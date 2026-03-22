#!/usr/bin/env bash
# preflight-hook.sh — Claude Code PostToolUse hook for .tsz files.
# Reads tool JSON from stdin, checks if a .tsz file was written/edited,
# runs preflight on affected entry points, returns structured JSON.
#
# Error tiers:
#   1. Errors in the file YOU just edited → always yell, with your session ID
#   2. Errors in other files, owner active (<30min) → suppress (their problem)
#   3. Errors in other files, owner fading (30-60min) → warn but don't assign
#   4. Errors in other files, owner dead (>60min or tombstoned) → inherit

set -uo pipefail

SESSIONS_DIR="/run/user/$(id -u)/claude-sessions/reactjit"
WARN_THRESHOLD=1800   # 30 minutes — warn but don't assign
DEAD_THRESHOLD=3600   # 60 minutes — inherit responsibility

# Read stdin JSON — extract file, session ID, tool name, and edit details
INPUT=$(cat)
eval "$(echo "$INPUT" | jq -r '
  @sh "FILE=\(.tool_input.file_path // .tool_response.filePath // "")",
  @sh "SID=\(.session_id // "")",
  @sh "TOOL=\(.tool_name // "")",
  @sh "OLD_STR=\((.tool_input // {}) | (.old_string // ""))",
  @sh "NEW_STR=\((.tool_input // {}) | (.new_string // ""))"
')"

# Only act on .tsz files
[[ "$FILE" == *.tsz ]] || exit 0

# Need the compiler to be built
ZIGOS_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}/experiments/zigos"
[[ -d "$ZIGOS_DIR" ]] || ZIGOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
[[ -x "$ZIGOS_DIR/zig-out/bin/zigos-compiler" ]] || exit 0

cd "$ZIGOS_DIR"

# Session attribution
SHORT="${SID:0:4}"
NOW=$(date +%s)

# Build a brief description of what the edit was
EDIT_DESC=""
if [ "$TOOL" = "Edit" ] && [ -n "$OLD_STR" ]; then
    OLD_FIRST=$(echo "$OLD_STR" | head -1 | cut -c1-80)
    NEW_FIRST=$(echo "$NEW_STR" | head -1 | cut -c1-80)
    EDIT_DESC="Edit: '${OLD_FIRST}' → '${NEW_FIRST}'"
elif [ "$TOOL" = "Write" ]; then
    EDIT_DESC="Write: full file rewrite"
fi

# Convert absolute path to relative from zigos root
REL=$(python3 -c "import os, sys; print(os.path.relpath(sys.argv[1]))" "$FILE")

# Get just the filename for matching against error lines
REL_BASENAME=$(basename "$REL")

# Run preflight — capture exit code without set -e killing us
EXIT=0
RESULT=$(./scripts/preflight.sh "$REL" 2>&1) || EXIT=$?

if [ $EXIT -ne 0 ]; then
    # Get all error lines (indented lines from preflight output)
    ALL_ERRORS=$(echo "$RESULT" | grep -E '^  ' | head -10)

    # Use Python to classify errors into 3 tiers:
    #   Tier 1: YOUR edit broke it → always yell
    #   Tier 2: Other session broke it, fading (30-60min) → warn, don't assign
    #   Tier 3: Other session broke it, dead (>60min or tombstoned) → inherit
    #   Suppressed: Other session broke it, active (<30min) → silent
    python3 -c "
import json, os, sys, glob

rel = sys.argv[1]
rel_basename = sys.argv[2]
short = sys.argv[3]
edit_desc = sys.argv[4]
now = int(sys.argv[5])
all_errors = sys.argv[6]
sessions_dir = sys.argv[7]
warn_threshold = int(sys.argv[8])
dead_threshold = int(sys.argv[9])
sid = sys.argv[10]

error_lines = [l for l in all_errors.split('\n') if l.strip()]
if not error_lines:
    sys.exit(0)

# Classify each error: is it in the file we just edited, or a different file?
own_errors = []
other_errors = []

for line in error_lines:
    stripped = line.strip()
    # Error lines look like:  Inspector.tsz:3704:28:message
    error_file = None
    if ':' in stripped:
        first_part = stripped.split(':')[0].strip()
        if first_part.endswith('.tsz'):
            error_file = first_part

    if error_file and error_file != rel_basename and not rel.endswith(error_file):
        other_errors.append((line, error_file))
    else:
        own_errors.append(line)

# For other-file errors, check session data to determine tier
warned_errors = []   # tier 2: fading session (30-60min)
adopted_errors = []  # tier 3: dead session (>60min or tombstoned)

for line, error_file in other_errors:
    owner_short = None
    owner_age = None
    owner_dead = False  # explicitly tombstoned via SessionEnd

    for sf in glob.glob(os.path.join(sessions_dir, '*.json')):
        sess_id = os.path.basename(sf).replace('.json', '')
        if sess_id == sid:
            continue

        try:
            with open(sf) as f:
                data = json.load(f)
        except Exception:
            continue

        ping = data.get('ping', 0)
        age = now - ping
        s_short = data.get('short', sess_id[:4])
        status = data.get('status', '')

        # Check if this session touched the error file
        touched = False
        for entry in data.get('recent', []):
            entry_file = entry.get('file', '')
            if entry_file.endswith(error_file) or os.path.basename(entry_file) == error_file:
                touched = True
                break
        current_file = data.get('file', '')
        if current_file.endswith(error_file) or os.path.basename(current_file) == error_file:
            touched = True

        if touched:
            owner_short = s_short
            owner_age = age
            owner_dead = (status == 'dead')
            break

    if not owner_short:
        # No known owner — unattributed error, show it
        adopted_errors.append(line)
    elif owner_dead or owner_age >= dead_threshold:
        # Tier 3: tombstoned or inactive >60min — dead, inherit it
        if owner_dead:
            adopted_errors.append(
                f'{line}  [← session {owner_short} is DEAD (exited). It will never fix this. You must fix it yourself.]'
            )
        else:
            mins = owner_age // 60
            adopted_errors.append(
                f'{line}  [← session {owner_short} has been inactive for {mins}m. That session no longer exists and will not fix this. You must fix it yourself.]'
            )
    elif owner_age >= warn_threshold:
        # Tier 2: fading (30-60min) — warn but don't assign
        mins = owner_age // 60
        warned_errors.append(
            f'{line}  [← session {owner_short} caused this {mins}m ago and may be abandoned. If it does not fix this soon, you will inherit it.]'
        )
    else:
        # Active (<30min) — suppress, their problem
        pass

# Build the final message
parts = []

if own_errors:
    parts.append(
        f'PREFLIGHT FAILED — caused by YOUR edit (session {short}) to {rel}.\\n'
        f'This is NOT a pre-existing error. Your {edit_desc} just broke the build.\\n'
        f'Errors:\\n' + '\\n'.join(own_errors)
    )

if adopted_errors:
    if parts:
        parts.append('')
    parts.append(
        f'INHERITED ERRORS in {rel} dependency chain — the session that caused these is dead. '
        f'It is not coming back. You are responsible for fixing them now.\\n'
        + '\\n'.join(adopted_errors)
    )

if warned_errors:
    if parts:
        parts.append('')
    parts.append(
        f'WARNING: errors in {rel} dependency chain from a possibly-abandoned session. '
        f'Do NOT fix these yet — the owner may still return. But be aware they exist.\\n'
        + '\\n'.join(warned_errors)
    )

if not parts:
    sys.exit(0)

notice = '\\n'.join(parts)
out = {'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': notice}}
print(json.dumps(out))
" "$REL" "$REL_BASENAME" "$SHORT" "$EDIT_DESC" "$NOW" "$ALL_ERRORS" "$SESSIONS_DIR" "$WARN_THRESHOLD" "$DEAD_THRESHOLD" "$SID"
fi
