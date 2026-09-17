# 014 — Implement Herdr run ownership and recovery

- **Status:** todo
- **Priority:** high
- **Summary:** Implement crash-safe ownership, locking, and recovery for project-local Herdr runs.
- **Labels:** developer-experience, qa, tooling, workflow
- **Depends on:** 011

## Goal

Implement the ownership and recovery primitives that make a project-local Herdr
workflow safe to retry after interrupted startup, pane launch, command
execution, or cleanup. The implementation must protect exact project/worktree
identity without ever reclaiming resources from the shared global server or
another BrushTales run.

## Acceptance criteria

- Each run has an owner-bound record containing project root, worktree, Herdr
  server/config identity, workspace ID, run ID, token, and lifecycle state.
- Per-project server/workspace and per-run result locks reject conflicting work,
  treat `acquiring` and `current` records as busy, and never infer ownership
  from a PID, pane order, or global focus alone.
- The per-project server-start lock is acquired before process/socket discovery;
  its owner record binds the canonical main checkout, config path, socket path,
  server instance, owner token, PID/session, lease, and generation. A concurrent
  loser waits for the bounded interval and re-checks that record instead of
  starting a second server. Stale start-lock recovery uses the same explicit
  operator evidence, token/generation fence, quarantine, and `--confirm` rules
  as run recovery; it never guesses from a PID or socket.
- The implementation exposes `brushtales-herdr server reconcile
  --project-root <main> --evidence <absolute-json> --confirm`. It acquires a
  parent recovery lock, validates the canonical root, config path, socket path,
  server instance, owner token, generation, expired lease, and operator proof
  that the recorded process/session is gone, then journals either a safe
  quarantine-and-retry transition or an explicit `manual-reconciliation` result.
  It never accepts a PID or socket as ownership proof by itself and never stops
  a shared server.
- The authoritative server-owner record has the exact schema
  `{project_root, config_path, socket_path, server_instance_id, owner_token,
  owner_pid, session_identity, generation, lease_expires_at, state, updated_at}`;
  server-start claims additionally contain `claim_id` and `claim_started_at`.
  `state` is one of `starting|ready|stopping|stopped|failed|manual-recovery`;
  `server_instance_id` is the identity returned by the validated Herdr status
  protocol, never a guessed PID or socket. A committed owner record is
  published atomically before releasing the start lock, and a stale claim is
  quarantined rather than overwritten. Lock release validates the complete
  project/config/socket/server-instance/owner-token/session/generation tuple,
  not only paths.
- Interrupted or stale runs use one crash-safe transfer/recovery intent journal
  for state transitions, workspace cleanup, result publication, server/workspace
  ownership, and rollback.
- The journal has explicit phases for server ownership, workspace cleanup,
  result publication, quarantine, and rollback; each phase records before/after
  evidence and has deterministic replay and rollback behavior after interruption.
  Lifecycle cleanup and result publication must call this journal rather than
  maintaining a second direct mutation protocol; inapplicable phases are
  recorded as no-ops. The intent stores immutable before/after snapshots for
  server owner, workspace, result, quarantine, fence, and fresh lock, plus an
  append-only JSON phase history; current phase and its history entry are
  published atomically. The snapshots include result, result-lock,
  recovery-lock, server-start-lock, deadline/cancel, quarantine, fence, and
  fresh-lock state. Snapshot digests use SHA-256 over canonical UTF-8 JSON with
  recursively sorted keys, no insignificant whitespace, and no trailing
  newline. A crash between a mutation and phase advancement is resolved by
  matching the live state to the recorded before/after snapshot, never by
  assuming the mutation did or did not happen. Rollback has explicit history
  entries for server, workspace, result, result-lock, deadline/cancel,
  recovery-lock, server-start-lock, transfer, quarantine, fence, and fresh-lock
  restoration, as applicable.
- Reclamation validates project, worktree, run ID, token, generation, and exact
  Herdr path before quarantining or releasing anything; normal callers cannot
  reclaim another run.
- Partial startup, expired leases, missing result records, and failed cleanup
  produce deterministic manual-recovery or retry states without deleting dirty
  worktrees or stopping the shared global Herdr server.
- Tests cover concurrent acquisition, process interruption at each mutation
  phase (including the two-process server-start barrier), replay, rollback,
  quarantine, token mismatch, generation mismatch, and safe refusal of ambiguous
  recovery. They assert one server socket and owner record after concurrent
  startup and verify that every replayed or rolled-back server/workspace/result
  mutation matches its immutable snapshots.
- Recovery tests cover `brushtales-herdr server reconcile
  --project-root <main> --evidence <absolute-json> --confirm`, including stale
  server-start claims, token/generation mismatch, ambiguous live sockets, and
  safe refusal without a destructive fallback.
- Structured logs and recovery commands expose enough redacted evidence for an
  operator to diagnose a run without storing child images, camera frames, voice
  recordings, or credentials.

## Notes

This task owns the recovery implementation referenced by task 011 and consumed
by the workspace-aware adapter in task 012. Keep all state under ignored
project-local developer-tooling storage and preserve the fail-open behavior
specified by task 009.
