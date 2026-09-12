---
description: BrushTales delivery loop — plan, delegate, red-green build, adversarial review, verify, and prepare a PR.
agent: orchestrator
---

You are starting a BrushTales `/build` run. `$ARGUMENTS` is a planning task ID such as `001`, a task path, a description, or empty.

## Step 0 — Load skills

Load `git-workflow`, `worktree-workflow`, `red-green-delivery`, `adversarial-review`, and `verification` with the `skill` tool.

## Step 1 — Resolve the task

- For a numeric ID, normalize it to the three-digit task ID and run `bash planning/resolve-task.sh <id>` to resolve the matching `planning/NNN-*.md` file.
- For a task path, take only the three-digit prefix from a basename matching `NNN-*.md`, then resolve and read the canonical path from SQLite. Reject paths that do not normalize to exactly one task ID.
- For a description or empty argument, pause and ask the user to approve a specific new task before creating or selecting work. Do not silently invent planning metadata.
- Confirm dependencies and priority before starting. Do not work on a blocked task.

## Step 2 — Create the isolated worktree

This command must start from the main checkout, not an existing `.worktrees/<task-id>` directory. Resolve its absolute root with `git rev-parse --show-toplevel`, reject roots nested under `.worktrees/`, fetch `origin/main`, and create the absolute worktree path `<root>/.worktrees/<task-id>` with a branch named `<type>/<task-id>-<slug>`. Do not implement application code in the main checkout.

## Step 3 — Write the delegation spec

Create `<root>/.worktrees/<task-id>/tmp/build-<timestamp>-<task-id>.md` in the feature worktree with the planning task, acceptance criteria, the absolute worktree path, exact files or areas to touch, failing test, privacy/safety constraints, and exact verification commands. Pass that absolute path explicitly to the builder; do not rely on the builder guessing which checkout contains the spec.

## Step 4 — Builder executes red-green

Delegate the spec to `builder` in the feature worktree directory. OpenCode V2.0.2 child sessions do not expose a working-directory parameter, so do not invoke the builder from the main checkout when it would inherit that directory. Stop and ask the user to launch a builder session with `opencode2 --prompt '<delegation spec path and objective>' '<absolute worktree path>'`, then have the builder verify its checkout before editing. Never fall back to the main checkout. The builder must load `red-green-delivery`, capture RED proof, implement the smallest GREEN change, and return the diff and command output.

## Step 5 — Adversarial review

Delegate the resulting diff to `adversary` with the relative feature-worktree path `.worktrees/<task-id>` and all executable review targets: `git -C .worktrees/<task-id> diff` for unstaged changes, `git -C .worktrees/<task-id> diff --cached` for staged changes, and `git -C .worktrees/<task-id> diff origin/main...HEAD` for committed changes. Also enumerate and read every untracked path reported by `git -C .worktrees/<task-id> status --short --untracked-files=all`; Git diff commands omit untracked files. If the adversary cannot be launched in or safely target the feature worktree, stop and ask the user to launch it with `opencode2` rooted there. The adversary must load `adversarial-review`, report blocking/major/minor/nit findings, and never edit. Have the builder address findings and repeat the review until no blocking or major findings remain.

## Step 6 — Verify

Load `verification` and run every applicable gate. Any failure is a hard stop.

## Step 7 — Update planning metadata

Only after the batch is verified should the orchestrator update the task Markdown and SQLite status, notes, and timestamps **inside the feature worktree** so those updates are part of the pull request. From the main checkout, rerun `bash .worktrees/<task-id>/planning/verify-index.sh` and `git -C .worktrees/<task-id> diff --check`. Keep the Markdown canonical and the database indexed.

## Step 8 — Prepare, then pause

Prepare a Conventional Commit message and PR body containing the task path, summary, RED proof, GREEN proof, verification results, adversarial-review remainder, privacy/safety notes, risks, and scope. Pause for explicit user confirmation before using `bash planning/worktree-git.sh <task-id> rebase`, `add ...`, `commit ...`, `push`, or `gh pr create`; direct Git commit/push commands from the main control plane are not permitted.

## Rules

- Never edit application code directly from the orchestrator.
- Never skip red-green delivery or adversarial review for an implementation batch.
- Never commit directly to `main` after the initial bootstrap.
- Never claim device verification without testing on the stated physical devices.
