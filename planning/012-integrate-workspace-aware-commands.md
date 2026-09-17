# 012 — Integrate workspace-aware OpenCode commands and wrappers

- **Status:** todo
- **Priority:** high
- **Summary:** Make BrushTales OpenCode commands and wrapping CLIs carry project and Herdr workspace context.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 011, 014

## Goal

Connect the project-local Herdr lifecycle to the developer workflow so every
delegated run resolves the intended project, Git worktree, Herdr workspace, and
OpenCode session explicitly rather than relying on global focus or ambient
working directories.

## Acceptance criteria

- `/build`, `/review`, and `/verify` resolve and pass an explicit project root,
  task ID, absolute worktree, delegation spec, and Herdr workspace identifier.
- Each command performs the canonical-root fence before task lookup: it resolves
  the shared Git directory and its checkout parent from the supplied cwd,
  resolves task metadata from that main root, and compares the selected task
  path with the exact feature-worktree copy and requires identical byte-level
  SHA-256 content for both task files before delegation. This fence is required
  in the command implementations, not merely in the future Herdr wrapper, so a
  feature-worktree invocation cannot select divergent planning metadata.
- A documented wrapper interface accepts
  `--project-root <main> --task <id> --worktree <absolute-path> --spec
  <absolute-path> --mode local|legacy-global [--global-config <absolute-path>]`
  on `brushtales-herdr run`, and
  emits one JSON object with
  `project_root`, `task_id`, `worktree`, `spec`, `server_instance_id`,
  `server_disposition`, `workspace_id`, `workspace_disposition`, and a `panes`
  map keyed by `main|terminal|builder|adversary`. The default mode is `local`;
  `legacy-global` requires `--global-config`, emits
  `server_disposition=shared`, and disables server stop plus cleanup of shared
  workspaces. Normal mode rejects `--global-config`. The companion
  `brushtales-herdr status --project-root <main> --mode local|legacy-global
  [--global-config <absolute-path>]` and
  `brushtales-herdr stop --project-root <main> --server-instance-id <id>
  --owner-token <token>` subcommands require explicit context; `stop` rejects
  legacy-global mode. There is no implicit global/default form. Exit status is
  `0` for success, `2` for invalid/mismatched context, `3` for unavailable
  tooling, `4` for busy ownership, and `5` when operator recovery is required.
  The mode matrix is uniform: omitted `--mode` and `--mode local` select local
  state for `run` and `status`; `--mode legacy-global` requires exactly one
  absolute `--global-config`; `stop` and all workspace-recovery commands accept
  local mode only and reject legacy-global or global-config arguments before
  invoking Herdr.
- The wrapping `deliver`/Herdr CLIs use structured workspace and pane IDs, exact
  worktree paths, and explicit cwd values; they never infer a workspace from
  focus, sidebar order, or a global default.
- A run creates or reuses only the exact project/worktree workspace recorded for
  that run, and cleanup closes only resources owned by that run.
- Commands launched from the main checkout, a feature worktree, and a Herdr pane
  all resolve the same task context or fail clearly rather than crossing roots.
- Provisioning, builder handoff, adversarial probes, verification, and manual
  fallback retain the existing absolute-path and approval-gated contracts.
- The adapter has tests for missing context, mismatched project/worktree,
  workspace reuse, pane launch, interrupted runs, local-vs-legacy mode,
  unavailable/failure JSON, and global-server isolation.
- Recovery is exposed through explicit `brushtales-herdr workspace reconcile`,
  `brushtales-herdr workspace recover`, and `brushtales-herdr workspace abandon`
  commands. Their canonical required arguments are respectively
  `--task --from-run --state --owner-token --generation --worktree
  --workspace-id --evidence --confirm`, `--task --from-run --to-run
  --owner-token --expected-predecessor --worktree --workspace-id --evidence
  --confirm`, and `--task --run --owner-token --worktree --evidence --confirm`.
  `brushtales-herdr server reconcile` additionally requires
  `--project-root --evidence --confirm`. None has a focus-based or
  global-default form.
- Structured unavailable/failure output uses `{ok:false, code, message,
  project_root, task_id, worktree, server_disposition, recovery_command}` with
  no secret/token values. Successful pane output uses the fixed role keys
  `main`, `terminal`, `builder`, and `adversary`; absent roles are explicit
  `null`, never inferred from pane order.
- Help text and onboarding explain how to inspect the active project-local
  server/workspace and how to recover without affecting other projects.

## Notes

This task implements developer tooling only. It must not add runtime Herdr,
network inference, credentials, or child-media handling to the BrushTales app.
