# 0005 — Keep profiles and progress on-device

**Date:** 2026-09-19
**Status:** Accepted for v0

## Context

The MVP needs multiple child profiles but does not need server persistence.
Camera use involves child-directed privacy risk.

## Decision

Store the minimum profile, story progress, reminder, and coarse session-summary
data locally. Do not upload or persist camera frames, child voice recordings,
face images, or biometric vectors. Provide caregiver deletion.

## Alternatives considered

- Account-based profiles and cloud sync.
- Anonymous analytics and uploaded session telemetry.
- Storing short camera clips for model improvement.

## Consequences

There is no cross-device recovery in v0. The privacy boundary is simpler, but
later research or sync features will require a new decision and policy review.
