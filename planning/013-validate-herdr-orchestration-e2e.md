# 013 — Validate Herdr orchestration end to end

- **Status:** todo
- **Priority:** high
- **Summary:** Validate project-local Herdr orchestration, recovery, and migration from the shared server workflow.
- **Labels:** developer-experience, qa, tooling, workflow
- **Depends on:** 012

## Goal

Prove that a developer can bootstrap BrushTales, run the workspace-aware
OpenCode workflow, recover from interruptions, and work alongside the existing
global Herdr server without cross-project state or resource damage.

## Acceptance criteria

- A clean-checkout walkthrough installs host tooling, starts the project-local
  server, creates an exact-path workspace, and runs the documented command flow.
- Two simultaneous project roots and the existing global server remain isolated;
  each test can identify its own config, socket, workspace, panes, and logs.
- A migration run can start the project-local server while the global server is
  already running, leaves existing global workspaces untouched, and makes the
  local-vs-global choice explicit in wrapper output and documentation.
- The migration exercises both canonical wrapper forms with the same task,
  worktree, and spec:
  `brushtales-herdr run --project-root <main> --task <id> --worktree
  <absolute-worktree> --spec <absolute-spec> --mode local`, and
  `brushtales-herdr run --project-root <main> --task <id> --worktree
  <absolute-worktree> --spec <absolute-spec> --mode legacy-global
  --global-config <absolute-global-config>`. The first must report a dedicated
  disposition; the second must report `server_disposition=shared` and perform
  no shared-resource cleanup.
- The migration test captures global server/config/socket/workspace/pane
  inventories before and after using the exact status, worktree-list, and
  pane-list command strings recorded by task 010 (the observed forms are
  `herdr status server`, `herdr worktree list --cwd <global-main> --json`, and
  `herdr pane list --workspace <global-workspace-id>`). Global snapshots run
  with `HERDR_CONFIG_PATH=<captured-global-config>` from the explicit migration
  input; the local
  invocation runs with its derived `HERDR_CONFIG_PATH`. The test normalizes
  volatile fields, stores redacted/hash-only evidence under `tmp/`, asserts
  global state is unchanged, and audits that local cleanup issues no global
  stop or close operation.
- End-to-end tests cover server unavailable/incompatible, workspace-open failure,
  pane failure, OpenCode launch failure, interrupted process, stale ownership,
  retry, cleanup, and manual recovery.
- Result locks, workspace ownership, transfer intent, quarantine, and recovery
  behavior are exercised with exact output and no destructive fallback.
- `/build`, `/review`, `/verify`, and wrapping CLIs are verified from supported
  launch locations and do not depend on global Herdr focus.
- The onboarding, troubleshooting, and migration documentation defines the
  concrete transition from the shared global workflow to the project-local one,
  including legacy wrapper behavior, rollback, and how to adopt the local server
  without stopping or altering the shared global server.
- The documentation is maintained in `docs/developer-herdr.md` and is exercised
  by the clean-checkout walkthrough.
- The verification record contains exact commands, pass/fail/unavailable status,
  and confirms that no child images, camera frames, or voice recordings are
  stored or uploaded.

## Notes

Use disposable test projects and fake Herdr responses where a physical host
surface is unavailable. This task is a developer-workflow gate, not a claim
that Herdr belongs in the mobile runtime.
