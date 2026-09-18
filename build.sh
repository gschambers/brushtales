#!/usr/bin/env bash
set -euo pipefail

exec bash "$(dirname "$0")/tooling/build-local.sh" "$@"
