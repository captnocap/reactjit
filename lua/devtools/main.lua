--[[
  devtools.lua -- Unified Chrome-style bottom panel with tabs

  Combines the inspector (Elements tab) and console (Console tab) into
  a single bottom panel with a tab bar. Canvas overlays (hover highlight,
  selected outline, tooltip, perf bar) always render on the main canvas
  regardless of which tab is active.

  Supports pop-out mode: the panel can be detached into a separate window
  via Ctrl+Shift+D or the tab bar button, giving the app full viewport
  while keeping devtools accessible alongside it.

  Usage:
    local devtools = require("lua.devtools")
    devtools.init({ inspector = inspector, console = console })
    -- In love.keypressed:  if devtools.keypressed(key) then return end
    -- In love.mousepressed: if devtools.mousepressed(x, y, btn) then return end
    -- In love.mousemoved:   devtools.mousemoved(x, y)
    -- In love.wheelmoved:   if devtools.wheelmoved(x, y) then return end
    -- In love.textinput:    if devtools.textinput(text) then return end
    -- In love.draw:         devtools.draw(root)
    -- In love.focus:        devtools.handleFocus(hasFocus)

  Controls:
    F12          -- Toggle devtools open/closed
    `            -- Switch to Console tab (opens devtools if closed)
    Ctrl+Shift+D -- Toggle pop-out / dock-back
    Escape       -- Close devtools (or clear selection, or dock back)
]]

local eventTrail = require("lua.event_trail")
local layoutColorizer = require("lua.layout_colorizer")
local Style = require("lua.devtools.style")

local NetworkTab   = require("lua.devtools.tab_network")
local PerfTab      = require("lua.devtools.tab_perf")
local WireframeTab = require("lua.devtools.tab_wireframe")
local LogsTab      = require("lua.devtools.tab_logs")

local DevTools = {}

-- ============================================================================
-- Dependencies (injected via init)
-- ============================================================================

local inspector = nil
local console   = nil
local tree      = nil
local bridge    = nil  -- for toggling JS-side channels

-- ============================================================================
-- State
-- ============================================================================

local state = {
  open      = false,
  activeTab = "elements",  -- "elements" or "console"
  -- Draggable divider between tree and detail panels
  dividerRatio    = 0.5,   -- tree takes this fraction of width (0.0-1.0)
  draggingDivider = false, -- currently dragging?
  -- Panel height resize (drag top edge)
  panelRatio      = 0.4,           -- user-adjustable panel height ratio
  draggingHeight  = false,        -- currently dragging top edge?
  -- Pop-out window state (subprocess over TCP IPC)
  poppedOut      = false,    -- devtools panel in its own child process?
  server         = nil,      -- TCP server socket (parent side)
  conn           = nil,      -- TCP connection to child process
  port           = nil,      -- TCP port
  initSent       = false,    -- initial tree sent to child?
  mainHasFocus   = true,     -- true when main window has focus
  lastPerfSend   = 0,        -- throttle perf updates to child
  lastSentSelId  = nil,      -- last selected node ID sent to child
  lastNetSend    = 0,        -- throttle network delta updates to child
  lastNetSentId  = 0,        -- latest network event ID sent to child
  forceNetSnapshot = false,  -- force full network snapshot on next child sync
  netPingSeq = 0,            -- counter for "Ping Tor" test button
  -- Mutation batching: accumulate mutations, flush at ~15fps to match child
  pendingMutations = {},     -- queued mutation commands
  mutationFlushTimer = 0,    -- time since last flush
  -- Network ingest guardrails
  netCapturedThisFrame = 0,
  netDroppedThisFrame = 0,
  netStatsTimer = 0,
  netRecentEvents = 0,
  netRecentDropped = 0,
  netEventsPerSec = 0,
  netDroppedPerSec = 0,
  netLastErrorTs = nil,
}

-- ============================================================================
-- Visual constants
-- ============================================================================

local TAB_BAR_H    = 26
local STATUS_BAR_H = 22
local MIN_PANEL_H  = 200
local PANEL_RATIO  = 0.4   -- 40% of screen height
local DIVIDER_W    = 5     -- grab zone half-width (total 10px)
local MIN_TREE_W   = 200
local MIN_DETAIL_W = 200

-- Colors (matching inspector/console dark theme)
local BG_COLOR     = { 0.05, 0.05, 0.10, 0.92 }
local BORDER_COLOR = { 0.25, 0.25, 0.35, 0.8 }
local TAB_BG       = { 0.08, 0.08, 0.14, 1 }
local TAB_ACTIVE   = { 0.05, 0.05, 0.10, 1 }
local TAB_TEXT     = { 0.55, 0.58, 0.65, 1 }
local TAB_TEXT_ACT = { 0.88, 0.90, 0.94, 1 }
local TAB_ACCENT   = { 0.38, 0.65, 0.98, 1 }
local CLOSE_COLOR  = { 0.55, 0.58, 0.65, 1 }
local CLOSE_HOVER  = { 0.95, 0.45, 0.45, 1 }
local DIVIDER_COLOR = { 0.30, 0.30, 0.42, 1 }
local DIVIDER_HOVER = { 0.38, 0.65, 0.98, 0.6 }
local STATUS_BG    = { 0.06, 0.06, 0.11, 1 }
local STATUS_TEXT  = { 0.55, 0.58, 0.65, 1 }
local STATUS_GOOD  = { 0.30, 0.80, 0.40, 1 }
local STATUS_WARN  = { 0.95, 0.75, 0.20, 1 }

-- Tab definitions
local TABS = {
  { id = "elements",  label = "Elements" },
  { id = "wireframe", label = "Wireframe" },
  { id = "perf",      label = "Perf" },
  { id = "network",   label = "Network" },
  { id = "console",   label = "Console" },
  { id = "logs",      label = "Logs" },
}

-- Cached font (created lazily)
local fontSmall = nil
local function getFont()
  if not fontSmall then fontSmall = love.graphics.newFont(11) end
  return fontSmall
end

-- Scrollbar helper (thin thumb, no track)
local SCROLLBAR_HIT_W = 10  -- hit area width (wider than visual for easier clicking)
local SCROLLBAR_VIS_W = 3   -- visual bar width

local function drawScrollbar(rx, ry, rw, rh, scrollY, contentH)
  if not contentH or contentH <= rh then return end
  local maxScroll = math.max(1, contentH - rh)
  local thumbH = math.max(20, rh * (rh / contentH))
  local thumbY = ry + (scrollY / maxScroll) * (rh - thumbH)
  love.graphics.setColor(1, 1, 1, 0.25)
  love.graphics.rectangle("fill", rx + rw - 5, thumbY, SCROLLBAR_VIS_W, thumbH, 1, 1)
end

--- Scrollbar geometry: returns { thumbY, thumbH, maxScroll, trackY, trackH } or nil
local function getScrollbarGeometry(region, scrollY, contentH)
  if not region or not contentH or contentH <= region.h then return nil end
  local rh = region.h
  local maxScroll = math.max(1, contentH - rh)
  local thumbH = math.max(20, rh * (rh / contentH))
  local thumbY = region.y + (scrollY / maxScroll) * (rh - thumbH)
  return { thumbY = thumbY, thumbH = thumbH, maxScroll = maxScroll, trackY = region.y, trackH = rh }
end

-- Scrollbar drag state
local devScrollDrag = nil  -- { tab, startMouse, startScroll, maxScroll, trackH, thumbH, trackY }


-- ============================================================================
-- Geometry helpers
-- ============================================================================

--- Compute panel geometry based on current screen size.
--- Returns panelY, panelH, contentY, contentH, screenW
--- When popped out, uses devtools window dimensions (panel fills entire window).
local function getPanelGeometry()
  if state.poppedOut then
    -- When popped out: in child process, fills entire window.
    -- love.graphics.getDimensions() returns devtools window size in child.
    local screenW, screenH = love.graphics.getDimensions()
    local panelH = screenH
    local panelY = 0
    local contentY = TAB_BAR_H
    local contentH = panelH - TAB_BAR_H - STATUS_BAR_H
    return panelY, panelH, contentY, contentH, screenW
  end
  local screenW, screenH = love.graphics.getDimensions()
  local ratio = state.panelRatio or PANEL_RATIO
  local panelH = math.max(MIN_PANEL_H, math.floor(screenH * ratio))
  local panelY = screenH - panelH
  local contentY = panelY + TAB_BAR_H
  local contentH = panelH - TAB_BAR_H - STATUS_BAR_H
  return panelY, panelH, contentY, contentH, screenW
end

-- ============================================================================
-- Public API
-- ============================================================================

function DevTools.init(config)
  config = config or {}
  inspector = config.inspector
  console   = config.console
  tree      = config.tree
  bridge    = config.bridge
  state.pushEvent = config.pushEvent
  -- Wire up the re-layout callback for inspector style editing
  if inspector and tree then
    inspector.setMarkDirty(function() tree.markDirty() end)
  end
  -- Apply initial theme if provided
  if config.theme then Style.setTheme(config.theme) end
end

--- Update devtools panel colors from the active theme.
--- Call this whenever the theme changes (from init.lua's theme switch flow).
function DevTools.setTheme(theme)
  Style.setTheme(theme)
end

local function nowSec()
  if type(love) == "table" and love.timer and love.timer.getTime then
    return love.timer.getTime()
  end
  return os.clock()
end

local function trimTo(s, n)
  s = tostring(s or "")
  if #s <= n then return s end
  return s:sub(1, n - 1) .. "..."
end

local function copyTable(src)
  local out = {}
  if type(src) ~= "table" then return out end
  for k, v in pairs(src) do out[k] = v end
  return out
end

--- Build the shared context table passed to tab modules.
local function buildCtx()
  return {
    state = state,
    getFont = getFont,
    drawScrollbar = drawScrollbar,
    getScrollbarGeometry = getScrollbarGeometry,
    nowSec = nowSec,
    trimTo = trimTo,
    copyTable = copyTable,
    inspector = inspector,
    tree = tree,
    bridge = bridge,
  }
end

function DevTools.isOpen()
  return state.open
end

--- Force devtools open (used by devtools child process on startup).
--- Sets mainHasFocus = false because in the child process there is no
--- main window — all clicks should route to the panel (tabs + content).
function DevTools.forceOpen()
  state.open = true
  state.poppedOut = true
  state.mainHasFocus = false
end

--- Return the available viewport height (screen height minus panel when open).
--- Used by init.lua to pass reduced height to layout.layout().
--- When popped out, the panel is in its own window — full height available.
function DevTools.getViewportHeight()
  if not state.open then return love.graphics.getHeight() end
  if state.poppedOut then return love.graphics.getHeight() end
  local screenH = love.graphics.getHeight()
  local ratio = state.panelRatio or PANEL_RATIO
  local panelH = math.max(MIN_PANEL_H, math.floor(screenH * ratio))
  return screenH - panelH
end

--- Push a viewport event so React-side useWindowDimensions() stays in sync.
local function pushViewportEvent()
  if not state.pushEvent then return end
  state.pushEvent({
    type = "viewport",
    payload = {
      width = love.graphics.getWidth(),
      height = DevTools.getViewportHeight(),
    },
  })
end

function DevTools.beginFrame(dt)
  NetworkTab.beginFrame(buildCtx(), dt)
end

function DevTools.recordNetworkEvent(raw)
  return NetworkTab.recordNetworkEvent(buildCtx(), raw)
end

function DevTools.clearNetworkEvents()
  NetworkTab.clearNetworkEvents(buildCtx())
end

function DevTools.getLatestNetworkEventId()
  return NetworkTab.getLatestNetworkEventId()
end

function DevTools.getNetworkDebugStats()
  return NetworkTab.getNetworkDebugStats()
end

function DevTools.getNetworkSnapshotForChild(limit)
  return NetworkTab.getNetworkSnapshotForChild(limit)
end

function DevTools.getNetworkDeltaForChild(lastEventId, maxEvents)
  return NetworkTab.getNetworkDeltaForChild(lastEventId, maxEvents)
end

function DevTools.ingestNetworkDelta(payload)
  NetworkTab.ingestNetworkDelta(payload, buildCtx())
end

function DevTools.recordFrame(layoutMs, paintMs)
  PerfTab.recordFrame(buildCtx(), layoutMs, paintMs)
end

-- ============================================================================
-- Pop-out window management (subprocess over TCP IPC)
-- ============================================================================

--- Pop the devtools panel out into a separate child Love2D process.
function DevTools.popOut()
  if state.poppedOut then return end
  local IPC = require("lua.window_ipc")

  -- Create TCP server for child to connect to
  local server, port = IPC.createServer()
  if not server then
    io.write("[devtools] failed to create IPC server\n"); io.flush()
    return
  end

  state.server      = server
  state.port        = port
  state.conn        = nil
  state.initSent    = false
  state.lastPerfSend = 0
  state.lastSentSelId = nil
  state.lastNetSend = 0
  state.lastNetSentId = 0
  state.forceNetSnapshot = false

  -- Resolve devtools_window path relative to this file
  local info = debug.getinfo(1, "S")
  local thisFile = info and info.source and info.source:gsub("^@", "") or ""
  local luaDir = thisFile:match("(.*/lua)/") or thisFile:match("(.*\\lua)\\")
  local devtoolsWindowPath = luaDir and (luaDir .. "devtools_window") or "lua/devtools_window"

  -- Spawn child Love2D process
  local baseCmd = string.format(
    'REACTJIT_WINDOW_TITLE=%q REACTJIT_WINDOW_WIDTH=%d REACTJIT_WINDOW_HEIGHT=%d REACTJIT_IPC_PORT=%d love %s',
    "DevTools", 800, 500, port, devtoolsWindowPath
  )
  io.write("[devtools] spawning: " .. baseCmd .. "\n"); io.flush()
  local pidHandle = io.popen(baseCmd .. " & echo $!")
  if pidHandle then
    local pid = pidHandle:read("*l")
    pidHandle:close()
    if pid and pid:match("%d+") then
      local reg = require("lua.process_registry")
      reg.register(pid)
      state.childPid = pid
    end
  end

  state.poppedOut = true
  -- Main app gets full viewport back
  if tree then tree.markDirty() end
  pushViewportEvent()
  io.write("[devtools] popped out (IPC port " .. port .. ")\n"); io.flush()
end

--- Dock the devtools panel back into the main window (kill child process).
function DevTools.dockBack()
  if not state.poppedOut then return end
  local IPC = require("lua.window_ipc")

  -- Send quit to child
  if state.conn then
    IPC.send(state.conn, { type = "quit" })
    IPC.cleanup(state.conn)
    state.conn = nil
  end

  -- Close server
  if state.server then
    pcall(function() state.server:close() end)
    state.server = nil
  end

  if state.childPid then
    local reg = require("lua.process_registry")
    reg.unregister(state.childPid)
    state.childPid = nil
  end

  state.poppedOut = false
  state.port = nil
  state.initSent = false
  state.mainHasFocus = true
  state.lastSentSelId = nil
  state.lastNetSend = 0
  state.lastNetSentId = 0
  state.forceNetSnapshot = false
  state.pendingMutations = {}
  state.mutationFlushTimer = 0
  -- Main app loses viewport space to the docked panel
  if tree then tree.markDirty() end
  pushViewportEvent()
  io.write("[devtools] docked back\n"); io.flush()
end

--- Toggle between popped out and docked.
function DevTools.togglePopOut()
  if not state.open then
    -- Open + pop out in one action
    state.open = true
    inspector.enable()
    DevTools.popOut()
    return
  end
  if state.poppedOut then
    DevTools.dockBack()
  else
    DevTools.popOut()
  end
end

--- Is the devtools panel in its own window?
function DevTools.isPoppedOut()
  return state.poppedOut
end

--- Called when the main Love2D window gains/loses focus.
--- When main loses focus and devtools window exists, devtools is focused.
function DevTools.handleFocus(hasFocus)
  state.mainHasFocus = hasFocus
end

--- Is the devtools window currently focused? (main lost focus while popped out)
function DevTools.isDevToolsFocused()
  return state.poppedOut and not state.mainHasFocus
end

--- Tick the IPC connection to the devtools child process.
--- Call this from the main process's update loop.
function DevTools.tick(dt)
  if not state.poppedOut or not state.server then return end

  local IPC = require("lua.window_ipc")

  -- 1. Accept pending child connection
  if not state.conn then
    state.conn = IPC.accept(state.server)
    return  -- wait for next frame
  end

  -- 2. Send initial full tree once connected
  if not state.initSent then
    if tree then
      local root = tree.getTree()
      if root then
        local commands = IPC.serializeSubtree({ children = { root } })
        local mainW, mainH = love.graphics.getDimensions()
        local netSnap = DevTools.getNetworkSnapshotForChild(350)
        IPC.send(state.conn, {
          type = "init",
          commands = commands,
          mainWidth = mainW,
          mainHeight = mainH,
          network = netSnap,
        })
        state.lastNetSentId = netSnap.sentUpToEventId or 0
        state.initSent = true
        io.write("[devtools] sent init (" .. #commands .. " commands)\n"); io.flush()
      end
    end
    return
  end

  -- 3. Flush batched mutations (~15fps to match child's frame rate)
  state.mutationFlushTimer = state.mutationFlushTimer + dt
  if state.mutationFlushTimer >= (1.0 / 15) then
    state.mutationFlushTimer = 0
    if #state.pendingMutations > 0 then
      IPC.send(state.conn, { type = "mutations", commands = state.pendingMutations })
      state.pendingMutations = {}
    end
  end

  -- 4. Send perf data (throttled to ~15fps to match mutation rate for sparkline)
  state.lastPerfSend = state.lastPerfSend + dt
  if state.lastPerfSend >= (1.0 / 15) then
    state.lastPerfSend = 0
    local perf = inspector and inspector.getPerfData()
    if perf then
      IPC.send(state.conn, { type = "devtools_state", perf = perf })
    end
  end

  -- 5. Sync selected node changes to child
  local sel = inspector and inspector.getSelectedNode()
  local selId = sel and sel.id or false
  if selId ~= state.lastSentSelId then
    state.lastSentSelId = selId
    IPC.send(state.conn, { type = "devtools_state", selectedNodeId = selId })
  end

  -- 6. Send network deltas (throttled, delta-only)
  state.lastNetSend = state.lastNetSend + dt
  if state.lastNetSend >= (1.0 / 15) then
    state.lastNetSend = 0
    if state.forceNetSnapshot then
      local snap = DevTools.getNetworkSnapshotForChild(350)
      IPC.send(state.conn, { type = "devtools_state", network = snap })
      state.lastNetSentId = snap.sentUpToEventId or 0
      state.forceNetSnapshot = false
    else
      local delta = DevTools.getNetworkDeltaForChild(state.lastNetSentId or 0, 240)
      if delta and delta.events and #delta.events > 0 then
        IPC.send(state.conn, { type = "devtools_state", network = delta })
        state.lastNetSentId = delta.sentUpToEventId or state.lastNetSentId
      end
    end
  end

  -- 7. Poll for events from child
  local msgs, dead = IPC.poll(state.conn)
  if dead then
    io.write("[devtools] child connection lost, docking back\n"); io.flush()
    state.conn = nil
    if state.server then pcall(function() state.server:close() end); state.server = nil end
    state.poppedOut = false
    state.port = nil
    state.initSent = false
    state.mainHasFocus = true
    state.lastSentSelId = nil
    state.lastNetSend = 0
    state.lastNetSentId = 0
    state.forceNetSnapshot = false
    state.pendingMutations = {}
    state.mutationFlushTimer = 0
    if tree then tree.markDirty() end
    pushViewportEvent()
    return
  end

  for _, msg in ipairs(msgs) do
    if msg.type == "devtools_select" and msg.nodeId then
      -- Child selected a node — sync to main inspector
      local nodes = tree and tree.getNodes()
      local node = nodes and nodes[msg.nodeId]
      if node and inspector then
        inspector.selectNode(node)
      end
    elseif msg.type == "windowEvent" and msg.handler == "onClose" then
      -- Child window X clicked — dock back
      DevTools.dockBack()
      return
    elseif msg.type == "devtools_network_ack" and msg.eventId then
      state.lastNetSentId = math.max(state.lastNetSentId or 0, tonumber(msg.eventId) or 0)
    end
  end
end

--- Forward tree mutations to the devtools child process.
--- Batches mutations and flushes at ~15fps (matching child's frame rate)
--- to avoid flooding the child with 240fps worth of IPC traffic.
function DevTools.forwardMutations(commands)
  if not state.poppedOut or not state.conn or not state.initSent then return end
  -- Accumulate into pending batch
  local pending = state.pendingMutations
  for _, cmd in ipairs(commands) do
    pending[#pending + 1] = cmd
  end
end

-- ============================================================================
-- Input handling
-- ============================================================================

--- Handle keypress. Returns true if consumed.
function DevTools.keypressed(key)
  -- Ctrl+Shift+D: toggle pop-out
  if key == "d" and love.keyboard.isDown("lctrl", "rctrl") and love.keyboard.isDown("lshift", "rshift") then
    DevTools.togglePopOut()
    return true
  end

  -- Ctrl+Shift+L: toggle layout colorizer
  if key == "l" and love.keyboard.isDown("lctrl", "rctrl") and love.keyboard.isDown("lshift", "rshift") then
    layoutColorizer.toggle()
    eventTrail.recordSemantic(layoutColorizer.active and "Layout colorizer ON" or "Layout colorizer OFF")
    return true
  end

  -- F12: toggle devtools
  if key == "f12" then
    if state.poppedOut then
      -- Dock back first, then close
      eventTrail.recordSemantic("F12: closed inspector (docked back)")
      DevTools.dockBack()
      state.open = false
      inspector.disable()
      console.hide()
      state.draggingDivider = false
      love.mouse.setCursor()
      if tree then tree.markDirty() end
      pushViewportEvent()
    else
      state.open = not state.open
      if state.open then
        eventTrail.recordSemantic("F12: opened inspector")
        inspector.enable()
      else
        eventTrail.recordSemantic("F12: closed inspector")
        inspector.disable()
        console.hide()
        state.draggingDivider = false
        love.mouse.setCursor()
      end
      -- Relayout: viewport height changed
      if tree then tree.markDirty() end
      pushViewportEvent()
    end
    return true
  end

  -- Backtick: open devtools to console tab (or switch to console if already open)
  if key == "`" then
    local wasOpen = state.open
    if not state.open then
      state.open = true
      inspector.enable()
    end
    state.activeTab = "console"
    console.show()
    -- Relayout if we just opened
    if not wasOpen and tree then
      tree.markDirty()
      pushViewportEvent()
    end
    return true
  end

  if not state.open then return false end

  -- Elements tab: route to inspector first when editing (edit mode handles Escape, Tab, etc.)
  if state.activeTab == "elements" and inspector.isEditing() then
    if inspector.keypressed(key) then return true end
  end

  -- Escape: clear selection first, then dock back (if popped), then close devtools
  if key == "escape" then
    if state.activeTab == "elements" and inspector.getSelectedNode() then
      inspector.clearSelection()
      return true
    end
    -- If popped out, dock back first
    if state.poppedOut then
      DevTools.dockBack()
      return true
    end
    -- Close devtools
    state.open = false
    inspector.disable()
    console.hide()
    state.draggingDivider = false
    love.mouse.setCursor()
    if tree then tree.markDirty() end
    pushViewportEvent()
    return true
  end

  -- Route to active tab
  if state.activeTab == "console" then
    return console.keypressed(key)
  elseif state.activeTab == "elements" then
    return inspector.keypressed(key)
  end

  return false
end

--- Handle text input. Returns true if consumed.
function DevTools.textinput(text)
  if not state.open then return false end

  if state.activeTab == "elements" then
    return inspector.textinput(text)
  elseif state.activeTab == "console" then
    return console.textinput(text)
  end

  return false
end


--- Get scroll state from the appropriate tab module.
local function getTabScrollState(tabName)
  local s = nil
  if tabName == "perf" then
    s = PerfTab.getScrollState()
  elseif tabName == "network" then
    s = NetworkTab.getScrollState()
  elseif tabName == "logs" then
    s = LogsTab.getScrollState()
  end

  if type(s) == "table" then
    return s
  end

  -- Back-compat for modules that still return multiple values:
  --   scrollY, region, contentH
  local scrollY, region, contentH = s, nil, nil
  if tabName == "perf" then
    scrollY, region, contentH = PerfTab.getScrollState()
  elseif tabName == "network" then
    scrollY, region, contentH = NetworkTab.getScrollState()
  end
  if scrollY == nil then return nil end
  return {
    scrollY = scrollY,
    region = region,
    contentH = contentH,
  }
end

--- Set scroll position on the appropriate tab module.
local function setTabScrollY(tabName, value)
  if tabName == "perf" then PerfTab.setScrollY(value)
  elseif tabName == "network" then NetworkTab.setScrollY(value)
  elseif tabName == "logs" then LogsTab.setScrollY(value)
  end
end

--- Try to start a scrollbar drag. Returns true if click was on a scrollbar.
local function devScrollbarPressed(mx, my, button)
  if button ~= 1 then return false end

  -- Determine which tab's scrollbar to test
  local tab = state.activeTab
  local ss = getTabScrollState(tab)
  if not ss or not ss.region then return false end

  local region, scrollY, contentH = ss.region, ss.scrollY, ss.contentH

  -- Check if click is in the scrollbar hit zone (right edge of region)
  local barX = region.x + region.w - SCROLLBAR_HIT_W
  if mx < barX or mx > region.x + region.w then return false end
  if my < region.y or my > region.y + region.h then return false end

  local geo = getScrollbarGeometry(region, scrollY, contentH)
  if not geo then return false end

  if my >= geo.thumbY and my <= geo.thumbY + geo.thumbH then
    -- Click on thumb -> start drag
    devScrollDrag = { tab = tab, startMouse = my, startScroll = scrollY,
                      maxScroll = geo.maxScroll, trackH = geo.trackH,
                      thumbH = geo.thumbH, trackY = geo.trackY }
  else
    -- Click on track -> jump to position, then start drag
    local ratio = (my - geo.trackY) / geo.trackH
    local newScroll = math.max(0, math.min(ratio * geo.maxScroll, geo.maxScroll))
    setTabScrollY(tab, newScroll)
    devScrollDrag = { tab = tab, startMouse = my, startScroll = newScroll,
                      maxScroll = geo.maxScroll, trackH = geo.trackH,
                      thumbH = geo.thumbH, trackY = geo.trackY }
  end
  return true
end

--- Update scrollbar drag on mouse move. Returns true if consumed.
local function devScrollbarMoved(mx, my)
  if not devScrollDrag then return false end
  local d = devScrollDrag
  local delta = my - d.startMouse
  local thumbTravel = math.max(1, d.trackH - d.thumbH)
  local scrollDelta = (delta / thumbTravel) * d.maxScroll
  local newScroll = math.max(0, math.min(d.startScroll + scrollDelta, d.maxScroll))
  setTabScrollY(d.tab, newScroll)
  return true
end

--- End scrollbar drag. Returns true if was dragging.
local function devScrollbarReleased()
  if not devScrollDrag then return false end
  devScrollDrag = nil
  return true
end

--- Handle mouse press. Returns true if consumed.
function DevTools.mousepressed(x, y, button)
  if not state.open then
    return false
  end

  -- When popped out: route differently based on which window is focused
  if state.poppedOut then
    if state.mainHasFocus then
      -- Main window click: only inspector canvas node selection
      return inspector.mousepressed(x, y, button)
    end
    -- Devtools window focused: coordinates are relative to devtools window
    -- Fall through to normal panel handling (panelY = 0 in pop-out geometry)
  end

  local panelY, panelH, contentY, contentH, screenW = getPanelGeometry()

  -- Top-edge resize handle (6px grab zone centered on panel top border)
  if not state.poppedOut and button == 1 and math.abs(y - panelY) <= 3 then
    state.draggingHeight = true
    return true
  end

  -- Click above the panel: route to inspector for viewport node selection.
  -- Always consume the click when devtools is open — never let it pass through
  -- to the React tree underneath, even if the inspector has no hovered node.
  if y < panelY then
    inspector.mousepressed(x, y, button)
    return true
  end

  -- Tab bar click: switch tabs
  if y < panelY + TAB_BAR_H then
    local font = getFont()
    local tabX = 8
    for _, tab in ipairs(TABS) do
      local tabW = font:getWidth(tab.label) + 24
      if x >= tabX and x < tabX + tabW then
        state.activeTab = tab.id
        if tab.id == "console" then
          console.show()
        end
        return true
      end
      tabX = tabX + tabW + 2
    end

    -- Pick mode toggle button
    local pickX = screenW - 124
    if x >= pickX and x < pickX + 20 then
      if inspector then
        inspector.setPickMode(not inspector.isPickMode())
        eventTrail.recordSemantic(inspector.isPickMode() and "Inspector pick mode ON" or "Inspector pick mode OFF")
      end
      return true
    end

    -- Layout colors toggle button
    local colorsX = screenW - 100
    if x >= colorsX and x < colorsX + 20 then
      layoutColorizer.toggle()
      eventTrail.recordSemantic(layoutColorizer.active and "Layout colorizer ON" or "Layout colorizer OFF")
      return true
    end

    -- Refresh button — clears stale state for the active panel
    local refreshX = screenW - 76
    if x >= refreshX and x < refreshX + 20 then
      -- Wireframe
      WireframeTab.refresh(buildCtx())
      -- Perf
      PerfTab.resetScroll()
      -- Logs
      LogsTab.resetState()
      -- Network
      if state.activeTab == "network" then
        DevTools.clearNetworkEvents()
      end
      -- Inspector (clear selection, re-walk tree)
      if inspector then
        inspector.clearSelection()
      end
      return true
    end

    -- Pop-out / dock-back button
    local popoutX = screenW - 52
    if x >= popoutX and x < popoutX + 20 then
      DevTools.togglePopOut()
      return true
    end

    -- Close button (right side of tab bar)
    local closeX = screenW - 28
    if x >= closeX and x < closeX + 20 then
      if state.poppedOut then DevTools.dockBack() end
      state.open = false
      inspector.disable()
      console.hide()
      if tree then tree.markDirty() end
      return true
    end

    return true  -- consumed by tab bar even if no tab hit
  end

  -- Scrollbar click/drag gets priority over tab content
  if devScrollbarPressed(x, y, button) then return true end

  -- Content area click: route to active tab
  if state.activeTab == "elements" then
    -- Check if click is on the divider between tree and detail
    if inspector.getSelectedNode() then
      local treeW = math.floor(screenW * state.dividerRatio)
      if math.abs(x - treeW) <= DIVIDER_W then
        state.draggingDivider = true
        return true
      end
    end
    -- Inspector handles tree/detail region clicks via stored regions
    return inspector.mousepressed(x, y, button)
  elseif state.activeTab == "wireframe" then
    -- Flex toggle button click
    local ft = WireframeTab.getFlexToggle()
    if ft then
      if x >= ft.x and x < ft.x + ft.w and y >= ft.y and y < ft.y + ft.h then
        WireframeTab.toggleFlex()
        return true
      end
    end
    -- Hit test against wireframe rects -- select node but stay on wireframe.
    local hitNode = WireframeTab.hitTest(x, y)
    if hitNode and inspector then
      inspector.selectNode(hitNode)
    end
    return true
  elseif state.activeTab == "perf" then
    return PerfTab.mousepressed(buildCtx(), x, y, button)
  elseif state.activeTab == "network" then
    local region = { x = 0, y = contentY, w = screenW, h = contentH }
    return NetworkTab.mousepressed(buildCtx(), x, y, button, region)
  elseif state.activeTab == "console" then
    return true  -- console content area consumes clicks
  elseif state.activeTab == "logs" then
    local region = { x = 0, y = contentY, w = screenW, h = contentH }
    return LogsTab.mousepressed(buildCtx(), x, y, button, region)
  end

  return true
end

--- Handle mouse movement. Returns true if devtools consumed the event
--- (callers should skip React tree hover tracking).
function DevTools.mousemoved(x, y)
  if not inspector then return false end
  if not state.open then return false end

  -- When popped out and main has focus: only track hover overlays on canvas
  if state.poppedOut and state.mainHasFocus then
    inspector.mousemoved(x, y)
    return true
  end

  -- Panel height dragging
  if state.draggingHeight then
    local screenW, screenH = love.graphics.getDimensions()
    local newH = screenH - y
    local minRatio = MIN_PANEL_H / screenH
    local maxRatio = 0.9  -- never cover more than 90% of the viewport
    state.panelRatio = math.max(minRatio, math.min(newH / screenH, maxRatio))
    if tree then tree.markDirty() end  -- relayout app viewport
    return true
  end

  -- Scrollbar dragging
  if devScrollbarMoved(x, y) then return true end

  -- Divider dragging (uses devtools window coordinates when popped out)
  if state.draggingDivider then
    local _, _, _, _, screenW = getPanelGeometry()
    local clamped = math.max(MIN_TREE_W, math.min(x, screenW - MIN_DETAIL_W))
    state.dividerRatio = clamped / screenW
    return true
  end

  -- Resize cursor when hovering panel top edge or divider
  local panelY, _, _, _, screenW = getPanelGeometry()
  if not state.poppedOut and math.abs(y - panelY) <= 3 then
    love.mouse.setCursor(love.mouse.getSystemCursor("sizens"))
  elseif state.activeTab == "elements" and inspector.getSelectedNode() then
    local treeW = math.floor(screenW * state.dividerRatio)
    if y > panelY and math.abs(x - treeW) <= DIVIDER_W then
      love.mouse.setCursor(love.mouse.getSystemCursor("sizewe"))
    else
      love.mouse.setCursor()
    end
  else
    love.mouse.setCursor()
  end

  -- Wireframe tab hover tracking
  if state.activeTab == "wireframe" then
    WireframeTab.setHoverNode(WireframeTab.hitTest(x, y))
  else
    WireframeTab.setHoverNode(nil)
  end

  -- Logs tab hover tracking
  local logsRegion = LogsTab.getScrollState().region
  if state.activeTab == "logs" and logsRegion then
    LogsTab.mousemoved(buildCtx(), x, y, logsRegion)
  else
    LogsTab.clearHover()
  end

  -- Always update inspector mouse position (needed for scroll hit testing in popped-out mode).
  -- Hover overlays on the main canvas are gated separately in the inspector's draw path.
  inspector.mousemoved(x, y)

  -- Devtools is open — consume the event so React tree hover doesn't fire
  return true
end

--- Handle mouse release. Returns true if consumed.
function DevTools.mousereleased(x, y, button)
  if devScrollbarReleased() then return true end
  if state.draggingHeight then
    state.draggingHeight = false
    love.mouse.setCursor()
    return true
  end
  if state.draggingDivider then
    state.draggingDivider = false
    love.mouse.setCursor()
    return true
  end
  return false
end

--- Handle mouse wheel. Returns true if consumed.
function DevTools.wheelmoved(x, y)
  if not state.open then return false end

  -- When popped out: main window wheel goes to app, devtools window wheel goes to panel
  if state.poppedOut then
    if state.mainHasFocus then return false end
    -- Devtools window focused: all wheel goes to panel
    if state.activeTab == "elements" then
      return inspector.wheelmoved(x, y)
    elseif state.activeTab == "perf" then
      return PerfTab.wheelmoved(buildCtx(), x, y)
    elseif state.activeTab == "network" then
      return NetworkTab.wheelmoved(buildCtx(), x, y)
    elseif state.activeTab == "console" then
      return console.wheelmoved(x, y)
    elseif state.activeTab == "logs" then
      return LogsTab.wheelmoved(buildCtx(), x, y)
    end
    return false
  end

  local panelY = getPanelGeometry()
  local mx, my = love.mouse.getPosition()

  -- Only handle wheel when mouse is in the panel area
  if my < panelY then return false end

  if state.activeTab == "elements" then
    return inspector.wheelmoved(x, y)
  elseif state.activeTab == "perf" then
    return PerfTab.wheelmoved(buildCtx(), x, y)
  elseif state.activeTab == "network" then
    return NetworkTab.wheelmoved(buildCtx(), x, y)
  elseif state.activeTab == "console" then
    return console.wheelmoved(x, y)
  elseif state.activeTab == "logs" then
    return LogsTab.wheelmoved(buildCtx(), x, y)
  end

  return false
end

-- ============================================================================
-- Drawing
-- ============================================================================

--- Draw the tab bar at the top of the panel.
local function drawTabBar(panelY, screenW)
  local font = getFont()

  -- Tab bar background
  love.graphics.setColor(TAB_BG)
  love.graphics.rectangle("fill", 0, panelY, screenW, TAB_BAR_H)

  -- Bottom border of tab bar
  love.graphics.setColor(BORDER_COLOR)
  love.graphics.rectangle("fill", 0, panelY + TAB_BAR_H - 1, screenW, 1)

  -- Top border of panel
  love.graphics.setColor(BORDER_COLOR)
  love.graphics.rectangle("fill", 0, panelY, screenW, 1)

  -- Draw tabs
  love.graphics.setFont(font)
  local tabX = 8
  local tabPadX = 12
  local tabH = TAB_BAR_H - 2  -- leave space for bottom border

  for _, tab in ipairs(TABS) do
    local tabW = font:getWidth(tab.label) + tabPadX * 2
    local isActive = state.activeTab == tab.id

    if isActive then
      -- Active tab: brighter background, accent underline
      love.graphics.setColor(TAB_ACTIVE)
      love.graphics.rectangle("fill", tabX, panelY + 1, tabW, tabH)
      love.graphics.setColor(TAB_ACCENT)
      love.graphics.rectangle("fill", tabX, panelY + TAB_BAR_H - 2, tabW, 2)
      love.graphics.setColor(TAB_TEXT_ACT)
    else
      love.graphics.setColor(TAB_TEXT)
    end

    local textY = panelY + math.floor((TAB_BAR_H - font:getHeight()) / 2)
    love.graphics.print(tab.label, tabX + tabPadX, textY)
    tabX = tabX + tabW + 2
  end

  -- Right-side buttons: pick mode, layout colors, refresh, pop-out, close
  local btnY = panelY + math.floor((TAB_BAR_H - font:getHeight()) / 2)

  -- Pick mode toggle button (cursor icon — active = element picking on)
  local pickX = screenW - 124
  local pickActive = inspector and inspector.isPickMode()
  love.graphics.setColor(pickActive and TAB_ACCENT or TAB_TEXT)
  love.graphics.print("+", pickX + 4, btnY)

  -- Layout colors toggle button
  local colorsX = screenW - 100
  love.graphics.setColor(layoutColorizer.active and TAB_ACCENT or TAB_TEXT)
  love.graphics.print("#", colorsX + 4, btnY)

  -- Refresh button
  local refreshX = screenW - 76
  love.graphics.setColor(TAB_TEXT)
  love.graphics.print("o", refreshX + 4, btnY)

  -- Pop-out / dock-back button
  local popoutX = screenW - 52
  love.graphics.setColor(TAB_TEXT)
  love.graphics.print(state.poppedOut and ">" or "<", popoutX + 4, btnY)

  -- Close button (x)
  local closeX = screenW - 28
  love.graphics.setColor(CLOSE_COLOR)
  love.graphics.print("x", closeX + 4, btnY)
end

--- Draw the status bar at the bottom of the panel (FPS, Layout, Paint, Nodes).
local function drawStatusBar(statusY, screenW)
  local font = getFont()
  local pad = 8

  -- Background
  love.graphics.setColor(STATUS_BG)
  love.graphics.rectangle("fill", 0, statusY, screenW, STATUS_BAR_H)

  -- Top border
  love.graphics.setColor(BORDER_COLOR)
  love.graphics.rectangle("fill", 0, statusY, screenW, 1)

  -- Get perf data from inspector
  local perf = inspector.getPerfData()
  if not perf then return end

  love.graphics.setFont(font)
  local textY = statusY + math.floor((STATUS_BAR_H - font:getHeight()) / 2)
  local x = pad

  -- FPS (green if good, yellow if slow)
  local fpsColor = perf.fps >= 55 and STATUS_GOOD or STATUS_WARN
  love.graphics.setColor(STATUS_TEXT)
  love.graphics.print("FPS ", x, textY)
  x = x + font:getWidth("FPS ")
  love.graphics.setColor(fpsColor)
  love.graphics.print(tostring(perf.fps), x, textY)
  x = x + font:getWidth(tostring(perf.fps)) + pad * 2

  -- Layout
  love.graphics.setColor(STATUS_TEXT)
  love.graphics.print("Layout ", x, textY)
  x = x + font:getWidth("Layout ")
  love.graphics.setColor(TAB_TEXT_ACT)
  local layoutStr = string.format("%.1fms", perf.layoutMs)
  love.graphics.print(layoutStr, x, textY)
  x = x + font:getWidth(layoutStr) + pad * 2

  -- Paint
  love.graphics.setColor(STATUS_TEXT)
  love.graphics.print("Paint ", x, textY)
  x = x + font:getWidth("Paint ")
  love.graphics.setColor(TAB_TEXT_ACT)
  local paintStr = string.format("%.1fms", perf.paintMs)
  love.graphics.print(paintStr, x, textY)
  x = x + font:getWidth(paintStr) + pad * 2

  -- Nodes
  love.graphics.setColor(STATUS_TEXT)
  love.graphics.print("Nodes ", x, textY)
  x = x + font:getWidth("Nodes ")
  love.graphics.setColor(TAB_TEXT_ACT)
  love.graphics.print(tostring(perf.nodeCount), x, textY)

  -- Window size (right-aligned)
  local winW, winH = love.graphics.getDimensions()
  local sizeStr = string.format("%d × %d", winW, winH)
  local sizeW = font:getWidth(sizeStr)
  love.graphics.setColor(STATUS_TEXT)
  love.graphics.print(sizeStr, screenW - sizeW - pad, textY)
end

--- Draw the panel content (tab bar, content area, status bar) into the current GL context.
--- Shared between docked mode (drawn on main canvas) and pop-out mode (drawn on devtools window).
local function drawPanelContent(root)
  local panelY, panelH, contentY, contentH, screenW = getPanelGeometry()

  -- Save graphics state for the panel
  love.graphics.push("all")
  love.graphics.origin()
  love.graphics.setScissor()

  -- Panel background
  love.graphics.setColor(BG_COLOR)
  love.graphics.rectangle("fill", 0, panelY, screenW, panelH)

  -- Tab bar
  drawTabBar(panelY, screenW)

  -- Content area
  if state.activeTab == "elements" then
    -- Split: tree on left, detail on right (draggable divider)
    if inspector.getSelectedNode() then
      local treeW = math.floor(screenW * state.dividerRatio)
      local detailX = treeW
      local detailW = screenW - treeW
      inspector.drawTreeInRegion(root, { x = 0, y = contentY, w = treeW, h = contentH })
      inspector.drawDetailInRegion({ x = detailX, y = contentY, w = detailW, h = contentH })

      -- Draw divider line (highlight on hover or drag)
      local mx = love.mouse.getX()
      local isDividerHot = state.draggingDivider or math.abs(mx - treeW) <= DIVIDER_W
      love.graphics.setColor(isDividerHot and DIVIDER_HOVER or DIVIDER_COLOR)
      love.graphics.rectangle("fill", treeW - 1, contentY, 2, contentH)
    else
      -- No selection: tree takes full width
      inspector.drawTreeInRegion(root, { x = 0, y = contentY, w = screenW, h = contentH })
    end

  elseif state.activeTab == "wireframe" then
    WireframeTab.draw(buildCtx(), root, { x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "perf" then
    PerfTab.draw(buildCtx(), { x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "network" then
    NetworkTab.draw(buildCtx(), { x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "console" then
    console.drawInRegion({ x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "logs" then
    LogsTab.draw(buildCtx(), { x = 0, y = contentY, w = screenW, h = contentH })
  end

  -- Status bar (bottom of panel)
  local statusY = panelY + panelH - STATUS_BAR_H
  drawStatusBar(statusY, screenW)

  -- Restore graphics state
  love.graphics.pop()
end

--- Main draw call. Renders overlays + panel (if open).
--- Call this from love.draw() after painting the UI tree.
--- When popped out, only draws canvas overlays on the main window — the panel
--- is rendered separately by drawInWindow() after GL context switch.
function DevTools.draw(root)
  -- Layout colorizer overlay (Ctrl+Shift+L)
  layoutColorizer.draw(root)

  -- Playground code/preview cross-link overlay (always available).
  if inspector and inspector.drawPlaygroundLinkOverlay then
    inspector.drawPlaygroundLinkOverlay(root)
  end

  -- Always draw inspector overlays when enabled (hover, selected, tooltip, perf)
  if inspector and inspector.isEnabled() then
    inspector.drawOverlays(root)
  end

  if not state.open then return end

  -- When popped out, the panel is drawn in drawInWindow() on the devtools GL context
  if state.poppedOut then return end

  drawPanelContent(root)
end

--- Draw the devtools panel filling the entire window.
--- Called by the devtools child process in love.draw().
function DevTools.drawInWindow(root)
  if not state.open or not state.poppedOut then return end
  drawPanelContent(root)
end

-- ============================================================================
-- Devtools-aware context menu integration
-- ============================================================================

--- Open devtools to Elements tab and select a specific node.
--- Used by context menu "Inspect" action.
function DevTools.inspectNode(node)
  if not node then return end
  local wasOpen = state.open
  state.open = true
  state.activeTab = "elements"
  if not wasOpen then
    inspector.enable()
  end
  inspector.inspectNode(node)
  -- Relayout: viewport height changed (panel just opened)
  if not wasOpen then
    if tree then tree.markDirty() end
    pushViewportEvent()
  end
end

return DevTools
