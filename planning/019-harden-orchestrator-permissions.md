# 019 — Harden orchestrator permissions for mechanical GitHub workflows

- **Status:** todo
- **Priority:** high
- **Summary:** Configure safe orchestrator permissions for mechanical Git and GitHub workflow operations.
- **Labels:** developer-experience, security, tooling, workflow
- **Depends on:** 018

## Goal

Replace the current permission deadlock with a deliberate policy for the
orchestrator's mechanical workflow. Routine repository inspection, safe
worktree setup, Herdr control, and read-only GitHub inspection should work
without repeated reviewer failures, while publication, remote mutation, and
destructive operations remain explicitly gated.

The policy must account for GitHub Issues becoming part of the planning
workflow without granting the orchestrator unrestricted `gh` or shell access.

## Acceptance criteria

- The effective permissions for the orchestrator are inspected and tested from
  a fresh OpenCode session; agent-level rules and project-level OpenCode rules
  have documented precedence and do not silently weaken one another.
- Routine local operations are explicitly allowed: repository status/diff/log,
  `git rev-parse`, fetching `origin/main`, safe branch creation, exact
  `.worktrees/<task-id>` listing/creation, and validated Herdr status,
  workspace, pane, and prompt-submission operations.
- Read-only GitHub CLI operations are explicitly allowed or reliably
  non-blocking: `gh auth status`, `gh repo view`, `gh issue list/view`, and
  `gh pr list/view`.
- Issue and PR mutations remain approval-gated: `git add`, commit, push,
  `gh issue create/edit/comment/close/reopen`, and `gh pr create` require an
  explicit approval path. `gh pr merge`, arbitrary `gh api`, credential
  management, force-push, reset, clean, checkout/restore, and deletion remain
  denied.
- The policy does not use a blanket `gh * allow`, blanket destructive Git
  allow, or an unrestricted `shell * allow`.
- `opencode-auto-permissions` remains a contextual reviewer for `ask` rules,
  not the enforcement boundary for hard denies. Its failure behavior produces
  actionable recovery rather than making routine orchestration unusable.
- A policy probe covers allowed, reviewed, denied, and reviewer-failure cases
  using harmless commands and does not access credentials, real GitHub writes,
  child media, or unrelated directories.
- The final policy and recovery guidance are documented in the repository, with
  no user-global configuration mutation required for normal project use.

## Verification

- Inspect effective configuration with the supported OpenCode debug command.
- Run the local permission probe with fake Herdr/GitHub boundaries.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

The orchestrator remains responsible for coordination and delegation, not
application implementation. Publication approval remains a product/workflow
gate even when the command is mechanically routine.
