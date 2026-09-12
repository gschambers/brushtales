# 004 — Spike camera tracking and wake-lock behavior

- **Status:** todo
- **Priority:** critical
- **Sequence:** 4
- **Labels:** camera, ml, native, spike
- **Depends on:** 001

## Goal

Prove that a physical iOS and Android device can keep the session visible, play audio, and produce enough on-device camera signal for a useful brushing-progress prototype.

## Acceptance criteria

- `expo-keep-awake` prevents normal screen sleep during the active two-minute session and releases afterward.
- App backgrounding, interruptions, denied permission, low battery, and camera failure produce a recoverable state.
- A camera-free timer/story fallback is usable.
- A small supervised test set covers lighting, skin tones, toothbrush colors, glasses, camera angle, and adult assistance.
- The team records whether Expo Camera is sufficient; if not, a documented decision is made to evaluate VisionCamera plus MediaPipe/ML Kit or a custom model.
- No camera frame is persisted or uploaded.

## Notes

Do not label the result “teeth cleaned.” It is an engagement/progress estimate. Never ask children to make unsafe exaggerated motions.
