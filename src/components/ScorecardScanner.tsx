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
  Plus
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

export function ScorecardScanner() {
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ParsedScorecard | null>(null);
  const [saved, setSaved] = useState(false);
  const [analyzingCourse, setAnalyzingCourse] = useState(false);
  const [courseAnalysis, setCourseAnalysis] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [crop, setCrop] = useState({ top: 25, left: 10, right: 10, bottom: 25 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCountdown(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setCountdown(null);
    try {
      // First try standard environment camera (exact often fails on iOS)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsScanning(true);
    } catch (err: any) {
      console.error("Environment camera error:", err);
      // Fallback: Any camera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
           video: true
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
        setIsScanning(true);
      } catch (fallbackErr) {
        setCameraError("Camera access denied. Please use the upload button.");
      }
    }
  };

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
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Create a temporary canvas to draw the whole frame
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Apply the adjustable crop percentages to the actual video dimensions
    const cropX = tempCanvas.width * (crop.left / 100);
    const cropY = tempCanvas.height * (crop.top / 100);
    const cropW = tempCanvas.width * ((100 - crop.left - crop.right) / 100);
    const cropH = tempCanvas.height * ((100 - crop.top - crop.bottom) / 100);
    
    // Draw the cropped portion to the final canvas
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    
    // Get cropped image URL
    const imageUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImagePreviews(prev => [...prev, imageUrl]);
    
    // Stop camera after capture
    stopCamera();
    setIsScanning(false);
  };

  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
     setActiveHandle(handle);
     (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
     if (!activeHandle) return;
     const container = e.currentTarget.getBoundingClientRect();
     
     // Calculate percentage of movement
     const percentX = (e.movementX / container.width) * 100;
     const percentY = (e.movementY / container.height) * 100;
     
     setCrop(prev => {
        const next = { ...prev };
        
        switch (activeHandle) {
           case 'top-left':
              next.top = Math.max(0, Math.min(100 - next.bottom - 10, next.top + percentY));
              next.left = Math.max(0, Math.min(100 - next.right - 10, next.left + percentX));
              break;
           case 'top-right':
              next.top = Math.max(0, Math.min(100 - next.bottom - 10, next.top + percentY));
              next.right = Math.max(0, Math.min(100 - next.left - 10, next.right - percentX));
              break;
           case 'bottom-left':
              next.bottom = Math.max(0, Math.min(100 - next.top - 10, next.bottom - percentY));
              next.left = Math.max(0, Math.min(100 - next.right - 10, next.left + percentX));
              break;
           case 'bottom-right':
              next.bottom = Math.max(0, Math.min(100 - next.top - 10, next.bottom - percentY));
              next.right = Math.max(0, Math.min(100 - next.left - 10, next.right - percentX));
              break;
           case 'top':
              next.top = Math.max(0, Math.min(100 - next.bottom - 10, next.top + percentY));
              break;
           case 'bottom':
              next.bottom = Math.max(0, Math.min(100 - next.top - 10, next.bottom - percentY));
              break;
           case 'left':
              next.left = Math.max(0, Math.min(100 - next.right - 10, next.left + percentX));
              break;
           case 'right':
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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    if (files.some((f) => f.size > 20 * 1024 * 1024)) {
      setError("Files must be smaller than 20MB");
      return;
    }

    const objectUrls = await Promise.all(files.map(f => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(f);
      });
    }));
    
    setImagePreviews(prev => [...prev, ...objectUrls]);
    setError(null);
    setScorecard(null);
    setSaved(false);
    setCourseAnalysis(null);
  };

  const processScorecard = async () => {
    if (imagePreviews.length === 0) return;
    setLoading(true);
    setError(null);
    
    try {
      const imagePayload = imagePreviews.map((dataUrl) => {
        // dataUrl format: data:image/jpeg;base64,xxxx
        const split = dataUrl.split(',');
        const mimeType = split[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const base64Data = split[1];
        return { data: base64Data, mimeType };
      });

      const res = await fetch("/api/gemini/scorecard-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imagePayload }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || "Failed to parse scorecard");
      }

      const data = await res.json();
      setScorecard(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse scorecard");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!scorecard) return;
    await saveCourse({
      name: scorecard.courseName,
      teeSet: scorecard.teeSet,
      holes: scorecard.holes,
    });
    setSaved(true);
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

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col">
         <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
           <button onClick={() => { stopCamera(); setIsScanning(false); }} className="text-white p-2 rounded-full bg-black/50 backdrop-blur self-start">
             <X className="w-6 h-6" />
           </button>
           <h2 className="text-white font-bold tracking-widest uppercase text-sm">Align Scorecard</h2>
           <div className="w-10"></div>
         </div>
         
         <div 
           className="flex-1 relative overflow-hidden bg-zinc-900 touch-none"
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}
         >
           <video
             ref={videoRef}
             autoPlay
             playsInline
             muted
             className="absolute inset-0 w-full h-full object-cover"
           />
           {/* Adjustable Crop Overlay */}
           <div className="absolute inset-0 pointer-events-none bg-black/40">
              <div 
                className={`absolute border-2 border-dashed transition-colors duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ${countdown !== null ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/80 bg-white/5'}`}
                style={{
                   top: `${crop.top}%`,
                   left: `${crop.left}%`,
                   bottom: `${crop.bottom}%`,
                   right: `${crop.right}%`,
                }}
              >
                  {/* Top Edge */}
                  <div 
                     className="absolute -top-3 left-0 right-0 h-6 cursor-ns-resize pointer-events-auto flex justify-center items-center group"
                     onPointerDown={(e) => handlePointerDown(e, 'top')}
                  >
                     <div className="w-8 h-1 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                  </div>
                  {/* Bottom Edge */}
                  <div 
                     className="absolute -bottom-3 left-0 right-0 h-6 cursor-ns-resize pointer-events-auto flex justify-center items-center group"
                     onPointerDown={(e) => handlePointerDown(e, 'bottom')}
                  >
                     <div className="w-8 h-1 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                  </div>
                  {/* Left Edge */}
                  <div 
                     className="absolute top-0 bottom-0 -left-3 w-6 cursor-ew-resize pointer-events-auto flex justify-center items-center group"
                     onPointerDown={(e) => handlePointerDown(e, 'left')}
                  >
                     <div className="w-1 h-8 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                  </div>
                  {/* Right Edge */}
                  <div 
                     className="absolute top-0 bottom-0 -right-3 w-6 cursor-ew-resize pointer-events-auto flex justify-center items-center group"
                     onPointerDown={(e) => handlePointerDown(e, 'right')}
                  >
                     <div className="w-1 h-8 bg-white/50 group-hover:bg-white rounded-full transition-colors" />
                  </div>

                  {/* Top-Left Corner */}
                  <div 
                     className="absolute -top-4 -left-4 w-8 h-8 cursor-nwse-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                     onPointerDown={(e) => handlePointerDown(e, 'top-left')}
                  />
                  {/* Top-Right Corner */}
                  <div 
                     className="absolute -top-4 -right-4 w-8 h-8 cursor-nesw-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                     onPointerDown={(e) => handlePointerDown(e, 'top-right')}
                  />
                  {/* Bottom-Left Corner */}
                  <div 
                     className="absolute -bottom-4 -left-4 w-8 h-8 cursor-nesw-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                     onPointerDown={(e) => handlePointerDown(e, 'bottom-left')}
                  />
                  {/* Bottom-Right Corner */}
                  <div 
                     className="absolute -bottom-4 -right-4 w-8 h-8 cursor-nwse-resize pointer-events-auto bg-white/20 hover:bg-white/50 rounded-full border-2 border-white/80 transition-colors"
                     onPointerDown={(e) => handlePointerDown(e, 'bottom-right')}
                  />
                  
                  {/* Center Scanning Animation & Text */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     {countdown !== null && countdown > 0 ? (
                        <span className="text-7xl font-black text-emerald-400 drop-shadow-2xl">{countdown}</span>
                     ) : (
                        <Scan className={`w-12 h-12 ${countdown !== null ? 'text-emerald-400 opacity-80 animate-pulse' : 'text-white/30'}`} />
                     )}
                  </div>
              </div>
           </div>
         </div>

         <div className="p-8 pb-12 bg-black flex flex-col items-center gap-6 border-t border-zinc-800">
           <p className={`flex items-center gap-2 text-sm font-semibold tracking-wider uppercase transition-colors ${countdown !== null ? 'text-emerald-400' : 'text-zinc-400'}`}>
             <Camera className="w-4 h-4" /> {countdown !== null ? 'Hold steady...' : 'Ensure scorecard is fully visible'}
           </p>
           <button
             onClick={startCountdown}
             disabled={countdown !== null}
             className={`px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-3 ${countdown !== null ? 'bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105' : 'bg-white text-black hover:bg-zinc-200 active:scale-95'}`}
           >
             {countdown !== null ? (
               <>
                 <Scan className="w-5 h-5 animate-pulse" />
                 Capturing in {countdown}...
               </>
             ) : (
               <>
                 <Scan className="w-5 h-5" />
                 Lock Alignment
               </>
             )}
           </button>
         </div>
         <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 border border-zinc-800 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-300" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
            Scorecard Scanner
          </h1>
          <p className="text-zinc-400 text-sm">
            Upload multiple scorecard images to build a pristine digital
            version.
          </p>
        </div>
      </div>

      {imagePreviews.length === 0 && (
        <div className="pt-4 grid grid-cols-2 gap-4">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={startCamera}
            className="flex flex-col items-center justify-center gap-3 bg-blue-600/20 border border-blue-500/50 p-8 rounded-xl hover:bg-blue-600/30 transition col-span-2 text-center"
          >
            <Camera className="w-10 h-10 text-blue-400" />
            <span className="font-semibold text-zinc-200">
              Live Scan Scorecard
            </span>
            <span className="text-xs text-zinc-400">
              Use your camera to scan front and back.
            </span>
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl hover:bg-zinc-800 transition col-span-2 text-center"
          >
            <Upload className="w-5 h-5 text-zinc-400" />
            <span className="font-semibold text-zinc-300 text-sm">
              Or Upload Photos
            </span>
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-900 rounded-xl text-red-500 text-sm">
          {error}
        </div>
      )}
      
      {cameraError && (
        <div className="p-4 bg-red-900/30 border border-red-900 rounded-xl text-red-500 text-sm">
          {cameraError}
        </div>
      )}

      {imagePreviews.length > 0 && !scorecard && !loading && (
        <div className="space-y-4">
          <div className="flex overflow-x-auto gap-4 hide-scrollbar snap-x snap-mandatory">
            {imagePreviews.map((img, idx) => (
              <div key={idx} className="relative w-48 h-32 shrink-0 snap-center rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                <img
                  src={img}
                  alt={`Scan ${idx + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => setImagePreviews(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
               onClick={startCamera}
               className="w-24 shrink-0 border-2 border-dashed border-zinc-700 bg-zinc-900/50 rounded-xl flex items-center justify-center hover:bg-zinc-800 hover:border-zinc-500 transition-colors"
            >
               <div className="flex flex-col items-center gap-1 text-zinc-500">
                  <Plus className="w-6 h-6" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-center px-2">Add Side</span>
               </div>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
             <button
                onClick={clearScans}
                className="flex-1 py-3 text-sm font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-white transition-colors"
             >
                Start Over
             </button>
             <button
                onClick={processScorecard}
                className="flex-[2] py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
             >
                Process Scorecard
             </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center text-white p-12 bg-black/50 border border-zinc-800 rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
          <Scan className="w-12 h-12 text-blue-500 animate-[spin_3s_linear_infinite] mb-4" />
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 absolute opacity-50" />
          <span className="mt-4 font-bold tracking-widest text-sm uppercase text-blue-300">
            Extracting Course Data
          </span>
          <span className="text-zinc-500 text-xs mt-2 text-center">Using Gemini to read par, yardage, and handicaps</span>
        </div>
      )}

      {scorecard && !loading && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
              {scorecard.uncertainFields &&
                scorecard.uncertainFields.length > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-xl p-4 text-sm">
                    <h4 className="flex items-center gap-2 font-semibold text-yellow-500 mb-2">
                      <AlertTriangle className="w-4 h-4" /> Please verify
                    </h4>
                    <p className="text-zinc-300 mb-2">
                      The AI was uncertain about:
                    </p>
                    <ul className="list-disc pl-5 text-yellow-600 space-y-1">
                      {scorecard.uncertainFields.map((field, i) => (
                        <li key={i}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="bg-gradient-to-b from-[#1a1c1a] to-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* Digital Scorecard Header */}
                <div className="p-6 border-b border-zinc-800/50 bg-[#141514] flex flex-col items-center text-center">
                  <label className="text-[9px] uppercase font-bold tracking-[0.2em] text-emerald-500/70 mb-2 block">
                    Official Scorecard
                  </label>
                  <input
                    value={scorecard.courseName}
                    onChange={(e) =>
                      setScorecard((s) =>
                        s ? { ...s, courseName: e.target.value } : null,
                      )
                    }
                    className="w-full text-center bg-transparent font-black tracking-tighter text-3xl text-white outline-none mb-1"
                  />
                  <div className="flex items-center gap-2 mt-2 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <input
                      value={scorecard.teeSet}
                      onChange={(e) =>
                        setScorecard((s) =>
                          s ? { ...s, teeSet: e.target.value } : null,
                        )
                      }
                      placeholder="Tees (e.g. Blue)"
                      className="bg-transparent font-semibold text-xs text-zinc-300 outline-none uppercase tracking-wider w-24"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto hide-scrollbar pb-2">
                  <table className="w-full text-sm text-center text-zinc-300 border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-zinc-900/50">
                        <th className="px-3 py-4 font-black uppercase tracking-widest text-[10px] text-zinc-500 border-b border-r border-zinc-800 w-16 sticky left-0 bg-[#0a0a0a] z-10">Hole</th>
                        {scorecard.holes.map((h, i) => (
                           <th key={i} className="px-2 py-4 font-black text-lg border-b border-zinc-800 text-white min-w-[40px]">{h.number}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      <tr className="hover:bg-zinc-900/30 transition-colors">
                        <td className="px-3 py-3 font-bold uppercase tracking-widest text-[10px] text-zinc-500 border-r border-zinc-800 w-16 sticky left-0 bg-[#0a0a0a] z-10">Par</td>
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
                              className="w-full block bg-transparent text-center outline-none focus:bg-zinc-800 rounded px-0.5"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="hover:bg-zinc-900/30 transition-colors">
                        <td className="px-3 py-3 font-bold uppercase tracking-widest text-[10px] text-zinc-500 border-r border-zinc-800 w-16 sticky left-0 bg-[#0a0a0a] z-10">Yds</td>
                        {scorecard.holes.map((hole, index) => (
                          <td key={index} className="px-1 py-3 font-mono text-[11px] text-zinc-400">
                            <input
                              type="number"
                              value={hole.yardage || ""}
                              onChange={(e) => {
                                const newHoles = [...scorecard.holes];
                                newHoles[index].yardage = parseInt(e.target.value) || undefined;
                                setScorecard({ ...scorecard, holes: newHoles });
                              }}
                              className="w-full block bg-transparent text-center outline-none focus:bg-zinc-800 rounded px-0.5"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr className="hover:bg-zinc-900/30 transition-colors">
                        <td className="px-3 py-3 font-bold uppercase tracking-widest text-[10px] text-zinc-500 border-r border-zinc-800 w-16 sticky left-0 bg-[#0a0a0a] z-10">Hcp</td>
                        {scorecard.holes.map((hole, index) => (
                          <td key={index} className="px-1 py-3 font-mono text-[11px] text-zinc-500">
                            <input
                              type="number"
                              value={hole.handicap || ""}
                              onChange={(e) => {
                                const newHoles = [...scorecard.holes];
                                newHoles[index].handicap = parseInt(e.target.value) || undefined;
                                setScorecard({ ...scorecard, holes: newHoles });
                              }}
                              className="w-full block bg-transparent text-center outline-none focus:bg-zinc-800 rounded px-0.5"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {!saved ? (
                <button
                  onClick={handleSave}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition"
                >
                  <Check className="w-5 h-5" /> Confirm & Save Course
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom flex flex-col items-center">
                  <div className="bg-green-900/30 border border-green-500 text-green-400 font-medium px-4 py-3 rounded-xl w-full text-center">
                    Course Saved Successfully!
                  </div>
                  {analyzingCourse ? (
                    <div className="w-full flex justify-center py-4 text-zinc-400 p-4 border border-zinc-800 rounded-xl border-dashed">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />{" "}
                      Analyzing Course...
                    </div>
                  ) : courseAnalysis ? (
                    <div className="w-full space-y-4">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">
                          Course Summary
                        </h3>
                        <p className="text-zinc-200 text-sm">
                          {courseAnalysis.summary}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">
                            Difficulty
                          </h3>
                          <p className="text-blue-400 font-semibold">
                            {courseAnalysis.difficultyRating}
                          </p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">
                            Hardest Holes
                          </h3>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {courseAnalysis.challengingHoles?.map(
                              (h: number) => (
                                <span
                                  key={h}
                                  className="bg-zinc-800 text-zinc-300 w-6 h-6 rounded-full flex items-center justify-center text-xs border border-zinc-700"
                                >
                                  {h}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">
                          Strategy Tips
                        </h3>
                        <ul className="space-y-2">
                          {courseAnalysis.strategyTips?.map(
                            (tip: string, i: number) => (
                              <li
                                key={i}
                                className="text-zinc-300 text-sm flex gap-2"
                              >
                                <span className="text-zinc-600 mt-0.5">•</span>
                                <span>{tip}</span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleAnalyzeCourse}
                      className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-4 rounded-xl transition"
                    >
                      Analyze Course Difficulty
                    </button>
                  )}
                  <button
                    onClick={() => navigate("/scorecards")}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-4 rounded-xl transition mt-2"
                  >
                    Go to Scorecards
                  </button>
                </div>
              )}
            </div>
          )}
    </div>
  );
}
