--[[
  console.lua — Quake-style dropdown console overlay
  CartridgeOS interactive terminal.

  Dependencies: gl.lua, font.lua, eventbus.lua, commands.lua
  These are passed in via Console.init(deps).
]]

local bit      = require("bit")
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
local targetHeight  = 0        -- starts at 40% of screen, resizable
local heightStep    = 0.1      -- resize by 10% of screen per step
local minHeightPct  = 0.2      -- minimum 20%
local maxHeightPct  = 1.0      -- maximum 100% (fullscreen)
local currentPct    = 0.4      -- current height as fraction of screen
local animSpeed     = 2400     -- px/sec slide speed

local outputLines   = {}       -- {text, color={r,g,b}}
local maxOutputLines = 500

local inputText     = ""
local cursorPos     = 0        -- byte position (0 = start)
local cursorBlink   = 0        -- timer for blink

local cmdHistory    = {}
local historyIndex  = 0        -- 0 = not navigating

local scrollOffset  = 0        -- lines scrolled up from bottom
local lastVisibleLines = 1     -- updated each draw, used by scroll clamping

local ignoreNextTextInput = false  -- eat the backtick that opened the console

local mode          = "console"  -- "console" or "lua"
local lastTabTime   = 0          -- for double-tab detection
local TAB_DOUBLE_MS = 0.35       -- seconds between taps for double-tab

-- ── Backdrop layer ───────────────────────────────────────────────────────
-- Faint decoration in the bottom-right corner, rendered behind all text.
-- Default: ASCII art watermark. Replace with an image callback later.

local backdrop = {
  alpha = 0.07,      -- very faint so it doesn't fight text
  color = {0.5, 0.4, 1.0},
  fontSize = 13,
  lines = {
    "   ____           __       _     __",
    "  / ___|__ _ _ __| |_ _ __(_) __| | __ _  ___",
    " | |   / _` | '__| __| '__| |/ _` |/ _` |/ _ \\",
    " | |__| (_| | |  | |_| |  | | (_| | (_| |  __/",
    "  \\____\\__,_|_|   \\__|_|  |_|\\__,_|\\__, |\\___|",
    "    ___  ____                       |___/",
    "   / _ \\/ ___|",
    "  | | | \\___ \\",
    "  | |_| |___) |",
    "   \\___/|____/",
  },
}

--- Set a custom backdrop. Pass nil to clear.
--- Fields: lines (table of strings), alpha, color {r,g,b}, fontSize
function Console.setBackdrop(cfg)
  if cfg == nil then
    backdrop.lines = {}
    return
  end
  if cfg.lines    then backdrop.lines    = cfg.lines    end
  if cfg.alpha    then backdrop.alpha    = cfg.alpha    end
  if cfg.color    then backdrop.color    = cfg.color    end
  if cfg.fontSize then backdrop.fontSize = cfg.fontSize end
end

-- ── SDL modifier constants ──────────────────────────────────────────────────

local KMOD_CTRL = 0x00C0   -- KMOD_LCTRL (0x40) | KMOD_RCTRL (0x80)

-- ── Layout constants ───────────────────────────────────────────────────────

local FONT_SIZE     = 14
local MIN_FONT_SIZE = 8
local MAX_FONT_SIZE = 28
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
  targetHeight = math.floor(H * currentPct)

  -- Welcome hint (single line, not a wall of ASCII)
  Console.addOutput("  Type 'help' for commands. Double-tab for Lua mode.", {0.4, 0.4, 0.6})

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
  targetHeight = math.floor(H * currentPct)
end

-- ── Public API ─────────────────────────────────────────────────────────────

function Console.isOpen()
  return open or height > 0
end

function Console.handleScroll(y)
  if not open then return end
  -- y > 0 = scroll up (show older), y < 0 = scroll down (show newer)
  local SCROLL_SPEED = 3
  local maxScroll = math.max(0, #outputLines - lastVisibleLines)
  if y > 0 then
    scrollOffset = math.min(scrollOffset + SCROLL_SPEED, maxScroll)
  elseif y < 0 then
    scrollOffset = math.max(0, scrollOffset - SCROLL_SPEED)
  end
end

function Console.toggle()
  open = not open
  if open then
    ignoreNextTextInput = true  -- eat the backtick character
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
  -- Eat the backtick that triggered the console open
  if ignoreNextTextInput then
    ignoreNextTextInput = false
    return true
  end
  -- Insert text at cursor position
  local before = inputText:sub(1, cursorPos)
  local after  = inputText:sub(cursorPos + 1)
  inputText = before .. text .. after
  cursorPos = cursorPos + #text
  cursorBlink = 0
  return true
end

function Console.handleKeyDown(scancode, modState)
  if not open then return false end
  modState = modState or 0
  local ctrl = bit.band(modState, KMOD_CTRL) ~= 0

  -- Ctrl+Up — grow console
  if ctrl and scancode == 82 then
    currentPct = math.min(maxHeightPct, currentPct + heightStep)
    targetHeight = math.floor(H * currentPct)
    return true
  end

  -- Ctrl+Down — shrink console
  if ctrl and scancode == 81 then
    currentPct = math.max(minHeightPct, currentPct - heightStep)
    targetHeight = math.floor(H * currentPct)
    return true
  end

  -- Ctrl+Plus (scancode 87 = KP+, or 46 = =+) — increase font size
  if ctrl and (scancode == 87 or scancode == 46) then
    FONT_SIZE = math.min(MAX_FONT_SIZE, FONT_SIZE + 1)
    LINE_HEIGHT = math.floor(FONT_SIZE * 1.45)
    return true
  end

  -- Ctrl+Minus (scancode 86 = KP-, or 45 = -_) — decrease font size
  if ctrl and (scancode == 86 or scancode == 45) then
    FONT_SIZE = math.max(MIN_FONT_SIZE, FONT_SIZE - 1)
    LINE_HEIGHT = math.floor(FONT_SIZE * 1.45)
    return true
  end

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
    local maxScroll = math.max(0, #outputLines - lastVisibleLines)
    scrollOffset = math.min(scrollOffset + 5, maxScroll)
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
  -- Use CART_BOOT.eval — sandboxed loadstring provided by the OS jailer.
  -- The function runs with _G (sandboxed) as its environment.
  local boot = CART_BOOT
  if not boot or not boot.eval then
    Console.addOutput("  Lua eval not available", {1.0, 0.6, 0.2})
    return
  end

  local ok, result = boot.eval(code)
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

  -- ── Backdrop decoration (behind all text) ────────────────────────────
  if backdrop.lines and #backdrop.lines > 0 and backdrop.alpha > 0 then
    local bfs = backdrop.fontSize
    local blh = math.floor(bfs * 1.4)
    local totalH = #backdrop.lines * blh
    -- Anchor to bottom-right of the output area, above the input bar
    local bx = w - PADDING - 20
    local by = h - STATUS_HEIGHT - INPUT_HEIGHT - 16 - totalH

    local r, g, b = backdrop.color[1], backdrop.color[2], backdrop.color[3]
    local a = backdrop.alpha

    for i, line in ipairs(backdrop.lines) do
      local lw = Font.measureWidth(line, bfs)
      Font.draw(line, bx - lw, by + (i - 1) * blh, bfs, r, g, b, a)
    end
  end

  -- Status bar at bottom of console
  local statusY = h - STATUS_HEIGHT
  rect(0, statusY, w, STATUS_HEIGHT, 0.06, 0.06, 0.12, 1)
  rect(0, statusY, w, 1, 0.15, 0.15, 0.3, 1)

  local modeStr = mode == "lua" and "LUA MODE" or "CONSOLE"
  Font.draw(modeStr, PADDING + 4, statusY + 4, 12, 0.4, 0.3, 0.9, 1)

  local rightInfo = "C-+/-:font  C-Up/Dn:size  `:toggle"
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

  -- Output area (scrollable, bottom-aligned like a real terminal)
  local outputAreaTop = PADDING
  local outputAreaBottom = inputY - 8
  local outputAreaH = math.max(0, outputAreaBottom - outputAreaTop)
  local visibleLines = math.floor(outputAreaH / LINE_HEIGHT)
  lastVisibleLines = visibleLines  -- cache for scroll clamping

  if outputAreaH > 0 then
    -- Enable scissor for output area — let GL clip partial lines
    GL.glEnable(GL.SCISSOR_TEST)
    GL.glScissor(0, H - (outputAreaTop + outputAreaH), math.max(0, w), math.max(0, outputAreaH))

    -- Clamp scroll to actual content
    local maxScroll = math.max(0, #outputLines - visibleLines)
    if scrollOffset > maxScroll then scrollOffset = maxScroll end

    local endIdx   = math.max(1, #outputLines - scrollOffset)
    local startIdx = math.max(1, endIdx - visibleLines + 1)
    local numLines = endIdx - startIdx + 1

    -- Bottom-align: newest line sits just above the input divider.
    -- Blank space (if any) is at the top, not between output and input.
    local drawY = outputAreaBottom - numLines * LINE_HEIGHT
    for i = startIdx, endIdx do
      local line = outputLines[i]
      if line then
        Font.draw(line.text, PADDING + 8, drawY, FONT_SIZE,
                  line.color[1], line.color[2], line.color[3], 1)
        drawY = drawY + LINE_HEIGHT
      end
    end

    GL.glDisable(GL.SCISSOR_TEST)
  end

  -- Scroll indicator
  if scrollOffset > 0 then
    local indicator = string.format("-- %d lines above --", scrollOffset)
    local iw = Font.measureWidth(indicator, 11)
    Font.draw(indicator, (w - iw) / 2, outputAreaBottom - 16, 11, 0.4, 0.4, 0.5, 0.8)
  end
end

return Console
