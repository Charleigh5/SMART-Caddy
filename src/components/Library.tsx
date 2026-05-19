import React, { useEffect, useState } from 'react';
import { getSwingVideos, deleteSwingVideo } from '../lib/storage';
import { Activity, Play, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface SwingRecord {
  id: string;
  blob: Blob;
  timestamp: number;
  viewAngle: string;
  analyzed: boolean;
  url?: string;
}

export function Library() {
  const [swings, setSwings] = useState<SwingRecord[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadSwings();
  }, []);

  const loadSwings = async () => {
    const records = await getSwingVideos();
    // create object urls
    const processed = records.map(r => ({ ...r, url: URL.createObjectURL(r.blob) }));
    // sort by newest
    processed.sort((a, b) => b.timestamp - a.timestamp);
    setSwings(processed);
  };

  const handleDelete = async (id: string, url?: string) => {
    await deleteSwingVideo(id);
    if (url) URL.revokeObjectURL(url);
    await loadSwings();
  };

  return (
    <div className="space-y-6 container mx-auto p-4 max-w-5xl pt-12 pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Swing Library</h1>
        <p className="text-zinc-400 mt-1">Review saved swings and AI analysis.</p>
      </div>

      {swings.length === 0 ? (
        <div className="border border-zinc-800 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-zinc-500">
           <Activity className="w-12 h-12 mb-4 opacity-50" />
           <p>No swings recorded yet.</p>
           <button 
             onClick={() => navigate('/permissions')}
             className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm hover:bg-zinc-700 transition"
           >
             Record a Swing
           </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {swings.map(swing => (
            <div key={swing.id} className="border border-zinc-800 bg-zinc-900/50 rounded-xl overflow-hidden flex flex-col group cursor-pointer" onClick={() => navigate(`/review/${swing.id}`)}>
              <div className="relative aspect-[3/4] bg-black">
                <video src={swing.url} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white">
                    <Play className="w-6 h-6 ml-1" />
                  </button>
                </div>
                <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[10px] font-mono text-zinc-300">
                  {swing.viewAngle}
                </div>
              </div>
              <div className="p-3 flex justify-between items-center bg-zinc-900">
                <div>
                  <div className="text-xs text-zinc-400">
                    {new Date(swing.timestamp).toLocaleDateString()}
                  </div>
                  <div className="text-[10px] text-yellow-500 mt-1 uppercase tracking-wider font-semibold">
                    {swing.analyzed ? 'Analyzed' : 'Not Analyzed'}
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(swing.id, swing.url);
                  }}
                  className="p-2 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
