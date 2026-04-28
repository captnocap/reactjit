#!/bin/bash
# ifttt-bus.sh — fans out one Claude Code hook event to N transports.
# Transports declared in .claude/ifttt-transports.json (project) or
# ~/.claude/ifttt-transports.json (user). If neither exists, falls back
# to the legacy jsonl path so old setups keep working.
#
# Each transport is one of:
#   { "type": "jsonl", "path": "/abs/path",      "trim_lines": 4000 }
#   { "type": "http",  "url": "http://...",      "timeout_ms": 200 }
#   { "type": "exec",  "command": "/bin/foo a b" }
#
# Cart authors flip transports here without touching the script. The
# cart's runtime listens on whichever transport it cares about.

set +e

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

# Build the canonical JSON line once; reuse across all transports.
LINE=$(echo "$INPUT" | jq -c --arg ts "$(date +%s%3N)" '
  {
    ts: ($ts | tonumber),
    session: (.session_id // "" | .[0:4]),
    phase: (.hook_event_name // ""),
    tool: (.tool_name // ""),
    cmd: ((.tool_input // {}) | .command // ""),
    desc: ((.tool_input // {}) | .description // ""),
    file: ((.tool_input // {}) | (.file_path // .path // "")),
    pattern: ((.tool_input // {}) | .pattern // ""),
    exit_code: ((.tool_response // {}) | .exit_code // null),
    duration_ms: ((.tool_response // {}) | .duration_ms // null),
    interrupted: ((.tool_response // {}) | .interrupted // null)
  }
' 2>/dev/null)
[ -z "$LINE" ] && exit 0

# Locate config: project-local wins, then user-level.
CONFIG=""
if [ -n "$CLAUDE_PROJECT_DIR" ] && [ -f "$CLAUDE_PROJECT_DIR/.claude/ifttt-transports.json" ]; then
  CONFIG="$CLAUDE_PROJECT_DIR/.claude/ifttt-transports.json"
elif [ -f "$HOME/.claude/ifttt-transports.json" ]; then
  CONFIG="$HOME/.claude/ifttt-transports.json"
fi

# Helpers per transport type.
emit_jsonl() {
  local path="$1" trim="$2"
  [ -z "$path" ] && return
  # Expand ${UID} since we can't rely on the hook env having it set how the user expects.
  path="${path//\$\{UID\}/$(id -u)}"
  path="${path//\$UID/$(id -u)}"
  mkdir -p "$(dirname "$path")" 2>/dev/null
  printf '%s\n' "$LINE" >> "$path"
  if [ -n "$trim" ] && [ "$trim" -gt 0 ]; then
    local n
    n=$(wc -l < "$path" 2>/dev/null || echo 0)
    if [ "$n" -gt "$trim" ]; then
      local keep=$((trim * 3 / 4))
      tail -"$keep" "$path" > "$path.tmp" && mv -f "$path.tmp" "$path"
    fi
  fi
}

emit_http() {
  local url="$1" timeout_ms="${2:-200}"
  [ -z "$url" ] && return
  # Background + short timeout: never block the hook on a slow / dead listener.
  local timeout_s
  timeout_s=$(awk "BEGIN { printf \"%.3f\", $timeout_ms / 1000 }")
  ( curl -s -m "$timeout_s" -H "Content-Type: application/json" -X POST -d "$LINE" "$url" >/dev/null 2>&1 ) &
  disown 2>/dev/null
}

emit_exec() {
  local cmd="$1"
  [ -z "$cmd" ] && return
  ( printf '%s\n' "$LINE" | bash -c "$cmd" >/dev/null 2>&1 ) &
  disown 2>/dev/null
}

# Fan out.
if [ -n "$CONFIG" ]; then
  # Iterate transports. jq emits one TSV row per entry: type<TAB>arg1<TAB>arg2.
  while IFS=$'\t' read -r ttype a1 a2; do
    case "$ttype" in
      jsonl) emit_jsonl "$a1" "$a2" ;;
      http)  emit_http  "$a1" "$a2" ;;
      exec)  emit_exec  "$a1" ;;
    esac
  done < <(jq -r '
    .transports[]? |
    if .type == "jsonl" then "jsonl\t\(.path)\t\(.trim_lines // 4000)"
    elif .type == "http" then "http\t\(.url)\t\(.timeout_ms // 200)"
    elif .type == "exec" then "exec\t\(.command)\t"
    else empty end
  ' "$CONFIG" 2>/dev/null)
else
  # Legacy fallback: single jsonl at the original path.
  emit_jsonl "/run/user/$(id -u)/claude-sessions/reactjit/.watch/ifttt-bus.log" 4000
fi

exit 0
