# 017 — Streamline the local build workflow

- **Status:** in_progress
- **Priority:** high
- **Summary:** Provide one local build command that provisions Herdr and context-aware OpenCode permissions.
- **Labels:** tooling, orchestration
- **Depends on:** none

## Goal

Provide boring local developer commands—`next` and `build.sh <task-id>`—that
resolve canonical planning data, select viable work deterministically, reuse or
provision the exact registered task worktree in a Herdr workspace, configure
context-aware OpenCode permission handling, and launch the builder without
repetitive manual orchestration.

## Acceptance criteria

- Task metadata is checked against both SQLite and Markdown in the canonical
   checkout.
- An executable repo-local `bin/next` selects only `todo` tasks whose
  dependencies are all `done`, orders them deterministically by priority and
  planning sequence, supports `--limit N` (default `1`) and `-q/--quiet`, and
  exits nonzero without stdout when no viable task matches.
- `next -q` emits only validated three-digit task IDs, one per line, for simple
  shell composition. Selection is local SQLite/Markdown logic and never asks
  an LLM to invent task IDs.
- Only the exact registered clean task worktree may be launched.
- A single public `build.sh <task-id>` entry point accepts the task ID and
  internally performs the local-build handoff; callers do not need to invoke
  `build-local.sh`, Herdr, or OpenCode separately.
- The project provisions `direnv` through the `Brewfile`, checks in a safe
  `.envrc` that adds the repository-local `bin/` directory to `PATH`, and
  provides an executable repo-local `build <task-id>` wrapper around
  `build.sh`. The wrapper works from both the canonical checkout and a linked
  task worktree without relying on a globally installed project command.
- The build handoff automatically runs `direnv allow` for the exact canonical
  and task-worktree `.envrc` files after validating their identity. Missing
  `direnv` produces clear setup guidance and never executes an untrusted
  `.envrc`; tests use a fake command and never change the user's direnv state.
- Herdr provisioning is idempotent: it confirms server readiness, reuses the
  workspace for the exact worktree when present, otherwise opens that exact
  worktree through the supported Herdr command, discovers opaque workspace and
  pane IDs, and launches against an explicitly validated pane. It never
  guesses from focus or pane order and never stops a shared server.
- When Herdr is unavailable, the same entry point uses an ordinary local
  OpenCode fallback with the same absolute worktree and task context.
- The OpenCode launch is integrated with the published
  `opencode-auto-permissions` plugin (MIT,
  https://github.com/hueyexe/opencode-auto-permissions) through an idempotent
  installation/configuration check. Routine, task-scoped shell work runs
  without repeated prompts; destructive Git, deletion, privilege escalation,
  credential access, broad external-directory access, and other high-risk
  actions remain denied or context-reviewed. The integration never grants
  blanket destructive access, persists credentials, or claims to be an OS
  sandbox.
- Permission setup is explicit, inspectable, and safe to retry. Missing or
  incompatible OpenCode/plugin tooling produces actionable recovery text rather
  than silently downgrading to an unsafe policy.
- Failures and interruptions leave a short ignored local run record with task,
  exact worktree, Herdr workspace/pane, process/session IDs, status, and
  recovery guidance—without child media, credentials, or environment dumps.
- Tests use local fakes/stubs and cover task resolution, worktree safety,
  Herdr workspace create/reuse and pane targeting, Herdr fallback, plugin
  install/configuration, routine-versus-risky permission behavior, launch
  failure/interruption, and summary/run-record output. No shared workspace or
  global server is touched by tests.

## Sources and implications

- [OpenCode Auto Permissions](https://github.com/hueyexe/opencode-auto-permissions)
- [OpenCode permissions](https://opencode.ai/docs/permissions/)
- [OpenCode configuration](https://opencode.ai/docs/config/)

**Implication for BrushTales:** this is developer-only host tooling. The plugin
reduces approval interruptions by reviewing narrowly scoped `ask` operations;
it does not bypass OpenCode policy, Git publication approvals, Herdr ownership,
or operating-system permissions. Child images, camera frames, voice recordings,
provider credentials, and arbitrary environment data remain outside the
workflow.
