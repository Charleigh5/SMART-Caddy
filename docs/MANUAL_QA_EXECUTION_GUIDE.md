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
