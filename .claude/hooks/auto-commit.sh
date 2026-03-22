#!/bin/bash
# auto-commit.sh — PostToolUse hook for Edit/Write.
# On every file edit, commits the changed file to a SEPARATE git worktree
# that only pushes to local Gitea. Does NOT touch the main branch.
# Runs in background (fire-and-forget) to avoid slowing down workers.

set +e

REPO="/home/siah/creative/reactjit"
REMOTE="edittrail"
TRAIL_BRANCH="edit-trail"
TRAIL_WORKTREE="/run/user/$(id -u)/claude-sessions/reactjit/edit-trail-wt"
LLM_URL="http://localhost:1234/v1/chat/completions"
LLM_MODEL="qwen2.5-coder-1.5b-instruct"
LOCK="/run/user/$(id -u)/claude-sessions/reactjit/.watch/commit.lock"

# Read hook stdin
INPUT=$(cat)
eval "$(echo "$INPUT" | jq -r '
  @sh "SID=\(.session_id // "")",
  @sh "TOOL=\(.tool_name // "")",
  @sh "FILE=\((.tool_input // {}) | (.file_path // ""))",
  @sh "OLD_STR=\((.tool_input // {}) | (.old_string // ""))",
  @sh "NEW_STR=\((.tool_input // {}) | (.new_string // ""))",
  @sh "CONTENT=\((.tool_input // {}) | (.content // ""))"
')"

[ -z "$FILE" ] && exit 0
[ -z "$SID" ] && exit 0

# Only process files inside the repo
case "$FILE" in
  "$REPO"/*) ;;
  *) exit 0 ;;
esac

SHORT="${SID:0:4}"
REL_PATH="${FILE#$REPO/}"

# Fire-and-forget in background
(
  exec 9>"$LOCK"
  flock -w 10 9 || exit 0

  cd "$REPO" || exit 0

  # One-time setup: create the edit-trail branch and worktree if they don't exist
  if [ ! -d "$TRAIL_WORKTREE" ]; then
    # Create orphan branch if it doesn't exist
    if ! git rev-parse --verify "$TRAIL_BRANCH" &>/dev/null; then
      git branch "$TRAIL_BRANCH" HEAD 2>/dev/null
    fi
    git worktree add "$TRAIL_WORKTREE" "$TRAIL_BRANCH" 2>/dev/null || exit 0
  fi

  # Copy the edited file into the worktree (preserving directory structure)
  DEST="$TRAIL_WORKTREE/$REL_PATH"
  mkdir -p "$(dirname "$DEST")"
  cp "$FILE" "$DEST" 2>/dev/null || exit 0

  # Build diff description for the LLM
  if [ "$TOOL" = "Edit" ] && [ -n "$OLD_STR" ] && [ -n "$NEW_STR" ]; then
    DIFF_DESC="File: ${REL_PATH}\n\nREMOVED:\n${OLD_STR:0:300}\n\nADDED:\n${NEW_STR:0:300}"
  elif [ "$TOOL" = "Write" ] && [ -n "$CONTENT" ]; then
    DIFF_DESC="File: ${REL_PATH}\n\nNew file written (${#CONTENT} chars):\n${CONTENT:0:400}"
  else
    DIFF_DESC="File: ${REL_PATH} modified"
  fi

  # Ask LLM for commit message
  PROMPT="Write a git commit message for this change. One line, max 72 chars. No quotes, no prefix, just the message.\n\n${DIFF_DESC}"
  JSON_PROMPT=$(jq -n --arg p "$PROMPT" '$p')

  COMMIT_MSG=$(curl -s --max-time 5 "$LLM_URL" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$LLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":$JSON_PROMPT}],\"max_tokens\":40,\"temperature\":0.1}" 2>/dev/null \
    | jq -r '.choices[0].message.content // empty' 2>/dev/null)

  if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="[$SHORT] edit $REL_PATH"
  else
    COMMIT_MSG="[$SHORT] $COMMIT_MSG"
  fi

  # Commit in the worktree (never touches main)
  cd "$TRAIL_WORKTREE" || exit 0
  git add "$REL_PATH" 2>/dev/null || exit 0
  git diff --cached --quiet 2>/dev/null && exit 0

  git -c user.name="Claude ($SHORT)" -c user.email="${SHORT}@claude.local" \
    commit --no-verify -m "$COMMIT_MSG" 2>/dev/null || exit 0

  # Push only the edit-trail branch to gitea
  git push "$REMOTE" "$TRAIL_BRANCH":main 2>/dev/null &

  exec 9>&-
) &

exit 0
