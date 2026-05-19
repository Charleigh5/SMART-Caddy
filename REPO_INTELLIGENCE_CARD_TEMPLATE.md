# Repo Intelligence Card

## Overview
- **Repo Name:** [Insert Repo Name, e.g., React Doctor]
- **Canonical URL:** [Insert URL]
- **Target Grade:** 90+
- **Extraction Level:** Level 4

## Pass 1: Repo Index
- **Canonical Repo Verified:** ✅ Yes
- **License Checked:** [Insert License, e.g., MIT]
- **Blocked/Unresolved:** None.

## Pass 2: Static Deep Dive

### Source Tree Mapped
```text
[Insert Source Tree Mapping]
/src
  /components
  /lib
  index.ts
package.json
README.md
```

### Entrypoints Identified
- **Main Entrypoint:** `src/index.ts`
- **Config Files:** `package.json`, `tsconfig.json`

## Pass 3: Critical Path + Verification (Level 4 Certification)

### Critical File Cards
 **File:** `src/index.ts`
- **Purpose:** NextJS/React application bootstrap and core integration points.
- **Key Exports:** `runCheck()`, `withReactDoctor()`

### Implementation Transfer Card
- **Pattern:** How to implement React Doctor into an existing codebase.
- **Steps:**
  1. Install via `npm install react-doctor`
  2. Implement Higher Order Component in root layout.
  3. Validate routes with `<DoctorBoundary>`.

### Novice Tasks Created
1. Update README with missing usage examples.
2. Add unit tests for `withReactDoctor()` edge cases.
3. Migrate deprecated API calls in `src/utils.ts`.

### Verification Commands Listed
- `npm run build`
- `npm run test`
- `npm run lint`

### Data Gaps Labeled
- [DATA GAP]: Test coverage for React Server Components is currently unmapped.
- [DATA GAP]: Documentation regarding multi-tenant configurations is sparse.
