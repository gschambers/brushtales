# Manual vision and wake-behavior scenarios

These are manual device checks, not automated tests. Record only derived values
with caregiver consent; never save camera frames, face images, audio, or child
identity data.

## Sensing scenarios

- [ ] Portrait, normal lighting, ordinary toothbrush, child in frame.
- [ ] Portrait, low lighting: app says the signal is uncertain and continues.
- [ ] Child wearing glasses: no shame or failure language.
- [ ] Caregiver assists: session remains encouraging and does not identify the
  caregiver.
- [ ] Child moves partly out of frame: `noFace`/uncertain state and audio-only
  continuation.
- [ ] Camera permission denied or restricted: complete two-minute audio story.
- [ ] Pause, background, return, and unmount stop the frame pipeline.

## Runtime and wake scenarios

- [ ] Two-minute timer counts only foreground running time.
- [ ] Screen-awake acquisition succeeds and releases after completion.
- [ ] Acquisition denied: session continues with a visible fallback notice.
- [ ] Wake lock revoked, low-power mode, and nearly empty battery: timer/audio
  continue and the UI says the screen may dim.
- [ ] Incoming call/audio-focus interruption: result is interrupted, not failed.
- [ ] Older iOS and Android devices do not show unhandled native errors or
  thermal warnings during a session.

## Recording template

For each run record: device/OS, scenario, derived status sequence, confidence
band, elapsed-duration drift, dropped-frame count, audio interruption count,
temperature trend, battery delta, and whether the fallback remained usable.
