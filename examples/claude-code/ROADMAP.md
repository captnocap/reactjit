# ReactJIT Claude Code GUI — Implementation Roadmap

Everything discussed, top to bottom, in build order.

---

## Phase 0: Fix What's Broken

### Permission flow auto-deny bug

The GUI is sending a "deny" response immediately instead of waiting for user input. The permission prompt UI needs to block and hold until the user confirms or denies.

**Where it lives:** `claude_session.lua` → `tick()` function. When a `tool_use` event arrives that requires permission, the stream-json protocol pauses the CLI waiting for a response. Your UI needs to:

1. Detect the permission request in the stream event
2. Set a `state.pendingPermission` flag with the tool details
3. Render a sticky permission card in the chat (not a system modal — user should still be able to scroll)
4. On user confirm/deny, write the response back via `state.proc:write()`
5. Only then resume processing the stream

**Test:** Manually trigger a file edit, verify the CLI actually waits, approve it, confirm the edit lands.

---

## Phase 1: Core Layout Shell

Build the three-column layout. Get the spatial bones right before filling in functionality.

### 1.1 Left sidebar (collapsible)

```
┌─────────────┐
│ [▼ ~/project] │  ← working directory switcher (dropdown/breadcrumb)
├─────────────┤
│ Agent A ● idle │  ← agent tabs (vertical, status badges)
│ Agent B ◉ run  │
│ Agent C ● idle │
├─────────────┤
│ Chat History   │  ← scrollable list
│  Today         │
│   ├ fix auth.. │     title, timestamp, working dir
│   └ write te.. │
│  Yesterday     │
│   └ refactor.. │
└─────────────┘
```

- Collapsible via a toggle button or drag handle
- Chat history entries show: summary/title, timestamp, which working directory
- Agent tabs show: label, status indicator (idle/thinking/writing/waiting permission), working directory
- Pulsing badge on agent tab when it's waiting for permission

### 1.2 Center column (always visible)

```
┌───────────────────────────────┐
│ [chat messages scroll area]    │
│                                │
│ User: fix the auth bug         │
│                                │
│ Claude: I'll look at...        │
│ ┌─────────────────────┐       │
│ │ ✏️ src/auth.lua      │       │  ← inline file edit card (collapsed diff)
│ │ +3 -1 lines         │       │
│ └─────────────────────┘       │
│                                │
│ [permission card if pending]   │  ← sticky, not modal
│                                │
├────────────────────────────────┤
│ [context: ████████░░ 74%]      │  ← token usage bar (subtle)
├────────────────────────────────┤
│ [multi-line input area]        │  ← resizable, not single-line
│ [attach] [compact] [model ▼]   │  ← toolbar row
└────────────────────────────────┘
```

- Chat area is the primary screen real estate consumer
- Input is multi-line (resizable handle or auto-grow)
- Token usage bar changes color as context fills (green → yellow → red)
- Small toolbar above or below input: attach file, manual compact trigger, model switcher
- Inline diff cards in chat for file edits (tap to expand, or view full file in right panel)

### 1.3 Right panel (toggle)

```
┌──────────────────┐
│ [Files] [Git]     │  ← tab switcher
├──────────────────┤
│ src/auth.lua      │
│ ┌──────────────┐ │
│ │- local tok.. │ │  ← full file with diff highlighted in context
│ │+ local tok.. │ │
│ │  ...         │ │
│ └──────────────┘ │
│                   │
│ src/routes.lua    │  ← second file in same turn
│ ┌──────────────┐ │
│ │+ new code    │ │
│ └──────────────┘ │
├──────────────────┤
│ [Git tab view]    │
│ a1b2c3 fix auth  │  ← git log timeline
│ d4e5f6 add routes│
│ ...              │
└──────────────────┘
```

- Toggleable (hotkey or button)
- Two tabs: file edit history and git history
- File view shows the FULL file with edits highlighted — not just the diff snippet
- Git history as a commit timeline
- Both are chronological feeds of the same underlying work at different granularities
- Could merge into a single interleaved timeline later

---

## Phase 2: Multi-Session Support

Convert `claude_session.lua` from singleton to registry.

### 2.1 Session registry

Replace the globals:

```lua
-- OLD
local _activeNodeId = nil
local _activeState  = nil

-- NEW
local _sessions = {}     -- nodeId -> state
local _focusedId = nil   -- which session has UI focus
```

Update `create`:

```lua
create = function(nodeId, props)
  local state = { ... }  -- same as now
  _sessions[nodeId] = state
  if not _focusedId then _focusedId = nodeId end
  return state
end,
```

Update `destroy`:

```lua
destroy = function(nodeId, state)
  _sessions[nodeId] = nil
  if _focusedId == nodeId then
    _focusedId = next(_sessions)  -- pick any remaining, or nil
  end
  if state.proc then
    state.proc:kill()
    state.proc:close()
  end
end,
```

`tick` already receives `(nodeId, state)` so it's already per-instance. No changes needed there.

### 2.2 RPC updates

```lua
rpcHandlers["claude:send"] = function(args)
  local id = args.session or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session: " .. tostring(id) } end
  state.pendingMessage = args.message
  return { ok = true, session = id }
end

rpcHandlers["claude:stop"] = function(args)
  local id = args.session or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  -- kill/close logic same as now
  return { ok = true }
end

rpcHandlers["claude:status"] = function(args)
  if args and args.session then
    local state = _sessions[args.session]
    if not state then return { status = "not_found" } end
    return { status = state.running and "running" or "idle", ... }
  end
  -- Return all sessions
  local all = {}
  for id, state in pairs(_sessions) do
    all[id] = { status = state.running and "running" or "idle", model = state.model }
  end
  return { sessions = all, focused = _focusedId }
end

rpcHandlers["claude:focus"] = function(args)
  if _sessions[args.session] then
    _focusedId = args.session
    return { ok = true }
  end
  return { error = "Unknown session" }
end

rpcHandlers["claude:list"] = function()
  local list = {}
  for id, state in pairs(_sessions) do
    list[#list + 1] = {
      id = id,
      status = state.running and "running" or "idle",
      model = state.model,
      sessionId = state.sessionId,
    }
  end
  return { sessions = list, focused = _focusedId }
end
```

### 2.3 React component per agent

Each agent tab in the sidebar corresponds to one `<ClaudeCode>` component instance with its own `nodeId`, `workingDir`, and `model`. Switching tabs changes `_focusedId` and swaps which chat stream the center column renders.

---

## Phase 3: SQLite Persistence Layer

Store full conversation history before compaction, enable cross-session search.

### 3.1 Schema

Add these tables to `memory.lua`'s SCHEMA string (or a separate `persistence.lua` if you want to keep memory.lua focused on the cognitive system):

```sql
-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id           TEXT PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  working_dir  TEXT,
  model        TEXT,
  title        TEXT,
  started_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  compacted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_conv_agent ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);

-- Messages (full content, never deleted)
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  token_count     INTEGER,
  timestamp       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, timestamp);

-- Tool uses (denormalized for fast queries)
CREATE TABLE IF NOT EXISTS tool_uses (
  id              TEXT PRIMARY KEY,
  message_id      TEXT NOT NULL REFERENCES messages(id),
  conversation_id TEXT NOT NULL,
  tool_name       TEXT NOT NULL,
  input_summary   TEXT,
  file_path       TEXT,
  timestamp       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_file ON tool_uses(file_path);
CREATE INDEX IF NOT EXISTS idx_tool_conv ON tool_uses(conversation_id);

-- Full-text search across all messages
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content, conversation_id, role
);
```

### 3.2 Write hooks

In `claude_session.lua`'s `handleStreamEvent`:

- On `message_start`: create a new message record
- On `content_block_delta` (text_delta): append to the message content
- On `message_stop`: finalize the message record, compute token_count
- On tool_use events: write to `tool_uses` with extracted file_path

In the `sendMessage` function: write the user message to `messages` before sending it to the CLI.

### 3.3 Read capabilities

```lua
-- Search across all conversations
function Store:search_messages(query, limit)
  return self._db:query(
    [[SELECT m.*, c.working_dir, c.title
      FROM messages_fts fts
      JOIN messages m ON fts.rowid = m.rowid
      JOIN conversations c ON m.conversation_id = c.id
      WHERE messages_fts MATCH ?
      ORDER BY rank LIMIT ?]],
    query, limit or 20
  )
end

-- Get everything Claude did to a specific file
function Store:file_history(file_path, limit)
  return self._db:query(
    [[SELECT t.*, m.content, m.role, c.working_dir
      FROM tool_uses t
      JOIN messages m ON t.message_id = m.id
      JOIN conversations c ON t.conversation_id = c.id
      WHERE t.file_path = ?
      ORDER BY t.timestamp DESC LIMIT ?]],
    file_path, limit or 50
  )
end

-- "Pick up where I left off"
function Store:restore_context(conversation_id, last_n)
  return self._db:query(
    [[SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp DESC LIMIT ?]],
    conversation_id, last_n or 20
  )
end
```

### 3.4 Pre-compaction dump

Add a hook that fires before context compaction. In the `tick` function, monitor the token usage (you can estimate from the stream events). When it approaches the limit:

1. Dump all current messages to SQLite (if not already persisted)
2. Let compaction proceed normally
3. The SQLite record is now the full-fidelity backup

The token usage bar in the UI (Phase 1.2) ties directly to this — when the bar goes red, the user knows compaction is imminent and their full context is safely persisted.

---

## Phase 4: Cross-Agent Coordination

This is where it gets interesting. Three sub-phases, each independently useful.

### 4.1 Passive awareness (broadcast activity)

**New table** (add to schema):

```sql
CREATE TABLE IF NOT EXISTS agent_activity (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL,
  event_type TEXT NOT NULL,
  file_path  TEXT,
  summary    TEXT NOT NULL,
  timestamp  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON agent_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_file ON agent_activity(file_path);
```

### 4.2 Soft file locking

**New table:**

```sql
CREATE TABLE IF NOT EXISTS agent_file_locks (
  file_path   TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  locked_at   TEXT NOT NULL,
  description TEXT
);
```

### 4.3 Directed coordination (manual orchestration)

User-driven cross-agent messaging via UI shortcuts.

---

## Phase 5: Memory System Integration

Wire M3A memory into the GUI for long-term intelligence.

### 5.1 Per-conversation memory
### 5.2 Global shared memory scope
### 5.3 Concept extraction upgrade

---

## Phase 6: Polish & Power Features

### 6.1 Working directory switcher
### 6.2 Chat history search
### 6.3 Context restore
### 6.4 Visual inspector integration
### 6.5 Theme
### 6.6 Keyboard shortcuts
### 6.7 Binary distribution

---

## Build Priority Summary

| Order | What | Why | Effort |
|-------|------|-----|--------|
| 0 | Fix permission auto-deny | Broken core flow | Small |
| 1.2 | Center column (chat + input) | Core UX, everything builds on this | Medium |
| 2 | Multi-session registry | Unblocks parallel agents | Small |
| 3.1-3.2 | SQLite persistence + write hooks | Foundation for everything else | Medium |
| 1.1 | Left sidebar (history + agent tabs) | Needs persistence to populate | Medium |
| 4.1 | Passive cross-agent awareness | Highest value coordination feature | Small |
| 1.3 | Right panel (file diffs + git) | Needs tool_uses table from 3.1 | Medium |
| 4.2 | Soft file locking | Prevents conflicts | Small |
| 3.3-3.4 | Search, restore, pre-compaction dump | Power user features | Medium |
| 5 | Memory system integration | Long-term intelligence | Medium |
| 6 | Polish (themes, shortcuts, binary) | Ship quality | Ongoing |
