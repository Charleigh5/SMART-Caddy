import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveAudioOutput } from './liveAudioOutput';

describe('LiveAudioOutput', () => {
    beforeEach(() => {
        Object.defineProperty(global, 'window', {
            value: {},
            writable: true
        });
        (global.window as any).AudioContext = class {
            destination = {};
            state = 'running';
            currentTime = 0;
            createBuffer = vi.fn().mockReturnValue({
                getChannelData: vi.fn().mockReturnValue(new Float32Array(100)),
                duration: 0.1
            });
            createBufferSource = vi.fn().mockReturnValue({
                buffer: null,
                connect: vi.fn(),
                start: vi.fn(),
                onended: null
            });
            resume = vi.fn().mockResolvedValue(undefined);
            close = vi.fn().mockResolvedValue(undefined);
        };
        global.atob = vi.fn().mockReturnValue('AABBCC');
    });

    it('AUDIO-008 audio output message handler works', async () => {
        const output = new LiveAudioOutput();
        await output.playBase64PCM('AABBCC');
        expect(global.atob).toHaveBeenCalled();
    });

    it('AUDIO-009 stop closes audioContext resources', () => {
        const output = new LiveAudioOutput();
        const closeSpy = vi.spyOn(output['audioContext'], 'close');
        output.stop();
        expect(closeSpy).toHaveBeenCalled();
    });
});
