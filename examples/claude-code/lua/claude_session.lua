--[[
  claude_session.lua — Claude Code CLI integration via stream-json protocol

  Spawns `claude` as a child process with bidirectional JSON streaming.
  All parsing, buffering, and state management happens here in Lua.
  React just gets clean events to render.

  Protocol (proven in /home/siah/creative/ai/app/src/bun/lib/code-session-manager.ts):
    CLI flags: claude -p --verbose --output-format stream-json
                      --input-format stream-json --include-partial-messages
    Stdin:  {"type":"user","message":{"role":"user","content":"..."}}\n
    Stdout: Line-delimited JSON with stream_event wrappers

  React usage:
    <ClaudeCode
      workingDir="/path/to/project"
      model="sonnet"
    />

  RPC:
    bridge.rpc("claude:send", { message = "fix the bug" })
    bridge.rpc("claude:stop")
    bridge.rpc("claude:status")
]]

local Capabilities = require("lua.capabilities")
local Process = require("lua.process")

local ok_json, json = pcall(require, "cjson")
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then error("[claude_session] JSON library required but not found") end

-- Renderer for feeding stream events into the visual blocks
local Renderer = nil
local function getRenderer()
  if not Renderer then
    local ok, mod = pcall(require, "lua.claude_renderer")
    if ok then Renderer = mod end
  end
  return Renderer
end

-- ── Module table (exported for claude_canvas.lua to call) ────────

local Session = {}

-- ── Module-level state (for RPC access) ──────────────────────────────

local _activeNodeId = nil
local _activeState  = nil

-- ── Helpers ──────────────────────────────────────────────────────────

local function pushCapEvent(pushEvent, nodeId, handler, data)
  if not pushEvent then return end
  local payload = { targetId = nodeId, handler = handler }
  if data then
    for k, v in pairs(data) do
      payload[k] = v
    end
  end
  pushEvent({ type = "capability", payload = payload })
end

-- ── Stream-JSON line parser ──────────────────────────────────────────
-- Handles incomplete lines across read() calls.

local function createLineBuffer()
  return { partial = "" }
end

local function feedLines(buf, data)
  if not data then return {} end
  buf.partial = buf.partial .. data

  local lines = {}
  while true do
    local pos = buf.partial:find("\n", 1, true)
    if not pos then break end
    local line = buf.partial:sub(1, pos - 1)
    buf.partial = buf.partial:sub(pos + 1)
    line = line:match("^%s*(.-)%s*$") -- trim
    if #line > 0 then
      lines[#lines + 1] = line
    end
  end
  return lines
end

-- ── Stream event dispatch ────────────────────────────────────────────

local function handleStreamEvent(state, event, pushEvent, nodeId)
  local etype = event.type
  local R = getRenderer()

  if etype == "message_start" then
    -- New assistant message
    state.streamingText = ""
    state.streamingMessageId = tostring(os.clock())
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "streaming" })
    -- Feed to renderer
    if R and state.rendererSessionId then
      R.setStatus(state.rendererSessionId, "streaming")
    end

  elseif etype == "content_block_start" then
    local block = event.content_block
    if block then
      if block.type == "tool_use" then
        pushCapEvent(pushEvent, nodeId, "onToolUse", {
          name = block.name or "unknown",
          toolId = block.id,
          input = block.input,
        })
        -- Feed to renderer: tool start block
        if R and state.rendererSessionId then
          R.addToolStart(state.rendererSessionId, block.name or "unknown", block.id, block.input)
        end
      elseif block.type == "text" and block.text and #block.text > 0 then
        state.streamingText = (state.streamingText or "") .. block.text
      end
    end

  elseif etype == "content_block_delta" then
    local delta = event.delta
    if delta then
      if delta.type == "text_delta" and delta.text then
        state.streamingText = (state.streamingText or "") .. delta.text
        pushCapEvent(pushEvent, nodeId, "onTextDelta", {
          text = delta.text,
          fullText = state.streamingText,
        })
        -- Feed to renderer: streaming text update
        if R and state.rendererSessionId then
          R.setStreaming(state.rendererSessionId, state.streamingText)
        end
      elseif delta.type == "input_json_delta" and delta.partial_json then
        -- Tool input streaming — accumulate for display
        pushCapEvent(pushEvent, nodeId, "onToolInput", {
          partialJson = delta.partial_json,
        })
      end
    end

  elseif etype == "content_block_stop" then
    -- Block finished, no action needed

  elseif etype == "message_delta" then
    -- Check stop_reason
    if event.delta and event.delta.stop_reason == "end_turn" then
      -- Message is complete
    end

  elseif etype == "message_stop" then
    -- Full message complete
    if state.streamingText and #state.streamingText > 0 then
      pushCapEvent(pushEvent, nodeId, "onTextDone", {
        text = state.streamingText,
      })
      -- Feed to renderer: finalize streaming text as a text block
      if R and state.rendererSessionId then
        R.addText(state.rendererSessionId, state.streamingText)
        R.setStreaming(state.rendererSessionId, nil)
      end
    end
    state.streamingText = nil
    state.streamingMessageId = nil
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "idle" })
    if R and state.rendererSessionId then
      R.setStatus(state.rendererSessionId, "idle")
    end
  end
end

-- ── Top-level JSON dispatch ──────────────────────────────────────────

local function handleJsonMessage(state, msg, pushEvent, nodeId)
  local mtype = msg.type
  local R = getRenderer()

  if mtype == "stream_event" and msg.event then
    handleStreamEvent(state, msg.event, pushEvent, nodeId)

  elseif mtype == "system" then
    state.sessionId = msg.session_id
    state.model = msg.model
    state.claudeVersion = msg.version
    pushCapEvent(pushEvent, nodeId, "onSystemInit", {
      sessionId = msg.session_id,
      model = msg.model,
      version = msg.version,
    })
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "idle" })
    -- Feed to renderer: system info block
    if R and state.rendererSessionId then
      local sysText = (msg.version or "claude") .. "  |  " .. (msg.model or "unknown") .. "  |  session " .. (msg.session_id or "?")
      R.addSystem(state.rendererSessionId, sysText)
      R.setStatus(state.rendererSessionId, "idle", msg.model)
    end

  elseif mtype == "assistant" then
    -- Full assistant message with content blocks (tool calls)
    local message = msg.message
    if message and message.content then
      for _, block in ipairs(message.content) do
        if block.type == "tool_use" then
          pushCapEvent(pushEvent, nodeId, "onToolUse", {
            name = block.name,
            toolId = block.id,
            input = block.input,
          })
          -- Feed to renderer
          if R and state.rendererSessionId then
            R.addToolStart(state.rendererSessionId, block.name, block.id, block.input)
          end
        elseif block.type == "tool_result" then
          -- Feed tool output to renderer
          if R and state.rendererSessionId and block.content then
            local outputText = type(block.content) == "string" and block.content
              or (type(block.content) == "table" and block.content[1] and block.content[1].text)
              or ""
            if #outputText > 0 then
              R.addToolOutput(state.rendererSessionId, outputText)
            end
          end
        elseif block.type == "text" and block.text then
          -- Feed text to renderer
          if R and state.rendererSessionId then
            R.addText(state.rendererSessionId, block.text)
          end
        end
      end
    end

  elseif mtype == "result" then
    -- Conversation result — Claude is done, waiting for next input
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "idle" })
    if R and state.rendererSessionId then
      R.setStatus(state.rendererSessionId, "idle")
    end

  elseif mtype == "error" then
    local errMsg = "Unknown error"
    if msg.error then
      errMsg = msg.error.message or msg.error or errMsg
    elseif msg.message then
      errMsg = msg.message
    end
    pushCapEvent(pushEvent, nodeId, "onError", { error = tostring(errMsg) })
    -- Feed to renderer
    if R and state.rendererSessionId then
      R.addError(state.rendererSessionId, tostring(errMsg))
    end
  end
end

-- ── Process spawn ────────────────────────────────────────────────────

local function spawnClaude(state, props)
  local executable = props.executable or "claude"
  local args = {
    "-p",
    "--verbose",
    "--output-format", "stream-json",
    "--input-format", "stream-json",
    "--include-partial-messages",
  }

  -- Model selection
  if props.model and props.model ~= "" then
    args[#args + 1] = "--model"
    args[#args + 1] = props.model
  end

  -- Max budget
  if props.maxBudget then
    args[#args + 1] = "--max-budget-usd"
    args[#args + 1] = tostring(props.maxBudget)
  end

  -- Permission mode
  if props.permissionMode then
    args[#args + 1] = "--permission-mode"
    args[#args + 1] = props.permissionMode
  end

  local cwd = props.workingDir or "."

  io.write("[claude_session] Spawning: " .. executable .. " " .. table.concat(args, " ") .. "\n")
  io.write("[claude_session] CWD: " .. cwd .. "\n")
  io.flush()

  state.proc = Process.spawn(executable, args, {
    cwd = cwd,
    env = {
      CLAUDECODE = false,       -- unset (prevent nested session guard)
      PAGER = "",               -- disable pager
      GIT_PAGER = "",           -- disable git pager
      TERM = "xterm-256color",  -- proper terminal type
    },
    unsetEnv = { "LD_PRELOAD", "LD_LIBRARY_PATH" },
  })

  state.lineBuffer = createLineBuffer()
  state.running = true
  state.streamingText = nil
  state.streamingMessageId = nil
end

-- ── Send user message to stdin ───────────────────────────────────────

local function sendMessage(state, message)
  if not state.proc then return false, "No process" end

  local payload = json.encode({
    type = "user",
    message = {
      role = "user",
      content = message,
    },
  })

  io.write("[claude_session] Sending: " .. payload:sub(1, 200) .. "\n"); io.flush()

  local ok, err = state.proc:write(payload .. "\n")
  if not ok then
    io.write("[claude_session] Write failed: " .. tostring(err) .. "\n"); io.flush()
    return false, err
  end

  return true
end

-- ── Module API (for claude_canvas.lua) ───────────────────────────────

--- Send a message to the active session. Called by canvas on Enter press.
function Session.send(message)
  if not _activeState then return false, "No session" end
  _activeState.pendingMessage = message
  return true
end

--- Stop the active session. Called by canvas on Ctrl+C.
function Session.stop()
  if not _activeState then return false end
  if _activeState.proc then
    _activeState.proc:kill()
    _activeState.proc:close()
    _activeState.proc = nil
    _activeState.running = false
  end
  return true
end

--- Get the renderer session ID for the active session.
function Session.getRendererSessionId()
  if _activeState then
    return _activeState.rendererSessionId
  end
  return nil
end

-- ── Capability registration ──────────────────────────────────────────

Capabilities.register("ClaudeCode", {
  visual = false,

  schema = {
    workingDir     = { type = "string", desc = "Project directory for Claude to operate in" },
    model          = { type = "string", default = "sonnet", desc = "Model: sonnet, opus, haiku" },
    executable     = { type = "string", default = "claude", desc = "Path to claude executable" },
    permissionMode = { type = "string", desc = "Permission mode: default, plan, acceptEdits, bypassPermissions" },
    maxBudget      = { type = "number", desc = "Max budget in USD" },
    sessionId      = { type = "string", default = "default", desc = "Session ID for renderer linkage" },
  },

  events = {
    "onSystemInit",
    "onTextDelta",
    "onTextDone",
    "onToolUse",
    "onToolInput",
    "onError",
    "onStatusChange",
  },

  create = function(nodeId, props)
    local state = {
      proc = nil,
      lineBuffer = nil,
      running = false,
      sessionId = nil,
      model = nil,
      streamingText = nil,
      streamingMessageId = nil,
      pendingMessage = nil,
      rendererSessionId = props.sessionId or "default",  -- link to renderer session
    }

    _activeNodeId = nodeId
    _activeState = state

    -- Ensure renderer has a session for us
    local R = getRenderer()
    if R then R.getSession(state.rendererSessionId) end

    return state
  end,

  update = function(nodeId, props, prev, state)
    -- If workingDir or model changed while not running, note for next spawn
    -- (Don't restart mid-conversation)
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    -- Handle pending message
    if state.pendingMessage then
      local msg = state.pendingMessage
      state.pendingMessage = nil

      if not state.proc or not state.running then
        -- Spawn process first
        local ok, err = pcall(spawnClaude, state, props)
        if not ok then
          pushCapEvent(pushEvent, nodeId, "onError", { error = "Failed to spawn: " .. tostring(err) })
          local R = getRenderer()
          if R and state.rendererSessionId then
            R.addError(state.rendererSessionId, "Failed to spawn: " .. tostring(err))
          end
          return
        end
        pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "starting" })
      end

      -- Send the message
      local ok, err = sendMessage(state, msg)
      if ok then
        pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "running" })
        local R = getRenderer()
        if R and state.rendererSessionId then
          R.setStatus(state.rendererSessionId, "running")
        end
      else
        pushCapEvent(pushEvent, nodeId, "onError", { error = "Send failed: " .. tostring(err) })
      end
    end

    -- Read from process (non-blocking, drains all available data)
    if state.proc and state.running then
      local data = state.proc:read()
      if data then
        local lines = feedLines(state.lineBuffer, data)
        for _, line in ipairs(lines) do
          local ok, parsed = pcall(json.decode, line)
          if ok and parsed then
            handleJsonMessage(state, parsed, pushEvent, nodeId)
          else
            -- Non-JSON output (debug info, etc.)
            io.write("[claude_session] Non-JSON: " .. line:sub(1, 200) .. "\n"); io.flush()
          end
        end
      end

      -- Check if process is still alive
      if not state.proc:alive() then
        local code = state.proc:exitCode()
        io.write("[claude_session] Process exited with code " .. tostring(code) .. "\n"); io.flush()
        state.running = false
        state.proc:close()
        state.proc = nil
        pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "stopped" })
        local R = getRenderer()
        if R and state.rendererSessionId then
          R.setStatus(state.rendererSessionId, "stopped")
        end
        if code and code ~= 0 then
          pushCapEvent(pushEvent, nodeId, "onError", {
            error = "Claude exited with code " .. tostring(code),
          })
          if R and state.rendererSessionId then
            R.addError(state.rendererSessionId, "Claude exited with code " .. tostring(code))
          end
        end
      end
    end
  end,

  destroy = function(nodeId, state)
    _activeNodeId = nil
    _activeState = nil
    if state.proc then
      state.proc:kill()
      state.proc:close()
      state.proc = nil
    end
  end,
})

-- ── RPC handlers ─────────────────────────────────────────────────────

local rpcHandlers = {}

rpcHandlers["claude:send"] = function(args)
  if not _activeState then
    return { error = "No ClaudeCode instance active" }
  end
  if not args or not args.message then
    return { error = "Missing 'message' argument" }
  end
  _activeState.pendingMessage = args.message
  return { ok = true, status = "queued" }
end

rpcHandlers["claude:stop"] = function()
  if not _activeState then
    return { error = "No ClaudeCode instance active" }
  end
  if _activeState.proc then
    _activeState.proc:kill()
    _activeState.proc:close()
    _activeState.proc = nil
    _activeState.running = false
  end
  return { ok = true }
end

rpcHandlers["claude:status"] = function()
  if not _activeState then
    return { status = "no_instance" }
  end
  return {
    status = _activeState.running and "running" or "idle",
    model = _activeState.model,
    sessionId = _activeState.sessionId,
    running = _activeState.running,
  }
end

-- Extend Capabilities.getHandlers to include our RPC methods
local originalGetHandlers = Capabilities.getHandlers
Capabilities.getHandlers = function()
  local handlers = originalGetHandlers()
  for method, handler in pairs(rpcHandlers) do
    handlers[method] = handler
  end
  return handlers
end

io.write("[claude_session] Registered ClaudeCode capability\n"); io.flush()

return Session
