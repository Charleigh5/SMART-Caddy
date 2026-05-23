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

const aerialLayoutSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    courseName: { type: Type.STRING },
    detectedHoles: { type: Type.INTEGER, description: "Total number of golf holes detected in this page layout map" },
    holesLayout: {
      type: Type.ARRAY,
      description: "Hole-by-hole structural layout properties with coordinates scaled as percentages (0 to 100) representing positions on the overall image",
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.INTEGER, description: "Hole number" },
          teeBox: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Tee box X coordinate percentage (0-100)" },
              y: { type: Type.NUMBER, description: "Tee box Y coordinate percentage (0-100)" }
            },
            required: ["x", "y"]
          },
          fairwayPoints: {
            type: Type.ARRAY,
            description: "List of coordinates marking the path layout of the fairway from tee to green",
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            }
          },
          green: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Green center X percentage (0-100)" },
              y: { type: Type.NUMBER, description: "Green center Y percentage (0-100)" }
            },
            required: ["x", "y"]
          },
          flagLocation: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Flagstick hole marker location percentage (0-100)" },
              y: { type: Type.NUMBER, description: "Flagstick hole marker location percentage (0-100)" }
            },
            required: ["x", "y"]
          },
          bunkers: {
            type: Type.ARRAY,
            description: "Co-ordinates of detected sand traps / bunkers associated with this hole",
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER, description: "Bunker center X percentage (0-100)" },
                y: { type: Type.NUMBER, description: "Bunker center Y percentage (0-100)" },
                radius: { type: Type.NUMBER, description: "Aesthetic radius mapping size percentage (typically 1 to 5)" }
              },
              required: ["x", "y", "radius"]
            }
          },
          waterAreas: {
            type: Type.ARRAY,
            description: "Coordinates of lakes, rivers, or ocean water hazards near this hole path",
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                radius: { type: Type.NUMBER, description: "Water coverage size percentage (typically 2 to 10)" }
              },
              required: ["x", "y", "radius"]
            }
          },
          trees: {
            type: Type.ARRAY,
            description: "Coordinate spots representing notable clusters or single obstacles in target sights",
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"]
            }
          },
          layoutDescription: { type: Type.STRING, description: "Meticulous text analysis of the colors, shape outlines, endpoints, dogleg types, hazards, and distances found from this layout slice." },
          mainColors: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Primary colors detected inside this specific segment (e.g., lightest green, deep green, brown, light sand, blue, grey)" 
          },
          individualHoleCropPrompt: { type: Type.STRING, description: "Strict prompt detailing visual features for automatic image rendering corresponding exactly to this hole's layout." }
        },
        required: ["number", "teeBox", "green", "flagLocation", "bunkers", "waterAreas", "trees", "layoutDescription", "mainColors", "individualHoleCropPrompt"]
      }
    }
  },
  required: ["courseName", "detectedHoles", "holesLayout"]
};

export async function analyzeAerialLayout(image: { data: string, mimeType: string }) {
  const model = getGemini();
  const response = await model.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: "user",
        parts: [
          { text: `Analyze this separate golf course layout map / aerial view photo. Complete a highly meticulous study:
- Detect the total number of holes clearly demarcated.
- For each hole layout, measure colors of green. Fairways are normally the lightest green, putting greens are smooth bright green, the surrounding rough is dark green, sand traps are white or yellow, and water bodies are blue.
- Plot absolute outline coordinate percentage points (float values between 0.0 and 100.0) mapping the full geometry of each hole relative to the overall image boundaries:
  - 'teeBox': Starting point.
  - 'green': The putting green outline core.
  - 'flagLocation': Specific coordinate of the flag/cup.
  - 'fairwayPoints': An array of coordinates mapping the fairway spine path from the tee to the green (minimum 2 spine points).
  - 'bunkers': Coordinate centers and bounding sizes of sand traps nearby.
  - 'waterAreas': Coordinate centers and coverage sizes of rivers or lakes.
  - 'trees': Pinpoint locations of thick tree lines or blocking tree groups.
- Author a highly descriptive detailed analysis outlining how colors translate, dogleg shape direction, physical hazards, target sightlines, and hole endpoint relative to the scorecard.` },
          { inlineData: { data: image.data, mimeType: image.mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: aerialLayoutSchema
    }
  });
  return JSON.parse(response.text || '{}');
}


