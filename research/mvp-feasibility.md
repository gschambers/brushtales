# MVP feasibility research

**Research date:** 2026-09-19
**Question:** Can a simple cross-platform app track brushing-like motion,
run a two-minute audio story, support profiles, and keep the screen awake?

## Recommendation at a glance

Build the product shell as React Native with native camera and keep-awake
integration. Use a PWA only to prototype sensing algorithms. A PWA should not
be used to promise reliable iOS camera sessions or guaranteed screen-awake
behavior.

## Camera and on-device vision

[React Native VisionCamera frame processing documentation](https://react-native-vision-camera.com/docs/guides/frame-processors)
describes realtime frame callbacks and native plugins that can wrap Apple
Vision, ML Kit, TensorFlow Lite, or custom algorithms. The current project
documentation also describes frame outputs that run on a parallel worklet
runtime and require frames to be disposed to avoid pipeline stalls.

This makes the required architecture feasible, but it does not make brushing
recognition solved. A generic object detector can identify objects; it does not
by itself understand that a toothbrush is moving near a mouth in a useful
brushing pattern. The initial experiment should compare:

1. Face/hand landmarks plus temporal motion features.
2. A toothbrush/hand detector plus a simple motion and mouth-proximity model.
3. A small custom classifier trained only on consented, synthetic or
   explicitly approved samples, if the first two are not robust enough.

The session score should be based on sustained confidence, motion across
prompted phases, and time present—not on a claim that the teeth are clean.
Sample failure states include poor lighting, occlusion from the brush, child
movement, camera angle, glasses, multiple people, and a caregiver helping.

## PWA feasibility

[MediaPipe Tasks for Web](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector/web_js)
supports browser camera/video object detection and recommends workers when
synchronous detection would block the UI. That is sufficient for an algorithm
spike, but browser performance and model packaging vary by device.

[MDN’s Screen Wake Lock documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
states that a visible document may request a screen wake lock, but the request
can be rejected and an acquired lock can be revoked for low battery, power
save mode, or visibility changes. The lock must be reacquired after returning
to a visible document. This is a best-effort screen lock, not a way to override
system energy-saving policy.

The PWA path therefore has these risks:

- Home-screen web apps and Safari can differ from a browser tab.
- A camera stream and worker-based ML inference compete with audio and battery
  on older devices.
- The app cannot guarantee that the operating system will keep the display on.
- Backgrounding, incoming calls, permission changes, and Safari lifecycle
  behavior need platform-specific fallbacks.

## Native app feasibility

A React Native app can request camera permission, run a native frame pipeline,
play local audio, and request native foreground keep-awake behavior. On iOS,
the app can use the native idle-timer mechanism while a session is active. On
Android, a foreground activity can request the equivalent screen-on behavior.
Neither platform should be treated as authorized to disable all battery saver,
parental-control, or thermal protections.

Native implementation still requires device testing for camera orientation,
front-camera mirroring, thermal load, low light, audio focus, Bluetooth audio,
phone calls, and older OS versions.

## Suggested feasibility experiments

### Experiment A — sensing

Create a disposable camera screen that records only derived timestamps and
confidence bands locally. Test the three target ages, at least two phones, two
lighting conditions, a normal toothbrush, and caregiver-assisted brushing.
Measure false encouragement and false discouragement rather than clinical
accuracy. The experiment passes if the app can stay encouraging while finding a
useful signal for the majority of a session.

### Experiment B — session runtime

Run a two-minute camera + local audio session on an older supported iPhone and
Android phone. Measure dropped frames, audio interruptions, heat, battery
change, and whether the timer remains monotonic after pause/background/return.

### Experiment C — wake behavior

Test native keep-awake and PWA Screen Wake Lock in normal mode, low-power mode,
after backgrounding, after an incoming call, and with the device nearly empty.
The UI must expose an honest fallback in every failed case.

### Experiment D — story/audio

Produce one 90–120 second narrated branch with three decision points and test
whether children can hear the narrator, understand the choice, and continue
brushing without staring at the screen.

## Release gates

- No raw camera frame, audio recording, or child identity data leaves the
  device.
- Camera-denied mode still provides a complete timed audio experience.
- A session cannot be failed solely because detection is uncertain.
- The timer and story graph are covered by deterministic tests.
- A caregiver can delete a local profile and its progress.
- TTS vendor terms and AI-voice disclosure requirements are documented before
  assets ship.
- Privacy/store review is complete before distribution to children.
