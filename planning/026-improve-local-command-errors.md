# 026 — Improve local command error messages

- **Status:** todo
- **Priority:** medium
- **Summary:** Make build and next failures human-readable and actionable.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 018

## Goal

Make failures from the local `next` and `build` commands understandable without
opening a JSON run record or reading implementation details. Preserve the
structured run record for diagnostics, but print a concise explanation,
affected paths or task IDs, and the next safe action directly to the terminal.

## Acceptance criteria

- `build` prints a stable human-readable error for each failure stage:
  input parsing, canonical checkout preflight, task validation, batch
  preparation, lock contention, worktree validation/creation, direnv,
  OpenCode/plugin setup, Herdr discovery/launch, local fallback launch, and
  interruption/uncertain ownership.
- Canonical-checkout failures identify the failed invariant and list relevant
  changed paths or state without printing credentials, full environments, or
  child media. Recovery text distinguishes safe retry from inspection or human
  intervention.
- Batch failures identify the affected task ID, whether earlier tasks launched,
  which tasks were not launched, and the run-record path for each relevant
  result. Exit status remains reliable for shell composition.
- `next` prints concise, actionable diagnostics for invalid limits, malformed
  SQLite/Markdown metadata, missing files, dependency/index inconsistencies,
  unavailable planning data, and the no-viable-task case. Quiet mode continues
  to emit only task IDs on success and no stdout on failure.
- Structured run records retain redacted machine-readable detail; terminal
  output never exposes secrets, credentials, arbitrary environment data, child
  media, or unredacted subprocess errors.
- Error wording is covered by focused tests using fake launchers, malformed
  planning fixtures, dirty/invalid canonical roots, lock contention, Herdr
  failure, plugin failure, interruption, and mixed batch outcomes.
- Documentation includes a short recovery table for common failures and does
  not claim that a successful launch means the task implementation succeeded.

## Verification

- `python3 -m unittest discover -s tests -v`
- Exercise `next` and `build` success/failure fixtures from a shell harness.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

This task is intentionally separate from the GitHub Issues migration. Once
planning moves to GitHub, the same terminal error contract should apply to
remote resolution and synchronization failures.
