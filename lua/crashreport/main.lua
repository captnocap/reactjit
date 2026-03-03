--[[
  Crash Report Viewer — standalone Love2D process.

  Reads crash data from /tmp/reactjit_crash.lua (written by the main process
  or the watchdog before the process dies). Displays error, event trail, memory,
  subsystem snapshot, and /proc diagnostics.

  R key or click "Reboot" to relaunch the original app and close this window.
  Esc to close. Ctrl+C to copy report to clipboard.
]]

local crashData = nil
local snapshot = nil  -- Lua-side subsystem snapshot (from panic_snapshot.lua)
local scrollY = 0
local maxScrollY = 0
local font = nil
local fontSmall = nil
local fontMono = nil
local fontLabel = nil
local copyFeedback = 0
local rebootBtn = { x = 0, y = 0, w = 0, h = 0 }
local hoveringReboot = false

-- Cross-platform temp dir
local tmpDir = os.getenv("TMPDIR") or os.getenv("TEMP") or os.getenv("TMP") or "/tmp"

function love.load()
    font = love.graphics.newFont(16)
    fontSmall = love.graphics.newFont(13)
    fontMono = love.graphics.newFont(love.graphics.getFont():getHeight())
    fontLabel = love.graphics.newFont(11)

    local monoOk, monoFont = pcall(love.graphics.newFont, "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    if monoOk then fontMono = monoFont end

    local monoSmallOk, monoSmall = pcall(love.graphics.newFont, "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    if monoSmallOk then fontLabel = monoSmall end

    -- Read crash data — it's a Lua table literal
    local f = io.open(tmpDir .. "/reactjit_crash.lua", "r")
    if f then
        local raw = f:read("*a")
        f:close()
        local fn = load(raw)
        if fn then
            local ok, result = pcall(fn)
            if ok then crashData = result end
        end
    end

    if not crashData then
        crashData = {
            error = "Could not read crash data from " .. tmpDir .. "/reactjit_crash.lua",
            context = "unknown",
            trail = "",
            timestamp = os.date("%Y-%m-%d %H:%M:%S"),
        }
    end

    -- Read Lua-side subsystem snapshot if available
    if crashData.hasLuaSnapshot then
        local sf = io.open(tmpDir .. "/reactjit_snapshot.lua", "r")
        if sf then
            local raw = sf:read("*a")
            sf:close()
            local fn = load(raw)
            if fn then
                local ok, result = pcall(fn)
                if ok then snapshot = result end
            end
        end
    end

    -- Read crisis analysis directly (flight recorder writes this via FFI syscalls).
    -- This is independent of the crash file — the flight recorder always has the
    -- latest data on disk, even if the watchdog couldn't merge it.
    if not crashData.crisisAnalysis or crashData.crisisAnalysis == "" then
        local cf = io.open(tmpDir .. "/reactjit_crisis.lua", "r")
        if cf then
            local raw = cf:read("*a")
            cf:close()
            local fn = load(raw)
            if fn then
                local ok, result = pcall(fn)
                if ok and result and result.crisisAnalysis then
                    crashData.crisisAnalysis = result.crisisAnalysis
                end
            end
        end
    end
end

local function drawWrappedText(text, x, y, maxW, f)
    love.graphics.setFont(f)
    local _, lines = f:getWrap(text, maxW)
    for i, line in ipairs(lines) do
        love.graphics.print(line, x, y + (i - 1) * f:getHeight())
    end
    return #lines * f:getHeight()
end

--- Draw a section header.
local function drawSectionHeader(text, x, y, W)
    love.graphics.setFont(fontSmall)
    love.graphics.setColor(0.6, 0.6, 0.7)
    love.graphics.print(text, x, y)
    y = y + fontSmall:getHeight() + 2
    love.graphics.setColor(0.2, 0.2, 0.25)
    love.graphics.line(x, y, W - x, y)
    return y + 6
end

--- Draw a key-value row. Returns new y.
local function drawKV(key, value, x, y, colW)
    love.graphics.setFont(fontLabel)
    love.graphics.setColor(0.5, 0.5, 0.6)
    love.graphics.print(key, x, y)
    love.graphics.setColor(0.9, 0.9, 0.9)
    love.graphics.print(tostring(value), x + colW, y)
    return y + fontLabel:getHeight() + 2
end

--- Format bytes as human-readable.
local function formatKB(kb)
    if not kb then return "?" end
    if kb >= 1048576 then return string.format("%.1f GB", kb / 1048576) end
    if kb >= 1024 then return string.format("%.1f MB", kb / 1024) end
    return string.format("%d KB", kb)
end

local function reboot()
    if crashData.rebootCmd and crashData.rebootCmd ~= "" then
        local cmd = crashData.rebootCmd
        if crashData.rebootCwd and crashData.rebootCwd ~= "" then
            cmd = string.format("cd %q && %s", crashData.rebootCwd, cmd)
        end
        os.execute(cmd .. " &")
        love.event.quit()
    end
end

function love.draw()
    local W, H = love.graphics.getDimensions()
    local pad = 24
    local contentW = W - pad * 2

    love.graphics.clear(0.08, 0.08, 0.10)

    love.graphics.push()
    love.graphics.translate(0, -scrollY)

    local y = pad

    -- Title
    love.graphics.setFont(font)
    love.graphics.setColor(1, 0.3, 0.3)
    love.graphics.print("Process Crashed", pad, y)
    y = y + font:getHeight() + 8

    -- Timestamp
    love.graphics.setFont(fontSmall)
    love.graphics.setColor(0.5, 0.5, 0.5)
    love.graphics.print(crashData.timestamp or "", pad, y)
    y = y + fontSmall:getHeight() + 16

    -- Context
    love.graphics.setColor(0.6, 0.6, 0.7)
    love.graphics.print("Context: " .. (crashData.context or "unknown"), pad, y)
    y = y + fontSmall:getHeight() + 12

    -- Error message
    love.graphics.setColor(1, 0.85, 0.85)
    local errH = drawWrappedText(crashData.error or "unknown error", pad, y, contentW, fontMono)
    y = y + errH + 20

    -- Separator
    love.graphics.setColor(0.25, 0.25, 0.3)
    love.graphics.line(pad, y, W - pad, y)
    y = y + 12

    -- ================================================================
    -- Crisis Analysis: WHO is leaking
    -- ================================================================
    if crashData.crisisAnalysis and crashData.crisisAnalysis ~= "" then
        y = drawSectionHeader("Crisis Analysis (command buffer breakdown)", pad, y, W)

        -- Parse and render with color coding
        for line in crashData.crisisAnalysis:gmatch("[^\n]+") do
            if line:match("^%-%-%-") then
                -- Section header within analysis
                love.graphics.setFont(fontSmall)
                love.graphics.setColor(0.6, 0.8, 1.0)
                love.graphics.print(line, pad + 8, y)
                y = y + fontSmall:getHeight() + 2
            elseif line:match("^LEAK CONFIRMED") then
                -- Leak confirmation — bright red
                love.graphics.setFont(fontMono)
                love.graphics.setColor(1, 0.2, 0.2)
                love.graphics.print(line, pad + 8, y)
                y = y + fontMono:getHeight() + 2
            elseif line:match("^Create/Remove") then
                -- Ratio line — orange warning
                love.graphics.setFont(fontMono)
                love.graphics.setColor(1, 0.7, 0.3)
                love.graphics.print(line, pad + 8, y)
                y = y + fontMono:getHeight() + 2
            elseif line ~= "" then
                -- Data row
                love.graphics.setFont(fontMono)
                love.graphics.setColor(0.9, 0.9, 0.9)
                love.graphics.print(line, pad + 8, y)
                y = y + fontMono:getHeight() + 1
            else
                y = y + 4
            end
        end
        y = y + 12
    end

    -- ================================================================
    -- Panic Snapshot: Subsystem Counters
    -- ================================================================
    if snapshot then
        y = drawSectionHeader("Subsystem Snapshot", pad, y, W)
        local col1 = pad + 8
        local kvW = 160

        -- Memory
        y = drawKV("Lua heap", formatKB(snapshot.luaMemKB), col1, y, kvW)
        if snapshot.rssKB then
            y = drawKV("RSS", formatKB(snapshot.rssKB), col1, y, kvW)
        end
        if snapshot.textureMem then
            y = drawKV("GPU textures", formatKB(snapshot.textureMem), col1, y, kvW)
        end
        y = y + 4

        -- Tree & rendering
        if snapshot.nodes then y = drawKV("Tree nodes", snapshot.nodes, col1, y, kvW) end
        if snapshot.handlers then y = drawKV("Event handlers", snapshot.handlers, col1, y, kvW) end
        if snapshot.drawCalls then y = drawKV("Draw calls", snapshot.drawCalls, col1, y, kvW) end
        if snapshot.canvases then y = drawKV("Canvases", snapshot.canvases, col1, y, kvW) end
        if snapshot.fonts then y = drawKV("Fonts", snapshot.fonts, col1, y, kvW) end
        y = y + 4

        -- Subsystems
        if snapshot.images then y = drawKV("Images loaded", snapshot.images, col1, y, kvW) end
        if snapshot.videos then y = drawKV("Videos loaded", snapshot.videos, col1, y, kvW) end
        if snapshot.scenes3d then y = drawKV("3D scenes", snapshot.scenes3d, col1, y, kvW) end
        if snapshot.animations then y = drawKV("Active animations", snapshot.animations, col1, y, kvW) end
        if snapshot.capabilityTypes then y = drawKV("Capability types", snapshot.capabilityTypes, col1, y, kvW) end
        if snapshot.capabilityInstances then y = drawKV("Capability instances", snapshot.capabilityInstances, col1, y, kvW) end
        if snapshot.windows then y = drawKV("Windows", snapshot.windows, col1, y, kvW) end
        if snapshot.hotstateAtoms then y = drawKV("HotState atoms", snapshot.hotstateAtoms, col1, y, kvW) end
        if snapshot.errors then y = drawKV("Errors", snapshot.errors, col1, y, kvW) end
        y = y + 4

        -- System
        if snapshot.threads then y = drawKV("Threads", snapshot.threads, col1, y, kvW) end
        if snapshot.fds then y = drawKV("File descriptors", snapshot.fds, col1, y, kvW) end

        y = y + 12
    end

    -- ================================================================
    -- Panic Deltas (memory growth during panic mode)
    -- ================================================================
    if crashData.panicDeltas and crashData.panicDeltas ~= "" then
        y = drawSectionHeader("Memory Growth (panic mode sampling)", pad, y, W)
        love.graphics.setColor(1, 0.7, 0.4)
        local deltaH = drawWrappedText(crashData.panicDeltas, pad + 8, y, contentW - 8, fontMono)
        y = y + deltaH + 12
    end

    -- ================================================================
    -- /proc Diagnostics
    -- ================================================================
    if crashData.procSnapshot and crashData.procSnapshot ~= "" then
        y = drawSectionHeader("Process Diagnostics (at spike #2)", pad, y, W)
        love.graphics.setColor(0.8, 0.8, 0.8)
        -- Parse key=value lines
        for line in crashData.procSnapshot:gmatch("[^\n]+") do
            local k, v = line:match("^(%S+)=(.+)$")
            if k and v then
                y = drawKV(k, v, pad + 8, y, 200)
            end
        end
        y = y + 8
    end

    if crashData.procFinal and crashData.procFinal ~= "" then
        y = drawSectionHeader("Process Diagnostics (at kill)", pad, y, W)
        love.graphics.setColor(0.8, 0.8, 0.8)
        for line in crashData.procFinal:gmatch("[^\n]+") do
            local k, v = line:match("^(%S+)=(.+)$")
            if k and v then
                y = drawKV(k, v, pad + 8, y, 200)
            end
        end
        y = y + 8
    end

    -- ================================================================
    -- Event trail
    -- ================================================================
    if crashData.trail and crashData.trail ~= "" then
        y = drawSectionHeader("Event Trail (last actions before crash)", pad, y, W)
        love.graphics.setColor(0.8, 0.8, 0.8)
        local trailH = drawWrappedText(crashData.trail, pad + 8, y, contentW - 8, fontMono)
        y = y + trailH + 20
    end

    -- ================================================================
    -- Memory info (legacy fields)
    -- ================================================================
    if (crashData.luaMemMB or crashData.rssMB) and not snapshot then
        y = drawSectionHeader("Memory at crash", pad, y, W)
        love.graphics.setColor(0.8, 0.8, 0.8)
        love.graphics.setFont(fontMono)
        local mem = ""
        if crashData.luaMemMB then mem = mem .. string.format("Lua: %.1f MB", crashData.luaMemMB) end
        if crashData.rssMB then mem = mem .. string.format("   RSS: %d MB", crashData.rssMB) end
        love.graphics.print(mem, pad + 8, y)
        y = y + fontMono:getHeight() + 20
    end

    -- Node info (legacy)
    if crashData.node then
        love.graphics.setFont(fontSmall)
        love.graphics.setColor(0.6, 0.6, 0.7)
        love.graphics.print("Last Node:", pad, y)
        y = y + fontSmall:getHeight() + 4
        love.graphics.setColor(0.8, 0.8, 0.8)
        love.graphics.setFont(fontMono)
        love.graphics.print(crashData.node, pad + 12, y)
        y = y + fontMono:getHeight() + 20
    end

    -- Track total content height for scrolling
    maxScrollY = math.max(0, y + pad - H + 48)

    love.graphics.pop()

    -- Bottom bar (fixed)
    love.graphics.setColor(0.12, 0.12, 0.15)
    love.graphics.rectangle("fill", 0, H - 48, W, 48)

    -- Reboot button
    local canReboot = crashData.rebootCmd and crashData.rebootCmd ~= ""
    if canReboot then
        local btnW, btnH = 90, 30
        local btnX = W - pad - btnW
        local btnY = H - 39
        rebootBtn = { x = btnX, y = btnY, w = btnW, h = btnH }

        if hoveringReboot then
            love.graphics.setColor(0.25, 0.55, 1.0)
        else
            love.graphics.setColor(0.2, 0.45, 0.9)
        end
        love.graphics.rectangle("fill", btnX, btnY, btnW, btnH, 4, 4)
        love.graphics.setFont(fontSmall)
        love.graphics.setColor(1, 1, 1)
        local textW = fontSmall:getWidth("Reboot")
        love.graphics.print("Reboot", btnX + (btnW - textW) / 2, btnY + 8)
    end

    -- Help text
    love.graphics.setFont(fontSmall)
    love.graphics.setColor(0.5, 0.5, 0.6)
    local help = "Esc close    Ctrl+C copy"
    if canReboot then help = help .. "    R reboot" end
    love.graphics.print(help, pad, H - 34)

    -- Copy feedback
    if copyFeedback > 0 then
        love.graphics.setColor(0.3, 1, 0.3)
        local feedX = canReboot and (W - pad - 90 - 80) or (W - pad - 60)
        love.graphics.print("Copied!", feedX, H - 34)
    end

    -- Scroll indicator
    if maxScrollY > 0 then
        local barH = math.max(20, H * (H / (maxScrollY + H)))
        local barY = (scrollY / maxScrollY) * (H - 48 - barH)
        love.graphics.setColor(0.3, 0.3, 0.35, 0.6)
        love.graphics.rectangle("fill", W - 6, barY, 4, barH, 2, 2)
    end
end

function love.update(dt)
    if copyFeedback > 0 then copyFeedback = copyFeedback - dt end

    local mx, my = love.mouse.getPosition()
    hoveringReboot = mx >= rebootBtn.x and mx <= rebootBtn.x + rebootBtn.w
        and my >= rebootBtn.y and my <= rebootBtn.y + rebootBtn.h
end

function love.wheelmoved(x, y)
    scrollY = math.max(0, math.min(maxScrollY, scrollY - y * 40))
end

function love.mousepressed(x, y, button)
    if button == 1 and hoveringReboot then
        reboot()
    end
end

function love.keypressed(key)
    if key == "escape" then
        love.event.quit()
    elseif key == "r" then
        reboot()
    elseif key == "c" and love.keyboard.isDown("lctrl", "rctrl") then
        -- Build comprehensive copy text
        local parts = {
            "ReactJIT Crash Report",
            crashData.timestamp or "",
            "",
            "Context: " .. (crashData.context or ""),
            "",
            "Error:",
            crashData.error or "",
        }

        -- Crisis analysis
        if crashData.crisisAnalysis and crashData.crisisAnalysis ~= "" then
            parts[#parts + 1] = ""
            parts[#parts + 1] = "=== CRISIS ANALYSIS ==="
            parts[#parts + 1] = crashData.crisisAnalysis
        end

        -- Snapshot data
        if snapshot then
            parts[#parts + 1] = ""
            parts[#parts + 1] = "--- Subsystem Snapshot ---"
            local fields = {
                { "Lua heap KB", "luaMemKB" },
                { "RSS KB", "rssKB" },
                { "Tree nodes", "nodes" },
                { "Event handlers", "handlers" },
                { "Images", "images" },
                { "Videos", "videos" },
                { "3D scenes", "scenes3d" },
                { "Animations", "animations" },
                { "Capability types", "capabilityTypes" },
                { "Capability instances", "capabilityInstances" },
                { "Windows", "windows" },
                { "HotState atoms", "hotstateAtoms" },
                { "Errors", "errors" },
                { "Draw calls", "drawCalls" },
                { "Canvases", "canvases" },
                { "Texture mem KB", "textureMem" },
                { "Fonts", "fonts" },
                { "Threads", "threads" },
                { "File descriptors", "fds" },
            }
            for _, kv in ipairs(fields) do
                if snapshot[kv[2]] then
                    parts[#parts + 1] = string.format("  %-22s %s", kv[1] .. ":", tostring(snapshot[kv[2]]))
                end
            end
        end

        -- Panic deltas
        if crashData.panicDeltas and crashData.panicDeltas ~= "" then
            parts[#parts + 1] = ""
            parts[#parts + 1] = "--- Memory Growth ---"
            parts[#parts + 1] = crashData.panicDeltas
        end

        -- /proc data
        if crashData.procSnapshot and crashData.procSnapshot ~= "" then
            parts[#parts + 1] = ""
            parts[#parts + 1] = "--- /proc at spike #2 ---"
            parts[#parts + 1] = crashData.procSnapshot
        end
        if crashData.procFinal and crashData.procFinal ~= "" then
            parts[#parts + 1] = ""
            parts[#parts + 1] = "--- /proc at kill ---"
            parts[#parts + 1] = crashData.procFinal
        end

        -- Trail
        if crashData.trail and crashData.trail ~= "" then
            parts[#parts + 1] = ""
            parts[#parts + 1] = "--- Event Trail ---"
            parts[#parts + 1] = crashData.trail
        end

        love.system.setClipboardText(table.concat(parts, "\n"))
        copyFeedback = 2
    end
end
