--[[
  claude_session.lua — Claude Code integration via damage-driven screen scraping

  Spawns `claude` in interactive mode over a PTY. libvterm sits on the read
  side with damage callbacks — we never scan the full grid. Only dirty rows
  get read, only on settled frames.

  Architecture:
    WRITES (you -> Claude): direct to PTY stdin
    READS  (Claude -> you): PTY stdout -> libvterm -> damage callbacks ->
                           settle timer -> extract dirty rows -> semantic diff ->
                           transition events -> block renderer

  Semantic state machine:
    Idle          -> cursor visible, prompt at bottom, no recent damage
    Streaming     -> rapid damage on content rows, cursor advancing
    Thinking      -> spinner chars on bottom rows, cursor moving
    PermissionGate -> "Do you want to" detected in dirty rows
    Splash        -> banner detected, no idle prompt yet

  React usage:
    <ClaudeCode workingDir="/path/to/project" model="sonnet" />
]]

local Capabilities = require("lua.capabilities")
local PTY          = require("lua.pty")
local VTerm        = require("lua.vterm")

-- Renderer for the pretty block UI
local Renderer = nil
local function getRenderer()
  if not Renderer then
    local ok, mod = pcall(require, "lua.claude_renderer")
    if ok then Renderer = mod end
  end
  return Renderer
end

-- ── Module table ─────────────────────────────────────────────────────

local Session = {}

-- ── State ────────────────────────────────────────────────────────────

local _sessions  = {}
local _focusedId = nil

-- ── Constants ────────────────────────────────────────────────────────

local TERM_ROWS    = 50
local TERM_COLS    = 120
local SETTLE_MS    = 120   -- ms after last damage before extracting semantics
local STREAM_MS    = 50    -- ms between streaming text updates to renderer

-- ── Clock (monotonic, milliseconds) ─────────────────────────────────

local function now_ms()
  if love and love.timer then
    return love.timer.getTime() * 1000
  end
  return os.clock() * 1000
end

-- ── Helpers ──────────────────────────────────────────────────────────

local function pushCapEvent(pushEvent, nodeId, handler, data)
  if not pushEvent then return end
  local payload = { targetId = nodeId, handler = handler }
  if data then for k, v in pairs(data) do payload[k] = v end end
  pushEvent({ type = "capability", payload = payload })
end

-- ── Semantic modes ──────────────────────────────────────────────────

local MODE_SPLASH     = "splash"
local MODE_IDLE       = "idle"
local MODE_STREAMING  = "streaming"
local MODE_THINKING   = "thinking"
local MODE_PERMISSION = "permission"

-- ── Row classification ──────────────────────────────────────────────

local function classifyRow(text, row, totalRows)
  if #text == 0 then return "empty" end

  -- Permission prompt
  local action, target = text:match("Do you want to (%w+)%s+(.-)%?")
  if action then return "permission", action, target end

  -- Numbered permission options (1. Yes, 2. Yes allow all, 3. No)
  if text:match("^%s*[›>]?%s*%d+%.%s+") then return "permission_option" end

  -- Banner / version
  if text:find("Claude Code v", 1, true) or text:find("Claude Code ", 1, true) then return "banner" end

  -- Model indicator
  if text:match("Opus [%d%.]+") or text:match("Sonnet [%d%.]+") or text:match("Haiku [%d%.]+") then
    return "banner"
  end

  -- Token/cost status bar
  if text:match("%d+%s*tokens") or text:match("%$%d") then return "status_bar" end
  if text:find("for shortcuts", 1, true) or text:find("esc to interrupt", 1, true) then return "status_bar" end

  -- Idle prompt: ❯ alone (possibly with spaces) near bottom of screen
  -- Must check BEFORE thinking — ❯ shares byte 0xE2 with spinner chars
  if row >= totalRows - 8 then
    local stripped = text:match("^%s*(.-)%s*$")
    if stripped == "❯" or stripped == ">" then return "idle_prompt" end
  end

  -- User prompt: ❯ or > followed by typed text
  if text:find("❯ ", 1, true) and not text:find("Imagining", 1, true) then
    local afterPrompt = text:match("❯ (.+)")
    if afterPrompt and #afterPrompt > 0 then return "user_prompt" end
  end
  if text:match("^> .") then return "user_prompt" end

  -- Thinking/spinner lines
  if text:find("Imagining", 1, true) or text:find("Thinking", 1, true)
     or text:find("Saut", 1, true) then
    return "thinking"
  end

  -- Tool use (bullet + tool name) — use plain find for bullet chars
  local hasBullet = text:find("● ", 1, true) or text:find("• ", 1, true) or text:find("◆ ", 1, true)
  if hasBullet then return "tool" end

  -- Diff lines
  if text:match("^%+") or text:match("^%-") then return "diff" end

  -- Box drawing (tool block borders) — use plain find
  if text:find("┌", 1, true) or text:find("╭", 1, true) or text:find("│", 1, true)
     or text:find("└", 1, true) or text:find("╰", 1, true) then
    return "box_drawing"
  end
  local stripped = text:match("^%s*(.-)%s*$")
  if stripped:find("────", 1, true) then return "box_drawing" end

  -- Error
  if text:match("^%s*[Ee]rror:") then return "error" end

  return "text"
end

-- ── PTY spawn ────────────────────────────────────────────────────────

local function spawnClaude(state, props)
  local executable = props.executable or "claude"
  local args = { "--verbose" }

  if props.model and props.model ~= "" then
    args[#args + 1] = "--model"
    args[#args + 1] = props.model
  end

  local cwd = props.workingDir or "."

  -- libvterm: damage-driven ANSI parser
  state.vterm = VTerm.new(TERM_ROWS, TERM_COLS)

  -- PTY: gives Claude isatty()=true
  state.proc = PTY.open({
    shell = executable,
    args  = args,
    cwd   = cwd,
    rows  = TERM_ROWS,
    cols  = TERM_COLS,
    env   = {
      CLAUDECODE      = false,
      LD_PRELOAD      = false,
      LD_LIBRARY_PATH = false,
      PAGER           = "",
      GIT_PAGER       = "",
      TERM            = "xterm-256color",
      FORCE_COLOR     = "1",
      COLORTERM       = "truecolor",
    },
  })

  state.running         = true
  state.mode            = MODE_SPLASH
  state.settleAt        = nil
  state.lastStreamPush  = 0
  state.bannerText      = nil
  state.permissionInfo  = nil
  state.lastAssistantText = nil
  state._emittedRows    = {}  -- dedup: rowKey -> true
end

-- ── Send message: type directly into PTY ─────────────────────────────

local function sendMessage(state, message)
  if not state.proc then return false, "No process" end

  state.proc:write(message)
  state._pendingEnter = true
  return true
end

-- Respond to permission — write keystroke directly to PTY
local function respondToPermission(state, choice, pushEvent, nodeId)
  if not state.permissionInfo then return end
  if not state.proc then return end

  -- 1 = approve, 2 = allow-all, 3 = deny
  state.proc:write(tostring(choice))
  state.permissionInfo = nil

  local R = getRenderer()
  if R and state.rendererSessionId then
    local labels = { [1] = "Approved", [2] = "Approved (all)", [3] = "Denied" }
    R.resolvePermissionPrompt(state.rendererSessionId, labels[choice] or "Responded")
  end

  -- Notify React that permission is resolved
  pushCapEvent(pushEvent, nodeId, "onPermissionResolved", {})
end

-- ── Semantic extraction (called when screen settles) ─────────────────

local function extractSemantics(state, dirtyRows, pushEvent, nodeId)
  local vt = state.vterm
  local R = getRenderer()
  local sid = state.rendererSessionId
  local numRows = TERM_ROWS

  local prevMode = state.mode
  local sawPermission = false
  local permAction, permTarget, permQuestion = nil, nil, nil
  local sawIdlePrompt = false
  local sawThinking = false
  local sawBanner = false
  local newTextLines = {}
  local sawTool = false
  local toolText = nil
  local sawError = false
  local errorText = nil

  -- Classify each dirty row
  for _, row in ipairs(dirtyRows) do
    local text = vt:getRowText(row)
    local kind, extra1, extra2 = classifyRow(text, row, numRows)

    -- Dedup: skip rows we've already emitted this turn
    local rowKey = row .. ":" .. text:sub(1, 60)
    if state._emittedRows[rowKey] and kind ~= "permission" then
      -- Always let permission through (needs instant response)
      goto continue
    end
    state._emittedRows[rowKey] = true

    if kind == "permission" then
      sawPermission = true
      permAction = extra1
      permTarget = extra2
      permQuestion = text
    elseif kind == "permission_option" then
      sawPermission = sawPermission or (state.mode == MODE_PERMISSION)
    elseif kind == "idle_prompt" then
      sawIdlePrompt = true
    elseif kind == "thinking" then
      sawThinking = true
    elseif kind == "banner" then
      sawBanner = true
      state.bannerText = state.bannerText or text
    elseif kind == "tool" then
      sawTool = true
      toolText = text
    elseif kind == "error" then
      sawError = true
      errorText = text
    elseif kind == "text" or kind == "user_prompt" then
      newTextLines[#newTextLines + 1] = { row = row, text = text, kind = kind }
    end

    ::continue::
  end

  -- ── Mode transitions ────────────────────────────────────────────

  local newMode = prevMode

  if sawPermission then
    newMode = MODE_PERMISSION
  elseif state.mode == MODE_PERMISSION and not sawPermission then
    local found = vt:findText("Do you want to")
    if not found then
      newMode = MODE_IDLE
      state.permissionInfo = nil
      if R and sid then R.resolvePermissionPrompt(sid, "Resolved") end
      pushCapEvent(pushEvent, nodeId, "onPermissionResolved", {})
    end
  elseif sawThinking and prevMode ~= MODE_SPLASH then
    newMode = MODE_THINKING
  elseif sawIdlePrompt and prevMode ~= MODE_SPLASH then
    newMode = MODE_IDLE
  elseif prevMode == MODE_SPLASH and (sawIdlePrompt or sawBanner) then
    state._readyForInput = true
    newMode = MODE_SPLASH

    if state._queuedMessage then
      local msg = state._queuedMessage
      state._queuedMessage = nil
      newMode = MODE_IDLE
      state._readyForInput = true
      local R = getRenderer()
      if R and state.rendererSessionId then
        if state.bannerText then R.addSystem(state.rendererSessionId, state.bannerText) end
        R.setStatus(state.rendererSessionId, "running")
      end
      sendMessage(state, msg)
      pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "running" })
    end
  elseif #newTextLines > 0 and prevMode ~= MODE_SPLASH then
    newMode = MODE_STREAMING
  end

  -- Clear dedup set on transition to idle (new conversation turn)
  if newMode == MODE_IDLE and prevMode ~= MODE_IDLE then
    state._emittedRows = {}
  end

  state.mode = newMode

  -- ── Emit events to renderer based on transitions ────────────────

  if not R or not sid then return end

  if prevMode == MODE_SPLASH and newMode == MODE_IDLE then
    if state.bannerText then
      R.addSystem(sid, state.bannerText)
    end
    R.setStatus(sid, "idle")
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "idle" })
  end

  -- Enter PermissionGate
  if newMode == MODE_PERMISSION and prevMode ~= MODE_PERMISSION then
    state.permissionInfo = { action = permAction, target = permTarget, rawQuestion = permQuestion }
    R.showPermissionPrompt(sid, state.permissionInfo)
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "waiting_permission" })
    -- Fire React event for modal
    pushCapEvent(pushEvent, nodeId, "onPermissionRequest", {
      action = permAction or "",
      target = permTarget or "",
      question = permQuestion or "",
    })
  end

  -- Enter Thinking
  if newMode == MODE_THINKING and prevMode ~= MODE_THINKING then
    R.setStatus(sid, "thinking")
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "thinking" })
  end

  -- Streaming text -> push to renderer (rate-limited)
  if newMode == MODE_STREAMING then
    local t = now_ms()
    if t - state.lastStreamPush >= STREAM_MS then
      state.lastStreamPush = t
      local contentLines = {}
      for i = 3, numRows - 3 do
        local text = vt:getRowText(i)
        if #text > 0 then
          contentLines[#contentLines + 1] = text
        end
      end
      if #contentLines > 0 then
        local fullText = table.concat(contentLines, "\n")
        if fullText ~= state.lastAssistantText then
          state.lastAssistantText = fullText
          R.setStreaming(sid, fullText)
        end
      end
    end
  end

  -- Streaming -> Idle: finalize the response
  if newMode == MODE_IDLE and (prevMode == MODE_STREAMING or prevMode == MODE_THINKING) then
    local contentLines = {}
    for i = 3, numRows - 3 do
      local text = vt:getRowText(i)
      if #text > 0 then
        contentLines[#contentLines + 1] = text
      end
    end
    if #contentLines > 0 then
      local fullText = table.concat(contentLines, "\n")
      if fullText ~= state.lastAssistantText then
        R.addText(sid, fullText)
        state.lastAssistantText = fullText
      end
    end
    R.setStreaming(sid, nil)
    R.setStatus(sid, "idle")
    pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "idle" })
  end

  -- Tool blocks
  if sawTool and toolText then
    R.addToolStart(sid, toolText, nil, nil)
  end

  -- Errors
  if sawError and errorText then
    R.addError(sid, errorText)
  end
end

-- ── Module API ───────────────────────────────────────────────────────

function Session.send(message, sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state then return false, "No session" end
  state.pendingMessage = message
  return true
end

function Session.stop(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state then return false end
  if state.proc then state.proc:write("\x03") end
  return true
end

function Session.respond(choice, sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state then return false end
  respondToPermission(state, choice)
  return true
end

function Session.getRendererSessionId(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.rendererSessionId end
  return nil
end

function Session.getVTerm(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.vterm end
  return nil
end

function Session.getScreenState(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.mode end
  return nil
end

function Session.isInitialized(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.mode ~= MODE_SPLASH end
  return false
end

function Session.getMode(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.mode end
  return nil
end

function Session.getFocusedId() return _focusedId end

-- ── Capability registration ──────────────────────────────────────────

Capabilities.register("ClaudeCode", {
  visual = false,

  schema = {
    workingDir = { type = "string", desc = "Project directory for Claude to operate in" },
    model      = { type = "string", default = "sonnet", desc = "Model: sonnet, opus, haiku" },
    executable = { type = "string", default = "claude", desc = "Path to claude executable" },
    sessionId  = { type = "string", default = "default", desc = "Session ID for renderer" },
  },

  events = { "onError", "onStatusChange", "onPermissionRequest", "onPermissionResolved", "onQuestionPrompt" },

  create = function(nodeId, props)
    local state = {
      proc              = nil,
      vterm             = nil,
      running           = false,
      mode              = MODE_SPLASH,
      pendingMessage    = nil,
      permissionInfo    = nil,
      settleAt          = nil,
      lastStreamPush    = 0,
      bannerText        = nil,
      lastAssistantText = nil,
      rendererSessionId = props.sessionId or "default",
      _workingDir       = props.workingDir or ".",
      _pendingEnter     = false,
      _queuedMessage    = nil,
      _pendingDirty     = {},
      _emittedRows      = {},
    }

    _sessions[nodeId] = state
    if not _focusedId then _focusedId = nodeId end

    local R = getRenderer()
    if R then R.getSession(state.rendererSessionId) end

    local ok, err = pcall(spawnClaude, state, props)
    if not ok then
      io.write("[claude_session] Spawn failed: " .. tostring(err) .. "\n"); io.flush()
    end

    return state
  end,

  update = function() end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    -- Deferred Enter: fires on the tick AFTER sendMessage wrote the text
    if state._pendingEnter and state.proc then
      state._pendingEnter = false
      state.proc:write("\r")
    end

    -- Handle pending message
    if state.pendingMessage then
      local msg = state.pendingMessage
      state.pendingMessage = nil

      if not state.proc or not state.running then
        local ok, err = pcall(spawnClaude, state, props)
        if not ok then
          pushCapEvent(pushEvent, nodeId, "onError", { error = "Spawn failed: " .. tostring(err) })
          return
        end
      end

      if state.mode == MODE_SPLASH and not state._readyForInput then
        state._queuedMessage = msg
      elseif state.mode == MODE_SPLASH and state._readyForInput then
        state.mode = MODE_IDLE
        state._emittedRows = {}  -- clear dedup for new turn
        local R = getRenderer()
        if R and state.rendererSessionId then
          if state.bannerText then R.addSystem(state.rendererSessionId, state.bannerText) end
          R.setStatus(state.rendererSessionId, "running")
        end
        sendMessage(state, msg)
        pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "running" })
      else
        state._emittedRows = {}  -- clear dedup for new turn
        sendMessage(state, msg)
        pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "running" })
      end
    end

    -- Read PTY output -> feed into libvterm
    if not state.proc or not state.running then return end

    local data = state.proc:read()
    if data and #data > 0 then
      state.vterm:feed(data)
    end

    -- Drain damage events from vterm
    local events = state.vterm:drain()

    if events.damaged then
      -- Accumulate dirty rows
      for _, row in ipairs(events.dirtyRows) do
        state._pendingDirty[row] = true
      end
      state.settleAt = now_ms() + SETTLE_MS

      -- Instant permission detection — bypass settle entirely
      -- Ink renders the prompt across batches, so settle keeps resetting.
      -- Fire the React event the moment we see the trigger text.
      if state.mode ~= MODE_PERMISSION then
        for _, row in ipairs(events.dirtyRows) do
          local text = state.vterm:getRowText(row)
          if text:find("Do you want to", 1, true) then
            local action, target = text:match("Do you want to (%w+)%s+(.-)%?")
            state.mode = MODE_PERMISSION
            state.permissionInfo = { action = action, target = target, rawQuestion = text }
            local R = getRenderer()
            if R and state.rendererSessionId then
              R.showPermissionPrompt(state.rendererSessionId, state.permissionInfo)
            end
            pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "waiting_permission" })
            pushCapEvent(pushEvent, nodeId, "onPermissionRequest", {
              action = action or "",
              target = target or "",
              question = text,
            })
            break
          end
        end
      end
    end

    -- Render-complete signal
    if events.renderCompleted then
      if next(state._pendingDirty) and (not state.settleAt or state.settleAt > now_ms() + 16) then
        state.settleAt = now_ms() + 16
      end
    end

    -- Streaming mode: push text updates at STREAM_MS rate
    if state.mode == MODE_STREAMING and next(state._pendingDirty) then
      local t = now_ms()
      if t - state.lastStreamPush >= STREAM_MS then
        local dirtyList = {}
        for r in pairs(state._pendingDirty) do
          dirtyList[#dirtyList + 1] = r
        end
        table.sort(dirtyList)
        extractSemantics(state, dirtyList, pushEvent, nodeId)
      end
    end

    -- Settle: extract semantics from accumulated dirty rows
    if state.settleAt and now_ms() >= state.settleAt then
      state.settleAt = nil

      local dirtyList = {}
      for r in pairs(state._pendingDirty) do
        dirtyList[#dirtyList + 1] = r
      end
      table.sort(dirtyList)

      if #dirtyList > 0 then
        extractSemantics(state, dirtyList, pushEvent, nodeId)
        state._pendingDirty = {}
      end
    end

    -- Check if process is still alive
    if not state.proc:alive() then
      local code = state.proc:exitCode()
      state.running = false
      state.proc:close()
      state.proc = nil
      pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "stopped" })
      local R = getRenderer()
      if R and state.rendererSessionId then
        R.setStatus(state.rendererSessionId, "stopped")
      end
    end
  end,

  destroy = function(nodeId, state)
    _sessions[nodeId] = nil
    if _focusedId == nodeId then _focusedId = next(_sessions) end
    if state.proc then state.proc:kill(); state.proc:close(); state.proc = nil end
    if state.vterm then state.vterm:free(); state.vterm = nil end
  end,
})

-- ── RPC handlers ─────────────────────────────────────────────────────

local rpcHandlers = {}

rpcHandlers["claude:send"] = function(args)
  local id = (args and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  if not args or not args.message then return { error = "Missing 'message'" } end
  state.pendingMessage = args.message
  return { ok = true }
end

rpcHandlers["claude:stop"] = function(args)
  local id = (args and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  if state.proc then state.proc:write("\x03") end
  return { ok = true }
end

rpcHandlers["claude:respond"] = function(args)
  if not args or not args.choice then return { error = "Missing 'choice'" } end
  local id = (args and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  -- Pass pushEvent=nil since RPC doesn't have it; React already knows
  respondToPermission(state, args.choice, nil, nil)
  return { ok = true }
end

rpcHandlers["claude:screen"] = function(args)
  local id = (args and args.session) or _focusedId
  local state = _sessions[id]
  if not state or not state.vterm then return { error = "No vterm" } end
  return {
    rows = state.vterm:getRows(),
    cursor = state.vterm:getCursor(),
    mode = state.mode,
  }
end

rpcHandlers["claude:mode"] = function(args)
  local id = (args and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  return { mode = state.mode }
end

local originalGetHandlers = Capabilities.getHandlers
Capabilities.getHandlers = function()
  local handlers = originalGetHandlers()
  for method, handler in pairs(rpcHandlers) do handlers[method] = handler end
  return handlers
end

return Session
