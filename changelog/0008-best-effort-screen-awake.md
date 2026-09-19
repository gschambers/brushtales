# 0008 — Request foreground keep-awake without overriding system policy

**Date:** 2026-09-19
**Status:** Accepted

## Context

The child needs to see the timer/camera during a session, but applications
cannot reliably override low-power, thermal, parental-control, or other OS
policies. Web Screen Wake Lock can be denied or revoked.

## Decision

The native app requests screen-awake behavior only while a session is active,
releases it at the end, and shows an honest fallback if the request fails or is
revoked. Do not claim to enable a device-wide “game mode” or disable energy
saving.

## Alternatives considered

- Require users to change device energy settings.
- Use a PWA wake lock as the product guarantee.
- Play an invisible looping video to keep the screen active.

## Consequences

Native foreground behavior is more reliable but still not absolute. The story
and timer must remain usable if the display dims or the app is interrupted.
