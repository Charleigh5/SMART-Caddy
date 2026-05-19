import React from 'react';
import { Video, Mic, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 container mx-auto p-4 max-w-md pt-12">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-white">AI Golf Caddy</h1>
        <p className="text-zinc-400">Your real-time swing coach and caddy.</p>
      </div>

      <div className="pt-8 space-y-4">
        <button 
          onClick={() => navigate('/permissions')}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-white font-medium"
        >
          <span className="flex items-center gap-3">
            <Video className="w-5 h-5" /> Let's Start (Setup Camera)
          </span>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/scorecards')}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors gap-2 text-zinc-300"
          >
            <MapPin className="w-5 h-5 text-green-400" />
            <span className="text-sm">Scorecards</span>
          </button>
          
          <button 
            onClick={() => navigate('/caddy')}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors gap-2 text-zinc-300"
          >
            <Mic className="w-5 h-5 text-purple-400" />
            <span className="text-sm">Ask Caddy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
