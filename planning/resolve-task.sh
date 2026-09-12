#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
db="$root/planning/index.sqlite3"
raw_id="${1:-}"

if ! [[ "$raw_id" =~ ^[0-9]{1,3}$ ]]; then
  printf 'task id must be one to three digits\n' >&2
  exit 2
fi

printf -v id '%03d' "$((10#$raw_id))"
row="$(sqlite3 -separator '|' -noheader "$db" "SELECT id, slug, path, status, priority, sequence, title FROM tasks WHERE id = '$id';")"
test -n "$row"
printf '%s\n' "$row"
