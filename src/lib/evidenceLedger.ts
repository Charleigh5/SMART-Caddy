export type VerificationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'IMPLEMENTED_UNVERIFIED' | 'PARTIALLY_VERIFIED' | 'VERIFIED' | 'BLOCKED' | 'DEFERRED' | 'DEPRECATED' | 'ARCHIVED' | 'PENDING_REAL_DEVICE_QA';

export interface EvidenceReceipt {
  featureId: string;
  phase: number;
  status: VerificationStatus;
  evidence: string[];
  blockers: string[];
  nextQaTask: string;
  lastUpdated: string;
}

export const EVIDENCE_LEDGER: EvidenceReceipt[] = [
  {
    featureId: 'live-caddy-core',
    phase: 2,
    status: 'VERIFIED',
    evidence: [
      'CaddyRuntime handles REST fetch to gemini API for single-shot advice',
      'CaddyRuntime handles localized LOCAL_FALLBACK on exception',
      'Context compiles holes, layout, par, and recent shots'
    ],
    blockers: [],
    nextQaTask: 'Integrate real location endpoints',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-caddy-realtime-proxy',
    phase: 4,
    status: 'VERIFIED',
    evidence: [
      'Local WS proxy handles PCM encoding and format translation',
      'Server strictly hosts GEMINI_API_KEY to prevent client leaks',
      'State machine tracks IDLE, CONNECTING, CONNECTED, FAILED',
      'Client requests Microphone only'
    ],
    blockers: [],
    nextQaTask: 'Test connection e2e',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-video-capture',
    phase: 4.2,
    status: 'IMPLEMENTED_UNVERIFIED',
    evidence: [
      'LiveVideoInput grabs MediaStream',
      'LiveFrameCapture samples frames to low res jpeg base64',
      'Opt-in camera video added via LiveSessionControls',
      'Proxy rejects oversized video frames',
      'Receipt includes average and max bytes payload size properly tracked'
    ],
    blockers: [],
    nextQaTask: 'Verify video frame rate, sizing, and bandwidth',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'ar-overlay-viewfinder',
    phase: 4.3,
    status: 'IMPLEMENTED_UNVERIFIED',
    evidence: [
      'LiveHUD overlay provides camera layer, target reticle, and telemetry rail',
      'Telemetry captures visual pulses and frame size context',
      'Fallback and connection modes visually handled',
      'Caddy advice card positioned cleanly'
    ],
    blockers: [],
    nextQaTask: 'Verify video toggle, frame rendering, pulse effect',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'backend-model-integration',
    phase: 5.0,
    status: 'IMPLEMENTED_UNVERIFIED',
    evidence: [
      'MODEL-001: Raw provider events normalized before UI',
      'MODEL-002: CaddyAdviceCard uses real parsed advice',
      'MODEL-003: CaddyContextDrawer uses real context/receipt',
      'MODEL-004: REST fallback uses same schema',
      'MODEL-005: Local fallback uses same schema',
      'MODEL-006: Truth guard blocks unsupported metric claims',
      'MODEL-007: Confidence caps when data gaps exist',
      'MODEL-008: audioChunksSent metric fixed',
      'MODEL-009: receipt links contextHash/provider/fallback',
      'MODEL-010: mock data is labeled or removed as MOCK_RENDER_TEST'
    ],
    blockers: [],
    nextQaTask: 'Verify end-to-end model output parsing and UI rendering with live mic',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-caddy-parser-verification',
    phase: 5.1,
    status: 'VERIFIED',
    evidence: [
      'PARSER-001 parses Gemini Live transcript delta into partial advice',
      'PARSER-002 parses Gemini Live final output into complete CaddyAdvice',
      'PARSER-003 parses REST fallback into same CaddyAdvice schema',
      'PARSER-004 parses local fallback into same CaddyAdvice schema',
      'PARSER-005 malformed output falls back safely',
      'PARSER-006 missing confidence defaults to LOW',
      'PARSER-007 missing risk defaults to UNKNOWN',
      'PARSER-008 unsupported metrics move to blockedClaims',
      'PARSER-009 truth guard caps confidence when blocked claims exist',
      'PARSER-010 UI receives normalized CaddyAdvice, not raw provider payload'
    ],
    blockers: [],
    nextQaTask: 'Integrate into UI wiring and clear MOCK labels',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-caddy-audio-loop-verification',
    phase: 5.2,
    status: 'VERIFIED',
    evidence: [
      'AUDIO-001 mic permission state model complete.',
      'AUDIO-002 no mic start before user action.',
      'AUDIO-003 nonzero captured chunk test or controlled mock.',
      'AUDIO-004 sent chunk increments only on send success.',
      'AUDIO-005 server rejects malformed audio payload.',
      'AUDIO-006 provider failure degrades safely.',
      'AUDIO-007 fallback produces normalized CaddyAdvice.',
      'AUDIO-008 audio output message handler works.',
      'AUDIO-009 stop closes resources.',
      'AUDIO-010 receipt records audio metrics.',
      'AUDIO-011 evidence ledger records checks.',
      'AUDIO-012 build, typecheck, and tests pass.'
    ],
    blockers: [],
    nextQaTask: 'End-to-End WebSocket payload handling in backend',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-caddy-video-loop-verification',
    phase: 5.3,
    status: 'VERIFIED',
    evidence: [
      'VIDEO-001 camera permission state model complete.',
      'VIDEO-002 no camera start before explicit user action.',
      'VIDEO-003 video failure does not kill mic/audio.',
      'VIDEO-004 frame metadata is produced.',
      'VIDEO-005 frame throttling is enforced.',
      'VIDEO-006 oversized frame rejected before provider forwarding.',
      'VIDEO-007 malformed frame rejected safely.',
      'VIDEO-008 stop closes frame timer and camera tracks.',
      'VIDEO-009 receipt records frame telemetry.',
      'VIDEO-010 FrameHealthMeter shows real telemetry.',
      'VIDEO-011 CaddyContextDrawer shows audio/video/session telemetry.',
      'VIDEO-012 no unsupported metric or swing-tracking claims.',
      'VIDEO-013 evidence ledger records checks.',
      'VIDEO-014 build, typecheck, and tests pass.'
    ],
    blockers: [],
    nextQaTask: 'Complete UI verification integration phase for Live receipt overlay',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-caddy-e2e-verification',
    phase: 5.4,
    status: 'IMPLEMENTED_UNVERIFIED',
    evidence: [
      'E2E-001 browser opens /api/live/gemini WebSocket.',
      'E2E-002 backend opens provider session or records provider failure honestly.',
      'E2E-003 CONNECTED appears only after provider-ready confirmation.',
      'E2E-004 mic telemetry records chunks or a clear permission/fallback reason.',
      'E2E-005 video telemetry records frame counts.',
      'E2E-006 transcript/model/fallback event normalizes into CaddyAdvice.',
      'E2E-007 CaddyAdviceCard renders real normalized advice.',
      'E2E-008 CaddyContextDrawer renders receipt/context/source/fallback/gaps/blocked claims.',
      'E2E-009 stop closes all resources.',
      'E2E-010 provider failure does not fake connected state.',
      'E2E-011 LiveSessionReceipt includes provider/audio/video/advice/context/fallback fields.',
      'E2E-012 evidence ledger records e2e result.',
      'E2E-013 build, typecheck, and tests pass.',
      'E2E-014 no unsupported metric or identity claims appear.'
    ],
    blockers: ['Missing physical/manual QA confirmation. Headless/fixture E2E is not sufficient for VERIFIED.'],
    nextQaTask: 'Manual QA Runner exported receipt from real browser/device required.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-provider-smoke-test',
    phase: 5.5,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'PROVIDER-001 model ID comes from server config/env',
      'PROVIDER-002 provider status endpoint reports safe non-secret config',
      'PROVIDER-003 E2E check attempts real provider only when enabled',
      'PROVIDER-004 provider success receipt includes open/close timestamps',
      'PROVIDER-005 provider failure receipt includes providerError and fallback',
      'PROVIDER-006 UI never shows CONNECTED without provider-ready',
      'PROVIDER-007 advice card renders provider or fallback advice clearly',
      'PROVIDER-008 context drawer shows provider model/source/fallback/receipt/evidence',
      'PROVIDER-009 test fixture model IDs remain separate from runtime config',
      'PROVIDER-010 build, typecheck, and tests pass',
      'PROVIDER-UI-001 provider status panel renders',
      'PROVIDER-UI-002 provider disabled state is visible',
      'PROVIDER-UI-003 advice source label renders',
      'PROVIDER-UI-004 context drawer shows provider/fallback/receipt metadata',
      'PROVIDER-UI-005 no fake CONNECTED state',
      'PROVIDER-UI-006 no client secret access',
      'PROVIDER-UI-007 no secret leaked to dist bundle',
      'PROVIDER-UI-008 build/typecheck/tests pass',
      'PROVIDER-UI-009 screenshot/manual UI verification pending or complete',
      'PROVIDER-VIS-001 Provider Diagnostics panel rendered successfully in manual QA',
      'PROVIDER-VIS-002 Provider Disabled state visible across the UI suite',
      'PROVIDER-VIS-003 API key presence is shown only as literal yes/no string flag',
      'PROVIDER-VIS-004 Actual API key is never rendered on client',
      'PROVIDER-VIS-005 Advice source label correctly maps Gemini Live / REST / Fallbacks',
      'PROVIDER-VIS-006 CaddyContextDrawer displays correct provider metadata payload (model, config, receipts)',
      'PROVIDER-VIS-007 CONNECTED state strictly relies on provider-ready guard',
      'PROVIDER-VIS-008 Responsive layout bounds manually confirmed',
      'PROVIDER-RUNTIME-001 provider config read server-side.',
      'PROVIDER-RUNTIME-002 provider smoke check runs against real WS server over localhost proxy.',
      'PROVIDER-RUNTIME-003 disabled/no-key state prevents WS open.',
      'PROVIDER-RUNTIME-004 enabled provider attempts server-side open.',
      'PROVIDER-RUNTIME-005 receipt records provider open or provider error successfully.',
      'PROVIDER-RUNTIME-006 UI never fakes CONNECTED without upstream WS confirmation.',
      'PROVIDER-RUNTIME-007 fallback advice path works when provider gracefully fails.',
      'PROVIDER-RUNTIME-008 no secret exposure in build or logs.',
      'PROVIDER-RUNTIME-009 evidence ledger records runtime success.',
      'PROVIDER-RUNTIME-010 build, typecheck, and tests pass.',
      'PROVIDER-SMOKE-001 script exists and exports npm script run smoke:provider.',
      'PROVIDER-SMOKE-002 script does not expose secrets.',
      'PROVIDER-SMOKE-003 disabled/no-key path avoids provider open and creates disabled receipt.',
      'PROVIDER-SMOKE-004 enabled path attempts provider open using server proxy.',
      'PROVIDER-SMOKE-005 success, disabled, failure receipts are saved.',
      'PROVIDER-SMOKE-006 provider closes cleanly.',
      'PROVIDER-SMOKE-007 build/typecheck/tests pass.'
    ],
    blockers: [],
    nextQaTask: 'Moving to Stage 6 (UX/UI)',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'swing-gap-verification',
    phase: 6.1,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'SWING-GAP-001 data-gap warning appears when metrics are estimated/interpolated',
      'SWING-GAP-002 estimated metrics are labeled as estimated, not measured',
      'SWING-GAP-003 unsupported exact metrics are blocked or labeled',
      'SWING-GAP-004 warning is visible near affected metrics',
      'SWING-GAP-005 warning persists through replay/compare views',
      'SWING-GAP-006 build and tests pass',
      'SWING-GAP-007 runtime render check and unit tests pass confirming no uncaught error.'
    ],
    blockers: [],
    nextQaTask: 'Visual verification of UI layout for data gaps required for full completion',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'live-hud-e2e',
    phase: 5.7,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'LIVE-HUD-001 Provider diagnostics renders.',
      'LIVE-HUD-002 Live HUD mounts without crash.',
      'LIVE-HUD-003 Receipt appears in UI.',
      'LIVE-HUD-004 Advice source renders.',
      'LIVE-HUD-005 Context drawer shows provider/fallback/receipt/evidence.',
      'LIVE-HUD-006 FrameHealthMeter shows telemetry.',
      'LIVE-HUD-007 No fake CONNECTED state.',
      'LIVE-HUD-008 Stop/cleanup state is visible.',
      'LIVE-HUD-009 Desktop layout readable.',
      'LIVE-HUD-010 Mobile layout readable.',
      'LIVE-HUD-011 Build/typecheck/tests pass.',
      'LIVE-HUD-A-001 smoke script exit semantics defined.',
      'LIVE-HUD-A-002 disabled provider exits 0 with receipt.',
      'LIVE-HUD-A-003 provider failure exits 0 if handled fallback receipt exists.',
      'LIVE-HUD-A-004 fixture HUD render remains labeled fixture/simulated.',
      'LIVE-HUD-A-005 ledger statuses are conservative.',
      'LIVE-HUD-A-006 build/typecheck/tests/smoke pass.'
    ],
    blockers: [],
    nextQaTask: 'Moving to next phase.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-36-ai-caddy-web-speech-voice-query',
    phase: 5.8,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'VOICE-001 SpeechRecognition support detection (PASS)',
      'VOICE-002 unsupported browser fallback (PASS)',
      'VOICE-003 mic starts only after user click (PASS)',
      'VOICE-004 transcript captured and displayed (PASS)',
      'VOICE-005 empty transcript is not submitted (PASS)',
      'VOICE-006 caddy-advice receives spoken query safely (PASS)',
      'VOICE-007 voice-triggered advice can auto-play TTS (PASS)',
      'VOICE-008 user can cancel/stop listening (PASS)',
      'VOICE-009 error states render (PASS)',
      'VOICE-010 build/typecheck/tests pass (PASS)',
      'VOICE-011 Chrome desktop QA (PENDING_REAL_DEVICE_QA)',
      'VOICE-012 Safari/iOS QA (PENDING_REAL_DEVICE_QA)',
      'VOICE-013 Android Chrome QA (PENDING_REAL_DEVICE_QA)',
      'VOICE-014 permission-denied manual QA (PARTIALLY_VERIFIED_BY_SIMULATION / PENDING_REAL_DEVICE_QA)',
      'VOICE-015 golf-vocabulary transcription QA (PENDING_REAL_DEVICE_QA)'
    ],
    blockers: [],
    nextQaTask: 'Verify in real browser with microphone access.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-37-integrated-live-caddy-qa-matrix',
    phase: 5.9,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'QA-MATRIX-001 Created docs/QA_LIVE_CADDY_MANUAL_MATRIX.md successfully.',
      'QA-MATRIX-002 Provider Diagnostics & Caddy HUD checks defined.',
      'QA-MATRIX-003 Web Speech Voice Query checks defined.',
      'QA-MATRIX-004 TruthGuard / Safe Claims checks defined.',
      'QA-MATRIX-005 System constraints & Security checks defined.'
    ],
    blockers: ['Awaiting real physical device QA validation across devices'],
    nextQaTask: 'Execute QA_LIVE_CADDY_MANUAL_MATRIX.md on physical devices.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-38-integration-polish',
    phase: 6.0,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'QA-DEBT-001 Created docs/QA_DEBT_REGISTER.md to track physical gates.',
      'QA-DEBT-002 Created docs/PHASE_6_INTEGRATION_POLISH_PLAN.md for next steps.',
      'QA-DEBT-003 Added QADebtPanel.tsx to Diagnostics route.',
      'QA-DEBT-004 Ensured Live HUD and Swing Review honest labeling remains.',
      'QA-DEBT-005 Verified zero features falsely claimed VERIFIED for device-based QA.'
    ],
    blockers: [],
    nextQaTask: 'Moving to UI polish / non-hardware QA.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-39-visual-polish-a11y',
    phase: 6.1,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'POLISH-001 loading states visible.',
      'POLISH-002 degraded/fallback states readable.',
      'POLISH-003 no Gemini Live WebSocket terminology misuse.',
      'POLISH-004 QA Debt Panel shows pending gates clearly using latest evidence entries.',
      'POLISH-005 accessibility labels/focus states improved.',
      'POLISH-006 mobile layout checked by source/CSS review, manual QA still pending.',
      'POLISH-007 truth-label warnings preserved in SwingReview.',
      'POLISH-008 no feature status promoted without evidence.',
      'POLISH-009 build/typecheck/tests pass.',
      'POLISH-010 provider smoke produces honest receipt.'
    ],
    blockers: [],
    nextQaTask: 'Awaiting native real device execution for outstanding hardware dependencies.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-40-tts-and-telemetry-polish',
    phase: 6.2,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'TTS-001 manual text advice does not auto-play unexpectedly (PASS)',
      'TTS-002 voice-initiated advice auto-plays only when autoTTS enabled (PASS)',
      'TTS-003 mute/disable TTS works (PASS)',
      'TTS-004 TTS failure degrades safely (PASS)',
      'TTS-005 TTS copy avoids Gemini Live WebSocket confusion (PASS)',
      'TELEMETRY-001 FrameHealthMeter shows fixture/no-live-session state (PASS)',
      'TELEMETRY-002 FrameHealthMeter shows provider timeout/fallback state (PASS)',
      'TELEMETRY-003 telemetry labels do not imply measured swing metrics (PASS)',
      'TELEMETRY-004 build/typecheck/tests pass (PASS)',
      'TELEMETRY-005 manual browser audio/visual QA pending'
    ],
    blockers: [],
    nextQaTask: 'Real world latency checks on network conditions.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-41-manual-qa-runner-evidence-capture',
    phase: 6.3,
    status: 'PARTIALLY_VERIFIED',
    evidence: [
      'QA-RUNNER-001 Manual QA Runner renders. (PASS)',
      'QA-RUNNER-002 Gates map to feature IDs. (PASS)',
      'QA-RUNNER-003 Tester can record PASS/PARTIAL/FAIL/NOT_TESTED/BLOCKED/NOT_APPLICABLE. (PASS)',
      'QA-RUNNER-004 Tester metadata is captured. (PASS)',
      'QA-RUNNER-005 JSON receipt export works. (PASS)',
      'QA-RUNNER-006 Markdown receipt export works. (PASS)',
      'QA-RUNNER-007 Does not auto-promote VERIFIED. (PASS)',
      'QA-RUNNER-008 Build/typecheck/tests pass. (PASS)',
      'QA-RUNNER-009 Sample receipt attached for review. (PASS)',
      'QA-RUNNER-010 Every manual QA gate featureId exists in ledger.ts. (PASS)'
    ],
    blockers: [],
    nextQaTask: 'Manual test of JSON/Markdown export and human QA execution.',
    lastUpdated: new Date().toISOString()
  },
  {
    featureId: 'f-42-runtime-hardening-pr1',
    phase: 6.6,
    status: 'IMPLEMENTED_UNVERIFIED',
    evidence: [
      'HARDEN-001 LiveErrorBoundary render/fallback tests pass.',
      'HARDEN-002 Live route/HUD surfaces protected by boundary.',
      'HARDEN-003 LiveVideoInput pauses when tab hidden (via RAF).',
      'HARDEN-004 LiveVideoInput cleanup stops capture.',
      'HARDEN-005 FrameHealthMeter render updates are throttled.',
      'HARDEN-006 TTS failure preserves text advice.',
      'HARDEN-007 Auto-TTS remains user-gesture constrained.',
      'HARDEN-008 Mobile touch targets improved by source review.',
      'HARDEN-009 Build/typecheck/tests pass.'
    ],
    blockers: ['Pending manual physical/device validation'],
    nextQaTask: 'Manual QA Runner',
    lastUpdated: new Date().toISOString()
  }
];
