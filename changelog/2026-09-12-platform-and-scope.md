# Initial platform and v0 scope

**Status:** Accepted for provisioning; implementation details remain subject to a device spike.

**Change:** Establish the initial native platform direction and v0 boundaries.

## Context

The app needs one codebase for iOS and Android, a front-facing camera, local persistence, audio playback, and a screen that stays awake for a two-minute session. A PWA would be attractive for a quick demo, but camera frame processing and operating-system behavior are less predictable in mobile browsers.

## Decision

Provision a React Native app using Expo and TypeScript. Use native builds rather than a browser-first PWA for v0. Start with `expo-camera` and `expo-keep-awake`; introduce `react-native-vision-camera` only if the detector needs a lower-level frame pipeline.

Use on-device inference and local-only profiles. Treat the brushing signal as an engagement/progress estimate, not a clinical measure. Include a timer/story fallback whenever camera permission or detection confidence is unavailable.

## Impact and trade-offs

- Expo provides a relatively small cross-platform starting point and supports iOS and Android camera access.
- `expo-keep-awake` exposes a platform-native way to prevent the screen from sleeping during the active session.
- A PWA can request the Screen Wake Lock API on modern browsers, but the lock can be revoked for system reasons and a web app cannot override battery-saver or other OS policy. Native packaging is the safer default for a camera-led routine.
- Expo Camera is not, by itself, a toothbrushing detector. Real-time frame processing may require a native-capable camera library and a custom/evaluated model.
- Native app-store distribution adds build, permission, and children’s-app review work, but it better fits the v0 interaction than relying on browser compatibility.

## Implication for BrushTales

Provision the native shell first, then run a short physical-device spike for camera access, wake-lock behavior, audio playback, and frame throughput before selecting the detection library. Do not promise that a PWA can override a device’s energy-saving policy.

## Sources

- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera) — iOS/Android camera preview and permissions.
- [Expo KeepAwake](https://docs.expo.dev/versions/latest/sdk/keep-awake) — cross-platform screen-sleep prevention.
- [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — browser wake locks are secure-context, revocable locks.
- [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) — live-stream hand landmarks and tracking option.
- [Google ML Kit object detection and tracking](https://developers.google.com/ml-kit/vision/object-detection) — on-device tracking and custom-model extension point.
- [FTC COPPA rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa) — children’s privacy requirements to account for before any data leaves the device.
