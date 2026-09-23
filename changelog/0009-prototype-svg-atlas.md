# 0009 — Prototype SVG mouth atlas

## Context

The approved prototype’s mouth guide uses authored tooth geometry and
surface-specific marks that generic native views cannot reproduce faithfully
across iOS, Android, and web.

## Decision

Render the local, non-sensitive mouth guide with `react-native-svg`, using
only deterministic geometry and the bundled OpenMoji toothbrush asset. The
atlas consumes the existing zone index and emits no sensing data, frames, or
biometric identifier.

## Alternatives

- Keep rounded React Native views: rejected because they lose the reviewed
  tooth silhouette, grooves, and gum highlight.
- Use an HTML-only atlas: rejected because it would not provide the same native
  presentation on iOS and Android.

## Consequences

`react-native-svg` adds an Expo-compatible native dependency. It is MIT
licensed, renders locally, makes no network requests, and needs no privacy
permission. If SVG rendering is unavailable, the session remains usable with
the same timer/audio controls; the atlas can be omitted without blocking the
adventure.

## Follow-up questions

- Confirm the exact display font files to bundle for consistent Android
  rendering; the current port uses the prototype’s system font stack.
