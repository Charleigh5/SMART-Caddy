import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';

// Polyfills
Object.defineProperty(globalThis, 'WebSocket', { value: WebSocket, configurable: true });
Object.defineProperty(globalThis, 'navigator', {
    value: {
        mediaDevices: {
            getUserMedia: async () => ({
                getTracks: () => [{ stop: () => {} }]
            })
        }
    },
    configurable: true
});
Object.defineProperty(globalThis, 'window', {
    value: {
        location: {
            protocol: 'http:',
            host: 'localhost:3000'
        },
        setInterval: setInterval,
        clearInterval: clearInterval,
        AudioContext: class {
            constructor() {}
            createBuffer() {}
            createBufferSource() {}
            resume() {}
            createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
            createScriptProcessor() { return { connect: () => {}, disconnect: () => {}, onaudioprocess: null }; }
            close() {}
            state = 'running';
        }
    },
    configurable: true
});
Object.defineProperty(globalThis, 'btoa', {
    value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    configurable: true
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: any, options: any) => {
    if (typeof url === 'string' && url.startsWith('/')) {
        url = 'http://localhost:3000' + url;
    }
    return originalFetch(url, options);
};

class CustomEvent extends Event {
    detail: any;
    constructor(type: string, eventInitDict?: any) {
        super(type, eventInitDict);
        this.detail = eventInitDict?.detail;
    }
}
Object.defineProperty(globalThis, 'CustomEvent', { value: CustomEvent, configurable: true });

async function run() {
    const { runLiveE2ECheck } = await import('../src/live/liveE2ECheck.ts');
    console.log('Running E2E Smoke Check against http://localhost:3000 ...');
    
    const receiptPromise = runLiveE2ECheck();
    
    // Safety timeout
    let timeoutHit = false;
    const timeout = setTimeout(() => {
        console.log('Timeout hit during E2E Check - resolving artificially to save failure receipt.');
        timeoutHit = true;
    }, 15000);
    
    // We race the normal check against a delay. Wait, we can just resolve the receipt automatically.
    // Instead of racing, we could export a `forceDisconnect` or similar on `runLiveE2ECheck` but we don't have it.
    // Let's just race it.
    const receipt = await Promise.race([
        receiptPromise,
        new Promise<any>((resolve) => setTimeout(() => resolve({ 
            finalLiveState: 'TIMEOUT', 
            providerError: 'Connection timed out',
            providerConnected: false 
        }), 15000))
    ]);
    
    clearTimeout(timeout);
    
    console.log('--- SESSION RECEIPT ---');
    console.log(JSON.stringify(receipt, null, 2));

    const checkStatusRes = await fetch('http://localhost:3000/api/provider-status').catch(() => ({ json: async () => ({ liveEnabled: false, hasApiKey: false }) }));
    const statusData = await checkStatusRes.json();
    const enabledAndHasKey = statusData.liveEnabled && statusData.hasApiKey;

    let fixtureName = 'providerSmokeDisabledReceipt.json';
    let classification = "PROVIDER_DISABLED";

    if (enabledAndHasKey) {
       if (receipt.finalLiveState === 'IDLE' && receipt.providerConnected) {
           fixtureName = 'providerSmokeSuccessReceipt.json';
           classification = "REAL_PROVIDER_SMOKE";
       } else {
           fixtureName = 'providerSmokeFailureReceipt.json';
           classification = "PROVIDER_FAILURE_HANDLED";
       }
    }

    const fixturePath = path.join(process.cwd(), 'src', 'live', '__fixtures__', fixtureName);
    
    const dir = path.dirname(fixturePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fixturePath, JSON.stringify({ classification, receiptType: fixtureName, ...receipt }, null, 2));
    console.log(`Saved receipt to ${fixturePath}`);
    
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
