# BrushTales UX and visual experience design

**Status:** Proposed for review
**Date:** 2026-09-20
**Audience:** Product, design, content, and engineering contributors
**Related:** `docs/superpowers/specs/2026-09-19-brushtales-discovery-design.md`

## Intent

BrushTales should make a two-minute brushing routine feel like a calm,
audio-led chapter of an adventure. The screen supports the story without
competing with the toothbrush, the narrator, or the caregiver. The child should
always understand what is happening, what they can touch, and how to continue
when camera sensing or device behavior is uncertain.

This design is a visual and interaction layer over the existing domain
boundaries. It does not introduce accounts, cloud sync, clinical dental
measurement, child media storage, or runtime-generated child-facing text.

## Design goals

1. Make audio the primary experience and the screen a quiet companion.
2. Give the active session one unmistakable focal action: play or pause.
3. Use authored tooth-zone illustrations as gentle prompts, never as a claim
   about detected coverage or dental quality.
4. Make camera permission, wake behavior, and sensing uncertainty understandable
   without blame or interruption.
5. Make first-run setup feel like part of the BrushTales world while keeping
   caregiver controls distinct and adult-visible.
6. Establish a repeatable visual feedback loop for web, simulator, and physical
   device validation.

## Non-goals

- A clinical mouth map, plaque display, cleanliness score, pressure indicator,
  or diagnosis.
- A cloud account, sign-in flow, social identity, or server-backed profile.
- A screen that requires continuous visual attention while brushing.
- A reward loop based on streak pressure, missed sessions, or screen time.
- Camera output that implies the app can judge brushing quality.

## Research basis

The design follows the current product discovery work and the following
platform/accessibility guidance:

- [Apple Human Interface Guidelines: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)
  recommends getting people into the app quickly, allowing onboarding to be
  skipped, and making education available later.
- [Android: Authentication and Onboarding](https://developer.android.com/design/ui/mobile/guides/patterns/onboarding)
  recommends collecting only critical information, showing value before
  requesting permissions, explaining permissions in context, showing progress,
  and providing recovery.
- [Apple Human Interface Guidelines: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
  recommends restrained motion for frequent interactions. BrushTales must
  provide a reduced-motion variant.
- [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps)
  recommends simple controls, meaningful descriptions, and 48dp touch targets.
- [WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  establishes a 24 CSS pixel minimum web criterion. BrushTales will use larger
  native-friendly targets for children.
- [agent-browser](https://github.com/vercel-labs/agent-browser) supports
  accessibility-tree snapshots and screenshots for the web feedback loop.
- [Maestro visual testing](https://maestro.dev/blog/visual-testing) provides a
  practical future path for scripted mobile screenshots and assertions.

## Experience principles

### Audio leads, visuals reassure

Narration and brushing prompts carry the story. Visuals confirm the current
state, provide a choice when needed, and offer a calm orientation cue. Between
choices, the interface should have very little text.

### One strong action at a time

The active session has one primary control. Secondary actions such as leaving,
audio-only information, or caregiver help remain available but visually quiet.
Choice moments temporarily promote two clearly labeled options.

### Encouragement without judgment

Use language such as “Let’s keep exploring,” “The crew is waiting,” and “You
can continue with audio only.” Never use “failed,” “dirty,” “bad brushing,” or
language that makes an ending, affection, food, sleep, or story access
conditional on performance.

### The same composition survives failure

Permission denial, no face, low light, unsupported sensing, audio interruption,
and revoked wake behavior should change a status detail, not replace the
experience with an error screen. Audio-only mode preserves the session layout
and story path.

## Visual language

### Canvas

All child-facing screens use a safe-area-aware full-screen canvas. The primary
session surface is a subtle vertical gradient inspired by Sky Reef:

- deep night blue at the top;
- softened indigo or teal through the middle;
- a restrained warm coral or peach accent near the lower horizon.

The gradient must remain dark enough for light text and illustrations to pass
contrast checks. Decorative stars, clouds, bubbles, and reef shapes are sparse,
static or very slow-moving, and never sit behind a touch target.

Caregiver screens use the same palette with a calmer, higher-contrast surface
panel so an adult can scan settings and history easily.

### Typography and copy

- Use large, rounded, highly legible display text for a short title or prompt.
- Use system text styles where possible so larger text settings reflow content.
- Keep child-facing copy short enough to understand through audio.
- Never make color the only signal for selected, active, or unavailable state.
- Every icon-only control has an accessibility label and a visible or spoken
  state change.

### Touch targets

- Primary play/pause control: at least 176dp visual diameter with a substantially
  larger hit target if platform layout allows.
- Choice cards: at least 64dp high and separated by at least 12dp.
- All other interactive elements: at least 48dp high/wide on native platforms
  and at least 44 CSS pixels on the web where practical.
- Do not place destructive caregiver actions beside a child-facing primary
  action.

## Active brushing session

The active session is the central product surface.

### Layout

1. **Top metadata**
   - story title or chapter name;
   - small remaining-time label such as “1:42 left”;
   - optional quiet status chip for camera helper or audio-only mode.
2. **Center stage**
   - large circular play/pause control;
   - soft audio-reactive ring around the control;
   - no competing progress bar directly around the button.
3. **Lower guide**
   - a zone atlas with front, upper-arch, and lower-arch illustrations;
   - one authored prompt zone highlighted;
   - short prompt text only when the story is at that prompt.
4. **Quiet utility area**
   - pause/resume is the center control while running;
   - a caregiver-accessible exit or help action stays visually secondary;
   - camera preview, when available, is a small rounded mirror tile rather than
     the main surface.

### Play/pause behavior

- Before the session begins, the center control is a play action labeled
  “Start adventure.”
- While running, it becomes a pause action labeled “Pause adventure.”
- While paused, the label becomes “Resume adventure,” narration pauses safely,
  and the timer does not advance.
- The icon transition is a short cross-fade or morph, not a spinning animation.
- Audio feedback and accessibility announcements must state the new mode.

### Audio-level ring

The ring represents the rhythm of the current fixed narration or ambient clip;
it does not represent brushing quality, camera confidence, or dental status.

The content/audio manifest should eventually support a small, reviewed envelope
for each shipped clip. The UI consumes normalized envelope samples and playback
state through the audio interface. It must not read microphone input or persist
audio recordings.

The ring should:

- respond gently with low amplitude and a slow easing curve;
- remain visually subordinate to the play/pause button;
- pause or settle when playback pauses;
- use a deterministic static or breathing state when an envelope is unavailable;
- become static or use a low-motion opacity fade when Reduce Motion is enabled;
- never flash, pulse rapidly, or imply a score.

### Zone atlas

The zone atlas is a reviewed illustration component with three authored views:

- front profile;
- upper arch/top profile;
- lower arch/bottom profile.

The current story node selects the highlighted prompt. The active region uses
at least two cues: a shape change or outline plus a label or audio prompt. A
slow glow is optional, but it must have a static reduced-motion equivalent.

The atlas is a guidance illustration, not a live camera overlay. Copy must say
what to try, not what the app sees. Preferred examples are “Let’s visit the
upper reef” or “Try this side next,” not “We detected the upper teeth.”

### Camera and fallback

When sensing is ready, show a small optional mirror tile with a simple status
such as “Camera helper on.” The tile may be hidden without interrupting the
story. It must not show confidence meters or raw detection labels to the child.

When camera access is denied, unsupported, unavailable, or uncertain:

- remove the tile or replace it with a compact “Listening mode” illustration;
- preserve the same center control, gradient, zone atlas, timer, and story path;
- use solution-oriented copy such as “The story can continue with audio.”

## Choice moments and completion

### Choice sheet

At authored decision points, pause narration and present two large option cards
in a bottom sheet or lower panel. Each option has a short visible label, a
distinct illustration or icon, and a matching audio label. The choice sheet must
not require the child to read a paragraph while brushing.

After selection, acknowledge the choice, return to the quiet session layout,
and let the next clip play. A caregiver may select on the child’s behalf.

### Completion

Completion uses the same world, but with a warmer horizon and a clear ending.
It celebrates participation and the story outcome rather than a performance
score. A stopped or interrupted session receives equally safe copy, such as
“The crew will be ready whenever you want to continue.”

## First-run and onboarding flow

“Account setup” means a local explorer profile in v0. It is not a login.

### Step 1: Welcome

Show the BrushTales world immediately with a short visual/audio teaser. The
primary action is “Set up an explorer.” A secondary path lets a returning family
choose an existing profile. Avoid a long feature tour.

### Step 2: Adult setup gate

Keep profile creation and privacy choices on an adult-visible path. Explain in
plain language that profiles and progress remain on this device and that camera
frames, face images, voice recordings, and biometric identifiers are not stored.

The gate is a product boundary and caregiver cue, not a claim of robust age
verification.

### Step 3: Create explorer

Use the child-facing visual language inside an adult-controlled form:

- nickname or display name;
- simple avatar selection;
- age-band selection for presentation adaptation;
- concise explanation that the age band changes language and guidance, not
  health conclusions.

No email, password, location, photograph, voice sample, or account recovery
flow is needed.

### Step 4: Ready for a chapter

Before the first session, show a compact progress indicator and explain each
capability at the moment it is needed:

1. test that audio is audible;
2. explain the optional camera helper and request camera permission;
3. explain that keeping the screen awake is best effort;
4. offer “Continue with audio only” at every relevant failure state.

Reminders and caregiver history remain in adult settings rather than delaying
the first story.

### Returning flow

After setup, return directly to profile selection or the story shelf. Do not
replay the tutorial unless the caregiver explicitly opens help. Preserve any
unfinished setup checkpoint locally so backing out does not require starting
over.

## State model for the UI

The screen layer should render from existing domain snapshots and a small UI
state model. It must not import native vision model details.

Required visual states:

- `welcome`;
- `adultSetup`;
- `profileCreation`;
- `preflight`;
- `running`;
- `paused`;
- `choice`;
- `audioOnly`;
- `sensingUncertain`;
- `wakeStateWarning`;
- `complete`;
- `stopped`.

The session engine remains the source of truth for timer, pause/resume,
sensing lifecycle, and final result. The story graph receives only authored
choices and the final session result as already defined by the discovery spec.

## Visual feedback loop

The feedback loop begins with the prototype and remains part of each production
slice.

### Web loop

For each deterministic route/state:

1. launch the Expo web build;
2. navigate with `agent-browser`;
3. capture an accessibility snapshot;
4. exercise the primary interaction;
5. capture a screenshot at the settled state;
6. inspect console errors and layout visually;
7. repeat with large text and reduced-motion settings where supported.

The accessibility snapshot catches missing labels and incorrect interaction
states. The screenshot catches clipping, weak hierarchy, contrast problems,
unexpected whitespace, and animation composition that a DOM inspection misses.

### Native loop

For iOS development builds, use an available simulator and `xcrun simctl` to
capture named states. Use Xcode Accessibility Inspector for labels, traits,
focus order, and contrast. Add Maestro flows when cross-platform scripted
captures are needed; use Detox only if deeper gray-box synchronization becomes
necessary.

Native screenshots must include at least one small phone, one large phone, and
one large-text configuration. Physical devices remain required for camera,
audio interruption, wake-lock, thermal, and lighting behavior.

### Determinism

Golden captures must use:

- an injected clock or fixed session fixture;
- fixed story state and choices;
- a deterministic audio envelope fixture;
- a fixed sensing adapter fixture;
- a settled animation or reduced-motion mode.

Do not store child media or use real child camera frames as visual fixtures.

### Review checklist

- Is the intended action obvious within two seconds?
- Does the visual hierarchy keep attention on audio and brushing?
- Are all touch targets large enough and separated?
- Does every state have an understandable audio-only equivalent?
- Are status changes expressed without shame or medical implication?
- Does large text reflow without clipping or hiding the primary action?
- Does Reduce Motion remove rapid or multi-axis movement?
- Are gradients, text, highlights, and icons sufficiently contrasted?
- Does the same composition work on web, iOS simulator, Android, and physical
  devices?

## Sequenced deliverables and ownership

### Deliverable 1: UX design brief and state map

This document is the source of truth for visual hierarchy, onboarding,
session states, safety boundaries, and QA criteria.

### Deliverable 2: Visual prototype spike

Create a disposable prototype for welcome, profile setup, story shelf, preflight,
active session, audio-only, choice, and completion. Use temporary illustrations
and deterministic audio envelopes. Do not connect production persistence or
native sensing yet.

### Deliverable 3: Prototype visual QA loop

Add repeatable web screenshots/accessibility snapshots and iOS simulator
captures to the prototype. Resolve composition, spacing, motion, and fallback
issues before production implementation.

### Deliverable 4: Production UI slices

Implement in this order:

1. shared visual shell, safe-area layout, semantic colors, and typography;
2. onboarding and local profile presentation;
3. session shell and play/pause behavior;
4. zone atlas and authored prompt states;
5. audio envelope animation and reduced-motion fallback;
6. camera tile/audio-only parity;
7. choice sheet and completion;
8. caregiver/settings styling.

The session shell, zone atlas, audio envelope, and fallback behavior are one
coupled feature because they share the active-session state model. Onboarding,
permission priming, and preflight are another coupled feature because setup
copy must explain the exact states the session can enter.

### Deliverable 5: Device validation

Validate the full flow on representative iOS and Android hardware, including
permission denial, no-face, low-light, audio interruption, background/foreground,
wake-lock revocation, large text, screen readers, thermal load, and battery
behavior.

## Acceptance criteria

The design is ready for implementation when:

1. A child can identify start/pause/resume without reading a long explanation.
2. The active session remains usable and visually coherent without camera access.
3. Zone illustrations are clearly prompts, not dental measurements.
4. Onboarding collects only local profile data and gets the family to the first
   story without unnecessary permission or reminder setup.
5. Motion has a reduced-motion equivalent and never carries essential meaning
   alone.
6. Accessibility snapshots expose meaningful labels and state changes.
7. Deterministic web and simulator captures exist for every required state.
8. The implementation can preserve the existing domain interfaces and privacy
   boundaries without storing raw frames, audio recordings, or biometric data.

## Open implementation questions

These should be answered during the prototype, not by expanding v0 scope:

- Which illustration style remains legible at the smallest supported phone size?
- Does the camera mirror tile help children orient themselves, or is it better
  hidden by default after preflight?
- What audio-envelope sample rate gives a perceptible but calm ring without
  increasing the shipped asset burden?
- Which native screenshot automation path gives the best maintenance trade-off
  after the first iOS and Android flows exist?
