# 009 — Evaluate and adopt deliver worktree orchestration

- **Status:** done
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
7. The reference injects an initial `/build` command, but BrushTales must not use
   that recursive handoff from a feature-worktree pane. The adopted handoff is a
   direct builder/OpenCode child launched in the validated feature worktree with
   the absolute delegation-spec and worktree paths.

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

### Implementation status and scope boundary

This task is a design/adoption investigation. It does **not** implement the
Herdr adapter, `brushtales-herdr workspace reconcile`/`recover`/`abandon`
commands, lock or
recovery runtime, or an application integration. The ownership, reclaimer,
fence, result-lock, and journal material below is a required future-adapter
contract: it specifies behavior that an adapter must implement, but it is not
runtime-proven by this task. Executable lock/recovery validation is explicitly
deferred to the indexed follow-up tasks 010–014. The fixture file only exercises
its fake pre-Herdr path/operation
fence; its passing (or unavailable) output must not be presented as Herdr or
lock-recovery proof.

## Reference observations

The reference repository was inspected at `/Users/gary/Projects/repro-dev/repro` on
2026-09-12. The observations below are from its checked-in scripts, manpages,
Brewfile, temporary deliver test plans/notes, and the installed Herdr CLI (0.8.2).

### `deliver` command contract and worktree lifecycle

- `bin/deliver` is a self-locating wrapper. It records the caller's current
  directory in `CALLER_PWD`, resolves the real script, and executes
  `scripts/deliver.sh`.
- `deliver [options] [<issue-id> | <pr-number> | <branch-name>]` supports Linear
  issue mode (`REP-123`), PR adoption (`--pr N`), prompt/spike mode (`-p
  description`), and bare branch mode. It also accepts `--profile`, `--pick`,
  `--dry-run`, and `--nightshift`. Issue labels route Bug to `/bugfix`, Pen to
  `/pen-reconcile`, and everything else to `/build`; missing Linear or failed
  lookup fails open to `/build`.
- Prompt mode converts the description to a kebab-case branch (or a timestamped
  scratch name) and a title-case workspace label. Bare branch mode validates a
  Git ref and extracts a Linear ID when one is embedded. Numeric positional
  arguments are PR mode, not local planning-task IDs.
- Reference issue mode performs Linear lookup before adoption/create resolution;
  that lookup supplies the issue metadata used by the worktree helper. This is
  distinct from BrushTales task resolution, which is local (see the mapping
  below) and must not require Linear access.
- Issue mode calls `reproctl.sh wt create --from-issue <id> --skip-install
  --no-status-update`, captures the emitted `Path:` line, and falls back to
  `git worktree list --porcelain` if needed. The underlying worktree helper
  fetches Linear metadata, resolves a branch, and chooses **adopt** (existing
  branch plus registered directory), **reattach** (existing branch without a
  directory), or **create** (mint a unique `<branch>-<timestamp-random>` branch
  from latest `origin/main`). Adoption does not mint, fetch, or update Linear;
  reattachment prunes a stale registration before attaching; fresh issue work
  can update Linear to In Progress.
- PR mode fetches `pull/N/head`, creates a local branch and worktree, and attempts
  to push the branch. Bare-branch mode attaches to an existing local branch; if
  the branch is missing, it creates one from the current `HEAD` (which is not
  necessarily the latest `origin/main`), then also attempts to push. This is an
  incompatibility/risk for BrushTales: its required rule is to fetch
  `origin/main` and create the task branch from that updated main, explicitly
  rather than inheriting the caller's current `HEAD`.
  Prompt mode creates from latest `origin/main` when available and attempts to
  push. These implicit pushes are incompatible with BrushTales' approval gate.
- A worktree is placed under the reference workspace root as
  `repro-wt-<slug>`. `reproctl wt create` copies local bootstrap configuration,
  and normally runs `pnpm install` followed by `moon run :build`; `--skip-install`
  defers both. Removal checks tracked/untracked state, cleans worktree services,
  runs `git worktree remove` and `git worktree prune`, and then closes a Herdr
  workspace found for that path. Dirty-worktree removal is interactive or
  requires an explicit force path.

### Herdr installation, server, workspace, panes, and launch

- The reference `Brewfile` contains `brew "herdr"` alongside `jq`, `fzf`, and
  other developer tools. BrushTales had no Herdr entry before this task; the
  smallest local bootstrap change is the developer-tooling entry added above.
- Herdr's agent guide describes it as a persistent local terminal multiplexer:
  a background server owns real terminal processes, while clients attach to a
  session. Its config is `~/.config/herdr/config.toml` (overridable with
  `HERDR_CONFIG_PATH`), logs are in that config directory, and named sessions
  are separate namespaces. It is not an app dependency and must not be bundled
  into an Expo build, runtime, or device image.
- The installed CLI reports `herdr 0.8.2`; its `herdr status [server|client]`
  forms report readiness. `herdr status server` reported `running`,
  version/protocol `0.8.2/20`, and socket
  `/Users/gary/.config/herdr/herdr.sock`. The CLI help exposes `workspace list|
  create|get|focus|rename|report-metadata|close`, `worktree list|create|open|
  remove`, and pane controls. Observed `herdr --help` exposes
  `herdr server stop` but no standalone start subcommand, so startup must follow
  the supported host-terminal procedure below rather than copying an older
  fallback.
 - The agent guide says an ordinary `herdr` invocation launches or attaches to
   the default persistent session and first-run onboarding starts there. That
   procedure is retained only for explicit legacy/shared-server use. The
   project-local adapter instead invokes its owned lifecycle and then polls
  `herdr status server` at a fixed interval until it reports `running` and a
  compatible protocol, with a bounded timeout. If that procedure is unavailable
  or readiness fails, report the prerequisite as unavailable and provide the
  manual recovery path; do not claim a workspace was opened. The CLI exposes
  `herdr server stop` for cleanup, but a run may use it only when it owns a
  dedicated server it started; it must never stop a shared developer server.
- The reference helper `_herdr_workspace_add_sibling` first checks that the
  binary exists and that `herdr status` succeeds (the helper does not
  explicitly invoke the `server` form). A BrushTales adapter may use the
  stronger `herdr status server` check described above. It then reuses an
  already-open workspace for the exact worktree path when
  `herdr worktree list --cwd MAIN --json` finds one. Otherwise it runs:
  `herdr worktree open --cwd <main-checkout> --path <absolute-worktree>
   --label <label> --no-focus --json`, extracts `.result.workspace.workspace_id`,
   and returns that opaque ID. Open failure is fail-open: the Git worktree is
   retained and the caller prints recovery instructions.
- When that reference helper sees a stopped daemon, its recovery text prints
  `herdr start`. This is stale/version-dependent guidance: the observed Herdr
  0.8.2 `herdr --help` has no `herdr start` command. BrushTales must instead
  prescribe the supported ordinary `herdr` invocation from a developer host
   terminal (or a dedicated host pane), then poll `herdr status server`; it must
   not copy the reference's `herdr start` text into a user-facing recovery path.
- The reference `deliver` reads the first pane from
  `herdr pane list --workspace <id>`, then runs
  `herdr pane split --pane <root> --direction right --cwd <worktree> --ratio
  0.7 --no-focus`. Herdr's split ratio sizes the original/first pane, so this
  gives OpenCode about 70% on the left and a terminal about 30% on the right.
  This corrects the earlier `0.3` ratio issue recorded in the reference
  `tmp/deliver-ratio-issue.md`.
- Dependency setup is sent to the terminal pane with
  `herdr pane run <terminal> "cd <worktree> && pnpm install"` and is
  intentionally fire-and-forget in the reference. This is not sufficient for
  BrushTales until install completion is observable; the proposed contract
  below requires readiness or an explicit unavailable result before launch.
- OpenCode is launched by typing a command into the left pane, not by Herdr's
  v1 `agent start --kind opencode`: the reference notes that Herdr 0.7.5 could
  select the v1 `opencode` executable and lose the v2 prompt. The command is
  `CALLER_PWD=<worktree> reproctl.sh opencode --prompt <prompt>` (or the
  profile equivalent), which resolves to `opencode2`; `--nightshift` adds v2's
  `--auto`. The seeded prompt is `/build [issue]`, and `--prompt` only seeds
  the editor. The script polls the visible pane for the seed without the
  `--prompt` wrapper, waits for TUI settle, sends `enter`, and polls
  `herdr pane list` for `agent_status == working`. If any check fails it warns,
  leaves the prompt for a manual Enter, and returns without destroying the
  worktree.
- The Herdr guide documents opaque IDs (`w1`, `w1:t1`, `w1:p1`), pane sources
  (`visible`, `recent`, `recent-unwrapped`, `detection`), explicit targeting,
  `--no-focus`, and `pane wait-output`. Scripts must parse returned JSON IDs;
  they must not infer IDs from sidebar order or focus. Workspace close is a
  cleanup operation, not a server stop.

### Observed failure and recovery behavior

The reference is deliberately fail-open around optional session launch. Missing
`jq` is fatal with `brew install jq`; missing Herdr or a stopped daemon leaves a
usable Git worktree and prints install and host-terminal startup instructions. A
failed workspace open, pane lookup, pane split, OpenCode launch, TUI detection,
Enter submission, or working-state confirmation warns and leaves manual commands.
If no terminal pane exists for deferred install, the reference falls back to a
synchronous `pnpm install` (non-fatal) and returns. Worktree creation failures
are fatal;
worktree cleanup is explicit and guarded against losing dirty tracked changes.
BrushTales should retain this non-destructive recovery shape but make dependency
completion and unavailable prerequisites explicit rather than presenting a
fire-and-forget install as success.

## Standalone Herdr adoption contract

This is the durable BrushTales adoption contract documented by task 009 now;
the contract is required, but its adapter implementation is deferred. It is not
runtime behavior delivered by this task. The indexed follow-up sequence is task
010 for project-local Herdr validation, task 011 for the owned server lifecycle,
task 014 for run ownership and recovery, task 012 for workspace-aware OpenCode
commands and wrappers, and task 013 for end-to-end validation and migration.
These tasks must preserve the contract below rather than silently attaching to
the shared global server.

1. **Install host tooling:** `brew "herdr"` in the repository `Brewfile` is a
   deliberate developer-tooling recommendation. `brew bundle
   --file=<absolute-worktree>/Brewfile` installs it on the developer host. It is
   not optional at runtime and is never an Expo, app, or device dependency. A
   Brew/Brewfile installation failure is a preflight failure: stop before
   opening a workspace, report the output, and give the explicit manual path
   `brew install herdr` (or the supported platform installer) followed by a
   retry. Never claim that a Herdr workspace was opened when this preflight is
   unavailable.
 2. **Start and check readiness:** before opening any worktree-scoped workspace,
    the adapter invokes the project-local lifecycle from task 011 with its
    derived `HERDR_CONFIG_PATH`; it must not inherit the global default session.
    The adapter then polls `herdr status server` at a fixed
   interval for a bounded 30-second timeout. Readiness requires a successful
   status response reporting `running` and a compatible protocol. A timeout,
   incompatible protocol, or unavailable host-terminal startup aborts workspace
   opening, retains the Git worktree, records Herdr as unavailable, and prints
    the status command plus a manual retry/recovery path. Legacy/manual `herdr`
    startup remains available only as an explicit migration mode. This contract
    does not invent a headless startup command or flag.
  3. **Ownership and lifecycle:** normal BrushTales adapter runs use a dedicated
     Herdr server and project-local configuration namespace owned by the current
     project lifecycle. Each invocation tags its workspace with a unique
     `BrushTales-<task-id>-<run-id>` label, queries the exact worktree path, and
     records the workspace ID plus whether this invocation created or reused that
     exact-path workspace. Cleanup closes only a workspace recorded as created by
     this invocation; it must never close a reused workspace from another run or
     retry. The adapter must never stop the shared global server. An explicit
     `--mode legacy-global --global-config <absolute-path>`, must record
     `server_disposition=shared`, and may not perform server stop or global
     workspace cleanup. The default is `--mode local`; local mode rejects a
     global config. A local run may use `herdr server stop` only when its
     dedicated server instance and ownership token are recorded.
4. **Failure fallback:** startup/readiness failure leaves the worktree intact
   for manual commands or a retry. Workspace open, pane, handoff, and install
   failures follow the same fail-open, non-destructive rule and must be labeled
   unavailable rather than silently continuing as a successful delegated run.

## BrushTales `/build` mapping and incompatibilities

The current `.opencode/commands/build.md` is the source of truth for BrushTales:
it loads the delivery/worktree/red-green/review/verification skills, resolves a
numeric task through `planning/resolve-task.sh`, refuses blocked work, creates a
task worktree from a clean main checkout, writes an absolute `tmp/build-*.md`
delegation spec, delegates implementation to `builder`, sends the complete diff
to `adversary`, repeats review for blocking/major findings, verifies,
updates Markdown and SQLite only after verification, and pauses for explicit
approval before rebase/add/commit/PR/push.

The proposed flow maps as follows:

1. **Resolve:** `/build 009` resolves the task locally from
   `planning/index.sqlite3` and its canonical Markdown path. BrushTales task IDs
   resolve locally from SQLite and need no Linear lookup. Reference issue mode
   performs Linear lookup before adoption/create resolution, while reference
   `deliver 009` classifies a numeric argument as PR mode and asks GitHub for PR
   9. An adapter must translate the local task ID to the task path before
   invoking any launcher; Linear/PR mode is not a drop-in replacement.
2. **Branch/worktree:** `/build` requires main-checkout origin/main and creates
   `.worktrees/009` with the task branch. Reference `deliver` uses its own
   `repro-wt-*` naming and `reproctl` assumptions (`.linear`, `pnpm`, `moon`,
   Linear branch metadata). BrushTales has no `.linear`, app manifest, or
   package manager yet, so its existing worktree workflow must remain the
   authority until a compatibility adapter is separately designed.
 3. **Workspace:** after the absolute task worktree exists, tag the Herdr
     worktree-scoped workspace with a unique run/task label such as
     `BrushTales-009-<run-id>`. Before opening it, query the exact worktree path
     and record the workspace ID, label, and whether this invocation created the
     workspace or reused one from another run/retry. Reuse must be exact-path
     only. Cleanup may close a workspace only when this invocation recorded that
     it created it; it must never close a reused workspace. The main checkout
     remains the orchestration control plane.
     The durable record and retry protocol below make that ownership decision
     operational; a label by itself is not an ownership lock.
 4. **Provision:** split `70:30`, use the terminal pane for the preflight and
    package-manager setup described below, and do not start the first OpenCode
    turn until the terminal result contract reports `ready`. A submitted
    `herdr pane run` may return before the command finishes, but this is still
    a blocking provisioning gate, not fire-and-forget work.
5. **Handoff:** do not send `/build 009` into the 70% feature-worktree pane.
    `/build` is the outer orchestrator: it resolves the task, creates the
    worktree, and writes the delegation spec. Herdr launches a direct
    builder/OpenCode child in that already-validated feature worktree, passing
    the absolute worktree and absolute delegation-spec paths. The direct child
    loads `red-green-delivery`, verifies its checkout, implements only the spec,
    and reports RED/GREEN evidence. It must not recursively invoke `/build`.
    The outer orchestrator remains responsible for the adversary,
    verification, planning metadata, and approval-gated publication. If a
    future adapter intentionally invokes `/build`, it must launch from the
    validated main checkout rather than this Herdr feature pane. The temporary
    `tmp/build-*.md` path is context for the direct child and adversary, never a
    `/build` task argument.
6. **Execution/review/verification:** OpenCode runs the existing `/build`
   contract: builder red-green, adversary review for every implementation batch,
   verification, and planning-index synchronization. A Herdr layout changes
   session transport only; it does not replace the builder/adversary boundary.
 7. **Publication/cleanup:** stop at the existing approval pause. Do not inherit
    reference `deliver`'s implicit branch pushes. After the user-approved PR is
    merged, close the exact Herdr workspace only when this invocation recorded
    that it created the workspace; leave a reused workspace open, and remove the
    worktree through the existing guarded workflow. Never stop the shared Herdr
    server automatically.

Further incompatibilities are explicit: reference profiles and
`reproctl opencode` target the reference repository's `opencode2` configuration;
BrushTales' profile/config surface is not yet provisioned. Reference `pnpm
install`/`moon run :build` cannot be assumed. Reference worktree adoption keys
off Linear IDs and branches, while BrushTales keys off local task IDs and
planning Markdown. The reference's `--nightshift`/`--auto` would weaken the
approval posture and must not be enabled by default.

## Provisioning contract before the first OpenCode turn

This is a future adapter contract, not an application runtime feature:

### Artifact path-safety contract

Path validation is a prerequisite to every provisioning or control-plane file
operation. Before creating or using a provisioning script, result, log, run
record, transfer intent, lock, cancellation marker, quarantine record, or
friction log, the adapter must resolve the worktree root, canonical main root,
and the intended artifact root with Python `pathlib`. The resolver must walk
the candidate and every existing parent with `lstat()`-style checks and reject
any symlinked component (including `tmp/` and any intermediate directory),
before calling `Path.resolve(strict=True)`. A path that cannot be resolved
strictly is rejected; the adapter must never substitute a lexical absolute path
or a string-prefix check.

This resolver is **preflight validation only**. `lstat()` followed by
`Path.resolve(strict=True)`, even when repeated immediately before an operation,
does not by itself prevent a time-of-check/time-of-use race. The future adapter
must perform artifact creation and publication with descriptor-relative,
no-follow operations: open each directory FD with `O_NOFOLLOW` (and the
platform's directory-only flags where available), then use `mkdirat`/`openat`
and `renameat`-style operations with no-follow semantics, or use an equivalent
platform helper that provides the same guarantee. It must retain directory/file
descriptor identity while holding the relevant lock and fail closed if the
platform cannot provide that primitive. The pathlib resolver proves intended
roots and candidates before those operations; it does not claim race-free
publication. The resulting guarantee is limited to adapter operations that use
that descriptor-relative/no-follow adapter; it is not a sandbox for arbitrary
code after a permitted child command starts.

The only allowed artifact roots are:

| Artifacts | Intended resolved root |
| --- | --- |
| `SCRIPT`, `RESULT`, `LOG`, `result.lock`, `cancel.json`, and `late-*.json` | `WORKTREE_REAL/tmp/herdr-provision` |
| run records, per-worktree locks, transfer intent journals, and recovery evidence | `MAIN_REAL/tmp/herdr-runs` |
| per-run friction JSONL | `MAIN_REAL/tmp/herdr-friction` |
| project-local Herdr config, socket, logs, state, and server ownership | `MAIN_REAL/tmp/herdr-project/<64-char-sha256-main-root>/` |

`WORKTREE_REAL` and `MAIN_REAL` themselves must be existing, non-symlinked,
strictly resolved Git roots before any artifact directory is inspected. For a
missing artifact directory or file, the resolver first finds the nearest
existing parent, validates that parent and every existing ancestor with
`lstat()`/strict resolution, and proves its resolved path is beneath the
intended resolved root. The production adapter may then create missing
directories one component at a time, owner-only and without following symlinks,
but only through the descriptor-relative/no-follow primitive described above;
the resolver's `lstat()` recheck after each creation is additional preflight
validation, not a race guarantee. If the descriptor operation detects a changed
component or cannot create the expected component, it aborts rather than
retrying through a different path.

Immediately before opening, reading, renaming, locking, or publishing an
artifact, the adapter repeats the strict/lstat checks and requires the final
artifact realpath (or, for a not-yet-created file, its validated parent and
post-create realpath) to remain beneath its one intended root. A worktree
artifact may not resolve into `MAIN_REAL`; a control-plane artifact may resolve
only into the explicitly intended main `tmp/herdr-runs` or
`tmp/herdr-friction` root. This is a realpath and component-identity fence,
never a lexical-only path check, but these checks alone do not close a TOCTOU
window; the subsequent operation must be descriptor-relative/no-follow. The
same checks apply to user-supplied
`--worktree`, `--spec`, `--evidence`, and all paths returned by Herdr before any
Herdr command or child process is invoked.

The resolver contract is executable Python, not an invocation of a platform
`realpath` command. Its required shape is equivalent to:

```python
import pathlib
import stat

def strict_no_symlink(path):
    p = pathlib.Path(path)
    if not p.is_absolute():
        raise ValueError("artifact paths must be absolute")
    cursor = pathlib.Path(p.anchor)
    for component in p.parts[1:]:
        if component == "..":
            raise ValueError("raw parent path component is not allowed")
        cursor /= component
        info = cursor.lstat()                 # do not follow this component
        if stat.S_ISLNK(info.st_mode):
            raise ValueError(f"symlinked path component: {cursor}")
    return p.resolve(strict=True)

def prepare_root(root_path, containing_root):
    container = strict_no_symlink(containing_root)
    root = pathlib.Path(root_path)
    if not root.is_absolute():
        raise ValueError("artifact roots must be absolute")
    missing = []
    cursor = root
    while True:
        try:
            cursor.lstat()                 # includes dangling symlinks
            break
        except FileNotFoundError:
            missing.append(cursor)
            if cursor == cursor.parent:
                raise ValueError("no existing artifact-root parent")
            cursor = cursor.parent
    existing = strict_no_symlink(cursor)
    existing.relative_to(container)
    for component in reversed(missing):
        existing = existing / component.name
        existing.mkdir(mode=0o700)         # preflight pseudocode only
        strict_no_symlink(existing)         # recheck immediately after mkdir
    final = strict_no_symlink(root)
    final.relative_to(container)
    return final

def validate_artifact(path, intended_root, containing_root, allow_missing=False):
    root = prepare_root(intended_root, containing_root)
    candidate = pathlib.Path(path)
    if not candidate.is_absolute():
        raise ValueError("artifact paths must be absolute")
    try:
        candidate_info = candidate.lstat()  # catches dangling symlinks too
    except FileNotFoundError:
        candidate_info = None
    if allow_missing and candidate_info is None:
        parent = candidate
        while True:
            try:
                parent.lstat()                 # includes dangling symlinks
                break
            except FileNotFoundError:
                pass
            if parent == parent.parent:
                raise ValueError("no existing parent")
            parent = parent.parent
        parent_real = strict_no_symlink(parent)
        parent_real.relative_to(root)
        # Create missing components only after this check; lstat and resolve
        # each newly-created component, then call this function again strict.
        return parent_real
    if candidate_info is not None and stat.S_ISLNK(candidate_info.st_mode):
        raise ValueError(f"symlinked artifact: {candidate}")
    final = strict_no_symlink(candidate)
    final.relative_to(root)
    return final
        ```

The production helper must additionally use descriptor-relative/no-follow
directory creation and exclusive owner-only file creation, repeating the
identity checks under the per-worktree lock after each component is created.
The illustrative `mkdir` above is not a race-safe publication primitive.
`relative_to` is only the final containment assertion; it is not a replacement
for the component `lstat()` walk and strict realpath checks. Any
`FileNotFoundError`, `RuntimeError`, `ValueError`, or containment failure is a
hard preflight failure before the file or lock is opened.

1. Check host prerequisites without changing the app: Git, Python 3 (`python3`),
   `jq`, `herdr`, and the chosen `opencode2` launcher. Python 3 is required by
   the adapter's portable, symlink-aware path resolver; `jq` is host-only
   tooling for Herdr JSON parsing and provisioning. Python 3, `jq`, and Herdr
   are all developer tools, not Expo/runtime or device dependencies. Homebrew
   users can install the declared tools with
   `brew bundle --file=<absolute-worktree>/Brewfile`; a missing `python3` must
   fail preflight clearly with `Python 3 (python3) is required` and the manual
   alternatives `brew install python` or a supported python.org/pyenv Python 3
   installation. This provisioning may run only on the developer host with the
   user's approval; it must never run inside an app build or on a child device.
   Missing `jq` or Herdr is reported separately as a host-tooling prerequisite
   failure, not as an app-runtime failure.
2. Detect package management reproducibly. First inspect `package.json`'s
    `packageManager` field; when present, it is authoritative. Require a
    recognized `name@version` declaration (`npm`, `pnpm`, `yarn`, or `bun`),
    pin/use that declared version through Corepack or the repository's supported
    version manager where possible, select the matching install command, and
    require lockfiles to agree with that manager. Require exactly one recognized
    lockfile in all cases. When `packageManager` is absent, exactly one
    recognized lockfile may select a manager only when its version is
    unambiguous: `package-lock.json` => `npm ci`, `pnpm-lock.yaml` =>
    `pnpm install --frozen-lockfile`, and `bun.lock`/`bun.lockb` => `bun install
    --frozen-lockfile` when their metadata identifies an unambiguous supported
    version. A `yarn.lock` alone is explicitly ambiguous across Yarn
    generations, so it never selects Yarn without explicit manager/version
    setup; Yarn 1 and Yarn 2+ also require their corresponding immutable mode.
    Reject conflicting or multiple recognized lockfiles, zero recognized
    lockfiles, a lockfile that conflicts with the declared manager, malformed or
    unsupported declarations, and absent/ambiguous manager-version metadata;
    fail and ask for explicit manager/version setup rather than guessing. Do
    not copy the reference's hard-coded `pnpm install` into BrushTales.
3. The current checkout has no `package.json`, lockfile, Expo app, or native
   project. Therefore the current result is **package provisioning unavailable**,
   not a successful no-op install. Task 001 (Expo shell) must establish the
   package manager and lockfile. Once present, install dependencies in the
   terminal pane, wait for its exit/result, and only then hand off to OpenCode.
4. After the Expo shell exists, add a separately approved Expo provisioning
   phase. Expo provisioning happens before the first builder turn: validate with
   `npx expo doctor`; use `npx expo install` only for dependencies
   explicitly selected by the task; use `npx expo prebuild` only when native
   configuration is intentionally being generated. This phase must not silently
   create native files or change camera/audio/privacy scope.
 5. The terminal pane is a required, observable gate. Before `herdr pane run`,
      create a per-run result path under the worktree's ignored `tmp/`, for
      example `<WORKTREE>/tmp/herdr-provision/<RUN_ID>/result.json`, and a log
      path next to it. The adapter sends one generated script to the terminal
      pane. The script must write an atomic `*.tmp` then rename it to the result
      path and return the same final status. Its result contract is:

      The command submission has this concrete shape. Every value is generated
      with an argv-safe shell quoting function, never by interpolating literal
      single quotes around a path. In the Bash launcher, for example,
      `shell_quote() { printf '%q' "$1"; }` is used for every path, pane ID,
      and run value before constructing the command string. This preserves
      paths containing single quotes (and whitespace); an equivalent argv-safe
      Herdr API is acceptable. The generated script receives the same values
      as arguments and validates them again.

      ```sh
      PROVISION_DIR="$WORKTREE_REAL/tmp/herdr-provision/$RUN_ID"
      RESULT="$PROVISION_DIR/result.json"
      LOG="$PROVISION_DIR/run.log"
      SCRIPT="$PROVISION_DIR/run.sh"
      shell_quote() { printf '%q' "$1"; }
      COMMAND="cd $(shell_quote "$WORKTREE_REAL") && bash $(shell_quote "$SCRIPT") \
        --run-id $(shell_quote "$RUN_ID") --generation $(shell_quote "$GENERATION") \
        --worktree $(shell_quote "$WORKTREE_REAL") --result $(shell_quote "$RESULT") \
        --log $(shell_quote "$LOG")"
      herdr pane run "$TERMINAL_PANE" "$COMMAND"
      ```

      The generated script is the command's authoritative exit-status producer;
     it exits `0` for `ready`, `10` for install failure, `11` for Expo-phase
     failure, and `124` for a timeout/interruption. The adapter must retain the
     exact command for a manual rerun rather than treating the `herdr pane run`
     submission response as completion.

      Before submission, the adapter creates `PROVISION_DIR` with owner-only
      permissions, a per-run `GENERATION` (a fresh unpredictable UUID), and
      these control paths:

       ```text
       <run-dir>/result.lock/       # atomic mkdir lock, publication ownership only
       <run-dir>/result.lock/owner.json # token/generation/PID/session/lease metadata
       <run-dir>/result-recovery.lock/ # parent-level reclaimer lock; never the orphan
       <run-dir>/result-fence.lock/  # shared final-publication gate
       <run-dir>/deadline.lock/      # deadline-generation serialization; never result.lock
       <run-dir>/deadline.json       # immutable run deadline and active generation
       <run-dir>/lock-fence.json     # authoritative token/generation/recovery fence
       <run-dir>/result-quarantine/  # atomically renamed orphan locks and late results
       <run-dir>/cancel.json        # atomic durable deadline/cancellation marker
        <run-dir>/result.json        # publishable result for this run/generation
        <run-dir>/late-*.json        # quarantine for results that lose the fence
        ```

      `result.lock` is an exclusive publication lock (an atomic `mkdir` with a
      bounded acquisition timeout, or an equivalent host lock primitive). The
       owner writes an owner-only `owner.json` containing a fresh unpredictable
       owner token and generation, PID, delivery session identity, acquisition
       time, and a heartbeat/lease expiry; the heartbeat is refreshed while the
       lock is held.
       In short, the required lock metadata is an owner token, PID/session
       identity, heartbeat/lease, and bounded acquisition state.
       Acquisition retries are bounded. On contention, the adapter reads and
       reports the live owner token, PID/session identity, and lease; it does not
       remove the lock. An expired lease is not an implicit recovery: normal
       callers must return busy and must never reclaim, rename, or replace an
       existing `result.lock`.

       Recovery is runnable without acquiring the orphaned lock. A sibling,
       parent-level `result-recovery.lock` under `<run-dir>` is the exclusive
       reclaimer lock; it is acquired before inspecting `result.lock` and is
       never nested inside or acquired through that orphan. Under this recovery
       lock, the explicit operator command rereads `owner.json`, requires an
       expired lease, and verifies owner token, PID, delivery session, heartbeat,
       and generation against owner-only operator evidence proving that the
       process/session is gone. It also requires the operator identity and an
       interactive `--confirm`; a timeout or a normal retry is insufficient.
       The recovery record is atomically published before the lock transition,
       including the old token/generation, evidence, operator, and new recovery
       epoch. The reclaimer then atomically renames the orphan directory to an
       owner-only `result-quarantine/orphan-<epoch>-<token>` path and creates a
       fresh `result.lock/owner.json` with a new owner token, generation, and
       epoch. A parent-level `lock-fence.json` is atomically advanced as part of
       that transition and marks the old token/generation invalid. Every normal
       publisher takes the recovery lock for its final fence check and atomic
       result publication; a late process with the old token or generation must
       instead write `late-*.json` quarantine evidence and exit `124`. No
       recovery path may delete or reuse the orphan directory in place.

       The provisioning script finishes its phases, then acquires the final
       publication locks in this order: `result-recovery.lock`, `result.lock`,
       `result-fence.lock`, and `deadline.lock`. It rechecks under the shared
       `result-fence.lock` and while holding `deadline.lock` that the durable
       `deadline.json`/`cancel.json` generation is still the exact active
       `run_id`/`GENERATION`, that no matching cancellation marker exists, and
       that the resolved worktree, owner token, and recovery epoch exactly match
       the command arguments immediately before writing a temporary result and
       atomically renaming it to `result.json`; the rename is the publication
       linearization point. The old result-lock check is replaced by this final
       fence check.
       Artifact creation/publication uses the descriptor-relative/no-follow
       adapter primitive described above, not the pathlib resolver alone. If a
       matching marker exists, the owner token/epoch is no longer current, or
       any identity check fails, it writes a timestamped `late-*.json` quarantine
       record and exits `124`; it must never publish `ready`.

       The deadline writer does **not** acquire `result.lock` (and therefore can
       publish cancellation even while that lock is held). At or before the
       deadline it takes only `deadline.lock`, verifies the immutable
       `deadline.json` generation, and atomically publishes an owner-only
       `cancel.json` containing `{run_id,generation,worktree,cancelled_at,reason,
       cancel_generation}`; it flushes the file and containing directory where
       supported before releasing the lock. It then records control state
       `timed_out` and interrupts the terminal command. The deadline marker is
       durable before the interrupt is sent. Because publication must take the
       shared final gate and then the same `deadline.lock` for its immediate
       final check, a marker that lands while the gate is held is observed and
       the late publication is rejected once the publisher reaches that check.
       If the publisher already holds `deadline.lock` for the final check and
       rename, the result rename linearizes first; the deadline writer then
       publishes its marker and that already-completed result remains accepted.

       The lock order is strictly `result-recovery.lock` -> `result.lock` ->
       `result-fence.lock` -> `deadline.lock` for publication/recovery. The
       deadline writer takes only `deadline.lock`; it never waits on or nests
       `result.lock`, so it cannot deadlock behind a held publication lock. A
       deadline-marker acquisition is not a bounded-failure path: it retries
       until the atomic marker is published, and a process crash is recovered
       from the immutable `deadline.json` by the next owner before any result
       publication. Thus no bounded lock failure may leave cancellation absent.
       On restart, an exact-generation marker with no result makes the run
       `timed_out`; an in-progress temporary marker is ignored or quarantined
       and rewritten from `deadline.json`. A result arriving later is accepted
       only when its `run_id`, `GENERATION`, `owner_token`, `recovery_epoch`, and
       resolved `worktree` exactly match the active invocation and no matching
       cancellation marker exists; otherwise it is quarantined or ignored and
       cannot turn this run back into `ready`. Markers or results for any other
       generation are identity failures and are quarantined, never adopted.

      ```json
      {
        "run_id": "<RUN_ID>",
        "generation": "<GENERATION>",
        "owner_token": "<OWNER_TOKEN>",
        "recovery_epoch": "<RECOVERY_EPOCH>",
        "worktree": "<resolved absolute worktree>",
        "status": "ready|failed|timed_out",
        "install_exit": 0,
        "expo_exit": 0,
        "expo_status": "passed|not-required|not-run|failed",
        "log": "<resolved absolute log path>",
        "completed_at": "<RFC3339 timestamp>"
      }
      ```

    The script runs the selected lockfile-compatible install command, captures
    its exact exit status in `install_exit`; a skipped phase uses
    `expo_exit=null` (the example shows the required-phase shape). If
    installation succeeds, it then
    runs the approved Expo phase (normally `npx expo doctor`; `npx expo install`
    or `npx expo prebuild` only when the task explicitly requires it) and
    captures `expo_exit`; if installation fails before that phase, it records
    `expo_status=not-run` and `expo_exit=null`. When no Expo phase is required,
    it records `expo_status=not-required` and `expo_exit=null`. It must not use
    `set -e` in a way that skips writing the result. A successful run has
    `status=ready`, `install_exit=0`, and `expo_status=passed` or
    `not-required`; any nonzero phase has `status=failed` and preserves both the
    phase status and log. A missing, malformed, mismatched-run, or
    mismatched-worktree result is a gate failure, not success.

     The adapter polls for that result at a fixed interval with a hard maximum
      (10 minutes for dependency/Expo setup). It also checks the terminal command
      exit status when Herdr exposes it. On deadline it durably publishes the
      exact-generation cancellation marker using the deadline protocol above,
      records `timed_out`, asks the terminal pane to interrupt the command, and
      leaves the log/result path for diagnosis. The timeout/cancellation marker
      is authoritative: a late result from an interrupted script is quarantined
      or ignored and cannot turn this run back into `ready`. It launches the
      first OpenCode turn only after validating the matching result and all
      required zero exit statuses.
     Install/provisioning
    failure or timeout keeps the worktree and workspace, marks the run
    `blocked`/`unavailable`, prints the log and an exact rerun command, and does
    not seed or press Enter on OpenCode. The terminal pane remains available for
    that manual rerun; a failed required gate must never be described as
    fire-and-forget success.

     6. If Herdr is unavailable, report that workspace/device prerequisite as
     unavailable rather than claiming delegated execution. Herdr, install, and
     Expo failure all retain the worktree for the same manual recovery path.

### Result-lock recovery implementation limit

The `result.lock` lease, sibling reclaimer lock, quarantine, generation fence,
and late-result rules in the provisioning contract are specified future-adapter
behavior only. No Herdr adapter or lock/recovery command exists in this task,
and no result-lock recovery path has been executed or runtime-proven. The
isolation fixture deliberately does not claim to cover an orphaned result lock.

A separately approved, indexed recovery-validation task must exercise normal
contention (including an expired lease remaining busy), explicit operator
evidence/`--confirm`, orphan quarantine, generation invalidation, fresh lock
creation, late-publication quarantine, and crash-safe journal replay/rollback.
A separate approved, indexed host-surface task must validate the corresponding
supported Herdr/host command surface. Until those tasks exist and produce exact
command output, result-lock recovery remains **unavailable/unverified**, not a
passed runtime gate.

## Durable Herdr workspace ownership and retry reconciliation

The future adapter keeps run state in the orchestration control plane, not in
the app: `<MAIN_CHECKOUT>/tmp/herdr-runs/<task-id>/<run-id>.json` (ignored by
Git, created with owner-only permissions). It writes records atomically and
uses an exclusive per-worktree lock while listing/opening/transferring/closing
a workspace. The per-worktree lock follows the same explicit lease protocol as
`result.lock`: an atomic owner-only acquisition with a bounded timeout, an
owner token, PID, delivery session identity, acquisition timestamp, heartbeat,
and lease expiry stored in lock metadata. A contender inspects the live PID and
session plus heartbeat/lease and reports the owning run; it never silently
removes the lock. Even after lease expiry, normal callers remain busy and never
reclaim it.

Recovery is runnable without acquiring an orphaned per-worktree lock. The task
run directory has a sibling parent-level `.worktree-recovery.lock` and an
authoritative `.worktree-lock-fence.json`; `brushtales-herdr workspace reconcile`
acquires the
recovery lock, never the orphan, and inspects its owner token, PID, session,
heartbeat, lease, and generation. It requires an expired lease, owner-only
operator evidence proving the process/session is gone, the operator identity,
and interactive `--confirm`. Under that recovery lock it performs validation
only, then prepares the single reconcile/recovery intent described below. The
intent, rather than independent mutations, records and applies the evidence,
old token/generation, transfer state, orphan-lock quarantine, generation-fence
invalidation, fresh per-worktree lock owner record, and predecessor/target state
changes through explicit phases. Late cleanup, transfer, or publication
handlers must check that fence under the recovery lock; an old token/epoch fails
closed and quarantines/leaves artifacts open, and may not publish or close a
workspace after recovery. The adapter must fail closed if it cannot provide
these descriptor-relative/no-follow lock directory operations. A record contains
at least:

```json
{
  "task_id": "009",
  "project_root": "<resolved absolute main checkout path>",
  "run_id": "<new unique UUID>",
  "owner_token": "<unpredictable token>",
  "generation": "<opaque-lock-generation>",
  "worktree": "<resolved absolute path>",
   "workspace_id": "<opaque exact ID or null while acquiring>",
  "label": "BrushTales-009-<run-id>",
  "workspace_disposition": "created|reused",
  "ownership_state": "acquiring|current|completed|transferred|failed|blocked|abandoned|closed",
  "server_disposition": "shared|dedicated-owned|dedicated-not-owned",
  "server_instance_id": "<dedicated server identity or null>",
  "herdr_config_path": "<resolved absolute config path>",
  "herdr_socket_path": "<resolved absolute socket path>",
  "owner_pid": "<delivery-process-pid>",
  "session_identity": "<launcher/session identity>",
  "lease_expires_at": "<RFC3339 timestamp>",
  "recovery_epoch": "<monotonic-or-opaque-fence>",
  "expected_predecessor": "<run-id or null>",
  "previous_run_id": "<run-id or null>",
  "transferred_to": "<run-id or null>",
  "transfer_reason": "<reason or null>",
  "heartbeat_at": "<RFC3339 timestamp>",
  "updated_at": "<RFC3339 timestamp>"
}
```

For the default project-local adapter, `server_disposition` must be
`dedicated-owned` or `dedicated-not-owned`; `shared` is valid only for the
explicit legacy/migration mode and is never eligible for server stop or shared
workspace cleanup.

The adapter follows this protocol:

1. Generate a new run ID and owner token for every invocation, take the
   per-worktree lock, resolve the worktree path, and perform the nonterminal
   ownership check in step 2 before creating this invocation's `acquiring`
   record. Only after that check passes does it write `acquiring` before
   calling Herdr. Query `herdr worktree list` for that exact resolved path. If
   none exists, open it and update the record with the returned opaque
   workspace ID and `workspace_disposition=created`. If one exists, record its
   ID and `workspace_disposition=reused`; never infer ownership from pane
   order, a label, or a guessed ID.
 2. While still holding the lock, enumerate every record for the exact
    `task_id` and resolved `worktree`. `acquiring` and `current` are both
    nonterminal ownership states. If any such record is owned by another run,
    refuse to create its acquiring record, attach, open, reuse, or close the
    workspace and report it busy;
    this includes another retry target that is still acquiring, so a retry
    cannot attach during another acquisition. A record belonging to the
    invocation may only be resumed with the same owner token. A timeout or
    process death is not enough to assume that a current run is failed; it
    requires explicit operator reconciliation.
 3. Heartbeats are refreshed at least every 30 seconds and the bounded stale
     lease is 15 minutes. A retry may recover only a prior record explicitly in
     `failed`, `blocked`, or `abandoned` state whose heartbeat is older than that
     lease. The retry must first create its own target record while holding the
     lock, with `ownership_state=acquiring`, a fresh owner token, the exact task
     ID, resolved worktree, and resolved workspace ID, and
     `expected_predecessor=<OLD_ID>`. The target's `previous_run_id` must also
     equal that expected predecessor. A retry that cannot create this exact
     acquiring record must stop; recovery cannot manufacture an unrelated owner
     or target record.

      `brushtales-herdr workspace recover` reacquires the parent-level recovery lock, never an
      orphaned lock, and validates the target record before changing the old
      record. It requires `NEW_ID`, the target
     owner token supplied by the retry, `task_id`, resolved `worktree`, and
     `workspace_id` to match exactly; it requires
     `ownership_state=acquiring`, `expected_predecessor=OLD_ID`, and
     `previous_run_id=OLD_ID`. It then queries Herdr by the exact path and
     requires the live workspace ID to match both records. Only after every
      target check passes may it prepare the single intent that marks the
      eligible old record `transferred` with `transferred_to=NEW_ID`, invalidates
      the old owner token, and atomically updates the already-existing target to
      `ownership_state=current` and
     `workspace_disposition=reused`. If no valid target record exists, or any
       identity/path/predecessor check fails, it transfers nothing, creates
       nothing, leaves the workspace open, and prints manual reconciliation
       instructions. A stale `current` record can be recovered only through an
       explicit operator command that proves its process or Herdr session is gone
       and records that evidence; it is never silently treated as a failed run.

      Before `brushtales-herdr workspace recover` can proceed, it must enumerate all records for
      the exact task/worktree and all records whose
      `expected_predecessor=OLD_ID`. There must be exactly one valid retry
      target: the supplied `NEW_ID`, its supplied owner token, the exact task,
      resolved path, resolved workspace ID, `ownership_state=acquiring`, and
      both predecessor fields equal to `OLD_ID`. Zero targets, a duplicate
      `NEW_ID`, or any additional competing acquiring target is an error; the
      command must reject the transfer without choosing one by age, label, file
      order, or heartbeat. Any other nonterminal (`acquiring` or `current`)
      record for the exact task/worktree is busy and also blocks recovery.

       #### Crash-safe reconcile/recovery intent journal

       Reconciliation and ownership transfer each run as one journaled
       transaction under the parent-level reclaimer lock (and the
       per-worktree lock where the normal transfer path owns it); the orphan
       lock is never acquired. There is one intent schema and one intent file
       per transaction, not separate journals for evidence, records, or lock
       state. Before changing **any** recovery evidence publication, run record,
       workspace cleanup, result publication, transfer relationship, orphan lock,
       quarantine, generation fence, or fresh-lock state, the adapter validates
       all inputs and atomically
       publishes one owner-only intent file under the validated
       `MAIN_REAL/tmp/herdr-runs/<task-id>/` root. Publishing the prepared
       intent is the first mutation. A reconcile intent has no target record;
       a recover intent has both predecessor and already-created target
       snapshots.

        The intent contains at least:

      ```json
      {
        "intent_id": "<unique-id>",
        "task_id": "009",
        "project_root": "<resolved absolute main checkout path>",
        "predecessor_run_id": "<OLD_ID>",
        "predecessor_owner_token": "<OLD_TOKEN>",
        "target_run_id": "<NEW_ID>",
        "target_owner_token": "<TARGET_TOKEN>",
        "worktree": "<resolved absolute path>",
         "workspace_id": "<opaque exact ID>",
         "server_instance_id": "<dedicated server identity or null>",
         "herdr_config_path": "<resolved absolute config path>",
         "herdr_socket_path": "<resolved absolute socket path>",
         "server_before": "<immutable server-owner snapshot or null>",
         "server_after": "<immutable server-owner snapshot or null>",
         "workspace_before": "<immutable workspace snapshot or null>",
         "workspace_after": "<immutable workspace snapshot or null>",
         "result_before": "<immutable result snapshot or null>",
         "result_after": "<immutable result snapshot or null>",
         "result_lock_before": "<immutable result-lock snapshot or null>",
         "result_lock_after": "<immutable result-lock snapshot or null>",
         "deadline_before": "<immutable deadline/cancel snapshot or null>",
         "deadline_after": "<immutable deadline/cancel snapshot or null>",
         "recovery_lock_before": "<immutable recovery-lock snapshot or null>",
         "recovery_lock_after": "<immutable recovery-lock snapshot or null>",
         "server_start_lock_before": "<immutable server-start-lock snapshot or null>",
         "server_start_lock_after": "<immutable server-start-lock snapshot or null>",
         "quarantine_before": "<immutable quarantine snapshot or null>",
         "quarantine_after": "<immutable quarantine snapshot or null>",
         "predecessor_record_before": "<immutable record snapshot>",
         "target_record_before": "<immutable record snapshot>",
         "predecessor_record_after": "<immutable record snapshot>",
        "target_record_after": "<immutable record snapshot or null for reconcile>",
        "evidence_path": "<validated absolute operator-evidence path>",
        "evidence_digest": "<sha256 of immutable operator evidence>",
        "evidence_record_before": "<immutable evidence-ledger snapshot or null>",
        "evidence_record_after": "<immutable evidence-ledger snapshot>",
         "transfer_before": "<immutable predecessor/target relationship or null>",
        "transfer_after": "<immutable predecessor/target relationship or null>",
        "orphan_lock_before": "<token/generation/owner snapshot>",
        "orphan_lock_after": "<immutable quarantine snapshot>",
        "quarantine_path": "<validated absolute path>",
         "fence_before": "<immutable fence snapshot>",
         "fence_after": "<immutable fence snapshot>",
         "fresh_lock_before": "<immutable fresh-lock snapshot or null>",
         "fresh_lock_after": "<new token/generation/epoch owner snapshot>",
         "phase": "prepared|server-ownership-updated|workspace-cleanup-published|result-published|evidence-published|predecessor-updated|target-updated|target-not-applicable|orphan-quarantined|fence-advanced|fresh-lock-created|committed|rollback-started|rollback-evidence-restored|rollback-server-restored|rollback-workspace-restored|rollback-result-restored|rollback-result-lock-restored|rollback-deadline-restored|rollback-recovery-lock-restored|rollback-server-start-lock-restored|rollback-predecessor-restored|rollback-target-restored|rollback-transfer-restored|rollback-quarantine-restored|rollback-fence-restored|rollback-fresh-lock-restored|rollback-lock-restored|rolled-back|manual-reconciliation",
         "phase_history": [{"phase":"prepared","outcome":"applied","before_digest":"<digest>","after_digest":"<digest>","recorded_at":"<RFC3339>"}]
        }
        ```

        Snapshot digests use SHA-256 over canonical UTF-8 JSON with recursively
        sorted object keys, no insignificant whitespace, and no trailing
        newline. `phase_history` is a JSON array, not an encoded string; each
        entry contains `phase`, `outcome` (`applied` or `noop`),
        `before_digest`, `after_digest`, and `recorded_at`. The intent includes
        the recovery-lock, server-start-lock, result-lock, and deadline/cancel
        snapshots even when their values are null, so replay can distinguish an
        unmodified lock from a missing record.

        The writer uses a unique temporary file, flushes it (and the containing
        directory where supported), then renames it atomically to the intent
        path. It writes `phase=prepared` and the initial prepared event in
        `phase_history` first. If the transaction changes a
        server owner, workspace, or result, it publishes the corresponding
        before/after snapshot and advances through
        `server-ownership-updated`, `workspace-cleanup-published`, or
        `result-published`; an inapplicable phase is recorded in
        `phase_history` with `outcome=noop` and matching before/after digests,
        rather than omitted. The current phase and its append-only history entry
        are atomically published together. It then publishes the validated
        recovery-evidence ledger,
        advances to `phase=evidence-published`, atomically publishes the
        predecessor state (abandoned for reconcile, transferred for recover),
        and advances to `phase=predecessor-updated`. For recover it atomically
        publishes the already-existing target state and advances to
        `phase=target-updated`; reconcile records the explicit no-target
        transition and advances to `phase=target-not-applicable`. It then
        atomically renames the orphan lock into the recorded quarantine path,
        advances to `phase=orphan-quarantined`, atomically advances the fence to
        invalidate the old token/generation, advances to `phase=fence-advanced`,
        creates the fresh lock owner record with the new token/generation/epoch,
        advances to `phase=fresh-lock-created`, and only then marks
        `phase=committed`.
       Every mutation is named by an immutable before/after snapshot in this
       same intent, and every phase record is itself atomically published. The
       committed intent remains as an audit record. No workspace close is
       permitted while an intent for that exact task/path is incomplete.

        Startup and explicit recovery scan incomplete intents while holding the
        same lock, before beginning a new ownership action. They may replay or
        roll back one only after validating the intent's task, both IDs and
        tokens, exact resolved worktree, workspace ID, evidence digest, every
        recorded lock/fence path, all server/workspace/result/record/relationship
        snapshots, every lock snapshot, deadline/cancel snapshot, and a fresh
        live Herdr exact-path result. A `prepared` intent whose evidence,
        server, workspace, result, records, every lock, and deadline/cancel state are
        still their recorded originals is rolled back by advancing
        `rollback-started`, then `rolled-back`; no separate evidence, server,
        workspace, result, or record mutation is allowed. If a mutation is
        visible while its phase is still `prepared`, replay first matches the
        recorded after-snapshot and advances that phase, or safely rolls back
        only when the before/after identity proves it; it never assumes the
        mutation was absent. A later phase is replayed only
       in its recorded order, one missing publication at a time, when all
       earlier snapshots, token/generation fences, quarantine identity,
       fresh-lock metadata, evidence identity, and live exact-path identity
       pass. Each replayed mutation advances the same intent before and after
       the mutation.

        If replay cannot be uniquely proven, rollback may restore the recorded
        evidence, server, workspace, result, predecessor, target, and lock
        snapshots only after recording `rollback-started` and only when the live
        path/ID and every owner-token and generation check prove that restoration
        is safe. The intent records `rollback-evidence-restored`,
        `rollback-server-restored`, `rollback-workspace-restored`,
        `rollback-result-restored`, `rollback-result-lock-restored`,
        `rollback-deadline-restored`, `rollback-recovery-lock-restored`,
        `rollback-server-start-lock-restored`, `rollback-predecessor-restored`,
        `rollback-target-restored`, `rollback-transfer-restored`,
        `rollback-quarantine-restored`, `rollback-fence-restored`,
        `rollback-fresh-lock-restored`, and `rollback-lock-restored` as
        applicable,
        then `rolled-back`. If any restoration is unsafe, it makes no further
       state mutation, marks the same intent `manual-reconciliation`, and
       reports the conflicting IDs/tokens/paths. Startup must complete this
       replay/rollback scan before any new ownership action. It never silently
       picks a predecessor, target, workspace, lock, evidence path, or path,
       and never leaves an ambiguous ownership state as if transfer or lock
       recovery succeeded. This replay/rollback protocol is specified here for
       the future adapter; it is not implemented or runtime-proven by task 009.
    4. Crashed acquisition and stale-current recovery are explicit, runnable
       procedures, not implicit retry behavior. The operator first prepares an
       owner-only, immutable evidence input containing at least `observed_at`, the task/run
       IDs, owner token and generation, resolved worktree, recorded workspace ID (or an explicit
      `workspace_id_unknown` reason), the exited PID/process evidence, the Herdr
      session/process evidence, and the operator identity. Then, from the main
      control plane, they run one of these commands with an interactive
      confirmation (a missing `--confirm` aborts):

      ```sh
       brushtales-herdr workspace reconcile --task 009 --from-run <OLD_ID> --state acquiring \
         --owner-token <OLD_OWNER_TOKEN> --generation <OLD_GENERATION> \
         --worktree /Users/gary/Projects/gschambers/brushtales/.worktrees/009 \
         --workspace-id <W_ID> --evidence <ABSOLUTE_EVIDENCE.json> --confirm
       brushtales-herdr workspace reconcile --task 009 --from-run <OLD_ID> --state current \
         --owner-token <OLD_OWNER_TOKEN> --generation <OLD_GENERATION> \
         --worktree /Users/gary/Projects/gschambers/brushtales/.worktrees/009 \
         --workspace-id <W_ID> --evidence <ABSOLUTE_EVIDENCE.json> --confirm
      ```

       The first command is for a crashed `acquiring` process; the second is for
       a `current` record whose heartbeat is older than the 15-minute lease. Each
       command first takes the parent-level reclaimer lock for the task/run
       directory, never the possibly orphaned per-worktree lock, before
       rereading the record. It requires the task/run/state, owner token, PID,
       session, heartbeat, lease, and generation evidence to match, resolves
       the supplied worktree with the macOS resolver below, and rejects anything
       other than the expected `.worktrees/009` path. While still holding the
       reclaimer lock it queries Herdr by that exact path and requires the
      returned workspace ID to equal both the record and `--workspace-id`.
      For an `acquiring` record that never stored an ID, the operator must
      supply the ID returned by that exact-path query; if there is no unique
      exact-path result, the command refuses to guess and leaves the workspace
      open. It also verifies the evidence proves the delivery process and
      relevant Herdr session are gone; a timeout alone is not proof.

       The supplied evidence input is validated read-only and is not an
       independently published run-state mutation; its path and digest are
       recorded in the one reconcile intent. On success, while still holding
       the reclaimer lock, the command creates
       the single reconcile intent described below, including the immutable
       evidence digest, predecessor before/after state, orphan-lock snapshot,
       quarantine path, fence transition, and fresh-lock owner record. It must
       not independently publish evidence, quarantine the lock, advance the
       generation fence, create a replacement lock, or update the predecessor:
       each mutation is performed only as the intent advances through its
       explicit phases. The reconcile intent records
       `acquiring -> abandoned` or `current -> abandoned`, including the
       evidence path, exact worktree/ID, operator, and reason, and leaves the
       workspace open. Only after that intent is `committed` may the operator
       run the normal transfer procedure; `brushtales-herdr workspace recover` creates its own
       single intent for the predecessor/target transfer and lock transition:

      ```sh
      brushtales-herdr workspace recover --task 009 --from-run <OLD_ID> --to-run <NEW_ID> \
        --owner-token <TARGET_OWNER_TOKEN> \
        --expected-predecessor <OLD_ID> \
        --worktree /Users/gary/Projects/gschambers/brushtales/.worktrees/009 \
        --workspace-id <W_ID> --evidence <ABSOLUTE_EVIDENCE.json> --confirm
      ```

      The retry that owns `NEW_ID` must have created the acquiring target before
      this command runs. `brushtales-herdr workspace recover` reacquires the lock, rereads both
      records, repeats the exact path/ID query, and validates the target owner
       token and expected predecessor before preparing its one intent. The
       transfer, predecessor/target state changes, lock quarantine, generation
       invalidation, and fresh-lock creation then occur only through that
       intent's recorded phases. It never creates a missing target. Any
       mismatch leaves both records/workspace open and prints manual recovery
       instructions. Thus a crash in `acquiring` and a stale `current` record
       are operationally recoverable without allowing a retry or late handler
       to close the wrong workspace.
   5. Every cleanup operation reacquires the lock and rereads the record. It may
    close a workspace only when the record's run ID and owner token are still
   current, `workspace_disposition=created`, the run is in an intentional
   terminal cleanup state, and a fresh exact-path Herdr query returns the same
   workspace ID. If any check fails—including a transferred/reused record,
   another active heartbeat, a changed path, or an ID mismatch—it must refuse
   to close and print the owning run ID plus recovery instructions. Thus a
   late failure handler from an old run can never close a retry's or another
   active run's workspace. A shared Herdr server is never stopped; only a
   separately configured server recorded as `dedicated-owned` may be stopped
   by its owning run.
     6. An operator intentionally abandoning a run uses the adapter's explicit
        `brushtales-herdr workspace abandon --task 009 --run <RUN_ID>
        --owner-token <OWNER_TOKEN> --worktree <ABSOLUTE_WORKTREE>
        --evidence <ABSOLUTE_EVIDENCE.json> --confirm` command. It verifies the
        run ID/token under the lock, prepares the same intent journal (with no
        target transfer), and records `abandoned` through its evidence/state
        phases; it leaves the workspace open by default. Adding `--close`
        requests close only after the same current-owner,
   created-workspace, exact-ID, and non-active checks; `--close` and any
   `--force` option must never bypass another run's ownership. To reconcile a
    stale failed run, the retry first creates the exact acquiring target record,
    then the operator uses `brushtales-herdr workspace recover --task 009
    --from-run <OLD_ID> --to-run <NEW_ID> --owner-token <TARGET_OWNER_TOKEN>`;
    the command requires confirmation, stale failed/blocked evidence,
    exact-path/ID verification, matching expected predecessor, and records the
    transfer only after the target is validated. Recovery cannot manufacture an
    unrelated owner.

The control-plane records make crashes recoverable without making cleanup
guessful: a crash before the `created` update leaves an `acquiring` record and
an open workspace for operator reconciliation, never an automatically closable
workspace. A reused workspace is always left open by this run, including on
failure.

## Invocation and handoff contract

No local `deliver` wrapper is added in this task. Once task 012 supplies the
canonical `brushtales-herdr` adapter, its invocation must carry absolute paths
and a validated worktree, for example:

```sh
brushtales-herdr run --project-root \
  /Users/gary/Projects/gschambers/brushtales \
  --task 009 --mode local --worktree \
  /Users/gary/Projects/gschambers/brushtales/.worktrees/009 \
  --spec \
  /Users/gary/Projects/gschambers/brushtales/.worktrees/009/tmp/build-20260912-009.md
```

The historical `deliver` name is an explanatory alias only; if retained, it
must invoke this exact parser and may not silently route to the reference CLI.
The reference CLI does not currently accept these BrushTales-specific flags;
this example is the required future adapter contract, not a command that should
be run against `/Users/gary/Projects/repro-dev/repro/bin/deliver` today. The
outer task command preserves the absolute delegation-spec path alongside the
absolute worktree path on every handoff. The temporary build spec is context
passed separately to the direct builder and adversary, never a `/build` task
argument. The outer task selector and delegation-spec path are distinct; both
must be verified before opening a Herdr workspace or making any delegated edit.
Resolve both context paths through the filesystem before validating containment;
lexical prefixes are insufficient because a symlink can escape the worktree.
Abort unless all of these checks pass:

```sh
# macOS/Bash 3.2-compatible resolver contract; GNU coreutils are not required.
resolve_existing() {
  python3 - "$1" <<'PY'
import pathlib
import stat
import sys

try:
    path = pathlib.Path(sys.argv[1])
    if not path.is_absolute():
        raise ValueError("path must be absolute")
    cursor = pathlib.Path(path.anchor)
    for component in path.parts[1:]:
        if component == "..":
            raise ValueError("raw parent path component")
        cursor /= component
        if stat.S_ISLNK(cursor.lstat().st_mode):
            raise ValueError("symlinked path component")
    print(path.resolve(strict=True))
except (OSError, RuntimeError, ValueError):
  raise SystemExit(1)
PY
}

WORKTREE_REAL="$(resolve_existing "$WORKTREE")" || abort "worktree cannot be resolved"
SPEC_REAL="$(resolve_existing "$SPEC")" || abort "spec cannot be resolved"

# Resolve the canonical main checkout before resolving task metadata. The shared
# Git directory is the identity boundary: its checkout parent is the main root
# for both the main checkout and feature worktrees. This prevents divergent
# planning metadata in a feature worktree from selecting a different task.
MAIN_GIT_COMMON="$(git -C "$WORKTREE_REAL" rev-parse --path-format=absolute --git-common-dir)" \
  || abort "shared Git directory cannot be resolved"
MAIN_GIT_COMMON_REAL="$(resolve_existing "$MAIN_GIT_COMMON")" \
  || abort "shared Git directory cannot be resolved"
MAIN_CANDIDATE="$(dirname "$MAIN_GIT_COMMON_REAL")"
MAIN_REAL="$(resolve_existing "$MAIN_CANDIDATE")" \
  || abort "canonical main checkout cannot be resolved"
MAIN_ROOT="$(git -C "$MAIN_REAL" rev-parse --show-toplevel)" \
  || abort "canonical main checkout is not a Git root"
MAIN_ROOT="$(resolve_existing "$MAIN_ROOT")" || abort "main Git root cannot be resolved"
test "$MAIN_ROOT" = "$MAIN_REAL" || abort "canonical main root mismatch"
test "$MAIN_REAL" != "$WORKTREE_REAL" || abort "feature worktree must not be the main checkout"

# Resolve the task through the main checkout's SQLite-backed resolver before any
# workspace or pane side effect. The resolver prints id|slug|path|...; only its
# path field is authoritative. TASK_REAL is the realpath of the supplied task
# context and must be exactly the realpath of that SQLite-selected path.
REPO_ROOT="$MAIN_REAL"
TASK_ID="$(basename "$TASK" | cut -c1-3)"
case "$TASK_ID" in
  [0-9][0-9][0-9]) : ;; *) abort "task path does not contain a numeric task ID" ;;
esac
TASK_ROW="$(cd "$REPO_ROOT" && bash planning/resolve-task.sh "$TASK_ID")" \
  || abort "SQLite task resolver failed"
TASK_INDEX_PATH="$(printf '%s\n' "$TASK_ROW" | cut -d'|' -f3)"
test -n "$TASK_INDEX_PATH" || abort "SQLite task resolver returned no canonical path"
TASK_INDEX_MAIN_REAL="$(resolve_existing "$MAIN_REAL/$TASK_INDEX_PATH")" \
  || abort "SQLite canonical main task path cannot be resolved"
TASK_INDEX_WORKTREE_REAL="$(resolve_existing "$WORKTREE_REAL/$TASK_INDEX_PATH")" \
  || abort "SQLite task path is missing from the feature worktree"
TASK_REAL="$(resolve_existing "$TASK")" || abort "canonical planning task cannot be resolved"
test "$TASK_INDEX_WORKTREE_REAL" = "$TASK_REAL" \
  || abort "task path does not equal SQLite-selected feature-worktree path"
# A task path is not enough: hash both regular files through no-follow file
# descriptors and require identical bytes before using either task document.
TASK_MAIN_DIGEST="$(hash_regular_file_no_follow "$TASK_INDEX_MAIN_REAL")" \
  || abort "canonical main task digest cannot be computed"
TASK_WORKTREE_DIGEST="$(hash_regular_file_no_follow "$TASK_INDEX_WORKTREE_REAL")" \
  || abort "feature task digest cannot be computed"
test "$TASK_MAIN_DIGEST" = "$TASK_WORKTREE_DIGEST" \
  || abort "main and feature task contents differ"

# A second planning/<id>-*.md file is ambiguous even if it is not the path the
# caller supplied. Resolve every candidate in both roots so symlink aliases or
# divergent feature metadata cannot bypass this check; reject before opening a
# workspace or allowing any edit.
for TASK_CANDIDATE in "$REPO_ROOT"/planning/"$TASK_ID"-*.md; do
  test -e "$TASK_CANDIDATE" || test -L "$TASK_CANDIDATE" || continue
  TASK_CANDIDATE_REAL="$(resolve_existing "$TASK_CANDIDATE")" \
    || abort "alternate planning task cannot be resolved"
  test "$TASK_CANDIDATE_REAL" = "$TASK_INDEX_MAIN_REAL" \
    || abort "alternate planning task file exists for $TASK_ID"
done
for TASK_CANDIDATE in "$WORKTREE_REAL"/planning/"$TASK_ID"-*.md; do
  test -e "$TASK_CANDIDATE" || test -L "$TASK_CANDIDATE" || continue
  TASK_CANDIDATE_REAL="$(resolve_existing "$TASK_CANDIDATE")" \
    || abort "alternate feature planning task cannot be resolved"
  test "$TASK_CANDIDATE_REAL" = "$TASK_INDEX_WORKTREE_REAL" \
    || abort "alternate feature planning task file exists for $TASK_ID"
done

test -d "$WORKTREE_REAL" || abort "resolved worktree is not a directory"
test -f "$SPEC_REAL" || abort "resolved delegation spec does not exist"
test -f "$TASK_REAL" || abort "resolved canonical planning task does not exist"
test "$TASK_REAL" != "$SPEC_REAL" || abort "task and spec paths must be distinct"
case "$SPEC_REAL" in
  "$WORKTREE_REAL"/*) : ;; *) abort "resolved spec is outside the feature worktree" ;;
esac
case "$TASK_REAL" in
  "$WORKTREE_REAL"/planning/[0-9][0-9][0-9]-*.md) : ;; *) abort "resolved task is outside feature planning path" ;;
esac
# The canonical root above, rather than worktree-list ordering, is authoritative
# for task resolution and every project-local Herdr namespace.
test "$MAIN_ROOT" = "$REPO_ROOT" || abort "task resolver root differs from canonical main root"

# The task worktree is not merely any registered Git worktree: it must be the
# exact task-named child of the canonical main checkout.
EXPECTED_WORKTREE="$MAIN_REAL/.worktrees/$TASK_ID"
EXPECTED_WORKTREE_REAL="$(resolve_existing "$EXPECTED_WORKTREE")" \
  || abort "expected task worktree is missing"
test "$WORKTREE_REAL" = "$EXPECTED_WORKTREE_REAL" \
  || abort "worktree is not the expected main/.worktrees/<task-id> path"

ROOT="$(git -C "$WORKTREE_REAL" rev-parse --show-toplevel)" \
  || abort "worktree Git root cannot be resolved"
ROOT="$(resolve_existing "$ROOT")" || abort "worktree Git root cannot be resolved"
test "$ROOT" = "$WORKTREE_REAL" || abort "resolved worktree root mismatch"
```

The outer `/build 009` command runs `bash planning/resolve-task.sh 009` (with the
normalized numeric ID) from the canonical main root, takes the resolver's
repository-relative `path` field, validates the corresponding paths under both
the main root and the exact feature worktree, and compares the supplied task
context with the feature-worktree path. This SQLite-backed comparison is
mandatory; a
glob or a caller-selected `planning/009-*.md` is not a task identity. Every
other matching planning file is resolved and rejected before any workspace or
pane side effect. The outer task selector remains numeric (`009`); the direct
child receives only the separate canonical task/spec context and never an
alternate `/build` selector.

`hash_regular_file_no_follow` is a required adapter primitive, not a shell
alias: it opens a regular file with no-follow semantics after the same
component walk, streams its bytes into SHA-256, and rejects symlinks, devices,
and changed descriptor identity. A path-only or lexical hash is insufficient
for the task-content fence.

The Python `pathlib.Path.resolve(strict=True)` resolver rejects raw `..`
components and resolves symlinks without requiring GNU `realpath` or its
nonportable `--` option. The resolved worktree,
spec, and task are checked before any edits or workspace opening, so a symlinked
spec outside the worktree is rejected. A candidate containing `..` is rejected
before resolution rather than normalized into an apparently safe path. The
shared Git directory's checkout parent is resolved as the canonical main
checkout; the feature worktree must be different from it and must equal that
checkout's exact `.worktrees/<task-id>` child. The resolved
`git rev-parse --show-toplevel` result must exactly equal
the resolved feature worktree, not merely a parent or a path that happens to
contain it. Any mismatch aborts before edits or workspace opening. The main checkout remains untouched
during delegated edits because the child panes, prompts, and all write commands
target only this validated worktree; the main checkout is only the orchestration
control plane and is never used as a child pane cwd or an edit destination.
The adapter passes the same absolute worktree/spec paths to the direct `builder`
child and every `adversary` prompt. A concrete direct-child handoff prompt is:

```text
Work only in /Users/gary/Projects/gschambers/brushtales/.worktrees/009.
Do not invoke `/build` from this feature-worktree pane. Read the separate
delegation spec at
/Users/gary/Projects/gschambers/brushtales/.worktrees/009/tmp/build-20260912-009.md,
load `red-green-delivery`, then implement only that spec. Verify that the
checkout is `/Users/gary/Projects/gschambers/brushtales/.worktrees/009`, report
RED/GREEN evidence, and do not commit or push. The outer orchestrator owns
review, verification, metadata, and approval.
```

The adversary prompt receives the same absolute worktree/spec paths plus executable
targets for unstaged, staged, committed, and untracked changes. When launched
from main, those targets must use `git -C .worktrees/<task-id> ...`; when its cwd
is already the feature worktree, they must use absolute `git -C
<absolute-feature-worktree> ...` equivalents. If session policy denies required
absolute-path Git commands, launch the reviewer rooted at main with the relative
targets or grant safe `git -C` access; report the review as unavailable rather
than claiming certification. A pane may be shared for the terminal and OpenCode,
but the filesystem scope is always the absolute task worktree; the orchestrator
never edits application code.

## Observed orchestration friction

- The child-session launcher has no `cwd` parameter. **Mitigation:** carry and
  validate absolute worktree and spec paths, and set the Herdr pane cwd to the
  same worktree before handoff.
- Worktree/spec absolute-path handoff is therefore required; relative paths can
  silently resolve against the main checkout. **Mitigation:** enforce the exact
  root/spec checks above before opening panes or editing.
- Pre-existing worktrees and uncommitted coordination changes complicate clean
  worktree creation. **Mitigation:** inspect status and registrations first,
  preserve them, use the existing guarded worktree workflow, and never reset or
  clean unrelated files.
- Herdr, package-manager, and physical-device prerequisites may be unavailable.
  **Mitigation:** treat each as an explicit preflight/unavailable result, keep
  the worktree for retry/manual recovery, and never claim device or workspace
  success without command output.
- Required absolute-path Git review commands can be denied by session policy;
  in particular, `git -C <absolute-worktree> ...` may be rejected even when
  the same review is permitted from the main checkout. **Mitigation:** launch
  the reviewer rooted at main with relative `.worktrees/<task-id>` targets, or
  grant safe `git -C` access; report the review as unavailable rather than
   claiming certification. Keep this limitation in the friction log for every
   adapter/verification run.
- The initial agent policies enumerated individual shell commands too narrowly,
  blocking ordinary Python, SQLite, and basic Git inspection. **Mitigation:**
  treat the active repository/worktree as a broad local sandbox, keep external
  directories unavailable, and retain only the small set of publication and
  destructive-operation gates that protect delivery. Permissions are convenience
  controls, not a process sandbox.

### Durable per-run friction and risk log

Every adapter invocation creates the owner-only, run-scoped JSONL file
`<MAIN_CHECKOUT>/tmp/herdr-friction/<TASK_ID>/<RUN_ID>.jsonl`. The adapter must
verify that this path is covered by the repository's ignore rules before writing
(and abort logging setup rather than create a tracked child-data path).

The following is the durable template/schema only; its placeholder values are
not event records and must never be described as observed:

```json
{
  "timestamp": "<RFC3339>",
  "task_id": "009",
  "run_id": "<RUN_ID>",
  "phase": "launch|workspace|provision|review|verification|cleanup",
  "command": "<exact command or safe redacted form>",
  "denial_or_unavailable_reason": "<reason>",
  "consequence": "<what could not be claimed or completed>",
  "mitigation": "<manual recovery or follow-up>"
}
```

Observed entries from this session (2026-09-12) are recorded below. The exact
clock timestamp was unavailable, so `timestamp unavailable` is intentional and
the run identifier `2026-09-12-009-adversary-followup` identifies this run:

```json
{"timestamp":"timestamp unavailable","task_id":"009","run_id":"2026-09-12-009-adversary-followup","phase":"launch","command":"child-session launcher","denial_or_unavailable_reason":"launcher has no cwd parameter","consequence":"a child could resolve relative paths against main instead of the task worktree","mitigation":"validate absolute paths and set the Herdr pane cwd before handoff"}
{"timestamp":"timestamp unavailable","task_id":"009","run_id":"2026-09-12-009-adversary-followup","phase":"review","command":"git -C /Users/gary/Projects/gschambers/brushtales/.worktrees/009 ...","denial_or_unavailable_reason":"session policy denied the adversary's absolute-path Git command","consequence":"absolute-path review was unavailable; no adversarial certification may be claimed","mitigation":"run the reviewer from main with relative .worktrees/009 targets or grant safe git -C access"}
```

These are the actual entries available for this session, not fabricated
RFC3339 values. The adapter will append future observations with their actual
timestamp when available, or the same explicit unavailable marker when it is
not. The PR body copies each observed JSONL entry verbatim (with any secrets or
machine-local redactions noted), so unavailable gates and their mitigations
survive the handoff; the durable template is not copied as an event. The log
contains no camera frames, child images, voice recordings, or other child media.

### Committed-baseline contamination and delivery boundary

`origin/main...HEAD` is not an empty baseline in this worktree: committed
`10c648e` (`chore(planning): keep execution order in index`) is the sole commit
ahead of `origin/main`. Its exact contents are one-line execution-order removals
from planning tasks 001–008, the addition of the 73-line task-009 planning
document, seven `planning/README.md` line changes, three
`planning/verify-index.sh` line changes, and the binary `planning/index.sqlite3`
update. This is pre-existing task/bootstrap planning scope, not an application
change introduced by the current coordination edits, but it contaminates the
delivery baseline for any task-009 diff.

Before staging task-009-only files, the orchestrator must reconcile this
contamination by using a fresh worktree from `origin/main`, or by obtaining
explicit user acceptance that `10c648e` is part of the delivery baseline. The
orchestrator must preserve the existing worktree and coordination changes while
doing so; no reset or history rewrite is authorized by this task. The user
accepted `10c648e` as part of the delivery baseline on 2026-09-12, so the
remaining report must disclose it but may proceed without claiming a clean
task-only range.

## Recommendation

The task-009 design/recommendation is documented and the accepted committed
baseline is disclosed as described below; the batch is ready for approval-gated
staging. The ignored fixture result is run-scoped evidence only and is not a
claim that a fresh checkout contains or can execute that fixture.
The deferred items below are future delivery batches, not missing implementation
within this task.

**Adopt locally only as documented policy; do not copy the reference `deliver`
implementation yet, and do not upstream a BrushTales-specific adapter to Repro.**
The smallest useful local change is this durable plan plus `brew "python"`,
`brew "herdr"`, and `brew "jq"` as deliberate host-tooling bootstrap entries.
All three are developer tools only; `brew bundle` installs them; failure is a
preflight failure with the manual-install fallback described above, never an app
runtime failure or dependency. Keep `/build`, the current task-ID resolver, the
  existing `.worktrees/<task-id>` convention, approval-gated Git helper, and
  builder/adversary workflow unchanged. The follow-up implementation begins with
  project-local Herdr host validation; it does not wait on app runtime packaging.

The separately approved follow-up tasks are now created and indexed before the
adapter implementation. Their required outcomes are:

- **010 — Supported Herdr host-surface validation:** validate a documented standalone
  Herdr startup and readiness sequence for the supported version, exact-path
  workspace reuse, `70:30` panes, workspace close without stopping other
  sessions, and record the available host workspace/pane command surface. Any
  missing lock/reclaimer commands become implementation requirements for task
  014 rather than an assumed Herdr capability.
- **011 — Project-local Herdr lifecycle:** implement an owned server/config
  lifecycle that cannot accidentally attach to the shared global server.
- **014 — Run ownership and recovery:** implement the result/workspace locks,
  transfer intent, quarantine, and recovery behavior required for interrupted
  or stale runs.
- **012 — Workspace-aware commands and wrappers:** implement the local-task-ID
  adapter and make `/build`, `/review`, `/verify`, and wrapping CLIs carry exact
  project/worktree/workspace context.
- **013 — Disposable integration and recovery validation:** exercise adoption, terminal
  install failure, Herdr-unavailable fallback, prompt handoff, review gate,
  cleanup, and the result/workspace-lock recovery protocol (including transfer
  journal replay/rollback) in a disposable task without touching the main
  checkout or storing child media. No lock-recovery pass is claimed until this
  fixture is executable and its exact output is recorded.

Each follow-up task is canonical in `planning/` and indexed in SQLite through the
normal planning workflow. Implementation must proceed in dependency order and
must not begin from the global Herdr workspace namespace by accident.

The reference's useful generic improvements (absolute context handoff, exact-path
workspace reuse, readiness polling, and non-destructive fallback) can be
upstream candidates only after a separately approved Repro task. The current
task intentionally leaves `/Users/gary/Projects/repro-dev/repro` unchanged.

## Delivery invariants and privacy boundaries

- The orchestrator coordinates only; application source, tests, native files,
  profiles, and assets are edited by the builder in the isolated worktree.
- No direct-to-main delivery is allowed. Rebase, `git add`, commit, push, and PR
  creation remain explicit user-approval operations.
- Every implementation batch still requires red-green evidence, adversarial
  review (with only disposable `tmp/` probes permitted), and applicable
  verification before planning completion.
- Herdr, Homebrew, OpenCode, and package managers are developer tooling only.
  None is an Expo runtime dependency or a mechanism for cloud inference.
- Camera frames, voice recordings, profiles, and audio remain local app data;
  this workflow stores no child images/audio, uploads none, and adds no
  analytics, accounts, ads, or provider credentials.

## Verification plan

All run-scoped harnesses, logs, delegation specs, and disposable fixtures belong
under the git-ignored `tmp/` directory. A run may create or supply them when
missing; they are never represented by a row in `planning/index.sqlite3`. Only
this durable task document and other durable planning/research documents are
indexed.

Use a disposable planning/fixture task rather than an app feature. A statement
that the main checkout is a control plane is not verification. The fixture must
produce command output and before/after snapshots as evidence.

### Required disposable main-isolation fixture

The fixture must invoke the adapter's pre-Herdr command fence with a concrete
operation model, not a prose instruction or an unrestricted shell string. The
adapter accepts either (a) generated `Operation` JSON or (b) a named,
allowlisted script template plus argv values. The model is:

```json
{
  "cwd": "<WORKTREE_REAL>",
  "argv": ["fake-herdr-runner", "write-file", "<WORKTREE_REAL>/tmp/fixture-delegated-write.md", "ok\\n"],
  "write_paths": ["<WORKTREE_REAL>/tmp/fixture-delegated-write.md"]
}
```

The fence resolves `cwd`, every argv path, and every `write_paths` parent with
the artifact path-safety contract above before invoking Herdr. It requires the
resolved cwd to equal `WORKTREE_REAL` exactly and every resolved write path to
remain beneath it. It rejects any symlinked path/component, `MAIN_REAL`, or
path outside `WORKTREE_REAL`. If a script template is used, only a checked-in
allowlist of templates may be selected and all paths still come from validated
argv values; arbitrary command text is not accepted. As an additional command
syntax fence it rejects any raw `..` substring before shlex/operator handling,
including `cd ..`, `../`, `/..`, embedded forms such as `/tmp/../outside`, and
attached-operator forms such as `foo/..;` and `foo/../x&&cmd`. These syntax
checks supplement realpath containment and are never a substitute for it.

The fixture file runs this model through a fake Herdr runner (never a real
child session) and creates its own disposable Git repository/worktree, so it
does not require the app or a pre-existing task worktree:

```sh
python3 tmp/009-isolation-fixture.py
```

The fixture source lived only at ignored `tmp/009-isolation-fixture.py` for this
run and is not expected to exist in a fresh checkout. Its
`FakeAdapter`/`fake-herdr-runner`
model is a future-adapter contract fixture, not an application test and not a
claim that arbitrary child code is sandboxed.
Its `pathlib`/`lstat` preflight and path-based fake write are deterministic
contract coverage only; they cannot race-test parent-symlink replacement.
Actual adapter writes and hashes must use descriptor-relative, no-follow
directory FDs (or an equivalent platform helper). Race/device validation is
deferred and must be reported unavailable until separately exercised.

The harness must fail closed before the runner is called for each rejected
operation and print the rejected operation plus its resolved paths. The fence
only controls commands generated by this adapter contract; it does not claim
to sandbox arbitrary malicious code after an accepted command has started. This
is deterministic contract coverage, not a parent-symlink race test;
descriptor-relative/no-follow production operations and physical-device
validation remain deferred and unavailable here.

For this fixture, `fake-herdr-runner write-file PATH CONTENT` is the sole
allowlisted operation and writes exactly `CONTENT` to the validated `PATH`; it
does not invoke a shell. The adapter must pass the valid operation once, while
the negative operations below must produce zero fake-runner invocations. This
fixture explicitly exercises shell templates containing `cd ..`, an embedded
`/tmp/../outside` token, and attached-operator forms `foo/..;` and `foo/../x`;
a future shell-template adapter must reject raw `..` syntax before shlex or
operator handling. It must still parse and fence generated template/argv values
and may not accept arbitrary user shell text.

1. Resolve the canonical main checkout to `MAIN_REAL` using the same
   symlink-aware resolver as the adapter. Before launching any child or writing
   the fixture, capture:
     `git -C "$MAIN_REAL" status --porcelain=v1 --untracked-files=all -z`,
     `git -C "$MAIN_REAL" diff --binary HEAD`, and
     `git -C "$MAIN_REAL" ls-tree -r --full-tree HEAD`. Also capture the names
     and SHA-256 hashes of any pre-existing untracked files. Parse status as
     NUL-delimited porcelain records (including rename/copy records and paths
     containing quotes, tabs, or newlines); hash only regular files opened with
     no-follow semantics after an `lstat()` component walk, and explicitly
     reject symlinked paths or parents. Store these snapshots outside both
     worktrees or in an owner-only ignored fixture directory.
 2. Create a disposable task worktree and absolute delegation spec from the
    resolved main checkout. Run the valid operation model above through the
    fake runner, with cwd and output path set to the resolved feature worktree.
    Capture the feature status and file content, then repeat all main
    snapshots. Assert byte-for-byte equality for status, diff, tree, and
    untracked-file name/hash snapshots, and assert that the fixture artifact
    exists only in the feature worktree. The main status and the SHA-256
    checksum/manifest of its status, diff, tree, and pre-existing untracked
    files must be byte-for-byte unchanged.
  3. Exercise the fence with explicit negative operations: (a) a
     spec/worktree symlink resolving outside the feature worktree, (b) an
     **independent absolute delegation-spec** path resolving into `MAIN_REAL`,
     with a valid feature-worktree cwd, (c) commands containing `cd ..`, an
     embedded `/tmp/../outside` path token, and attached-operator forms
     `foo/..;` and `foo/../x`, (d) commands targeting absolute `MAIN_REAL` and
     absolute outside paths, and (e) an argv/output path containing a raw `..`
     parent component. Each must be rejected before the fake runner is called,
     leave no marker or output in main or the feature worktree, and emit the
     rejected operation and resolved path. The adapter must reject the
     path/command before Herdr, not merely rely on the child shell's current
     directory.
 4. This fixture verifies the adapter-generated operation/path fence; it does
    not claim that arbitrary malicious code is sandboxed after a permitted
    command starts.
   If the disposable fixture, required resolver, or host tools are unavailable,
    report the specific prerequisite and command output as **unavailable** rather
    than claiming isolation was proved. The fixture result below is only the
    result of this fake contract harness; it does not certify a future Herdr
    adapter.

### Fixture execution record (follow-up)

For this run, the supplied ignored fixture was executed:

```text
python3 tmp/009-isolation-fixture.py
```

The obtained result is consistent for this follow-up:

```text
PASS main snapshot unchanged: status, diff, tree, and untracked hashes
  PASS 009 deterministic contract fixture: 1 valid operation; 31 rejected; fake runner invocations=1; parent-symlink race/device validation deferred
```

The fixture also emitted one valid-operation line, thirty-one controlled
operation `REJECT` lines, and one separate snapshot-symlink preflight rejection.
Malformed operation fields return controlled `Rejected` results rather than
uncaught exceptions. This is fake contract coverage only; executable
Herdr, result-lock, reclaimer, race, and device validation remain deferred and
must not be inferred from this output.

The complete test matrix is:

5. Run the adapter in dry-run mode and verify the resolved task/spec/worktree
   paths are absolute; verify builder and adversary receive those same paths.
6. Simulate missing Herdr, stopped/incompatible server, missing package manager,
   install failure, pane split failure, and OpenCode readiness timeout. Each
   result must preserve the worktree, state the prerequisite as unavailable, and
   print recovery steps. No test may call a real device or persist camera/audio.
7. With Herdr available, inspect workspace list/open/reuse, `70:30` pane layout,
   terminal install completion, absolute prompt handoff, and exact workspace
   close. If Herdr, a workspace, or device prerequisite is unavailable, record
   **unavailable** with command output; never claim success.
8. Run the repository checks from the worktree and from the main control plane:

   ```sh
   bash planning/verify-index.sh
   git diff --check
   git status --short --untracked-files=all
   ```

   SQLite metadata remains unchanged for this investigation. The orchestrator
   updates task status/index only in the post-verification delivery step if the
   task state genuinely changes.

## Acceptance checklist

- [x] Reference `deliver`, worktree lifecycle, Herdr integration, panes, launch,
  and recovery paths are documented with observed commands and behavior.
- [x] `/build` is mapped step-by-step, including local task IDs versus Linear/PR
  selectors, v2 OpenCode, absent app/package manager, and approval-gated publish.
- [x] Python 3, Herdr, and jq host prerequisites are explicit Brewfile/developer
  tooling entries and are kept separate from the app runtime.
- [x] Herdr Brewfile entry, standalone startup/readiness contract, exact worktree
  workspace, naming, cleanup, and recovery are covered; Herdr is developer-only.
- [x] SQLite-backed task resolution, repository-root-prefixed realpath identity
  comparison, alternate planning-file rejection, and the direct absolute-path
  builder handoff are explicit; the outer task selector is not injected into a
  feature-worktree pane.
- [x] Provisioning, run, lock, cancellation, quarantine, recovery, and
  friction artifacts use strict Python pathlib/lstat component checks and
  explicit worktree/main control-plane roots; lexical-only checks are
  prohibited. These checks are preflight only: actual future-adapter writes and
  hashes must use descriptor-relative, no-follow directory FDs or an equivalent
  platform helper, and the fixture does not race-test parent symlink changes.
  The required future-adapter orphan-lock protocol uses a separate
  parent-level reclaimer lock, explicit evidence/confirmation, atomic
  quarantine, fresh owner record, an invalidating token/generation fence, and
  one transfer-intent journal spanning server/workspace/result publication,
  record publication, cleanup, and lock transition; normal callers never
  reclaim. This is specified only, not runtime-proven.
- [x] Exact-task/worktree concurrency treats `acquiring` and `current` records
  as busy, requires one retry target, rejects competing targets, and uses a
  crash-safe, token/path/ID-bound transfer intent journal.
- [ ] Executable Herdr/result-lock/reclaimer recovery is intentionally deferred
  to indexed follow-up tasks 010–014. Task 009 specifies the required
  future-adapter contract but does not claim a runtime implementation or passing
  recovery validation.
- [x] Package-manager detection and the future Expo provisioning phase precede
  the first OpenCode turn and report current prerequisites unavailable.
- [x] `70:30` layout and absolute spec/worktree handoff to builder and adversary
  are defined with invocation examples.
- [x] Orchestrator/application, branch, approval, review, and child-media privacy
  invariants are preserved.
- [x] Disposable operation/path-fence verification was executed in this run with
  the ignored `tmp/009-isolation-fixture.py`: one valid feature-worktree write,
  unchanged main snapshot, thirty-one pre-runner operation rejections plus one
  separate snapshot-symlink preflight rejection (including
  raw-parent, absolute-main/outside, independent-spec, malformed, arbitrary-shell,
  and symlink cases) passed. The exact command was
  `python3 tmp/009-isolation-fixture.py`. The fixture is run-scoped evidence,
  intentionally not part of a fresh checkout or indexed in SQLite; a future run
  must supply its own disposable fixture or adapter test recipe. Executable
  Herdr, result-lock, and
  reclaimer recovery validation remains separately deferred to approved, indexed
  tasks 010–014 and is not claimed here.
 - [x] **Delivery-baseline decision:** the user explicitly accepted committed
   baseline `10c648e` as part of this delivery on 2026-09-12. The PR must disclose
   that the range is not task-009-only; no clean-range claim is made.
- [x] Recommendation distinguishes local adoption, upstreaming, and deferral and
  names follow-up tasks.
