# 010 — Validate project-local Herdr server isolation

- **Status:** todo
- **Priority:** high
- **Summary:** Validate a Herdr server and state namespace isolated to the BrushTales project.
- **Labels:** developer-experience, spike, tooling, workflow
- **Depends on:** 009

## Goal

Determine and prove the supported Herdr configuration for BrushTales so the
project can run its own server instead of sharing the current global server
with unrelated projects. This is a host-tooling investigation, not an app
feature.

## Acceptance criteria

- A documented supported Herdr version and startup/readiness procedure exists,
  including the available workspace/pane host command surface and any Herdr
  capabilities that must be supplied by BrushTales task 014.
- A project-local configuration root, socket, log location, and state namespace
  are selected and kept under an explicitly ignored project-owned directory.
- The derivation is deterministic: resolve the main checkout by asking Git for
  the shared `--git-common-dir` from the supplied root, take its checkout parent,
  reject symlinked components, and use the lowercase hexadecimal SHA-256 of the
  canonical main-root UTF-8 bytes without a trailing newline. The namespace is
  `MAIN_REAL/tmp/herdr-project/<64-char-hash>/` with these required children:
  `config/`, `server.sock`, `logs/`, `state/`, and `state/server-owner.json`.
  Lifecycle lock directories and their owner snapshots live below `state/` and
  are not alternate namespaces. After a successful claim,
  `state/server-owner.json` is authoritative; a transient start-lock owner must
  match it before the lock is released.
- The project identity is canonicalized to the main checkout, even when a
  command starts from a feature worktree. The wrapper sets `HERDR_CONFIG_PATH`
  to the derived project-local config for every Herdr invocation and rejects a
  conflicting caller value unless explicit legacy/migration mode is selected.
- Environment handling is deterministic: normal mode removes inherited
  `HERDR_*` endpoint/configuration variables, sets only the validated local
  `HERDR_CONFIG_PATH`, and records the resulting environment allowlist. The
  only opt-in exception is `--mode legacy-global --global-config
  <absolute-path>`, which uses only that validated global config and forbids
  local cleanup of shared resources; inherited endpoint variables remain
  scrubbed in both modes. The parser matrix is fixed: omitted `--mode` means
  `local`; `--mode local` rejects `--global-config`; `--mode legacy-global`
  requires exactly one absolute `--global-config`; all other combinations fail
  before Herdr is invoked.
- The probe must identify an actually supported isolated startup invocation/API
  for the installed Herdr version and record it verbatim in
  `docs/developer-herdr.md`; if no supported invocation can launch a server
  against the derived config, task 010 is blocked and task 011 must not invent
  a headless command or claim isolation.
- Starting BrushTales does not attach to or mutate the existing global Herdr
  server; the probe demonstrates this with both servers available.
- Two project roots can run concurrently without seeing, reusing, or closing
  each other’s workspaces, panes, or sessions.
- Two simultaneous startup attempts for the same project converge on one owned
  server and one state namespace rather than creating conflicting instances;
  a barrier-controlled two-process probe asserts one socket, one owner record,
  and a loser re-check rather than a second launch.
- Ownership metadata identifies the project root, server instance, and run; stop
  and cleanup operate only on an instance owned by BrushTales.
- Missing, incompatible, or unavailable Herdr produces a clear non-destructive
  fallback and leaves the global server untouched.
- The documented host procedure includes the exact status/readiness command,
  bounded timeout, protocol check, and the workspace/pane JSON list commands
  used by task 013's migration inventory.
- The probe records exact commands and outcomes without persisting child images,
  camera frames, voice recordings, or other child media.

## Notes

Use a disposable harness and real local Herdr where available, with a fake
server adapter only for deterministic negative cases. Do not change the global
Herdr installation or stop a server owned by another project. The isolation
probe must snapshot the global server/workspace/pane state before and after and
must show that local start, close, and stop commands address only the derived
configuration.
