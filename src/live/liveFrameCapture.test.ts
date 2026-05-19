import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveFrameCapture } from './liveFrameCapture';

describe('LiveFrameCapture', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(global, 'window', {
            value: {
                requestAnimationFrame: vi.fn((cb) => global.setTimeout(() => cb(performance.now()), 16)),
                cancelAnimationFrame: vi.fn((id) => global.clearTimeout(id))
            },
            writable: true
        });
        
        Object.defineProperty(global, 'document', {
            value: {
                visibilityState: 'visible',
                createElement: vi.fn().mockImplementation((tag) => {
                    if (tag === 'canvas') {
                        return {
                            width: 0,
                            height: 0,
                            getContext: vi.fn().mockReturnValue({
                                drawImage: vi.fn()
                            }),
                            toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,AABBCCDDEE')
                        };
                    }
                })
            },
            writable: true
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('VIDEO-004 frame metadata is produced', () => {
        let output = '';
        const capture = new LiveFrameCapture((data) => output = data, 0.5);
        capture.start({ videoWidth: 640, videoHeight: 360 } as any);
        expect(output).toBe('AABBCCDDEE');
    });

    it('VIDEO-005 frame throttling is enforced', () => {
        const cb = vi.fn();
        const capture = new LiveFrameCapture(cb, 0.5); // 0.5fps = 1 per 2 seconds
        capture.start({ videoWidth: 640, videoHeight: 360 } as any);
        expect(window.requestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));
    });

    it('VIDEO-008 stop closes frame timer', () => {
        const capture = new LiveFrameCapture(vi.fn(), 0.5);
        capture.start({ videoWidth: 640, videoHeight: 360 } as any);
        capture.stop();
        expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });
});
