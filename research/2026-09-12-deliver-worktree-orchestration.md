# Deliver/worktree orchestration research

**Date:** 2026-09-12
**Status:** Complete for the task-009 design recommendation; adapter implementation
and executable recovery validation remain separately approved follow-up work.

## Sources

- Local reference checkout: [`repro`](file:///Users/gary/Projects/repro-dev/repro),
  especially `bin/deliver`, `scripts/deliver.sh`, `scripts/reproctl.sh`, the
  reference `Brewfile`, and its temporary deliver notes.
- [Git worktree documentation](https://git-scm.com/docs/git-worktree) — branch
  and worktree lifecycle semantics.
- [Git status porcelain format](https://git-scm.com/docs/git-status#_porcelain_format_version_1)
  — machine-readable status and NUL-delimited path handling.
- [Homebrew Bundle and Brewfile](https://docs.brew.sh/Brew-Bundle-and-Brewfile)
  — developer-tool installation from a repository Brewfile.

## Findings

The reference `deliver` flow combines task lookup, worktree creation, Herdr
workspace setup, pane splitting, dependency installation, and OpenCode prompt
handoff. Its issue/PR selectors, Linear dependency, implicit branch pushes,
reference package-manager assumptions, and optional fire-and-forget install do
not map directly to BrushTales. BrushTales instead resolves local planning task
IDs, creates `.worktrees/<task-id>` from an updated integration branch, keeps
the main checkout as the orchestration control plane, and pauses for explicit
publication approval.

Herdr is host developer tooling rather than an Expo dependency. A future adapter
must use the supported host-terminal startup procedure, poll server readiness,
reuse workspaces only by exact resolved worktree path, preserve opaque IDs, and
avoid stopping shared servers. Workspace ownership, provisioning results, lock
recovery, and transfer/reconcile mutations require durable, path-safe records;
recovery must use one atomic intent journal with replay/rollback rather than
independent state mutations.

The current repository has no Expo/package manifest or lockfile, so dependency
provisioning is unavailable until the Expo shell establishes an authoritative
package manager and lockfile. The task-009 isolation fixture lived only at ignored
`tmp/009-isolation-fixture.py` for the follow-up run and is not expected in a
fresh checkout. It validates only the future adapter's fake operation fence and
main-checkout snapshot; it
cannot certify Herdr, lock recovery, or arbitrary child-code sandboxing. The
follow-up run obtained PASS main snapshot unchanged and PASS 009 deterministic
contract fixture: 1 valid operation; 31 operation rejections; fake runner
invocations=1 (the separate snapshot-symlink preflight rejection is reported
independently).

## Decision

Adopt the workflow as documented local policy only. Do not copy the reference
`deliver` implementation, add a BrushTales adapter, or change the reference
checkout in task 009. Create and index separately approved follow-up tasks before
assigning IDs or implementing the Herdr host-surface validation, local-task-ID
adapter, provisioning follow-up, or disposable integration/recovery fixture.

## Implication for BrushTales

Keep durable workflow decisions in `planning/*.md` and durable observations in
`research/*.md`. Run-scoped delegation specs, logs, PR drafts, and disposable
verification fixtures belong in the git-ignored `tmp/` directory. A run recreates
missing scratch artifacts; they are not task files and must not be indexed in
`planning/index.sqlite3`.

Keep `/build`, the SQLite-backed local task resolver, existing worktree workflow,
builder/adversary boundary, approval-gated Git publication, and local-only child
data rules as the authority. Treat Herdr/package-manager/device prerequisites as
explicit host-side gates with honest unavailable results. The future adapter
must carry absolute validated worktree/spec paths, never implicitly push, and
must not claim delegated execution or lock-recovery success without executable
command output.
