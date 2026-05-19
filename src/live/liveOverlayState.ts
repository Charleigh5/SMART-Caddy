import { CaddyAdvice } from '../caddy/runtime/caddyAdviceSchema';

export interface CaddyContext {
  profile: string;
  courseHole: string;
  weather: string;
  shotHistory: string;
  clubData: string;
  memoryFacts: string[];
  providerPath: string;
  fallbackPath: string;
  providerModel?: string;
  providerConfigSource?: string;
  providerConnected?: boolean;
  fallbackUsed?: string | null;
  evidenceIds?: string[];
  blockedClaims: string[];
  receiptId: string | null;
  audioTelemetry?: string;
  videoTelemetry?: string;
}

export type LiveOverlayMode = 'SETUP' | 'ACTIVE' | 'FALLBACK';

export interface OverlayState {
  mode: LiveOverlayMode;
  advice: CaddyAdvice | null;
  context: CaddyContext | null;
  showDebug: boolean;
}
