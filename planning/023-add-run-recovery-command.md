# 023 — Add a lightweight run recovery command

- **Status:** todo
- **Priority:** medium
- **Summary:** Add a safe command for inspecting and recovering stale local build runs.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 020

## Goal

Make interrupted local build sessions understandable and recoverable without
introducing the elaborate recovery protocol deferred by the personal-project
scope. The command should explain stale locks and run records, then require an
explicit operator choice before any ownership or workspace change.

## Acceptance criteria

- A repo-local command such as `bin/recover <task-id>` lists the task's local
  run records, lock/owner state, exact worktree, Herdr workspace/pane, process
  or session identity when available, and last known failure.
- It distinguishes active, completed, interrupted, stale, ambiguous, and
  missing records and provides a concrete next action for each state.
- Inspection is read-only by default. Recovery never infers ownership from a
  PID, pane focus, or pane order alone and never silently deletes a worktree,
  stops a shared Herdr server, reclaims another run, or discards dirty work.
- Any supported reclaim/quarantine/retry operation requires an explicit
  task-scoped confirmation and validates the complete owner/worktree/run
  identity before changing state.
- Recovery state transitions and failures are recorded with redacted output;
  no credentials, child media, environment dumps, or arbitrary command text
  are persisted.
- Tests use fake records and Herdr/process adapters and cover active ownership,
  stale ownership, ambiguity, interrupted launch, dirty worktree refusal,
  retry, and safe no-op behavior.

## Verification

- Run recovery tests with no real Herdr server or process termination.
- Exercise read-only inspection against disposable `tmp/` records.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

Keep this deliberately smaller than the durable Herdr recovery design in Task
014. The personal workflow needs clear recovery guidance, not a distributed
ownership protocol.
