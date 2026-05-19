import { LiveSessionStatus, saveLiveReceipt, LiveSessionReceipt } from './liveSessionState';
import { ClientLiveMessage, ServerLiveMessage } from '../shared/liveProtocol';
import { LiveAudioInput } from './liveAudioInput';
import { LiveAudioOutput } from './liveAudioOutput';
import { LiveVideoInput } from './liveVideoInput';
import { LiveFrameCapture } from './liveFrameCapture';

import { telemetry } from './liveOverlayTelemetry';
import { CaddyAdvice } from '../caddy/runtime/caddyAdviceSchema';
import { parseCaddyOutput } from '../caddy/runtime/caddyModelOutputParser';
import { normalizeAdvice } from '../caddy/runtime/caddyAdviceNormalizer';

export class LiveGeminiClient {
  private ws: WebSocket | null = null;
  private onStatusChange: (status: LiveSessionStatus, error?: string) => void;
  public onAdviceChange: ((advice: CaddyAdvice) => void) | null = null;
  private audioInput: LiveAudioInput | null = null;
  private audioOutput: LiveAudioOutput | null = null;
  
  private videoInput: LiveVideoInput | null = null;
  private frameCapture: LiveFrameCapture | null = null;

  private currentStatus: LiveSessionStatus = 'IDLE';
  private startTime: number | null = null;

  private videoEnabled = false;
  private videoPermission: 'GRANTED' | 'DENIED' | 'PROMPT' | 'NOT_REQUESTED' | 'UNAVAILABLE' | 'ERROR' = 'NOT_REQUESTED';
  private micPermission: 'GRANTED' | 'DENIED' | 'PROMPT' | 'NOT_REQUESTED' | 'UNAVAILABLE' | 'ERROR' = 'NOT_REQUESTED';
  private audioChunksCaptured = 0;
  private audioChunksEncoded = 0;
  private audioChunksSent = 0;
  private audioChunksAcceptedByServer = 0;
  private audioChunksForwardedToProvider = 0;
  private audioChunksReceivedFromProvider = 0;
  private audioChunksPlayed = 0;
  private audioBytesSent = 0;
  private audioBytesReceived = 0;
  private audioInputSampleRate: number | null = null;
  private audioOutputSampleRate: number | null = null;
  private audioStartedAt: string | null = null;
  private audioStoppedAt: string | null = null;
  private videoFramesSent = 0;
  private totalFramePayloadBytes = 0;
  private maxFramePayloadBytes = 0;
  private videoFramesCaptured = 0;
  private videoStartedAt: string | null = null;
  private videoStoppedAt: string | null = null;
  private videoErrors: string[] = [];
  private providerError: string | null = null;
  private providerConnected = false;
  private providerOpenedAt: string | null = null;
  private providerClosedAt: string | null = null;
  private fallbackUsed: string | null = null;
  private errors: string[] = [];

  private currentTranscript: string = '';
  private currentAdvice: CaddyAdvice | null = null;
  private contextCardHash: string | null = null;

  private providerConfig: any = null;
  
  constructor(onStatusChange: (status: LiveSessionStatus, error?: string) => void) {
    this.onStatusChange = (status, error) => {
      this.currentStatus = status;
      if (error) this.errors.push(error);
      if (status === 'DEGRADED_TEXT_ONLY') this.fallbackUsed = 'TEXT_ONLY';
      if (status === 'FAILED_RETRYABLE' || status === 'FAILED_FINAL') this.fallbackUsed = 'LOCAL/REST';
      onStatusChange(status, error);
    };
  }

  async connect(enableVideo: boolean = false) {
    this.startTime = Date.now();
    this.videoEnabled = enableVideo;

    try {
        const { fetchProviderConfig } = await import('./liveProviderStatus');
        this.providerConfig = await fetchProviderConfig();
    } catch (e: any) {
        console.warn("Failed to fetch provider config, using defaults", e);
        this.providerConfig = { liveEnabled: true, hasApiKey: false, liveModel: 'SERVER_DEFAULT_LIVE', textModel: 'SERVER_DEFAULT', configSource: 'error' };
    }

    if (!this.providerConfig.liveEnabled || !this.providerConfig.hasApiKey) {
        this.providerError = !this.providerConfig.liveEnabled 
            ? 'Live configuration disabled' 
            : 'Missing API Key';
        this.onStatusChange('FAILED_RETRYABLE', this.providerError);
        this.saveReceipt();
        return;
    }

    this.videoFramesSent = 0;
    this.totalFramePayloadBytes = 0;
    this.maxFramePayloadBytes = 0;
    this.videoFramesCaptured = 0;
    this.videoStartedAt = null;
    this.videoStoppedAt = null;
    this.videoErrors = [];
    this.audioChunksCaptured = 0;
    this.audioChunksEncoded = 0;
    this.audioChunksSent = 0;
    this.audioChunksAcceptedByServer = 0;
    this.audioChunksForwardedToProvider = 0;
    this.audioChunksReceivedFromProvider = 0;
    this.audioChunksPlayed = 0;
    this.audioBytesSent = 0;
    this.audioBytesReceived = 0;
    this.audioInputSampleRate = null;
    this.audioOutputSampleRate = null;
    this.audioStartedAt = null;
    this.audioStoppedAt = null;
    this.currentTranscript = '';
    this.currentAdvice = null;
    this.contextCardHash = `ctx-${Date.now().toString(36).substring(4)}`;
    this.videoPermission = 'NOT_REQUESTED';
    this.micPermission = 'NOT_REQUESTED';
    this.providerConnected = false;
    this.providerOpenedAt = null;
    this.providerClosedAt = null;
    this.providerError = null;
    this.errors = [];
    this.fallbackUsed = null;

    this.onStatusChange('REQUESTING_PERMISSION');
    
    try {
      this.micPermission = 'PROMPT';
      await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micPermission = 'GRANTED';
    } catch (err: any) {
      this.micPermission = 'DENIED';
      this.onStatusChange('FAILED_FINAL', 'Microphone permission denied.');
      this.saveReceipt();
      return;
    }

    if (enableVideo) {
       try {
         this.videoPermission = 'PROMPT';
         this.videoInput = new LiveVideoInput();
         await this.videoInput.start();
         this.videoPermission = 'GRANTED';
         this.videoStartedAt = new Date().toISOString();
       } catch (err: any) {
         this.videoPermission = 'DENIED';
         this.videoErrors.push(err.message || 'Video permission denied');
         console.warn('Video permission denied or failed. Proceeding without video.', err);
       }
    }

    this.onStatusChange('CONNECTING');
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${window.location.host}/api/live/gemini`);
      
      this.ws.onopen = () => {
        const msg: ClientLiveMessage = { type: 'live.start' };
        this.ws?.send(JSON.stringify(msg));
        
        this.audioOutput = new LiveAudioOutput();
        this.audioOutputSampleRate = 24000;
        this.audioStartedAt = new Date().toISOString();
        this.audioInputSampleRate = 16000;
        
        this.audioInput = new LiveAudioInput((base64Data) => {
           this.audioChunksEncoded++;
           if (this.ws?.readyState === WebSocket.OPEN) {
              const audioMsg: ClientLiveMessage = { type: 'live.audio.input', payload: { data: base64Data } };
              this.ws.send(JSON.stringify(audioMsg));
              this.audioChunksSent++;
              this.audioBytesSent += Math.round((base64Data.length * 3) / 4);
           }
        }, () => {
           this.audioChunksCaptured++;
        });
        
        this.audioInput.start();

        if (this.videoInput && this.videoPermission === 'GRANTED') {
           this.frameCapture = new LiveFrameCapture((base64Data) => {
               this.videoFramesCaptured++;
               if (this.ws?.readyState === WebSocket.OPEN) {
                   const byteSize = Math.round((base64Data.length * 3) / 4);
                   this.videoFramesSent++;
                   this.totalFramePayloadBytes += byteSize;
                   if (byteSize > this.maxFramePayloadBytes) {
                       this.maxFramePayloadBytes = byteSize;
                   }
                   telemetry.emitFramePulsed();
                   const videoMsg: ClientLiveMessage = { type: 'live.video.frame', payload: { data: base64Data } };
                   this.ws.send(JSON.stringify(videoMsg));
               }
           }, 0.5); // 0.5 FPS (1 frame every 2s)
           this.frameCapture.start(this.videoInput.videoElement);
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const msg: ServerLiveMessage = JSON.parse(event.data);
          switch (msg.type) {
            case 'live.status':
              if (msg.payload?.status === 'CONNECTED') {
                this.providerConnected = true;
                this.providerOpenedAt = new Date().toISOString();
                this.onStatusChange('CONNECTED');
              } else if (msg.payload?.status === 'CLOSED') {
                this.providerConnected = false;
                this.providerClosedAt = new Date().toISOString();
                this.onStatusChange('IDLE');
              }
              break;
            case 'live.audio.output':
              if (msg.payload?.data && this.audioOutput) {
                this.audioChunksReceivedFromProvider++;
                this.audioBytesReceived += Math.round((msg.payload.data.length * 3) / 4);
                this.onStatusChange('SPEAKING');
                this.audioOutput.playBase64PCM(msg.payload.data);
                this.audioChunksPlayed++;
              }
              break;
            case 'live.transcript.delta':
              if (msg.payload?.text) {
                this.currentTranscript += msg.payload.text;
                const partial = parseCaddyOutput(this.currentTranscript, `advice-${this.startTime}`, this.fallbackUsed ? 'REST_FALLBACK' : 'GEMINI_LIVE');
                this.currentAdvice = normalizeAdvice(partial);
                if (this.onAdviceChange) this.onAdviceChange(this.currentAdvice);
              }
              break;
            case 'live.interrupted':
              if (this.audioOutput) {
                this.audioOutput.interrupt();
              }
              break;
            case 'live.error':
              this.providerError = msg.payload?.message || 'Server error';
              this.onStatusChange('FAILED_RETRYABLE', this.providerError);
              this.saveReceipt();
              break;
          }
        } catch (e) {
          console.error('Failed to parse server message', e);
        }
      };

      this.ws.onerror = () => {
        this.onStatusChange('FAILED_RETRYABLE', 'Gemini Live WebSocket connection failed.');
        this.saveReceipt();
      };

      this.ws.onclose = () => {
        if (this.providerConnected) {
          this.providerClosedAt = new Date().toISOString();
          this.providerConnected = false;
        }
        this.onStatusChange('IDLE');
        this.saveReceipt();
        this.cleanup();
      };

    } catch (e: any) {
      this.onStatusChange('FAILED_RETRYABLE', e.message);
      this.saveReceipt();
      this.cleanup();
    }
  }

  private buildReceipt(): LiveSessionReceipt {
       const avgBytes = this.videoFramesSent > 0 ? Math.round(this.totalFramePayloadBytes / this.videoFramesSent) : 0;
       return {
         sessionId: `session-receipt-${Date.now()}`,
         startedAt: new Date(this.startTime || Date.now()).toISOString(),
         endedAt: new Date().toISOString(),
         finalLiveState: this.currentStatus,
         durationSeconds: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
         
         providerModel: this.providerConfig?.liveModel || 'unknown',
         providerConnected: this.providerConnected,
         providerOpenedAt: this.providerOpenedAt,
         providerClosedAt: this.providerClosedAt,
         providerError: this.providerError,
         
         micPermissionState: this.micPermission,
         cameraPermissionState: this.videoPermission,
         
         audioChunksCaptured: this.audioChunksCaptured,
         audioChunksEncoded: this.audioChunksEncoded,
         audioChunksSent: this.audioChunksSent,
         audioChunksAcceptedByServer: this.audioChunksAcceptedByServer,
         audioChunksForwardedToProvider: this.audioChunksForwardedToProvider,
         audioChunksReceivedFromProvider: this.audioChunksReceivedFromProvider,
         audioChunksPlayed: this.audioChunksPlayed,
         audioBytesSent: this.audioBytesSent,
         audioBytesReceived: this.audioBytesReceived,
         audioInputSampleRate: this.audioInputSampleRate,
         audioOutputSampleRate: this.audioOutputSampleRate,
         audioStartedAt: this.audioStartedAt,
         audioStoppedAt: this.audioStoppedAt,
         audioErrors: this.errors,
         
         videoFramesCaptured: this.videoFramesCaptured,
         videoFramesSent: this.videoFramesSent,
         videoFramesAcceptedByServer: this.videoFramesSent,
         videoFramesRejectedByServer: 0,
         videoStartedAt: this.videoStartedAt,
         videoStoppedAt: this.videoStoppedAt,
         videoErrors: this.videoErrors,
         
         adviceId: this.currentAdvice?.adviceId || null,
         fallbackUsed: this.fallbackUsed,
         contextCardHash: this.contextCardHash,
         blockedClaims: [],
         dataGaps: [],
         evidenceIds: [],
         errors: this.errors,
         qaFlags: [],

         videoEnabled: this.videoEnabled,
         maxFramePayloadBytes: this.maxFramePayloadBytes,
         averageFramePayloadBytes: avgBytes
       };
  }

  private saveReceipt() {
    if (this.startTime) {
       const receipt = this.buildReceipt();
       saveLiveReceipt(receipt);
       this.startTime = null;
    }
  }

  getReceipt(): LiveSessionReceipt {
      return this.buildReceipt();
  }

  private cleanup() {
    if (this.audioInput) {
      this.audioInput.stop();
      this.audioInput = null;
    }
    if (this.audioOutput) {
      this.audioOutput.stop();
      this.audioOutput = null;
    }
    if (this.frameCapture) {
      this.frameCapture.stop();
      this.frameCapture = null;
    }
    if (this.videoInput) {
      this.videoInput.stop();
      this.videoInput = null;
      if (!this.videoStoppedAt) {
          this.videoStoppedAt = new Date().toISOString();
      }
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: ClientLiveMessage = { type: 'live.stop' };
      this.ws.send(JSON.stringify(msg));
    }
    this.saveReceipt();
    this.cleanup();
    this.onStatusChange('IDLE');
  }

  getStream(): MediaStream | null {
    return this.videoInput?.stream || null;
  }

  getMetrics() {
    return {
      framesSent: this.videoFramesSent,
      maxPayloadBytes: this.maxFramePayloadBytes,
      averagePayloadBytes: this.videoFramesSent > 0 ? this.totalFramePayloadBytes / this.videoFramesSent : 0,
      micPerm: this.micPermission,
      camPerm: this.videoPermission,
      providerConnected: this.providerConnected,
      providerModel: this.providerConfig?.liveModel || 'unknown',
      providerTextModel: this.providerConfig?.textModel || 'unknown',
      providerConfigSource: this.providerConfig?.configSource || 'unknown',
      providerLiveEnabled: this.providerConfig?.liveEnabled ?? false,
      providerHasApiKey: this.providerConfig?.hasApiKey ?? false,
      providerError: this.providerError,
      fallbackUsed: this.fallbackUsed
    };
  }
}
