# BrushTales Root Review Fixes Implementation Plan

> **For agentic workers:** Execute this plan inline in the current worktree, task-by-task, using the test-driven-development workflow. Each task has a separate red/green test cycle.

**Goal:** Close the verified root-flow lifecycle, persistence, sensing-fallback, caregiver-copy, backgrounding, and responsive-accessibility gaps found during pre-merge review.

**Architecture:** Keep `PrototypeApp` as the root presentation and keep session mechanics behind `StorySessionController`. Give each adventure a fresh controller, pass the loaded local profile ID into it, persist the controller result through the existing session repository, and make root presentation follow controller phase and sensing status. Retain deterministic adapters only for development/tests; production must not claim sensing readiness without a frame processor.

**Tech Stack:** Expo Router, React Native, TypeScript, existing session controller/repositories, Jest, React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-brushtales-prototype-first-app-design.md`; product safety constraints in `AGENTS.md` and `docs/superpowers/specs/2026-09-19-brushtales-discovery-design.md`.

## Global Constraints

- A two-minute session remains the default; clock-dependent behavior stays injectable.
- Camera processing remains transient and on-device; no camera frame, image, audio recording, or biometric identifier is persisted or uploaded.
- Unsupported, denied, or unavailable sensing continues the same story by sound with calm, non-punitive copy.
- The caregiver remains responsible for supervision and safe brushing; profile setup is visibly directed to a grown-up and does not ask a child for a name.
- Story content remains deterministic and authored; no runtime-generated child-facing copy is introduced.
- Preserve the prototype's authored flow and large, accessible controls.

## Review Focus

- A permission-denied or processing-unavailable sensor must display the fallback notice and never be presented as ready.
- A completed, interrupted, or exited session must not be persisted twice, and summaries must use the selected local profile ID.
- A choice after Act 3 must create a fresh controller-backed brushing session rather than falling back to a UI-only timer.
- Returning from background must resume only a session that the app paused, without advancing elapsed time while backgrounded.
- A 320px viewport and reduced-motion setting must retain the prototype's compact atlas and a stationary brush.

---

### Task 1: Make controller phases and root adventure lifecycle explicit

**Files:**
- Modify: `src/session/storySessionController.ts`
- Modify: `src/domain/session/sessionEngine.ts`
- Modify: `src/components/prototype/PrototypeApp.tsx`
- Test: `tests/session/storySessionController.test.ts`
- Test: `tests/screens/prototypeApp.test.tsx`

**Interfaces:**
- `StorySessionController.beginBrushing(): Promise<void>` starts a new brushing phase without replaying Act 1; `beginStory()` continues to start Act 1 first.
- `PrototypeApp` creates a fresh controller for each adventure and routes controller `complete` to the completion state.

- [x] **Step 1: Add a failing direct-brushing controller test**

Assert that `beginBrushing()` loads the brushing asset, enters phase `brushing`, and starts a running session without loading the opening asset.

- [x] **Step 2: Run the controller test and verify it fails because the method is missing**

Run: `npm test -- --runInBand tests/session/storySessionController.test.ts -t 'starts brushing directly'`

- [x] **Step 3: Implement the direct-start method and expose it on the controller interface**

Delegate to the controller's existing guarded brushing-start path; keep duplicate starts and starts after cleanup as no-ops.

- [x] **Step 4: Add root-flow regressions for completion, controller restart after choice, and cleanup on every Exit path**

Use controller fixtures at the root boundary and deterministic audio/sensing with an injected test clock for controller tests; assert visible states and calls/results at the controller boundary.

- [x] **Step 5: Run focused controller and root tests, then implement fresh-controller generation and controller-driven completion**

Run: `npm test -- --runInBand tests/session/storySessionController.test.ts tests/screens/prototypeApp.test.tsx`

On choice, stop and persist the finished controller, create a new controller in direct-brushing mode, reset the 120-second timer and zone index, and stay on the prototype's choice-to-running path. Route complete to the positive completion screen. Route Exit through idempotent controller cleanup.

- [x] **Step 6: Re-run both focused test files and check that repeated start/stop remains idempotent**

An additional controller regression verifies that stopping while sensing startup is
pending cannot restart audio or leave sensing active after cleanup.

Expected: all controller/root lifecycle tests pass with no duplicate session starts.

### Task 2: Bind root sessions to local profiles and persist summaries

**Files:**
- Modify: `src/components/prototype/PrototypeApp.tsx`
- Modify: `app/index.tsx`
- Test: `tests/screens/prototypeApp.test.tsx`
- Test: `tests/storage/profileRepository.test.ts` or a focused root profile-store test

**Interfaces:**
- A loaded/saved profile reference is `{ id: string; nickname: string } | null`.
- The root profile-store boundary exposes `load()`, `save(nickname)`, and `saveSummary(summary)`; the Expo adapter maps summaries to `createSessionRepository(database).saveSummary(...)`.

- [x] **Step 1: Add a failing root test that loads the selected profile ID and saves exactly one completed summary**

Use an in-memory store fixture and assert the returned `profileId`, story ID, completion duration, confidence, engagement band, and interruption fields.

- [x] **Step 2: Run the targeted test and verify it fails because root storage does not expose IDs or summary writes**

Run: `npm test -- --runInBand tests/screens/prototypeApp.test.tsx -t 'completed domain sessions'`

- [x] **Step 3: Return profile references from the Expo profile store and save session results with the local repository**

Pass the selected ID into each controller. Guard result persistence by adventure generation so complete, Continue, Exit, and effect cleanup cannot duplicate the summary.

- [x] **Step 4: Run focused root and storage tests and verify one summary is written per adventure**

Run: `npm test -- --runInBand tests/screens/prototypeApp.test.tsx tests/storage/profileRepository.test.ts`

### Task 3: Align production adapters, sensing fallback, backgrounding, and motion

**Files:**
- Modify: `src/components/prototype/PrototypeApp.tsx`
- Modify: `src/sensing/nativeSensingAdapter.ts`
- Modify: `src/components/session/ZoneAtlas.tsx` only if needed for the 320px cap
- Test: `tests/sensing/nativeSensingAdapter.test.ts`
- Test: `tests/screens/prototypeApp.test.tsx`
- Test: `tests/components/sessionVisuals.test.tsx`

**Interfaces:**
- The app entry point uses `NativeSensingAdapter` in all builds and does not request permission until a frame processor exists; local audio playback is used for production builds, and the timed development audio player is development-only. Deterministic adapters remain explicit preview/test fixtures.
- The root camera/helper presentation derives from `sensingStatus` and renders the existing status notice. Until a frame processor exists, permission status alone cannot produce `ready`.
- The root pauses only on a non-active `AppState` transition while its session is running, and resumes only a session that it paused.

- [x] **Step 1: Add failing adapter and root tests for `processingUnavailable`, permission denial, and visible calm fallback copy**

- [x] **Step 2: Run the targeted tests and confirm production `ready`/missing fallback is the failing behavior**

Run: `npm test -- --runInBand tests/sensing/nativeSensingAdapter.test.ts tests/screens/prototypeApp.test.tsx -t 'fallback|processing unavailable|permission denied'`

- [x] **Step 3: Select production audio/sensing adapters and report truthful sensing availability**

Use the native adapter from the app entry point and keep deterministic sensing limited to explicit preview/test injection. Do not request camera permission or report `ready` until a frame-processing implementation can emit real signals; retain the calm audio-only continuation.

- [x] **Step 4: Add a failing background/foreground test and wire root AppState handling**

Verify running→background pauses once, active resumes that app-paused session, and an already user-paused session stays paused.

- [x] **Step 5: Pass reduced-motion state to `ZoneAtlas` and cap the atlas at 188px at 320px**

Add focused assertions for stationary motion and the 320px/430px widths, then use `AccessibilityInfo` unless the explicit `reducedMotion` prop overrides the system value.

- [x] **Step 6: Run focused sensing, root, and session-visual tests**

Run: `npm test -- --runInBand tests/sensing/nativeSensingAdapter.test.ts tests/screens/prototypeApp.test.tsx tests/components/sessionVisuals.test.tsx`

### Task 4: Make setup and supervision caregiver-visible

**Files:**
- Modify: `src/components/prototype/PrototypeApp.tsx`
- Modify: `tests/screens/prototypeApp.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-21-brushtales-prototype-first-app-design.md` if its profile wording needs to record the safety constraint

- [x] **Step 1: Add failing assertions that setup is addressed to a grown-up, requests a profile nickname rather than a child's name, states on-device/transient-media privacy, and reminds families about adult brushing supervision**

- [x] **Step 2: Run the focused profile/safety test and confirm the current child-name prompt fails it**

Run: `npm test -- --runInBand tests/screens/prototypeApp.test.tsx -t 'caregiver-visible'`

- [x] **Step 3: Update the form cue/label and include a short safe-brushing caregiver reminder in the authored opening copy**

Keep the form controls, session copy tone, and story actions intact; add only the adult/setup and supervision context required by product safety guidance.

- [x] **Step 4: Run the targeted tests, then run `npm run ci`**

Expected: lint, typecheck, every test suite, content validation, and child-facing safety-copy validation pass.

## Execution Ledger

- Ruling: Keep the real app's native sensing adapter unavailable until a frame processor exists, and do not request camera permission in the meantime — this preserves an honest, non-camera fallback and avoids an unneeded child-device permission prompt — the cost if wrong is that camera-based engagement feedback remains unavailable until the processor work lands.
- Ruling: Use controller fixtures at the root UI boundary and the injected monotonic clock in controller tests — this tests the state-machine/persistence boundary and exact 6.667-second cadence without tying UI tests to wall-clock scheduling — the cost if wrong is a weaker end-to-end test of the production adapter wiring, covered separately through the app factory and adapter tests.
- Ruling: Keep the profile input as a grown-up-visible nickname field and add the explicit on-device/transient-media privacy and safe-brushing supervision copy — this follows the product safety guidance while keeping the one-field prototype flow — the cost if wrong is a small copy/layout divergence from the source prototype.
