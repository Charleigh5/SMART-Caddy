import { CaddyAdvice } from './caddyAdviceSchema';

export interface ActiveCaddyContextCard {
  profileId: string | null;
  roundId: string | null;
  holeNumber: number | null;
  par: number | null;
  yardage: number | null;
  handicap: number | null;
  weather: any;
  lastShots: any[];
  confirmedClubData: any[];
  dataGaps: string[];
}

export interface CaddyAdviceReceipt {
  id: string;
  timestamp: string;
  context: ActiveCaddyContextCard;
  advice: CaddyAdvice;
  source: 'GEMINI_LIVE' | 'REST_API' | 'LOCAL_FALLBACK';
  status: 'SUCCESS' | 'DEGRADED' | 'FAILED';
}
