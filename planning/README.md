# BrushTales planning

This directory contains the executable v0 task plan.

## Source of truth

Each todo is a separate, enumerated Markdown file. The task Markdown is the source of truth for intent, acceptance criteria, and notes. `index.sqlite3` is a queryable index of task metadata for quick lookups, filtering, priority views, labels, and sequencing; it must not become a second task description.

Task files use the format `NNN-short-slug.md`, where `NNN` is a stable sequence number. Do not reuse a number after a task is removed. Update the SQLite index whenever task metadata or task files change.

## Metadata fields

Every task should declare:

- status: `todo`, `in_progress`, `blocked`, `done`, or `cancelled`;
- priority: `critical`, `high`, `medium`, or `low`;
- sequence: an integer execution order;
- labels: one or more concise categories; and
- dependencies: task IDs that should be completed first.

## Useful queries

```sh
# List the planned execution order
sqlite3 -header -column planning/index.sqlite3 \
  'SELECT id, priority, status, title FROM tasks ORDER BY sequence;'

# Find unblocked high-priority work
sqlite3 -header -column planning/index.sqlite3 \
  "SELECT t.id, t.title FROM tasks t WHERE t.status = 'todo' AND t.priority IN ('critical', 'high') AND NOT EXISTS (SELECT 1 FROM dependencies d JOIN tasks dep ON dep.id = d.depends_on WHERE d.task_id = t.id AND dep.status <> 'done') ORDER BY t.sequence;"

# Inspect the task graph
sqlite3 -header -column planning/index.sqlite3 \
  'SELECT task_id, depends_on FROM dependencies ORDER BY task_id, depends_on;'
```

`schema.sql` documents the database schema and can recreate the empty database. The checked-in SQLite file is seeded with the current task index.
