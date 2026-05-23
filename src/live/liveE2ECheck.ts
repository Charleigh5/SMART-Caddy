import { LiveGeminiClient } from './liveGeminiClient';
import { LiveSessionReceipt } from './liveSessionState';

export async function runLiveE2ECheck(): Promise<LiveSessionReceipt> {
  return new Promise((resolve) => {
    let statusLog: string[] = [];
    const client = new LiveGeminiClient((status, error) => {
      statusLog.push(status + (error ? ": " + error : ""));
      console.log('STATUS LOG:', statusLog);
      if (status === 'CONNECTED') {
         // E2E-003 CONNECTED appears only after provider-ready confirmation
         
         // Send a prompt to test transcript normalization into CaddyAdvice (E2E-006)
         if (client['ws'] && client['ws'].readyState === WebSocket.OPEN) {
             client['ws'].send(JSON.stringify({
                 type: 'live.text.input',
                 payload: { text: 'Test Caddy Protocol' }
             }));
         }
         
         client.disconnect(); // E2E-009 stop closes all resources
      }
      
      if (status === 'IDLE' || status === 'FAILED_FINAL' || status === 'FAILED_RETRYABLE') {
         console.log('RESOLVING:', status);
         resolve(client.getReceipt());
      }
    });

    client.connect(false).catch(err => {
       statusLog.push("CONNECT_ERROR: " + err.message);
       resolve(client.getReceipt());
    });
  });
}
