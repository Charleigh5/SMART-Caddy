import React, { useRef, useEffect } from 'react';
import { TargetReticle } from './TargetReticle';
import { FrameHealthMeter } from './FrameHealthMeter';
import { LiveStatusRail } from './LiveStatusRail';
import { CaddyAdviceCard } from './CaddyAdviceCard';
import { ShotConeOverlay } from './ShotConeOverlay';
import { WindCompass } from './WindCompass';
import { PermissionStateEnum } from '../../live/liveSessionState';
import { LiveOverlayMode } from '../../live/liveOverlayState';
import { CaddyAdvice } from '../../caddy/runtime/caddyAdviceSchema';

interface Props {
  videoStream: MediaStream | null;
  videoEnabled: boolean;
  camPerm: PermissionStateEnum;
  micPerm: PermissionStateEnum;
  geminiConnected: boolean;
  framesSent: number;
  averagePayloadBytes: number;
  maxPayloadBytes: number;
  advice: CaddyAdvice | null;
  mode: LiveOverlayMode;
  fallbackActive: boolean;
}

export function ARViewfinder({
  videoStream, videoEnabled, camPerm, micPerm, geminiConnected, 
  framesSent, averagePayloadBytes, maxPayloadBytes, advice, mode, fallbackActive
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  return (
    <div className="relative w-full h-[600px] bg-black rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col">
      {/* Video Background Layer */}
      {videoEnabled && videoStream ? (
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-4">
          <div className="w-16 h-16 border border-zinc-800 rounded-full flex items-center justify-center">
            <span className="text-xs">NO CAM</span>
          </div>
          <p className="text-xs uppercase tracking-widest font-bold">Audio Mode Only</p>
        </div>
      )}

      {/* Overlays Layer */}
      <LiveStatusRail 
         micPerm={micPerm} 
         camPerm={camPerm} 
         gpsPerm="NOT_REQUESTED" 
         geminiConnected={geminiConnected} 
         mode={mode}
         fallbackActive={fallbackActive}
      />

      {videoEnabled && videoStream && <TargetReticle />}
      {videoEnabled && videoStream && <ShotConeOverlay />}
      {videoEnabled && videoStream && <WindCompass />}

      {videoEnabled && videoStream && (
        <FrameHealthMeter 
          framesSent={framesSent} 
          averagePayloadBytes={averagePayloadBytes} 
          maxPayloadBytes={maxPayloadBytes} 
          mode={mode}
          fallbackActive={fallbackActive}
        />
      )}

      <CaddyAdviceCard advice={advice} />

    </div>
  );
}
