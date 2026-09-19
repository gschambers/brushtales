# Native camera sensing boundary

## Context

BrushTales needs a native-capable camera path for transient, on-device
brushing-like motion signals. The app must not retain or upload frames, face
images, audio recordings, or biometric identifiers, and it must continue
without camera access.

## Decision

Use `react-native-vision-camera` 5.x behind `NativeSensingAdapter`. The adapter
requests the front-camera permission, stops its lifecycle on session teardown,
and exposes only the existing typed `SensingSignal`/`SensingStatus` contract.
The initial implementation emits a conservative low-confidence ready signal;
the feasibility spike may replace the internal frame processor without changing
story content or session interfaces.

The dependency is MIT-licensed and requires the VisionCamera Nitro peers. The
native build declares the iOS camera usage rationale and Android camera
permission in `app.json`. No microphone permission is requested. If permission
is denied/restricted or processing is unavailable, the session remains an
encouraging audio-only experience.

## Alternatives considered

- `expo-camera`: simpler Expo integration, but less suitable for the native
  frame-processor feasibility path selected for v0.
- A web/PWA camera path: retained only as a feasibility experiment because
  iOS wake behavior and frame processing are less predictable.
- A vendor cloud vision API: rejected because v0 requires transient local
  processing and no child media upload.

## Consequences

- Development builds are required; Expo Go is not the production assumption.
- Platform camera permission text and device testing are release gates.
- The MVP has a clear non-camera fallback and makes no dental-quality claims.
- The initial signal quality is intentionally conservative until representative
  iOS and Android testing selects a model.

## Follow-up

- Run the feasibility matrix across age bands, lighting, glasses, devices, and
  caregiver assistance.
- Confirm the exact VisionCamera/Nitro versions and native build behavior on
  the representative iOS and Android hardware before release.
- Verify that no frame processor logs, serializes, or persists raw pixels.
