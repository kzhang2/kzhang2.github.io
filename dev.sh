#!/usr/bin/env bash
# Local dev server: rebuilds the isolated _site output on source changes and
# serves it at http://localhost:8000. Refresh the browser to see updates.
set -euo pipefail
cd "$(dirname "$0")"

cleanup() {
    if [[ -n "${rebuild_pid:-}" ]]; then
        kill "$rebuild_pid" 2>/dev/null || true
    fi
    if [[ -n "${serve_pid:-}" ]]; then
        kill "$serve_pid" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

python3 scripts/build.py
find content scripts articles static -type f | entr -rn python3 scripts/build.py &
rebuild_pid=$!

python3 -m http.server 8000 --directory _site &
serve_pid=$!

wait
