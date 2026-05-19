import { CaddyAdvice } from './caddyAdviceSchema';

export const LOCAL_FALLBACK_ADVICE: CaddyAdvice = {
  adviceId: 'local-fallback',
  createdAt: new Date().toISOString(),
  source: 'LOCAL_FALLBACK',
  situation: 'Unable to connect to AI Caddy.',
  smartTarget: 'Play towards the center of the green or fairway.',
  clubThought: 'Use a comfortable club that you hit consistently.',
  avoid: 'Avoid high-risk shots until AI connection is restored.',
  riskLevel: 'LOW',
  confidence: 'LOW',
  dataGaps: ['Provider offline', 'No live analysis available'],
  blockedClaims: [],
  evidenceLabels: []
};
