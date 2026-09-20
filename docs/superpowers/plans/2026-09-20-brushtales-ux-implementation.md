# BrushTales UX Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current text-and-border scaffold with an audio-first BrushTales experience featuring a gradient session surface, central play/pause control, deterministic audio-envelope animation, authored tooth-zone prompts, guided local-profile onboarding, and repeatable web/native visual QA.

**Architecture:** Keep the existing session engine, story graph, sensing adapter, audio player, repositories, and Expo Router boundaries. Add a small presentation layer under `src/ui` that renders domain snapshots and authored visual metadata without importing native vision details. Keep animation deterministic and injectable so reduced-motion, audio-only, pause/resume, and screenshot states are testable.

**Tech Stack:** React Native 0.86 / Expo SDK 57, Expo Router, TypeScript, `expo-linear-gradient`, `Animated`, Jest, React Native Testing Library, `agent-browser`, `xcrun simctl`, and optional Maestro flows for native screenshot assertions.

**Spec:** `docs/superpowers/specs/2026-09-20-brushtales-ux-design.md`

## Global Constraints

- “Make audio the primary experience and the screen a quiet companion.”
- “Use authored tooth-zone illustrations as gentle prompts, never as a claim about detected coverage or dental quality.”
- “The same composition survives failure.” Camera denial, sensing uncertainty, audio interruption, and wake-state warnings must not replace the session with an error screen.
- “Account setup” means a local explorer profile in v0; do not add email, password, location, photographs, voice samples, cloud sync, or account recovery.
- Camera frames, face images, voice recordings, and biometric identifiers remain transient or absent from storage.
- All child-facing copy must be encouraging and non-clinical; no shame, failure, cleanliness, plaque, or dental-quality claims.
- Native interactive targets are at least 48dp; web targets are at least 44 CSS pixels where practical.
- Every essential state must have an audio-only equivalent and a reduced-motion equivalent.
- Use deterministic clocks, audio-envelope fixtures, story choices, and sensing fixtures for screenshot and component tests.
- Fixed audio assets remain local and reviewed; no runtime TTS or runtime-generated child-facing text.
- Do not commit raw camera samples, child media, or generated child recordings.

## Review Focus

- **Audio-only fallback:** camera permission denial, unsupported sensing, no-face, and low-light states preserve the same session layout and story controls. Test in Tasks 5 and 6.
- **Motion preferences:** Reduce Motion disables the ring’s scale/pulse animation while retaining playback state and prompt meaning. Test in Task 2.
- **Large text and small screens:** content reflows without clipping the central action, zone atlas, or choices. Test in Tasks 1, 4, and 7.
- **Profile isolation:** avatar and onboarding presentation changes must not alter profile repository ownership or expose another child’s history. Test in Task 4.
- **Deterministic visual review:** web and iOS captures represent settled states rather than timer or animation noise. Test and document in Task 7.

---

## Task 0: Build the disposable visual prototype spike

**Files:**
- Create: `prototype/index.html`
- Create: `prototype/prototype.css`
- Create: `prototype/prototype.js`
- Create: `tests/visual/prototypeStates.md`

**Interfaces:**
- The prototype is a standalone browser artifact and does not import production
  code, persistence, native modules, or child media.
- `prototype.js` exposes only local state controls for `welcome`, `profile`,
  `preflight`, `running`, `paused`, `audioOnly`, `choice`, and `complete`.
- The prototype’s fake envelope is a fixed array such as
  `[0.25, 0.42, 0.7, 0.38, 0.55, 0.3]`; it is not an audio recording.

- [ ] **Step 1: Create the standalone prototype markup**

Create one mobile-width document with a full-screen Sky Reef gradient, top
metadata, a central play/pause circle, an outer ring, three tooth-zone cards,
two choice cards, and a compact status chip. Include buttons that switch between
the named states and a “Reduce motion” checkbox. Give every button an accessible
name and use `aria-pressed`/`aria-current` for selected state.

- [ ] **Step 2: Add the prototype styles and restrained motion**

Use CSS custom properties for the candidate palette, spacing, radii, and touch
targets. Keep the primary button at least 176px in the prototype and all other
controls at least 48px high. Use a slow ring scale animation for running state
and disable it under `@media (prefers-reduced-motion: reduce)` or the local
checkbox. Keep the tooth-zone cards readable on a 320px-wide viewport.

- [ ] **Step 3: Add state transitions and fake envelope playback**

Implement a small state machine in `prototype.js`. The play button changes the
state from preflight to running, the pause button changes running to paused,
the audio-only control removes the camera tile without changing composition,
the choice control displays exactly two options, and completion returns to the
same world with a warmer horizon. The ring reads from the fixed envelope array
only while the state is running.

- [ ] **Step 4: Run syntax and accessibility checks**

Run:

```bash
node --check prototype/prototype.js
agent-browser open "file://$PWD/prototype/index.html"
agent-browser snapshot
agent-browser screenshot --screenshot-dir "$TMPDIR/brushtales-prototype"
```

Expected: the script parses, the accessibility snapshot exposes every primary
control, and the screenshot shows the mobile composition without clipped text.

- [ ] **Step 5: Capture the prototype state matrix**

For each named state, record the exact interaction sequence, screenshot path,
intended focal action, and any visual defect in `tests/visual/prototypeStates.md`.
Review at 320px and 430px widths, with reduced motion enabled, and with the
audio-only status visible.

- [ ] **Step 6: Stop for visual review before production UI work**

Present the prototype captures and state matrix for human review. Do not carry
prototype HTML/CSS into the production app; use the review to settle hierarchy,
zone-card proportions, ring subtlety, and onboarding step order before Task 1.

---

## File map and ownership

### Shared presentation layer

- Create `src/ui/theme.ts` — semantic colors, spacing, radii, typography, and minimum touch-target constants.
- Create `src/ui/ScreenShell.tsx` — safe-area-aware gradient canvas and content containment.
- Create `src/ui/PrimaryButton.tsx` — labeled child-facing action with consistent states.
- Create `src/ui/PlaybackButton.tsx` — central play/pause/resume control with accessible labels.
- Create `src/ui/AudioEnvelopeRing.tsx` — deterministic animated ring driven by normalized envelope samples.
- Create `src/ui/ToothZoneAtlas.tsx` — three-view authored prompt illustration with non-color-only state cues.
- Create `src/ui/StatusChip.tsx` — compact camera/audio-only/wake-state status presentation.
- Create `src/ui/useReducedMotion.ts` — subscribes to `AccessibilityInfo` and exposes a testable reduced-motion state.
- Create `src/ui/sessionPresentation.ts` — pure formatting and status mapping functions.

### Authored metadata

- Modify `src/domain/story/types.ts` — add a typed authored `StoryZone` to nodes.
- Modify `src/content/story/sky-reef.json` — assign a safe authored zone prompt to every reachable node.
- Modify `content/audio/manifest.json` — add normalized envelope samples to every reviewed clip.
- Modify `tools/validate-story.ts` — validate envelope shape and values.
- Modify `src/audio/audioManifest.ts` — expose envelopes through `AudioAsset`.

### Routes and providers

- Modify `app/_layout.tsx` — render the full-screen root shell correctly without introducing route state.
- Modify `app/index.tsx` — style welcome/profile selection and distinguish child profile selection from adult setup.
- Modify `app/parent.tsx` — style the adult gate/settings surface while preserving local-only copy and controls.
- Modify `app/profiles/new.tsx` — add avatar selection and presentation consistent with the visual system.
- Modify `app/session/[storyId].tsx` — integrate the session shell, playback button, ring, zone atlas, status chips, choice sheet, and fallbacks.
- Modify `app/complete/[sessionId].tsx` — add the safe positive completion surface.
- Modify `src/providers/AppProviders.tsx` — expose only presentation/session setup state that must survive route changes.

### Tests and documentation

- Create: `prototype/index.html`, `prototype/prototype.css`, `prototype/prototype.js` — disposable visual spike only.
- Create: `tests/visual/prototypeStates.md` — prototype capture/state matrix.
- Create `tests/ui/sessionPresentation.test.ts`.
- Create `tests/ui/AudioEnvelopeRing.test.tsx`.
- Create `tests/ui/ToothZoneAtlas.test.tsx`.
- Create `tests/ui/ScreenShell.test.tsx`.
- Create `tests/screens/onboarding.test.tsx`.
- Create `tests/screens/sessionVisualStates.test.tsx`.
- Modify `tests/accessibility/core-flow.test.tsx`.
- Modify `tests/domain/storyGraph.test.ts` or add `tests/content/visualMetadata.test.ts` for authored zones.
- Modify or add `tests/content/audioManifest.test.ts` for envelope validation.
- Create `docs/testing/visual-feedback-loop.md`.
- Create `changelog/0009-visual-shell-and-qa-loop.md` documenting the gradient dependency and visual QA decision.

---

## Task 1: Add the visual shell and design tokens

**Files:**
- Create: `src/ui/theme.ts`
- Create: `src/ui/ScreenShell.tsx`
- Create: `src/ui/PrimaryButton.tsx`
- Create: `src/ui/sessionPresentation.ts`
- Create: `tests/ui/ScreenShell.test.tsx`
- Create: `tests/ui/sessionPresentation.test.ts`
- Modify: `app/_layout.tsx`
- Modify: `package.json`, `package-lock.json`
- Create: `changelog/0009-visual-shell-and-qa-loop.md`

**Interfaces:**
- `ScreenShell({ children, variant?, testID? })` renders a safe-area-aware full-screen gradient and contained children.
- `PrimaryButton({ label, onPress, disabled?, accessibilityLabel?, variant? })` renders a minimum 48dp action.
- `formatRemainingTime(remainingMs: number): string` returns `mm:ss` with a zero-padded seconds component.
- `getSessionStatusMessage(status: SensingStatus, keepAwakeState: KeepAwakeState): string | null` returns only encouraging, non-clinical status copy.
- `theme` exports semantic colors and layout constants; route files do not hard-code palette values.

- [ ] **Step 1: Write failing formatting and status tests**

```ts
import { formatRemainingTime, getSessionStatusMessage } from '../../src/ui/sessionPresentation'

describe('session presentation helpers', () => {
  it('formats a two-minute countdown as minutes and seconds', () => {
    expect(formatRemainingTime(120_000)).toBe('2:00')
    expect(formatRemainingTime(61_000)).toBe('1:01')
    expect(formatRemainingTime(-1)).toBe('0:00')
  })

  it('uses solution-oriented copy for sensing fallback', () => {
    expect(getSessionStatusMessage('permissionDenied', 'active'))
      .toBe('The story can continue with audio.')
  })
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --runInBand tests/ui/sessionPresentation.test.ts`

Expected: FAIL because `src/ui/sessionPresentation.ts` does not exist.

- [ ] **Step 3: Implement semantic tokens and pure presentation helpers**

Define a palette with semantic names such as `night`, `reef`, `horizon`,
`surface`, `textPrimary`, `textSecondary`, `accentWarm`, and `accentCool`.
Export spacing, radii, typography sizes, and `minimumTouchTarget = 48`.
Clamp negative countdown values to zero and map `unsupported`,
`permissionDenied`, `noFace`, `lowLight`, and `processingUnavailable` to
solution-oriented copy. Map denied/revoked wake state to a quiet “Screen may
dim, but the adventure can continue.” message.

- [ ] **Step 4: Add the gradient shell and primary button**

Run `npx expo install expo-linear-gradient`. Use `LinearGradient` with the
semantic palette and `SafeAreaView`/`View` containment. Add the dependency’s
platform, license, privacy, and fallback notes to
`changelog/0009-visual-shell-and-qa-loop.md`: it renders local colors only,
does not access device data, and falls back to the base `night` color if the
native gradient cannot render.

Ensure the root layout gives the router a flex container so routes fill the
viewport instead of placing content at the top of a non-flex wrapper.

- [ ] **Step 5: Add shell and helper tests**

Assert the shell renders its children, the primary button has a `button` role,
and the button’s hit area is at least 48dp in style. Keep the gradient mocked in
Jest so tests remain native-module independent.

- [ ] **Step 6: Run focused tests and type checking**

Run: `npm test -- --runInBand tests/ui/ScreenShell.test.tsx tests/ui/sessionPresentation.test.ts`

Run: `npm run typecheck`

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the visual shell**

```bash
git add src/ui/theme.ts src/ui/ScreenShell.tsx src/ui/PrimaryButton.tsx src/ui/sessionPresentation.ts tests/ui/ScreenShell.test.tsx tests/ui/sessionPresentation.test.ts app/_layout.tsx package.json package-lock.json changelog/0009-visual-shell-and-qa-loop.md
git commit -m "feat: add BrushTales visual shell"
```

## Task 2: Add reduced motion and deterministic audio-envelope presentation

**Files:**
- Create: `src/ui/useReducedMotion.ts`
- Create: `src/ui/AudioEnvelopeRing.tsx`
- Create: `tests/ui/AudioEnvelopeRing.test.tsx`
- Modify: `src/audio/audioManifest.ts`
- Modify: `content/audio/manifest.json`
- Modify: `tools/validate-story.ts`
- Create or modify: `tests/content/audioManifest.test.ts`

**Interfaces:**
- `type AudioEnvelope = number[]` with values normalized to `[0, 1]`.
- `AudioAsset.envelope: AudioEnvelope`.
- `useReducedMotion(): boolean` returns the current accessibility motion preference.
- `AudioEnvelopeRing({ envelope, playing, reducedMotion?, testID? })` renders a decorative ring and exposes no score or sensing meaning.
- `validateAudioManifest()` rejects empty, non-finite, or out-of-range envelope samples.

- [ ] **Step 1: Write failing envelope validation and motion tests**

```ts
it('rejects an envelope with values outside the normalized range', () => {
  expect(() => validateAudioManifest(manifestWithEnvelope([0, 0.4, 1.1])))
    .toThrow('envelope')
})
```

```tsx
it('does not start a scale animation when reduced motion is enabled', () => {
  const { getByTestId } = render(
    <AudioEnvelopeRing envelope={[0.2, 0.8]} playing reducedMotion testID="ring" />,
  )
  expect(getByTestId('ring').props.accessible).toBe(false)
  expect(getByTestId('ring').props.style.transform).toEqual([{ scale: 1 }])
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- --runInBand tests/ui/AudioEnvelopeRing.test.tsx tests/content/audioManifest.test.ts`

Expected: FAIL because envelope metadata and the ring do not exist.

- [ ] **Step 3: Add reviewed envelope metadata to the audio manifest**

Add a short normalized array to every clip in `content/audio/manifest.json`.
Use deterministic authored values with 8–32 samples per clip; do not generate
or commit child recordings. Extend the manifest type and validator to require
the array, finite samples, and values between `0` and `1`.

- [ ] **Step 4: Implement the reduced-motion hook**

Use `AccessibilityInfo.isReduceMotionEnabled()` on mount and subscribe with
`AccessibilityInfo.addEventListener('reduceMotionChanged', listener)`. Return a
cleanup function. Accept an optional test override in the hook’s internal
implementation rather than mocking global accessibility state in every test.

- [ ] **Step 5: Implement the ring with a deterministic phase**

Use `Animated.Value` and an interval or request-animation-frame loop that maps
the current elapsed phase to an envelope sample. When `playing` is false,
animate back to the base scale once. When reduced motion is true, render the
base ring and use only a slow opacity change or no animation. Set
`accessible={false}` on the decorative ring and put playback state on the
parent playback control so screen readers do not announce a meaningless visual
level.

- [ ] **Step 6: Run validation, component tests, and content checks**

Run: `npm test -- --runInBand tests/ui/AudioEnvelopeRing.test.tsx tests/content/audioManifest.test.ts`

Run: `npm run validate:content`

Expected: all envelope validation and reduced-motion tests pass.

- [ ] **Step 7: Commit audio-envelope presentation**

```bash
git add src/ui/useReducedMotion.ts src/ui/AudioEnvelopeRing.tsx tests/ui/AudioEnvelopeRing.test.tsx src/audio/audioManifest.ts content/audio/manifest.json tools/validate-story.ts tests/content/audioManifest.test.ts
git commit -m "feat: add deterministic audio envelope visuals"
```

## Task 3: Add authored tooth-zone metadata and the zone atlas

**Files:**
- Create: `src/ui/ToothZoneAtlas.tsx`
- Create: `tests/ui/ToothZoneAtlas.test.tsx`
- Modify: `src/domain/story/types.ts`
- Modify: `src/content/story/sky-reef.json`
- Modify: `src/domain/story/storyGraph.ts` if validation needs the new field
- Modify: `tests/domain/storyGraph.test.ts`

**Interfaces:**
- `type StoryZone = 'front' | 'upper' | 'lower'`.
- Every `StoryNode` has `zone: StoryZone`.
- `ToothZoneAtlas({ activeZone, prompt?, reducedMotion?, testID? })` renders all three views and marks exactly one as active.

- [ ] **Step 1: Write failing type/content and atlas tests**

```tsx
it('marks the authored upper zone with more than color alone', () => {
  const { getByTestId } = render(<ToothZoneAtlas activeZone="upper" testID="atlas" />)
  expect(getByTestId('zone-upper').props.accessibilityLabel).toContain('active')
  expect(getByTestId('zone-upper').props.accessibilityState).toEqual({ selected: true })
})
```

```ts
it('requires a valid authored zone on every reachable story node', () => {
  const invalidGraph = {
    ...storyGraph,
    nodes: {
      ...storyGraph.nodes,
      intro: { ...storyGraph.nodes.intro, zone: 'invalid' },
    },
  } as unknown as StoryGraph
  expect(() => validateStoryGraph(invalidGraph)).toThrow('zone')
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- --runInBand tests/ui/ToothZoneAtlas.test.tsx tests/domain/storyGraph.test.ts`

Expected: FAIL because story nodes and the atlas have no zone contract.

- [ ] **Step 3: Add the typed `StoryZone` field and authored values**

Add `zone: StoryZone` to narration, choice, and ending nodes. Assign a small
authored progression across the Sky Reef graph, for example front for the
opening, upper for the first branch, lower for the second branch, and front or
upper for endings. Keep these values as prompts only; do not derive them from
`SensingSignal`.

- [ ] **Step 4: Extend story validation**

Validate that every reachable node has one of the three zones. Keep the error
message tied to the node ID so content authors can correct invalid JSON.

- [ ] **Step 5: Implement the atlas without a new image dependency**

Use focused React Native `View` shapes and labels for the prototype atlas so it
works on native and web without requiring a generated image bundle. Render
front, upper, and lower profile cards in a bounded lower-third container. The
active card gets a border/shape treatment, label, and `accessibilityState`, not
just an accent color. Expose the prompt as readable text for larger text and
screen readers.

- [ ] **Step 6: Run story and atlas tests**

Run: `npm test -- --runInBand tests/ui/ToothZoneAtlas.test.tsx tests/domain/storyGraph.test.ts`

Run: `npm run validate:content`

Expected: every reachable story node has a valid zone and the atlas exposes one
selected zone with non-color cues.

- [ ] **Step 7: Commit the zone atlas**

```bash
git add src/ui/ToothZoneAtlas.tsx tests/ui/ToothZoneAtlas.test.tsx src/domain/story/types.ts src/content/story/sky-reef.json src/domain/story/storyGraph.ts tests/domain/storyGraph.test.ts
git commit -m "feat: add authored tooth zone prompts"
```

## Task 4: Rebuild welcome, adult setup, and local profile creation

**Files:**
- Create: `src/domain/profile/avatarOptions.ts`
- Create: `tests/screens/onboarding.test.tsx`
- Create: `tests/support/profileRepositoryFakes.ts`
- Modify: `app/index.tsx`
- Modify: `app/parent.tsx`
- Modify: `app/profiles/new.tsx`
- Modify: `src/providers/AppProviders.tsx` only if a route-safe active-profile helper is needed

**Interfaces:**
- `AVATAR_OPTIONS: readonly { key: string; label: string; glyph: string }[]` is a reviewed local list with no child media.
- Profile creation submits `{ nickname, ageBand, avatarKey }` through the existing `ProfileRepository`.
- Returning families can select an existing profile without seeing another profile’s history.

- [ ] **Step 1: Write failing onboarding tests**

```tsx
it('shows a welcoming setup action when no local profiles exist', async () => {
  render(<HomeScreen />)
  expect(await screen.findByText('Set up an explorer')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Adult setup' })).toBeTruthy()
})

it('submits the selected avatar with the local profile', async () => {
  const profileRepository = { create: jest.fn().mockResolvedValue({ id: 'profile-1' }) }
  mockProfileRepository(profileRepository)
  render(<NewProfileScreen />)
  fireEvent.press(screen.getByRole('radio', { name: 'Moon manta' }))
  fireEvent.changeText(screen.getByLabelText('Profile nickname'), 'Mira')
  fireEvent.press(screen.getByRole('button', { name: 'Save profile' }))
  expect(profileRepository.create).toHaveBeenCalledWith({ nickname: 'Mira', ageBand: '4-5', avatarKey: 'moon-manta' })
})
```

The test helper must mock `openAppDatabase` and `createProfileRepository` to
return this injected repository, while leaving the production repository
implementation unchanged.

- [ ] **Step 2: Run onboarding tests and verify they fail**

Run: `npm test -- --runInBand tests/screens/onboarding.test.tsx`

Expected: FAIL because the routes still use the old text-only controls and do
not expose avatar choices.

- [ ] **Step 3: Add the reviewed avatar option list**

Use a small fixed list of symbolic options such as star, moon manta, cloud fox,
and reef whale. Each option has a visible label and a glyph/shape; do not add
photos, camera capture, or personalization that stores media.

- [ ] **Step 4: Style the home/profile picker**

Render `ScreenShell`, a short welcome/selection heading, large profile cards,
avatar glyphs, and an adult setup button. When no profiles exist, show the
“Set up an explorer” action and a concise local-device explanation. Preserve the
existing route query contract for `profileId`.

- [ ] **Step 5: Style the adult gate/settings screen**

Keep the adult confirmation before profile creation, reminders, history, age
band editing, and deletion. Use high-contrast caregiver panels and keep privacy
copy visible. Do not make reminders part of the first-run blocking path.

- [ ] **Step 6: Add avatar selection to profile creation**

Render nickname, age-band radio cards, and avatar radio cards inside the shared
shell. Submit `avatarKey` to the existing repository. Keep the current
nickname validation and saving/error states. Add an explicit label explaining
that age band changes language and guidance, not health conclusions.

- [ ] **Step 7: Run onboarding, storage, accessibility, and type checks**

Run: `npm test -- --runInBand tests/screens/onboarding.test.tsx tests/accessibility/core-flow.test.tsx`

Run: `npm run typecheck`

Expected: local profile creation, avatar selection, adult gating, and existing
profile isolation all pass.

- [ ] **Step 8: Commit onboarding**

```bash
git add src/domain/profile/avatarOptions.ts tests/screens/onboarding.test.tsx tests/support/profileRepositoryFakes.ts app/index.tsx app/parent.tsx app/profiles/new.tsx src/providers/AppProviders.tsx
git commit -m "feat: add guided local profile onboarding"
```

## Task 5: Build the active session composition

**Files:**
- Create: `src/ui/PlaybackButton.tsx`
- Create: `src/ui/StatusChip.tsx`
- Create: `tests/screens/sessionVisualStates.test.tsx`
- Create: `tests/support/sessionFakes.ts`
- Modify: `app/session/[storyId].tsx`
- Modify: `src/components/CameraPreview.native.tsx`
- Modify: `src/components/CameraPreview.tsx`
- Modify: `src/components/CameraPreview.web.tsx`
- Modify: `tests/accessibility/core-flow.test.tsx`

**Interfaces:**
- `PlaybackButton({ mode: 'play' | 'pause' | 'resume', onPress, disabled? })` exposes labels `Start adventure`, `Pause adventure`, or `Resume adventure`.
- `StatusChip({ label, tone })` is decorative/semantic status UI and never exposes raw ML confidence.
- `SessionScreenProps.clock?: MonotonicClock` allows deterministic UI tests without changing production defaults.
- `CameraPreview` remains `{ isActive: boolean; style?: StyleProp<ViewStyle> }`; its visual size changes but its native sensing boundary does not.

- [ ] **Step 1: Write failing session-state tests**

```tsx
it('renders the active session with a central pause action and zone atlas', async () => {
  const { sensing, audio, keepAwake } = createPermissionDeniedSessionFakes()
  render(<SessionScreen storyId="sky-reef" sensing={sensing} audio={audio} keepAwake={keepAwake} />)
  fireEvent.press(screen.getByRole('button', { name: 'Start adventure' }))
  expect(await screen.findByRole('button', { name: 'Pause adventure' })).toBeTruthy()
  expect(screen.getByTestId('tooth-zone-atlas')).toBeTruthy()
  expect(screen.getByText('The story can continue with audio.')).toBeTruthy()
})
```

`tests/support/sessionFakes.ts` must export `createPermissionDeniedSessionFakes()`
with an `SensingAdapter` whose `start()` resolves to `permissionDenied`, an
`AudioPlayer` implementing every method in `AudioPlayer`, and a
`KeepAwakeController` whose acquire/release methods resolve to valid typed
states. This keeps route tests independent from native camera and audio
modules.

- [ ] **Step 2: Run session visual tests and verify they fail**

Run: `npm test -- --runInBand tests/screens/sessionVisualStates.test.tsx tests/accessibility/core-flow.test.tsx`

Expected: FAIL because the session route does not render the visual shell,
central control, atlas, or structured fallback chip.

- [ ] **Step 3: Implement the playback button and status chip**

Use a large circular `Pressable` centered in the stage. Render a simple
play/pause glyph with a text label available to assistive technology. Keep the
visual ring outside the button and mark it decorative. Map sensing and wake
states through `sessionPresentation.ts` so the route does not contain medical
or vendor-specific copy.

- [ ] **Step 4: Integrate the session shell**

Replace the current text stack with `ScreenShell`, top story/time metadata,
center stage, `AudioEnvelopeRing`, `PlaybackButton`, lower `ToothZoneAtlas`, and
a small camera tile. Use `formatRemainingTime` rather than raw seconds. Keep
the existing engine lifecycle, pause/resume semantics, story traversal, and
summary persistence.

- [ ] **Step 5: Add preflight and fallback parity**

Before `engine.start`, show the audio check, camera-helper explanation, and
caregiver supervision note. After permission denial or typed sensing fallback,
show the same composition with a `Listening mode` chip and no camera tile.
When wake state is denied or revoked, show a secondary status message without
stopping the session.

- [ ] **Step 6: Add authored zone and envelope selection**

Read the current story node’s `zone` and audio asset’s `envelope`. Pass them to
the atlas and ring. Do not read raw sensing signals in the visual components.
When a choice node is active, use the prompt asset envelope and show the choice
prompt only at the decision point.

- [ ] **Step 7: Add deterministic clock support and state tests**

Construct `SessionEngine` with `clockOverride ?? new SystemMonotonicClock()`.
Test running, paused, resumed, audio-only, sensing-uncertain, wake warning,
choice, and completion states with fakes. Assert that the pause action remains
accessible and that no visual state renders a dental-quality or confidence
score to the child.

- [ ] **Step 8: Run session tests and type checking**

Run: `npm test -- --runInBand tests/screens/sessionVisualStates.test.tsx tests/accessibility/core-flow.test.tsx tests/domain/sessionEngine.test.ts`

Run: `npm run typecheck`

Expected: all session lifecycle and visual-state tests pass.

- [ ] **Step 9: Commit the active session composition**

```bash
git add src/ui/PlaybackButton.tsx src/ui/StatusChip.tsx tests/screens/sessionVisualStates.test.tsx tests/support/sessionFakes.ts app/session/'[storyId].tsx' src/components/CameraPreview.native.tsx src/components/CameraPreview.tsx src/components/CameraPreview.web.tsx tests/accessibility/core-flow.test.tsx
git commit -m "feat: add audio-first brushing session UI"
```

## Task 6: Add choice sheet and completion surfaces

**Files:**
- Create: `src/ui/ChoiceSheet.tsx`
- Create: `tests/ui/ChoiceSheet.test.tsx`
- Modify: `app/session/[storyId].tsx`
- Modify: `app/complete/[sessionId].tsx`

**Interfaces:**
- `ChoiceSheet({ prompt, options, ageBand, onChoose, onDismiss? })` renders exactly two large labeled options for the current story choice.
- Completion receives only the existing `completed` route parameter and renders safe positive copy for completed and stopped sessions.

- [ ] **Step 1: Write failing choice/completion tests**

```tsx
it('renders two accessible choice actions and pauses the story until selection', () => {
  const onChoose = jest.fn()
  render(<ChoiceSheet prompt="Which path?" options={twoOptions} ageBand="6-7" onChoose={onChoose} />)
  expect(screen.getAllByRole('button')).toHaveLength(2)
  fireEvent.press(screen.getByRole('button', { name: 'Follow the bubbles' }))
  expect(onChoose).toHaveBeenCalledWith('bubbles')
})
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- --runInBand tests/ui/ChoiceSheet.test.tsx`

Expected: FAIL because the choice sheet component does not exist.

- [ ] **Step 3: Implement the choice sheet**

Use a contained lower panel over the same gradient. Render the age-band label
from the story graph, large option cards with icon/shape plus text, and clear
pressed/selected state. Keep the sheet usable when hands are occupied by using
large targets and ensuring the caregiver can tap either action.

- [ ] **Step 4: Integrate choice pause/resume behavior**

When a choice node is reached, pause narration safely, render the sheet, call
the existing `choose(optionId)` function, then return to the quiet session
layout and play the next asset. Do not alter story traversal or pass raw sensing
objects into the sheet.

- [ ] **Step 5: Style completion and stopped states**

Use the same world gradient with a warmer horizon. Keep copy positive for both
completed and interrupted sessions. Do not render engagement, confidence, or
coverage as a score on the child-facing completion screen.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- --runInBand tests/ui/ChoiceSheet.test.tsx tests/screens/sessionVisualStates.test.tsx`

```bash
git add src/ui/ChoiceSheet.tsx tests/ui/ChoiceSheet.test.tsx app/session/'[storyId].tsx' app/complete/'[sessionId].tsx'
git commit -m "feat: add safe story choices and completion"
```

## Task 7: Establish the visual feedback loop

**Files:**
- Create: `docs/testing/visual-feedback-loop.md`
- Create: `tests/visual/visualStates.md`
- Modify: `package.json` only if adding a documented `visual:check` script
- Modify: `.gitignore` only if local screenshot output is stored inside the repository

**Interfaces:**
- The visual route matrix names stable states: `welcome-empty`, `profile-picker`, `profile-create`, `preflight`, `running`, `paused`, `audio-only`, `choice`, `complete`, and `stopped`.
- Each state has a deterministic setup, expected accessibility labels, screenshot command, and review checklist.

- [ ] **Step 1: Document the web capture workflow**

Document these exact commands, using an existing Expo web server and a temporary
output directory:

```bash
agent-browser open http://localhost:8081
agent-browser snapshot
agent-browser screenshot --screenshot-dir "$TMPDIR/brushtales-visual-audit"
```

Document that every interaction requires a fresh snapshot before using element
refs, and that screenshots are inspected for clipping, hierarchy, contrast,
animation settling, and audio-only parity.

- [ ] **Step 2: Document the iOS simulator workflow**

Document simulator discovery and capture commands:

```bash
xcrun simctl list devices available
xcrun simctl boot <device-udid>
xcrun simctl io <device-udid> screenshot "$TMPDIR/brushtales-running.png"
```

Include Xcode Accessibility Inspector steps and state that simulator captures
cannot replace physical-device camera, audio interruption, wake-lock, thermal,
or low-light validation.

- [ ] **Step 3: Define deterministic state setup**

For each state, document the fixture profile, story node, fake clock value,
sensing adapter status, playback state, envelope phase, and expected labels.
Require settled animations or reduced-motion mode before capture. Keep all
captures outside version control unless a future reviewer explicitly adds a
small, non-child visual baseline set.

- [ ] **Step 4: Add visual-state review matrix**

List each route/state with checks for safe area, small phone, large text, touch
targets, contrast, screen-reader labels, reduced motion, and audio-only parity.
Include the five Review Focus cases from this plan and link each to its owning
automated test.

- [ ] **Step 5: Run the manual loop against the implemented web routes**

Run the route matrix, capture the accessibility snapshot and screenshot for
each state, and record any visual defects in the implementation branch before
claiming the UI slice complete.

- [ ] **Step 6: Commit the QA workflow**

```bash
git add docs/testing/visual-feedback-loop.md tests/visual/visualStates.md
git commit -m "test: document BrushTales visual feedback loop"
```

## Task 8: Run release checks and device validation

**Files:**
- Modify: `tests/accessibility/core-flow.test.tsx`
- Modify: `tests/device/visionScenarios.md`
- Modify: `docs/privacy/v0-data-handling.md` only if the UI adds a new disclosure
- Modify: `AGENTS.md` only if the selected gradient or screenshot tooling adds a permanent project rule

**Interfaces:**
- No domain interface changes in this task.
- The existing `SessionEngine`, `SensingAdapter`, `AudioPlayer`, `KeepAwakeController`, `ProfileRepository`, and `SessionRepository` contracts remain unchanged.

- [ ] **Step 1: Add accessibility assertions for the final flow**

Assert accessible names for `Start adventure`, `Pause adventure`,
`Resume adventure`, the three zone illustrations, both choice options, audio-
only status, and the adult setup action. Assert that decorative gradient/ring
elements are not exposed as interactive controls.

- [ ] **Step 2: Run the complete local suite**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run validate:content
npm run validate:safety
```

Expected: every command exits zero with no forbidden child-facing copy and no
missing story/audio/envelope metadata.

- [ ] **Step 3: Run the web visual matrix**

Capture all named web states at the default viewport and a large-text/reduced-
motion configuration. Inspect every screenshot and accessibility snapshot using
the checklist in `docs/testing/visual-feedback-loop.md`.

- [ ] **Step 4: Run native simulator checks**

Build the Expo development client, exercise the welcome, profile, preflight,
active, choice, completion, and audio-only states on a small and large iOS
simulator, and capture settled screenshots with `simctl`.

- [ ] **Step 5: Run physical-device checks**

On representative iOS and Android hardware, exercise camera denial, no-face,
low-light, audio interruption, background/foreground, wake-lock revocation,
large text, screen readers, two-minute thermal/battery behavior, and portrait
safe areas. Record only derived observations in the existing device matrix.

- [ ] **Step 6: Request review before integration**

Run `git status --short` and confirm only intended implementation files are
staged. Request a whole-branch review focused on child safety, accessibility,
privacy, visual consistency, and physical-device fallback behavior.
