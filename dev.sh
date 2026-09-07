#!/usr/bin/env bash
# Local dev server: rebuilds the isolated _site output on source changes and
# serves it at http://localhost:8080 with automatic browser refresh.
# Use --no-reload for controlled automation (no watcher or browser refresh).
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

uv run python scripts/build.py
if [[ "${1:-}" == "--no-reload" ]]; then
    exec uv run python -m http.server 8080 --bind 127.0.0.1 --directory _site
fi

find content scripts articles static -type f | entr -rn uv run python scripts/build.py &
rebuild_pid=$!

npx --yes live-server _site --host=127.0.0.1 --port=8080 --no-browser --wait=300 &
serve_pid=$!

wait
