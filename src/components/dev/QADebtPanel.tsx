import React from 'react';
import { EVIDENCE_LEDGER } from '../../lib/evidenceLedger';
import { AlertTriangle, Clock } from 'lucide-react';

export function QADebtPanel() {
  const pendingItems = EVIDENCE_LEDGER.filter(
    (item) => item.status === 'PENDING_REAL_DEVICE_QA' || item.status === 'PARTIALLY_VERIFIED'
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-h-96 flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 shrink-0">
        <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          QA Debt Register
        </h3>
        <span className="text-xs font-semibold px-2 py-1 bg-zinc-800 text-zinc-400 rounded-full">
          {pendingItems.length} Pending
        </span>
      </div>
      <div className="overflow-y-auto p-4 space-y-4">
        {pendingItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No QA debt recorded. All manual checks have evidence.</p>
        ) : (
          pendingItems.map((item) => (
            <div key={item.featureId} className="space-y-2 pb-4 border-b border-zinc-800/50 last:border-0 last:pb-0">
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-zinc-200">{item.featureId}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
                  {item.status}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 space-y-1.5">
                <p><strong>Next Required Proof:</strong> {item.nextQaTask || 'Awaiting native device execution.'}</p>
                {item.blockers && item.blockers.length > 0 && (
                  <p className="text-red-400"><strong>Blocked Gates:</strong> {item.blockers.join(', ')}</p>
                )}
                {item.evidence && item.evidence.filter(e => !e.includes('PENDING')).length > 0 && (
                  <p className="text-emerald-400/80 line-clamp-1 truncate w-full" title={item.evidence.filter(e => !e.includes('PENDING')).pop()}>
                    <strong>Last Auto Result:</strong> {item.evidence.filter(e => !e.includes('PENDING')).pop()}
                  </p>
                )}
                {item.evidence && item.evidence.filter(e => e.includes('PENDING')).length > 0 && (
                  <div className="mt-2 space-y-1 bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                    <strong className="text-zinc-500 uppercase tracking-widest text-[9px]">Pending Manual Gates:</strong>
                    <ul className="list-disc pl-3 space-y-1 mt-1">
                      {item.evidence.filter(e => e.includes('PENDING')).map((e, idx) => (
                        <li key={idx} className="text-[10px] text-amber-500/70">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
