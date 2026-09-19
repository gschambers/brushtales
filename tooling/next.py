"""Select the next locally planned tasks without invoking external tools."""
from __future__ import annotations

import argparse
import re
import sqlite3
import stat
import sys
from dataclasses import dataclass
from pathlib import Path


MAX_LIMIT = 100
PRIORITIES = {"critical": 0, "high": 1, "medium": 2, "low": 3}
_METADATA = re.compile(r"^- \*\*(?P<name>[^:]+):\*\* (?P<value>.*)$", re.MULTILINE)
_REQUIRED_METADATA = {"Status", "Priority", "Summary", "Labels", "Depends on"}
_STATUSES = {"todo", "in_progress", "blocked", "done", "cancelled"}


@dataclass(frozen=True)
class Task:
    id: str
    slug: str
    title: str
    priority: str
    sequence: int


class MetadataError(ValueError):
    """The indexed task and its canonical Markdown disagree."""


def _metadata(markdown: str) -> dict[str, str]:
    values: dict[str, str] = {}
    counts: dict[str, int] = {}
    for match in _METADATA.finditer(markdown):
        name = match.group("name")
        counts[name] = counts.get(name, 0) + 1
        values[name] = match.group("value").strip()
    missing = _REQUIRED_METADATA - values.keys()
    duplicate = {name for name in _REQUIRED_METADATA if counts.get(name, 0) > 1}
    if missing:
        raise MetadataError(f"missing Markdown metadata: {missing}")
    if duplicate:
        raise MetadataError(f"duplicate Markdown metadata: {sorted(duplicate)}")
    return values


def _csv_metadata(value: str, field: str, *, allow_none: bool = False) -> tuple[str, ...]:
    if allow_none and value.lower() == "none":
        return ()
    if not value:
        raise MetadataError(f"empty Markdown metadata: {field}")
    values = tuple(item.strip() for item in value.split(","))
    if any(not item for item in values) or len(set(values)) != len(values):
        raise MetadataError(f"malformed Markdown metadata: {field}")
    return tuple(sorted(values))


def _task_row(row) -> tuple[str, str, str, str, str, str, int, str]:
    if len(row) != 8:
        raise MetadataError("malformed SQLite task row")
    task_id, slug, title, indexed_path, status, priority, sequence, summary = row
    text_values = (task_id, slug, title, indexed_path, status, priority, summary)
    if any(not isinstance(value, str) or not value for value in text_values):
        raise MetadataError("malformed SQLite task metadata")
    if type(sequence) is not int or sequence < 1:
        raise MetadataError("SQLite sequence is not a positive integer")
    if not re.fullmatch(r"[0-9]{3}", task_id):
        raise MetadataError("task ID is not three digits")
    if status not in _STATUSES or priority not in PRIORITIES:
        raise MetadataError("malformed SQLite task status or priority")
    return task_id, slug, title, indexed_path, status, priority, sequence, summary


def _real_planning_dir(root: Path) -> Path:
    planning = root / "planning"
    try:
        mode = planning.lstat().st_mode
    except OSError as error:
        raise MetadataError("planning directory is unavailable") from error
    if stat.S_ISLNK(mode) or not stat.S_ISDIR(mode):
        raise MetadataError("planning is not a real directory")
    return planning


def _canonical_task(
    root: Path,
    planning: Path,
    row,
    dependency_ids: tuple[str, ...],
    labels: tuple[str, ...],
) -> Task:
    task_id, slug, title, indexed_path, status, priority, sequence, summary = _task_row(row)
    expected_path = f"planning/{task_id}-{slug}.md"
    if indexed_path != expected_path:
        raise MetadataError("indexed task path is not canonical")
    path = root / indexed_path
    try:
        mode = path.lstat().st_mode
    except OSError as error:
        raise MetadataError("indexed task Markdown is missing") from error
    if stat.S_ISLNK(mode) or not stat.S_ISREG(mode) or path.parent != planning:
        raise MetadataError("indexed task Markdown is missing")
    markdown = path.read_text(encoding="utf-8")
    heading = re.search(rf"^# {re.escape(task_id)} — (.+)$", markdown, re.MULTILINE)
    if heading is None or heading.group(1) != title:
        raise MetadataError("SQLite and Markdown task title differ")
    values = _metadata(markdown)
    if any(values[field] != expected for field, expected in (
        ("Status", status), ("Priority", priority), ("Summary", summary)
    )):
        raise MetadataError("SQLite and Markdown task metadata differ")
    listed = _csv_metadata(values["Depends on"], "Depends on", allow_none=True)
    if listed != tuple(sorted(dependency_ids)):
        raise MetadataError("SQLite and Markdown dependencies differ")
    markdown_labels = _csv_metadata(values["Labels"], "Labels")
    if markdown_labels != tuple(sorted(labels)):
        raise MetadataError("SQLite and Markdown labels differ")
    return Task(task_id, slug, title, priority, int(sequence))


def select_tasks(root: Path, limit: int = 1) -> list[Task]:
    """Return validated, runnable tasks in deterministic planning order."""
    if isinstance(limit, bool) or not 1 <= limit <= MAX_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_LIMIT}")
    root = Path(root).resolve()
    planning = _real_planning_dir(root)
    database = planning / "index.sqlite3"
    try:
        database_mode = database.lstat().st_mode
    except OSError as error:
        raise MetadataError("planning index is unavailable") from error
    if stat.S_ISLNK(database_mode) or not stat.S_ISREG(database_mode):
        raise MetadataError("planning index is not a regular file")
    connection = sqlite3.connect(database)
    try:
        rows = connection.execute(
            "SELECT id, slug, title, path, status, priority, sequence, summary FROM tasks ORDER BY id"
        ).fetchall()
        dependency_rows = connection.execute(
            "SELECT task_id, depends_on FROM dependencies"
        ).fetchall()
        label_rows = connection.execute("SELECT name FROM labels").fetchall()
        task_label_rows = connection.execute("SELECT task_id, label FROM task_labels").fetchall()
    finally:
        connection.close()

    normalized_rows = [_task_row(row) for row in rows]
    for field_index, field_name in ((0, "task ID"), (1, "slug"), (3, "path"), (6, "sequence")):
        values = [row[field_index] for row in normalized_rows]
        if len(values) != len(set(values)):
            raise MetadataError(f"duplicate SQLite {field_name}")
    task_ids = {row[0] for row in normalized_rows}
    db_labels: set[str] = set()
    for label_row in label_rows:
        if len(label_row) != 1 or not isinstance(label_row[0], str) or not label_row[0]:
            raise MetadataError("malformed SQLite label row")
        if label_row[0] in db_labels:
            raise MetadataError("duplicate SQLite label")
        db_labels.add(label_row[0])
    labels_by_task: dict[str, list[str]] = {task_id: [] for task_id in task_ids}
    seen_task_labels: set[tuple[str, str]] = set()
    for task_label_row in task_label_rows:
        if len(task_label_row) != 2 or not all(isinstance(value, str) and value for value in task_label_row):
            raise MetadataError("malformed SQLite task label row")
        task_id, label = task_label_row
        if task_id not in task_ids or label not in db_labels:
            raise MetadataError("SQLite task label references an unknown record")
        if (task_id, label) in seen_task_labels:
            raise MetadataError("duplicate SQLite task label")
        seen_task_labels.add((task_id, label))
        labels_by_task[task_id].append(label)

    dependencies: dict[str, list[str]] = {row[0]: [] for row in rows}
    seen_dependencies: set[tuple[str, str]] = set()
    for dependency_row in dependency_rows:
        if len(dependency_row) != 2:
            raise MetadataError("malformed SQLite dependency row")
        task_id, depends_on = dependency_row
        if not isinstance(task_id, str) or not isinstance(depends_on, str):
            raise MetadataError("malformed SQLite dependency row")
        if task_id not in task_ids or depends_on not in task_ids:
            raise MetadataError("SQLite dependency references an unknown record")
        if (task_id, depends_on) in seen_dependencies:
            raise MetadataError("duplicate SQLite dependency")
        seen_dependencies.add((task_id, depends_on))
        dependencies[task_id].append(depends_on)

    validated: dict[str, Task] = {}
    for row in normalized_rows:
        task_id = row[0]
        validated[task_id] = _canonical_task(
            root, planning, row, tuple(dependencies[task_id]), tuple(labels_by_task[task_id])
        )

    viable: list[Task] = []
    statuses = {row[0]: row[4] for row in normalized_rows}
    for row in normalized_rows:
        if row[4] != "todo" or row[5] not in PRIORITIES:
            continue
        task_dependencies = tuple(dependencies.get(row[0], ()))
        if not task_dependencies or all(statuses.get(depends_on) == "done" for depends_on in task_dependencies):
            viable.append(validated[row[0]])
    viable.sort(key=lambda task: (PRIORITIES[task.priority], task.sequence, task.id))
    return viable[:limit]


def _limit(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("limit must be a positive integer") from error
    if not 1 <= parsed <= MAX_LIMIT:
        raise argparse.ArgumentTypeError(f"limit must be between 1 and {MAX_LIMIT}")
    return parsed


def main(argv: list[str] | None = None, *, root: Path | None = None) -> int:
    parser = argparse.ArgumentParser(prog="next", description="select viable local planning tasks")
    parser.add_argument("--limit", type=_limit, default=1, help=f"number of tasks (1-{MAX_LIMIT})")
    parser.add_argument("-q", "--quiet", action="store_true", help="print only normalized task IDs")
    try:
        arguments = parser.parse_args(argv)
    except SystemExit as error:
        return int(error.code)
    try:
        tasks = select_tasks(root or Path(__file__).resolve().parents[1], arguments.limit)
    except (OSError, sqlite3.Error, TypeError, UnicodeError, ValueError) as error:
        print(f"next: invalid planning index: {error}", file=sys.stderr)
        return 2
    if not tasks:
        print("next: no viable tasks", file=sys.stderr)
        return 1
    if arguments.quiet:
        for task in tasks:
            print(task.id)
    else:
        for task in tasks:
            print(f"{task.id} — {task.title} [{task.priority}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
