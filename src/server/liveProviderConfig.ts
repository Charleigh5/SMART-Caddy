export interface ProviderConfig {
  liveEnabled: boolean;
  hasApiKey: boolean;
  liveModel: string;
  textModel: string;
  configSource: 'system' | 'env';
  lastProviderError?: string;
}

const SERVER_DEFAULT_LIVE = 'models/gemini-2.0-flash-exp';
const SERVER_DEFAULT_TEXT = 'gemini-2.5-pro';

let lastError: string | undefined;

export function setLastError(error: string) {
  lastError = error;
}

export function getProviderConfig(): ProviderConfig {
  return {
    liveEnabled: process.env.ENABLE_GEMINI_LIVE !== 'false', // Default to true unless explicitly 'false'
    hasApiKey: !!process.env.GEMINI_API_KEY,
    liveModel: process.env.GEMINI_LIVE_MODEL || SERVER_DEFAULT_LIVE,
    textModel: process.env.GEMINI_TEXT_MODEL || SERVER_DEFAULT_TEXT,
    configSource: 'env',
    lastProviderError: lastError
  };
}
