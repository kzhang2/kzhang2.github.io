#!/usr/bin/env bash
# Local dev server: rebuilds index.html from site_data.json on save, and
# live-reloads the browser on any static file change.
set -euo pipefail
cd "$(dirname "$0")"

cleanup() {
    kill "$rebuild_pid" "$serve_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "site_data.json ssg.py" | tr ' ' '\n' | entr -rn python3 ssg.py &
rebuild_pid=$!

npx --yes live-server --quiet &
serve_pid=$!

wait
