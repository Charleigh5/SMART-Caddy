import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, MicOff, VideoOff, Target, Activity, Loader2, StopCircle, Volume2, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

/* Base64 encoding for PCM generated from float32array */
function pcmToBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(i * 2, s, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function Caddy() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'LIVE' | 'ERROR'>('IDLE');
  const [muted, setMuted] = useState(false);
  const [isScanningTarget, setIsScanningTarget] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  
  // TTS State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioCtxRefTTS = useRef<AudioContext | null>(null);
  const audioSourceRefTTS = useRef<AudioBufferSourceNode | null>(null);

  const stopAudio = () => {
    if (audioSourceRefTTS.current) {
      try {
        audioSourceRefTTS.current.stop();
        audioSourceRefTTS.current.disconnect();
      } catch (e) {}
      audioSourceRefTTS.current = null;
    }
    setIsPlayingAudio(false);
  };

  const playTTS = async (textToPlay: string) => {
    // AUDIT-ISSUE: AudioContext Autoplay Risk
    // Audio playback must be tied to a trusted user gesture (button click) 
    // to bypass browser autoplay restrictions.
    if (isPlayingAudio || isGeneratingAudio || !textToPlay) return;
    setIsGeneratingAudio(true);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToPlay })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          const binaryStr = atob(data.audio);
          const pcm16 = new Int16Array(binaryStr.length / 2);
          for (let i = 0; i < pcm16.length; i++) {
            pcm16[i] = binaryStr.charCodeAt(i * 2) | (binaryStr.charCodeAt(i * 2 + 1) << 8);
          }
          const audioCtx = new AudioContext({ sampleRate: 24000 });
          audioCtxRefTTS.current = audioCtx;
          const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < pcm16.length; i++) {
            channelData[i] = pcm16[i] / 32768.0;
          }
          const sourceNode = audioCtx.createBufferSource();
          sourceNode.buffer = audioBuffer;
          sourceNode.connect(audioCtx.destination);
          
          sourceNode.onended = () => setIsPlayingAudio(false);
          sourceNode.start(0);
          
          audioSourceRefTTS.current = sourceNode;
          setIsPlayingAudio(true);
        }
      }
    } catch (e) {
      console.error("TTS fetch error", e);
    }
    setIsGeneratingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRefTTS.current) {
        audioCtxRefTTS.current.close().catch(() => {});
      }
    };
  }, []);
  
  // Context state
  const [currentHole, setCurrentHole] = useState(4);
  const [distanceToPin, setDistanceToPin] = useState(165); // yards
  const [currentPar, setCurrentPar] = useState<number | undefined>(undefined);
  const [currentHandicap, setCurrentHandicap] = useState<number | undefined>(undefined);
  const [currentScore, setCurrentScore] = useState('+2');
  const [locationStr, setLocationStr] = useState("Unknown GPS");
  const [weatherStr, setWeatherStr] = useState("Sunny, light breeze (72°F)");
  const [weatherData, setWeatherData] = useState<{temp: number, wind: number, dir: string, desc: string} | null>(null);
  const [shotInfo, setShotInfo] = useState("At the tee.");

  useEffect(() => {
    const bc = new BroadcastChannel('caddy-context');
    bc.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'CONTEXT_UPDATE') {
         if (payload.holeNumber !== undefined) setCurrentHole(payload.holeNumber);
         if (payload.hole !== undefined && payload.holeNumber === undefined) setCurrentHole(payload.hole);
         if (payload.yardage !== undefined) setDistanceToPin(payload.yardage);
         if (payload.distance !== undefined && payload.yardage === undefined) setDistanceToPin(payload.distance);
         if (payload.par !== undefined) setCurrentPar(payload.par);
         if (payload.handicap !== undefined) setCurrentHandicap(payload.handicap);
         if (payload.score !== undefined) setCurrentScore(payload.score);
         if (payload.shotInfo !== undefined) setShotInfo(payload.shotInfo);
      }
    };
    return () => bc.close();
  }, []);

  useEffect(() => {
    let watchId: number;
    let lastFetchTime = 0;

    if (navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(
         async pos => {
           const lat = pos.coords.latitude;
           const lng = pos.coords.longitude;
           setLocationStr(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
           
           const now = Date.now();
           // Only fetch weather at most once every 5 minutes to avoid rate limiting
           if (now - lastFetchTime > 5 * 60 * 1000) {
             lastFetchTime = now;
             try {
               const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`);
               const data = await res.json();
               if (data.current) {
                 const temp = Math.round(data.current.temperature_2m);
                 const windSpeed = Math.round(data.current.wind_speed_10m);
                 const windDir = data.current.wind_direction_10m;
                 const wmoCodes: Record<number, string> = {
                    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
                    45: "Fog", 48: "Depositing rime fog",
                    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
                    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
                    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
                    95: "Thunderstorm"
                 };
                 const desc = wmoCodes[data.current.weather_code] || "Clear";
                 const compass = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "N"];
                 const dirStr = compass[Math.round((windDir % 360) / 22.5)];
                 setWeatherStr(`${desc}, ${temp}°F. Wind: ${windSpeed}mph ${dirStr}`);
                 setWeatherData({ temp, wind: windSpeed, dir: dirStr, desc });
               }
             } catch (e) {
               console.error("Failed to fetch weather", e);
             }
           }
         },
         err => console.log('GPS error:', err),
         { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
       );
    }
    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const frameIntervalRef = useRef<any>(null);

  // Send context updates when variables change during live connection
  useEffect(() => {
    if (status === 'LIVE' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const parText = currentPar !== undefined ? currentPar : "unknown";
      const hcpText = currentHandicap !== undefined ? currentHandicap : "unknown";
      const msg = `System Update for Caddy context: User is now on Hole ${currentHole}, par is ${parText}, yardage is ${distanceToPin}, handicap is ${hcpText}, score relative to par is ${currentScore}. Shot context: ${shotInfo}. Location is ${locationStr}. Weather is ${weatherStr}.`;
      wsRef.current.send(JSON.stringify({ type: 'live.text.input', payload: { text: msg } }));
    }
  }, [currentHole, distanceToPin, currentPar, currentHandicap, currentScore, shotInfo, locationStr, weatherStr, status]);

  // Initialize camera on mount for viewfinder
  useEffect(() => {
    let mounted = true;
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.error('Failed to get camera feed', err);
      }
    };
    initCamera();

    return () => {
      mounted = false;
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startLive = async () => {
    try {
      setStatus('CONNECTING');
      
      // Need both audio and video for the live connection
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }


      const contextData = {
        currentHole,
        par: currentPar,
        yardage: distanceToPin,
        handicap: currentHandicap,
        currentScore,
        shotHistory: shotInfo,
        courseLocation: locationStr,
        weather: weatherStr
      };
      
      const contextStr = encodeURIComponent(JSON.stringify(contextData));

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live/gemini?context=${contextStr}`);
      wsRef.current = ws;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      nextPlayTimeRef.current = audioCtx.currentTime;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && !muted) {
          const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ type: 'live.audio.input', payload: { data: base64 } }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      ws.onopen = () => {
        setStatus('LIVE');
        ws.send(JSON.stringify({ type: 'live.start' }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'live.audio.output' && msg.payload?.data) {
          setIsScanningTarget(false);
          const binaryStr = atob(msg.payload.data);
          const buffer = new ArrayBuffer(binaryStr.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < binaryStr.length; i++) {
            view[i] = binaryStr.charCodeAt(i);
          }
          
          if (audioCtxRef.current) {
             audioCtxRef.current.decodeAudioData(buffer, (audioBuffer) => {
               const sourceNode = audioCtxRef.current!.createBufferSource();
               sourceNode.buffer = audioBuffer;
               sourceNode.connect(audioCtxRef.current!.destination);
               
               const startTime = Math.max(audioCtxRef.current!.currentTime, nextPlayTimeRef.current);
               sourceNode.start(startTime);
               nextPlayTimeRef.current = startTime + audioBuffer.duration;
             });
          }
        }
        if (msg.type === 'live.transcript.delta' && msg.payload?.text) {
           setIsScanningTarget(false);
           setAnalysisText(prev => prev + msg.payload.text);
        }
        if (msg.type === 'live.interrupted') {
          nextPlayTimeRef.current = audioCtxRef.current ? audioCtxRef.current.currentTime : 0;
        }
      };

      ws.onerror = () => {
        setStatus('ERROR');
      };

      // AUDIT-ISSUE: LiveVideoInput setInterval Risk
      // Fixed: Moved to requestAnimationFrame and integrated document visibility checks.
      let lastFrameTime = 0;
      const captureFrameLoop = (timestamp: number) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        frameIntervalRef.current = requestAnimationFrame(captureFrameLoop);
        
        if (document.visibilityState !== 'visible') return;

        if (timestamp - lastFrameTime >= 2000) {
          lastFrameTime = timestamp;
          if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
               canvas.width = Math.min(video.videoWidth, 640);
               canvas.height = (canvas.width / video.videoWidth) * video.videoHeight;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                 ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                 const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                 const base64 = dataUrl.split(',')[1];
                 ws.send(JSON.stringify({ type: 'live.video.frame', payload: { data: base64 } }));
               }
            }
          }
        }
      };
      
      frameIntervalRef.current = requestAnimationFrame(captureFrameLoop);

    } catch (e) {
      console.error(e);
      setStatus('ERROR');
    }
  };

  const stopLive = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (frameIntervalRef.current) {
      cancelAnimationFrame(frameIntervalRef.current);
    }
    setStatus('IDLE');
  };

  useEffect(() => {
    return () => stopLive();
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden">
      {/* Live Camera Viewfinder */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* AR Viewfinder Overlay - Always Visible */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center pt-8">
          {/* Rangefinder HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-black/40 rounded-[3rem] m-2 z-0"></div>
          
          {/* Top Info Bar */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-4 w-full px-8 justify-between pointer-events-auto">
             <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center flex-1 font-mono">
               <span className="block text-[8px] text-green-400 font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">Hole</span>
               <div className="flex items-center justify-center gap-1">
                 <button onClick={() => setCurrentHole(Math.max(1, currentHole - 1))} className="text-zinc-500 hover:text-white px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 transition-transform" aria-label="Previous Hole">-</button>
                 <span className="block text-xl font-bold text-white shadow-black drop-shadow-md min-w-[32px] text-center">{currentHole}</span>
                 <button onClick={() => setCurrentHole(Math.min(18, currentHole + 1))} className="text-zinc-500 hover:text-white px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 transition-transform" aria-label="Next Hole">+</button>
               </div>
             </div>
             
             <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center flex-1 font-mono flex flex-col justify-center items-center">
               <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">GPS Dist</span>
               <span className="block text-xl font-bold text-white shadow-black drop-shadow-md">{distanceToPin}<span className="text-sm font-normal text-zinc-400">y</span></span>
             </div>

             <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center flex-1 font-mono flex flex-col justify-center items-center">
               <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">Score</span>
               <span className="block text-xl font-bold text-white shadow-black drop-shadow-md">{currentScore}</span>
             </div>
          </div>

          {/* Weather & Location Info Bar */}
          {weatherData && (
              <div className="absolute top-28 left-1/2 -translate-x-1/2 flex items-center gap-4 w-11/12 max-w-sm justify-center pointer-events-auto">
                 <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-center flex items-center gap-4 font-mono justify-center shadow-xl w-full">
                    <div className="flex flex-col items-center flex-1">
                       <span className="block text-[8px] text-orange-400 font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">Temp</span>
                       <span className="block text-xl font-bold text-white shadow-black drop-shadow-md w-full">{weatherData.temp}°<span className="text-sm font-normal text-zinc-400">F</span></span>
                    </div>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex flex-col items-center flex-1">
                       <span className="block text-[8px] text-blue-400 font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">Wind</span>
                       <span className="block text-xl font-bold text-white shadow-black drop-shadow-md truncate w-full">{weatherData.wind}<span className="text-[10px] font-normal text-zinc-400 ml-1 block mt-px">{weatherData.dir} mph</span></span>
                    </div>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex-col items-center flex-[1.5] flex">
                       <span className="block text-[8px] text-zinc-400 font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">GPS ({weatherData.desc})</span>
                       <span className="block text-[8px] font-bold text-zinc-300 shadow-black drop-shadow-md truncate w-full mt-2 leading-none max-w-[80px]">{locationStr.replace('Lat: ', '').replace(', Lng: ', ', ')}</span>
                    </div>
                 </div>
              </div>
          )}

          {/* Center Crosshair for Targeting */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
             {/* Dynamic color based on status */}
             <div className={cn("w-32 h-32 border border-dashed rounded-full flex items-center justify-center transition-all duration-500", 
                 isScanningTarget ? 'border-green-400 scale-110 animate-[spin_3s_linear_infinite]' : (status === 'LIVE' ? 'border-green-500/50' : 'border-white/50'))}
             >
                <div className={cn("w-8 h-8 relative transition-all duration-500", isScanningTarget && "scale-125")}>
                   <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3", isScanningTarget ? 'bg-green-400' : (status === 'LIVE' ? 'bg-green-500' : 'bg-white'))}></div>
                   <div className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3", isScanningTarget ? 'bg-green-400' : (status === 'LIVE' ? 'bg-green-500' : 'bg-white'))}></div>
                   <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-3 h-0.5", isScanningTarget ? 'bg-green-400' : (status === 'LIVE' ? 'bg-green-500' : 'bg-white'))}></div>
                   <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-3 h-0.5", isScanningTarget ? 'bg-green-400' : (status === 'LIVE' ? 'bg-green-500' : 'bg-white'))}></div>
                   <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full", isScanningTarget ? 'bg-green-400' : (status === 'LIVE' ? 'bg-green-500' : 'bg-white'))}></div>
                </div>
             </div>
             <div className="absolute top-full mt-4 text-center">
                <span className={cn("inline-block px-2 py-1 bg-black/40 backdrop-blur rounded text-[10px] font-mono tracking-widest uppercase transition-all", isScanningTarget ? 'text-green-300 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : (status === 'LIVE' ? 'text-green-400' : 'text-white/70'))}>
                  {isScanningTarget ? 'SCANNING HARMONICS...' : (status === 'LIVE' ? 'ANALYZING SCENE' : 'ALIGN FLAG IN CENTER')}
                </span>
             </div>
          </div>
          
          <div className="absolute bottom-1/3 transition-opacity duration-300 w-full px-12" style={{ opacity: status === 'LIVE' ? 1 : 0.5 }}>
             <div className="bg-black/60 backdrop-blur border border-white/10 px-4 py-3 rounded-xl shadow-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center flex-1">
                     {isScanningTarget ? 'TARGET LOCKED' : (analysisText ? 'CADDY ANALYSIS' : (status === 'LIVE' ? 'Live Caddy Active' : 'Rangefinder Off'))}
                  </span>
                  {analysisText && (
                    <div className="flex items-center gap-2">
                       {isPlayingAudio ? (
                          <button onClick={stopAudio} aria-label="Stop audio" className="bg-white/10 hover:bg-white/20 p-3 min-w-[44px] min-h-[44px] flex justify-center items-center rounded-full text-zinc-400 hover:text-white transition-colors">
                              <Square className="w-5 h-5 fill-current" />
                          </button>
                       ) : (
                          <button onClick={() => playTTS(analysisText)} aria-label="Play audio" disabled={isGeneratingAudio} className="bg-emerald-500/20 hover:bg-emerald-500/40 p-3 min-w-[44px] min-h-[44px] flex justify-center items-center rounded-full text-emerald-400 hover:text-white transition-colors cursor-pointer">
                              {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                       )}
                       <button onClick={() => setAnalysisText('')} aria-label="Clear analysis" className="bg-white/10 hover:bg-white/20 p-3 min-w-[44px] min-h-[44px] flex justify-center items-center rounded-full text-zinc-400 hover:text-white transition-colors">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                       </button>
                    </div>
                  )}
                </div>
                {analysisText ? (
                   <p className="text-sm font-semibold text-white whitespace-pre-wrap">{analysisText}</p>
                ) : (
                   <span className="block text-sm font-semibold text-white text-center">
                      {isScanningTarget ? 'Processing flag position, distance, elevation, and strategy...' : (status === 'LIVE' ? 'Point at target and lock, or ask for advice' : 'Start live view to use AI Caddy')}
                   </span>
                )}
             </div>
          </div>
      </div>

      {/* Controls */}

      <div className="absolute bottom-8 z-10 flex items-center gap-6">
        {status === 'IDLE' && (
          <button 
            onClick={startLive}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            <Camera className="w-5 h-5" />
            Start Live Viewfinder
          </button>
        )}
        
        {status === 'CONNECTING' && (
          <button disabled className="flex items-center gap-3 bg-zinc-800 text-zinc-400 px-8 py-4 rounded-full font-bold shadow-xl cursor-not-allowed">
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting...
          </button>
        )}

        {status === 'LIVE' && (
          <>
            <button 
              onClick={() => setMuted(!muted)}
              className={cn(
                "p-4 rounded-full shadow-xl transition-all",
                muted ? "bg-red-500/20 text-red-500 border border-red-500/50" : "bg-black/50 text-white border border-white/20 hover:bg-black/70 backdrop-blur"
              )}
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button 
               onClick={() => {
                 if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    setIsScanningTarget(true);
                    setAnalysisText('');
                    
                    // Capture high-res frame immediately
                    if (videoRef.current && canvasRef.current) {
                      const canvas = canvasRef.current;
                      const video = videoRef.current;
                      if (video.videoWidth > 0 && video.videoHeight > 0) {
                         canvas.width = Math.min(video.videoWidth, 1280);
                         canvas.height = (canvas.width / video.videoWidth) * video.videoHeight;
                         const ctx = canvas.getContext('2d');
                         if (ctx) {
                           ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                           const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                           const base64 = dataUrl.split(',')[1];
                           wsRef.current.send(JSON.stringify({ type: 'live.video.frame', payload: { data: base64 } }));
                         }
                      }
                    }

                    wsRef.current.send(JSON.stringify({ 
                      type: 'live.text.input',
                      payload: {
                        text: "User has locked target on the viewfinder. Please analyze the current visual frame and immediately report back in a concise, authoritative caddy tone incorporating:\n1) Flag Position & Distance Estimation\n2) Shot Recommendations & Strategy Tips\n3) Target Elevation & Hazards\n4) Data Gap Notifications (what you cannot reliably see/measure)."
                      }
                    }));

                    setTimeout(() => setIsScanningTarget(false), 6000);
                 }
              }}
              className={cn(
                "flex items-center gap-2 px-6 py-4 rounded-full font-bold shadow-xl transition-all",
                isScanningTarget ? "bg-green-500/80 animate-pulse text-white scale-105" : "bg-green-600 hover:bg-green-500 text-white hover:scale-105 active:scale-95"
              )}
              disabled={isScanningTarget}
            >
              <Target className={cn("w-6 h-6", isScanningTarget && "animate-spin")} />
              {isScanningTarget ? "Analyzing Scene..." : "Lock Target & Analyze"}
            </button>
            <button 
              onClick={stopLive}
              className="p-4 rounded-full shadow-xl bg-red-600 hover:bg-red-500 text-white transition-all transform hover:scale-105 active:scale-95"
            >
              <StopCircle className="w-6 h-6" />
            </button>
          </>
        )}

        {status === 'ERROR' && (
          <div className="text-center space-y-4">
             <div className="text-red-400 bg-red-950/50 border border-red-900 px-4 py-2 rounded-lg text-sm mb-4">
               Failed to connect. Make sure you have granted microphone and camera permissions.
             </div>
             <button 
                onClick={startLive}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-full font-bold shadow-xl mx-auto block transition-all"
             >
                Retry
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
