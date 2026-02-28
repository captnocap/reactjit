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
  -- Pop-out window state
  poppedOut    = false,     -- devtools panel in its own window?
  windowEntry  = nil,       -- WM window entry when popped out
  mainHasFocus = true,      -- true when main window has focus (false → devtools window)
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
  { id = "elements", label = "Elements" },
  { id = "console",  label = "Console" },
  { id = "logs",     label = "Logs" },
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
--- When popped out, uses devtools window dimensions (panel fills entire window).
local function getPanelGeometry()
  if state.poppedOut and state.windowEntry then
    local screenW = state.windowEntry.width
    local screenH = state.windowEntry.height
    local panelH = screenH
    local panelY = 0
    local contentY = TAB_BAR_H
    local contentH = panelH - TAB_BAR_H - STATUS_BAR_H
    return panelY, panelH, contentY, contentH, screenW
  end
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

--- Return the available viewport height (screen height minus panel when open).
--- Used by init.lua to pass reduced height to layout.layout().
--- When popped out, the panel is in its own window — full height available.
function DevTools.getViewportHeight()
  if not state.open then return love.graphics.getHeight() end
  if state.poppedOut then return love.graphics.getHeight() end
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
-- Pop-out window management
-- ============================================================================

local WM = nil  -- lazy-loaded window manager

local function getWM()
  if not WM then
    local ok, mod = pcall(require, "lua.window_manager")
    if ok then WM = mod end
  end
  return WM
end

--- Pop the devtools panel out into a separate window.
function DevTools.popOut()
  if state.poppedOut then return end
  local wm = getWM()
  if not wm then
    io.write("[devtools] cannot pop out: window manager not available\n"); io.flush()
    return
  end

  state.windowEntry = wm.create({ title = "DevTools", width = 800, height = 500 })
  if not state.windowEntry then
    io.write("[devtools] failed to create devtools window\n"); io.flush()
    return
  end

  state.poppedOut = true
  -- Main app gets full viewport back
  if tree then tree.markDirty() end
  pushViewportEvent()
  io.write("[devtools] popped out to window #" .. state.windowEntry.id .. "\n"); io.flush()
end

--- Dock the devtools panel back into the main window.
function DevTools.dockBack()
  if not state.poppedOut then return end
  local wm = getWM()

  if wm and state.windowEntry then
    wm.destroy(state.windowEntry.id)
  end

  state.poppedOut = false
  state.windowEntry = nil
  state.mainHasFocus = true
  -- Main app loses viewport space to the docked panel
  if tree then tree.markDirty() end
  pushViewportEvent()
  io.write("[devtools] docked back to main window\n"); io.flush()
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

--- Get the WM window entry for the devtools window (used by init.lua for GL context switching).
function DevTools.getWindowEntry()
  return state.windowEntry
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

-- ============================================================================
-- Input handling
-- ============================================================================

--- Handle keypress. Returns true if consumed.
function DevTools.keypressed(key)
  -- Ctrl+Shift+P: toggle pop-out (Ctrl+Shift+D reserved for canvas clipboard dump)
  if key == "p" and love.keyboard.isDown("lctrl", "rctrl") and love.keyboard.isDown("lshift", "rshift") then
    DevTools.togglePopOut()
    return true
  end

  -- F12: toggle devtools
  if key == "f12" then
    if state.poppedOut then
      -- Dock back first, then close
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
        inspector.enable()
      else
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

-- Forward declaration (defined after DevTools.mousepressed, called within it)
local logsMousepressed

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
  elseif state.activeTab == "console" then
    return true  -- console content area consumes clicks
  elseif state.activeTab == "logs" then
    local region = { x = 0, y = contentY, w = screenW, h = contentH }
    return logsMousepressed(x, y, button, region)
  end

  return true
end

--- Handle mouse movement.
function DevTools.mousemoved(x, y)
  if not inspector then return end

  -- When popped out and main has focus: only track hover overlays on canvas
  if state.poppedOut and state.mainHasFocus then
    inspector.mousemoved(x, y)
    return
  end

  -- Divider dragging (uses devtools window coordinates when popped out)
  if state.draggingDivider then
    local _, _, _, _, screenW = getPanelGeometry()
    local clamped = math.max(MIN_TREE_W, math.min(x, screenW - MIN_DETAIL_W))
    state.dividerRatio = clamped / screenW
    return
  end

  -- Resize cursor when hovering divider
  if state.open and state.activeTab == "elements" and inspector.getSelectedNode() then
    local panelY, _, _, _, screenW = getPanelGeometry()
    local treeW = math.floor(screenW * state.dividerRatio)
    if y > panelY and math.abs(x - treeW) <= DIVIDER_W then
      love.mouse.setCursor(love.mouse.getSystemCursor("sizewe"))
    else
      love.mouse.setCursor()
    end
  end

  -- Logs tab hover tracking
  if state.open and state.activeTab == "logs" and logsRegion then
    logsMousemoved(x, y, logsRegion)
  else
    logsHoverRow = nil
  end

  -- Inspector tracks mouse for hover overlays (only when main is focused, not devtools)
  if not state.poppedOut or state.mainHasFocus then
    inspector.mousemoved(x, y)
  end
end

--- Handle mouse release. Returns true if consumed.
function DevTools.mousereleased(x, y, button)
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
  elseif state.activeTab == "console" then
    return console.wheelmoved(x, y)
  elseif state.activeTab == "logs" then
    return logsWheelmoved(x, y)
  end

  return false
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

-- Track which button is hovered for visual feedback
local logsHoverRow = nil  -- index into sortedChannels, or "all"/"none"
local logsScrollY  = 0

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

  -- Hint at bottom
  local hintY = rowY + 8
  if hintY + fh < region.y + region.h + logsScrollY then
    love.graphics.setColor(0.35, 0.38, 0.45, 1)
    love.graphics.print("Tip: ILOVEREACT_DEBUG=tree,layout love love  (enable at startup)", x0, hintY)
    love.graphics.print("Output goes to terminal AND console tab", x0, hintY + fh + 2)
  end

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

  return true
end

--- Handle mouse movement on logs tab for hover effects.
local function logsMousemoved(x, y, region)
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
end

--- Handle wheel scroll on logs tab.
local function logsWheelmoved(x, y)
  logsScrollY = math.max(0, logsScrollY - y * 20)
  return true
end

-- Store current logs tab region for mousemoved (needs geometry from draw)
local logsRegion = nil

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

  -- Pop-out / dock-back button (right side, before close)
  local popoutX = screenW - 52
  local popoutY = panelY + math.floor((TAB_BAR_H - font:getHeight()) / 2)
  love.graphics.setColor(TAB_TEXT)
  -- Arrow icons: pop-out arrow when docked, dock-back arrow when popped out
  love.graphics.print(state.poppedOut and ">" or "<", popoutX + 4, popoutY)

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

--- Draw the devtools panel into the devtools window's GL context.
--- Called by init.lua after WM.activate(devtoolsEntry).
function DevTools.drawInWindow(root)
  if not state.open or not state.poppedOut then return end
  -- Sync dimensions: GL context is active for the devtools window,
  -- so love.graphics.getDimensions() returns its size.
  local w, h = love.graphics.getDimensions()
  if state.windowEntry then
    state.windowEntry.width = w
    state.windowEntry.height = h
  end
  drawPanelContent(root)
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
