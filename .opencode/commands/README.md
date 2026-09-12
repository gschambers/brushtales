# `.opencode/commands/`

BrushTales commands are reusable delivery workflows invoked from the OpenCode TUI.

- `/build <task-id>` — run the delegated develop → adversarial-review → verify → PR preparation cycle.
- `/review [task-id]` — run a read-only adversarial review.
- `/verify [--physical]` — run applicable verification gates and report pass/fail.

Application work is branch/worktree isolated and must reach `main` through a pull request after the initial repository bootstrap.
