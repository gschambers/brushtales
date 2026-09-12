#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
db="$root/planning/index.sqlite3"

test -f "$db"

test "$(sqlite3 -noheader "$db" "SELECT value FROM metadata WHERE key = 'schema_version';")" = "1"
test "$(sqlite3 -noheader "$db" "SELECT value FROM metadata WHERE key = 'source_of_truth';")" = "planning/*.md"
test -n "$(sqlite3 -noheader "$db" "SELECT value FROM metadata WHERE key = 'last_indexed_at';")"

integrity="$(sqlite3 "$db" 'PRAGMA integrity_check;')"
test "$integrity" = "ok"
test -z "$(sqlite3 "$db" 'PRAGMA foreign_key_check;')"
cycles="$(sqlite3 "$db" <<'SQL'
WITH RECURSIVE reach(start, node) AS (
  SELECT task_id, depends_on FROM dependencies
  UNION
  SELECT reach.start, dependencies.depends_on
  FROM reach JOIN dependencies ON dependencies.task_id = reach.node
)
SELECT COUNT(*) FROM reach WHERE start = node;
SQL
)"
test "$cycles" = "0"
late_dependencies="$(sqlite3 "$db" <<'SQL'
SELECT COUNT(*)
FROM dependencies
JOIN tasks AS task ON task.id = dependencies.task_id
JOIN tasks AS dependency ON dependency.id = dependencies.depends_on
WHERE dependency.sequence >= task.sequence;
SQL
)"
test "$late_dependencies" = "0"

metadata() {
  sed -n "s/^- \\*\\*$1:\\*\\* //p" "$2" | head -n 1
}

metadata_count() {
  sed -n "s/^- \\*\\*$1:\\*\\* //p" "$2" | wc -l | tr -d ' '
}

normalize_csv() {
  printf '%s\n' "$1" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | sed '/^$/d' | sort | paste -sd, -
}

while IFS= read -r path; do
  test -n "$path"
  test -f "$root/$path"
done < <(sqlite3 -noheader "$db" 'SELECT path FROM tasks ORDER BY id;')

canonical_mismatches="$(sqlite3 "$db" "SELECT COUNT(*) FROM tasks WHERE path <> 'planning/' || id || '-' || slug || '.md';")"
test "$canonical_mismatches" = "0"

while IFS= read -r file; do
  id="$(basename "$file" | cut -c1-3)"
  count="$(sqlite3 "$db" "SELECT COUNT(*) FROM tasks WHERE id = '$id';")"
  test "$count" = "1"
done < <(find "$root/planning" -maxdepth 1 -type f -name '[0-9][0-9][0-9]-*.md' -print | sort)

while IFS='|' read -r id slug title path status priority sequence summary; do
  file="$root/$path"
  for field in Status Priority Sequence Summary Labels 'Depends on'; do
    test "$(metadata_count "$field" "$file")" = "1"
  done
  test "$(sed -n "s/^# $id — //p" "$file" | head -n 1)" = "$title"
  test "$(metadata Status "$file")" = "$status"
  test "$(metadata Priority "$file")" = "$priority"
  test "$(metadata Sequence "$file")" = "$sequence"
  test "$(metadata Summary "$file")" = "$summary"
  test -n "$summary"
  test "$sequence" -ge 1
  test "$sequence" -eq "$sequence"

  md_labels="$(metadata Labels "$file")"
  test -n "$md_labels"
  db_labels="$(sqlite3 -noheader "$db" "SELECT COALESCE(group_concat(label, ', '), '') FROM (SELECT label FROM task_labels WHERE task_id = '$id' ORDER BY label);")"
  test "$(normalize_csv "$md_labels")" = "$(normalize_csv "$db_labels")"

  md_dependencies="$(metadata 'Depends on' "$file")"
  test "$md_dependencies" != "none" || md_dependencies=""
  db_dependencies="$(sqlite3 -noheader "$db" "SELECT COALESCE(group_concat(depends_on, ', '), '') FROM (SELECT depends_on FROM dependencies WHERE task_id = '$id' ORDER BY depends_on);")"
  test "$(normalize_csv "$md_dependencies")" = "$(normalize_csv "$db_dependencies")"
done < <(sqlite3 -separator '|' -noheader "$db" 'SELECT id, slug, title, path, status, priority, sequence, summary FROM tasks ORDER BY id;')

indexed="$(sqlite3 "$db" 'SELECT COUNT(*) FROM tasks;')"
files="$(find "$root/planning" -maxdepth 1 -type f -name '[0-9][0-9][0-9]-*.md' -print | wc -l | tr -d ' ')"
test "$indexed" = "$files"

printf 'planning index: ok (%s tasks)\n' "$indexed"
