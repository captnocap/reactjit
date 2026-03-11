--[[
  capabilities/terminal.lua — Visual, hittable PTY terminal capability

  Spawns shells over a PTY and feeds output through libvterm for structured,
  damage-driven updates. Renders the vterm cell grid directly with proper
  ANSI colors, handles keyboard input, scrolling, and cursor blink.

  Click to focus, type to interact. It's a real terminal.

  ── Terminal types ────────────────────────────────────────────────────────────

  "user"     Interactive bash/zsh as the current OS user. Cannot escalate
             privileges. Safe for general shell interaction.

  "root"     Interactive shell via `sudo -i <shell>`. Requires passwordless
             sudo OR the PTY naturally shows the password prompt — either way
             the caller handles it. Use intentionally.

  "template" Stateless, ephemeral execution. Declare a bash environment (env
             vars, cwd, shell flags). Each command sent spawns its own fresh
             PTY: `bash --norc --noprofile -c "<cmd>"`. Exits when done, fires
             onExit. Perfect for sandboxed one-shot commands.

  ── React usage ──────────────────────────────────────────────────────────────

    -- Visual interactive terminal (one-liner):
    <Terminal type="user" style={{ flexGrow: 1 }} />

    -- TUI app (claude, codex, vim) — rawMode for apps that manage their own display:
    <Terminal type="user" rawMode shell="claude" style={{ flexGrow: 1 }} />

    -- With event hooks for custom handling:
    <Terminal type="user" onData={(e) => log(e.data)} style={{ flexGrow: 1 }} />

    -- Hook pattern (managed state + send/resize helpers):
    const { send, sendLine, terminalProps } = usePTY({ type: 'user' })
    <Terminal {...terminalProps} style={{ flexGrow: 1 }} />

  ── RPC ──────────────────────────────────────────────────────────────────────

    bridge.rpc('pty:write',  { session, data })         → { ok }
    bridge.rpc('pty:resize', { session, rows, cols })   → { ok }
    bridge.rpc('pty:kill',   { session, signal? })      → { ok }
    bridge.rpc('pty:focus',  { session })               → { ok }
    bridge.rpc('pty:list')                              → [{ id, session, ... }]
    bridge.rpc('pty:screen', { session })               → { rows: [...], cursor: {...} }

    `session` is the string session name or numeric nodeId.
    Omit to target the focused session.
]]

local Capabilities = require("lua.capabilities")
local PTY          = require("lua.pty")
local VTerm        = require("lua.vterm")
local Scissor      = require("lua.scissor")

-- ── Lazy-loaded Measure module ─────────────────────────────────────────────

local Measure = nil
local function ensureMeasure()
  if not Measure then
    local ok, m = pcall(require, "lua.measure")
    if ok then Measure = m end
  end
  return Measure
end

-- ── Constants ───────────────────────────────────────────────────────────────

local SETTLE_MS    = 120   -- ms after last damage before extracting dirty rows
local BLINK_RATE   = 0.53  -- cursor blink interval in seconds
local SCROLL_LINES = 3     -- lines per scroll wheel tick
local FONT_SIZE    = 13    -- monospace font size
local PADDING      = 4     -- content padding in pixels

-- Default terminal colors (dark theme)
local BG_COLOR   = { 0.05, 0.05, 0.10, 1.0 }  -- dark background
local FG_DEFAULT = { 0.80, 0.84, 0.90 }        -- light gray text
local CURSOR_COLOR = { 0.65, 0.89, 0.63, 0.85 } -- green cursor block

-- ── Clock (monotonic, milliseconds) ─────────────────────────────────────────

local function now_ms()
  if love and love.timer then
    return love.timer.getTime() * 1000
  end
  return os.clock() * 1000
end

-- ── Session registry ─────────────────────────────────────────────────────────

local _sessions     = {}   -- nodeId -> state
local _sessionNames = {}   -- session string -> nodeId
local _focusedId    = nil  -- nodeId of the "focused" session (fallback for RPC)

-- ── Helpers ──────────────────────────────────────────────────────────────────

local function resolveSession(idOrName)
  if type(idOrName) == "number" then
    return _sessions[idOrName], idOrName
  end
  if type(idOrName) == "string" then
    local nid = _sessionNames[idOrName]
    if nid then return _sessions[nid], nid end
  end
  return _sessions[_focusedId], _focusedId
end

local function pushCap(pushEvent, nodeId, handler, data)
  if not pushEvent then return end
  local payload = { targetId = nodeId, handler = handler }
  if data then for k, v in pairs(data) do payload[k] = v end end
  pushEvent({ type = "capability", payload = payload })
end

-- ── Spawn helpers ────────────────────────────────────────────────────────────

local function buildEnv(props)
  local env = {}
  if props.env then
    for k, v in pairs(props.env) do env[k] = v end
  end
  env.TERM      = env.TERM      or "xterm-256color"
  env.COLORTERM = env.COLORTERM or "truecolor"
  return env
end

local function spawnPTY(props, command)
  local ptyType = props.type or "user"
  local shell   = props.shell or "bash"
  local args    = {}

  if ptyType == "root" then
    shell = "sudo"
    args  = { "-i", props.shell or "bash" }

  elseif ptyType == "template" then
    shell = props.shell or "bash"
    if command then
      args = { "--norc", "--noprofile", "-c", command }
    else
      args = { "--norc", "--noprofile" }
    end
  end

  return PTY.open({
    shell   = shell,
    args    = args,
    cwd     = props.cwd,
    env     = buildEnv(props),
    rows    = props.rows or 24,
    cols    = props.cols or 80,
    rawMode = props.rawMode or false,
  })
end

-- ── Capability registration ─────────────────────────────────────────────────

Capabilities.register("Terminal", {
  visual   = true,
  hittable = true,

  schema = {
    type        = { type = "string",  default = "user",   desc = "user | root | template" },
    shell       = { type = "string",  default = "bash",   desc = "Shell: bash | zsh" },
    cwd         = { type = "string",                      desc = "Working directory" },
    rows        = { type = "number",  default = 24,       desc = "Terminal rows" },
    cols        = { type = "number",  default = 80,       desc = "Terminal columns" },
    env         = { type = "object",                      desc = "Environment overrides { KEY: value | false }" },
    session     = { type = "string",                      desc = "Named session ID for RPC targeting" },
    autoConnect = { type = "bool",    default = true,     desc = "Auto-spawn shell on mount" },
    rawMode     = { type = "bool",    default = false,    desc = "Raw PTY mode for TUI apps (claude, codex, vim). Normal shells leave false." },
    transport   = { type = "string",  default = "bridge", desc = "bridge | ws | http | tor" },
  },

  events = { "onData", "onDirtyRows", "onCursorMove", "onConnect", "onExit", "onError" },

  create = function(nodeId, props)
    local rows = props.rows or 24
    local cols = props.cols or 80

    local state = {
      pty           = nil,
      vterm         = nil,
      connected     = false,
      rows          = rows,
      cols          = cols,
      session       = props.session,
      ptyType       = props.type or "user",
      -- Damage tracking
      _pendingDirty = {},
      _lastDamageAt = nil,
      settleAt      = nil,
      -- Visual state
      scrollY       = 0,
      blinkTimer    = 0,
      blinkOn       = true,
    }

    _sessions[nodeId] = state
    if props.session then _sessionNames[props.session] = nodeId end
    if not _focusedId then _focusedId = nodeId end
    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Live resize: update both PTY and vterm together
    if props.rows ~= prev.rows or props.cols ~= prev.cols then
      local r = props.rows or 24
      local c = props.cols or 80
      if state.vterm then
        state.vterm:resize(r, c)
      end
      if state.pty then
        state.pty:resize(r, c)
      end
      state.rows = r
      state.cols = c
      -- Clear pending dirty — grid reflows after resize
      state._pendingDirty = {}
    end
    -- Update named session mapping if session prop changed
    if props.session ~= state.session then
      if state.session then _sessionNames[state.session] = nil end
      state.session = props.session
      if props.session then _sessionNames[props.session] = nodeId end
    end
    state.ptyType = props.type or "user"
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    -- Cursor blink
    state.blinkTimer = state.blinkTimer + dt
    if state.blinkTimer >= BLINK_RATE then
      state.blinkTimer = state.blinkTimer - BLINK_RATE
      state.blinkOn = not state.blinkOn
    end

    -- Auto-connect on first tick: spawn PTY + create vterm
    if not state.connected and props.autoConnect ~= false then
      local rows = props.rows or 24
      local cols = props.cols or 80

      -- Create vterm first
      state.vterm = VTerm.new(rows, cols)

      -- Spawn PTY
      local pty, err = spawnPTY(props)
      if pty then
        state.pty       = pty
        state.connected = true
        pushCap(pushEvent, nodeId, "onConnect", {
          shell   = props.shell or "bash",
          ptyType = props.type or "user",
          session = props.session,
        })
      else
        -- Clean up vterm on spawn failure
        if state.vterm then state.vterm:free(); state.vterm = nil end
        pushCap(pushEvent, nodeId, "onError", { error = tostring(err) })
      end
      return
    end

    if not state.pty or not state.connected then return end

    -- Read PTY output -> feed into vterm
    local data = state.pty:read()
    if data and #data > 0 then
      -- Push raw bytes for backward compat (onData still fires)
      pushCap(pushEvent, nodeId, "onData", { data = data })

      -- Feed into vterm for structured damage tracking
      if state.vterm then
        state.vterm:feed(data)
      end
    end

    -- Drain damage events from vterm
    if state.vterm then
      local events = state.vterm:drain()

      if events.damaged then
        -- Accumulate dirty rows
        for _, row in ipairs(events.dirtyRows) do
          state._pendingDirty[row] = true
        end
        state.settleAt = now_ms() + SETTLE_MS
        state._lastDamageAt = now_ms()
      end

      -- Cursor movement events (fire immediately, no settle needed)
      if events.cursorMoved then
        local cursor = state.vterm:getCursor()
        if cursor then
          pushCap(pushEvent, nodeId, "onCursorMove", {
            row     = cursor.row,
            col     = cursor.col,
            visible = cursor.visible,
          })
        end
      end
    end

    -- Settle: extract dirty rows once screen is calm
    if state.settleAt and now_ms() >= state.settleAt then
      state.settleAt = nil

      local dirtyList = {}
      for r in pairs(state._pendingDirty) do
        dirtyList[#dirtyList + 1] = r
      end
      table.sort(dirtyList)

      if #dirtyList > 0 and state.vterm then
        local rowData = {}
        for _, r in ipairs(dirtyList) do
          rowData[#rowData + 1] = {
            row  = r,
            text = state.vterm:getRowText(r),
          }
        end
        pushCap(pushEvent, nodeId, "onDirtyRows", { rows = rowData })
        state._pendingDirty = {}
      end
    end

    -- Check for process exit
    if not state.pty:alive() then
      local code = state.pty:exitCode()
      state.connected = false
      state.pty:close()
      state.pty = nil
      pushCap(pushEvent, nodeId, "onExit", { exitCode = code })
    end
  end,

  destroy = function(nodeId, state)
    if state.pty then
      state.pty:kill()
      state.pty:close()
      state.pty = nil
    end
    if state.vterm then
      state.vterm:free()
      state.vterm = nil
    end
    if state.session then _sessionNames[state.session] = nil end
    _sessions[nodeId] = nil
    if _focusedId == nodeId then
      _focusedId = next(_sessions)
    end
  end,

  -- ── Measure ──────────────────────────────────────────────────────────────
  -- Return nil to let the layout engine handle sizing (flexGrow, explicit dims).

  measure = function(node)
    return nil
  end,

  -- ── Render ───────────────────────────────────────────────────────────────
  -- Paints the vterm cell grid with proper ANSI colors.

  render = function(node, c, effectiveOpacity)
    if not c or c.w <= 0 or c.h <= 0 then return end
    ensureMeasure()

    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state
    local vterm = state.vterm
    local alpha = effectiveOpacity or 1

    -- Font setup
    local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
    local lineHeight = font and font:getHeight() or 16
    local charWidth  = font and font:getWidth("M") or 8

    -- Background fill
    love.graphics.setColor(BG_COLOR[1], BG_COLOR[2], BG_COLOR[3], BG_COLOR[4] * alpha)
    love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

    if not vterm then
      -- No vterm yet — show placeholder
      love.graphics.setColor(FG_DEFAULT[1], FG_DEFAULT[2], FG_DEFAULT[3], 0.4 * alpha)
      if font then
        love.graphics.setFont(font)
        love.graphics.print("Connecting...", c.x + PADDING, c.y + PADDING)
      end
      return
    end

    -- Scissor to our bounds
    local prevScissor = Scissor.saveIntersected(c.x, c.y, c.w, c.h)

    local vtRows, vtCols = vterm:size()

    -- Compute scroll bounds
    local contentHeight = vtRows * lineHeight
    local maxScroll = math.max(0, contentHeight - c.h)
    state.scrollY = math.max(0, math.min(state.scrollY, maxScroll))

    -- Determine visible row range
    local firstRow = math.floor(state.scrollY / lineHeight)
    local lastRow  = math.min(vtRows - 1, firstRow + math.ceil(c.h / lineHeight))

    if font then love.graphics.setFont(font) end

    -- Render visible rows cell-by-cell with colors
    for row = firstRow, lastRow do
      local yPos = c.y + PADDING + (row * lineHeight) - state.scrollY

      -- Skip rows fully outside visible area
      if yPos + lineHeight < c.y or yPos > c.y + c.h then
        goto nextRow
      end

      -- Render cells in spans of same fg color for performance
      local col = 0
      while col < vtCols do
        local cell = vterm:getCell(row, col)
        if cell.char == "" or cell.char == " " then
          -- Check for bg color on space/empty cells
          if cell.bg then
            local bg = cell.bg
            love.graphics.setColor(bg[1] / 255, bg[2] / 255, bg[3] / 255, alpha)
            love.graphics.rectangle("fill", c.x + PADDING + col * charWidth, yPos, charWidth, lineHeight)
          end
          col = col + 1
          goto nextCell
        end

        -- Start a span: collect consecutive chars with same fg
        local spanStart = col
        local spanFg = cell.fg
        local spanBg = cell.bg
        local spanBold = cell.bold
        local spanChars = { cell.char }

        col = col + (cell.width > 0 and cell.width or 1)

        -- Extend span while fg matches
        while col < vtCols do
          local next = vterm:getCell(row, col)
          if next.char == "" or next.char == " " then break end
          local sameFg = (spanFg == nil and next.fg == nil) or
            (spanFg and next.fg and spanFg[1] == next.fg[1] and spanFg[2] == next.fg[2] and spanFg[3] == next.fg[3])
          local sameBold = (spanBold == next.bold)
          if not sameFg or not sameBold then break end
          spanChars[#spanChars + 1] = next.char
          col = col + (next.width > 0 and next.width or 1)
        end

        -- Draw bg for span if present
        if spanBg then
          love.graphics.setColor(spanBg[1] / 255, spanBg[2] / 255, spanBg[3] / 255, alpha)
          local spanWidth = #spanChars * charWidth
          love.graphics.rectangle("fill", c.x + PADDING + spanStart * charWidth, yPos, spanWidth, lineHeight)
        end

        -- Draw fg text
        if spanFg then
          love.graphics.setColor(spanFg[1] / 255, spanFg[2] / 255, spanFg[3] / 255, alpha)
        else
          love.graphics.setColor(FG_DEFAULT[1], FG_DEFAULT[2], FG_DEFAULT[3], alpha)
        end

        -- Use bold font if available
        if spanBold and Measure then
          local boldFont = Measure.getFont(FONT_SIZE, "monospace", "bold")
          if boldFont then love.graphics.setFont(boldFont) end
        end

        local spanText = table.concat(spanChars)
        love.graphics.print(spanText, c.x + PADDING + spanStart * charWidth, yPos)

        -- Restore normal font after bold
        if spanBold and font then
          love.graphics.setFont(font)
        end

        ::nextCell::
      end

      ::nextRow::
    end

    -- Draw cursor
    if state.connected and vterm:isCursorVisible() and state.blinkOn then
      local cursor = vterm:getCursor()
      local cursorX = c.x + PADDING + cursor.col * charWidth
      local cursorY = c.y + PADDING + (cursor.row * lineHeight) - state.scrollY

      -- Only draw if cursor is in visible area
      if cursorY >= c.y and cursorY + lineHeight <= c.y + c.h then
        love.graphics.setColor(CURSOR_COLOR[1], CURSOR_COLOR[2], CURSOR_COLOR[3], CURSOR_COLOR[4] * alpha)
        love.graphics.rectangle("fill", cursorX, cursorY, charWidth, lineHeight)

        -- Draw the character under the cursor in dark color (inverted)
        local cursorCell = vterm:getCell(cursor.row, cursor.col)
        if cursorCell.char ~= "" and cursorCell.char ~= " " then
          love.graphics.setColor(BG_COLOR[1], BG_COLOR[2], BG_COLOR[3], alpha)
          if font then love.graphics.setFont(font) end
          love.graphics.print(cursorCell.char, cursorX, cursorY)
        end
      end
    end

    -- Disconnected overlay
    if not state.connected and state.vterm then
      love.graphics.setColor(1, 1, 1, 0.5 * alpha)
      if font then
        love.graphics.setFont(font)
        love.graphics.print("[exited]", c.x + PADDING, c.y + c.h - lineHeight - PADDING)
      end
    end

    Scissor.restore(prevScissor)
  end,

  -- ── Keyboard handling ────────────────────────────────────────────────────
  -- Converts Love2D key names to ANSI escape sequences and writes to PTY.

  handleKeyPressed = function(node, key, scancode, isrepeat)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return false end
    local state = capInst.state

    -- Reset cursor blink on keypress
    state.blinkOn = true
    state.blinkTimer = 0

    if not state.pty or not state.connected then return false end

    -- ── Scroll (UI-only, don't pass to PTY) ──────────────────────────────

    if key == "pageup" then
      ensureMeasure()
      local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
      local lineHeight = font and font:getHeight() or 16
      state.scrollY = math.max(0, state.scrollY - lineHeight * 20)
      return true
    elseif key == "pagedown" then
      ensureMeasure()
      local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
      local lineHeight = font and font:getHeight() or 16
      state.scrollY = state.scrollY + lineHeight * 20
      return true
    end

    -- Shift+Up/Down: scroll by line
    if love.keyboard.isDown("lshift", "rshift") then
      if key == "up" then
        ensureMeasure()
        local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
        local lineHeight = font and font:getHeight() or 16
        state.scrollY = math.max(0, state.scrollY - lineHeight)
        return true
      elseif key == "down" then
        ensureMeasure()
        local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
        local lineHeight = font and font:getHeight() or 16
        state.scrollY = state.scrollY + lineHeight
        return true
      end
    end

    -- ── Ctrl+key combos → control characters ─────────────────────────────

    if love.keyboard.isDown("lctrl", "rctrl") then
      -- Ctrl+V: paste clipboard text into PTY
      if key == "v" then
        local clipboard = love.system.getClipboardText()
        if clipboard then state.pty:write(clipboard) end
        return true
      end
      -- Ctrl+C: interrupt
      if key == "c" then state.pty:write("\x03"); return true end
      -- Ctrl+D: EOF
      if key == "d" then state.pty:write("\x04"); return true end
      -- Ctrl+Z: suspend
      if key == "z" then state.pty:write("\x1a"); return true end
      -- Ctrl+A: beginning of line
      if key == "a" then state.pty:write("\x01"); return true end
      -- Ctrl+E: end of line
      if key == "e" then state.pty:write("\x05"); return true end
      -- Ctrl+U: clear line
      if key == "u" then state.pty:write("\x15"); return true end
      -- Ctrl+W: delete word backward
      if key == "w" then state.pty:write("\x17"); return true end
      -- Ctrl+K: kill to end of line
      if key == "k" then state.pty:write("\x0b"); return true end
      -- Ctrl+L: clear screen
      if key == "l" then state.pty:write("\x0c"); return true end
      -- Ctrl+R: reverse search
      if key == "r" then state.pty:write("\x12"); return true end
      -- Consume other Ctrl combos
      return true
    end

    -- ── Special keys with ANSI escape sequences ──────────────────────────

    local ANSI = {
      ["return"]    = "\r",
      kpenter       = "\r",
      backspace     = "\x7f",
      tab           = "\t",
      escape        = "\x1b",
      up            = "\x1b[A",
      down          = "\x1b[B",
      right         = "\x1b[C",
      left          = "\x1b[D",
      home          = "\x1b[H",
      ["end"]       = "\x1b[F",
      delete        = "\x1b[3~",
      insert        = "\x1b[2~",
      f1            = "\x1bOP",
      f2            = "\x1bOQ",
      f3            = "\x1bOR",
      f4            = "\x1bOS",
      f5            = "\x1b[15~",
      f6            = "\x1b[17~",
      f7            = "\x1b[18~",
      f8            = "\x1b[19~",
      f9            = "\x1b[20~",
      f10           = "\x1b[21~",
      f11           = "\x1b[23~",
      f12           = "\x1b[24~",
    }

    local seq = ANSI[key]
    if seq then
      -- Auto-scroll to bottom on input
      if key == "return" or key == "kpenter" then
        local vterm = state.vterm
        if vterm then
          ensureMeasure()
          local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
          local lineHeight = font and font:getHeight() or 16
          local vtRows = vterm:size()
          local contentHeight = vtRows * lineHeight
          state.scrollY = math.max(0, contentHeight)
        end
      end
      state.pty:write(seq)
      return true
    end

    -- Regular keys are handled by handleTextInput
    return false
  end,

  -- ── Text input ─────────────────────────────────────────────────────────
  -- Forward typed characters directly to PTY.

  handleTextInput = function(node, text)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state

    if state.pty and state.connected then
      state.pty:write(text)
      -- Reset cursor blink
      state.blinkOn = true
      state.blinkTimer = 0
    end
  end,

  -- ── Mouse scroll ──────────────────────────────────────────────────────
  -- Scroll through terminal output.

  handleWheelMoved = function(node, dx, dy)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state

    ensureMeasure()
    local font = Measure and Measure.getFont(FONT_SIZE, "monospace", nil)
    local lineHeight = font and font:getHeight() or 16
    local scrollAmount = SCROLL_LINES * lineHeight

    -- dy positive = scroll up, negative = scroll down (love2d convention)
    state.scrollY = state.scrollY - dy * scrollAmount
    if state.scrollY < 0 then state.scrollY = 0 end
    -- Upper bound clamped in render
  end,
})

-- ── RPC handlers ─────────────────────────────────────────────────────────────

local rpc = {}

-- Write raw bytes to a PTY session (keystrokes, commands, control sequences)
rpc["pty:write"] = function(args)
  local state = resolveSession(args.session or args.id)
  if not state then
    return { error = "No PTY session: " .. tostring(args.session or args.id or "focused") }
  end

  -- Template mode: "command" spawns a fresh ephemeral PTY
  if state.ptyType == "template" and not state.pty and args.command then
    -- Create vterm for the ephemeral session if needed
    if not state.vterm then
      state.vterm = VTerm.new(state.rows, state.cols)
    end
    local pty, err = spawnPTY({ type = "template", shell = "bash", env = args.env }, args.command)
    if pty then
      state.pty       = pty
      state.connected = true
    else
      return { error = "Failed to spawn template PTY: " .. tostring(err) }
    end
  end

  if not state.pty then
    return { error = "PTY not connected" }
  end

  local ok = state.pty:write(args.data or "")
  return { ok = ok }
end

-- Resize the terminal window (sends SIGWINCH to the shell + resizes vterm)
rpc["pty:resize"] = function(args)
  local state = resolveSession(args.session or args.id)
  if not state then return { error = "No PTY session" } end
  local r = args.rows or 24
  local c = args.cols or 80
  if state.vterm then state.vterm:resize(r, c) end
  if state.pty then state.pty:resize(r, c) end
  state.rows = r
  state.cols = c
  state._pendingDirty = {}  -- clear — grid reflows
  return { ok = true }
end

-- Send a signal to the child process
rpc["pty:kill"] = function(args)
  local state = resolveSession(args.session or args.id)
  if not state then return { error = "No PTY session" } end
  if state.pty then state.pty:kill(args.signal) end
  return { ok = true }
end

-- Set the focused session (used when session is omitted in other RPC calls)
rpc["pty:focus"] = function(args)
  if args.session then
    local nid = _sessionNames[args.session]
    if nid and _sessions[nid] then
      _focusedId = nid
      return { ok = true }
    end
    return { error = "Unknown session: " .. args.session }
  end
  if args.id and _sessions[args.id] then
    _focusedId = args.id
    return { ok = true }
  end
  return { error = "Session not found" }
end

-- List all active terminal sessions
rpc["pty:list"] = function()
  local list = {}
  for id, s in pairs(_sessions) do
    list[#list + 1] = {
      id        = id,
      session   = s.session,
      connected = s.connected,
      ptyType   = s.ptyType,
      rows      = s.rows,
      cols      = s.cols,
    }
  end
  return list
end

-- Read the full vterm screen state (for debugging or screen dump)
rpc["pty:screen"] = function(args)
  local state = resolveSession(args and (args.session or args.id))
  if not state or not state.vterm then return { error = "No vterm" } end
  return {
    rows   = state.vterm:getRows(),
    cursor = state.vterm:getCursor(),
  }
end

-- ── Register RPC handlers ────────────────────────────────────────────────────

local Caps     = require("lua.capabilities")
local _origGet = Caps.getHandlers
Caps.getHandlers = function()
  local h = _origGet()
  for method, fn in pairs(rpc) do h[method] = fn end
  return h
end
