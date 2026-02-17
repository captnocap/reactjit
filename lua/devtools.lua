--[[
  devtools.lua -- Unified Chrome-style bottom panel with tabs

  Combines the inspector (Elements tab) and console (Console tab) into
  a single bottom panel with a tab bar. Canvas overlays (hover highlight,
  selected outline, tooltip, perf bar) always render on the main canvas
  regardless of which tab is active.

  Usage:
    local devtools = require("lua.devtools")
    devtools.init({ inspector = inspector, console = console })
    -- In love.keypressed:  if devtools.keypressed(key) then return end
    -- In love.mousepressed: if devtools.mousepressed(x, y, btn) then return end
    -- In love.mousemoved:   devtools.mousemoved(x, y)
    -- In love.wheelmoved:   if devtools.wheelmoved(x, y) then return end
    -- In love.textinput:    if devtools.textinput(text) then return end
    -- In love.draw:         devtools.draw(root)

  Controls:
    F12     -- Toggle devtools open/closed
    `       -- Switch to Console tab (opens devtools if closed)
    Escape  -- Close devtools (or clear selection first in Elements tab)
]]

local DevTools = {}

-- ============================================================================
-- Dependencies (injected via init)
-- ============================================================================

local inspector = nil
local console   = nil
local tree      = nil

-- ============================================================================
-- State
-- ============================================================================

local state = {
  open      = false,
  activeTab = "elements",  -- "elements" or "console"
}

-- ============================================================================
-- Visual constants
-- ============================================================================

local TAB_BAR_H    = 26
local STATUS_BAR_H = 22
local MIN_PANEL_H  = 200
local PANEL_RATIO  = 0.4   -- 40% of screen height

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
local STATUS_BG    = { 0.06, 0.06, 0.11, 1 }
local STATUS_TEXT  = { 0.55, 0.58, 0.65, 1 }
local STATUS_GOOD  = { 0.30, 0.80, 0.40, 1 }
local STATUS_WARN  = { 0.95, 0.75, 0.20, 1 }

-- Tab definitions
local TABS = {
  { id = "elements", label = "Elements" },
  { id = "console",  label = "Console" },
}

-- Cached font (created lazily)
local fontSmall = nil
local function getFont()
  if not fontSmall then fontSmall = love.graphics.newFont(11) end
  return fontSmall
end

-- ============================================================================
-- Geometry helpers
-- ============================================================================

--- Compute panel geometry based on current screen size.
--- Returns panelY, panelH, contentY, contentH, screenW
local function getPanelGeometry()
  local screenW, screenH = love.graphics.getDimensions()
  local panelH = math.max(MIN_PANEL_H, math.floor(screenH * PANEL_RATIO))
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
  state.pushEvent = config.pushEvent
end

function DevTools.isOpen()
  return state.open
end

--- Return the available viewport height (screen height minus panel when open).
--- Used by init.lua to pass reduced height to layout.layout().
function DevTools.getViewportHeight()
  if not state.open then return love.graphics.getHeight() end
  local screenH = love.graphics.getHeight()
  local panelH = math.max(MIN_PANEL_H, math.floor(screenH * PANEL_RATIO))
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
-- Input handling
-- ============================================================================

--- Handle keypress. Returns true if consumed.
function DevTools.keypressed(key)
  -- F12: toggle devtools
  if key == "f12" then
    state.open = not state.open
    if state.open then
      inspector.enable()
    else
      inspector.disable()
      console.hide()
    end
    -- Relayout: viewport height changed
    if tree then tree.markDirty() end
    pushViewportEvent()
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

  -- Escape: clear selection first, then close devtools
  if key == "escape" then
    if state.activeTab == "elements" and inspector.getSelectedNode() then
      inspector.clearSelection()
      return true
    end
    -- Close devtools
    state.open = false
    inspector.disable()
    console.hide()
    if tree then tree.markDirty() end
    pushViewportEvent()
    return true
  end

  -- Route to active tab
  if state.activeTab == "console" then
    return console.keypressed(key)
  elseif state.activeTab == "elements" then
    -- Elements tab: Escape already handled above, other keys not used
    return false
  end

  return false
end

--- Handle text input. Returns true if consumed.
function DevTools.textinput(text)
  if not state.open then return false end

  if state.activeTab == "console" then
    return console.textinput(text)
  end

  return false
end

--- Handle mouse press. Returns true if consumed.
function DevTools.mousepressed(x, y, button)
  if not state.open then
    -- Even when panel is closed, inspector handles viewport clicks
    -- for node selection (if enabled via F12 previously... but in devtools
    -- mode, enabled = open, so this won't happen). Return false.
    return false
  end

  local panelY, panelH, contentY, contentH, screenW = getPanelGeometry()

  -- Click above the panel: route to inspector for viewport node selection
  if y < panelY then
    return inspector.mousepressed(x, y, button)
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

    -- Close button (right side of tab bar)
    local closeX = screenW - 28
    if x >= closeX and x < closeX + 20 then
      state.open = false
      inspector.disable()
      console.hide()
      if tree then tree.markDirty() end
      return true
    end

    return true  -- consumed by tab bar even if no tab hit
  end

  -- Content area click: route to active tab
  if state.activeTab == "elements" then
    -- Inspector handles tree/detail region clicks via stored regions
    return inspector.mousepressed(x, y, button)
  elseif state.activeTab == "console" then
    return true  -- console content area consumes clicks
  end

  return true
end

--- Handle mouse movement.
function DevTools.mousemoved(x, y)
  if not inspector then return end
  -- Inspector always tracks mouse for hover overlays
  inspector.mousemoved(x, y)
end

--- Handle mouse wheel. Returns true if consumed.
function DevTools.wheelmoved(x, y)
  if not state.open then return false end

  local panelY = getPanelGeometry()
  local mx, my = love.mouse.getPosition()

  -- Only handle wheel when mouse is in the panel area
  if my < panelY then return false end

  if state.activeTab == "elements" then
    return inspector.wheelmoved(x, y)
  elseif state.activeTab == "console" then
    return console.wheelmoved(x, y)
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

  -- Close button (x) on the right
  local closeX = screenW - 28
  local closeY = panelY + math.floor((TAB_BAR_H - font:getHeight()) / 2)
  love.graphics.setColor(CLOSE_COLOR)
  love.graphics.print("x", closeX + 4, closeY)
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

--- Main draw call. Renders overlays + panel (if open).
--- Call this from love.draw() after painting the UI tree.
function DevTools.draw(root)
  -- Always draw inspector overlays when enabled (hover, selected, tooltip, perf)
  if inspector and inspector.isEnabled() then
    inspector.drawOverlays(root)
  end

  if not state.open then return end

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
    -- Split: tree on left, detail on right (50/50, or tree-only if no selection)
    if inspector.getSelectedNode() then
      local treeW = math.floor(screenW * 0.5)
      local detailX = treeW
      local detailW = screenW - treeW
      inspector.drawTreeInRegion(root, { x = 0, y = contentY, w = treeW, h = contentH })
      inspector.drawDetailInRegion({ x = detailX, y = contentY, w = detailW, h = contentH })
    else
      -- No selection: tree takes full width
      inspector.drawTreeInRegion(root, { x = 0, y = contentY, w = screenW, h = contentH })
    end

  elseif state.activeTab == "console" then
    console.drawInRegion({ x = 0, y = contentY, w = screenW, h = contentH })
  end

  -- Status bar (bottom of panel)
  local statusY = panelY + panelH - STATUS_BAR_H
  drawStatusBar(statusY, screenW)

  -- Restore graphics state
  love.graphics.pop()
end

-- ============================================================================
-- Devtools-aware context menu integration
-- ============================================================================

--- Open devtools to Elements tab and select a specific node.
--- Used by context menu "Inspect" action.
function DevTools.inspectNode(node)
  if not node then return end
  state.open = true
  state.activeTab = "elements"
  inspector.inspectNode(node)
end

return DevTools
