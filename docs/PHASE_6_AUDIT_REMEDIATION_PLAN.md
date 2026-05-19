# Phase 6 Audit Remediation Plan (Phase 6.5)

Based on the global codebase audit, the following PR-sized tasks are planned to address the identified runtime, technical debt, and governance risks.

- [x] **PR-1: Ledger/Evidence Downgrade**
  Downgrade `f-31-caddy-live-e2e-verification` from `VERIFIED` to `IMPLEMENTED_UNVERIFIED` because headless fixture/test execution is NOT physical QA. Clarify legacy markdown documentation status.
- [x] **PR-2: ErrorBoundary Wrappers**
  Add a lightweight ErrorBoundary to isolate live session and AR HUD crashes, ensuring the rest of the shell remains functional if WebGL or Media APIs crash.
- [x] **PR-3: LiveVideoInput Optimization**
  Move interval-based frame capture logic to `requestAnimationFrame` and integrate document visibility checks. Add a TODO in code to track the debt.
- [x] **PR-4: FrameHealthMeter Throttling**
  Throttle or debounce telemetry state updates sent from the websocket to prevent extreme re-rendering on the React thread.
- [x] **PR-5: AudioContext Autoplay Hardening**
  Add explicit comments in `useTTS` and `AiCaddy` warning that `AudioContext.resume()` behavior must be bound to a trusted user gesture to overcome browser muting policies.
- [x] **PR-6: Mobile UX/A11y Review**
  Physically verify mobile touch targets (min 44px) and z-index overlap in the HUD. Requires real device execution.
