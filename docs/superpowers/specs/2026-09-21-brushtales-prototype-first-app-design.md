# BrushTales prototype-first app experience

**Status:** Approved implementation direction  
**Date:** 2026-09-21  
**Source of truth:** `prototype/index.html`, `prototype/prototype.js`, and `prototype/prototype.css`

## Decision

The reviewed prototype is the product experience for this slice. The React
Native/Expo app must reproduce its child-facing states, structure, copy,
layout, responsive geometry, palette, controls, atlas, toothbrush cue, and
fallback behavior. Existing app shell screens are not an alternative UX and
must not be reachable from the root experience.

The existing domain interfaces remain implementation seams underneath the
prototype-first presentation: local profiles, session timer, audio, sensing,
keep-awake, and summaries may power the state machine, but they must not
reshape the reviewed child-facing flow.

## Required states and transitions

The root route owns this prototype state machine:

```text
welcome → profile → welcome → opening → running ↔ paused
                                      ├→ audioOnly (direct fallback fixture)
                                      └→ closing → choice → running
welcome ← settings
running/closing/audioOnly → complete → welcome
```

Required state behavior:

- `welcome`: first-run **Create a profile**; returning profile shows the warm
  greeting, **Start an adventure**, and long-press adult settings control.
- `profile`: a grown-up-visible setup cue, one local profile-nickname field,
  on-device storage and transient-media privacy copy, **Continue**, and **Back**.
  The field does not ask a child to provide their name.
- `opening`: Act 1 audiobook card with one **Begin story** action. No visible
  Act 1 audio-only action. Copy reminds families that grown-ups are responsible
  for safe brushing.
- `running`: camera helper slot, seconds-only countdown, compact playback/audio
  halo, bottom-right atlas, muted exit, and prototype session tone.
- `paused`: same brushing composition with the active zone stable and **Resume
  adventure**.
- `audioOnly`: only a direct fallback fixture; it keeps the brushing
  composition and does not become an Act 1 entry choice.
- `closing`: Act 3 audiobook card with **Continue to story choice**.
- `choice`: two large authored choices with prototype labels and layout.
- `settings`: adult-visible copy and **Back to stories**.
- `complete`: positive completion copy and **Return to profiles**.

The prototype’s authored state flow is authoritative even where it differs
from the earlier native vertical-slice decision to stop after Act 3. The
choice sheet is restored because the user explicitly selected the prototype
experience as the complete product target.

## Local data and adapter behavior

- The root story session uses the selected local profile ID and persists its
  session summary to the on-device repository exactly once.
- The current native sensing adapter reports `processingUnavailable` until a
  transient frame processor exists. It does not request camera permission or
  claim that sensing is ready based only on permission status; the child-facing
  brushing composition continues by sound with a calm notice.
- Profile setup is visibly directed to a grown-up and explains that profiles
  and progress stay on-device and that camera frames, face images, voice
  recordings, and biometric identifiers are not saved.
- When app state leaves the foreground during an active brushing phase, the
  root pauses the session and resumes only the pause it initiated. System
  reduced-motion preference keeps the toothbrush still.

## Visual fidelity contract

Port the prototype’s structure rather than approximating it with generic app
cards:

- Global app padding, centered content widths, topbar, eyebrow, display type,
  irregular card/button radii, shadows, pastel paper, and decorative landing
  background.
- Session tone variables (`peach`, `mint`, `sky`, `lilac`, `butter`) scoped to
  session screens only.
- Camera preview/helper above the countdown; the countdown is a dark circle
  beneath it.
- Playback button/audio visualizer layered with the ring behind the button and
  placed to the left of the atlas.
- Atlas geometry is six surface bands × left/center/right: curved front rows,
  taller chewing/inside rows, 3/4/3 tooth grouping, surface-specific active
  styling, and the local OpenMoji toothbrush asset with lower-row mirroring.
- Responsive atlas right inset and brush clamping must preserve the prototype
  at 320px and 430px widths.
- Reduced motion stops envelope/brush animation while retaining all content and
  controls.

## Architecture

Create one root `PrototypeApp` presentation/state machine used by
`app/index.tsx`. It owns only prototype presentation state and delegates
session timing/audio/sensing/persistence to the existing controller and
repositories. The old `app/stories.tsx`, profile shell, and native-slice route
may remain as compatibility modules for tests/deep links, but root navigation
must not render them.

Keep visual components focused:

- `PrototypeApp`: state transitions, profile name, session lifecycle, and
  persistence/navigation boundary.
- `PrototypeShell`: global background/topbar/content scaffolding.
- `PrototypeAct`, `PrototypeWelcome`, `PrototypeProfile`, `PrototypeChoice`,
  `PrototypeSettings`, and `PrototypeComplete`: exact state compositions.
- `PrototypeBrushingSurface` and `PrototypeAtlas`: exact session layout and
  geometry.

## Verification

- Component tests assert every prototype state and named action.
- Root-flow tests exercise profile creation, warm welcome, opening, brushing,
  pause/resume, closing, choices, settings hold, and completion.
- `agent-browser` verifies the running Expo web app at 320px and 430px widths,
  captures welcome/opening/running/paused/closing/choice/complete, and compares
  them visually against the prototype states.
- Existing domain, safety, content, and session tests remain green.
