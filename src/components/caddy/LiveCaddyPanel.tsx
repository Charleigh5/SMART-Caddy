import React, { useState } from 'react';
import { requestCaddyAdvice } from '../../caddy/runtime/caddyRuntime';
import { compileCaddyContext } from '../../caddy/runtime/caddyContextCompiler';
import { CaddyAdviceReceipt } from '../../caddy/runtime/caddyTypes';
import { CaddyDebugReceipt } from './CaddyDebugReceipt';

export function LiveCaddyPanel() {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<CaddyAdviceReceipt | null>(null);

  const testTrigger = async () => {
    setLoading(true);
    const context = compileCaddyContext(
      'profile-test',
      { id: 'round-test' },
      { number: 1, par: 4, yardage: 400, handicap: 10 },
      [], // no shots yet
      { temp: 75, wind: '5mph N' },
      [] // no confirmed club data
    );
    
    const res = await requestCaddyAdvice(context);
    setReceipt(res);
    setLoading(false);
  };

  return (
    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm tracking-widest uppercase text-emerald-500">Live Caddy Runtime</h3>
        <button 
          onClick={testTrigger}
          disabled={loading}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] tracking-widest uppercase disabled:opacity-50"
        >
          {loading ? 'Thinking...' : 'Simulate Request'}
        </button>
      </div>
      
      {receipt && <CaddyDebugReceipt receipt={receipt} />}
    </div>
  );
}
