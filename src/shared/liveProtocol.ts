export type ClientLiveMessageType =
  | 'live.start'
  | 'live.audio.input'
  | 'live.text.input'
  | 'live.video.frame'
  | 'live.stop';

export interface ClientLiveMessage {
  type: ClientLiveMessageType;
  payload?: any;
}

export type ServerLiveMessageType =
  | 'live.status'
  | 'live.audio.output'
  | 'live.transcript.delta'
  | 'live.interrupted'
  | 'live.receipt'
  | 'live.error'
  | 'live.parsed.advice';

export interface ServerLiveMessage {
  type: ServerLiveMessageType;
  payload?: any;
}
