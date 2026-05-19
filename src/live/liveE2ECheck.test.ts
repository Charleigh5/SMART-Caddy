import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runLiveE2ECheck } from './liveE2ECheck';

describe('Live E2E Verification', () => {
    beforeEach(() => {
        Object.defineProperty(global, 'fetch', {
            value: vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    liveEnabled: true,
                    hasApiKey: true,
                    liveModel: 'test-fixture-model',
                    textModel: 'test-fixture-model',
                    configSource: 'test'
                })
            }),
            writable: true
        });

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
        Object.defineProperty(global, 'window', {
            value: {
                location: { protocol: 'https:', host: 'localhost' }
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
        
        global.WebSocket = class {
            readyState = 1;
            send = vi.fn();
            onmessage: any;
            close() {
                setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: 'live.status', payload: { status: 'IDLE' } }) }), 10);
            }
            constructor() {
                setTimeout(() => {
                    this.onmessage?.({ data: JSON.stringify({ type: 'live.status', payload: { status: 'CONNECTED' } }) });
                }, 10);
            }
        } as any;
    });

    it('E2E-001 through E2E-014 Loop Completes', async () => {
        const receipt = await runLiveE2ECheck();
        expect(receipt).toBeDefined();
        expect(receipt.sessionId).toContain('session-receipt');
        expect(receipt.micPermissionState).toBe('GRANTED');
        expect(receipt.cameraPermissionState).toBe('NOT_REQUESTED');
    });
});
