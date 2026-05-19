export interface FramePulseEvent {
  timestamp: number;
}

const observers: ((event: FramePulseEvent) => void)[] = [];

export const telemetry = {
  emitFramePulsed: () => {
    const ev = { timestamp: Date.now() };
    observers.forEach(fn => fn(ev));
  },
  onFramePulsed: (fn: (event: FramePulseEvent) => void) => {
    observers.push(fn);
    return () => {
      const idx = observers.indexOf(fn);
      if (idx > -1) observers.splice(idx, 1);
    };
  }
};
