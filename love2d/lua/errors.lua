--[[
  errors.lua -- Error collection + visual overlay

  Two modes:
    1. Normal overlay: 40% bottom panel on top of the running app (non-fatal errors)
    2. BSOD mode: full-screen crash recovery screen with event trail, deep
       stack trace, copy-to-clipboard, and reboot controls

  BSOD mode activates automatically when crashRecoveryMode is true.

  Usage:
    local errors = require("lua.errors")
    errors.push({ source = "js", message = "...", stack = "...", context = "...", trail = {...} })
    -- In love.draw():
    errors.draw()            -- normal overlay
    errors.drawBSOD()        -- full-screen crash recovery (call from init.lua when crashRecoveryMode)
    -- In love.mousepressed():
    errors.mousepressed(x, y)
    -- In crash recovery keyboard routing:
    errors.keypressed(key)
]]

local Errors = {}

-- Inline code editor for BSOD
local editorOk, bsodEditor = pcall(require, "lua.bsod_editor")
if not editorOk then bsodEditor = nil end

-- Rolling buffer of recent errors (max 20)
local buffer = {}
local MAX_ERRORS = 20

-- Current error index being displayed (1-based, 0 = none/dismissed)
local currentIndex = 0

-- Whether overlay is visible
local visible = false

-- Copy button state
local copyBtnRect = { x = 0, y = 0, w = 0, h = 0 }
local copiedFlashUntil = 0

-- BSOD state
local bsodCopied = false
local bsodCopiedTimer = 0
local bsodSpinnerIdx = 1
local bsodSpinnerTimer = 0
local spinnerChars = { "|", "/", "-", "\\" }
local scrollOffset = 0  -- scroll position for BSOD content

-- BSOD clickable button hit rects (updated each frame by drawBSOD)
local bsodButtons = {
  reboot = { x = 0, y = 0, w = 0, h = 0 },
  copy   = { x = 0, y = 0, w = 0, h = 0 },
  quit   = { x = 0, y = 0, w = 0, h = 0 },
}
local bsodHoveredBtn = nil  -- which button the mouse is over

-- Callback to trigger reload (set by init.lua)
local reloadCallback = nil

-- Overlay height as fraction of screen (normal mode)
local OVERLAY_HEIGHT_FRAC = 0.4
local MIN_OVERLAY_HEIGHT = 200
local MAX_STACK_LINES = 6

-- Normal overlay colors
local BG_COLOR      = { 0.86, 0.15, 0.15, 0.92 }  -- #dc2626
local TEXT_COLOR     = { 0.996, 0.949, 0.949, 1 }   -- #fef2f2
local SECONDARY     = { 0.988, 0.647, 0.647, 1 }    -- #fca5a5
local DIM_COLOR     = { 0.988, 0.647, 0.647, 0.7 }  -- #fca5a5 dimmed
local SHADOW_COLOR  = { 0, 0, 0, 0.4 }

-- BSOD colors (dark theme)
local BSOD_BG       = { 0.06, 0.04, 0.08, 1 }
local BSOD_ACCENT   = { 0.85, 0.20, 0.25, 1 }
local BSOD_TEXT      = { 0.92, 0.90, 0.88, 1 }
local BSOD_DIM       = { 0.55, 0.52, 0.50, 1 }
local BSOD_TRACE     = { 0.75, 0.55, 0.50, 1 }
local BSOD_TRAIL     = { 0.50, 0.60, 0.75, 1 }
local BSOD_GREEN     = { 0.30, 0.80, 0.40, 1 }
local BSOD_COPIED    = { 0.40, 0.85, 0.50, 1 }
local BSOD_BAR       = { 0.08, 0.06, 0.10, 1 }

-- ============================================================================
-- Font cache — created ONCE on first use. NEVER allocate fonts per frame.
-- Creating love.graphics.newFont() every frame leaks GPU memory and eventually
-- freezes the crash screen, which is the one thing that must never freeze.
-- ============================================================================
local _fonts = nil
local function getFonts()
  if _fonts then return _fonts end
  local fallback = love.graphics.getFont()

  -- Create each font individually so a single failure doesn't lose all of them
  local ok11, f11 = pcall(love.graphics.newFont, 11)
  local ok12, f12 = pcall(love.graphics.newFont, 12)
  local ok14, f14 = pcall(love.graphics.newFont, 14)
  local ok18, f18 = pcall(love.graphics.newFont, 18)

  -- Editor font: try monospace, fall back to default size
  local editorFont = fallback
  local okMono, mono = pcall(love.graphics.newFont, "monospace", 12)
  if okMono and mono then
    editorFont = mono
  elseif ok12 then
    editorFont = f12
  end

  _fonts = {
    small   = ok11 and f11 or fallback,
    body    = ok12 and f12 or fallback,
    title14 = ok14 and f14 or fallback,
    title18 = ok18 and f18 or fallback,
    editor  = editorFont,
  }
  return _fonts
end

--- Set the reload callback (called by init.lua on setup).
function Errors.setReloadCallback(fn)
  reloadCallback = fn
end

--- Push a new error into the buffer and show the overlay.
--- @param err table { source, message, stack, context, trail }
function Errors.push(err)
  local entry = {
    timestamp = os.date("%H:%M:%S"),
    source = err.source or "unknown",
    message = err.message or "unknown error",
    stack = err.stack or "",
    context = err.context or "",
    trail = err.trail or nil,  -- event trail snapshot (array of {type, args, time})
  }

  -- Add to buffer (rolling)
  buffer[#buffer + 1] = entry
  if #buffer > MAX_ERRORS then
    table.remove(buffer, 1)
  end

  -- Show this error — but if we're already displaying an error (crash cascade),
  -- keep the index on the FIRST error in the sequence. That's the root cause;
  -- subsequent errors are cascade noise from corrupted state.
  if not visible then
    currentIndex = #buffer
  end
  visible = true
  scrollOffset = 0

  -- Initialize the inline code editor with the crash location
  if bsodEditor then
    pcall(bsodEditor.init, entry.message, entry.stack)
  end

  -- Print structured output to terminal
  Errors._printToTerminal(entry)
end

--- Print a structured error to the terminal.
function Errors._printToTerminal(entry)
  local ok, _ = pcall(function()
    io.write("\n")
    io.write("[reactjit ERROR] " .. entry.timestamp .. " | " .. entry.context .. "\n")
    io.write("  " .. entry.source .. ": " .. entry.message .. "\n")
    if entry.stack and entry.stack ~= "" then
      io.write("  Stack:\n")
      local lineCount = 0
      for line in entry.stack:gmatch("[^\n]+") do
        io.write("    " .. line .. "\n")
        lineCount = lineCount + 1
        if lineCount >= 10 then
          io.write("    ... (truncated)\n")
          break
        end
      end
    end
    io.write("\n")
    io.flush()
  end)
end

--- Format an error entry as a plain-text string for clipboard.
local function formatForClipboard(entry)
  local parts = {}
  parts[#parts + 1] = "REACTJIT CRASH REPORT"
  parts[#parts + 1] = string.rep("=", 60)
  parts[#parts + 1] = ""
  parts[#parts + 1] = "Time: " .. (entry.timestamp or "unknown")

  if entry.context and entry.context ~= "" then
    parts[#parts + 1] = "Context: " .. entry.context
  end
  parts[#parts + 1] = ""

  local prefix = entry.source ~= "unknown" and (entry.source .. ": ") or ""
  parts[#parts + 1] = "ERROR"
  parts[#parts + 1] = prefix .. entry.message
  parts[#parts + 1] = ""

  if entry.stack and entry.stack ~= "" then
    parts[#parts + 1] = "TRACEBACK"
    parts[#parts + 1] = string.rep("-", 60)
    parts[#parts + 1] = entry.stack
    parts[#parts + 1] = ""
  end

  -- Event trail
  if entry.trail and #entry.trail > 0 then
    parts[#parts + 1] = "EVENT TRAIL (" .. #entry.trail .. " events, most recent first)"
    parts[#parts + 1] = string.rep("-", 60)
    for i = #entry.trail, math.max(1, #entry.trail - 29), -1 do
      local e = entry.trail[i]
      local timeStr = string.format("%.3fs", e.time)
      local argsPart = e.args ~= "" and ("  " .. e.args) or ""
      parts[#parts + 1] = "  " .. timeStr .. "  " .. e.type .. argsPart
    end
  end

  return table.concat(parts, "\n")
end

-- ============================================================================
-- BSOD Mode: Full-screen crash recovery
-- ============================================================================

--- Draw the full-screen BSOD crash recovery screen.
--- Called by init.lua when crashRecoveryMode is true.
function Errors.drawBSOD()
  if currentIndex < 1 or currentIndex > #buffer then return end

  local entry = buffer[currentIndex]
  if not entry then return end

  local fonts = getFonts()
  local W = love.graphics.getWidth()
  local H = love.graphics.getHeight()
  local pad = 24
  local barH = 44

  -- Background + accent bar (always safe)
  love.graphics.clear(BSOD_BG[1], BSOD_BG[2], BSOD_BG[3])
  love.graphics.setColor(BSOD_ACCENT)
  love.graphics.rectangle("fill", 0, 0, W, 4)

  -- Content section (protected — editor/stack rendering can fail)
  pcall(function()
    local y = pad + 4

    -- Title
    love.graphics.setFont(fonts.title18)
    love.graphics.setColor(BSOD_ACCENT)
    love.graphics.print("ReactJIT crashed", pad, y)
    y = y + 28

    -- Timestamp + context
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(BSOD_DIM)
    local contextStr = entry.timestamp
    if entry.context ~= "" then
      contextStr = contextStr .. "  |  " .. entry.context
    end
    love.graphics.print(contextStr, pad, y)
    y = y + 16

    -- Error counter (if multiple)
    if #buffer > 1 then
      love.graphics.setColor(BSOD_DIM)
      love.graphics.print("Error " .. currentIndex .. " of " .. #buffer .. "  (Tab to cycle)", W - pad - 200, pad + 4)
    end

    -- Error message (compact — 2 lines max)
    love.graphics.setFont(fonts.body)
    love.graphics.setColor(BSOD_TEXT)

    local msgPrefix = entry.source ~= "unknown" and (entry.source .. ": ") or ""
    local fullMsg = msgPrefix .. entry.message
    -- Truncate to ~2 lines worth
    if #fullMsg > 120 then fullMsg = fullMsg:sub(1, 117) .. "..." end
    love.graphics.print(fullMsg, pad, y)
    y = y + 18

    -- ================================================================
    -- CODE EDITOR SECTION — takes ~50% of screen height
    -- ================================================================
    local editorActive = bsodEditor and bsodEditor.isActive()

    if editorActive then
      local editorH = math.floor((H - y - barH - 8) * 0.55)
      editorH = math.max(editorH, 120)

      bsodEditor.draw(pad, y, W - pad * 2, editorH, fonts.editor)
      y = y + editorH + 8
    else
      -- No file found — show hint
      love.graphics.setColor(BSOD_DIM)
      love.graphics.setFont(fonts.small)
      if entry.source == "js" then
        love.graphics.print("  Source is a compiled bundle — edit your .tsx source and save to trigger HMR reload", pad, y)
      else
        love.graphics.print("  Could not locate source file for inline editing", pad, y)
      end
      y = y + 20
    end

    -- ================================================================
    -- STACK TRACE + EVENT TRAIL (scrollable, below editor)
    -- ================================================================
    local trailSectionY = y
    local trailSectionH = H - y - barH - 4

    -- Scissor for scrollable section
    love.graphics.setScissor(0, trailSectionY, W, trailSectionH)

    local sy = trailSectionY - scrollOffset

    -- Separator
    love.graphics.setColor(BSOD_ACCENT[1], BSOD_ACCENT[2], BSOD_ACCENT[3], 0.3)
    love.graphics.rectangle("fill", pad, sy, W - pad * 2, 1)
    sy = sy + 8

    -- Stack trace
    if entry.stack and entry.stack ~= "" then
      love.graphics.setColor(BSOD_DIM)
      love.graphics.setFont(fonts.small)
      love.graphics.print("TRACEBACK", pad, sy)
      sy = sy + 14

      for line in entry.stack:gmatch("[^\n]+") do
        love.graphics.setColor(BSOD_TRACE)
        love.graphics.print("  " .. line, pad, sy)
        sy = sy + 14
      end
      sy = sy + 8
    end

    -- Event trail section
    local trail = entry.trail
    if trail and #trail > 0 then
      love.graphics.setColor(BSOD_ACCENT[1], BSOD_ACCENT[2], BSOD_ACCENT[3], 0.3)
      love.graphics.rectangle("fill", pad, sy, W - pad * 2, 1)
      sy = sy + 8

      love.graphics.setColor(BSOD_DIM)
      love.graphics.setFont(fonts.small)
      love.graphics.print("EVENT TRAIL (" .. #trail .. " events, most recent first)", pad, sy)
      sy = sy + 16

      love.graphics.setFont(fonts.body)
      local maxTrailShow = math.min(#trail, 25)
      for i = #trail, math.max(1, #trail - maxTrailShow + 1), -1 do
        local e = trail[i]
        local timeStr = string.format("%.3fs", e.time)
        local argsPart = e.args ~= "" and ("  " .. e.args) or ""
        love.graphics.setColor(BSOD_TRAIL)
        love.graphics.print("  " .. timeStr .. "  " .. e.type .. argsPart, pad, sy)
        sy = sy + 14
      end
    end

    love.graphics.setScissor()
  end)

  -- Clean up any leaked scissor from the content pcall
  love.graphics.setScissor()

  -- Bottom controls bar — ALWAYS renders, even if content section errored.
  -- The pcall above may fail (editor crash, font issue, etc.) but the user
  -- still needs to see key hints and the HMR watcher status.
  local barY = H - barH
  love.graphics.setColor(BSOD_BAR)
  love.graphics.rectangle("fill", 0, barY, W, barH)
  love.graphics.setColor(BSOD_ACCENT[1], BSOD_ACCENT[2], BSOD_ACCENT[3], 0.3)
  love.graphics.rectangle("fill", 0, barY, W, 1)

  love.graphics.setFont(fonts.small)

  -- Spinner + watcher status
  bsodSpinnerTimer = bsodSpinnerTimer + (love.timer.getDelta() or 0.016)
  if bsodSpinnerTimer >= 0.15 then
    bsodSpinnerTimer = 0
    bsodSpinnerIdx = (bsodSpinnerIdx % #spinnerChars) + 1
  end
  -- Tick copy flash timer
  if bsodCopied then
    bsodCopiedTimer = bsodCopiedTimer - (love.timer.getDelta() or 0.016)
    if bsodCopiedTimer <= 0 then bsodCopied = false end
  end

  -- Left side: watcher status
  love.graphics.setColor(BSOD_GREEN)
  love.graphics.print(spinnerChars[bsodSpinnerIdx] .. " Watching for code changes — press R or click Reboot to restart", pad, barY + 14)

  -- Right side: clickable buttons
  local btnH = 28
  local btnY = barY + math.floor((barH - btnH) / 2)
  local btnPadX = 10  -- horizontal padding inside button
  local btnGap = 8
  local btnX = W - pad

  -- Track mouse position for hover state
  local mx, my = love.mouse.getPosition()

  -- Helper to draw a button and record its hit rect
  local function drawButton(name, label, bgColor, textColor)
    local tw = fonts.small:getWidth(label)
    local bw = tw + btnPadX * 2
    btnX = btnX - bw
    local rect = bsodButtons[name]
    rect.x, rect.y, rect.w, rect.h = btnX, btnY, bw, btnH

    -- Hover detection
    local hovered = mx >= rect.x and mx <= rect.x + rect.w
                and my >= rect.y and my <= rect.y + rect.h

    -- Background
    if hovered then
      love.graphics.setColor(bgColor[1], bgColor[2], bgColor[3], 0.9)
    else
      love.graphics.setColor(bgColor[1], bgColor[2], bgColor[3], 0.6)
    end
    love.graphics.rectangle("fill", btnX, btnY, bw, btnH, 4, 4)

    -- Text
    love.graphics.setColor(textColor)
    love.graphics.print(label, btnX + btnPadX, btnY + math.floor((btnH - fonts.small:getHeight()) / 2))

    btnX = btnX - btnGap
  end

  -- Flash message overrides the buttons
  if bsodCopied then
    love.graphics.setColor(BSOD_COPIED)
    local flashText = "Copied to clipboard!"
    local fw = fonts.small:getWidth(flashText)
    love.graphics.print(flashText, W - pad - fw, barY + 14)
  else
    -- Draw buttons right-to-left: Quit, Copy, Reboot (so Reboot is leftmost = most prominent)
    drawButton("quit",   "Quit",   { 0.30, 0.28, 0.35 }, BSOD_DIM)
    drawButton("copy",   "Copy",   { 0.25, 0.30, 0.40 }, BSOD_TRAIL)
    drawButton("reboot", "Reboot", BSOD_ACCENT,           BSOD_TEXT)
  end
end

--- Handle keypresses in BSOD/crash recovery mode.
--- Called by ReactJIT.safeCall when crashRecoveryMode is true.
function Errors.keypressed(key)
  if currentIndex < 1 or currentIndex > #buffer then return end

  -- Editor gets first crack at keypresses
  if bsodEditor and bsodEditor.isActive() then
    local result = bsodEditor.keypressed(key)
    if result == "save" then
      -- Save the file and trigger reload
      local saved = bsodEditor.save()
      if saved and reloadCallback then
        pcall(reloadCallback)
      end
      return
    end
    -- If the editor has an active cursor, it consumed navigation keys
    -- Only fall through for global shortcuts
    local ctrl = love.keyboard.isDown("lctrl", "rctrl")
    if not ctrl and key ~= "escape" and key ~= "r" and key ~= "tab" then
      return
    end
  end

  -- Ctrl+C: copy crash report to clipboard
  if key == "c" and love.keyboard.isDown("lctrl", "rctrl") then
    local entry = buffer[currentIndex]
    if entry then
      pcall(love.system.setClipboardText, formatForClipboard(entry))
      bsodCopied = true
      bsodCopiedTimer = 2.0
    end
    return
  end

  -- R: hard reboot (only when not editing)
  if key == "r" then
    if bsodEditor and bsodEditor.isActive() then return end  -- 'r' is a letter, don't reboot while typing
    -- Snapshot hot state then restart the Love2D process entirely.
    -- HMR reload is too fragile from crash recovery — just restart.
    pcall(function()
      local hs = require("lua.hotstate")
      if hs and hs.snapshot then hs.snapshot("state_preset.json") end
    end)
    love.event.quit("restart")
    return
  end

  -- Escape: quit (or deactivate cursor in editor)
  if key == "escape" then
    love.event.quit()
    return
  end

  -- Tab: cycle through errors
  if key == "tab" then
    if #buffer > 1 then
      currentIndex = currentIndex % #buffer + 1
      scrollOffset = 0
      -- Reinitialize editor for the new error
      if bsodEditor then
        local entry = buffer[currentIndex]
        if entry then
          pcall(bsodEditor.init, entry.message, entry.stack)
        end
      end
    end
    return
  end
end

--- Handle text input in BSOD mode (character insertion for editor).
function Errors.textinput(text)
  if bsodEditor and bsodEditor.isActive() then
    bsodEditor.textinput(text)
  end
end

--- Handle mouse press in BSOD mode (click buttons or place cursor in editor).
function Errors.bsodMousepressed(x, y, button)
  if button ~= 1 then return false end

  -- Check clickable buttons first
  local function hitRect(r)
    return x >= r.x and x <= r.x + r.w and y >= r.y and y <= r.y + r.h and r.w > 0
  end

  if hitRect(bsodButtons.reboot) then
    pcall(function()
      local hs = require("lua.hotstate")
      if hs and hs.snapshot then hs.snapshot("state_preset.json") end
    end)
    love.event.quit("restart")
    return true
  end

  if hitRect(bsodButtons.copy) then
    local entry = buffer[currentIndex]
    if entry then
      pcall(love.system.setClipboardText, formatForClipboard(entry))
      bsodCopied = true
      bsodCopiedTimer = 2.0
    end
    return true
  end

  if hitRect(bsodButtons.quit) then
    love.event.quit()
    return true
  end

  -- Editor gets remaining clicks
  if bsodEditor and bsodEditor.isActive() then
    if bsodEditor.mousepressed(x, y, button) then
      return true
    end
  end
  return false
end

--- Handle mouse wheel in BSOD mode (scroll).
function Errors.wheelmoved(x, y)
  -- Let editor handle scroll if active
  if bsodEditor and bsodEditor.isActive() then
    bsodEditor.wheelmoved(x, y)
    return
  end

  if y > 0 then
    scrollOffset = math.max(0, scrollOffset - 60)
  elseif y < 0 then
    scrollOffset = scrollOffset + 60
  end
end

-- ============================================================================
-- Normal overlay mode (non-fatal errors, bottom panel)
-- ============================================================================

--- Draw the error overlay on top of everything.
--- Call at the end of love.draw().
function Errors.draw()
  if not visible or currentIndex < 1 or currentIndex > #buffer then
    return
  end

  local ok, drawErr = pcall(function()
    local entry = buffer[currentIndex]
    if not entry then return end

    local fonts = getFonts()
    local screenW = love.graphics.getWidth()
    local screenH = love.graphics.getHeight()
    local overlayH = math.max(MIN_OVERLAY_HEIGHT, math.floor(screenH * OVERLAY_HEIGHT_FRAC))
    local overlayY = screenH - overlayH
    local pad = 16

    -- Shadow behind overlay
    love.graphics.setColor(SHADOW_COLOR)
    love.graphics.rectangle("fill", 0, overlayY - 4, screenW, overlayH + 4)

    -- Background
    love.graphics.setColor(BG_COLOR)
    love.graphics.rectangle("fill", 0, overlayY, screenW, overlayH)

    -- Header: "ERROR  --  context"
    love.graphics.setFont(fonts.title14)
    love.graphics.setColor(TEXT_COLOR)

    local header = "ERROR"
    if entry.context and entry.context ~= "" then
      header = header .. "  --  " .. entry.context
    end
    love.graphics.print(header, pad, overlayY + pad)

    -- Error message
    love.graphics.setFont(fonts.body)
    love.graphics.setColor(TEXT_COLOR)

    local msgPrefix = entry.source ~= "unknown" and (entry.source .. ": ") or ""
    love.graphics.print(msgPrefix .. entry.message, pad, overlayY + pad + 24)

    -- Stack trace
    if entry.stack and entry.stack ~= "" then
      love.graphics.setFont(fonts.small)
      love.graphics.setColor(SECONDARY)

      local sy = overlayY + pad + 50
      local lineCount = 0
      for line in entry.stack:gmatch("[^\n]+") do
        if lineCount >= MAX_STACK_LINES then break end
        if sy + 14 > screenH - pad then break end
        love.graphics.print("  " .. line, pad, sy)
        sy = sy + 14
        lineCount = lineCount + 1
      end
    end

    -- Counter (if multiple errors)
    if #buffer > 1 then
      love.graphics.setColor(DIM_COLOR)
      local counter = currentIndex .. "/" .. #buffer
      love.graphics.print(counter, screenW - pad - 60, overlayY + pad)
    end

    -- Footer
    love.graphics.setColor(DIM_COLOR)
    love.graphics.print("click to dismiss", pad, screenH - pad - 14)
  end)
end

--- Handle mouse press for dismissing the overlay.
--- Call from love.mousepressed(x, y, button).
--- Returns true if the click was consumed by the overlay.
function Errors.mousepressed(x, y, button)
  if not visible or currentIndex < 1 then
    return false
  end

  local screenH = love.graphics.getHeight()
  local overlayH = math.max(MIN_OVERLAY_HEIGHT, math.floor(screenH * OVERLAY_HEIGHT_FRAC))
  local overlayY = screenH - overlayH

  -- Check if click is within the overlay
  if y >= overlayY then
    -- Check copy button first
    if x >= copyBtnRect.x and x <= copyBtnRect.x + copyBtnRect.w
       and y >= copyBtnRect.y and y <= copyBtnRect.y + copyBtnRect.h then
      local entry = buffer[currentIndex]
      if entry then
        love.system.setClipboardText(formatForClipboard(entry))
        copiedFlashUntil = love.timer.getTime() + 1.5
      end
      return true  -- consumed
    end

    -- Cycle through errors if there are multiple, or dismiss if on last one
    if currentIndex < #buffer then
      currentIndex = currentIndex + 1
    else
      visible = false
      currentIndex = 0
    end
    return true  -- consumed
  end

  return false
end

--- Get the current error count.
function Errors.count()
  return #buffer
end

--- Check if the overlay is currently visible.
function Errors.isVisible()
  return visible
end

--- Clear all errors and hide the overlay.
function Errors.clear()
  buffer = {}
  currentIndex = 0
  visible = false
  scrollOffset = 0
  bsodCopied = false
  if bsodEditor then pcall(bsodEditor.reset) end
end

return Errors
