import React from 'react';
import { CaddyAdvice } from '../../caddy/runtime/caddyAdviceSchema';
import { Target, ShieldAlert, Zap, AlertCircle, Info, Volume2, Square, Loader2 } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';

interface Props {
  advice: CaddyAdvice | null;
}

export function CaddyAdviceCard({ advice }: Props) {
  const { playAudioFeedback, isPlayingAudio, isGeneratingAudio } = useTTS();

  if (!advice) return null;

  const handleListen = () => {
    const textToRead = `${advice.situation} Target: ${advice.smartTarget}. Club thought: ${advice.clubThought}. Avoid: ${advice.avoid}.`;
    playAudioFeedback(textToRead);
  };

  const getSourceLabel = (src: string) => {
    switch (src) {
      case 'GEMINI_LIVE': return 'Gemini Live';
      case 'REST_FALLBACK': return 'REST fallback';
      case 'LOCAL_FALLBACK':
      case 'FALLBACK': return 'Local fallback';
      case 'SIMULATED': return 'Provider disabled';
      default: return src;
    }
  };

  return (
    <div className="absolute bottom-24 left-4 right-4 bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl p-4 z-40 text-sm shadow-2xl">
      <div className="absolute -top-3 left-4 bg-zinc-950 border border-zinc-800 rounded-full px-2 py-0.5 text-[9px] font-mono text-zinc-500 flex items-center gap-1">
        <span>Src: {getSourceLabel(advice.source)}</span>
      </div>

      <div className="flex justify-between items-start mb-3 pt-1">
        <h4 className="font-bold text-white text-base">{advice.situation}</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleListen}
            disabled={isGeneratingAudio}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${
              isPlayingAudio ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            }`}
          >
            {isGeneratingAudio ? <Loader2 className="w-3 h-3 animate-spin"/> : isPlayingAudio ? <Square className="w-3 h-3 fill-emerald-400"/> : <Volume2 className="w-3 h-3" />}
            {isGeneratingAudio ? "Wait" : isPlayingAudio ? "Stop" : "Listen"}
          </button>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
            advice.riskLevel === 'LOW' ? 'bg-emerald-500/20 text-emerald-400' :
            advice.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
            advice.riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-400' :
            'bg-zinc-500/20 text-zinc-400'
          }`}>
            {advice.riskLevel} Risk
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Target className="w-3.5 h-3.5" /> Target
          </div>
          <div className="text-zinc-200">{advice.smartTarget}</div>
        </div>
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Zap className="w-3.5 h-3.5" /> Club Thought
          </div>
          <div className="text-zinc-200">{advice.clubThought}</div>
        </div>
      </div>

      <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 mb-3 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-0.5">Avoid</div>
          <div className="text-zinc-300 text-xs">{advice.avoid}</div>
        </div>
      </div>

      {advice.dataGaps.length > 0 && (
        <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-white/10 text-zinc-500 text-[10px]">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>Gaps: {advice.dataGaps.join(', ')}</span>
        </div>
      )}

      {advice.blockedClaims && advice.blockedClaims.length > 0 && (
        <div className="flex items-start gap-1.5 mt-2 text-red-500 text-[10px]">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>Blocked: {advice.blockedClaims.join(', ')}</span>
        </div>
      )}
      
      <div className="absolute -top-3 right-4 bg-zinc-950 border border-zinc-800 rounded-full px-2 py-0.5 text-[9px] font-mono text-zinc-500 flex items-center gap-1">
        <span>Conf: {advice.confidence}</span>
        {advice.confidenceCapped && <Info className="w-2.5 h-2.5 text-orange-400" />}
      </div>
    </div>
  );
}
