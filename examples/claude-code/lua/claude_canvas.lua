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
    }
  end
  return _inputStates[nodeId]
end

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
        Focus.set(node)
        state._focusGrabbed = true
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

    -- If Claude hasn't initialized yet, render raw vterm grid (splash screen)
    local vterm = Session.getVTerm()
    local isInit = Session.isInitialized()
    local mode = Session.getMode()

    if vterm and not isInit and Measure then
      -- Raw vterm grid rendering (splash, boot, etc.)
      local font = Measure.getFont(13, nil, nil)
      local boldFont = Measure.getFont(13, "bold", nil)
      local charW = font:getWidth("M")
      local lineH = font:getHeight()

      -- Dynamic resize: compute how many cols fit at font size 13
      local availW = c.w - 16  -- 8px padding each side
      local fitCols = math.max(20, math.floor(availW / charW))
      Session.resize(fitCols, nil)  -- resize vterm+pty if changed

      local rows, cols = vterm:size()

      -- Don't render past the input zone
      local maxRow = math.min(rows, Session.getInputBoundary()) - 1

      -- Background
      love.graphics.setColor(Color.toTable("#0f172a")[1], Color.toTable("#0f172a")[2],
                             Color.toTable("#0f172a")[3], effectiveOpacity)
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

      -- Scissor clip to the layout box
      love.graphics.setScissor(c.x, c.y, c.w, c.h)
      love.graphics.setFont(font)
      for row = 0, maxRow do
        local py = c.y + 8 + row * lineH
        if py + lineH > c.y + c.h then break end
        for col = 0, cols - 1 do
          local cell = vterm:getCell(row, col)
          if cell.char and #cell.char > 0 and cell.char ~= " " then
            local px = c.x + 8 + col * charW
            if px > c.x + c.w then break end
            -- Background
            if cell.bg then
              love.graphics.setColor(cell.bg[1]/255, cell.bg[2]/255, cell.bg[3]/255, effectiveOpacity)
              love.graphics.rectangle("fill", px, py, charW, lineH)
            end
            -- Foreground
            if cell.fg then
              love.graphics.setColor(cell.fg[1]/255, cell.fg[2]/255, cell.fg[3]/255, effectiveOpacity)
            else
              love.graphics.setColor(COLORS.inputText[1], COLORS.inputText[2],
                                     COLORS.inputText[3], effectiveOpacity)
            end
            if cell.bold then love.graphics.setFont(boldFont) end
            love.graphics.print(cell.char, px, py)
            if cell.bold then love.graphics.setFont(font) end
          end
        end
      end
      love.graphics.setScissor()

      -- Debug overlay: cols + window width (temporary)
      local debugFont = Measure.getFont(10, nil, nil)
      love.graphics.setFont(debugFont)
      love.graphics.setColor(1, 1, 0, 0.8 * effectiveOpacity)
      love.graphics.print(
        string.format("cols=%d  w=%.0f  fitCols=%d", cols, c.w, fitCols),
        c.x + 8, c.y + c.h - 60
      )

      -- Fall through to input bar below
    else
      -- Normal mode: render the block-based UI
      Renderer.render(node, c, effectiveOpacity)
    end

    -- ── Input bar (always drawn, every mode) ──────────────────────
    local inputState = getInputState(nodeId)
    if not Measure then return end

    local fontSize = 13
    local font = Measure.getFont(fontSize, nil, nil)
    local lineHeight = font:getHeight()
    local promptX = c.x + 16
    local prefixW = font:getWidth("> ")
    local textAreaW = c.w - 32 - prefixW  -- available width for text
    if textAreaW < 20 then textAreaW = 20 end

    -- Word-wrap helper: splits text into lines that fit within maxW
    local function wrapText(text, maxW)
      if #text == 0 then return { "" }, { 0 } end
      local lines = {}
      local lineStarts = { 1 }  -- byte offset where each line starts
      local lineStart = 1
      local lastSpace = nil
      local x = 0
      local i = 1
      while i <= #text do
        local ch = text:sub(i, i)
        local chW = font:getWidth(ch)
        if ch == " " then lastSpace = i end
        if x + chW > maxW and i > lineStart then
          -- Wrap: prefer breaking at last space
          local breakAt
          if lastSpace and lastSpace > lineStart then
            breakAt = lastSpace
            lines[#lines + 1] = text:sub(lineStart, breakAt - 1)
            lineStart = breakAt + 1  -- skip the space
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

    -- Compute wrapped lines
    local wrappedLines, lineStarts
    if #inputState.text > 0 then
      wrappedLines, lineStarts = wrapText(inputState.text, textAreaW)
    else
      wrappedLines = { "" }
      lineStarts = { 1 }
    end
    local numLines = #wrappedLines
    local inputH = numLines * lineHeight + 8  -- 4px padding top+bottom
    local inputTop = c.y + c.h - inputH - 20  -- 20px bottom margin

    -- Input background
    love.graphics.setColor(COLORS.inputBg[1], COLORS.inputBg[2], COLORS.inputBg[3],
                           (COLORS.inputBg[4] or 1) * effectiveOpacity)
    love.graphics.rectangle("fill", c.x + 8, inputTop, c.w - 16, inputH, 4, 4)

    -- "> " prefix on first line
    love.graphics.setFont(font)
    love.graphics.setColor(COLORS.inputPrompt[1], COLORS.inputPrompt[2], COLORS.inputPrompt[3],
                           (COLORS.inputPrompt[4] or 1) * effectiveOpacity)
    love.graphics.print("> ", promptX, inputTop + 4)

    if #inputState.text == 0 then
      -- Show placeholder from Claude CLI (tab to accept)
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
      -- Draw each wrapped line
      love.graphics.setScissor(c.x + 8, inputTop, c.w - 16, inputH)
      love.graphics.setColor(COLORS.inputText[1], COLORS.inputText[2], COLORS.inputText[3],
                             (COLORS.inputText[4] or 1) * effectiveOpacity)
      for i, line in ipairs(wrappedLines) do
        local lx = promptX + (i == 1 and prefixW or 0)
        local ly = inputTop + 4 + (i - 1) * lineHeight
        love.graphics.print(line, lx, ly)
      end
      love.graphics.setScissor()
    end

    -- Cursor: find which wrapped line the cursor is on
    if inputState.blinkOn then
      local cursorByte = inputState.cursorPos
      local cursorLine = 1
      for i = 2, #lineStarts do
        if cursorByte >= lineStarts[i] then
          cursorLine = i
        else
          break
        end
      end
      local lineOffset = cursorByte - lineStarts[cursorLine] + 1
      local textBefore = wrappedLines[cursorLine]:sub(1, lineOffset)
      local cursorPx = font:getWidth(textBefore)
      local cursorX = promptX + (cursorLine == 1 and prefixW or 0) + cursorPx
      local cursorY = inputTop + 4 + (cursorLine - 1) * lineHeight
      love.graphics.setColor(COLORS.inputCaret[1], COLORS.inputCaret[2], COLORS.inputCaret[3],
                             (COLORS.inputCaret[4] or 1) * effectiveOpacity)
      love.graphics.rectangle("fill", cursorX, cursorY, 2, lineHeight)
    end
  end,

  -- ── Keyboard event routing (called by init.lua) ───────────────

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
      -- Block all other input while permission is pending
      return true
    end

    -- Tab: accept placeholder text from Claude CLI
    if key == "tab" and #inputState.text == 0 then
      local ph = Session.getPlaceholder()
      if ph and #ph > 0 then
        inputState.text = ph
        inputState.cursorPos = #ph
      end
      return true
    end

    -- Enter: submit message
    if key == "return" or key == "kpenter" then
      local text = inputState.text
      if #text > 0 then
        -- Add to history
        inputState.history[#inputState.history + 1] = text
        inputState.historyIdx = 0
        -- Clear input
        inputState.text = ""
        inputState.cursorPos = 0
        -- Add as user input block in the renderer
        Renderer.addUserInput(sessionId, text)
        -- Send to session
        Session.send(text)
      end
      return true  -- consumed
    end

    -- Ctrl+V: paste
    if key == "v" and love.keyboard.isDown("lctrl", "rctrl") then
      local clipboard = love.system.getClipboardText()
      if clipboard then insertText(inputState, clipboard) end
      return true
    end

    -- Ctrl+A: select all (move cursor to end)
    if key == "a" and love.keyboard.isDown("lctrl", "rctrl") then
      inputState.cursorPos = #inputState.text
      return true
    end

    -- Ctrl+C: interrupt (when input is empty) or copy
    if key == "c" and love.keyboard.isDown("lctrl", "rctrl") then
      if #inputState.text == 0 then
        Session.stop()
        Renderer.addSystem(sessionId, "^C — interrupted")
      end
      return true
    end

    -- Ctrl+L: clear display
    if key == "l" and love.keyboard.isDown("lctrl", "rctrl") then
      Renderer.clearSession(sessionId)
      Renderer.getSession(sessionId)
      return true
    end

    -- Ctrl+R: expand/collapse the last tool block
    if key == "r" and love.keyboard.isDown("lctrl", "rctrl") then
      local session = Renderer.getSession(sessionId)
      -- Find the last collapsible block and toggle it
      for i = #session.blocks, 1, -1 do
        local block = session.blocks[i]
        if block.type == "tool_start" or block.type == "diff" then
          Renderer.toggleCollapse(sessionId, i)
          break
        end
      end
      return true
    end

    -- Ctrl+N: new agent session (placeholder — needs multi-agent UI)
    if key == "n" and love.keyboard.isDown("lctrl", "rctrl") then
      -- TODO: spawn new ClaudeCode + ClaudeCanvas instance
      Renderer.addSystem(sessionId, "Ctrl+N: multi-agent not yet wired")
      return true
    end

    -- Ctrl+Tab / Ctrl+Shift+Tab: cycle agent tabs
    if key == "tab" and love.keyboard.isDown("lctrl", "rctrl") then
      -- TODO: cycle through sessions when sidebar exists
      return true
    end

    -- Ctrl+E: toggle right panel (placeholder)
    if key == "e" and love.keyboard.isDown("lctrl", "rctrl") then
      -- TODO: toggle right panel when it exists
      return true
    end

    -- Ctrl+B: toggle left sidebar (placeholder)
    if key == "b" and love.keyboard.isDown("lctrl", "rctrl") then
      -- TODO: toggle left sidebar when it exists
      return true
    end

    -- Ctrl+K: search (placeholder)
    if key == "k" and love.keyboard.isDown("lctrl", "rctrl") then
      -- TODO: focus search when sidebar exists
      return true
    end

    -- Escape: just clear input (focus is always on canvas)
    if key == "escape" then
      inputState.text = ""
      inputState.cursorPos = 0
      inputState.historyIdx = 0
      return true
    end

    -- Cursor movement
    if key == "backspace" then
      if inputState.cursorPos > 0 then
        local before = inputState.text:sub(1, inputState.cursorPos - 1)
        local after = inputState.text:sub(inputState.cursorPos + 1)
        inputState.text = before .. after
        inputState.cursorPos = inputState.cursorPos - 1
      end
      return true
    elseif key == "delete" then
      if inputState.cursorPos < #inputState.text then
        local before = inputState.text:sub(1, inputState.cursorPos)
        local after = inputState.text:sub(inputState.cursorPos + 2)
        inputState.text = before .. after
      end
      return true
    elseif key == "left" then
      if inputState.cursorPos > 0 then
        inputState.cursorPos = inputState.cursorPos - 1
      end
      return true
    elseif key == "right" then
      if inputState.cursorPos < #inputState.text then
        inputState.cursorPos = inputState.cursorPos + 1
      end
      return true
    elseif key == "home" then
      inputState.cursorPos = 0
      return true
    elseif key == "end" then
      inputState.cursorPos = #inputState.text
      return true
    elseif key == "up" then
      -- History navigation
      if #inputState.history > 0 and inputState.historyIdx < #inputState.history then
        inputState.historyIdx = inputState.historyIdx + 1
        local idx = #inputState.history - inputState.historyIdx + 1
        inputState.text = inputState.history[idx] or ""
        inputState.cursorPos = #inputState.text
      end
      return true
    elseif key == "down" then
      if inputState.historyIdx > 0 then
        inputState.historyIdx = inputState.historyIdx - 1
        if inputState.historyIdx == 0 then
          inputState.text = ""
        else
          local idx = #inputState.history - inputState.historyIdx + 1
          inputState.text = inputState.history[idx] or ""
        end
        inputState.cursorPos = #inputState.text
      end
      return true
    end

    return false  -- not consumed, let framework handle
  end,

  handleTextInput = function(node, text)
    local inputState = getInputState(node.id)
    insertText(inputState, text)
  end,
})

-- ── Module exports ─────────────────────────────────────────────────

local Canvas = {}

--- Get the current input text for a canvas node (for testing)
function Canvas.getInputText(nodeId)
  return getInputState(nodeId).text
end

return Canvas
