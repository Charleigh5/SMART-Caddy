# Phase 6.0 Integration Polish Plan

## Objective
Acknowledge the boundary of the AI Studio development sandbox by properly separating automated/simulated verification from true physical device QA. Consolidate the user experience so the distinctions between fallback modes, voice features, and real-time live capabilities are obvious to end-users and developers alike.

## Key Actions
1. **QA Debt Formalization**
   - Implemented `docs/QA_DEBT_REGISTER.md` to collect all pending device QA.
   - Built an interactive `QADebtPanel` into the Diagnostics UI for visibility.
   - Ensured features remain `PARTIALLY_VERIFIED` or `IMPLEMENTED_UNVERIFIED` until out-of-sandbox validation occurs.

2. **Terminology & UX Clean-up**
   - Explicitly separate **Web Speech API** Voice Query from **Gemini Live / WebRTC**.
   - Standardize fallback states across the HUD:
     - `Gemini Live (WebSocket)`
     - `REST API (Fallback)`
     - `Local Mock (Fallback)`
   - Prevent "fake" Connected states when providers timeout or are disabled.
   
3. **Truth & Label Preservation**
   - Maintain strict `Data Gap` highlights for non-tracked metrics.
   - Use `Simulated` or `Estimated` whenever a true hardware sensor isn't supplying the layout.

## Next Steps
- Continue addressing UX edge cases around loading state visualization.
- Prepare Phase 6.1: UX Cleanups.
