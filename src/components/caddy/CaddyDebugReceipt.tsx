import React from 'react';
import { CaddyAdviceReceipt } from '../../caddy/runtime/caddyTypes';

interface Props {
  receipt: CaddyAdviceReceipt;
}

export function CaddyDebugReceipt({ receipt }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 mt-2 overflow-auto max-h-48">
      <div className="flex justify-between items-center border-b border-zinc-700 pb-2 mb-2">
        <span className="font-bold text-emerald-400">Receipt: {receipt.id}</span>
        <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest ${
          receipt.status === 'SUCCESS' ? 'bg-emerald-900 text-emerald-400' :
          receipt.status === 'DEGRADED' ? 'bg-yellow-900 text-yellow-400' :
          'bg-red-900 text-red-400'
        }`}>{receipt.source} - {receipt.status}</span>
      </div>
      
      <div className="space-y-1">
        <p><span className="text-zinc-500">Timestamp:</span> {receipt.timestamp}</p>
        <p><span className="text-zinc-500">Risk Level:</span> {receipt.advice.riskLevel}</p>
        <p><span className="text-zinc-500">Confidence:</span> {receipt.advice.confidence}</p>
        <p className="mt-2 text-zinc-400">{receipt.advice.situation}</p>
      </div>

      {receipt.advice.dataGaps.length > 0 && (
        <div className="mt-2 text-[10px]">
          <span className="text-red-400 font-bold uppercase tracking-widest">Data Gaps Identified:</span>
          <ul className="list-disc list-inside mt-1 text-red-300/80">
            {receipt.advice.dataGaps.map((gap, i) => <li key={i}>{gap}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
