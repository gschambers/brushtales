# Local build launcher

Select and launch validated local planning tasks:

```sh
./bin/next -q --limit 3 | ./bin/build
./build.sh 017
./build.sh 17 018 017
```

IDs from arguments and stdin are normalized, deduplicated, bounded, and fully
validated before a session starts. Each launch verifies the SQLite/Markdown
task metadata, lifecycle and dependencies, a clean deterministic worktree
based on `origin/main`, and the committed OpenCode permission configuration.

The handoff is always an independent OpenCode orchestrator prompt containing
`/build <id>`. Herdr is used when its server/workspace/pane are available and
otherwise the same command runs through ordinary local OpenCode. Herdr failure
does not stop the normal fallback.

Each task has a simple owner record at `tmp/build-lock-<id>.json`. Existing
ownership blocks a retry and gives explicit recovery guidance; after confirming
the recorded owner is stale, recover it with:

```sh
python3 -m tooling.local_build --root "$PWD" --recover-stale 017 \
  --owner '<owner-from-build-lock>' --confirm
```

Run records are short, local-only, and redacted. They include exact root and
worktree paths, launch status, workspace/pane and process/session IDs when
known, ownership state, error classification, and recovery guidance. They do
not record credentials, child media, or environment dumps.

`.envrc` is never executed automatically. When repository-controlled `.envrc`
files are present and matching, the launcher reports that `direnv allow` may
be configured manually; missing setup is actionable guidance and does not
make the ordinary local fallback unusable.
