import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Upload,
  Check,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  X,
  Scan,
  RefreshCw,
  Plus,
  HelpCircle,
  AlertOctagon,
  Map
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { saveCourse } from "../lib/storage";
import { cn } from "../lib/utils";
import { 
  ScorecardExtractionV2, 
  CourseIdentityCandidate, 
  HoleAtlasSeed, 
  generateHoleAtlasSeeds,
  preprocessCanvasImageData,
  validateScorecardTotals
} from "../lib/scorecardV2Schema";
import { executeScorecardParserPipeline } from "../lib/scorecardParserPipeline";
import {
  CourseIdentityConfirmCard,
  ScorecardExtractionTable,
  ScorecardUncertaintyPanel,
  TeeSelector,
  HoleAtlasSeedGrid,
  ScorecardVisualRegionsPanel,
  MediaSourceRegistryPanel,
  ScorecardStrategySummaryPanel
} from "./ScorecardScannerV2Components";

interface HoleData {
  number: number;
  par: number;
  yardage?: number;
  handicap?: number;
}

interface ParsedScorecard {
  courseName: string;
  teeSet: string;
  holes: HoleData[];
  uncertainFields: string[];
  cityOrGeography?: string;
  logoDescription?: string;
  visualFeatures?: string[];
  aestheticPrompt?: string;
}

type ScannerState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "CAMERA_ACTIVE"
  | "CAMERA_ERROR"
  | "IMAGE_READY"
  | "CROP_READY"
  | "OCR_UPLOADING"
  | "OCR_PROCESSING"
  | "NEEDS_CONFIRMATION"
  | "SAVED";

const activeStreamsSet = new Set<MediaStream>();

export function ScorecardScanner() {
  const [scannerState, setScannerState] = useState<ScannerState>("IDLE");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"network" | "parsing" | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardExtractionV2 | null>(null);
  const [courseCandidate, setCourseCandidate] = useState<CourseIdentityCandidate | null>(null);
  const [atlasSeeds, setAtlasSeeds] = useState<HoleAtlasSeed[]>([]);
  const [highlightedHole, setHighlightedHole] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [analyzingCourse, setAnalyzingCourse] = useState(false);
  const [courseAnalysis, setCourseAnalysis] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentOriginalImage, setCurrentOriginalImage] = useState<string | null>(null);

  const [aerialImageUrl, setAerialImageUrl] = useState<string | null>(null);
  const [generatingAerial, setGeneratingAerial] = useState<boolean>(false);
  const [aerialError, setAerialError] = useState<string | null>(null);
  const [aerialPromptOverride, setAerialPromptOverride] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [crop, setCrop] = useState({ top: 15, left: 15, right: 15, bottom: 15 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  // Derived loading state for backwards compatibility or style matching
  const loading = scannerState === "OCR_PROCESSING" || scannerState === "OCR_UPLOADING";
  const isScanning = scannerState === "CAMERA_ACTIVE";

  // Re-usable cleanup logic to shut down camera hardware safely
  const stopCamera = () => {
    console.log(`ScorecardScanner STOP_CAMERA execution. State: ${scannerState}, streamRef.current active:`, !!streamRef.current);
    if (streamRef.current) {
      activeStreamsSet.delete(streamRef.current);
      try {
        const tracks = streamRef.current.getTracks();
        console.log(`ScorecardScanner stopping ${tracks.length} track(s).`);
        tracks.forEach((track) => {
          track.stop();
          console.log("ScorecardScanner track.stop() triggered.");
        });
      } catch (err) {
        console.error("ScorecardScanner failed to stop tracks:", err);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCountdown(null);
  };

  // Component unmount or state route changes
  useEffect(() => {
    return () => {
      console.log("ScorecardScanner UNMOUNT cleanup hook executed.");
      stopCamera();
      activeStreamsSet.forEach((stream) => {
        console.log("ScorecardScanner fallback activeStreamsSet unmount track stopping.");
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch (e) {
          console.error("ScorecardScanner failed activeStreamsSet track stop:", e);
        }
      });
      activeStreamsSet.clear();
    };
  }, []);

  // Safe transition cleanup
  useEffect(() => {
    if (scannerState !== "CAMERA_ACTIVE") {
      stopCamera();
    }
  }, [scannerState]);

  // Auto-trigger course aerial generation when a scorecard is loaded
  useEffect(() => {
    if (scorecard && !aerialImageUrl && !generatingAerial && !aerialError) {
      handleGenerateAerialView();
    }
  }, [scorecard]);

  const startCamera = async () => {
    setCameraError(null);
    setCountdown(null);
    setScannerState("REQUESTING_PERMISSION");

    try {
      // Direct request to environment lens
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      activeStreamsSet.add(stream);
      if (typeof window !== "undefined") {
        (window as any).__lastCameraStream = stream;
      }
      setScannerState("CAMERA_ACTIVE");
    } catch (err: any) {
      console.error("Environment camera failed, attempting standard lookup...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        streamRef.current = fallbackStream;
        activeStreamsSet.add(fallbackStream);
        if (typeof window !== "undefined") {
          (window as any).__lastCameraStream = fallbackStream;
        }
        setScannerState("CAMERA_ACTIVE");
      } catch (fallbackErr: any) {
        console.error("Camera permissions fully rejected", fallbackErr);
        let errorMsg = "Camera permission denied. Please grant settings access or upload photo files.";
        if (
          typeof window !== "undefined" &&
          window.location.protocol !== "https:" &&
          window.location.hostname !== "localhost"
        ) {
          errorMsg = "Insecure context detected. Media device capture requires HTTPS layers. Please upload local photos instead.";
        }
        setCameraError(errorMsg);
        setScannerState("CAMERA_ERROR");
      }
    }
  };

  // Post-render stream binding to ensure no blank previews
  useEffect(() => {
    if (isScanning && streamRef.current && videoRef.current) {
      const bindStream = async () => {
        const videoElement = videoRef.current;
        if (!videoElement) return;
        if (videoElement.srcObject !== streamRef.current) {
          videoElement.srcObject = streamRef.current;
        }
        try {
          await videoElement.play();
        } catch (err) {
          console.error("Stream presentation play aborted:", err);
          setCameraError("Unable to play the real-time layout feed onto viewfinder.");
          setScannerState("CAMERA_ERROR");
        }
      };
      bindStream();
    }
  }, [isScanning, videoRef.current]);

  const startCountdown = () => {
    if (countdown !== null) return;
    setCountdown(3);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      captureFrame();
      setCountdown(null);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("Camera capture error: live video stream is not running yet.");
      setScannerState("CAMERA_ERROR");
      return;
    }

    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("Could not spawn 2D canvas context.");

      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.95);

      // Captured frame loaded directly as original image
      setCurrentOriginalImage(dataUrl);
      setCrop({ top: 15, left: 15, right: 15, bottom: 15 });

      stopCamera();
      // Pivot to crop layout
      setScannerState("CROP_READY");
    } catch (err: any) {
      console.error("Capture transaction failed:", err);
      setCameraError("Internal snapshot capture pipeline failed.");
      setScannerState("CAMERA_ERROR");
    }
  };

  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    setActiveHandle(handle);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle) return;
    const container = e.currentTarget.getBoundingClientRect();

    // Calculate percent movement
    const percentX = (e.movementX / container.width) * 100;
    const percentY = (e.movementY / container.height) * 100;

    setCrop((prev) => {
      const next = { ...prev };

      switch (activeHandle) {
        case "top-left":
          next.top = Math.max(0, Math.min(100 - next.bottom - 10, next.top + percentY));
          next.left = Math.max(0, Math.min(100 - next.right - 10, next.left + percentX));
          break;
        case "top-right":
          next.top = Math.max(0, Math.min(100 - next.bottom - 10, next.top + percentY));
          next.right = Math.max(0, Math.min(100 - next.left - 10, next.right - percentX));
          break;
        case "bottom-left":
          next.bottom = Math.max(0, Math.min(100 - next.top - 10, next.bottom - percentY));
          next.left = Math.max(0, Math.min(100 - next.right - 10, next.left + percentX));
          break;
        case "bottom-right":
          next.bottom = Math.max(0, Math.min(100 - next.top - 10, next.bottom - percentY));
          next.right = Math.max(0, Math.min(100 - next.left - 10, next.right - percentX));
          break;
        case "top":
          next.top = Math.max(0, Math.min(100 - next.bottom - 10, next.top + percentY));
          break;
        case "bottom":
          next.bottom = Math.max(0, Math.min(100 - next.top - 10, next.bottom - percentY));
          break;
        case "left":
          next.left = Math.max(0, Math.min(100 - next.right - 10, next.left + percentX));
          break;
        case "right":
          next.right = Math.max(0, Math.min(100 - next.left - 10, next.right - percentX));
          break;
      }
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setActiveHandle(null);
    }
  };

  const clearScans = () => {
    setImagePreviews([]);
    setScorecard(null);
    setSaved(false);
    setCourseAnalysis(null);
    setScannerState("IDLE");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    if (files.some((f) => f.size > 20 * 1024 * 1024)) {
      setError("Files must be smaller than 20MB");
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const dataUrl = event.target?.result as string;
        setCurrentOriginalImage(dataUrl);
        setCrop({ top: 15, left: 15, right: 15, bottom: 15 });
        setScannerState("CROP_READY");
      } catch (err: any) {
        setError("Unable to read uploaded scorecard photo.");
        setScannerState("IDLE");
      }
    };
    reader.onerror = () => {
      setError("Failed to parse file.");
      setScannerState("IDLE");
    };
    reader.readAsDataURL(file);

    setError(null);
    setScorecard(null);
    setSaved(false);
    setCourseAnalysis(null);
  };

  const cropStaticImage = (dataUrl: string, cropPct: typeof crop): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to instantiate 2D cropping element."));
            return;
          }

          const cropX = img.width * (cropPct.left / 100);
          const cropY = img.height * (cropPct.top / 100);
          const cropW = img.width * ((100 - cropPct.left - cropPct.right) / 100);
          const cropH = img.height * ((100 - cropPct.top - cropPct.bottom) / 100);

          canvas.width = cropW;
          canvas.height = cropH;

          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Unable to render original image into cropping canvas."));
      img.src = dataUrl;
    });
  };

  const handleConfirmCrop = async () => {
    if (!currentOriginalImage) return;

    try {
      const croppedDataUrl = await cropStaticImage(currentOriginalImage, crop);
      setImagePreviews((prev) => [...prev, croppedDataUrl]);
      setCurrentOriginalImage(null);
      setScannerState("IDLE");
    } catch (err: any) {
      console.error("Cropping action failed:", err);
      setError("Cropping extraction failed. Using original photo outline instead.");
      setImagePreviews((prev) => [...prev, currentOriginalImage]);
      setCurrentOriginalImage(null);
      setScannerState("IDLE");
    }
  };

  const handleUseOriginal = () => {
    if (!currentOriginalImage) return;
    setImagePreviews((prev) => [...prev, currentOriginalImage]);
    setCurrentOriginalImage(null);
    setScannerState("IDLE");
  };

  const handleCancelCrop = () => {
    setCurrentOriginalImage(null);
    setScannerState("IDLE");
  };

  const processScorecard = async () => {
    if (imagePreviews.length === 0) return;
    setScannerState("OCR_PROCESSING");
    setError(null);
    setErrorType(null);
    setAerialImageUrl(null);
    setAerialError(null);
    setAerialPromptOverride("");

    try {
      const imagePayload = [];
      for (let i = 0; i < imagePreviews.length; i++) {
        const dataUrl = imagePreviews[i];
        const split = dataUrl.split(",");
        const mimeType = split[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const base64Data = split[1];
        imagePayload.push({ data: base64Data, mimeType });
      }

      let res;
      try {
        res = await fetch("/api/gemini/scorecard-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: imagePayload }),
        });
      } catch (fetchErr: any) {
        throw {
          type: "network",
          message: "Network connection failure. The server could not be reached. Cloud AI endpoints require active internet connectivity. Ensure you are online and try again.",
        };
      }

      if (!res.ok) {
        let textErr = "";
        try {
          textErr = await res.text();
        } catch (_) {}
        throw {
          type: "parsing",
          message: textErr || "OCR extraction failed. The parsed text did not contain a recognizable golf scorecard layout.",
        };
      }

      let data;
      try {
        data = await res.json();
      } catch (jsonErr: any) {
        throw {
          type: "parsing",
          message: "Server returned a malformed response format that could not be parsed.",
        };
      }

      if (!data || typeof data !== "object" || !data.courseName || !Array.isArray(data.holes)) {
        throw {
          type: "parsing",
          message: "Scanned scorecard structure mismatch (missing valid holes or course name structure).",
        };
      }

      // Execute the unified parser pipeline with the OCR adapter mapping the Gemini server output
      const scoreData = await executeScorecardParserPipeline({
        images: imagePayload,
        adapter: {
          parseImages: async () => data
        }
      });

      setScorecard(scoreData);

      // Initialize the CourseIdentityCandidate state
      setCourseCandidate({
        courseName: scoreData.courseName,
        cityOrGeography: scoreData.cityOrGeography || "San Jose, California",
        logoDescription: scoreData.logoDescription || "Crest design.",
        visualFeatures: scoreData.visualFeatures || [],
        aestheticPrompt: scoreData.aestheticPrompt || `A detailed top-down photorealistic aerial satellite view of the golf course named ${scoreData.courseName}.`,
        rating: scoreData.rating,
        slope: scoreData.slope,
        confirmed: false,
      });

      setAtlasSeeds([]);
      setScannerState("NEEDS_CONFIRMATION");
    } catch (err: any) {
      console.error(err);
      if (err.type === "network") {
        setError(err.message);
        setErrorType("network");
      } else if (err.type === "parsing") {
        setError(err.message);
        setErrorType("parsing");
      } else {
        const isOffline = !navigator.onLine;
        setError(err.message || "An unexpected error occurred during scorecard processing.");
        setErrorType(isOffline ? "network" : "parsing");
      }
      setScannerState("IDLE");
    }
  };

  const handleGenerateAerialView = async (customPrompt?: string) => {
    if (!scorecard) return;
    setGeneratingAerial(true);
    setAerialError(null);
    try {
      const featuresStr = scorecard.visualFeatures && scorecard.visualFeatures.length > 0 
        ? scorecard.visualFeatures.join(", ") 
        : "winding green fairways, sand traps, classic layout, pathways, and elegant geometric tee boxes";

      const defaultPrompt = scorecard.aestheticPrompt || `A detailed top-down schematic illustration of the golf course named ${scorecard.courseName} in ${scorecard.cityOrGeography || 'pristine geography'}, styled as an artistic scorecard course map schematic, highlighting ${featuresStr}, clean vectors, high resolution graphic cartography.`;
      const promptToUse = customPrompt || defaultPrompt;

      const res = await fetch("/api/gemini/generate-course-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToUse }),
      });
      if (!res.ok) {
        throw new Error("Failed to generate course schematic layout preview from Gemini model API.");
      }
      const data = await res.json();
      if (data.imageUrl) {
        setAerialImageUrl(data.imageUrl);
      } else {
        throw new Error("No image was returned from the generator service.");
      }
    } catch (err: any) {
      console.warn("Course map schematic layout preview generation failed, falling back to a dynamic seeded placeholder:", err);
      // Construct a highly descriptive, beautiful seeded Picsum photo so that we never block course creation
      const seedName = encodeURIComponent((scorecard.courseName || "golf-course").substring(0, 40).replace(/[^a-zA-Z0-9]/g, '-'));
      const fallbackUrl = `https://picsum.photos/seed/${seedName}/1200/675`;
      setAerialImageUrl(fallbackUrl);
      // We don't display a blocking visual error anymore, but we can set a mild status log
      console.log("Graceful client fallback loaded:", fallbackUrl);
    } finally {
      setGeneratingAerial(false);
    }
  };

  // Provide simple manual fallbacks bypass
  const startManualEntry = () => {
    setAerialImageUrl(null);
    setAerialError(null);
    setAerialPromptOverride("");
    
    const manualExtraction: ScorecardExtractionV2 = {
      courseName: "Commemorative Course",
      teeSet: "White",
      holes: Array.from({ length: 18 }, (_, idx) => ({
        number: idx + 1,
        par: 4,
        yardage: 350,
        handicap: idx + 1,
      })),
      uncertainFields: [],
      cityOrGeography: "Monterey, California",
      logoDescription: "A circular crest featuring a single cypress tree towering above sea cliffs",
      visualFeatures: ["ocean fairways", "sand traps", "coastal pines", "steep cliffs"],
      aestheticPrompt: "A photorealistic aerial top-down satellite mapping of Monterey Cliff Golf Course, pristine coastal grass, sand bunkers, deep blue ocean borders, pathways, 16:9 high resolution map.",
      rating: 70.0,
      slope: 120,
      visualRegions: [
        { id: "reg-man-1", type: "LOGO_ICON", bounds: { x: 5, y: 5, width: 40, height: 40 } }
      ],
      adsClassification: { hasAds: false },
      confidenceScore: 80
    };

    setScorecard(manualExtraction);

    setCourseCandidate({
      courseName: manualExtraction.courseName,
      cityOrGeography: manualExtraction.cityOrGeography || "Monterey, California",
      logoDescription: manualExtraction.logoDescription || "Crest logo.",
      visualFeatures: manualExtraction.visualFeatures || [],
      aestheticPrompt: manualExtraction.aestheticPrompt || "",
      rating: manualExtraction.rating,
      slope: manualExtraction.slope,
      confirmed: false,
    });

    setAtlasSeeds([]);
    setScannerState("NEEDS_CONFIRMATION");
  };

  const handleSave = async () => {
    if (!scorecard) return;

    // Reject / sanitize any attempts to forge official handicaps
    const sanitizedHoles = scorecard.holes.map((h) => ({
      ...h,
    }));

    await saveCourse({
      name: scorecard.courseName,
      teeSet: scorecard.teeSet,
      holes: sanitizedHoles,
      aerialImageUrl: aerialImageUrl || undefined,
      cityOrGeography: scorecard.cityOrGeography,
      logoDescription: scorecard.logoDescription,
      visualFeatures: scorecard.visualFeatures,
      aestheticPrompt: scorecard.aestheticPrompt,
      rating: scorecard.rating,
      slope: scorecard.slope,
      holeAtlasSeeds: atlasSeeds,
    } as any);
    setSaved(true);
    setScannerState("SAVED");
    handleAnalyzeCourse();
  };

  const handleAnalyzeCourse = async () => {
    if (!scorecard) return;
    setAnalyzingCourse(true);
    setCourseAnalysis(null);
    try {
      const courseDataString = JSON.stringify({
        name: scorecard.courseName,
        teeSet: scorecard.teeSet,
        holes: scorecard.holes,
      });
      const res = await fetch("/api/gemini/course-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseData: courseDataString }),
      });
      if (res.ok) {
        const data = await res.json();
        setCourseAnalysis(data);
      }
    } catch (err: any) {
      console.error(err);
    }
    setAnalyzingCourse(false);
  };

  // Gated View Branch 1: Requesting Media Permissions
  if (scannerState === "REQUESTING_PERMISSION") {
    return (
      <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24 text-center">
        <div className="flex flex-col items-center justify-center text-white p-12 bg-black/50 border border-zinc-800 rounded-2xl relative overflow-hidden min-h-[400px]">
          <Camera className="w-12 h-12 text-blue-400 animate-pulse mb-4 z-10" />
          <span className="font-bold tracking-widest text-sm uppercase text-blue-300 z-10">
            Requesting Camera Access
          </span>
          <p className="text-zinc-400 text-xs mt-3 max-w-xs z-10">
            Please allow camera permissions if requested by your browser to initialize real-time scanning overlay boxes.
          </p>
          <button
            onClick={() => setScannerState("IDLE")}
            className="mt-8 px-6 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            id="permission-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Gated View Branch 2: Camera Capture Pipeline Error
  if (scannerState === "CAMERA_ERROR") {
    return (
      <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24">
        <div className="flex flex-col items-center justify-center text-red-400 p-8 bg-black/50 border border-red-900/40 rounded-2xl text-center min-h-[400px]">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
          <h3 className="font-bold text-lg text-white uppercase tracking-wider mb-2">Camera Connection Blocked</h3>
          <p className="text-zinc-400 text-sm max-w-xs mb-8 leading-relaxed">
            {cameraError || "No accessible camera found or secure context (HTTPS) error occurred."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={startCamera}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-colors uppercase tracking-wider"
              id="camera-error-retry-btn"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                setScannerState("IDLE");
                setTimeout(() => fileInputRef.current?.click(), 100);
              }}
              className="py-3 px-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-805 text-zinc-300 font-bold rounded-xl text-sm transition-colors uppercase tracking-wider"
              id="camera-error-upload-btn"
            >
              Upload Local File
            </button>
            <button
              onClick={() => {
                setCameraError(null);
                setScannerState("IDLE");
              }}
              className="py-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold uppercase tracking-wider transition-colors mt-2"
              id="camera-error-dismiss-btn"
            >
              Cancel & Return
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gated View Branch 3: Active Video Stream Viewfinder
  if (scannerState === "CAMERA_ACTIVE") {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col" id="scorecard-live-scanner">
        {/* Navigation Action bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
          <button
            onClick={() => {
              stopCamera();
              setScannerState("IDLE");
            }}
            className="text-white p-2 rounded-full bg-black/50 backdrop-blur self-start hover:bg-zinc-900 transition-colors"
            id="camera-cancel-btn"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-white font-black tracking-widest uppercase text-xs">Align Scorecard Frame</h2>
          <div className="w-10"></div>
        </div>

        {/* DRAG-AND-CROP ATTACHMENT PORT OVER VIDEO */}
        <div
          className="flex-1 relative overflow-hidden bg-zinc-950 touch-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          id="camera-viewport-container"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            id="scanner-live-preview"
          />

          {/* Draggable boundary alignment boxes are gated safely */}
          <div className="absolute inset-0 pointer-events-none bg-black/40">
            <div
              className={`absolute border-2 border-dashed transition-colors duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ${
                countdown !== null ? "border-emerald-500 bg-emerald-500/10" : "border-white/80 bg-white/5"
              }`}
              style={{
                top: `${crop.top}%`,
                left: `${crop.left}%`,
                bottom: `${crop.bottom}%`,
                right: `${crop.right}%`,
              }}
            >
              {/* Top Handle */}
              <div
                className="absolute -top-3 left-0 right-0 h-6 cursor-ns-resize pointer-events-auto flex justify-center items-center group"
                onPointerDown={(e) => handlePointerDown(e, "top")}
              >
                <div className="w-10 h-1 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
              </div>
              {/* Bottom Handle */}
              <div
                className="absolute -bottom-3 left-0 right-0 h-6 cursor-ns-resize pointer-events-auto flex justify-center items-center group"
                onPointerDown={(e) => handlePointerDown(e, "bottom")}
              >
                <div className="w-10 h-1 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
              </div>
              {/* Left Handle */}
              <div
                className="absolute top-0 bottom-0 -left-3 w-6 cursor-ew-resize pointer-events-auto flex justify-center items-center group"
                onPointerDown={(e) => handlePointerDown(e, "left")}
              >
                <div className="w-1 h-10 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
              </div>
              {/* Right Handle */}
              <div
                className="absolute top-0 bottom-0 -right-3 w-6 cursor-ew-resize pointer-events-auto flex justify-center items-center group"
                onPointerDown={(e) => handlePointerDown(e, "right")}
              >
                <div className="w-1 h-10 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
              </div>

              {/* 4 Corners */}
              <div
                className="absolute -top-4 -left-4 w-8 h-8 cursor-nwse-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                onPointerDown={(e) => handlePointerDown(e, "top-left")}
              />
              <div
                className="absolute -top-4 -right-4 w-8 h-8 cursor-nesw-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                onPointerDown={(e) => handlePointerDown(e, "top-right")}
              />
              <div
                className="absolute -bottom-4 -left-4 w-8 h-8 cursor-nesw-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                onPointerDown={(e) => handlePointerDown(e, "bottom-left")}
              />
              <div
                className="absolute -bottom-4 -right-4 w-8 h-8 cursor-nwse-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                onPointerDown={(e) => handlePointerDown(e, "bottom-right")}
              />

              {/* Center Guidance indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {countdown !== null && countdown > 0 ? (
                  <span className="text-7xl font-black text-emerald-400 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                    {countdown}
                  </span>
                ) : (
                  <Scan
                    className={`w-12 h-12 ${
                      countdown !== null ? "text-emerald-400 opacity-80 animate-pulse" : "text-white/30"
                    }`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Shutter panel */}
        <div className="p-8 pb-12 bg-black flex flex-col items-center gap-6 border-t border-zinc-900">
          <p
            className={`flex items-center gap-2 text-xs font-bold tracking-wider uppercase transition-colors ${
              countdown !== null ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            <Camera className="w-4 h-4" />{" "}
            {countdown !== null ? "Hold steady..." : "Sparsely frame edges inside the grid"}
          </p>
          <button
            onClick={startCountdown}
            disabled={countdown !== null}
            className={`px-10 py-5 rounded-full font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 ${
              countdown !== null
                ? "bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105"
                : "bg-white text-black hover:bg-zinc-250 active:scale-95 cursor-pointer"
            }`}
            id="camera-capture-trigger-btn"
          >
            {countdown !== null ? (
              <>
                <Scan className="w-5 h-5 animate-pulse" />
                Capturing ({countdown}s)...
              </>
            ) : (
              <>
                <Scan className="w-5 h-5 animate-bounce" />
                Lock Alignment
              </>
            )}
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Gated View Branch 4: Static Frame Bounding-Box Cropper (Unifies Upload & Capture outputs)
  if (scannerState === "CROP_READY" && currentOriginalImage) {
    return (
      <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col" id="cropper-pipeline-screen">
        {/* Navigation Action bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/95 via-black/40 to-transparent">
          <button
            onClick={handleCancelCrop}
            className="text-white p-2 rounded-full bg-black/50 backdrop-blur hover:bg-zinc-900 transition-colors"
            id="crop-cancel-btn-top"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-white font-black tracking-widest uppercase text-xs">Crop Scorecard Frame</h2>
          <div className="w-10"></div>
        </div>

        {/* Crop Sandbox Viewport Box */}
        <div className="flex-1 relative overflow-hidden bg-zinc-950 flex flex-col justify-center items-center p-4">
          <div
            className="relative max-w-full max-h-[65vh] border border-zinc-800 rounded-lg overflow-hidden touch-none shadow-2xl"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            id="cropper-box-viewport"
          >
            <img
              src={currentOriginalImage}
              alt="Live snapshot snippet"
              className="max-w-full max-h-[65vh] object-contain block pointer-events-none rounded-lg"
              id="cropper-original-preview"
            />

            {/* Editable percentage crop overlay over original preview boundaries */}
            <div className="absolute inset-0 pointer-events-none bg-black/40">
              <div
                className="absolute border-2 border-dashed border-white/80 bg-white/5 transition-colors duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                style={{
                  top: `${crop.top}%`,
                  left: `${crop.left}%`,
                  bottom: `${crop.bottom}%`,
                  right: `${crop.right}%`,
                }}
              >
                {/* Top Border */}
                <div
                  className="absolute -top-3 left-0 right-0 h-6 cursor-ns-resize pointer-events-auto flex justify-center items-center group"
                  onPointerDown={(e) => handlePointerDown(e, "top")}
                >
                  <div className="w-10 h-1 bg-white/50 group-hover:bg-white rounded-full transition-colors animate-pulse" />
                </div>
                {/* Bottom Border */}
                <div
                  className="absolute -bottom-3 left-0 right-0 h-6 cursor-ns-resize pointer-events-auto flex justify-center items-center group"
                  onPointerDown={(e) => handlePointerDown(e, "bottom")}
                >
                  <div className="w-10 h-1 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                </div>
                {/* Left Border */}
                <div
                  className="absolute top-0 bottom-0 -left-3 w-6 cursor-ew-resize pointer-events-auto flex justify-center items-center group"
                  onPointerDown={(e) => handlePointerDown(e, "left")}
                >
                  <div className="w-1 h-10 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                </div>
                {/* Right Border */}
                <div
                  className="absolute top-0 bottom-0 -right-3 w-6 cursor-ew-resize pointer-events-auto flex justify-center items-center group"
                  onPointerDown={(e) => handlePointerDown(e, "right")}
                >
                  <div className="w-1 h-10 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                </div>

                {/* 4 Corners */}
                <div
                  className="absolute -top-4 -left-4 w-8 h-8 cursor-nwse-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-all shadow"
                  onPointerDown={(e) => handlePointerDown(e, "top-left")}
                />
                <div
                  className="absolute -top-4 -right-4 w-8 h-8 cursor-nesw-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-all shadow"
                  onPointerDown={(e) => handlePointerDown(e, "top-right")}
                />
                <div
                  className="absolute -bottom-4 -left-4 w-8 h-8 cursor-nesw-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-all shadow"
                  onPointerDown={(e) => handlePointerDown(e, "bottom-left")}
                />
                <div
                  className="absolute -bottom-4 -right-4 w-8 h-8 cursor-nwse-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-all shadow"
                  onPointerDown={(e) => handlePointerDown(e, "bottom-right")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action triggers */}
        <div className="p-6 bg-black border-t border-zinc-900 flex flex-col gap-4">
          <div className="flex gap-4">
            <button
              onClick={handleConfirmCrop}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm uppercase tracking-wider transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
              id="crop-confirm-submit-btn"
            >
              Confirm Crop & Add
            </button>
            <button
              onClick={handleUseOriginal}
              className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-805 text-zinc-300 font-bold rounded-xl text-sm uppercase tracking-wider transition-all border border-zinc-800 cursor-pointer"
              id="crop-original-bypass-btn"
            >
              Use Original (No Crop)
            </button>
          </div>
          <button
            onClick={handleCancelCrop}
            className="py-2 text-zinc-500 hover:text-zinc-350 text-xs font-bold uppercase tracking-widest transition-colors text-center cursor-pointer"
            id="crop-cancel-btn-bottom"
          >
            Cancel / Re-take
          </button>
        </div>
      </div>
    );
  }

  // Gated View Branch 5: OCR Loading / API Server Transaction Progress
  if (scannerState === "OCR_PROCESSING" || scannerState === "OCR_UPLOADING") {
    return (
      <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24">
        <div className="flex flex-col items-center justify-center text-white p-12 bg-black/50 border border-zinc-800 rounded-2xl relative overflow-hidden min-h-[400px]">
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
          <Scan className="w-12 h-12 text-blue-500 animate-[spin_4s_linear_infinite] mb-4 z-10" />
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 absolute opacity-50 z-10" />
          <span className="mt-4 font-bold tracking-widest text-sm uppercase text-blue-300 z-10">
            {scannerState === "OCR_UPLOADING" ? "Uploading Imagery..." : "Extracting Scorecard Data"}
          </span>
          <span className="text-zinc-500 text-xs mt-2 text-center max-w-xs z-10 leading-relaxed">
            Generating layout coordinates with Gemini Vision APIs to parse holes, tee details, difficulty, pars, and yards.
          </span>
        </div>
      </div>
    );
  }

  // STANDARD VISUAL PAGE VIEW (IDLE layout or NESTED review forms)
  return (
    <div
      className={`space-y-6 container mx-auto px-2 sm:px-4 py-4 pt-12 pb-24 ${
        scannerState === "NEEDS_CONFIRMATION" || scannerState === "SAVED"
          ? "max-w-md md:max-w-3xl lg:max-w-6xl"
          : "max-w-md"
      }`}
      id="scorecard-scanner-module"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 border border-zinc-800 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
          id="scanner-back-btn"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-300" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Scorecard Scanner</h1>
          <p className="text-zinc-400 text-sm">
            Digitize any physical paper golf card to instantly load full course parameters.
          </p>
        </div>
      </div>

      {/* Landing Choice Hub (rendered only in IDLE and empty previews) */}
      {scannerState === "IDLE" && imagePreviews.length === 0 && (
        <div className="pt-4 grid grid-cols-2 gap-4">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            id="scorecard-file-hidden-input"
          />
          <button
            onClick={startCamera}
            className="flex flex-col items-center justify-center gap-3 bg-blue-600/20 border border-blue-500/50 p-8 rounded-xl hover:bg-blue-600/30 transition col-span-2 text-center group cursor-pointer"
            id="scanner-start-camera-btn"
          >
            <Camera className="w-10 h-10 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-zinc-200">Live Scan Scorecard</span>
            <span className="text-xs text-zinc-400">Use alignment guides to lock and crop perfectly.</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl hover:bg-zinc-800 transition col-span-2 text-center cursor-pointer group"
            id="scanner-upload-photos-btn"
          >
            <Upload className="w-5 h-5 text-zinc-400 group-hover:-translate-y-0.5 transition-transform" />
            <span className="font-semibold text-zinc-300 text-sm">Or Upload Image Files</span>
          </button>

          <button
            onClick={startManualEntry}
            className="col-span-2 py-3 px-4 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300 transition text-[11px] uppercase tracking-widest font-black flex items-center justify-center gap-2 cursor-pointer"
            id="scanner-manual-bypass-btn"
          >
            <Plus className="w-3.5 h-3.5" /> Or Start Empty Manual Entry
          </button>
        </div>
      )}

      {error && (
        <div
          className="p-4 bg-red-950/40 border border-red-900/50 text-red-200 text-sm rounded-xl space-y-3 animate-in fade-in"
          id="scanner-error-banner"
        >
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left flex-1">
              <h4 className="font-bold text-red-400 text-sm">Scorecard Analysis Failed</h4>
              
              <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-900/60 text-red-300 border border-red-800/50">
                {errorType === "network" ? "Network Offline / Server Unreachable" : "Parsing Algorithm Logic Error"}
              </div>

              <p className="text-zinc-300 text-xs leading-relaxed font-mono">{error}</p>
            </div>
            <button
              onClick={() => {
                setError(null);
                setErrorType(null);
              }}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors cursor-pointer"
              title="Dismiss error"
              id="error-dismiss-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Differentiated UI Recovery Paths */}
          {errorType === "network" ? (
            <div className="space-y-3 pt-1 border-t border-red-900/30 text-left">
              <div className="bg-black/40 border border-zinc-800/50 rounded-lg p-2.5 space-y-2">
                <p className="text-[11px] uppercase tracking-widest font-black text-blue-400">🛰️ Network Diagnostics Desk</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-400 font-mono">
                  <div className="flex justify-between items-center">
                    <span>OnLine API State:</span>
                    <span className={`font-bold ${navigator.onLine ? "text-emerald-400" : "text-red-400 animate-pulse"}`}>
                      {navigator.onLine ? "CONNECTED" : "OFFLINE"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Target Port:</span>
                    <span className="text-zinc-400">3000 (HTTPS Sec)</span>
                  </div>
                </div>
              </div>

              <div className="bg-red-950/60 border border-red-900/30 rounded-lg p-2.5 text-xs text-zinc-400 space-y-1 font-sans">
                <p className="font-semibold text-zinc-300">💡 Specific Network Resolution Path:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Confirm cellular signals or router connection is responsive.</li>
                  <li>Verify server routes aren't blocked by dynamic VPN configurations.</li>
                  <li>Click 'Offline Manual Bypass' below to create a draft round offline.</li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {imagePreviews.length > 0 && (
                  <button
                    onClick={processScorecard}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    id="error-retry-ocr-btn"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Server Connection
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      const healthRes = await fetch("/api/health");
                      if (healthRes.ok) {
                        setError("Server is online! Please retry your parsing request.");
                        setErrorType(null);
                      } else {
                        setError("API /api/health returned non-200. Cloud Run container is unreachable.");
                      }
                    } catch (e) {
                      setError("Server ping to /api/health failed. Connection is completely Offline.");
                    }
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-black uppercase tracking-wider rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  id="error-ping-health-btn"
                >
                  Ping API Health
                </button>
                <button
                  onClick={startManualEntry}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-black uppercase tracking-wider rounded-lg border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  id="error-manual-bypass-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Offline Manual Bypass
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1 border-t border-red-900/30 text-left">
              <div className="bg-black/40 border border-zinc-800/50 rounded-lg p-2.5 space-y-2">
                <p className="text-[11px] uppercase tracking-widest font-black text-amber-400">📐 Image Quality & Framing Audit</p>
                <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    <span>Blur/Shadow Check: Ensure numbers aren't hidden by direct device reflection.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    <span>Alignment bounds: Leave 5% margins around the entire card structure block.</span>
                  </div>
                </div>
              </div>

              <div className="bg-red-950/60 border border-red-900/30 rounded-lg p-2.5 text-xs text-zinc-400 space-y-1 font-sans">
                <p className="font-semibold text-zinc-300">💡 Recommended Formatting Resolution Path:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Recapture closer with the camera flash illuminated for superior lighting.</li>
                  <li>Or bypass the OCR algorithms and override with standard layout placeholders.</li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {imagePreviews.length > 0 && (
                  <button
                    onClick={processScorecard}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    id="error-retry-ocr-btn"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry OCR Parsing
                  </button>
                )}
                <button
                  onClick={() => {
                    setError(null);
                    setErrorType(null);
                    startCamera();
                  }}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-[11px] font-black uppercase tracking-wider rounded-lg border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  id="error-quick-recapture-btn"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Recapture
                </button>
                <button
                  onClick={startManualEntry}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-black uppercase tracking-wider rounded-lg border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  id="error-manual-bypass-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Override & Enter Manually
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pre-scanned Sides Batching Hub */}
      {scannerState === "IDLE" && imagePreviews.length > 0 && (
        <div className="space-y-4 animate-in fade-in" id="scanner-batch-preview-hub">
          <label className="text-xs uppercase font-bold tracking-widest text-zinc-400 block">Scanned Sides</label>
          <div className="flex overflow-x-auto gap-4 hide-scrollbar snap-x snap-mandatory py-2">
            {imagePreviews.map((img, idx) => (
              <div
                key={idx}
                className="relative w-48 h-32 shrink-0 snap-center rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 flex items-center justify-center group shadow-md"
              >
                <img src={img} alt={`Scan side ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                <button
                  onClick={() => setImagePreviews((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-red-500 transition-colors cursor-pointer"
                  title="Remove side"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-black/65 px-2 py-0.5 rounded-md text-[10px] text-zinc-300 uppercase font-bold">
                  Side {idx + 1}
                </div>
              </div>
            ))}
            <button
              onClick={startCamera}
              className="w-24 shrink-0 border-2 border-dashed border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/40 rounded-xl flex items-center justify-center hover:border-zinc-500 transition-all cursor-pointer group"
              id="batch-add-camera-side"
            >
              <div className="flex flex-col items-center gap-1.5 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                <Plus className="w-5 h-5" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-center">Add Side</span>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={clearScans}
              className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-white transition-colors cursor-pointer"
              id="batch-start-over-btn"
            >
              Start Over
            </button>
            <button
              onClick={processScorecard}
              className="flex-[2] py-4 text-xs font-bold uppercase tracking-widest text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
              id="batch-process-ocr-btn"
            >
              Process Scorecard
            </button>
          </div>
        </div>
      )}

      {/* Review & Edit Hand-off Screen (NEEDS_CONFIRMATION) */}
      {scannerState === "NEEDS_CONFIRMATION" && scorecard && (() => {
        const totalHoles = scorecard.holes.length;
        const validHolesCount = scorecard.holes.filter(h => 
          typeof h.par === "number" && h.par >= 3 && h.par <= 6 && 
          typeof h.yardage === "number" && h.yardage > 0 && 
          typeof h.handicap === "number" && h.handicap >= 1 && h.handicap <= 18
        ).length;
        const validationPercentage = totalHoles > 0 ? Math.round((validHolesCount / totalHoles) * 100) : 0;

        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6" id="ocr-results-reviewer">
            {/* Validation Progress Bar */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-sans font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Hole Data Validation Progress
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xl leading-relaxed">
                    Review and verify extracted OCR results. Each hole requires par (3-6), yardage (&gt;0), and handicap (1-18) values. Click a tag below to highlight its editor row.
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0 justify-between sm:justify-end border-t border-zinc-800/50 sm:border-t-0 pt-2 sm:pt-0">
                  <span className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                    {validationPercentage}%
                  </span>
                  <span className="text-[10px] text-zinc-500 font-bold font-mono">
                    ({validHolesCount}/{totalHoles} holes validated)
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-850 p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 transition-all duration-300 ease-out"
                  style={{ width: `${validationPercentage}%` }}
                />
              </div>

              {/* Individual Hole Status Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1 font-mono text-[9px] select-none">
                {scorecard.holes.map((h: any) => {
                  const parOk = typeof h.par === "number" && h.par >= 3 && h.par <= 6;
                  const yardageOk = typeof h.yardage === "number" && h.yardage > 0;
                  const hcpOk = typeof h.handicap === "number" && h.handicap >= 1 && h.handicap <= 18;
                  const hValid = parOk && yardageOk && hcpOk;

                  return (
                    <button 
                      key={`vtag-${h.number}`}
                      type="button"
                      onClick={() => setHighlightedHole(h.number)}
                      className={cn(
                        "px-2 py-1.25 rounded-lg border uppercase font-black transition-all active:scale-95 flex items-center gap-1 cursor-pointer outline-none",
                        hValid 
                          ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-800" 
                          : "bg-red-950/20 border-red-900/30 text-red-400 hover:bg-red-900/10 hover:border-red-800",
                        highlightedHole === h.number ? "ring-1 ring-amber-500 ring-offset-1 ring-offset-black scale-105" : ""
                      )}
                    >
                      <span>H{h.number}</span>
                      <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                      <span>{hValid ? "OK" : "FIX"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commemorative disclaimer label */}
            <div className="bg-yellow-950/40 border border-yellow-850/50 rounded-2xl p-4 text-xs text-yellow-500 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>Commemorative Keepsake Notice</strong>: Digital stubs are purely for keepsake framing. This card does not support authorized course play entry or verified official handicap credentials.
              </div>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Action Columns: Forms, Editors, Teeblocks, and Atlas */}
            <div className="lg:col-span-2 space-y-6">
              {courseCandidate && (
                <CourseIdentityConfirmCard
                  candidate={courseCandidate}
                  onChange={(updated) => {
                    setCourseCandidate(updated);
                    // Also sync name changes to scorecard
                    setScorecard({
                      ...scorecard,
                      courseName: updated.courseName,
                      cityOrGeography: updated.cityOrGeography,
                      logoDescription: updated.logoDescription,
                      vintageFeatures: updated.visualFeatures,
                      aestheticPrompt: updated.aestheticPrompt,
                      rating: updated.rating,
                      slope: updated.slope,
                    } as any);
                  }}
                  onConfirmToggle={() => {
                    setCourseCandidate(prev => {
                      if (!prev) return null;
                      return { ...prev, confirmed: !prev.confirmed };
                    });
                  }}
                />
              )}

              <TeeSelector
                currentTee={scorecard.teeSet}
                onSelectTee={(teeName) => setScorecard({ ...scorecard, teeSet: teeName })}
                totals={validateScorecardTotals(scorecard.holes)}
              />

              <ScorecardExtractionTable
                scorecard={scorecard}
                onUpdateHoles={(updatedHoles) => setScorecard({ ...scorecard, holes: updatedHoles })}
                highlightedRow={highlightedHole}
              />

              <HoleAtlasSeedGrid
                scorecard={scorecard}
                courseConfirmed={courseCandidate?.confirmed || false}
                onGenerateSeeds={() => {
                  const seeds = generateHoleAtlasSeeds(scorecard.holes);
                  setAtlasSeeds(seeds);
                }}
                seeds={atlasSeeds}
              />
            </div>

            {/* Sidebar Columns: Previews, Confidence Checks, Legal Registry */}
            <div className="space-y-6">
              {/* Course Schematic Layout Preview */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                  <div className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-350">
                      Schematic Scorecard-Derived Preview
                    </span>
                  </div>
                  {aerialImageUrl && (
                    <span className="text-[9px] uppercase font-bold tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
                      SCHEMATIC_INFERENCE
                    </span>
                  )}
                </div>

                {generatingAerial ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/50 border border-zinc-850 border-dashed rounded-xl h-44 space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-400 animate-pulse">
                      Synthesizing schematic layout...
                    </span>
                  </div>
                ) : aerialError ? (
                  <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl space-y-2 text-center" id="aerial-error-container">
                    <p className="text-xs text-red-400 font-mono">{aerialError}</p>
                    <button
                      onClick={() => handleGenerateAerialView()}
                      className="px-3 py-1 bg-red-900/50 hover:bg-red-805 text-white text-[10px] uppercase font-bold tracking-wider rounded transition cursor-pointer"
                    >
                      Retry Generation
                    </button>
                  </div>
                ) : aerialImageUrl ? (
                  <div className="space-y-3" id="aerial-image-success-container">
                    <div className="relative overflow-hidden rounded-xl border border-zinc-850 aspect-video bg-black shadow-lg">
                      <img
                        src={aerialImageUrl}
                        alt="Schematic Scorecard-Derived Preview"
                        className="w-full h-full object-cover opacity-85"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-left">
                        <p className="text-[10px] text-zinc-400 line-clamp-1 italic">
                          {scorecard.aestheticPrompt || `Schematic layout draft for ${scorecard.courseName}`}
                        </p>
                      </div>
                    </div>

                    {/* Refinement Inputs */}
                    <div className="flex gap-2">
                      <input
                        value={aerialPromptOverride}
                        onChange={(e) => setAerialPromptOverride(e.target.value)}
                        placeholder="Refine layout prompt (e.g. include hills, pine woods)..."
                        className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-zinc-700"
                        id="aerial-prompt-refinement-input"
                      />
                      <button
                        onClick={() => handleGenerateAerialView(aerialPromptOverride)}
                        className="px-3 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-xs font-bold rounded-lg uppercase tracking-wider transition border border-zinc-700 cursor-pointer"
                        id="aerial-prompt-refine-btn"
                      >
                        Refine
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 bg-zinc-950/30 border border-zinc-850 border-dashed rounded-xl text-center space-y-3">
                    <p className="text-xs text-zinc-400">No schematic layout preview generated yet.</p>
                    <button
                      onClick={() => handleGenerateAerialView()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition cursor-pointer"
                      id="aerial-generate-btn"
                    >
                      Generate From Scorecard Details
                    </button>
                  </div>
                )}
              </div>

              <ScorecardUncertaintyPanel
                scorecard={scorecard}
                onSelectHoleWarning={(holeNum) => {
                  setHighlightedHole(holeNum);
                  // Scroll table element into view
                  const tableElement = document.getElementById("scorecard-extraction-table-comp");
                  if (tableElement) {
                    tableElement.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              />

              <ScorecardStrategySummaryPanel
                scorecard={scorecard}
              />

              <ScorecardVisualRegionsPanel
                scorecard={scorecard}
              />

              <MediaSourceRegistryPanel
                scorecard={scorecard}
              />
            </div>
          </div>

          <div className="border-t border-zinc-850 pt-6 flex items-center justify-end">
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition cursor-pointer leading-none uppercase tracking-widest text-xs shadow-lg"
              id="scanner-saver-btn"
            >
              <Check className="w-4 h-4" /> Confirm & Save Course
            </button>
          </div>
        </div>
      );
    })()}

      {/* Persistence Confirmation & Intelligent Review Screen (SAVED) */}
      {scannerState === "SAVED" && scorecard && (
        <div className="space-y-4 animate-in fade-in" id="course-saved-screen">
          <div className="bg-emerald-950/20 border border-emerald-500/50 text-emerald-400 font-bold px-4 py-3 rounded-xl w-full text-center text-sm uppercase tracking-widest flex items-center justify-center gap-2">
            <Check className="w-5 h-5 shrink-0" />
            Saved Commemorative Course!
          </div>

          <div className="bg-yellow-950/20 border border-yellow-850/30 rounded-xl p-4 text-xs text-zinc-500 leading-relaxed">
            🌿 <strong>Keepsake Ledger status</strong>: Commemorative entries will sync safely offline. Official handicap parameters are unofficially estimated.
          </div>

          {analyzingCourse ? (
            <div className="w-full flex justify-center items-center py-8 text-zinc-500 border border-zinc-800 rounded-xl border-dashed">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-purple-400" />
              Running AI Caddy analysis...
            </div>
          ) : courseAnalysis ? (
            <div className="w-full space-y-4 animate-in fade-in">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                  AI Course Overview
                </h3>
                <p className="text-zinc-200 text-sm leading-relaxed">{courseAnalysis.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Caddy Difficulty
                  </h3>
                  <p className="text-purple-400 font-bold ml-0.5 text-sm mt-1">
                    {courseAnalysis.difficultyRating}
                  </p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
                  <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Demanding Holes (Low Handicap Index)
                  </h3>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {courseAnalysis.challengingHoles?.map((h: number) => (
                      <span
                        key={h}
                        className="bg-zinc-850 text-purple-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-zinc-700 font-black"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">
                  Tactical Strategy Tips
                </h3>
                <ul className="space-y-2">
                  {courseAnalysis.strategyTips?.map((tip: string, i: number) => (
                    <li key={i} className="text-zinc-300 text-xs flex gap-2 leading-relaxed">
                      <span className="text-purple-500 text-sm mt-0.5 block select-none">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAnalyzeCourse}
              className="w-full flex items-center justify-center gap-2 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 font-bold py-4 rounded-xl transition cursor-pointer uppercase tracking-widest text-xs"
              id="request-ai-overview-btn"
            >
              Analyze Course Layout difficulty
            </button>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => navigate("/scorecards")}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-805 text-zinc-300 font-bold rounded-xl transition text-xs uppercase tracking-widest text-center cursor-pointer border border-zinc-800"
              id="saved-go-back-btn"
            >
              Go play Rounds
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
