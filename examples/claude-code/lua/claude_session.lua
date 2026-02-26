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

local TERM_ROWS    = 200
local TERM_COLS    = 120
local SETTLE_MS    = 120   -- ms after last damage before extracting semantics
local STREAM_MS    = 50    -- ms between streaming text updates to renderer
local STREAM_IDLE_MS = 500 -- ms of no damage before exiting streaming mode

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

-- ── Input zone detection ────────────────────────────────────────────
-- Scans from the bottom of the vterm grid upward to find where Claude CLI's
-- input area starts (the ──── separator above the ❯ prompt). Everything at
-- or below that row is "input zone" and should never be extracted as content.
--
-- Returns: boundaryRow, placeholderText
--   boundaryRow   = first row of the input zone (or numRows if not found)
--   placeholderText = text after ❯ in the prompt line (the tab-completable hint)

-- Helper: is this row a separator line (────, ╌╌╌╌, etc.)?
local function isSeparatorRow(vt, row)
  local text = vt:getRowText(row)
  local stripped = text:match("^%s*(.-)%s*$") or ""
  return stripped:find("────", 1, true)
    or stripped:find("╌╌╌╌", 1, true)
    or stripped:find("┄┄┄┄", 1, true)
    or stripped:find("┈┈┈┈", 1, true)
    or (stripped:match("^%-%-%-%-") and #stripped > 20)
end

local function findInputZoneBoundary(vt, numRows)
  local boundary = numRows
  local placeholder = nil

  -- Find the last non-empty row — that's where the content ends.
  -- Claude CLI renders inline top-down, NOT pinned to the bottom.
  local lastContent = -1
  for r = numRows - 1, 0, -1 do
    if #(vt:getRowText(r)) > 0 then
      lastContent = r
      break
    end
  end

  if lastContent < 0 then return numRows, nil end  -- grid is empty

  -- The real input prompt is ALWAYS sandwiched between two ──── separators:
  --   ────────────────────────
  --   ❯ Try "fix typecheck errors"
  --   ────────────────────────
  --
  -- A menu selection cursor (❯ 1. Default) is NOT between separators.
  -- Scan backward looking for this sandwich pattern.

  for r = lastContent, math.max(0, lastContent - 15), -1 do
    local text = vt:getRowText(r)
    local stripped = text:match("^%s*(.-)%s*$") or ""

    local promptStart = stripped:find("❯", 1, true)
    local isSimplePrompt = stripped:match("^>%s") or stripped == ">"

    if promptStart or isSimplePrompt then
      -- Check for separator ABOVE this row
      local hasSepAbove = false
      for above = r - 1, math.max(0, r - 3), -1 do
        local aboveText = vt:getRowText(above)
        if #aboveText > 0 then
          hasSepAbove = isSeparatorRow(vt, above)
          break  -- check only the nearest non-empty row above
        end
      end

      -- Check for separator BELOW this row
      local hasSepBelow = false
      for below = r + 1, math.min(lastContent, r + 3) do
        local belowText = vt:getRowText(below)
        if #belowText > 0 then
          hasSepBelow = isSeparatorRow(vt, below)
          break  -- check only the nearest non-empty row below
        end
      end

      if hasSepAbove and hasSepBelow then
        -- This is the real input prompt, sandwiched between separators.
        -- Extract placeholder text.
        if promptStart then
          local rest = stripped:sub(promptStart + 3)
          rest = rest:gsub("^\194\160", "")  -- strip NBSP
          rest = rest:gsub("^%s+", "")
          if #rest > 1 then placeholder = rest end
        else
          local after = stripped:match("^>%s+(.+)")
          if after and #after > 1 then placeholder = after end
        end

        -- Boundary = the separator above the prompt (top of input zone)
        for above = r - 1, math.max(0, r - 3), -1 do
          if isSeparatorRow(vt, above) then
            boundary = above
            break
          end
        end
        break
      end
      -- Not sandwiched → menu cursor, keep scanning upward
    end
  end

  return boundary, placeholder
end

-- ── Row classification ──────────────────────────────────────────────

local function classifyRow(text, row, totalRows)

  -- Permission prompt
  local action, target = text:match("Do you want to (%w+)%s+(.-)%?")
  if action then return "permission", action, target end

  -- Numbered menu/selection options (1. Yes, 2. Sonnet, ❯ 1. Default, etc.)
  -- Matches with or without ❯/› cursor prefix
  if text:match("^%s*[›>]?%s*%d+%.%s+") then return "menu_option" end
  -- Also catch ❯ followed by a numbered option (the selected item in a menu)
  if text:find("❯", 1, true) then
    local pos = text:find("❯", 1, true)
    local after = text:sub(pos + 3):gsub("^\194\160", ""):gsub("^%s+", "")
    if after:match("^%d+%.%s") then return "menu_option" end
  end

  -- Banner / version
  if text:find("Claude Code v", 1, true) or text:find("Claude Code ", 1, true) then return "banner" end

  -- Model indicator
  if text:match("Opus [%d%.]+") or text:match("Sonnet [%d%.]+") or text:match("Haiku [%d%.]+") then
    return "banner"
  end

  -- Interactive menu elements
  -- Horizontal selector: "High effort (default) ← → to adjust"
  if text:find("← →", 1, true) or text:find("to adjust", 1, true) then return "selector" end
  -- Menu hint footer: "Enter to confirm · Esc to exit"
  if text:find("Enter to confirm", 1, true) then return "confirmation" end
  -- Menu title: "Select model", "Select permission", etc.
  if text:match("^%s*Select%s+") then return "menu_title" end

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
  -- ❯ followed by text — check both regular space and NBSP (C2 A0 = \194\160)
  if text:find("❯", 1, true) and not text:find("Imagining", 1, true) then
    local pos = text:find("❯", 1, true)
    local rest = text:sub(pos + 3):gsub("^\194\160", ""):gsub("^%s+", "")
    if #rest > 0 then return "user_prompt" end
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

  -- Find where the input zone starts — everything at/below is CLI chrome
  local inputBoundary, placeholder = findInputZoneBoundary(vt, numRows)
  state._inputBoundary = inputBoundary
  -- Only set placeholder once (first detection). Once user types, the prompt
  -- text changes but _placeholder must stay as the original hint text so
  -- getPromptState() can distinguish placeholder from real input.
  if placeholder and not state._placeholder then
    state._placeholder = placeholder
  end

  local prevMode = state.mode
  local sawPermission = false
  local permAction, permTarget, permQuestion = nil, nil, nil
  -- The ❯ prompt lives in the input zone (below boundary), so we detect idle
  -- from the boundary scan: if we found the input zone, the prompt is visible.
  local sawIdlePrompt = (inputBoundary < numRows)
  local sawThinking = false
  local sawBanner = false
  local newTextLines = {}
  local sawTool = false
  local toolText = nil
  local sawError = false
  local errorText = nil

  -- Count dirty content rows — rows above the input boundary that have content.
  -- This is separate from classification: Claude CLI wraps responses in │ box
  -- borders, which classifyRow marks as "box_drawing". But they're still content
  -- rows that indicate Claude is actively streaming a response.
  local contentDirtyCount = 0

  -- Classify each dirty row
  for _, row in ipairs(dirtyRows) do
    -- Skip rows in the input zone — we have our own input field
    if row >= inputBoundary then goto continue end

    local text = vt:getRowText(row)
    local kind, extra1, extra2 = classifyRow(text, row, numRows)

    -- Count content-area rows with actual text (regardless of classification)
    -- Skip first 3 rows (banner area) and status_bar/idle_prompt
    if row >= 3 and #text > 0 and kind ~= "banner" and kind ~= "status_bar" and kind ~= "idle_prompt" then
      contentDirtyCount = contentDirtyCount + 1
    end

    -- Dedup: skip rows we've already emitted this turn
    local rowKey = row .. ":" .. text:sub(1, 60)
    if state._emittedRows[rowKey] and kind ~= "permission" then
      goto continue
    end
    state._emittedRows[rowKey] = true

    if kind == "permission" then
      sawPermission = true
      permAction = extra1
      permTarget = extra2
      permQuestion = text
    elseif kind == "menu_option" then
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
    elseif kind == "text" then
      newTextLines[#newTextLines + 1] = { row = row, text = text, kind = kind }
    end
    -- user_prompt, status_bar, box_drawing → intentionally ignored for blocks
    -- (but box_drawing IS counted for streaming detection via contentDirtyCount)

    ::continue::
  end

  -- ── Mode transitions ────────────────────────────────────────────
  -- Key insight: Claude CLI wraps all response text in │ box borders, so
  -- classifyRow returns "box_drawing" for response lines, not "text".
  -- Use contentDirtyCount (any content-area damage) for streaming detection,
  -- not just #newTextLines (which requires "text" classification).

  local hasContentActivity = contentDirtyCount > 0 or #newTextLines > 0
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
  elseif sawThinking and not hasContentActivity and prevMode ~= MODE_SPLASH then
    newMode = MODE_THINKING
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
  elseif hasContentActivity and prevMode ~= MODE_SPLASH then
    newMode = MODE_STREAMING
  elseif prevMode == MODE_STREAMING then
    -- Stay in streaming — tick handles the STREAMING→IDLE transition
    -- after a quiet period with no damage (STREAM_IDLE_MS)
    newMode = MODE_STREAMING
  elseif sawIdlePrompt and not sawThinking and not hasContentActivity and prevMode ~= MODE_SPLASH then
    newMode = MODE_IDLE
  end

  -- Clear dedup set and placeholder on transition to idle (new conversation turn)
  if newMode == MODE_IDLE and prevMode ~= MODE_IDLE then
    state._emittedRows = {}
    state._placeholder = nil  -- reset so next idle prompt detects fresh placeholder
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

  -- Streaming content push is handled in tick, not here

  -- Thinking -> Idle: finalize
  -- (Streaming -> Idle is handled by the tick timer, not here)
  if newMode == MODE_IDLE and prevMode == MODE_THINKING then
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

function Session.getPlaceholder(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state._placeholder end
  return nil
end

function Session.getInputBoundary(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state and state._inputBoundary then return state._inputBoundary end
  return TERM_ROWS
end

--- Check if the CLI is showing an interactive menu (e.g. /model, /permissions).
--- Detected by "Enter to confirm" in the vterm content.
function Session.isMenuActive(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state or not state.vterm then return false end
  return state.vterm:findText("Enter to confirm") ~= nil
end

--- Write raw bytes to the PTY (for sending escape sequences like arrow keys)
function Session.writeRaw(data, sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state or not state.proc then
    io.write("[PTY] writeRaw FAILED: no state/proc for id=" .. tostring(id) .. "\n"); io.flush()
    return false
  end
  -- Log printable chars, hex for control chars
  local display = data:gsub("[%c]", function(c) return string.format("\\x%02x", c:byte()) end)
  io.write("[PTY] writeRaw: '" .. display .. "' (" .. #data .. " bytes)\n"); io.flush()
  state.proc:write(data)
  return true
end

--- Read the current prompt line text and cursor column from the vterm.
--- Returns: { text = "user's input", cursorCol = N, promptRow = R }
--- Uses vterm cursor position to find the prompt row (works for ❯, !, >, etc.)
function Session.getPromptState(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state or not state.vterm then return nil end

  local vt = state.vterm
  local boundary = state._inputBoundary or TERM_ROWS
  local cursor = vt:getCursor()
  if not cursor then return nil end

  local cursorRow = cursor.row
  local cursorCol = cursor.col

  -- Cursor must be in the input zone (at or below boundary)
  if cursorRow < boundary then return nil end

  local text = vt:getRowText(cursorRow)
  if #text == 0 then return nil end

  -- Find the prompt prefix by scanning cells from the left.
  -- The prompt is a symbol (❯, !, >) followed by space/NBSP, then user text.
  -- We find where the actual text content starts by looking for the first
  -- cell after the prompt symbol + space.
  local textStartCol = 0
  local foundPrompt = false
  for col = 0, math.min(15, cursorCol + 5) do
    local cell = vt:getCell(cursorRow, col)
    if not cell or not cell.char then break end
    local ch = cell.char
    -- Common prompt symbols: ❯ (U+276F), !, >, ›
    if not foundPrompt and (ch:find("❯", 1, true) or ch == "!" or ch == ">" or ch == "›") then
      foundPrompt = true
      -- Next cell should be space/NBSP — skip it too
    elseif foundPrompt then
      -- Skip the space/NBSP after the prompt symbol
      if ch == " " or ch == "\194\160" or ch == "" then
        textStartCol = col + 1
      else
        textStartCol = col
      end
      break
    end
  end

  -- Extract user text: everything from textStartCol onward
  -- Build the text by reading cells (avoids byte/cell mismatch)
  local userChars = {}
  local cols = select(2, vt:size())
  for col = textStartCol, cols - 1 do
    local cell = vt:getCell(cursorRow, col)
    if cell and cell.char and #cell.char > 0 then
      userChars[#userChars + 1] = cell.char
    else
      break  -- hit empty cell, end of text
    end
  end
  local userText = table.concat(userChars)
  -- Trim trailing whitespace
  userText = userText:gsub("%s+$", "")

  -- If the text exactly matches the known placeholder, it's not user input
  if state._placeholder and #userText > 0 and userText == state._placeholder then
    userText = ""
  end

  -- Cursor offset into user text (cell-based)
  local inputCursorCol = math.max(0, cursorCol - textStartCol)

  return {
    text = userText,
    cursorCol = inputCursorCol,
    promptRow = cursorRow,
  }
end

--- Read rows below the input zone (for @-picker dropdown, slash command menus, etc.)
--- Returns array of { row = N, text = "...", kind = "..." }
function Session.getDropdownRows(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state or not state.vterm then return {} end

  local vt = state.vterm
  local boundary = state._inputBoundary or TERM_ROWS
  local rows = {}

  -- Find the last non-empty row below boundary
  for r = boundary, TERM_ROWS - 1 do
    local text = vt:getRowText(r)
    if #text > 0 then
      -- Skip separator lines and the prompt itself
      local stripped = text:match("^%s*(.-)%s*$") or ""
      if not isSeparatorRow(vt, r) then
        local kind = classifyRow(text, r, TERM_ROWS)
        if kind ~= "idle_prompt" and kind ~= "status_bar" and kind ~= "user_prompt" then
          rows[#rows + 1] = { row = r, text = text, kind = kind }
        end
      end
    end
  end
  return rows
end

-- Deferred resize: canvas sets desired size from render, tick applies it
local _desiredCols, _desiredRows = nil, nil

function Session.setDesiredSize(cols, rows)
  _desiredCols = cols
  _desiredRows = rows
end

-- For backward compat (not called from render anymore)
function Session.resize(cols, rows, sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state then return end
  rows = rows or TERM_ROWS
  cols = cols or TERM_COLS
  if state.vterm then
    local curRows, curCols = state.vterm:size()
    if curCols ~= cols or curRows ~= rows then
      state.vterm:resize(rows, cols)
      if state.proc then state.proc:resize(rows, cols) end
      state._emittedRows = {}  -- clear dedup — grid reflows
    end
  end
end

function Session.isInitialized(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.mode ~= MODE_SPLASH end
  return false
end

--- Check if the CLI prompt is ready for input (may still be in SPLASH mode visually)
function Session.isReady(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state._readyForInput == true end
  return false
end

function Session.getMode(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if state then return state.mode end
  return nil
end

function Session.getDebugInfo(sessionNodeId)
  local id = sessionNodeId or _focusedId
  local state = _sessions[id]
  if not state then return { alive = false, mode = "no_session" } end
  local dirtyCount = 0
  for _ in pairs(state._pendingDirty) do dirtyCount = dirtyCount + 1 end
  -- Count content rows in vterm (for debug display)
  local vtContentRows = 0
  if state.vterm then
    local boundary = state._inputBoundary or TERM_ROWS
    for i = 0, boundary - 1 do
      if #(state.vterm:getRowText(i)) > 0 then vtContentRows = vtContentRows + 1 end
    end
  end
  return {
    alive = state.proc and state.proc:alive() or false,
    mode = state.mode or "?",
    boundary = state._inputBoundary or -1,
    dirty = dirtyCount,
    lastDmg = state._lastDamageAt and math.floor(now_ms() - state._lastDamageAt) or -1,
    settle = state.settleAt and math.floor(state.settleAt - now_ms()) or -1,
    streaming = state.lastAssistantText and #state.lastAssistantText or 0,
    vtContent = vtContentRows,
  }
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
      _lastDamageAt     = nil,
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

    -- Apply deferred column resize (rows stay fixed — row resize segfaults libvterm)
    if _desiredCols and state.vterm then
      local curRows, curCols = state.vterm:size()
      if curCols ~= _desiredCols then
        state.vterm:resize(curRows, _desiredCols)
        if state.proc then state.proc:resize(curRows, _desiredCols) end
        state._emittedRows = {}
      end
      _desiredCols = nil
    end

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
      state._lastDamageAt = now_ms()

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

    -- Streaming mode: push content directly at STREAM_MS rate
    -- Don't call extractSemantics here — that caused mode toggling via dedup
    if state.mode == MODE_STREAMING then
      local t = now_ms()
      if t - state.lastStreamPush >= STREAM_MS then
        state.lastStreamPush = t
        local R = getRenderer()
        local sid = state.rendererSessionId
        if R and sid then
          local vt = state.vterm
          -- Refresh boundary every push — it moves as Claude streams content
          -- and the prompt shifts down. Using the stale value from extractSemantics
          -- would read only the first few banner rows.
          local inputBoundary = findInputZoneBoundary(vt, TERM_ROWS)
          state._inputBoundary = inputBoundary
          -- Only capture Claude's response content, not the full vterm history.
          -- 1. Walk backward to find the ❯ user_prompt row
          -- 2. Walk forward past user message continuation rows
          -- 3. Start capturing at the first Claude response row
          local promptRow = nil
          for i = inputBoundary - 1, 0, -1 do
            local text = vt:getRowText(i)
            if #text > 0 then
              local kind = classifyRow(text, i, TERM_ROWS)
              if kind == "user_prompt" then
                promptRow = i
                break
              end
            end
          end
          -- Walk forward from prompt to find where Claude's response starts.
          -- User message continuation rows are plain text (no bullets, no box chars).
          -- Claude's response starts with thinking, tool bullet, or box-drawing (│).
          local responseStart = promptRow and (promptRow + 1) or 3
          if promptRow then
            for i = promptRow + 1, inputBoundary - 1 do
              local text = vt:getRowText(i)
              if #text > 0 then
                local kind = classifyRow(text, i, TERM_ROWS)
                -- These kinds mark the start of Claude's output
                if kind == "thinking" or kind == "tool" or kind == "box_drawing"
                   or kind == "diff" or kind == "error" then
                  responseStart = i
                  break
                end
                -- A blank line after user text also signals the boundary
              elseif i > promptRow + 1 then
                -- Empty row after user message = gap before response
                responseStart = i + 1
                break
              end
            end
          end
          local contentLines = {}
          for i = responseStart, inputBoundary - 1 do
            local text = vt:getRowText(i)
            if #text > 0 then
              local kind = classifyRow(text, i, TERM_ROWS)
              if kind ~= "banner" and kind ~= "status_bar" and kind ~= "idle_prompt" then
                contentLines[#contentLines + 1] = "[" .. kind .. "] " .. text
              end
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

      -- STREAMING → IDLE: only after no damage for STREAM_IDLE_MS
      -- But if a menu is active, DON'T finalize — keep overwriting streaming text
      -- so arrow key navigation replaces the display instead of stacking blocks.
      local menuActive = state.vterm and state.vterm:findText("Enter to confirm") ~= nil
      if state._lastDamageAt and (now_ms() - state._lastDamageAt) >= STREAM_IDLE_MS then
        if menuActive then
          -- Menu is open — stay in streaming mode so next arrow key just overwrites.
          -- Do one content refresh to keep display current, but don't finalize.
          state.mode = MODE_STREAMING
          state._lastDamageAt = now_ms()  -- reset timer so we don't keep hitting this
        else
          -- Final boundary refresh before finalizing
          local finalBoundary = findInputZoneBoundary(state.vterm, TERM_ROWS)
          state._inputBoundary = finalBoundary
          local R = getRenderer()
          local sid = state.rendererSessionId
          if R and sid then
            -- Finalize: one last content read — only the current response
            local promptRow = nil
            for i = finalBoundary - 1, 0, -1 do
              local text = state.vterm:getRowText(i)
              if #text > 0 then
                local kind = classifyRow(text, i, TERM_ROWS)
                if kind == "user_prompt" then
                  promptRow = i
                  break
                end
              end
            end
            local responseStart = promptRow and (promptRow + 1) or 3
            if promptRow then
              for i = promptRow + 1, finalBoundary - 1 do
                local text = state.vterm:getRowText(i)
                if #text > 0 then
                  local kind = classifyRow(text, i, TERM_ROWS)
                  if kind == "thinking" or kind == "tool" or kind == "box_drawing"
                     or kind == "diff" or kind == "error" then
                    responseStart = i
                    break
                  end
                elseif i > promptRow + 1 then
                  responseStart = i + 1
                  break
                end
              end
            end
            local contentLines = {}
            for i = responseStart, finalBoundary - 1 do
              local text = state.vterm:getRowText(i)
              if #text > 0 then
                local kind = classifyRow(text, i, TERM_ROWS)
                if kind ~= "banner" and kind ~= "status_bar" and kind ~= "idle_prompt" then
                  contentLines[#contentLines + 1] = "[" .. kind .. "] " .. text
                end
              end
            end
            if #contentLines > 0 then
              state.lastAssistantText = table.concat(contentLines, "\n")
            end
            local fullText = state.lastAssistantText
            if fullText then
              R.addText(sid, fullText)
            end
            R.setStreaming(sid, nil)
            R.setStatus(sid, "idle")
          end
          state.mode = MODE_IDLE
          state._emittedRows = {}
          state._pendingDirty = {}
          pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "idle" })
        end
      end
    end

    -- Settle: extract semantics from accumulated dirty rows
    -- Skip during streaming — the streaming block above handles content + idle transition
    if state.mode ~= MODE_STREAMING and state.settleAt and now_ms() >= state.settleAt then
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

Session.classifyRow = classifyRow
Session.isSeparatorRow = isSeparatorRow

return Session
