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
local Recorder     = require("lua.session_recorder")

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

local _sessions    = {}
local _focusedId   = nil
local _autoAccept  = true   -- survives HMR; toggled via RPC; default ON

-- ── Constants ────────────────────────────────────────────────────────

local TERM_ROWS    = 200
local TERM_COLS    = 30
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

  -- Banner / version — only match the actual splash banner, not mentions in prose
  -- "Claude Code v1.2.3" is always banner; "Claude Code" alone needs banner context (art prefix or row<=5)
  if text:find("Claude Code v%d", 1, false) then return "banner" end
  if row <= 5 and text:find("Claude Code", 1, true) then return "banner" end

  -- Model indicator — only in the splash area (first few rows)
  if row <= 5 and (text:match("Opus [%d%.]+") or text:match("Sonnet [%d%.]+") or text:match("Haiku [%d%.]+")) then
    return "banner"
  end

  -- Banner: crab ASCII art + working directory (e.g. "╰─ ~/creative/reactjit")
  -- Always in the first few rows of the splash screen
  if row <= 5 and text:find("~/", 1, true) then return "banner" end

  -- Interactive menu elements
  -- Horizontal selector: "High effort (default) ← → to adjust"
  if text:find("← →", 1, true) or text:find("to adjust", 1, true) then return "selector" end
  -- Menu hint footer: "Enter to confirm · Esc to exit"
  if text:find("Enter to confirm", 1, true) then return "confirmation" end
  -- Menu title: "Select model", "Select permission", etc.
  if text:match("^%s*Select%s+") then return "menu_title" end

  -- Picker titles: "Resume Session", etc.
  if text:match("^%s*Resume Session") then return "picker_title" end

  -- Picker metadata: "5 hours ago · main · 10.1MB"
  if text:match("%d+%s+%a+ ago") and text:find("·", 1, true) then return "picker_meta" end

  -- Token/cost status bar
  if text:match("%d+%s*tokens") or text:match("%$%d") then return "status_bar" end
  if text:find("for shortcuts", 1, true) or text:find("for short", 1, true) or text:find("esc to interrupt", 1, true) then return "status_bar" end

  -- Idle prompt: ❯ alone (possibly with spaces) near bottom of screen
  if row >= totalRows - 8 then
    local stripped = text:match("^%s*(.-)%s*$")
    if stripped == "❯" or stripped == ">" then return "idle_prompt" end
  end

  -- User prompt: ❯ or > followed by typed text
  if text:find("❯", 1, true) and not text:find("Imagining", 1, true) then
    local pos = text:find("❯", 1, true)
    local rest = text:sub(pos + 3):gsub("^\194\160", ""):gsub("^%s+", "")
    if #rest > 0 then return "user_prompt" end
  end
  if text:match("^> .") then return "user_prompt" end

  -- Thought complete: ✻ Sautéed for 38s, ✻ Brewed for 13m 8s, ✻ Churned for 44s
  -- ✻ is the constant character — verb varies (cooking/drink themed past tense)
  if text:find("✻", 1, true) then return "thought_complete" end

  -- Task active: live progress line (appears after 30s of task activity)
  -- Pattern: "+ Verbing… (Xm Xs · ↓ Nk tokens)" in orange
  if text:find("…", 1, true) and (text:find("· ↓", 1, true) or text:find("tokens", 1, true)) then
    return "task_active"
  end

  -- Task summary: "9 tasks (8 done, 1 open)"
  if text:match("%d+%s+tasks?%s*%(") then return "task_summary" end

  -- Task done: ✔ prefix (completed task in list)
  if text:find("✔", 1, true) then return "task_done" end

  -- Task open: ◻ prefix (pending task in list)
  if text:find("◻", 1, true) then return "task_open" end

  -- Thinking/spinner lines (in-progress, no ✻ prefix)
  if text:find("Imagining", 1, true) or text:find("Thinking", 1, true) then
    return "thinking"
  end

  -- Plan mode transitions — only Claude CLI system messages, not user prose mentioning "plan mode"
  if text:find("Entered plan mode", 1, true) or text:find("Exited plan mode", 1, true) then return "plan_mode" end
  if text:find("exploring and designing", 1, true) or text:find("now exploring", 1, true) then return "plan_mode" end

  -- Tool use: bullet + API-shape word (● Read(, ● Search(, ● Bash(, etc.)
  -- A bullet followed by a normal sentence is assistant text, not a tool invocation.
  local hasBullet = text:find("● ", 1, true) or text:find("• ", 1, true) or text:find("◆ ", 1, true)
  if hasBullet and text:match("[●•◆]%s+%a+%(") then return "tool" end

  -- Diff lines
  if text:match("^%+") or text:match("^%-") then return "diff" end

  -- Image attachment inside result bracket: ⎿  [Image #1]
  -- Must check before generic result — both have ⎿ prefix
  if text:find("⎿", 1, true) and text:find("[Image", 1, true) then return "image_attachment" end

  -- Result/dismiss bracket: ⎿ (menu closed, command result, dialog dismissed)
  if text:find("⎿", 1, true) then return "result" end

  -- Box drawing (tool block borders) — use plain find
  if text:find("┌", 1, true) or text:find("╭", 1, true) or text:find("│", 1, true)
     or text:find("└", 1, true) or text:find("╰", 1, true) then
    return "box_drawing"
  end
  -- Plan/content block borders: ╌╌╌ dashed lines (distinct from ─── solid chrome)
  local stripped = text:match("^%s*(.-)%s*$")
  if stripped:find("╌╌╌", 1, true) then return "plan_border" end
  if stripped:find("────", 1, true) then return "box_drawing" end

  -- Wizard step indicator: ← □ Drop tar... □ Direction ✓ Submit →
  if text:find("□", 1, true) and (text:find("←", 1, true) or text:find("→", 1, true)) then
    return "wizard_step"
  end

  -- Image attachment without result bracket (standalone): [Image #1] (↑ to select)
  if text:find("[Image", 1, true) then return "image_attachment" end

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
      -- Permission overlay removed; vterm renders natively
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
    if _autoAccept then
      respondToPermission(state, 1, pushEvent, nodeId)
    else
      pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "waiting_permission" })
      pushCapEvent(pushEvent, nodeId, "onPermissionRequest", {
        action = permAction or "",
        target = permTarget or "",
        question = permQuestion or "",
      })
    end
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
      _recorder         = Recorder.new({ cli = "claude", rows = TERM_ROWS, cols = TERM_COLS }),
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
      if state._recorder then state._recorder:capture(data) end
    end

    -- Drain damage events from vterm
    local events = state.vterm:drain()

    -- Snapshot settled cursor position for proxy input bar
    local cursor = state.vterm:getCursor()
    if cursor then
      state._settledCursorRow = cursor.row
      state._settledCursorCol = cursor.col
    end

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
            if _autoAccept then
              -- Auto-approve without bothering React
              respondToPermission(state, 1, pushEvent, nodeId)
            else
              pushCapEvent(pushEvent, nodeId, "onStatusChange", { status = "waiting_permission" })
              pushCapEvent(pushEvent, nodeId, "onPermissionRequest", {
                action = action or "",
                target = target or "",
                question = text,
              })
            end
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
    -- Auto-save recording
    if state._recorder and state._recorder.meta.frameCount > 0 then
      local path = "/tmp/claude_session.rec.lua"
      local ok = state._recorder:save(path)
      if ok then
        io.write("[claude_session] Recording saved: " .. path ..
          " (" .. state._recorder.meta.frameCount .. " frames, " ..
          string.format("%.1fs", state._recorder.meta.duration) .. ")\n")
        io.flush()
      end
    end
    if state.proc then state.proc:kill(); state.proc:close(); state.proc = nil end
    if state.vterm then state.vterm:free(); state.vterm = nil end
  end,
})

-- ── RPC handlers ─────────────────────────────────────────────────────

local rpcHandlers = {}

rpcHandlers["claude:send"] = function(args)
  local id = (args and args.session and args.session ~= "default" and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  if not args or not args.message then return { error = "Missing 'message'" } end
  state.pendingMessage = args.message
  return { ok = true }
end

rpcHandlers["claude:stop"] = function(args)
  local id = (args and args.session and args.session ~= "default" and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  if state.proc then state.proc:write("\x03") end
  return { ok = true }
end

rpcHandlers["claude:write"] = function(args)
  if not args or not args.data then return { error = "Missing 'data'" } end
  local ok = Session.writeRaw(args.data)
  return { ok = ok }
end

rpcHandlers["claude:respond"] = function(args)
  if not args or not args.choice then return { error = "Missing 'choice'" } end
  local id = (args and args.session and args.session ~= "default" and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  -- Pass pushEvent=nil since RPC doesn't have it; React already knows
  respondToPermission(state, args.choice, nil, nil)
  return { ok = true }
end

rpcHandlers["claude:screen"] = function(args)
  local id = (args and args.session and args.session ~= "default" and args.session) or _focusedId
  local state = _sessions[id]
  if not state or not state.vterm then return { error = "No vterm" } end
  return {
    rows = state.vterm:getRows(),
    cursor = state.vterm:getCursor(),
    mode = state.mode,
  }
end

rpcHandlers["claude:mode"] = function(args)
  local id = (args and args.session and args.session ~= "default" and args.session) or _focusedId
  local state = _sessions[id]
  if not state then return { error = "No session" } end
  return { mode = state.mode }
end

rpcHandlers["claude:autoaccept"] = function(args)
  if args and args.set ~= nil then
    _autoAccept = not not args.set  -- coerce to bool
  elseif args and args.toggle then
    _autoAccept = not _autoAccept
  end
  return { autoAccept = _autoAccept }
end

rpcHandlers["claude:classified"] = function(args)
  local id = _focusedId
  if args and args.session and args.session ~= "default" then
    id = args.session
  end
  local state = _sessions[id]
  if not state or not state.vterm then return { rows = {}, mode = "no_session" } end

  local vt = state.vterm
  local numRows, _ = vt:size()

  -- find last non-empty row
  local lastRow = -1
  for r = numRows - 1, 0, -1 do
    if #(vt:getRowText(r)) > 0 then lastRow = r; break end
  end

  local rows = {}
  for r = 0, lastRow do
    local text = vt:getRowText(r)
    local kind = classifyRow(text, r, lastRow + 1)
    rows[#rows + 1] = { row = r, kind = kind, text = text }
  end

  -- ── Block pass: blank lines delimit blocks ─────────────────────────
  -- Claude always puts a blank line between actions. Everything between
  -- two blank lines is one block. The first *major* semantic row in the
  -- block determines the kind for ALL other rows in that block.
  --
  -- Major kinds (these SET the block kind):
  --   banner, user_prompt, assistant_text, tool, result, thinking,
  --   plan_mode, permission, error, diff, status_bar, input_border
  -- Everything else (text, box_drawing, list_info, menu_option,
  -- menu_title, etc.) INHERITS the block kind.

  local BLOCK_SETTERS = {
    banner = true, user_prompt = true, thinking = true,
    tool = true, result = true, diff = true,
    plan_mode = true, permission = true, error = true,
    status_bar = true, input_border = true, input_zone = true,
    idle_prompt = true, thought_complete = true, task_active = true,
    image_attachment = true,
  }

  local blockKind = nil
  for i = 1, #rows do
    local text = rows[i].text
    local kind = rows[i].kind
    local isEmpty = text:match("^%s*$")

    if isEmpty then
      blockKind = nil  -- reset on blank line
    elseif BLOCK_SETTERS[kind] then
      -- Major semantic row: this sets the block's kind
      blockKind = kind
    elseif blockKind then
      -- Everything else inherits the block's kind
      rows[i].kind = blockKind
    end
  end

  -- ── Structural input area detection ──────────────────────────────
  -- Scan from the bottom to find the input area: ────, ❯/>, ────
  -- Re-tag those rows as input_border/input_zone regardless of what
  -- classifyRow returned. This is position-independent — it finds the
  -- actual pattern, not a row number guess.
  local n = #rows
  if n >= 2 then
    -- Find the last ──── row (bottom border)
    local botBorder = nil
    for i = n, math.max(1, n - 5), -1 do
      local s = rows[i].text:match("^%s*(.-)%s*$")
      if s:find("────", 1, true) then
        botBorder = i
        break
      end
    end

    if botBorder and botBorder > 1 then
      -- Find top border: scan upward from botBorder for another ────
      local topBorder = nil
      for i = botBorder - 1, math.max(1, botBorder - 6), -1 do
        local s = rows[i].text:match("^%s*(.-)%s*$")
        if s:find("────", 1, true) then
          topBorder = i
          break
        end
      end

      if topBorder then
        -- Verify there's a prompt (❯ or >) somewhere between the borders
        local hasPrompt = false
        for i = topBorder + 1, botBorder - 1 do
          if rows[i].text:find("❯", 1, true) or rows[i].text:match("^>%s") then
            hasPrompt = true
            break
          end
        end

        if hasPrompt then
          rows[topBorder].kind = "input_border"
          rows[botBorder].kind = "input_border"
          for zi = topBorder + 1, botBorder - 1 do
            rows[zi].kind = "input_zone"
          end
        end
      end
    end
  end

  -- Include PTY cursor position for proxy input bar.
  -- Use the vterm cursor directly — getPromptState() fails in splash mode
  -- because _inputBoundary isn't set yet. Instead, find the input_zone row
  -- we already classified above, and compute cursor offset from that.
  -- Extract prompt text and cursor position from input_zone rows.
  -- The CLI (Ink) parks the vterm cursor below visible content, so we
  -- can't use vterm:getCursor(). Instead, find the ❯ row, extract text
  -- after the prompt symbol, and place cursor at end of text.
  local vt = state.vterm
  local promptText = ""
  local promptCursorCol = -1

  for _, r in ipairs(rows) do
    if r.kind == "input_zone" then
      local t = r.text
      -- Strip prompt symbol and leading whitespace
      local pos = t:find("❯", 1, true)
      if pos then
        t = t:sub(pos + 3)  -- ❯ is 3 bytes in UTF-8
      elseif t:match("^>%s") then
        t = t:sub(3)
      end
      -- Strip leading NBSP / spaces
      t = t:gsub("^\194\160", ""):gsub("^%s+", "")
      if #t > 0 then
        if #promptText > 0 then promptText = promptText .. "\n" end
        promptText = promptText .. t
      end
    end
  end

  -- If prompt text matches the placeholder, it's not user input — show as empty
  if state._placeholder and #promptText > 0 then
    -- The placeholder in vterm may be truncated, so check if one starts with the other
    local ph = state._placeholder
    if promptText == ph or ph:sub(1, #promptText) == promptText or promptText:sub(1, #ph) == ph then
      promptText = ""
    end
  end

  -- Try to get cursor col from vterm — the col may track even if the row is wrong.
  -- Find where text starts on the prompt row, then compute offset.
  local cursor = vt and vt:getCursor()
  if cursor and #promptText > 0 then
    -- Find the input_zone row with the ❯ prompt
    local promptVtRow = nil
    local textStartCol = 0
    for _, r in ipairs(rows) do
      if r.kind == "input_zone" and (r.text:find("❯", 1, true) or r.text:match("^>%s")) then
        promptVtRow = r.row
        -- Scan cells to find where user text starts
        local foundPrompt = false
        for col = 0, 15 do
          local cell = vt:getCell(r.row, col)
          if not cell or not cell.char then break end
          local ch = cell.char
          if not foundPrompt and (ch:find("❯", 1, true) or ch == "!" or ch == ">" or ch == "›") then
            foundPrompt = true
          elseif foundPrompt then
            if ch == " " or ch == "\194\160" or ch == "" then
              textStartCol = col + 1
            else
              textStartCol = col
            end
            break
          end
        end
        break
      end
    end

    -- Scan cells on the prompt row for cursor indicator.
    -- Ink renders cursor as inverse/bold/different-bg character.
    -- Log all cell attributes to find the pattern.
    if promptVtRow then
      local cols = select(2, vt:size())
      local cursorCol = nil
      for col = textStartCol, math.min(cols - 1, textStartCol + #promptText + 1) do
        local cell = vt:getCell(promptVtRow, col)
        if cell then
          local hasBg = cell.bg and (cell.bg[1] > 0 or cell.bg[2] > 0 or cell.bg[3] > 0)
          local isReverse = cell.reverse
          local isBold = cell.bold
          if hasBg or isReverse then
            io.write(string.format("[CURSOR-CELL] col=%d char='%s' bg=%s reverse=%s bold=%s\n",
              col, cell.char or "",
              hasBg and string.format("%d,%d,%d", cell.bg[1], cell.bg[2], cell.bg[3]) or "nil",
              tostring(isReverse), tostring(isBold)))
            io.flush()
            if not cursorCol then
              cursorCol = col - textStartCol
            end
          end
        end
      end
      if cursorCol then
        promptCursorCol = math.min(cursorCol, #promptText)
      else
        promptCursorCol = #promptText
      end
    else
      promptCursorCol = #promptText
    end
  else
    promptCursorCol = #promptText
  end

  return {
    rows = rows,
    mode = state.mode,
    boundary = state._inputBoundary or numRows,
    promptCursorCol = promptCursorCol,
    cursorVisible = true,
    promptText = promptText,
    placeholder = state._placeholder,
  }
end

-- ── Graph / search / turn RPCs ───────────────────────────────────────
-- These expose the semantic graph built by claude_canvas.lua

local Canvas = nil
local function getCanvas()
  if not Canvas then
    local ok, mod = pcall(require, "lua.claude_canvas")
    if ok then Canvas = mod end
  end
  return Canvas
end

rpcHandlers["claude:graph"] = function(args)
  local C = getCanvas()
  if not C then return { error = "Canvas not loaded" } end
  local sessionId = (args and args.session) or "default"
  local graph = C.getGraphForSession(sessionId)
  if not graph then return { nodes = {}, turns = {}, state = {} } end

  -- Serialize: flatten nodes into a list (tables with string keys are fine over bridge)
  local nodeList = {}
  for _, nid in ipairs(graph.nodeOrder) do
    local node = graph.nodes[nid]
    if node then
      nodeList[#nodeList + 1] = {
        id = node.id,
        type = node.type,
        kind = node.kind,
        role = node.role,
        lane = node.lane,
        turnId = node.turnId,
        parentId = node.parentId,
        rowStart = node.rowStart,
        rowEnd = node.rowEnd,
        text = node.text or (node.lines and table.concat(node.lines, "\n") or ""),
        lineCount = #node.lines,
        childCount = #node.childrenIds,
        childrenIds = node.childrenIds,
      }
    end
  end

  return {
    nodes = nodeList,
    turns = graph.turnList,
    state = graph.state,
    frame = graph.frame,
  }
end

rpcHandlers["claude:turns"] = function(args)
  local C = getCanvas()
  if not C then return { error = "Canvas not loaded" } end
  local sessionId = (args and args.session) or "default"
  local graph = C.getGraphForSession(sessionId)
  if not graph then return { turns = {} } end

  local turns = {}
  for _, tid in ipairs(graph.turnList) do
    local turnNid = "turn:t" .. tid
    local turnNode = graph.nodes[turnNid]
    if turnNode then
      local turnData = {
        id = tid,
        children = {},
      }
      for _, childId in ipairs(turnNode.childrenIds) do
        local child = graph.nodes[childId]
        if child then
          -- Collect all lines for this node
          local content = table.concat(child.lines or {}, "\n")
          turnData.children[#turnData.children + 1] = {
            id = child.id,
            kind = child.kind,
            role = child.role,
            lane = child.lane,
            text = content,
            lineCount = #(child.lines or {}),
          }
        end
      end
      turns[#turns + 1] = turnData
    end
  end

  return { turns = turns, turnCount = #turns }
end

rpcHandlers["claude:search"] = function(args)
  if not args or not args.query then return { error = "Missing 'query'" } end
  local C = getCanvas()
  if not C then return { error = "Canvas not loaded" } end
  local sessionId = (args and args.session) or "default"
  local classified = C.getClassifiedForSession(sessionId)
  if not classified then return { results = {} } end

  local query = args.query:lower()
  local maxResults = args.limit or 50
  local results = {}

  for _, entry in ipairs(classified) do
    if entry.text and entry.text:lower():find(query, 1, true) then
      results[#results + 1] = {
        row = entry.row,
        kind = entry.kind,
        text = entry.text,
        turnId = entry.turnId,
        nodeId = entry.nodeId,
      }
      if #results >= maxResults then break end
    end
  end

  return { results = results, total = #results, query = args.query }
end

rpcHandlers["claude:diff"] = function(args)
  local C = getCanvas()
  if not C then return { error = "Canvas not loaded" } end
  local sessionId = (args and args.session) or "default"
  local nid = C.getNodeIdForSession(sessionId)
  if not nid then return { ops = {} } end
  local diff = C.getDiff(nid)
  if not diff then return { ops = {} } end

  -- Serialize diff ops (they reference node tables, flatten them)
  local ops = {}
  for _, op in ipairs(diff) do
    local entry = { op = op.op, id = op.id }
    if op.node then
      entry.kind = op.node.kind
      entry.role = op.node.role
      entry.text = op.node.text
      entry.turnId = op.node.turnId
    end
    if op.state then entry.state = op.state end
    ops[#ops + 1] = entry
  end

  return { ops = ops }
end

-- Remove an image attachment by sending the CLI's keystroke sequence:
-- up-arrow to enter selection, navigate to the target, backspace to remove, down to return
rpcHandlers["claude:removeImage"] = function(args)
  local index = args and args.index or 0       -- 0-indexed from left
  local total = args and args.total or 1
  -- Enter image selection mode (up arrow) — CLI selects the LAST image
  Session.writeRaw("\x1b[A")
  -- Navigate left to reach the target image (CLI starts at rightmost)
  local moves = total - 1 - index
  for i = 1, moves do
    Session.writeRaw("\x1b[D")  -- left arrow
  end
  -- Small delay would be ideal but writeRaw is synchronous buffered, CLI processes in order
  Session.writeRaw("\x7f")      -- backspace to remove
  Session.writeRaw("\x1b[B")    -- down arrow to return to input
  return { ok = true }
end

rpcHandlers["claude:openFile"] = function(args)
  if not args or not args.path then return { error = "Missing path" } end
  os.execute('xdg-open "' .. args.path .. '" 2>/dev/null &')
  return { ok = true }
end

rpcHandlers["claude:images"] = function()
  local cacheDir = os.getenv("HOME") .. "/.claude/image-cache"
  local handle = io.popen('ls -t "' .. cacheDir .. '" 2>/dev/null')
  if not handle then return { images = {} } end
  local listing = handle:read("*a") or ""
  handle:close()
  local images = {}
  for name in listing:gmatch("[^\n]+") do
    if name:match("%.png$") or name:match("%.jpg$") or name:match("%.jpeg$") then
      images[#images + 1] = cacheDir .. "/" .. name
    end
  end
  return { images = images }
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
