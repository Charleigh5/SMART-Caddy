import React, { useEffect, useRef } from 'react';

interface SilhouetteOverlayProps {
  viewAngle: 'DOWN_THE_LINE' | 'FACE_ON' | 'UNKNOWN';
  handedness: 'RIGHT' | 'LEFT';
  isVisible: boolean;
  setupScore?: number;
  deviceTilt?: number;
}

export function SilhouetteOverlay({ viewAngle, handedness, isVisible, setupScore, deviceTilt = 0 }: SilhouetteOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wasAlignedRef = useRef(false);
  const alignedSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let animationFrameId: number;

    const draw = (time: number) => {
      // Handle resize without observer by checking every frame
      if (canvas.width !== parent.clientWidth) canvas.width = parent.clientWidth;
      if (canvas.height !== parent.clientHeight) canvas.height = parent.clientHeight;
      
      // We must clear in case dimensions didn't change
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply device tilt vertically to shift the perspective
      ctx.translate(0, deviceTilt);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      const sideMult = handedness === 'RIGHT' ? 1 : -1;
      const isAligned = setupScore !== undefined && setupScore >= 70;
      
      if (isAligned && !wasAlignedRef.current) {
        alignedSinceRef.current = Date.now();
      } else if (!isAligned) {
        alignedSinceRef.current = null;
      }
      wasAlignedRef.current = isAligned;

      let stanceColor = 'rgba(255, 255, 255, 0.4)';
      let stanceTextColor = 'rgba(255, 255, 255, 0.5)';
      let stanceBgColor = 'transparent';
      let stanceLineWidth = 2;
      let pulse = 0;

      if (isAligned && alignedSinceRef.current) {
        const elapsed = Date.now() - alignedSinceRef.current;
        // Pulse fades out after 2 seconds
        if (elapsed < 2000) {
          pulse = (Math.sin(time / 100) * 0.5 + 0.5) * (1 - elapsed / 2000); 
        }
        stanceColor = `rgba(34, 197, 94, ${0.6 + pulse * 0.4})`;
        stanceTextColor = `rgba(34, 197, 94, ${0.8 + pulse * 0.2})`;
        stanceBgColor = `rgba(34, 197, 94, ${0.1 + pulse * 0.2})`;
        stanceLineWidth = 2 + pulse * 3;
      }

      if (viewAngle === 'FACE_ON') {
        // FACE-ON: Head
        ctx.beginPath();
        ctx.arc(cx, h * 0.3, h * 0.05, 0, Math.PI * 2);
        ctx.stroke();

        // Torso
        ctx.beginPath();
        ctx.moveTo(cx, h * 0.35);
        ctx.lineTo(cx, h * 0.6);
        ctx.stroke();

        // Stance / Feet
        ctx.strokeStyle = stanceColor;
        ctx.fillStyle = stanceBgColor;
        ctx.lineWidth = stanceLineWidth;
        ctx.beginPath();
        ctx.ellipse(cx - 40, h * 0.85, 20, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 40, h * 0.85, 20, 10, 0, 0, Math.PI * 2);
        if (isAligned) ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = stanceTextColor;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isAligned ? '✓ STANCE ALIGNED' : 'STANCE ZONE', cx, h * 0.85 + 25);
        
        // Reset properties
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; 
        ctx.lineWidth = 2;

        // Ball Area
        ctx.fillStyle = 'rgba(234, 179, 8, 0.5)';
        ctx.beginPath();
        ctx.arc(cx, h * 0.85, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px sans-serif';
        ctx.fillText('ADDRESS ZONE', cx, h * 0.85 - 15);

        // Club Arc Zone
        ctx.beginPath();
        ctx.arc(cx, h * 0.6, h * 0.35, Math.PI, 0);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'; // Blueish arc
        ctx.lineWidth = 20;
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.fillText('CLUB ARC CLEARANCE', cx, h * 0.2);

      } else if (viewAngle === 'DOWN_THE_LINE') {
        // DOWN THE LINE: Head
        ctx.beginPath();
        ctx.arc(cx + 20 * sideMult, h * 0.3, h * 0.05, 0, Math.PI * 2);
        ctx.stroke();

        // Torso leaning
        ctx.beginPath();
        ctx.moveTo(cx + 20 * sideMult, h * 0.35);
        ctx.lineTo(cx - 10 * sideMult, h * 0.6);
        ctx.stroke();

        // Stance
        ctx.strokeStyle = stanceColor;
        ctx.fillStyle = stanceBgColor;
        ctx.lineWidth = stanceLineWidth;
        ctx.beginPath();
        ctx.ellipse(cx - 20 * sideMult, h * 0.85, 20, 30, 0, 0, Math.PI * 2);
        if (isAligned) ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = stanceTextColor;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isAligned ? '✓ STANCE ALIGNED' : 'STANCE', cx - 20 * sideMult, h * 0.85 + 40);
        
        // Reset properties
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; 
        ctx.lineWidth = 2;

        // Ball Area
        ctx.fillStyle = 'rgba(234, 179, 8, 0.5)';
        ctx.beginPath();
        ctx.arc(cx + 60 * sideMult, h * 0.85, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px sans-serif';
        ctx.fillText('ADDRESS ZONE', cx + 60 * sideMult, h * 0.85 - 15);

        // Target Line
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(cx + 60 * sideMult, h * 0.95);
        ctx.lineTo(cx + 60 * sideMult, h * 0.1);
        ctx.stroke();
        ctx.setLineDash([5, 5]);
        
        ctx.fillText('TARGET LINE GUIDE', cx + 60 * sideMult, h * 0.08);
      }
      
      ctx.restore();
      
      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationFrameId);
  }, [viewAngle, handedness, isVisible, setupScore]);

  if (!isVisible) return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none w-full h-full"
    />
  );
}
