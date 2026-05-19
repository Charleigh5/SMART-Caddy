export class LiveAudioOutput {
  private audioContext: AudioContext;
  private queue: AudioBuffer[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
  }

  async playBase64PCM(base64Data: string) {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // We expect 16-bit PCM (little endian)
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    this.queue.push(audioBuffer);
    this.scheduleNext();
  }

  private scheduleNext() {
    if (this.isPlaying || this.queue.length === 0) return;
    this.isPlaying = true;

    const buffer = this.queue.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    if (this.nextStartTime < this.audioContext.currentTime) {
      this.nextStartTime = this.audioContext.currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    source.onended = () => {
      this.isPlaying = false;
      this.scheduleNext();
    };
  }

  interrupt() {
    this.queue = [];
    this.nextStartTime = 0;
    this.isPlaying = false;
    // To immediately stop currently playing source, we'd need to keep a reference to current source,
    // but suspending and recreating is easier for a simplified robust interruption.
    this.audioContext.close();
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
  }

  stop() {
    this.queue = [];
    this.audioContext.close();
  }
}
