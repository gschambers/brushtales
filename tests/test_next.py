import contextlib
import io
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tooling.next import MetadataError, main, select_tasks


class NextSelectorTests(unittest.TestCase):
    def test_orders_viable_tasks_and_filters_status_and_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "low", 4, "Low task")
            self._task(root, "002", "critical", 9, "Critical task")
            self._task(root, "003", "high", 1, "Blocked task", depends_on=("004",))
            self._task(root, "004", "high", 2, "Unfinished dependency", status="in_progress")
            self._task(root, "005", "high", 3, "Earlier high task")
            self.assertEqual([task.id for task in select_tasks(root, 10)], ["002", "005", "001"])

    def test_selector_closes_sqlite_connection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Closable task")
            real_connection = sqlite3.connect(root / "planning/index.sqlite3")

            class TrackingConnection:
                def __init__(self, connection):
                    self.connection = connection
                    self.closed = False

                def __enter__(self):
                    return self

                def __exit__(self, *args):
                    return False

                def execute(self, *args):
                    return self.connection.execute(*args)

                def close(self):
                    self.closed = True
                    self.connection.close()

            tracked = TrackingConnection(real_connection)
            with mock.patch("tooling.next.sqlite3.connect", return_value=tracked):
                select_tasks(root)
            self.assertTrue(tracked.closed)

    def test_rejects_sqlite_markdown_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Indexed title")
            drifted = root / "planning/001-indexed-title.md"
            drifted.write_text(
                drifted.read_text().replace("Indexed title", "Different title"),
                encoding="utf-8",
            )
            with self.assertRaises(MetadataError):
                select_tasks(root, 1)

    def test_rejects_symlinked_planning_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Outside task")
            planning = root / "planning"
            external = root / "external-planning"
            planning.rename(external)
            planning.symlink_to(external, target_is_directory=True)
            with self.assertRaises(MetadataError):
                select_tasks(root)

    def test_rejects_symlinked_task_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Linked task")
            task = root / "planning/001-linked-task.md"
            external = root / "outside.md"
            external.write_text(task.read_text(encoding="utf-8"), encoding="utf-8")
            task.unlink()
            task.symlink_to(external)
            with self.assertRaises(MetadataError):
                select_tasks(root)

    def test_rejects_duplicate_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Duplicate metadata")
            task = root / "planning/001-duplicate-metadata.md"
            task.write_text(task.read_text(encoding="utf-8") + "- **Summary:** conflicting\n", encoding="utf-8")
            with self.assertRaises(MetadataError):
                select_tasks(root)

    def test_rejects_missing_or_duplicate_labels(self):
        for replacement in ("", "- **Labels:** other\n- **Labels:** duplicate\n"):
            with self.subTest(replacement=replacement), tempfile.TemporaryDirectory() as directory:
                root = self._repository(Path(directory))
                self._task(root, "001", "high", 1, "Invalid labels")
                task = root / "planning/001-invalid-labels.md"
                content = task.read_text(encoding="utf-8")
                content = content.replace("- **Labels:** test\n", replacement)
                task.write_text(content, encoding="utf-8")
                with self.assertRaises(MetadataError):
                    select_tasks(root)

    def test_rejects_malformed_sqlite_sequence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Malformed sequence")
            connection = sqlite3.connect(root / "planning/index.sqlite3")
            connection.execute("UPDATE tasks SET sequence = 'not-an-integer'")
            connection.commit()
            connection.close()
            with self.assertRaises(MetadataError):
                select_tasks(root)

    def test_malformed_index_is_controlled_cli_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Malformed CLI sequence")
            connection = sqlite3.connect(root / "planning/index.sqlite3")
            connection.execute("UPDATE tasks SET sequence = 'not-an-integer'")
            connection.commit()
            connection.close()
            output = io.StringIO()
            error = io.StringIO()
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(error):
                status = main([], root=root)
            self.assertNotEqual(status, 0)
            self.assertEqual(output.getvalue(), "")
            self.assertNotIn("Traceback", error.getvalue())

    def test_limit_and_quiet_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "First task")
            self._task(root, "002", "low", 2, "Second task")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(main(["--limit", "2", "--quiet"], root=root), 0)
            self.assertEqual(output.getvalue(), "001\n002\n")

    def test_human_output_contains_id_title_and_priority(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "critical", 1, "Explore the cave")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(main([], root=root), 0)
            self.assertIn("001", output.getvalue())
            self.assertIn("Explore the cave", output.getvalue())
            self.assertIn("critical", output.getvalue())

    def test_no_match_is_nonzero_and_silent_on_stdout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = self._repository(Path(directory))
            self._task(root, "001", "high", 1, "Already done", status="done")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertNotEqual(main([], root=root), 0)
            self.assertEqual(output.getvalue(), "")

    def test_invalid_limit_is_rejected(self):
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            status = main(["--limit", "0"], root=Path("/does/not/matter"))
        self.assertNotEqual(status, 0)
        self.assertIn("usage:", error.getvalue().lower())

    def test_wrapper_works_from_an_arbitrary_current_directory(self):
        wrapper = Path(__file__).parents[1] / "bin/next"
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([str(wrapper), "--quiet"], cwd=directory, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertRegex(result.stdout, r"^\d{3}\n$")

    @staticmethod
    def _repository(root):
        planning = root / "planning"
        planning.mkdir()
        connection = sqlite3.connect(planning / "index.sqlite3")
        connection.executescript(
            """
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE, status TEXT NOT NULL, priority TEXT NOT NULL,
                sequence INTEGER NOT NULL UNIQUE, summary TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE labels (name TEXT PRIMARY KEY);
            CREATE TABLE task_labels (task_id TEXT NOT NULL, label TEXT NOT NULL,
                                      PRIMARY KEY (task_id, label));
            CREATE TABLE dependencies (task_id TEXT NOT NULL, depends_on TEXT NOT NULL);
            """
        )
        connection.close()
        return root

    @staticmethod
    def _task(root, task_id, priority, sequence, title, status="todo", depends_on=()):
        slug = title.lower().replace(" ", "-")
        path = root / "planning" / f"{task_id}-{slug}.md"
        dependency_text = ", ".join(depends_on) if depends_on else "none"
        path.write_text(
            f"# {task_id} — {title}\n\n"
            f"- **Status:** {status}\n"
            f"- **Priority:** {priority}\n"
            f"- **Summary:** {title}\n"
            f"- **Labels:** test\n"
            f"- **Depends on:** {dependency_text}\n",
            encoding="utf-8",
        )
        connection = sqlite3.connect(root / "planning/index.sqlite3")
        connection.execute(
            "INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'now', 'now')",
            (task_id, slug, title, f"planning/{path.name}", status, priority, sequence, title),
        )
        connection.execute("INSERT OR IGNORE INTO labels VALUES ('test')")
        connection.execute("INSERT INTO task_labels VALUES (?, 'test')", (task_id,))
        connection.executemany(
            "INSERT INTO dependencies VALUES (?, ?)", [(task_id, dependency) for dependency in depends_on]
        )
        connection.commit()
        connection.close()


if __name__ == "__main__":
    unittest.main()
