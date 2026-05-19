import { describe, it, expect, vi } from 'vitest';
import { handleLiveGeminiProxy } from './liveGeminiProxy';

global.process.env.GEMINI_API_KEY = "mock_key";
vi.mock('./gemini', () => ({
    getGemini: vi.fn().mockReturnValue({})
}));

describe('LiveGeminiProxy', () => {
    it('AUDIO-005 server rejects malformed audio payload', async () => {
        let sentMessage: any = null;
        let isClosed = false;
        const mockWs: any = {
            readyState: 1, // OPEN
            send: vi.fn((data) => sentMessage = JSON.parse(data)),
            close: vi.fn(() => isClosed = true),
            on: vi.fn((evt, cb) => {
                if (evt === 'message') {
                    // simulate sending a malformed message
                    const malformed = {
                        type: 'live.audio.input',
                        payload: { data: 12345 } // should be string
                    };
                    cb(JSON.stringify(malformed));
                }
            })
        };
        
        // Mock getGemini failure or success not strictly needed if we just check rejection logic 
        // since handleLiveGeminiProxy attaches the listener
        
        await handleLiveGeminiProxy(mockWs, { url: '/' });
        
        // Trigger the message
        const messageCb = mockWs.on.mock.calls.find((c: any) => c[0] === 'message')[1];
        
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await messageCb(JSON.stringify({ type: 'live.audio.input', payload: { data: 12345 } }));
        
        expect(consoleWarnSpy).toHaveBeenCalledWith("Audio frame rejected: malformed payload");
        consoleWarnSpy.mockRestore();
    });

    it('VIDEO-006 oversized frame rejected before provider forwarding', async () => {
        let sentMessage: any = null;
        const mockWs: any = {
            readyState: 1,
            send: vi.fn(),
            close: vi.fn(),
            on: vi.fn((evt, cb) => {
                if (evt === 'message') {
                    const oversized = {
                        type: 'live.video.frame',
                        payload: { data: 'A'.repeat(5 * 1024 * 1024) } // > 4MB
                    };
                    cb(JSON.stringify(oversized));
                }
            })
        };
        
        global.process.env.GEMINI_API_KEY = "mock_key";
        await handleLiveGeminiProxy(mockWs, { url: '/' });
        
        const messageCb = mockWs.on.mock.calls.find((c: any) => c[0] === 'message')[1];
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await messageCb(JSON.stringify({ type: 'live.video.frame', payload: { data: 'A'.repeat(5 * 1024 * 1024) } }));
        expect(consoleWarnSpy).toHaveBeenCalledWith("Video frame rejected: oversized payload");
        consoleWarnSpy.mockRestore();
    });

    it('VIDEO-007 malformed frame rejected safely', async () => {
        const mockWs: any = {
            readyState: 1,
            send: vi.fn(),
            close: vi.fn(),
            on: vi.fn()
        };
        
        await handleLiveGeminiProxy(mockWs, { url: '/' });
        const messageCb = mockWs.on.mock.calls.find((c: any) => c[0] === 'message')[1];
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await messageCb(JSON.stringify({ type: 'live.video.frame', payload: { data: 12345 } }));
        expect(consoleWarnSpy).toHaveBeenCalledWith("Video frame rejected: malformed payload");
        consoleWarnSpy.mockRestore();
    });
});
