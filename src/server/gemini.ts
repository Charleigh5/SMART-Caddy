import { GoogleGenAI, Type, Schema } from "@google/genai";

let ai: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

const swingAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cameraView: { type: Type.STRING },
    setupScore: { type: Type.INTEGER },
    visibilityQuality: { type: Type.STRING },
    detectedPhases: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    topObservations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    primaryCorrection: { type: Type.STRING },
    drill: { type: Type.STRING },
    nextRecordingInstruction: { type: Type.STRING },
    confidence: { type: Type.STRING },
    dataGaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    unsupportedMetrics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    tempoAnalysis: {
      type: Type.OBJECT,
      properties: {
        backswingTimeMs: { type: Type.INTEGER },
        downswingTimeMs: { type: Type.INTEGER },
        ratio: { type: Type.NUMBER },
        description: { type: Type.STRING }
      },
      required: ["backswingTimeMs", "downswingTimeMs", "ratio", "description"]
    }
  },
  required: [
    "cameraView", "setupScore", "visibilityQuality", "detectedPhases", 
    "topObservations", "primaryCorrection", "drill", 
    "nextRecordingInstruction", "confidence", "dataGaps", "unsupportedMetrics", "tempoAnalysis"
  ]
};

export async function analyzeSwing(videoInstructions: string, viewAngle: string) {
  const model = getGemini();
  const response = await model.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: "user",
        parts: [
          { text: `Analyze this golf swing (View: ${viewAngle}). Instructions/Notes: ${videoInstructions}` }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: swingAnalysisSchema
    }
  });
  return JSON.parse(response.text || '{}');
}

const caddySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shotRecommendation: { type: Type.STRING },
    targetStrategy: { type: Type.STRING },
    missStrategy: { type: Type.STRING },
    clubThought: { type: Type.STRING },
    confidence: { type: Type.STRING },
    dataGaps: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["shotRecommendation", "targetStrategy", "missStrategy", "clubThought", "confidence", "dataGaps"]
};

export async function getCaddyAdvice(context: string) {
  const model = getGemini();
  const response = await model.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: "user",
        parts: [
          { text: `Act as a professional golf caddy. Here is the context: ${context}\nGive short, concise advice.` }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: caddySchema
    }
  });
  return JSON.parse(response.text || '{}');
}

const scorecardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    courseName: { type: Type.STRING },
    cityOrGeography: { type: Type.STRING, description: "Any city or geographical identifying text" },
    logoDescription: { type: Type.STRING, description: "Detailed description of any logo or identifying icon that represents the golf course brand" },
    visualFeatures: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Visual map-based features, terrain, and aesthetics noted on the scorecard" 
    },
    teeSet: { type: Type.STRING },
    holes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.INTEGER },
          par: { type: Type.INTEGER },
          yardage: { type: Type.INTEGER },
          handicap: { type: Type.INTEGER },
          layoutDescription: { type: Type.STRING, description: "Layout in relation to the tee box and actual hole details if present" }
        },
        required: ["number", "par"]
      }
    },
    uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } },
    aestheticPrompt: { type: Type.STRING, description: "A highly detailed prompt for an image generation model to recreate a visually enhanced, pristine, and centered course logo or map." }
  },
  required: ["courseName", "teeSet", "holes", "uncertainFields"]
};

export async function parseScorecard(images: { data: string, mimeType: string }[]) {
  const model = getGemini();
  const inlineDataParts = images.map(img => ({
    inlineData: { data: img.data, mimeType: img.mimeType }
  }));
  
  const response = await model.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: "user",
        parts: [
          { text: `Parse this sequence of golf scorecard images. Extract the full course details, hole-by-hole scoring and handicap data, map layouts, geographical text, and describe the course's logo or icons. Build a pristine digital representation.` },
          ...inlineDataParts
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: scorecardSchema
    }
  });
  return JSON.parse(response.text || '{}');
}

const courseAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    difficultyRating: { type: Type.STRING },
    challengingHoles: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER }
    },
    strategyTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["summary", "difficultyRating", "challengingHoles", "strategyTips"]
};

export async function analyzeCourse(courseData: string) {
  const model = getGemini();
  const response = await model.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: "user",
        parts: [
          { text: `Analyze the following golf course data and provide a summary of the course difficulty, identify potential challenging holes, and give some basic strategic tips.\nCourse Data:\n${courseData}` }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: courseAnalysisSchema
    }
  });
  return JSON.parse(response.text || '{}');
}

