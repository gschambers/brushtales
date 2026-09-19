# 0003 — Treat camera output as engagement sensing, not dental measurement

**Date:** 2026-09-19
**Status:** Accepted

## Context

The requested object detection is intended to track brushing motion. Generic
object detection cannot establish plaque removal or clinical brushing quality,
and false negatives are likely with young children.

## Decision

The sensing layer may emit transient, coarse signals such as child-in-frame,
brush/hand region present, brushing-like motion, prompted-region movement, and
confidence. Session results are encouragement bands, never cleanliness,
plaque, cavity, gum, or medical scores.

## Alternatives considered

- Claim tooth-by-tooth cleanliness from camera frames.
- Require a connected toothbrush.
- Omit sensing and build only a timer.

## Consequences

The app needs honest uncertainty states and an audio-only fallback. A
feasibility experiment must be completed before selecting a model.

## Feasibility status — 2026-09-19

The implementation preserves this boundary with a configurable derived-feature
seam and a conservative baseline adapter. The device matrix and manual
scenarios are documented in `research/vision-test-matrix.md` and
`tests/device/visionScenarios.md`, but no physical devices were available in
this workspace, so no accuracy, thermal, battery, or frame-drop result is
claimed. The model decision remains open until representative iOS and Android
testing is completed.
