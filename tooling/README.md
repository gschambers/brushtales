# Local build launcher

Select the next validated local planning task without invoking a build:

```sh
./bin/next
./bin/next --limit 3 --quiet
```

Selection reads only the canonical SQLite index and task Markdown. Quiet mode
prints normalized task IDs, one per line; no-match and invalid-limit cases exit
nonzero.

From the canonical checkout, run:

```sh
./build.sh 017

# Equivalent explicit shell invocation:
bash build.sh 017
```

After installing direnv, enable its shell hook and allow the checked-in `.envrc`;
then `build 017` is available from either the canonical checkout or linked task
worktree.

The launcher verifies the SQLite/Markdown task pair and the exact registered
`.worktrees/<id>` path before starting `opencode run` directly in that
worktree. Herdr discovery uses `herdr status server`, `herdr worktree list
--cwd <main> --json`, and `herdr pane list --workspace <opaque-id>`; launching
uses `herdr pane run <explicit-pane-id> <command>`. A Herdr adapter can be
supplied by callers that already have Herdr;
when it is absent, the normal OpenCode process is used. It never invokes
`/build` recursively. Each attempt writes a short, local-only JSON record under
the ignored `tmp/` directory with recovery guidance.

On first use, the command checks the project-root `opencode.json` declaration,
installs the published MIT
`opencode-auto-permissions` plugin with OpenCode's plugin installer, then writes
an inspectable project config and verifies the effective result with
`opencode debug config`. Restart OpenCode after installation. Routine
project reads, edits, tests, and local Git inspection are allowed; deletion,
destructive Git, `sudo`, credential access, publication, and broad external
directory access remain review-gated or denied. This is not an OS sandbox, and
the command never changes the user configuration in tests.
