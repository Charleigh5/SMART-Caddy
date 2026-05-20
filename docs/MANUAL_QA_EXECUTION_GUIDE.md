# Manual QA Execution Guide

Live Caddy hardware-dependent features (voice, camera, fallback paths, performance drops) require real-world execution testing that our headless automated runners cannot provide. We capture proof of these tasks using the **Manual QA Runner**.

## Process

1. Check out the project Branch/PR.
2. Ensure you have physical devices (Mobile Android/iOS, Desktop Web with Camera/Mic).
3. Start the application locally or via preview deployment (`npm run dev` / `npm run build && npm start`).
4. Navigate to the **Diagnostics** route.
5. In the **Manual QA Runner** panel:
   - Verify Tester Metadata is accurate.
   - For each categorized gate, execute the physical test.
   - Mark `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`.
   - Add tester notes containing the scenario context.
6. Click **JSON** or **MD** export buttons at the top of the QA Runner panel.
7. Paste the receipt back into the AI working environment.
8. The developer/agent will use this receipt to promote features from `PARTIALLY_VERIFIED` to `VERIFIED` and update the ledger.

## Rules

- Do NOT manually edit the JSON receipt.
- Do NOT consider features VERIFIED simply because the UI shows PASS. The Agent must reconcile this into the central Ledger safely to close the QA debt.
- All failed items create new feature requests under the Next Required Fix label.

## Scorecard Scanner Test Procedures

### QA-013: Scorecard camera lifecycle
1. Navigate to the **Scorecard Scanner** feature tab.
2. Click **Use Camera / Viewfinder**. Note if the native system permission dialog appears.
3. Verify the video stream attaches only after layout mount and displays the camera perspective.
4. Click **Cancel** inside the camera viewport. Confirm the camera inactive state displays and track resources are released (no green camera browser indicator dot).
5. Switch browser modes or mock camera failures to verify proper fallback alerts and file-upload activation.

### QA-014: Scorecard cropper viewport scaling
1. Drag-and-drop or select a sample golf scorecard photo, or snapshot via camera stream.
2. Ensure the crop viewport box loads exactly.
3. Shrink your browser width to simulate mobile displays (specifically **375px**, **390px**, and **430px**) and enlarge to **1280px+** desktop.
4. Verify you can drag, scale, and adjust the corners easily on both touch simulators and physical mice without any buttons or crop indicators clipping out of frame bounds.

### QA-015: Scorecard OCR validation
1. Under Scorecard review, submit the cropped area to `/api/gemini/scorecard-parse`.
2. Confirm the resulting scorecard reviewer displays. Check if unsure/doubtful metrics have red flags or amber highlight signs.
3. Edit the parsed name, tee set, par, ratings, and scorecard structure cleanly.
4. Try to save an official handicap credential. Confirm the system blocks official handicap claims unless manual confirmation checkboxes are clicked.
5. Save the scorecard to indexedDB state and ensure local persistence works.
