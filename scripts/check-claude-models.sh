#!/usr/bin/env bash
#
# check-claude-models — probe every Claude model exposed by /v1/models
# and ask each one "are you <id>? YES/NO". Writes the verdict to a JSON
# file the cart picker reads as a layer on top of its built-in heuristic.
#
# Why: Anthropic silently reroutes deprecated model ids to a newer model
# (e.g. `claude-opus-4-1` returns answers from `claude-opus-4-7`). The
# /v1/models endpoint still lists the rerouted ones, so we can't trust
# its output as-is. This script asks each model directly.
#
# Output:
#   $HOME/.claude-overflow/projects/-home-siah-creative-reactjit/memory/model-status.json
#
# Usage:
#   ./scripts/check-claude-models.sh
#
# Cron'd via /schedule every 2 weeks.

set -euo pipefail

CRED="$HOME/.claude/.credentials.json"
OUT_DIR="$HOME/.claude-overflow/projects/-home-siah-creative-reactjit/memory"
OUT_FILE="$OUT_DIR/model-status.json"

if [[ ! -f "$CRED" ]]; then
  echo "no credentials at $CRED — run 'claude auth login' first" >&2
  exit 1
fi

TOKEN=$(jq -r .claudeAiOauth.accessToken "$CRED")
if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "no claudeAiOauth.accessToken in $CRED" >&2
  exit 1
fi

MODELS=$(curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: oauth-2025-04-20" \
  https://api.anthropic.com/v1/models \
  | jq -r '.data[].id')

if [[ -z "$MODELS" ]]; then
  echo "no models returned from /v1/models" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

CHECKED_AT=$(date -Iseconds)

# Build JSON. We don't pull a full library — it's just an array of
# {id, status, response} objects.
{
  echo '{'
  echo "  \"checkedAt\": \"$CHECKED_AT\","
  echo '  "results": ['
  FIRST=1
  for M in $MODELS; do
    if RESP=$(timeout 30 claude --print --model "$M" "are you ${M}? YES or NO only — no other words" 2>&1); then
      RC=0
    else
      RC=$?
    fi
    # Trim and lower-case for matching.
    LOWER=$(echo "$RESP" | tr '[:upper:]' '[:lower:]' | tr -d '\n' | sed 's/^ *//;s/ *$//')
    STATUS="unknown"
    if [[ $RC -ne 0 ]]; then
      STATUS="error"
    elif [[ "$LOWER" =~ ^yes ]]; then
      STATUS="verified"
    elif [[ "$LOWER" =~ ^no ]]; then
      STATUS="rerouted"
    fi
    # JSON-escape the response for embedding.
    ESC=$(printf '%s' "$RESP" | jq -Rs .)
    if [[ $FIRST -eq 1 ]]; then FIRST=0; else echo ','; fi
    echo "    { \"id\": \"$M\", \"status\": \"$STATUS\", \"response\": $ESC }"
    echo "[check-claude-models] $M -> $STATUS" >&2
  done
  echo
  echo '  ]'
  echo '}'
} > "$TMP"

mv "$TMP" "$OUT_FILE"
trap - EXIT
echo "[check-claude-models] wrote $OUT_FILE" >&2
