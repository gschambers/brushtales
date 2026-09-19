"""Readable local implementation of the BrushTales ``/build`` handoff.

This module deliberately uses ordinary pathlib, Git, and flock operations.  It
is developer tooling for a personal device, not a hostile-filesystem sandbox.
"""
from __future__ import annotations

import argparse
import contextlib
import fcntl
import json
import os
import re
import shlex
import sqlite3
import stat
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
    """A Herdr or OpenCode boundary rejected a launch."""


class LockContended(RuntimeError):
    """Another invocation currently owns the task lock."""


class HerdrProtocolError(LaunchError):
    pass


def _task_id(raw_id: str) -> str:
    if not re.fullmatch(r"[0-9]{1,3}", str(raw_id)):
        raise ValueError("task id must be one to three digits")
    return f"{int(raw_id):03d}"


def _safe_task_slug(slug: str) -> str:
    if not isinstance(slug, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", slug):
        raise ValueError("task slug must be a safe Markdown path component")
    return slug


def _git(root: Path, *args: str) -> str:
    return subprocess.check_output(("git", "-C", str(root), *args), text=True,
                                   stderr=subprocess.DEVNULL).strip()


def _git_run(root: Path, args, **kwargs):
    return subprocess.run(("git", "-C", str(root), *args), **kwargs)


def _git_bytes(root: Path, *args: str) -> bytes:
    return subprocess.check_output(("git", "-C", str(root), *args),
                                   stderr=subprocess.DEVNULL)


def _git_common(root: Path) -> Path:
    value = Path(_git(root, "rev-parse", "--git-common-dir"))
    return (Path(root) / value if not value.is_absolute() else value).resolve()


def _real_directory(path: Path, label: str) -> Path:
    path = Path(path)
    try:
        metadata = path.lstat()
    except OSError as error:
        raise RuntimeError(f"{label} is unavailable") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise RuntimeError(f"{label} must be a real directory")
    return path.resolve()


def _regular_file(path: Path, label: str) -> Path:
    try:
        metadata = path.lstat()
    except OSError as error:
        raise RuntimeError(f"{label} is unavailable") from error
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise RuntimeError(f"{label} must be a regular file")
    return path


def canonical_root(invocation_root: Path) -> Path:
    """Return the main checkout for either the main checkout or a worktree."""
    invocation_root = _real_directory(Path(invocation_root), "repository root")
    top = Path(_git(invocation_root, "rev-parse", "--show-toplevel")).resolve()
    for block in _git(top, "worktree", "list", "--porcelain").split("\n\n"):
        lines = dict(line.split(" ", 1) for line in block.splitlines()
                     if " " in line and line.split(" ", 1)[0] in {"worktree", "branch"})
        if lines.get("branch") == "refs/heads/main":
            return _real_directory(Path(lines["worktree"]), "main checkout")
    return top


def validate_canonical_checkout(root: Path, *, fetch=True) -> Path:
    """Require a clean main checkout synchronized to its local origin/main ref."""
    root = canonical_root(root)
    if _git(root, "branch", "--show-current") != "main":
        raise RuntimeError("canonical checkout must be on main")
    status = _git(root, "status", "--porcelain")
    unexpected = [line for line in status.splitlines()
                  if line and not _allowed_run_scope_status(line)]
    if unexpected:
        raise RuntimeError("canonical checkout must be clean")
    if fetch:
        try:
            _git_run(root, ("fetch", "--quiet", "origin", "main"), check=True)
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError("unable to fetch origin/main; repair the origin remote and retry") from error
    try:
        if _git(root, "rev-parse", "HEAD") != _git(root, "rev-parse", "origin/main"):
            raise RuntimeError("canonical main is not fresh with origin/main")
    except subprocess.CalledProcessError as error:
        raise RuntimeError("origin/main is unavailable; fetch it before retrying") from error
    return root


def _allowed_run_scope_status(line: str) -> bool:
    """Allow only the ignored runtime directories, not similarly named files."""
    if len(line) < 3:
        return False
    path = line[3:]
    return path in {"tmp", ".worktrees"} or path.startswith(("tmp/", ".worktrees/"))


def _revalidate_canonical_checkout(root: Path) -> None:
    if _git(root, "branch", "--show-current") != "main":
        raise RuntimeError("canonical checkout changed away from main")
    try:
        if _git(root, "rev-parse", "HEAD") != _git(root, "rev-parse", "origin/main"):
            raise RuntimeError("canonical main changed or is no longer fresh with origin/main")
    except subprocess.CalledProcessError as error:
        raise RuntimeError("origin/main is unavailable; fetch it before retrying") from error


def _metadata(markdown: str, name: str) -> str:
    matches = re.findall(r"^- \*\*" + re.escape(name) + r":\*\* (.+)$", markdown, re.MULTILINE)
    if len(matches) != 1:
        raise ValueError(f"missing or duplicate Markdown metadata: {name}")
    return matches[0].strip()


def _require_planning_schema(connection) -> None:
    required = {
        "tasks": {"id", "slug", "title", "path", "status", "priority", "sequence", "summary"},
        "dependencies": {"task_id", "depends_on"},
        "labels": {"name"},
        "task_labels": {"task_id", "label"},
    }
    for table, columns in required.items():
        table_row = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
        ).fetchone()
        if table_row is None:
            raise ValueError(f"planning SQLite schema is missing the {table} table")
        actual = {row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
        missing = sorted(columns - actual)
        if missing:
            raise ValueError(
                f"planning SQLite schema {table} table is missing columns: {', '.join(missing)}"
            )


def resolve_task(root: Path, raw_id: str) -> Task:
    root = canonical_root(root)
    task_id = _task_id(raw_id)
    planning = _real_directory(root / "planning", "planning directory")
    database = _regular_file(planning / "index.sqlite3", "planning database")
    connection = None
    canonical_labels = None
    try:
        connection = sqlite3.connect(database)
        _require_planning_schema(connection)
        rows = connection.execute(
            "SELECT id, slug, title, path, status, priority, sequence, summary "
            "FROM tasks WHERE id = ?", (task_id,)
        ).fetchall()
        if len(rows) != 1:
            raise ValueError(f"unknown or duplicate task: {task_id}")
        row = rows[0]
        if row[4] != "todo":
            raise ValueError(f"task {task_id} is not launchable: status is {row[4]}")
        dependencies = tuple(item[0] for item in connection.execute(
            "SELECT depends_on FROM dependencies WHERE task_id = ? ORDER BY depends_on", (task_id,)
        ).fetchall())
        for dependency in dependencies:
            dependency_row = connection.execute(
                "SELECT id, slug, path, status FROM tasks WHERE id = ?", (dependency,)
            ).fetchone()
            if dependency_row is None or dependency_row[3] != "done":
                raise ValueError(f"task {task_id} has unfinished dependency: {dependency}")
            dependency_slug = _safe_task_slug(dependency_row[1])
            dependency_indexed_path = Path(dependency_row[2])
            dependency_path = (root / dependency_indexed_path).resolve()
            expected_dependency_path = planning / f"{dependency_row[0]}-{dependency_row[1]}.md"
            if (dependency_indexed_path.is_absolute() or dependency_path.parent != planning.resolve() or
                    dependency_path != expected_dependency_path.resolve() or
                    _regular_file(dependency_path, "dependency Markdown") != dependency_path):
                raise ValueError("dependency indexed path does not match canonical Markdown")
            dependency_markdown = dependency_path.read_text()
            if _metadata(dependency_markdown, "Status") != dependency_row[3]:
                raise ValueError(f"dependency {dependency} SQLite and Markdown status differ")
        label_rows = connection.execute("SELECT name FROM labels").fetchall()
        db_labels = set()
        for label_row in label_rows:
            if len(label_row) != 1 or not isinstance(label_row[0], str) or not label_row[0]:
                raise ValueError("malformed SQLite label row")
            if label_row[0] in db_labels:
                raise ValueError("duplicate SQLite label")
            db_labels.add(label_row[0])
        task_label_rows = connection.execute(
            "SELECT task_id, label FROM task_labels"
        ).fetchall()
        indexed_task_ids = {item[0] for item in connection.execute("SELECT id FROM tasks").fetchall()}
        labels_by_task = {}
        seen_task_labels = set()
        for task_label_row in task_label_rows:
            if (len(task_label_row) != 2 or
                    not all(isinstance(value, str) and value for value in task_label_row)):
                raise ValueError("malformed SQLite task label row")
            label_task_id, label = task_label_row
            if label_task_id not in indexed_task_ids or label not in db_labels:
                raise ValueError("SQLite task label references an unknown record")
            if (label_task_id, label) in seen_task_labels:
                raise ValueError("duplicate SQLite task label")
            seen_task_labels.add((label_task_id, label))
            labels_by_task.setdefault(label_task_id, []).append(label)
        canonical_labels = tuple(sorted(labels_by_task.get(task_id, ())))
    except sqlite3.Error as error:
        raise ValueError("planning SQLite index is malformed") from error
    finally:
        if connection is not None:
            connection.close()
    slug = _safe_task_slug(row[1])
    indexed_path = Path(row[3])
    path = (root / indexed_path).resolve()
    expected = planning / f"{task_id}-{slug}.md"
    if (indexed_path.is_absolute() or path.parent != planning.resolve() or
            path != expected.resolve() or _regular_file(path, "task Markdown") != path):
        raise ValueError("indexed task path does not match canonical Markdown")
    markdown = path.read_text()
    title = re.search(rf"^# {task_id} — (.+)$", markdown, re.MULTILINE)
    if not title or title.group(1) != row[2]:
        raise ValueError("SQLite and Markdown task title differ")
    for field, value in (("Status", row[4]), ("Priority", row[5]), ("Summary", row[7])):
        if _metadata(markdown, field) != value:
            raise ValueError(f"SQLite and Markdown {field.lower()} differ")
    labels = _metadata(markdown, "Labels")
    if not labels.strip():
        raise ValueError("Markdown Labels metadata is empty")
    markdown_labels = tuple(sorted(item.strip() for item in labels.split(",")))
    if canonical_labels is not None and markdown_labels != canonical_labels:
        raise ValueError("SQLite and Markdown labels differ")
    listed = _metadata(markdown, "Depends on")
    markdown_dependencies = () if listed.lower() == "none" else tuple(sorted(x.strip() for x in listed.split(",")))
    if markdown_dependencies != tuple(sorted(dependencies)):
        raise ValueError("SQLite and Markdown dependencies differ")
    return Task(task_id, row[1], row[2], path, row[4], row[5], row[6], row[7], dependencies)


def _registered_worktrees(root: Path) -> set[Path]:
    return {Path(line.removeprefix("worktree ")).resolve()
            for line in _git(root, "worktree", "list", "--porcelain").splitlines()
            if line.startswith("worktree ")}


def _registered_worktree_branches(root: Path) -> dict[str, Path]:
    branches = {}
    for block in _git(root, "worktree", "list", "--porcelain").split("\n\n"):
        fields = dict(line.split(" ", 1) for line in block.splitlines() if " " in line)
        path = fields.get("worktree")
        branch = fields.get("branch")
        if path and branch and branch.startswith("refs/heads/"):
            branches[branch.removeprefix("refs/heads/")] = Path(path).resolve()
    return branches


def _reject_branch_checked_out_elsewhere(root: Path, worktree: Path, branch: str) -> None:
    registered_path = _registered_worktree_branches(root).get(branch)
    if registered_path is not None and registered_path != worktree.resolve():
        raise RuntimeError(f"task branch is already checked out at {registered_path}")


def _validate_task_worktree(root: Path, worktree: Path, task: Task) -> None:
    root = canonical_root(root)
    parent = root / ".worktrees"
    _real_directory(parent, ".worktrees")
    if worktree.is_symlink() or worktree.resolve() != worktree:
        raise RuntimeError("task worktree must not be a symlink")
    if worktree.resolve() not in _registered_worktrees(root):
        raise RuntimeError("task worktree is not registered at the exact path")
    if _git(worktree, "branch", "--show-current") != f"chore/{task.id}-{task.slug}":
        raise RuntimeError("task worktree branch is not deterministic")
    if _git(worktree, "status", "--porcelain"):
        raise RuntimeError("refusing to launch a dirty task worktree")
    if _git_common(root) != _git_common(worktree):
        raise RuntimeError("task worktree uses a different git common directory")
    base = _git(root, "rev-parse", "origin/main")
    if _git(worktree, "rev-parse", "HEAD") != base:
        raise RuntimeError("task worktree is not fresh with origin/main")


def ensure_task_worktree(root: Path, task: Task, *, create=True, creation_state=None) -> Path:
    root = canonical_root(root)
    parent = root / ".worktrees"
    branch = f"chore/{task.id}-{task.slug}"
    expected_worktree = parent / task.id
    _reject_branch_checked_out_elsewhere(root, expected_worktree, branch)
    if not parent.exists():
        if not create:
            branch_exists = subprocess.run(("git", "-C", str(root), "show-ref", "--verify",
                                            f"refs/heads/{branch}"), capture_output=True).returncode == 0
            if branch_exists and _git(root, "rev-parse", branch) != _git(root, "rev-parse", "origin/main"):
                raise RuntimeError("existing task branch is not fresh with origin/main")
            return parent / task.id
        parent.mkdir(mode=0o700)
    _real_directory(parent, ".worktrees")
    worktree = parent / task.id
    if worktree.is_symlink():
        raise RuntimeError("task worktree path must not be a symlink")
    registered = _registered_worktrees(root)
    if worktree.exists() and worktree.resolve() not in registered:
        raise RuntimeError("task worktree exists but is not registered")
    created = False
    branch_exists = False
    if worktree.resolve() not in registered:
        _reject_branch_checked_out_elsewhere(root, worktree, branch)
        if not create:
            branch_exists = subprocess.run(("git", "-C", str(root), "show-ref", "--verify",
                                            f"refs/heads/{branch}"), capture_output=True).returncode == 0
            if branch_exists and _git(root, "rev-parse", branch) != _git(root, "rev-parse", "origin/main"):
                raise RuntimeError("existing task branch is not fresh with origin/main")
            return worktree
        base = _git(root, "rev-parse", "origin/main")
        branch_exists = subprocess.run(("git", "-C", str(root), "show-ref", "--verify",
                                        f"refs/heads/{branch}"), capture_output=True).returncode == 0
        if branch_exists:
            if _git(root, "rev-parse", branch) != base:
                raise RuntimeError("existing task branch is not fresh with origin/main")
            _git_run(root, ("worktree", "add", "--quiet", str(worktree), branch), check=True)
        else:
            _git_run(root, ("worktree", "add", "--quiet", "-b", branch, str(worktree), "origin/main"), check=True)
        created = True
    try:
        _validate_task_worktree(root, worktree, task)
    except BaseException:
        if created:
            _git_run(root, ("worktree", "remove", "--force", str(worktree)), check=False)
            if not branch_exists:
                _git_run(root, ("branch", "-D", branch), check=False)
        raise
    if creation_state is not None:
        creation_state.update(worktree_created=created, branch=branch,
                              branch_created=created and not branch_exists)
    return worktree


class TaskLock:
    """Simple per-task flock plus a durable owner record."""

    def __init__(self, root: Path, task_id: str, owner: Optional[str] = None):
        self.root = Path(root).resolve()
        self.task_id = _task_id(task_id)
        self.owner = owner or uuid.uuid4().hex
        self.runtime = self.root / "tmp"
        self.path = self.runtime / f"build-lock-{self.task_id}.json"
        self.guard_path = self.runtime / f"build-lock-{self.task_id}.guard"
        self._fd = None
        self.acquired = False

    def acquire(self):
        self.runtime.mkdir(mode=0o700, exist_ok=True)
        _real_directory(self.runtime, "repository tmp")
        self._fd = os.open(self.guard_path, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            try:
                fcntl.flock(self._fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise LockContended(
                    f"task {self.task_id} is already owned; inspect {self.path} and recover explicitly"
                ) from error
            if self.path.exists():
                raise LockContended(f"task {self.task_id} is already owned; inspect {self.path} and recover explicitly")
            payload = {"task": self.task_id, "root": str(self.root), "owner": self.owner,
                       "state": "acquiring", "created_at": time.time(),
                       "recovery": "Inspect this owner record and recover explicitly with its owner token."}
            self.path.write_text(json.dumps(payload, sort_keys=True) + "\n")
            self.acquired = True
            return self
        except BaseException:
            self.close_started()
            raise

    def _payload(self):
        try:
            payload = json.loads(self.path.read_text())
        except (OSError, ValueError) as error:
            raise RuntimeError("task owner record is malformed or unavailable") from error
        if not isinstance(payload, dict) or payload.get("owner") != self.owner:
            raise RuntimeError("task lock owner token changed")
        return payload

    def update(self, **fields):
        if not self.acquired:
            return
        payload = self._payload()
        payload.update(fields)
        self.path.write_text(json.dumps(payload, sort_keys=True) + "\n")

    def mark_started(self):
        self.update(state="started")

    def preserve_started(self, *, worktree, workspace, pane, process_id, session_id):
        """Best-effort owner update after a child was already reported started."""
        if not self.acquired:
            return
        payload = self._payload()
        payload.update(state="started", worktree=str(worktree), workspace=workspace,
                       pane=pane, process_id=process_id, session_id=session_id)
        self.path.write_text(json.dumps(payload, sort_keys=True) + "\n")

    def release(self, hook=None):
        if not self.acquired:
            return
        if hook:
            hook()
        self._payload()
        self.path.unlink()
        self.close_started()

    def close_started(self):
        if self._fd is not None:
            fcntl.flock(self._fd, fcntl.LOCK_UN)
            os.close(self._fd)
            self._fd = None
        self.acquired = False

    @classmethod
    def recover(cls, root: Path, task_id: str, owner: str, *, confirm=False, quarantine=False, hook=None):
        if not confirm:
            raise RuntimeError("explicit confirmation is required for stale-owner recovery")
        lock = cls(root, task_id, owner=owner)
        lock.runtime.mkdir(mode=0o700, exist_ok=True)
        fd = os.open(lock.guard_path, os.O_RDWR | os.O_CREAT, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            payload = lock._payload()
            if hook:
                hook()
            if payload.get("owner") != owner:
                raise RuntimeError("owner token does not match the inspected task owner record")
            lock.path.unlink()
            return True
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)


def _safe_error(error) -> Optional[str]:
    if not error:
        return None
    return f"{type(error).__name__}: launcher failed"


def _setup_failure(error):
    """Return a safe setup classification and static operator guidance."""
    message = str(error).lower()
    if "config differs from the committed repository file" in message:
        return ("opencode project config drift",
                "OpenCode project config drift: restore opencode.json from the committed repository file")
    if ("project opencode config is missing" in message or
            "opencode project config is missing" in message or
            "opencode config is unavailable" in message):
        return ("opencode project config missing",
                "OpenCode project config missing: restore opencode.json from the committed repository file")
    if ("project opencode config is unreadable" in message or
            "opencode project config is unreadable" in message):
        return ("opencode project config unreadable",
                "OpenCode project config unreadable: restore opencode.json from the committed repository file")
    if ("project opencode config is malformed" in message or
            "opencode project config is malformed" in message):
        return ("opencode project config malformed",
                "OpenCode project config malformed: restore opencode.json from the committed repository file")
    if "opencode" in message or "auto-permissions" in message:
        return ("opencode plugin setup",
                "OpenCode plugin setup: install opencode-auto-permissions and verify with opencode debug config")
    if "direnv" in message or ".envrc" in message:
        return ("direnv setup",
                "direnv setup: repair the repository-controlled .envrc and run direnv allow manually")
    return (None, None)


def _record(root: Path, task: Task, worktree: Path, workspace: Optional[str], pane: Optional[str],
            result: LaunchResult, recovery: str, *, owner_state="released", lock_path=None,
            herdr_error=None, direnv_status=None, setup_guidance=None) -> Path:
    runtime = Path(root).resolve() / "tmp"
    runtime.mkdir(mode=0o700, exist_ok=True)
    record = runtime / f"local-build-{task.id}-{int(time.time())}-{uuid.uuid4().hex}.json"
    classification, inferred_guidance = _setup_failure(result.error) if result.error else (None, None)
    payload = {"task": task.id, "root": str(Path(root).resolve()), "worktree": str(worktree),
               "workspace": workspace, "pane": pane, "process_id": result.process_id,
               "session_id": result.session_id, "status": result.status,
               "error": _safe_error(result.error),
                "error_classification": classification or (type(result.error).__name__ if result.error else None),
                "owner_state": owner_state, "lock_path": str(lock_path) if lock_path else None,
                "herdr_error": herdr_error, "direnv_status": direnv_status,
                "setup_guidance": setup_guidance or inferred_guidance, "recovery": recovery}
    record.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return record


def record_interruption(root: Path, raw_id: str, stage: str) -> str:
    task_id = _task_id(raw_id)
    root = canonical_root(root)
    task = Task(task_id, "unknown", "unknown", root / "planning" / f"{task_id}.md", "todo", "unknown", 0, "unknown")
    record = _record(root, task, root / ".worktrees" / task_id,
                     None, None, LaunchResult("interrupted", error=KeyboardInterrupt()),
                     f"Interrupted during {stage}; inspect the run record before retrying.")
    return f"task {task_id} | status interrupted | run record {record}"


def _json_items(payload, keys):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in keys:
            if key in payload:
                value = payload[key]
                return value if isinstance(value, list) else _json_items(value, keys)
    return []


def _path_value(item):
    value = item.get("path", item.get("cwd", "")) if isinstance(item, dict) else ""
    return Path(value).resolve() if value else None


class HerdrAdapter:
    """Optional adapter for an already running Herdr server."""

    def __init__(self, discover, launch, panes=None, open_workspace=None):
        self._discover = discover
        self._launch = launch
        self._panes = panes
        self._open_workspace = open_workspace

    @classmethod
    def discover(cls, main_root, executable="herdr", runner=None, popen=None):
        runner = runner or subprocess.check_output

        def discover_workspaces():
            try:
                status = runner((executable, "status", "server"), text=True)
                if "running" not in status.lower() or "not running" in status.lower():
                    return None
                return _json_items(json.loads(runner((executable, "worktree", "list", "--cwd",
                                                       str(main_root), "--json"), text=True)), ("worktrees", "result"))
            except (OSError, subprocess.CalledProcessError):
                return None
            except (ValueError, TypeError) as error:
                raise HerdrProtocolError("Herdr worktree response is malformed") from error

        def panes(workspace):
            return json.loads(runner((executable, "pane", "list", "--workspace", workspace), text=True))

        def launch(command, workspace, pane, cwd, env=None):
            prefix = f"OPENCODE_CONFIG={shlex.quote(env['OPENCODE_CONFIG'])} " if env and env.get("OPENCODE_CONFIG") else ""
            return runner((executable, "pane", "send-keys", pane, prefix + shlex.join(command), "Enter"), text=True)

        def open_workspace(worktree, label):
            return json.loads(runner((executable, "worktree", "open", "--cwd", str(main_root),
                                      "--path", str(worktree), "--label", label, "--no-focus", "--json"), text=True))

        return cls(discover_workspaces, launch, panes, open_workspace)

    def available(self):
        return self._discover() is not None

    def provision(self, main_root, worktree, label):
        matches = [item for item in (self._discover() or []) if _path_value(item) == worktree.resolve()]
        if not matches:
            if self._open_workspace is None:
                raise LaunchError("exact Herdr workspace is unavailable")
            created = self._open_workspace(worktree, label)
            if isinstance(created, dict):
                direct = created.get("workspace")
                nested = created.get("result", {}).get("workspace") if isinstance(created.get("result"), dict) else None
                created = direct if isinstance(direct, dict) else nested
            matches = [created] if isinstance(created, dict) else []
        if len(matches) != 1 or _path_value(matches[0]) != worktree.resolve():
            raise LaunchError("Herdr workspace does not target the exact task worktree")
        workspace = matches[0].get("workspace_id", matches[0].get("id"))
        panes = _json_items(self._panes(workspace), ("panes", "result")) if self._panes else []
        matching = [item for item in panes if item.get("cwd", item.get("path")) and
                    _path_value(item) == worktree.resolve()]
        if len(matching) != 1:
            raise LaunchError("Herdr workspace does not have exactly one task pane")
        return workspace, matching[0].get("id", matching[0].get("pane_id"))

    def launch(self, workspace, pane, command, cwd, env=None):
        matches = [item for item in (self._discover() or [])
                   if item.get("workspace_id", item.get("id")) == workspace and _path_value(item) == cwd.resolve()]
        if len(matches) != 1:
            raise LaunchError("workspace does not target the exact task worktree")
        panes = _json_items(self._panes(workspace), ("panes", "result")) if self._panes else []
        if not any(item.get("id", item.get("pane_id")) == pane and _path_value(item) == cwd.resolve() for item in panes):
            raise LaunchError("pane does not target the exact task worktree")
        response = self._launch(command, workspace, pane, cwd, env)
        if isinstance(response, str) and response.strip().lower() in {"ok", "sent"}:
            return LaunchResult("started")
        if isinstance(response, dict) and response.get("ok") is True:
            return LaunchResult("started")
        raise HerdrProtocolError("Herdr send-keys returned no valid acknowledgement")


class SubprocessOpenCode:
    def __init__(self, popen=None):
        self._popen = popen or subprocess.Popen

    def launch(self, command, cwd, env=None):
        process = self._popen(command, cwd=str(Path(cwd).resolve()), env=env or os.environ.copy())
        return LaunchResult("started", process.pid, getattr(process, "session_id", None))


def _validate_opencode_config(root: Path, config_path: Path, *, require_committed=True) -> Path:
    root = canonical_root(root)
    config = Path(config_path).resolve()
    if config != root / "opencode.json":
        raise RuntimeError("OpenCode config must be the repository-controlled opencode.json")
    try:
        _regular_file(config, "OpenCode config")
    except RuntimeError as error:
        if isinstance(error.__cause__, FileNotFoundError):
            raise RuntimeError(
                "OpenCode project config is missing; restore opencode.json from the committed repository file"
            ) from error
        raise RuntimeError(
            "OpenCode project config is unreadable; restore opencode.json from the committed repository file"
        ) from error
    try:
        current = config.read_bytes()
    except OSError as error:
        raise RuntimeError(
            "OpenCode project config is unreadable; restore opencode.json from the committed repository file"
        ) from error
    if require_committed and current != _git_bytes(root, "show", "HEAD:opencode.json"):
        raise RuntimeError("OpenCode config differs from the committed repository file")
    return config


def _validate_launch_cwd(root: Path, worktree: Path, launch_cwd=None) -> Path:
    cwd = Path(root if launch_cwd is None else launch_cwd).resolve()
    if cwd not in {Path(root).resolve(), Path(worktree).resolve()}:
        raise RuntimeError("launch cwd must be the canonical root or exact task worktree")
    return _real_directory(cwd, "launch cwd")


def run_build(root: Path, raw_id: str, herdr=None, opencode=None, workspace=None, pane=None,
              config_path=None, launch_cwd=None, prelaunch=None, lock=None,
              canonical_revalidate=None, herdr_error=None, direnv_status=None) -> str:
    root = canonical_root(root)
    task_id = _task_id(raw_id)
    task = Task(task_id, "unknown", "unknown", root / "planning" / f"{task_id}.md", "todo", "unknown", 0, "unknown")
    worktree = root / ".worktrees" / task_id
    lock = lock or TaskLock(root, task_id)
    result = None
    try:
        task = resolve_task(root, raw_id)
        worktree = root / ".worktrees" / task.id
        if canonical_revalidate:
            canonical_revalidate()
        else:
            _revalidate_canonical_checkout(root)
        lock.acquire() if not lock.acquired else None
        worktree = ensure_task_worktree(root, task)
        if prelaunch:
            prelaunch_result = prelaunch(task, worktree)
            if prelaunch_result:
                workspace, pane, *details = prelaunch_result
                if details:
                    herdr_error = herdr_error or details[0]
                if len(details) > 1:
                    direnv_status = direnv_status or details[1]
        _validate_task_worktree(root, worktree, task)
        if config_path is not None:
            config_path = _validate_opencode_config(root, config_path)
        launch_cwd = _validate_launch_cwd(root, worktree, launch_cwd)
        prompt = (f"You are the independent BrushTales delivery orchestrator. Work from canonical root {root} "
                  f"and task worktree {worktree}. Read {task.path}, then invoke /build {task.id}. "
                  "Own the builder, adversarial review, verification, planning-index update, and approval pause; "
                  "do not edit the canonical checkout or bypass the workflow.")
        command = ("opencode", "--prompt", prompt)
        env = os.environ.copy()
        if config_path is not None:
            env["OPENCODE_CONFIG"] = str(config_path)
        if herdr is not None:
            try:
                if herdr.available():
                    if workspace is None or pane is None:
                        workspace, pane = herdr.provision(root, worktree, f"BrushTales {task.id}")
                    result = herdr.launch(workspace, pane, command, worktree, env=env)
                else:
                    herdr_error = herdr_error or "Herdr unavailable; normal local fallback used"
            except (KeyboardInterrupt, SystemExit, GeneratorExit):
                raise
            except BaseException as error:
                herdr_error = f"{type(error).__name__}: Herdr launch rejected"
        if result is None:
            launcher = opencode or SubprocessOpenCode()
            result = launcher.launch(command, launch_cwd, env=env)
        if result.status == "started":
            lock.update(worktree=str(worktree), workspace=workspace, pane=pane,
                        process_id=result.process_id, session_id=result.session_id)
            lock.mark_started()
            owner_state = "started"
            recovery = "Inspect the owner record and recover explicitly after the orchestrator exits."
            lock.close_started()
        else:
            owner_state = "released"
            recovery = "Inspect the run record, repair the launcher, and retry the task."
            lock.release()
        record = _record(root, task, worktree, workspace, pane, result, recovery,
                         owner_state=owner_state, lock_path=lock.path,
                         herdr_error=herdr_error, direnv_status=direnv_status)
        return f"task {task.id} | worktree {worktree} | workspace {workspace or 'terminal'} | status {result.status} | run record {record}"
    except (KeyboardInterrupt, SystemExit, GeneratorExit):
        if isinstance(sys.exc_info()[1], KeyboardInterrupt):
            if result is not None and result.status == "started":
                try:
                    preserve_started = getattr(lock, "preserve_started", None)
                    if preserve_started is not None:
                        preserve_started(worktree=worktree, workspace=workspace, pane=pane,
                                         process_id=result.process_id, session_id=result.session_id)
                except BaseException:
                    pass
                uncertain = LaunchResult("uncertain", process_id=result.process_id,
                                         session_id=result.session_id, error=KeyboardInterrupt())
                recovery = ("A child was reported started but owner bookkeeping was interrupted. Inspect the "
                            f"owner record at {lock.path} and the child process/session before retrying; "
                            "do not retry until the live child is confirmed and ownership is recovered explicitly.")
                record = _record(root, task, worktree, workspace, pane, uncertain, recovery,
                                 owner_state="uncertain", lock_path=lock.path,
                                 herdr_error=herdr_error, direnv_status=direnv_status)
                return (f"task {task.id} | worktree {worktree} | workspace {workspace or 'terminal'} | "
                        f"status uncertain | recovery: inspect the live child before retry | run record {record}")
            try:
                lock.close_started()
            except BaseException:
                pass
            record = _record(root, task, worktree, workspace, pane,
                             LaunchResult("interrupted", error=KeyboardInterrupt()),
                             "Interrupted; inspect the owner record and retry only after confirming its state.",
                             owner_state="uncertain", lock_path=lock.path)
            return f"task {task.id} | worktree {worktree} | status interrupted | run record {record}"
        raise
    except BaseException as error:
        if result is not None and result.status == "started":
            try:
                preserve_started = getattr(lock, "preserve_started", None)
                if preserve_started is not None:
                    preserve_started(worktree=worktree, workspace=workspace, pane=pane,
                                     process_id=result.process_id, session_id=result.session_id)
            except BaseException:
                pass
            uncertain = LaunchResult("uncertain", process_id=result.process_id,
                                     session_id=result.session_id, error=error)
            recovery = ("A child was reported started but owner bookkeeping failed. Inspect the owner record "
                        f"at {lock.path} and the child process/session before retrying; do not retry until "
                        "the live child is confirmed and ownership is recovered explicitly.")
            record = _record(root, task, worktree, workspace, pane, uncertain, recovery,
                             owner_state="uncertain", lock_path=lock.path,
                             herdr_error=herdr_error, direnv_status=direnv_status)
            return (f"task {task.id} | worktree {worktree} | workspace {workspace or 'terminal'} | "
                    f"status uncertain | recovery: inspect the live child before retry | run record {record}")
        try:
            if lock.acquired:
                lock.release()
        except BaseException:
            pass
        contended = isinstance(error, LockContended)
        _, setup_guidance = _setup_failure(error)
        status = "contended" if contended else ("interrupted" if isinstance(error, BaseException) and not isinstance(error, Exception) else "failed")
        recovery = (f"Inspect the existing owner record at {lock.path} and recover only after confirming "
                    "the owner is stale; use the explicit owner token to recover.") if contended else (
                    setup_guidance or "Repair the reported task, worktree, permissions, or launcher, then retry.")
        record = _record(root, task, worktree, workspace, pane, LaunchResult(status, error=error),
                         recovery, owner_state="contended" if contended else "released", lock_path=lock.path,
                         herdr_error=herdr_error, direnv_status=direnv_status,
                         setup_guidance=setup_guidance)
        summary_recovery = "owner-present; " + recovery if contended else (setup_guidance or "repair setup and retry")
        return f"task {task.id} | worktree {worktree} | status {status} | recovery: {summary_recovery} | run record {record}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Launch one local BrushTales planning task")
    parser.add_argument("task_id", nargs="?")
    parser.add_argument("--recover-stale")
    parser.add_argument("--owner")
    parser.add_argument("--confirm", action="store_true")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args(argv)
    try:
        root = validate_canonical_checkout(args.root)
        if args.recover_stale:
            if not args.owner or not args.confirm:
                raise RuntimeError("stale-owner recovery requires --owner and --confirm")
            TaskLock.recover(root, args.recover_stale, args.owner, confirm=True)
            print(f"released explicit owner record for task {_task_id(args.recover_stale)}")
            return 0
        if not args.task_id:
            raise ValueError("provide a task ID")
        from .build import BuildEntrypoint
        summary = BuildEntrypoint(root).run(args.task_id)
        print(summary)
        return 0 if "| status started" in summary else 1
    except KeyboardInterrupt:
        print(record_interruption(args.root, args.task_id or "0", "canonical validation"))
        return 1
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"local build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
