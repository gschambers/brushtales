# 0007 — Pre-generate expressive narration assets

**Date:** 2026-09-19
**Status:** Accepted for v0, vendor pending audition

## Context

The user wants a humanistic TTS experience rather than native robotic voices.
Runtime cloud synthesis would require credentials, network availability, and
child/session text handling.

## Decision

Use a vendor bakeoff led by ElevenLabs, with Google Cloud and OpenAI as
benchmarks. Generate, review, normalize, and ship fixed audio assets. Do not
put API credentials in the client or synthesize during a brushing session.

## Alternatives considered

- Native device TTS.
- Runtime cloud TTS.
- Commission a human narrator immediately.

## Consequences

Offline playback is reliable and story audio can be reviewed. Revisions require
regenerating assets, and commercial licensing plus AI disclosure must be
verified before distribution.
