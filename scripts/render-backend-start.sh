#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

: "${PORT:=10000}"

exec uvicorn app.main:socket_app --host 0.0.0.0 --port "$PORT"


