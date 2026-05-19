import React from 'react';
import { EVIDENCE_LEDGER, EvidenceReceipt } from '../../lib/evidenceLedger';

export default function VerificationPanel() {
  return (
    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
      <h2 className="text-emerald-400 font-bold uppercase tracking-widest text-sm">Verification Panel</h2>
      {EVIDENCE_LEDGER.length === 0 ? (
        <p className="text-zinc-500 text-sm">No evidence receipts yet.</p>
      ) : (
        <div className="space-y-4">
          {EVIDENCE_LEDGER.map((receipt) => (
            <div key={receipt.featureId} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-zinc-200 font-semibold">{receipt.featureId} <span className="text-zinc-500 text-xs ml-2">Phase {receipt.phase}</span></h3>
                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 font-bold uppercase tracking-widest">{receipt.status}</span>
              </div>
              
              {receipt.evidence.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Evidence:</span>
                  <ul className="list-disc list-inside text-zinc-300 text-sm mt-1">
                    {receipt.evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                  </ul>
                </div>
              )}

              {receipt.blockers.length > 0 && (
                <div className="mb-2">
                  <span className="text-[10px] text-red-500 uppercase tracking-widest font-bold">Blockers:</span>
                  <ul className="list-disc list-inside text-red-400 text-sm mt-1">
                    {receipt.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              {receipt.nextQaTask && (
                <div className="mt-2 text-xs">
                  <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Next QA Task:</span>
                  <p className="text-blue-300 mt-0.5">{receipt.nextQaTask}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
