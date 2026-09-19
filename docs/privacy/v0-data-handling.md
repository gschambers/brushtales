# BrushTales v0 data handling

## Scope

BrushTales v0 is an on-device habit-support tool for supervised brushing. It
does not create accounts, sync profiles, upload analytics, or call a runtime
TTS or vision service.

## Stored locally

- Child profile nickname, age band, avatar key, and timestamps.
- Session summaries: story ID, completed duration, coarse engagement band,
  sensing confidence, interruption flag, and completion state.
- Caregiver-selected reminder times, when reminders are enabled.

## Not stored or transmitted

- Camera frames, face images, face vectors, biometric identifiers, or video.
- Microphone recordings, child voice samples, or audio recordings.
- Raw ML/vendor objects, location, account credentials, contacts, or social data.
- TTS provider keys, child-specific prompts, or cloud session data.

Camera processing is transient and on-device. The sensing adapter translates
available input into coarse states such as `ready`, `noFace`, and `lowLight`; it
does not measure plaque, cavities, gum health, cleanliness, pressure, or
clinical brushing quality. If permission or processing is unavailable, the
timed audio story continues.

## Permissions

- Camera permission is requested only for the optional brushing-like motion
  signal. The rationale says that the camera does not inspect dental health.
- Microphone permission is disabled in the Expo Audio configuration. The app
  plays fixed local audio and does not record voices.
- Notification permission is requested only from adult settings. A reminder
  contains generic text and no child name, profile ID, session result, or
  story choice.

## Caregiver controls

Adult settings provide local age-band editing, coarse history (dates/durations
and completion state only), reminder settings, privacy explanation, and profile
deletion. Deleting a profile cascades to its local summaries. The app does not
provide a cloud recovery path.

## Release gates

Before distribution, complete privacy/store review, caregiver content review,
TTS licensing and AI-voice disclosure review, native device testing, and a
verification that no frame/audio logging or upload path was introduced.
