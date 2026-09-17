"""Public build orchestration kept behind the repository's build.sh wrapper."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .local_build import (HerdrAdapter, LaunchResult, _record, canonical_root,
                          ensure_task_worktree, resolve_task, run_build)


class PermissionPolicy:
    """Conservative project policy: routine work is allowed, risky work reviewed."""

    def decision(self, command: str) -> str:
        lowered = command.lower()
        if any(word in lowered for word in ("credential", "password", "secret", "api_key", ".aws/", ".ssh/")):
            return "deny"
        if any(word in lowered for word in ("rm ", "reset --hard", "clean -f", "sudo ", "git push", "git commit", "git publish", "deploy", "/tmp/", "../")):
            return "ask"
        if lowered == "pwd" or lowered.startswith(("git status ", "git diff ", "git log ", "git show ",
                                                     "python -m unittest ")):
            return "allow"
        return "ask"


class DirenvPreflight:
    """Trust only identical canonical and task-worktree .envrc files."""

    def __init__(self, runner=None):
        self.runner = runner or subprocess.run

    def ensure(self, root: Path, worktree: Path):
        canonical_envrc = root.resolve() / ".envrc"
        worktree_envrc = worktree.resolve() / ".envrc"
        if not canonical_envrc.is_file() or not worktree_envrc.is_file():
            raise RuntimeError("direnv setup requires .envrc in both the canonical checkout and exact task worktree")
        try:
            canonical_content = canonical_envrc.read_bytes()
            worktree_content = worktree_envrc.read_bytes()
        except OSError as error:
            raise RuntimeError("read both .envrc files before running direnv allow") from error
        if canonical_content != worktree_content:
            raise RuntimeError("canonical and task-worktree .envrc files must be byte-identical")
        try:
            self.runner(("direnv", "allow", str(root.resolve())), check=True)
            self.runner(("direnv", "allow", str(worktree.resolve())), check=True)
        except (OSError, subprocess.CalledProcessError) as error:
            raise RuntimeError("direnv setup failed; install direnv and retry direnv allow for both worktrees") from error


class OpenCodePreflight:
    plugin = "opencode-auto-permissions"

    def __init__(self, config: Path, runner=None, policy=None):
        self.config = config
        self.runner = runner or subprocess.check_output
        self.policy = policy or PermissionPolicy()

    def ensure(self):
        try:
            data = json.loads(self.config.read_text(encoding="utf-8")) if self.config.exists() else {}
        except (OSError, ValueError) as error:
            raise RuntimeError("project OpenCode config is unreadable; repair opencode.json and retry") from error
        if not isinstance(data, dict) or ("plugin" in data and not isinstance(data["plugin"], list)):
            raise RuntimeError("project OpenCode config has incompatible plugin shape; repair opencode.json")
        if "permission" in data and not isinstance(data["permission"], dict):
            raise RuntimeError("project OpenCode config has incompatible permission shape; repair opencode.json")
        if isinstance(data.get("permission"), dict) and "bash" in data["permission"] and not isinstance(data["permission"]["bash"], dict):
            raise RuntimeError("project OpenCode config has incompatible bash permission shape; repair opencode.json")
        declared = data.get("plugin", [])
        if self.plugin not in declared:
            try:
                self.runner(("opencode", "plugin", "add", self.plugin), cwd=self.config.parent, text=True)
            except (OSError, subprocess.CalledProcessError) as error:
                raise RuntimeError("install opencode-auto-permissions with: opencode plugin add opencode-auto-permissions") from error
        data = json.loads(self.config.read_text(encoding="utf-8")) if self.config.exists() else {}
        plugins = data.setdefault("plugin", [])
        if self.plugin not in plugins:
            plugins.append(self.plugin)
        permission = data.setdefault("permission", {})
        bash = permission.setdefault("bash", {})
        risky = ("rm *", "sudo *", "git push *", "git reset --hard*", "git clean -f*",
                 "git commit *", "cat ~/.aws/*", "cat ~/.ssh/*", "printenv *", "env *",
                 "git branch -D *", "git reset *", "git publish *", "deploy *", "curl *", "wget *")
        routine = ("git status *", "git diff *", "git log *", "git show *", "pwd",
                   "python -m unittest *")
        for pattern in ("*", *routine, *risky):
            bash.pop(pattern, None)
        bash.update({"*": "ask"})
        bash.update({pattern: self.policy.decision(pattern.rstrip("*")) for pattern in routine})
        bash.update({pattern: self.policy.decision(pattern.rstrip("*")) for pattern in risky})
        permission["external_directory"] = "ask" if permission.get("external_directory") == "allow" else permission.get("external_directory", "ask")
        self.config.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        try:
            effective = self.runner(("opencode", "debug", "config"), cwd=self.config.parent, text=True)
            parsed = json.loads(effective)
            if not isinstance(parsed, dict) or not isinstance(parsed.get("plugin"), list) or self.plugin not in parsed["plugin"]:
                raise RuntimeError("effective OpenCode config does not contain auto-permissions plugin")
        except (OSError, subprocess.CalledProcessError, ValueError) as error:
            raise RuntimeError("verify OpenCode effective config with: opencode debug config") from error


class BuildEntrypoint:
    def __init__(self, root: Path, herdr=None, permissions=None, opencode=None, direnv=None):
        self.root = canonical_root(root)
        self.herdr = herdr
        self.permissions = permissions
        self.opencode = opencode
        self.direnv = direnv

    def run(self, task_id: str) -> str:
        task = resolve_task(self.root, task_id)
        worktree = ensure_task_worktree(self.root, task)
        if self.direnv is not None:
            try:
                self.direnv.ensure(self.root, worktree)
            except Exception as error:
                record = _record(self.root, task, worktree, None, None,
                                 LaunchResult("failed", error=error),
                                 "Install or repair direnv and matching .envrc files, then rerun build.sh.")
                return (f"task {task.id} | worktree {worktree} | status failed | "
                        "recovery: install or repair direnv and matching .envrc files | "
                        f"run record {record}")
        if self.permissions is not None:
            try:
                self.permissions.ensure()
            except Exception as error:
                record = _record(self.root, task, worktree, None, None,
                                 LaunchResult("failed", error=error),
                                 "Install or repair OpenCode permissions, then rerun build.sh.")
                return f"task {task.id} | worktree {worktree} | status failed | run record {record}"
        workspace = pane = None
        if self.herdr is not None:
            try:
                herdr_available = self.herdr.available()
            except Exception as error:
                record = _record(self.root, task, worktree, None, None,
                                 LaunchResult("failed", error=error),
                                 "Check Herdr server readiness, then rerun build.sh.")
                return f"task {task.id} | worktree {worktree} | status failed | run record {record}"
            if herdr_available:
                try:
                    workspace, pane = self.herdr.provision(self.root, worktree, f"BrushTales {task.id}")
                except Exception as error:
                    record = _record(self.root, task, worktree, None, None,
                                     LaunchResult("failed", error=error),
                                     "Repair Herdr workspace/pane setup, then rerun build.sh.")
                    return f"task {task.id} | worktree {worktree} | status failed | run record {record}"
        return run_build(self.root, task.id, herdr=self.herdr, opencode=self.opencode,
                         workspace=workspace, pane=pane,
                         config_path=self.root / "opencode.json")


def main(argv=None) -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("task_id")
    args = parser.parse_args(argv)
    root = canonical_root(Path.cwd())
    permissions = OpenCodePreflight(root / "opencode.json")
    herdr = HerdrAdapter.discover(root)
    print(BuildEntrypoint(root, herdr=herdr, permissions=permissions,
                          direnv=DirenvPreflight()).run(args.task_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
