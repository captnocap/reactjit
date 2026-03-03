--[[
  contextmenu.lua -- Right-click context menu (Lua-owned interaction)

  Global singleton that handles:
    - Right-click detection and menu opening
    - Context-aware item generation (Copy when text selected, Select All on text nodes)
    - Custom items from ContextMenu React ancestors
    - Mouse/keyboard interaction (hover, click, arrow keys, Enter, Escape)
    - Rendering (dark panel, items, hover highlight, separators)

  Follows the "inverse pattern": Lua owns ALL interaction state. JS only
  receives boundary events (contextmenu:select, contextmenu:open, contextmenu:close).

  Requires: measure.lua, events.lua, textselection.lua (injected via init)
]]

local ContextMenu = {}

local Measure       = nil
local Events        = nil
local TextSelection = nil
local Inspector     = nil
local DevToolsRef   = nil
local AppActions    = nil
local ShortcutHints = nil

function ContextMenu.init(config)
  config = config or {}
  Measure       = config.measure
  Events        = config.events
  TextSelection = config.textselection
  Inspector     = config.inspector
  DevToolsRef   = config.devtools
  AppActions    = config.actions or {}
  ShortcutHints = config.shortcuts or {}
end

-- ============================================================================
-- State
-- ============================================================================

local state = nil
-- {
--   x           = number,    -- screen x of top-left corner
--   y           = number,    -- screen y of top-left corner
--   items       = table,     -- array of { label, action, disabled, separator }
--   hoverIndex  = number,    -- 1-based index of highlighted item (0 = none)
--   hitNode     = node|nil,  -- the node that was right-clicked
--   textNode    = node|nil,  -- the Text node under cursor (if any)
--   contextMenuNode = node|nil, -- nearest ContextMenu ancestor (if any)
--   selectedText = string|nil,  -- text that was selected when menu opened
--   pushEvent   = function,  -- bridge push function (injected on open)
-- }

-- ============================================================================
-- Visual constants
-- ============================================================================

local FONT_SIZE     = 13
local ITEM_HEIGHT   = 28
local SEPARATOR_H   = 9
local PADDING_X     = 6
local PADDING_Y     = 4
local TEXT_PADDING_X = 10
local MIN_WIDTH     = 160
local BORDER_RADIUS = 6

-- Colors (catppuccin-adjacent dark)
local BG_COLOR       = { 0.12, 0.12, 0.16, 0.95 }
local BORDER_COLOR   = { 0.25, 0.25, 0.32, 0.8 }
local TEXT_COLOR     = { 0.85, 0.87, 0.91, 1.0 }
local DISABLED_COLOR = { 0.45, 0.47, 0.50, 1.0 }
local SHORTCUT_COLOR = { 0.57, 0.60, 0.66, 1.0 }
local HOVER_COLOR    = { 0.22, 0.35, 0.55, 0.55 }
local SEPARATOR_COLOR = { 0.25, 0.25, 0.32, 0.5 }
local SHORTCUT_GAP   = 24

-- ============================================================================
-- Helpers
-- ============================================================================

--- Walk up from a node to find the nearest ContextMenu ancestor.
local function findContextMenuAncestor(node)
  local current = node
  while current do
    if current.type == "ContextMenu" then return current end
    current = current.parent
  end
  return nil
end

local function normalizeShortcut(value)
  if value == nil then return nil end
  local s = tostring(value)
  if s == "" then return nil end
  return s
end

--- Build the items list based on context.
--- Combines built-in items (Copy) with custom items from ContextMenu ancestors.
--- Always produces at least one item so the menu is never empty.
local function buildItems(hitNode, textNode, root)
  local items = {}
  local sel = TextSelection and TextSelection.get()
  local hasSelection = sel and sel.text

  -- Built-in: Inspect — opens inspector on the right-clicked node (top of menu)
  if Inspector then
    items[#items + 1] = {
      label = "Inspect",
      action = "__inspect",
      disabled = false,
    }
    items[#items + 1] = { separator = true }
  end

  -- Built-in: Copy — always present, disabled when no selection
  items[#items + 1] = {
    label = "Copy",
    action = "__copy",
    disabled = not hasSelection,
  }

  -- Custom items from nearest ContextMenu ancestor
  local cmNode = nil
  if hitNode then
    cmNode = findContextMenuAncestor(hitNode)
  end
  if not cmNode and textNode then
    cmNode = findContextMenuAncestor(textNode)
  end

  -- Custom items from nearest ContextMenu ancestor
  if cmNode and cmNode.props and cmNode.props.items then
    local customItems = cmNode.props.items
    -- Add separator before custom items if we have built-in items
    if #items > 0 and #customItems > 0 then
      items[#items + 1] = { separator = true }
    end
    for _, item in ipairs(customItems) do
      items[#items + 1] = {
        label = item.label or "",
        action = item.action or "",
        disabled = item.disabled or false,
        separator = item.separator or false,
        shortcut = normalizeShortcut(item.shortcut),
      }
    end
  end

  local appItems = {}
  if AppActions then
    if AppActions.refresh then
      appItems[#appItems + 1] = {
        label = "Refresh",
        action = "__refresh",
        disabled = false,
        shortcut = normalizeShortcut(ShortcutHints and ShortcutHints.refresh or nil),
      }
    end
    if AppActions.screenshot then
      appItems[#appItems + 1] = {
        label = "Screenshot",
        action = "__screenshot",
        disabled = false,
        shortcut = normalizeShortcut(ShortcutHints and ShortcutHints.screenshot or nil),
      }
    end
    if AppActions.toggleThemeMenu then
      appItems[#appItems + 1] = {
        label = "Theme Menu",
        action = "__theme_menu",
        disabled = false,
        shortcut = normalizeShortcut(ShortcutHints and ShortcutHints.themeMenu or nil),
      }
    end
    if AppActions.toggleSettings then
      appItems[#appItems + 1] = {
        label = "Settings",
        action = "__settings_menu",
        disabled = false,
        shortcut = normalizeShortcut(ShortcutHints and ShortcutHints.settings or nil),
      }
    end
    if AppActions.toggleSystemPanel then
      appItems[#appItems + 1] = {
        label = "System Panel",
        action = "__system_panel",
        disabled = false,
        shortcut = normalizeShortcut(ShortcutHints and ShortcutHints.systemPanel or nil),
      }
    end
    if AppActions.toggleLayoutColors then
      local colorizer = require("lua.layout_colorizer")
      appItems[#appItems + 1] = {
        label = colorizer.active and "Layout Colors  ON" or "Layout Colors",
        action = "__layout_colors",
        disabled = false,
        shortcut = normalizeShortcut(ShortcutHints and ShortcutHints.layoutColors or nil),
      }
    end
  end

  if #appItems > 0 then
    items[#items + 1] = { separator = true }
    for _, item in ipairs(appItems) do
      items[#items + 1] = item
    end
  end


  return items, cmNode
end

--- Get the font for menu items.
local function getFont()
  if Measure then
    return Measure.getFont(FONT_SIZE)
  end
  return love.graphics.getFont()
end

--- Calculate menu dimensions based on items.
local function calcMenuSize(items, font)
  local maxW = MIN_WIDTH
  for _, item in ipairs(items) do
    if not item.separator then
      local labelW = font:getWidth(item.label)
      local shortcutText = normalizeShortcut(item.shortcut)
      local shortcutW = shortcutText and font:getWidth(shortcutText) or 0
      local w = labelW + TEXT_PADDING_X * 2
      if shortcutW > 0 then
        w = w + SHORTCUT_GAP + shortcutW
      end
      if w > maxW then maxW = w end
    end
  end

  local totalH = PADDING_Y * 2
  for _, item in ipairs(items) do
    if item.separator then
      totalH = totalH + SEPARATOR_H
    else
      totalH = totalH + ITEM_HEIGHT
    end
  end

  return maxW + PADDING_X * 2, totalH
end

--- Clamp menu position to stay within the viewport.
local function clampPosition(x, y, w, h)
  local screenW, screenH = love.graphics.getDimensions()
  if x + w > screenW then x = screenW - w end
  if y + h > screenH then y = screenH - h end
  if x < 0 then x = 0 end
  if y < 0 then y = 0 end
  return x, y
end

--- Get the item index at screen position (mx, my), or 0 if none.
local function itemIndexAt(mx, my)
  if not state then return 0 end

  local font = getFont()
  local menuW, menuH = calcMenuSize(state.items, font)

  -- Check bounds
  if mx < state.x or mx > state.x + menuW then return 0 end
  if my < state.y or my > state.y + menuH then return 0 end

  local curY = state.y + PADDING_Y
  for i, item in ipairs(state.items) do
    local itemH = item.separator and SEPARATOR_H or ITEM_HEIGHT
    if my >= curY and my < curY + itemH then
      if item.separator then return 0 end
      return i
    end
    curY = curY + itemH
  end
  return 0
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Open the context menu at (x, y). Called from init.lua on right-click.
--- @param x number Screen x position
--- @param y number Screen y position
--- @param root table The tree root node
--- @param pushEventFn function Bridge push function for boundary events
function ContextMenu.open(x, y, root, pushEventFn)
  io.write("[contextmenu] open() called at " .. x .. ", " .. y .. "\n"); io.flush()

  -- Find what's under the cursor
  local hitNode = Events and Events.hitTest(root, x, y) or nil
  local textNode = Events and Events.textHitTest(root, x, y) or nil

  io.write("[contextmenu] hitNode=" .. tostring(hitNode and hitNode.type) .. " textNode=" .. tostring(textNode and textNode.type) .. "\n"); io.flush()

  -- Resolve __TEXT__ to parent Text
  if textNode and textNode.type == "__TEXT__" and textNode.parent then
    textNode = textNode.parent
  end

  -- Build items
  local items, cmNode = buildItems(hitNode, textNode, root)

  io.write("[contextmenu] items=" .. #items .. " cmNode=" .. tostring(cmNode and cmNode.type) .. "\n"); io.flush()

  -- If no items at all, don't open
  if #items == 0 then
    io.write("[contextmenu] BAILING: items=0 — no text node and no ContextMenu ancestor. hitNode=" .. tostring(hitNode) .. " textNode=" .. tostring(textNode) .. "\n"); io.flush()
    return false
  end

  -- Calculate menu dimensions and clamp to viewport
  local font = getFont()
  local menuW, menuH = calcMenuSize(items, font)
  local mx, my = clampPosition(x, y, menuW, menuH)

  -- Get selected text info
  local sel = TextSelection and TextSelection.get()
  local selectedText = sel and sel.text or nil

  state = {
    x = mx,
    y = my,
    items = items,
    hoverIndex = 0,
    hitNode = hitNode,
    textNode = textNode,
    contextMenuNode = cmNode,
    selectedText = selectedText,
    pushEvent = pushEventFn,
  }

  io.write("[contextmenu] state SET — menu at " .. mx .. "," .. my .. " size=" .. menuW .. "x" .. menuH .. " items=" .. #items .. "\n"); io.flush()

  -- Fire open boundary event
  if cmNode and pushEventFn then
    pushEventFn({
      type = "contextmenu:open",
      payload = {
        type = "contextmenu:open",
        targetId = cmNode.id,
      },
    })
  end

  return true
end

--- Close the context menu.
function ContextMenu.close()
  if not state then return end

  local cmNode = state.contextMenuNode
  local pushEventFn = state.pushEvent

  state = nil

  -- Fire close boundary event
  if cmNode and pushEventFn then
    pushEventFn({
      type = "contextmenu:close",
      payload = {
        type = "contextmenu:close",
        targetId = cmNode.id,
      },
    })
  end
end

--- Check if the context menu is currently open.
function ContextMenu.isOpen()
  return state ~= nil
end

--- Select the item at the given index.
local function selectItem(index)
  if not state then return end
  local item = state.items[index]
  if not item or item.separator or item.disabled then return end

  local action = item.action
  local cmNode = state.contextMenuNode
  local pushEventFn = state.pushEvent
  local selectedText = state.selectedText
  local hitNodeId = state.hitNode and state.hitNode.id

  -- Execute built-in actions directly in Lua (no bridge round-trip)
  if action == "__copy" then
    if TextSelection then
      TextSelection.copyToClipboard()
    end
  elseif action == "__refresh" then
    if AppActions and AppActions.refresh then
      pcall(AppActions.refresh)
    end
  elseif action == "__screenshot" then
    if AppActions and AppActions.screenshot then
      pcall(AppActions.screenshot)
    end
  elseif action == "__theme_menu" then
    if AppActions and AppActions.toggleThemeMenu then
      pcall(AppActions.toggleThemeMenu)
    end
  elseif action == "__settings_menu" then
    if AppActions and AppActions.toggleSettings then
      pcall(AppActions.toggleSettings)
    end
  elseif action == "__system_panel" then
    if AppActions and AppActions.toggleSystemPanel then
      pcall(AppActions.toggleSystemPanel)
    end
  elseif action == "__inspector_toggle" then
    if AppActions and AppActions.toggleDevTools then
      pcall(AppActions.toggleDevTools)
    end
  elseif action == "__layout_colors" then
    if AppActions and AppActions.toggleLayoutColors then
      pcall(AppActions.toggleLayoutColors)
    end
  elseif action == "__inspect" then
    -- Prefer the most specific node: textNode > hitNode
    local target = state.textNode or state.hitNode
    if DevToolsRef then
      -- Open devtools to Elements tab with node selected
      DevToolsRef.inspectNode(target)
    elseif Inspector then
      -- Fallback: direct inspector call
      Inspector.inspectNode(target)
    end
  end

  -- Fire select boundary event (for both built-in and custom actions)
  if cmNode and pushEventFn then
    pushEventFn({
      type = "contextmenu:select",
      payload = {
        type = "contextmenu:select",
        targetId = cmNode.id,
        action = action,
        contextTargetId = hitNodeId,
        hasSelection = selectedText ~= nil,
        selectedText = selectedText,
      },
    })
  end

  ContextMenu.close()
end

--- Handle mouse press. Returns true if consumed.
function ContextMenu.handleMousePressed(x, y, button)
  if not state then return false end

  io.write("[contextmenu] handleMousePressed at " .. x .. "," .. y .. " button=" .. button .. "\n"); io.flush()
  local index = itemIndexAt(x, y)
  io.write("[contextmenu] itemIndexAt=" .. index .. "\n"); io.flush()
  if index > 0 then
    selectItem(index)
    return true
  end

  -- Click outside menu: close
  ContextMenu.close()
  return true
end

--- Handle mouse movement. Updates hover highlight.
function ContextMenu.handleMouseMoved(x, y)
  if not state then return false end

  local index = itemIndexAt(x, y)
  if state.hoverIndex ~= index then
    state.hoverIndex = index
  end
  return true
end

--- Handle key press. Returns true if consumed.
function ContextMenu.handleKeyPressed(key)
  if not state then return false end

  if key == "escape" then
    ContextMenu.close()
    return true
  end

  if key == "return" or key == "kpenter" then
    if state.hoverIndex > 0 then
      selectItem(state.hoverIndex)
    end
    return true
  end

  if key == "up" then
    -- Move highlight up, skipping separators and disabled items
    local idx = state.hoverIndex
    if idx <= 0 then idx = #state.items + 1 end
    for _ = 1, #state.items do
      idx = idx - 1
      if idx < 1 then idx = #state.items end
      local item = state.items[idx]
      if not item.separator and not item.disabled then
        state.hoverIndex = idx
        break
      end
    end
    return true
  end

  if key == "down" then
    -- Move highlight down, skipping separators and disabled items
    local idx = state.hoverIndex
    if idx <= 0 then idx = 0 end
    for _ = 1, #state.items do
      idx = idx + 1
      if idx > #state.items then idx = 1 end
      local item = state.items[idx]
      if not item.separator and not item.disabled then
        state.hoverIndex = idx
        break
      end
    end
    return true
  end

  return true  -- consume all keys while menu is open
end

-- ============================================================================
-- Rendering
-- ============================================================================

--- Draw the context menu overlay.
function ContextMenu.draw()
  if not state then return end

  if not state._loggedDraw then
    state._loggedDraw = true
    io.write("[contextmenu] draw() called — pos=" .. state.x .. "," .. state.y .. " items=" .. #state.items .. "\n"); io.flush()
  end

  local font = getFont()
  local menuW, menuH = calcMenuSize(state.items, font)
  local x, y = state.x, state.y

  -- Save graphics state
  local prevFont = love.graphics.getFont()
  love.graphics.setFont(font)

  -- Background with rounded corners
  love.graphics.setColor(BG_COLOR)
  love.graphics.rectangle("fill", x, y, menuW, menuH, BORDER_RADIUS, BORDER_RADIUS)

  -- Border
  love.graphics.setColor(BORDER_COLOR)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", x, y, menuW, menuH, BORDER_RADIUS, BORDER_RADIUS)

  -- Items
  local curY = y + PADDING_Y
  for i, item in ipairs(state.items) do
    if item.separator then
      -- Draw separator line
      local sepY = curY + math.floor(SEPARATOR_H / 2)
      love.graphics.setColor(SEPARATOR_COLOR)
      love.graphics.line(x + PADDING_X + 4, sepY, x + menuW - PADDING_X - 4, sepY)
      curY = curY + SEPARATOR_H
    else
      -- Hover highlight
      if i == state.hoverIndex and not item.disabled then
        love.graphics.setColor(HOVER_COLOR)
        -- Inset the highlight slightly from the panel edges
        local hlX = x + PADDING_X
        local hlW = menuW - PADDING_X * 2
        local hlR = BORDER_RADIUS - 2
        if hlR < 0 then hlR = 0 end
        love.graphics.rectangle("fill", hlX, curY, hlW, ITEM_HEIGHT, hlR, hlR)
      end

      -- Label text
      if item.disabled then
        love.graphics.setColor(DISABLED_COLOR)
      else
        love.graphics.setColor(TEXT_COLOR)
      end

      local textY = curY + math.floor((ITEM_HEIGHT - font:getHeight()) / 2)
      love.graphics.print(item.label, x + PADDING_X + TEXT_PADDING_X, textY)

      local shortcutText = normalizeShortcut(item.shortcut)
      if shortcutText then
        love.graphics.setColor(SHORTCUT_COLOR)
        local shortcutX = x + menuW - PADDING_X - TEXT_PADDING_X - font:getWidth(shortcutText)
        love.graphics.print(shortcutText, shortcutX, textY)
      end

      curY = curY + ITEM_HEIGHT
    end
  end

  -- Restore font
  love.graphics.setFont(prevFont)
end

return ContextMenu
