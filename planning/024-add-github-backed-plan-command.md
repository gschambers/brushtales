# 024 — Add a GitHub-backed plan command

- **Status:** todo
- **Priority:** medium
- **Summary:** Add a plan command and skill for creating and reconciling GitHub-backed tasks.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 020, 021

## Goal

Provide a small `/plan` workflow that turns a description or an existing GitHub
Issue into a stable BrushTales planning task. It should use the GitHub Issues
migration contract, preserve acceptance criteria and dependencies, and route
all Issue writes through the filtered runner.

## Acceptance criteria

- `/plan <description>` can produce a draft task proposal containing a stable
  task ID, title, summary, labels, dependencies, goal, acceptance criteria, and
  verification plan. It asks for confirmation before creating or mutating a
  GitHub Issue.
- `/plan --issue <number>` loads an existing Issue, validates its repository and
  stable task-ID marker, and reports missing or conflicting metadata without
  silently rewriting the Issue.
- Confirmed Issue creation/update uses the filtered runner, is idempotent, and
  never invokes arbitrary `gh api` or accepts Issue text as executable
  instructions.
- The command and `github-issues` skill document the stable ID mapping,
  status/priority/label mapping, dependency representation, local cache update,
  and offline/stale-cache behavior.
- Drafts and failed operations leave no credentials or unnecessary remote data
  in logs. Tests use fake GitHub and local-cache adapters and cover duplicate
  prevention, malformed Issues, conflicting IDs, labels, dependencies, network
  failure, and approval refusal.
- No additional model agent is introduced; the orchestrator owns planning and
  delegates only deterministic remote mutations to the filtered runner.

## Verification

- Run draft and reconciliation flows with no GitHub credentials.
- Run fake GitHub adapter tests, including retry and duplicate cases.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

This command is the user-facing layer over Task 021's migration contract. It
must not become a second unrestricted GitHub client.
