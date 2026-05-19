import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSwingVideos, getSwingVideo, saveSwingAnalysis, saveCoachingNote, saveDrill } from '../lib/storage';
import { Loader2, ArrowLeft, Target, AlertTriangle, GitCompare, X, ChevronDown, Volume2, Square, Activity, Eye, EyeOff, Bookmark, Check, History } from 'lucide-react';
import { cn } from '../lib/utils';

function SwingPlayer({ video, url, label }: { video: any, url: string, label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !video?.analysis) return;

    const videoNode = videoRef.current;
    const canvasNode = canvasRef.current;
    
    const ctx = canvasNode.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const startTime = performance.now();

    const drawOverlays = () => {
      const rect = videoNode.getBoundingClientRect();
      canvasNode.width = rect.width;
      canvasNode.height = rect.height;
      ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);

      const time = performance.now();
      const elapsed = (time - startTime) / 1000;

      const drawPoint = (x: number, y: number, color: string) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      const w = canvasNode.width;
      const h = canvasNode.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.lineWidth = 3;

      if (video?.viewAngle === 'DOWN_THE_LINE') {
        const topBackswingX = cx + w * 0.2;
        const topBackswingY = cy - h * 0.25;
        const impactX = cx - w * 0.05;
        const impactY = cy + h * 0.35;
        const followThroughX = cx - w * 0.3;
        const followThroughY = cy - h * 0.15;
        
        // Target Line (Feet/Aiming Line) -> extends to vanish point
        const ballPositionX = impactX + 20; // Ball is slightly right of the club path
        const ballPositionY = impactY + 10;
        const vanishPointX = cx - w * 0.4;
        const vanishPointY = cy - h * 0.1;
        
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ballPositionX + 40, ballPositionY + 20); // Extends slightly backwards
        ctx.lineTo(vanishPointX, vanishPointY);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)'; // Purple for Target Line
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText('Target Line', ballPositionX + 25, ballPositionY + 35);
        ctx.restore();

        // Ball Trajectory Projection
        ctx.save();
        const apexX = (ballPositionX + vanishPointX) / 2;
        const apexY = (ballPositionY + vanishPointY) / 2 - h * 0.2; // Rises up
        ctx.beginPath();
        ctx.moveTo(ballPositionX, ballPositionY);
        ctx.quadraticCurveTo(apexX, apexY, vanishPointX, vanishPointY + 20); // Drops slightly at the end
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)'; // Pink for Trajectory
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 6]);
        const trajOffset = -elapsed * 50;
        ctx.lineDashOffset = trajOffset;
        ctx.stroke();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.fillText('Est. Trajectory', apexX - 25, apexY - 10);
        ctx.restore();

        // Dynamic Swing Plane (Elliptical Arc) with Acceleration gradient
        ctx.save();
        for (let i = 0; i < 50; i++) {
          const t1 = i / 50;
          const t2 = (i + 1) / 50;
          
          const invT1 = 1 - t1;
          const x1 = invT1 * invT1 * topBackswingX + 2 * invT1 * t1 * impactX + t1 * t1 * followThroughX;
          const y1 = invT1 * invT1 * topBackswingY + 2 * invT1 * t1 * impactY + t1 * t1 * followThroughY;
          
          const invT2 = 1 - t2;
          const x2 = invT2 * invT2 * topBackswingX + 2 * invT2 * t2 * impactX + t2 * t2 * followThroughX;
          const y2 = invT2 * invT2 * topBackswingY + 2 * invT2 * t2 * impactY + t2 * t2 * followThroughY;
          
          // Speed peaks at impact (approx t=0.5)
          const speedFactor = Math.exp(-Math.pow(t1 - 0.5, 2) / 0.05);

          // Color shifts from cooler (blue, hue 220) to hotter (red/orange, hue 0-30) based on speed
          const hue = 220 - (speedFactor * 190); 
          const lightness = 50 + (speedFactor * 25);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          
          ctx.strokeStyle = `hsla(${hue}, 100%, ${lightness}%, ${0.3 + speedFactor * 0.7})`;
          ctx.lineWidth = (2 + Math.pow(speedFactor, 1.5) * 10) * (rect.width / 400); // Scale with canvas size
          ctx.lineCap = 'round';
          
          // Add glow effect for high speeds
          if (speedFactor > 0.3) {
             ctx.shadowBlur = speedFactor * 12;
             ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${speedFactor * 0.8})`;
          } else {
             ctx.shadowBlur = 0;
          }
          
          ctx.stroke();
        }
        ctx.restore();

        // Animated dashed line for swing path direction
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(topBackswingX, topBackswingY);
        ctx.quadraticCurveTo(impactX, impactY, followThroughX, followThroughY);
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 15]);
        ctx.lineDashOffset = -elapsed * 120; // Move dashes along the path
        ctx.stroke();
        ctx.restore();

        // Animated dot representing clubhead 
        const phase = (elapsed % 1.5) / 1.5;
        const movePhase = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2; // Ease in out
        
        const invT = 1 - movePhase;
        const currentX = invT * invT * topBackswingX + 2 * invT * movePhase * impactX + movePhase * movePhase * followThroughX;
        const currentY = invT * invT * topBackswingY + 2 * invT * movePhase * impactY + movePhase * movePhase * followThroughY;

        // Pulse based on speed
        const currentSpeedFactor = Math.exp(-Math.pow(movePhase - 0.5, 2) / 0.05);
        const pulse = 1 + Math.sin(phase * Math.PI * 30) * (0.2 + currentSpeedFactor * 0.3);

        ctx.save();
        for (let i = 1; i <= 20; i++) {
            const tailPhase = Math.max(0, phase - (i * 0.01 * (1 + currentSpeedFactor * 2.5))); 
            const tailMovePhase = tailPhase < 0.5 ? 2 * tailPhase * tailPhase : 1 - Math.pow(-2 * tailPhase + 2, 2) / 2;
            const tInvT = 1 - tailMovePhase;
            const tailX = tInvT * tInvT * topBackswingX + 2 * tInvT * tailMovePhase * impactX + tailMovePhase * tailMovePhase * followThroughX;
            const tailY = tInvT * tInvT * topBackswingY + 2 * tInvT * tailMovePhase * impactY + tailMovePhase * tailMovePhase * followThroughY;
            
            ctx.beginPath();
            ctx.arc(tailX, tailY, 4 * ((20 - i) / 20) * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59, 130, 246, ${((20 - i) / 20) * (0.3 + currentSpeedFactor * 0.7)})`;
            ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(currentX, currentY, (4 + currentSpeedFactor * 3) * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + currentSpeedFactor * 0.2})`;
        ctx.shadowBlur = (10 + currentSpeedFactor * 20) * pulse;
        ctx.shadowColor = 'rgba(59, 130, 246, 1)';
        ctx.fill();
        ctx.restore();

        // Club face Angle Indicator (tangent to curve)
        ctx.save();
        ctx.translate(currentX, currentY);
        // Calculate tangent angle for rotation
        const dX = 2 * invT * (impactX - topBackswingX) + 2 * movePhase * (followThroughX - impactX);
        const dY = 2 * invT * (impactY - topBackswingY) + 2 * movePhase * (followThroughY - impactY);
        const pathAngle = Math.atan2(dY, dX);
        
        // Face opens, squares at impact, closes
        const faceAngleOffset = ((0.5 - movePhase) * 60) * (Math.PI / 180); 
        ctx.rotate(pathAngle + Math.PI / 2 + faceAngleOffset);
        
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, 0);
        ctx.lineTo(8, 4);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Red face
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(0, -10);
        ctx.strokeStyle = 'rgba(229, 231, 235, 0.9)'; 
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        if (Math.abs(movePhase - 0.5) < 0.1) {
            ctx.rotate(- (pathAngle + Math.PI / 2 + faceAngleOffset)); 
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.font = '10px monospace';
            ctx.fillText('Square Impact', 15, 0);
        }
        ctx.restore();

        // Draw indication of club shaft at address
        ctx.save();
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)'; 
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const handsX = cx + w * 0.1;
        const handsY = cy + h * 0.1;
        ctx.moveTo(impactX, impactY);
        ctx.lineTo(handsX, handsY); 
        ctx.stroke();
        ctx.restore();
        
        ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText('Address Shaft', handsX + 10, handsY);
        drawPoint(handsX, handsY, '#4ade80'); // Hands position point
        
      } else {
        const topBackswingX = cx + w * 0.35;
        const topBackswingY = cy - h * 0.05;
        const controlX = cx;
        const controlY = cy + h * 0.45;
        const followThroughX = cx - w * 0.35;
        const followThroughY = cy - h * 0.15;
        
        const impactX = cx + w * 0.05;
        const impactY = cy + h * 0.22;

        // Target Line (Face On = Horizontal)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, impactY + 15);
        ctx.lineTo(w, impactY + 15);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)'; // Purple for Target Line
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText('Target Line', cx + w * 0.2, impactY + 30);
        ctx.restore();

        // Trajectory Overlay
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(impactX, impactY);
        ctx.quadraticCurveTo(cx - w * 0.2, cy - h * 0.1, 0, cy - h * 0.2);
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)'; // Pink for Trajectory
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = elapsed * 80;
        ctx.stroke();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.fillText('Est. Trajectory', w * 0.05, cy - h * 0.1);
        ctx.restore();

        // Static path with varying thickness, brightness, and color to indicate acceleration
        ctx.save();
        for (let i = 0; i < 50; i++) {
          const t1 = i / 50;
          const t2 = (i + 1) / 50;
          
          const invT1 = 1 - t1;
          const x1 = invT1 * invT1 * topBackswingX + 2 * invT1 * t1 * controlX + t1 * t1 * followThroughX;
          const y1 = invT1 * invT1 * topBackswingY + 2 * invT1 * t1 * controlY + t1 * t1 * followThroughY;
          
          const invT2 = 1 - t2;
          const x2 = invT2 * invT2 * topBackswingX + 2 * invT2 * t2 * controlX + t2 * t2 * followThroughX;
          const y2 = invT2 * invT2 * topBackswingY + 2 * invT2 * t2 * controlY + t2 * t2 * followThroughY;
          
          // Speed peaks around impact (t=0.5)
          const speedFactor = Math.exp(-Math.pow(t1 - 0.5, 2) / 0.05);

          // Color shifts from cooler (cyan, hue 180) to hotter (red/orange, hue 0)
          const hue = 180 - (speedFactor * 180);
          const lightness = 40 + (speedFactor * 35);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          
          ctx.strokeStyle = `hsla(${hue}, 100%, ${lightness}%, ${0.3 + speedFactor * 0.7})`;
          ctx.lineWidth = (2 + Math.pow(speedFactor, 1.5) * 10) * (rect.width / 400); // Scale with canvas size
          ctx.lineCap = 'round';
          
          if (speedFactor > 0.3) {
             ctx.shadowBlur = speedFactor * 10;
             ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${speedFactor * 0.8})`;
          } else {
             ctx.shadowBlur = 0;
          }
          
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.setLineDash([10, 15]);
        ctx.lineDashOffset = -elapsed * 120;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(topBackswingX, topBackswingY);
        ctx.quadraticCurveTo(controlX, controlY, followThroughX, followThroughY);
        ctx.stroke();
        ctx.restore();

        const phase = (elapsed % 1.5) / 1.5;
        const t = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2;
        const invT = 1 - t;
        const currentX = invT * invT * topBackswingX + 2 * invT * t * controlX + t * t * followThroughX;
        const currentY = invT * invT * topBackswingY + 2 * invT * t * controlY + t * t * followThroughY;

        // Animated dot and comet tail representing clubhead acceleration
        const currentSpeedFactor = Math.exp(-Math.pow(t - 0.5, 2) / 0.05);
        const pulse = 1 + Math.sin(phase * Math.PI * 30) * (0.2 + currentSpeedFactor * 0.3);

        ctx.save();
        for (let i = 1; i <= 20; i++) {
            const tailPhase = Math.max(0, phase - (i * 0.01 * (1 + currentSpeedFactor * 2.5)));
            const tailT = tailPhase < 0.5 ? 2 * tailPhase * tailPhase : 1 - Math.pow(-2 * tailPhase + 2, 2) / 2;
            const tailInvT = 1 - tailT;
            const tailX = tailInvT * tailInvT * topBackswingX + 2 * tailInvT * tailT * controlX + tailT * tailT * followThroughX;
            const tailY = tailInvT * tailInvT * topBackswingY + 2 * tailInvT * tailT * controlY + tailT * tailT * followThroughY;
            
            ctx.beginPath();
            ctx.arc(tailX, tailY, 4 * ((20 - i) / 20) * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(234, 179, 8, ${((20 - i) / 20) * (0.3 + currentSpeedFactor * 0.7)})`;
            ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(currentX, currentY, (4 + currentSpeedFactor * 3) * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + currentSpeedFactor * 0.2})`;
        ctx.shadowBlur = (10 + currentSpeedFactor * 20) * pulse;
        ctx.shadowColor = 'rgba(234, 179, 8, 1)';
        ctx.fill();
        ctx.restore();

        // Face Angle Indicator
        ctx.save();
        ctx.translate(currentX, currentY);
        const dX = 2 * invT * (controlX - topBackswingX) + 2 * t * (followThroughX - controlX);
        const dY = 2 * invT * (controlY - topBackswingY) + 2 * t * (followThroughY - controlY);
        const pathAngle = Math.atan2(dY, dX);
        const faceAngleOffset = ((0.5 - t) * 60) * (Math.PI / 180); 
        ctx.rotate(pathAngle + Math.PI / 2 + faceAngleOffset);
        
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(10, 0);
        ctx.lineTo(8, 4);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; 
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(0, -10);
        ctx.strokeStyle = 'rgba(229, 231, 235, 0.9)'; 
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (Math.abs(t - 0.5) < 0.1) {
            ctx.rotate(- (pathAngle + Math.PI / 2 + faceAngleOffset)); 
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.font = '10px monospace';
            ctx.fillText('Square Impact', 15, 0);
        }
        ctx.restore();

        // Draw indication of club shaft at address
        ctx.save();
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const handsX = cx - w * 0.05;
        const handsY = impactY - h * 0.10;
        ctx.moveTo(impactX, impactY);
        ctx.lineTo(handsX, handsY); 
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText('Address Shaft', handsX - 40, handsY - 10);
        drawPoint(handsX, handsY, '#4ade80');
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px monospace';
      ctx.fillText('ESTIMATED_FROM_POSE (Conceptual)', 10, 20);
      if (label) {
        ctx.fillText(label, 10, 35);
      }

      animationFrameId = requestAnimationFrame(drawOverlays);
    };

    const observer = new ResizeObserver(() => {
      // observer just triggers resize if needed, but since we are polling in rAF it will pick up rect
    });

    observer.observe(videoNode);
    drawOverlays(); 

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [video?.analysis, video?.viewAngle, label]);

  return (
    <div className="relative aspect-[3/4] w-full bg-zinc-900 border-b border-zinc-800">
      <div className="absolute top-4 left-4 z-10 flex gap-1 bg-black/50 backdrop-blur rounded p-1">
        {[0.25, 0.5, 1, 1.5, 2].map(rate => (
          <button
            key={rate}
            onClick={() => setPlaybackRate(rate)}
            className={cn(
              "px-2 py-1 text-xs font-mono rounded transition-colors",
              playbackRate === rate ? "bg-emerald-500 text-white font-bold" : "text-white/70 hover:bg-white/10"
            )}
          >
            {rate}x
          </button>
        ))}
      </div>
      <video 
        ref={videoRef}
        src={url || ''} 
        controls 
        className="w-full h-full object-contain"
        playsInline
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = playbackRate;
        }}
        onPlay={(e) => {
          e.currentTarget.playbackRate = playbackRate;
        }}
        onRateChange={(e) => {
          if (e.currentTarget.playbackRate !== playbackRate) {
            setPlaybackRate(e.currentTarget.playbackRate);
          }
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      
      {/* Visual Overlay Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1.5 bg-black/60 backdrop-blur-md rounded-lg p-3 text-[10px] font-medium border border-white/10 pointer-events-none">
        
        <div className="flex items-center gap-2">
          <div className="w-4 border-t border-dashed border-purple-400"></div>
          <span className="text-zinc-300">Target Line (Aiming)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-4 border-t border-dashed border-pink-400"></div>
          <span className="text-zinc-300">Est. Ball Trajectory</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-4 border-t-2 border-dashed border-blue-400"></div>
          <span className="text-zinc-300">Swing Plane Arc</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-4 border-t-2 border-dashed border-emerald-400"></div>
          <span className="text-zinc-300">Shaft Angle @ Address</span>
        </div>
        
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/10">
          <div className="w-3 h-1.5 bg-red-500 rounded-[1px] transform -rotate-12 border border-white/50"></div>
          <span className="text-zinc-300">Club Face (Opens/Closes)</span>
        </div>
      </div>

      {video?.analysis?.setupScore < 70 && (
        <div className="absolute top-20 right-4 bg-yellow-600/90 text-white px-2 py-1 text-[10px] rounded flex items-center gap-1 font-semibold">
          <AlertTriangle className="w-3 h-3" /> Setup Score: {video.analysis.setupScore}
        </div>
      )}
    </div>
  );
}

function SwingTempoGraph({ tempo, compareTempo, dataGaps = [], compareDataGaps = [] }: { tempo?: { backswingTimeMs: number, downswingTimeMs: number, ratio: number, description: string, limitations?: string[] }, compareTempo?: { backswingTimeMs: number, downswingTimeMs: number, ratio: number, description: string, limitations?: string[] }, dataGaps?: string[], compareDataGaps?: string[] }) {
  const [showPrimaryGraph, setShowPrimaryGraph] = useState(true);
  const [showCompareGraph, setShowCompareGraph] = useState(true);
  const isMock = !tempo;

  // Use mock values if none provided
  const backswingStr = tempo?.backswingTimeMs ? `${(tempo.backswingTimeMs / 1000).toFixed(2)}s` : '0.80s';
  const downswingStr = tempo?.downswingTimeMs ? `${(tempo.downswingTimeMs / 1000).toFixed(2)}s` : '0.25s';
  const ratio = tempo?.ratio || 3.2;
  const description = tempo?.description || "A 3:1 ratio is typical for professional golfers. Your tempo is relatively steady.";
  
  const tempoRelatedGaps = dataGaps.filter(gap => gap.toLowerCase().includes('tempo') || gap.toLowerCase().includes('frame') || gap.toLowerCase().includes('blur'));
  const limitations = tempo?.limitations || (isMock ? ["Tempo metrics are ESTIMATED from pose tracking and may lack sub-frame accuracy. Data may be a MOCK simulation if frame rate was too low."] : tempoRelatedGaps.length > 0 ? tempoRelatedGaps : []);

  const backswingPercent = (ratio / (ratio + 1)) * 100;
  const downswingPercent = (1 / (ratio + 1)) * 100;
  
  const compareIsMock = !compareTempo;
  const compareBackswingStr = compareTempo?.backswingTimeMs ? `${(compareTempo.backswingTimeMs / 1000).toFixed(2)}s` : '0.75s';
  const compareDownswingStr = compareTempo?.downswingTimeMs ? `${(compareTempo.downswingTimeMs / 1000).toFixed(2)}s` : '0.25s';
  const compareRatio = compareTempo?.ratio || 3.0;
  const compareDescription = compareTempo?.description || "A solid 3:1 ratio comparison.";
  
  const compareTempoRelatedGaps = compareDataGaps.filter(gap => gap.toLowerCase().includes('tempo') || gap.toLowerCase().includes('frame') || gap.toLowerCase().includes('blur'));
  const compareLimitations = compareTempo?.limitations || (compareIsMock ? ["Comparison tempo is MOCK data or ESTIMATED from pose."] : compareTempoRelatedGaps.length > 0 ? compareTempoRelatedGaps : []);

  const compareBackswingPercent = (compareRatio / (compareRatio + 1)) * 100;
  const compareDownswingPercent = (1 / (compareRatio + 1)) * 100;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error);
      }
    };
  }, []);

  const speakTempo = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      let text = '';
      if (compareTempo && tempo) {
         text = `Let's compare your swing tempos. Your reference swing had a tempo ratio of ${compareRatio.toFixed(1)} to 1. ${compareDescription} Your current swing has a tempo ratio of ${ratio.toFixed(1)} to 1. ${description}`;
      } else {
         text = `Your swing tempo ratio is ${ratio.toFixed(1)} to 1. ${description}`;
      }
      console.log("Playing tempo TTS:", text);

      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          const binaryStr = atob(data.audio);
          const pcm16 = new Int16Array(binaryStr.length / 2);
          for (let i = 0; i < binaryStr.length / 2; i++) {
            const lsb = binaryStr.charCodeAt(i * 2);
            const msb = binaryStr.charCodeAt(i * 2 + 1);
            const val = (msb << 8) | lsb;
            pcm16[i] = val >= 32768 ? val - 65536 : val;
          }
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768.0;
          }

          if (!audioCtxRef.current) {
             audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
          }
          const audioBuffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);
          
          const source = audioCtxRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtxRef.current.destination);
          source.onended = () => {
             setIsPlaying(false);
          };
          source.start(0);
          sourceNodeRef.current = source;
        } else {
          setIsPlaying(false);
        }
      } else {
         setIsPlaying(false);
      }
    } catch (err) {
      console.error("TTS failed:", err);
      setIsPlaying(false);
    }
  };

  return (
    <details className="group border border-emerald-900/30 bg-emerald-900/10 rounded-xl overflow-hidden">
      <summary className="p-4 cursor-pointer flex items-center justify-between outline-none">
        <h3 className="uppercase text-[10px] tracking-widest text-emerald-400 font-bold flex items-center gap-2">
           <Activity className="w-4 h-4" /> Swing Tempo & Rhythm
        </h3>
        <div className="flex items-center gap-3">
          <button
              onClick={speakTempo}
              className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-full transition-colors flex items-center justify-center"
              aria-label={isPlaying ? "Stop Tempo Audio" : "Listen to Tempo"}
          >
              {isPlaying ? <Square className="w-4 h-4 fill-emerald-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <ChevronDown className="w-4 h-4 text-emerald-500 transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>
      <div className="px-4 pb-4 border-t border-emerald-900/30 mt-2 pt-4">
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">Current Swing Tempo</span>
          <button 
            onClick={(e) => { e.preventDefault(); setShowPrimaryGraph(!showPrimaryGraph); }}
            className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded hover:bg-emerald-800/40 transition-colors"
          >
            {showPrimaryGraph ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPrimaryGraph ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {showPrimaryGraph && (
          <div className="space-y-6">
            <div className="flex items-end gap-1 h-32 pt-4 relative">
                {/* simple bar graph representation */}
                <div className="flex flex-col justify-end w-full relative group/bar">
                    <div 
                        className="bg-emerald-500/80 rounded-t-md w-full transition-all duration-1000 origin-bottom" 
                        style={{ height: `${backswingPercent}%` }}
                    ></div>
                    <span className="text-[10px] text-emerald-300/70 text-center font-mono mt-2 absolute -bottom-6 w-full uppercase tracking-wider">Backswing</span>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-300">{backswingStr}</span>
                </div>
                
                <div className="flex flex-col justify-end w-full relative">
                    <div 
                        className="bg-emerald-400 rounded-t-md w-full transition-all duration-1000 origin-bottom shadow-[0_0_15px_rgba(52,211,153,0.4)]" 
                        style={{ height: `${downswingPercent}%` }}
                    ></div>
                    <span className="text-[10px] text-emerald-300/70 text-center font-mono mt-2 absolute -bottom-6 w-full uppercase tracking-wider">Downswing</span>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-300">{downswingStr}</span>
                </div>
            </div>

            <div className="flex justify-between items-center p-3 mt-6 bg-emerald-950/50 rounded-lg border border-emerald-900/30">
               <div>
                   <div className="text-xs text-emerald-500 font-mono tracking-widest uppercase">Tempo Ratio</div>
                   <div className="text-[10px] text-emerald-600 font-medium mt-1">Backswing : Downswing</div>
               </div>
               <div className="text-xl font-bold text-emerald-300">{ratio.toFixed(1)} : 1</div>
            </div>
            
            <p className="text-xs text-emerald-200/70 leading-relaxed bg-emerald-950/30 p-3 rounded-lg mb-2">
                {description}
            </p>

            {limitations.length > 0 && (
                <div className="bg-orange-950/30 border border-orange-900/30 p-3 rounded-lg mt-2">
                    <span className="text-orange-500/70 font-mono text-[10px] mb-2 block uppercase tracking-widest flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Data Limitations
                    </span>
                    <ul className="list-disc pl-4 space-y-1">
                        {limitations.map((lim, idx) => (
                            <li key={idx} className="text-xs text-orange-300/80 leading-relaxed">
                                {lim}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
          </div>
        )}

        {compareTempo && (
          <div className="mt-8 pt-4 border-t border-emerald-900/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">Comparison Swing Tempo</span>
              <button 
                onClick={(e) => { e.preventDefault(); setShowCompareGraph(!showCompareGraph); }}
                className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded hover:bg-emerald-800/40 transition-colors"
              >
                {showCompareGraph ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showCompareGraph ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            {showCompareGraph && (
               <div className="space-y-6">
                 <div className="flex items-end gap-1 h-32 pt-4 relative">
                     <div className="flex flex-col justify-end w-full relative">
                         <div 
                             className="bg-emerald-500/60 border border-emerald-500/80 rounded-t-md w-full transition-all duration-1000 origin-bottom" 
                             style={{ height: `${compareBackswingPercent}%` }}
                         ></div>
                         <span className="text-[10px] text-emerald-300/70 text-center font-mono mt-2 absolute -bottom-6 w-full uppercase tracking-wider">Backswing</span>
                         <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-300">{compareBackswingStr}</span>
                     </div>
                     
                     <div className="flex flex-col justify-end w-full relative">
                         <div 
                             className="bg-emerald-400/80 border border-emerald-400 rounded-t-md w-full transition-all duration-1000 origin-bottom shadow-[0_0_10px_rgba(52,211,153,0.2)]" 
                             style={{ height: `${compareDownswingPercent}%` }}
                         ></div>
                         <span className="text-[10px] text-emerald-300/70 text-center font-mono mt-2 absolute -bottom-6 w-full uppercase tracking-wider">Downswing</span>
                         <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-emerald-300">{compareDownswingStr}</span>
                     </div>
                 </div>

                 <div className="flex justify-between items-center p-3 mt-6 bg-emerald-950/50 rounded-lg border border-emerald-900/30">
                    <div className="text-xs text-emerald-500 font-mono tracking-widest uppercase">Compare Ratio</div>
                    <div className="text-lg font-bold text-emerald-300">{compareRatio.toFixed(1)} : 1</div>
                 </div>
                 
                 <p className="text-xs text-emerald-200/70 leading-relaxed bg-emerald-950/30 p-3 rounded-lg mb-2">
                     {compareDescription}
                 </p>

                 {compareLimitations.length > 0 && (
                     <div className="bg-orange-950/30 border border-orange-900/30 p-3 rounded-lg mt-2">
                         <span className="text-orange-500/70 font-mono text-[10px] mb-2 block uppercase tracking-widest flex items-center gap-1">
                             <AlertTriangle className="w-3 h-3" /> Compare Limitations
                         </span>
                         <ul className="list-disc pl-4 space-y-1">
                             {compareLimitations.map((lim, idx) => (
                                 <li key={idx} className="text-xs text-orange-300/80 leading-relaxed">
                                     {lim}
                                 </li>
                             ))}
                         </ul>
                     </div>
                 )}
               </div>
            )}
          </div>
        )}

      </div>
    </details>
  );
}

export function SwingReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [video, setVideo] = useState<any>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Compare mode state
  const [compareVideo, setCompareVideo] = useState<any>(null);
  const [compareUrl, setCompareUrl] = useState<string | null>(null);
  const [showCompareSelect, setShowCompareSelect] = useState(false);
  const [recentSwings, setRecentSwings] = useState<any[]>([]);

  // TTS State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [savedToJournal, setSavedToJournal] = useState(false);
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [showSimulatedMetrics, setShowSimulatedMetrics] = useState(false);

  useEffect(() => {
    // Reset save state when viewing a different video
    setSavedToJournal(false);
  }, [id]);

  const handleSaveToJournal = async () => {
    if (!video?.analysis || !id) return;
    setIsSavingJournal(true);
    try {
      await saveCoachingNote(id, video.analysis.primaryCorrection);
      await saveDrill(id, video.analysis.drill);
      setSavedToJournal(true);
    } catch (e) {
      console.error(e);
    }
    setIsSavingJournal(false);
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const playAudioFeedback = async (compareContext?: any) => {
    if (isPlayingAudio) {
      stopAudio();
      return;
    }

    const currentAnalysis = compareContext || video?.analysis;
    if (!currentAnalysis) return;
    setIsGeneratingAudio(true);
    try {
      const textParts = [
        compareContext ? `Comparing swings.` : `Swing analysis complete.`
      ];

      if (compareContext) {
        if (video?.analysis?.primaryCorrection !== currentAnalysis.primaryCorrection) {
          textParts.push(`Your current primary correction is: ${video?.analysis?.primaryCorrection}, compared to your previous correction: ${currentAnalysis.primaryCorrection}.`);
        } else {
          textParts.push(`Your primary correction remains: ${currentAnalysis.primaryCorrection}.`);
        }
        
        if (video?.analysis?.drill !== currentAnalysis.drill) {
           textParts.push(`Your new recommended drill is: ${video?.analysis?.drill}, changed from ${currentAnalysis.drill}.`);
        } else {
           textParts.push(`Continue working on this drill: ${currentAnalysis.drill}.`);
        }
      } else {
        textParts.push(`Your primary correction is: ${currentAnalysis.primaryCorrection}.`);
        textParts.push(`I recommend this drill: ${currentAnalysis.drill}.`);
      }

      const text = textParts.join(' ');
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          const binaryStr = atob(data.audio);
          const pcm16 = new Int16Array(binaryStr.length / 2);
          for (let i = 0; i < binaryStr.length / 2; i++) {
            const lsb = binaryStr.charCodeAt(i * 2);
            const msb = binaryStr.charCodeAt(i * 2 + 1);
            const val = (msb << 8) | lsb;
            pcm16[i] = val >= 32768 ? val - 65536 : val;
          }
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768.0;
          }

          if (!audioCtxRef.current) {
             audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
          }
          const audioCtx = audioCtxRef.current;
          
          const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);
          
          const sourceNode = audioCtx.createBufferSource();
          sourceNode.buffer = audioBuffer;
          sourceNode.connect(audioCtx.destination);
          
          sourceNode.onended = () => setIsPlayingAudio(false);
          sourceNode.start(0);
          
          audioSourceRef.current = sourceNode;
          setIsPlayingAudio(true);
        }
      }
    } catch (e) {
      console.error("TTS fetch error", e);
    }
    setIsGeneratingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (id) {
      getSwingVideo(id).then(v => {
        if (v) {
          setVideo(v);
          setUrl(URL.createObjectURL(v.blob));
          if (!v.analyzed) {
             analyze(v, false);
          }
        }
      });
    }
  }, [id]);

  useEffect(() => {
    getSwingVideos().then(vids => {
      const sorted = vids.sort((a, b) => b.timestamp - a.timestamp).filter(v => v.id !== id);
      setRecentSwings(sorted);
    });
  }, [id]);

  const loadCompareVideo = async (vidId: string) => {
    const v = await getSwingVideo(vidId);
    if (v) {
      setCompareVideo(v);
      setCompareUrl(URL.createObjectURL(v.blob));
      setShowCompareSelect(false);
      if (!v.analyzed) {
         analyze(v, true);
      }
    }
  };

  const analyze = async (v: any, isCompare: boolean) => {
    if (!isCompare) setAnalyzing(true);
    try {
      const res = await fetch('/api/gemini/swing-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          viewAngle: v.viewAngle, 
          videoInstructions: 'Analyze standard setup and swing path.' 
        })
      });
      if (res.ok) {
        const analysis = await res.json();
        await saveSwingAnalysis(v.id, analysis);
        if (isCompare) {
          setCompareVideo((prev: any) => ({ ...prev, analyzed: true, analysis }));
        } else {
          setVideo((prev: any) => ({ ...prev, analyzed: true, analysis }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    if (!isCompare) setAnalyzing(false);
  };

  if (!video) {
    return <div className="p-8 text-center text-zinc-500">Loading...</div>;
  }

  const analysis = video.analysis || {};
  const dataGaps = Array.isArray(analysis.dataGaps) ? analysis.dataGaps : [];
  
  const compareAnalysis = compareVideo?.analysis || {};
  const compareDataGaps = Array.isArray(compareAnalysis.dataGaps) ? compareAnalysis.dataGaps : [];
  
  const isComparing = !!compareVideo;

  return (
    <div className="min-h-screen bg-black text-white pb-24 relative overflow-x-hidden">
      {/* Header */}
      <div className="fixed top-0 w-full z-20 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 bg-black/50 rounded-full backdrop-blur">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          {analyzing && <span className="bg-blue-600/50 border border-blue-500 text-blue-100 px-3 py-1 text-xs rounded-full flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Logic</span>}
          {!isComparing && (
            <button 
              onClick={() => setShowCompareSelect(true)}
              className="bg-zinc-800/80 backdrop-blur border border-zinc-700 text-zinc-300 px-3 py-1.5 text-xs rounded-full flex items-center gap-2 hover:bg-zinc-700 transition"
            >
              <GitCompare className="w-4 h-4" /> Compare
            </button>
          )}
        </div>
      </div>

      <div className="pt-16">
        {/* Media Player Section */}
        <div className={cn("grid", isComparing ? "grid-cols-2" : "grid-cols-1")}>
          <SwingPlayer video={video} url={url!} label={isComparing ? "Current" : undefined} />
          {isComparing && (
            <div className="relative">
              <SwingPlayer video={compareVideo} url={compareUrl!} label="Comparison" />
              <button 
                onClick={() => setCompareVideo(null)} 
                className="absolute top-4 right-4 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Analysis Report Section */}
        {!isComparing ? (
          <div className="grid p-4 gap-4 max-w-lg mx-auto mb-8">
            <div className="space-y-4">
               {!analyzing && analysis ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-zinc-300 font-semibold text-lg">AI Swing Analysis</h2>
                    <button
                      onClick={() => playAudioFeedback()}
                      disabled={isGeneratingAudio}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors",
                         isPlayingAudio 
                          ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30" 
                          : "bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/30"
                      )}
                    >
                      {isGeneratingAudio ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                      ) : isPlayingAudio ? (
                        <><Square className="w-4 h-4" /> Stop Audio</>
                      ) : (
                        <><Volume2 className="w-4 h-4" /> Listen to Feedback</>
                      )}
                    </button>
                  </div>

                  {dataGaps.length > 0 && (
                    <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                        <div>
                           <h4 className="text-sm font-semibold text-orange-400 mb-1">Estimated Analysis Due to Data Gaps</h4>
                           <p className="text-xs text-orange-300/80 mb-2">Confidence is limited. The following tracking elements were obstructed or missing. Visual observations and suggestions may be inaccurate.</p>
                           <div className="flex flex-wrap gap-1.5">
                             {dataGaps.map((gap: string, i: number) => (
                               <span key={i} className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-orange-900/40 border border-orange-900/50 rounded text-orange-200">
                                 {gap}
                               </span>
                             ))}
                           </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <details className="group border border-zinc-800 bg-zinc-900/50 rounded-xl overflow-hidden" open>
                    <summary className="p-4 cursor-pointer flex items-center justify-between outline-none">
                      <div className="flex items-center gap-3">
                        <h3 className="uppercase text-[10px] tracking-widest text-zinc-400 font-bold flex items-center gap-2 group-open:text-blue-400 transition-colors">
                          <Target className="w-4 h-4 text-blue-400 group-open:text-blue-400 group-[&:not([open])]:text-zinc-500" /> AI Feedback
                          {dataGaps.length > 0 && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[8px] tracking-widest group-open:text-orange-400">ESTIMATED</span>}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleSaveToJournal();
                          }}
                          disabled={isSavingJournal || savedToJournal}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors border",
                            savedToJournal 
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-white"
                          )}
                        >
                          {isSavingJournal ? (
                             <Loader2 className="w-3 h-3 animate-spin" />
                          ) : savedToJournal ? (
                             <><Check className="w-3 h-3" /> Saved to Journal</>
                          ) : (
                             <><Bookmark className="w-3 h-3" /> Save Note & Drill</>
                          )}
                        </button>
                      </div>
                      <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-zinc-800/50 mt-2 pt-4 space-y-4">
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Primary Correction</h4>
                        <p className="text-sm md:text-base text-zinc-100">{analysis.primaryCorrection}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Recommended Drill</h4>
                        <p className="text-sm md:text-base text-zinc-100 italic">"{analysis.drill}"</p>
                      </div>
                    </div>
                  </details>

                  <details className="group border border-zinc-800 bg-zinc-900/50 rounded-xl overflow-hidden" open>
                    <summary className="p-4 cursor-pointer flex items-center justify-between outline-none">
                      <h3 className="uppercase text-[10px] tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                        Top Observations 
                        {dataGaps.length > 0 && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[8px]">ESTIMATED</span>}
                      </h3>
                      <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-zinc-800/50 mt-2 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                         {analysis.topObservations?.map((obs: string, i: number) => (
                           <div key={i} className="border border-zinc-800 bg-zinc-950/50 rounded-xl p-3 text-sm text-zinc-300">
                             <span className="text-zinc-500 font-mono text-xs mb-1 block">0{i+1}</span>
                             <p className="">{obs}</p>
                           </div>
                         ))}
                      </div>
                    </div>
                  </details>

                  <details className="group border border-emerald-900/30 bg-emerald-900/10 rounded-xl overflow-hidden">
                    <summary className="p-4 cursor-pointer flex items-center justify-between outline-none">
                      <h3 className="uppercase text-[10px] tracking-widest text-emerald-400 font-bold">Detected Phases</h3>
                      <ChevronDown className="w-4 h-4 text-emerald-500 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-emerald-900/30 mt-2 pt-4">
                      <div className="flex flex-wrap gap-2">
                        {analysis.detectedPhases?.map((phase: string, i: number) => (
                          <span key={i} className="text-xs font-mono px-2 py-1 bg-emerald-950/50 border border-emerald-900/30 rounded text-emerald-300 flex items-center gap-1">
                            {phase.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>

                  <SwingTempoGraph 
                    tempo={analysis.tempoAnalysis} 
                    compareTempo={compareVideo?.analysis?.tempoAnalysis}
                    dataGaps={dataGaps}
                    compareDataGaps={compareDataGaps}
                  />

                  <details className="group border border-blue-900/30 bg-blue-900/10 rounded-xl overflow-hidden">
                    <summary className="p-4 cursor-pointer flex items-center justify-between outline-none">
                      <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest">Quality & Confidence</h3>
                      <ChevronDown className="w-4 h-4 text-blue-500 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-blue-900/30 mt-2 pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border border-blue-900/30 bg-blue-950/50 rounded-xl p-3">
                          <span className="text-blue-500/70 font-mono text-[10px] mb-1 block uppercase tracking-widest">Setup Score</span>
                          <p className="text-lg font-semibold text-blue-300">{analysis.setupScore}/100</p>
                        </div>
                        <div className="border border-blue-900/30 bg-blue-950/50 rounded-xl p-3">
                          <span className="text-blue-500/70 font-mono text-[10px] mb-1 block uppercase tracking-widest">Confidence</span>
                          <p className="text-lg font-semibold text-blue-300 capitalize">{analysis.confidence}</p>
                        </div>
                      </div>
                      <div className="border border-blue-900/30 bg-blue-950/50 rounded-xl p-3">
                        <span className="text-blue-500/70 font-mono text-[10px] mb-1 block uppercase tracking-widest">Visibility Quality</span>
                        <p className="text-sm text-blue-300 capitalize">{analysis.visibilityQuality}</p>
                      </div>
                    </div>
                  </details>

                  <details className="group border border-red-900/30 bg-red-900/10 rounded-xl overflow-hidden">
                    <summary className="p-4 cursor-pointer flex items-center justify-between outline-none">
                      <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">Data Gaps & Limitations</h3>
                      <ChevronDown className="w-4 h-4 text-red-500 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 border-t border-red-900/30 mt-2 pt-4 space-y-4">
                      <div>
                        <span className="text-red-500/70 font-mono text-[10px] mb-2 block uppercase tracking-widest">Missing Data & Gaps</span>
                        <div className="flex flex-wrap gap-2">
                          {dataGaps.map((gap: string, i: number) => (
                            <span key={i} className="text-[10px] uppercase font-mono px-2 py-1 bg-red-950/50 border border-red-900/30 rounded text-red-200/80 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-500/70" />
                              {gap}
                            </span>
                          ))}
                        </div>
                      </div>
                      {analysis.unsupportedMetrics && analysis.unsupportedMetrics.length > 0 && (
                        <div>
                          <span className="text-red-500/70 font-mono text-[10px] mb-2 block uppercase tracking-widest">Unsupported Metrics</span>
                          <div className="flex flex-wrap gap-2">
                            {analysis.unsupportedMetrics.map((metric: string, i: number) => (
                              <span key={i} className="text-[10px] uppercase font-mono px-2 py-1 bg-red-950/50 border border-red-900/30 rounded text-red-200/80 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-red-500/70" />
                                {metric}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ) : !analyzing ? (
                <div className="p-8 text-center text-zinc-500 border border-zinc-800 border-dashed rounded-xl">
                   <p>Analysis not available or failed.</p>
                   <button onClick={() => analyze(video, false)} className="mt-4 px-4 py-2 border border-zinc-700 rounded text-sm hover:bg-zinc-800">
                     Retry
                   </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 pb-8 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h2 className="text-zinc-300 font-semibold text-lg">Side-by-Side Comparison</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSimulatedMetrics(!showSimulatedMetrics)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border",
                    showSimulatedMetrics 
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                  )}
                >
                   {showSimulatedMetrics ? <EyeOff className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                   Hardware Metrics
                </button>
                <button
                  onClick={() => playAudioFeedback(compareVideo?.analysis)}
                  disabled={isGeneratingAudio}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors",
                     isPlayingAudio 
                      ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30" 
                      : "bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/30"
                  )}
                >
                  {isGeneratingAudio ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : isPlayingAudio ? (
                    <><Square className="w-4 h-4" /> Stop Audio</>
                  ) : (
                    <><Volume2 className="w-4 h-4" /> Listen to Feedback</>
                  )}
                </button>
              </div>
            </div>

            {(dataGaps.length > 0 || compareDataGaps.length > 0) && (
              <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                  <div>
                     <h4 className="text-sm font-semibold text-orange-400 mb-1">Estimated Data Comparison</h4>
                     <p className="text-xs text-orange-300/80 mb-2">Confidence in this comparison is limited due to data gaps in one or both recordings. Metrics and observations may be inaccurate.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-900 border-b border-zinc-800 uppercase text-[10px] tracking-widest text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-1/3">Metric / Feedback</th>
                    <th className="px-4 py-3 font-semibold w-1/3 border-l border-zinc-800 text-blue-400">Current Swing</th>
                    <th className="px-4 py-3 font-semibold w-1/3 border-l border-zinc-800 text-green-400">Comparison Swing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  <tr className="hover:bg-zinc-800/20">
                    <td className="px-4 py-3 text-zinc-400 font-medium">Capture Date</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-zinc-300">{new Date(video.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-zinc-300">{compareVideo ? new Date(compareVideo.timestamp).toLocaleString() : '-'}</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20">
                    <td className="px-4 py-3 text-zinc-400 font-medium">View Angle</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-zinc-300">{video.viewAngle}</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-zinc-300">{compareVideo?.viewAngle || '-'}</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20 bg-zinc-950/20">
                    <td className="px-4 py-3 text-zinc-400 font-medium align-top">Primary Correction</td>
                    <td className={cn(
                      "px-4 py-3 font-semibold",
                      compareVideo?.analysis?.primaryCorrection && analysis?.primaryCorrection !== compareVideo?.analysis?.primaryCorrection 
                        ? "bg-amber-500/20 text-amber-200 border-l border-amber-500 ring-1 ring-inset ring-amber-500/30" 
                        : "border-l border-zinc-800 text-zinc-100"
                    )}>{analysis?.primaryCorrection || 'N/A'}</td>
                    <td className={cn(
                      "px-4 py-3 font-semibold relative",
                      compareVideo?.analysis?.primaryCorrection && analysis?.primaryCorrection !== compareVideo?.analysis?.primaryCorrection 
                        ? "bg-amber-500/30 text-amber-50 border-l border-amber-400 ring-1 ring-inset ring-amber-500/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.2)]" 
                        : "border-l border-zinc-800 text-zinc-100"
                    )}>
                      {compareVideo?.analysis?.primaryCorrection && analysis?.primaryCorrection !== compareVideo?.analysis?.primaryCorrection && (
                         <span className="absolute -top-2 right-2 bg-amber-500 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shadow-lg animate-pulse">Changed</span>
                      )}
                      {compareVideo?.analysis ? compareVideo.analysis.primaryCorrection : <Loader2 className="w-4 h-4 animate-spin opacity-50" />}
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20">
                     <td className="px-4 py-3 text-zinc-400 font-medium align-top">Recommended Drill</td>
                    <td className={cn(
                      "px-4 py-3 italic",
                      compareVideo?.analysis?.drill && analysis?.drill !== compareVideo?.analysis?.drill
                        ? "bg-amber-500/10 text-amber-200 border-l border-amber-500/50 ring-1 ring-inset ring-amber-500/20"
                        : "border-l border-zinc-800 text-zinc-300"
                    )}>
                      {analysis?.drill || 'N/A'}
                      {compareVideo?.analysis?.drill && analysis?.drill !== compareVideo?.analysis?.drill && (
                         <div className="mt-2 px-2 py-1 text-[9px] bg-amber-500/20 text-amber-300 rounded inline-flex items-center uppercase tracking-widest font-bold border border-amber-500/30 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]">
                             New Drill
                         </div>
                      )}
                    </td>
                    <td className={cn(
                      "px-4 py-3 italic relative",
                      compareVideo?.analysis?.drill && analysis?.drill !== compareVideo?.analysis?.drill
                        ? "bg-blue-500/10 text-blue-200 border-l border-blue-400/50 ring-1 ring-inset ring-blue-500/20"
                        : "border-l border-zinc-800 text-zinc-300"
                    )}>
                      {compareVideo?.analysis ? compareVideo.analysis.drill : '-'}
                      {compareVideo?.analysis?.drill && analysis?.drill !== compareVideo?.analysis?.drill && (
                         <div className="mt-2 px-2 py-1 text-[9px] bg-blue-500/20 text-blue-300 rounded inline-flex items-center uppercase tracking-widest font-bold border border-blue-500/30">
                             Previous Drill
                         </div>
                      )}
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20 bg-zinc-950/20">
                    <td className="px-4 py-3 text-zinc-400 font-medium align-top">Top Observations</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-zinc-300">
                      <ul className="list-disc pl-4 space-y-1.5 text-xs">
                        {analysis?.topObservations?.map((obs: string, i: number) => {
                           const isNew = compareVideo?.analysis?.topObservations && !compareVideo.analysis.topObservations.includes(obs);
                           return (
                             <li key={i} className={cn("transition-colors", isNew ? "text-amber-300 font-medium list-none -ml-4 pl-4 border-l-2 border-amber-500 bg-amber-500/10 py-0.5 rounded-r" : "")}>
                               {obs}
                               {isNew && <span className="ml-2 inline-block text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded uppercase tracking-widest border border-amber-500/30 align-middle">New</span>}
                             </li>
                           );
                        })}
                      </ul>
                    </td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-zinc-300">
                      <ul className="list-disc pl-4 space-y-1.5 text-xs">
                        {compareVideo?.analysis?.topObservations?.map((obs: string, i: number) => {
                           const isUniqueToOld = analysis?.topObservations && !analysis.topObservations.includes(obs);
                           return (
                             <li key={i} className={cn("transition-colors", isUniqueToOld ? "text-blue-300 font-medium list-none -ml-4 pl-4 border-l-2 border-blue-500 bg-blue-500/10 py-0.5 rounded-r" : "")}>
                               {obs}
                               {isUniqueToOld && <span className="ml-2 inline-block text-[8px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded uppercase tracking-widest border border-blue-500/30 align-middle">Resolved?</span>}
                             </li>
                           );
                        })}
                      </ul>
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20">
                    <td className="px-4 py-3 text-zinc-400 font-medium align-top">Reported Data Gaps</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-red-400 text-xs">
                      {dataGaps.length > 0 ? dataGaps.join(', ') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-red-400 text-xs">
                       {compareDataGaps.length > 0 ? compareDataGaps.join(', ') : '-'}
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-800/20 bg-zinc-950/20">
                    <td className="px-4 py-3 text-zinc-400 font-medium align-top">Tempo Ratio</td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-emerald-300 text-sm font-bold flex items-center gap-2">
                      {analysis?.tempoAnalysis?.ratio ? `${analysis.tempoAnalysis.ratio.toFixed(1)}:1` : '3.2:1'}
                      {(!analysis?.tempoAnalysis?.ratio || dataGaps.some(gap => gap.toLowerCase().includes('tempo') || gap.toLowerCase().includes('frame') || gap.toLowerCase().includes('blur'))) && (
                         <div className="group relative inline-block cursor-help">
                           <AlertTriangle className="w-3 h-3 text-orange-500" />
                           <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-orange-200 text-[10px] w-48 p-2 rounded -top-8 left-6 pointer-events-none z-50">
                             {!analysis?.tempoAnalysis?.ratio ? 'Tempo is MOCK estimated data' : 'Tempo estimated with limited confidence due to data gaps'}
                           </div>
                         </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-l border-zinc-800 text-emerald-300 text-sm font-bold">
                       <div className="flex items-center gap-2">
                         {compareVideo?.analysis?.tempoAnalysis?.ratio ? `${compareVideo.analysis.tempoAnalysis.ratio.toFixed(1)}:1` : '-'}
                         {(!compareVideo?.analysis?.tempoAnalysis?.ratio || compareDataGaps.some(gap => gap.toLowerCase().includes('tempo') || gap.toLowerCase().includes('frame') || gap.toLowerCase().includes('blur'))) && compareVideo && (
                            <div className="group relative inline-block cursor-help">
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-orange-200 text-[10px] w-48 p-2 rounded -top-8 left-6 pointer-events-none z-50">
                                {!compareVideo?.analysis?.tempoAnalysis?.ratio ? 'Comparison tempo is MOCK estimated data' : 'Comparison tempo estimated with limited confidence'}
                              </div>
                            </div>
                         )}
                       </div>
                    </td>
                  </tr>
                  {/* Simulated Hardware Metrics Rows */}
                  {showSimulatedMetrics && (
                    <>
                      <tr className="bg-zinc-900 border-y border-zinc-800">
                        <td colSpan={3} className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                             <div className="flex items-center gap-2 font-semibold text-xs text-amber-500 uppercase tracking-widest">
                               <AlertTriangle className="w-3 h-3" /> Simulated Hardware Metrics
                               <span className="bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded text-[9px] ml-2">MOCK_RENDER_TEST</span>
                             </div>
                             <div className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                               <strong>Why are these estimates mock data?</strong> Exact metrics like clubhead speed, spin rate, launch angle, apex, carry, and smash factor cannot be <em>MEASURED</em> purely from limited frame-rate video. They require physical launch monitor hardware or high-speed radar. Until hardware is connected, these are rendered as <em>UNAVAILABLE</em> or simulated for UI demonstration only.
                             </div>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-zinc-800/20">
                        <td className="px-4 py-3 text-zinc-400 font-medium">Club Head Speed</td>
                        <td className="px-4 py-3 border-l border-zinc-800 text-zinc-500 font-mono text-sm italic">92 mph <span className="text-[8px] bg-zinc-800 text-zinc-400 ml-1 px-1 rounded">UNAVAILABLE</span></td>
                        <td className="px-4 py-3 border-l border-zinc-800 text-zinc-500 font-mono text-sm italic">{compareVideo ? <span>104 mph <span className="text-[8px] bg-zinc-800 text-zinc-400 ml-1 px-1 rounded">UNAVAILABLE</span></span> : '-'}</td>
                      </tr>
                      <tr className="hover:bg-zinc-800/20">
                        <td className="px-4 py-3 text-zinc-400 font-medium">Angle of Attack</td>
                        <td className="px-4 py-3 border-l border-zinc-800 text-orange-400/70 font-mono text-sm border-dashed border-b border-orange-900/30 pb-0">-4.0° (Steep) <span className="text-[8px] bg-orange-900/30 text-orange-400 ml-1 px-1 rounded uppercase">AI_ESTIMATED</span></td>
                        <td className="px-4 py-3 border-l border-zinc-800 text-orange-400/70 font-mono text-sm border-dashed border-b border-orange-900/30 pb-0">{compareVideo ? <span>-1.5° (Better) <span className="text-[8px] bg-orange-900/30 text-orange-400 ml-1 px-1 rounded uppercase">AI_ESTIMATED</span></span> : '-'}</td>
                      </tr>
                      <tr className="hover:bg-zinc-800/20">
                        <td className="px-4 py-3 text-zinc-400 font-medium">Swing Path</td>
                        <td className="px-4 py-3 border-l border-zinc-800 text-purple-400/70 font-mono text-sm border-dotted border-b border-purple-900/30 pb-0">+4.0° (Out-to-In) <span className="text-[8px] bg-purple-900/30 text-purple-400 ml-1 px-1 rounded uppercase">INTERPOLATED</span></td>
                        <td className="px-4 py-3 border-l border-zinc-800 text-purple-400/70 font-mono text-sm border-dotted border-b border-purple-900/30 pb-0">{compareVideo ? <span>-1.0° (Neutral) <span className="text-[8px] bg-purple-900/30 text-purple-400 ml-1 px-1 rounded uppercase">INTERPOLATED</span></span> : '-'}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Swing History */}
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                 <History className="w-5 h-5 text-blue-400 shrink-0" />
                 <h3 className="text-zinc-300 font-semibold text-lg">Swing History</h3>
                 <span className="text-zinc-500 text-xs ml-auto">Library</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                {recentSwings.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No past swings found.</p>
                ) : (
                  recentSwings.map((v) => (
                    <div 
                      key={v.id}
                      className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-zinc-200 font-medium">{new Date(v.timestamp).toLocaleDateString()}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">{v.viewAngle}</span>
                      </div>
                      <div className="text-sm text-zinc-400 line-clamp-1">
                        {v.analyzed && v.analysis?.primaryCorrection ? v.analysis.primaryCorrection : 'Not yet analyzed'}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button 
                           onClick={() => {
                             window.scrollTo(0,0);
                             navigate(`/swing/${v.id}`, { replace: true });
                           }}
                           className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Review
                        </button>
                        <button 
                           onClick={() => {
                              window.scrollTo(0,0);
                              loadCompareVideo(v.id);
                           }}
                           className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/50 text-xs font-semibold rounded-lg transition-colors"
                        >
                          <GitCompare className="w-3 h-3" /> Compare
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Select Compare Video Modal */}
      {showCompareSelect && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col pt-4 overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="flex items-center justify-between px-6 pb-4 border-b border-zinc-800">
              <h3 className="font-semibold text-lg text-white">Select Swing to Compare</h3>
              <button onClick={() => setShowCompareSelect(false)} className="text-zinc-500 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1 space-y-2">
              {recentSwings.length === 0 ? (
                <p className="text-center text-zinc-500 py-8 text-sm">No other swings available to compare.</p>
              ) : (
                recentSwings.map((v) => (
                  <button 
                    key={v.id}
                    onClick={() => loadCompareVideo(v.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-zinc-200 font-medium">{new Date(v.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs text-zinc-500 mt-1">{v.viewAngle} {v.analyzed ? '• Analyzed' : ''}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

