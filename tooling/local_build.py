"""Small, local-only task build launcher.

The orchestration boundary is deliberately injectable: tests use fakes and the
CLI uses subprocesses. No workspace service or project daemon is created here.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import sqlite3
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class Task:
    id: str
    slug: str
    title: str
    path: Path
    status: str
    priority: str
    sequence: int
    summary: str
    dependencies: tuple[str, ...] = ()


@dataclass(frozen=True)
class LaunchResult:
    status: str
    process_id: Optional[int] = None
    session_id: Optional[str] = None
    error: Optional[BaseException | str] = None


class LaunchError(RuntimeError):
    """A discovered launcher rejected a safe launch request."""


class HerdrProtocolError(LaunchError):
    """Herdr is running but returned an invalid protocol response."""


def canonical_root(invocation_root: Path) -> Path:
    """Find the main checkout even when called from a linked worktree."""
    invocation_root = invocation_root.resolve()
    common_text = _git(invocation_root, "rev-parse", "--path-format=absolute", "--git-common-dir")
    common = Path(common_text).resolve()
    listing = _git(invocation_root, "worktree", "list", "--porcelain")
    block = {}
    for line in listing.splitlines() + [""]:
        if not line.strip():
            if block.get("branch") == "refs/heads/main":
                return Path(block["worktree"]).resolve()
            block = {}
            continue
        key, _, value = line.partition(" ")
        if key in ("worktree", "branch"):
            block[key] = value
    return common.parent if common.name == ".git" else invocation_root


def _metadata(markdown: str, name: str) -> str:
    match = re.search(r"^- \*\*" + re.escape(name) + r":\*\* (.+)$", markdown, re.MULTILINE)
    if not match:
        raise ValueError(f"missing Markdown metadata: {name}")
    return match.group(1).strip()


def resolve_task(root: Path, raw_id: str) -> Task:
    root = canonical_root(root)
    if not re.fullmatch(r"[0-9]{1,3}", raw_id):
        raise ValueError("task id must be one to three digits")
    task_id = f"{int(raw_id):03d}"
    database = root / "planning" / "index.sqlite3"
    connection = sqlite3.connect(database)
    try:
        row = connection.execute(
            "SELECT id, slug, title, path, status, priority, sequence, summary "
            "FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        has_dependencies = connection.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dependencies'").fetchone()
        dependencies = tuple(r[0] for r in connection.execute(
            "SELECT depends_on FROM dependencies WHERE task_id = ? ORDER BY depends_on", (task_id,)
        )) if has_dependencies else ()
        if has_dependencies:
            blocked = connection.execute(
                "SELECT d.depends_on FROM dependencies d JOIN tasks dep ON dep.id = d.depends_on "
                "WHERE d.task_id = ? AND dep.status <> 'done'", (task_id,)
            ).fetchone()
            if blocked:
                raise ValueError(f"task {task_id} has unfinished dependency: {blocked[0]}")
    finally:
        connection.close()
    if row is None:
        raise ValueError(f"unknown task: {task_id}")
    path = root / row[3]
    planning_dir = (root / "planning").resolve()
    if (Path(row[3]).is_absolute() or path.resolve().parent != planning_dir or
            not path.is_file() or path.name != f"{task_id}-{row[1]}.md"):
        raise ValueError("indexed task path does not match canonical Markdown")
    markdown = path.read_text(encoding="utf-8")
    title = re.search(rf"^# {task_id} — (.+)$", markdown, re.MULTILINE)
    if title is None or title.group(1) != row[2]:
        raise ValueError("SQLite and Markdown task title differ")
    for field, expected in (("Status", row[4]), ("Priority", row[5]), ("Summary", row[7])):
        if _metadata(markdown, field) != expected:
            raise ValueError(f"SQLite and Markdown {field.lower()} differ")
    md_dependencies = _metadata(markdown, "Depends on")
    listed = () if md_dependencies.lower() == "none" else tuple(sorted(x.strip() for x in md_dependencies.split(",")))
    if listed != tuple(sorted(dependencies)):
        raise ValueError("SQLite and Markdown dependencies differ")
    return Task(task_id, row[1], row[2], path, row[4], row[5], row[6], row[7], dependencies)


def _git(root: Path, *args: str) -> str:
    return subprocess.check_output(("git", "-C", str(root), *args), text=True).strip()


def _json_items(payload, keys):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in keys:
        if key in payload:
            found = _json_items(payload[key], keys)
            if found:
                return found
    for value in payload.values():
        found = _json_items(value, keys)
        if found:
            return found
    return []


def _workspace_id(item):
    value = item.get("workspace_id", item.get("id"))
    if isinstance(value, dict):
        return value.get("id")
    return value


def _workspace_object(payload):
    if isinstance(payload, dict) and (_workspace_id(payload) or payload.get("workspace")):
        nested = payload.get("workspace")
        return nested if isinstance(nested, dict) else payload
    if isinstance(payload, dict):
        for value in payload.values():
            found = _workspace_object(value)
            if found:
                return found
    return None


def _workspace_path(item):
    value = item.get("path", item.get("cwd", ""))
    return Path(value).resolve() if value else None


def _pane_id(item):
    return item if isinstance(item, str) else item.get("id", item.get("pane_id"))


def _pane_path(item):
    if not isinstance(item, dict):
        return None
    value = item.get("cwd", item.get("path", ""))
    return Path(value).resolve() if value else None


def _safe_error(error):
    if isinstance(error, BaseException):
        return f"{type(error).__name__}: launcher failed"
    return "launcher failed"


def _herdr_is_running(status):
    text = " ".join(status.lower().split())
    if re.search(r"\b(?:not|error|failed|stopped|unavailable)\b", text):
        return False
    return bool(re.search(r"\brunning\b", text))


class HerdrAdapter:
    """Adapter for an already-running Herdr CLI; never starts a server."""

    def __init__(self, discover, launch, panes=None, open_workspace=None):
        self._discover = discover
        self._launch = launch
        self._panes = panes
        self._open_workspace = open_workspace

    @classmethod
    def discover(cls, main_root, executable="herdr", runner=None, popen=None):
        runner = runner or subprocess.check_output
        popen = popen or subprocess.Popen

        def discover_workspaces():
            try:
                status = runner((executable, "status", "server"), text=True)
            except (OSError, subprocess.CalledProcessError):
                return None
            if not _herdr_is_running(status):
                return None
            try:
                output = runner((executable, "worktree", "list", "--cwd", str(main_root), "--json"), text=True)
                payload = json.loads(output)
                if isinstance(payload, dict) and not any(key in payload for key in ("worktrees", "result")):
                    raise HerdrProtocolError("Herdr worktree response has an unexpected shape")
                if not isinstance(payload, (dict, list)):
                    raise HerdrProtocolError("Herdr worktree response is not JSON data")
                return _json_items(payload, ("worktrees", "result"))
            except HerdrProtocolError:
                raise
            except (OSError, subprocess.CalledProcessError, ValueError) as error:
                raise HerdrProtocolError("Herdr worktree response is malformed") from error

        def launch(command, workspace, pane, cwd, env=None):
            prefix = f"OPENCODE_CONFIG={shlex.quote(env['OPENCODE_CONFIG'])} " if env and env.get("OPENCODE_CONFIG") else ""
            return popen((executable, "pane", "run", pane, prefix + shlex.join(command)), cwd=cwd)

        def panes(workspace):
            output = runner((executable, "pane", "list", "--workspace", workspace), text=True)
            return json.loads(output)

        def open_workspace(worktree, label):
            output = runner((executable, "worktree", "open", "--cwd", str(main_root), "--path", str(worktree),
                             "--label", label, "--no-focus", "--json"), text=True)
            return json.loads(output)

        return cls(discover_workspaces, launch, panes, open_workspace)

    def provision(self, main_root, worktree, label):
        workspaces = self._discover()
        if workspaces is None:
            raise LaunchError("Herdr server unavailable")
        match = next((item for item in workspaces if _workspace_path(item) == worktree.resolve()), None)
        if match is None:
            if self._open_workspace is None:
                raise LaunchError("exact Herdr workspace is not available; open it with herdr worktree open")
            match = self._open_workspace(worktree, label)
            match = _workspace_object(match)
            if match is None:
                raise LaunchError("Herdr workspace open returned no workspace")
            if _workspace_path(match) != worktree.resolve():
                raise LaunchError("Herdr workspace open returned a different worktree path")
        workspace = _workspace_id(match)
        if not workspace:
            raise LaunchError("Herdr workspace has no opaque ID")
        panes = _json_items(self._pane_list(workspace), ("panes", "result"))
        matching = [item for item in panes if _pane_path(item) == worktree.resolve() and _pane_id(item)]
        if len(matching) != 1:
            raise LaunchError("Herdr workspace does not have exactly one validated task pane")
        return workspace, _pane_id(matching[0])

    def available(self):
        return self._discover() is not None

    def launch(self, workspace, pane, command, cwd, env=None):
        workspaces = self._discover()
        if workspaces is None:
            raise LaunchError("Herdr became unavailable")
        match = next((item for item in workspaces if _workspace_id(item) == workspace), None)
        if match is None or _workspace_path(match) != cwd.resolve():
            raise LaunchError("workspace does not target the exact task worktree")
        try:
            panes = _json_items(self._pane_list(workspace), ("panes", "result"))
            pane_match = next((item for item in panes if _pane_id(item) == pane and _pane_path(item) == cwd.resolve()), None)
            if pane_match is None:
                raise LaunchError("pane is not registered for the exact task worktree")
            process = self._launch(command, workspace, pane, cwd, env)
        except (OSError, subprocess.CalledProcessError) as error:
            raise LaunchError(str(error)) from error
        return LaunchResult("started", getattr(process, "pid", None), getattr(process, "session_id", None))

    def _pane_list(self, workspace):
        if self._panes is None:
            raise LaunchError("pane discovery is unavailable for this Herdr adapter")
        try:
            return self._panes(workspace)
        except (OSError, subprocess.CalledProcessError, ValueError) as error:
            raise LaunchError(f"pane discovery failed: {error}") from error


class SubprocessOpenCode:
    """Ordinary fallback boundary; ``popen`` is injectable for local tests."""

    def __init__(self, popen=None):
        self._popen = popen or subprocess.Popen

    def launch(self, command, cwd, env=None):
        process = self._popen(command, cwd=cwd, env={**os.environ, **(env or {})})
        return LaunchResult("started", process.pid, getattr(process, "session_id", None))


def ensure_task_worktree(root: Path, task: Task) -> Path:
    """Return only the exact registered ``.worktrees/<id>`` path."""
    expected = (root / ".worktrees" / task.id).resolve()
    porcelain = _git(root, "worktree", "list", "--porcelain")
    registered = {line.removeprefix("worktree ") for line in porcelain.splitlines() if line.startswith("worktree ")}
    if str(expected) not in {str(Path(p).resolve()) for p in registered}:
        raise RuntimeError(f"task worktree is not registered at exact path: {expected}")
    if not expected.is_dir() or _git(expected, "rev-parse", "--show-toplevel") != str(expected):
        raise RuntimeError("registered task worktree failed safety checks")
    common_path = Path(_git(root, "rev-parse", "--git-common-dir"))
    worktree_common_path = Path(_git(expected, "rev-parse", "--git-common-dir"))
    common = (root / common_path if not common_path.is_absolute() else common_path).resolve()
    worktree_common = (expected / worktree_common_path if not worktree_common_path.is_absolute() else worktree_common_path).resolve()
    if common != worktree_common:
        raise RuntimeError("task worktree uses a different git common directory")
    branch = _git(expected, "branch", "--show-current")
    if branch == "main" or not re.fullmatch(r"(?:feat|fix|spike|docs|chore|research)/" + re.escape(task.id) + r"-.+", branch):
        raise RuntimeError(f"unsafe task branch: {branch}")
    if _git(expected, "status", "--porcelain"):
        raise RuntimeError("refusing to launch a dirty task worktree")
    return expected


def _record(root: Path, task: Task, worktree: Path, workspace: Optional[str], pane: Optional[str], result: LaunchResult, recovery: str) -> Path:
    record = root / "tmp" / f"local-build-{task.id}-{time.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex}.json"
    record.parent.mkdir(exist_ok=True)
    record.write_text(json.dumps({"task": task.id, "worktree": str(worktree), "workspace": workspace,
                                  "pane": pane, "process_id": result.process_id, "session_id": result.session_id,
                                  "status": result.status, "error": _safe_error(result.error) if result.error else None,
                                  "recovery": recovery}, indent=2) + "\n", encoding="utf-8")
    return record


def run_build(root: Path, raw_id: str, herdr=None, opencode=None, workspace=None, pane=None, config_path=None) -> str:
    root = canonical_root(root)
    task = resolve_task(root, raw_id)
    worktree = ensure_task_worktree(root, task)
    command = ("opencode", "run", "--dir", str(worktree), "--prompt",
               f"Implement task {task.id} directly. Read {task.path}. Never invoke /build.")
    env = {"OPENCODE_CONFIG": str(config_path.resolve())} if config_path else None
    try:
        if herdr is not None and herdr.available():
            result = herdr.launch(workspace, pane, command, worktree, env=env)
        elif opencode is not None:
            result = opencode.launch(command, worktree, env=env)
        else:
            process = subprocess.Popen(command, cwd=worktree, env={**os.environ, **(env or {})})
            result = LaunchResult("started", process.pid)
    except KeyboardInterrupt as error:
        result = LaunchResult("interrupted", error=error)
    except Exception as error:
        result = LaunchResult("failed", error=error)
    recovery = "Inspect the run record, then rerun the same task after fixing the launcher." if result.status != "started" else "Builder is running in the selected worktree; rerun after it exits if needed."
    record = _record(root, task, worktree, workspace, pane, result, recovery)
    return f"task {task.id} | worktree {worktree} | workspace {workspace or 'terminal'} | status {result.status} | run record {record}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Launch one local BrushTales planning task")
    parser.add_argument("task_id")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--workspace")
    parser.add_argument("--pane")
    args = parser.parse_args(argv)
    try:
        root = canonical_root(args.root.resolve())
        herdr = HerdrAdapter.discover(root)
        print(run_build(root, args.task_id, herdr=herdr, workspace=args.workspace, pane=args.pane))
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"local build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
