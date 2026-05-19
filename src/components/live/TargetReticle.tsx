import React, { useEffect, useState } from 'react';
import { telemetry } from '../../live/liveOverlayTelemetry';

export function TargetReticle() {
  const [pulseScale, setPulseScale] = useState(1);

  useEffect(() => {
    const unsub = telemetry.onFramePulsed(() => {
      setPulseScale(1.1);
      setTimeout(() => setPulseScale(1), 200);
    });
    return unsub;
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div 
        className="w-48 h-48 border border-white/20 rounded-[2rem] flex items-center justify-center transition-transform duration-300"
        style={{ transform: `scale(${pulseScale})` }}
      >
        <div className="w-1 h-3 bg-white/50 absolute top-0 rounded-full" />
        <div className="w-1 h-3 bg-white/50 absolute bottom-0 rounded-full" />
        <div className="w-3 h-1 bg-white/50 absolute left-0 rounded-full" />
        <div className="w-3 h-1 bg-white/50 absolute right-0 rounded-full" />
        <div className="w-1.5 h-1.5 bg-blue-500/80 rounded-full" />
      </div>
    </div>
  );
}
