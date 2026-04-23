#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CART_NAME=hello_stress HARNESS_NAME=verify-hello-stress exec "$ROOT/scripts/verify-hello.sh"
