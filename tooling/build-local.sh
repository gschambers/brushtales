#!/usr/bin/env bash
set -euo pipefail

# Keep the public entry point boring and local; the Python module owns safety
# checks and injectable Herdr/OpenCode boundaries.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
cd "$REPO_ROOT"
exec python3 -m tooling.build "$@"
