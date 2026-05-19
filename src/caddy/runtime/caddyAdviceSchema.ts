export type AdviceSource = 'GEMINI_LIVE' | 'REST_FALLBACK' | 'LOCAL_FALLBACK' | 'MOCK_RENDER_TEST';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKED';

export interface CaddyAdvice {
  adviceId: string;
  createdAt: string;
  source: AdviceSource;
  situation: string;
  smartTarget: string;
  clubThought: string;
  avoid: string;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  dataGaps: string[];
  blockedClaims: string[];
  evidenceLabels: string[];
  recommendedClubId?: string;
  targetYardage?: string;
  targetDescription?: string;
  rawModelSummary?: string;
  confidenceCapped?: boolean;
}
