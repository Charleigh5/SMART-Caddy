# Scorecard Extractor V2 Open-Source Pattern Scan & Decisions

We have conducted a pattern scan on industry-standard toolkits for OCR, image processing, golf maps coordinate geometry, and geospatial seed calculations.

## Library Pattern Analysis

### 1. OCR Toolkits
- **Tesseract.js** (`naptha/tesseract.js`):
  - *Pattern / License*: Apache-2.0. Runs in-browser or Node-side.
  - *Pros / Cons*: Excellent client-side WASM OCR. However, has high bundle size (~30MB WASM payload) and requires extensive dictionary files to segment dual-grid scorecards.
  - *Decision*: We will rely on server-side Gemini multi-modal JSON parser (`gemini-2.5-flash`) for production OCR because it handles table geometries, font styling, handwritten pencil marks, and visual logos natively, but we will document and integrate a local-first interface design. We will build a modular `OCRAdapeaterInterface` which supports mock adapters and can hook into Tesseract or a proprietary Gemini backend.

- **PaddleOCR** & **DocTR** (`mindee/doctr` / `PaddlePaddle`):
  - *Pattern*: Apache/BSD licenses. Fast, high-accuracy table row structure recognition.
  - *Pros / Cons*: Server-heavy python processes.
  - *Decision*: Adopt their row classification heuristic layout principles (e.g. classifying rows semantic names like PAR, HANDICAP, YARDS) in our downstream table semantic-row classifier.

- **OpenCV.js** (`TechStark/opencv-js`):
  - *Pattern*: Apache-2.0. Large WASM library for edge detection and gray-scaling. Heuristic-based grid-detectors from OpenCV.js are perfect for local preprocessing.
  - *Decision*: Implement a clean visual image-preprocessing helper in our frontend pipeline (canvas-based contrast, gray-scale normalization, grid-align bounding box crop ratios) to feed the OCR pipeline optimal high-contrast imagery, mirroring the grid-detection algorithms of OpenCV without the WASM overhead.

### 2. Golf Mapping & Turf Layouts
- **OSMGolf** & **Golfr** (`leif81/osmgolf`, `joshshep/golfr`, `bdlucas1/ace`):
  - *Pattern*: GPL/MIT. Parse golf boundaries (tees, greens, bunkers) as node geometries.
  - *Pros / Cons*: Excellent spatial structure.
  - *Decision*: Utilize their local Cartesian grid system to map hole yardages to a schematic Local Coordinate Space (Tee `[0,0]`, Fairway, Green `[0, yardage]`).

- **MapLibre GL JS** / **Turf.js** (`maplibre/maplibre-gl-js`, `turfjs/turf`):
  - *Pattern*: BSD-3/MIT.
  - *Pros / Cons*: Extremely solid geo computation.
  - *Decision*: Build a geospatial coordinate shell. In our `HoleLocalCoordinate` helper, we will map standard yardages into physical distance layouts. When GPS georeference anchor points are not yet active/confirmed, our coordinate engine returns a clean schematic model.

### 3. Verification & Test Engines
- **Playwright**, **Vitest**, **MSW**, and **React Testing Library**:
  - *Pattern*: MIT, standard test utilities.
  - *Decision*: Fully integrate into our QA gate suite to run scorecard parsing, totals mismatch, and manual edit tests.

## Architectural Decision

We will implement a clean multi-tiered structure in `/src/lib/scorecardV2Schema.ts` and UI elements:
1. **Model Representation (Zod)**: Define schemas and strict validators for:
   - `ScorecardExtractionV2`: Complete OCR + visual regions + ads filter data structure.
   - `CourseIdentityCandidate`: Validated identity candidates with user confirmation.
   - `HoleAtlasSeed`: 18 detailed layout files holding coordinate structures.
   - `MediaSourceRecord`: Media records paired with content licenses.
2. **Parser Pipeline Helpers**:
   - High-contrast canvas image preprocessing.
   - Row-semantic row classifiers matching `par`, `yardage`, `handicap`, `demanding holes`.
   - Grid detector metrics and totals validators.
3. **UI Engine components in React/Tailwind**: Interactive tabular confirmation card layout.
