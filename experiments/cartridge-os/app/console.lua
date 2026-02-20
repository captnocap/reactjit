--[[
  console.lua — Quake-style dropdown console overlay
  CartridgeOS interactive terminal.

  Dependencies: gl.lua, font.lua, eventbus.lua, commands.lua
  These are passed in via Console.init(deps).
]]

local EventBus = require("eventbus")
local Commands = require("commands")

local Console = {}

-- Injected dependencies (set by Console.init)
local GL   = nil
local Font = nil
local rect = nil
local W, H = 0, 0

-- ── State ──────────────────────────────────────────────────────────────────

local open          = false
local height        = 0        -- current animated height in px
local targetHeight  = 0        -- 40% of screen when open
local animSpeed     = 2400     -- px/sec slide speed

local outputLines   = {}       -- {text, color={r,g,b}}
local maxOutputLines = 500

local inputText     = ""
local cursorPos     = 0        -- byte position (0 = start)
local cursorBlink   = 0        -- timer for blink

local cmdHistory    = {}
local historyIndex  = 0        -- 0 = not navigating

local scrollOffset  = 0        -- lines scrolled up from bottom

local mode          = "console"  -- "console" or "lua"
local lastTabTime   = 0          -- for double-tab detection
local TAB_DOUBLE_MS = 0.35       -- seconds between taps for double-tab

-- ── Layout constants ───────────────────────────────────────────────────────

local FONT_SIZE     = 14
local LINE_HEIGHT   = 20
local PADDING       = 12
local INPUT_HEIGHT  = 28
local STATUS_HEIGHT = 24
local PROMPT_CONSOLE = "> "
local PROMPT_LUA     = ">> "

-- ── Init ───────────────────────────────────────────────────────────────────

function Console.init(deps)
  GL   = deps.GL
  Font = deps.Font
  rect = deps.rect
  W    = deps.W
  H    = deps.H
  targetHeight = math.floor(H * 0.4)

  -- Welcome banner
  local banner = {
    { text = "",                                                color = {0.3, 0.2, 0.7} },
    { text = "   ____           __       _     __           ",  color = {0.4, 0.3, 1.0} },
    { text = "  / ___|__ _ _ __| |_ _ __(_) __| | __ _  ___",  color = {0.4, 0.3, 1.0} },
    { text = " | |   / _` | '__| __| '__| |/ _` |/ _` |/ _ \\", color = {0.5, 0.4, 1.0} },
    { text = " | |__| (_| | |  | |_| |  | | (_| | (_| |  __/", color = {0.5, 0.4, 1.0} },
    { text = "  \\____\\__,_|_|   \\__|_|  |_|\\__,_|\\__, |\\___|", color = {0.6, 0.5, 1.0} },
    { text = "    ___  ____                       |___/      ", color = {0.6, 0.5, 1.0} },
    { text = "   / _ \\/ ___|                                 ", color = {0.5, 0.4, 0.9} },
    { text = "  | | | \\___ \\                                 ", color = {0.5, 0.4, 0.9} },
    { text = "  | |_| |___) |                                ", color = {0.4, 0.3, 0.8} },
    { text = "   \\___/|____/                                 ", color = {0.4, 0.3, 0.8} },
    { text = "",                                                color = {0.3, 0.2, 0.7} },
    { text = "  iLoveReact — no X11, no Wayland, no display server", color = {0.5, 0.5, 0.7} },
    { text = "  Type 'help' for commands. Double-tab for Lua mode.", color = {0.4, 0.4, 0.6} },
    { text = "",                                                color = {0.3, 0.2, 0.7} },
  }
  for _, line in ipairs(banner) do
    Console.addOutput(line.text, line.color)
  end

  -- Subscribe to all events to populate the feed
  EventBus.subscribe("*", function(evt)
    if EventBus.isVisible(evt.channel) then
      local r, g, b = EventBus.channelColor(evt.channel)
      Console.addOutput("[" .. evt.channel .. "] " .. evt.summary, {r, g, b})
    end
  end)
end

function Console.updateSize(w, h)
  W, H = w, h
  targetHeight = math.floor(H * 0.4)
end

-- ── Public API ─────────────────────────────────────────────────────────────

function Console.isOpen()
  return open or height > 0
end

function Console.toggle()
  open = not open
  if open then
    -- Signal to main.lua to call SDL_StartTextInput
    return "open"
  else
    return "close"
  end
end

function Console.addOutput(text, color)
  table.insert(outputLines, {
    text  = text,
    color = color or {0.7, 0.7, 0.7},
  })
  -- Trim old lines
  while #outputLines > maxOutputLines do
    table.remove(outputLines, 1)
  end
  -- Auto-scroll to bottom on new output (unless user scrolled up)
  if scrollOffset == 0 then
    -- already at bottom
  end
end

-- ── Input handling ─────────────────────────────────────────────────────────

function Console.handleTextInput(text)
  if not open then return false end
  -- Insert text at cursor position
  local before = inputText:sub(1, cursorPos)
  local after  = inputText:sub(cursorPos + 1)
  inputText = before .. text .. after
  cursorPos = cursorPos + #text
  cursorBlink = 0
  return true
end

function Console.handleKeyDown(scancode, keycode)
  if not open then return false end

  -- Enter (scancode 40)
  if scancode == 40 then
    executeInput()
    return true
  end

  -- Backspace (scancode 42)
  if scancode == 42 then
    if cursorPos > 0 then
      -- Handle UTF-8: step back to find start of previous char
      local pos = cursorPos
      while pos > 0 and inputText:byte(pos) and
            inputText:byte(pos) >= 0x80 and inputText:byte(pos) < 0xC0 do
        pos = pos - 1
      end
      if pos > 0 then pos = pos - 1 end
      inputText = inputText:sub(1, pos) .. inputText:sub(cursorPos + 1)
      cursorPos = pos
    end
    cursorBlink = 0
    return true
  end

  -- Delete (scancode 76)
  if scancode == 76 then
    if cursorPos < #inputText then
      -- Find end of current char
      local nextPos = cursorPos + 1
      while nextPos <= #inputText and
            inputText:byte(nextPos + 1) and
            inputText:byte(nextPos + 1) >= 0x80 and inputText:byte(nextPos + 1) < 0xC0 do
        nextPos = nextPos + 1
      end
      inputText = inputText:sub(1, cursorPos) .. inputText:sub(nextPos + 1)
    end
    return true
  end

  -- Left arrow (scancode 80)
  if scancode == 80 then
    if cursorPos > 0 then
      cursorPos = cursorPos - 1
      -- Skip UTF-8 continuation bytes
      while cursorPos > 0 and inputText:byte(cursorPos + 1) and
            inputText:byte(cursorPos + 1) >= 0x80 and inputText:byte(cursorPos + 1) < 0xC0 do
        cursorPos = cursorPos - 1
      end
    end
    cursorBlink = 0
    return true
  end

  -- Right arrow (scancode 79)
  if scancode == 79 then
    if cursorPos < #inputText then
      cursorPos = cursorPos + 1
      -- Skip UTF-8 continuation bytes
      while cursorPos < #inputText and inputText:byte(cursorPos + 1) and
            inputText:byte(cursorPos + 1) >= 0x80 and inputText:byte(cursorPos + 1) < 0xC0 do
        cursorPos = cursorPos + 1
      end
    end
    cursorBlink = 0
    return true
  end

  -- Up arrow (scancode 82) — command history
  if scancode == 82 then
    if #cmdHistory > 0 then
      if historyIndex == 0 then
        historyIndex = #cmdHistory
      elseif historyIndex > 1 then
        historyIndex = historyIndex - 1
      end
      inputText = cmdHistory[historyIndex]
      cursorPos = #inputText
    end
    return true
  end

  -- Down arrow (scancode 81) — command history
  if scancode == 81 then
    if historyIndex > 0 then
      if historyIndex < #cmdHistory then
        historyIndex = historyIndex + 1
        inputText = cmdHistory[historyIndex]
        cursorPos = #inputText
      else
        historyIndex = 0
        inputText = ""
        cursorPos = 0
      end
    end
    return true
  end

  -- Tab (scancode 43) — autocomplete or double-tab for Lua mode toggle
  if scancode == 43 then
    local now = os.clock()
    if inputText == "" then
      -- Double-tab on empty input toggles Lua mode
      if (now - lastTabTime) < TAB_DOUBLE_MS then
        if mode == "console" then
          mode = "lua"
          Console.addOutput("  switched to Lua mode (>> )", {1.0, 0.8, 0.3})
        else
          mode = "console"
          Console.addOutput("  switched to console mode (> )", {0.5, 0.9, 0.5})
        end
        lastTabTime = 0
      else
        lastTabTime = now
      end
    else
      -- Tab completion
      local candidates = Commands.complete(inputText)
      if #candidates == 1 then
        inputText = candidates[1] .. " "
        cursorPos = #inputText
      elseif #candidates > 1 then
        -- Show candidates
        for _, c in ipairs(candidates) do
          Console.addOutput("  " .. c, {0.6, 0.6, 0.7})
        end
      end
      lastTabTime = now
    end
    return true
  end

  -- Escape (scancode 41) — clear input or close
  if scancode == 41 then
    if inputText ~= "" then
      inputText = ""
      cursorPos = 0
    else
      open = false
      return true, "close"
    end
    return true
  end

  -- Page Up (scancode 75)
  if scancode == 75 then
    scrollOffset = math.min(scrollOffset + 5, math.max(0, #outputLines - 3))
    return true
  end

  -- Page Down (scancode 78)
  if scancode == 78 then
    scrollOffset = math.max(0, scrollOffset - 5)
    return true
  end

  -- Home (scancode 74)
  if scancode == 74 then
    cursorPos = 0
    cursorBlink = 0
    return true
  end

  -- End (scancode 77)
  if scancode == 77 then
    cursorPos = #inputText
    cursorBlink = 0
    return true
  end

  return true  -- eat all keys when console is open
end

-- ── Command execution ──────────────────────────────────────────────────────

function executeInput()
  local trimmed = inputText:match("^%s*(.-)%s*$")
  if trimmed == "" then return end

  -- Add to history
  table.insert(cmdHistory, trimmed)
  historyIndex = 0
  scrollOffset = 0

  -- Show the input in the output
  local prompt = mode == "lua" and PROMPT_LUA or PROMPT_CONSOLE
  Console.addOutput(prompt .. trimmed, {0.9, 0.9, 0.9})

  -- Check for !! one-shot Lua eval
  if trimmed:sub(1, 2) == "!!" then
    local code = trimmed:sub(3):match("^%s*(.+)")
    if code then
      evalLua(code)
    end
  elseif mode == "lua" then
    evalLua(trimmed)
  else
    -- Console mode: run through command dictionary
    local result = Commands.execute(trimmed)
    if result then
      renderResult(result)
    end
  end

  inputText = ""
  cursorPos = 0
end

function evalLua(code)
  -- Try as expression first (return value)
  local fn, err = loadstring("return " .. code)
  if not fn then
    -- Try as statement
    fn, err = loadstring(code)
  end
  if not fn then
    Console.addOutput("  error: " .. tostring(err), {1, 0.3, 0.3})
    return
  end

  local ok, result = pcall(fn)
  if ok then
    if result ~= nil then
      Console.addOutput("  " .. tostring(result), {0.5, 1, 0.5})
    else
      Console.addOutput("  (nil)", {0.4, 0.4, 0.5})
    end
  else
    Console.addOutput("  error: " .. tostring(result), {1, 0.3, 0.3})
  end
end

function renderResult(result)
  if result.type == "clear" then
    outputLines = {}
    scrollOffset = 0
  elseif result.type == "error" then
    Console.addOutput("  " .. result.data, {1, 0.4, 0.4})
  elseif result.type == "lines" then
    for _, line in ipairs(result.data) do
      Console.addOutput(line.text, line.color)
    end
  elseif result.type == "text" then
    Console.addOutput("  " .. result.data, {0.7, 0.8, 0.7})
  end
end

-- ── Update ─────────────────────────────────────────────────────────────────

function Console.update(dt)
  -- Animate slide
  if open then
    if height < targetHeight then
      height = math.min(targetHeight, height + animSpeed * dt)
    end
  else
    if height > 0 then
      height = math.max(0, height - animSpeed * dt)
    end
  end

  -- Blink cursor
  cursorBlink = cursorBlink + dt
end

-- ── Draw ───────────────────────────────────────────────────────────────────

function Console.draw()
  if height <= 1 then return end

  local h = math.floor(height)
  local w = W

  -- Background
  rect(0, 0, w, h, 0.02, 0.02, 0.06, 0.92)

  -- Left accent bar
  rect(0, 0, 3, h, 0.4, 0.3, 1.0, 0.8)

  -- Status bar at bottom of console
  local statusY = h - STATUS_HEIGHT
  rect(0, statusY, w, STATUS_HEIGHT, 0.06, 0.06, 0.12, 1)
  rect(0, statusY, w, 1, 0.15, 0.15, 0.3, 1)

  local modeStr = mode == "lua" and "LUA MODE" or "CONSOLE"
  Font.draw(modeStr, PADDING + 4, statusY + 4, 12, 0.4, 0.3, 0.9, 1)

  local rightInfo = "F2:scim  `:toggle"
  local riw = Font.measureWidth(rightInfo, 12)
  Font.draw(rightInfo, w - PADDING - riw, statusY + 4, 12, 0.3, 0.3, 0.5, 1)

  -- Input area
  local inputY = statusY - INPUT_HEIGHT - 4
  rect(PADDING, inputY, w - PADDING * 2, INPUT_HEIGHT, 0.06, 0.06, 0.12, 0.9)
  rect(PADDING, inputY, w - PADDING * 2, 1, 0.2, 0.2, 0.35, 1)

  -- Prompt
  local prompt, promptColor
  if mode == "lua" then
    prompt = PROMPT_LUA
    promptColor = {1.0, 0.7, 0.2}
  else
    prompt = PROMPT_CONSOLE
    promptColor = {0.4, 0.9, 0.4}
  end

  local promptX = PADDING + 8
  local textY   = inputY + 6
  Font.draw(prompt, promptX, textY, FONT_SIZE,
            promptColor[1], promptColor[2], promptColor[3], 1)

  local promptW = Font.measureWidth(prompt, FONT_SIZE)
  local inputX  = promptX + promptW

  -- Input text
  Font.draw(inputText, inputX, textY, FONT_SIZE, 0.9, 0.9, 0.9, 1)

  -- Blinking cursor
  if math.floor(cursorBlink * 2) % 2 == 0 then
    local beforeCursor = inputText:sub(1, cursorPos)
    local cursorX = inputX + Font.measureWidth(beforeCursor, FONT_SIZE)
    rect(cursorX, textY, 2, FONT_SIZE + 2, promptColor[1], promptColor[2], promptColor[3], 0.9)
  end

  -- Divider above input
  rect(PADDING, inputY - 4, w - PADDING * 2, 1, 0.15, 0.15, 0.3, 0.6)

  -- Output area (scrollable)
  local outputAreaTop = PADDING
  local outputAreaBottom = inputY - 8
  local outputAreaH = outputAreaBottom - outputAreaTop
  local visibleLines = math.floor(outputAreaH / LINE_HEIGHT)

  -- Enable scissor for output area
  GL.glEnable(GL.SCISSOR_TEST)
  GL.glScissor(0, H - outputAreaBottom, w, outputAreaH)

  local startIdx = math.max(1, #outputLines - visibleLines - scrollOffset + 1)
  local endIdx   = math.max(1, #outputLines - scrollOffset)

  local drawY = outputAreaTop
  for i = startIdx, endIdx do
    local line = outputLines[i]
    if line and drawY + LINE_HEIGHT <= outputAreaBottom then
      Font.draw(line.text, PADDING + 8, drawY, FONT_SIZE,
                line.color[1], line.color[2], line.color[3], 1)
      drawY = drawY + LINE_HEIGHT
    end
  end

  GL.glDisable(GL.SCISSOR_TEST)

  -- Scroll indicator
  if scrollOffset > 0 then
    local indicator = string.format("-- %d lines above --", scrollOffset)
    local iw = Font.measureWidth(indicator, 11)
    Font.draw(indicator, (w - iw) / 2, outputAreaBottom - 16, 11, 0.4, 0.4, 0.5, 0.8)
  end
end

return Console
