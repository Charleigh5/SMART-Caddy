export class LiveFrameCapture {
  private timer: number | null = null;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private onFrameEncoded: (base64Data: string) => void;
  private frameIntervalMs: number;
  private lastFrameTime: number = 0;

  constructor(onFrameEncoded: (base64Data: string) => void, fps: number = 0.5) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.context = this.canvas.getContext('2d');
    this.onFrameEncoded = onFrameEncoded;
    this.frameIntervalMs = 1000 / fps; // 1 frame every 2 seconds by default
  }

  start(videoElement: HTMLVideoElement) {
    this.stop();
    this.captureFrame(videoElement); // initial frame
    this.lastFrameTime = performance.now();
    
    const loop = (timestamp: number) => {
      this.timer = window.requestAnimationFrame(loop);
      
      if (document.visibilityState !== 'visible') return;

      if (timestamp - this.lastFrameTime >= this.frameIntervalMs) {
        this.lastFrameTime = timestamp;
        this.captureFrame(videoElement);
      }
    };
    
    this.timer = window.requestAnimationFrame(loop);
  }

  private captureFrame(videoElement: HTMLVideoElement) {
    if (!this.context || videoElement.videoWidth === 0) return;
    
    const maxDim = 640;
    let w = videoElement.videoWidth;
    let h = videoElement.videoHeight;
    if (w > maxDim || h > maxDim) {
       if (w > h) {
          h = Math.floor((h / w) * maxDim);
          w = maxDim;
       } else {
          w = Math.floor((w / h) * maxDim);
          h = maxDim;
       }
    }
    
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;

    this.context.drawImage(videoElement, 0, 0, w, h);
    
    // low quality JPEG to save bandwidth
    const base64Url = this.canvas.toDataURL('image/jpeg', 0.6);
    const b64Data = base64Url.split(',')[1];
    if (b64Data) {
      this.onFrameEncoded(b64Data);
    }
  }

  stop() {
    if (this.timer !== null) {
      window.cancelAnimationFrame(this.timer);
      this.timer = null;
    }
  }
}
