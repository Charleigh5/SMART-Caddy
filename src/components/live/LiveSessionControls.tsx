import React, { useState, useEffect } from 'react';
import { LiveSessionStatus, liveReceiptMemory } from '../../live/liveSessionState';
import { LiveGeminiClient } from '../../live/liveGeminiClient';
import { LiveStatusBadge } from './LiveStatusBadge';
import { ARViewfinder } from './ARViewfinder';
import { CaddyContextDrawer } from './CaddyContextDrawer';
import { CaddyAdvice } from '../../caddy/runtime/caddyAdviceSchema';

export function LiveSessionControls() {
  const [status, setStatus] = useState<LiveSessionStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [client, setClient] = useState<LiveGeminiClient | null>(null);
  const [enableVideo, setEnableVideo] = useState<boolean>(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [advice, setAdvice] = useState<CaddyAdvice | null>(null);
  const [metrics, setMetrics] = useState({
    framesSent: 0,
    maxPayloadBytes: 0,
    averagePayloadBytes: 0,
    micPerm: 'NOT_REQUESTED' as any,
    camPerm: 'NOT_REQUESTED' as any,
    providerConnected: false,
    providerModel: 'unknown',
    providerTextModel: 'unknown',
    providerConfigSource: 'unknown',
    providerLiveEnabled: false,
    providerHasApiKey: false,
    providerError: null as string | null,
    fallbackUsed: null as string | null
  });

  useEffect(() => {
    const c = new LiveGeminiClient((newStatus, err) => {
      setStatus(newStatus);
      if (err) setErrorMsg(err);
      else setErrorMsg(null);
    });
    c.onAdviceChange = (msg) => {
      setAdvice({...msg});
    };
    setClient(c);

    return () => {
      c.disconnect();
    };
  }, []);

  useEffect(() => {
    let interval: number;
    if (client && (status === 'CONNECTED' || status === 'LISTENING' || status === 'THINKING' || status === 'SPEAKING')) {
      interval = window.setInterval(() => {
        setMetrics(client.getMetrics());
      }, 500);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [client, status]);

  const handleToggle = () => {
    if (!client) return;
    if (status === 'IDLE' || status === 'FAILED_RETRYABLE' || status === 'FAILED_FINAL') {
      setAdvice(null);
      client.connect(enableVideo);
    } else {
      client.disconnect();
      setMetrics(client.getMetrics()); // force final update
    }
  };

  const isConnected = status === 'CONNECTED' || status === 'LISTENING' || status === 'THINKING' || status === 'SPEAKING';
  const fallbackActive = status === 'DEGRADED_TEXT_ONLY' || status.includes('FAILED');
  
  const lastReceipt = liveReceiptMemory.length > 0 ? liveReceiptMemory[liveReceiptMemory.length - 1] : null;

  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm tracking-widest uppercase text-blue-500">Gemini Live Realtime</h3>
      </div>
      
      {/* Immersive Viewfinder */}
      <ARViewfinder 
        videoStream={client?.getStream() || null}
        videoEnabled={enableVideo && isConnected}
        micPerm={metrics.micPerm}
        camPerm={metrics.camPerm}
        geminiConnected={metrics.providerConnected}
        framesSent={metrics.framesSent}
        averagePayloadBytes={metrics.averagePayloadBytes}
        maxPayloadBytes={metrics.maxPayloadBytes}
        advice={advice}
        mode={isConnected ? 'ACTIVE' : fallbackActive ? 'FALLBACK' : 'SETUP'}
        fallbackActive={fallbackActive}
      />

      <div className="flex justify-center -mt-2 relative z-20">
        <button 
           onClick={() => setShowDrawer(true)}
           className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-zinc-700 transition"
        >
          View Caddy Memory
        </button>
      </div>

      <CaddyContextDrawer 
         isOpen={showDrawer}
         onClose={() => setShowDrawer(false)}
         advice={advice}
         context={showDrawer ? {
           profile: 'Pro',
           courseHole: 'Pebble Beach #7',
           weather: '72F / 12mph Wind',
           shotHistory: 'Last shot was 105y with PW. Landed short. Tendency to pull left on this hole.',
           clubData: 'PW (110y max), 9i (125y max)',
           memoryFacts: ['User prefers safe play over water', 'Avoids deep bunkers'],
           providerPath: status,
           fallbackPath: fallbackActive ? 'REST or LOCAL' : 'None',
           providerModel: metrics.providerModel,
           providerConfigSource: client?.['providerConfig']?.configSource || 'unknown',
           providerConnected: metrics.providerConnected,
           fallbackUsed: metrics.fallbackUsed,
           blockedClaims: advice?.blockedClaims || [],
           receiptId: lastReceipt?.sessionId || null,
           evidenceIds: lastReceipt?.evidenceIds || [],
           audioTelemetry: lastReceipt ? `Sent: ${lastReceipt.audioChunksSent} / Rcvd: ${lastReceipt.audioChunksReceivedFromProvider}` : undefined,
           videoTelemetry: lastReceipt ? `Captured: ${lastReceipt.videoFramesCaptured} / Sent: ${lastReceipt.videoFramesSent} / Avg: ${(lastReceipt.averageFramePayloadBytes / 1024).toFixed(1)}k` : undefined
         } : null}
      />

      {errorMsg && (
        <div className="p-2 bg-red-950/50 border border-red-900/50 rounded text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-800 pt-4 pb-2">
         <div className="flex items-center gap-2">
           <span className="text-xs text-zinc-300 font-bold uppercase tracking-widest">Voice</span>
           <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-2 rounded ml-1">ON</span>
         </div>
         <div className="flex items-center gap-4">
           
           <button
             onClick={async () => {
               // Load fixtures
               const success = await import('../../live/__fixtures__/providerSmokeSuccessReceipt.json').then(m => m.default).catch(() => null);
               const disabled = await import('../../live/__fixtures__/providerSmokeDisabledReceipt.json').then(m => m.default).catch(() => null);
               const failure = await import('../../live/__fixtures__/providerSmokeFailureReceipt.json').then(m => m.default).catch(() => null);
               
               const { saveLiveReceipt } = await import('../../live/liveSessionState');
               
               if (success) saveLiveReceipt(success as any);
               if (disabled) saveLiveReceipt(disabled as any);
               if (failure) saveLiveReceipt(failure as any);

               setAdvice({
                 source: 'GEMINI_LIVE',
                 situation: 'Testing E2E HUD',
                 smartTarget: 'Fairway',
                 clubThought: 'Smooth tempo',
                 avoid: 'Left bunker',
                 riskLevel: 'LOW',
                 confidence: 0.95,
                 confidenceCapped: false,
                 dataGaps: ['Missing spin rate'],
                 blockedClaims: ['Cures slice']
               });

               setMetrics(m => ({...m, providerConnected: true, providerModel: 'models/gemini-2.0-flash-exp'}));
               
               setStatus('IDLE'); // Just to trigger a re-render
             }}
             className="text-[10px] bg-indigo-900/40 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-800/50 px-2 py-1 uppercase rounded"
           >
             Run Live HUD E2E Check
           </button>
           <LiveStatusBadge status={status} />
           <button
             onClick={() => setEnableVideo(!enableVideo)}
             disabled={isConnected || status === 'CONNECTING'}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
               enableVideo 
                 ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                 : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
             } disabled:opacity-50 disabled:cursor-not-allowed`}
           >
             {enableVideo ? 'SIGHT ADDED' : 'ADD SIGHT'}
           </button>
         </div>
      </div>

      <button
        onClick={handleToggle}
        className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors ${
          isConnected || status === 'CONNECTING'
            ? 'bg-red-900/50 hover:bg-red-900 text-red-500 border border-red-800' 
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {isConnected || status === 'CONNECTING' ? 'Disconnect Live' : 'Connect to Live Caddy'}
      </button>

      {lastReceipt && (
        <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-[10px] font-mono text-zinc-400 space-y-1 mt-4">
          <div className="text-zinc-500 uppercase tracking-widest font-bold mb-2 border-b border-zinc-800 pb-1 flex justify-between">
            <span>Last Session Receipt</span>
            <span>{lastReceipt.startedAt?.split('T')[1]?.split('.')[0] || 'Unknown'}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div>ID: <span className="text-blue-400">{lastReceipt.sessionId.split('-').pop()}</span></div>
            <div>Status: <span className={lastReceipt.finalLiveState.includes('FAILED') ? 'text-red-400' : 'text-emerald-400'}>{lastReceipt.finalLiveState}</span></div>
            <div>Duration: <span className="text-yellow-400">{lastReceipt.durationSeconds.toFixed(1)}s</span></div>
            <div>Provider: <span className={lastReceipt.providerConnected ? 'text-emerald-400' : 'text-zinc-500'}>{lastReceipt.providerConnected ? 'OK' : 'Error'}</span></div>
            <div>Cam Perm: <span className={lastReceipt.cameraPermissionState === 'GRANTED' ? 'text-emerald-400' : 'text-zinc-500'}>{lastReceipt.cameraPermissionState}</span></div>
            <div>Mic Perm: <span className={lastReceipt.micPermissionState === 'GRANTED' ? 'text-emerald-400' : 'text-zinc-500'}>{lastReceipt.micPermissionState}</span></div>
            <div>Aud Sent: <span className="text-blue-400">{lastReceipt.audioChunksSent}</span></div>
            <div>Aud Rcvd: <span className="text-emerald-400">{lastReceipt.audioChunksReceivedFromProvider}</span></div>
            <div>Frames Sent: <span className="text-blue-400">{lastReceipt.videoFramesSent}</span></div>
            <div>Conf Hash: <span className="text-blue-400 text-[9px]">{lastReceipt.contextCardHash ? lastReceipt.contextCardHash.substring(0,6) : 'None'}</span></div>
            <div>Avg Frame: <span className="text-purple-400">{(lastReceipt.averageFramePayloadBytes / 1024).toFixed(1)}k</span></div>
            <div>Max Frame: <span className="text-purple-400">{(lastReceipt.maxFramePayloadBytes / 1024).toFixed(1)}k</span></div>
          </div>
        </div>
      )}

      <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-[10px] font-mono text-zinc-400 space-y-1 mt-4">
          <div className="text-zinc-500 uppercase tracking-widest font-bold mb-2 border-b border-zinc-800 pb-1 flex justify-between">
            <span>Provider Diagnostics</span>
            <span className={metrics.providerConnected ? 'text-emerald-400' : (status.includes('FAILED') ? 'text-red-400' : 'text-yellow-500')}>
              {metrics.providerConnected ? 'CONNECTED' : (status.includes('FAILED') ? 'DISABLED/ERROR' : 'IDLE')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
            <div>Live Enabled: <span className={metrics.providerLiveEnabled ? 'text-emerald-400' : 'text-red-400'}>{metrics.providerLiveEnabled ? 'YES' : 'NO'}</span></div>
            <div>API Key: <span className={metrics.providerHasApiKey ? 'text-emerald-400' : 'text-red-400'}>{metrics.providerHasApiKey ? 'PRESENT' : 'MISSING'}</span></div>
            <div className="col-span-2">Live Model: <span className="text-purple-400">{metrics.providerModel}</span></div>
            <div className="col-span-2">Text Model: <span className="text-purple-400">{metrics.providerTextModel}</span></div>
            <div>Config Source: <span className="text-blue-400">{metrics.providerConfigSource}</span></div>
            <div>Fallback: <span className={metrics.fallbackUsed ? 'text-yellow-400' : 'text-zinc-500'}>{metrics.fallbackUsed || 'None'}</span></div>
            {metrics.providerError && (
               <div className="col-span-2 bg-red-950/40 border border-red-900/50 p-2 rounded text-red-500 mt-1 flex flex-col gap-1">
                 <span className="font-bold">Last Provider Error:</span>
                 {metrics.providerError}
               </div>
            )}
          </div>
      </div>
    </div>
  );
}
