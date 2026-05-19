# Staging Manual QA Runbook

## Scope and Purpose
This runbook governs the execution of explicit Manual QA for hardware-dependent, UI-bound, and media-intensive features (like Gemini Live's audio/video payload streaming) that cannot be safely verified by headless Node.js tests.

**DO NOT CLAIM REAL DEVICE VERIFICATION FROM AUTOMATION.** Passing unit tests or a backend smoke script timeout is *honest fallback evidence*, not Real Hardware Field Verification.

## Prerequisites
1. Ensure `.env.example` has been followed to configure `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`, `GEMINI_TEXT_MODEL`, and `ENABLE_GEMINI_LIVE`.
2. A staging or local URL accessible on a real physical device. For mobile testing, ensure you can access the app URL over HTTPS on a phone with camera/microphone permissions.
3. For Fallback/Disabled Testing: Set `ENABLE_GEMINI_LIVE=false` or remove the API key. The UI must degrade safely.

## Launching the QA Environment
1. Start the app.
2. Open the staging URL.
3. Navigate to **Diagnostics** in the navigation menu (or hit `/settings` / `/diagnostics`).
4. You will see the **Manual QA Runner** component.

## Execution Steps
1. **Tester Details:** Fill out your Device (e.g., iPhone 15), Browser, and OS versions at the top of the runner.
2. **Execute Gates:** Open each section (Media Constraints, Live Session HUD, AR Overlay, etc.).
3. **Physical Test:** Perform the explicit instructions described in the gate on the actual device. Observe if the requirement is fully met (`PASS`), somewhat met/degraded (`PARTIAL`), or broken (`FAIL`).
4. **Notes/Evidence:** Write specific notes in the textarea (e.g., "The stop button hit target feels too small", "Canvas renders out of bounds on orientation change", "Audio muted without explicit tap").
5. **Mark Status:** Select the corresponding status. Leave `PENDING_REAL_DEVICE_QA` or mark `NOT_TESTED` if you have not tangibly tested it.

## Exporting and Recording Evidence
This internal React component does *not* automatically persist data back into the repository feature ledgers. 
**You must explicitly export the receipt.**

1. Click **JSON** or **MD** at the top right of the Manual QA Runner.
2. An alert will confirm the receipt has been copied to your clipboard.
3. **Paste the contents back into the chat** or save them into a `qa-receipts` folder.
4. The system agent will read this receipt and promote features in `src/lib/ledger.ts` to `VERIFIED` based on physical QA proof.

## "Do Not Claim" Safeguards
* **Provider Smoke Timeout:** Do NOT claim Gemini Live field session verified from the provider smoke test timeout. That is just proving the codebase correctly intercepts and recovers from timeouts.
* **WebRTC:** We are using WebSockets, not WebRTC. Do not claim WebRTC capability.
* **Launch Metrics:** We do not claim exact carry/spin/launch data without an official launch monitor connected. We provide estimated visual analysis.
* **No Automated "Manual" QA:** Automated tests are vital, but they do NOT substitute for tapping buttons on glass and confirming browser AudioContext constraints let audio play. Maintain `PARTIALLY_VERIFIED` on hardware features until a human receipts it.
