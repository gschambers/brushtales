# BrushTales discovery and MVP design

**Status:** Discovery foundation; approved direction, not an implementation plan
**Date:** 2026-09-19
**Audience:** Product and engineering contributors preparing the v0 build

## Intent

BrushTales turns a familiar two-minute brushing routine into an audio-first
fantasy adventure. Children aged roughly 4–9 choose a story and make a small
number of decisions. Their participation in that brushing session influences
the route or ending, so brushing feels like agency rather than a timer being
attached to a chore.

The first release should prove three things:

1. A family can start a session quickly and complete it twice a day without a
   network connection.
2. On-device camera signals can provide useful, non-clinical feedback without
   collecting child media.
3. Fixed, expressive narration and a small deterministic story graph can make
   a two-minute session feel like a meaningful adventure.

## Users and age adaptation

The app supports multiple local child profiles. A profile stores a display
name or nickname, an age band, a chosen avatar, progress, and preferences.
Age bands are guidance for content presentation:

- **4–5:** short sentences, repeated prompts, picture-led choices, forgiving
  timing, and a caregiver-friendly setup.
- **6–7:** clearer cause and effect, two explicit choices, and light reading
  support alongside narration.
- **8–9:** richer vocabulary, more consequential choices, and less redundant
  guidance while retaining audio-first operation.

The profile is not used to infer health, ability, or identity. A caregiver can
change the age band and content settings locally.

## v0 experience

1. **Caregiver setup:** choose “new child,” select an age band, pick a simple
   avatar, and optionally set reminder times. No account is required.
2. **Story shelf:** choose the single v0 story. The story card describes the
   tone and approximate session length without promising a health result.
3. **Preflight:** explain camera positioning, ask for camera permission, test
   audio, request foreground screen-awake behavior, and offer “audio-only / no
   camera” if permission is denied.
4. **Brush and listen:** narration, gentle music, and short brushing prompts
   play while the two-minute timer runs. The camera view is a quiet mirror-like
   aid, not a diagnostic display.
5. **Decision moments:** at pre-authored points, the child taps one of two
   large choices. If hands are occupied, the story pauses safely and a
   caregiver can tap.
6. **Session result:** celebrate completion and explain that the adventure
   changed because the child kept going. A low-confidence session still ends
   with a positive, non-punitive result.
7. **Local progress:** update the profile’s story state and routine history.
   Provide a simple caregiver view of completed sessions, not a dental score.

## Domain model and boundaries

### Profile store

An on-device store owns profiles, age-band presentation settings, story
progress, reminder preferences, and coarse session summaries. It does not own
raw images, camera frames, voice recordings, or ML tensors.

### Session engine

The session engine owns a monotonic two-minute timer, pause/resume semantics,
audio cue scheduling, sensing lifecycle, and a final `SessionResult` such as:

```text
completedDuration
engagementBand: low | steady | strong
coveragePromptsAttempted
confidence: low | medium | high
interrupted: boolean
```

`SessionResult` is an encouragement signal. It must not be named or rendered as
a cleanliness, plaque, medical, or dental-quality score.

### Sensing adapter

The sensing adapter receives transient camera frames and emits coarse signals:
child-in-frame, toothbrush-or-hand region present, brushing-like motion,
prompt-region movement, and confidence. A native implementation is expected to
use a React Native camera pipeline plus native/on-device vision. A generic
object detector alone is insufficient to infer brushing motion; the feasibility
spike should compare face/hand landmarks, toothbrush detection, temporal motion,
and a small custom model if needed.

The adapter must provide `unsupported`, `permissionDenied`, `noFace`,
`lowLight`, and `processingUnavailable` states. Story flow must continue for
all of them.

### Story graph

Story content is a reviewed, deterministic graph of narration clips, ambient
audio, choice points, and endings. The graph consumes a small set of session
bands and the child’s choices; it does not receive frames or raw ML output.
The v0 graph should have one story, 3–4 decision points, and 3–4 endings with
shared authored clips where practical.

Brushing performance should influence the adventure’s opportunities or tone,
not determine whether the child is worthy of a happy ending. Every path should
be emotionally safe and satisfying.

### Audio asset pipeline

TTS is a content-production dependency, not a runtime dependency. Approved
script segments are synthesized, reviewed by an adult, checked for
pronunciation and age fit, normalized, and packaged as local audio assets.
Choice clips and prompts should be short enough to avoid delaying the timer.
The app should support a future `NarrationProvider` interface, but v0 should
not send child-specific text or session data to a TTS service.

## Platform and technical direction

Use React Native with a native-capable development/build workflow. The camera
and vision layer should be replaceable behind the sensing adapter. A current
React Native camera library such as VisionCamera exposes native frame
processing/frame-output hooks and plugin integration for iOS and Android; the
exact library version belongs in the implementation plan after the feasibility
spike.

Use native foreground keep-awake behavior or a well-maintained React Native
wrapper. The app cannot override every battery-saving or parental-control
setting. It should request the minimum foreground behavior, display its state,
and degrade to a visible timer/audio-only flow if refused.

A PWA can prototype MediaPipe-based camera experiments, but it cannot be the
release assumption. Browser wake locks require an active visible document, may
be revoked by the platform, and are not equivalent to disabling energy saving.
iOS home-screen PWA behavior needs device-matrix testing before it can support
a two-minute camera session promise.

## Privacy and safety requirements

- Process camera frames on-device and discard them immediately after feature
  extraction.
- Do not record or upload camera, microphone, or child voice data in v0.
- Do not use face recognition, identity matching, or a persistent face vector.
- Store the minimum local profile data and offer caregiver deletion.
- Keep the camera permission rationale clear: the camera helps estimate
  brushing-like movement; it does not inspect dental health.
- Include a caregiver notice that the app is a habit-support tool, not a
  substitute for a dentist or adult supervision.
- Obtain a privacy/legal review before public distribution to children. This
  document is product guidance, not legal advice.

## Research conclusions

The competitive research shows a proven pattern of combining a two-minute
timer, camera or connected-brush feedback, collection/rewards, profiles, and
parent-facing progress. The clearest opportunity is to make the child’s
choices and expressive audio the core reward rather than copying a sticker or
monster-collection loop.

The TTS research supports a pre-generation bakeoff between ElevenLabs,
Google Cloud’s current expressive voices, and OpenAI’s current steerable TTS.
ElevenLabs is the leading first audition for long-form, expressive English
narration; Google is the strongest enterprise/multilingual alternative; OpenAI
is a useful controllable benchmark. Commercial redistribution, AI disclosure,
voice availability, and child-directed content terms must be verified before
selecting a production vendor.

## Risks and validation gates

1. **Sensing accuracy:** test with the three target age groups, multiple
   toothbrushes, lighting conditions, portrait/landscape positioning, glasses,
   and caregiver assistance. Success means the app remains encouraging when
   sensing is uncertain, not that it achieves clinical accuracy.
2. **Thermal/battery load:** run a two-minute camera + audio session on older
   representative iOS and Android devices.
3. **Wake behavior:** verify native keep-awake behavior, interruption, lock,
   low-power mode, and return-from-background behavior.
4. **Narration quality:** run a blind listening session with caregivers and
   children in the target age range; check intelligibility, warmth, pacing,
   excitement, and pronunciation.
5. **Story pacing:** verify that choices are possible without stopping a
   toothbrush, that every branch resolves cleanly, and that younger children
   understand the choices through audio and images.
6. **Privacy and store review:** confirm camera disclosure, local deletion,
   child-directed policy, and app-store requirements before distribution.

## Explicitly out of scope for v0

- Dental diagnosis, plaque detection, tooth-by-tooth clinical maps, or claims
  of improved oral health.
- Live cloud TTS, runtime generative stories, child voice input, accounts,
  cloud sync, social features, ads, subscriptions, and a content marketplace.
- Background camera operation, device-wide game mode, or overriding system
  battery/energy-saving controls.
- Multiple stories, multiplayer, connected toothbrush hardware, and wearable
  integrations.

## Implementation entry criteria

The implementation plan may begin when the team has selected a camera/vision
experiment, defined the local storage technology, chosen the first authored
story graph, and completed a TTS audition plus licensing check. The plan must
keep the sensing adapter and story graph independently testable.
