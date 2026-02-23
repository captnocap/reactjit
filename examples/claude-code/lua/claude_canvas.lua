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

    -- Render the terminal blocks
    Renderer.render(node, c, effectiveOpacity)

    -- Render the inline "> " input prompt at bottom
    local inputState = getInputState(nodeId)
    if not Measure then return end

    local fontSize = 13
    local font = Measure.getFont(fontSize, nil, nil)
    local lineHeight = font:getHeight()
    local promptY = c.y + c.h - lineHeight - 28  -- above status bar
    local promptX = c.x + 16

    -- Input background
    love.graphics.setColor(COLORS.inputBg[1], COLORS.inputBg[2], COLORS.inputBg[3],
                           (COLORS.inputBg[4] or 1) * effectiveOpacity)
    love.graphics.rectangle("fill", c.x + 8, promptY - 4, c.w - 16, lineHeight + 8, 4, 4)

    -- "> " prefix
    love.graphics.setFont(font)
    love.graphics.setColor(COLORS.inputPrompt[1], COLORS.inputPrompt[2], COLORS.inputPrompt[3],
                           (COLORS.inputPrompt[4] or 1) * effectiveOpacity)
    love.graphics.print("> ", promptX, promptY)

    -- Input text
    local prefixW = font:getWidth("> ")
    love.graphics.setColor(COLORS.inputText[1], COLORS.inputText[2], COLORS.inputText[3],
                           (COLORS.inputText[4] or 1) * effectiveOpacity)
    love.graphics.print(inputState.text, promptX + prefixW, promptY)

    -- Cursor
    if inputState.blinkOn then
      local cursorX = promptX + prefixW + font:getWidth(inputState.text:sub(1, inputState.cursorPos))
      love.graphics.setColor(COLORS.inputCaret[1], COLORS.inputCaret[2], COLORS.inputCaret[3],
                             (COLORS.inputCaret[4] or 1) * effectiveOpacity)
      love.graphics.rectangle("fill", cursorX, promptY, 2, lineHeight)
    end
  end,

  -- ── Keyboard event routing (called by init.lua) ───────────────

  handleKeyPressed = function(node, key, scancode, isrepeat)
    local nodeId = node.id
    local props = node.props or {}
    local sessionId = props.sessionId or "default"
    local inputState = getInputState(nodeId)

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

io.write("[claude_canvas] Registered ClaudeCanvas visual capability\n"); io.flush()

return Canvas
