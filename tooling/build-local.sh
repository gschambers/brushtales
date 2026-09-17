#!/usr/bin/env bash
set -euo pipefail

# Keep the public entry point boring and local; the Python module owns safety
# checks and injectable Herdr/OpenCode boundaries.
exec python3 -m tooling.build "$@"
