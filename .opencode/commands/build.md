---
description: BrushTales delivery loop — plan, delegate, red-green build, adversarial review, verify, and prepare a PR.
agent: orchestrator
---

You are starting a BrushTales `/build` run. `$ARGUMENTS` is a planning task ID such as `001`, a task path, a description, or empty.

## Step 0 — Load skills

Load `git-workflow`, `worktree-workflow`, `red-green-delivery`, `adversarial-review`, and `verification` with the `skill` tool.

## Step 1 — Resolve the task

- For a numeric ID, normalize it to the three-digit task ID and run `bash planning/resolve-task.sh <id>` from the repository root. Parse the resolver's pipe-delimited row and take its `path` field; do not glob for a task or trust a caller-supplied path. Resolve that repository-relative SQLite-selected path against the already validated repository root (for example, `resolve_existing "$REPO_ROOT/$TASK_INDEX_PATH"`), then realpath-resolve it and require the result to equal `TASK_REAL`, the realpath-resolved task path used for the run. Never pass the resolver's relative `path` field directly to an absolute-path resolver.
- For a task path, take only the three-digit prefix from a basename matching `NNN-*.md`, then run the same SQLite resolver and realpath comparison. Reject paths that do not normalize to exactly one task ID, whose realpath differs from SQLite's canonical path, or for which any other `planning/<id>-*.md` candidate exists (including a symlink resolving outside the canonical file). Perform these checks before opening a workspace, creating panes, or making delegated edits.
- The resolver output is repository-relative, so resolve it against the same validated repository/main root used to invoke `planning/resolve-task.sh`; a missing, malformed, or multiply matching row is fatal. The outer `/build 009` command owns resolution, worktree creation, and the delegation spec. Herdr must launch a direct builder/OpenCode child in the validated feature worktree with the absolute worktree and spec paths; that child must not recursively invoke `/build 009`. The outer orchestrator remains responsible for adversarial review, verification, planning metadata, and the approval pause.
- For a description or empty argument, pause and ask the user to approve a specific new task before creating or selecting work. Do not silently invent planning metadata.
- Confirm dependencies and priority before starting. Do not work on a blocked task.

## Step 2 — Create the isolated worktree

This command must start from the main checkout, not an existing `.worktrees/<task-id>` directory. Resolve its absolute root with `git rev-parse --show-toplevel`, reject roots nested under `.worktrees/`, fetch `origin/main`, and create the absolute worktree path `<root>/.worktrees/<task-id>` with a branch named `<type>/<task-id>-<slug>`. Do not implement application code in the main checkout.

## Step 3 — Write the delegation spec

Create `<root>/.worktrees/<task-id>/tmp/build-<timestamp>-<task-id>.md` in the feature worktree with the planning task, acceptance criteria, the absolute worktree path, exact files or areas to touch, failing test, privacy/safety constraints, and exact verification commands. Pass that absolute path explicitly to the builder; do not rely on the builder guessing which checkout contains the spec.

## Step 4 — Builder executes red-green

Delegate the spec to `builder` in the feature worktree directory. OpenCode V2.0.2 child sessions do not expose a working-directory parameter, so do not invoke the builder from the main checkout when it would inherit that directory. Stop and ask the user to launch a builder session with `opencode2 --prompt '<delegation spec path and objective>' '<absolute worktree path>'`, then have the builder verify its checkout before editing. Never fall back to the main checkout. The builder must load `red-green-delivery`, capture RED proof, implement the smallest GREEN change, and return the diff and command output.

## Step 5 — Adversarial review

Delegate the resulting diff to `adversary` with **both** the absolute feature-worktree path and the absolute delegation-spec path created in Step 3. Start a fresh independent adversary conversation for every review; do not reuse the builder session or a prior review session by default. The orchestrator owns the run-scoped ledger under `tmp/`: after each builder/adversary report it records stable IDs, evidence, disposition, and re-review state; agents read and reference the ledger but never edit it. Never allow either path to resolve against a different checkout. For a reviewer launched from the main checkout, keep these executable review targets relative to that checkout: `git -C .worktrees/<task-id> diff` for unstaged changes, `git -C .worktrees/<task-id> diff --cached` for staged changes, and `git -C .worktrees/<task-id> diff origin/main...HEAD` for committed changes. Also enumerate and read every untracked path reported by `git -C .worktrees/<task-id> status --short --untracked-files=all`; Git diff commands omit untracked files. When the reviewer cwd is already the feature worktree, use the absolute equivalents (`git -C <absolute-feature-worktree> diff`, `git -C <absolute-feature-worktree> diff --cached`, `git -C <absolute-feature-worktree> diff origin/main...HEAD`, and `git -C <absolute-feature-worktree> status --short --untracked-files=all`) and pass the same absolute delegation-spec path. If an absolute-path Git command is denied by session policy, do not claim certification: launch the reviewer rooted at main with the relative `.worktrees/<task-id>` targets, or obtain safe `git -C` access first. The adversary must load `adversarial-review`, repeat the full review matrix, report blocking/major/minor/nit findings, and never edit. Have the builder address findings and repeat the full review until no blocking or major findings remain.

### Required detailed review handoff

Every review cycle must produce an ignored, run-scoped Markdown handoff at
`tmp/adversarial-review-<task-id>-<cycle>-findings.md`. The handoff is required
even when there are no findings and must include, for every stable finding ID:
severity; exact file/line evidence; acceptance-criteria mapping; reproduction
or probe output; impact; recommended fix; review-cycle identifier; verified criteria;
and unavailable verification gates. Builders must read and cite the
handoff before fixing findings. Follow-up adversaries must read and cite the
latest handoff, repeat the complete matrix, and add targeted probes for every
fix. The compact `tmp/adversarial-ledger-<task-id>.md` is summary-only; the
orchestrator must reconcile it against the detailed handoff with evidence,
disposition, and re-review status and must never treat a summary row as review
evidence by itself. Preserve each detailed handoff for the run; do not replace
it with a compact report.

## Scope-aware review

Review findings must stay within the planning task's declared scope and threat
model. If a finding would materially over-engineer a personal utility beyond
that scope, document and dismiss it with rationale in the run-scoped handoff,
then start a fresh review with the clarified scope; do not silently redefine
the task.

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
