--[[
  claude_canvas.lua — Visual capability for the Claude Code terminal canvas

  Registers "ClaudeCanvas" as a visual, hittable capability that:
    - Delegates rendering to claude_renderer.lua
    - Handles keyboard input for the inline "> " prompt
    - Communicates with claude_session.lua to send messages / interrupt

  React usage:
    <Native type="ClaudeCanvas" sessionId="main" />

  All interactivity lives here in Lua — React only declares the layout box.
  The canvas receives focus via click (like TextInput) and then captures
  all keyboard/textinput events through the framework's generic capability
  keyboard routing.
]]

local Capabilities = require("lua.capabilities")
local Renderer     = require("lua.claude_renderer")
local Session      = require("lua.claude_session")
local Color        = require("lua.color")
local Focus        = require("lua.focus")
local Tree         = require("lua.tree")

local Measure = nil

-- Per-instance input state (keyed by nodeId)
local _inputStates = {}
local function getInputState(nodeId)
  if not _inputStates[nodeId] then
    _inputStates[nodeId] = {
      text = "",
      cursorPos = 0,
      blinkTimer = 0,
      blinkOn = true,
      history = {},
      historyIdx = 0,
      viewportH = 600,  -- updated each render frame
    }
  end
  return _inputStates[nodeId]
end

-- Scroll step sizes
local SCROLL_LINE = 40   -- pixels per mouse wheel notch
local SCROLL_PAGE = 400  -- pixels per PgUp/PgDn (updated to viewport height at render)

-- ── Input editing helpers ──────────────────────────────────────────

local function insertText(inputState, text)
  local before = inputState.text:sub(1, inputState.cursorPos)
  local after = inputState.text:sub(inputState.cursorPos + 1)
  inputState.text = before .. text .. after
  inputState.cursorPos = inputState.cursorPos + #text
  inputState.blinkOn = true
  inputState.blinkTimer = 0
end

-- ── Colors ─────────────────────────────────────────────────────────

local COLORS = {
  inputBg     = Color.toTable("#1e293b"),
  inputText   = Color.toTable("#e2e8f0"),
  inputCaret  = Color.toTable("#94a3b8"),
  inputPrompt = Color.toTable("#64748b"),
}

-- ── Capability Registration ────────────────────────────────────────

Capabilities.register("ClaudeCanvas", {
  visual   = true,
  hittable = true,  -- can receive focus and keyboard events

  schema = {
    sessionId = { type = "string", desc = "Session ID linking to a ClaudeCode instance" },
  },

  events = {},

  create = function(nodeId, props)
    -- Initialize renderer with the Measure module (once)
    if not Measure then
      local ok, m = pcall(require, "lua.measure")
      if ok then
        Measure = m
        Renderer.init({ measure = m })
      end
    end

    local sessionId = props.sessionId or "default"
    Renderer.getSession(sessionId)

    return {
      sessionId = sessionId,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.sessionId and props.sessionId ~= state.sessionId then
      state.sessionId = props.sessionId
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Auto-focus on first tick so keyboard events route here immediately
    if not state._focusGrabbed then
      local nodes = Tree.getNodes()
      local node = nodes[nodeId]
      if node then
        io.write(string.format("[FOCUS] Setting focus: nodeId=%s type='%s' hittable=%s\n",
          tostring(nodeId), tostring(node.type), tostring(node._capHittable)))
        io.flush()
        Focus.set(node)
        state._focusGrabbed = true
      else
        io.write("[FOCUS] No node found for " .. tostring(nodeId) .. "\n"); io.flush()
      end
    end

    local inputState = getInputState(nodeId)
    inputState.blinkTimer = inputState.blinkTimer + dt
    if inputState.blinkTimer >= 0.53 then
      inputState.blinkTimer = 0
      inputState.blinkOn = not inputState.blinkOn
    end
  end,

  destroy = function(nodeId, state)
    _inputStates[nodeId] = nil
  end,

  -- ── Visual capability methods (painter.lua / layout.lua) ──────

  measure = function(node)
    return Renderer.measure(node)
  end,

  render = function(node, c, effectiveOpacity)
    local nodeId = node.id
    local props = node.props or {}
    local sessionId = props.sessionId or "default"

    -- Save viewport height for scroll calculations in key handler
    local inputState = getInputState(nodeId)
    inputState.viewportH = c.h

    -- Compute desired column count — applied next tick (row resize segfaults libvterm)
    if Measure then
      local sizeFont = Measure.getFont(13, nil, nil)
      local charW = sizeFont:getWidth("M")
      local fitCols = math.max(20, math.floor((c.w - 16) / charW))
      Session.setDesiredSize(fitCols, nil)
    end

    -- ── Compute bottom reserved area (input + debug) FIRST ────────
    local inputState = getInputState(nodeId)
    if not Measure then return end

    local fontSize = 13
    local font = Measure.getFont(fontSize, nil, nil)
    local lineHeight = font:getHeight()
    local promptX = c.x + 16
    local prefixW = font:getWidth("> ")
    local textAreaW = c.w - 32 - prefixW
    if textAreaW < 20 then textAreaW = 20 end

    -- Word-wrap helper
    local function wrapText(text, maxW)
      if #text == 0 then return { "" }, { 0 } end
      local lines = {}
      local lineStarts = { 1 }
      local lineStart = 1
      local lastSpace = nil
      local x = 0
      local i = 1
      while i <= #text do
        local ch = text:sub(i, i)
        local chW = font:getWidth(ch)
        if ch == " " then lastSpace = i end
        if x + chW > maxW and i > lineStart then
          local breakAt
          if lastSpace and lastSpace > lineStart then
            breakAt = lastSpace
            lines[#lines + 1] = text:sub(lineStart, breakAt - 1)
            lineStart = breakAt + 1
          else
            breakAt = i
            lines[#lines + 1] = text:sub(lineStart, breakAt - 1)
            lineStart = breakAt
          end
          lineStarts[#lineStarts + 1] = lineStart
          lastSpace = nil
          x = 0
        else
          x = x + chW
          i = i + 1
        end
      end
      lines[#lines + 1] = text:sub(lineStart)
      return lines, lineStarts
    end

    -- Read vterm prompt state FIRST so we compute input height from reality
    local prompt = Session.getPromptState()
    local promptText = prompt and prompt.text or ""
    -- Strip leading whitespace (NBSP and regular)
    promptText = promptText:gsub("^\194\160", ""):gsub("^%s+", "")
    local promptCursorCol = prompt and prompt.cursorCol or 0


    -- Compute wrapped lines from vterm prompt (not local inputState.text)
    local displayLines, displayStarts
    if #promptText > 0 then
      displayLines, displayStarts = wrapText(promptText, textAreaW)
    else
      displayLines = { "" }
      displayStarts = { 1 }
    end
    local displayNumLines = #displayLines

    local inputH = displayNumLines * lineHeight + 8
    local bottomMargin = 20
    local inputTop = c.y + c.h - inputH - bottomMargin

    -- Debug overlay height (3 lines of debug text + 5px gap above input)
    local df = Measure.getFont(10, nil, nil)
    local dfH = df:getHeight()
    local debugH = dfH * 3 + 5  -- 3 lines + gap
    local debugTop = inputTop - 5 - debugH

    -- The content area stops at the debug overlay top
    local contentBottom = debugTop
    local contentRect = { x = c.x, y = c.y, w = c.w, h = contentBottom - c.y }

    -- ── Render ALL vterm rows with semantic tags ─────────────────
    -- No boundary cutoff. Every row gets classified. React layer decides display.
    local vterm = Session.getVTerm()
    local boundary = Session.getInputBoundary()

    if vterm and Measure then
      local vtFont = Measure.getFont(13, nil, nil)
      local tagFont = Measure.getFont(9, nil, nil)
      local charW = vtFont:getWidth("M")
      local lineH = vtFont:getHeight()
      local rows, cols = vterm:size()

      -- Measure tag prefix width for offsetting cell content
      local tagW = tagFont:getWidth("[confirmation] ")  -- widest tag as reference
      local cellOffsetX = tagW + 4
      -- Row numbers reserve space on the right
      local rowNumW = 34  -- "999" + padding
      -- Available width for vterm cells between tag and row numbers
      local cellAreaW = c.w - cellOffsetX - rowNumW
      local maxCellCols = math.max(1, math.floor(cellAreaW / charW))

      love.graphics.setColor(Color.toTable("#0f172a")[1], Color.toTable("#0f172a")[2],
                             Color.toTable("#0f172a")[3], effectiveOpacity)
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

      love.graphics.setScissor(contentRect.x, contentRect.y, contentRect.w, contentRect.h)

      -- Find last non-empty row to avoid rendering 200 blank lines
      local lastNonEmpty = 0
      for row = rows - 1, 0, -1 do
        if #(vterm:getRowText(row)) > 0 then
          lastNonEmpty = row
          break
        end
      end

      for row = 0, lastNonEmpty do
        local py = c.y + 8 + row * lineH
        if py + lineH > contentBottom then break end

        local rowText = vterm:getRowText(row)
        if #rowText > 0 then
          -- Classify with zone awareness
          local kind = Session.classifyRow(rowText, row, rows)
          -- Override: rows in the input zone get zone-specific tags
          if row >= boundary then
            if Session.isSeparatorRow(vterm, row) then
              kind = "input_border"
            elseif kind == "user_prompt" or kind == "idle_prompt" then
              kind = "user_input"
            elseif kind == "status_bar" then
              kind = "status_bar"
            elseif kind == "confirmation" or kind == "menu_option" or kind == "selector" or kind == "menu_title" then
              -- keep these as-is
            else
              kind = "input_zone"
            end
          end

          -- Draw tag prefix
          love.graphics.setFont(tagFont)
          -- Color-code by zone: blue=content, orange=input zone
          if row >= boundary then
            love.graphics.setColor(1.0, 0.6, 0.2, 0.7 * effectiveOpacity)
          else
            love.graphics.setColor(0.4, 0.7, 1.0, 0.6 * effectiveOpacity)
          end
          love.graphics.print("[" .. kind .. "]", c.x + 4, py + 2)

          -- Draw cells between tag prefix and row numbers
          love.graphics.setFont(vtFont)
          for col = 0, math.min(cols - 1, maxCellCols - 1) do
            local cell = vterm:getCell(row, col)
            if cell.char and #cell.char > 0 and cell.char ~= " " then
              local px = c.x + cellOffsetX + col * charW
              if cell.fg then
                love.graphics.setColor(cell.fg[1]/255, cell.fg[2]/255, cell.fg[3]/255, effectiveOpacity)
              else
                love.graphics.setColor(COLORS.inputText[1], COLORS.inputText[2],
                                       COLORS.inputText[3], effectiveOpacity)
              end
              love.graphics.print(cell.char, px, py)
            end
          end
        end
      end
      love.graphics.setScissor()

      -- Row numbers
      local numFont = Measure.getFont(9, nil, nil)
      love.graphics.setFont(numFont)
      for row = 0, lastNonEmpty do
        local py = c.y + 8 + row * lineH
        if py + lineH > contentBottom then break end
        local rowText = vterm:getRowText(row)
        if row >= boundary then
          love.graphics.setColor(1, 0.6, 0.2, 0.5)  -- orange for input zone
        elseif #rowText > 0 then
          love.graphics.setColor(0.3, 1, 0.3, 0.5)
        else
          love.graphics.setColor(1, 1, 1, 0.15)
        end
        love.graphics.print(string.format("%3d", row), c.x + c.w - 30, py)
      end
    end

    -- ── Debug overlay (above input bar) ─────────────────────────
    local dbg = Session.getDebugInfo()
    local dvt = Session.getVTerm()
    local dRows, dCols = 0, 0
    if dvt then dRows, dCols = dvt:size() end
    love.graphics.setFont(df)
    love.graphics.setColor(1, 1, 0, 0.8)
    love.graphics.print(
      string.format("cols=%d rows=%d w=%.0f h=%.0f", dCols, dRows, c.w, c.h),
      c.x + 8, debugTop)
    love.graphics.print(
      string.format("mode=%s alive=%s boundary=%d dirty=%d",
        dbg.mode, tostring(dbg.alive), dbg.boundary, dbg.dirty),
      c.x + 8, debugTop + dfH)
    love.graphics.print(
      string.format("lastDmg=%dms settle=%dms streamLen=%d vtContent=%d",
        dbg.lastDmg, dbg.settle, dbg.streaming, dbg.vtContent or 0),
      c.x + 8, debugTop + dfH * 2)

    -- ── Input bar (reads from vterm prompt, computed above) ────
    -- Input background
    love.graphics.setColor(COLORS.inputBg[1], COLORS.inputBg[2], COLORS.inputBg[3],
                           (COLORS.inputBg[4] or 1) * effectiveOpacity)
    love.graphics.rectangle("fill", c.x + 8, inputTop, c.w - 16, inputH, 4, 4)

    -- "> " prefix on first line
    love.graphics.setFont(font)
    love.graphics.setColor(COLORS.inputPrompt[1], COLORS.inputPrompt[2], COLORS.inputPrompt[3],
                           (COLORS.inputPrompt[4] or 1) * effectiveOpacity)
    love.graphics.print("> ", promptX, inputTop + 4)

    if #promptText == 0 then
      -- Show placeholder from CLI (tab to accept)
      local ph = Session.getPlaceholder()
      if ph and #ph > 0 then
        love.graphics.setScissor(promptX + prefixW, inputTop, textAreaW, inputH)
        love.graphics.setColor(COLORS.inputPrompt[1], COLORS.inputPrompt[2], COLORS.inputPrompt[3],
                               0.4 * effectiveOpacity)
        love.graphics.print(ph, promptX + prefixW, inputTop + 4)
        local phW = font:getWidth(ph)
        love.graphics.setColor(COLORS.inputPrompt[1], COLORS.inputPrompt[2], COLORS.inputPrompt[3],
                               0.25 * effectiveOpacity)
        love.graphics.print("  tab", promptX + prefixW + phW, inputTop + 4)
        love.graphics.setScissor()
      end
    else
      -- Draw wrapped prompt text
      love.graphics.setScissor(c.x + 8, inputTop, c.w - 16, inputH)
      love.graphics.setColor(COLORS.inputText[1], COLORS.inputText[2], COLORS.inputText[3],
                             (COLORS.inputText[4] or 1) * effectiveOpacity)
      for i, line in ipairs(displayLines) do
        local lx = promptX + (i == 1 and prefixW or 0)
        local ly = inputTop + 4 + (i - 1) * lineHeight
        love.graphics.print(line, lx, ly)
      end
      love.graphics.setScissor()
    end

    -- Cursor: position from vterm cursor column
    if inputState.blinkOn and #promptText > 0 then
      local cursorByte = math.min(promptCursorCol, #promptText)
      local cursorLine = 1
      for i = 2, #displayStarts do
        if cursorByte >= displayStarts[i] then
          cursorLine = i
        else
          break
        end
      end
      local lineOffset = cursorByte - displayStarts[cursorLine] + 1
      local textBefore = displayLines[cursorLine]:sub(1, math.max(0, lineOffset))
      local cursorPx = font:getWidth(textBefore)
      local cursorX = promptX + (cursorLine == 1 and prefixW or 0) + cursorPx
      local cursorY = inputTop + 4 + (cursorLine - 1) * lineHeight
      love.graphics.setColor(COLORS.inputCaret[1], COLORS.inputCaret[2], COLORS.inputCaret[3],
                             (COLORS.inputCaret[4] or 1) * effectiveOpacity)
      love.graphics.rectangle("fill", cursorX, cursorY, 2, lineHeight)
    elseif inputState.blinkOn then
      -- Empty prompt: cursor at the start
      love.graphics.setColor(COLORS.inputCaret[1], COLORS.inputCaret[2], COLORS.inputCaret[3],
                             (COLORS.inputCaret[4] or 1) * effectiveOpacity)
      love.graphics.rectangle("fill", promptX + prefixW, inputTop + 4, 2, lineHeight)
    end

    -- ── Dropdown rows below input (for @ picker, slash menus, etc.) ──
    local dropdownRows = Session.getDropdownRows()
    if #dropdownRows > 0 then
      local dropdownTop = inputTop + inputH + 4
      local dropFont = Measure.getFont(11, nil, nil)
      local dropLineH = dropFont:getHeight()
      love.graphics.setFont(dropFont)

      -- Background for dropdown area
      local dropH = #dropdownRows * dropLineH + 8
      love.graphics.setColor(0.08, 0.12, 0.2, 0.95 * effectiveOpacity)
      love.graphics.rectangle("fill", c.x + 8, dropdownTop, c.w - 16, dropH, 4, 4)

      for i, dr in ipairs(dropdownRows) do
        local dy = dropdownTop + 4 + (i - 1) * dropLineH
        if dy + dropLineH > c.y + c.h then break end
        -- Prefix with kind tag
        love.graphics.setColor(0.4, 0.7, 1.0, 0.6 * effectiveOpacity)
        love.graphics.print("[" .. dr.kind .. "]", c.x + 12, dy)
        -- Row text
        love.graphics.setColor(0.9, 0.9, 0.9, 0.9 * effectiveOpacity)
        local tagW = dropFont:getWidth("[" .. dr.kind .. "] ")
        love.graphics.print(dr.text, c.x + 12 + tagW, dy)
      end
    end
  end,

  -- ── Keyboard event routing (called by init.lua) ───────────────
  -- All keystrokes pass through to the PTY in real-time.
  -- Our input bar is a visual mirror of the vterm prompt line.

  handleKeyPressed = function(node, key, scancode, isrepeat)
    local nodeId = node.id
    local props = node.props or {}
    local sessionId = props.sessionId or "default"
    local inputState = getInputState(nodeId)

    -- Reset cursor blink on every key press
    inputState.blinkOn = true
    inputState.blinkTimer = 0

    -- Check for permission prompt — intercept y/a/n/Esc
    local permPrompt = Renderer.getPermissionPrompt(sessionId)
    if permPrompt then
      if key == "y" or key == "return" or key == "kpenter" then
        Session.respond(1)
        return true
      elseif key == "a" then
        Session.respond(2)
        return true
      elseif key == "n" or key == "escape" then
        Session.respond(3)
        return true
      end
      return true
    end

    -- ── UI-only controls (don't pass to PTY) ────────────────────

    -- Scroll: PgUp / PgDn / Shift+Up / Shift+Down
    if key == "pageup" then
      Renderer.adjustScroll(sessionId, -(inputState.viewportH - 60), inputState.viewportH)
      return true
    elseif key == "pagedown" then
      Renderer.adjustScroll(sessionId, (inputState.viewportH - 60), inputState.viewportH)
      return true
    end
    if love.keyboard.isDown("lshift", "rshift") then
      if key == "up" then
        Renderer.adjustScroll(sessionId, -SCROLL_LINE, inputState.viewportH)
        return true
      elseif key == "down" then
        Renderer.adjustScroll(sessionId, SCROLL_LINE, inputState.viewportH)
        return true
      end
    end

    -- Ctrl+L: clear our renderer display (UI-only, doesn't affect CLI)
    if key == "l" and love.keyboard.isDown("lctrl", "rctrl") then
      Renderer.clearSession(sessionId)
      Renderer.getSession(sessionId)
      return true
    end

    -- Ctrl+R: expand/collapse the last tool block (UI-only)
    if key == "r" and love.keyboard.isDown("lctrl", "rctrl") then
      local session = Renderer.getSession(sessionId)
      for i = #session.blocks, 1, -1 do
        local block = session.blocks[i]
        if block.type == "tool_start" or block.type == "diff" then
          Renderer.toggleCollapse(sessionId, i)
          break
        end
      end
      return true
    end

    -- ── PTY passthrough ─────────────────────────────────────────
    -- Don't send keystrokes until CLI prompt is ready
    if not Session.isReady() then return false end

    -- ANSI escape sequences for special keys
    local ANSI = {
      up        = "\27[A",
      down      = "\27[B",
      right     = "\27[C",
      left      = "\27[D",
      home      = "\27[H",
      ["end"]   = "\27[F",
      delete    = "\27[3~",
      backspace = "\127",
      tab       = "\t",
      escape    = "\27",
    }

    io.write("[KEY] keyPressed → PTY: '" .. key .. "'\n"); io.flush()

    -- Enter: capture prompt text for renderer, then send \r to PTY
    if key == "return" or key == "kpenter" then
      local prompt = Session.getPromptState()
      if prompt and prompt.text and #prompt.text > 0 then
        -- Strip leading whitespace from prompt text
        local text = prompt.text:match("^%s*(.-)%s*$") or prompt.text
        if #text > 0 then
          Renderer.addUserInput(sessionId, text)
        end
      end
      Renderer.scrollToBottom(sessionId, inputState.viewportH)
      Session.writeRaw("\r")
      return true
    end

    -- Ctrl+key combos → send as control characters
    if love.keyboard.isDown("lctrl", "rctrl") then
      -- Ctrl+V: paste clipboard text into PTY
      if key == "v" then
        local clipboard = love.system.getClipboardText()
        if clipboard then
          -- Send clipboard text directly to PTY
          Session.writeRaw(clipboard)
        end
        return true
      end
      -- Ctrl+C: send interrupt
      if key == "c" then
        Session.writeRaw("\x03")
        return true
      end
      -- Ctrl+A: beginning of line
      if key == "a" then
        Session.writeRaw("\x01")
        return true
      end
      -- Ctrl+E: end of line
      if key == "e" then
        Session.writeRaw("\x05")
        return true
      end
      -- Ctrl+U: clear line
      if key == "u" then
        Session.writeRaw("\x15")
        return true
      end
      -- Ctrl+W: delete word backward
      if key == "w" then
        Session.writeRaw("\x17")
        return true
      end
      -- Ctrl+K: kill to end of line
      if key == "k" then
        Session.writeRaw("\x0b")
        return true
      end
      return true  -- consume other Ctrl combos
    end

    -- Special keys with ANSI sequences
    if ANSI[key] then
      Session.writeRaw(ANSI[key])
      return true
    end

    -- Regular keys are handled by handleTextInput below
    return false
  end,

  handleTextInput = function(node, text)
    -- Don't send keystrokes until CLI prompt is ready
    if not Session.isReady() then return end
    io.write("[KEY] textInput → PTY: '" .. text .. "'\n"); io.flush()
    -- Send typed characters directly to PTY
    Session.writeRaw(text)
  end,

  handleWheelMoved = function(node, dx, dy)
    local props = node.props or {}
    local sessionId = props.sessionId or "default"
    local inputState = getInputState(node.id)
    -- dy is positive when scrolling up, negative when scrolling down (love2d convention)
    -- We want scroll up = content moves down = scrollY decreases
    Renderer.adjustScroll(sessionId, -dy * SCROLL_LINE, inputState.viewportH)
  end,
})

-- ── Module exports ─────────────────────────────────────────────────

local Canvas = {}

--- Get the current input text for a canvas node (for testing)
function Canvas.getInputText(nodeId)
  return getInputState(nodeId).text
end

return Canvas
