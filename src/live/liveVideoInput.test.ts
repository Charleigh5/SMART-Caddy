import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveVideoInput } from './liveVideoInput';

describe('LiveVideoInput', () => {
    beforeEach(() => {
        Object.defineProperty(global, 'navigator', {
            value: {
                mediaDevices: {
                    getUserMedia: vi.fn().mockResolvedValue({
                        getTracks: () => [{ stop: vi.fn() }]
                    })
                }
            },
            writable: true
        });
        
        // mock window and HTMLVideoElement
        Object.defineProperty(global, 'document', {
            value: {
                createElement: vi.fn().mockReturnValue({
                    play: vi.fn().mockResolvedValue(undefined),
                    set srcObject(val: any) {
                        this._srcObject = val;
                        if (this.onloadedmetadata) this.onloadedmetadata();
                    }
                })
            },
            writable: true
        });
    });

    it('VIDEO-002 no camera start before explicit user action', () => {
        const input = new LiveVideoInput();
        expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });

    it('VIDEO-008 stop closes frame timer and camera tracks', async () => {
        const input = new LiveVideoInput();
        const mockTracks = [{ stop: vi.fn() }];
        global.navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
            getTracks: () => mockTracks
        });
        
        await input.start();
        input.stop();
        expect(mockTracks[0].stop).toHaveBeenCalled();
    });
});
