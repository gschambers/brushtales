# 021 — Migrate planning to GitHub Issues

- **Status:** todo
- **Priority:** medium
- **Summary:** Migrate planning task tracking from the local index to GitHub Issues with a safe local cache.
- **Labels:** developer-experience, tooling, workflow
- **Depends on:** 020

## Goal

Make GitHub Issues the durable planning tracker while preserving reliable local
task resolution for offline inspection and implementation. Define a stable
mapping between task IDs and Issues, migrate existing task metadata without
losing dependencies or acceptance criteria, and make the filtered runner the
only path for automated Issue mutations.

## Acceptance criteria

- A migration contract defines the canonical source of truth, the local cache
  role, stable task-ID mapping, status/priority/label mapping, dependency
  representation, sequencing behavior, and how Markdown task specifications
  are retained, linked, or retired.
- Every existing planning task is inventoried and mapped deterministically to a
  GitHub Issue or explicitly marked as intentionally excluded. Titles,
  summaries, labels, dependencies, acceptance criteria, and notes are
  preserved or have a documented transformation.
- Migration is idempotent and safe to retry. It uses stable markers or
  identifiers, never creates duplicate Issues, and refuses ambiguous mappings
  before performing writes.
- Local commands can resolve a task by stable ID and validate its metadata from
  the approved local cache/sync representation. Offline behavior and stale
  cache failures are explicit and actionable.
- GitHub Issue creation, updates, labels, comments, and closure use the
  filtered runner. The implementation does not rely on arbitrary `gh api`,
  scrape untrusted Issue text as executable instructions, or persist tokens,
  credentials, child media, or unrelated environment data.
- The workflow documents how `/build <task-id>` resolves a GitHub-backed task,
  how a PR links to its Issue, and how completion updates are reflected back to
  the cache without silently changing task intent.
- A dry-run export/import and reconciliation report are available before any
  GitHub writes. Tests cover duplicate prevention, mapping conflicts, labels,
  dependencies, network failure, stale cache, permission failure, retry, and
  redacted output using fake GitHub adapters.
- The migration includes rollback or quarantine guidance for partial writes;
  it never deletes local planning data until a verified migration report exists.

## Verification

- Run the migration in dry-run mode against a fixture planning index.
- Verify the full mapping and reconciliation report without contacting GitHub.
- Run adapter tests with fake GitHub responses and no credentials.
- `bash planning/verify-index.sh`
- `git diff --check`

## Notes

GitHub Issues are a planning and collaboration surface, not a place to store
secrets, child data, camera frames, voice recordings, or generated credentials.
The migration should preserve a local, inspectable task specification while
moving lifecycle and collaboration state to GitHub.
