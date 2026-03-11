--[[
  gamepad_maps.lua — Controller profiles and button/axis → action mappings.

  Each profile maps SDL GameController button/axis names to semantic actions.
  The system panel (F11) lets the user pick a profile per controller and
  override individual bindings.

  Actions:
    navigate_up, navigate_down, navigate_left, navigate_right
    confirm, back, menu             (menu opens system panel / F11)
    group_prev, group_next          (shoulder-style focus group cycling)
    panel_prev, panel_next          (cycle F9-F12 panels via triggers)
    scroll_up, scroll_down, scroll_left, scroll_right  (discrete scroll)
    navigate_x, navigate_y          (analog stick → focus navigation)
    scroll_x, scroll_y              (analog stick → scroll)

  Usage:
    local maps = require("lua.gamepad_maps")
    maps.init()
    local action = maps.getButtonAction(joystickId, "dpdown")  -- → "navigate_down"
    local action = maps.getAxisAction(joystickId, "righty")     -- → "scroll_y"
    maps.setProfile(joystickId, "n64")
    maps.setButtonOverride(joystickId, "x", "confirm")
]]

local GamepadMaps = {}

-- ============================================================================
-- JSON
-- ============================================================================

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then json = { encode = tostring, decode = function() return {} end } end

-- ============================================================================
-- Built-in profiles
-- ============================================================================

local profiles = {
  xbox = {
    label = "Xbox / Generic",
    buttons = {
      dpup         = "navigate_up",
      dpdown       = "navigate_down",
      dpleft       = "navigate_left",
      dpright      = "navigate_right",
      a            = "confirm",
      b            = "back",
      x            = nil,  -- unbound (app-defined)
      y            = nil,  -- unbound (app-defined)
      leftshoulder = "group_prev",
      rightshoulder= "group_next",
      start        = "menu",
      back         = "menu",
      guide        = nil,
      leftstick    = nil,
      rightstick   = nil,
    },
    axes = {
      leftx        = "navigate_x",
      lefty        = "navigate_y",
      rightx       = "scroll_x",
      righty       = "scroll_y",
      triggerleft  = "panel_prev",
      triggerright  = "panel_next",
    },
  },

  n64 = {
    label = "Nintendo 64",
    buttons = {
      dpup         = "navigate_up",
      dpdown       = "navigate_down",
      dpleft       = "navigate_left",
      dpright      = "navigate_right",
      a            = "confirm",        -- A button
      b            = "back",           -- B button
      x            = "scroll_up",      -- C-up  (SDL maps C-buttons to x/y on most adapters)
      y            = "scroll_down",    -- C-down
      leftshoulder = "group_prev",     -- L trigger
      rightshoulder= "group_next",     -- R trigger
      start        = "menu",
      -- Z trigger maps differently per adapter — some as leftstick, some as back
      leftstick    = "back",           -- Z trigger (common mapping)
      rightstick   = nil,
    },
    axes = {
      leftx        = "navigate_x",    -- Analog stick
      lefty        = "navigate_y",
      -- C-buttons as right stick (some adapters)
      rightx       = "scroll_x",
      righty       = "scroll_y",
      triggerleft  = "panel_prev",
      triggerright  = "panel_next",
    },
  },

  ps = {
    label = "PlayStation",
    buttons = {
      dpup         = "navigate_up",
      dpdown       = "navigate_down",
      dpleft       = "navigate_left",
      dpright      = "navigate_right",
      a            = "confirm",        -- Cross (SDL maps Cross → a)
      b            = "back",           -- Circle
      x            = nil,              -- Square
      y            = nil,              -- Triangle
      leftshoulder = "group_prev",     -- L1
      rightshoulder= "group_next",     -- R1
      start        = "menu",           -- Options
      back         = "menu",           -- Share/Create
      guide        = nil,              -- PS button
      leftstick    = nil,              -- L3
      rightstick   = nil,              -- R3
    },
    axes = {
      leftx        = "navigate_x",
      lefty        = "navigate_y",
      rightx       = "scroll_x",
      righty       = "scroll_y",
      triggerleft  = nil,              -- L2
      triggerright  = nil,             -- R2
    },
  },

  switch = {
    label = "Nintendo Switch",
    buttons = {
      dpup         = "navigate_up",
      dpdown       = "navigate_down",
      dpleft       = "navigate_left",
      dpright      = "navigate_right",
      -- NOTE: Switch A/B are swapped in SDL vs physical layout
      -- SDL "a" = physical B (right), SDL "b" = physical A (bottom)
      -- We map by SDL name, so a=confirm works correctly
      a            = "confirm",
      b            = "back",
      x            = nil,
      y            = nil,
      leftshoulder = "group_prev",     -- L
      rightshoulder= "group_next",     -- R
      start        = "menu",           -- +
      back         = "menu",           -- -
      guide        = nil,              -- Home
      leftstick    = nil,
      rightstick   = nil,
    },
    axes = {
      leftx        = "navigate_x",
      lefty        = "navigate_y",
      rightx       = "scroll_x",
      righty       = "scroll_y",
      triggerleft  = nil,              -- ZL
      triggerright  = nil,             -- ZR
    },
  },
}

-- ============================================================================
-- State
-- ============================================================================

-- Per-controller state: { [joystickId] = { profile = "xbox", overrides = { buttons = {}, axes = {} } } }
local controllerState = {}

local function getOrCreateState(joystickId)
  local id = tostring(joystickId)
  if not controllerState[id] then
    controllerState[id] = {
      profile = "xbox",  -- default
      overrides = { buttons = {}, axes = {} },
    }
  end
  return controllerState[id]
end

-- ============================================================================
-- Persistence
-- ============================================================================

local SAVE_PATH = "save"
local SAVE_FILE = "save/gamepad_maps.json"

local function loadPrefs()
  if love.filesystem.getInfo and not love.filesystem.getInfo(SAVE_FILE) then return end
  local content = love.filesystem.read(SAVE_FILE)
  if not content then return end
  local ok, data = pcall(json.decode, content)
  if not ok or type(data) ~= "table" then return end

  if type(data.controllers) == "table" then
    for id, entry in pairs(data.controllers) do
      controllerState[tostring(id)] = {
        profile = entry.profile or "xbox",
        overrides = {
          buttons = entry.overrides and entry.overrides.buttons or {},
          axes = entry.overrides and entry.overrides.axes or {},
        },
      }
    end
  end
end

local function savePrefs()
  love.filesystem.createDirectory(SAVE_PATH)
  local data = { controllers = controllerState }
  local ok, encoded = pcall(json.encode, data)
  if ok then
    love.filesystem.write(SAVE_FILE, encoded)
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

function GamepadMaps.init()
  loadPrefs()
end

--- Get the action for a button press on a controller.
--- @param joystickId number|string
--- @param button string  SDL button name (e.g. "a", "dpdown", "leftshoulder")
--- @return string|nil  action name or nil if unbound
function GamepadMaps.getButtonAction(joystickId, button)
  local cs = getOrCreateState(joystickId)

  -- Check per-controller overrides first
  if cs.overrides.buttons[button] then
    local override = cs.overrides.buttons[button]
    if override == "__none__" then return nil end  -- explicitly unbound
    return override
  end

  -- Fall back to profile
  local profile = profiles[cs.profile]
  if not profile then profile = profiles.xbox end
  return profile.buttons[button]
end

--- Get the action for an axis on a controller.
--- @param joystickId number|string
--- @param axis string  SDL axis name (e.g. "leftx", "righty")
--- @return string|nil  action name or nil if unbound
function GamepadMaps.getAxisAction(joystickId, axis)
  local cs = getOrCreateState(joystickId)

  if cs.overrides.axes[axis] then
    local override = cs.overrides.axes[axis]
    if override == "__none__" then return nil end
    return override
  end

  local profile = profiles[cs.profile]
  if not profile then profile = profiles.xbox end
  return profile.axes[axis]
end

--- Set the profile for a controller.
--- @param joystickId number|string
--- @param profileName string  "xbox", "n64", "ps", "switch"
function GamepadMaps.setProfile(joystickId, profileName)
  if not profiles[profileName] then return end
  local cs = getOrCreateState(joystickId)
  cs.profile = profileName
  cs.overrides = { buttons = {}, axes = {} }  -- clear overrides when switching profile
  savePrefs()
end

--- Override a single button mapping for a controller.
--- @param joystickId number|string
--- @param button string  SDL button name
--- @param action string|nil  action name, or nil to clear override, or "__none__" to unbind
function GamepadMaps.setButtonOverride(joystickId, button, action)
  local cs = getOrCreateState(joystickId)
  cs.overrides.buttons[button] = action
  savePrefs()
end

--- Override a single axis mapping for a controller.
--- @param joystickId number|string
--- @param axis string  SDL axis name
--- @param action string|nil  action name, or nil to clear override, or "__none__" to unbind
function GamepadMaps.setAxisOverride(joystickId, axis, action)
  local cs = getOrCreateState(joystickId)
  cs.overrides.axes[axis] = action
  savePrefs()
end

--- Get the current profile name for a controller.
--- @param joystickId number|string
--- @return string
function GamepadMaps.getProfile(joystickId)
  local cs = getOrCreateState(joystickId)
  return cs.profile
end

--- Get all available profile names and labels.
--- @return table  { { id = "xbox", label = "Xbox / Generic" }, ... }
function GamepadMaps.getProfiles()
  local result = {}
  for id, profile in pairs(profiles) do
    result[#result + 1] = { id = id, label = profile.label }
  end
  -- Sort alphabetically by label
  table.sort(result, function(a, b) return a.label < b.label end)
  return result
end

--- Get the full resolved mapping for a controller (profile + overrides).
--- Used by the system panel to display the current mapping.
--- @param joystickId number|string
--- @return table  { buttons = { dpup = "navigate_up", ... }, axes = { ... } }
function GamepadMaps.getResolvedMap(joystickId)
  local cs = getOrCreateState(joystickId)
  local profile = profiles[cs.profile] or profiles.xbox

  local resolved = { buttons = {}, axes = {} }

  -- Start with profile defaults
  for btn, action in pairs(profile.buttons) do
    resolved.buttons[btn] = action
  end
  for axis, action in pairs(profile.axes) do
    resolved.axes[axis] = action
  end

  -- Apply overrides
  for btn, action in pairs(cs.overrides.buttons) do
    if action == "__none__" then
      resolved.buttons[btn] = nil
    else
      resolved.buttons[btn] = action
    end
  end
  for axis, action in pairs(cs.overrides.axes) do
    if action == "__none__" then
      resolved.axes[axis] = nil
    else
      resolved.axes[axis] = action
    end
  end

  return resolved
end

--- Get list of all known actions (for the remap UI dropdown).
--- @return table  { "navigate_up", "navigate_down", ... }
function GamepadMaps.getActions()
  return {
    "navigate_up", "navigate_down", "navigate_left", "navigate_right",
    "confirm", "back", "menu",
    "group_prev", "group_next",
    "panel_prev", "panel_next",
    "scroll_up", "scroll_down", "scroll_left", "scroll_right",
    "navigate_x", "navigate_y",
    "scroll_x", "scroll_y",
  }
end

--- Get a human-readable label for an action.
--- @param action string
--- @return string
function GamepadMaps.getActionLabel(action)
  local labels = {
    navigate_up    = "Navigate Up",
    navigate_down  = "Navigate Down",
    navigate_left  = "Navigate Left",
    navigate_right = "Navigate Right",
    confirm        = "Confirm / Click",
    back           = "Back / Escape",
    menu           = "System Panel",
    group_prev     = "Prev Focus Group",
    group_next     = "Next Focus Group",
    panel_prev     = "Prev Panel (F9-F12)",
    panel_next     = "Next Panel (F9-F12)",
    scroll_up      = "Scroll Up",
    scroll_down    = "Scroll Down",
    scroll_left    = "Scroll Left",
    scroll_right   = "Scroll Right",
    navigate_x     = "Nav Stick X",
    navigate_y     = "Nav Stick Y",
    scroll_x       = "Scroll Stick X",
    scroll_y       = "Scroll Stick Y",
  }
  return labels[action] or action
end

--- Expose the raw profiles table (for system panel display).
function GamepadMaps.getRawProfiles()
  return profiles
end

return GamepadMaps
