import React, { useEffect, useRef, useState } from 'react';
import { 
  Map, Eye, Compass, Move, RotateCw, Plus, Trash2, Sliders, 
  Sparkles, RefreshCw, Send, CheckCircle2, Play, ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';
import { updateCourse } from '../lib/storage';

interface Coords {
  x: number;
  y: number;
}

interface Bunker {
  x: number;
  y: number;
  radius: number;
}

interface WaterArea {
  x: number;
  y: number;
  radius: number;
}

interface HoleLayout {
  number: number;
  teeBox: Coords;
  fairwayPoints: Coords[];
  green: Coords;
  flagLocation: Coords;
  bunkers: Bunker[];
  waterAreas: WaterArea[];
  trees: Coords[];
  layoutDescription: string;
  mainColors: string[];
  individualHoleCropPrompt: string;
  generatedImage?: string;
}

interface InteractiveCourseSimulatorProps {
  course: any;
  onCourseUpdated?: (updatedCourse: any) => void;
  onClose?: () => void;
}

export function InteractiveCourseSimulator({ course, onCourseUpdated, onClose }: InteractiveCourseSimulatorProps) {
  const [selectedHoleNum, setSelectedHoleNum] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'3D' | 'Aerial'>('3D');
  const [holeLayouts, setHoleLayouts] = useState<HoleLayout[]>([]);
  
  // Camera Navigation states in Local coordinates
  // Local space runs with Tee Box at (0, 0), and Green straight ahead at (0, yardageScale)
  const [camX, setCamX] = useState<number>(0);
  const [camY, setCamY] = useState<number>(20); // start just in front of Tee Box
  const [camYaw, setCamYaw] = useState<number>(0); // 0 radians = looking straight ahead along local Y axis
  const [camHeight, setCamHeight] = useState<number>(12); // camera eye height
  
  // Shot tracer animated ball physics
  const [isSimulatingShot, setIsSimulatingShot] = useState<boolean>(false);
  const [ballProgress, setBallProgress] = useState<number>(0); // 0 to 1
  const [ballTrail, setBallTrail] = useState<{x: number, y: number, z: number}[]>([]);
  
  // Target coordinates for rendering fallback images
  const [generatingHoleImage, setGeneratingHoleImage] = useState<boolean>(false);
  const [customHolePrompt, setCustomHolePrompt] = useState<string>("");
  const [showEditor, setShowEditor] = useState<boolean>(false);
  
  // Canvas refs
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load layouts from course or build defaults if missing
  useEffect(() => {
    if (course.aerialLayoutData?.holesLayout) {
      setHoleLayouts(course.aerialLayoutData.holesLayout);
    } else {
      // Build a default complete mockup layout matching the scorecard hole count
      const defaults = course.holes.map((h: any) => {
        const num = h.number;
        // Generate pseudo-coordinates tracing across page based on hole index
        const row = Math.floor((num - 1) / 3);
        const col = (num - 1) % 3;
        const baseX = 15 + col * 30;
        const baseY = 15 + row * 15;
        
        return {
          number: num,
          teeBox: { x: baseX, y: baseY + 10 },
          fairwayPoints: [
            { x: baseX + (num % 2 === 0 ? 5 : -5), y: baseY + 5 }
          ],
          green: { x: baseX, y: baseY },
          flagLocation: { x: baseX + 1, y: baseY - 1 },
          bunkers: [
            { x: baseX - 4, y: baseY + 2, radius: 2 },
            { x: baseX + 4, y: baseY - 1, radius: 1.5 }
          ],
          waterAreas: num % 3 === 0 ? [
            { x: baseX + (num % 2 === 0 ? 8 : -8), y: baseY + 6, radius: 4 }
          ] : [],
          trees: [
            { x: baseX - 6, y: baseY + 8 },
            { x: baseX + 6, y: baseY + 4 },
            { x: baseX - 8, y: baseY + 1 }
          ],
          layoutDescription: `Hole #${num} outlines a clean ${num % 2 === 0 ? 'dogleg right' : 'straight fairway'} highlighting light green corridors flanked by protective sand traps around the high-resolution front-left green space.`,
          mainColors: ["lightest green", "emerald green", "tan sand", num % 3 === 0 ? "soft water blue" : "rough green"],
          individualHoleCropPrompt: `A gorgeous scenic photorealistic aerial top-down layout of Hole ${num} green fairway with sand traps, manicured trees, high resolution.`
        };
      });
      setHoleLayouts(defaults);
    }
  }, [course]);

  const currentHoleLayout = holeLayouts.find(h => h.number === selectedHoleNum);

  // Set default prompt when hole switches
  useEffect(() => {
    if (currentHoleLayout) {
      setCustomHolePrompt(currentHoleLayout.individualHoleCropPrompt);
      // Reset camera to starting Tee-box area looking down the fairway
      setCamX(0);
      setCamY(15);
      setCamYaw(0);
      setBallProgress(0);
      setIsSimulatingShot(false);
      setBallTrail([]);
    }
  }, [selectedHoleNum, currentHoleLayout]);

  // Handle Dynamic Aerial Map Canvas Crop and Coordinate Overlay
  useEffect(() => {
    if (!cropCanvasRef.current || !currentHoleLayout || !course.aerialImageUrl) return;
    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.src = course.aerialImageUrl;

    img.onload = () => {
      drawCrop(ctx, img, currentHoleLayout);
    };
    img.onerror = () => {
      // Draw simulated graphical blueprint if image fails CORS or loading
      drawPlaceholderBlueprint(ctx, currentHoleLayout);
    };
  }, [currentHoleLayout, course.aerialImageUrl]);

  const drawCrop = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, layout: HoleLayout) => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;

    // Collate all points involved to find bounding box
    const pts = [
      layout.teeBox,
      layout.green,
      layout.flagLocation,
      ...layout.fairwayPoints,
      ...layout.bunkers,
      ...layout.waterAreas,
      ...layout.trees
    ];

    let minX = Math.min(...pts.map(p => p.x));
    let maxX = Math.max(...pts.map(p => p.x));
    let minY = Math.min(...pts.map(p => p.y));
    let maxY = Math.max(...pts.map(p => p.y));

    // Pad crop area by 15% to give beautiful visual breathing room
    const paddingX = Math.max((maxX - minX) * 0.18, 6);
    const paddingY = Math.max((maxY - minY) * 0.18, 6);
    minX = Math.max(minX - paddingX, 0);
    maxX = Math.min(maxX + paddingX, 100);
    minY = Math.max(minY - paddingY, 0);
    maxY = Math.min(maxY + paddingY, 100);

    canvas.width = 400;
    canvas.height = 400;

    const sourceX = (minX / 100) * img.naturalWidth;
    const sourceY = (minY / 100) * img.naturalHeight;
    const sourceW = ((maxX - minX) / 100) * img.naturalWidth;
    const sourceH = ((maxY - minY) / 100) * img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);

    // Coordinate conversions from Global aerial offset to Cropped coordinate frame
    const mapX = (gx: number) => ((gx - minX) / (maxX - minX)) * canvas.width;
    const mapY = (gy: number) => ((gy - minY) / (maxY - minY)) * canvas.height;

    // Draw Fairway Line Path
    ctx.strokeStyle = "rgba(52, 211, 153, 0.7)"; // bright translucent mint emerald
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(mapX(layout.teeBox.x), mapY(layout.teeBox.y));
    layout.fairwayPoints.forEach(p => ctx.lineTo(mapX(p.x), mapY(p.y)));
    ctx.lineTo(mapX(layout.green.x), mapY(layout.green.y));
    ctx.stroke();

    // Draw Bunkers
    ctx.fillStyle = "rgba(254, 240, 138, 0.45)"; // Soft sand yellow
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.5;
    layout.bunkers.forEach(b => {
      ctx.beginPath();
      // scale radius relative to proportional coordinate frame
      const r = (b.radius / (maxX - minX)) * canvas.width;
      ctx.arc(mapX(b.x), mapY(b.y), Math.max(r, 6), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Water
    ctx.fillStyle = "rgba(96, 165, 250, 0.5)"; // Blue water
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.5;
    layout.waterAreas.forEach(w => {
      ctx.beginPath();
      const r = (w.radius / (maxX - minX)) * canvas.width;
      ctx.arc(mapX(w.x), mapY(w.y), Math.max(r, 9), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Tree indicators
    ctx.fillStyle = "rgba(16, 185, 129, 0.5)";
    ctx.strokeStyle = "#10b981";
    layout.trees.forEach(t => {
      ctx.beginPath();
      ctx.arc(mapX(t.x), mapY(t.y), 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Tee Box indicator
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(mapX(layout.teeBox.x), mapY(layout.teeBox.y), 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TEE", mapX(layout.teeBox.x), mapY(layout.teeBox.y));

    // Green boundary indicator
    ctx.strokeStyle = "#10b981";
    ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mapX(layout.green.x), mapY(layout.green.y), 16, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Flag marker
    ctx.fillStyle = "#ef4444"; // Red flag
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // draw mini flagpole pole and triangular flag
    const fx = mapX(layout.flagLocation.x);
    const fy = mapY(layout.flagLocation.y);
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - 16);
    ctx.lineTo(fx - 10, fy - 12);
    ctx.lineTo(fx, fy - 8);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(fx, fy, 3, 0, 2*Math.PI);
    ctx.fillStyle = "#000000";
    ctx.fill();
  };

  const drawPlaceholderBlueprint = (ctx: CanvasRenderingContext2D, layout: HoleLayout) => {
    // Elegant dark technical blueprint fallback
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    canvas.width = 400;
    canvas.height = 400;

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw aesthetic grid lines
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Proportional coordinates bounding box simulation
    const minX = 0, maxX = 100, minY = 0, maxY = 100;
    const mapX = (gx: number) => ((gx - minX) / (maxX - minX)) * canvas.width;
    const mapY = (gy: number) => ((gy - minY) / (maxY - minY)) * canvas.height;

    ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(mapX(layout.teeBox.x), mapY(layout.teeBox.y));
    layout.fairwayPoints.forEach(p => ctx.lineTo(mapX(p.x), mapY(p.y)));
    ctx.lineTo(mapX(layout.green.x), mapY(layout.green.y));
    ctx.stroke();

    // Tee Box
    ctx.fillStyle = "#18181b";
    ctx.strokeStyle = "#10b981";
    ctx.beginPath(); ctx.arc(mapX(layout.teeBox.x), mapY(layout.teeBox.y), 10, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();

    // Green
    ctx.fillStyle = "#064e3b";
    ctx.strokeStyle = "#34d399";
    ctx.beginPath(); ctx.arc(mapX(layout.green.x), mapY(layout.green.y), 24, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();

    // Flag
    const fx = mapX(layout.flagLocation.x);
    const fy = mapY(layout.flagLocation.y);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - 18);
    ctx.lineTo(fx - 12, fy - 13);
    ctx.lineTo(fx, fy - 9);
    ctx.fill();

    // Details text
    ctx.fillStyle = "#71717a";
    ctx.font = "9px system-ui";
    ctx.fillText("SEPARATE AERIAL IMAGE SCAN FALLBACK", 20, 25);
  };

  // 3D SIMULATOR LOGIC & VIEW RENDER LOOP
  // Rotates coordinates into local vector space where Tee is (0,0) and Green is straight ahead
  useEffect(() => {
    if (!simCanvasRef.current || !currentHoleLayout) return;
    const canvas = simCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const renderingLoop = () => {
      draw3DScene(ctx, canvas, currentHoleLayout);
      animFrame = requestAnimationFrame(renderingLoop);
    };

    renderingLoop();
    return () => cancelAnimationFrame(animFrame);
  }, [currentHoleLayout, camX, camY, camYaw, camHeight, viewMode, holeLayouts, isSimulatingShot, ballProgress, ballTrail]);

  const draw3DScene = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, layout: HoleLayout) => {
    const width = canvas.width = canvas.parentElement?.clientWidth || 500;
    const height = canvas.height = 360;

    // Convert everything to local coords
    // Vector pointing straight up from Tee (tx, ty) to Green flag (gx, gy)
    const tx = layout.teeBox.x;
    const ty = layout.teeBox.y;
    const gx = layout.flagLocation.x;
    const gy = layout.flagLocation.y;

    const dx = gx - tx;
    const dy = gy - ty;
    const mapHoleLength = Math.sqrt(dx * dx + dy * dy);

    // Coordinate conversion mapping rotation angle (Green straight ahead along Local Y)
    const cosAngle = dy / mapHoleLength;
    const sinAngle = dx / mapHoleLength;

    const toLocal = (gxVal: number, gyVal: number) => {
      const rx = gxVal - tx;
      const ry = gyVal - ty;
      // standard rotation mapping
      const lx = rx * cosAngle - ry * sinAngle;
      const ly = rx * sinAngle + ry * cosAngle;
      return { x: lx * 15, y: ly * 15 }; // scale coordinate spacing factor
    };

    // Calculate all key components rotated and styled
    const localTee = toLocal(layout.teeBox.x, layout.teeBox.y);
    const localGreen = toLocal(layout.green.x, layout.green.y);
    const localFlag = toLocal(layout.flagLocation.x, layout.flagLocation.y);

    const localFairwayPoints = [
      localTee,
      ...layout.fairwayPoints.map(p => toLocal(p.x, p.y)),
      localGreen
    ];

    const localBunkers = layout.bunkers.map(b => ({
      ...toLocal(b.x, b.y),
      radiusPx: b.radius * 12
    }));

    const localWater = layout.waterAreas.map(w => ({
      ...toLocal(w.x, w.y),
      radiusPx: w.radius * 15
    }));

    const localTrees = layout.trees.map(t => toLocal(t.x, t.y));

    // AERIAL MAP MODE
    if (viewMode === 'Aerial') {
      ctx.fillStyle = "#0c0a09"; // Slate cosmic backdrop
      ctx.fillRect(0, 0, width, height);

      // Draw course bounding bounds
      ctx.save();
      // Center the local coordinates system inside the screen
      ctx.translate(width / 2, height - 70);
      const scaleFactor = Math.min(width / 400, height / (localGreen.y + 100));
      ctx.scale(scaleFactor, -scaleFactor); // invert Y so up is up

      // Draw bunkers on aerial
      ctx.fillStyle = "rgba(251, 191, 36, 0.45)"; // Soft golden beige
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      localBunkers.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radiusPx * 0.4, 0, 2*Math.PI);
        ctx.fill();
        ctx.stroke();
      });

      // Draw water
      ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
      ctx.strokeStyle = "#3b82f6";
      localWater.forEach(w => {
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radiusPx * 0.4, 0, 2*Math.PI);
        ctx.fill();
        ctx.stroke();
      });

      // Draw Fairway Grass boundaries
      ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
      ctx.lineWidth = 33;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(localTee.x, localTee.y);
      localFairwayPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();

      // Sharp putting green inner boundary
      ctx.fillStyle = "rgba(4, 120, 87, 0.6)";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(localGreen.x, localGreen.y, 25, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw individual trees
      ctx.fillStyle = "#059669";
      localTrees.forEach(t => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Green Flag
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(localFlag.x, localFlag.y, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Draw Player Camera Position marker
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(camX, camY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw FOV Direction pointer
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(camX, camY);
      ctx.lineTo(camX + Math.sin(camYaw) * 20, camY + Math.cos(camYaw) * 20);
      ctx.stroke();

      // Draw Animating Shot tracer in 2D
      if (ballTrail.length > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ballTrail[0].x, ballTrail[0].y);
        ballTrail.forEach(step => ctx.lineTo(step.x, step.y));
        ctx.stroke();

        const latestBall = ballTrail[ballTrail.length - 1];
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(latestBall.x, latestBall.y, 4 + (latestBall.z * 0.08), 0, 2*Math.PI);
        ctx.fill();
      }

      ctx.restore();

      // Mini text overlays
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`TEE POSITION: (0, 0)`, 15, 25);
      ctx.fillText(`GREEN AT: (0, ${Math.round(localGreen.y)} yds)`, 15, 40);
      return;
    }

    // FIRST PERSON 3D VIEW
    // Setup Perspective Math projection functions
    const project = (lx: number, ly: number, lz: number) => {
      // 1. Translate relative to Camera position state
      const tx = lx - camX;
      const ty = ly - camY;
      const tz = lz - camHeight;

      // 2. Rotate horizontal yaw coordinate around Camera yaw angle
      const rx = tx * Math.cos(camYaw) - ty * Math.sin(camYaw);
      const ry = tx * Math.sin(camYaw) + ty * Math.cos(camYaw);
      const rz = tz;

      // Behind Camera clip guard
      if (ry <= 5) return null;

      // Standard divide-by-depth perspective coordinates projection
      const focal = 320; // lens field-of-view strength focus
      const sx = width / 2 + (rx / ry) * focal;
      const sy = height / 2 - (rz / ry) * focal;
      const projectionScale = focal / ry;

      return { x: sx, y: sy, scale: projectionScale, depth: ry };
    };

    // Draw sky horizon background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height / 2);
    skyGrad.addColorStop(0, "#09090b"); // Sleek dark metallic sky
    skyGrad.addColorStop(1, "#1e293b"); // Deep rich twilight border
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Flat grass ground plane
    ctx.fillStyle = "#064e3b"; // Rich forest rough green
    ctx.fillRect(0, height / 2, width, height / 2);

    // Draw atmospheric horizontal clouds on the horizon
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2.5, width * 0.4, 15, 0, 0, 2 * Math.PI);
    ctx.fill();

    // RENDER 3D FAIRWAY AS TAPERED SEGMENTS
    // Collect projected boundary points for fairway corridors (20 units wide)
    const fairwaySegmentsLeft: {x: number, y: number}[] = [];
    const fairwaySegmentsRight: {x: number, y: number}[] = [];

    localFairwayPoints.forEach(p => {
      // Project left and right boundary paths to form solid polygons in distance
      const projLeft = project(p.x - 30, p.y, 0);
      const projRight = project(p.x + 30, p.y, 0);
      if (projLeft && projRight) {
        fairwaySegmentsLeft.push({ x: projLeft.x, y: projLeft.y });
        fairwaySegmentsRight.unshift({ x: projRight.x, y: projRight.y }); // unshift to draw circular polygon bounds easily
      }
    });

    if (fairwaySegmentsLeft.length > 1) {
      ctx.fillStyle = "#10b981"; // Bright fairway green
      ctx.beginPath();
      ctx.moveTo(fairwaySegmentsLeft[0].x, fairwaySegmentsLeft[0].y);
      fairwaySegmentsLeft.forEach(pt => ctx.lineTo(pt.x, pt.y));
      fairwaySegmentsRight.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.closePath();
      ctx.fill();
    }

    // DRAW WATER HAZARDS IN 3D (Rendered as blue horizontal ellipses in depth)
    localWater.forEach(w => {
      const proj = project(w.x, w.y, 0);
      if (proj) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.6)"; // Sparkling water
        ctx.strokeStyle = "#4ea8de";
        ctx.lineWidth = Math.min(6, 1 / proj.depth);
        ctx.beginPath();
        // Scale vertical squash projection based on distance depth
        const radiusX = w.radiusPx * proj.scale * 0.8;
        const radiusY = w.radiusPx * proj.scale * 0.2; // vertical squashing
        ctx.ellipse(proj.x, proj.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    });

    // DRAW SAND BUNKERS IN 3D
    localBunkers.forEach(b => {
      const proj = project(b.x, b.y, 0);
      if (proj) {
        ctx.fillStyle = "rgba(254, 240, 138, 0.8)"; // Golden sand trap
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const radiusX = b.radiusPx * proj.scale * 0.7;
        const radiusY = b.radiusPx * proj.scale * 0.18;
        ctx.ellipse(proj.x, proj.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    });

    // DRAW THE GREEN SPARK IN 3D
    const greenProj = project(localGreen.x, localGreen.y, 0);
    if (greenProj) {
      ctx.fillStyle = "#34d399"; // Super bright lime putting green
      ctx.strokeStyle = "rgba(16,185,129,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(greenProj.x, greenProj.y, 50 * greenProj.scale, 16 * greenProj.scale, 0, 0, 2*Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    // DRAW ALL TREES (depth sorted to render properly)
    const sortedTrees = localTrees
      .map(t => ({ lx: t.x, ly: t.y, proj: project(t.x, t.y, 0) }))
      .filter(t => t.proj !== null)
      .sort((a, b) => b.proj!.depth - a.proj!.depth); // Draw furthest trees first!

    sortedTrees.forEach(t => {
      const p = t.proj!;
      const treeHeight = 25 * p.scale;
      const trunkWidth = 3 * p.scale;

      // Draw tree wooden trunk coordinate
      ctx.fillStyle = "#78350f"; // wood brown
      ctx.fillRect(p.x - trunkWidth / 2, p.y - treeHeight / 3, trunkWidth, treeHeight / 3);

      // Draw beautiful tiered pines outline (3 overlapping triangles scaling up)
      ctx.fillStyle = "#065f46"; // Forest pine green
      for (let i = 0; i < 3; i++) {
        const tierSize = (16 - i * 3) * p.scale;
        const tierY = p.y - (treeHeight * 0.3) - (i * 6 * p.scale);
        
        ctx.beginPath();
        ctx.moveTo(p.x, tierY - tierSize);
        ctx.lineTo(p.x + tierSize * 0.8, tierY);
        ctx.lineTo(p.x - tierSize * 0.8, tierY);
        ctx.closePath();
        ctx.fill();
      }
    });

    // DRAW THE RED FLAGSTICK IN 3D perspective
    const flagProj = project(localFlag.x, localFlag.y, 0);
    if (flagProj) {
      const pinHeight = 35 * flagProj.scale;
      const pX = flagProj.x;
      const pY = flagProj.y;

      // Draw white flagpole
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.5, 2.5 * flagProj.scale);
      ctx.beginPath();
      ctx.moveTo(pX, pY);
      ctx.lineTo(pX, pY - pinHeight);
      ctx.stroke();

      // Draw tri-color waving red flag
      const flagW = 16 * flagProj.scale;
      const flagH = 10 * flagProj.scale;
      ctx.fillStyle = "#ef4444"; // Vivid Red
      ctx.beginPath();
      ctx.moveTo(pX, pY - pinHeight);
      ctx.lineTo(pX - flagW, pY - pinHeight + flagH / 2);
      ctx.lineTo(pX, pY - pinHeight + flagH);
      ctx.closePath();
      ctx.fill();

      // Draw flag base metallic shadow cup
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(pX, pY, 4 * flagProj.scale, 0, 2 * Math.PI);
      ctx.fill();
    }

    // DRAW SHOT TRACER ANIMATION PROJECTILES
    if (ballTrail.length > 0) {
      // Draw glowing background neon particle tracers
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#38bdf8";

      ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();

      let started = false;
      ballTrail.forEach(step => {
        const ep = project(step.x, step.y, step.z);
        if (ep) {
          if (!started) {
            ctx.moveTo(ep.x, ep.y);
            started = true;
          } else {
            ctx.lineTo(ep.x, ep.y);
          }
        }
      });
      ctx.stroke();

      // Reset shadow rendering immediately for other elements
      ctx.shadowBlur = 0;

      // Project the active ball projectile
      const latest = ballTrail[ballTrail.length - 1];
      const ballProj = project(latest.x, latest.y, latest.z);
      if (ballProj) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // size swells slightly at peak height to simulate physical elevation distance zooms
        const ballSize = Math.max(2, (3 + latest.z * 0.1) * ballProj.scale);
        ctx.arc(ballProj.x, ballProj.y, ballSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Trace a small shadow beneath the ball onto the ground (z=0)
        const shadowProj = project(latest.x, latest.y, 0);
        if (shadowProj) {
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.ellipse(shadowProj.x, shadowProj.y, ballSize * 0.9, ballSize * 0.25, 0, 0, 2*Math.PI);
          ctx.fill();
        }
      }
    }
  };

  // CAMERA & VEHICAL MOVEMENT ACTIONS
  const moveCamera = (direction: 'forward' | 'backward' | 'left' | 'right') => {
    const moveStep = 8;
    const rotStep = 0.08;

    if (direction === 'forward') {
      // Walk forward in yaw sight direction
      setCamX(prev => prev + Math.sin(camYaw) * moveStep);
      setCamY(prev => prev + Math.cos(camYaw) * moveStep);
    } else if (direction === 'backward') {
      setCamX(prev => prev - Math.sin(camYaw) * moveStep);
      setCamY(prev => prev - Math.cos(camYaw) * moveStep);
    } else if (direction === 'left') {
      // Rotate camera yaw left
      setCamYaw(prev => prev - rotStep);
    } else if (direction === 'right') {
      setCamYaw(prev => prev + rotStep);
    }
  };

  // Triggers real-time parabolic shot simulator
  const handleSimulateShot = () => {
    if (isSimulatingShot || !currentHoleLayout) return;

    // Redraw coordinates
    const tx = currentHoleLayout.teeBox.x;
    const ty = currentHoleLayout.teeBox.y;
    const gx = currentHoleLayout.flagLocation.x;
    const gy = currentHoleLayout.flagLocation.y;

    const dx = gx - tx;
    const dy = gy - ty;
    const mapHoleLength = Math.sqrt(dx * dx + dy * dy);

    const cosAngle = dy / mapHoleLength;
    const sinAngle = dx / mapHoleLength;

    const toLocal = (gxVal: number, gyVal: number) => {
      const rx = gxVal - tx;
      const ry = gyVal - ty;
      const lx = rx * cosAngle - ry * sinAngle;
      const ly = rx * sinAngle + ry * cosAngle;
      return { x: lx * 15, y: ly * 15 };
    };

    const startLocal = { x: camX, y: camY, z: 0 };
    const targetLocal = toLocal(currentHoleLayout.flagLocation.x, currentHoleLayout.flagLocation.y);

    setIsSimulatingShot(true);
    setBallProgress(0);

    const duration = 2400; // ms
    const intervalTime = 30; // 33 fps
    let elapsed = 0;
    const trail: {x: number, y: number, z: number}[] = [];

    const simTimer = setInterval(() => {
      elapsed += intervalTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Interpolate local coords straight/dogleg following
      const x = startLocal.x + (targetLocal.x - startLocal.x) * t;
      const y = startLocal.y + (targetLocal.y - startLocal.y) * t;
      
      // Calculate realistic high parabolic trajectory
      const maxAltitude = 35 + (mapHoleLength * 0.4); // higher altitude for larger distance
      const z = maxAltitude * 4 * t * (1 - t);

      trail.push({ x, y, z });
      setBallTrail([...trail]);
      setBallProgress(t);

      // Camera chases ball gently if looking first person
      setCamX(x - Math.sin(camYaw) * 12);
      setCamY(y - Math.cos(camYaw) * 12);

      if (t >= 1) {
        clearInterval(simTimer);
        setTimeout(() => {
          setIsSimulatingShot(false);
          // Gently land ball right at cup
          setCamX(targetLocal.x);
          setCamY(targetLocal.y - 12); // stand just behind flag
          setCamYaw(0);
        }, 300);
      }
    }, intervalTime);
  };

  // SAVE UPDATED COORDINATES IN IDB
  const saveLayoutEdits = async (updatedLayouts: HoleLayout[]) => {
    setHoleLayouts(updatedLayouts);
    const updatedCourse = {
      ...course,
      aerialLayoutData: {
        ...course.aerialLayoutData,
        holesLayout: updatedLayouts
      }
    };
    await updateCourse(updatedCourse);
    if (onCourseUpdated) onCourseUpdated(updatedCourse);
  };

  const updateHoleProperty = (key: keyof HoleLayout, value: any) => {
    if (!currentHoleLayout) return;
    const updated = holeLayouts.map(h => {
      if (h.number === selectedHoleNum) {
        return { ...h, [key]: value };
      }
      return h;
    });
    saveLayoutEdits(updated);
  };

  // ADD RANDOM SHAPE GENERATOR FOR MANUAL ADJUSTMENT
  const handleAddNewBunker = () => {
    if (!currentHoleLayout) return;
    const newB = {
      x: currentHoleLayout.green.x - 3,
      y: currentHoleLayout.green.y + 4,
      radius: 1.5
    };
    updateHoleProperty('bunkers', [...currentHoleLayout.bunkers, newB]);
  };

  const handleAddNewWater = () => {
    if (!currentHoleLayout) return;
    const newW = {
      x: currentHoleLayout.teeBox.x + 5,
      y: currentHoleLayout.teeBox.y - 8,
      radius: 3.5
    };
    updateHoleProperty('waterAreas', [...currentHoleLayout.waterAreas, newW]);
  };

  // TRIGGER REAL-TIME GEMINI IMAGE RENDER SERVICE
  const handleGenerateHoleImage = async () => {
    if (!currentHoleLayout) return;
    setGeneratingHoleImage(true);
    try {
      const prompt = `A highly atmospheric photorealistic 3D game rendering looking down from the tee box of a golf course hole. Description: ${customHolePrompt}. Light color green fairway, clear water blue details, white sand traps, and bright sunlight.`;
      const res = await fetch("/api/gemini/generate-course-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.imageUrl) {
        const updated = holeLayouts.map(h => {
          if (h.number === selectedHoleNum) {
            return { 
              ...h, 
              generatedImage: data.imageUrl,
              individualHoleCropPrompt: customHolePrompt
            };
          }
          return h;
        });
        await saveLayoutEdits(updated);
      }
    } catch (err) {
      console.error("Failed to generate hole scenic backdrop:", err);
    } finally {
      setGeneratingHoleImage(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl text-left space-y-4 max-w-lg mx-auto pb-4">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-r from-emerald-950/40 to-zinc-900 border-b border-zinc-800 p-4 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Navigable 3D Hole Simulator
          </h2>
          <p className="text-[10px] text-zinc-450 mt-0.5 font-mono">
            {course.name} &bull; PAR {course.holes.find((h: any) => h.number === selectedHoleNum)?.par || 4} &bull; YDS {course.holes.find((h: any) => h.number === selectedHoleNum)?.yardage || 380}
          </p>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Exit
          </button>
        )}
      </div>

      {/* Selector and Navigator */}
      <div className="px-4 flex items-center justify-between gap-2">
        <button 
          disabled={selectedHoleNum <= 1}
          onClick={() => setSelectedHoleNum(p => p - 1)}
          className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:enabled:bg-zinc-800 disabled:opacity-30 text-white"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-sm text-zinc-200 uppercase font-mono bg-zinc-900 border border-zinc-850 px-4 py-1.5 rounded-xl">
          Hole {selectedHoleNum} of {course.holes.length}
        </span>
        <button 
          disabled={selectedHoleNum >= course.holes.length}
          onClick={() => setSelectedHoleNum(p => p + 1)}
          className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:enabled:bg-zinc-800 disabled:opacity-30 text-white"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 grid grid-cols-2 gap-3">
        {/* VIEW 1: Aerial Crop vs Scenic Rendering */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-xl overflow-hidden bg-black border border-zinc-800 group shadow-lg">
            <div className="absolute top-2 left-2 z-10 bg-zinc-950/80 border border-zinc-850 rounded px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <Map className="w-3 h-3" /> Map Crop
            </div>
            <canvas ref={cropCanvasRef} className="w-full h-full object-cover" />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Hole Scenic Render</span>
              <button 
                onClick={handleGenerateHoleImage}
                disabled={generatingHoleImage}
                className="text-[9px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white px-2 py-1 rounded flex items-center gap-1 font-mono transition-colors"
              >
                {generatingHoleImage ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                Generate
              </button>
            </div>
            
            {currentHoleLayout?.generatedImage ? (
              <img 
                src={currentHoleLayout.generatedImage} 
                alt="Scenic Render preview"
                className="w-full h-18 rounded-lg object-cover border border-zinc-800"
              />
            ) : (
              <div className="h-18 flex items-center justify-center text-zinc-500 text-[9px] border border-dashed border-zinc-800 rounded-lg italic">
                No automatic render generated
              </div>
            )}
            
            <textarea 
              value={customHolePrompt}
              onChange={(e) => setCustomHolePrompt(e.target.value)}
              placeholder="Tailor aesthetic features/theme..."
              className="w-full text-[10px] bg-black border border-zinc-800 text-zinc-350 p-1.5 rounded font-sans focus:outline-none focus:border-zinc-700 resize-none h-12"
            />
          </div>
        </div>

        {/* VIEW 2: Dynamic Live 3D projection or Topdown tactical */}
        <div className="space-y-2 flex flex-col justify-between">
          <div className="relative flex-1 rounded-xl overflow-hidden bg-[#0c0a09] border border-zinc-800 flex flex-col justify-between p-1 min-h-[220px]">
            {/* Overlay View Selector */}
            <div className="absolute top-2 right-2 z-20 flex bg-zinc-950/90 border border-zinc-800 p-0.5 rounded-lg text-[9px] font-bold">
              <button 
                onClick={() => setViewMode('3D')}
                className={`px-2 py-1 rounded-md transition-all ${viewMode === '3D' ? 'bg-emerald-600 text-white' : 'text-zinc-400'}`}
              >
                3D Play
              </button>
              <button 
                onClick={() => setViewMode('Aerial')}
                className={`px-2 py-1 rounded-md transition-all ${viewMode === 'Aerial' ? 'bg-emerald-600 text-white' : 'text-zinc-400'}`}
              >
                Map View
              </button>
            </div>

            {/* Simulated Stage Renderer */}
            <canvas ref={simCanvasRef} className="w-full h-full rounded-lg bg-zinc-950 object-cover" />

            {/* Live FPS Control dashboard */}
            {viewMode === '3D' && (
              <div className="absolute bottom-2 left-2 z-10 bg-black/75 border border-zinc-850 p-2 rounded-lg space-y-1.5">
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Interactive D-PAD</span>
                <div className="grid grid-cols-3 gap-1">
                  <div/>
                  <button 
                    onClick={() => moveCamera('forward')}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 rounded text-zinc-200 flex items-center justify-center"
                    title="Move closer along fairway"
                  >
                    W
                  </button>
                  <div/>
                  <button 
                    onClick={() => moveCamera('left')}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 rounded text-zinc-200 flex items-center justify-center"
                    title="Rotate view left"
                  >
                    A
                  </button>
                  <button 
                    onClick={() => moveCamera('backward')}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 rounded text-zinc-200 flex items-center justify-center"
                    title="Walk backwards"
                  >
                    S
                  </button>
                  <button 
                    onClick={() => moveCamera('right')}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 rounded text-zinc-200 flex items-center justify-center"
                    title="Rotate view right"
                  >
                    D
                  </button>
                </div>
              </div>
            )}

            {/* Shot Tracer action */}
            <button 
              onClick={handleSimulateShot}
              disabled={isSimulatingShot}
              className="absolute bottom-2 right-2 z-10 bg-gradient-to-r from-emerald-600 to-sky-600 disabled:from-zinc-800 disabled:to-zinc-850 hover:brightness-110 text-white font-mono px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-lg transition-all"
            >
              <Play className="w-3 h-3 fill-current" />
              {isSimulatingShot ? "Simulating Tracer..." : "Simulate Shot"}
            </button>
          </div>
        </div>
      </div>

      {/* Terrain description extracted */}
      <div className="px-4">
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 space-y-1.5">
          <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Hole Descriptor Summary</span>
          <p className="text-[11px] text-zinc-350 leading-relaxed font-sans mt-0.5">
            {currentHoleLayout?.layoutDescription}
          </p>
          {currentHoleLayout?.mainColors && currentHoleLayout.mainColors.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 opacity-80">
              {currentHoleLayout.mainColors.map((col, i) => (
                <span key={i} className="text-[8px] uppercase tracking-wider bg-zinc-950 border border-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded-md font-mono">
                  🎨 {col}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* INTERACTIVE BUILDER MODULE PANEL */}
      <div className="px-4">
        <button 
          onClick={() => setShowEditor(!showEditor)}
          className="w-full bg-zinc-900 border border-zinc-850 text-zinc-300 font-medium py-2 rounded-xl text-xs hover:bg-zinc-850 transition-all flex items-center justify-center gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5" />
          {showEditor ? "Collapse Physical Obstacle Editor" : "Open Obstacles Coordinate Editor"}
        </button>

        {showEditor && currentHoleLayout && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mt-2 space-y-3.5 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
              <span>Interactive Golf Obstacles</span>
              <button 
                onClick={handleAddNewBunker}
                className="text-emerald-400 flex items-center gap-1 hover:brightness-110"
              >
                <Plus className="w-3 h-3" /> Add Bunker
              </button>
            </div>

            {currentHoleLayout.bunkers.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">No bunkers defined yet.</p>
            ) : (
              <div className="space-y-2">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono">Sand Bunker Coordinates</span>
                {currentHoleLayout.bunkers.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-zinc-950 border border-zinc-850 p-2 rounded-lg">
                    <span className="text-[10px] font-mono font-bold text-zinc-400">#{idx+1}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-mono">X Position</span>
                        <input 
                          type="range" min="10" max="90" step="1"
                          value={Math.round(b.x)}
                          onChange={(e) => {
                            const updatedBunkers = [...currentHoleLayout.bunkers];
                            updatedBunkers[idx] = { ...b, x: parseFloat(e.target.value) };
                            updateHoleProperty('bunkers', updatedBunkers);
                          }}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-mono">Y Position</span>
                        <input 
                          type="range" min="10" max="90" step="1"
                          value={Math.round(b.y)}
                          onChange={(e) => {
                            const updatedBunkers = [...currentHoleLayout.bunkers];
                            updatedBunkers[idx] = { ...b, y: parseFloat(e.target.value) };
                            updateHoleProperty('bunkers', updatedBunkers);
                          }}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-mono">Size Radius</span>
                        <input 
                          type="range" min="0.5" max="5" step="0.1"
                          value={b.radius}
                          onChange={(e) => {
                            const updatedBunkers = [...currentHoleLayout.bunkers];
                            updatedBunkers[idx] = { ...b, radius: parseFloat(e.target.value) };
                            updateHoleProperty('bunkers', updatedBunkers);
                          }}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const updatedBunkers = currentHoleLayout.bunkers.filter((_, i) => i !== idx);
                        updateHoleProperty('bunkers', updatedBunkers);
                      }}
                      className="p-1 text-red-400 hover:bg-zinc-900 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pb-2 border-b border-zinc-800 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
              <span>Water Hazard Areas</span>
              <button 
                onClick={handleAddNewWater}
                className="text-blue-400 flex items-center gap-1 hover:brightness-110"
              >
                <Plus className="w-3 h-3" /> Add Lake
              </button>
            </div>

            {currentHoleLayout.waterAreas.length === 0 ? (
              <p className="text-[10px] text-zinc-500 italic">No lakes parsed yet.</p>
            ) : (
              <div className="space-y-2">
                <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono">Lake Boundaries Coordinates</span>
                {currentHoleLayout.waterAreas.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-zinc-950 border border-zinc-850 p-2 rounded-lg">
                    <span className="text-[10px] font-mono font-bold text-zinc-400">#{idx+1}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-mono">X Position</span>
                        <input 
                          type="range" min="10" max="90" step="1"
                          value={Math.round(w.x)}
                          onChange={(e) => {
                            const updatedW = [...currentHoleLayout.waterAreas];
                            updatedW[idx] = { ...w, x: parseFloat(e.target.value) };
                            updateHoleProperty('waterAreas', updatedW);
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-mono">Y Position</span>
                        <input 
                          type="range" min="10" max="90" step="1"
                          value={Math.round(w.y)}
                          onChange={(e) => {
                            const updatedW = [...currentHoleLayout.waterAreas];
                            updatedW[idx] = { ...w, y: parseFloat(e.target.value) };
                            updateHoleProperty('waterAreas', updatedW);
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-mono">Size Radius</span>
                        <input 
                          type="range" min="1" max="10" step="0.2"
                          value={w.radius}
                          onChange={(e) => {
                            const updatedW = [...currentHoleLayout.waterAreas];
                            updatedW[idx] = { ...w, radius: parseFloat(e.target.value) };
                            updateHoleProperty('waterAreas', updatedW);
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const updatedW = currentHoleLayout.waterAreas.filter((_, i) => i !== idx);
                        updateHoleProperty('waterAreas', updatedW);
                      }}
                      className="p-1 text-red-400 hover:bg-zinc-900 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
