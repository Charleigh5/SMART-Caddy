import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, createRound, getRoundsByCourse } from '../lib/storage';
import { ArrowLeft, Map, Play, Calendar, Trophy } from 'lucide-react';

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

  if (!course) {
    return <div className="p-8 text-center text-zinc-500">Loading...</div>;
  }

  const totalPar = course.holes.reduce((sum: number, h: any) => sum + (h.par || 0), 0);
  const totalYardage = course.holes.reduce((sum: number, h: any) => sum + (h.yardage || 0), 0);

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
