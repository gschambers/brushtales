# 011 — Implement project-local Herdr lifecycle

- **Status:** todo
- **Priority:** high
- **Summary:** Implement owned startup, readiness, status, and cleanup for a project-local Herdr server.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 010

## Goal

Build the smallest reusable host-side lifecycle wrapper that gives BrushTales a
dedicated Herdr server and state namespace. It must be explicit about project
identity and ownership, idempotent for retries, and safe around the existing
global server.

## Acceptance criteria

- A documented wrapper or CLI accepts an explicit BrushTales project root and
  derives the project-local Herdr configuration, socket, logs, and state paths
  under `MAIN_REAL/tmp/herdr-project/<64-char-sha256-main-root>/`, using the
  canonical-root and UTF-8 digest algorithm validated by task 010.
- `state/server-owner.json` is the authoritative committed server-owner record;
  `state/server-start.lock/owner.json` is only the atomic in-progress claim and
  must contain the same project/config/socket identity, server instance ID,
  owner token, session/PID, and generation before release. The final status
  response and complete claim/owner tuple are compared while holding the lock;
  only that atomic match permits lock release.
- Project identity is canonicalized to the main checkout. Every Herdr invocation
  receives the derived project-local `HERDR_CONFIG_PATH`; a conflicting caller
  value is rejected unless explicit legacy/migration mode is selected.
- Start is idempotent: it reuses only the matching owned server and otherwise
  starts a dedicated instance with the exact supported startup invocation
  recorded by task 010; it never substitutes ordinary global `herdr` startup.
- Concurrent starts for the same project are serialized or converge safely on
  one owned instance without duplicate sockets or ownership records. A durable
  per-project server-start lock at
  `<project-dir>/state/server-start.lock/` is claimed with atomic directory
  creation before process or socket discovery. Its owner record contains the
  canonical main root, config path, socket path, server instance ID, owner
  token, PID/session identity, generation, and lease. Losers wait up to the
  documented bounded timeout, then re-check readiness and that owner record;
  partial claims are handed to task 014's recovery protocol.
- An executable barrier-controlled two-process test starts both callers together
  and asserts one start attempt, one socket, one owner record, matching
  canonical/config/socket identities, and a loser that re-checks the running
  instance instead of launching a second process.
- Readiness verifies a running compatible server and reports actionable output
  on timeout, protocol mismatch, or missing tooling.
- Status and stop target the owned instance by project identity and ownership
  token; they cannot stop or close the shared global server by default.
- Stale ownership records, dead processes, and partial startup are handed to the
  run-ownership/recovery implementation in task 014 without guessed PID or
  socket reuse.
- The implementation has deterministic tests for start/reuse, concurrent
  project roots, failure fallback, and cleanup ownership.
- Installation and usage are documented for a clean developer checkout without
  adding Herdr to the mobile app runtime.
- The supported setup and lifecycle contract is documented in
  `docs/developer-herdr.md`, including project identity, environment precedence,
  exact startup invocation, ownership, lock schema, and recovery commands.

## Notes

Keep project state under ignored developer-tooling storage. Do not add accounts,
cloud services, analytics, or child-media persistence. The wrapper should expose
structured output suitable for the workspace-aware command adapter in task 012.
