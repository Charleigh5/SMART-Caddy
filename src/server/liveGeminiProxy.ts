import { WebSocket } from "ws";
import { getGemini } from "./gemini";
import { ClientLiveMessage, ServerLiveMessage } from "../shared/liveProtocol";
import { Modality } from "@google/genai";

export async function handleLiveGeminiProxy(ws: WebSocket, req: any) {
  const { getProviderConfig, setLastError } = await import('./liveProviderConfig');
  const config = getProviderConfig();

  let extraContext = '';
  try {
    if (req.url) {
      const urlObj = new URL(req.url, 'http://localhost');
      const contextStr = urlObj.searchParams.get('context');
      if (contextStr) {
         extraContext = `\n\nCURRENT CONTEXT: ${contextStr}`;
      }
    }
  } catch (e) {
    console.error('Failed to parse URL params for WS', e);
  }

  if (!config.liveEnabled) {
    const msg: ServerLiveMessage = { type: 'live.error', payload: { message: "Live usage is disabled via configuration" } };
    ws.send(JSON.stringify(msg));
    ws.close();
    return;
  }

  // Ensure Gemini is available
  if (!config.hasApiKey) {
    const msg: ServerLiveMessage = { type: 'live.error', payload: { message: "GEMINI_API_KEY not configured on server" } };
    ws.send(JSON.stringify(msg));
    ws.close();
    return;
  }

  let ai;
  try {
    ai = getGemini();
  } catch (err: any) {
    const msg: ServerLiveMessage = { type: 'live.error', payload: { message: err.message } };
    ws.send(JSON.stringify(msg));
    ws.close();
    return;
  }

  let session: any = null;
  let isConnecting = false;

  const sendMessage = (msg: ServerLiveMessage) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  ws.on('message', async (data) => {
    try {
      const parsed: ClientLiveMessage = JSON.parse(data.toString());
      
      switch (parsed.type) {
        case 'live.start':
          if (session || isConnecting) return;
          isConnecting = true;
          
          try {
            session = await ai.live.connect({
              model: config.liveModel,
              callbacks: {
                onmessage: (message: any) => {
                  const parts = message.serverContent?.modelTurn?.parts;
                  if (parts) {
                    let textContent = '';
                    for (const p of parts) {
                      if (p.inlineData?.data) {
                        sendMessage({ type: 'live.audio.output', payload: { data: p.inlineData.data } });
                      }
                      if (p.text) {
                        textContent += p.text;
                      }
                    }
                    if (textContent) {
                      sendMessage({ type: 'live.transcript.delta', payload: { text: textContent } });
                    }
                  }
                  if (message.serverContent?.interrupted) {
                    sendMessage({ type: 'live.interrupted' });
                  }
                },
                onclose: () => {
                  sendMessage({ type: 'live.status', payload: { status: 'CLOSED' } });
                },
                onerror: (e: any) => {
                  setLastError(e.message || 'Unknown provider error');
                  sendMessage({ type: 'live.error', payload: { message: e.message || 'Unknown provider error' } });
                }
              },
              config: {
                responseModalities: [Modality.AUDIO, Modality.TEXT],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
                },
                systemInstruction: "You are an AI Golf Caddy and real-time swing coach. Be concise and helpful in an audio conversation." + extraContext,
              },
            });
            isConnecting = false;
            sendMessage({ type: 'live.status', payload: { status: 'CONNECTED' } });
          } catch (e: any) {
            isConnecting = false;
            setLastError(e.message || "Failed to connect to provider");
            sendMessage({ type: 'live.error', payload: { message: e.message || "Failed to connect to provider" } });
            session = null;
          }
          break;

        case 'live.audio.input':
          if (!parsed.payload?.data || typeof parsed.payload.data !== 'string') {
              console.warn("Audio frame rejected: malformed payload");
              break;
          }
          if (session && parsed.payload?.data) {
            session.sendRealtimeInput({
              audio: { data: parsed.payload.data, mimeType: "audio/pcm;rate=16000" },
            });
          }
          break;

        case 'live.video.frame':
          if (!parsed.payload?.data || typeof parsed.payload.data !== 'string') {
              console.warn("Video frame rejected: malformed payload");
              break;
          }
          if (parsed.payload.data.length > 4 * 1024 * 1024) {
              console.warn("Video frame rejected: oversized payload");
              break;
          }
          if (session && parsed.payload?.data) {
            session.sendRealtimeInput({
              video: { data: parsed.payload.data, mimeType: "image/jpeg" }, // or image/webp
            });
          }
          break;

        case 'live.text.input':
          if (session && parsed.payload?.text) {
             session.send({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{ text: parsed.payload.text }]
                }],
                turnComplete: true
              }
            });
          }
          break;

        case 'live.stop':
          if (session) {
            try { session.close(); } catch(e) {}
            session = null;
          }
          sendMessage({ type: 'live.receipt', payload: { id: `live-receipt-${Date.now()}` } });
          break;
      }
    } catch(e) {
      console.error("Invalid client message", e);
    }
  });

  ws.on('close', () => {
    if (session) {
      try { session.close(); } catch(e) {}
      session = null;
    }
  });
}
