import React from 'react';
import { Navigation } from 'lucide-react';

export function WindCompass() {
  return (
    <div className="absolute left-4 top-20 flex flex-col items-center gap-1 z-20 pointer-events-none">
      <div className="w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm flex items-center justify-center relative">
        <Navigation className="w-4 h-4 text-emerald-400 rotate-45 transform" />
        <div className="absolute top-0 right-1 text-[8px] font-mono text-zinc-500">N</div>
        <div className="absolute bottom-1 right-1 text-[8px] font-mono text-zinc-500">E</div>
      </div>
      <div className="bg-black/60 backdrop-blur text-[9px] font-mono text-white px-1.5 py-0.5 rounded border border-white/10">
        12 MPH
      </div>
    </div>
  );
}
