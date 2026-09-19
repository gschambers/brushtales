# 022 — Add an environment doctor command

- **Status:** todo
- **Priority:** medium
- **Summary:** Add a read-only doctor command for local build workflow prerequisites.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 019

## Goal

Provide one small diagnostic command that explains why the local planning and
build workflow cannot run. It should make the personal-device setup boring
without silently changing global configuration or trying to repair an
environment it does not own.

## Acceptance criteria

- A repo-local `bin/doctor` or equivalent command reports independent pass,
  warn, and fail results for Git/main state, `gh` authentication, Herdr
  availability, OpenCode version/effective configuration, the
  `opencode-auto-permissions` plugin, direnv, and the filtered runner.
- Each failure includes one actionable recovery instruction and identifies
  whether the fix is repository-local, user-global, or requires human action.
- The command is read-only by default. It never installs software, changes
  user-global configuration, approves `.envrc`, creates worktrees, contacts
  GitHub with a write, or starts Herdr/OpenCode sessions.
- Checks do not print credentials, tokens, full environments, child media, or
  unrelated filesystem contents. GitHub and Herdr output is reduced to safe
  status information.
- Tests use local fake executables and malformed-config fixtures; they cover
  missing tools, unavailable services, invalid effective permissions, blocked
  direnv, and a healthy setup without touching the user's environment.

## Verification

- Run the doctor against healthy and failing local fixtures.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

The doctor may point to setup commands, but setup and repair remain explicit
user actions. This is developer tooling only and is not a new model agent.
