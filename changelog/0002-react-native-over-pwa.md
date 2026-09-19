# 0002 — Prefer React Native with native modules

**Date:** 2026-09-19
**Status:** Accepted for MVP direction

## Context

The product needs camera processing, local audio, reliable foreground behavior,
and both iOS and Android support. A PWA is attractive for speed but must keep
the screen awake for a two-minute session.

## Decision

Use React Native with a native-capable build workflow. Keep a PWA as an
optional, throwaway sensing experiment only.

## Alternatives considered

- PWA with MediaPipe and Screen Wake Lock.
- Flutter with platform ML plugins.

## Consequences

The MVP has native build and store overhead, but can use native camera and
foreground keep-awake APIs. We must isolate native dependencies behind small
adapters and test both platforms on physical devices.
