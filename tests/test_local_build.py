import contextlib
import io
import json
import os
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import tooling.build as build
import tooling.local_build as local


class FakeLauncher:
    def __init__(self, result=None):
        self.result = result or local.LaunchResult("started", 17, "session-17")
        self.calls = []

    def launch(self, command, cwd, env=None):
        self.calls.append((command, cwd, env))
        return self.result


class FakeHerdr:
    def __init__(self):
        self.calls = []
        self.provisioned = []

    def available(self):
        return True

    def provision(self, root, worktree, label):
        self.provisioned.append((root, worktree, label))
        return "workspace-17", "pane-17"

    def launch(self, workspace, pane, command, cwd, env=None):
        self.calls.append((workspace, pane, command, cwd, env))
        return local.LaunchResult("started", session_id="herdr-17")


class LocalBuildTests(unittest.TestCase):
    def test_public_build_dirty_canonical_rejection_writes_task_record(self):
        """BT018-033-002: canonical rejection remains task-scoped and recorded."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            (root / "opencode.json").write_text('{"plugin": []}\n')
            output = io.StringIO()
            errors = io.StringIO()
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                status = build.main(["017"], root=root)
            records = list((root / "tmp").glob("local-build-017-*.json"))
            record = json.loads(records[0].read_text())
        self.assertEqual(status, 1)
        self.assertIn("run record", output.getvalue())
        self.assertNotIn("Traceback", errors.getvalue())
        self.assertEqual(record["status"], "failed")
        self.assertEqual(record["root"], str(root))
        self.assertEqual(record["worktree"], str(root / ".worktrees/017"))

    def test_public_build_canonical_interrupt_writes_task_record(self):
        """BT018-033-002: public preflight KeyboardInterrupt is recoverable."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            output = io.StringIO()
            errors = io.StringIO()
            with mock.patch("tooling.build.validate_canonical_checkout", side_effect=KeyboardInterrupt()), \
                    contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                status = build.main(["017"], root=root)
            records = list((root / "tmp").glob("local-build-017-*.json"))
            record = json.loads(records[0].read_text())
        self.assertEqual(status, 1)
        self.assertIn("status interrupted", output.getvalue())
        self.assertNotIn("Traceback", errors.getvalue())
        self.assertEqual(record["status"], "interrupted")
        self.assertEqual(record["root"], str(root))
        self.assertEqual(record["worktree"], str(root / ".worktrees/017"))

    def test_quiet_selector_pipeline_normalizes_and_deduplicates_before_launch(self):
        calls = []

        class Entrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))

            def run(self, task_id):
                calls.append(("run", task_id))
                return f"task {task_id} | status started"

        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"))
            status = build.main(["17"], root=root, stdin=io.StringIO("018 017\n"),
                                entrypoint_factory=lambda _: Entrypoint())
        self.assertEqual(status, 0)
        self.assertEqual(calls, [("validate", "017"), ("validate", "018"),
                                 ("run", "017"), ("run", "018")])

    def test_batch_validation_happens_before_any_prepare_or_run(self):
        calls = []

        class Entrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))
                if task_id == "018":
                    raise ValueError("task is blocked")

            def prepare(self, task_id):
                calls.append(("prepare", task_id))

            def run(self, task_id):
                calls.append(("run", task_id))
                return f"task {task_id} | status started"

            def record_batch_setup(self, task_id, status, stage, error=None):
                return f"task {task_id} | status {status} | {stage}"

        summaries = build.run_batch(Entrypoint(), ("017", "018", "019"))
        self.assertEqual([kind for kind, _ in calls], ["validate", "validate"])
        self.assertIn("status failed", summaries[1])
        self.assertIn("status unlaunched", summaries[2])

    def test_batch_validation_rejects_stale_absent_worktree_branch_before_launch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"), worktree_ids=("017",))
            staging = root / "tmp-stale-018"
            subprocess.run(["git", "-C", str(root), "worktree", "add", "-q", str(staging), "-b",
                            "chore/018-second", "origin/main"], check=True)
            (staging / "stale.txt").write_text("stale\n")
            subprocess.run(["git", "-C", str(staging), "add", "stale.txt"], check=True)
            subprocess.run(["git", "-C", str(staging), "commit", "-qm", "stale branch"], check=True)
            subprocess.run(["git", "-C", str(root), "worktree", "remove", "--force", str(staging)], check=True)
            launcher = FakeLauncher()
            entrypoint = build.BuildEntrypoint(root, opencode=launcher)
            summaries = build.run_batch(entrypoint, ("017", "018"))
            failed_record = json.loads(Path(summaries[1].rsplit("run record ", 1)[1]).read_text())
        self.assertEqual(launcher.calls, [])
        self.assertIn("status aborted", summaries[0])
        self.assertIn("status failed", summaries[1])
        self.assertEqual(failed_record["status"], "failed")

    def test_batch_validation_rejects_branch_checked_out_at_another_path_before_launch(self):
        """BT018-033-001: alternate branch registration blocks the whole batch."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"), worktree_ids=("017",))
            alternate = root / "tmp-alternate-018"
            subprocess.run(["git", "-C", str(root), "worktree", "add", "-q", str(alternate),
                            "-b", "chore/018-second", "origin/main"], check=True)
            launcher = FakeLauncher()
            entrypoint = build.BuildEntrypoint(root, opencode=launcher)
            summaries = build.run_batch(entrypoint, ("017", "018"))
            failed_record = json.loads(Path(summaries[1].rsplit("run record ", 1)[1]).read_text())
        self.assertEqual(launcher.calls, [])
        self.assertIn("status aborted", summaries[0])
        self.assertIn("status failed", summaries[1])
        self.assertEqual(failed_record["status"], "failed")

    def test_batch_preparation_rejects_absent_second_worktree_before_launch(self):
        """BT018-035-001: ordinary setup failure is discovered before any launch."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"), worktree_ids=("017",))
            launcher = FakeLauncher()
            original = local.ensure_task_worktree

            def fail_second_creation(root_arg, task, *, create=True, creation_state=None):
                if task.id == "018" and create:
                    self.assertFalse((root / ".worktrees" / "018").exists())
                    raise OSError("permission denied creating task worktree")
                return original(root_arg, task, create=create, creation_state=creation_state)

            entrypoint = build.BuildEntrypoint(root, opencode=launcher)
            with mock.patch("tooling.build.ensure_task_worktree", side_effect=fail_second_creation):
                summaries = build.run_batch(entrypoint, ("017", "018"))

        self.assertEqual(launcher.calls, [])
        self.assertIn("status aborted", summaries[0])
        self.assertIn("status failed", summaries[1])


    def test_direct_resolver_rejects_sqlite_markdown_label_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            connection = sqlite3.connect(root / "planning/index.sqlite3")
            connection.commit()
            connection.close()
            task_path = root / "planning/017-demo.md"
            task_path.write_text(task_path.read_text().replace("**Labels:** tooling", "**Labels:** orchestration"))
            with self.assertRaisesRegex(ValueError, "labels"):
                local.resolve_task(root, "017")

    def test_direct_resolver_rejects_indexed_markdown_traversal(self):
        """BT018-035-004: indexed task paths stay in the canonical planning directory."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            task_path = root / "planning/017-demo.md"
            outside = root / "outside.md"
            outside.write_text(task_path.read_text())
            connection = sqlite3.connect(root / "planning/index.sqlite3")
            connection.execute(
                "UPDATE tasks SET slug = ?, path = ? WHERE id = ?",
                ("..//../../outside", "planning/017-..//../../outside.md", "017"),
            )
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "canonical|slug|path"):
                local.resolve_task(root, "017")

    def test_missing_plugin_setup_guidance_is_preserved_in_summary_and_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            (root / "opencode.json").write_text('{"plugin": []}\n')
            subprocess.run(["git", "-C", str(root), "add", "opencode.json"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "remove plugin"], check=True)
            subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", "HEAD"], check=True)
            permissions = build.OpenCodePreflight(root / "opencode.json", repository_root=root)
            summary = build.BuildEntrypoint(root, permissions=permissions, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("opencode-auto-permissions", summary)
        self.assertIn("opencode debug config", summary)
        self.assertIn("plugin", record["error_classification"])
        self.assertIn("opencode-auto-permissions", record["setup_guidance"])
        self.assertNotIn("plugin []", json.dumps(record))

    def test_committed_opencode_config_drift_has_restore_guidance(self):
        """BT018-033-004: committed config drift is not plugin-install failure."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            (root / "opencode.json").write_text('{"plugin": []}\n')
            permissions = build.OpenCodePreflight(root / "opencode.json", repository_root=root)
            summary = build.BuildEntrypoint(root, permissions=permissions, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("restore", summary.lower())
        self.assertEqual(record["error_classification"], "opencode project config drift")
        self.assertIn("restore opencode.json", record["setup_guidance"])
        self.assertNotIn("install opencode-auto-permissions", record["setup_guidance"])

    def test_missing_opencode_config_has_restore_guidance_in_record(self):
        """BT018-036-002: missing project config is not plugin setup."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            (root / "opencode.json").unlink()
            permissions = build.OpenCodePreflight(root / "opencode.json", repository_root=root)
            summary = build.BuildEntrypoint(root, permissions=permissions, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertEqual(record["error_classification"], "opencode project config missing")
        self.assertIn("restore opencode.json", record["setup_guidance"])
        self.assertNotIn("install opencode-auto-permissions", record["setup_guidance"])

    def test_malformed_opencode_config_has_restore_guidance_in_record(self):
        """BT018-036-002: malformed project config is classified separately."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            (root / "opencode.json").write_text("{not-json\n")
            subprocess.run(["git", "-C", str(root), "add", "opencode.json"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "malformed config"], check=True)
            subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", "HEAD"], check=True)
            permissions = build.OpenCodePreflight(root / "opencode.json", repository_root=root)
            summary = build.BuildEntrypoint(root, permissions=permissions, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertEqual(record["error_classification"], "opencode project config malformed")
        self.assertIn("restore opencode.json", record["setup_guidance"])
        self.assertNotIn("install opencode-auto-permissions", record["setup_guidance"])

    def test_opencode_config_setup_failures_are_classified_before_plugin_failures(self):
        """BT018-036-002: config repair guidance is distinct from plugin guidance."""
        config_failures = (
            ("OpenCode project config is missing", "opencode project config missing"),
            ("OpenCode project config is unreadable", "opencode project config unreadable"),
            ("OpenCode project config is malformed", "opencode project config malformed"),
            ("OpenCode config differs from the committed repository file", "opencode project config drift"),
        )
        for message, classification in config_failures:
            with self.subTest(message=message):
                actual_classification, guidance = local._setup_failure(RuntimeError(message))
                self.assertEqual(actual_classification, classification)
                self.assertIn("restore opencode.json", guidance)
                self.assertNotIn("install opencode-auto-permissions", guidance)
        classification, guidance = local._setup_failure(
            RuntimeError("opencode-auto-permissions is missing from the valid project config")
        )
        self.assertEqual(classification, "opencode plugin setup")
        self.assertIn("install opencode-auto-permissions", guidance)

    def test_ineffective_plugin_setup_guidance_is_preserved_in_summary_and_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            permissions = build.OpenCodePreflight(
                root / "opencode.json",
                runner=lambda argv, **kwargs: '{"plugin": []}',
                repository_root=root,
            )
            summary = build.BuildEntrypoint(root, permissions=permissions, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("opencode-auto-permissions", summary)
        self.assertIn("opencode debug config", summary)
        self.assertIn("plugin", record["error_classification"])
        self.assertIn("opencode-auto-permissions", record["setup_guidance"])

    def test_invalid_direnv_setup_guidance_is_preserved_in_summary_and_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            external = root / "external-envrc"
            external.write_text("export BRUSH=1\n")
            (root / ".envrc").symlink_to(external)
            subprocess.run(["git", "-C", str(root), "add", ".envrc", "external-envrc"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "add envrc"], check=True)
            subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", "HEAD"], check=True)
            direnv = build.DirenvPreflight()
            summary = build.BuildEntrypoint(root, direnv=direnv, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("direnv", summary.lower())
        self.assertIn("repository-controlled", summary.lower())
        self.assertIn("direnv", record["error_classification"])
        self.assertIn("direnv allow", record["setup_guidance"])

    def test_resolver_reports_sqlite_open_failure_without_unbound_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            with mock.patch("sqlite3.connect", side_effect=sqlite3.OperationalError(
                    "unable to open database file")):
                with self.assertRaisesRegex(ValueError, "planning SQLite index"):
                    local.resolve_task(root, "017")

    def test_herdr_without_descriptor_protocol_is_targeted_before_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            herdr = FakeHerdr()
            fallback = FakeLauncher()
            summary = local.run_build(root, "017", herdr=herdr, opencode=fallback)
        self.assertIn("status started", summary)
        self.assertEqual(len(herdr.calls), 1)
        self.assertEqual(fallback.calls, [])
        self.assertIn("/build 017", herdr.calls[0][2][2])

    def test_fallback_uses_authoritative_project_config_not_snapshot_machinery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            fallback = FakeLauncher()
            summary = local.run_build(root, "017", opencode=fallback,
                                     config_path=root / "opencode.json")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("status started", summary)
        self.assertEqual(fallback.calls[0][2]["OPENCODE_CONFIG"], str(root / "opencode.json"))
        self.assertIsNone(record.get("config_snapshot"))

    def test_missing_direnv_is_guidance_and_does_not_block_normal_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            summary = build.BuildEntrypoint(
                root, direnv=build.DirenvPreflight(), opencode=FakeLauncher()
            ).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("status started", summary)
        self.assertIn("direnv", record["direnv_status"].lower())
        self.assertIn("manual", record["direnv_status"].lower())

    def test_task_metadata_and_dependencies_are_prevalidated(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"), dependency=("018", "017"))
            with self.assertRaisesRegex(ValueError, "dependency|unfinished"):
                local.resolve_task(root, "018")
            self.assertEqual(local.resolve_task(root, "017").id, "017")

    def test_worktree_is_created_from_origin_main_with_deterministic_branch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            task = local.resolve_task(root, "017")
            worktree = local.ensure_task_worktree(root, task)
            self.assertEqual(worktree, root / ".worktrees/017")
            self.assertEqual(local._git(worktree, "branch", "--show-current"), "chore/017-demo")
            self.assertEqual(local._git(worktree, "rev-parse", "HEAD"),
                             local._git(root, "rev-parse", "origin/main"))

    def test_existing_branch_survives_post_add_validation_failure(self):
        """BT018-036-001: rollback removes only branches created by this invocation."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            branch = "chore/017-demo"
            subprocess.run(["git", "-C", str(root), "branch", branch, "origin/main"], check=True)
            task = local.resolve_task(root, "017")
            with mock.patch("tooling.local_build._validate_task_worktree",
                            side_effect=RuntimeError("post-add validation failed")):
                with self.assertRaisesRegex(RuntimeError, "post-add validation"):
                    local.ensure_task_worktree(root, task)
            self.assertEqual(local._git(root, "rev-parse", branch),
                             local._git(root, "rev-parse", "origin/main"))
            self.assertFalse((root / ".worktrees" / "017").exists())

    def test_task_lock_contention_and_explicit_recovery_guidance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = local.TaskLock(root, "017", owner="first").acquire()
            try:
                with self.assertRaisesRegex(RuntimeError, "already owned|recovery"):
                    local.TaskLock(root, "017", owner="second").acquire()
                with self.assertRaisesRegex(RuntimeError, "confirmation"):
                    local.TaskLock.recover(root, "017", "first")
                first.close_started()
                self.assertTrue(local.TaskLock.recover(root, "017", "first", confirm=True))
            finally:
                first.close_started()

    def test_run_build_records_contended_owner_without_claiming_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            first = local.TaskLock(root, "017", owner="first").acquire()
            try:
                summary = local.run_build(
                    root, "017", opencode=FakeLauncher(),
                    lock=local.TaskLock(root, "017", owner="second"),
                    canonical_revalidate=lambda: None,
                )
                record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
            finally:
                first.close_started()
        self.assertIn("owner-present", summary)
        self.assertIn("inspect the existing owner record", summary.lower())
        self.assertIn("recover only after confirming the owner is stale", summary.lower())
        self.assertEqual(record["owner_state"], "contended")
        self.assertIn("recover only after confirming the owner is stale", record["recovery"].lower())
        self.assertNotIn("already owned", record["error"] or "")

    def test_canonical_dirty_guard_rejects_staged_tmp_prefix_lookalike(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            path = root / "tmpfile"
            path.write_text("changed\n")
            subprocess.run(["git", "-C", str(root), "add", "tmpfile"], check=True)
            with self.assertRaisesRegex(RuntimeError, "clean"):
                local.validate_canonical_checkout(root, fetch=False)

    def test_canonical_dirty_guard_rejects_unstaged_worktrees_prefix_lookalike(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            path = root / ".worktrees-file"
            path.write_text("changed\n")
            with self.assertRaisesRegex(RuntimeError, "clean"):
                local.validate_canonical_checkout(root, fetch=False)

    def test_existing_task_worktree_must_be_exactly_at_origin_main(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            worktree = root / ".worktrees/017"
            (worktree / "unrelated.txt").write_text("unrelated\n")
            subprocess.run(["git", "-C", str(worktree), "add", "unrelated.txt"], check=True)
            subprocess.run(["git", "-C", str(worktree), "commit", "-qm", "unrelated"], check=True)
            task = local.resolve_task(root, "017")
            with self.assertRaisesRegex(RuntimeError, "fresh"):
                local.ensure_task_worktree(root, task)

    def test_dependency_markdown_status_must_match_done_sqlite_status(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"),
                              dependency=("018", "017"))
            dependency = root / "planning/017-demo.md"
            dependency.write_text(dependency.read_text().replace("**Status:** todo", "**Status:** in_progress"))
            connection = sqlite3.connect(root / "planning/index.sqlite3")
            connection.execute("UPDATE tasks SET status = 'done' WHERE id = '017'")
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "dependency.*status"):
                local.resolve_task(root, "018")

    def test_opencode_preflight_is_check_only_and_requires_declared_plugin(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            before = (root / "opencode.json").read_bytes()
            runner = lambda argv, **kwargs: '{"plugin":["opencode-auto-permissions"]}'
            preflight = build.OpenCodePreflight(root / "opencode.json", runner=runner,
                                                repository_root=root)
            preflight.ensure()
            self.assertEqual((root / "opencode.json").read_bytes(), before)
            (root / "opencode.json").write_text('{"plugin": []}\n')
            with self.assertRaisesRegex(RuntimeError, "missing|plugin|committed"):
                preflight.ensure()

    def test_opencode_preflight_rejects_malformed_committed_plugin_shapes(self):
        """BT018-034-001: committed plugin must be an array of strings."""
        malformed_values = (
            '"opencode-auto-permissions"',
            '{"name":"opencode-auto-permissions"}',
            "null",
            '["opencode-auto-permissions", 7]',
        )
        for plugin_value in malformed_values:
            with self.subTest(plugin_value=plugin_value), tempfile.TemporaryDirectory() as directory:
                root = self._repo(Path(directory), worktree_ids=())
                (root / "opencode.json").write_text(f'{{"plugin":{plugin_value}}}\n')
                subprocess.run(["git", "-C", str(root), "add", "opencode.json"], check=True)
                subprocess.run(["git", "-C", str(root), "commit", "-qm", "malformed plugin"], check=True)
                subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", "HEAD"], check=True)
                preflight = build.OpenCodePreflight(
                    root / "opencode.json",
                    runner=lambda argv, **kwargs: '{"plugin":["opencode-auto-permissions"]}',
                    repository_root=root,
                )
                with self.assertRaisesRegex(RuntimeError, "plugin|array|strings|install"):
                    preflight.ensure()

    def test_opencode_preflight_rejects_malformed_effective_plugin_shapes(self):
        """BT018-034-001: effective config uses the same strict plugin shape check."""
        malformed_values = (
            '"opencode-auto-permissions"',
            '{"name":"opencode-auto-permissions"}',
            "null",
            '["opencode-auto-permissions", 7]',
        )
        for plugin_value in malformed_values:
            with self.subTest(plugin_value=plugin_value), tempfile.TemporaryDirectory() as directory:
                root = self._repo(Path(directory), worktree_ids=())
                preflight = build.OpenCodePreflight(
                    root / "opencode.json",
                    runner=lambda argv, value=plugin_value, **kwargs: f'{{"plugin":{value}}}',
                    repository_root=root,
                )
                with self.assertRaisesRegex(RuntimeError, "plugin|array|strings|effective"):
                    preflight.ensure()

    def test_malformed_plugin_failure_keeps_guidance_and_redacts_shape(self):
        """BT018-034-001: malformed setup is actionable without recording config data."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            (root / "opencode.json").write_text('{"plugin":{"secret":"do-not-record"}}\n')
            subprocess.run(["git", "-C", str(root), "add", "opencode.json"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "malformed plugin"], check=True)
            subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", "HEAD"], check=True)
            permissions = build.OpenCodePreflight(
                root / "opencode.json",
                runner=lambda argv, **kwargs: '{"plugin":["opencode-auto-permissions"]}',
                repository_root=root,
            )
            summary = build.BuildEntrypoint(root, permissions=permissions, opencode=FakeLauncher()).run("017")
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertIn("opencode-auto-permissions", summary)
        self.assertIn("install", record["setup_guidance"])
        self.assertNotIn("do-not-record", json.dumps(record))

    def test_direct_resolver_requires_canonical_planning_schema(self):
        """BT018-034-002: direct build resolution matches the selector schema contract."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=())
            connection = sqlite3.connect(root / "planning/index.sqlite3")
            connection.execute("DROP TABLE dependencies")
            connection.execute("DROP TABLE labels")
            connection.execute("DROP TABLE task_labels")
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "schema|table|dependencies|labels"):
                local.resolve_task(root, "017")

    def test_herdr_cli_submits_tui_command_with_explicit_enter(self):
        calls = []
        responses = iter([
            "running",
            '{"worktrees":[{"id":"workspace-17","path":"/task"}]}',
            '{"panes":[{"id":"pane-17","cwd":"/task"}]}',
            "sent",
        ])

        def runner(argv, **kwargs):
            calls.append(argv)
            return next(responses)

        adapter = local.HerdrAdapter.discover(Path("/main"), runner=runner)
        result = adapter.launch("workspace-17", "pane-17", ("opencode", "--prompt", "hello"),
                                Path("/task"))
        self.assertEqual(result.status, "started")
        self.assertEqual(calls[-1][-1], "Enter")
        self.assertIn("--prompt hello", calls[-1][-2])

    def test_herdr_nested_workspace_open_response_is_targeted_and_submitted(self):
        """BT018-035-002: documented result.workspace responses are supported."""
        worktree = Path("/task")
        opened = []
        sends = []

        def discover():
            return list(opened)

        def open_workspace(path, label):
            workspace = {"workspace_id": "workspace-17", "path": str(path)}
            opened.append(workspace)
            return {"result": {"workspace": workspace}}

        def panes(workspace):
            return {"panes": [{"id": "pane-17", "cwd": str(worktree)}]}

        def send(command, workspace, pane, cwd, env=None):
            sends.append((command, workspace, pane, cwd, env))
            return "sent"

        adapter = local.HerdrAdapter(discover, send, panes, open_workspace)
        workspace, pane = adapter.provision(Path("/main"), worktree, "BrushTales 017")
        result = adapter.launch(workspace, pane, ("opencode", "--prompt", "hello"), worktree)

        self.assertEqual((workspace, pane), ("workspace-17", "pane-17"))
        self.assertEqual(result.status, "started")
        self.assertEqual(sends[0][2], "pane-17")


    def test_run_record_is_redacted_and_contains_recovery_context(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            failing = FakeLauncher(local.LaunchResult("failed", error=RuntimeError(
                "AWS_SECRET_ACCESS_KEY=secret-value bearer-token")))
            summary = local.run_build(root, "017", opencode=failing)
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
        self.assertEqual(record["status"], "failed")
        self.assertNotIn("secret-value", json.dumps(record))
        self.assertIn("recovery", record)
        self.assertEqual(record["root"], str(root))

    def test_interruption_writes_a_recoverable_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))

            class Interrupting:
                def launch(self, command, cwd, env=None):
                    raise KeyboardInterrupt()

            summary = local.run_build(root, "017", opencode=Interrupting())
            self.assertIn("status interrupted", summary)
            self.assertIn("run record", summary)

    def test_post_launch_bookkeeping_failure_preserves_uncertain_owner(self):
        """BT018-035-003: a started child is never reported as an ordinary failure."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), worktree_ids=("017",))
            lock = local.TaskLock(root, "017", owner="owner-17")
            launcher = FakeLauncher(local.LaunchResult("started", 91, "session-91"))
            try:
                with mock.patch.object(lock, "update", side_effect=OSError("owner record write failed")):
                    summary = local.run_build(root, "017", opencode=launcher, lock=lock)
                record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
                owner = json.loads(lock.path.read_text())
            finally:
                if lock.acquired:
                    lock.release()

        self.assertIn("status uncertain", summary)
        self.assertIn("inspect", summary.lower())
        self.assertEqual(record["status"], "uncertain")
        self.assertEqual(record["process_id"], 91)
        self.assertEqual(record["session_id"], "session-91")
        self.assertEqual(record["owner_state"], "uncertain")
        self.assertEqual(owner["state"], "started")
        self.assertEqual(owner["process_id"], 91)
        self.assertIn("do not retry", record["recovery"].lower())

    def test_handled_launcher_interruption_stops_production_batch(self):
        """BT018-033-003: handled interruption leaves later tasks unlaunched."""
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory), task_ids=("017", "018"), worktree_ids=("017", "018"))

            class InterruptFirst:
                def __init__(self):
                    self.calls = []

                def launch(self, command, cwd, env=None):
                    self.calls.append((command, cwd, env))
                    if len(self.calls) == 1:
                        raise KeyboardInterrupt()
                    return local.LaunchResult("started")

            launcher = InterruptFirst()
            entrypoint = build.BuildEntrypoint(root, opencode=launcher)
            summaries = build.run_batch(entrypoint, ("017", "018"))
            remaining_record = json.loads(Path(summaries[1].rsplit("run record ", 1)[1]).read_text())
        self.assertEqual(len(launcher.calls), 1)
        self.assertIn("status interrupted", summaries[0])
        self.assertIn("status unlaunched", summaries[1])
        self.assertEqual(remaining_record["status"], "unlaunched")

    @staticmethod
    def _repo(root, task_ids=("017",), worktree_ids=None, dependency=None):
        if worktree_ids is None:
            worktree_ids = task_ids
        root.mkdir(parents=True, exist_ok=True)
        planning = root / "planning"
        planning.mkdir()
        database = sqlite3.connect(planning / "index.sqlite3")
        database.execute("CREATE TABLE tasks (id TEXT, slug TEXT, title TEXT, path TEXT, status TEXT, priority TEXT, sequence INTEGER, summary TEXT)")
        database.execute("CREATE TABLE dependencies (task_id TEXT, depends_on TEXT)")
        database.execute("CREATE TABLE labels (name TEXT PRIMARY KEY)")
        database.execute("CREATE TABLE task_labels (task_id TEXT, label TEXT)")
        for index, task_id in enumerate(task_ids):
            slug = "demo" if task_id == "017" else "second"
            title = "Demo" if task_id == "017" else "Second"
            summary = "A demo task" if task_id == "017" else "A second task"
            database.execute("INSERT INTO tasks VALUES (?, ?, ?, ?, 'todo', 'high', ?, ?)",
                             (task_id, slug, title, f"planning/{task_id}-{slug}.md", int(task_id), summary))
            (planning / f"{task_id}-{slug}.md").write_text(
                f"# {task_id} — {title}\n\n- **Status:** todo\n- **Priority:** high\n"
                f"- **Summary:** {summary}\n- **Labels:** tooling\n- **Depends on:** none\n"
            )
            database.execute("INSERT OR IGNORE INTO labels VALUES ('tooling')")
            database.execute("INSERT INTO task_labels VALUES (?, 'tooling')", (task_id,))
        if dependency:
            database.execute("INSERT INTO dependencies VALUES (?, ?)", dependency)
            task_path = planning / "018-second.md"
            task_path.write_text(task_path.read_text().replace("**Depends on:** none", "**Depends on:** 017"))
        database.commit()
        database.close()
        (root / "opencode.json").write_text('{"plugin":["opencode-auto-permissions"]}\n')
        agent = root / ".opencode/agents/orchestrator.md"
        agent.parent.mkdir(parents=True)
        agent.write_bytes((Path(__file__).parents[1] / ".opencode/agents/orchestrator.md").read_bytes())
        subprocess.run(["git", "init", "-q", str(root)], check=True)
        subprocess.run(["git", "-C", str(root), "branch", "-M", "main"], check=True)
        subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.com"], check=True)
        subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
        subprocess.run(["git", "-C", str(root), "add", "."], check=True)
        subprocess.run(["git", "-C", str(root), "commit", "-qm", "init"], check=True)
        subprocess.run(["git", "-C", str(root), "update-ref", "refs/remotes/origin/main", "HEAD"], check=True)
        for task_id in worktree_ids:
            slug = "demo" if task_id == "017" else "second"
            worktree = root / ".worktrees" / task_id
            worktree.parent.mkdir(exist_ok=True)
            subprocess.run(["git", "-C", str(root), "branch", f"chore/{task_id}-{slug}"], check=True)
            subprocess.run(["git", "-C", str(root), "worktree", "add", "-q", str(worktree),
                            f"chore/{task_id}-{slug}"], check=True)
        return root.resolve()


if __name__ == "__main__":
    unittest.main()
