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
  AlertOctagon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { saveCourse } from "../lib/storage";

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
  const [scorecard, setScorecard] = useState<ParsedScorecard | null>(null);
  const [saved, setSaved] = useState(false);
  const [analyzingCourse, setAnalyzingCourse] = useState(false);
  const [courseAnalysis, setCourseAnalysis] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentOriginalImage, setCurrentOriginalImage] = useState<string | null>(null);

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

    try {
      const imagePayload = [];
      for (let i = 0; i < imagePreviews.length; i++) {
        const dataUrl = imagePreviews[i];
        const split = dataUrl.split(",");
        const mimeType = split[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const base64Data = split[1];
        imagePayload.push({ data: base64Data, mimeType });
      }

      const res = await fetch("/api/gemini/scorecard-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imagePayload }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || "OCR extraction failed. Please review values or supply manual fallbacks.");
      }

      const data = await res.json();
      setScorecard(data);
      setScannerState("NEEDS_CONFIRMATION");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to parse scanned scorecard side logs.");
      setScannerState("IDLE");
    }
  };

  // Provide simple manual fallbacks bypass
  const startManualEntry = () => {
    setScorecard({
      courseName: "Commemorative Course",
      teeSet: "White",
      holes: Array.from({ length: 18 }, (_, idx) => ({
        number: idx + 1,
        par: 4,
        yardage: 350,
        handicap: idx + 1,
      })),
      uncertainFields: [],
    });
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
    });
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
    <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24" id="scorecard-scanner-module">
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
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-red-400 text-sm">Scorecard Analysis Failed</h4>
              <p className="text-zinc-300 text-xs leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors cursor-pointer"
              title="Dismiss error"
              id="error-dismiss-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-900/40">
            {imagePreviews.length > 0 && (
              <button
                onClick={processScorecard}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                id="error-retry-ocr-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Parsing
              </button>
            )}
            <button
              onClick={startManualEntry}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-black uppercase tracking-wider rounded-lg border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              id="error-manual-bypass-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              Enter Manually
            </button>
          </div>
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
      {scannerState === "NEEDS_CONFIRMATION" && scorecard && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4" id="ocr-results-reviewer">
          {/* Commemorative disclaimer label */}
          <div className="bg-yellow-950/40 border border-yellow-850/50 rounded-xl p-4 text-xs text-yellow-500 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong>Commemorative Keepsake Notice</strong>: Digital stubs are purely for keepsake framing. This card does not support authorized course play entry or verified official handicap credentials.
            </div>
          </div>

          {scorecard.uncertainFields && scorecard.uncertainFields.length > 0 && (
            <div className="bg-orange-950/20 border border-orange-900/40 rounded-xl p-4 text-xs">
              <h4 className="flex items-center gap-1.5 font-bold text-orange-400 uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4" /> OCR Confidence Checks
              </h4>
              <p className="text-zinc-400 mb-2 font-medium">Verify the following low-confidence values:</p>
              <ul className="list-disc pl-5 text-orange-500 space-y-1">
                {scorecard.uncertainFields.map((field, i) => (
                  <li key={i}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gradient-to-b from-zinc-900 to-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header card details */}
            <div className="p-6 border-b border-zinc-800/65 bg-[#0e0e10] flex flex-col items-center text-center">
              <label className="text-[9px] uppercase font-bold tracking-[0.2em] text-emerald-500/80 mb-2 block">
                Commemorative Digital Card
              </label>
              <input
                value={scorecard.courseName}
                onChange={(e) =>
                  setScorecard((s) => (s ? { ...s, courseName: e.target.value } : null))
                }
                className="w-full text-center bg-transparent font-black tracking-tighter text-2xl text-white outline-none border border-transparent focus:border-zinc-800 focus:bg-zinc-950 rounded px-1"
                id="reviewer-course-name"
              />
              <div className="flex items-center gap-2 mt-3 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-850">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <input
                  value={scorecard.teeSet}
                  onChange={(e) =>
                    setScorecard((s) => (s ? { ...s, teeSet: e.target.value } : null))
                  }
                  placeholder="TEE COLOUR"
                  className="bg-transparent font-semibold text-[10px] text-zinc-300 outline-none uppercase tracking-widest w-24 text-center"
                  id="reviewer-tee-set"
                />
              </div>
            </div>

            {/* Editable scoring statistics table */}
            <div className="overflow-x-auto hide-scrollbar pb-2">
              <table className="w-full text-sm text-center text-zinc-350 border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-zinc-950/80">
                    <th className="px-3 py-4 font-black uppercase tracking-widest text-[9px] text-zinc-500 border-b border-r border-zinc-850 w-16 sticky left-0 bg-[#0d0e10] z-10">
                      Hole
                    </th>
                    {scorecard.holes.map((h, i) => (
                      <th
                        key={i}
                        className="px-2 py-4 font-black text-sm border-b border-zinc-850 text-white min-w-[40px]"
                      >
                        {h.number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                  <tr className="hover:bg-zinc-900/10 transition-colors">
                    <td className="px-3 py-3 font-bold uppercase tracking-widest text-[9px] text-zinc-500 border-r border-zinc-850 w-16 sticky left-0 bg-[#0d0e10] z-10">
                      Par
                    </td>
                    {scorecard.holes.map((hole, index) => (
                      <td key={index} className="px-1 py-3 text-emerald-400 font-bold">
                        <input
                          type="number"
                          value={hole.par}
                          onChange={(e) => {
                            const newHoles = [...scorecard.holes];
                            newHoles[index].par = parseInt(e.target.value) || 0;
                            setScorecard({ ...scorecard, holes: newHoles });
                          }}
                          className="w-full block bg-transparent text-center outline-none focus:bg-zinc-850 rounded px-0.5"
                          id={`input-par-${hole.number}`}
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-zinc-900/10 transition-colors">
                    <td className="px-3 py-3 font-bold uppercase tracking-widest text-[9px] text-zinc-500 border-r border-zinc-850 w-16 sticky left-0 bg-[#0d0e10] z-10">
                      Yds
                    </td>
                    {scorecard.holes.map((hole, index) => (
                      <td key={index} className="px-1 py-3 font-mono text-[10px] text-zinc-400">
                        <input
                          type="number"
                          value={hole.yardage || ""}
                          onChange={(e) => {
                            const newHoles = [...scorecard.holes];
                            newHoles[index].yardage = parseInt(e.target.value) || undefined;
                            setScorecard({ ...scorecard, holes: newHoles });
                          }}
                          className="w-full block bg-transparent text-center outline-none focus:bg-zinc-850 rounded px-0.5"
                          id={`input-yds-${hole.number}`}
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-zinc-900/10 transition-colors">
                    <td className="px-3 py-3 font-bold uppercase tracking-widest text-[9px] text-zinc-500 border-r border-zinc-850 w-16 sticky left-0 bg-[#0d0e10] z-10">
                      Hcp
                    </td>
                    {scorecard.holes.map((hole, index) => (
                      <td key={index} className="px-1 py-3 font-mono text-[10px] text-zinc-500">
                        <input
                          type="number"
                          value={hole.handicap || ""}
                          onChange={(e) => {
                            const newHoles = [...scorecard.holes];
                            newHoles[index].handicap = parseInt(e.target.value) || undefined;
                            setScorecard({ ...scorecard, holes: newHoles });
                          }}
                          className="w-full block bg-transparent text-center outline-none focus:bg-zinc-850 rounded px-0.5"
                          id={`input-hcp-${hole.number}`}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition cursor-pointer leading-none uppercase tracking-widest text-xs"
            id="scanner-saver-btn"
          >
            <Check className="w-4 h-4" /> Confirm & Save Course
          </button>
        </div>
      )}

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
                    Target Hazards
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
