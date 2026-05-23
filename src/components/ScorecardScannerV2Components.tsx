import React, { useState, useEffect } from "react";
import { 
  ScorecardExtractionV2, 
  CourseIdentityCandidate, 
  HoleAtlasSeed, 
  MediaSourceRecord, 
  TotalsValidationResult, 
  validateScorecardTotals,
  compileStrategySummary,
  generateHoleAtlasSeeds,
  MediaLicenseType
} from "../lib/scorecardV2Schema";
import { 
  MapPin, 
  Award, 
  Compass, 
  Image as ImageIcon, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  Grid, 
  Zap, 
  FileText,
  User,
  Info,
  ChevronRight,
  TrendingUp,
  Sliders,
  Maximize2
} from "lucide-react";

// --- 1. COURSE IDENTITY CONFIRM CARD ---
interface CourseIdentityConfirmCardProps {
  candidate: CourseIdentityCandidate;
  onChange: (candidate: CourseIdentityCandidate) => void;
  onConfirmToggle: () => void;
}

export function CourseIdentityConfirmCard({ candidate, onChange, onConfirmToggle }: CourseIdentityConfirmCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4 transition-all hover:border-zinc-700">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-lg text-white">Course Identity Candidate</h3>
            <p className="text-xs text-zinc-500">Awaiting user identity confirmation for atlas seeding</p>
          </div>
        </div>
        <button
          onClick={onConfirmToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
            candidate.confirmed 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : "bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25"
          }`}
          id="identity-confirm-btn"
        >
          {candidate.confirmed ? "✓ Confirmed" : "Confirm Identity"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">Course Name</label>
          <input
            type="text"
            id="reviewer-course-name"
            value={candidate.courseName}
            onChange={(e) => onChange({ ...candidate, courseName: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700"
            placeholder="e.g. Twin Lakes Golf Course"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">City / Geography</label>
          <input
            type="text"
            value={candidate.cityOrGeography}
            onChange={(e) => onChange({ ...candidate, cityOrGeography: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700"
            placeholder="e.g. Santa Cruz, California"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">Logo Description</label>
          <input
            type="text"
            value={candidate.logoDescription}
            onChange={(e) => onChange({ ...candidate, logoDescription: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700"
            placeholder="e.g. Crest with two pine trees and white golf balls"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <div className="space-y-1">
            <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">USGA Course Rating</label>
            <input
              type="number"
              step="0.1"
              value={candidate.rating || ""}
              onChange={(e) => onChange({ ...candidate, rating: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700"
              placeholder="e.g. 71.4"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">Slope Rating</label>
            <input
              type="number"
              value={candidate.slope || ""}
              onChange={(e) => onChange({ ...candidate, slope: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700"
              placeholder="e.g. 124"
            />
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">Scenic AI Prompt Context</label>
          <textarea
            value={candidate.aestheticPrompt}
            onChange={(e) => onChange({ ...candidate, aestheticPrompt: e.target.value })}
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-zinc-700 resize-none font-sans"
            placeholder="Prompt for model layout..."
          />
        </div>
      </div>
    </div>
  );
}


// --- 2. TEE SELECTOR ---
interface TeeSelectorProps {
  currentTee: string;
  onSelectTee: (teeName: string) => void;
  totals: TotalsValidationResult;
}

export function TeeSelector({ currentTee, onSelectTee, totals }: TeeSelectorProps) {
  const standardTees = [
    { name: "Championship (Blue)", color: "bg-blue-600 border-blue-400" },
    { name: "Resort (White)", color: "bg-white border-zinc-300 text-zinc-900" },
    { name: "Forward (Red)", color: "bg-red-600 border-red-400" },
    { name: "Yellow", color: "bg-yellow-500 border-yellow-300 text-zinc-900" }
  ];

  return (
    <div className="space-y-3 bg-zinc-900/50 p-4 border border-zinc-850 rounded-xl">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-mono tracking-wider uppercase text-zinc-400">Select Active Tee Class</h4>
        <span className="text-xs font-mono bg-zinc-950 px-2 py-0.5 border border-zinc-850 rounded text-zinc-400">
          Total Distance: {totals.totalYardage} yds
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {standardTees.map((t) => {
          const isSelected = currentTee.toLowerCase().includes(t.name.split(" ")[0].toLowerCase());
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => onSelectTee(t.name)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isSelected 
                  ? "bg-zinc-800 border-zinc-600 ring-2 ring-indigo-500/20" 
                  : "bg-zinc-950/80 border-zinc-900 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full border ${t.color.split(" ")[0]} ${t.color.split(" ")[1]}`}></span>
                <span className="truncate">{t.name}</span>
              </div>
              {isSelected && <span className="text-xs font-bold text-indigo-400">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}


// --- 3. SCORECARD EXTRACTION TABLE ---
interface ScorecardExtractionTableProps {
  scorecard: ScorecardExtractionV2;
  onUpdateHoles: (holes: any[]) => void;
  highlightedRow?: number;
}

export function ScorecardExtractionTable({ scorecard, onUpdateHoles, highlightedRow }: ScorecardExtractionTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleCellChange = (index: number, field: string, val: any) => {
    const updatedHoles = [...scorecard.holes];
    const originalHole = updatedHoles[index];
    
    let parsedVal = val;
    if (field === "par" || field === "yardage" || field === "handicap") {
      parsedVal = val === "" ? "" : Number(val);
    }
    
    updatedHoles[index] = {
      ...originalHole,
      [field]: parsedVal
    };
    onUpdateHoles(updatedHoles);
  };

  const sums = validateScorecardTotals(scorecard.holes);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg" id="scorecard-extraction-table-comp">
      <div className="px-5 py-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Grid className="w-5 h-5 text-indigo-400" />
          <h3 className="font-sans font-semibold text-white text-sm">Hole Grid Extraction Editor</h3>
        </div>
        <span className="text-xs font-mono text-zinc-500">
          Editable OCR Fields
        </span>
      </div>

      <div className="w-full font-mono text-[11px] xs:text-xs sm:text-sm overflow-x-auto">
        <div className="min-w-[280px]">
          {/* Header Row using CSS Grid */}
          <div className="grid grid-cols-[2.2rem_3.2rem_4.5rem_1fr] md:grid-cols-[3.5rem_4.5rem_6.5rem_5.5rem_1fr] bg-zinc-950/85 border-b border-zinc-800/80 text-[9px] xs:text-[10px] tracking-wider uppercase text-zinc-500 py-3 px-3 sm:px-4 gap-2 items-center">
            <div className="font-bold">Hole</div>
            <div>Par</div>
            <div>
              <span className="hidden sm:inline">Yardage ({scorecard.teeSet})</span>
              <span className="sm:hidden">Yards</span>
            </div>
            <div>
              <span className="hidden sm:inline">Handicap Index</span>
              <span className="sm:hidden">Hcp</span>
            </div>
            <div className="hidden md:block">Layout/Desc</div>
          </div>

          {/* Matrix Rows using CSS Grid */}
          <div className="divide-y divide-zinc-850">
            {scorecard.holes.map((hole, index) => {
              const isHighlighted = highlightedRow === hole.number;
              return (
                <div
                  key={hole.number}
                  className={`grid grid-cols-[2.2rem_3.2rem_4.5rem_1fr] md:grid-cols-[3.5rem_4.5rem_6.5rem_5.5rem_1fr] items-center gap-2 py-2 px-3 sm:px-4 transition-colors hover:bg-zinc-800/50 ${
                    isHighlighted ? "bg-amber-500/10 hover:bg-amber-500/15" : ""
                  }`}
                >
                  <div className="font-bold text-zinc-300">
                    {hole.number}
                  </div>
                  <div>
                    <input
                      type="number"
                      min="3"
                      max="6"
                      value={hole.par}
                      id={`input-par-${hole.number}`}
                      onChange={(e) => handleCellChange(index, "par", e.target.value)}
                      className="w-10 sm:w-12 bg-zinc-950 border border-zinc-850 text-center py-1 rounded text-white text-[11px] xs:text-xs sm:text-sm focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={hole.yardage || ""}
                      onChange={(e) => handleCellChange(index, "yardage", e.target.value)}
                      className="w-14 sm:w-20 bg-zinc-950 border border-zinc-850 px-1.5 sm:px-2 py-1 rounded text-white text-[11px] xs:text-xs sm:text-sm focus:outline-none focus:border-zinc-700"
                      placeholder="e.g. 390"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      max="18"
                      value={hole.handicap || ""}
                      onChange={(e) => handleCellChange(index, "handicap", e.target.value)}
                      className="w-12 sm:w-16 bg-zinc-950 border border-zinc-850 text-center py-1 rounded text-white text-[11px] xs:text-xs sm:text-sm focus:outline-none focus:border-zinc-700"
                      placeholder="e.g. 7"
                    />
                  </div>
                  <div className="hidden md:block">
                    <input
                      type="text"
                      value={hole.layoutDescription || ""}
                      onChange={(e) => handleCellChange(index, "layoutDescription", e.target.value)}
                      className="w-full max-w-sm bg-zinc-950 border border-zinc-850 px-2 py-1 rounded text-zinc-300 text-xs focus:outline-none focus:border-zinc-700"
                      placeholder="Flat lies, tree lined"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Section using precise CSS Grid matching */}
          <div className="border-t-2 border-zinc-800 font-mono text-zinc-400 text-[10px] sm:text-xs">
            {/* Front Nine Row */}
            <div className="grid grid-cols-[2.2rem_3.2rem_4.5rem_1fr] md:grid-cols-[3.5rem_4.5rem_6.5rem_5.5rem_1fr] items-center gap-2 py-3 px-3 sm:px-4 bg-zinc-955/90">
              <div className="font-bold text-white text-[10px] sm:text-xs truncate">OUT (1-9)</div>
              <div className="text-white font-bold">{sums.frontNinePar}</div>
              <div className="text-white font-bold truncate">{sums.frontNineYardage} yds</div>
              <div className="col-span-1 md:col-span-2"></div>
            </div>
            {/* Back Nine Row */}
            <div className="grid grid-cols-[2.2rem_3.2rem_4.5rem_1fr] md:grid-cols-[3.5rem_4.5rem_6.5rem_5.5rem_1fr] items-center gap-2 py-3 px-3 sm:px-4 bg-zinc-955/90 border-t border-zinc-850">
              <div className="font-bold text-white text-[10px] sm:text-xs truncate">IN (10-18)</div>
              <div className="text-white font-bold">{sums.backNinePar}</div>
              <div className="text-white font-bold truncate">{sums.backNineYardage} yds</div>
              <div className="col-span-1 md:col-span-2"></div>
            </div>
            {/* Total Row */}
            <div className="grid grid-cols-[2.2rem_3.2rem_4.5rem_1fr] md:grid-cols-[3.5rem_4.5rem_6.5rem_5.5rem_1fr] items-center gap-2 py-4 px-3 sm:px-4 bg-zinc-950/95 border-t-2 border-zinc-800 text-[11px] sm:text-xs">
              <div className="font-bold text-indigo-400 truncate">TOTAL (18)</div>
              <div className="text-indigo-400 font-bold">{sums.totalPar}</div>
              <div className="text-indigo-400 font-bold truncate">{sums.totalYardage} yds</div>
              <div className="col-span-1 md:col-span-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- 4. SCORECARD UNCERTAINTY PANEL ---
interface ScorecardUncertaintyPanelProps {
  scorecard: ScorecardExtractionV2;
  onSelectHoleWarning: (holeNum: number) => void;
}

export function ScorecardUncertaintyPanel({ scorecard, onSelectHoleWarning }: ScorecardUncertaintyPanelProps) {
  const sums = validateScorecardTotals(scorecard.holes);

  // Filter lists
  const missingHcp = scorecard.holes.filter(h => h.handicap === undefined);
  const missingYds = scorecard.holes.filter(h => h.yardage === undefined);
  const hcpConflicts = scorecard.holes
    .map(h => h.handicap)
    .filter((hcp): hcp is number => hcp !== undefined);
  
  // Find duplicate handicaps
  const findDuplicates = (arr: number[]) => {
    return arr.filter((item, index) => arr.indexOf(item) !== index);
  };
  const duplicateHcps = findDuplicates(hcpConflicts);

  const hasIssues = missingHcp.length > 0 || missingYds.length > 0 || !sums.isValid || duplicateHcps.length > 0 || scorecard.uncertainFields.length > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md space-y-4" id="scorecard-uncertainty-panel">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center space-x-2">
          <AlertTriangle className={`w-5 h-5 ${hasIssues ? "text-amber-400 animate-pulse" : "text-zinc-500"}`} />
          <h3 className="font-sans font-semibold text-white text-sm">Parser Confidence Checker</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono uppercase text-zinc-500">Confidence Scale:</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
            scorecard.confidenceScore >= 80 
              ? "bg-emerald-500/10 text-emerald-400" 
              : scorecard.confidenceScore >= 50 
              ? "bg-amber-500/10 text-amber-300" 
              : "bg-red-500/10 text-red-400 animate-pulse"
          }`}>
            {scorecard.confidenceScore}%
          </span>
        </div>
      </div>

      {!hasIssues ? (
        <div className="flex items-center space-x-3 bg-emerald-500/10 text-emerald-400 px-4 py-3 border border-emerald-500/20 rounded-xl text-xs">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p>Fantastic! The parsed dataset contains complete par and score columns with zero semantic anomalies.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-zinc-400">
            Below are low-confidence scorecard properties flagged by the AI. Click any alert to highlight and edit its matrix value.
          </p>

          <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-1">
            {/* missing ratings */}
            {(!scorecard.rating || !scorecard.slope) && (
              <div className="flex items-center justify-between bg-zinc-950/90 border border-zinc-850 px-3 py-2 rounded-xl text-xs">
                <div className="flex items-center space-x-2 text-zinc-300">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Missing course ratings or slope multiplier fields</span>
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded uppercase">Fill rating</span>
              </div>
            )}

            {/* Sum checks */}
            {!sums.isValid && sums.warnings.map((w, idx) => (
              <div key={idx} className="flex items-center space-x-2 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-xl text-xs text-red-300">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{w}</span>
              </div>
            ))}

            {/* missing yardages */}
            {missingYds.map(h => (
              <button
                key={`yds-${h.number}`}
                onClick={() => onSelectHoleWarning(h.number)}
                className="flex items-center justify-between bg-zinc-950/90 border border-zinc-850 hover:border-zinc-700 px-3 py-1.5 rounded-xl text-xs text-left cursor-pointer"
              >
                <div className="flex items-center space-x-2 text-zinc-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Hole {h.number}: Yardage was not confirmed during OCR translation</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Row {h.number}</span>
              </button>
            ))}

            {/* duplicate handicaps */}
            {duplicateHcps.length > 0 && (
              <div className="flex items-center space-x-2 bg-zinc-950/90 border border-zinc-850 px-3 py-2 rounded-xl text-xs text-zinc-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Duplicate Handicap index detected: {duplicateHcps.join(", ")} is listed multiple times</span>
              </div>
            )}

            {/* other raw strings */}
            {scorecard.uncertainFields.map((uf, idx) => (
              <div key={idx} className="flex items-center space-x-2 bg-zinc-950/90 border border-zinc-850 px-3 py-1.5 rounded-xl text-xs text-zinc-400">
                <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>{uf}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// --- 5. SCORECARD STRATEGY SUMMARY PANEL ---
interface ScorecardStrategySummaryPanelProps {
  scorecard: ScorecardExtractionV2;
}

export function ScorecardStrategySummaryPanel({ scorecard }: ScorecardStrategySummaryPanelProps) {
  const strategy = compileStrategySummary(scorecard.holes);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md space-y-5" id="scorecard-strategy-panel">
      <div className="flex items-center space-x-2.5 border-b border-zinc-850 pb-3">
        <TrendingUp className="w-5 h-5 text-emerald-400" />
        <h3 className="font-sans font-semibold text-white text-sm">Strategic Scorecard Analytics</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-zinc-950/50 p-3 border border-zinc-850 rounded-xl space-y-1">
            <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500 hover:text-white">Outward vs Inward Balance</span>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {strategy.frontBackBalance.description}
            </p>
            <div className="flex items-center space-x-4 pt-1.5 text-[10px] font-mono text-zinc-500">
              <span>Front: {strategy.frontBackBalance.frontNineYardage} yds (Par {strategy.frontBackBalance.frontNinePar})</span>
              <span>Back: {strategy.frontBackBalance.backNineYardage} yds (Par {strategy.frontBackBalance.backNinePar})</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">Demanding Holes (Lowest Handicap Columns)</span>
            <div className="grid grid-cols-2 gap-2">
              {strategy.demandingHoles.length === 0 ? (
                <div className="col-span-2 text-xs text-zinc-500 py-1 font-mono">No handicap ratings entered yet</div>
              ) : (
                strategy.demandingHoles.map(h => (
                  <div key={h.number} className="bg-zinc-950 px-2.5 py-1.5 border border-zinc-850 rounded-lg flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300 font-bold">Hole {h.number}</span>
                    <span className="bg-amber-500/10 text-amber-300 px-1 py-0.2 rounded text-[10px]">HCP {h.handicap}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Opportunities summary */}
          <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-850 pb-1.5 text-[10px] uppercase">
              <span>Layout Character</span>
              <span>Holes Count</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                <span>Longest Launch (Par-5s)</span>
              </span>
              <span className="font-bold text-white">{strategy.par5Opportunities.length} opportunities</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
                <span>Elevation Pin Drops (Par-3s)</span>
              </span>
              <span className="font-bold text-white">{strategy.par3Opportunities.length} par 3s</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                <span>Longest Hole (Tee-to-Green)</span>
              </span>
              <span className="font-bold text-white">
                {strategy.longestHoles[0] ? `Hole ${strategy.longestHoles[0].number} (${strategy.longestHoles[0].yardage}y)` : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                <span>Shortest Hole (Approach focus)</span>
              </span>
              <span className="font-bold text-white">
                {strategy.shortestHoles[0] ? `Hole ${strategy.shortestHoles[0].number} (${strategy.shortestHoles[0].yardage}y)` : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- 6. HOLE ATLAS SEED GRID & CARDS ---
interface HoleAtlasSeedGridProps {
  scorecard: ScorecardExtractionV2;
  courseConfirmed: boolean;
  onGenerateSeeds: () => void;
  seeds: HoleAtlasSeed[];
}

export function HoleAtlasSeedGrid({ scorecard, courseConfirmed, onGenerateSeeds, seeds }: HoleAtlasSeedGridProps) {
  const [selectedHoleNum, setSelectedHoleNum] = useState<number | null>(null);

  const selectedSeed = seeds.find(s => s.holeNumber === selectedHoleNum);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-6" id="hole-atlas-seed-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
        <div>
          <h3 className="font-sans font-semibold text-white text-base">Hole-By-Hole Atlas Generator</h3>
          <p className="text-xs text-zinc-500">Produce local coordinate maps and tactical strategies for caddy loading</p>
        </div>

        <button
          onClick={onGenerateSeeds}
          disabled={!courseConfirmed}
          className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
            !courseConfirmed
              ? "bg-zinc-800 text-zinc-500 border border-zinc-850 cursor-not-allowed opacity-55"
              : "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/20 shadow-indigo-600/10 cursor-pointer"
          }`}
          id="build-atlas-btn"
        >
          {seeds.length > 0 ? "Rebuild 18-Hole Atlas Seeds" : "Build 18-Hole Course Atlas"}
        </button>
      </div>

      {!courseConfirmed && (
        <div className="flex items-center space-x-3 bg-amber-500/5 text-amber-300 border border-amber-500/10 p-4 rounded-2xl text-xs leading-relaxed">
          <Info className="w-5 h-5 text-amber-400 shrink-0" />
          <p>
            <strong>Confirmation Blocked:</strong> Visual security guidelines dictate that you must confirm the <strong>Course Identity Candidate</strong> fields above to unlock the 18-hole coordinate seed mapping pipeline.
          </p>
        </div>
      )}

      {seeds.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">18-Hole Atlas Grid</span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {seeds.map((seed) => {
                const isSelected = selectedHoleNum === seed.holeNumber;
                return (
                  <button
                    key={seed.holeNumber}
                    onClick={() => setSelectedHoleNum(seed.holeNumber)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border relative overflow-hidden transition-all text-left cursor-pointer ${
                      isSelected 
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20" 
                        : seed.isDemanding 
                        ? "bg-amber-500/5 border-amber-500/25 text-amber-200 hover:bg-amber-500/10"
                        : "bg-zinc-950/90 border-zinc-850 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-sm font-bold font-mono text-white">#{seed.holeNumber}</span>
                    <span className="text-[10px] font-mono text-zinc-400 mt-1">Par {seed.par}</span>
                    <span className="text-[9px] font-mono text-zinc-500 mt-0.5">{seed.yardage}y</span>

                    {seed.isDemanding && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full" title="Demanding hole index"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex flex-col justify-between">
            {selectedSeed ? (
              <HoleSeedCard seed={selectedSeed} />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 px-3 text-zinc-500 space-y-2 h-full">
                <Compass className="w-8 h-8 text-zinc-700 animate-pulse" />
                <p className="text-xs">Select any hole from the atlas grid to preview its schematic plots, coordinates, and caddy strategy tips.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- 7. INDIVIDUAL HOLE SEED CARD ---
interface HoleSeedCardProps {
  seed: HoleAtlasSeed;
}

export function HoleSeedCard({ seed }: HoleSeedCardProps) {
  const [isSimulated, setIsSimulated] = useState(false);

  useEffect(() => {
    setIsSimulated(false);
  }, [seed.holeNumber]);

  return (
    <div className="space-y-4 h-full flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold text-white font-mono">
              #{seed.holeNumber}
            </span>
            <span className="text-sm font-bold text-white font-sans">Hole Atlas Coordinates</span>
          </div>
          {seed.isDemanding && (
            <span className="bg-amber-500/10 text-amber-400 text-[9px] font-mono tracking-wide px-2 py-0.5 rounded-full uppercase font-bold">
              Demanding Hole (Hcp {seed.handicap})
            </span>
          )}
        </div>

        {/* 2D Schematic plotting canvas-like container */}
        <div className="h-44 bg-black border border-zinc-900 rounded-xl relative overflow-hidden flex items-center justify-center font-mono">
          {/* Subtle grid mesh */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-10">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="border border-zinc-700"></div>
            ))}
          </div>

          {/* Local Coordinates Vector plots */}
          <div className="absolute bottom-4 flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-400 flex items-center justify-center relative">
              <span className="absolute -bottom-4 text-[8px] text-zinc-500">Tee ([0,0])</span>
            </div>
          </div>

          {/* Trajectory dotted line */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none px-4">
            <path
              d={`M ${120} ${140} Q ${120 + (seed.localCoordinates.fairwayPoints[0]?.x || 0) * 0.5} ${100} ${120} ${40}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeDasharray={isSimulated ? "0" : "4,4"}
              className={`${isSimulated ? "animate-draw" : "opacity-60"}`}
            />
          </svg>

          {seed.localCoordinates.fairwayPoints.length > 0 && (
            <div 
              className="absolute text-[8px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded"
              style={{
                bottom: "75px",
                transform: `translateX(${seed.localCoordinates.fairwayPoints[0].x}px)`
              }}
            >
              Fairway: x:{seed.localCoordinates.fairwayPoints[0].x}
            </div>
          )}

          <div className="absolute top-5 flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-indigo-500 border border-indigo-400 shadow-md shadow-indigo-500/20 relative animate-pulse">
              <span className="absolute -top-4 text-[8px] text-zinc-400">Green (0, {seed.yardage}y)</span>
            </div>
          </div>

          <div className="absolute top-2 right-2 text-[9px] text-zinc-500 flex flex-col text-right">
            <span>2D Cartesian space</span>
            <span>Planar: {seed.schematicDistance} yds</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl text-xs space-y-1">
          <span className="text-[9px] font-mono text-indigo-400 uppercase font-semibold">Caddy Strategy Insight</span>
          <p className="text-zinc-300 text-xs leading-relaxed">{seed.strategyTip}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsSimulated(!isSimulated)}
        className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
        id="simulate-trajectory-btn"
      >
        {isSimulated ? "Reset Coordinate Path" : "Simulate Cartographic Trajectory"}
      </button>
    </div>
  );
}


// --- 8. SCORECARD VISUAL REGIONS PANEL ---
interface ScorecardVisualRegionsPanelProps {
  scorecard: ScorecardExtractionV2;
}

export function ScorecardVisualRegionsPanel({ scorecard }: ScorecardVisualRegionsPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regionDetails = scorecard.visualRegions;
  const logoRegion = regionDetails.find(r => r.type === "LOGO_ICON");
  const teeRegion = regionDetails.find(r => r.type === "TEE_BLOCKS");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4" id="scorecard-regions-panel">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
        <div className="flex items-center space-x-2">
          <ImageIcon className="w-5 h-5 text-indigo-400" />
          <h3 className="font-sans font-semibold text-white text-sm">Visual Regions Extraction Map</h3>
        </div>
        <span className="text-xs font-mono text-zinc-500">Segments Mapped: {regionDetails.length}</span>
      </div>

      {regionDetails.length === 0 ? (
        <p className="text-xs text-zinc-500 py-4 font-mono">No specific scorecard crop regions mapped under parser pipeline</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            The OCR parser segmented key coordinates. Standard geographic bounds map to the following regions:
          </p>

          <div className="grid grid-cols-2 gap-3">
            {regionDetails.map(reg => (
              <button
                key={reg.id}
                onClick={() => setSelectedRegion(reg.id)}
                className={`p-3 rounded-xl border flex flex-col justify-between text-left cursor-pointer transition-all ${
                  selectedRegion === reg.id 
                    ? "bg-indigo-500/10 border-indigo-500 text-white" 
                    : "bg-zinc-950/80 border-zinc-850 hover:border-zinc-700 text-zinc-300"
                }`}
              >
                <div>
                  <span className="text-[10px] font-mono tracking-wide uppercase bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    {reg.type}
                  </span>
                  <div className="mt-2 text-xs font-mono text-zinc-500">
                    x:{reg.bounds.x} y:{reg.bounds.y}
                  </div>
                  <div className="text-xs font-mono text-zinc-500">
                    {reg.bounds.width}×{reg.bounds.height} coords
                  </div>
                </div>

                {selectedRegion === reg.id && (
                  <span className="text-[9px] text-indigo-400 mt-2 font-bold uppercase tracking-wider">▲ Display active</span>
                )}
              </button>
            ))}
          </div>

          {selectedRegion && (
            <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl text-xs space-y-2 relative">
              <span className="text-[10px] font-mono text-zinc-500">Bounding Area Layout</span>
              <div className="w-full h-16 border border-zinc-850 border-dashed rounded flex items-center justify-center text-zinc-650 text-[11px] select-none text-zinc-500">
                Crop boundaries: xmin:{regionDetails.find(r => r.id === selectedRegion)?.bounds.x}, ymin:{regionDetails.find(r => r.id === selectedRegion)?.bounds.y}
              </div>
              <button
                onClick={() => setSelectedRegion(null)}
                className="absolute top-2 right-2 text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// --- 9. MEDIA SOURCE REGISTRY PANEL ---
interface MediaSourceRegistryPanelProps {
  scorecard: ScorecardExtractionV2;
}

export function MediaSourceRegistryPanel({ scorecard }: MediaSourceRegistryPanelProps) {
  // We represent static media source records honoring intellectual property constraints
  const [sources, setSources] = useState<MediaSourceRecord[]>([
    {
      id: "media-1",
      sourceUrl: "https://ais-dev-g35rwmi7uhasfskjz5kaiz-46558936289.us-east1.run.app/assets/scorecard-original-twinlakes.jpg",
      licenseType: "RECIRC_KEEPSAKE",
      attribution: "Twin Lakes Golf Course Official Scorecard - Commemorative Keepsake",
      isRestrictedForTraining: false
    },
    {
      id: "media-2",
      sourceUrl: "https://ais-dev-g35rwmi7uhasfskjz5kaiz-46558936289.us-east1.run.app/assets/logo-twinlakes-extract.png",
      licenseType: "RESTRICTED_MEDIA",
      attribution: "Corporate golf club logo assets. Strictly protected by trademark laws.",
      isRestrictedForTraining: true
    }
  ]);

  const handleLicenseChange = (id: string, license: MediaLicenseType) => {
    const isRestricted = license === "RESTRICTED_MEDIA";
    setSources(prev => prev.map(s => s.id === id ? { ...s, licenseType: license, isRestrictedForTraining: isRestricted } : s));
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md space-y-4" id="media-source-registry-panel">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-sans font-semibold text-white text-sm">Media Source & IP Protection Registry</h3>
        </div>
        <span className="text-xs font-mono text-zinc-500">Copyright Compliance Hub</span>
      </div>

      <p className="text-xs text-zinc-405 text-zinc-350 leading-relaxed">
        We adhere cleanly to licensing and trademark policies. Intellectual property derived from course scorecards or logo graphics will <strong>never</strong> be loaded into LLM model caches/training datasets without permission confirmation.
      </p>

      <div className="space-y-3.5">
        {sources.map(src => (
          <div key={src.id} className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-white max-w-sm truncate" title={src.sourceUrl}>
                {src.attribution}
              </span>

              {src.isRestrictedForTraining && (
                <div className="flex items-center space-x-1.5 bg-red-500/10 text-red-400 text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-red-500/20">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Restricted - Shield Active</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-850/50">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Assign Legal License Type</span>
                <select
                  value={src.licenseType}
                  onChange={(e) => handleLicenseChange(src.id, e.target.value as MediaLicenseType)}
                  className="bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1 rounded text-zinc-350 text-zinc-300 focus:outline-none"
                >
                  <option value="RECIRC_KEEPSAKE">Recirc Keepsake (Private)</option>
                  <option value="CREATIVE_COMMONS">Creative Commons (ShareAlike)</option>
                  <option value="PUBLIC_DOMAIN">Public Domain (CC0)</option>
                  <option value="USER_OWNED">User Owned / Upload</option>
                  <option value="RESTRICTED_MEDIA">Restricted Media (Protected / No ML)</option>
                </select>
              </div>

              <div className="text-[10px] text-zinc-500 font-mono text-left sm:text-right">
                <p>Training Safe: <strong className={src.isRestrictedForTraining ? "text-red-400" : "text-emerald-400"}>
                  {src.isRestrictedForTraining ? "PROHIBITED" : "ALLOWED"}
                </strong></p>
                <p className="mt-0.5">Asset Ref: {src.id}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
