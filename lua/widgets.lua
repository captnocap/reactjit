--[[
  widgets.lua — Unified registry and dispatch for Lua-owned interactive widgets

  Centralizes the type→module mapping for Slider, Fader, Knob, Switch, Checkbox,
  Radio, and Select.  init.lua uses this to drain events, dispatch mouse input,
  and initialize all widget modules in one call.  events.lua uses isLuaInteractive()
  for hit testing instead of a hardcoded type whitelist.

  Adding a new widget: add one entry to the `entries` table in Widgets.init().
  That's it — drain, dispatch, and hit testing all pick it up automatically.
]]

local Widgets = {}

-- Registry: typeName -> { mod, stateKey, dragField }
-- stateKey:  node field that holds per-instance state (e.g. "_slider")
-- dragField: field inside stateKey that indicates active interaction (e.g. "isDragging")
-- Both are optional — widgets without them skip release/move tree scans.
local registry = {}

-- Ordered list of registered type names (for deterministic drain order)
local widgetTypes = {}

-- ============================================================================
-- Initialization
-- ============================================================================

--- Require, init, and register all widget modules.
--- @param deps table  { measure = <measure module> }
function Widgets.init(deps)
  local measure = deps.measure

  local entries = {
    { type = "Slider",   mod = "lua.slider",   stateKey = "_slider",  dragField = "isDragging" },
    { type = "Fader",    mod = "lua.fader",     stateKey = "_fader",   dragField = "isDragging" },
    { type = "Knob",     mod = "lua.knob",      stateKey = "_knob",    dragField = "isDragging" },
    { type = "Switch",   mod = "lua.switch"     },
    { type = "Checkbox", mod = "lua.checkbox"   },
    { type = "Radio",    mod = "lua.radio"      },
    { type = "Select",   mod = "lua.select",    stateKey = "_select",  dragField = "isOpen" },
  }

  for _, entry in ipairs(entries) do
    local m = require(entry.mod)
    m.init({ measure = measure })
    registry[entry.type] = {
      mod       = m,
      stateKey  = entry.stateKey,
      dragField = entry.dragField,
    }
    widgetTypes[#widgetTypes + 1] = entry.type
  end
end

-- ============================================================================
-- Queries
-- ============================================================================

--- Check if a node type is a registered Lua-owned widget.
--- Used by events.lua for hit testing.
--- @param typeName string
--- @return boolean
function Widgets.isLuaInteractive(typeName)
  return registry[typeName] ~= nil
end

--- Get the module for a widget type (or nil).
--- @param typeName string
--- @return table|nil
function Widgets.getModule(typeName)
  local entry = registry[typeName]
  return entry and entry.mod
end

-- ============================================================================
-- Event draining (called once per frame from init.lua update loop)
-- ============================================================================

--- Drain queued events from all widget modules and push them to the bridge.
--- Replaces 8 identical drain blocks that were copy-pasted in init.lua.
--- @param pushEvent function
function Widgets.drainAllEvents(pushEvent)
  for _, typeName in ipairs(widgetTypes) do
    local entry = registry[typeName]
    if entry.mod.drainEvents then
      local evts = entry.mod.drainEvents()
      if evts then
        for i = 1, #evts do
          local evt = evts[i]
          pushEvent({
            type = evt.type,
            payload = {
              type = evt.type,
              targetId = evt.nodeId,
              value = evt.value,
            },
          })
        end
      end
    end
  end
end

-- ============================================================================
-- Mouse dispatch (called from init.lua input handlers)
-- ============================================================================

--- Dispatch mousePressed to the widget that was hit.
--- @param hit table  The hit-tested node
--- @param x number
--- @param y number
--- @param button number
--- @return boolean  true if a widget handled the press
function Widgets.handleMousePressed(hit, x, y, button)
  local entry = registry[hit.type]
  if entry and entry.mod.handleMousePressed then
    entry.mod.handleMousePressed(hit, x, y, button)
    return true
  end
  return false
end

--- Dispatch mouseReleased to all widgets with active state.
--- Scans the full node tree once (mouse may have left widget bounds during drag).
--- @param treeModule table  The tree.lua module
--- @param x number
--- @param y number
--- @param button number
function Widgets.handleMouseReleased(treeModule, x, y, button)
  if not treeModule then return end
  local nodes = treeModule.getNodes()
  if not nodes then return end
  for _, node in pairs(nodes) do
    local entry = registry[node.type]
    if entry and entry.stateKey and node[entry.stateKey] and entry.mod.handleMouseReleased then
      entry.mod.handleMouseReleased(node, x, y, button)
    end
  end
end

--- Dispatch mouseMoved to all widgets with active drag/open state.
--- Scans the full node tree once (drag may extend outside widget bounds).
--- @param treeModule table  The tree.lua module
--- @param x number
--- @param y number
function Widgets.handleMouseMoved(treeModule, x, y)
  if not treeModule then return end
  local nodes = treeModule.getNodes()
  if not nodes then return end
  for _, node in pairs(nodes) do
    local entry = registry[node.type]
    if entry and entry.stateKey and entry.dragField and entry.mod.handleMouseMoved then
      local state = node[entry.stateKey]
      if state and state[entry.dragField] then
        entry.mod.handleMouseMoved(node, x, y)
      end
    end
  end
end

return Widgets
