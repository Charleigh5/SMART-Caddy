import React, { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, Target, AlertTriangle, Lightbulb, MapPin, Activity, Cloud, Wind, Volume2, Square, Mic } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTTS } from '../hooks/useTTS';

interface AiCaddyProps {
  courseName: string;
  holeNumber: number;
  par: number;
  yardage?: number;
  handicap?: number;
  shots: any[];
}

// Haversine formula to calculate yards between two lat/lng points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6967420; // Earth's radius in yards
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
}

export function AiCaddy({ courseName, holeNumber, par, yardage, handicap, shots }: AiCaddyProps) {
  const [advice, setAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [locationStr, setLocationStr] = useState("Unknown Location");
  const [weatherStr, setWeatherStr] = useState("");
  const [weatherData, setWeatherData] = useState<{temp: number, wind: number, dir: string, desc: string} | null>(null);

  const { playAudioFeedback: ttsPlay, stopAudio, isPlayingAudio, isGeneratingAudio } = useTTS();

  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'transcribing' | 'transcript-ready' | 'sending' | 'error'>('idle');
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [autoTTS, setAutoTTS] = useState(true);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
    }
  }, []);

  const playAudioFeedback = async (specificAdvice?: any) => {
    // AUDIT-ISSUE: AudioContext Autoplay Risk
    // TTS playback via AudioContext.resume() may fail or be muted by browser tab policies 
    // if not explicitly tied to a user gesture. Ensure autoTTS only triggers after user interaction.
    const currentAdvice = specificAdvice || advice;
    if (!currentAdvice) return;
    const text = `Situation read. ${currentAdvice.targetStrategy} Your club thought is: ${currentAdvice.clubThought}. ${currentAdvice.missStrategy} The recommended shot is: ${currentAdvice.shotRecommendation}.`;
    await ttsPlay(text);
  };

  useEffect(() => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(
         async pos => {
           const lat = pos.coords.latitude;
           const lng = pos.coords.longitude;
           setLocationStr(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
           
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
         },
         err => console.log('GPS error:', err)
       );
    }
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      if (voiceState === 'listening') {
        setVoiceState('idle');
      }
    }
  };

  const startListening = () => {
    setVoiceError(null);
    setTranscript('');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input not supported in this browser.');
      setVoiceState('error');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceState('listening');
    };

    recognition.onresult = (event: any) => {
      setVoiceState('transcribing');
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript || interimTranscript) {
        setTranscript(finalTranscript || interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setVoiceError(`Error: ${event.error}`);
      setVoiceState('error');
    };

    recognition.onend = () => {
      if (voiceState === 'listening' || voiceState === 'transcribing') {
          // If we have a transcript but haven't errored out
          setVoiceState(transcript.trim().length > 0 ? 'transcript-ready' : 'idle');
      }
    };

    try {
      recognition.start();
    } catch(e) {
      console.error(e);
      setVoiceError('Could not start microphone capture.');
      setVoiceState('error');
    }
  };

  const handleSubmitTranscript = () => {
    if (transcript.trim().length === 0) return;
    setVoiceState('sending');
    handleAskCaddy(transcript);
  };

  const handleClearTranscript = () => {
    setTranscript('');
    setVoiceState('idle');
    setVoiceError(null);
  };

  const handleAskCaddy = async (userQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      let context = `I am playing "${courseName}". I am on Hole ${holeNumber} (Par ${par}`;
      if (yardage) context += `, ${yardage} yards`;
      if (handicap) context += `, HCP ${handicap}`;
      context += `).\n`;
      
      if (weatherStr) {
        context += `Current Location: ${locationStr}. Weather: ${weatherStr}.\n`;
      }

      if (shots.length === 0) {
        context += `I am on the Tee Box preparing for my first shot.\n`;
      } else {
        context += `I have taken ${shots.length} shots so far:\n`;
        shots.forEach((s, i) => {
           let distText = "";
           if (i > 0 && s.gps && shots[i-1].gps) {
               distText = ` (Distance covered from previous shot: ${calculateDistance(shots[i-1].gps.lat, shots[i-1].gps.lng, s.gps.lat, s.gps.lng)} YDS)`;
           }
           context += `Shot ${i+1}: ${s.club} from ${s.lie}${distText}, resulting in ${s.result}. Penalty: ${s.penalty} strokes.\n`;
        });
        const lastShot = shots[shots.length - 1];
        const gpsText = lastShot.gps ? ` [GPS: Lat ${lastShot.gps.lat.toFixed(6)}, Lng ${lastShot.gps.lng.toFixed(6)}]` : '';
        const penaltyText = lastShot.penalty > 0 ? ` (Note: This recent shot incurred a ${lastShot.penalty} stroke penalty).` : '';
        context += `\nMy immediate situation: My most recent shot was with a ${lastShot.club} from a ${lastShot.lie} lie. The outcome/trajectory of that shot was: ${lastShot.result}.${penaltyText}${gpsText} Based carefully on this recent shot's trajectory, club selection, and outcome, please provide highly tailored strategic advice and club recommendations for my UPCOMING next shot from this ${lastShot.result} location.\n`;
      }

      if (userQuery) {
        context += `\n\nUSER QUESTION/INPUT:\n"${userQuery}"\n\nPlease directly address the user's question or instruction in your advice if possible.`;
      }

      const res = await fetch('/api/gemini/caddy-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
      });

      if (!res.ok) throw new Error('Failed to get caddy advice');
      const data = await res.json();
      setAdvice(data);
      
      // Auto-play TTS if a voice query was used
      if (userQuery && autoTTS) {
        setVoiceState('speaking');
        playAudioFeedback(data);
      } else {
        setVoiceState('idle');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching advice.');
      setVoiceState('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden mt-6 flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-sm">
          <Bot className="w-5 h-5" />
          AI Caddy {voiceState !== 'idle' && <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full ml-2">Voice: {voiceState}</span>}
        </div>
        <div className="flex items-center gap-2">
          {!advice && !loading && isSpeechSupported && (
            <button 
              onClick={() => voiceState === 'listening' ? stopListening() : startListening()}
              className={cn(
                "p-1.5 rounded-full shadow-lg transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
                voiceState === 'listening' || voiceState === 'transcribing' ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse" : "bg-blue-950 text-blue-400 border-blue-900/50 hover:bg-blue-900/50"
              )}
              title={voiceState === 'listening' ? "Stop listening" : "Speak to Caddy"}
              aria-label={voiceState === 'listening' ? "Stop listening" : "Use Web Speech Voice Query"}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          {!advice && !loading && (
            <button 
              onClick={() => handleAskCaddy()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors shadow-lg shadow-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              Manual Request
            </button>
          )}
        </div>
      </div>

      {voiceState === 'error' && voiceError && (
          <div className="bg-red-950/30 text-red-400 p-3 text-xs flex items-center justify-between border-b border-red-900/50">
             <span>{voiceError}</span>
             <button onClick={handleClearTranscript} className="uppercase font-bold underline px-2">Dismiss</button>
          </div>
      )}

      {(voiceState === 'transcribing' || voiceState === 'transcript-ready') && (
          <div className="bg-zinc-950 border-b border-zinc-800 p-4">
             <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2">Voice Query Transcript</div>
             <div className="text-sm text-zinc-300 italic mb-4">"{transcript}"</div>
             <div className="flex justify-end gap-3 flex-wrap">
                 <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-zinc-400 mr-auto">
                    <input type="checkbox" checked={autoTTS} onChange={(e) => setAutoTTS(e.target.checked)} className="accent-blue-500"/>
                    Auto-play TTS Response
                 </label>
                 <button onClick={handleClearTranscript} className="px-3 py-1.5 rounded-full text-xs font-bold uppercase border border-zinc-700 text-zinc-400 hover:bg-zinc-800">Clear</button>
                 <button onClick={handleSubmitTranscript} disabled={transcript.trim().length === 0} className="px-3 py-1.5 rounded-full text-xs font-bold uppercase bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">Send Query</button>
             </div>
          </div>
      )}

      {weatherData && (
        <div className="bg-zinc-950/80 border-b border-zinc-800/50 px-4 py-2 flex items-center justify-between gap-4 text-[10px] font-mono text-zinc-400">
           <div className="flex items-center gap-1.5">
             <MapPin className="w-3 h-3 text-emerald-500" />
             <span className="truncate max-w-[90px]">{locationStr.replace('Lat: ', '').replace(', Lng: ', ', ')}</span>
           </div>
           <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                 <Cloud className="w-3 h-3 text-blue-400" />
                 <span>{weatherData.temp}°F</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <Wind className="w-3 h-3 text-sky-400" />
                 <span>{weatherData.wind}mph {weatherData.dir}</span>
               </div>
           </div>
        </div>
      )}

      <div className="p-4">
        {!advice && !loading ? (
           <p className="text-zinc-500 text-sm text-center py-4">Request a strategy read and club thoughts for your next shot based on the current context.</p>
        ) : loading ? (
           <div className="flex flex-col items-center justify-center py-8 gap-3">
             <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
             <p className="text-blue-400 text-xs font-bold uppercase tracking-widest animate-pulse" aria-live="polite">Analyzing Course & Lie...</p>
           </div>
        ) : error ? (
           <div className="text-red-400 text-center text-sm py-4">{error}</div>
        ) : (
           <div className="space-y-4">
              <div className="bg-blue-950/30 border border-blue-900/50 rounded-2xl p-4">
                 <div className="flex items-center justify-between mb-2">
                   <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3" /> Target Strategy
                   </div>
                   <button 
                     onClick={() => playAudioFeedback()}
                     disabled={isGeneratingAudio}
                     className={cn(
                       "flex items-center gap-1.5 px-2 py-1 bg-blue-900/40 hover:bg-blue-800/60 rounded text-[10px] uppercase font-bold tracking-wider transition-colors",
                       isPlayingAudio ? "text-emerald-400" : "text-blue-300"
                     )}
                   >
                     {isGeneratingAudio ? <Loader2 className="w-3 h-3 animate-spin"/> : isPlayingAudio ? <Square className="w-3 h-3 fill-emerald-400"/> : <Volume2 className="w-3 h-3" />}
                     {isGeneratingAudio ? "Generating..." : isPlayingAudio ? "Stop" : "Listen"}
                   </button>
                 </div>
                 <div className="text-blue-50 text-sm">{advice.targetStrategy}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4">
                     <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Club Thought
                     </div>
                     <div className="text-emerald-100 text-sm">{advice.clubThought}</div>
                  </div>
                  <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-4">
                     <div className="text-[10px] uppercase font-bold text-red-500 tracking-wider mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Miss Strategy
                     </div>
                     <div className="text-red-100 text-sm">{advice.missStrategy}</div>
                  </div>
              </div>

              <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4">
                  <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Shot Recommendation
                  </div>
                  <div className="text-zinc-300 text-sm font-medium">{advice.shotRecommendation}</div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/50">
                  <div className="flex items-center gap-2">
                     <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Confidence Level</div>
                     <div className="text-[10px] uppercase font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{advice.confidence}</div>
                  </div>
                  {advice.dataGaps && advice.dataGaps.length > 0 && (
                     <div className="flex items-center gap-2">
                         <div className="text-[10px] uppercase font-bold text-orange-500/70 tracking-wider">Data Gaps</div>
                         <div className="flex flex-wrap gap-1">
                             {advice.dataGaps.map((gap: string, i: number) => (
                                <span key={i} className="text-[9px] border border-orange-900/50 text-orange-400 bg-orange-950/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {gap}
                                </span>
                             ))}
                         </div>
                     </div>
                  )}
              </div>
              
              <div className="flex justify-end pt-2 gap-3 flex-wrap">
                 {isSpeechSupported && (
                   <button 
                      onClick={() => voiceState === 'listening' ? stopListening() : startListening()} 
                      className={cn(
                        "text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 transition-colors border px-2 py-1 rounded-full",
                        voiceState === 'listening' || voiceState === 'transcribing' ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse" : "text-zinc-500 border-zinc-800 hover:text-blue-400 hover:border-blue-900/50"
                      )}
                   >
                      <Mic className="w-3 h-3" /> {voiceState === 'listening' ? 'Listening...' : 'Voice Query'}
                   </button>
                 )}
                 <button onClick={() => handleAskCaddy()} className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold hover:text-zinc-300 flex items-center gap-1 transition-colors">
                    <Bot className="w-3 h-3" /> Refresh Advice
                 </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
