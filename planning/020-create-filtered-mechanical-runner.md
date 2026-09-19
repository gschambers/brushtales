# 020 — Create a filtered mechanical runner

- **Status:** todo
- **Priority:** high
- **Summary:** Create a deterministic filtered runner for validated Git, Herdr, and GitHub operations.
- **Labels:** security, tooling, workflow
- **Depends on:** 019

## Goal

Create a deterministic, auditable execution boundary for mechanical developer
operations. The runner must accept structured operations rather than arbitrary
shell strings and must enforce the repository, worktree, Herdr, and GitHub
scope before invoking a fixed command.

The runner is a safety boundary implemented in code, not another model agent
trusted to interpret a prompt. OpenCode permissions and
`opencode-auto-permissions` remain useful surrounding controls but are not the
runner's enforcement mechanism.

## Acceptance criteria

- The runner exposes a versioned operation schema with explicit operations for
  safe Git inspection/fetch/worktree setup, validated Herdr discovery and pane
  submission, and approved GitHub Issue/PR inspection or mutation.
- It rejects arbitrary shell strings, command substitution, pipelines,
  redirects, unapproved environment assignments, unknown operations, unknown
  arguments, and paths outside the canonical checkout or exact task worktree.
- Every operation validates canonical repository identity, task ID, exact
  worktree registration, branch and cleanliness requirements, and any required
  Herdr workspace/pane identity before execution.
- GitHub operations target the configured repository explicitly. Issue writes
  require a structured approval record or user approval token; arbitrary
  `gh api`, credential, secret, workflow-cancellation, merge, force-push, and
  destructive operations are rejected.
- Worktree acquisition and GitHub Issue mutation use crash-safe ownership or
  idempotency keys so retries cannot create duplicate worktrees, sessions, or
  planning Issues.
- Output is structured and redacted. It never records credentials, full
  environment dumps, child media, camera frames, voice recordings, or arbitrary
  command text supplied by an agent. Failures include safe recovery guidance.
- The runner has no subagent authority and cannot broaden its own allowlist.
  Its tests use fake subprocess, Herdr, and GitHub adapters; no shared Herdr
  server, real GitHub mutation, user-global configuration, or credentials are
  touched.
- Tests cover valid operations, malformed schemas, path/symlink confinement,
  task/worktree mismatch, lock contention, stale ownership, retries,
  interruption, subprocess failure, Herdr targeting, GitHub write approval,
  redaction, and refusal of arbitrary shell/API access.

## Verification

- Run the runner unit and contract tests with all external adapters mocked.
- Run disposable confinement probes under ignored `tmp/`.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

Task 015 evaluates stronger OS-level sandboxing separately. This runner must
not claim to be an OS sandbox; it is an application-level command and scope
filter that preserves the existing branch, worktree, review, and approval
controls.
