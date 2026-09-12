#!/usr/bin/env bash
set -euo pipefail

script_root="$(cd "$(dirname "$0")/.." && pwd)"
main_root="$(git -C "$script_root" worktree list --porcelain | awk '
  /^worktree / { path = substr($0, 10) }
  /^branch refs\/heads\/main$/ { print path }
' | head -n 1)"
test -n "$main_root"
root="$main_root"
raw_id="${1:-}"
operation="${2:-}"

if ! [[ "$raw_id" =~ ^[0-9]{1,3}$ ]]; then
  printf 'task id must be one to three digits\n' >&2
  exit 2
fi

printf -v id '%03d' "$((10#$raw_id))"
slug="$(sqlite3 -noheader "$root/planning/index.sqlite3" "SELECT slug FROM tasks WHERE id = '$id';")"
indexed_path="$(sqlite3 -noheader "$root/planning/index.sqlite3" "SELECT path FROM tasks WHERE id = '$id';")"
test "$indexed_path" = "planning/$id-$slug.md"
test -d "$root/.worktrees/$id"
worktree="$(cd "$root/.worktrees/$id" && pwd -P)"
expected_worktree="$root/.worktrees/$id"
test "$worktree" = "$expected_worktree"
main_common="$(cd "$root/$(git -C "$root" rev-parse --git-common-dir)" && pwd -P)"
worktree_common="$(cd "$(git -C "$worktree" rev-parse --git-common-dir)" && pwd -P)"
test "$main_common" = "$worktree_common"
registered="$(git -C "$root" worktree list --porcelain | awk '/^worktree / { print substr($0, 10) }' | grep -Fx "$worktree" || true)"
test "$registered" = "$worktree"
test "$(git -C "$worktree" rev-parse --show-toplevel)" = "$worktree"
branch="$(git -C "$worktree" branch --show-current)"
test -n "$branch"
test "$branch" != "main"
case "$branch" in
  feat/$id-*|fix/$id-*|spike/$id-*|docs/$id-*|chore/$id-*|research/$id-*) ;;
  *) printf 'branch does not match task %s: %s\n' "$id" "$branch" >&2; exit 1 ;;
esac

staged_paths() {
  git -C "$worktree" diff --cached --name-only
}

assert_safe_staged_paths() {
  while IFS= read -r path; do
    case "$path" in
      .env|.env.*|*/.env|*/.env.*|.envrc|*/.envrc|.npmrc|*/.npmrc|*.pem|*.key|*.p12|*.pfx|*.p8|*.crt|*.der|*.asc|*.gpg|.ssh/*|*/.ssh/*|.aws/*|*/.aws/*|id_rsa|id_ed25519|*credentials*|*secrets*)
        test "$path" = ".env.example" || { printf 'refusing sensitive staged path: %s\n' "$path" >&2; exit 1; }
        ;;
    esac
  done < <(staged_paths)
}

case "$operation" in
  rebase)
    git -C "$worktree" fetch origin main
    if git -C "$worktree" merge-base --is-ancestor origin/main HEAD; then
      :
    else
      GIT_EDITOR=true git -C "$worktree" rebase origin/main
    fi
    ;;
  add)
    shift 2
    test "$#" -gt 0
    for path in "$@"; do
      [[ "$path" != /* && "$path" != *..* && "$path" != "." && "$path" != "" && "$path" != -* ]]
      git -C "$worktree" add -- "$path"
    done
    ;;
  commit)
    message="${3:-}"
    test -n "$message"
    test -z "$(git -C "$worktree" diff --cached --check)"
    assert_safe_staged_paths
    git -C "$worktree" commit -m "$message"
    ;;
  push)
    git -C "$worktree" fetch origin main
    git -C "$worktree" merge-base --is-ancestor origin/main HEAD
    git -C "$worktree" push -u origin "$branch"
    ;;
  *)
    printf 'operation must be rebase, add, commit, or push\n' >&2
    exit 2
    ;;
esac
