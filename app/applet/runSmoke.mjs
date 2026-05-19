import WebSocket from "ws";

const run = () => {
    const ws = new WebSocket('ws://localhost:3000/api/live/gemini');

    ws.on('open', () => {
        console.log('Connected to ws server.');
        ws.send(JSON.stringify({ type: 'live.start', payload: { model: 'test' } }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log('RECEIVE:', msg.type, msg.payload);
        if (msg.type === 'live.status' && msg.payload.status === 'CONNECTED') {
            console.log('Provider opened!');
            setTimeout(() => {
                ws.send(JSON.stringify({ type: 'live.stop' }));
            }, 1000);
        }
        if (msg.type === 'live.receipt') {
            console.log('Got Receipt!', msg.payload);
            ws.close();
            process.exit(0);
        }
        if (msg.type === 'live.error') {
            console.log('Got Error!', msg.payload);
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', (err) => {
        console.error('WS Error:', err);
        process.exit(1);
    });

    setTimeout(() => {
        console.log('Timeout');
        process.exit(1);
    }, 10000);
}

run();
