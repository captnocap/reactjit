# Hook System

Claude Code hooks for multi-session coordination, edit tracking, and auto-commits.

## Overview

The ReactJIT project uses Claude Code hooks — shell scripts triggered by tool-call lifecycle events — to coordinate parallel Claude sessions, track edits, and maintain an audit trail. These hooks live in `.claude/hooks/` at the repo root and run automatically on every tool call.

## Hook Architecture

Hooks fire on Claude Code lifecycle events:

| Event | When |
|-------|------|
| `PreToolUse` | Before a tool executes — can allow/deny |
| `PostToolUse` | After a tool completes |
| `SessionStart` | When a Claude session begins |
| `SessionEnd` | When a Claude session ends |
| `UserPromptSubmit` | When the user sends a message |
| `PermissionRequest` | When a tool needs user approval |
| `Stop` / `StopFailure` | When the model finishes generating |

Each hook receives JSON on stdin with `session_id`, `hook_event_name`, `tool_name`, and `tool_input`.

## Active Hooks

### session-ping.sh

**Purpose**: Multi-session awareness and collision prevention.

**How it works**:
1. Each session writes a JSON file to `/run/user/$UID/claude-sessions/reactjit/` with its session ID, current tool, current file, and status
2. On every tool call, scans all sibling session files to build an awareness context
3. Injects `[SESSION AWARENESS]` messages into the conversation so each Claude instance knows what others are doing
4. **File collision guard**: If another session edited the same file in the last 5 seconds, denies the Edit/Write with a "re-read and retry" message
5. **Message passing**: Sessions can send messages to each other via JSON files in a `messages/` subdirectory

**LLM summaries**: On Edit/Write, sends the diff to a local LLM (qwen2.5-coder-1.5b via LM Studio) to generate a one-line summary of the change. These summaries appear in sibling session awareness contexts.

### edit-log.sh

**Purpose**: Audit trail of all file edits across sessions.

**How it works**:
1. Fires on `PostToolUse` for `Edit` and `Write` tools
2. Logs the exact diff (old_string → new_string for Edit, full content for Write) to `/run/user/$UID/claude-sessions/reactjit/.watch/edits.log`
3. Auto-trims log to 5000 lines to prevent unbounded growth

**Use case**: The supervisor can watch this log to see spec violations or unexpected edits across all sessions in real time.

### auto-commit.sh

**Purpose**: Every file edit is auto-committed to a separate git branch for undo capability.

**How it works**:
1. Fires on `PostToolUse` for `Edit` and `Write` tools
2. Maintains a separate git worktree at `/run/user/$UID/claude-sessions/reactjit/edit-trail-wt` on the `edit-trail` branch
3. Copies the edited file into the worktree and commits it
4. Asks the local LLM for a commit message (falls back to `[sessionId] edit path/to/file`)
5. Pushes to a local Gitea remote (`edittrail`) — never touches the main branch
6. Runs entirely in background (fire-and-forget) with file locking to prevent races

### send-message.sh

**Purpose**: Inter-session messaging.

**Usage** (from within a Claude session):
```bash
bash .claude/hooks/send-message.sh <target_short_id|all> "message text"
```

Writes a JSON message file that the target session picks up on its next tool call via session-ping.sh.

### supervisor-log.sh

**Purpose**: Structured logging for the supervisor dashboard.

### ralph.sh / pane-watch.sh / report-to-supervisor.sh

Supporting hooks for the supervisor system and pane management.

## Storage

All hook state lives in tmpfs for speed and auto-cleanup on reboot:
```
/run/user/$UID/claude-sessions/reactjit/
  *.json                    # Session ping files (one per active session)
  messages/*.json           # Inter-session messages
  .watch/edits.log          # Edit audit trail
  .watch/commit.lock        # Auto-commit file lock
  edit-trail-wt/            # Git worktree for edit-trail branch
```

## Known Limitations

- Session awareness has a 10-minute staleness window — sessions idle longer than 10 minutes are cleaned up
- File collision guard uses a 5-second cooldown — fast successive edits by different sessions may still conflict
- LLM summaries require LM Studio running locally on port 1234; they silently fail if unavailable
- Auto-commit uses `--no-verify` to skip pre-commit hooks (speed over safety for the audit trail)
- Message delivery is eventual — messages are checked on the next tool call, not pushed immediately
