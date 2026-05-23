import { z } from "zod";

// --- 1. MEDIA LICENSE & SOURCE REGISTRY SCHEMA ---
export const MediaLicenseTypeSchema = z.enum([
  "RECIRC_KEEPSAKE",
  "CREATIVE_COMMONS",
  "PUBLIC_DOMAIN",
  "USER_OWNED",
  "RESTRICTED_MEDIA"
]);

export type MediaLicenseType = z.infer<typeof MediaLicenseTypeSchema>;

export const MediaSourceRecordSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().url(),
  licenseType: MediaLicenseTypeSchema,
  attribution: z.string(),
  isRestrictedForTraining: z.boolean(), // RESTRICTED_MEDIA is restricted from storage/texturing/ml training
});

export type MediaSourceRecord = z.infer<typeof MediaSourceRecordSchema>;

// --- 2. GRID & HOLE EXTRACTOR SCHEMAS ---
export const HoleExtractionSchema = z.object({
  number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().positive().optional(),
  handicap: z.number().int().min(1).max(18).optional(),
  layoutDescription: z.string().optional(),
});

export type HoleExtraction = z.infer<typeof HoleExtractionSchema>;

export const VisualRegionSchema = z.object({
  id: z.string(),
  type: z.enum(["TEE_BLOCKS", "GREEN_MAP", "LOGO_ICON", "ADVERTISEMENT", "UNKNOWN"]),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  cropDataUrl: z.string().optional(),
});

export type VisualRegion = z.infer<typeof VisualRegionSchema>;

export const AdsClassificationSchema = z.object({
  hasAds: z.boolean(),
  advertisementTextDetected: z.array(z.string()).optional(),
});

export type AdsClassification = z.infer<typeof AdsClassificationSchema>;

// --- 3. SCORECARD EXTRACTION V2 SCHEMA ---
export const ScorecardExtractionV2Schema = z.object({
  courseName: z.string().min(1, "Course name is required"),
  teeSet: z.string().min(1, "Tee set is required"),
  cityOrGeography: z.string().optional(),
  logoDescription: z.string().optional(),
  visualFeatures: z.array(z.string()).default([]),
  aestheticPrompt: z.string().optional(),
  rating: z.number().positive().optional(),
  slope: z.number().positive().optional(),
  holes: z.array(HoleExtractionSchema).min(1).max(18),
  uncertainFields: z.array(z.string()).default([]),
  visualRegions: z.array(VisualRegionSchema).default([]),
  adsClassification: AdsClassificationSchema.default({ hasAds: false }),
  confidenceScore: z.number().min(0).max(100), // percentage based on parser accuracy
});

export type ScorecardExtractionV2 = z.infer<typeof ScorecardExtractionV2Schema>;

// --- 4. COURSE IDENTITY CANDIDATE SCHEMA ---
export const CourseIdentityCandidateSchema = z.object({
  courseName: z.string().min(1),
  cityOrGeography: z.string(),
  logoDescription: z.string(),
  visualFeatures: z.array(z.string()),
  aestheticPrompt: z.string(),
  rating: z.number().optional(),
  slope: z.number().optional(),
  confirmed: z.boolean().default(false),
});

export type CourseIdentityCandidate = z.infer<typeof CourseIdentityCandidateSchema>;

// --- 5. HOLE ATLAS SEED SCHEMA ---
export const Coordinate2DSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const HoleAtlasSeedSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage: z.number().int().positive(),
  handicap: z.number().int().min(1).max(18),
  localCoordinates: z.object({
    teeBox: Coordinate2DSchema,
    fairwayPoints: z.array(Coordinate2DSchema),
    green: Coordinate2DSchema,
  }),
  schematicDistance: z.number(), // in yards or schematic units
  strategyTip: z.string(),
  isDemanding: z.boolean(), // replaces "hazard" label, represents low handicap status
});

export type HoleAtlasSeed = z.infer<typeof HoleAtlasSeedSchema>;


// --- 6. PARSER PIPELINE HELPERS ---

/**
 * Image preprocessing tool representing basic contrast/grayscale adjustment logic
 */
export function preprocessCanvasImageData(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Grayscale conversion
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Auto contrast stretch
    let enhanced = gray;
    if (enhanced < 60) {
      enhanced = 0; // deepen dark text
    } else if (enhanced > 195) {
      enhanced = 255; // widen highlight background
    }
    
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Classifies table row tags following heuristic scan patterns
 */
export function classifySemanticRow(labelText: string): "PAR" | "YARDAGE" | "HANDICAP" | "DEMANDING_HOLES" | "AD" | "UNKNOWN" {
  const normalized = labelText.toUpperCase().trim();
  if (normalized.includes("PAR")) return "PAR";
  if (normalized.includes("YARD") || normalized.includes("YDS") || normalized.includes("YARDAGE")) return "YARDAGE";
  if (normalized.includes("HCP") || normalized.includes("HDCP") || normalized.includes("HANDICAP") || normalized.includes("INDX") || normalized.includes("INDEX")) return "HANDICAP";
  if (normalized.includes("DEMANDING") || normalized.includes("TOUGH") || normalized.includes("HAZARD")) return "DEMANDING_HOLES";
  if (normalized.includes("SALE") || normalized.includes("PRO SHOP") || normalized.includes("BUY") || normalized.includes("AD") || normalized.includes("SPONSOR")) return "AD";
  return "UNKNOWN";
}

/**
 * Validates sums for front-9 and back-9 scores against user inputs or OCR parsed totals
 */
export interface TotalsValidationResult {
  isValid: boolean;
  frontNinePar: number;
  backNinePar: number;
  totalPar: number;
  frontNineYardage: number;
  backNineYardage: number;
  totalYardage: number;
  warnings: string[];
}

export function validateScorecardTotals(holes: HoleExtraction[]): TotalsValidationResult {
  let frontNinePar = 0;
  let backNinePar = 0;
  let frontNineYardage = 0;
  let backNineYardage = 0;
  const warnings: string[] = [];

  for (const hole of holes) {
    const num = hole.number;
    const par = hole.par || 0;
    const yard = hole.yardage || 0;

    if (num <= 9) {
      frontNinePar += par;
      frontNineYardage += yard;
    } else {
      backNinePar += par;
      backNineYardage += yard;
    }
  }

  const totalPar = frontNinePar + backNinePar;
  const totalYardage = frontNineYardage + backNineYardage;

  // Basic sanity validation check
  if (totalPar !== 0 && (totalPar < 54 || totalPar > 90)) {
    warnings.push(`Extreme par total alert: Sum total par of (${totalPar}) falls outside the standard 18-hole range (54 to 90).`);
  }
  if (totalYardage > 0 && totalYardage < 2000) {
    warnings.push(`Yardage warning: Course yardage is exceptionally short (${totalYardage} yds). Double-check the score columns.`);
  }

  return {
    isValid: warnings.length === 0,
    frontNinePar,
    backNinePar,
    totalPar,
    frontNineYardage,
    backNineYardage,
    totalYardage,
    warnings,
  };
}

// --- 7. STRATEGY SUMMARY COMPILATION ---
export interface ScorecardStrategySummary {
  longestHoles: HoleExtraction[];
  shortestHoles: HoleExtraction[];
  par5Opportunities: HoleExtraction[];
  par3Opportunities: HoleExtraction[];
  demandingHoles: HoleExtraction[];
  frontBackBalance: {
    frontNinePar: number;
    backNinePar: number;
    frontNineYardage: number;
    backNineYardage: number;
    description: string;
  };
  selectedTeeTotalYardage: number;
}

export function compileStrategySummary(holes: HoleExtraction[]): ScorecardStrategySummary {
  const sortedByYardage = [...holes]
    .filter(h => h.yardage && h.yardage > 0)
    .sort((a, b) => (b.yardage || 0) - (a.yardage || 0));

  const longestHoles = sortedByYardage.slice(0, 3);
  const shortestHoles = [...sortedByYardage].reverse().slice(0, 3);

  const par5Opportunities = holes.filter(h => h.par === 5);
  const par3Opportunities = holes.filter(h => h.par === 3);

  // Demanding holes: classified strictly from Handicap Index (handicap 1 to 6 reflect hardest holes, i.e., Demanding Holes)
  const demandingHoles = holes
    .filter(h => h.handicap !== undefined && h.handicap >= 1 && h.handicap <= 6)
    .sort((a, b) => (a.handicap || 0) - (b.handicap || 0));

  let frontNinePar = 0;
  let backNinePar = 0;
  let frontNineYardage = 0;
  let backNineYardage = 0;

  for (const h of holes) {
    if (h.number <= 9) {
      frontNinePar += h.par;
      frontNineYardage += h.yardage || 0;
    } else {
      backNinePar += h.par;
      backNineYardage += h.yardage || 0;
    }
  }

  const yardageDiff = Math.abs(frontNineYardage - backNineYardage);
  let description = "The course offers a balanced ratio between the Outward and Inward halves.";
  if (yardageDiff > 400) {
    if (frontNineYardage > backNineYardage) {
      description = "The front nine is significantly longer and demanding, requiring robust stamina off the tee.";
    } else {
      description = "The back nine escalates in yardage and distance, demanding careful club management down the stretch.";
    }
  }

  const selectedTeeTotalYardage = frontNineYardage + backNineYardage;

  return {
    longestHoles,
    shortestHoles,
    par5Opportunities,
    par3Opportunities,
    demandingHoles,
    frontBackBalance: {
      frontNinePar,
      backNinePar,
      frontNineYardage,
      backNineYardage,
      description,
    },
    selectedTeeTotalYardage,
  };
}

// --- 8. GEOSPATIAL SEED ENGINE ---

/**
 * Places 2D schematic points for a hole based on standard design practices.
 * The tee box sits at [0, 0].
 * The green is centered horizontally at x=0, and placed vertically at the yardage distance (converted optionally).
 * Mid-fairway points are placed to simulate natural terrain curvatures.
 */
export function calculateHoleLocalCoordinates(yardage: number, par: number, holeNum: number) {
  const teeBox = { x: 0, y: 0 };
  
  // Custom curvature offset based on hole number seed
  const fairwayOffset = Math.sin(holeNum * 1.7) * (par > 3 ? 35 : 0);
  const fairwayY = Math.ceil(yardage * 0.5);
  
  const fairwayPoints = par > 3 
    ? [{ x: Number(fairwayOffset.toFixed(1)), y: fairwayY }]
    : [];

  const green = { x: 0, y: yardage };

  return {
    teeBox,
    fairwayPoints,
    green,
  };
}

/**
 * Calculates schematic distance in planar Cartesian space
 */
export function calculateSchematicDistance(
  teeBox: { x: number; y: number },
  green: { x: number; y: number }
): number {
  const dx = green.x - teeBox.x;
  const dy = green.y - teeBox.y;
  return Math.ceil(Math.sqrt(dx * dx + dy * dy));
}

/**
 * Optional GPS georeference shell. Returns null when GPS or actual geographic bounds are not mapped or verified.
 * Complies with visual, privacy, and non-scrape directives.
 */
export function getGeoreferenceBBox(cityOrGeography?: string): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  // Returns null since exact geographic limits require API scraper integrations, keeping us safe
  return null;
}

/**
 * Generates 18 HoleAtlasSeed objects once CourseIdentityCandidate coordinates have been confirmed.
 */
export function generateHoleAtlasSeeds(holes: HoleExtraction[]): HoleAtlasSeed[] {
  return holes.map(h => {
    const yardage = h.yardage || 350; // default beautiful seed size
    const par = h.par || 4;
    const handicap = h.handicap || h.number; // fallback handicap
    const coords = calculateHoleLocalCoordinates(yardage, par, h.number);
    const schematicDist = calculateSchematicDistance(coords.teeBox, coords.green);

    // Dynamic strategy generator based purely on yardage/par/handicap context (safe heuristics, NO real hazards guessed)
    let tip = `Par ${par} hole requiring precise shot placing off the tee.`;
    if (par === 3) {
      tip = `Challenging short par 3. Prioritize clean elevation contact to land on the green safely. Keep distance controlled to under ${yardage} yards.`;
    } else if (par === 5) {
      tip = `Stretching ${yardage} yards, this par 5 provides a powerful launch opportunity off the tee. Safe placing gets a rewarding short-iron look.`;
    } else if (par === 4 && yardage < 340) {
      tip = `Exciting drivable par-4 configuration. An aggressive line off the tee opens birdy looks, but conservative hybrids leave an easier approach wedge.`;
    } else if (handicap <= 4) {
      tip = `Highly demanding par ${par} designated as Handicap index ${handicap}. Focus on a strict safe fairway path. Check yardages carefully.`;
    }

    const isDemanding = handicap <= 6;

    return {
      holeNumber: h.number,
      par,
      yardage,
      handicap,
      localCoordinates: coords,
      schematicDistance: schematicDist,
      strategyTip: tip,
      isDemanding,
    };
  });
}
