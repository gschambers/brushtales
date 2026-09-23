# BrushTales Native Sky Reef Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder React Native session route with the validated Sky Reef three-act brushing vertical slice, using deterministic local fakes until production media and vision processing exist.

**Architecture:** Keep Expo Router and the existing domain interfaces. Split the session route into a pure story-session controller plus presentational Act, brushing, atlas, and completion components. Inject deterministic audio/sensing/keep-awake dependencies in development and tests; keep the existing production adapters replaceable behind the same interfaces.

**Tech Stack:** Expo 57, React Native 0.86, Expo Router, TypeScript, Jest, React Native Testing Library, `expo-audio`, `expo-keep-awake`, `react-native-vision-camera`, and existing SQLite repositories.

**Spec:** `docs/superpowers/specs/2026-09-21-brushtales-native-vertical-slice-design.md`

## Global Constraints

- The implementation uses deterministic local fakes for development and tests, while preserving the existing audio, sensing, keep-awake, story, and storage interfaces for later production dependencies.
- The child-facing flow is `profile → Sky Reef shelf → Act 1 opening → Act 2 brushing → Act 3 closing → complete`.
- Act 1 has one **Begin story** action and no separate audio-only entry path.
- Act 2 has no child-facing finish button; session completion automatically enters Act 3.
- Act 3 is the narrative conclusion and then navigates to completion.
- The 18-zone atlas has ten teeth per row with 3/4/3 grouping and an enlarged local OpenMoji toothbrush cue.
- Camera frames, audio recordings, biometric identifiers, and ML tensors are never persisted or uploaded.
- Missing audio, camera denial, unsupported sensing, and wake-lock failure preserve the session composition and story path.
- `npm run ci` and native portrait checks must pass before the slice is considered complete.

## Review Focus

- **Opening audio never emits `finished`:** the controller must not start brushing until the opening completion event, and tests must explicitly control that event.
- **Camera denial/no-face/low-light:** the same brushing composition must remain usable with a quiet status, covered by controller and component tests.
- **Session completion during a polling tick:** the engine must be stopped/released once, then Act 3 must start exactly once; test duplicate completion notifications.
- **Lower-right atlas zones at narrow widths:** the enlarged brush must remain inside the native atlas container; component geometry tests must cover upper/lower right zones.
- **App background/interruption during brushing:** pause/resume and audio interruption must preserve remaining time and clean up resources; controller tests must cover both paths.

---

### Task 1: Add deterministic session dependencies and shared view types

**Files:**
- Create: `src/session/storySessionTypes.ts`
- Create: `src/audio/deterministicAudioPlayer.ts`
- Create: `src/sensing/deterministicSensingAdapter.ts`
- Test: `tests/session/deterministicDependencies.test.ts`

**Interfaces:**

`src/session/storySessionTypes.ts` produces:

```ts
export type SessionPhase = 'opening' | 'brushing' | 'closing' | 'complete'
export type SessionAudioState = 'idle' | 'playing' | 'paused' | 'unavailable' | 'finished'

export interface StorySessionViewState {
  phase: SessionPhase
  audioState: SessionAudioState
  zoneIndex: number
  remainingMs: number
  sensingStatus: SensingStatus
  keepAwakeState: KeepAwakeState
  statusNotice: string | null
}
```

`DeterministicAudioPlayer` implements `AudioPlayer` and exposes:

```ts
finish(): void
interrupt(): void
loadedAssetId: AudioAssetId | null
```

`DeterministicSensingAdapter` implements `SensingAdapter` and exposes:

```ts
emit(signal: SensingSignal): void
```

- [ ] **Step 1: Write the failing tests for fake audio events.**

```ts
it('loads, plays, and explicitly finishes without wall-clock timing', async () => {
  const audio = new DeterministicAudioPlayer()
  const events: AudioPlayerEvent[] = []
  audio.onStateChange((event) => events.push(event))

  await audio.load('intro')
  await audio.play()
  audio.finish()

  expect(audio.loadedAssetId).toBe('intro')
  expect(events).toEqual(['ready', 'playing', 'finished'])
})
```

- [ ] **Step 2: Run the focused test and verify the expected missing-module failure.**

Run: `npx jest tests/session/deterministicDependencies.test.ts --runInBand`

Expected: FAIL because `DeterministicAudioPlayer` and `DeterministicSensingAdapter` do not exist.

- [ ] **Step 3: Implement the deterministic audio player.**

Keep `load`, `play`, `pause`, and `stop` asynchronous to match `AudioPlayer`. `finish()` emits `finished`; `interrupt()` emits `interruption`; no timer or native module is used.

- [ ] **Step 4: Implement the deterministic sensing adapter.**

`start(listener)` stores the listener, emits one ready signal with zero motion and low confidence, and returns `ready`. `emit()` forwards only while running. `stop()` clears the listener and running flag.

- [ ] **Step 5: Add fake behavior tests for sensing and interruption.**

Assert that signals are ignored after `stop()` and that `interrupt()` emits the audio interruption event exactly once per call.

- [ ] **Step 6: Run the focused tests and commit.**

Run: `npx jest tests/session/deterministicDependencies.test.ts --runInBand`

Expected: PASS with all fake dependency tests green.

```bash
git add src/session/storySessionTypes.ts src/audio/deterministicAudioPlayer.ts src/sensing/deterministicSensingAdapter.ts tests/session/deterministicDependencies.test.ts
git commit -m "feat: add deterministic session dependencies"
```

### Task 2: Build the native visual components

**Files:**
- Create: `src/components/session/sessionTheme.ts`
- Create: `src/components/session/ActScreen.tsx`
- Create: `src/components/session/ZoneAtlas.tsx`
- Create: `src/components/session/BrushingSurface.tsx`
- Create: `src/components/session/CompletionScreen.tsx`
- Create: `assets/openmoji-toothbrush.png`
- Create: `assets/ATTRIBUTION.md` with the native asset path and the existing OpenMoji source/license attribution
- Test: `tests/components/sessionVisuals.test.tsx`

**Interfaces:**

`ActScreen` consumes:

```ts
interface ActScreenProps {
  act: 'opening' | 'closing'
  title: string
  body: string
  primaryLabel: string
  onPrimaryPress: () => void
}
```

`ZoneAtlas` consumes:

```ts
interface ZoneAtlasProps {
  zoneIndex: number
  width?: number
  reducedMotion?: boolean
}
```

`BrushingSurface` consumes:

```ts
interface BrushingSurfaceProps {
  snapshot: SessionSnapshot
  viewState: StorySessionViewState
  onPauseResume: () => void
  onExit: () => void
  reducedMotion?: boolean
  showCamera: boolean
}
```

`CompletionScreen` consumes `completed: boolean` and an `onReturn` callback.

- [ ] **Step 1: Add the local native toothbrush asset and attribution.**

Create the native-compatible raster asset from the already attributed local
OpenMoji source. Keep the source SVG and attribution boundary documented; do
not download from a runtime URL. The native attribution file must cite the
same OpenMoji source URL and CC BY-SA 4.0 license as the prototype attribution.

- [ ] **Step 2: Write component tests for the Act and completion surfaces.**

Assert that Act 1 renders **Begin story**, Act 3 renders one continuation action, and completion uses positive copy with an accessible return button.

- [ ] **Step 3: Write atlas tests before implementation.**

For zone indexes `0`, `2`, `9`, `11`, and `17`, assert:

```ts
expect(getAllByTestId('tooth')).toHaveLength(20)
expect(getAllByTestId('active-tooth')).toHaveLength(4)
expect(getByTestId('toothbrush')).toHaveProp('accessibilityElementsHidden', true)
```

Assert the active group is left/center/right according to the explicit `[0,3)`, `[3,7)`, and `[7,10)` ranges, including the lower-row mirrored anchor.

- [ ] **Step 4: Implement `sessionTheme.ts`.**

Define the pastel session colors, readable deep-ink text, spacing, and minimum 48dp touch target constants. Keep the theme local to session components rather than changing the app-wide palette.

- [ ] **Step 5: Implement `ZoneAtlas`.**

Render two ten-tooth rows with React Native `View`/`Animated.View` primitives, four active teeth for the current group, upper/lower transforms, surface variants for front/chewing/inside, and the local toothbrush image. Use `overflow: 'hidden'` only on the outer atlas container after the brush anchor is clamped; the tooth rows themselves must remain visible enough for the brush to align.

- [ ] **Step 6: Implement `BrushingSurface`.**

Use a safe-area-aware vertical layout: reserved camera slot, seconds-only countdown badge, lower visual region, compact playback control with the audio halo behind it, atlas, and quiet notices. Keep the pause/resume control as the only child-facing session action besides the muted exit.

- [ ] **Step 7: Implement `ActScreen` and `CompletionScreen`.**

Use reviewed non-punitive copy from the prototype. Act 3 must communicate narrative conclusion, not another choice phase.

- [ ] **Step 8: Run component tests and commit.**

Run: `npx jest tests/components/sessionVisuals.test.tsx --runInBand`

Expected: PASS with accessible act/completion surfaces and atlas grouping tests green.

```bash
git add src/components/session assets/openmoji-toothbrush.png assets/ATTRIBUTION.md tests/components/sessionVisuals.test.tsx
git commit -m "feat: add native BrushTales session visuals"
```

### Task 3: Implement the three-act session controller

**Files:**
- Create: `src/session/storySessionController.ts`
- Create: `src/session/useStorySessionController.ts`
- Test: `tests/session/storySessionController.test.ts`
- Modify: `src/domain/session/sessionEngine.ts` only if a controller-owned lifecycle hook is required by a failing test

**Interfaces:**

```ts
export interface StorySessionControllerDependencies {
  audio: AudioPlayer
  sensing: SensingAdapter
  keepAwake: KeepAwakeController
  clock: MonotonicClock
  profileId: string
  storyId: string
  durationMs: number
  openingAssetId: AudioAssetId
  brushingAssetId: AudioAssetId
  closingAssetId: AudioAssetId
}

export interface StorySessionController {
  state(): StorySessionViewState
  snapshot(): SessionSnapshot
  refresh(): void
  beginStory(): Promise<void>
  pauseOrResume(): Promise<void>
  stop(): Promise<SessionResult>
  subscribe(listener: () => void): () => void
}
```

- [ ] **Step 1: Write failing controller tests for the phase sequence.**

Cover:

```ts
it('does not start brushing before opening audio finishes', async () => { /* assert engine snapshot remains idle */ })
it('starts brushing after opening finishes', async () => { /* assert running and 120 seconds */ })
it('enters closing exactly once when the engine completes', async () => { /* emit duplicate snapshots/events */ })
it('enters complete after closing audio finishes', async () => { /* assert complete */ })
```

Use `DeterministicAudioPlayer`, a manually advanced monotonic clock, and fake keep-awake. Do not use real timers for phase assertions.

- [ ] **Step 2: Run the controller tests and verify they fail for the missing controller.**

Run: `npx jest tests/session/storySessionController.test.ts --runInBand`

Expected: FAIL because the controller factory/class is not implemented.

- [ ] **Step 3: Implement the pure controller lifecycle.**

On `beginStory`, load/play the opening asset and remain in `opening`. On an opening `finished` event, load the brushing fallback/asset, call `SessionEngine.start`, set `phase` to `brushing`, and notify subscribers. `refresh()` polls the engine snapshot and detects completion once, calls `engine.stop()`, loads/plays the closing asset, and sets `phase` to `closing`.

- [ ] **Step 4: Implement pause/resume and status mapping.**

Delegate pause/resume to the engine. Map sensing statuses and keep-awake states to non-punitive notices. Audio interruption sets a recoverable notice and does not end the session.

- [ ] **Step 5: Implement the React hook wrapper.**

Create the controller once per dependency set, subscribe with `useSyncExternalStore` or an equivalent stable subscription pattern, call `refresh()` on the UI polling cadence, and expose the controller actions plus current view state. Ensure unmount calls `stop()` only when a session is active and never starts duplicate cleanup.

- [ ] **Step 6: Add lifecycle failure tests.**

Test camera denial/no-face, wake denial/revocation, audio interruption, app pause/resume forwarding, duplicate completion, and idempotent stop/release calls.

- [ ] **Step 7: Run controller tests and commit.**

Run: `npx jest tests/session/storySessionController.test.ts --runInBand`

Expected: PASS with all phase, failure, and cleanup tests green.

```bash
git add src/session/storySessionController.ts src/session/useStorySessionController.ts tests/session/storySessionController.test.ts src/domain/session/sessionEngine.ts
git commit -m "feat: add three-act story session controller"
```

### Task 4: Replace the placeholder session route and completion route

**Files:**
- Modify: `app/session/[storyId].tsx`
- Modify: `app/complete/[sessionId].tsx`
- Modify: `app/_layout.tsx` if safe-area or status-bar configuration is required by failing device tests
- Test: `tests/screens/sessionScreen.test.tsx`
- Test: `tests/accessibility/core-flow.test.tsx`

**Interfaces:**

`SessionScreen` continues to accept dependency overrides for tests:

```ts
interface SessionScreenProps {
  storyId: string
  profileId?: string
  ageBand?: AgeBand
  audio?: AudioPlayer
  sensing?: SensingAdapter
  keepAwake?: KeepAwakeController
  clock?: MonotonicClock
}
```

- [ ] **Step 1: Update screen tests to describe the new flow.**

Replace the obsolete `Start adventure → Continue adventure → choices → Finish adventure` assertions with:

```ts
press('Begin story')
expect(getByText('Opening audiobook')).toBeTruthy()
finishOpening()
expect(getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
completeSession()
expect(getByText('Closing audiobook')).toBeTruthy()
finishClosing()
expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('/complete/'))
```

Add an assertion that no button named `Finish adventure` exists during brushing.

- [ ] **Step 2: Run the updated screen/accessibility tests and verify the expected failures.**

Run: `npx jest tests/screens/sessionScreen.test.tsx tests/accessibility/core-flow.test.tsx --runInBand`

Expected: FAIL because the route still renders the old placeholder screen.

- [ ] **Step 3: Integrate profile loading and dependency selection.**

Keep the existing profile repository lookup. In `__DEV__`, default to deterministic audio and sensing fakes with short automatic phase completion for simulator review; in production, default to `LocalAudioPlayer` and `NativeSensingAdapter`. Preserve all dependency overrides for tests and later production replacement. Pass the profile age band to the presentational components.

- [ ] **Step 4: Render by controller phase.**

Render `ActScreen` for opening/closing, `BrushingSurface` for brushing, and `CompletionScreen` through the existing completion route. Route exit stops the controller and returns to stories/profiles without saving raw media.

- [ ] **Step 5: Persist the summary and navigate only after cleanup.**

When the controller reaches `complete`, persist `SessionSummary` through `createSessionRepository` and replace the route with `/complete/<sessionId>?completed=<boolean>`. Guard against duplicate navigation when React effects re-run or the engine reports completion twice.

- [ ] **Step 6: Verify screen and accessibility tests.**

Run: `npx jest tests/screens/sessionScreen.test.tsx tests/accessibility/core-flow.test.tsx --runInBand`

Expected: PASS with the three-act flow, positive completion, accessible controls, no finish button, and failure notices covered.

- [ ] **Step 7: Commit route integration.**

```bash
git add app/session/[storyId].tsx app/complete/[sessionId].tsx app/_layout.tsx tests/screens/sessionScreen.test.tsx tests/accessibility/core-flow.test.tsx
git commit -m "feat: integrate native Sky Reef brushing flow"
```

### Task 5: Run full verification and record the native slice gates

**Files:**
- Modify: `tests/device/visionScenarios.md`
- Modify: `tests/visual/prototypeStates.md` only for cross-reference notes if the native parity checklist changes
- Create: `tests/device/skyReefVerticalSlice.md`

- [ ] **Step 1: Add the device acceptance checklist.**

Record manual checks for iOS and Android portrait devices: profile selection, Begin story, camera-visible and denied states, seconds countdown, pause/resume, app backgrounding, wake denial/revocation, rightmost atlas zones, automatic closing, positive completion, and return navigation.

- [ ] **Step 2: Run static and repository verification.**

Run:

```bash
node --check prototype/prototype.js
git diff --check
npm run ci
```

Expected: lint, typecheck, all Jest suites, story validation, and safety-copy validation pass.

- [ ] **Step 3: Run the focused native test matrix.**

Run:

```bash
npx jest tests/session/deterministicDependencies.test.ts tests/session/storySessionController.test.ts tests/components/sessionVisuals.test.tsx tests/screens/sessionScreen.test.tsx tests/accessibility/core-flow.test.tsx --runInBand
```

Expected: all fake dependency, controller, component, screen, and accessibility tests pass.

- [ ] **Step 4: Review the diff against the design spec.**

Confirm no post-session story-choice phase, no child-facing brushing finish button, no runtime media/network dependency, no raw media persistence, and no medical/dental claims were introduced.

- [ ] **Step 5: Commit verification documentation.**

```bash
git add tests/device/skyReefVerticalSlice.md tests/device/visionScenarios.md tests/visual/prototypeStates.md
git commit -m "test: document Sky Reef vertical slice gates"
```
