import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, createRound, getRoundsByCourse, updateCourse } from '../lib/storage';
import { ArrowLeft, Map, Play, Calendar, Trophy, Sparkles, Upload, Loader2, Compass } from 'lucide-react';
import { InteractiveCourseSimulator } from './InteractiveCourseSimulator';

export function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      getCourse(id).then(c => {
        if (c) setCourse(c);
      });
      getRoundsByCourse(id).then(r => setRounds(r));
    }
  }, [id]);

  const handleStartRound = async () => {
    if (!course) return;
    const roundId = await createRound(course.id);
    navigate(`/round/${roundId}`);
  };

  const [analyzingLayout, setAnalyzingLayout] = useState(false);
  const [layoutAnalysisError, setLayoutAnalysisError] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);

  const handleUploadLayoutMap = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingLayout(true);
    setLayoutAnalysisError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const res = await fetch('/api/gemini/analyze-aerial-layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: {
            data: base64Data,
            mimeType: file.type,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`API analysis error: ${res.statusText}`);
      }

      const result = await res.json();
      if (!result || !result.holesLayout) {
        throw new Error("Invalid structure returned from the model API scanner.");
      }

      const updatedCourse = {
        ...course,
        aerialLayoutData: result,
      };

      await updateCourse(updatedCourse);
      setCourse(updatedCourse);
      setShowSimulator(true);
    } catch (err: any) {
      console.error(err);
      setLayoutAnalysisError(err.message || 'Error occurred while parsing layout.');
    } finally {
      setAnalyzingLayout(false);
    }
  };

  if (!course) {
    return <div className="p-8 text-center text-zinc-500">Loading...</div>;
  }

  const totalPar = course.holes.reduce((sum: number, h: any) => sum + (h.par || 0), 0);
  const totalYardage = course.holes.reduce((sum: number, h: any) => sum + (h.yardage || 0), 0);

  if (showSimulator) {
    return (
      <div className="container mx-auto p-4 max-w-md pt-12 pb-24">
        <InteractiveCourseSimulator 
          course={course} 
          onCourseUpdated={(c) => setCourse(c)}
          onClose={() => setShowSimulator(false)} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto p-4 max-w-md pt-12 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 border border-zinc-800 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white line-clamp-1">{course.name}</h1>
            <p className="text-zinc-400 text-sm flex gap-3">
              <span>Tees: {course.teeSet}</span>
              <span>Par: {totalPar}</span>
              {totalYardage > 0 && <span>Yds: {totalYardage}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={handleStartRound}
          className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500 transition shadow-[0_0_20px_rgba(5,150,105,0.4)]"
        >
          <Play className="w-5 h-5 fill-current" />
          Start Round
        </button>
      </div>

      {course.aerialLayoutData ? (
        <div className="bg-gradient-to-br from-zinc-905 via-zinc-900 to-emerald-950/25 border border-emerald-800/40 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider font-mono">
                3D Play & Map Simulator
              </h3>
            </div>
            <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900 font-bold px-2 py-0.5 rounded-md font-mono uppercase">
              Ready
            </span>
          </div>
          <p className="text-xs text-zinc-350 leading-relaxed font-sans">
            Meticulously processed. Tour the course in first-person 3D view, dynamic golf hazard editors and animated ball tracer simulations!
          </p>
          <button
            onClick={() => setShowSimulator(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Compass className="w-4 h-4" />
            Launch 3D Hole Simulator
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-250 uppercase tracking-wider font-mono">
              Course Layout Analyzer
            </h3>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Scan an architectural style layout map or custom separate aerial photograph to extract green colors (lightest = fairway), sand traps & hazard lines.
          </p>

          <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-xl p-4 cursor-pointer group transition-all">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleUploadLayoutMap}
              className="hidden" 
              disabled={analyzingLayout}
            />
            {analyzingLayout ? (
              <div className="flex flex-col items-center gap-2 text-center py-2">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <span className="text-xs font-bold text-emerald-400 animate-pulse">Scanning Layout Topography...</span>
                <span className="text-[10px] text-zinc-500 max-w-xs leading-normal">
                  Analyzing contour color outlines, mapping coordinate vectors, sand bunkers, putting flags and distance yardages...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center py-1">
                <Upload className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                <span className="text-xs font-semibold text-zinc-350 font-mono">Upload Separate Aerial Map</span>
                <span className="text-[10px] text-zinc-550 block">JPEG, PNG, or camera snap</span>
              </div>
            )}
          </label>

          {layoutAnalysisError && (
            <div className="text-[10px] bg-red-950/40 border border-red-900/40 text-red-400 p-2.5 rounded-lg font-mono">
              ⚠️ {layoutAnalysisError}
            </div>
          )}
        </div>
      )}

      {course.aerialImageUrl && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
          <h3 className="px-4 py-3 bg-zinc-950/50 border-b border-zinc-800 text-xs font-bold uppercase tracking-widest text-emerald-400 flex justify-between items-center">
            <span>Course Aerial View</span>
            <Map className="w-4 h-4" />
          </h3>
          <div className="relative aspect-video w-full bg-black overflow-hidden">
            <img
              src={course.aerialImageUrl}
              alt={`${course.name} Aerial Satellite View`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {course.cityOrGeography && (
              <div className="absolute bottom-2 left-2 bg-black/70 border border-zinc-850 rounded px-2 py-1 text-[10px] text-zinc-350">
                📍 {course.cityOrGeography}
              </div>
            )}
          </div>
        </div>
      )}

      {(course.cityOrGeography || course.logoDescription || (course.visualFeatures && course.visualFeatures.length > 0)) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-md">
          <h3 className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-800 pb-2">
            Course Landscape & Brand Identity
          </h3>
          {course.cityOrGeography && (
            <div className="flex gap-2 text-xs">
              <span className="text-zinc-500 font-medium shrink-0">Location:</span>
              <span className="text-zinc-200">{course.cityOrGeography}</span>
            </div>
          )}
          {course.logoDescription && (
            <div className="flex gap-2 text-xs">
              <span className="text-zinc-500 font-medium shrink-0">Logo Design:</span>
              <span className="text-zinc-300 italic">{course.logoDescription}</span>
            </div>
          )}
          {course.visualFeatures && course.visualFeatures.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider block">Visual Landmarks</span>
              <div className="flex flex-wrap gap-1.5">
                {course.visualFeatures.map((feat: string, i: number) => (
                  <span key={i} className="text-[10px] font-medium bg-zinc-950 border border-zinc-800 text-emerald-400 px-2 py-0.5 rounded-md">
                    🌴 {feat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <h3 className="px-4 py-3 bg-zinc-950/50 border-b border-zinc-800 text-xs font-bold uppercase tracking-widest text-zinc-500 flex justify-between items-center">
            <span>Scorecard Preview</span>
            <Map className="w-4 h-4" />
        </h3>
        <div className="overflow-x-auto max-h-[30vh]">
          <table className="w-full text-sm text-left text-zinc-400 sticky-header">
            <thead className="text-xs uppercase bg-zinc-950/80 text-zinc-500 border-b border-zinc-800 sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3">Hole</th>
                <th className="px-4 py-3 text-center">Par</th>
                <th className="px-4 py-3 text-center">Yardage</th>
                <th className="px-4 py-3 text-center">HCP</th>
              </tr>
            </thead>
            <tbody>
              {course.holes.map((hole: any, index: number) => (
                <tr key={index} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium text-zinc-200">
                     <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-white">
                        {hole.number}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-center text-white">{hole.par}</td>
                  <td className="px-4 py-3 text-center">{hole.yardage || '-'}</td>
                  <td className="px-4 py-3 text-center">{hole.handicap || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rounds.length > 0 && (
         <div className="space-y-3">
             <h3 className="text-zinc-500 font-semibold uppercase tracking-widest text-xs flex items-center gap-2">
                 <Calendar className="w-4 h-4" /> Previous Rounds
             </h3>
             <div className="grid gap-3">
                 {rounds.map(round => {
                    const score = Object.values(round.scores).reduce((a: any, b: any) => a + b, 0);
                    const toPar = (score as number) - totalPar;
                    return (
                        <button 
                          key={round.id} 
                          onClick={() => navigate(`/round/${round.id}`)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800 transition"
                        >
                            <div>
                                <div className="text-zinc-200 font-semibold">{new Date(round.timestamp).toLocaleDateString()}</div>
                                <div className="text-zinc-500 text-xs mt-1">{round.completed ? 'Completed' : 'In Progress'}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                {Number(score) > 0 && (
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-white">{score}</div>
                                        <div className="text-[10px] uppercase font-bold text-zinc-500">
                                            {toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar}
                                        </div>
                                    </div>
                                )}
                                <Trophy className={`w-5 h-5 ${round.completed ? 'text-blue-500' : 'text-zinc-600'}`} />
                            </div>
                        </button>
                    )
                 })}
             </div>
         </div>
      )}
    </div>
  );
}
