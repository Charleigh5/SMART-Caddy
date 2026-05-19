import React from 'react';
import { INITIAL_LEDGER, FeatureStatus } from '../lib/ledger';

const statusColors: Record<FeatureStatus, string> = {
  NOT_STARTED: 'bg-zinc-800 text-zinc-400',
  IN_PROGRESS: 'bg-blue-900/50 text-blue-400',
  IMPLEMENTED_UNVERIFIED: 'bg-yellow-900/50 text-yellow-400',
  PARTIALLY_VERIFIED: 'bg-indigo-900/50 text-indigo-400',
  VERIFIED: 'bg-green-900/50 text-green-400',
  BLOCKED: 'bg-red-900/50 text-red-400',
  DEFERRED: 'bg-zinc-700 text-zinc-300',
  DEPRECATED: 'bg-orange-900/50 text-orange-400',
  ARCHIVED: 'bg-zinc-900 text-zinc-600',
  PENDING_REAL_DEVICE_QA: 'bg-amber-500/10 text-amber-500'
};

export function FeatureLedger() {
  return (
    <div className="space-y-6 container mx-auto p-4 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Feature Ledger</h1>
          <p className="text-zinc-400 mt-1">Project governance and feature tracking.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {INITIAL_LEDGER.map((feature) => (
          <div key={feature.featureId} className="border border-zinc-800 bg-zinc-900/50 rounded-lg p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-500 uppercase tracking-wider">Phase {feature.phase}</span>
                  <h3 className="font-semibold text-lg text-zinc-200">{feature.name}</h3>
                </div>
                <p className="text-zinc-400 text-sm mt-1">{feature.description}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[feature.status]}`}>
                {feature.status.replace('_', ' ')}
              </span>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <h4 className="text-zinc-500 uppercase text-xs font-semibold tracking-wider mb-2">Acceptance Criteria</h4>
                <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                  {feature.acceptanceCriteria.map((ac, i) => (
                    <li key={i}>{ac}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-zinc-500 uppercase text-xs font-semibold tracking-wider mb-2">Verification</h4>
                <div className="space-y-2">
                  <p className="text-zinc-300"><span className="text-zinc-500">Method:</span> {feature.verificationMethod}</p>
                  <p className="text-zinc-300"><span className="text-zinc-500">Result:</span> {feature.verificationResult}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
