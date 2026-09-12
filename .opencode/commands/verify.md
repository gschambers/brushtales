---
description: BrushTales verification gates — planning integrity, tests, builds, and optional physical-device checks.
agent: orchestrator
---

You are starting a BrushTales `/verify` run. `$ARGUMENTS` may be empty, a planning task ID, or `--physical`.

## Steps

1. Load the `verification` skill.
2. Resolve the repository root with `git rev-parse --show-toplevel` and reject a root under `.worktrees/`. If a planning task ID is supplied, normalize it to three digits with `bash planning/resolve-task.sh <id>`, resolve exactly one matching path from `git worktree list --porcelain` under `.worktrees/<task-id>`, and run all checks there; otherwise use the current worktree. Fail rather than guessing if the task worktree is missing or ambiguous. Inspect changed files and the repository’s configured package scripts.
3. Run all applicable gates in the documented order: planning/index integrity for coordination changes; typecheck, lint, tests, and build for application changes; physical-device checks when `--physical` is present or camera/audio/wake-lock behavior changed.
4. Report every gate as pass, fail, or unavailable with the exact command or device coverage.
5. Treat failures as a hard stop. Do not commit or push from verification.

Use the output format defined by `verification`.
