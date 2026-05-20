import React, { useState, useEffect } from 'react';
import { INITIAL_QA_MATRIX, QaGate, GateStatus } from '../../lib/manualQaMatrix';
import { generateReceipt, receiptToMarkdown, QaReceiptMetadata } from '../../lib/manualQaReceipt';
import { Settings, ClipboardCheck, Clipboard, Download, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, AlertCircle, CircleDashed } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ManualQARunner() {
  const [gates, setGates] = useState<QaGate[]>(INITIAL_QA_MATRIX);
  const [metadata, setMetadata] = useState<Partial<QaReceiptMetadata>>({
    tester: '',
    device: 'Desktop',
    browser: 'Chrome',
    os: 'macOS',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
    microphoneAvailable: false,
    cameraAvailable: false,
    providerConfigState: 'Unknown'
  });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Populate auto-detectable metadata
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const audio = devices.some(d => d.kind === 'audioinput');
      const video = devices.some(d => d.kind === 'videoinput');
      setMetadata(prev => ({...prev, microphoneAvailable: audio, cameraAvailable: video}));
    }).catch(() => {});
    
    fetch('/api/provider-status').then(res => res.json()).then(data => {
      setMetadata(prev => ({...prev, providerConfigState: data.geminiAvailable ? 'Configured' : 'Missing'}));
    }).catch(() => {});

    const updateViewport = () => setMetadata(prev => ({...prev, viewport: `${window.innerWidth}x${window.innerHeight}`}));
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const updateGateInfo = (id: string, updates: Partial<QaGate>) => {
    setGates(gates.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const copyJson = () => {
    const r = generateReceipt({
      qaRunId: `QA-${Date.now()}`,
      createdAt: new Date().toISOString(),
      tester: metadata.tester || 'Anonymous',
      device: metadata.device || 'Unknown',
      browser: metadata.browser || 'Unknown',
      os: metadata.os || 'Unknown',
      viewport: metadata.viewport || 'Unknown',
      microphoneAvailable: !!metadata.microphoneAvailable,
      cameraAvailable: !!metadata.cameraAvailable,
      providerConfigState: metadata.providerConfigState || 'Unknown'
    }, gates);
    navigator.clipboard.writeText(JSON.stringify(r, null, 2));
    alert('JSON Receipt Copied. Paste back to agent.');
  };

  const copyMarkdown = () => {
    const r = generateReceipt({
      qaRunId: `QA-${Date.now()}`,
      createdAt: new Date().toISOString(),
      tester: metadata.tester || 'Anonymous',
      device: metadata.device || 'Unknown',
      browser: metadata.browser || 'Unknown',
      os: metadata.os || 'Unknown',
      viewport: metadata.viewport || 'Unknown',
      microphoneAvailable: !!metadata.microphoneAvailable,
      cameraAvailable: !!metadata.cameraAvailable,
      providerConfigState: metadata.providerConfigState || 'Unknown'
    }, gates);
    navigator.clipboard.writeText(receiptToMarkdown(r));
    alert('Markdown Receipt Copied. Paste back to agent.');
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({...prev, [category]: !prev[category]}));
  };

  const categories = Array.from(new Set(gates.map(g => g.category))) as string[];
  
  const statusColors: Record<GateStatus, string> = {
    PASS: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    PARTIAL: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    FAIL: 'bg-red-500/10 text-red-500 border-red-500/20',
    BLOCKED: 'bg-red-900/40 text-red-400 border-red-900/50',
    NOT_TESTED: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    PENDING_REAL_DEVICE_QA: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    NOT_APPLICABLE: 'bg-zinc-800 text-zinc-500 border-zinc-700'
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-h-[800px] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0">
        <h3 className="font-bold text-zinc-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-zinc-400" />
          Manual QA Runner
        </h3>
        <div className="flex gap-2">
          <button onClick={copyMarkdown} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-md transition border border-zinc-700">
            <Clipboard className="w-3.5 h-3.5" /> MD
          </button>
          <button onClick={copyJson} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-md transition border border-zinc-700">
            <ClipboardCheck className="w-3.5 h-3.5" /> JSON
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 space-y-4">
          <h4 className="text-sm font-semibold text-zinc-300">Tester Metadata</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Tester ID</span>
              <input type="text" value={metadata.tester} onChange={e => setMetadata({...metadata, tester: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" placeholder="e.g. John Doe" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Device</span>
              <input type="text" value={metadata.device} onChange={e => setMetadata({...metadata, device: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" placeholder="e.g. iPhone 14" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Browser</span>
              <input type="text" value={metadata.browser} onChange={e => setMetadata({...metadata, browser: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" placeholder="e.g. Safari" />
            </label>
             <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">OS</span>
              <input type="text" value={metadata.os} onChange={e => setMetadata({...metadata, os: e.target.value})} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200" placeholder="e.g. iOS 16" />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-zinc-400">Viewport: <strong className="text-zinc-200">{metadata.viewport}</strong></span>
            <span className="text-zinc-400">Mic: <strong className={metadata.microphoneAvailable ? "text-emerald-400" : "text-red-400"}>{metadata.microphoneAvailable ? 'Found' : 'Missing'}</strong></span>
            <span className="text-zinc-400">Cam: <strong className={metadata.cameraAvailable ? "text-emerald-400" : "text-red-400"}>{metadata.cameraAvailable ? 'Found' : 'Missing'}</strong></span>
            <span className="text-zinc-400">Provider: <strong className="text-zinc-200">{metadata.providerConfigState}</strong></span>
          </div>
        </div>

        <div className="p-4 bg-yellow-500/10 text-yellow-500/80 text-[11px] uppercase tracking-wider font-bold text-center border-b border-yellow-500/20">
          This runner does NOT automatically update feature ledger status. You MUST export the receipt and paste it back into the conversation room.
        </div>

        <div className="p-4 space-y-4">
          {categories.map(cat => {
            const catGates = gates.filter(g => g.category === cat);
            const isExpanded = expandedCategories[cat] !== false; // default true
            
            return (
              <div key={cat} className="border border-zinc-800 rounded-lg overflow-hidden">
                <button 
                  onClick={() => toggleCategory(cat)}
                  className="w-full bg-zinc-800/50 p-3 flex justify-between items-center hover:bg-zinc-800 transition"
                >
                  <span className="font-semibold text-sm text-zinc-200 relative">
                    {cat}
                    <span className="ml-2 text-[10px] bg-zinc-700/50 px-1.5 py-0.5 rounded text-zinc-400">{catGates.length} items</span>
                  </span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                </button>
                {isExpanded && (
                  <div className="divide-y divide-zinc-800 border-t border-zinc-800">
                    {catGates.map(gate => (
                      <div key={gate.id} className="p-4 bg-zinc-900/30">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <h5 className="font-bold text-sm text-zinc-200 flex items-center gap-2">
                              {gate.name}
                              <span className="text-[9px] uppercase tracking-widest text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">{gate.id}</span>
                            </h5>
                            <p className="text-xs text-zinc-400">{gate.requiredProof}</p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-1">Feat: {gate.featureId} | Cmp: {gate.relatedComponent}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-4">
                          <div className="shrink-0 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Status</span>
                            <div className="flex flex-wrap gap-1">
                              {(['PASS', 'PARTIAL', 'FAIL', 'NOT_TESTED', 'BLOCKED', 'NOT_APPLICABLE', 'PENDING_REAL_DEVICE_QA'] as GateStatus[]).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateGateInfo(gate.id, { testerStatus: s })}
                                  className={cn(
                                    "px-2 py-1 text-[10px] font-bold rounded border uppercase tracking-wider transition-colors",
                                    gate.testerStatus === s ? statusColors[s] : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600"
                                  )}
                                >
                                  {s.replace(/_/g, ' ')}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Notes / Evidence</span>
                            <textarea 
                              placeholder={gate.testerStatus === 'FAIL' ? gate.nextRequiredFixIfFailed : "Add observations or evidence context..."}
                              value={gate.notes || ''}
                              onChange={e => updateGateInfo(gate.id, { notes: e.target.value })}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300 min-h-[60px]"
                            />
                            
                            {gate.screenshotRequired && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 pt-2 border-t border-zinc-800/50">
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 text-xs">
                                  <input 
                                    type="checkbox" 
                                    checked={gate.screenshotProvided || false} 
                                    onChange={e => updateGateInfo(gate.id, { screenshotProvided: e.target.checked })}
                                    className="rounded bg-zinc-950 border border-zinc-800 text-yellow-500 focus:ring-0"
                                  />
                                  <span>Screenshot Provided</span>
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[9px] uppercase font-bold text-zinc-500">Proof Artifact Ref</span>
                                  <input 
                                    type="text" 
                                    value={gate.proofArtifactRef || ''} 
                                    onChange={e => updateGateInfo(gate.id, { proofArtifactRef: e.target.value })}
                                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300"
                                    placeholder="e.g. scorecard_caps.png"
                                  />
                                </label>
                              </div>
                            )}

                            {gate.testerStatus === 'BLOCKED' && (
                              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-zinc-800/50">
                                <span className="text-[9px] uppercase font-bold text-zinc-500">Blocker Reason</span>
                                <input 
                                  type="text" 
                                  value={gate.blockerReason || ''} 
                                  onChange={e => updateGateInfo(gate.id, { blockerReason: e.target.value })}
                                  className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300"
                                  placeholder="Describe the blocker reason..."
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
