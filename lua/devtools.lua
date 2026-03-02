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

local Log = require("lua.debug_log")
local eventTrail = require("lua.event_trail")
local HotState = require("lua.hotstate")

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
  -- Mutation batching: accumulate mutations, flush at ~15fps to match child
  pendingMutations = {},     -- queued mutation commands
  mutationFlushTimer = 0,    -- time since last flush
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
-- Stored regions and content heights for scrollbar interaction
local perfRegion   = nil
local perfContentHStored = 0

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

  -- Resolve devtools_window path relative to this file
  local info = debug.getinfo(1, "S")
  local thisFile = info and info.source and info.source:gsub("^@", "") or ""
  local luaDir = thisFile:match("(.*/lua)/") or thisFile:match("(.*\\lua)\\")
  local devtoolsWindowPath = luaDir and (luaDir .. "devtools_window") or "lua/devtools_window"

  -- Spawn child Love2D process
  local cmd = string.format(
    'REACTJIT_WINDOW_TITLE=%q REACTJIT_WINDOW_WIDTH=%d REACTJIT_WINDOW_HEIGHT=%d REACTJIT_IPC_PORT=%d love %s &',
    "DevTools", 800, 500, port, devtoolsWindowPath
  )
  io.write("[devtools] spawning: " .. cmd .. "\n"); io.flush()
  os.execute(cmd)

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

  state.poppedOut = false
  state.port = nil
  state.initSent = false
  state.mainHasFocus = true
  state.lastSentSelId = nil
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
        IPC.send(state.conn, {
          type = "init",
          commands = commands,
          mainWidth = mainW,
          mainHeight = mainH,
        })
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

  -- 6. Poll for events from child
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

-- Forward declarations (defined in tab sections below, called by DevTools methods above)
local logsMousepressed
local logsMousemoved
local logsWheelmoved
local wireframeHitTest
local perfWheelmoved
local logsHoverRow = nil  -- index into sortedChannels, or "all"/"none"
local logsScrollY  = 0
local logsRegion   = nil  -- stored from draw for scroll clamping
local logsContentHStored = 0
local perfScrollY  = 0   -- forward-declared (used by scrollbar helpers before perf section)

local wfRefresh  -- forward declaration (used by mousepressed before definition)

--- Try to start a scrollbar drag. Returns true if click was on a scrollbar.
local function devScrollbarPressed(mx, my, button)
  if button ~= 1 then return false end

  -- Determine which tab's scrollbar to test
  local tab, region, scrollY, contentH
  if state.activeTab == "perf" and perfRegion then
    tab, region, scrollY, contentH = "perf", perfRegion, perfScrollY, perfContentHStored
  elseif state.activeTab == "logs" and logsRegion then
    tab, region, scrollY, contentH = "logs", logsRegion, logsScrollY, logsContentHStored
  else
    return false
  end

  -- Check if click is in the scrollbar hit zone (right edge of region)
  local barX = region.x + region.w - SCROLLBAR_HIT_W
  if mx < barX or mx > region.x + region.w then return false end
  if my < region.y or my > region.y + region.h then return false end

  local geo = getScrollbarGeometry(region, scrollY, contentH)
  if not geo then return false end

  if my >= geo.thumbY and my <= geo.thumbY + geo.thumbH then
    -- Click on thumb → start drag
    devScrollDrag = { tab = tab, startMouse = my, startScroll = scrollY,
                      maxScroll = geo.maxScroll, trackH = geo.trackH,
                      thumbH = geo.thumbH, trackY = geo.trackY }
  else
    -- Click on track → jump to position, then start drag
    local ratio = (my - geo.trackY) / geo.trackH
    local newScroll = math.max(0, math.min(ratio * geo.maxScroll, geo.maxScroll))
    if tab == "perf" then perfScrollY = newScroll
    else logsScrollY = newScroll end
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
  if d.tab == "perf" then perfScrollY = newScroll
  else logsScrollY = newScroll end
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

    -- Refresh button — clears stale state for the active panel
    local refreshX = screenW - 76
    if x >= refreshX and x < refreshX + 20 then
      -- Wireframe
      wfRefresh()
      -- Perf
      perfScrollY = 0
      -- Logs
      sortedChannels = nil
      logsScrollY = 0
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
    local ft = state._wfFlexToggle
    if ft then
      if x >= ft.x and x < ft.x + ft.w and y >= ft.y and y < ft.y + ft.h then
        wfShowFlex = not wfShowFlex
        return true
      end
    end
    -- Hit test against wireframe rects — select node but stay on wireframe.
    local hitNode = wireframeHitTest(x, y)
    if hitNode and inspector then
      inspector.selectNode(hitNode)
    end
    return true
  elseif state.activeTab == "perf" then
    -- Rate selector click (screen coords from last draw)
    if perfRateRegion and button == 1 then
      local pr = perfRateRegion
      if x >= pr.x and x < pr.x + pr.w and y >= pr.y and y < pr.y + pr.h then
        local idx = math.floor((x - pr.x) / pr.segW) + 1
        if idx >= 1 and idx <= #PERF_RATE_PRESETS then
          perfRateIdx = idx
          perfDisplaySnapshot = nil  -- force immediate refresh
        end
        return true
      end
    end
    return true
  elseif state.activeTab == "console" then
    return true  -- console content area consumes clicks
  elseif state.activeTab == "logs" then
    local region = { x = 0, y = contentY, w = screenW, h = contentH }
    return logsMousepressed(x, y, button, region)
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
    wfHoverNode = wireframeHitTest(x, y)
  else
    wfHoverNode = nil
  end

  -- Logs tab hover tracking
  if state.activeTab == "logs" and logsRegion then
    logsMousemoved(x, y, logsRegion)
  else
    logsHoverRow = nil
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
      return perfWheelmoved(x, y)
    elseif state.activeTab == "console" then
      return console.wheelmoved(x, y)
    elseif state.activeTab == "logs" then
      return logsWheelmoved(x, y)
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
    return perfWheelmoved(x, y)
  elseif state.activeTab == "console" then
    return console.wheelmoved(x, y)
  elseif state.activeTab == "logs" then
    return logsWheelmoved(x, y)
  end

  return false
end

-- ============================================================================
-- Wireframe tab: mini viewport showing all nodes as outlines
-- ============================================================================

-- Colors for wireframe
local WF_NODE_COLOR     = { 0.35, 0.38, 0.48, 0.50 }  -- default node outline
local WF_TEXT_COLOR     = { 0.55, 0.50, 0.40, 0.40 }  -- text node outline
local WF_SELECTED_COLOR = { 0.38, 0.65, 0.98, 1 }     -- selected node
local WF_HOVER_COLOR    = { 0.38, 0.65, 0.98, 0.50 }  -- hovered node
local WF_LABEL_COLOR    = { 0.55, 0.58, 0.65, 0.80 }  -- node labels
local WF_BG_COLOR       = { 0.03, 0.03, 0.06, 1 }     -- viewport background
local WF_VIEWPORT_BORDER = { 0.20, 0.22, 0.30, 0.60 } -- viewport outline
local WF_DEPTH_COLORS   = {                             -- depth-based tinting
  { 0.45, 0.55, 0.80, 0.55 },  -- depth 0
  { 0.50, 0.70, 0.60, 0.50 },  -- depth 1
  { 0.70, 0.60, 0.50, 0.45 },  -- depth 2
  { 0.60, 0.50, 0.70, 0.40 },  -- depth 3
  { 0.50, 0.60, 0.55, 0.35 },  -- depth 4+
}

-- Flex pressure overlay colors
local FP_GROW_COLOR   = { 0.95, 0.75, 0.20, 0.60 }  -- amber for flex-grow
local FP_SHRINK_COLOR = { 0.40, 0.60, 0.95, 0.60 }  -- blue for flex-shrink
local FP_BASIS_COLOR  = { 0.50, 0.50, 0.50, 0.30 }  -- gray for basis portion
local FP_TEXT_COLOR   = { 0.70, 0.72, 0.78, 0.90 }  -- info text
local FP_HEADER_BG    = { 0.08, 0.08, 0.12, 0.85 }  -- header backdrop

-- Wireframe state
local wfHoverNode = nil   -- node under cursor in wireframe
local wfNodeRects = {}    -- array of { node, sx, sy, sw, sh } for hit testing
local wfLastRootId = nil  -- track root identity to detect tree rebuilds (HMR)
local wfShowFlex = true   -- flex pressure overlay toggle

--- Get the depth-based color for a node.
local function getWfDepthColor(depth)
  local idx = math.min(depth + 1, #WF_DEPTH_COLORS)
  return WF_DEPTH_COLORS[idx]
end

--- Recursively draw nodes as wireframe outlines.
--- @param node table        The tree node
--- @param scale number      Scale factor (viewport → region)
--- @param offX number       X offset in screen coords
--- @param offY number       Y offset in screen coords
--- @param depth number      Tree depth (for color)
--- @param clipRect table|nil  { x1, y1, x2, y2 } in scaled coords — parent's clip bounds
local function drawWfNode(node, scale, offX, offY, depth, clipRect)
  if not node or not node.computed then return end
  local c = node.computed
  if c.w <= 0 or c.h <= 0 then return end

  -- Scaled screen coordinates
  local sx = offX + c.x * scale
  local sy = offY + c.y * scale
  local sw = c.w * scale
  local sh = c.h * scale

  -- Skip tiny rects (less than 1px either dimension)
  if sw < 1 and sh < 1 then return end

  -- Clip: skip nodes entirely outside, clamp partial overlaps to clip bounds
  if clipRect then
    if sx + sw < clipRect.x1 or sx > clipRect.x2 then return end
    if sy + sh < clipRect.y1 or sy > clipRect.y2 then return end
    -- Clamp visible rect to clip bounds
    local cx1 = math.max(sx, clipRect.x1)
    local cy1 = math.max(sy, clipRect.y1)
    local cx2 = math.min(sx + sw, clipRect.x2)
    local cy2 = math.min(sy + sh, clipRect.y2)
    sx, sy, sw, sh = cx1, cy1, cx2 - cx1, cy2 - cy1
    if sw < 1 or sh < 1 then return end
  end

  -- Store for hit testing (clamped rect)
  wfNodeRects[#wfNodeRects + 1] = { node = node, sx = sx, sy = sy, sw = sw, sh = sh }

  -- Determine color
  local isSelected = inspector and inspector.getSelectedNode() == node
  local isHovered = wfHoverNode == node

  if isSelected then
    -- Selected: filled highlight + bright outline
    love.graphics.setColor(WF_SELECTED_COLOR[1], WF_SELECTED_COLOR[2], WF_SELECTED_COLOR[3], 0.15)
    love.graphics.rectangle("fill", sx, sy, sw, sh)
    love.graphics.setColor(WF_SELECTED_COLOR)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", sx, sy, sw, sh)
    love.graphics.setLineWidth(1)
  elseif isHovered then
    -- Hovered: subtle fill + outline
    love.graphics.setColor(WF_HOVER_COLOR[1], WF_HOVER_COLOR[2], WF_HOVER_COLOR[3], 0.10)
    love.graphics.rectangle("fill", sx, sy, sw, sh)
    love.graphics.setColor(WF_HOVER_COLOR)
    love.graphics.rectangle("line", sx, sy, sw, sh)
  else
    -- Normal: classify by render count for non-text nodes
    local col
    if node.type == "__TEXT__" then
      col = WF_TEXT_COLOR
    else
      local rc = node.renderCount or 0
      if rc > 20 then
        col = { 0.95, 0.40, 0.30, 0.55 }  -- hotspot red
      elseif rc > 1 then
        col = { 0.95, 0.75, 0.20, 0.50 }  -- reactive amber
      else
        col = getWfDepthColor(depth)        -- static: depth-based cool
      end
    end
    love.graphics.setColor(col)
    love.graphics.rectangle("line", sx, sy, sw, sh)
  end

  -- Label only on selected node (avoids visual clutter that looks like clipping)
  if isSelected and sw > 30 and sh > 12 and node.type ~= "__TEXT__" then
    local label = node.debugName or node.type or ""
    if #label > 0 then
      local font = getFont()
      local labelW = font:getWidth(label)
      if labelW < sw - 4 then
        love.graphics.setColor(WF_SELECTED_COLOR)
        love.graphics.setFont(font)
        love.graphics.print(label, sx + 2, sy + 1)
      end
    end
  end

  -- Recurse into children — propagate clip rect for overflow containers
  if node.children then
    local childClip = clipRect
    local s = node.style or {}
    if s.overflow == "hidden" or s.overflow == "scroll" or s.overflow == "auto" then
      -- This node clips its children to its own bounds
      childClip = { x1 = sx, y1 = sy, x2 = sx + sw, y2 = sy + sh }
    end
    for _, child in ipairs(node.children) do
      drawWfNode(child, scale, offX, offY, depth + 1, childClip)
    end
  end
end

--- Clear wireframe stale state (call on HMR or manual refresh).
local function wfRefresh()
  wfHoverNode = nil
  wfNodeRects = {}
  wfLastRootId = nil
  if inspector then inspector.clearSelection() end
end

--- Draw the flex pressure overlay on the wireframe.
--- Shows flex distribution bars and summary when a flex container is selected.
local function drawFlexOverlay(selectedNode, scale, offX, offY, region)
  if not selectedNode then return end
  local c = selectedNode.computed
  if not c or not c.flexInfo then return end
  local fi = c.flexInfo

  -- Build lookup: childId → screen rect from wfNodeRects
  local childRects = {}
  for _, r in ipairs(wfNodeRects) do
    childRects[r.node.id] = r
  end

  -- Find the selected node's own screen rect
  local selRect = childRects[selectedNode.id]
  if not selRect then return end

  local font = getFont()
  love.graphics.setFont(font)
  local fh = font:getHeight()

  for lineIdx, flexLine in ipairs(fi.lines) do
    if not flexLine then goto continueLine end
    local itemCount = #flexLine.items
    if itemCount == 0 then goto continueLine end

    -- Container summary header above the node
    if lineIdx == 1 then
      local summaryParts = {}
      summaryParts[#summaryParts + 1] = string.format("%.0fpx", fi.mainSize)
      summaryParts[#summaryParts + 1] = string.format("basis:%.0f", flexLine.totalBasis)
      if flexLine.freeSpace >= 0 then
        summaryParts[#summaryParts + 1] = string.format("free:%.0f", flexLine.freeSpace)
      else
        summaryParts[#summaryParts + 1] = string.format("over:%.0f", -flexLine.freeSpace)
      end
      summaryParts[#summaryParts + 1] = string.format("%d items", itemCount)
      local summary = table.concat(summaryParts, "  |  ")
      local tw = font:getWidth(summary)

      -- Position header above the selected node rect
      local hx = selRect.sx + math.floor((selRect.sw - tw) / 2)
      local hy = selRect.sy - fh - 6
      -- Clamp to region bounds
      hx = math.max(region.x + 2, math.min(hx, region.x + region.w - tw - 2))
      hy = math.max(region.y + 2, hy)

      -- Background pill
      love.graphics.setColor(FP_HEADER_BG)
      love.graphics.rectangle("fill", hx - 4, hy - 1, tw + 8, fh + 2, 3, 3)
      -- Text
      love.graphics.setColor(FP_TEXT_COLOR)
      love.graphics.print(summary, hx, hy)
    end

    -- Draw allocation bars on each child
    local barH = 4  -- bar thickness in screen pixels
    local barW = 4  -- bar thickness for column direction

    for _, item in ipairs(flexLine.items) do
      local r = childRects[item.id]
      if not r then goto continueItem end
      if r.sw < 3 or r.sh < 3 then goto continueItem end

      local totalFinal = 0
      for _, it in ipairs(flexLine.items) do totalFinal = totalFinal + it.finalBasis end
      if totalFinal <= 0 then goto continueItem end

      if fi.isRow then
        -- Horizontal bar at bottom of child rect
        local barY = r.sy + r.sh - barH - 1

        -- Basis portion (gray)
        local basisFrac = item.origBasis / totalFinal
        local basisW = math.max(0, r.sw * (basisFrac * itemCount))
        -- Clamp to child width
        basisW = math.min(basisW, r.sw)

        love.graphics.setColor(FP_BASIS_COLOR)
        love.graphics.rectangle("fill", r.sx, barY, r.sw, barH)

        -- Delta portion overlay
        if math.abs(item.delta) > 0.5 then
          local deltaFrac = math.abs(item.delta) / fi.mainSize
          local deltaW = math.max(2, r.sw * deltaFrac * itemCount)
          deltaW = math.min(deltaW, r.sw)
          if item.delta > 0 then
            -- Grow: amber bar from right side of basis
            love.graphics.setColor(FP_GROW_COLOR)
            love.graphics.rectangle("fill", r.sx + r.sw - deltaW, barY, deltaW, barH)
          else
            -- Shrink: blue bar from right side
            love.graphics.setColor(FP_SHRINK_COLOR)
            love.graphics.rectangle("fill", r.sx + r.sw - deltaW, barY, deltaW, barH)
          end
        end

        -- Label if wide enough
        if r.sw > 40 then
          local label
          if item.grow > 0 and item.delta > 0.5 then
            label = string.format("+%.0f (g:%.0f)", item.delta, item.grow)
          elseif item.delta < -0.5 then
            label = string.format("%.0f (s)", item.delta)
          else
            label = string.format("%.0fpx", item.finalBasis)
          end
          local lw = font:getWidth(label)
          if lw < r.sw - 4 then
            love.graphics.setColor(FP_TEXT_COLOR)
            love.graphics.print(label, r.sx + 2, barY - fh - 1)
          end
        end
      else
        -- Column: vertical bar at right of child rect
        local barX = r.sx + r.sw - barW - 1

        love.graphics.setColor(FP_BASIS_COLOR)
        love.graphics.rectangle("fill", barX, r.sy, barW, r.sh)

        -- Delta portion overlay
        if math.abs(item.delta) > 0.5 then
          local deltaFrac = math.abs(item.delta) / fi.mainSize
          local deltaH = math.max(2, r.sh * deltaFrac * itemCount)
          deltaH = math.min(deltaH, r.sh)
          if item.delta > 0 then
            love.graphics.setColor(FP_GROW_COLOR)
            love.graphics.rectangle("fill", barX, r.sy + r.sh - deltaH, barW, deltaH)
          else
            love.graphics.setColor(FP_SHRINK_COLOR)
            love.graphics.rectangle("fill", barX, r.sy + r.sh - deltaH, barW, deltaH)
          end
        end

        -- Label if tall enough
        if r.sh > 40 and r.sw > 30 then
          local label
          if item.grow > 0 and item.delta > 0.5 then
            label = string.format("+%.0f", item.delta)
          elseif item.delta < -0.5 then
            label = string.format("%.0f", item.delta)
          else
            label = string.format("%.0f", item.finalBasis)
          end
          love.graphics.setColor(FP_TEXT_COLOR)
          love.graphics.print(label, barX - font:getWidth(label) - 2, r.sy + 2)
        end
      end

      ::continueItem::
    end

    ::continueLine::
  end
end

--- Draw the wireframe tab content.
local function drawWireframeTab(root, region)
  if not root then return end

  -- Detect tree rebuild (HMR) — root node ID changes when tree is torn down
  local rootId = root.id
  if wfLastRootId and rootId ~= wfLastRootId then
    wfHoverNode = nil
    wfNodeRects = {}
  end
  wfLastRootId = rootId

  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  -- Dark background for the viewport area
  love.graphics.setColor(WF_BG_COLOR)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)

  -- Use the root node's computed size as the viewport — this is what the
  -- layout engine actually used, regardless of window resize or panel docking.
  local appW, appH
  if root.computed and root.computed.w > 0 and root.computed.h > 0 then
    appW = root.computed.w
    appH = root.computed.h
  else
    appW, appH = love.graphics.getDimensions()
  end

  if appW <= 0 or appH <= 0 then
    love.graphics.setScissor()
    return
  end

  -- Compute scale to fit app viewport into the wireframe region with padding
  local pad = 16
  local availW = region.w - pad * 2
  local availH = region.h - pad * 2
  if availW <= 0 or availH <= 0 then
    love.graphics.setScissor()
    return
  end

  local scaleX = availW / appW
  local scaleY = availH / appH
  local scale = math.min(scaleX, scaleY)

  -- Center the viewport representation in the region
  local scaledW = appW * scale
  local scaledH = appH * scale
  local offX = region.x + pad + math.floor((availW - scaledW) / 2)
  local offY = region.y + pad + math.floor((availH - scaledH) / 2)

  -- Draw viewport border
  love.graphics.setColor(WF_VIEWPORT_BORDER)
  love.graphics.rectangle("line", offX - 1, offY - 1, scaledW + 2, scaledH + 2)

  -- Clear hit test rects and rebuild during draw
  wfNodeRects = {}

  -- Draw all nodes recursively
  love.graphics.setLineWidth(1)
  drawWfNode(root, scale, offX, offY, 0)

  -- Flex pressure overlay
  local flexHasOverlay = false
  if wfShowFlex and inspector then
    local selNode = inspector.getSelectedNode()
    if selNode then
      local c = selNode.computed
      if c and c.flexInfo then
        flexHasOverlay = true
        drawFlexOverlay(selNode, scale, offX, offY, region)
      end
    end
  end

  -- Bottom bar: scale label + flex toggle
  local font = getFont()
  love.graphics.setFont(font)
  local fh = font:getHeight()
  local bottomY = region.y + region.h - fh - 10

  -- Flex toggle pill button (left side)
  local flexLabel = wfShowFlex and "\xe2\x97\x8f Flex" or "\xe2\x97\x8b Flex"  -- ● / ○
  local flexTw = font:getWidth(flexLabel)
  local pillPadX, pillPadY = 8, 3
  local pillX = region.x + 8
  local pillY = bottomY - pillPadY
  local pillW = flexTw + pillPadX * 2
  local pillH = fh + pillPadY * 2

  -- Check hover for visual feedback
  local mx, my = love.mouse.getPosition()
  local isFlexHover = mx >= pillX and mx < pillX + pillW and my >= pillY and my < pillY + pillH

  if wfShowFlex then
    -- Active: solid amber pill
    love.graphics.setColor(0.95, 0.75, 0.20, isFlexHover and 0.45 or 0.30)
    love.graphics.rectangle("fill", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(0.95, 0.75, 0.20, 0.90)
    love.graphics.rectangle("line", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(0.95, 0.85, 0.40, 1)
  else
    -- Inactive: ghost pill
    love.graphics.setColor(0.30, 0.30, 0.35, isFlexHover and 0.20 or 0.05)
    love.graphics.rectangle("fill", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(0.35, 0.35, 0.40, 0.35)
    love.graphics.rectangle("line", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(0.45, 0.45, 0.50, 0.50)
  end
  love.graphics.print(flexLabel, pillX + pillPadX, bottomY)

  -- Hint when flex is on but no overlay is showing
  if wfShowFlex and not flexHasOverlay then
    local hint = "click a flex container to see distribution"
    local hintW = font:getWidth(hint)
    local hintX = pillX + pillW + 10
    love.graphics.setColor(0.55, 0.55, 0.60, 0.50)
    love.graphics.print(hint, hintX, bottomY)
  end

  -- Store flex toggle hit rect for click handling
  state._wfFlexToggle = { x = pillX, y = pillY, w = pillW, h = pillH }

  -- Scale label (right side)
  love.graphics.setColor(STATUS_TEXT)
  local scaleLabel = string.format("%.0f%%", scale * 100)
  local labelW = font:getWidth(scaleLabel)
  love.graphics.print(scaleLabel, region.x + region.w - labelW - 8, bottomY)

  love.graphics.setScissor()
end

--- Hit test wireframe tab: find the deepest (last-drawn) node under the cursor.
wireframeHitTest = function(x, y)
  -- Walk in reverse order (last drawn = frontmost / deepest)
  for i = #wfNodeRects, 1, -1 do
    local r = wfNodeRects[i]
    if x >= r.sx and x < r.sx + r.sw and y >= r.sy and y < r.sy + r.sh then
      return r.node
    end
  end
  return nil
end

-- ============================================================================
-- Perf tab: frame budget, sparkline, node timing, mutations, memory
-- ============================================================================

-- Frame history ring buffer (120 entries = ~2s at 60fps)
local PERF_HISTORY_SIZE = 120
local perfHistory = {}    -- array of { layoutMs, paintMs, totalMs }
local perfHistoryIdx = 0  -- next write index (wraps)
-- perfScrollY is forward-declared near other scroll state (line ~555)

-- Mutation stats accumulator (polled per frame)
local lastMutationStats = { total = 0, creates = 0, updates = 0, removes = 0 }

-- Display refresh throttle — controls how often the visible numbers update.
-- Ring buffer always records at full rate; this only gates the displayed snapshot.
local PERF_RATE_PRESETS = { 0, 0.1, 0.25, 0.5, 1.0, 2.0 }  -- seconds (0 = realtime)
local PERF_RATE_LABELS  = { "RT", "100ms", "250ms", "500ms", "1s", "2s" }
local perfRateIdx = 4  -- default 500ms
local perfLastDisplayUpdate = 0  -- love.timer timestamp of last snapshot
local perfDisplaySnapshot = nil  -- frozen copy of perf data for display

-- Colors for perf tab
local PERF_TAB_BG      = { 0.03, 0.03, 0.06, 1 }
local PERF_BUDGET_BG   = { 0.10, 0.10, 0.16, 1 }
local PERF_BUDGET_FILL = { 0.30, 0.80, 0.40, 0.80 }
local PERF_BUDGET_WARN = { 0.95, 0.75, 0.20, 0.80 }
local PERF_BUDGET_CRIT = { 0.95, 0.40, 0.30, 0.80 }
local PERF_SPARK_LINE  = { 0.38, 0.65, 0.98, 0.80 }
local PERF_SPARK_FILL  = { 0.38, 0.65, 0.98, 0.15 }
local PERF_SPARK_THRESH = { 0.95, 0.40, 0.30, 0.30 }
local PERF_HEADER_COL  = { 0.65, 0.68, 0.75, 1 }
local PERF_LABEL_COL   = { 0.55, 0.58, 0.65, 1 }
local PERF_VALUE_COL   = { 0.88, 0.90, 0.94, 1 }
local PERF_REACTIVE_COL = { 0.95, 0.75, 0.20, 0.80 }
local PERF_HOTSPOT_COL = { 0.95, 0.40, 0.30, 0.90 }
local PERF_STATIC_COL  = { 0.40, 0.55, 0.75, 0.70 }
local PERF_COMP_COL    = { 0.56, 0.68, 0.98, 1 }
local PERF_DIM_COL     = { 0.42, 0.44, 0.52, 0.70 }
local PERF_PROP_COL    = { 0.90, 0.78, 0.35, 0.80 }

--- Record a frame's timing data into the ring buffer.
function DevTools.recordFrame(layoutMs, paintMs)
  perfHistoryIdx = (perfHistoryIdx % PERF_HISTORY_SIZE) + 1
  perfHistory[perfHistoryIdx] = {
    layoutMs = layoutMs or 0,
    paintMs = paintMs or 0,
    totalMs = (layoutMs or 0) + (paintMs or 0),
  }
  -- Poll mutation stats
  if tree and tree.getMutationStats then
    lastMutationStats = tree.getMutationStats()
  end
end

--- Build a comprehensive offender entry from a node.
local function buildOffenderInfo(node)
  local info = {
    node = node,
    name = node.debugName or nil,
    luaType = node.type or "?",
    id = node.id,
    renderCount = node.renderCount or 0,
    layoutMs = (node.computed and node.computed.layoutMs) or 0,
    paintMs = (node.computed and node.computed.paintMs) or 0,
    w = node.computed and math.floor(node.computed.w) or 0,
    h = node.computed and math.floor(node.computed.h) or 0,
    props = {},
    source = node.debugSource,
    handlerCount = 0,
  }
  -- Key style props
  local s = node.style or {}
  if s.flexGrow and s.flexGrow > 0 then info.props[#info.props + 1] = "flexGrow=" .. s.flexGrow end
  if s.flexDirection == "row" then info.props[#info.props + 1] = "row" end
  if s.width then info.props[#info.props + 1] = "w=" .. tostring(s.width) end
  if s.height then info.props[#info.props + 1] = "h=" .. tostring(s.height) end
  if s.overflow then info.props[#info.props + 1] = "overflow=" .. s.overflow end
  -- Handlers
  if node.handlerMeta and type(node.handlerMeta) == "table" then
    for _ in pairs(node.handlerMeta) do info.handlerCount = info.handlerCount + 1 end
  end
  -- Total cost
  info.totalMs = info.layoutMs + info.paintMs
  return info
end

--- Get top offenders sorted by actual time cost (layout + paint), with full info.
local function getTopOffenders(maxCount)
  if not tree then return {} end
  local allNodes = tree.getNodes()
  if not allNodes then return {} end

  local list = {}
  for _, node in pairs(allNodes) do
    if node.type ~= "__TEXT__" and node.computed then
      local cost = (node.computed.layoutMs or 0) + (node.computed.paintMs or 0)
      local rc = node.renderCount or 0
      -- Include if it has measurable cost OR re-renders
      if cost > 0.01 or rc > 1 then
        list[#list + 1] = buildOffenderInfo(node)
      end
    end
  end

  -- Sort by total time cost (highest first)
  table.sort(list, function(a, b) return a.totalMs > b.totalMs end)

  local result = {}
  for i = 1, math.min(maxCount, #list) do
    result[i] = list[i]
  end
  return result
end

--- Draw a labeled value pair inline. Returns new x position.
local function drawLV(font, x, y, label, value, labelCol, valueCol)
  love.graphics.setColor(labelCol)
  love.graphics.print(label, x, y)
  x = x + font:getWidth(label)
  love.graphics.setColor(valueCol)
  love.graphics.print(value, x, y)
  return x + font:getWidth(value) + 16
end

--- Draw the perf tab content.
-- Perf rate selector region (for click detection)
local perfRateRegion = nil  -- { x, y, w, h, segW }

local function drawPerfTab(region)
  local font = getFont()
  love.graphics.setFont(font)
  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  love.graphics.setColor(PERF_TAB_BG)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)

  local fh = font:getHeight()
  local pad = 16
  local x0 = region.x + pad
  local y = region.y + pad - perfScrollY
  local contentW = region.w - pad * 2

  -- == Refresh Rate Selector ==
  local rateBarH = 20
  local rateBarW = #PERF_RATE_PRESETS * 44
  local rateX = region.x + region.w - pad - rateBarW
  local rateY = y

  love.graphics.setColor(PERF_LABEL_COL)
  love.graphics.print("Refresh", x0, rateY + math.floor((rateBarH - fh) / 2))

  love.graphics.setColor(PERF_BUDGET_BG)
  love.graphics.rectangle("fill", rateX, rateY, rateBarW, rateBarH, 3, 3)

  local segW = rateBarW / #PERF_RATE_PRESETS
  for i, label in ipairs(PERF_RATE_LABELS) do
    local sx = rateX + (i - 1) * segW
    if i == perfRateIdx then
      love.graphics.setColor(PERF_SPARK_LINE[1], PERF_SPARK_LINE[2], PERF_SPARK_LINE[3], 0.25)
      love.graphics.rectangle("fill", sx, rateY, segW, rateBarH, 3, 3)
      love.graphics.setColor(PERF_VALUE_COL)
    else
      love.graphics.setColor(PERF_LABEL_COL)
    end
    local lw = font:getWidth(label)
    love.graphics.print(label, sx + math.floor((segW - lw) / 2), rateY + math.floor((rateBarH - fh) / 2))
  end

  -- Store in screen coords (rateY already accounts for scroll)
  perfRateRegion = { x = rateX, y = rateY, w = rateBarW, h = rateBarH, segW = segW }
  y = y + rateBarH + 10

  -- == Throttled display snapshot ==
  local now = love.timer.getTime()
  local interval = PERF_RATE_PRESETS[perfRateIdx]
  local livePerf = inspector and inspector.getPerfData()

  if interval == 0 or not perfDisplaySnapshot or (now - perfLastDisplayUpdate) >= interval then
    if livePerf then
      perfDisplaySnapshot = {
        layoutMs = livePerf.layoutMs,
        paintMs = livePerf.paintMs,
        fps = livePerf.fps,
        nodeCount = livePerf.nodeCount,
      }
      perfLastDisplayUpdate = now
    end
  end

  -- == Frame Budget Bar ==
  local perf = perfDisplaySnapshot
  if perf then
    love.graphics.setColor(PERF_HEADER_COL)
    love.graphics.print("Frame Budget", x0, y)
    y = y + fh + 6

    local frameMs = perf.layoutMs + perf.paintMs
    local budgetMs = 16.6
    local pct = math.min(frameMs / budgetMs, 1.5)

    local barH = 18
    love.graphics.setColor(PERF_BUDGET_BG)
    love.graphics.rectangle("fill", x0, y, contentW, barH, 4, 4)

    local fillW = math.min(pct, 1.0) * contentW
    local barColor = PERF_BUDGET_FILL
    if pct > 0.8 then barColor = PERF_BUDGET_WARN end
    if pct > 1.0 then barColor = PERF_BUDGET_CRIT end
    love.graphics.setColor(barColor)
    love.graphics.rectangle("fill", x0, y, fillW, barH, 4, 4)

    love.graphics.setColor(PERF_VALUE_COL)
    love.graphics.print(string.format("%.1fms / %.1fms  (%.0f%%)", frameMs, budgetMs, pct * 100), x0 + 8, y + math.floor((barH - fh) / 2))
    y = y + barH + 6

    -- Stats row 1: timing + FPS
    local nx = x0
    nx = drawLV(font, nx, y, "Layout ", string.format("%.2fms", perf.layoutMs), PERF_LABEL_COL, PERF_VALUE_COL)
    nx = drawLV(font, nx, y, "Paint ", string.format("%.2fms", perf.paintMs), PERF_LABEL_COL, PERF_VALUE_COL)
    local fpsColor = perf.fps >= 55 and PERF_BUDGET_FILL or (perf.fps >= 30 and PERF_BUDGET_WARN or PERF_BUDGET_CRIT)
    nx = drawLV(font, nx, y, "FPS ", tostring(perf.fps), PERF_LABEL_COL, fpsColor)
    drawLV(font, nx, y, "Nodes ", tostring(perf.nodeCount), PERF_LABEL_COL, PERF_VALUE_COL)
    y = y + fh + 4

    -- Stats row 2: memory + mutations
    local memKB = collectgarbage("count")
    nx = x0
    nx = drawLV(font, nx, y, "Memory ", string.format("%.1f MB", memKB / 1024), PERF_LABEL_COL, PERF_VALUE_COL)
    nx = drawLV(font, nx, y, "Mutations ", tostring(lastMutationStats.total) .. "/frame", PERF_LABEL_COL, PERF_VALUE_COL)
    if lastMutationStats.total > 0 then
      local parts = {}
      if lastMutationStats.creates > 0 then parts[#parts + 1] = "+" .. lastMutationStats.creates end
      if lastMutationStats.updates > 0 then parts[#parts + 1] = "~" .. lastMutationStats.updates end
      if lastMutationStats.removes > 0 then parts[#parts + 1] = "-" .. lastMutationStats.removes end
      love.graphics.setColor(PERF_DIM_COL)
      love.graphics.print("(" .. table.concat(parts, " ") .. ")", nx, y)
    end
    y = y + fh + 16
  end

  -- == Frame Time Sparkline ==
  local histCount = math.min(#perfHistory, PERF_HISTORY_SIZE)
  if histCount > 1 then
    love.graphics.setColor(PERF_HEADER_COL)
    love.graphics.print("Frame Time", x0, y)
    y = y + fh + 6

    local sparkH = 60
    local sparkW = contentW

    love.graphics.setColor(PERF_BUDGET_BG)
    love.graphics.rectangle("fill", x0, y, sparkW, sparkH, 4, 4)

    local maxMs = 20
    local threshY = y + sparkH - (16.6 / maxMs) * sparkH
    love.graphics.setColor(PERF_SPARK_THRESH)
    love.graphics.setLineWidth(1)
    love.graphics.line(x0, threshY, x0 + sparkW, threshY)

    local stepW = sparkW / (PERF_HISTORY_SIZE - 1)
    local points = {}
    local fillPoints = {}

    for i = 1, histCount do
      local idx = ((perfHistoryIdx - histCount + i - 1) % PERF_HISTORY_SIZE) + 1
      local entry = perfHistory[idx]
      local ms = entry and entry.totalMs or 0
      local ptx = x0 + (i - 1) * stepW
      local pty = y + sparkH - math.min(ms / maxMs, 1.0) * sparkH
      points[#points + 1] = ptx
      points[#points + 1] = pty
      fillPoints[#fillPoints + 1] = ptx
      fillPoints[#fillPoints + 1] = pty
    end

    if #fillPoints >= 4 then
      fillPoints[#fillPoints + 1] = fillPoints[#fillPoints - 1]
      fillPoints[#fillPoints + 1] = y + sparkH
      fillPoints[#fillPoints + 1] = fillPoints[1]
      fillPoints[#fillPoints + 1] = y + sparkH
      love.graphics.setColor(PERF_SPARK_FILL)
      pcall(love.graphics.polygon, "fill", fillPoints)
    end
    if #points >= 4 then
      love.graphics.setColor(PERF_SPARK_LINE)
      love.graphics.setLineWidth(1.5)
      love.graphics.line(points)
      love.graphics.setLineWidth(1)
    end

    love.graphics.setColor(PERF_LABEL_COL)
    love.graphics.print("16.6ms", x0 + 4, threshY - fh - 2)
    y = y + sparkH + 16
  end

  -- == Top Offenders (by actual cost) ==
  love.graphics.setColor(PERF_HEADER_COL)
  love.graphics.print("Costliest Nodes (layout + paint time)", x0, y)
  y = y + fh + 8

  local offenders = getTopOffenders(20)
  if #offenders == 0 then
    love.graphics.setColor(PERF_LABEL_COL)
    love.graphics.print("Waiting for frame data...", x0, y)
  else
    for i, info in ipairs(offenders) do
      -- Row 1: rank, component name, lua type, dimensions, total cost
      local rc = info.renderCount
      local rowColor = PERF_STATIC_COL
      if rc > 20 then rowColor = PERF_HOTSPOT_COL
      elseif rc > 1 then rowColor = PERF_REACTIVE_COL end

      -- Rank
      love.graphics.setColor(PERF_LABEL_COL)
      love.graphics.print(string.format("%2d.", i), x0, y)
      local nx = x0 + font:getWidth("00. ")

      -- Component name (bright) or lua type
      if info.name then
        love.graphics.setColor(PERF_COMP_COL)
        love.graphics.print(info.name, nx, y)
        nx = nx + font:getWidth(info.name)
        -- Lua type as dim badge
        love.graphics.setColor(PERF_DIM_COL)
        love.graphics.print(" [" .. info.luaType .. "]", nx, y)
        nx = nx + font:getWidth(" [" .. info.luaType .. "]")
      else
        love.graphics.setColor(PERF_VALUE_COL)
        love.graphics.print(info.luaType, nx, y)
        nx = nx + font:getWidth(info.luaType)
      end

      -- #id
      love.graphics.setColor(PERF_DIM_COL)
      love.graphics.print(" #" .. info.id, nx, y)
      nx = nx + font:getWidth(" #" .. info.id)

      -- Right side: total cost
      local costStr = string.format("%.2fms", info.totalMs)
      local costW = font:getWidth(costStr)
      love.graphics.setColor(rowColor)
      love.graphics.print(costStr, x0 + contentW - costW, y)

      y = y + fh + 2

      -- Row 2: detailed breakdown
      nx = x0 + font:getWidth("00. ")
      love.graphics.setColor(PERF_DIM_COL)

      local details = {}
      details[#details + 1] = info.w .. "x" .. info.h
      details[#details + 1] = "layout:" .. string.format("%.2fms", info.layoutMs)
      details[#details + 1] = "paint:" .. string.format("%.2fms", info.paintMs)
      details[#details + 1] = "renders:" .. rc
      if info.handlerCount > 0 then
        details[#details + 1] = "handlers:" .. info.handlerCount
      end
      if #info.props > 0 then
        details[#details + 1] = table.concat(info.props, " ")
      end

      local detailStr = table.concat(details, "  ")
      love.graphics.print(detailStr, nx, y)

      -- Row 3: source file (if available)
      if info.source and info.source.fileName then
        y = y + fh + 1
        love.graphics.setColor(PERF_DIM_COL)
        local srcStr = info.source.fileName
        if info.source.lineNumber then
          srcStr = srcStr .. ":" .. info.source.lineNumber
        end
        -- Truncate long paths — show last 2 segments
        local parts = {}
        for part in srcStr:gmatch("[^/]+") do parts[#parts + 1] = part end
        if #parts > 2 then
          srcStr = ".../" .. parts[#parts - 1] .. "/" .. parts[#parts]
        end
        love.graphics.print(srcStr, nx, y)
      end

      y = y + fh + 6
    end
  end

  local perfContentH = (y - region.y) + perfScrollY
  -- Store for scrollbar interaction
  perfRegion = region
  perfContentHStored = perfContentH
  drawScrollbar(region.x, region.y, region.w, region.h, perfScrollY, perfContentH)
  love.graphics.setScissor()
end

perfWheelmoved = function(x, y)
  -- Map horizontal tilt to vertical scroll (page-like) when no vertical input
  local dy = y
  if dy == 0 and x ~= 0 then dy = x end
  perfScrollY = math.max(0, perfScrollY - dy * 20)
  return true
end

-- ============================================================================
-- Logs tab: channel toggle grid
-- ============================================================================

-- Sorted channel list (built once, stable order)
local sortedChannels = nil
local function getSortedChannels()
  if not sortedChannels then
    sortedChannels = {}
    for name in pairs(Log.CHANNELS) do
      sortedChannels[#sortedChannels + 1] = name
    end
    table.sort(sortedChannels)
  end
  return sortedChannels
end

-- Layout constants for the logs tab
local LOG_ROW_H     = 32
local LOG_TOGGLE_W  = 40
local LOG_PAD_X     = 16
local LOG_PAD_Y     = 12
local LOG_HEADER_H  = 36
local LOG_BTN_H     = 28
local LOG_BTN_PAD   = 6

-- Colors for logs tab
local LOG_TAB_BG    = { 0.03, 0.03, 0.06, 1 }
local LOG_ON_BG     = { 0.15, 0.30, 0.20, 1 }
local LOG_ON_DOT    = { 0.30, 0.85, 0.40, 1 }
local LOG_OFF_BG    = { 0.12, 0.12, 0.18, 1 }
local LOG_OFF_DOT   = { 0.35, 0.35, 0.45, 1 }
local LOG_NAME      = { 0.88, 0.90, 0.94, 1 }
local LOG_DESC      = { 0.50, 0.52, 0.58, 1 }
local LOG_HEADER_TXT = { 0.65, 0.68, 0.75, 1 }
local LOG_BTN_BG    = { 0.12, 0.12, 0.18, 1 }
local LOG_BTN_TEXT  = { 0.55, 0.58, 0.65, 1 }
local LOG_BTN_HOVER = { 0.18, 0.22, 0.32, 1 }
local LOG_DIVIDER   = { 0.18, 0.18, 0.25, 1 }

--- Toggle a channel (handles JS-side sync for recon/dispatch).
local function toggleChannel(name)
  Log.toggle(name)
  local jsChannels = { recon = true, dispatch = true }
  if jsChannels[name] and bridge then
    pcall(function() bridge:eval("if(typeof __debugLog!=='undefined')__debugLog.toggle('" .. name .. "')") end)
  end
end

--- Draw the logs tab content.
local function drawLogsTab(region)
  local font = getFont()
  love.graphics.setFont(font)
  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  -- Opaque background (matches perf tab)
  love.graphics.setColor(LOG_TAB_BG)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)

  local channels = getSortedChannels()
  local fh = font:getHeight()
  local x0 = region.x + LOG_PAD_X
  local y0 = region.y + LOG_PAD_Y - logsScrollY

  -- Header
  love.graphics.setColor(LOG_HEADER_TXT)
  love.graphics.print("Debug Log Channels", x0, y0 + math.floor((LOG_HEADER_H - fh) / 2))

  -- All / None buttons (right-aligned in header)
  local btnW = font:getWidth("All") + 16
  local noneW = font:getWidth("None") + 16
  local btnY = y0 + math.floor((LOG_HEADER_H - LOG_BTN_H) / 2)
  local noneX = region.x + region.w - LOG_PAD_X - noneW
  local allX = noneX - btnW - LOG_BTN_PAD

  -- "All" button
  love.graphics.setColor(logsHoverRow == "all" and LOG_BTN_HOVER or LOG_BTN_BG)
  love.graphics.rectangle("fill", allX, btnY, btnW, LOG_BTN_H, 4, 4)
  love.graphics.setColor(LOG_BTN_TEXT)
  love.graphics.print("All", allX + 8, btnY + math.floor((LOG_BTN_H - fh) / 2))

  -- "None" button
  love.graphics.setColor(logsHoverRow == "none" and LOG_BTN_HOVER or LOG_BTN_BG)
  love.graphics.rectangle("fill", noneX, btnY, noneW, LOG_BTN_H, 4, 4)
  love.graphics.setColor(LOG_BTN_TEXT)
  love.graphics.print("None", noneX + 8, btnY + math.floor((LOG_BTN_H - fh) / 2))

  -- Channel rows
  local rowY = y0 + LOG_HEADER_H

  for i, name in ipairs(channels) do
    local chDef = Log.CHANNELS[name]
    local isOn = Log.isOn(name)
    local isHovered = logsHoverRow == i

    -- Row background (subtle highlight on hover)
    if isHovered then
      love.graphics.setColor(0.10, 0.12, 0.18, 1)
      love.graphics.rectangle("fill", region.x, rowY, region.w, LOG_ROW_H)
    end

    -- Toggle pill
    local pillX = x0
    local pillY = rowY + math.floor((LOG_ROW_H - 18) / 2)
    local pillW = LOG_TOGGLE_W
    local pillH = 18
    local pillR = 9

    love.graphics.setColor(isOn and LOG_ON_BG or LOG_OFF_BG)
    love.graphics.rectangle("fill", pillX, pillY, pillW, pillH, pillR, pillR)

    -- Toggle dot
    local dotR = 6
    local dotX = isOn and (pillX + pillW - dotR - 4) or (pillX + dotR + 4)
    local dotY = pillY + pillH / 2
    love.graphics.setColor(isOn and LOG_ON_DOT or LOG_OFF_DOT)
    love.graphics.circle("fill", dotX, dotY, dotR)

    -- Channel name (use channel's own color when on)
    local nameX = pillX + pillW + 12
    love.graphics.setColor(isOn and chDef.color or LOG_NAME)
    love.graphics.print(name, nameX, rowY + math.floor((LOG_ROW_H - fh) / 2))

    -- Description
    local descX = nameX + font:getWidth(name) + 16
    love.graphics.setColor(LOG_DESC)
    local desc = chDef.desc
    -- Truncate if too long
    local maxDescW = region.x + region.w - descX - LOG_PAD_X
    if maxDescW > 0 then
      while font:getWidth(desc) > maxDescW and #desc > 3 do
        desc = desc:sub(1, -2)
      end
      love.graphics.print(desc, descX, rowY + math.floor((LOG_ROW_H - fh) / 2))
    end

    rowY = rowY + LOG_ROW_H
  end

  -- ── HMR Settings section ──
  rowY = rowY + 8
  love.graphics.setColor(LOG_DIVIDER)
  love.graphics.rectangle("fill", x0, rowY, region.w - LOG_PAD_X * 2, 1)
  rowY = rowY + 8

  love.graphics.setColor(LOG_HEADER_TXT)
  love.graphics.print("HMR Settings", x0, rowY + math.floor((LOG_HEADER_H - fh) / 2))
  rowY = rowY + LOG_HEADER_H

  -- HMR State Preservation toggle
  local hmrOn = HotState.isEnabled()
  local hmrIsHovered = logsHoverRow == "hmr_state"

  if hmrIsHovered then
    love.graphics.setColor(0.10, 0.12, 0.18, 1)
    love.graphics.rectangle("fill", region.x, rowY, region.w, LOG_ROW_H)
  end

  local hmrPillX = x0
  local hmrPillY = rowY + math.floor((LOG_ROW_H - 18) / 2)
  local hmrPillW = LOG_TOGGLE_W
  local hmrPillH = 18
  local hmrPillR = 9

  love.graphics.setColor(hmrOn and LOG_ON_BG or LOG_OFF_BG)
  love.graphics.rectangle("fill", hmrPillX, hmrPillY, hmrPillW, hmrPillH, hmrPillR, hmrPillR)

  local hmrDotR = 6
  local hmrDotX = hmrOn and (hmrPillX + hmrPillW - hmrDotR - 4) or (hmrPillX + hmrDotR + 4)
  local hmrDotY = hmrPillY + hmrPillH / 2
  love.graphics.setColor(hmrOn and LOG_ON_DOT or LOG_OFF_DOT)
  love.graphics.circle("fill", hmrDotX, hmrDotY, hmrDotR)

  local hmrNameX = hmrPillX + hmrPillW + 12
  love.graphics.setColor(hmrOn and { 0.38, 0.82, 0.98, 1 } or LOG_NAME)
  love.graphics.print("State Preservation", hmrNameX, rowY + math.floor((LOG_ROW_H - fh) / 2))

  local hmrDescX = hmrNameX + font:getWidth("State Preservation") + 16
  love.graphics.setColor(LOG_DESC)
  local hmrDesc = hmrOn and "useState survives hot reload" or "useState resets on hot reload"
  local hmrMaxW = region.x + region.w - hmrDescX - LOG_PAD_X
  if hmrMaxW > 0 then
    love.graphics.print(hmrDesc, hmrDescX, rowY + math.floor((LOG_ROW_H - fh) / 2))
  end

  rowY = rowY + LOG_ROW_H

  -- Hint at bottom
  local hintY = rowY + 8
  if hintY + fh < region.y + region.h + logsScrollY then
    love.graphics.setColor(0.35, 0.38, 0.45, 1)
    love.graphics.print("Tip: REACTJIT_DEBUG=tree,layout love love  (enable at startup)", x0, hintY)
    love.graphics.print("Output goes to terminal AND console tab", x0, hintY + fh + 2)
  end

  local logsContentH = LOG_PAD_Y + LOG_HEADER_H + #channels * LOG_ROW_H + 16 + 1 + 8 + LOG_HEADER_H + LOG_ROW_H + 30
  logsContentHStored = logsContentH
  drawScrollbar(region.x, region.y, region.w, region.h, logsScrollY, logsContentH)
  love.graphics.setScissor()
end

--- Handle click on logs tab. Returns true if consumed.
logsMousepressed = function(x, y, button, region)
  if button ~= 1 then return false end
  if x < region.x or x > region.x + region.w then return false end
  if y < region.y or y > region.y + region.h then return false end

  local font = getFont()
  local fh = font:getHeight()
  local x0 = region.x + LOG_PAD_X
  local y0 = region.y + LOG_PAD_Y - logsScrollY
  local channels = getSortedChannels()

  -- Check All/None buttons
  local btnW = font:getWidth("All") + 16
  local noneW = font:getWidth("None") + 16
  local btnY = y0 + math.floor((LOG_HEADER_H - LOG_BTN_H) / 2)
  local noneX = region.x + region.w - LOG_PAD_X - noneW
  local allX = noneX - btnW - LOG_BTN_PAD

  if y >= btnY and y < btnY + LOG_BTN_H then
    if x >= allX and x < allX + btnW then
      Log.all(true)
      if bridge then
        pcall(function() bridge:eval("if(typeof __debugLog!=='undefined')__debugLog.all(true)") end)
      end
      return true
    end
    if x >= noneX and x < noneX + noneW then
      Log.all(false)
      if bridge then
        pcall(function() bridge:eval("if(typeof __debugLog!=='undefined')__debugLog.all(false)") end)
      end
      return true
    end
  end

  -- Check channel rows
  local rowY = y0 + LOG_HEADER_H
  for i, name in ipairs(channels) do
    if y >= rowY and y < rowY + LOG_ROW_H then
      toggleChannel(name)
      return true
    end
    rowY = rowY + LOG_ROW_H
  end

  -- HMR Settings section: divider(8+1+8) + header(LOG_HEADER_H) + toggle row
  local hmrRowY = rowY + 8 + 1 + 8 + LOG_HEADER_H
  if y >= hmrRowY and y < hmrRowY + LOG_ROW_H then
    HotState.setEnabled(not HotState.isEnabled())
    if bridge then
      if HotState.isEnabled() then
        pcall(function() bridge:eval("if(typeof __enableStatePreservation==='function')__enableStatePreservation()") end)
      else
        pcall(function() bridge:eval("if(typeof __disableStatePreservation==='function')__disableStatePreservation()") end)
      end
    end
    return true
  end

  return true
end

--- Handle mouse movement on logs tab for hover effects.
logsMousemoved = function(x, y, region)
  logsHoverRow = nil
  if not region then return end
  if x < region.x or x > region.x + region.w then return end
  if y < region.y or y > region.y + region.h then return end

  local font = getFont()
  local y0 = region.y + LOG_PAD_Y - logsScrollY
  local channels = getSortedChannels()

  -- Check All/None buttons
  local btnW = font:getWidth("All") + 16
  local noneW = font:getWidth("None") + 16
  local btnY = y0 + math.floor((LOG_HEADER_H - LOG_BTN_H) / 2)
  local noneX = region.x + region.w - LOG_PAD_X - noneW
  local allX = noneX - btnW - LOG_BTN_PAD

  if y >= btnY and y < btnY + LOG_BTN_H then
    if x >= allX and x < allX + btnW then
      logsHoverRow = "all"; return
    end
    if x >= noneX and x < noneX + noneW then
      logsHoverRow = "none"; return
    end
  end

  -- Check channel rows
  local rowY = y0 + LOG_HEADER_H
  for i, name in ipairs(channels) do
    if y >= rowY and y < rowY + LOG_ROW_H then
      logsHoverRow = i; return
    end
    rowY = rowY + LOG_ROW_H
  end

  -- HMR Settings toggle row
  local hmrRowY = rowY + 8 + 1 + 8 + LOG_HEADER_H
  if y >= hmrRowY and y < hmrRowY + LOG_ROW_H then
    logsHoverRow = "hmr_state"; return
  end
end

--- Handle wheel scroll on logs tab.
logsWheelmoved = function(x, y)
  -- Map horizontal tilt to vertical scroll when no vertical input
  local dy = y
  if dy == 0 and x ~= 0 then dy = x end
  logsScrollY = math.max(0, logsScrollY - dy * 20)
  -- Clamp to content height (use stored value from drawLogsTab)
  if logsRegion and logsContentHStored > 0 then
    local maxScroll = math.max(0, logsContentHStored - logsRegion.h)
    logsScrollY = math.min(logsScrollY, maxScroll)
  end
  return true
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

  -- Right-side buttons: refresh, pop-out, close
  local btnY = panelY + math.floor((TAB_BAR_H - font:getHeight()) / 2)

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
    drawWireframeTab(root, { x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "perf" then
    drawPerfTab({ x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "console" then
    console.drawInRegion({ x = 0, y = contentY, w = screenW, h = contentH })

  elseif state.activeTab == "logs" then
    logsRegion = { x = 0, y = contentY, w = screenW, h = contentH }
    drawLogsTab(logsRegion)
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
