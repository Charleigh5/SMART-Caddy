import React, { useState } from 'react';
import { ArrowLeft, Trash2, Download, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearDatabase, exportDatabase } from '../lib/storage';

export function Settings() {
  const navigate = useNavigate();
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `golf-caddy-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to export data');
    }
    setExporting(false);
  };

  const handleClear = async () => {
    if (clearing) return;
    if (window.confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      setClearing(true);
      try {
        await clearDatabase();
        alert('All local data cleared successfully.');
        navigate('/');
      } catch (e) {
        console.error(e);
        alert('Failed to clear data');
      }
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-zinc-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-400 hover:text-white transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black tracking-tight">Settings & Privacy</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 mt-4">
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 text-blue-400 mb-2">
            <Shield className="w-5 h-5" />
            <h2 className="font-bold text-lg text-white">Privacy Context</h2>
          </div>
          <p className="text-sm text-zinc-400">
            All your swing videos, rounds, shots, and analyses are stored locally on your device via IndexedDB. 
            When you request AI analysis or Caddy advice, only the necessary context representation is sent 
            securely to the backend. Video data is processed temporarily in memory on the server for analysis 
            and not persisted.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-lg text-white mb-2">Data Management</h2>
          
          <button 
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition disabled:opacity-50"
          >
            <div className="flex items-center gap-3 text-zinc-300">
              <Download className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Export Data</div>
                <div className="text-xs text-zinc-500 mt-0.5">Download your history as JSON</div>
              </div>
            </div>
            {exporting && <div className="text-xs text-zinc-500">Exporting...</div>}
          </button>

          <button 
            onClick={handleClear}
            disabled={clearing}
            className="w-full flex items-center justify-between p-4 bg-red-950/20 border border-red-900/50 rounded-xl hover:bg-red-900/30 transition disabled:opacity-50"
          >
            <div className="flex items-center gap-3 text-red-500">
              <Trash2 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Delete All Data</div>
                <div className="text-xs text-red-500/70 mt-0.5">Clear local storage and videos</div>
              </div>
            </div>
            {clearing && <div className="text-xs text-red-500/70">Deleting...</div>}
          </button>
        </div>

      </div>
    </div>
  );
}
