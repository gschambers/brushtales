---
name: verification
description: Verification gates for BrushTales — planning integrity, TypeScript tests, Expo builds, and physical-device checks.
---

## When to load me

Load this skill after adversarial review passes and before a batch is committed or a pull request is opened.

## Gate selection

Inspect the repository’s package scripts before running commands. Use configured scripts rather than inventing command names. Any available gate that is relevant to the changed files must pass.

### Coordination-only changes

- `bash planning/verify-index.sh` — validates SQLite integrity, bidirectional task-file coverage, dependency foreign keys, task IDs, sequence uniqueness, and label links.
- Check `git diff --check`.
- Run `opencode2 debug config` and `opencode2 debug agents` when `.opencode/` changes. Confirm `orchestrator`, `builder`, and `adversary` have the expected modes, confirm the built-in `build` agent is disabled, and inspect the discovered command/skill paths directly. The current CLI does not provide an `opencode2 debug skill` subcommand.

### Application changes

Run the project’s configured typecheck, lint, unit-test, and build commands. Once the Expo app exists, the expected gates should include the repository’s equivalents of:

- TypeScript typecheck
- Unit tests for timer, story, score, profile, and interruption behavior
- Lint/format checks
- Expo/native build or export checks where applicable

Do not claim a gate ran when the command or app does not exist yet; report it as unavailable and explain why.

### Physical-device checks

Camera, wake-lock, audio interruption, permissions, and accessibility behavior require a recent iOS device and Android device before v0 is considered ready. Record device coverage and known limitations in the PR.

## E2E and temporary resources

- Use OS-assigned ports; never assume fixed development ports in verification harnesses.
- Use an ephemeral database or scratch database under `tmp/`/`.tmp/`; never use a development database for tests.
- Keep harnesses, logs, screenshots, and temporary assets out of source directories.
- Keep disposable planning fixtures, adversarial probes, and run-scoped verification artifacts under the git-ignored `tmp/` directory; recreate missing scratch files during the run instead of indexing them in `planning/index.sqlite3`. The task-009 isolation fixture is run-scoped evidence only and is not expected in a fresh checkout.
- Clean temporary resources after verification.

## Pass/fail criteria

Any applicable verification failure is a hard stop. A batch is not green until the failing gate is fixed or the user explicitly accepts the documented limitation.

## Output format

```text
## Verification

| Gate | Status |
|------|--------|
| planning/index | ✅ / ❌ / n/a |
| typecheck | ✅ / ❌ / n/a |
| tests | ✅ / ❌ / n/a |
| build | ✅ / ❌ / n/a |
| physical devices | ✅ / ❌ / n/a |

Result: **PASS** / **FAIL**
```
