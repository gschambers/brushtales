#!/usr/bin/env python3
"""Disposable future-adapter contract fixture (not an app test).

This creates a temporary Git main checkout and worktree, then exercises a tiny
allowlisted fake adapter.  It proves only that adapter-generated operations are
fenced before the fake runner is called; it is not a sandbox for arbitrary code
after an accepted operation starts.  ``pathlib``/``lstat`` checks and the
path-based fake write are deterministic contract coverage only: they do not
race-test parent symlink replacement.  A production adapter must use
descriptor-relative, no-follow directory FDs (or an equivalent platform
helper) for actual writes and hashes; race/device validation remains deferred.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shlex
import stat
import subprocess
import tempfile
from typing import Any


class Rejected(ValueError):
    """An operation was rejected before the fake runner was called."""


def git(cwd: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(cwd), *args], text=True, stderr=subprocess.STDOUT
    )


def git_bytes(cwd: Path, *args: str) -> bytes:
    return subprocess.check_output(
        ["git", "-C", str(cwd), *args], stderr=subprocess.STDOUT
    )


def registered_main_root(worktree: Path) -> Path:
    """Resolve the first registered main worktree before taking snapshots."""
    entries = git(worktree, "worktree", "list", "--porcelain").splitlines()
    candidate = next(
        (line[len("worktree ") :] for line in entries if line.startswith("worktree ")),
        "",
    )
    if not candidate:
        raise Rejected("registered main worktree is unavailable")
    main = strict_preflight(Path(candidate))
    git_root = strict_preflight(Path(git(main, "rev-parse", "--show-toplevel").strip()))
    if git_root != main:
        raise Rejected(f"registered main root mismatch: {main} != {git_root}")
    return main


def strict_preflight(path: Path) -> Path:
    """Resolve an existing path without accepting symlink components or ``..``."""
    if not path.is_absolute():
        raise Rejected("path must be absolute")
    if ".." in path.parts:
        raise Rejected(f"raw parent component rejected before resolution: {path}")

    cursor = Path(path.anchor)
    for component in path.parts[1:]:
        cursor /= component
        try:
            info = cursor.lstat()
        except FileNotFoundError:
            continue
        if info.is_symlink():
            raise Rejected(f"symlinked path component: {cursor}")

    existing = path
    while not existing.exists():
        if existing == existing.parent:
            raise Rejected(f"no existing parent: {path}")
        existing = existing.parent
    resolved_existing = existing.resolve(strict=True)
    return resolved_existing / path.relative_to(existing)


def contained(path: Path, root: Path, label: str) -> Path:
    candidate = strict_preflight(path)
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise Rejected(f"{label} resolves outside worktree: {candidate}") from exc
    return candidate


class FakeAdapter:
    """A deterministic model of the future adapter's pre-Herdr fence.

    The path-based write is intentionally not a race-safe publication
    primitive.  Descriptor-relative/no-follow operations belong to the future
    production adapter and are not claimed by this fixture.
    """

    @staticmethod
    def _contains_raw_parent_component(shell: str) -> bool:
        """Reject raw parent syntax before shell parsing can reinterpret it.

        The substring check is intentional: attached shell operators (for
        example ``foo/..;``) must not turn a parent component into an ordinary
        token before the path fence sees it.
        """
        if ".." in shell:
            return True
        try:
            tokens = shlex.split(shell)
        except ValueError:
            return True
        return any(component == ".." for token in tokens for component in token.split("/"))

    def __init__(self, main: Path, worktree: Path) -> None:
        self.main = strict_preflight(main)
        self.worktree = strict_preflight(worktree)
        self.runner_calls = 0

    def run(self, operation: dict[str, Any]) -> None:
        # Reject shell syntax before resolving or invoking any command.
        shell = operation.get("shell")
        if shell and self._contains_raw_parent_component(shell):
            raise Rejected(f"shell parent traversal rejected: {shell}")

        cwd = contained(Path(operation["cwd"]), self.worktree, "cwd")
        if cwd != self.worktree:
            raise Rejected(f"cwd must equal worktree: {cwd}")
        if "spec" in operation:
            contained(Path(operation["spec"]), self.worktree, "spec")

        argv = operation.get("argv")
        if not isinstance(argv, list) or argv[:2] != ["fake-herdr-runner", "write-file"]:
            raise Rejected("operation is not allowlisted")
        output = contained(Path(argv[2]), self.worktree, "output")
        for write_path in operation.get("write_paths", []):
            if contained(Path(write_path), self.worktree, "write path") != output:
                raise Rejected("write path does not match output")

        self.runner_calls += 1
        output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        output.write_text(argv[3], encoding="utf-8")


def snapshot(main: Path) -> dict[str, Any]:
    untracked: dict[str, str] = {}
    # Porcelain v1 -z is NUL-delimited and does not quote paths.  Parsing
    # line-oriented --short output would corrupt names containing newlines,
    # tabs, or quotes.
    status = git_bytes(
        main, "status", "--porcelain=v1", "--untracked-files=all", "-z"
    )
    records = status.split(b"\0")
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record:
            continue
        if len(record) < 3 or record[2:3] != b" ":
            raise AssertionError(f"malformed porcelain status record: {record!r}")
        status_code = record[:2]
        if status_code[0:1] in (b"R", b"C") or status_code[1:2] in (b"R", b"C"):
            # Porcelain v1 -z emits the original path as the following NUL
            # record for renames/copies.  It is not a second status record.
            if index >= len(records) or not records[index]:
                raise AssertionError(f"rename/copy status missing original path: {record!r}")
            index += 1
            continue
        if status_code != b"??":
            continue
        relative = os.fsdecode(record[3:])
        if not relative:
            raise AssertionError("porcelain status reported an empty untracked path")
        path = main / relative

        # lstat and O_NOFOLLOW ensure the snapshot never hashes through a
        # symlink.  Walk existing components too, so a symlinked parent is an
        # explicit rejection rather than an alternate route to another tree.
        cursor = Path(path.anchor)
        for component in path.parts[1:]:
            cursor /= component
            try:
                info = cursor.lstat()
            except FileNotFoundError as exc:
                raise Rejected(f"untracked path disappeared: {path}") from exc
            if stat.S_ISLNK(info.st_mode):
                raise Rejected(f"symlinked untracked path: {path}")

        info = path.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise Rejected(f"symlinked untracked path: {path}")
        if not stat.S_ISREG(info.st_mode):
            continue

        no_follow = getattr(os, "O_NOFOLLOW", None)
        if no_follow is None:
            raise Rejected("platform lacks O_NOFOLLOW for safe snapshot hashing")
        try:
            descriptor = os.open(path, os.O_RDONLY | no_follow)
        except OSError as exc:
            raise Rejected(f"could not open untracked path without following symlinks: {path}") from exc
        try:
            opened = os.fstat(descriptor)
            if stat.S_ISLNK(opened.st_mode):
                raise Rejected(f"symlinked untracked path: {path}")
            if not stat.S_ISREG(opened.st_mode):
                continue
            digest = hashlib.sha256()
            with os.fdopen(descriptor, "rb") as stream:
                descriptor = -1
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
            untracked[relative] = digest.hexdigest()
        finally:
            if descriptor >= 0:
                os.close(descriptor)
    return {
        "status": status,
        "diff": git(main, "diff", "--binary", "HEAD"),
        "tree": git(main, "ls-tree", "-r", "--full-tree", "HEAD"),
        "untracked": untracked,
    }


def display(value: Any, sandbox: Path, main: Path, worktree: Path) -> Any:
    """Make output stable while retaining the rejected/resolved path evidence."""
    if isinstance(value, str):
        return (
            value.replace(str(sandbox), "<SANDBOX>")
            .replace(str(main), "<MAIN>")
            .replace(str(worktree), "<WORKTREE>")
        )
    if isinstance(value, list):
        return [display(item, sandbox, main, worktree) for item in value]
    if isinstance(value, dict):
        return {key: display(item, sandbox, main, worktree) for key, item in value.items()}
    return value


def rejected(
    name: str,
    operation: dict[str, Any],
    adapter: FakeAdapter,
    sandbox: Path,
    main: Path,
    worktree: Path,
    marker: Path,
) -> None:
    before_calls = adapter.runner_calls
    try:
        adapter.run(operation)
    except Rejected as exc:
        if adapter.runner_calls != before_calls:
            raise AssertionError(f"runner called for rejected {name}")
        if marker.exists():
            raise AssertionError(f"rejected {name} wrote marker: {marker}")
        evidence = {
            "operation": display(operation, sandbox, main, worktree),
            "resolved_paths": display(str(exc), sandbox, main, worktree),
            "runner_calls": adapter.runner_calls,
        }
        print(f"REJECT {name}: {json.dumps(evidence, sort_keys=True)}")
        return
    raise AssertionError(f"expected rejection: {name}")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="009-isolation-fixture-") as raw:
        sandbox = Path(raw)
        main_root = sandbox / "main"
        worktree = sandbox / "worktree"
        main_root.mkdir()
        git(main_root, "init", "-q")
        git(main_root, "config", "user.email", "fixture@example.invalid")
        git(main_root, "config", "user.name", "009 fixture")
        (main_root / "README.md").write_text("disposable main\n", encoding="utf-8")
        git(main_root, "add", "README.md")
        git(main_root, "commit", "-qm", "fixture baseline")
        git(main_root, "worktree", "add", "-q", "-b", "fixture-009", str(worktree), "HEAD")
        (worktree / "tmp").mkdir(mode=0o700)
        registered_main = registered_main_root(worktree)
        if registered_main != strict_preflight(main_root):
            raise AssertionError(
                f"fixture registered main differs from created main: {registered_main}"
            )
        absolute_spec = worktree / "tmp/fixture-delegation-spec.md"
        absolute_spec.write_text("disposable spec\n", encoding="utf-8")
        main_spec = main_root / "fixture-delegation-spec.md"
        main_spec.write_text("main-only negative spec\n", encoding="utf-8")

        # Exercise NUL-delimited status parsing with a path that would be
        # quoted or split by line-oriented status parsing.
        unusual = main_root / 'fixture "quoted"\tand\nnewline.md'
        unusual.write_bytes(b"pre-existing unusual path\n")
        snapshot_target = sandbox / "snapshot-target"
        snapshot_target.mkdir()
        snapshot_link = main_root / "fixture-snapshot-link"
        snapshot_link.symlink_to(snapshot_target, target_is_directory=True)
        try:
            snapshot(registered_main)
        except Rejected as exc:
            print(
                "REJECT snapshot-symlink: "
                + display(str(exc), sandbox, main_root, worktree)
            )
        else:
            raise AssertionError("snapshot followed an untracked symlink")
        finally:
            snapshot_link.unlink()

        before = snapshot(registered_main)
        adapter = FakeAdapter(registered_main, worktree)
        valid_output = worktree / "tmp/fixture-delegated-write.md"
        valid = {
            "cwd": str(worktree),
            "argv": ["fake-herdr-runner", "write-file", str(valid_output), "ok\n"],
            "write_paths": [str(valid_output)],
        }
        adapter.run(valid)
        if valid_output.read_text(encoding="utf-8") != "ok\n":
            raise AssertionError("valid feature-worktree operation had wrong content")
        if not valid_output.exists() or (main_root / "tmp/fixture-delegated-write.md").exists():
            raise AssertionError("valid artifact was not isolated to the feature worktree")
        feature_status = git(worktree, "status", "--short", "--untracked-files=all").splitlines()
        print(
            "PASS valid operation: fake runner invocations=1, "
            f"feature artifact=tmp/fixture-delegated-write.md, "
            f"feature status={json.dumps(feature_status)}"
        )

        outside = sandbox / "outside"
        outside.mkdir()
        link = worktree / "tmp/escape-link"
        link.symlink_to(outside, target_is_directory=True)
        alias = worktree / "tmp/worktree-alias"
        alias.symlink_to(main_root, target_is_directory=True)

        rejected(
            "shell-cd-parent",
            {
                "cwd": str(worktree),
                "shell": "cd .. && fake-herdr-runner write-file output ok",
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/shell-marker"), "bad\n"],
                "write_paths": [str(worktree / "tmp/shell-marker")],
            },
            adapter, sandbox, main_root, worktree, worktree / "tmp/shell-marker",
        )
        rejected(
            "shell-embedded-parent",
            {
                "cwd": str(worktree),
                "shell": "cd /tmp/../outside && fake-herdr-runner write-file output ok",
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/shell-embedded-marker"), "bad\n"],
                "write_paths": [str(worktree / "tmp/shell-embedded-marker")],
            },
            adapter, sandbox, main_root, worktree, worktree / "tmp/shell-embedded-marker",
        )
        rejected(
            "shell-parent-with-attached-operator",
            {
                "cwd": str(worktree),
                "shell": "fake-herdr-runner write-file foo/..;>/tmp/fixture-attached-marker ok",
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/shell-attached-marker"), "bad\n"],
                "write_paths": [str(worktree / "tmp/shell-attached-marker")],
            },
            adapter, sandbox, main_root, worktree, worktree / "tmp/shell-attached-marker",
        )
        rejected(
            "shell-parent-path-with-operator",
            {
                "cwd": str(worktree),
                "shell": "cd foo/../x&&fake-herdr-runner write-file output ok",
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/shell-path-marker"), "bad\n"],
                "write_paths": [str(worktree / "tmp/shell-path-marker")],
            },
            adapter, sandbox, main_root, worktree, worktree / "tmp/shell-path-marker",
        )
        rejected(
            "absolute-main",
            {
                "cwd": str(worktree),
                "argv": ["fake-herdr-runner", "write-file", str(main_root / "fixture-main-escape.md"), "bad\n"],
                "write_paths": [str(main_root / "fixture-main-escape.md")],
            },
            adapter, sandbox, main_root, worktree, main_root / "fixture-main-escape.md",
        )
        rejected(
            "absolute-outside",
            {
                "cwd": str(worktree),
                "argv": ["fake-herdr-runner", "write-file", str(outside / "fixture-absolute-escape.md"), "bad\n"],
                "write_paths": [str(outside / "fixture-absolute-escape.md")],
            },
            adapter, sandbox, main_root, worktree, outside / "fixture-absolute-escape.md",
        )
        rejected(
            "absolute-spec-main",
            {
                "cwd": str(worktree),
                "spec": str(main_spec),
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/spec-marker"), "bad\n"],
                "write_paths": [str(worktree / "tmp/spec-marker")],
            },
            adapter, sandbox, main_root, worktree, worktree / "tmp/spec-marker",
        )
        rejected(
            "parent-traversal",
            {
                "cwd": str(worktree),
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/.." / "fixture-parent-escape.md"), "bad\n"],
                "write_paths": [str(worktree / "tmp/.." / "fixture-parent-escape.md")],
            },
            adapter, sandbox, main_root, worktree, worktree / "fixture-parent-escape.md",
        )
        rejected(
            "symlink-escape",
            {
                "cwd": str(worktree),
                "argv": ["fake-herdr-runner", "write-file", str(link / "fixture-symlink-escape.md"), "bad\n"],
                "write_paths": [str(link / "fixture-symlink-escape.md")],
            },
            adapter, sandbox, main_root, worktree, outside / "fixture-symlink-escape.md",
        )
        rejected(
            "worktree-symlink",
            {
                "cwd": str(alias),
                "spec": str(alias / "delegation.md"),
                "argv": ["fake-herdr-runner", "write-file", str(worktree / "tmp/worktree-marker"), "bad\n"],
                "write_paths": [str(worktree / "tmp/worktree-marker")],
            },
            adapter, sandbox, main_root, worktree, worktree / "tmp/worktree-marker",
        )

        after = snapshot(registered_main)
        if after != before:
            raise AssertionError(f"main checkout changed: before={before!r} after={after!r}")
        if (main_root / "fixture-main-escape.md").exists():
            raise AssertionError("absolute-main rejection left a main marker")
        if not valid_output.exists() or (main_root / "tmp/fixture-delegated-write.md").exists():
            raise AssertionError("valid artifact was not isolated to the feature worktree")
        if adapter.runner_calls != 1:
            raise AssertionError(f"unexpected fake runner count: {adapter.runner_calls}")
        print("PASS main snapshot unchanged: status, diff, tree, and untracked hashes")
        print(
            "PASS 009 deterministic contract fixture: 1 valid operation; "
            "10 rejected; fake runner invocations=1; parent-symlink race/device "
            "validation deferred"
        )


if __name__ == "__main__":
    main()
