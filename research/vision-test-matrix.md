# Vision sensing device-test matrix

**Status:** Test plan prepared; physical-device execution pending
**Date prepared:** 2026-09-19

This matrix records only derived observations such as confidence bands, timing,
frame-drop counts, temperature trend, and battery percentage. No camera frames,
face images, recordings, or child identifiers may be stored. Obtain caregiver
consent and supervise every session.

## Device and environment matrix

| Platform | Device class | Device target | Portrait / front camera | Normal light | Low light | Glasses | Caregiver assist | Camera denied | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iOS | Older supported | iPhone SE (2nd gen) or equivalent | Pending | Pending | Pending | Pending | Pending | Pending | Not run in this workspace |
| iOS | Current | Current supported iPhone | Pending | Pending | Pending | Pending | Pending | Pending | Not run in this workspace |
| Android | Older supported | Pixel 5 / Galaxy S20 class | Pending | Pending | Pending | Pending | Pending | Pending | Not run in this workspace |
| Android | Current | Current supported Android | Pending | Pending | Pending | Pending | Pending | Pending | Not run in this workspace |

## Signals and product bar

The least-complex baseline is a derived feature seam: child-in-frame,
low-light, normalized motion score, and prompted-region coverage. The adapter
maps those features to `SensingSignal` and never exposes frame pixels. A useful
run should show a stable participation signal for most of the two-minute
session without false discouragement; it is not a clinical accuracy test.

Record per scenario:

- start/stop and pause/resume timing drift;
- confidence band and failure status over time;
- dropped-frame count and whether audio remains understandable;
- thermal trend and battery percentage before/after;
- whether a child can continue in audio-only mode after uncertainty.

## Current decision

No device measurements are claimed yet. Keep the configurable derived-signal
baseline and audio-only fallback until the matrix is run on representative
iOS and Android hardware. Do not add a custom toothbrush model based on
synthetic or anecdotal observations alone.
