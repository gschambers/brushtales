# 018 — Complete the delegated build delivery workflow

- **Status:** done
- **Priority:** high
- **Summary:** Make the local build command hand off to the complete safe /build workflow.
- **Labels:** tooling, orchestration, workflow, safety
- **Depends on:** none

## Goal

Make `build <task-id>` a reliable handoff into the repository's prescribed
`/build <task-id>` delivery loop rather than a direct builder launcher. The
workflow should be boring local developer tooling: it must validate the task,
create or reuse the exact task worktree, prevent ordinary concurrent ownership
conflicts, and keep OpenCode's existing agent permissions authoritative while
the `opencode-auto-permissions` plugin reviews contextual requests.

This is a follow-up to the merged Task 017 implementation. It intentionally
has no planning dependency: the current Task 017 behavior is the baseline that
this task corrects, while Task 017 remains in progress until its original
acceptance criteria are fully satisfied.

## Acceptance criteria

- The public repo-local `build`/`build.sh` command preserves its existing input
  contract: positional and whitespace-delimited IDs are normalized,
  deduplicated, bounded, and completely validated before any session starts.
- A task may launch only when its canonical SQLite/Markdown metadata agrees, its
  status is `todo`, and every dependency is `done`.
- Each task acquisition uses a simple per-task lock or equivalent owner
  record. A concurrent invocation cannot launch a second session for the same
  task; an existing owner produces explicit recovery guidance. PID liveness,
  focus, and pane order are not used as the sole ownership check.
- The canonical checkout is validated before worktree creation. The workflow
  verifies the current `origin/main`, refuses an ordinary dirty or non-main
  root, and never performs application edits in the canonical checkout.
- If `.worktrees/<task-id>` is absent, the workflow creates that exact
  registered worktree from the validated `origin/main` with a deterministic
  feature branch. If it exists, the workflow verifies its exact path, shared
  Git identity, branch, clean state, and base freshness before reuse.
- Each task launches one independent OpenCode **orchestrator** session with the
  explicit `/build <task-id>` handoff from the canonical checkout. The spawned
  workflow owns the delegation spec, builder, adversarial review, verification,
  planning-index update, and approval pause; it must not use the old direct
  `Implement task ... Never invoke /build` prompt.
- The launcher uses the installed OpenCode TUI contract: it starts
  `opencode --prompt <prompt>` in the explicitly validated Herdr pane and
  submits the populated prompt with an explicit Herdr `pane send-keys ...
  Enter` operation. It must not use `opencode run`, unsupported `--dir` flags,
  or assume that `--prompt` submits the message by itself.
- Herdr, when available, launches against the explicitly selected workspace and
  pane for the intended canonical/task context without relying on focus or pane
  ordering. The ordinary local OpenCode fallback uses the same absolute root
  and task context and never stops a shared Herdr server. If Herdr is absent or
  unsupported, the fallback is the normal path; no descriptor-level Herdr
  security protocol is required for this personal-device workflow.
- The build path does not rewrite `opencode.json` or synthesize a competing
  permission policy. The committed agent permissions remain the hard role and
  safety boundary; `opencode-auto-permissions` reviews only contextual
  `ask` requests. Missing or incompatible plugin setup fails with actionable
  setup guidance rather than silently weakening policy.
- Existing safe direnv handling remains explicit: only repository-controlled
  `.envrc` files may be allowed, and the command must not silently execute an
  untrusted file. A missing or unavailable direnv setup reports actionable
  guidance rather than implementing a bespoke sandbox.
- Launch, interruption, lock contention, worktree rejection, Herdr failure,
  and OpenCode failure leave a short ignored run record with task, exact root
  and worktree, owner/lock state, workspace/pane when known, process/session
  IDs, status, redacted error classification, and recovery guidance. No child
  media, credentials, or environment dumps are recorded.
- Tests use local fakes and cover batch prevalidation, task lifecycle and
  dependency checks, lock contention and stale ownership guidance, worktree
  creation and freshness, explicit `/build` handoff, Herdr targeting and
  fallback, permission/plugin check-only behavior, interruption, and run-record
  output. Tests should prefer direct, readable behavior checks over an
  exhaustive hostile-filesystem race matrix.
  Tests do not touch a shared Herdr workspace, global server, user OpenCode
  configuration, or real credentials.

## Verification

- `bash planning/verify-index.sh`
- `python3 -m unittest discover -s tests -v`
- `git diff --check`
- Run the repository's available formatting, lint, typecheck, and build gates;
  report unavailable gates rather than inventing results.

## Notes

The plugin is an approval/review layer, not a replacement for explicit agent
denies. Keep role-specific access and hard safety boundaries in the agent
definitions; centralize only routine-versus-contextual approval behavior after
effective OpenCode permission precedence is tested.
## Scope decision — 2026-09-19

This is personal, greenfield developer tooling running on a personal device.
The implementation target is a reliable `next -q | build` workflow, not a
general hostile-host security protocol. Descriptor-level TOCTOU defenses,
custom immutable snapshot lifecycles, nested Git-admin confinement, and
descriptor-bound Herdr APIs are explicitly deferred unless a future threat
model or deployment context justifies them. Keep ordinary path validation,
clear failure records, task/worktree isolation, permission boundaries, and
credential/privacy hygiene.
