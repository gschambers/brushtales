# BrushTales agentic development guidelines

## Product mission

BrushTales is an audio-first adventure that helps children build a calm,
consistent toothbrushing routine. A child chooses a story, brushes for a timed
session, and makes story choices whose available outcomes reflect the session.
The product should encourage participation and confidence; it must not shame a
child or claim to diagnose, prevent, or treat dental disease.

The v0 audience spans approximately ages 4–9. Adapt language, pacing, choice
complexity, and visual scaffolding through a local child profile rather than
building separate products for each age.

## Current scope and architectural default

- v0 targets iOS and Android with a React Native application capable of using
  native modules.
- A PWA may be used for a throwaway feasibility experiment, but it is not the
  default production path because camera processing and screen-awake behavior
  are less predictable on iOS home-screen web apps.
- Profiles, progress, story state, and session summaries remain on-device in
  v0. There is no account, server sync, analytics backend, or remote child
  data store.
- Camera input is processed transiently on-device. Do not persist or upload
  camera frames, face images, audio recordings, or biometric identifiers.
- Narration is generated during content production and shipped as fixed audio
  assets for v0. Never put a TTS provider API key in the mobile client.

The discovery design and decision records are in:

- `docs/superpowers/specs/2026-09-19-brushtales-discovery-design.md`
- `research/`
- `changelog/`

## Child safety and experience rules

1. Use encouraging language such as “let’s keep exploring” rather than “you
   failed” or “your teeth are dirty.”
2. Never make story access, affection, food, sleep, or other necessities
   contingent on brushing performance.
3. Do not present vision output as dental measurement or medical advice.
4. Treat detection as an imperfect engagement signal. Always provide a
   graceful, non-punitive path when the camera cannot see the child or cannot
   recognize brushing.
5. Keep an adult-visible setup and settings path. Do not ask a child for a
   name, photo, voice sample, location, or account credentials.
6. Avoid ads, external links, social sharing, manipulative streak pressure,
   and reward loops designed to maximize screen time.
7. Make audio understandable without requiring the child to read. Choice
   controls need large touch targets, clear labels, and non-color-only cues.
8. The caregiver remains responsible for supervision and safe brushing. The
   app must say so without using alarming language.

## Vision and session boundaries

- The MVP may estimate that brushing-like motion is present, that the child is
  in frame, and that prompted regions or phases were attempted.
- It must not claim to see plaque, cavities, gum health, tooth cleanliness,
  pressure, or clinical brushing quality.
- Prefer a robust, explainable score made from confidence and coverage signals
  over a brittle “perfect brushing” classifier.
- A two-minute session is the default product requirement, with a clear
  pause/reposition path. The routine is twice daily, but the app should not
  punish extra sessions or missed days.
- Screen-awake requests are best effort. Native foreground keep-awake APIs
  must be released when a session ends, and the UI must explain if the OS
  refuses or revokes the request.

## Engineering practices

- Keep the story engine, session timer, sensing adapter, profile store, and
  audio player behind small interfaces so they can be tested independently.
- Make all clock-dependent behavior injectable. Tests must cover pause,
  resume, app backgrounding, interruption, and device time changes.
- Keep sensing vendor/model details out of story content. The story receives a
  session result, not raw frames or an ML-specific object graph.
- Prefer deterministic, local story graphs over runtime-generated child-facing
  text in v0. All story text and audio must be reviewed before release.
- If a native dependency is added, document its platform requirements,
  license, privacy behavior, and fallback behavior in the relevant decision
  record.
- Never commit secrets, generated child media, raw camera samples, or vendor
  credentials.

When the app exists, expected checks include formatting, type checking, unit
tests for every domain interface, and device tests on representative iOS and
Android hardware. A feature is not complete until its failure mode is tested.

## Research and decision logs

- Research claims must link to a first-party source where possible and record
  the access date.
- Treat app-store descriptions, vendor marketing claims, and user reviews as
  evidence of positioning or reported experience, not independent proof of
  health outcomes.
- Put one decision in each `changelog/*.md` file. Include context, decision,
  alternatives, consequences, and follow-up questions.
- Update the design spec when a decision changes an interface, privacy
  boundary, platform assumption, or release gate.
