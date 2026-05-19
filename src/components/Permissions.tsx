import React, { useState } from 'react';
import { Camera, Mic, MapPin, Activity, ChevronRight, Check } from 'lucide-react';

interface PermissionState {
  camera: boolean | null;
  mic: boolean | null;
  location: boolean | null;
  motion: boolean | null;
}

export function Permissions() {
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: null,
    mic: null,
    location: null,
    motion: null,
  });

  const requestCameraMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop immediately, we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      setPermissions(p => ({ ...p, camera: true, mic: true }));
    } catch (err) {
      console.warn("Camera/Mic denied", err);
      setPermissions(p => ({ ...p, camera: false, mic: false }));
    }
  };

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setPermissions(p => ({ ...p, location: true })),
        () => setPermissions(p => ({ ...p, location: false }))
      );
    } else {
      setPermissions(p => ({ ...p, location: false }));
    }
  };

  const requestMotion = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setPermissions(p => ({ ...p, motion: true }));
        } else {
          setPermissions(p => ({ ...p, motion: false }));
        }
      } catch (e) {
        setPermissions(p => ({ ...p, motion: false }));
      }
    } else {
      // Non-iOS 13+ devices
      setPermissions(p => ({ ...p, motion: true }));
    }
  };

  return (
    <div className="space-y-6 container mx-auto p-4 max-w-md pt-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Device Setup</h1>
        <p className="text-zinc-400">To act as your real-time coach, we need access to your device capabilities.</p>
      </div>

      <div className="space-y-4 pt-4">
        <PermissionCard 
          icon={Camera} 
          title="Camera & Microphone" 
          description="For AI vision tracking and live voice coaching"
          status={permissions.camera}
          onClick={requestCameraMic}
        />
        <PermissionCard 
          icon={MapPin} 
          title="Location (GPS)" 
          description="For finding your course and tracking shots"
          status={permissions.location}
          onClick={requestLocation}
        />
        <PermissionCard 
          icon={Activity} 
          title="Motion & Orientation" 
          description="For stable camera setup checking"
          status={permissions.motion}
          onClick={requestMotion}
        />
      </div>

      <div className="pt-8">
        <button 
          onClick={() => {
            // Optional: check if all true before allowing
            window.location.href = '/capture';
          }}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-zinc-100 text-zinc-900 font-semibold hover:bg-white transition-colors"
        >
          Continue <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function PermissionCard({ icon: Icon, title, description, status, onClick }: { icon: any, title: string, description: string, status: boolean | null, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      disabled={status === true}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-colors",
        status === true ? "border-green-800 bg-green-900/20" : 
        status === false ? "border-red-800 bg-red-900/20" : 
        "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800"
      )}
    >
      <div className={cn(
        "p-2 rounded-lg",
        status === true ? "bg-green-900 text-green-400" :
        status === false ? "bg-red-900 text-red-400" :
        "bg-zinc-800 text-zinc-400"
      )}>
        {status === true ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-zinc-200">{title}</h3>
        <p className="text-sm text-zinc-400 mt-1">{description}</p>
      </div>
    </button>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
