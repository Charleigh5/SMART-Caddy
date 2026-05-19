import React from 'react';

export function ShotConeOverlay() {
  return (
    <div className="absolute inset-x-0 bottom-32 flex justify-center pointer-events-none opacity-40 z-10">
      <svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M100 100 L20 0 Q100 -20 180 0 Z" fill="url(#coneGradient)"/>
        <path d="M100 100 L20 0 Q100 -20 180 0 Z" stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" strokeWidth="1"/>
        <path d="M100 100 L100 0" stroke="rgba(60, 130, 246, 0.5)" strokeDasharray="2 4" strokeWidth="1"/>
        
        <defs>
          <linearGradient id="coneGradient" x1="100" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(60, 130, 246, 0)"/>
            <stop offset="100%" stopColor="rgba(60, 130, 246, 0.2)"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
