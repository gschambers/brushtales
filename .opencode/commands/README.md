# `.opencode/commands/`

BrushTales commands are reusable delivery workflows invoked from the OpenCode TUI.

- `/build <task-id>` — run the delegated develop → adversarial-review → verify → PR preparation cycle.
- `/review [task-id]` — run an adversarial review; disposable probes may live in
  ignored `tmp/` while application and durable coordination files remain intact.
- `/verify [--physical]` — run applicable verification gates and report pass/fail.

Application work is branch/worktree isolated and must reach `main` through a pull request after the initial repository bootstrap.
