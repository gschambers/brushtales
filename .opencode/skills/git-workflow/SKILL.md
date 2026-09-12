---
name: git-workflow
description: Git conventions for BrushTales — Conventional Commits, feature branches, worktrees, PR-first delivery, and safe Git operations.
---

# Git workflow

Use this skill whenever a task creates, edits, commits, branches, merges, rebases, or prepares a pull request for BrushTales.

## Safety rules

1. Inspect `git status --short --branch` and the relevant diff before changing history.
2. Never run `git reset --hard`, `git clean`, `git checkout -- <path>`, broad deletion, or force-push unless the user explicitly authorizes that exact operation and scope.
3. Never commit secrets, tokens, private keys, `.env` files, generated credentials, child camera frames, child voice recordings, or local machine data. Check staged paths and the staged diff before committing.
4. Do not create commits, tags, merges, or pushes unless the user explicitly requests that action in the current task. Preparing a commit or PR description is not permission to publish it.
5. Never rewrite shared remote history. Prefer a new corrective commit over amending or rebasing a branch that others may use.
6. Preserve unrelated user changes. Do not reset, stash, overwrite, or reformat files outside the requested scope.

## Repository and branch rules

- The protected integration branch is `main`. Do not commit directly to it for feature, fix, research, refactor, or workflow work. The initial repository bootstrap was the only exception.
- Create branches from an up-to-date `main` using one of these prefixes:
  - `feat/<short-kebab-name>` — user-facing capability
  - `fix/<short-kebab-name>` — bug correction
  - `docs/<short-kebab-name>` — documentation-only work
  - `research/<short-kebab-name>` — research or discovery
  - `spike/<short-kebab-name>` — time-boxed technical investigation
  - `chore/<short-kebab-name>` — maintenance/tooling
  - `release/<version>` — release preparation
- Keep branch names lowercase, short, and focused on one outcome. Do not use issue titles verbatim when they are long or contain sensitive information.
- Keep branches small and short-lived. One branch should normally map to one reviewable change.
- Before branching, check the current branch and worktree. Do not switch branches if it would strand or overwrite uncommitted work.
- Branch protection should require pull requests, passing CI, and at least one review before merging to `main`. Configure this on the hosting service; local Git cannot enforce remote protection.
- Use one worktree per planning task. The main checkout is for orchestration and coordination, not application implementation.

## Conventional commits

Use the Conventional Commits format:

```text
<type>(<optional scope>)<optional !>: <imperative summary>

<body explaining why, when useful>

<footer such as Fixes #123 or BREAKING CHANGE: ...>
```

Allowed types for this project are:

- `feat` — a user-facing capability;
- `fix` — a user-facing bug fix;
- `docs` — documentation only;
- `research` — research notes or discovery artifacts;
- `test` — tests without production behavior change;
- `refactor` — behavior-preserving code restructuring;
- `perf` — performance improvement;
- `chore` — maintenance and tooling;
- `build` — dependencies or build system; and
- `ci` — automation and workflow configuration.

Commit guidance:

- Use a specific, imperative, lowercase summary and keep it concise; for example, `feat(session): add pause and resume states`.
- Explain motivation and user impact in the body when the change is not self-evident.
- Use `!` or a `BREAKING CHANGE:` footer only when the public behavior or contract truly breaks.
- Keep each commit coherent and reviewable. Do not mix formatting churn, unrelated cleanup, or generated artifacts into a behavioral change.
- Include the appropriate `changelog/` entry for an actual product change, and put research-only material in `research/`.
- Treat `planning/*.md` as canonical task content and update `planning/index.sqlite3` when planning metadata changes.
- Include the planning task reference in the commit body, for example `Task: planning/001-provision-expo-shell.md`.

SemVer interpretation for future releases: `fix`/`perf` are generally patch-level, `feat` is generally minor-level, and a breaking change is major-level. Confirm release policy before tagging.

## Pre-push rebase guard

Before every push, including a re-push after review, update the feature branch from `origin/main`. Use the validated task helper from the main checkout: `bash planning/worktree-git.sh <task-id> rebase`. It fetches `origin/main`, rebases only when the branch does not already contain it, and uses `GIT_EDITOR=true` for non-interactive execution.

Never merge `main` into a feature branch merely to update it. Never force-push a branch with human approvals. If a rebase rewrites only your own unapproved work, use `--force-with-lease` only after explicit user approval.

## Before committing

Run the repository’s available checks, then inspect exactly what will be committed:

```sh
git status --short
git diff --check
git diff --stat
git diff -- <paths>
git diff --cached --check
git diff --cached --name-status
git diff --cached
```

Stage explicit paths rather than using `git add .` when unrelated or generated files may exist. Confirm the commit contains no secrets or accidental deletions. If tests, lint, typecheck, or build commands do not exist yet, report that clearly.

## Pull requests

PR titles should use the same Conventional Commit style as commits, for example `feat(session): make brushing progress shape story branches`.

Every PR should state:

1. **Summary** — what changed and why;
2. **Scope** — what is deliberately not included;
3. **Task** — the planning task path and relevant task metadata;
4. **Verification performed** — exact commands and physical-device coverage, or why a check could not run;
5. **Adversarial review** — blocking/major findings fixed and any minor/nit remainder;
6. **Privacy/safety** — camera, audio, child-data, permissions, and fallback implications;
7. **Screenshots/audio/video** — when UI or interaction changes need review; and
8. **Risks and rollout** — known limitations, migration needs, and follow-up tasks.

Keep the PR focused, link the relevant planning task, and call out changes to story content or narration assets. Request review from the appropriate code/content/privacy owners. Do not merge a PR with failing required checks or unresolved safety/privacy concerns.

Prefer squash merging focused feature branches into `main` unless the repository later adopts a different documented policy. Delete the merged remote branch only after confirming it is no longer needed.

## GitHub CLI

If `gh` is installed and the user asks to open a PR, verify the current remote, branch, and authentication state before using it. Otherwise, prepare the PR title and body in the response without claiming that a PR was created. Never paste credentials into commands or files.
