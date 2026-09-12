---
name: worktree-workflow
description: Isolated Git worktrees for BrushTales tasks, keeping the main checkout as an orchestration control plane.
---

# Worktree workflow

Use this skill when creating, using, reviewing, or removing worktrees.

## Required rules

- Every application implementation task uses its own worktree.
- The main checkout is for orchestration, planning, delegation specs, and verification coordination—not application implementation.
- Create worktrees from a clean main checkout or another clean checkout, never from inside another worktree.
- Use one branch per worktree and keep the worktree alive through review and merge.
- Never run two implementation agents in the same worktree.

## Creation

From the main checkout, run `git fetch origin main` followed by `git worktree add .worktrees/<task-id> -b <type>/<task-id>-<slug> origin/main`.

The `.worktrees/` directory is ignored. Record the absolute worktree path in the delegation spec. Install dependencies independently inside the worktree when the app exists.

## Lifecycle

Use `git worktree list`, `git worktree remove .worktrees/<task-id>`, and `git worktree prune` for inspection and cleanup. Use `bash planning/worktree-git.sh <task-id> rebase`, then `add ...`, `commit ...`, and `push` for approval-gated delivery operations; the helper validates the task ID and worktree path.

Do not remove a worktree before its pull request is merged or the user explicitly abandons the task. Never remove a worktree containing uncommitted work without explicit approval.

## Parallel work

Independent tasks may run in parallel only when each has its own worktree and branch. Each agent receives the worktree path, planning task path, precise objective, failing-test requirement, and verification contract.

Before the builder edits, its child session must be launched with the feature worktree as its working directory. If the active OpenCode runtime cannot bind a child session to that directory, stop and ask the user to open a builder session there; never let the builder proceed from the main checkout. The builder and adversary both verify their checkout with `git rev-parse --show-toplevel` before acting.

## Cross-references

- `git-workflow` — branch naming, rebase guard, commit format, and PR flow.
- `verification` — per-worktree verification and temporary-resource rules.
