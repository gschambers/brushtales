---
description: Adversarial review of a BrushTales working-tree or task diff.
agent: adversary
subagent: true
---

You are starting a BrushTales `/review` run. `$ARGUMENTS` may be empty or a planning task ID.

## Steps

1. Load the `adversarial-review` skill.
2. Require invocation from the main checkout: resolve the root with `git rev-parse --show-toplevel` and reject a root under `.worktrees/`. Determine the review target: empty means inspect unstaged and staged changes in the current worktree plus every untracked path from `git status --short --untracked-files=all`; a planning task ID means normalize it to three digits, resolve exactly one matching path from `git worktree list --porcelain` under `.worktrees/<task-id>`, and inspect its unstaged diff, staged diff, committed `origin/main...HEAD` diff, and every untracked path from `git -C .worktrees/<task-id> status --short --untracked-files=all`. Fail rather than guessing if the task worktree is missing or ambiguous.
3. Review every changed file and code path against the task, `AGENTS.md`, privacy/safety rules, tests, and workflow rules.
4. Report findings as blocking, major, minor, or nit.
5. Do not modify application or durable coordination files, fix findings, stage
   changes, commit, or push. Disposable probes may be written under ignored
   `tmp/` and run against the review target.

Use the output format defined by `adversarial-review`.
