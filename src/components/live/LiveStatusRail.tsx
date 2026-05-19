import React from 'react';
import { LiveOverlayMode } from '../../live/liveOverlayState';
import { PermissionStateEnum } from '../../live/liveSessionState';
import { Mic, MicOff, Camera, CameraOff, MapPin, MapPinOff, Cpu, AlertTriangle } from 'lucide-react';

interface Props {
  micPerm: PermissionStateEnum;
  camPerm: PermissionStateEnum;
  gpsPerm: PermissionStateEnum;
  geminiConnected: boolean;
  mode: LiveOverlayMode;
  fallbackActive: boolean;
}

export function LiveStatusRail({ micPerm, camPerm, gpsPerm, geminiConnected, mode, fallbackActive }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
      <div className="flex gap-2">
        {/* Gemini Status */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${geminiConnected ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          <Cpu className="w-3 h-3" />
          <span>{geminiConnected ? 'Live' : 'Offline'}</span>
        </div>
        
        {/* Fallback Mode */}
        {fallbackActive && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>Fallback</span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 bg-black/40 backdrop-blur-sm rounded-full p-1 border border-white/10">
        <div className={`p-1.5 rounded-full ${micPerm === 'GRANTED' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
          {micPerm === 'GRANTED' ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </div>
        <div className={`p-1.5 rounded-full ${camPerm === 'GRANTED' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
          {camPerm === 'GRANTED' ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
        </div>
        <div className={`p-1.5 rounded-full ${gpsPerm === 'GRANTED' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500 bg-zinc-800'}`}>
          {gpsPerm === 'GRANTED' ? <MapPin className="w-3.5 h-3.5" /> : <MapPinOff className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
}
