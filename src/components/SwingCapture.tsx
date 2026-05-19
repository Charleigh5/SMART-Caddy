import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, RefreshCcw, Save, Trash2, Maximize, Target, CircleUser, Video as VideoIcon, Eye, EyeOff, MoveLeft, ArrowDownToLine, Smartphone, AlertTriangle, ChevronRight, Bot, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { saveSwingVideo } from '../lib/storage';
import { SilhouetteOverlay } from './SilhouetteOverlay';

type ViewAngle = 'DOWN_THE_LINE' | 'FACE_ON' | 'UNKNOWN';

export function SwingCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const [viewAngle, setViewAngle] = useState<ViewAngle>('DOWN_THE_LINE');
  const [handedness, setHandedness] = useState<'RIGHT' | 'LEFT'>('RIGHT');
  const [showOverlay, setShowOverlay] = useState(true);
  const [setupScore, setSetupScore] = useState(0);
  const [setupWarnings, setSetupWarnings] = useState<string[]>([]);
  
  const [deviceTilt, setDeviceTilt] = useState(0);

  const [ballTrackStatus, setBallTrackStatus] = useState<'IDLE' | 'TRACKING' | 'TRACKED' | 'PARTIALLY_TRACKED' | 'NOT_TRACKABLE' | 'MANUAL'>('IDLE');
  const [trackingIssue, setTrackingIssue] = useState<{reason: string, tip: string} | null>(null);
  const [manualResult, setManualResult] = useState({ carry: '', direction: '' });
  
  // Manual adjustments for trajectory
  const [manualOffsets, setManualOffsets] = useState({ x: 0, y: 0, angle: 0 });
  const [isAnalyzingFlight, setIsAnalyzingFlight] = useState(false);
  const [flightAnalysisResult, setFlightAnalysisResult] = useState<{
    trajectory: string;
    distance: string;
    topObservations: string[];
    primaryCorrection: string;
    confidence: string;
  } | null>(null);

  useEffect(() => {
    startCamera();
    
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // e.beta is front-to-back tilt in degrees, where 0 is flat, 90 is vertical, 180 is upside down
      if (e.beta !== null) {
        // Assume ideal upright is 90
        const tiltOffset = (e.beta - 90) * 0.5; // Scale it down
        setDeviceTilt(tiltOffset);
      }
    };
    
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Failed to start camera", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const calculateFakeSetupScore = () => {
    // In a real implementation this would use pose estimation landmarks 
    // vs silhouette zones. Here we simulate varying score + warnings.
    const score = Math.floor(Math.random() * 60) + 40; // 40 to 100
    setSetupScore(score);
    
    // Generate warnings based on simulated score
    const warnings = [];
    if (score < 85) {
      if (Math.random() > 0.5) warnings.push("Move closer to the center.");
      else warnings.push("Ball is outside the address zone.");
    }
    if (score < 70) {
      if (viewAngle === 'DOWN_THE_LINE') {
        warnings.push("Move phone backward to capture target line.");
        warnings.push("Align phone parallel to feet.");
      } else {
        warnings.push("Move phone perpendicular to chest.");
        warnings.push("Make sure hands and clubhead are visible.");
      }
    }
    if (score < 50) {
      warnings.push("Tilt phone slightly upward to capture full arm extension.");
      warnings.push("Club may leave frame during backswing.");
    }
    setSetupWarnings(warnings);
  };

  useEffect(() => {
    if (stream && !isRecording && !videoUrl) {
      const interval = setInterval(calculateFakeSetupScore, 1000);
      return () => clearInterval(interval);
    }
  }, [stream, isRecording, videoUrl]);

  const handleStartRecording = () => {
    if (!stream) return;
    setRecordedChunks([]);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(mediaRecorderRef.current ? recordedChunks : [], { type: 'video/webm' });
      // In JS closures, recordedChunks might be empty inside here, so we assemble it in a useEffect or use the state later, but typically we handle it in ondataavailable.
      // We will manage blob assembly when we stop.
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
    setTimeLeft(10);
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleStopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Assemble video
    setTimeout(() => {
      setRecordedChunks((currentChunks) => {
        const blob = new Blob(currentChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        stopCamera();
        simulateBallTracking();
        return currentChunks;
      });
    }, 200); // small delay to let chunks flush
  };

  const simulateBallTracking = () => {
    setBallTrackStatus('TRACKING');
    setTrackingIssue(null);
    setTimeout(() => {
      const rand = Math.random();
      if (rand > 0.6) {
        setBallTrackStatus('TRACKED');
      } else if (rand > 0.3) {
        setBallTrackStatus('PARTIALLY_TRACKED');
        setTrackingIssue({ reason: 'Lost tracking in visual clutter', tip: 'Shoot against a clearer background like an open sky.' });
      } else {
        setBallTrackStatus('NOT_TRACKABLE');
        setTrackingIssue({ reason: 'Motion blur too high', tip: 'Hold camera steadier and ensure good lighting.' });
      }
    }, 2000); // 2 second delay
  };

  const retake = () => {
    setVideoUrl(null);
    setRecordedChunks([]);
    setBallTrackStatus('IDLE');
    setTrackingIssue(null);
    setManualResult({ carry: '', direction: '' });
    startCamera();
  };

  const analyzeBallFlight = async () => {
    setIsAnalyzingFlight(true);
    setFlightAnalysisResult(null);
    // Simulate AI delay
    setTimeout(() => {
      let shape = "Straight";
      let topObservations = ["Good posture at address", "Smooth transition"];
      let primaryCorrection = "Maintain balance through finish to ensure consistent strikes.";
      
      const angle = manualOffsets.angle;
      const shiftX = manualOffsets.x;
      
      if (angle < -10) {
        shape = "Pull";
        topObservations = ["Out-to-in swing path", "Clubface closed to target line"];
        primaryCorrection = "Work on dropping hands inside to prevent over-the-top motion.";
      } else if (angle > 10) {
        shape = "Push";
        topObservations = ["Inside-out swing path", "Clubface open to target line"];
        primaryCorrection = "Focus on releasing the clubhead earlier to square the face.";
      } else if (shiftX < -20) {
        shape = "Draw/Hook";
        topObservations = ["Clubface closed to swing path", "Strong grip detected"];
        primaryCorrection = "Check grip strength and ensure body rotation matches hand release.";
      } else if (shiftX > 20) {
        shape = "Fade/Slice";
        topObservations = ["Out-to-in swing path", "Clubface open relative to path"];
        primaryCorrection = "Keep back to target slightly longer in transition to shallow the club.";
      }
      
      const distanceEst = Math.floor(150 + Math.random() * 50 - Math.abs(angle));
      
      setFlightAnalysisResult({
        trajectory: shape,
        distance: `${distanceEst} yds (Est.)`,
        topObservations: topObservations,
        primaryCorrection: primaryCorrection,
        confidence: ballTrackStatus === 'TRACKED' ? 'High' : 'Medium'
      });
      setIsAnalyzingFlight(false);
    }, 1500);
  };

  const saveToLibrary = async () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    await saveSwingVideo(blob, viewAngle);
    navigate('/');
  };

  return (
    <div className="h-screen bg-black flex flex-col pt-safe pb-24 text-white">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 z-10 bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full">
        <button onClick={() => navigate(-1)} className="text-zinc-300">Back</button>
        <div className="flex flex-col gap-2 relative z-20">
          <div className="flex self-end gap-2 bg-zinc-900/80 px-1 py-1 rounded-full text-xs font-semibold backdrop-blur tracking-wider">
            <button 
              className={cn("px-2 py-1 rounded-full transition-colors", viewAngle === 'DOWN_THE_LINE' && "bg-blue-600")}
              onClick={() => setViewAngle('DOWN_THE_LINE')}
            >
              DTL
            </button>
            <button 
              className={cn("px-2 py-1 rounded-full transition-colors", viewAngle === 'FACE_ON' && "bg-blue-600")}
              onClick={() => setViewAngle('FACE_ON')}
            >
              FACE ON
            </button>
          </div>
          <div className="flex self-end gap-2 bg-zinc-900/80 px-1 py-1 rounded-full text-xs font-semibold backdrop-blur tracking-wider">
             <button 
              className={cn("px-2 py-1 rounded-full transition-colors", handedness === 'RIGHT' && "bg-zinc-700")}
              onClick={() => setHandedness('RIGHT')}
            >
              RH
            </button>
            <button 
              className={cn("px-2 py-1 rounded-full transition-colors", handedness === 'LEFT' && "bg-zinc-700")}
              onClick={() => setHandedness('LEFT')}
            >
              LH
            </button>
            <button 
              className={cn("px-2 py-1 rounded-full transition-colors", showOverlay ? "text-blue-400" : "text-zinc-500")}
              onClick={() => setShowOverlay(!showOverlay)}
            >
              {showOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {!videoUrl ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn("object-cover w-full h-full", viewAngle === 'FACE_ON' && "scale-x-[-1]")} // Mirror Face On maybe? Usually not mirrored for rear camera. 
            />
            {/* Viewfinder Alignment Guide */}
            {!isRecording && (
              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-60">
                {viewAngle === 'DOWN_THE_LINE' && (
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Vertical / Horizontal center crosshairs */}
                    <path d="M 50 45 L 50 55 M 45 50 L 55 50" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="0.5" />
                    
                    {/* Target Line Guide (extending to Distance) - Handedness dependent */}
                    <path d={handedness === 'RIGHT' ? "M 80 90 L 50 30" : "M 20 90 L 50 30"} stroke="#eab308" strokeWidth="0.5" strokeDasharray="2, 2" />
                    
                    {/* Ball Position Target */}
                    <circle cx={handedness === 'RIGHT' ? "75" : "25"} cy="80" r="3" stroke="#eab308" strokeWidth="0.5" fill="none" />
                    <text x={handedness === 'RIGHT' ? "65" : "30"} y="79" fill="#eab308" fontSize="3" className="uppercase font-mono tracking-widest bg-black text-xs">Ball & Target Line</text>
                    
                    {/* Frame leveling guides */}
                    <path d="M 20 20 L 30 20 M 70 20 L 80 20 M 20 80 L 30 80 M 70 80 L 80 80" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                  </svg>
                )}
                {viewAngle === 'FACE_ON' && (
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Vertical Player Center Guideline */}
                    <path d="M 50 10 L 50 90" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="0.5" strokeDasharray="3, 3" />
                    
                    {/* Horizontal Ground/Ball line */}
                    <path d="M 10 85 L 90 85" stroke="#eab308" strokeWidth="0.5" strokeDasharray="2, 2" />
                    
                    {/* Ball Position Target */}
                    <circle cx="50" cy="85" r="3" stroke="#eab308" strokeWidth="0.5" fill="none" />
                    <text x="54" y="84" fill="#eab308" fontSize="3" className="uppercase font-mono tracking-widest">Center Ball</text>
                    
                    <path d="M 45 40 L 55 40 M 45 60 L 55 60" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                  </svg>
                )}
              </div>
            )}
            
            {/* Setup Assistant Overlay */}
            {!isRecording && (
                <>
                  <SilhouetteOverlay 
                    viewAngle={viewAngle} 
                    handedness={handedness} 
                    isVisible={showOverlay}
                    setupScore={setupScore}
                    deviceTilt={deviceTilt}
                  />
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10">
                    <div className="mt-16 text-center flex flex-col items-center gap-2">
                      <div className={cn(
                        "inline-block px-4 py-2 rounded-full backdrop-blur-md border",
                        setupScore >= 85 ? "bg-green-900/70 border-green-500/50 text-green-100" :
                        setupScore >= 70 ? "bg-blue-900/70 border-blue-500/50 text-blue-100" :
                        setupScore >= 50 ? "bg-yellow-900/70 border-yellow-500/50 text-yellow-100" :
                        "bg-red-900/70 border-red-500/50 text-red-100"
                      )}>
                        <span className="font-bold">{setupScore}/100</span> Setup Score
                      </div>
                      
                      {setupScore >= 70 ? (
                        setupWarnings.slice(0, 2).map((warn, idx) => (
                          <div key={idx} className="text-xs bg-black/80 backdrop-blur inline-block px-3 py-1.5 rounded-full font-medium shadow-lg border border-white/10 text-yellow-400">
                            ! {warn}
                          </div>
                        ))
                      ) : null}
                    </div>
                  </div>

                  {/* Refined Actions UI for Score < 70 */}
                  {setupScore < 70 && !isRecording && (
                    <div className="absolute inset-x-8 bottom-40 bg-zinc-950/90 border border-red-500/50 backdrop-blur-md rounded-xl p-4 shadow-2xl animate-in slide-in-from-bottom flex flex-col gap-3 z-20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span className="font-bold text-red-100 uppercase tracking-wider text-xs">Reposition Recommended</span>
                      </div>
                      <div className="space-y-2">
                        {setupWarnings.slice(0, 2).map((warn, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-red-200">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                            <p>{warn}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {viewAngle === 'DOWN_THE_LINE' ? (
                          <>
                            <div className="bg-black/60 rounded p-3 flex flex-col items-center justify-center text-xs text-red-300 gap-2 border border-red-900/50 shadow-inner">
                                <MoveLeft className="w-6 h-6 text-red-400 animate-pulse" />
                                <span className="font-medium text-center leading-tight">Move Phone<br/>Backward</span>
                            </div>
                            <div className="bg-black/60 rounded p-3 flex flex-col items-center justify-center text-xs text-red-300 gap-2 border border-red-900/50 shadow-inner">
                                <ArrowDownToLine className="w-6 h-6 text-red-400 animate-pulse" />
                                <span className="font-medium text-center leading-tight">Lower Phone<br/>Height</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-black/60 rounded p-3 flex flex-col items-center justify-center text-xs text-red-300 gap-2 border border-red-900/50 shadow-inner">
                                <Smartphone className="w-6 h-6 text-red-400 animate-pulse" />
                                <span className="font-medium text-center leading-tight">Face Phone<br/>To Chest</span>
                            </div>
                            <div className="bg-black/60 rounded p-3 flex flex-col items-center justify-center text-xs text-red-300 gap-2 border border-red-900/50 shadow-inner">
                                <Maximize className="w-6 h-6 text-red-400 animate-pulse" />
                                <span className="font-medium text-center leading-tight">Check Full<br/>Framing</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
            )}
            
            {/* Fade Silhouette during active recording */}
            {isRecording && showOverlay && (
               <div className="pointer-events-none absolute inset-0 opacity-20">
                 <SilhouetteOverlay 
                    viewAngle={viewAngle} 
                    handedness={handedness} 
                    isVisible={true}
                    setupScore={setupScore}
                    deviceTilt={deviceTilt}
                 />
               </div>
            )}
            
            {/* Recording HUD */}
            {isRecording && (
              <div className="absolute top-16 right-4 bg-red-600 px-3 py-1 rounded shadow text-white font-mono flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full relative">
            <video 
              src={videoUrl} 
              controls={ballTrackStatus !== 'TRACKING'} 
              playsInline 
              className="w-full h-full object-contain bg-black"
            />
            {/* Ball Tracking Status HUD */}
            <div className="absolute top-4 inset-x-4 z-20 flex justify-center">
              {ballTrackStatus === 'TRACKING' && (
                <div className="bg-black/80 backdrop-blur border border-zinc-800 text-zinc-300 px-4 py-2 rounded-full text-sm flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Analyzing Ball Flight...
                </div>
              )}
              {ballTrackStatus === 'TRACKED' && (
                <div className="bg-green-900/80 backdrop-blur border border-green-500/50 text-green-100 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4" /> Ball Tracked
                </div>
              )}
              {ballTrackStatus === 'PARTIALLY_TRACKED' && (
                <div className="bg-yellow-900/90 backdrop-blur border border-yellow-500/50 text-yellow-100 flex flex-col p-3 rounded-2xl text-sm font-semibold w-full max-w-sm shadow-xl">
                  <div className="flex items-center gap-2 mb-1"><EyeOff className="w-5 h-5" /> Partially Tracked</div>
                  <p className="text-xs font-normal text-yellow-200/80 leading-snug">{trackingIssue?.reason}: {trackingIssue?.tip}</p>
                  <button onClick={() => setBallTrackStatus('MANUAL')} className="text-xs text-yellow-900 bg-yellow-300 hover:bg-yellow-200 rounded-lg py-2 mt-3 font-bold transition">Enter Manual Result</button>
                </div>
              )}
              {ballTrackStatus === 'NOT_TRACKABLE' && (
                <div className="bg-red-900/90 backdrop-blur border border-red-500/50 text-red-100 flex flex-col p-3 rounded-2xl text-sm font-semibold w-full max-w-sm shadow-xl">
                  <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-5 h-5" /> Not Trackable</div>
                  <p className="text-xs font-normal text-red-200/80 leading-snug">{trackingIssue?.reason}: {trackingIssue?.tip}</p>
                  <button onClick={() => setBallTrackStatus('MANUAL')} className="text-xs text-red-900 bg-red-300 hover:bg-red-200 rounded-lg py-2 mt-3 font-bold transition">Enter Manual Result</button>
                </div>
              )}
            </div>

            {/* Manual Entry Overlay */}
            {ballTrackStatus === 'MANUAL' && (
              <div className="absolute inset-x-4 bottom-8 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl p-4 shadow-2xl z-30">
                <h4 className="text-sm font-bold text-zinc-100 mb-3 flex items-center justify-between">
                  Manual Ball Result
                  <button onClick={() => setBallTrackStatus('NOT_TRACKABLE')} className="text-zinc-500 text-xs hover:text-zinc-300">Cancel</button>
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Carry Distance (yards)</label>
                    <input 
                      type="number" 
                      value={manualResult.carry}
                      onChange={(e) => setManualResult(p => ({ ...p, carry: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. 150"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Direction</label>
                    <div className="flex gap-2">
                       {['Pull', 'Straight', 'Push'].map(dir => (
                         <button 
                           key={dir}
                           onClick={() => setManualResult(p => ({ ...p, direction: dir }))}
                           className={cn("flex-1 py-1.5 text-xs rounded-lg border", manualResult.direction === dir ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400")}
                         >
                           {dir}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Draw Simulated Path if Tracked or Partially Tracked */}
            {(ballTrackStatus === 'TRACKED' || ballTrackStatus === 'PARTIALLY_TRACKED') && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                   <defs>
                     <linearGradient id="pathGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                       <stop offset="0%" stopColor={ballTrackStatus === 'TRACKED' ? '#4ade80' : '#facc15'} stopOpacity="1" />
                       <stop offset="100%" stopColor={ballTrackStatus === 'TRACKED' ? '#3b82f6' : '#ef4444'} stopOpacity="0.2" />
                     </linearGradient>
                     <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                       <feGaussianBlur stdDeviation="1.5" result="blur" />
                       <feComposite in="SourceGraphic" in2="blur" operator="over" />
                     </filter>
                   </defs>
                   <g transform={`translate(${manualOffsets.x}, ${manualOffsets.y}) rotate(${manualOffsets.angle} 50 80)`}>
                     {/* Background wider stroke for glow */}
                     <path 
                       d={viewAngle === 'DOWN_THE_LINE' 
                           ? "M 50 80 Q 55 40 45 30" 
                           : "M 40 80 Q 60 20 80 80"} 
                       fill="none" 
                       stroke="url(#pathGradient)"
                       strokeWidth="1.5" 
                       opacity="0.3"
                       filter="url(#glow)"
                     />
                     {/* Main Path */}
                     <path 
                       d={viewAngle === 'DOWN_THE_LINE' 
                           ? "M 50 80 Q 55 40 45 30" 
                           : "M 40 80 Q 60 20 80 80"} 
                       fill="none" 
                       stroke="url(#pathGradient)" 
                       strokeWidth="0.8" 
                       strokeDasharray={ballTrackStatus === 'PARTIALLY_TRACKED' ? "2, 3" : "0"}
                       className="animate-pulse"
                     />
                     {/* Apex marker */}
                     <circle 
                       cx={viewAngle === 'DOWN_THE_LINE' ? "50" : "60"} 
                       cy={viewAngle === 'DOWN_THE_LINE' ? "35" : "20"} 
                       r="1.5" 
                       fill="#ffffff" 
                       className="animate-pulse"
                       filter="url(#glow)"
                     />
                   </g>
                </svg>

                {/* Confidence overlay text */}
                <div 
                  className={cn(
                    "absolute backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold font-mono tracking-widest border shadow-lg flex items-center gap-1.5",
                    viewAngle === 'DOWN_THE_LINE' ? "top-1/4" : "top-1/4 right-1/4",
                    ballTrackStatus === 'TRACKED' ? "bg-green-950/70 text-green-300 border-green-500/50" : "bg-yellow-950/70 text-yellow-300 border-yellow-500/50"
                  )}
                  style={{ transform: viewAngle === 'DOWN_THE_LINE' ? "translateY(-30px)" : "translate(20px, -20px)" }}
                >
                  CONF {ballTrackStatus === 'TRACKED' ? '92%' : '64%'}
                  <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                </div>
                
                {/* AI Analysis Button */}
                {!flightAnalysisResult && !isAnalyzingFlight && (
                  <button 
                    onClick={analyzeBallFlight}
                    className={cn(
                      "absolute flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 animate-in fade-in",
                      viewAngle === 'DOWN_THE_LINE' ? "top-1/3" : "top-1/3 right-1/4"
                    )}
                  >
                    <Bot className="w-4 h-4" /> AI Analyze Flight
                  </button>
                )}
                
                {/* Analyzing Indicator */}
                {isAnalyzingFlight && (
                  <div className={cn(
                    "absolute flex items-center gap-2 bg-purple-900/80 border border-purple-500/50 text-purple-100 px-4 py-2 rounded-full text-xs font-bold backdrop-blur animate-pulse",
                    viewAngle === 'DOWN_THE_LINE' ? "top-1/3" : "top-1/3 right-1/4"
                  )}>
                    <Zap className="w-4 h-4" /> Analyzing Trajectory...
                  </div>
                )}
                
                {/* AI Analysis Result */}
                {flightAnalysisResult && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 max-w-sm bg-black/80 backdrop-blur-md rounded-2xl border border-purple-500/30 p-5 shadow-2xl animate-in fade-in zoom-in-95 pointer-events-auto z-40">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                      <Bot className="w-5 h-5 text-purple-400" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Flight Analysis</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Distance</div>
                        <div className="text-sm font-semibold text-emerald-400">{flightAnalysisResult.distance}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Trajectory</div>
                        <div className="text-sm font-semibold text-blue-400">{flightAnalysisResult.trajectory}</div>
                      </div>
                    </div>
                    
                    <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20 mb-2">
                      <div className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-1">Top Observations</div>
                      <ul className="list-disc pl-4 text-xs text-red-200 leading-relaxed font-medium space-y-0.5">
                        {flightAnalysisResult.topObservations.map((obs, i) => (
                           <li key={i}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20 mb-3">
                      <div className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-1">Primary Correction</div>
                      <p className="text-xs text-blue-200 leading-relaxed font-medium">{flightAnalysisResult.primaryCorrection}</p>
                    </div>

                    <div className="text-[10px] text-yellow-500/80 text-center uppercase tracking-widest font-bold mb-2 border border-yellow-500/30 bg-yellow-500/10 rounded py-1">
                      MOCK DATA - NOT REAL ANALYSIS
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                      <span>Tracking Confidence: {flightAnalysisResult.confidence}</span>
                      <button onClick={() => setFlightAnalysisResult(null)} className="text-purple-400 hover:text-purple-300 underline">Dismiss</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Added sliders to adjust the path */}
            {ballTrackStatus === 'PARTIALLY_TRACKED' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 bg-black/60 p-3 rounded-xl border border-white/10 backdrop-blur z-20">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center mb-1">Adjust Path</label>
                
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500">Angle</span>
                  <input type="range" min="-30" max="30" value={manualOffsets.angle} onChange={e => setManualOffsets(p => ({...p, angle: parseInt(e.target.value)}))} className="w-24 accent-yellow-400" />
                </div>
                
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500">Left/Right</span>
                  <input type="range" min="-50" max="50" value={manualOffsets.x} onChange={e => setManualOffsets(p => ({...p, x: parseInt(e.target.value)}))} className="w-24 accent-yellow-400" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-32 bg-black pb-safe flex items-center justify-center px-8 border-t border-zinc-900">
        {!videoUrl ? (
          <button 
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={cn(
              "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all",
              isRecording ? "border-zinc-800" : "border-white"
            )}
          >
            {isRecording ? (
              <div className="w-8 h-8 bg-red-600 rounded-sm" />
            ) : (
              <div className="w-16 h-16 bg-red-600 rounded-full" />
            )}
          </button>
        ) : (
          <div className="flex w-full justify-around items-center">
            <button onClick={retake} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white">
              <RefreshCcw className="w-6 h-6" />
              <span className="text-xs">Retake</span>
            </button>
            <button onClick={saveToLibrary} className="flex gap-2 items-center px-6 py-3 bg-blue-600 rounded-full font-semibold">
              <Save className="w-5 h-5" /> Save Analysis
            </button>
            <button onClick={retake} className="flex flex-col items-center gap-1 text-red-500 hover:text-red-400">
              <Trash2 className="w-6 h-6" />
              <span className="text-xs">Discard</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
