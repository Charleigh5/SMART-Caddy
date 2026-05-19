import React, { useEffect, useState } from "react";
import { telemetry } from "../../live/liveOverlayTelemetry";
import { Activity } from "lucide-react";

interface Props {
  framesSent: number;
  averagePayloadBytes: number;
  maxPayloadBytes: number;
  rejectedFrames?: number;
  fallbackActive?: boolean;
  mode?: string;
}

export function FrameHealthMeter({
  framesSent,
  averagePayloadBytes,
  maxPayloadBytes,
  rejectedFrames = 0,
  fallbackActive = false,
  mode = 'ACTIVE'
}: Props) {
  const [pulseScale, setPulseScale] = useState(1);

  useEffect(() => {
    // AUDIT-ISSUE: FrameHealthMeter Throttle
    // Fixed: Throttled state updates to prevent extreme re-rendering.
    let throttling = false;
    const unsub = telemetry.onFramePulsed(() => {
      if (throttling) return;
      throttling = true;
      setPulseScale(1.5);
      setTimeout(() => setPulseScale(1), 200);
      setTimeout(() => { throttling = false; }, 400); 
    });
    return unsub;
  }, []);

  const isDegraded = averagePayloadBytes > 500 * 1024;
  const isCritical = averagePayloadBytes > 1000 * 1024;

  const avgColor = isCritical
    ? "text-red-400"
    : isDegraded
      ? "text-yellow-400"
      : "text-emerald-400";

  return (
    <div className="absolute right-4 top-20 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-white/10 flex flex-col items-end gap-1 font-mono text-[9px] text-zinc-400 pointer-events-none z-50 min-w-[120px]">
      <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1 border-b border-white/10 pb-1 w-full justify-end">
        <span className="uppercase tracking-widest text-[8px]">Sight Telemetry</span>
        <Activity
          className="w-3 h-3 text-blue-400 transition-transform duration-200"
          style={{ transform: `scale(${pulseScale})` }}
        />
      </div>
      
      {mode === 'SETUP' && (
        <div className="text-blue-300 font-bold text-center w-full my-1">
          FIXTURE / NO SESSION
        </div>
      )}

      {fallbackActive && (
        <div className="text-orange-400 font-bold text-center w-full my-1 border border-orange-900/50 bg-orange-950/30 py-0.5 rounded">
          PROVIDER TIMEOUT/<br/>FALLBACK
        </div>
      )}

      <div>
        Sent: <span className="text-white">{framesSent}</span>
      </div>
      <div>
        Rejected: <span className={rejectedFrames > 0 ? "text-yellow-400" : "text-white"}>{rejectedFrames}</span>
      </div>
      <div>
        Avg:{" "}
        <span className={avgColor}>
          {(averagePayloadBytes / 1024).toFixed(1)}k
        </span>
      </div>
      <div>
        Max:{" "}
        <span className="text-yellow-400">
          {(maxPayloadBytes / 1024).toFixed(1)}k
        </span>
      </div>

      {(isDegraded || isCritical) && averagePayloadBytes > 0 && (
        <div className="mt-1 max-w-[120px] text-right text-[8px] leading-tight text-amber-500 font-sans">
          Warning: Large frames may increase latency and degrade real-time
          performance.
        </div>
      )}
    </div>
  );
}
