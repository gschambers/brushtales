# BrushTales native Sky Reef vertical slice

**Status:** Proposed for implementation review  
**Date:** 2026-09-21  
**Related:**

- `docs/superpowers/specs/2026-09-19-brushtales-discovery-design.md`
- `docs/superpowers/specs/2026-09-20-brushtales-ux-design.md`
- `prototype/`

## Intent

Move the validated disposable BrushTales prototype composition into the
existing React Native/Expo application as a first native vertical slice for
the Sky Reef story. The slice proves the child-facing three-act brushing
experience without waiting for production narration media or native vision
processing.

The implementation uses deterministic local fakes for development and tests,
while preserving the existing audio, sensing, keep-awake, story, and storage
interfaces for later production dependencies.

## Scope

### Included

- Existing local profile selection and Sky Reef story entry.
- Act 1 opening audiobook placeholder with one **Begin story** action.
- Act 2 two-minute brushing session with:
  - seconds-only countdown;
  - reserved camera-preview slot;
  - calm pastel session composition;
  - play/pause control with audio-level halo layered behind it;
  - 18-zone authored atlas with ten teeth per row and 3/4/3 grouping;
  - enlarged local OpenMoji toothbrush cue;
  - quiet sensing, audio, and wake-state notices.
- Automatic transition from completed brushing to Act 3.
- Act 3 closing audiobook placeholder as the narrative conclusion.
- Positive completion screen and local session-summary persistence.
- Injectable deterministic audio and sensing fakes.
- Unit, component, accessibility, and responsive regression coverage.

### Excluded

- Production narration, ambient music, or final audio mastering.
- Native frame processing, toothbrush detection, or custom vision models.
- New caregiver setup, reminder, or profile-management redesign.
- Post-session story choices in this slice. The existing story graph remains
  available as domain content for a later story-expansion decision, but it does
  not add another child-facing phase here.
- Accounts, synchronization, analytics, uploaded media, or biometric storage.

## Experience flow

```text
profile → Sky Reef shelf → Act 1 opening → Act 2 brushing → Act 3 closing → complete
```

### Act 1: opening

The screen introduces the Sky Reef chapter and exposes one primary action:
**Begin story**. Activating it starts the deterministic intro audio and, when
the intro completes, starts the session engine. The UI does not offer a
separate audio-only entry path.

### Act 2: brushing

The session engine owns the two-minute monotonic timer, pause/resume behavior,
sensing lifecycle, and terminal result. The UI renders its snapshot and
advances the authored atlas zone on a deterministic presentation cadence.

The brushing surface has one primary control: pause or resume. There is no
child-facing finish button. The camera preview remains a reserved upper slot;
when sensing is unavailable, the slot may be hidden but the composition and
story path remain intact.

### Act 3: closing

When the session reaches its authored duration, the controller stops the
brushing phase, releases session resources through the engine, and enters the
closing audiobook phase. Act 3 is the narrative conclusion. After its closing
clip/placeholder completes, the app navigates to completion.

### Completion

The completion screen uses encouraging copy and offers a return action. It does
not present dental quality, cleanliness, or failure language. The final local
session summary is persisted before navigation when a profile is available.

## Architecture

### Route orchestration

The existing `app/session/[storyId].tsx` route remains the entry point, but its
current inline orchestration is split into a controller and presentational
components. The route loads the profile age band and supplies production or
development dependencies.

### Session controller

`useStorySessionController` owns:

- `phase`: `opening | brushing | closing | complete`;
- current story/profile context;
- current session-engine snapshot;
- audio state and phase completion;
- deterministic atlas-zone index;
- wake-state notices;
- start, pause, resume, exit, and cleanup actions.

Presentational components do not call the session engine directly. The
controller converts dependency events into stable UI state and ensures
terminal cleanup is idempotent.

### Components

- `ActScreen`: shared opening/closing audiobook placeholder composition.
- `BrushingSurface`: camera slot, countdown, playback control, status, and
  atlas layout.
- `ZoneAtlas`: upper/lower tooth rows, authored surface geometry, active 3/4/3
  group, and decorative brush placement.
- `CompletionScreen`: positive completion copy and return navigation.

The native implementation should use safe-area-aware React Native layout,
large touch targets, accessible labels, and reduced-motion handling. The web
prototype remains the visual regression reference rather than a runtime
dependency.

## Dependency strategy

The existing interfaces remain the boundaries:

- `AudioPlayer` handles load/play/pause/stop and state events.
- `SensingAdapter` emits coarse `SensingSignal` values only.
- `KeepAwakeController` handles acquire/release and revocation notices.
- `SessionEngine` owns timer, sensing, audio, keep-awake, and final result
  semantics.
- profile/session repositories own on-device persistence.

Development and test fakes provide deterministic behavior:

- a fake audio player exposes explicit completion and interruption controls;
- a fake sensing adapter emits `ready`, `noFace`, `lowLight`, and low-confidence
  signals without frames;
- fake keep-awake behavior covers active, denied, and revoked states.

Production media and native frame processing can later replace these fakes
through dependency injection without changing the child-facing components or
domain engine contract.

## Failure and privacy behavior

- Missing or unavailable audio keeps the phase moving with a quiet fallback
  notice; no child-facing error screen is introduced.
- Camera permission denial, unsupported hardware, no face, and processing
  unavailability preserve the brushing layout and never claim dental insight.
- Wake-lock denial or revocation leaves the timer/session usable and explains
  only that the screen may dim.
- App backgrounding pauses the active engine; returning to the app preserves
  the remaining time and offers resume.
- Camera frames, audio recordings, biometric identifiers, and ML tensors are
  never persisted or uploaded.

## Verification gates

### Automated

- Controller tests cover opening completion, brushing start, pause/resume,
  automatic closing, closing completion, cleanup, interruption, and failures.
- Component tests cover accessible labels, seconds-only countdown, atlas
  grouping, active-zone rendering, positive copy, and the absence of a finish
  button during brushing.
- Existing domain, storage, audio, sensing, content, and safety suites remain
  green.

### Visual and device

- Compare native portrait layouts on representative iOS and Android devices.
- Check camera-visible and camera-unavailable states.
- Check reduced motion, rightmost atlas zones, and large touch targets.
- Retain the prototype’s 320px/430px browser regression checks while the native
  surface is brought into parity.

The implementation is not complete until `npm run ci` passes and the native
vertical slice has been exercised with deterministic fakes on both platform
targets.

## Follow-up decisions

- Select and ship reviewed narration/ambient assets.
- Define the native frame-processing adapter and its platform/license/privacy
  record.
- Decide how the existing multi-choice story graph should be reintroduced
  after the three-act brushing slice.
- Replace deterministic fakes with production adapters behind the same seams.
