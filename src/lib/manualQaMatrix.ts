export type GateStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_TESTED' | 'BLOCKED' | 'NOT_APPLICABLE' | 'PENDING_REAL_DEVICE_QA';

export interface QaGate {
  id: string;
  category: string;
  name: string;
  featureId: string;
  ledgerStatus: string;
  requiredProof: string;
  relatedComponent: string;
  nextRequiredFixIfFailed: string;
  testerStatus: GateStatus;
  notes: string;
  // Extra fields for receipt and QA gates
  status?: string;
  testerName?: string;
  device?: string;
  browser?: string;
  os?: string;
  viewport?: string;
  inspectedAt?: string;
  proofArtifactRef?: string;
  screenshotRequired?: boolean;
  screenshotProvided?: boolean;
  blockerReason?: string;
  // Recommended schema additions
  proofArtifactExists?: boolean;
  proofArtifactType?: 'SCREENSHOT' | 'VIDEO' | 'RECEIPT_EXPORT' | 'LOG' | 'UNKNOWN';
  proofArtifactSha256?: string;
  proofArtifactPath?: string;
  proofArtifactUrl?: string;
  verifiedByHuman?: boolean;
  generatedByAgent?: boolean;
  validationStatus?: 'VALID' | 'INVALID_MOCK' | 'INVALID_MISSING_ARTIFACT' | 'CONTESTED_UNVERIFIED';
}

export const INITIAL_QA_MATRIX: QaGate[] = [
  {
    id: 'QA-001',
    category: 'Provider diagnostics',
    name: 'Provider Diagnostics Panel Visible',
    featureId: 'f-34-provider-runtime',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Verify panel renders and runs checks accurately on physical device.',
    relatedComponent: 'src/components/Diagnostics.tsx',
    nextRequiredFixIfFailed: 'Fix provider ping fallback handling.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-002',
    category: 'Provider disabled/fallback',
    name: 'Provider Disabled/Failure State Visible',
    featureId: 'f-34-provider-runtime',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Verify disabled state is communicated honestly without mock success.',
    relatedComponent: 'src/components/Diagnostics.tsx',
    nextRequiredFixIfFailed: 'Ensure disabled states show warning UI.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-003',
    category: 'Live HUD fixture mode',
    name: 'No Fake CONNECTED State (Timeout respects state)',
    featureId: 'f-35-live-hud-e2e',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Live HUD accurately shows FIXTURE/NO SESSION when disconnected.',
    relatedComponent: 'src/components/live/LiveSessionControls.tsx',
    nextRequiredFixIfFailed: 'Fix connection state machine.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-004',
    category: 'CaddyAdviceCard',
    name: 'Advice Source Label Visible & Correct',
    featureId: 'f-35-live-hud-e2e',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Displays accurate source (REST vs Live).',
    relatedComponent: 'src/components/live/CaddyAdviceCard.tsx',
    nextRequiredFixIfFailed: 'Ensure source tracking in Caddy context.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-005',
    category: 'CaddyContextDrawer',
    name: 'CaddyContextDrawer Populated',
    featureId: 'f-35-live-hud-e2e',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Shows provider model, config source, receipt ID, fallback state.',
    relatedComponent: 'src/components/live/CaddyContextDrawer.tsx',
    nextRequiredFixIfFailed: 'Wire context payload down from AiCaddy to drawer.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-006',
    category: 'FrameHealthMeter',
    name: 'FrameHealthMeter Renders State',
    featureId: 'f-40-tts-and-telemetry-polish',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Shows telemetry size/speed or fixture state without locking UI thread.',
    relatedComponent: 'src/components/live/FrameHealthMeter.tsx',
    nextRequiredFixIfFailed: 'Optimize React re-renders in telemetry component.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-007',
    category: 'Web Speech Voice Query',
    name: 'Voice Query Logic works natively',
    featureId: 'f-36-ai-caddy-web-speech-voice-query',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Mic prompts, captures audio, fallback if unsupported.',
    relatedComponent: 'src/components/AiCaddy.tsx',
    nextRequiredFixIfFailed: 'Fix web-speech-api initialization logic.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-008',
    category: 'TTS playback',
    name: 'Auto TTS for queries works properly',
    featureId: 'f-40-tts-and-telemetry-polish',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Only autoplays for speech, plays text properly, degrades safely.',
    relatedComponent: 'src/components/AiCaddy.tsx',
    nextRequiredFixIfFailed: 'Fix TTS audio context autoplay restrictions.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-009',
    category: 'SwingReview truth labels',
    name: 'SwingReview UI Honestly Labels Mocks',
    featureId: 'f-32-explicit-data-gap-cues',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Mock kinematic data warns users it is simulated.',
    relatedComponent: 'src/components/SwingReview.tsx',
    nextRequiredFixIfFailed: 'Add warning banner for non-hardware measurements.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-010',
    category: 'Mobile layout',
    name: 'Responsive UI avoids clipping',
    featureId: 'f-39-visual-polish-a11y',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Verify HUD components scale cleanly on iOS/Android.',
    relatedComponent: 'src/components/live/*.tsx',
    nextRequiredFixIfFailed: 'Adapt CSS media queries for z-index and spacing.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-011',
    category: 'No-secret UI check',
    name: 'API Keys remain server-side',
    featureId: 'f-33-provider-config',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Secrets never appear in UI, dom logs, or console output.',
    relatedComponent: 'Global',
    nextRequiredFixIfFailed: 'Scrub secrets from receipt or component states.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-012',
    category: 'SwingReview Visual Metrics',
    name: 'SWING-VIS-006 mobile/responsive chart layout proof',
    featureId: 'f-43-swingreview-visual-metrics',
    ledgerStatus: 'PARTIALLY_VERIFIED',
    requiredProof: 'Verify single-view and comparison-view Recharts radar and bar graphs do not overflow/clip on mobile layout and display correctly with truth labels visible near charts under dark theme. Confirm with desktop & mobile screenshots or text-rendering proofs.',
    relatedComponent: 'src/components/SwingReview.tsx',
    nextRequiredFixIfFailed: 'Adjust Recharts container aspect ratio or responsive styling wrapper on SwingReview.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
  },
  {
    id: 'QA-013',
    category: 'Scorecard camera lifecycle',
    name: 'Scorecard camera lifecycle activation',
    featureId: 'f-7-scorecard-scanner',
    ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
    requiredProof: 'Verify browser permission prompt appears; rear/environment camera requested where supported; live viewfinder stream appears; stream attaches after video element mounts; cancel stops tracks; retake stops old stream; route change/unmount stops tracks; permission denied renders fallback; no camera renders upload/manual fallback.',
    relatedComponent: 'src/components/ScorecardScanner.tsx',
    nextRequiredFixIfFailed: 'Check MediaDevices.getUserMedia constraints and unmount cleanup logic.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
    status: 'PENDING_REAL_DEVICE_QA',
    screenshotRequired: true,
    screenshotProvided: false,
    proofArtifactRef: '',
    blockerReason: ''
  },
  {
    id: 'QA-014',
    category: 'Scorecard cropper workflow',
    name: 'Scorecard cropper viewport scaling',
    featureId: 'f-7-scorecard-scanner',
    ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
    requiredProof: 'Verify cropper does not appear before image/video source exists; captured camera image enters cropper; uploaded image enters cropper; crop handles work at desktop and mobile widths (test 375px, 390px, 430px, and 1280px+); no controls clip or become unreachable.',
    relatedComponent: 'src/components/ScorecardScanner.tsx',
    nextRequiredFixIfFailed: 'Adjust cropper container relative positioning and touch target handlers for small screen boundaries.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
    status: 'PENDING_REAL_DEVICE_QA',
    screenshotRequired: true,
    screenshotProvided: false,
    proofArtifactRef: '',
    blockerReason: ''
  },
  {
    id: 'QA-015',
    category: 'Scorecard OCR validation',
    name: 'Scorecard OCR validation and confirmation flow',
    featureId: 'f-7-scorecard-scanner',
    ledgerStatus: 'IMPLEMENTED_UNVERIFIED',
    requiredProof: 'Verify cropped image submits to /api/gemini/scorecard-parse; parser response renders review/confirmation UI; uncertain fields are visibly flagged; course name, tee set, holes, par, yardage, handicap, rating/slope are editable if present; ads/non-golf text is not treated as scoring truth; saved scorecard persists; official handicap claims remain blocked unless official/user-confirmed inputs exist.',
    relatedComponent: 'src/components/ScorecardScanner.tsx',
    nextRequiredFixIfFailed: 'Verify /api/gemini/scorecard-parse schema parser extraction rules and save persistence behavior in IDB.',
    testerStatus: 'PENDING_REAL_DEVICE_QA',
    notes: '',
    status: 'PENDING_REAL_DEVICE_QA',
    screenshotRequired: true,
    screenshotProvided: false,
    proofArtifactRef: '',
    blockerReason: ''
  }
];
