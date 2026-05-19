import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { WebSocketServer } from "ws";
import { analyzeSwing, getCaddyAdvice, parseScorecard, analyzeCourse, getGemini } from "./src/server/gemini";
import { Modality } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/provider-status", async (req, res) => {
    const { getProviderConfig } = await import('./src/server/liveProviderConfig.js');
    res.json(getProviderConfig());
  });

  app.post("/api/gemini/swing-analysis", async (req, res) => {
    try {
      const { videoInstructions, viewAngle } = req.body;
      const analysis = await analyzeSwing(videoInstructions || '', viewAngle || 'UNKNOWN');
      res.json(analysis);
    } catch (err: any) {
      console.error("Swing analysis error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/caddy-advice", async (req, res) => {
    try {
      const { context } = req.body;
      const advice = await getCaddyAdvice(context || '');
      res.json(advice);
    } catch (err: any) {
      console.error("Caddy advice error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/scorecard-parse", async (req, res) => {
    try {
      const { images } = req.body;
      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ error: "Missing or invalid images array" });
      }
      
      const scorecard = await parseScorecard(images);
      res.json(scorecard);
    } catch (err: any) {
      console.error("Scorecard parse error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/generate-course-image", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        }
      });
      
      let imageUrl = null;
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      
      if (!imageUrl) {
        throw new Error("No image generated");
      }
      
      res.json({ imageUrl });
    } catch (err: any) {
      console.error("Image generation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/course-analysis", async (req, res) => {
    try {
      const { courseData } = req.body;
      const analysis = await analyzeCourse(courseData || '');
      res.json(analysis);
    } catch (err: any) {
      console.error("Course analysis error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini/tts", async (req, res) => {
    try {
      const { text } = req.body;
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ audio: base64Audio });
      } else {
        res.status(500).json({ error: "Failed to generate audio" });
      }
    } catch (err: any) {
      console.error("TTS error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  const server = http.createServer(app);

  // WebSocket Server for Gemini Live
  const wss = new WebSocketServer({ server, path: '/api/live/gemini' });
  
  wss.on('connection', async (ws, req) => {
    console.log('Client connected to Gemini Live WebSocket');
    const { handleLiveGeminiProxy } = await import('./src/server/liveGeminiProxy.js');
    handleLiveGeminiProxy(ws, req);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
