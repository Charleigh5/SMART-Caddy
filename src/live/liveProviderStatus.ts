export interface ProviderConfig {
  liveEnabled: boolean;
  hasApiKey: boolean;
  liveModel: string;
  textModel: string;
  configSource: string;
  lastProviderError?: string;
}

export async function fetchProviderConfig(): Promise<ProviderConfig> {
  const res = await fetch('/api/provider-status');
  if (!res.ok) {
     throw new Error(`Failed to fetch provider config: ${res.statusText}`);
  }
  return res.json();
}
