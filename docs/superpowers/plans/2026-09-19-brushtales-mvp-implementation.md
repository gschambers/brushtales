# BrushTales MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native-capable React Native MVP in which a child chooses a
local profile and story, completes a two-minute audio brushing session with
best-effort camera feedback, and reaches a safe authored story outcome.

**Architecture:** Keep the domain independent from React Native: a profile
repository owns local child data, a session engine owns monotonic timing and
session results, a sensing adapter emits coarse on-device signals, and a story
graph consumes only the final result and child choices. UI adapters provide
camera, audio, notifications, and foreground keep-awake behavior; all of them
have explicit failure states and a complete audio-only fallback.

**Tech Stack:** React Native with an Expo development-build/native-module
workflow, TypeScript, Expo Router, `expo-sqlite` for local persistence,
`react-native-vision-camera` for native frame processing, `expo-audio` for
local playback, `expo-keep-awake` plus small native fallbacks where required,
`expo-notifications` for optional reminders, and Jest/React Native Testing
Library for deterministic domain and screen tests.

**Spec:** `docs/superpowers/specs/2026-09-19-brushtales-discovery-design.md`

## Global Constraints

- “The v0 audience spans approximately ages 4–9.”
- “Profiles, progress, story state, and session summaries remain on-device in v0.”
- “Camera input is processed transiently on-device.”
- “Narration is generated during content production and shipped as fixed audio assets for v0.”
- “The sensing layer may emit transient, coarse signals” and must not claim plaque, cavities, gum health, tooth cleanliness, pressure, or clinical quality.
- “A two-minute session is the default product requirement.”
- “The v0 graph should have one story, 3–4 decision points, and 3–4 endings.”
- “Every path should be emotionally safe and satisfying.”
- “A PWA can prototype MediaPipe-based camera experiments, but it cannot be the release assumption.”
- No accounts, server sync, analytics backend, ads, social features, runtime cloud TTS, runtime-generated child-facing text, child voice input, or connected toothbrush hardware.
- A session must complete positively when camera permission is denied, sensing is unsupported, the child is not detected, or wake-lock acquisition fails.

## Review Focus

- **Camera permission denied, no face, low light, or unsupported model:** the session remains usable with timer/audio and explains the fallback without blame. Test in Task 6.
- **Pause, app backgrounding, audio interruption, and device sleep:** the monotonic timer never adds duplicate time or completes the story twice. Test in Task 4.
- **Three local profiles and deletion:** one child cannot see or mutate another child’s progress, and deletion removes all associated records. Test in Task 3.
- **Missing story node or audio asset:** content validation fails before release, while runtime playback falls back to a safe completion clip. Test in Task 5.
- **Wake lock denied or revoked:** the UI shows the current state, continues the session, and releases the request when the session ends. Test in Task 6.

---

## File map and ownership

The implementation should create this structure. Keep files focused and do not
move sensing or content rules into screens.

```text
app/
  _layout.tsx                 # Router, providers, and navigation shell
  index.tsx                   # Profile selection entry point
  profiles/new.tsx            # Caregiver-gated profile creation
  stories.tsx                 # Story shelf
  session/[storyId].tsx       # Preflight and active session screen
  parent.tsx                  # Local caregiver progress/settings
  complete/[sessionId].tsx    # Positive completion and branch summary
src/
  domain/profile/types.ts     # Profile and age-band types
  domain/session/types.ts     # Session, signal, and result types
  domain/session/sessionEngine.ts
  domain/story/types.ts
  domain/story/storyGraph.ts
  storage/database.ts
  storage/profileRepository.ts
  storage/sessionRepository.ts
  audio/audioManifest.ts
  audio/audioPlayer.ts
  platform/keepAwake.ts
  platform/reminders.ts
  sensing/sensingAdapter.ts
  sensing/mockSensingAdapter.ts
  sensing/nativeSensingAdapter.ts
  content/story/sky-reef.json
  content/audio/manifest.json
  content/audio/README.md
tools/validate-story.ts       # CI/content validation
tests/                         # Domain, storage, and integration tests
```

## Task 1: Scaffold the native-capable React Native project

**Files:**
- Create: `package.json`, `app.json`, `babel.config.js`, `tsconfig.json`, `jest.config.js`
- Create: `app/_layout.tsx`, `app/index.tsx`
- Create: `src/app/AppProviders.tsx`
- Create: `tests/smoke/app-starts.test.tsx`
- Modify: `AGENTS.md` only if the selected dependency’s privacy/license behavior adds a project rule

**Interfaces:**
- Produces the app entry point and test commands used by every later task.
- `AppProviders` must accept `children: React.ReactNode` and expose no domain
  state until later tasks add providers.

- [ ] **Step 1: Create the project with TypeScript and an Expo development build**

  Use the current stable Expo/React Native versions supported by the camera
  library at implementation time. Select Expo Router, TypeScript, Jest, and a
  development client; do not choose Expo Go as the production assumption because
  native frame processors require a custom build.

- [ ] **Step 2: Configure scripts and strict TypeScript**

  Add scripts named `start`, `ios`, `android`, `typecheck`, `lint`, `test`,
  `test:watch`, and `validate:content`. Enable strict TypeScript and path
  aliases rooted at `src`.

- [ ] **Step 3: Write the app-start smoke test**

  ```tsx
  it('renders the BrushTales entry point', () => {
    const { getByText } = render(<RootLayout />)
    expect(getByText('BrushTales')).toBeTruthy()
  })
  ```

- [ ] **Step 4: Run the smoke test and type checker**

  Run: `npm test -- --runInBand tests/smoke/app-starts.test.tsx` and
  `npm run typecheck`
  Expected: the smoke test passes and TypeScript reports zero errors.

- [ ] **Step 5: Commit the scaffold**

  ```bash
  git add package.json app.json babel.config.js tsconfig.json jest.config.js app src tests
  git commit -m "chore: scaffold BrushTales native app"
  ```

## Task 2: Define domain types and the deterministic story graph

**Files:**
- Create: `src/domain/profile/types.ts`
- Create: `src/domain/session/types.ts`
- Create: `src/domain/story/types.ts`, `src/domain/story/storyGraph.ts`
- Create: `src/content/story/sky-reef.json`
- Create: `tests/domain/storyGraph.test.ts`
- Create: `tools/validate-story.ts`, `tests/content/storyValidation.test.ts`

**Interfaces:**
- Produces `AgeBand = '4-5' | '6-7' | '8-9'`.
- Produces `Profile = { id: string; nickname: string; ageBand: AgeBand;
  avatarKey: string; createdAt: string; updatedAt: string }` and
  `CreateProfileInput = { nickname: string; ageBand: AgeBand; avatarKey?: string }`.
- Produces `EngagementBand = 'low' | 'steady' | 'strong'` and
  `SensingConfidence = 'low' | 'medium' | 'high'`.
- Produces `SensingStatus = 'ready' | 'unsupported' | 'permissionDenied' |
  'noFace' | 'lowLight' | 'processingUnavailable'` and
  `SensingSignal = { status: SensingStatus; motionScore: number;
  coveragePrompt: string | null; confidence: SensingConfidence }`.
- Produces `SessionResult` with `completedDurationMs`, `engagementBand`,
  `coveragePromptsAttempted`, `confidence`, and `interrupted`.
- Produces `SessionStatus = 'idle' | 'running' | 'paused' | 'complete' | 'stopped'`,
  `KeepAwakeState = 'active' | 'denied' | 'revoked' | 'released'`, and
  `AudioAssetId = string`.
- Produces `SessionSnapshot` with `status: SessionStatus`, `elapsedMs`, `remainingMs`,
  `sensingStatus`, and `keepAwakeState`.
- Produces `SessionSummary` with `profileId`, `storyId`, `completed`,
  `completedDurationMs`, `engagementBand`, `confidence`, and `interrupted`.
- Produces `StoryGraph`, `StoryState`, `advanceStory(graph, state, event)`, and
  `validateStoryGraph(graph, assetIds?)`, where
  `StoryEvent = { type: 'choose'; optionId: string; sessionBand: EngagementBand }`.

- [ ] **Step 1: Write failing tests for graph traversal and validation**

  ```ts
  it('advances a choice node using the selected option and session band', () => {
    const state = { storyId: 'sky-reef', nodeId: 'choice-1', choices: {} }
    expect(advanceStory(graph, state, {
      type: 'choose', optionId: 'cave', sessionBand: 'strong'
    }).nodeId).toBe('cave-strong')
  })

  it('rejects a dangling node reference before content ships', () => {
    expect(() => validateStoryGraph({ ...graph, nodes: { ...graph.nodes, bad: {
      type: 'narration', assetId: 'missing', next: 'does-not-exist'
    }}})).toThrow('does-not-exist')
  })
  ```

- [ ] **Step 2: Add the typed story graph and result types**

  Model narration, choice, and ending nodes as a discriminated union. Choices
  must contain an audio asset ID and a next-node mapping. Endings must contain a
  reviewed audio asset ID and a safe summary key. Keep raw sensing signals out
  of all story types.

- [ ] **Step 3: Implement graph validation and traversal**

  Validate a single start node, reachable nodes, optional known asset IDs, no
  dangling references, no infinite cycles without a choice or ending, and at
  least three reachable endings. `advanceStory` must return a typed error for
  an invalid event rather than mutating state.

- [ ] **Step 4: Author the first minimal graph**

  Add 3–4 decision points, 3–4 endings, age-band copy variants, and shared
  narration where useful. Every ending is positive and none describes the
  child as clean, dirty, good, bad, successful, or failed.

- [ ] **Step 5: Run validation and domain tests**

  Run: `npm test -- --runInBand tests/domain/storyGraph.test.ts tests/content/storyValidation.test.ts`
  Expected: all traversal and validation tests pass.

- [ ] **Step 6: Commit the domain graph**

  ```bash
  git add src/domain/profile src/domain/session src/domain/story src/content/story tools tests
  git commit -m "feat: add BrushTales domain and story graph"
  ```

## Task 3: Add local profiles and caregiver deletion

**Files:**
- Create: `src/storage/database.ts`
- Create: `src/storage/profileRepository.ts`, `src/storage/sessionRepository.ts`
- Create: `tests/storage/profileRepository.test.ts`
- Create: `app/profiles/new.tsx`, `app/parent.tsx`
- Modify: `app/index.tsx`

**Interfaces:**
- `ProfileRepository.list(): Promise<Profile[]>`
- `ProfileRepository.create(input): Promise<Profile>`
- `ProfileRepository.get(id): Promise<Profile | null>`
- `ProfileRepository.delete(id): Promise<void>`
- `SessionRepository.saveSummary(profileId, summary): Promise<void>`
- `SessionRepository.listForProfile(profileId): Promise<SessionSummary[]>`
- No repository method accepts or stores a camera frame, audio recording, face
  image, or biometric vector.

- [ ] **Step 1: Write failing isolation and deletion tests**

  ```ts
  it('keeps progress isolated by profile ID', async () => {
    const a = await repo.create({ nickname: 'A', ageBand: '4-5' })
    const b = await repo.create({ nickname: 'B', ageBand: '8-9' })
    await sessions.saveSummary(a.id, { storyId: 'sky-reef', completed: true })
    expect(await sessions.listForProfile(b.id)).toEqual([])
  })

  it('deletes a profile and its summaries in one operation', async () => {
    const profile = await repo.create({ nickname: 'A', ageBand: '6-7' })
    await sessions.saveSummary(profile.id, { storyId: 'sky-reef', completed: true })
    await repo.delete(profile.id)
    expect(await repo.get(profile.id)).toBeNull()
    expect(await sessions.listForProfile(profile.id)).toEqual([])
  })
  ```

- [ ] **Step 2: Define the SQLite schema and migrations**

  Create `profiles` and `session_summaries` tables with generated IDs,
  timestamps, age band, nickname, avatar key, story ID, completion duration,
  engagement band, confidence, and interrupted flag. Add a foreign key with
  cascade delete. Do not create a table or column for raw camera/audio data.

- [ ] **Step 3: Implement repositories with parameterized queries**

  Keep SQLite details inside repository files. Validate nickname length and
  age-band values at the boundary. Return domain objects, not SQLite rows.

- [ ] **Step 4: Build the profile picker, creation screen, and parent deletion flow**

  The picker shows nickname and avatar only. Profile creation and deletion are
  caregiver-facing; deletion requires a simple adult confirmation gate. The
  child-facing flow never asks for location, account credentials, image, or
  voice sample.

- [ ] **Step 5: Run storage and screen tests**

  Run: `npm test -- --runInBand tests/storage/profileRepository.test.ts` and
  `npm run typecheck`
  Expected: isolation/deletion tests pass and the screens type-check.

- [ ] **Step 6: Commit local profiles**

  ```bash
  git add src/storage app tests/storage
  git commit -m "feat: add local child profiles"
  ```

## Task 4: Implement the session engine and audio-only runtime

**Files:**
- Create: `src/domain/session/sessionEngine.ts`
- Create: `src/audio/audioManifest.ts`, `src/audio/audioPlayer.ts`
- Create: `src/sensing/sensingAdapter.ts`, `src/sensing/mockSensingAdapter.ts`
- Create: `src/platform/keepAwake.ts`
- Create: `tests/domain/sessionEngine.test.ts`, `tests/audio/audioPlayer.test.ts`

**Interfaces:**
- `SensingAdapter.start(listener: (signal: SensingSignal) => void): Promise<SensingStatus>`
- `SensingAdapter.stop(): Promise<void>`
- `AudioPlayer.load(assetId): Promise<void>`, `play(): Promise<void>`,
  `pause(): Promise<void>`, `stop(): Promise<void>`
- `KeepAwakeController.acquire(): Promise<KeepAwakeState>` and
  `release(): Promise<void>`
- `SessionEngine.start(input): Promise<void>`, `pause(): Promise<void>`,
  `resume(): Promise<void>`, `stop(): Promise<SessionResult>`,
  `snapshot(): SessionSnapshot`

- [ ] **Step 1: Write failing timer and interruption tests**

  ```ts
  it('uses elapsed monotonic time and completes once at two minutes', () => {
    const clock = new FakeMonotonicClock()
    const engine = new SessionEngine({ clock, sensing, audio, keepAwake })
    engine.start({ profileId: 'p1', storyId: 'sky-reef', durationMs: 120_000 })
    clock.advance(60_000)
    engine.pause()
    clock.advance(30_000)
    engine.resume()
    clock.advance(60_000)
    expect(engine.snapshot().elapsedMs).toBe(120_000)
    expect(engine.snapshot().status).toBe('complete')
  })

  it('returns an interrupted positive result when audio focus is lost', async () => {
    audio.emit('interruption')
    const result = await engine.stop()
    expect(result.interrupted).toBe(true)
    expect(result.completedDurationMs).toBeGreaterThanOrEqual(0)
  })
  ```

- [ ] **Step 2: Implement the injectable monotonic clock and state machine**

  Use states `idle`, `running`, `paused`, `complete`, and `stopped`. Count only
  running time. Ignore repeated `complete`/`stop` transitions after the first
  terminal result. Aggregate sensing signals into engagement/confidence bands
  without exposing raw frames to the story engine.

- [ ] **Step 3: Implement local audio manifest validation and playback adapter**

  `audioManifest.ts` maps reviewed asset IDs to bundled local URIs and duration
  metadata. `audioPlayer.ts` wraps the chosen local playback library and emits
  `ready`, `playing`, `paused`, `finished`, `interruption`, and `error` states.
  An unavailable asset must resolve to a safe fallback clip ID, not crash the
  session.

- [ ] **Step 4: Implement mock sensing and keep-awake interfaces**

  The mock sensing adapter emits deterministic signals for tests. The initial
  keep-awake adapter wraps `expo-keep-awake`, reports `active`, `denied`, and
  `revoked`, and always releases when the engine reaches a terminal state.

- [ ] **Step 5: Run deterministic domain/audio tests**

  Run: `npm test -- --runInBand tests/domain/sessionEngine.test.ts tests/audio/audioPlayer.test.ts`
  Expected: pause, resume, interruption, completion-once, fallback-asset, and
  keep-awake-release tests pass.

- [ ] **Step 6: Commit the session runtime**

  ```bash
  git add src/domain/session src/audio src/sensing src/platform tests/domain tests/audio
  git commit -m "feat: add deterministic brushing session runtime"
  ```

## Task 5: Add reviewed story/audio content and content checks

**Files:**
- Create: `content/scripts/sky-reef.md`
- Create: `content/audio/README.md`, `content/audio/manifest.json`
- Modify: `tools/validate-story.ts` for audio manifest checks
- Create: `tests/content/audioManifest.test.ts`
- Modify: `src/content/story/sky-reef.json`

**Interfaces:**
- `content/audio/manifest.json` must provide every asset ID referenced by the
  story graph, a bundled relative path, duration, speaker role, and review
  status.
- The app consumes `AudioAssetId` only; it does not know which vendor made an
  asset.
- Produces `validateAudioManifest(manifest)` and
  `validateContent(story, manifest)` for CI and unit tests.

- [ ] **Step 1: Write failing manifest and safety tests**

  ```ts
  it('rejects story references without local audio', () => {
    expect(() => validateContent(story, manifestWithout('choice-1')))
      .toThrow('choice-1')
  })

  it('requires every shipped clip to be adult-reviewed', () => {
    expect(() => validateAudioManifest({ ...manifest, clips: {
      ...manifest.clips, intro: { ...manifest.clips.intro, reviewed: false }
    }})).toThrow('reviewed')
  })
  ```

- [ ] **Step 2: Write the first story script and asset manifest**

  Script one narrator and a small set of character voices. Include explicit
  pause markers, invented-name pronunciation notes, audio choice labels, and
  a positive fallback ending. Keep content age-adaptable for the 4–9 range.

- [ ] **Step 3: Generate and review a TTS audition outside the client**

  Compare the same sample script using ElevenLabs, Google Cloud expressive
  voices, and OpenAI `gpt-4o-mini-tts`. Record vendor/model, voice ID, date,
  output format, and licensing review in `content/audio/README.md`. Select a
  vendor only after caregiver listening review; ship fixed files, never API
  credentials.

- [ ] **Step 4: Add normalized local audio assets and validate them**

  Package the approved clips as MP3 or AAC local assets. Validate that every
  referenced file exists, every clip is marked reviewed, durations are positive,
  and the graph has reachable positive endings.

- [ ] **Step 5: Run content tests**

  Run: `npm test -- --runInBand tests/content/audioManifest.test.ts` and
  `npm run validate:content`
  Expected: the content validator exits zero with the complete asset bundle.

- [ ] **Step 6: Commit reviewed content**

  ```bash
  git add content src/content tools/validate-story.ts tests/content
  git commit -m "feat: add reviewed offline story content"
  ```

## Task 6: Build the active session screen with camera fallback

**Files:**
- Create: `src/sensing/nativeSensingAdapter.ts`
- Create: `src/platform/permissions.ts`
- Create: `app/stories.tsx`, `app/session/[storyId].tsx`, `app/complete/[sessionId].tsx`
- Create: `tests/sensing/sensingFallback.test.tsx`, `tests/screens/sessionScreen.test.tsx`
- Modify: `src/app/AppProviders.tsx`, `src/audio/audioPlayer.ts`

**Interfaces:**
- `NativeSensingAdapter` implements `SensingAdapter` and emits only typed
  coarse signals and failure statuses.
- `requestCameraPermission(): Promise<'granted' | 'denied' | 'restricted'>`
- The session screen consumes `SessionSnapshot`, `SensingStatus`, and story
  nodes; it never imports a native ML model directly.

- [ ] **Step 1: Write failing fallback and wake-lock tests**

  ```tsx
  it('continues as audio-only when camera permission is denied', async () => {
    cameraPermission.mockResolvedValue('denied')
    render(<SessionScreen storyId="sky-reef" />)
    fireEvent.press(screen.getByRole('button', { name: 'Start adventure' }))
    expect(await screen.findByText('Audio-only mode')).toBeTruthy()
    expect(screen.getByText('The adventure can still continue')).toBeTruthy()
  })

  it('reports a revoked wake lock without stopping the session', async () => {
    keepAwake.emit('revoked')
    expect(await screen.findByText('Screen may dim')).toBeTruthy()
    expect(screen.getByText('Brush session in progress')).toBeTruthy()
  })
  ```

- [ ] **Step 2: Add camera permission and native adapter lifecycle**

  Use the front camera, handle orientation/mirroring, and stop the frame
  pipeline on pause/background/unmount. Process frames in the native/worklet
  path. Do not serialize or log frame pixels. Use a conservative baseline
  signal implementation until the feasibility experiment chooses the model.

- [ ] **Step 3: Implement the preflight and active session screens**

  Preflight explains positioning, asks for permission, tests audio, and shows
  caregiver supervision copy. Active mode shows a quiet camera mirror, timer,
  current prompt, pause control, sensing confidence state, and audio-only
  fallback. Choice points use large labeled buttons and pause the story safely.

- [ ] **Step 4: Implement story progression and completion persistence**

  At each choice point, call `advanceStory`. At terminal result, save one
  summary for the active profile and navigate to the completion screen. If an
  audio asset errors, play the safe fallback and finish the graph.

- [ ] **Step 5: Run screen and sensing tests**

  Run: `npm test -- --runInBand tests/sensing/sensingFallback.test.tsx tests/screens/sessionScreen.test.tsx`
  Expected: permission denial, no-face/low-light, wake-lock revocation, choice
  progression, completion persistence, and fallback audio tests pass.

- [ ] **Step 6: Commit the session UI**

  ```bash
  git add app src tests/sensing tests/screens
  git commit -m "feat: add camera-aware audio brushing session"
  ```

## Task 7: Validate the vision approach on physical devices and replace the baseline

**Files:**
- Create: `research/vision-test-matrix.md`
- Create: `tests/device/visionScenarios.md`
- Modify: `src/sensing/nativeSensingAdapter.ts`
- Modify: `changelog/0003-brushing-sensing-boundary.md`

**Interfaces:**
- Preserve the `SensingAdapter` interface from Task 4.
- The adapter may change its internal model, but must continue emitting typed
  `SensingSignal` values and failure statuses without exposing raw frames.

- [ ] **Step 1: Define the device and scenario matrix**

  Test at least one older and one current iPhone, one older and one current
  Android phone, two lighting conditions, portrait orientation, normal
  toothbrushes, glasses, caregiver assistance, and camera denial. Record only
  derived confidence/timing observations with consent; do not store child media.

- [ ] **Step 2: Compare landmark, motion, and custom-model strategies**

  Measure sustained confidence, false discouragement, dropped frames, thermal
  load, and battery change over a two-minute session. Do not optimize for a
  clinical metric the product does not claim to provide.

- [ ] **Step 3: Implement the least complex strategy that passes the product bar**

  Prefer face/hand landmarks plus temporal motion if it is sufficient. Add a
  custom toothbrush model only if the simpler approach cannot provide a stable
  participation signal. Keep thresholds configurable and cover them with unit
  tests using derived fixture signals, not child photographs.

- [ ] **Step 4: Verify native foreground wake behavior**

  Test acquisition, denial, revocation, low-power mode, background/return,
  incoming-call interruption, and session-end release on both platforms.
  Document that neither platform overrides all energy-saving policies.

- [ ] **Step 5: Run physical-device checks and update the decision record**

  Run: `npm run ios -- --device` and `npm run android -- --device` with the
  device matrix. Expected: no unhandled permission/thermal/audio errors, a
  complete audio-only fallback, and a written result in
  `research/vision-test-matrix.md`.

- [ ] **Step 6: Commit the validated sensing implementation**

  ```bash
  git add src/sensing research/vision-test-matrix.md tests/device changelog/0003-brushing-sensing-boundary.md
  git commit -m "feat: validate on-device brushing signal"
  ```

## Task 8: Add reminders, caregiver controls, accessibility, and release checks

**Files:**
- Create: `src/platform/reminders.ts`, `tests/platform/reminders.test.ts`
- Create: `tests/accessibility/core-flow.test.tsx`
- Create: `docs/privacy/v0-data-handling.md`
- Modify: `app/parent.tsx`, `app/session/[storyId].tsx`, `AGENTS.md`
- Modify: `package.json` CI scripts

**Interfaces:**
- `ReminderService.requestPermission(): Promise<PermissionState>`
- `ReminderService.scheduleMorningEvening(input): Promise<void>`
- `ReminderService.cancelAll(): Promise<void>`
- `PermissionState = 'granted' | 'denied' | 'undetermined'` and
  `ReminderInput = { morning: string | null; evening: string | null }`.
- Caregiver controls can edit reminders, select age band, view coarse history,
  and delete a profile; they cannot view camera frames because none are stored.

- [ ] **Step 1: Write reminder and accessibility tests**

  ```ts
  it('schedules at most one morning and one evening reminder', async () => {
    await reminders.scheduleMorningEvening({ morning: '07:30', evening: '19:30' })
    expect(notifications.schedule).toHaveBeenCalledTimes(2)
  })

  it('gives every core action an accessible label', () => {
    render(<SessionScreen storyId="sky-reef" />)
    expect(screen.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
  })
  ```

- [ ] **Step 2: Implement optional local reminders**

  Ask permission only from caregiver settings. If permission is denied, retain
  the preference locally and explain that reminders are unavailable. Never
  send child profile or session data with a notification.

- [ ] **Step 3: Finish caregiver controls and deletion**

  Show completed-session history as dates and durations, not dental scores.
  Provide local age-band editing, reminder controls, privacy explanation, and
  profile deletion.

- [ ] **Step 4: Add accessibility and child-safety copy checks**

  Verify Dynamic Type/large text, screen-reader labels, high contrast, no
  color-only choices, reduced-motion behavior, and audio-only completion.
  Search reviewed child-facing copy for forbidden shame/medical language.

- [ ] **Step 5: Run the full local verification suite**

  Run: `npm run lint && npm run typecheck && npm test -- --runInBand && npm run validate:content`
  Expected: all commands exit zero.

- [ ] **Step 6: Run release device checks**

  Build development/release candidates for iOS and Android. Exercise setup,
  profile switching, camera denial, two-minute completion, choice branches,
  audio interruption, wake-lock denial/revocation, reminder denial, and profile
  deletion on physical devices.

- [ ] **Step 7: Commit release-readiness work**

  ```bash
  git add app src tests docs/privacy package.json AGENTS.md
  git commit -m "chore: add BrushTales release safeguards"
  ```

## Handoff and completion criteria

After Task 8, request a whole-branch review focused on child safety, privacy,
domain/type consistency, and physical-device behavior. Do not publish to an
app store until the privacy/store review, TTS licensing review, device matrix,
and caregiver content review are complete.
