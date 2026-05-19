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
  }
];
