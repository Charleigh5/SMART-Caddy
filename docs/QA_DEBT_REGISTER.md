# QA Debt Register

This register catalogues all manual and real-device QA gates that are required before marking advanced integrated features as `VERIFIED`. Because the AI Studio agent environment is restricted to automated scripts and headless browsers, hardware-dependent features (Mic, Camera, native mobile layouts) remain here pending physical validation.

## PENDING_REAL_DEVICE_QA Items

### Voice & Live Telemetry (Phase 5.8 - 5.10)
*   **VOICE-011 Chrome desktop QA:** Verify Web Speech recognition logic behaves cleanly.
*   **VOICE-012 Safari/iOS QA:** Verify fallback or functional degradation.
*   **VOICE-013 Android Chrome QA:** Verify native OS mic prompts and permission behavior.
*   **VOICE-014 Permission-denied QA:** Verify denial handlers natively.
*   **VOICE-015 Golf-vocabulary QA:** Verify 'hook', 'slice', 'bunker' transcription accuracy natively.

### Provider Integration & HUD UX (Phase 5.9)
*   **QA-MATRIX-001:** Provider Diagnostics panel must visibly run and correctly report missing provider keys when none are provided.
*   **QA-MATRIX-002:** FrameHealthMeter accurately reflects payload transmission sizes and framerates under live load.
*   **QA-MATRIX-003:** Live HUD respects mobile boundaries without clipping controls.
*   **QA-MATRIX-004:** CaddyContextDrawer properly updates without lagging native thread blocking.
*   **QA-MATRIX-005:** Verify all `REST` vs `Live` fallback tags present themselves honestly under packet loss/no-wifi conditions.

## Execution Requirements
To drain this debt register, a developer must check out the project locally, build it, provision a mobile device or desktop browser, and execute the manual suite, updating the `EVIDENCE_LEDGER` manually with `PASS` records.

## Automated Audit Discoveries (Phase 6.5 - Hardened Phase 6.6)
The codebase audit flagged the following architectural risks which require QA or runtime hardening:
*   [x] **AudioContext Autoplay Risk:** TTS audio playback may fail or be muted by browser tab policies if not explicitly tied to a user gesture.
*   [x] **LiveVideoInput setInterval Risk:** The `setInterval` mechanism for fetching frame telemetry can cause background CPU/battery drain. Move to `requestAnimationFrame` and consider visibility checks.
*   [x] **FrameHealthMeter Throttle:** Telemetry may push too many React renders; consider throttling updates.
*   [x] **ErrorBoundary Missing:** The Live HUD components currently lack an `ErrorBoundary`, risking full app crashes on render failures.
*   [ ] **Mobile Touch Target QA:** Z-index layering, HUD spacing, and touch target sizes (44px) remain unverified on physical hardware.
*   [ ] **Provider Smoke Check Timeout:** The smoke harness still requires an extended runtime verification to handle timeouts cleanly.