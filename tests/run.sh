#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for test in tests/check-*.cjs; do node "$test"; done
PYTHONPATH=. python3 tests/check-movies.py
python3 scripts/check-public.py
