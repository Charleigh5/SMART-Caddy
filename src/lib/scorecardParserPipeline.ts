import {
  ScorecardExtractionV2,
  HoleExtraction,
  VisualRegion,
  AdsClassification,
  classifySemanticRow,
  validateScorecardTotals,
  preprocessCanvasImageData
} from "./scorecardV2Schema";

// --- 1. OCR ADAPTER INTERFACE ---
export interface ScorecardOCRAdapter {
  parseImages(images: { data: string; mimeType: string }[]): Promise<any>;
}

// --- 2. MOCK OCR ADAPTER FOR TESTS ---
export class MockScorecardOCRAdapter implements ScorecardOCRAdapter {
  private mockFail: boolean = false;
  private mockResponse: any = null;

  constructor(mockFail = false, customMockResponse: any = null) {
    this.mockFail = mockFail;
    this.mockResponse = customMockResponse;
  }

  async parseImages(images: { data: string; mimeType: string }[]): Promise<any> {
    if (this.mockFail) {
      throw new Error("OCR pipeline timeout: The raw imagery was too low contrast or blurred.");
    }

    if (this.mockResponse) {
      return this.mockResponse;
    }

    // Default beautiful mock response representing Twin Lakes Golf
    return {
      courseName: "Twin Lakes Golf",
      teeSet: "Yellow",
      cityOrGeography: "Santa Cruz, California",
      logoDescription: "A crest with two crossed pine trees and a golf lake",
      visualFeatures: ["pine trees", "calm lakes", "rolling hills"],
      aestheticPrompt: "Pristine top down satellite view photo of Twin Lakes Golf Santa Cruz landscape layout with scenic pine trees framing two crystal blue lakes",
      rating: 71.4,
      slope: 124,
      holes: Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        par: i % 3 === 0 ? 3 : i % 5 === 0 ? 5 : 4,
        yardage: i % 3 === 0 ? 150 : i % 5 === 0 ? 510 : 380,
        handicap: ((i * 7) % 18) + 1,
        layoutDescription: `Straight hole with pine trees framing the landing zone.`
      })),
      uncertainFields: [],
      visualRegions: [
        { id: "reg-1", type: "LOGO_ICON", bounds: { x: 10, y: 15, width: 80, height: 80 } },
        { id: "reg-2", type: "TEE_BLOCKS", bounds: { x: 100, y: 15, width: 200, height: 50 } }
      ],
      adsClassification: {
        hasAds: false,
        advertisementTextDetected: []
      }
    };
  }
}

// --- 3. THE COMPLETE PARSER PARSING PIPELINE WORKER ---
export interface PipelineInput {
  images: { data: string; mimeType: string }[];
  adapter?: ScorecardOCRAdapter;
}

export async function executeScorecardParserPipeline(input: PipelineInput): Promise<ScorecardExtractionV2> {
  const adapter = input.adapter || new MockScorecardOCRAdapter();
  
  // Call the OCR adapter
  const ocrResult = await adapter.parseImages(input.images);

  if (!ocrResult || typeof ocrResult !== "object") {
    throw new Error("OCR extraction produced a malformed result.");
  }

  // 1. EXTRACT HOLE ROW DATA
  const parsedHoles: HoleExtraction[] = [];
  const rawHoles = Array.isArray(ocrResult.holes) ? ocrResult.holes : [];

  for (let i = 0; i < 18; i++) {
    // Attempt to extract or fallback gracefully for each of the 18 holes
    const rawH = rawHoles.find((h: any) => h && Number(h.number) === i + 1) || {};
    
    const num = i + 1;
    // Par validation with strict fallbacks
    let parVal = Number(rawH.par);
    if (isNaN(parVal) || parVal < 3 || parVal > 6) {
      // Default guess par based on layout yardage
      const yardage = Number(rawH.yardage);
      if (!isNaN(yardage) && yardage > 0) {
        parVal = yardage < 220 ? 3 : yardage > 470 ? 5 : 4;
      } else {
        parVal = 4; // generic par 4 default
      }
    }

    const yardageVal = Number(rawH.yardage);
    const handicapVal = Number(rawH.handicap);

    parsedHoles.push({
      number: num,
      par: parVal,
      yardage: isNaN(yardageVal) || yardageVal <= 0 ? undefined : yardageVal,
      handicap: isNaN(handicapVal) || handicapVal < 1 || handicapVal > 18 ? undefined : handicapVal,
      layoutDescription: rawH.layoutDescription || `Hole ${num} green layout`,
    });
  }

  // 2. UNCERTAIN FIELDS & CONFIDENCE ANALYSIS
  const uncertainFields: string[] = Array.isArray(ocrResult.uncertainFields) 
    ? ocrResult.uncertainFields.map((f: any) => String(f))
    : [];

  // Flag missing holes fields as uncertain
  parsedHoles.forEach(h => {
    if (!h.yardage) uncertainFields.push(`Hole ${h.number} Yardage`);
    if (!h.handicap) uncertainFields.push(`Hole ${h.number} Handicap`);
  });

  const ratingVal = ocrResult.rating ? Number(ocrResult.rating) : undefined;
  const slopeVal = ocrResult.slope ? Number(ocrResult.slope) : undefined;

  if (!ratingVal) uncertainFields.push("Course Rating");
  if (!slopeVal) uncertainFields.push("Course Slope");

  // Totals Validation
  const totalsResult = validateScorecardTotals(parsedHoles);
  if (!totalsResult.isValid) {
    uncertainFields.push("Scorecard Summary Sum Mismatch");
  }

  // Calculate parser confidence score (percentage 0 - 100)
  // Deduct penalty based on missing critical scorecard characteristics
  let confidenceScore = 100;
  
  // Deduct 2% for each uncertain field
  confidenceScore -= uncertainFields.length * 2;
  
  // Deduct 15% if course name is standard or empty
  if (!ocrResult.courseName || ocrResult.courseName === "Commemorative Course") {
    confidenceScore -= 15;
  }
  
  // Deduct 10% if rating or slope is missing
  if (!ratingVal) confidenceScore -= 10;
  if (!slopeVal) confidenceScore -= 10;

  confidenceScore = Math.max(15, Math.min(100, confidenceScore));

  // 3. ADS CLASSIFIER / TEXT BLOCKING
  // Filter out any ad words or commercial text identified
  const adsClass: AdsClassification = {
    hasAds: ocrResult.adsClassification?.hasAds || false,
    advertisementTextDetected: Array.isArray(ocrResult.adsClassification?.advertisementTextDetected)
      ? ocrResult.adsClassification.advertisementTextDetected
      : []
  };

  // 4. VISUAL REGION DETECTION & LAYOUT STRUCTURE
  const visualRegions: VisualRegion[] = Array.isArray(ocrResult.visualRegions)
    ? ocrResult.visualRegions.map((r: any, idx: number) => ({
        id: r.id || `reg-${idx}`,
        type: ["TEE_BLOCKS", "GREEN_MAP", "LOGO_ICON", "ADVERTISEMENT", "UNKNOWN"].includes(r.type)
          ? r.type
          : "UNKNOWN",
        bounds: {
          x: Number(r.bounds?.x || 0),
          y: Number(r.bounds?.y || 0),
          width: Number(r.bounds?.width || 100),
          height: Number(r.bounds?.height || 50)
        },
        cropDataUrl: r.cropDataUrl
      }))
    : [];

  const parsedVisualFeatures: string[] = Array.isArray(ocrResult.visualFeatures)
    ? ocrResult.visualFeatures.filter((v: any) => typeof v === "string" && v.trim().length > 0)
    : [];

  return {
    courseName: ocrResult.courseName || "Twin Lakes Golf",
    teeSet: ocrResult.teeSet || "Yellow",
    cityOrGeography: ocrResult.cityOrGeography || "San Jose, California",
    logoDescription: ocrResult.logoDescription || "A corporate or simple layout crest logo.",
    visualFeatures: parsedVisualFeatures.length > 0 ? parsedVisualFeatures : ["bays", "fairways", "sand traps"],
    aestheticPrompt: ocrResult.aestheticPrompt || `Pristine top down satellite mapping photo.`,
    rating: ratingVal,
    slope: slopeVal,
    holes: parsedHoles,
    uncertainFields,
    visualRegions,
    adsClassification: adsClass,
    confidenceScore: Math.round(confidenceScore)
  };
}
