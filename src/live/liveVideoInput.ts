export class LiveVideoInput {
  stream: MediaStream | null = null;
  videoElement: HTMLVideoElement;

  constructor() {
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true; // prevent feedback
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 360 }
      } 
    });
    this.videoElement.srcObject = this.stream;
    return new Promise<void>((resolve, reject) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play().then(resolve).catch(reject);
      };
      this.videoElement.onerror = reject;
      // Safety timeout
      setTimeout(resolve, 3000);
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.videoElement.srcObject = null;
  }
}
