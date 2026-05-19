export type LiveSessionStatus = 
  'IDLE' | 
  'REQUESTING_PERMISSION' | 
  'CONNECTING' | 
  'CONNECTED' | 
  'LISTENING' | 
  'THINKING' | 
  'SPEAKING' | 
  'DEGRADED_TEXT_ONLY' | 
  'FAILED_RETRYABLE' | 
  'FAILED_FINAL';

export interface LiveSessionState {
  status: LiveSessionStatus;
  errorMessage: string | null;
}

export type PermissionStateEnum = 'GRANTED' | 'DENIED' | 'PROMPT' | 'NOT_REQUESTED' | 'UNAVAILABLE' | 'ERROR';

export interface LiveSessionReceipt {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  finalLiveState: LiveSessionStatus;
  durationSeconds: number;

  providerModel: string;
  providerConnected: boolean;
  providerOpenedAt: string | null;
  providerClosedAt: string | null;
  providerError: string | null;

  micPermissionState: PermissionStateEnum;
  cameraPermissionState: PermissionStateEnum;

  audioChunksCaptured: number;
  audioChunksEncoded: number;
  audioChunksSent: number;
  audioChunksAcceptedByServer: number;
  audioChunksForwardedToProvider: number;
  audioChunksReceivedFromProvider: number;
  audioChunksPlayed: number;
  audioBytesSent: number;
  audioBytesReceived: number;
  audioInputSampleRate: number | null;
  audioOutputSampleRate: number | null;
  audioStartedAt: string | null;
  audioStoppedAt: string | null;
  audioErrors: string[];

  videoFramesCaptured: number;
  videoFramesSent: number;
  videoFramesAcceptedByServer: number;
  videoFramesRejectedByServer: number;
  videoStartedAt?: string | null;
  videoStoppedAt?: string | null;
  videoErrors?: string[];

  adviceId: string | null;
  fallbackUsed: string | null;
  contextCardHash: string | null;
  blockedClaims: string[];
  dataGaps: string[];
  evidenceIds: string[];
  errors: string[];
  qaFlags: string[];

  videoEnabled: boolean;
  maxFramePayloadBytes: number;
  averageFramePayloadBytes: number;
}

export const liveReceiptMemory: LiveSessionReceipt[] = [];

export function saveLiveReceipt(receipt: LiveSessionReceipt) {
  liveReceiptMemory.push(receipt);
}
