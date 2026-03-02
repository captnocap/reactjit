--[[
  bsod.lua — Custom Love2D error handler (ReactJIT BSOD)

  Replaces Love2D's default blue error screen with a dark, branded
  crash screen that shows the full error, traceback, event trail,
  and an inline code editor for fixing the crash right here.

  This is the LAST RESORT — it only fires if an error escapes both:
    1. ReactJIT.safeCall() pcall wrappers (Layer 1)
    2. ReactJIT.update()/draw() internal pcalls

  Features:
    - Full error message + traceback
    - Inline code editor: click to edit the crash site, Ctrl+S to save+reload
    - Event trail (last 30 events before crash)
    - Copy to clipboard (Ctrl+C)
    - Reboot from last working state (R key)
    - Auto-reboot when code changes (HMR polling)
    - Quit (Escape)

  Usage (in main.lua):
    local bsod = require("lua.bsod")
    love.errorhandler = bsod
]]

-- Try to load dependencies — they may not be available if the crash
-- happened very early (before require paths are set up).
local trailOk, eventTrail = pcall(require, "lua.event_trail")
local hotstateOk, hotstate = pcall(require, "lua.hotstate")
local editorOk, bsodEditor = pcall(require, "lua.bsod_editor")

--- Safely create a monospace-ish font for the inline editor.
--- Some Love2D builds throw if "monospace" isn't a real font file.
local function getEditorFont(size)
  local okMono, mono = pcall(love.graphics.newFont, "monospace", size)
  if okMono and mono then return mono end

  local okFallback, fallback = pcall(love.graphics.newFont, size)
  if okFallback and fallback then return fallback end

  return love.graphics.getFont()
end

--- Format the full crash report for clipboard.
local function formatCrashReport(msg, trailText)
  local parts = {}
  parts[#parts + 1] = "REACTJIT CRASH REPORT"
  parts[#parts + 1] = string.rep("=", 60)
  parts[#parts + 1] = ""
  parts[#parts + 1] = "Time: " .. os.date("%Y-%m-%d %H:%M:%S")
  parts[#parts + 1] = ""
  parts[#parts + 1] = "ERROR + TRACEBACK"
  parts[#parts + 1] = string.rep("-", 60)
  parts[#parts + 1] = tostring(msg)
  parts[#parts + 1] = ""

  if trailText and #trailText > 0 then
    parts[#parts + 1] = ""
    parts[#parts + 1] = trailText
  end

  return table.concat(parts, "\n")
end

--- The error handler function. Assigned to love.errorhandler.
--- @param msg string  The error message (includes traceback from Love2D)
return function(msg)
  msg = tostring(msg)

  -- Freeze the event trail so it shows what led to the crash
  if trailOk and eventTrail then
    pcall(eventTrail.freeze)
  end

  -- Attempt to get the event trail text
  local trailText = ""
  if trailOk and eventTrail then
    local ok, text = pcall(eventTrail.format, 30)
    if ok then trailText = text end
  end

  -- Build the full crash report for clipboard
  local crashReport = formatCrashReport(msg, trailText)

  -- Print to terminal
  pcall(function()
    io.write("\n" .. crashReport .. "\n")
    io.flush()
  end)

  -- Initialize inline code editor
  local editorActive = false
  if editorOk and bsodEditor then
    -- The msg from love.errorhandler includes the traceback appended by Love2D.
    -- The first line is the error, the rest is the traceback.
    local errorLine = msg:match("^([^\n]+)")
    pcall(bsodEditor.init, errorLine or msg, msg)
    editorActive = bsodEditor.isActive()
  end

  -- State for the error screen
  local copied = false
  local copiedTimer = 0
  local hmrFrameCount = 0
  local spinnerChars = { "|", "/", "-", "\\" }
  local spinnerIdx = 1
  local spinnerTimer = 0

  -- Try to detect bundle path for HMR polling
  local bundlePath = nil
  local bundleMtime = nil
  pcall(function()
    -- Check common bundle paths
    for _, path in ipairs({ "bundle.js", "love/bundle.js" }) do
      local info = love.filesystem.getInfo(path)
      if info then
        bundlePath = path
        bundleMtime = info.modtime
        break
      end
    end
  end)

  -- Parse the traceback into lines for display
  local traceLines = {}
  for line in msg:gmatch("[^\n]+") do
    traceLines[#traceLines + 1] = line
  end

  -- Parse trail events for display
  local trailEvents = {}
  if trailOk and eventTrail then
    local ok, trail = pcall(eventTrail.getTrail)
    if ok and trail then
      -- Show last 20, most recent first
      local start = math.max(1, #trail - 19)
      for i = #trail, start, -1 do
        local e = trail[i]
        local timeStr = string.format("%.3fs", e.time)
        local argsPart = e.args ~= "" and ("  " .. e.args) or ""
        trailEvents[#trailEvents + 1] = timeStr .. "  " .. e.type .. argsPart
      end
    end
  end

  -- Colors
  local BG        = { 0.06, 0.04, 0.08 }
  local ACCENT    = { 0.85, 0.20, 0.25 }
  local TEXT       = { 0.92, 0.90, 0.88 }
  local DIM        = { 0.55, 0.52, 0.50 }
  local TRACE      = { 0.75, 0.55, 0.50 }
  local TRAIL_COL  = { 0.50, 0.60, 0.75 }
  local GREEN      = { 0.30, 0.80, 0.40 }
  local COPIED_COL = { 0.40, 0.85, 0.50 }
  local BAR_BG     = { 0.08, 0.06, 0.10 }

  -- Reboot helper
  local function doReboot()
    if hotstateOk and hotstate and hotstate.snapshot then
      pcall(hotstate.snapshot, "state_preset.json")
    end
    love.event.quit("restart")
  end

  -- Custom run loop
  return function()
    -- An error may occur while drawing to a canvas; force-reset graphics state
    -- so the BSOD loop itself can pump/present without Love2D fataling.
    pcall(function()
      love.graphics.setCanvas()
      love.graphics.setScissor()
      love.graphics.setStencilTest()
      love.graphics.setBlendMode("alpha")
    end)

    -- Process events
    love.event.pump()
    for name, a, b, c, d, e, f in love.event.poll() do
      if name == "quit" then
        return 1

      elseif name == "mousepressed" then
        -- Route to editor
        if editorActive then
          pcall(bsodEditor.mousepressed, a, b, c)
        end

      elseif name == "wheelmoved" then
        -- Route to editor
        if editorActive then
          pcall(bsodEditor.wheelmoved, a, b)
        end

      elseif name == "textinput" then
        -- Route to editor
        if editorActive then
          pcall(bsodEditor.textinput, a)
        end

      elseif name == "keypressed" then
        local ctrl = love.keyboard.isDown("lctrl", "rctrl")

        -- Global shortcuts — always work, never swallowed by editor
        if a == "c" and ctrl then
          pcall(love.system.setClipboardText, crashReport)
          copied = true
          copiedTimer = 2.0
        elseif a == "s" and ctrl and editorActive then
          local sok, saved = pcall(bsodEditor.save)
          if sok and saved then
            doReboot()
            return
          end
        elseif a == "escape" then
          return 1
        elseif a == "r" then
          -- Block R only when cursor is placed in editor (user is typing)
          local editorTyping = editorActive and bsodEditor.getCursorLine and bsodEditor.getCursorLine() > 0
          if not editorTyping then
            doReboot()
            return
          end
        end

        -- Non-global keys route to editor (arrow keys, typing, etc.)
        if editorActive then
          pcall(bsodEditor.keypressed, a)
        end
      end
    end

    -- HMR polling: check for bundle changes
    hmrFrameCount = hmrFrameCount + 1
    if bundlePath and hmrFrameCount % 60 == 0 then
      pcall(function()
        local info = love.filesystem.getInfo(bundlePath)
        if info and info.modtime and bundleMtime and info.modtime ~= bundleMtime then
          doReboot()
        end
      end)
    end

    -- Timing
    local dt = love.timer.step()
    if copied then
      copiedTimer = copiedTimer - dt
      if copiedTimer <= 0 then copied = false end
    end
    spinnerTimer = spinnerTimer + dt
    if spinnerTimer >= 0.15 then
      spinnerTimer = 0
      spinnerIdx = (spinnerIdx % #spinnerChars) + 1
    end

    -- Draw
    if not love.graphics.isActive() then
      love.timer.sleep(0.1)
      return
    end

    love.graphics.origin()
    love.graphics.clear(BG[1], BG[2], BG[3])

    local W = love.graphics.getWidth()
    local H = love.graphics.getHeight()
    local pad = 24
    local y = pad
    local barH = 44

    -- Accent bar at top
    love.graphics.setColor(ACCENT)
    love.graphics.rectangle("fill", 0, 0, W, 4)
    y = y + 4

    -- Title
    local titleFont = love.graphics.newFont(18)
    love.graphics.setFont(titleFont)
    love.graphics.setColor(ACCENT)
    love.graphics.print("ReactJIT crashed", pad, y)
    y = y + 28

    -- Timestamp
    local smallFont = love.graphics.newFont(11)
    love.graphics.setFont(smallFont)
    love.graphics.setColor(DIM)
    love.graphics.print(os.date("%Y-%m-%d %H:%M:%S"), pad, y)
    y = y + 16

    -- Error message (compact — first line only)
    local bodyFont = love.graphics.newFont(12)
    love.graphics.setFont(bodyFont)
    love.graphics.setColor(TEXT)
    local errorLine = traceLines[1] or msg
    if #errorLine > 120 then errorLine = errorLine:sub(1, 117) .. "..." end
    love.graphics.print(errorLine, pad, y)
    y = y + 18

    -- ================================================================
    -- CODE EDITOR SECTION
    -- ================================================================
    if editorActive then
      local editorFont = getEditorFont(12)
      local editorH = math.floor((H - y - barH - 8) * 0.55)
      editorH = math.max(editorH, 120)

      bsodEditor.draw(pad, y, W - pad * 2, editorH, editorFont)
      y = y + editorH + 8
    end

    -- ================================================================
    -- TRACEBACK (below editor, remaining space)
    -- ================================================================
    love.graphics.setColor(ACCENT[1], ACCENT[2], ACCENT[3], 0.3)
    love.graphics.rectangle("fill", pad, y, W - pad * 2, 1)
    y = y + 8

    love.graphics.setFont(smallFont)
    local maxTraceY = H - barH - 8

    -- Skip first line (already shown above) for traceback
    for idx = 2, #traceLines do
      if y > maxTraceY then
        love.graphics.setColor(DIM)
        love.graphics.print("  ... " .. (#traceLines - idx + 1) .. " more (Ctrl+C to copy all)", pad, y)
        break
      end
      love.graphics.setColor(TRACE)
      love.graphics.print("  " .. traceLines[idx], pad, y)
      y = y + 14
    end

    -- Event trail (if there's still room)
    if #trailEvents > 0 and y < maxTraceY - 30 then
      y = y + 4
      love.graphics.setColor(DIM)
      love.graphics.print("EVENT TRAIL", pad, y)
      y = y + 14

      love.graphics.setFont(bodyFont)
      for _, line in ipairs(trailEvents) do
        if y > maxTraceY then break end
        love.graphics.setColor(TRAIL_COL)
        love.graphics.print("  " .. line, pad, y)
        y = y + 14
      end
    end

    -- Bottom controls bar
    local barY = H - barH
    love.graphics.setColor(BAR_BG[1], BAR_BG[2], BAR_BG[3])
    love.graphics.rectangle("fill", 0, barY, W, barH)
    love.graphics.setColor(ACCENT[1], ACCENT[2], ACCENT[3], 0.3)
    love.graphics.rectangle("fill", 0, barY, W, 1)

    love.graphics.setFont(smallFont)

    -- HMR watcher status
    local watcherText
    if bundlePath then
      watcherText = spinnerChars[spinnerIdx] .. " Watching for code changes..."
      love.graphics.setColor(GREEN)
    else
      watcherText = "No bundle detected"
      love.graphics.setColor(DIM)
    end
    love.graphics.print(watcherText, pad, barY + 14)

    -- Key hints (right side)
    local hints
    if copied then
      hints = "Copied to clipboard!"
      love.graphics.setColor(COPIED_COL)
    elseif editorActive then
      hints = "Ctrl+S  save+reload   |   R  reboot   |   Ctrl+C  copy   |   Esc  quit"
      love.graphics.setColor(DIM)
    else
      hints = "R  reboot   |   Ctrl+C  copy   |   Esc  quit"
      love.graphics.setColor(DIM)
    end
    local hintsW = smallFont:getWidth(hints)
    love.graphics.print(hints, W - pad - hintsW, barY + 14)

    love.graphics.present()
    love.timer.sleep(0.016) -- ~60fps cap
  end
end
