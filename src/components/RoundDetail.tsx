import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRound, getCourse, getShotsByRound, addShot, updateShot, deleteShot, updateRoundScore, updateRoundCompletion } from '../lib/storage';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Map, MapPin, Plus, Trash2, Crosshair, Navigation, Edit2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

import { AiCaddy } from './AiCaddy';

// Haversine formula to calculate yards between two lat/lng points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6967420; // Earth's radius in yards
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
}

export function RoundDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [shots, setShots] = useState<any[]>([]);
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0);

  // Shot input state
  const [showShotSheet, setShowShotSheet] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [expandedShotId, setExpandedShotId] = useState<string | null>(null);
  const [club, setClub] = useState('Driver');
  const [lie, setLie] = useState('Tee');
  const [result, setResult] = useState('Fairway');
  const [penalty, setPenalty] = useState<number>(0);
  const [saveGps, setSaveGps] = useState(false);

  // Zoom and Pan states for shot trajectory map
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Long-press and Pinning states
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [pressStartPos, setPressStartPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingGpsPin, setPendingGpsPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [activePinTargetShotId, setActivePinTargetShotId] = useState<string | null>(null);
  const [lastUserGps, setLastUserGps] = useState<{ lat: number; lng: number }>({ lat: 36.488665, lng: -121.925000 });
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLastUserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { timeout: 4000 }
      );
    }
  }, []);

  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentHoleIdx]);

  const handleZoomIn = () => {
    setZoomScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const startLongPressTimer = (clientX: number, clientY: number) => {
    cancelLongPressTimer();
    setPressStartPos({ x: clientX, y: clientY });
    const timer = setTimeout(() => {
       handleLongPressMatch(clientX, clientY);
    }, 700);
    setLongPressTimer(timer);
  };

  const cancelLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    setLongPressTimer(null);
    setPressStartPos(null);
  };

  const handleMoveCheck = (clientX: number, clientY: number) => {
    if (pressStartPos) {
      const dist = Math.sqrt(Math.pow(clientX - pressStartPos.x, 2) + Math.pow(clientY - pressStartPos.y, 2));
      if (dist > 8) {
        cancelLongPressTimer();
      }
    }
  };

  const handleLongPressMatch = async (clientX: number, clientY: number) => {
    if (!mapContainerRef.current) return;
    
    if (navigator.vibrate) {
      try { navigator.vibrate(60); } catch(e) {}
    }

    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const untranslatedX = clickX - panOffset.x;
    const untranslatedY = clickY - panOffset.y;
    const relativeX = (untranslatedX - centerX) / zoomScale + centerX;
    const relativeY = (untranslatedY - centerY) / zoomScale + centerY;
    
    const pctX = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (relativeY / rect.height) * 100));
    
    const targetHole = course?.holes?.[currentHoleIdx];
    const targetHoleShots = shots.filter(s => s.holeNumber === targetHole?.number);
    const gpsShots = targetHoleShots.filter(s => s.gps);
    
    let minLat = lastUserGps.lat;
    let maxLat = lastUserGps.lat;
    let minLng = lastUserGps.lng;
    let maxLng = lastUserGps.lng;

    if (gpsShots.length > 0) {
      let absoluteMinLat = Infinity, absoluteMaxLat = -Infinity;
      let absoluteMinLng = Infinity, absoluteMaxLng = -Infinity;
      gpsShots.forEach(s => {
          if (s.gps.lat < absoluteMinLat) absoluteMinLat = s.gps.lat;
          if (s.gps.lat > absoluteMaxLat) absoluteMaxLat = s.gps.lat;
          if (s.gps.lng < absoluteMinLng) absoluteMinLng = s.gps.lng;
          if (s.gps.lng > absoluteMaxLng) absoluteMaxLng = s.gps.lng;
      });
      const latRange = Math.max(absoluteMaxLat - absoluteMinLat, 0.0001);
      const lngRange = Math.max(absoluteMaxLng - absoluteMinLng, 0.0001);
      
      minLat = absoluteMinLat - latRange * 0.15;
      maxLat = absoluteMaxLat + latRange * 0.15;
      minLng = absoluteMinLng - lngRange * 0.15;
      maxLng = absoluteMaxLng + lngRange * 0.15;
    } else {
      const verticalYards = targetHole?.yardage || 400;
      const latDelta = verticalYards * 0.000009;
      const lngDelta = latDelta;
      
      minLat = lastUserGps.lat - latDelta * 0.1;
      maxLat = lastUserGps.lat + latDelta * 0.9;
      minLng = lastUserGps.lng - lngDelta * 0.5;
      maxLng = lastUserGps.lng + lngDelta * 0.5;
    }

    const calculatedLng = minLng + (pctX / 100) * (maxLng - minLng);
    const calculatedLat = minLat + ((100 - pctY) / 100) * (maxLat - minLat);
    
    if (activePinTargetShotId) {
      const shot = shots.find(s => s.id === activePinTargetShotId);
      if (shot) {
        await updateShot({
          ...shot,
          gps: { lat: calculatedLat, lng: calculatedLng }
        });
        await loadData(round.id);
        setActivePinTargetShotId(null);
        cancelLongPressTimer();
        return;
      }
    }

    setPendingGpsPin({ lat: calculatedLat, lng: calculatedLng });
    setShowPinModal(true);
    cancelLongPressTimer();
  };

  const handleQuickPin = async (clientX: number, clientY: number) => {
    if (!mapContainerRef.current || !activePinTargetShotId) return;
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const untranslatedX = clickX - panOffset.x;
    const untranslatedY = clickY - panOffset.y;
    const relativeX = (untranslatedX - centerX) / zoomScale + centerX;
    const relativeY = (untranslatedY - centerY) / zoomScale + centerY;
    
    const pctX = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (relativeY / rect.height) * 100));
    
    const targetHole = course?.holes?.[currentHoleIdx];
    const targetHoleShots = shots.filter(s => s.holeNumber === targetHole?.number);
    const gpsShots = targetHoleShots.filter(s => s.gps);
    
    let minLat = lastUserGps.lat;
    let maxLat = lastUserGps.lat;
    let minLng = lastUserGps.lng;
    let maxLng = lastUserGps.lng;

    if (gpsShots.length > 0) {
      let absoluteMinLat = Infinity, absoluteMaxLat = -Infinity;
      let absoluteMinLng = Infinity, absoluteMaxLng = -Infinity;
      gpsShots.forEach(s => {
          if (s.gps.lat < absoluteMinLat) absoluteMinLat = s.gps.lat;
          if (s.gps.lat > absoluteMaxLat) absoluteMaxLat = s.gps.lat;
          if (s.gps.lng < absoluteMinLng) absoluteMinLng = s.gps.lng;
          if (s.gps.lng > absoluteMaxLng) absoluteMaxLng = s.gps.lng;
      });
      const latRange = Math.max(absoluteMaxLat - absoluteMinLat, 0.0001);
      const lngRange = Math.max(absoluteMaxLng - absoluteMinLng, 0.0001);
      
      minLat = absoluteMinLat - latRange * 0.15;
      maxLat = absoluteMaxLat + latRange * 0.15;
      minLng = absoluteMinLng - lngRange * 0.15;
      maxLng = absoluteMaxLng + lngRange * 0.15;
    } else {
      const verticalYards = targetHole?.yardage || 400;
      const latDelta = verticalYards * 0.000009;
      const lngDelta = latDelta;
      
      minLat = lastUserGps.lat - latDelta * 0.1;
      maxLat = lastUserGps.lat + latDelta * 0.9;
      minLng = lastUserGps.lng - lngDelta * 0.5;
      maxLng = lastUserGps.lng + lngDelta * 0.5;
    }

    const calculatedLng = minLng + (pctX / 100) * (maxLng - minLng);
    const calculatedLat = minLat + ((100 - pctY) / 100) * (maxLat - minLat);
    
    const shot = shots.find(s => s.id === activePinTargetShotId);
    if (shot) {
      await updateShot({
        ...shot,
        gps: { lat: calculatedLat, lng: calculatedLng }
      });
      await loadData(round.id);
      setActivePinTargetShotId(null);
      if (navigator.vibrate) {
        try { navigator.vibrate([40, 40]); } catch(e) {}
      }
    }
  };

  const handlePinGpsToShot = async (shotId: string) => {
    if (!pendingGpsPin) return;
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    
    await updateShot({
      ...shot,
      gps: pendingGpsPin
    });
    
    await loadData(round.id);
    setShowPinModal(false);
    setPendingGpsPin(null);
    setActivePinTargetShotId(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    startLongPressTimer(clientX, clientY);

    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const clientX = e.clientX;
    const clientY = e.clientY;
    handleMoveCheck(clientX, clientY);

    if (!isDragging) return;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    const bound = Math.max(0, (zoomScale - 1) * 120);
    setPanOffset({
      x: Math.max(-bound, Math.min(bound, dx)),
      y: Math.max(-bound, Math.min(bound, dy))
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    
    if (pressStartPos && activePinTargetShotId) {
      const dist = Math.sqrt(Math.pow(e.clientX - pressStartPos.x, 2) + Math.pow(e.clientY - pressStartPos.y, 2));
      if (dist <= 8 && longPressTimer) {
        handleQuickPin(e.clientX, e.clientY);
      }
    }
    
    cancelLongPressTimer();
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    cancelLongPressTimer();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    startLongPressTimer(clientX, clientY);

    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    handleMoveCheck(clientX, clientY);

    if (!isDragging) return;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    const bound = Math.max(0, (zoomScale - 1) * 120);
    setPanOffset({
      x: Math.max(-bound, Math.min(bound, dx)),
      y: Math.max(-bound, Math.min(bound, dy))
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    cancelLongPressTimer();
  };

  const handleDoubleClick = () => {
    if (zoomScale > 1) {
      handleResetZoom();
    } else {
      setZoomScale(2.5);
    }
  };

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (roundId: string) => {
    const r = await getRound(roundId);
    if (!r) return;
    setRound(r);
    const c = await getCourse(r.courseId);
    setCourse(c);
    const s = await getShotsByRound(roundId);
    setShots(s);
    
    // Find first hole without score if not completed, else start at 0
    if (!r.completed && c) {
        let firstEmpty = c.holes.findIndex((h: any) => !r.scores[h.number]);
        if (firstEmpty !== -1) setCurrentHoleIdx(firstEmpty);
    }
  };

  const handleScoreChange = async (holeNumber: number, step: number) => {
    if (!round) return;
    const currentScore = round.scores[holeNumber] || course.holes[currentHoleIdx].par;
    const newScore = Math.max(1, currentScore + step);
    await updateRoundScore(round.id, holeNumber, newScore);
    await loadData(round.id);
  };

  const handleSaveShot = async () => {
    if (!round || !course) return;
    const currentHole = course.holes[currentHoleIdx];
    const existing = editingShotId ? shots.find(s => s.id === editingShotId) : null;
    
    // Attempt GPS
    let gps: { lat: number; lng: number } | undefined;
    if (saveGps && (!existing || !existing.gps)) {
      try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch(e) {
          console.log('GPS not available for shot', e);
      }
    }

    const shotData = {
        roundId: round.id,
        holeNumber: currentHole.number,
        club,
        lie,
        result,
        penalty,
    };

    if (editingShotId) {
        await updateShot({
            ...existing,
            ...shotData,
            gps: saveGps ? (gps || existing?.gps) : undefined
        });
    } else {
        await addShot({
            ...shotData,
            gps: saveGps ? gps : undefined
        } as any);
        
        // Auto-update score to match shots if it's currently empty or less than shots
        const currentScore = round.scores[currentHole.number] || 0;
        if (currentScore < holeShots.length + 1) {
            await updateRoundScore(round.id, currentHole.number, holeShots.length + 1);
        }
    }
    
    await loadData(round.id);
    
    setShowShotSheet(false);
    setEditingShotId(null);
  };

  const handleEditShot = (shot: any) => {
      setEditingShotId(shot.id);
      setClub(shot.club);
      setLie(shot.lie);
      setResult(shot.result);
      setPenalty(shot.penalty);
      setSaveGps(!!shot.gps);
      setShowShotSheet(true);
  };

  const handleDeleteShot = async (shotId: string) => {
      await deleteShot(shotId);
      if (round) await loadData(round.id);
  }

  const handleCompleteRound = async () => {
      if (!round) return;
      await updateRoundCompletion(round.id, true);
      navigate('/scorecards');
  }

  const currentHole = course?.holes?.[currentHoleIdx] || null;
  const holeShots = shots.filter(s => s.holeNumber === currentHole?.number);
  const isLastHole = course?.holes ? currentHoleIdx === course.holes.length - 1 : false;

  useEffect(() => {
     if (course && currentHole) {
        const bc = new BroadcastChannel('caddy-context');
        const distance = currentHole.yardage || 0;
        
        let shotText = 'They are at the tee.';
        if (holeShots.length > 0) {
            const shotDescriptions = holeShots.map((s, i) => {
                let distText = "";
                if (i > 0 && s.gps && holeShots[i-1].gps) {
                    distText = ` (Distance: ${calculateDistance(holeShots[i-1].gps!.lat, holeShots[i-1].gps!.lng, s.gps.lat, s.gps.lng)} YDS)`;
                }
                const hasPenalty = typeof s.penalty === 'number' ? s.penalty > 0 : s.penalty !== 'None' && s.penalty !== '0';
                return `Shot ${i + 1}: ${s.club} from ${s.lie}${distText}, outcome: ${s.result}${hasPenalty ? ` (Penalty: ${s.penalty})` : ''}`;
            });
            shotText = `They have hit ${holeShots.length} shots. ` + shotDescriptions.join('. ');

            const lastShot = holeShots[holeShots.length - 1];
            const hasPenalty = typeof lastShot.penalty === 'number' ? lastShot.penalty > 0 : lastShot.penalty !== 'None' && lastShot.penalty !== '0';
            const penaltyText = hasPenalty ? ` with a penalty of ${lastShot.penalty}` : '';
            const gpsText = lastShot.gps ? ` [GPS: Lat ${lastShot.gps.lat.toFixed(6)}, Lng ${lastShot.gps.lng.toFixed(6)}]` : '';
            
            shotText += `. My most recent shot was a ${lastShot.club} from a ${lastShot.lie} lie, resulting in a ${lastShot.result} outcome${penaltyText}${gpsText}. Please provide tailored advice based on my current location, which is ${lastShot.result}.`;
        }
        
        const currentScoreVal = round?.scores[currentHole.number] || 0;
        const relativeScore = currentScoreVal > 0 
            ? (currentScoreVal > currentHole.par ? `+${currentScoreVal - currentHole.par}` : (currentScoreVal === currentHole.par ? 'E' : `${currentScoreVal - currentHole.par}`))
            : 'E';

        bc.postMessage({
           type: 'CONTEXT_UPDATE',
           payload: {
              holeNumber: currentHole.number,
              par: currentHole.par,
              yardage: currentHole.yardage,
              handicap: currentHole.handicap,
              score: relativeScore,
              shotInfo: shotText,
              latestShot: holeShots.length > 0 ? holeShots[holeShots.length-1] : null
           }
         });
         bc.close();
      }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentHoleIdx, JSON.stringify(holeShots), course, round?.scores]);

  if (!round || !course || !currentHole) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading round...</div>;
  }

  const getScoreSummary = () => {
      let totalScore = 0;
      let totalPar = 0;
      let holesPlayed = 0;
      course.holes.forEach((h: any) => {
          if (round.scores[h.number]) {
              totalScore += round.scores[h.number];
              totalPar += h.par;
              holesPlayed++;
          }
      });
      const toPar = totalScore - totalPar;
      return { totalScore, toPar, holesPlayed };
  }

  const summary = getScoreSummary();
  const currentScore = round.scores[currentHole.number] || 0;

  const renderMap = () => {
      const gpsShots = holeShots.filter(s => s.gps);
      const missingGpsShots = holeShots.filter(s => !s.gps);
      
      if (holeShots.length === 0) return null;

      let getCoord = (gps: any) => ({ x: 50, y: 50 });
      const estimatedCoords = new Map();

      if (gpsShots.length > 0) {
          // Normalize coordinates
          let minLat = Infinity, maxLat = -Infinity;
          let minLng = Infinity, maxLng = -Infinity;
          
          gpsShots.forEach(s => {
              if (s.gps.lat < minLat) minLat = s.gps.lat;
              if (s.gps.lat > maxLat) maxLat = s.gps.lat;
              if (s.gps.lng < minLng) minLng = s.gps.lng;
              if (s.gps.lng > maxLng) maxLng = s.gps.lng;
          });
          
          // Pad bounding box
          const latRange = Math.max(maxLat - minLat, 0.0001);
          const lngRange = Math.max(maxLng - minLng, 0.0001);
          
          minLat -= latRange * 0.1;
          maxLat += latRange * 0.1;
          minLng -= lngRange * 0.1;
          maxLng += lngRange * 0.1;

          getCoord = (gps: any) => {
              const y = 100 - ((gps.lat - minLat) / (maxLat - minLat)) * 100;
              const x = ((gps.lng - minLng) / (maxLng - minLng)) * 100;
              return { x, y };
          };
      }

      if (gpsShots.length === 0) {
          holeShots.forEach((shot, i) => {
              const t = holeShots.length > 1 ? i / (holeShots.length - 1) : 0;
              estimatedCoords.set(shot.id, {
                  x: 50 + (i % 2 === 0 ? -10 : 10), // slight zigzag to show progression
                  y: 80 - 60 * t // move from bottom to top
              });
          });
      } else {
          holeShots.forEach((shot, i) => {
              if (shot.gps) return;
              
              let prevValidIdx = -1;
              for (let j = i - 1; j >= 0; j--) {
                  if (holeShots[j].gps) { prevValidIdx = j; break; }
              }
              let nextValidIdx = -1;
              for (let j = i + 1; j < holeShots.length; j++) {
                  if (holeShots[j].gps) { nextValidIdx = j; break; }
              }
              
              if (prevValidIdx !== -1 && nextValidIdx !== -1) {
                  const prev = getCoord(holeShots[prevValidIdx].gps);
                  const next = getCoord(holeShots[nextValidIdx].gps);
                  const t = (i - prevValidIdx) / (nextValidIdx - prevValidIdx);
                  estimatedCoords.set(shot.id, {
                      x: prev.x + (next.x - prev.x) * t,
                      y: prev.y + (next.y - prev.y) * t,
                  });
              } else if (prevValidIdx !== -1) {
                  const prev = getCoord(holeShots[prevValidIdx].gps);
                  const offset = Math.min(10 * (i - prevValidIdx), 30);
                  estimatedCoords.set(shot.id, {
                      x: Math.max(5, Math.min(95, prev.x)), 
                      y: Math.max(5, Math.min(95, prev.y - offset)),
                  });
              } else if (nextValidIdx !== -1) {
                  const next = getCoord(holeShots[nextValidIdx].gps);
                  const offset = Math.min(10 * (nextValidIdx - i), 30);
                  estimatedCoords.set(shot.id, {
                      x: Math.max(5, Math.min(95, next.x)), 
                      y: Math.max(5, Math.min(95, next.y + offset)),
                  });
              }
          });
      }

      const getShotCoord = (shot: any) => {
          if (shot.gps) return getCoord(shot.gps);
          return estimatedCoords.get(shot.id);
      };

      return (
          <div 
              ref={mapContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={handleDoubleClick}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                  "h-64 bg-emerald-950/20 border rounded-3xl mb-6 relative overflow-hidden flex flex-col justify-between select-none touch-none transition-all",
                  activePinTargetShotId 
                      ? "border-amber-500 ring-2 ring-amber-500/30" 
                      : zoomScale > 1 ? (isDragging ? "cursor-grabbing border-blue-500/50" : "cursor-grab border-zinc-700/80 hover:border-zinc-500") : "border-emerald-900/50"
              )}
          >
              {/* Scalable Container */}
              <div 
                  className={cn(
                      "absolute inset-0 origin-center pointer-events-none",
                      isDragging ? "duration-0" : "transition-transform duration-300 ease-out"
                  )}
                  style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`
                  }}
              >
                  <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2310b981\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
                  }}></div>
                  
                  <div className="absolute inset-0 p-8">
                      <svg key={`trajectory-svg-${currentHoleIdx}`} className="w-full h-full overflow-visible">
                          {/* Draw lines */}
                          {holeShots.map((shot, i) => {
                              if (i === 0) return null;
                              const prevCoord = getShotCoord(holeShots[i-1]);
                              const currCoord = getShotCoord(shot);
                              
                              if (!prevCoord || !currCoord) return null;
                              
                              const isMissing = !shot.gps || !holeShots[i-1].gps;
                              
                              let distanceText = "N/A";
                              if (!isMissing) {
                                  distanceText = `${calculateDistance(holeShots[i-1].gps.lat, holeShots[i-1].gps.lng, shot.gps.lat, shot.gps.lng)}y`;
                              }
                              
                              const lineDelay = (i - 1) * 0.2;
                              
                              return (
                                  <g key={`line-group-${shot.id}`}>
                                      <motion.line 
                                          key={`line-${shot.id}`}
                                          initial={{ 
                                              x1: `${prevCoord.x}%`, 
                                              y1: `${prevCoord.y}%`, 
                                              x2: `${prevCoord.x}%`, 
                                              y2: `${prevCoord.y}%` 
                                          }}
                                          animate={{ 
                                              x2: `${currCoord.x}%`, 
                                              y2: `${currCoord.y}%` 
                                          }}
                                          transition={{
                                              duration: 0.6,
                                              ease: "easeOut",
                                              delay: lineDelay
                                          }}
                                          stroke={isMissing ? "#71717a" : "#10b981"} 
                                          strokeWidth={isMissing ? "1.5" : "2"} 
                                          strokeDasharray={isMissing ? "4 4" : "none"}
                                          className={isMissing ? "opacity-60" : "opacity-70"}
                                      />
                                      <motion.text
                                          x={`${(prevCoord.x + currCoord.x) / 2}%`}
                                          y={`${(prevCoord.y + currCoord.y) / 2}%`}
                                          dy="-6"
                                          textAnchor="middle"
                                          fill={isMissing ? "#71717a" : "#10b981"}
                                          fontSize="10"
                                          fontWeight="bold"
                                          className={isMissing ? "opacity-70" : "opacity-90"}
                                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{
                                              duration: 0.3,
                                              delay: lineDelay + 0.4
                                          }}
                                      >
                                          {distanceText}
                                      </motion.text>
                                  </g>
                              );
                          })}
                          {/* Draw points */}
                          {holeShots.map((shot, i) => {
                              const coord = getShotCoord(shot);
                              if (!coord) return null;
                              
                              const isMissing = !shot.gps;
                              const isLast = i === holeShots.length - 1;
                              const dotDelay = i * 0.2;
                              
                              if (isMissing) {
                                  return (
                                      <motion.g 
                                          key={`dot-${shot.id}`}
                                          initial={{ opacity: 0, scale: 0 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{
                                              type: "spring",
                                              stiffness: 260,
                                              damping: 20,
                                              delay: dotDelay
                                          }}
                                          style={{ transformOrigin: `${coord.x}% ${coord.y}%` }}
                                      >
                                          <circle cx={`${coord.x}%`} cy={`${coord.y}%`} r="6" fill="#27272a" stroke="#71717a" strokeWidth="1.5" strokeDasharray="2 2" className="opacity-80" />
                                          <text x={`${coord.x}%`} y={`${coord.y}%`} dy="3" textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="bold" className="opacity-90">
                                              ?
                                          </text>
                                          <text x={`${coord.x}%`} y={`${coord.y}%`} dy="-12" textAnchor="middle" fill="#71717a" fontSize="8" fontWeight="semibold" className="opacity-80">
                                              {shot.club} (Est.)
                                          </text>
                                      </motion.g>
                                  );
                              }
                              
                              return (
                                  <motion.g 
                                      key={`dot-${shot.id}`}
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{
                                          type: "spring",
                                          stiffness: 260,
                                          damping: 18,
                                          delay: dotDelay
                                      }}
                                      style={{ transformOrigin: `${coord.x}% ${coord.y}%` }}
                                  >
                                      <circle cx={`${coord.x}%`} cy={`${coord.y}%`} r={isLast ? "8" : "6"} fill={isLast ? "#fff" : "#10b981"} />
                                      <circle cx={`${coord.x}%`} cy={`${coord.y}%`} r={isLast ? "3" : "2"} fill="black" />
                                      <text x={`${coord.x}%`} y={`${coord.y}%`} dy="-12" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" className="shadow-black drop-shadow-md">
                                          {shot.club}
                                      </text>
                                  </motion.g>
                              );
                          })}
                      </svg>
                  </div>
              </div>
 
              {/* Overlays */}
              <div className="relative z-10 pointer-events-none p-3 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-center w-full">
                    {activePinTargetShotId ? (
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setActivePinTargetShotId(null); }}
                            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-2.5 py-1 rounded-xl text-[9px] uppercase font-black tracking-wider flex items-center gap-1 shadow-lg pointer-events-auto cursor-pointer animate-pulse shrink-0"
                            title="Click to cancel GPS pinning mode"
                        >
                            <MapPin className="w-3 h-3 fill-current" />
                            <span>Pinning Mode: Tap Map</span>
                            <span className="text-[7px] bg-black/15 text-zinc-950 px-1 py-0.25 rounded font-bold">X</span>
                        </button>
                    ) : (
                        <div className="bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] uppercase font-bold tracking-widest text-emerald-400 border border-emerald-950 inline-flex items-center gap-1.5 pointer-events-auto" title="Long-press anywhere on the map to manually pin a coordinate">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span>GPS Trajectory (Long-Press to Pin)</span>
                        </div>
                    )}
                    {/* Zoom / Pan Action HUD overlay */}
                    <div className="flex gap-1.5 items-center pointer-events-auto">
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                            title="Zoom In"
                            className="bg-black/80 hover:bg-black text-white p-1.5 border border-zinc-800 rounded-lg transition active:scale-95"
                        >
                            <ZoomIn className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                            title="Zoom Out"
                            className="bg-black/80 hover:bg-black text-white p-1.5 border border-zinc-800 rounded-lg transition active:scale-95"
                        >
                            <ZoomOut className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                        {zoomScale > 1 && (
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
                                title="Reset Zoom"
                                className="bg-black/80 hover:bg-black text-white px-2 py-1.5 border border-zinc-800 rounded-lg transition active:scale-95 flex items-center gap-1 font-mono text-[9px] uppercase font-black tracking-wider animate-in fade-in zoom-in-75 duration-200"
                            >
                                <RotateCcw className="w-3 h-3 text-indigo-400" />
                                <span className="text-[9px] text-zinc-300">Reset</span>
                            </button>
                        )}
                    </div>
                  </div>
 
                  <div className="flex justify-between items-end w-full">
                      {zoomScale > 1 ? (
                          <div className="bg-zinc-950/80 backdrop-blur-sm px-2 py-1 rounded text-[9px] uppercase tracking-wider text-zinc-300 border border-zinc-800/50">
                              Drag to pan • Zoom {Math.round(zoomScale * 100)}% • Long-press to pin
                          </div>
                      ) : (
                          <div className="bg-zinc-950/50 backdrop-blur-sm px-2 py-1 rounded text-[9px] uppercase tracking-wider text-zinc-400 border border-zinc-800/10">
                              Double-tap to zoom • Long-press to pin GPS
                          </div>
                      )}

                      {missingGpsShots.length > 0 && (
                          <div className="flex flex-wrap gap-2 justify-end self-end pointer-events-auto max-w-[60%] mt-auto">
                              {missingGpsShots.map((shot) => (
                                  <div key={`missing-${shot.id}`} className="bg-zinc-950/80 backdrop-blur-sm px-2 py-1 rounded-md text-[9px] uppercase font-bold tracking-wider text-zinc-400 border border-zinc-800/50 flex items-center shadow-lg">
                                      <MapPin className="w-3 h-3 mr-1 opacity-40 stroke-[3]" />
                                      <span className="line-through opacity-50 mr-1.5">GPS</span>
                                      <span className="text-zinc-200">{shot.club}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
        {/* Header */}
        <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex flex-col gap-3.5 sticky top-0 z-20">
            {/* Progress Segment Bar */}
            <div className="flex gap-1 w-full mx-auto select-none">
                {course.holes.map((h: any, i: number) => {
                    const isPlayed = !!round.scores[h.number];
                    const isCurrent = i === currentHoleIdx;
                    return (
                        <button 
                            key={h.number} 
                            type="button"
                            onClick={() => setCurrentHoleIdx(i)}
                            className={cn(
                                "h-1.5 flex-1 rounded-full transition-all duration-200 outline-none focus:outline-none focus:ring-0",
                                isCurrent ? "bg-white scale-y-125 font-black" : isPlayed ? "bg-emerald-500 hover:bg-emerald-400" : "bg-zinc-800 hover:bg-zinc-700"
                            )} 
                            title={`Go to Hole ${h.number}`}
                        />
                    );
                })}
            </div>
            <div className="flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 border border-zinc-800 bg-zinc-900 rounded-full">
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-bold tracking-tight text-white">{course.name}</h1>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Thru {summary.holesPlayed} • {summary.totalScore > 0 ? summary.totalScore : '-'} ({summary.totalScore > 0 ? (summary.toPar > 0 ? `+${summary.toPar}` : summary.toPar === 0 ? 'E' : summary.toPar) : 'E'})</p>
                </div>
                <button onClick={() => setShowCompleteConfirm(true)} className="p-2 border border-emerald-900/50 bg-emerald-900/20 text-emerald-400 rounded-full hover:bg-emerald-900/40">
                    <CheckCircle2 className="w-5 h-5" />
                </button>
            </div>

            {/* Hole Navigation & Selector Bar */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 bg-zinc-905 border border-zinc-900 rounded-2xl p-1 select-none">
                    <button 
                        type="button"
                        onClick={() => setCurrentHoleIdx(Math.max(0, currentHoleIdx - 1))}
                        disabled={currentHoleIdx === 0}
                        className="p-2 hover:bg-zinc-900 text-zinc-400 disabled:opacity-20 disabled:hover:bg-transparent rounded-xl transition shrink-0 active:scale-95"
                        title="Previous Hole"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth flex gap-1 items-center px-0.5 py-0.5">
                        {course.holes.map((h: any, i: number) => {
                            const isCurrent = i === currentHoleIdx;
                            const score = round.scores[h.number];
                            const isPlayed = !!score;
                            const par = h.par;
                            
                            return (
                                <button
                                    key={h.number}
                                    type="button"
                                    onClick={() => setCurrentHoleIdx(i)}
                                    className={cn(
                                        "flex flex-col items-center justify-between min-w-[2.5rem] h-11 px-1 py-1 rounded-xl font-bold text-xs transition border uppercase shrink-0",
                                        isCurrent 
                                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                                            : isPlayed 
                                                ? "bg-emerald-950/40 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/20" 
                                                : "bg-zinc-950 border-zinc-850/80 text-zinc-500 hover:bg-zinc-850/20 hover:text-zinc-300"
                                    )}
                                >
                                    <span className={cn("text-[8px] uppercase tracking-wider font-extrabold", isCurrent ? "text-blue-100" : isPlayed ? "text-emerald-500/70" : "text-zinc-650")}>
                                        H{h.number}
                                    </span>
                                    <span className="text-[11px] font-black leading-none">
                                        {isPlayed ? score : `p${par}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button 
                        type="button"
                        onClick={() => setCurrentHoleIdx(Math.min(course.holes.length - 1, currentHoleIdx + 1))}
                        disabled={currentHoleIdx === course.holes.length - 1}
                        className="p-2 hover:bg-zinc-900 text-zinc-400 disabled:opacity-20 disabled:hover:bg-transparent rounded-xl transition shrink-0 active:scale-95"
                        title="Next Hole"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Selected Hole Details Sub-row */}
                <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-wider text-zinc-500 py-0.5">
                    <span className="font-extrabold text-zinc-400">Hole {currentHole.number}:</span>
                    <span className="font-black text-zinc-300">Par {currentHole.par}</span>
                    {currentHole.yardage && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-zinc-850" />
                            <span className="font-black text-zinc-300">{currentHole.yardage} Yds</span>
                        </>
                    )}
                    {currentHole.handicap && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-zinc-850" />
                            <span className="font-black text-zinc-300">HCP {currentHole.handicap}</span>
                        </>
                    )}
                </div>
            </div>
        </div>

        <div className="max-w-md mx-auto p-4 space-y-6">

            {/* Score Entry Container */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col items-center">
                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Score</div>
                <div className="flex items-center gap-8">
                    <button 
                        onClick={() => handleScoreChange(currentHole.number, -1)}
                        className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition"
                    >
                        <div className="w-4 h-1 bg-white rounded-full"></div>
                    </button>
                    
                    <div className="w-24 text-center">
                        <span className={cn(
                            "text-6xl font-black",
                            currentScore === 0 ? "text-zinc-600" :
                            currentScore < currentHole.par ? "text-red-400" :
                            currentScore > currentHole.par ? "text-blue-400" : "text-white"
                        )}>
                            {currentScore || '-'}
                        </span>
                        {currentScore > 0 && (
                             <div className="text-xs uppercase font-bold text-zinc-500 tracking-widest mt-2">
                                {currentScore === currentHole.par - 2 ? 'Eagle' :
                                 currentScore === currentHole.par - 1 ? 'Birdie' :
                                 currentScore === currentHole.par ? 'Par' :
                                 currentScore === currentHole.par + 1 ? 'Bogey' :
                                 currentScore === currentHole.par + 2 ? 'Dbl Bogey' : `+${currentScore - currentHole.par}`}
                             </div>
                        )}
                    </div>

                    <button 
                        onClick={() => handleScoreChange(currentHole.number, 1)}
                        className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition"
                    >
                        <Plus className="w-6 h-6 text-white" strokeWidth={3} />
                    </button>
                </div>
            </div>

            {/* Shots List Container */}
            {/* AI Caddy */}
            <AiCaddy 
                courseName={course.name}
                holeNumber={currentHole.number}
                par={currentHole.par}
                yardage={currentHole.yardage}
                handicap={currentHole.handicap}
                shots={holeShots}
            />

            {/* Hole Overview */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="font-black text-lg">Hole {currentHole.number}</h3>
                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 mt-1">
                        <span>Par {currentHole.par}</span>
                        {currentHole.yardage && <span>{currentHole.yardage} YDS</span>}
                        {currentHole.handicap && <span>HCP {currentHole.handicap}</span>}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Score</div>
                    <div className={cn(
                        "text-xl font-black",
                        currentScore === 0 ? "text-zinc-600" :
                        currentScore < currentHole.par ? "text-red-400" :
                        currentScore > currentHole.par ? "text-blue-400" : "text-white"
                    )}>
                        {currentScore === 0 ? '-' : 
                         currentScore === currentHole.par ? 'E' :
                         currentScore < currentHole.par ? `-${currentHole.par - currentScore}` : 
                         `+${currentScore - currentHole.par}`}
                    </div>
                </div>
            </div>

            {renderMap()}

            <div className="space-y-3">
                <div className="flex items-center justify-between items-center mb-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Crosshair className="w-4 h-4" /> Shot Tracking
                    </h3>
                    <span className="text-zinc-600 text-xs font-semibold">{holeShots.length} SHOTS</span>
                </div>

                <div className="space-y-2">
                    {holeShots.length === 0 ? (
                        <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-2xl p-6 text-center text-zinc-500 text-sm">
                            No shots tracked for this hole. Log each shot for detailed analytics.
                        </div>
                    ) : (
                        holeShots.map((shot, i) => {
                            const isExpanded = expandedShotId === shot.id;
                            let distanceText = "N/A";
                            if (i > 0 && shot.gps && holeShots[i-1].gps) {
                                distanceText = `${calculateDistance(holeShots[i-1].gps.lat, holeShots[i-1].gps.lng, shot.gps.lat, shot.gps.lng)} YDS`;
                            } else if (i === 0) {
                                distanceText = "N/A";
                            }
                            
                            return (
                            <div key={shot.id} 
                                className={cn(
                                    "bg-zinc-900 border rounded-2xl relative overflow-hidden group transition-all",
                                    isExpanded ? "border-zinc-600" : "border-zinc-800"
                                )}
                            >
                                <div className={cn("absolute left-0 top-0 bottom-0 w-1", isExpanded ? "bg-blue-500" : "bg-blue-500/30")}></div>
                                
                                {/* Header / Collapsed View */}
                                <div 
                                    className="p-4 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedShotId(isExpanded ? null : shot.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0",
                                            isExpanded ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"
                                        )}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("font-bold transition-colors", isExpanded ? "text-white text-lg" : "text-zinc-200")}>{shot.club}</span>
                                                {shot.penalty > 0 && <span className="bg-red-500/20 text-red-400 text-[10px] uppercase px-2 py-0.5 rounded font-bold">+{shot.penalty} Pen</span>}
                                            </div>
                                            <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                                                <span>{shot.lie}</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                <span>{shot.result}</span>
                                                {shot.gps && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                        <MapPin className="w-3 h-3 text-emerald-500/70" />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase text-zinc-600 font-bold tracking-widest mb-0.5">Distance</div>
                                            <div className="text-sm font-black text-white">{distanceText}</div>
                                        </div>
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center transition-transform",
                                            isExpanded ? "rotate-90 bg-zinc-800" : ""
                                        )}>
                                            <ChevronRight className="w-4 h-4 text-zinc-600" />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 bg-black/20">
                                        <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                                            <div>
                                                <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Lie</div>
                                                <div className="text-sm font-semibold text-zinc-300">{shot.lie}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Result</div>
                                                <div className="text-sm font-semibold text-zinc-300">{shot.result}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Distance</div>
                                                <div className="text-sm font-semibold text-zinc-300">{distanceText}</div>
                                            </div>
                                            {shot.penalty > 0 && (
                                                <div>
                                                    <div className="text-[10px] uppercase text-red-500/70 font-bold tracking-wider mb-1">Penalty</div>
                                                    <div className="text-sm font-semibold text-red-400">+{shot.penalty} Stroke{shot.penalty > 1 ? 's' : ''}</div>
                                                </div>
                                            )}
                                            {shot.gps && (
                                                <div>
                                                    <div className="text-[10px] uppercase text-emerald-500/70 font-bold tracking-wider mb-1">Location</div>
                                                    <div className="text-[10px] font-mono text-emerald-400 tracking-tighter">
                                                        {shot.gps.lat.toFixed(5)},<br/>{shot.gps.lng.toFixed(5)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/50 pt-3">
                                            {!shot.gps && (
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setActivePinTargetShotId(shot.id === activePinTargetShotId ? null : shot.id);
                                                        mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                                                    }} 
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all mr-auto",
                                                        activePinTargetShotId === shot.id
                                                            ? "bg-amber-500 text-zinc-950 font-black animate-pulse"
                                                            : "bg-indigo-900/30 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-900/50"
                                                    )}
                                                    title="Activate placement mode: click or long-press on the map to save this shot's coordinates"
                                                >
                                                    <MapPin className="w-3.5 h-3.5" /> 
                                                    {activePinTargetShotId === shot.id ? "Click/Long-Press Map" : "Pin GPS on Map"}
                                                </button>
                                            )}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditShot(shot); }} 
                                                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold hover:bg-zinc-700 hover:text-white flex items-center gap-1.5 transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> Edit
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteShot(shot.id); }} 
                                                className="px-4 py-2 bg-red-950/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-900/50 flex items-center gap-1.5 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )})
                    )}
                </div>

                <button 
                    onClick={() => { setEditingShotId(null); setShowShotSheet(true); }}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-zinc-300 font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition"
                >
                    <Plus className="w-5 h-5" /> Add Shot
                </button>
            </div>
        </div>

        {/* Floating next button if score is set */}
        {currentScore > 0 && !isLastHole && (
             <div className="fixed bottom-6 left-0 right-0 p-4 z-10 pointer-events-none flex justify-center">
                 <button 
                     onClick={() => setCurrentHoleIdx(currentHoleIdx + 1)}
                     className="bg-blue-600 pointer-events-auto text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-blue-500 transition"
                 >
                     Next Hole <ChevronRight className="w-5 h-5" />
                 </button>
             </div>
        )}

        {/* Complete Round Dialog */}
        {showCompleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompleteConfirm(false)}></div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative z-10 w-full max-w-sm">
                    <h3 className="text-lg font-bold text-white mb-2">Complete Round?</h3>
                    <p className="text-zinc-400 text-sm mb-6">Are you sure you want to finalize this round? You can view completed rounds from the course page.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowCompleteConfirm(false)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition">Cancel</button>
                        <button onClick={handleCompleteRound} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition">
                            <CheckCircle2 className="w-5 h-5" /> Complete
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Manually Pin GPS Modal */}
        {showPinModal && pendingGpsPin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setShowPinModal(false); setPendingGpsPin(null); }}></div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative z-10 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2 mb-4 text-emerald-400">
                        <MapPin className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-lg font-bold text-white">Pin GPS Location</h3>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-center text-xs text-zinc-400 mb-6 space-y-1">
                        <div><span className="text-zinc-650 font-bold">LAT:</span> {pendingGpsPin.lat.toFixed(6)}</div>
                        <div><span className="text-zinc-650 font-bold">LNG:</span> {pendingGpsPin.lng.toFixed(6)}</div>
                    </div>
                    
                    <p className="text-zinc-400 text-xs mb-3 uppercase tracking-widest font-black">Apply coordinate to shot:</p>
                    <div className="space-y-2 mb-6 max-h-52 overflow-y-auto pr-1">
                        {holeShots.length === 0 ? (
                            <p className="text-zinc-500 text-center py-4 text-xs">No shots logged on this hole yet.</p>
                        ) : (
                            holeShots.map((shot, idx) => (
                                <button 
                                    key={shot.id}
                                    onClick={() => handlePinGpsToShot(shot.id)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border transition flex items-center justify-between text-xs",
                                        activePinTargetShotId === shot.id
                                            ? "border-amber-500 bg-amber-955/40 text-amber-350 ring-2 ring-amber-500/20"
                                            : shot.gps
                                                ? "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/80"
                                                : "border-indigo-900/50 bg-indigo-950/20 text-indigo-300 hover:bg-indigo-900/40 animate-pulse"
                                    )}
                                >
                                    <div className="flex flex-col gap-0.5">
                                        <span className={cn("font-bold text-sm", activePinTargetShotId === shot.id ? "text-amber-300" : "text-white")}>Shot {idx + 1}: {shot.club}</span>
                                        <span className="text-zinc-500 text-[10px]">{shot.lie} • {shot.result}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {activePinTargetShotId === shot.id ? (
                                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 py-0.5 px-2 rounded-full font-black uppercase tracking-wider animate-pulse">Target</span>
                                        ) : shot.gps ? (
                                            <span className="text-[9px] bg-zinc-850 text-zinc-500 py-0.5 px-2 rounded-full font-bold">Has GPS</span>
                                        ) : (
                                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 py-0.5 px-2 rounded-full font-bold uppercase tracking-wider">Pin Here</span>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setShowPinModal(false); setPendingGpsPin(null); }} 
                            className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold hover:bg-zinc-700 hover:text-white transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Add Shot Bottom Sheet */}
        {showShotSheet && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShotSheet(false)}></div>
                <div className="bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 relative animate-in slide-in-from-bottom-8">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-zinc-800 rounded-full"></div>
                    <h3 className="text-lg font-bold text-white mt-4 mb-6">{editingShotId ? 'Edit Shot' : `Log Shot #${holeShots.length + 1}`}</h3>
                    
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pb-6">
                        {/* Club */}
                        <div className="mb-6">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2 block px-1">Club Used</label>
                            <div className="relative -mx-6 px-6">
                                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                                <div className="flex overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar text-center">
                                    <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl shrink-0">
                                        {['Driver', '3 Wood', '5 Wood', '4 Iron', '5 Iron', '6 Iron', '7 Iron', '8 Iron', '9 Iron', 'PW', 'AW', 'SW', 'LW', 'Putter'].map(c => {
                                            const shortName = c.replace(' Iron', 'i').replace(' Wood', 'w');
                                            return (
                                                <button
                                                    key={c}
                                                    onClick={() => setClub(c)}
                                                    className={cn(
                                                        "snap-center shrink-0 min-w[60px] px-5 py-3 rounded-xl text-sm transition-all focus:outline-none",
                                                        club === c ? "bg-white text-black font-black shadow-sm" : "text-zinc-500 font-bold hover:text-zinc-300"
                                                    )}
                                                >
                                                    {shortName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Lie */}
                        <div className="mb-6">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2 block px-1">Lie</label>
                            <div className="relative -mx-6 px-6">
                                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                                <div className="flex overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar text-center">
                                    <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl shrink-0">
                                        {['Tee', 'Fairway', 'Rough', 'Sand', 'Fringe', 'Green'].map(l => (
                                            <button
                                                key={l}
                                                onClick={() => setLie(l)}
                                                className={cn(
                                                    "snap-center shrink-0 min-w[70px] px-6 py-3 rounded-xl text-sm transition-all focus:outline-none",
                                                    lie === l ? "bg-emerald-500 text-black font-black shadow-sm" : "text-zinc-500 font-bold hover:text-zinc-300"
                                                )}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Result */}
                        <div className="mb-6">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-2 block px-1">Result</label>
                            <div className="relative -mx-6 px-6">
                                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none"></div>
                                <div className="flex overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar text-center">
                                    <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl shrink-0">
                                        {['Fairway', 'Green', 'Left Rough', 'Right Rough', 'Short', 'Long', 'Bunker', 'Water', 'Out of Bounds'].map(r => {
                                            const isBad = r === 'Water' || r === 'Out of Bounds' || r === 'Bunker';
                                            const isGood = r === 'Fairway' || r === 'Green';
                                            const activeColorClass = isGood ? "bg-blue-500" : isBad ? "bg-red-500" : "bg-amber-500";
                                            return (
                                            <button
                                                key={r}
                                                onClick={() => setResult(r)}
                                                className={cn(
                                                    "snap-center shrink-0 px-5 py-3 rounded-xl text-sm transition-all focus:outline-none",
                                                    result === r ? `${activeColorClass} text-black font-black shadow-sm` : "text-zinc-500 font-bold hover:text-zinc-300"
                                                )}
                                            >
                                                {r}
                                            </button>
                                        )})}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="pt-2 flex flex-col gap-2">
                             <label className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer">
                                 <input type="checkbox" checked={penalty > 0} onChange={(e) => setPenalty(e.target.checked ? 1 : 0)} className="w-5 h-5 rounded border-zinc-700 bg-black text-red-500 focus:ring-red-500" />
                                 <span className="text-sm font-bold text-red-400">Add Penalty Stroke</span>
                             </label>
                             <label className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer">
                                 <input type="checkbox" checked={saveGps} onChange={(e) => setSaveGps(e.target.checked)} className="w-5 h-5 rounded border-zinc-700 bg-black text-emerald-500 focus:ring-emerald-500" />
                                 <span className="text-sm font-bold text-emerald-400">Save GPS Location</span>
                             </label>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                        <button onClick={() => setShowShotSheet(false)} className="flex-1 py-3 text-zinc-400 font-bold hover:text-white transition">Cancel</button>
                        <button onClick={handleSaveShot} className="flex-[2] bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition">
                            <CheckCircle2 className="w-5 h-5" /> Save Shot
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
