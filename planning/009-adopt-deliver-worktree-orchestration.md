# 009 — Evaluate and adopt deliver worktree orchestration

- **Status:** todo
- **Priority:** critical
- **Summary:** Evaluate and adopt the repo-local deliver CLI for safe task worktrees and herdr-managed sessions.
- **Labels:** workflow, tooling, developer-experience
- **Depends on:** none

## Goal

Work out how BrushTales can use the repo-local `deliver` CLI and herdr workspace
management from `~/Projects/repro-dev/repro` to run delegated builds without
requiring the orchestrator to manually launch a second OpenCode session in a
feature worktree.

## Proposed delivery flow

The reference flow is:

1. Resolve the planning issue/task.
2. Define a branch name from the task.
3. Create the task worktree from the current integration branch.
4. Create a herdr workspace rooted at that worktree.
5. Open a `70:30` two-pane workspace: OpenCode in the larger first pane and a
   terminal in the second.
6. Run `npm install` or the equivalent package-manager setup in the terminal pane
   (including any other project provisioning phases required by the app stack).
7. Inject the initial `/build` command and send it into the OpenCode session.

The adoption plan must account for the fact that BrushTales does not currently
have herdr configured. Investigate adding the herdr CLI to the project Brewfile,
and determine how a standalone herdr server should run for this working directory
without becoming an application runtime dependency. Document server lifecycle,
workspace naming/cleanup, readiness checks, and behavior when the server or
package installation fails.

## Acceptance criteria

- The `deliver` CLI and its herdr integration are inspected in the reference
  repository, including their command contract, worktree lifecycle, session
  launch behavior, and failure/recovery paths.
- The current BrushTales `/build` workflow is mapped step-by-step to the proposed
  `deliver` workflow, with gaps and incompatibilities called out explicitly.
- The plan covers herdr bootstrapping for this project: Brewfile installation,
  standalone server startup and readiness, worktree-scoped workspace creation,
  cleanup, and failure recovery.
- The plan defines how package-manager detection and dependency installation run
  before the initial OpenCode turn, including setup phases needed once the Expo
  project is provisioned.
- The plan defines the pane layout and session handoff: OpenCode receives the
  absolute task/spec context in the `70:30` workspace, while the terminal pane is
  available for installation, build, and verification commands.
- A recommendation documents the smallest repo-local adoption: files/configuration
  to add or change, invocation examples, required environment assumptions, and
  how builder and adversary sessions receive an absolute worktree/spec path.
- The design preserves BrushTales delivery invariants: no application edits from
  the orchestrator, no direct-to-main delivery, explicit approval for rebase/add/
  commit/push/PR operations, adversarial review for every implementation batch,
  and no persistence or upload of child camera frames or audio recordings.
- A verification plan demonstrates the adopted flow with a disposable planning
  or fixture task, proves the main checkout remains untouched during delegated
  edits, and reports unavailable external-device or workspace prerequisites rather
  than claiming success.
- The task records whether adoption should be implemented in this repository,
  upstreamed to the reference tooling, or deferred, with follow-up planning tasks
  if needed.

## Notes

This is a workflow/tooling investigation, not an application feature. Do not add
provider credentials, analytics, backend services, or child data handling. Keep
the reference repository unchanged unless a separately approved upstream task is
created.
