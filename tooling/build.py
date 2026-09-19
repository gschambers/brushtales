"""Public batch wrapper for the local ``next -q | build`` workflow."""
from __future__ import annotations

import argparse
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

from . import local_build
from .local_build import (LaunchResult, Task, TaskLock, _git_bytes, _git_run, _record,
                          _validate_opencode_config, canonical_root,
                          ensure_task_worktree, resolve_task, run_build,
                          validate_canonical_checkout)


MAX_BATCH_SIZE = 16


def collect_task_ids(positional, stdin=None):
    """Collect positional and piped IDs without reading an interactive TTY."""
    tokens = list(positional)
    stream = sys.stdin if stdin is None else stdin
    if not stream.isatty():
        tokens.extend(stream.read().split())
    result = []
    seen = set()
    for token in tokens:
        if not re.fullmatch(r"[0-9]{1,3}", token):
            raise ValueError(f"invalid task ID: {token}")
        task_id = f"{int(token):03d}"
        if task_id not in seen:
            seen.add(task_id)
            result.append(task_id)
    if len(result) > MAX_BATCH_SIZE:
        raise ValueError(f"at most {MAX_BATCH_SIZE} task IDs may be built at once")
    return tuple(result)


def _started(summary):
    return re.search(r"\| status started(?: \||$)", summary) is not None


def _interrupted(summary):
    return re.search(r"\| status interrupted(?: \||$)", summary) is not None


def _uncertain(summary):
    return re.search(r"\| status uncertain(?: \||$)", summary) is not None


def _abort_batch(entrypoint):
    for name in ("abort_active", "abort_prepared"):
        abort = getattr(entrypoint, name, None)
        if abort:
            try:
                abort()
            except BaseException:
                pass


def _unlaunched_records(entrypoint, task_ids, start, stage, error):
    recorder = getattr(entrypoint, "record_batch_setup", None)
    if recorder is None:
        return [f"task {task_id} | status unlaunched" for task_id in task_ids[start:]]
    return [recorder(task_id, "unlaunched", stage, error) for task_id in task_ids[start:]]


def run_batch(entrypoint, task_ids):
    """Resolve every task before preparing or launching the first one."""
    for index, task_id in enumerate(task_ids):
        try:
            entrypoint.validate(task_id)
        except KeyboardInterrupt as error:
            return _batch_records(entrypoint, task_ids, index, "interrupted", "batch validation", error)
        except (SystemExit, GeneratorExit):
            raise
        except BaseException as error:
            return _batch_records(entrypoint, task_ids, index, "failed", "batch validation", error)
    prepared = []
    try:
        for index, task_id in enumerate(task_ids):
            prepare = getattr(entrypoint, "prepare", None)
            if prepare:
                prepare(task_id)
                prepared.append(task_id)
    except KeyboardInterrupt as error:
        _abort_batch(entrypoint)
        return _batch_records(entrypoint, task_ids, index, "interrupted", "batch preflight", error)
    except (SystemExit, GeneratorExit):
        raise
    except BaseException as error:
        _abort_batch(entrypoint)
        return _batch_records(entrypoint, task_ids, index, "failed", "batch preflight", error)
    summaries = []
    for index, task_id in enumerate(task_ids):
        try:
            summary = entrypoint.run(task_id)
            summaries.append(summary)
            if _interrupted(summary):
                _abort_batch(entrypoint)
                summaries.extend(_unlaunched_records(entrypoint, task_ids, index + 1,
                                                     "batch launch", KeyboardInterrupt()))
                return summaries
            if _uncertain(summary):
                _abort_batch(entrypoint)
                summaries.extend(_unlaunched_records(
                    entrypoint, task_ids, index + 1, "batch launch",
                    RuntimeError("a launched child has uncertain ownership; inspect before retry")))
                return summaries
        except KeyboardInterrupt as error:
            _abort_batch(entrypoint)
            return summaries + _batch_records(entrypoint, task_ids, index, "interrupted", "batch launch", error)
        except BaseException as error:
            summaries.append(f"task {task_id} | status failed | launcher raised ({type(error).__name__})")
    return summaries


def _batch_records(entrypoint, task_ids, failed_index, status, stage, error):
    recorder = getattr(entrypoint, "record_batch_setup", None)
    if recorder is None:
        return [f"task {task_id} | status {status if index == failed_index else ('unlaunched' if index > failed_index else 'aborted')}"
                for index, task_id in enumerate(task_ids)]
    return [recorder(task_id,
                     status if index == failed_index else ("unlaunched" if index > failed_index else "aborted"),
                     stage, error) for index, task_id in enumerate(task_ids)]


class PermissionPolicy:
    """Small display policy; committed agent permissions remain authoritative."""

    def decision(self, command: str) -> str:
        lowered = command.lower()
        if any(word in lowered for word in ("credential", "password", "secret", "api_key", ".aws/", ".ssh/")):
            return "deny"
        if any(word in lowered for word in ("rm ", "reset --hard", "clean -f", "sudo ", "git push", "git commit", "../")):
            return "ask"
        if lowered == "pwd" or lowered.startswith(("git status ", "git diff ", "git log ", "python -m unittest ")):
            return "allow"
        return "ask"


class DirenvPreflight:
    """Validate repository-controlled envrc bytes and provide manual guidance."""

    def __init__(self, runner=None):
        self.runner = runner
        self.status = "direnv is not configured; run direnv allow manually for the canonical checkout and task worktree if needed"

    def ensure(self, root: Path, worktree: Path):
        root_envrc = root / ".envrc"
        task_envrc = Path(worktree) / ".envrc"
        if not root_envrc.exists() or not task_envrc.exists():
            self.status = "direnv setup is unavailable; run direnv allow manually after adding a repository-controlled .envrc"
            return False
        for path in (root_envrc, task_envrc):
            try:
                metadata = path.lstat()
            except OSError as error:
                raise RuntimeError("direnv .envrc is unavailable") from error
            if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
                raise RuntimeError("direnv .envrc must be a repository-controlled regular file")
        if root_envrc.read_bytes() != task_envrc.read_bytes():
            raise RuntimeError("canonical and task-worktree .envrc files must be byte-identical")
        try:
            if root_envrc.read_bytes() != _git_bytes(root, "show", "HEAD:.envrc"):
                raise RuntimeError("canonical .envrc differs from the committed repository-controlled file")
        except subprocess.CalledProcessError as error:
            raise RuntimeError(".envrc must be committed before direnv setup") from error
        self.status = "verified repository-controlled .envrc; configure direnv allow manually if environment loading is needed"
        return False


class OpenCodePreflight:
    plugin = "opencode-auto-permissions"

    def __init__(self, config: Path, runner=None, check_only=True, repository_root=None):
        if not check_only:
            raise ValueError("OpenCode preflight is check-only; it never mutates opencode.json")
        self.config = Path(config)
        self.runner = runner or subprocess.check_output
        self.repository_root = (Path(repository_root).resolve() if repository_root else self.config.parent.resolve())

    def ensure(self):
        config = _validate_opencode_config(self.repository_root, self.config)
        try:
            data = json.loads(config.read_text())
        except OSError as error:
            raise RuntimeError(
                "project OpenCode config is unreadable; restore opencode.json from the committed repository file"
            ) from error
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError(
                "project OpenCode config is malformed; restore opencode.json from the committed repository file"
            ) from error
        if not self._has_plugin(data):
            raise RuntimeError(
                "opencode-auto-permissions is missing or malformed; configure plugin as a JSON array of strings "
                "or install it with: opencode plugin add opencode-auto-permissions"
            )
        try:
            effective = self.runner(("opencode", "debug", "config"), cwd=str(self.repository_root),
                                    text=True, env={**os.environ, "OPENCODE_CONFIG": str(config)})
            parsed = json.loads(effective)
        except (OSError, subprocess.CalledProcessError, ValueError) as error:
            raise RuntimeError("verify OpenCode effective config with: opencode debug config") from error
        if not self._has_plugin(parsed):
            raise RuntimeError(
                "effective OpenCode config is missing or has a malformed plugin; configure plugin as a JSON array "
                "of strings and verify with: opencode debug config"
            )

    def _has_plugin(self, config):
        if not isinstance(config, dict):
            return False
        plugins = config.get("plugin")
        return isinstance(plugins, list) and all(isinstance(plugin, str) for plugin in plugins) and self.plugin in plugins


class BuildEntrypoint:
    def __init__(self, root: Path, herdr=None, permissions=None, opencode=None, direnv=None,
                 herdr_discovery_error=None):
        self.root = canonical_root(root)
        self.herdr = herdr
        self.permissions = permissions
        self.opencode = opencode
        self.direnv = direnv
        self.herdr_discovery_error = herdr_discovery_error
        self._validated = {}
        self._prepared = set()
        self._created_worktrees = {}
        self._active = set()

    def validate(self, task_id):
        task = resolve_task(self.root, task_id)
        worktree = ensure_task_worktree(self.root, task, create=False)
        self._validated[task.id] = (task, worktree)
        return task, worktree

    def prepare(self, task_id):
        cached = self._validated.get(task_id)
        task, _ = cached if cached is not None else self.validate(task_id)
        creation_state = {}
        worktree = ensure_task_worktree(self.root, task, create=True,
                                         creation_state=creation_state)
        self._validated[task.id] = (task, worktree)
        if creation_state.get("worktree_created"):
            self._created_worktrees[task.id] = (
                worktree, creation_state.get("branch"), creation_state.get("branch_created", False)
            )
        self._prepared.add(task_id)

    def abort_prepared(self):
        for worktree, branch, branch_created in tuple(self._created_worktrees.values()):
            _git_run(self.root, ("worktree", "remove", "--force", str(worktree)), check=False)
            if branch and branch_created:
                _git_run(self.root, ("branch", "-D", branch), check=False)
        self._created_worktrees.clear()
        self._prepared.clear()

    def abort_active(self):
        self._active.clear()

    def record_batch_setup(self, task_id, status, stage, error=None):
        task, worktree = self._validated.get(task_id, (
            Task(task_id, "unknown", "unknown", self.root / "planning" / f"{task_id}.md",
                 "todo", "unknown", 0, "unknown"), self.root / ".worktrees" / task_id))
        record = _record(self.root, task, worktree, None, None,
                         LaunchResult(status, error=error),
                         f"Batch {stage} did not launch this task; repair the setup and retry.")
        return f"task {task_id} | status {status} | run record {record}"

    def run(self, task_id):
        def prelaunch(task, worktree):
            if self.direnv is not None:
                self.direnv.ensure(self.root, worktree)
            if self.permissions is not None:
                self.permissions.ensure()
            workspace = pane = None
            herdr_error = self.herdr_discovery_error
            if self.herdr is not None:
                try:
                    if self.herdr.available():
                        workspace, pane = self.herdr.provision(self.root, worktree, f"BrushTales {task.id}")
                except (KeyboardInterrupt, SystemExit, GeneratorExit):
                    raise
                except BaseException as error:
                    herdr_error = f"{type(error).__name__}: Herdr preflight failed"
            return workspace, pane, herdr_error, getattr(self.direnv, "status", None)

        self._active.add(task_id)
        try:
            return run_build(self.root, task_id, herdr=self.herdr, opencode=self.opencode,
                             config_path=self.root / "opencode.json", prelaunch=prelaunch)
        finally:
            self._active.discard(task_id)
            self._prepared.discard(task_id)
            self._created_worktrees.pop(task_id, None)


def _preflight_records(invocation_root, task_ids, status, stage, error):
    try:
        root = canonical_root(invocation_root)
    except BaseException:
        root = Path(invocation_root).resolve()
    summaries = []
    for index, task_id in enumerate(task_ids):
        try:
            task = resolve_task(root, task_id)
        except BaseException:
            task = Task(task_id, "unknown", "unknown", root / "planning" / f"{task_id}.md",
                        "todo", "unknown", 0, "unknown")
        task_status = status if index == 0 else "unlaunched"
        record = _record(root, task, root / ".worktrees" / task_id, None, None,
                         LaunchResult(task_status, error=error),
                         f"Canonical {stage} prevented launch; repair the checkout and retry.")
        summaries.append(f"task {task_id} | status {task_status} | run record {record}")
    return summaries


def main(argv=None, *, root=None, stdin=None, entrypoint_factory=None) -> int:
    parser = argparse.ArgumentParser(description="Launch validated local BrushTales tasks")
    parser.add_argument("task_ids", nargs="*")
    parser.add_argument("--root", type=Path)
    args = parser.parse_args(argv)
    task_ids = ()
    try:
        task_ids = collect_task_ids(args.task_ids, stdin)
        if not task_ids:
            raise ValueError("provide at least one task ID")
        invocation_root = args.root or root or Path(__file__).resolve().parents[1]
        if entrypoint_factory is None:
            try:
                canonical = canonical_root(invocation_root)
                canonical = validate_canonical_checkout(canonical)
            except (KeyboardInterrupt, RuntimeError, subprocess.CalledProcessError) as error:
                for summary in _preflight_records(
                        invocation_root, task_ids,
                        "interrupted" if isinstance(error, KeyboardInterrupt) else "failed",
                        "preflight", error):
                    print(summary)
                return 1
            entrypoint = BuildEntrypoint(
                canonical,
                herdr=local_build.HerdrAdapter.discover(canonical),
                permissions=OpenCodePreflight(canonical / "opencode.json", repository_root=canonical),
                direnv=DirenvPreflight(),
            )
        else:
            canonical = canonical_root(invocation_root)
            entrypoint = entrypoint_factory(canonical)
        summaries = run_batch(entrypoint, task_ids)
        for summary in summaries:
            print(summary)
        return 0 if summaries and all(_started(summary) for summary in summaries) else 1
    except KeyboardInterrupt as error:
        if task_ids:
            for summary in _preflight_records(invocation_root, task_ids, "interrupted", "preflight", error):
                print(summary)
            return 1
        print("local build interrupted", file=sys.stderr)
        return 1
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"local build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
