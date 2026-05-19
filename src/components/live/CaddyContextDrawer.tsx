import React from 'react';
import { CaddyContext } from '../../live/liveOverlayState';
import { CaddyAdvice } from '../../caddy/runtime/caddyAdviceSchema';
import { Database, Cloud, FileText, Settings, ShieldAlert, BookOpen, AlertTriangle } from 'lucide-react';

interface Props {
  context: CaddyContext | null;
  advice: CaddyAdvice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CaddyContextDrawer({ context, advice, isOpen, onClose }: Props) {
  if (!isOpen || !context) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 top-1/2 bg-zinc-950/95 backdrop-blur-3xl rounded-t-3xl border-t border-zinc-800 p-6 z-50 overflow-y-auto shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-white font-bold tracking-widest uppercase text-sm">Caddy Memory Context</h4>
        <button onClick={onClose} className="px-3 py-1 bg-zinc-800 rounded text-xs text-zinc-400 font-bold hover:text-white transition-colors">
          CLOSE
        </button>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <h5 className="flex items-center gap-1.5 text-blue-400 text-xs font-bold uppercase tracking-widest"><Database className="w-3.5 h-3.5" /> Player & Environment</h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-300"><span className="text-zinc-500 block text-[10px]">Profile</span>{context.profile}</div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-300"><span className="text-zinc-500 block text-[10px]">Location</span>{context.courseHole}</div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-300"><span className="text-zinc-500 block text-[10px]">Weather</span>{context.weather}</div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-300"><span className="text-zinc-500 block text-[10px]">Clubs</span>{context.clubData}</div>
          </div>
        </div>

        <div className="space-y-3">
          <h5 className="flex items-center gap-1.5 text-purple-400 text-xs font-bold uppercase tracking-widest"><BookOpen className="w-3.5 h-3.5" /> Recent History</h5>
          <div className="bg-zinc-900 rounded p-3 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
            {context.shotHistory}
          </div>
        </div>

        <div className="space-y-3">
           <h5 className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-widest"><FileText className="w-3.5 h-3.5" /> Derived Memory Facts</h5>
           <ul className="text-zinc-400 text-xs list-disc pl-4 space-y-1">
             {context.memoryFacts.map((fact, i) => <li key={i}>{fact}</li>)}
             {context.memoryFacts.length === 0 && <li className="italic text-zinc-600">No recent facts derived</li>}
           </ul>
        </div>

        <div className="space-y-3">
          <h5 className="flex items-center gap-1.5 text-yellow-500 text-xs font-bold uppercase tracking-widest"><Settings className="w-3.5 h-3.5" /> System Info</h5>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400">Model: <span className="text-white">{context.providerModel || 'N/A'}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400">Config: <span className="text-white">{context.providerConfigSource || 'unknown'}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400">Connected: <span className={context.providerConnected ? "text-emerald-400" : "text-zinc-500"}>{context.providerConnected ? 'YES' : 'NO'}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400">Path: <span className="text-white">{context.providerPath}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2">Fallback: <span className="text-white">{context.fallbackUsed || context.fallbackPath}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2">Receipt: <span className="text-blue-400">{context.receiptId || 'None'}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2">Evidence IDs: <span className="text-purple-400">{context.evidenceIds?.join(', ') || 'None'}</span></div>
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2">Parser Source: <span className="text-green-400">{advice?.source || 'Unknown'}</span></div>
            {context.audioTelemetry && (
              <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2">Audio: <span className="text-blue-400">{context.audioTelemetry}</span></div>
            )}
            {context.videoTelemetry && (
              <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2">Video: <span className="text-blue-400">{context.videoTelemetry}</span></div>
            )}
            <div className="bg-zinc-900 rounded p-2 border border-zinc-800 text-zinc-400 col-span-2 flex items-center justify-between">
               Confidence Cap: 
               {advice?.confidenceCapped ? (
                 <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> APPLIED</span>
               ) : (
                 <span className="text-emerald-400">None</span>
               )}
            </div>
          </div>
        </div>

        {advice && advice.dataGaps.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3">
            <h5 className="flex items-center gap-1.5 text-amber-500 text-xs font-bold uppercase tracking-widest mb-2"><AlertTriangle className="w-3.5 h-3.5" /> Data Gaps</h5>
            <ul className="text-amber-300/80 text-[10px] uppercase font-mono list-disc pl-4">
               {advice.dataGaps.map((gap, i) => <li key={i}>{gap}</li>)}
            </ul>
          </div>
        )}

        {context.blockedClaims.length > 0 && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
            <h5 className="flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase tracking-widest mb-2"><ShieldAlert className="w-3.5 h-3.5" /> Blocked Claims</h5>
            <ul className="text-red-300/80 text-[10px] uppercase font-mono list-disc pl-4">
               {context.blockedClaims.map((claim, i) => <li key={i}>{claim}</li>)}
            </ul>
          </div>
        )}

        {advice && advice.blockedClaims && advice.blockedClaims.length > 0 && context.blockedClaims.length === 0 && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
            <h5 className="flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase tracking-widest mb-2"><ShieldAlert className="w-3.5 h-3.5" /> Parsed Blocked Claims</h5>
            <ul className="text-red-300/80 text-[10px] uppercase font-mono list-disc pl-4">
               {advice.blockedClaims.map((claim, i) => <li key={i}>{claim}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
