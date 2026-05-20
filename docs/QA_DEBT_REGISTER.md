# QA Debt Register

This register catalogues all manual and real-device QA gates that are required before marking advanced integrated features as `VERIFIED`. Because the AI Studio agent environment is restricted to automated scripts and headless browsers, hardware-dependent features (Mic, Camera, native mobile layouts) remain here pending physical validation.

## PENDING_REAL_DEVICE_QA Items

### Voice & Live Telemetry (Phase 5.8 - 5.10)
*   **VOICE-011 Chrome desktop QA:** Verify Web Speech recognition logic behaves cleanly.
*   **VOICE-012 Safari/iOS QA:** Verify fallback or functional degradation.
*   **VOICE-013 Android Chrome QA:** Verify native OS mic prompts and permission behavior.
*   **VOICE-014 Permission-denied QA:** Verify denial handlers natively.
*   **VOICE-015 Golf-vocabulary QA:** Verify 'hook', 'slice', 'bunker' transcription accuracy natively.

### Provider Integration & HUD UX (Phase 5.9 - 6.8)
*   **QA-MATRIX-001:** Provider Diagnostics panel must visibly run and correctly report missing provider keys when none are provided.
*   **QA-MATRIX-002:** FrameHealthMeter accurately reflects payload transmission sizes and framerates under live load.
*   **QA-MATRIX-003:** Live HUD respects mobile boundaries without clipping controls.
*   **QA-MATRIX-004:** CaddyContextDrawer properly updates without lagging native thread blocking.
*   **QA-MATRIX-005:** Verify all `REST` vs `Live` fallback tags present themselves honestly under packet loss/no-wifi conditions.
*   **SWING-VIS-006:** Confirm Recharts radar and bar graphs render gracefully with optimal dimensions and text visibility on mobile viewport widths (375px-430px) without overflow.

### Scorecard Scanner UX & Verification (Phase 9A.1)
*   **QA-013 Scorecard camera lifecycle:** Verify rear/environment camera initialization, active viewfinders, stream attachment on video mount, cancel/retake track closures, permission fallback, and file-upload fallback.
*   **QA-014 Scorecard cropper workflow:** Verify draggable cropper overlay gates correctly, captured/uploaded source renders, handles work smoothly at 375px, 390px, 430px, and 1280px+ widths, and buttons never clip.
*   **QA-015 Scorecard OCR validation:** Verify cropped image submission to /api/gemini/scorecard-parse, validation UI flags doubtful values, parses COURSE / TEE LEVEL metrics to editable table, ignores advertising text, and blocks official handicap claims when unconfirmed.

## Execution Requirements
To drain this debt register, a developer must check out the project locally, build it, provision a mobile device or desktop browser, and execute the manual suite, updating the `EVIDENCE_LEDGER` manually with `PASS` records.

**Crucial Disciplinary Rule**: While automated test suites support implementation readiness and block software regressions, they do NOT constitute physical proof. Any gate requiring physical or real-device testing MUST be validated using a real browser or mobile setup. The QA Receipt generator will automatically reject and revert any PASS claims if headless/JSDOM metadata, mock configuration states, or mock test logs are supplied.

## Automated Verification Tests (Scorecard Scanner)
These automated mock and interface tests confirm execution integrity and logic correctness, acting as supporting evidence before real physical device deployment:
*   **AUTO-SCS-001: Scorecard camera lifecycle mocked test:** Validates default environmental media capture, track shutdown triggers on unmount and stop clicks, and permission error degradation under Vitest environments.
*   **AUTO-SCS-002: Scorecard cropper/upload mocked test:** Confirms drag viewport scaling constraints, source bindings on mounting, and local file-dialog integration vectors.
*   **AUTO-SCS-003: Scorecard OCR error/retry mocked test:** Verifies exception interception, response table validations, and manual bypass pathways under simulated server failure payloads.

## Automated Audit Discoveries (Phase 6.5 - Hardened Phase 6.6)
The codebase audit flagged the following architectural risks which require QA or runtime hardening:
*   [x] **AudioContext Autoplay Risk:** TTS audio playback may fail or be muted by browser tab policies if not explicitly tied to a user gesture.
*   [x] **LiveVideoInput setInterval Risk:** The `setInterval` mechanism for fetching frame telemetry can cause background CPU/battery drain. Move to `requestAnimationFrame` and consider visibility checks.
*   [x] **FrameHealthMeter Throttle:** Telemetry may push too many React renders; consider throttling updates.
*   [x] **ErrorBoundary Missing:** The Live HUD components currently lack an `ErrorBoundary`, risking full app crashes on render failures.
*   [ ] **Mobile Touch Target QA:** Z-index layering, HUD spacing, and touch target sizes (44px) remain unverified on physical hardware.
*   [ ] **Provider Smoke Check Timeout:** The smoke harness still requires an extended runtime verification to handle timeouts cleanly.