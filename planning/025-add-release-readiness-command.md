# 025 — Add a release readiness command

- **Status:** todo
- **Priority:** low
- **Summary:** Add a human-gated release readiness command for final checks and PR preparation.
- **Labels:** developer-experience, release, tooling, workflow
- **Depends on:** 022, 023, 024

## Goal

Provide one lightweight `/release <version>` workflow for the point when the
mobile app is ready to ship. It should run the applicable checks, prepare
release material, and stop at every publication boundary instead of pretending
that a personal project needs a full release platform.

## Acceptance criteria

- `/release <version>` validates the version format, clean/expected worktree
  state, planning/Issue link, changelog state, and available verification
  commands before preparing anything.
- It runs the applicable formatting, lint, typecheck, unit, build, and device
  gates, clearly distinguishing pass, fail, unavailable, and not-applicable
  results. It does not invent physical-device verification.
- It prepares a concise release checklist, changelog/release-note draft, PR
  summary, task/Issue links, verification evidence, known risks, and privacy
  notes. The `release-readiness` skill defines this checklist.
- It pauses for explicit user approval before commit, push, PR creation, tag,
  GitHub release, merge, store upload, or deployment. It never merges or
  publishes automatically.
- Any GitHub mutation uses the filtered runner and records only redacted,
  task-scoped output. No credentials, child media, or environment dumps enter
  release artifacts.
- Tests cover unavailable gates, failed gates, dirty state, invalid versions,
  missing Issue links, approval refusal, retry, and successful dry-run output.
- No separate release agent is introduced; the orchestrator uses the command
  and skill with the existing builder/adversary/verification roles.

## Verification

- Run the command in dry-run mode against a fixture project and fake GitHub
  adapter.
- Confirm every publication boundary pauses for approval.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

Keep this intentionally modest until the app has a real distributable build.
Store publishing, signing, deployment, and release automation are future scope.
