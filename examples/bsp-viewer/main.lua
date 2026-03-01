--
-- BSP Viewer + ReactJIT — hybrid main.lua
--
-- Demo: Camera starts at a saved "start" viewport showing the origin story
-- on a monitor. Scroll reads the article. Keep scrolling past the end and
-- the camera transitions to the "end" viewport, revealing cs_office.
--
-- Viewport setup:
--   [ = capture start viewport
--   ] = capture end viewport
--   \ = save viewports to file + enter preview
--   backspace = return to free mode to re-adjust
--

local g3d = require("lua.g3d")
local ReactJIT = require("lua.init")

love.errorhandler = require("lua.bsod")

local models = {}
local props  = {}
local screens = {}
local totalTris = 0
local moveSpeed = 3
local mapName = ""
local screenCanvas = nil
local SCREEN_W, SCREEN_H = 512, 384
local reactReady = false

-- -----------------------------------------------------------------------
-- Demo state machine: reading → pullback → free
-- -----------------------------------------------------------------------

local phase = "free"            -- "reading" | "pullback" | "free"
local scrollAccum = 0           -- total scroll wheel ticks
local SCROLL_THRESHOLD = 50     -- ticks before pullback starts
local PULLBACK_TICKS = 40       -- ticks for full pullback animation
local pullbackProgress = 0      -- 0..1

-- -----------------------------------------------------------------------
-- Viewport capture state
-- -----------------------------------------------------------------------

local viewports = nil           -- { start = {x,y,z,dir,pitch}, ["end"] = {...} }
local setupMsg = nil            -- HUD flash message
local setupMsgTimer = 0         -- seconds remaining for flash

-- -----------------------------------------------------------------------
-- OBJ loader
-- -----------------------------------------------------------------------

local function loadOBJByMaterial(filepath)
    local positions = {}
    local texcoords = {}
    local normals   = {}
    local groups    = {}
    local currentMat = "default"

    for line in love.filesystem.lines(filepath) do
        local cmd = line:match("^(%S+)")
        if not cmd or cmd == "#" or cmd == "mtllib" or cmd == "g" then
            -- skip
        elseif cmd == "v" then
            local x, y, z = line:match("v%s+([%d%.%-eE]+)%s+([%d%.%-eE]+)%s+([%d%.%-eE]+)")
            positions[#positions + 1] = { tonumber(x), tonumber(y), tonumber(z) }
        elseif cmd == "vt" then
            local u, v = line:match("vt%s+([%d%.%-eE]+)%s+([%d%.%-eE]+)")
            texcoords[#texcoords + 1] = { tonumber(u), tonumber(v) }
        elseif cmd == "vn" then
            local nx, ny, nz = line:match("vn%s+([%d%.%-eE]+)%s+([%d%.%-eE]+)%s+([%d%.%-eE]+)")
            normals[#normals + 1] = { tonumber(nx), tonumber(ny), tonumber(nz) }
        elseif cmd == "usemtl" then
            currentMat = line:match("usemtl%s+(%S+)")
        elseif cmd == "f" then
            if not groups[currentMat] then
                groups[currentMat] = { verts = {} }
            end
            local gv = groups[currentMat].verts
            for vi, vti, vni in line:gmatch("(%d+)/(%d+)/(%d+)") do
                local p  = positions[tonumber(vi)]
                local t  = texcoords[tonumber(vti)]
                local n  = normals[tonumber(vni)]
                if p and t and n then
                    gv[#gv + 1] = {
                        p[1] or 0, p[2] or 0, p[3] or 0,
                        t[1] or 0, 1 - (t[2] or 0),
                        n[1] or 0, n[2] or 0, n[3] or 0
                    }
                end
            end
        end
    end
    return groups
end

-- -----------------------------------------------------------------------
-- Texture helpers
-- -----------------------------------------------------------------------

local function makeColorTexture(name)
    local hash = 5381
    for i = 1, #name do
        hash = (hash * 33 + string.byte(name, i)) % 16777216
    end
    local r = math.floor(hash / 65536) / 255
    local gv = math.floor(hash / 256) % 256 / 255
    local b = (hash % 256) / 255
    if r + gv + b < 0.75 then
        r = math.min(r + 0.3, 1)
        gv = math.min(gv + 0.3, 1)
        b = math.min(b + 0.3, 1)
    end
    local data = love.image.newImageData(2, 2)
    data:mapPixel(function() return r, gv, b, 1 end)
    local img = love.graphics.newImage(data)
    img:setWrap("repeat", "repeat")
    return img
end

local function loadTexture(name)
    local texPath = "textures/" .. name .. ".png"
    if love.filesystem.getInfo(texPath) then
        local img = love.graphics.newImage(texPath)
        img:setWrap("repeat", "repeat")
        img:setFilter("nearest", "nearest")
        return img
    end
    return makeColorTexture(name)
end

-- -----------------------------------------------------------------------
-- Map file discovery
-- -----------------------------------------------------------------------

local function findMapFile()
    if not love.filesystem.getInfo("maps") then return nil end
    if arg then
        for i = 2, #arg do
            local try = "maps/" .. arg[i] .. ".obj"
            if love.filesystem.getInfo(try) then return try end
            if love.filesystem.getInfo(arg[i]) then return arg[i] end
        end
    end
    local items = love.filesystem.getDirectoryItems("maps")
    for _, item in ipairs(items) do
        if item:match("%.obj$") then return "maps/" .. item end
    end
    return nil
end

local function loadMapInfo(baseName)
    local infoPath = "maps/" .. baseName .. "_mapinfo.lua"
    if love.filesystem.getInfo(infoPath) then
        local chunk = love.filesystem.load(infoPath)
        if chunk then return chunk() end
    end
    return nil
end

-- -----------------------------------------------------------------------
-- Prop loading
-- -----------------------------------------------------------------------

local function loadPropOBJ(filepath, px, py, pz, scale, rx, ry, rz)
    local groups = loadOBJByMaterial(filepath)
    local propModels = {}

    for name, group in pairs(groups) do
        if #group.verts >= 3 then
            local tex = loadTexture(name)
            local mdl = g3d.newModel(group.verts, tex)
            mdl:setTranslation(px, py, pz)
            mdl:setScale(scale, scale, scale)
            if (rx and rx ~= 0) or (ry and ry ~= 0) or (rz and rz ~= 0) then
                mdl:setRotation(rx or 0, ry or 0, rz or 0)
            end
            local isScreen = name:match("screen") ~= nil
            propModels[#propModels + 1] = { model = mdl, name = name, isScreen = isScreen }
            totalTris = totalTris + #group.verts / 3

            if isScreen then
                screens[#screens + 1] = {
                    model = mdl,
                    x = px, y = py, z = pz,
                }
            end
        end
    end

    return propModels
end

local function loadProps()
    local propsFile = "maps/props.lua"
    if not love.filesystem.getInfo(propsFile) then return end
    local chunk = love.filesystem.load(propsFile)
    if not chunk then return end

    local placements = chunk()
    local loaded = 0
    local missing = 0
    for _, p in ipairs(placements) do
        local objPath = "maps/props/" .. p.model .. ".obj"
        if love.filesystem.getInfo(objPath) then
            local s = p.scale or 1
            local rx = math.rad(p.az or p.angle or 0)
            local ry = math.rad(-(p.ax or 0))
            local rz = math.rad(p.ay or 0)
            local propModels = loadPropOBJ(objPath, p.x, p.y, p.z, s, rx, ry, rz)
            props[#props + 1] = { models = propModels, name = p.model }
            loaded = loaded + 1
        else
            missing = missing + 1
        end
    end
    print(string.format("  Props: %d loaded, %d missing OBJ", loaded, missing))
end

-- -----------------------------------------------------------------------
-- Camera helpers
-- -----------------------------------------------------------------------

local function lerp(a, b, t)
    return a + (b - a) * t
end

local function lerpAngle(a, b, t)
    local diff = (b - a) % (2 * math.pi)
    if diff > math.pi then diff = diff - 2 * math.pi end
    return a + diff * t
end

local function smoothstep(t)
    t = math.max(0, math.min(1, t))
    return t * t * (3 - 2 * t)
end

-- -----------------------------------------------------------------------
-- Viewport capture / interpolation
-- -----------------------------------------------------------------------

local function captureViewport()
    local dir, pitch = g3d.camera.getDirectionPitch()
    return {
        x = g3d.camera.position[1],
        y = g3d.camera.position[2],
        z = g3d.camera.position[3],
        dir = dir,
        pitch = pitch,
    }
end

local function applyViewport(vp)
    g3d.camera.lookInDirection(vp.x, vp.y, vp.z, vp.dir, vp.pitch)
end

local function positionCameraBetweenViewports(progress)
    if not viewports or not viewports.start or not viewports["end"] then return end
    local t = smoothstep(progress)
    local s, e = viewports.start, viewports["end"]
    local x = lerp(s.x, e.x, t)
    local y = lerp(s.y, e.y, t)
    local z = lerp(s.z, e.z, t)
    local dir = lerpAngle(s.dir, e.dir, t)
    local pitch = lerp(s.pitch, e.pitch, t)
    g3d.camera.lookInDirection(x, y, z, dir, pitch)
end

local function formatViewport(vp)
    return string.format("{ x = %.4f, y = %.4f, z = %.4f, dir = %.4f, pitch = %.4f }",
        vp.x, vp.y, vp.z, vp.dir, vp.pitch)
end

local function saveViewports()
    if not viewports or not viewports.start or not viewports["end"] then return false end

    local content = "return {\n"
        .. "  start = " .. formatViewport(viewports.start) .. ",\n"
        .. "  [\"end\"] = " .. formatViewport(viewports["end"]) .. ",\n"
        .. "}\n"

    -- Write to the actual project directory (maps/ is a symlink)
    local sourcePath = love.filesystem.getSource()
    local filePath = sourcePath .. "/maps/viewports.lua"
    local f = io.open(filePath, "w")
    if f then
        f:write(content)
        f:close()
        print("Viewports saved to " .. filePath)
        return true
    else
        print("ERROR: Could not write to " .. filePath)
        return false
    end
end

local function loadViewports()
    local vpPath = "maps/viewports.lua"
    if love.filesystem.getInfo(vpPath) then
        local chunk = love.filesystem.load(vpPath)
        if chunk then
            local vp = chunk()
            if vp and vp.start and vp["end"] then
                return vp
            end
        end
    end
    return nil
end

local function flashMsg(msg)
    setupMsg = msg
    setupMsgTimer = 3
    print(msg)
end

-- -----------------------------------------------------------------------
-- Love callbacks
-- -----------------------------------------------------------------------

function love.load()
    -- Init ReactJIT
    ReactJIT.init({
        mode = "native",
        bundlePath = "love/bundle.js",
        libpath = "lib/libquickjs",
    })
    reactReady = true

    -- Load BSP map
    local mapFile = findMapFile()
    if not mapFile then return end

    mapName = mapFile:match("maps/(.+)%.obj$") or "unknown"

    print("Loading " .. mapFile .. "...")
    local groups = loadOBJByMaterial(mapFile)

    for name, group in pairs(groups) do
        if #group.verts >= 3 then
            local tex = loadTexture(name)
            local mdl = g3d.newModel(group.verts, tex)
            models[#models + 1] = { model = mdl, name = name, tris = #group.verts / 3 }
            totalTris = totalTris + #group.verts / 3
        end
    end

    print(string.format("Loaded %d material groups, %d triangles", #models, totalTris))

    -- Load props
    loadProps()

    -- Create screen canvas and swap monitor textures
    if #screens > 0 then
        screenCanvas = love.graphics.newCanvas(SCREEN_W, SCREEN_H)
        for _, s in ipairs(screens) do
            s.model.mesh:setTexture(screenCanvas)
        end
        print(string.format("  Screens: %d monitor quads → ReactJIT canvas (%dx%d)", #screens, SCREEN_W, SCREEN_H))
    end

    -- Load saved viewports or start in free mode
    viewports = loadViewports()
    if viewports then
        phase = "reading"
        love.mouse.setRelativeMode(false)
        applyViewport(viewports.start)
        print(string.format("  Viewports loaded — starting in reading mode"))
    else
        phase = "free"
        love.mouse.setRelativeMode(true)
        viewports = {}  -- empty table for capture

        -- Use map spawn if available
        local info = loadMapInfo(mapName)
        if info and info.spawn then
            g3d.camera.lookInDirection(
                info.spawn.x, info.spawn.y, info.spawn.z,
                math.rad(info.spawn.angle or 0), 0
            )
        end
        print("  No viewports.lua found — free mode (use [ ] \\ to set up viewports)")
    end
end

function love.update(dt)
    if reactReady then
        ReactJIT.update(dt)
    end

    if phase == "free" then
        g3d.camera.firstPersonMovement(dt * moveSpeed)
    end

    -- Flash message timer
    if setupMsgTimer > 0 then
        setupMsgTimer = setupMsgTimer - dt
        if setupMsgTimer <= 0 then
            setupMsg = nil
        end
    end
end

function love.draw()
    if #models == 0 then
        love.graphics.setColor(1, 1, 1)
        love.graphics.printf(
            "No .obj file found in maps/ directory.\n\n" ..
            "1. Convert a BSP:  node bsp-to-obj.cjs mymap.bsp maps/mymap.obj --textures\n" ..
            "2. Run:            love . cs_office_source",
            40, 40, love.graphics.getWidth() - 80
        )
        return
    end

    -- Render React tree to screen canvas
    if screenCanvas and reactReady then
        love.graphics.setDepthMode("always", false)
        love.graphics.setCanvas(screenCanvas)
        love.graphics.clear(1, 1, 1, 1)
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.push()
        love.graphics.scale(SCREEN_W / love.graphics.getWidth(), SCREEN_H / love.graphics.getHeight())
        ReactJIT.draw()
        love.graphics.pop()
        love.graphics.setCanvas()
    end

    -- Render 3D world
    love.graphics.setDepthMode("lequal", true)
    love.graphics.setColor(1, 1, 1, 1)

    for _, entry in ipairs(models) do
        entry.model:draw()
    end

    for _, prop in ipairs(props) do
        for _, entry in ipairs(prop.models) do
            entry.model:draw()
        end
    end

    -- HUD
    love.graphics.setDepthMode("always", false)

    if phase == "free" then
        local hasStart = viewports and viewports.start
        local hasEnd = viewports and viewports["end"]

        love.graphics.setColor(0, 0, 0, 0.6)
        love.graphics.rectangle("fill", 0, 0, 340, 130)
        love.graphics.setColor(1, 1, 1)
        love.graphics.print(string.format("FPS: %d", love.timer.getFPS()), 8, 8)
        love.graphics.print(string.format("Tris: %d  Groups: %d  Screens: %d", totalTris, #models, #screens), 8, 24)
        love.graphics.print(string.format("Speed: %.1fx  [scroll to adjust]", moveSpeed), 8, 40)
        love.graphics.print("WASD move | Mouse look | Tab cursor", 8, 56)

        -- Viewport setup hints
        love.graphics.setColor(0.6, 0.8, 1)
        love.graphics.print(string.format("[ start%s  ] end%s  \\ save+preview",
            hasStart and " *" or "", hasEnd and " *" or ""), 8, 80)
        love.graphics.setColor(0.5, 0.5, 0.5)
        love.graphics.print("Esc quit", 8, 96)

        -- Flash message
        if setupMsg and setupMsgTimer > 0 then
            local alpha = math.min(1, setupMsgTimer)
            love.graphics.setColor(0.2, 1, 0.4, alpha)
            love.graphics.print(setupMsg, 8, 112)
        end
    end
end

function love.mousemoved(x, y, dx, dy)
    if phase == "free" and love.mouse.getRelativeMode() then
        g3d.camera.firstPersonLook(dx, dy)
    end
end

function love.wheelmoved(x, y)
    if phase == "reading" then
        -- Forward scroll to ReactJIT for ScrollView
        ReactJIT.safeCall("wheelmoved", x, y)

        -- Accumulate scroll (y > 0 = scroll up, y < 0 = scroll down)
        scrollAccum = scrollAccum - y  -- negative y = scrolling down = progress
        if scrollAccum >= SCROLL_THRESHOLD then
            phase = "pullback"
            pullbackProgress = 0
            print("Phase: pullback")
        end

    elseif phase == "pullback" then
        -- Scroll drives camera transition from start to end viewport
        pullbackProgress = pullbackProgress + (-y) / PULLBACK_TICKS
        if pullbackProgress >= 1 then
            pullbackProgress = 1
            phase = "free"
            love.mouse.setRelativeMode(true)
            print("Phase: free roam")
        end
        positionCameraBetweenViewports(pullbackProgress)

    elseif phase == "free" then
        moveSpeed = math.max(0.5, math.min(20, moveSpeed + y * 0.5))
    end
end

function love.keypressed(key)
    if key == "escape" then
        love.event.quit()

    elseif key == "tab" and phase == "free" then
        local captured = not love.mouse.getRelativeMode()
        love.mouse.setRelativeMode(captured)

    elseif key == "space" and phase == "reading" then
        -- Skip to pullback
        phase = "pullback"
        pullbackProgress = 0
        print("Phase: pullback (skipped)")

    -- Viewport capture controls
    elseif key == "[" and phase == "free" then
        if not viewports then viewports = {} end
        viewports.start = captureViewport()
        flashMsg("Start viewport captured: " .. formatViewport(viewports.start))

    elseif key == "]" and phase == "free" then
        if not viewports then viewports = {} end
        viewports["end"] = captureViewport()
        flashMsg("End viewport captured: " .. formatViewport(viewports["end"]))

    elseif key == "\\" and phase == "free" then
        if viewports and viewports.start and viewports["end"] then
            if saveViewports() then
                flashMsg("Viewports saved! Entering preview...")
                phase = "reading"
                scrollAccum = 0
                pullbackProgress = 0
                love.mouse.setRelativeMode(false)
                applyViewport(viewports.start)
            end
        else
            flashMsg("Set both viewports first: [ for start, ] for end")
        end

    elseif key == "backspace" and (phase == "reading" or phase == "pullback") then
        phase = "free"
        love.mouse.setRelativeMode(true)
        flashMsg("Back to free mode — re-adjust viewports")
    end
end

function love.resize(w, h)
    ReactJIT.safeCall("resize", w, h)
end

function love.quit()
    if reactReady then
        ReactJIT.quit()
    end
end
