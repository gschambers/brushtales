import json
import io
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path

from tooling.local_build import (HerdrProtocolError, LaunchError, LaunchResult, HerdrAdapter,
                                 SubprocessOpenCode, canonical_root,
                                 ensure_task_worktree, resolve_task, run_build)
from tooling.build import (BuildEntrypoint, DirenvPreflight, OpenCodePreflight,
                           PermissionPolicy, MAX_BATCH_SIZE, collect_task_ids,
                           main, run_batch)


class LocalBuildTests(unittest.TestCase):
    def test_collects_pipeline_ids_and_normalizes_deduplicates(self):
        ids = collect_task_ids(["17", "003"], io.StringIO("017 3 12"))
        self.assertEqual(ids, ("017", "003", "012"))

    def test_rejects_malformed_and_over_limit_input_before_launch(self):
        with self.assertRaises(ValueError):
            collect_task_ids(["17", "oops"], io.StringIO(""))
        with self.assertRaises(ValueError):
            collect_task_ids([str(index) for index in range(1, MAX_BATCH_SIZE + 2)], io.StringIO(""))

    def test_no_argument_interactive_stdin_is_not_read(self):
        class InteractiveInput(io.StringIO):
            def isatty(self):
                return True

            def read(self, *args, **kwargs):
                raise AssertionError("interactive stdin must not be read")

        self.assertEqual(collect_task_ids([], InteractiveInput("17")), ())
        self.assertEqual(main([], stdin=InteractiveInput("17")), 1)

    def test_batch_prevalidates_all_tasks_before_any_run(self):
        calls = []

        class FakeEntrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))
                if task_id == "018":
                    raise ValueError("bad task")

            def run(self, task_id):
                calls.append(("run", task_id))
                return f"task {task_id} | status started"

        with self.assertRaises(ValueError):
            run_batch(FakeEntrypoint(), ("017", "018"))
        self.assertEqual(calls, [("validate", "017"), ("validate", "018")])

    def test_batch_runs_one_independent_session_and_propagates_failure(self):
        calls = []

        class FakeEntrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))

            def run(self, task_id):
                calls.append(("run", task_id))
                status = "failed" if task_id == "002" else "started"
                return f"task {task_id} | status {status}"

        summaries = run_batch(FakeEntrypoint(), ("001", "002", "003"))
        self.assertEqual(len(summaries), 3)
        self.assertEqual([call[0] for call in calls], ["validate"] * 3 + ["run"] * 3)
        self.assertIn("status failed", summaries[1])

    def test_batch_continues_after_launcher_exception_without_started_claim(self):
        calls = []

        class FakeEntrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))

            def run(self, task_id):
                calls.append(("run", task_id))
                if task_id == "002":
                    raise RuntimeError("launcher unavailable")
                return f"task {task_id} | status started"

        summaries = run_batch(FakeEntrypoint(), ("001", "002", "003"))
        self.assertEqual([call[0] for call in calls], ["validate"] * 3 + ["run"] * 3)
        self.assertEqual(len(summaries), 3)
        self.assertIn("task 001 | status started", summaries[0])
        self.assertIn("task 002 | status failed", summaries[1])
        self.assertIn("launcher raised", summaries[1])
        self.assertNotIn("status started", summaries[1])
        self.assertIn("task 003 | status started", summaries[2])

    def test_single_task_entrypoint_path_remains_unchanged(self):
        calls = []

        class FakeEntrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))

            def run(self, task_id):
                calls.append(("run", task_id))
                return f"task {task_id} | status started"

        self.assertEqual(run_batch(FakeEntrypoint(), ("017",)), ["task 017 | status started"])
        self.assertEqual(calls, [("validate", "017"), ("run", "017")])

    def test_main_combines_positional_and_pipeline_ids_with_fake_launcher(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            calls = []

            class FakeEntrypoint:
                def validate(self, task_id):
                    calls.append(("validate", task_id))

                def run(self, task_id):
                    calls.append(("run", task_id))
                    return f"task {task_id} | status started"

            entrypoint = FakeEntrypoint()
            status = main(["17"], root=root, stdin=io.StringIO("017"),
                          entrypoint_factory=lambda _: entrypoint)
            self.assertEqual(status, 0)
            self.assertEqual(calls, [("validate", "017"), ("run", "017")])

    def test_main_returns_nonzero_when_a_task_launch_reports_failure(self):
        calls = []

        class FakeEntrypoint:
            def validate(self, task_id):
                calls.append(("validate", task_id))

            def run(self, task_id):
                calls.append(("run", task_id))
                return f"task {task_id} | status {'failed' if task_id == '002' else 'started'}"

        status = main(["1", "2"], root=Path.cwd(),
                      entrypoint_factory=lambda _: FakeEntrypoint())
        self.assertEqual(status, 1)
        self.assertEqual(calls, [("validate", "001"), ("validate", "002"),
                                 ("run", "001"), ("run", "002")])

    def test_public_entrypoint_provisions_and_delegates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            herdr = ProvisioningHerdr()
            entrypoint = BuildEntrypoint(root, herdr=herdr, direnv=FakeDirenv(), permissions=FakePermissions(),
                                         opencode=FakeOpenCode(LaunchResult("started", 7)))
            summary = entrypoint.run("017")
            self.assertIn("status started", summary)
            self.assertEqual(herdr.provisioned[1], (root / ".worktrees/017").resolve())

    def test_envrc_is_minimal_and_safe(self):
        envrc = (Path(__file__).parents[1] / ".envrc")
        self.assertEqual(envrc.read_text(), 'PATH_add "$PWD/bin"\n')
        self.assertNotRegex(envrc.read_text(), r"(?m)\b(export|curl|wget|brew|npm|pip|source|eval)\b")

    def test_brewfile_registers_direnv(self):
        self.assertIn('brew "direnv"', (Path(__file__).parents[1] / "Brewfile").read_text())

    def test_repo_local_build_wrapper_delegates_all_arguments(self):
        wrapper = Path(__file__).parents[1] / "bin/build"
        content = wrapper.read_text()
        self.assertIn('exec "$SCRIPT_DIR/../build.sh" "$@"', content)
        self.assertTrue(wrapper.stat().st_mode & 0o111)

    def test_direnv_allows_canonical_then_exact_worktree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            self._write_matching_envrc(root)
            fake = FakeDirenv()
            DirenvPreflight(fake).ensure(root, root / ".worktrees/017")
            self.assertEqual(fake.calls, [("direnv", "allow", str(root)),
                                          ("direnv", "allow", str((root / ".worktrees/017").resolve()))])

    def test_direnv_mismatch_is_recoverable_and_never_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            worktree = root / ".worktrees/017"
            self._write_matching_envrc(root)
            (worktree / ".envrc").write_text("PATH_add elsewhere\n")
            fake = FakeDirenv()
            with self.assertRaises(RuntimeError):
                DirenvPreflight(fake).ensure(root, worktree)
            self.assertEqual(fake.calls, [])

    def test_missing_direnv_is_recoverable_without_allow(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            fake = FakeDirenv(RuntimeError("direnv: command not found"))
            summary = BuildEntrypoint(root, direnv=fake,
                                      opencode=FakeOpenCode(LaunchResult("started", 1))).run("017")
            self.assertIn("status failed", summary)
            self.assertEqual(fake.calls, [("direnv", "allow", str(root))])
            self.assertIn("direnv", summary.lower())

    def test_public_shell_delegates_to_local_layer(self):
        script = (Path(__file__).parents[1] / "build.sh").read_text()
        self.assertIn("tooling/build-local.sh", script)

    def test_public_shell_help_smoke(self):
        result = subprocess.run(["bash", str(Path(__file__).parents[1] / "build.sh"), "--help"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout.lower())

    def test_repo_local_build_wrapper_imports_from_arbitrary_cwd(self):
        root = Path(__file__).parents[1].resolve()
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([str(root / "bin/build"), "--help"], cwd=directory,
                                    capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("usage:", result.stdout.lower())

    def test_permission_policy_allows_routine_and_reviews_risky_actions(self):
        policy = PermissionPolicy()
        self.assertEqual(policy.decision("git status --porcelain"), "allow")
        self.assertEqual(policy.decision("pwd"), "allow")
        self.assertEqual(policy.decision("python -m unittest discover"), "allow")
        self.assertEqual(policy.decision("cat /etc/passwd"), "ask")
        self.assertEqual(policy.decision("find /Users/other"), "ask")
        self.assertEqual(policy.decision("git push origin main"), "ask")
        self.assertEqual(policy.decision("rm -rf build"), "ask")
        self.assertEqual(policy.decision("cat ~/.aws/credentials"), "deny")

    def test_permission_setup_failure_is_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            class BrokenPermissions:
                def ensure(self):
                    raise RuntimeError("plugin unavailable")
            summary = BuildEntrypoint(root, permissions=BrokenPermissions(),
                                      opencode=FakeOpenCode(LaunchResult("started", 1))).run("017")
            self.assertIn("status failed", summary)
            self.assertIn("run record", summary)

    def test_malformed_permission_config_is_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            config = root / "opencode.json"
            config.write_text("not json")
            summary = BuildEntrypoint(root, permissions=OpenCodePreflight(config, runner=lambda *a, **k: ""),
                                      opencode=FakeOpenCode(LaunchResult("started", 1))).run("017")
            self.assertIn("status failed", summary)
            self.assertIn("run record", summary)

    def test_plugin_preflight_is_idempotent_and_inspectable(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "opencode.json"
            runner = FakePluginRunner(["[]", "[opencode-auto-permissions]"])
            preflight = OpenCodePreflight(config, runner=runner)
            preflight.ensure()
            preflight.ensure()
            self.assertEqual(runner.installs, 1)
            self.assertIn("opencode-auto-permissions", config.read_text())

    def test_plugin_preflight_requires_effective_debug_config(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "opencode.json"
            runner = EffectiveConfigRunner("{\"plugin\": [\"opencode-auto-permissions\"]}")
            OpenCodePreflight(config, runner=runner).ensure()
            self.assertIn(("opencode", "debug", "config"), runner.calls)

    def test_plugin_preflight_asserts_add_argv_and_debug_cwd(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "opencode.json"
            runner = EffectiveConfigRunner("{\"plugin\": [\"opencode-auto-permissions\"]}")
            OpenCodePreflight(config, runner=runner).ensure()
            self.assertIn(("opencode", "plugin", "add", "opencode-auto-permissions"), runner.calls)
            self.assertIn(("opencode", "debug", "config"), runner.calls)
            self.assertEqual(runner.install_cwd, config.parent)
            self.assertEqual(runner.debug_cwd, config.parent)

    def test_plugin_preflight_rejects_misleading_string_occurrence(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "opencode.json"
            runner = EffectiveConfigRunner("{\"message\": \"opencode-auto-permissions\"}")
            with self.assertRaises(RuntimeError):
                OpenCodePreflight(config, runner=runner).ensure()

    def test_plugin_effective_verification_failure_is_actionable(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "opencode.json"
            runner = EffectiveConfigRunner("{}")
            with self.assertRaises(RuntimeError):
                OpenCodePreflight(config, runner=runner).ensure()

    def test_permission_preflight_merges_existing_rules(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "opencode.json"
            config.write_text(json.dumps({"permission": {"webfetch": "allow"}}))
            preflight = OpenCodePreflight(config, runner=lambda *args, **kwargs: '{"plugin":["opencode-auto-permissions"]}')
            preflight.ensure()
            data = json.loads(config.read_text())
            self.assertEqual(data["permission"]["webfetch"], "allow")
            self.assertEqual(data["permission"]["bash"]["git push *"], "ask")
            self.assertEqual(data["permission"]["bash"]["cat ~/.aws/*"], "deny")
            self.assertEqual(data["permission"]["bash"]["printenv *"], "ask")
            self.assertEqual(data["permission"]["external_directory"], "ask")
            config.write_text(json.dumps(data | {"permission": {**data["permission"], "external_directory": "allow"}}))
            preflight.ensure()
            self.assertEqual(json.loads(config.read_text())["permission"]["external_directory"], "ask")
            self.assertEqual(data["permission"]["bash"]["git publish *"], "ask")
            self.assertEqual(data["permission"]["bash"]["deploy *"], "ask")
            self.assertEqual(data["permission"]["bash"]["cat ~/.ssh/*"], "deny")
            keys = list(data["permission"]["bash"])
            self.assertLess(keys.index("*"), keys.index("cat ~/.aws/*"))
            self.assertNotIn("cat *", keys)
            self.assertNotIn("ls *", keys)
            self.assertNotIn("find *", keys)
            self.assertNotIn("grep *", keys)

    def test_resolves_canonical_task_metadata_from_sqlite_and_markdown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            task = resolve_task(root, "17")
            self.assertEqual(task.id, "017")
            self.assertEqual(task.title, "Demo")

    def test_reuses_exact_registered_worktree_and_herdr_pane(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            herdr = FakeHerdr(True)
            summary = run_build(root, "017", herdr=herdr, workspace="opaque-7", pane="opaque-7:p1")
            self.assertIn("status started", summary)
            self.assertEqual(herdr.call[:2], ("opaque-7", "opaque-7:p1"))
            self.assertEqual(Path(herdr.call[3]), (root / ".worktrees/017").resolve())
            self.assertNotIn("/build", herdr.call[2])

    def test_falls_back_and_records_launch_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            fallback = FakeOpenCode(LaunchResult("failed", error="not installed"))
            summary = run_build(root, "17", herdr=FakeHerdr(False), opencode=fallback)
            self.assertIn("status failed", summary)
            self.assertTrue(fallback.called)
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
            self.assertTrue(set(("task", "worktree", "workspace", "pane", "process_id", "session_id", "status", "recovery")) <= set(record))
            self.assertEqual(record["task"], "017")
            self.assertEqual(Path(record["worktree"]), (root / ".worktrees/017").resolve())

    def test_interrupted_builder_is_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            summary = run_build(root, "017", opencode=RaisingOpenCode(KeyboardInterrupt()))
            self.assertIn("status interrupted", summary)
            self.assertIn("run record", summary)

    def test_subprocess_fallback_start_is_injectable(self):
        class Process:
            pid = 42
        calls = []
        launcher = SubprocessOpenCode(lambda command, cwd, env=None: calls.append((command, cwd, env)) or Process())
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            summary = run_build(root, "017", herdr=FakeHerdr(False), opencode=launcher)
            self.assertIn("status started", summary)
            self.assertEqual(calls[0][1], (root / ".worktrees/017").resolve())

    def test_launch_receives_absolute_opencode_config_context(self):
        class Process:
            pid = 42
        calls = []
        launcher = SubprocessOpenCode(lambda command, cwd, env=None: calls.append((command, cwd, env)) or Process())
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            run_build(root, "017", herdr=FakeHerdr(False), opencode=launcher,
                      config_path=root / "opencode.json")
            self.assertEqual(calls[0][2]["OPENCODE_CONFIG"], str((root / "opencode.json").resolve()))

    def test_run_record_redacts_secret_like_error_text(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            summary = run_build(root, "017", opencode=RaisingOpenCode(RuntimeError(
                "AWS_SECRET_ACCESS_KEY=aws-secret SECRET_TOKEN=token-secret "
                "Bearer bearer-secret https://user:password-secret@example.test/path")))
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
            for secret in ("aws-secret", "token-secret", "bearer-secret", "password-secret"):
                self.assertNotIn(secret, record["error"])
            self.assertEqual(record["error"], "RuntimeError: launcher failed")
            self.assertLessEqual(len(record["error"]), 280)

    def test_invocation_from_worktree_uses_main_canonical_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            self.assertEqual(canonical_root(root / ".worktrees/017"), root)
            self.assertEqual(canonical_root(root), root)
            summary = run_build(root / ".worktrees/017", "017", opencode=FakeOpenCode(LaunchResult("started", 1)))
            self.assertIn("task 017", summary)

    def test_resolve_task_canonicalizes_public_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            self.assertEqual(resolve_task(root / ".worktrees/017", "017").path, root / "planning/017-demo.md")

    def test_dirty_worktree_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            worktree = root / ".worktrees/017"
            (worktree / "dirty.txt").write_text("do not launch")
            with self.assertRaises(RuntimeError):
                ensure_task_worktree(root, resolve_task(root, "017"))

    def test_herdr_validates_exact_workspace_and_pane_path(self):
        herdr = HerdrAdapter(lambda: [{"id": "opaque", "path": "/exact", "panes": ["opaque:p1"]}], lambda *args: None)
        with self.assertRaises(LaunchError):
            herdr.launch("opaque", "opaque:p1", ("opencode",), Path("/other"))

    def test_herdr_rejects_absent_workspace_or_pane_paths(self):
        herdr = HerdrAdapter(lambda: [{"id": "opaque", "path": ""}], lambda *args: None,
                             lambda workspace: [{"id": "opaque:p1"}])
        with self.assertRaises(LaunchError):
            herdr.launch("opaque", "opaque:p1", ("opencode",), Path.cwd())

    def test_herdr_rejects_missing_pane_path_after_valid_workspace(self):
        herdr = HerdrAdapter(lambda: [{"id": "opaque", "path": str(Path.cwd())}], lambda *args: None,
                             lambda workspace: [{"id": "opaque:p1"}])
        with self.assertRaises(LaunchError):
            herdr.launch("opaque", "opaque:p1", ("opencode",), Path.cwd())

    def test_subprocess_fallback_failure_records_recovery(self):
        launcher = SubprocessOpenCode(lambda command, cwd: (_ for _ in ()).throw(OSError("spawn failed")))
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            summary = run_build(root, "017", herdr=FakeHerdr(False), opencode=launcher)
            self.assertIn("status failed", summary)
            record = json.loads(Path(summary.rsplit("run record ", 1)[1]).read_text())
            self.assertEqual(record["status"], "failed")
            self.assertIn("recovery", record)

    def test_herdr_cli_uses_supported_discovery_and_run_argv(self):
        calls = []
        responses = iter(["running\n", '{"result": {"worktrees": [{"workspace_id": "opaque", "path": "/exact"}]}}',
                          '{"result": {"panes": [{"id": "opaque:p1", "cwd": "/exact"}]}}'])
        class Process:
            pid = 9
        def runner(argv, **kwargs):
            calls.append(argv)
            return next(responses)
        adapter = HerdrAdapter.discover(Path("/main"), executable="herdr", runner=runner,
                                        popen=lambda argv, **kwargs: calls.append(argv) or Process())
        result = adapter.launch("opaque", "opaque:p1", ("opencode", "run"), Path("/exact"))
        self.assertEqual(result.process_id, 9)
        self.assertEqual(calls[0], ("herdr", "status", "server"))
        self.assertEqual(calls[1], ("herdr", "worktree", "list", "--cwd", "/main", "--json"))
        self.assertEqual(calls[2], ("herdr", "pane", "list", "--workspace", "opaque"))
        self.assertEqual(calls[3], ("herdr", "pane", "run", "opaque:p1", "opencode run"))

    def test_herdr_pane_run_has_valid_config_assignment(self):
        calls = []
        responses = iter(["running", '{"result": {"worktrees": [{"workspace_id": "opaque", "path": "/exact"}]}}',
                          '{"result": {"panes": [{"id": "opaque:p1", "cwd": "/exact"}]}}'])
        class Process:
            pid = 9
        def runner(argv, **kwargs):
            return next(responses)
        adapter = HerdrAdapter.discover(Path("/main"), runner=runner,
                                        popen=lambda argv, **kwargs: calls.append(argv) or Process())
        adapter.launch("opaque", "opaque:p1", ("opencode", "run"), Path("/exact"),
                       env={"OPENCODE_CONFIG": "/main/opencode.json"})
        command = calls[0][4]
        self.assertTrue(command.startswith("OPENCODE_CONFIG=/main/opencode.json opencode run"))
        self.assertNotIn("'OPENCODE_CONFIG", command)

    def test_available_herdr_failure_is_recoverable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repo(Path(directory))
            class BrokenHerdr:
                def available(self):
                    raise RuntimeError("status failed")
            summary = BuildEntrypoint(root, herdr=BrokenHerdr(),
                                      opencode=FakeOpenCode(LaunchResult("started", 1))).run("017")
            self.assertIn("status failed", summary)
            self.assertIn("run record", summary)

    def test_herdr_creates_workspace_with_supported_argv(self):
        calls = []
        responses = iter(["running", '{"result": {"worktrees": []}}',
                          '{"result": {"workspace": {"workspace_id": "opaque", "path": "/exact"}}}',
                          '{"result": {"panes": [{"id": "opaque:p1", "cwd": "/exact"}]}}'])
        class Process:
            pid = 1
        def runner(argv, **kwargs):
            calls.append(argv)
            return next(responses)
        adapter = HerdrAdapter.discover(Path("/main"), runner=runner,
                                        popen=lambda argv, **kwargs: Process())
        self.assertEqual(adapter.provision(Path("/main"), Path("/exact"), "BrushTales 017"), ("opaque", "opaque:p1"))
        self.assertEqual(calls[2], ("herdr", "worktree", "open", "--cwd", "/main", "--path", "/exact", "--label", "BrushTales 017", "--no-focus", "--json"))

    def test_herdr_rejects_create_response_with_wrong_path(self):
        responses = iter(["running", '{"result": {"worktrees": []}}',
                          '{"result": {"workspace": {"workspace_id": "opaque", "path": "/wrong"}}}'])
        def runner(argv, **kwargs):
            return next(responses)
        adapter = HerdrAdapter.discover(Path("/main"), runner=runner)
        with self.assertRaises(LaunchError):
            adapter.provision(Path("/main"), Path("/exact"), "BrushTales 017")

    def test_herdr_not_running_status_is_unavailable(self):
        calls = []
        adapter = HerdrAdapter.discover(
            Path("/main"), runner=lambda argv, **kwargs: calls.append(argv) or "server not running\n"
        )
        self.assertFalse(adapter.available())
        self.assertEqual(calls, [("herdr", "status", "server")])

    def test_running_herdr_with_malformed_worktree_response_is_protocol_error(self):
        responses = iter(["running", "not-json"])
        adapter = HerdrAdapter.discover(Path("/main"), runner=lambda *args, **kwargs: next(responses))
        with self.assertRaises(HerdrProtocolError):
            adapter.available()

    @staticmethod
    def _write_matching_envrc(root):
        content = "PATH_add bin\n"
        (root / ".envrc").write_text(content)
        (root / ".worktrees/017/.envrc").write_text(content)

    @staticmethod
    def _repo(root):
        (root / "planning").mkdir(parents=True)
        database = sqlite3.connect(root / "planning/index.sqlite3")
        database.execute("CREATE TABLE tasks (id TEXT, slug TEXT, title TEXT, path TEXT, status TEXT, priority TEXT, sequence INTEGER, summary TEXT)")
        database.execute("INSERT INTO tasks VALUES ('017', 'demo', 'Demo', 'planning/017-demo.md', 'todo', 'high', 17, 'A demo task')")
        database.commit()
        database.close()
        (root / "planning/017-demo.md").write_text("# 017 — Demo\n\n- **Status:** todo\n- **Priority:** high\n- **Summary:** A demo task\n- **Labels:** tooling\n- **Depends on:** none\n")
        (root / "bin").mkdir()
        subprocess.run(["git", "init", "-q", str(root)], check=True)
        subprocess.run(["git", "-C", str(root), "branch", "-M", "main"], check=True)
        subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.com"], check=True)
        subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
        subprocess.run(["git", "-C", str(root), "add", "."], check=True)
        subprocess.run(["git", "-C", str(root), "commit", "-qm", "init"], check=True)
        worktree = root / ".worktrees/017"
        worktree.parent.mkdir()
        subprocess.run(["git", "-C", str(root), "branch", "chore/017-demo"], check=True)
        subprocess.run(["git", "-C", str(root), "worktree", "add", "-q", str(worktree), "chore/017-demo"], check=True)
        return root.resolve()


class FakeHerdr:
    def __init__(self, available):
        self._available = available
        self.call = None

    def available(self):
        return self._available

    def launch(self, workspace, pane, command, cwd, env=None):
        self.call = (workspace, pane, command, str(cwd))
        return LaunchResult("started", 12, "session-1")


class ProvisioningHerdr(FakeHerdr):
    def __init__(self):
        super().__init__(True)
        self.provisioned = None

    def provision(self, main_root, worktree, label):
        self.provisioned = (main_root, worktree, label)
        return "opaque-7", "opaque-7:p1"


class FakePermissions:
    def ensure(self):
        return None


class FakeDirenv:
    def __init__(self, error=None):
        self.error = error
        self.calls = []

    def __call__(self, argv, **kwargs):
        self.calls.append(argv)
        if self.error:
            raise self.error

    def ensure(self, root, worktree):
        self(("direnv", "allow", str(root.resolve())))
        self(("direnv", "allow", str(worktree.resolve())))


class FakePluginRunner:
    def __init__(self, listings):
        self.listings = iter(listings)
        self.installs = 0

    def __call__(self, argv, **kwargs):
        if argv[1:3] == ("debug", "config"):
            return '{"plugin": ["opencode-auto-permissions"]}'
        if "list" in argv:
            return next(self.listings)
        self.installs += 1
        return "installed"


class EffectiveConfigRunner:
    def __init__(self, effective):
        self.effective = effective
        self.calls = []
        self.install_cwd = None
        self.debug_cwd = None

    def __call__(self, argv, **kwargs):
        self.calls.append(argv)
        if argv[1:3] == ("debug", "config"):
            self.debug_cwd = kwargs.get("cwd")
            return self.effective
        if argv[1:3] == ("plugin", "add"):
            self.install_cwd = kwargs.get("cwd")
        return "installed"


class FakeOpenCode:
    def __init__(self, result):
        self.result = result
        self.called = False

    def launch(self, command, cwd, env=None):
        self.called = True
        return self.result


class RaisingOpenCode:
    def __init__(self, error):
        self.error = error

    def launch(self, command, cwd, env=None):
        raise self.error


if __name__ == "__main__":
    unittest.main()
