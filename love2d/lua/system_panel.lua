--[[
  system_panel.lua — User-owned device & permissions manager

  This panel is NON-NEGOTIABLE. Developers cannot disable it.
  It protects the user FROM the developer, not the other way around.

  F11 opens the panel in any ReactJIT application. There is no config flag
  to suppress it, no enable/disable toggle. The user is sovereign over
  their devices and what capabilities an app can exercise.

  Features:
    - Enumerate and block controllers, MIDI, serial, audio devices
    - Assign controllers to player slots
    - Toggle permission categories (clipboard, storage, network, etc.)
    - View blocked attempt counts from the audit log
    - Preferences persist across sessions (save/system_panel.json)

  Usage (wired into init.lua unconditionally):
    local systemPanel = require("lua.system_panel")
    systemPanel.init({ permit = permit, audit = audit })
    -- In love.keypressed:   if systemPanel.keypressed(key) then return end
    -- In love.mousepressed: if systemPanel.mousepressed(x, y, btn) then return end
    -- In love.mousereleased: systemPanel.mousereleased(x, y, btn)
    -- In love.mousemoved:   systemPanel.mousemoved(x, y)
    -- In love.wheelmoved:   if systemPanel.wheelmoved(x, y) then return end
    -- In love.textinput:    if systemPanel.textinput(text) then return end
    -- In love.update:       systemPanel.update(dt)
    -- In love.draw:         if systemPanel.isOpen() then systemPanel.draw() end
]]

local SystemPanel = {}

-- ============================================================================
-- JSON (reuse whatever the host loaded)
-- ============================================================================

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then json = { encode = tostring, decode = function() return {} end } end

-- ============================================================================
-- Dependencies (injected via init)
-- ============================================================================

local permit = nil
local audit = nil
local midi = nil
local audioEngine = nil
local gamepadMaps = nil
local getGamepadButtons = nil
local getGamepadAxes = nil

-- Visual controller diagrams
local ok_visual, gamepadVisual = pcall(require, "lua.gamepad_visual")
if not ok_visual then gamepadVisual = nil end

-- ============================================================================
-- State
-- ============================================================================

local state = {
  open        = false,
  toggleKey   = "f11",

  -- Scroll
  scrollY     = 0,
  maxScrollY  = 0,
  contentH    = 0,

  -- Collapsed sections
  collapsed   = {},  -- { [sectionName] = true }

  -- Hover state
  hoverClose    = false,
  hoverReset    = false,
  hoverItems    = {},    -- { [itemKey] = "block" | "unblock" | "player" | "toggle" }

  -- Layout cache (recomputed each draw)
  panelRect     = nil,
  closeRect     = nil,
  resetRect     = nil,
  itemRects     = {},    -- { [itemKey] = { x, y, w, h, action = "block"|"toggle"|... } }
  sectionRects  = {},    -- { [sectionName] = { x, y, w, h } }

  -- Device state (persisted)
  devices = {
    controllers = {},  -- { [joystickId] = { blocked = false, player = N } }
    midi        = {},  -- { [deviceId] = { blocked = false } }
    serial      = {},  -- { [port] = { blocked = false } }
  },

  -- Permission overrides (persisted)
  permOverrides = {},  -- { [category] = false }  (only false entries matter — blocking)

  -- Audio device selection (persisted)
  audioOut = nil,
  audioIn  = nil,

  -- Persistence
  dirty       = false,
  saveTimer   = 0,

  -- Device rescan timer
  rescanTimer = 0,

  -- Cached device lists (refreshed periodically)
  cachedControllers = {},
  cachedMidi        = {},
  cachedSerial      = {},
  cachedAudioOut    = {},
  cachedAudioIn     = {},

  -- Gamepad remap listen mode
  -- When non-nil, we're waiting for the user to press a button/move an axis
  -- to assign to this action.
  remapListen = nil,  -- { deviceId, action, inputType = "button"|"axis", timeout = 5.0 }
}

-- ============================================================================
-- Visual constants
-- ============================================================================

local PANEL_W_RATIO  = 0.55
local PANEL_H_RATIO  = 0.75
local MIN_PANEL_W    = 420
local MIN_PANEL_H    = 350
local TITLE_BAR_H    = 34
local SECTION_HEAD_H = 30
local ITEM_ROW_H     = 28
local SCROLL_SPEED   = 30
local CORNER_R       = 6
local BTN_H          = 22
local BTN_PAD        = 6
local STATUS_BAR_H   = 22

-- Colors
local C = {
  backdrop    = { 0.00, 0.00, 0.00, 0.50 },
  panelBg     = { 0.06, 0.06, 0.11, 0.97 },
  titleBg     = { 0.08, 0.08, 0.14, 1 },
  titleText   = { 0.88, 0.90, 0.94, 1 },
  border      = { 0.20, 0.20, 0.30, 0.8 },
  sectionBg   = { 0.09, 0.09, 0.14, 1 },
  sectionText = { 0.55, 0.58, 0.65, 1 },
  itemText    = { 0.78, 0.80, 0.86, 1 },
  dimText     = { 0.45, 0.48, 0.55, 1 },
  accent      = { 0.38, 0.65, 0.98, 1 },
  green       = { 0.30, 0.80, 0.40, 1 },
  red         = { 0.90, 0.35, 0.35, 1 },
  orange      = { 0.95, 0.65, 0.20, 1 },
  btnBg       = { 0.12, 0.12, 0.18, 1 },
  btnHover    = { 0.18, 0.18, 0.26, 1 },
  btnBlockBg  = { 0.25, 0.10, 0.10, 1 },
  btnBlockHov = { 0.35, 0.15, 0.15, 1 },
  checkOn     = { 0.38, 0.65, 0.98, 1 },
  checkOff    = { 0.30, 0.30, 0.40, 1 },
  closeNormal = { 0.55, 0.58, 0.65, 1 },
  closeHover  = { 0.95, 0.45, 0.45, 1 },
  scrollbar   = { 0.25, 0.25, 0.35, 0.6 },
  scrollthumb = { 0.40, 0.42, 0.50, 0.8 },
  statusBg    = { 0.06, 0.06, 0.11, 1 },
  statusText  = { 0.45, 0.48, 0.55, 1 },
  chevron     = { 0.45, 0.48, 0.55, 1 },
  playerColors = {
    { 0.38, 0.65, 0.98, 1 },  -- P1 blue
    { 0.90, 0.35, 0.35, 1 },  -- P2 red
    { 0.30, 0.80, 0.40, 1 },  -- P3 green
    { 0.95, 0.80, 0.20, 1 },  -- P4 yellow
  },
}

-- Cached fonts
local fonts = {}
local function getFont(size)
  if not fonts[size] then fonts[size] = love.graphics.newFont(size) end
  return fonts[size]
end

-- ============================================================================
-- Persistence
-- ============================================================================

local SAVE_PATH = "save"
local SAVE_FILE = "save/system_panel.json"

local function loadPrefs()
  if love.filesystem.getInfo and not love.filesystem.getInfo(SAVE_FILE) then return end
  local content = love.filesystem.read(SAVE_FILE)
  if not content then return end
  local ok, data = pcall(json.decode, content)
  if not ok or type(data) ~= "table" then return end

  if type(data.permOverrides) == "table" then
    state.permOverrides = data.permOverrides
  end
  if type(data.blockedDevices) == "table" then
    -- Restore controller blocks
    if type(data.blockedDevices.controllers) == "table" then
      for _, id in ipairs(data.blockedDevices.controllers) do
        state.devices.controllers[tostring(id)] = state.devices.controllers[tostring(id)] or {}
        state.devices.controllers[tostring(id)].blocked = true
      end
    end
    if type(data.blockedDevices.midi) == "table" then
      for _, id in ipairs(data.blockedDevices.midi) do
        state.devices.midi[id] = { blocked = true }
      end
    end
    if type(data.blockedDevices.serial) == "table" then
      for _, port in ipairs(data.blockedDevices.serial) do
        state.devices.serial[port] = { blocked = true }
      end
    end
  end
  if type(data.playerAssignments) == "table" then
    for id, player in pairs(data.playerAssignments) do
      state.devices.controllers[tostring(id)] = state.devices.controllers[tostring(id)] or {}
      state.devices.controllers[tostring(id)].player = player
    end
  end
  if data.audioOut then state.audioOut = data.audioOut end
  if data.audioIn then state.audioIn = data.audioIn end
  if type(data.collapsedSections) == "table" then
    for _, name in ipairs(data.collapsedSections) do
      state.collapsed[name] = true
    end
  end
end

local function savePrefs()
  love.filesystem.createDirectory(SAVE_PATH)

  local blockedControllers = {}
  local playerAssignments = {}
  for id, entry in pairs(state.devices.controllers) do
    if entry.blocked then blockedControllers[#blockedControllers + 1] = id end
    if entry.player then playerAssignments[id] = entry.player end
  end

  local blockedMidi = {}
  for id, entry in pairs(state.devices.midi) do
    if entry.blocked then blockedMidi[#blockedMidi + 1] = id end
  end

  local blockedSerial = {}
  for port, entry in pairs(state.devices.serial) do
    if entry.blocked then blockedSerial[#blockedSerial + 1] = port end
  end

  local collapsedSections = {}
  for name, v in pairs(state.collapsed) do
    if v then collapsedSections[#collapsedSections + 1] = name end
  end

  local data = {
    permOverrides = state.permOverrides,
    blockedDevices = {
      controllers = blockedControllers,
      midi = blockedMidi,
      serial = blockedSerial,
    },
    playerAssignments = playerAssignments,
    audioOut = state.audioOut,
    audioIn = state.audioIn,
    collapsedSections = collapsedSections,
  }

  local ok, encoded = pcall(json.encode, data)
  if ok then
    love.filesystem.write(SAVE_FILE, encoded)
  end
  state.dirty = false
end

local function markDirty()
  state.dirty = true
  state.saveTimer = 0.5
end

-- ============================================================================
-- Device enumeration
-- ============================================================================

local function scanDevices()
  -- Controllers
  state.cachedControllers = {}
  if love.joystick then
    local joysticks = love.joystick.getJoysticks()
    for _, js in ipairs(joysticks) do
      local id = tostring(js:getID())
      state.cachedControllers[#state.cachedControllers + 1] = {
        id = id,
        name = js:getName() or ("Controller " .. id),
        isGamepad = js:isGamepad(),
      }
      -- Ensure entry exists
      if not state.devices.controllers[id] then
        state.devices.controllers[id] = { blocked = false, player = nil }
      end
    end
  end

  -- Auto-assign player numbers to unassigned controllers
  local usedPlayers = {}
  for _, entry in pairs(state.devices.controllers) do
    if entry.player then usedPlayers[entry.player] = true end
  end
  for _, ctrl in ipairs(state.cachedControllers) do
    local entry = state.devices.controllers[ctrl.id]
    if entry and not entry.player then
      for p = 1, 4 do
        if not usedPlayers[p] then
          entry.player = p
          usedPlayers[p] = true
          break
        end
      end
    end
  end

  -- MIDI
  state.cachedMidi = {}
  if midi and midi.getDevices then
    local ok, devs = pcall(midi.getDevices)
    if ok and type(devs) == "table" then
      for _, dev in ipairs(devs) do
        state.cachedMidi[#state.cachedMidi + 1] = {
          id = dev.id,
          name = dev.name,
          connected = dev.connected,
        }
        if not state.devices.midi[dev.id] then
          state.devices.midi[dev.id] = { blocked = false }
        end
      end
    end
  end

  -- Serial ports (scan /dev/)
  state.cachedSerial = {}
  local serialPatterns = { "ttyUSB", "ttyACM", "ttyS" }
  local ok_io, dirHandle = pcall(io.popen, "ls /dev/tty{USB,ACM,S}* 2>/dev/null")
  if ok_io and dirHandle then
    for line in dirHandle:lines() do
      local port = line:match("^(/dev/tty%S+)")
      if port then
        -- Skip ttyS ports > 3 (usually virtual)
        local ttyS = port:match("ttyS(%d+)")
        if not ttyS or tonumber(ttyS) <= 3 then
          state.cachedSerial[#state.cachedSerial + 1] = {
            id = port,
            name = port,
          }
          if not state.devices.serial[port] then
            state.devices.serial[port] = { blocked = false }
          end
        end
      end
    end
    dirHandle:close()
  end

  -- Audio output
  state.cachedAudioOut = {}
  if love.audio and love.audio.getPlaybackDevices then
    local ok2, devs = pcall(love.audio.getPlaybackDevices)
    if ok2 and type(devs) == "table" then
      for _, name in ipairs(devs) do
        state.cachedAudioOut[#state.cachedAudioOut + 1] = name
      end
    end
  end

  -- Audio input
  state.cachedAudioIn = {}
  if love.audio and love.audio.getRecordingDevices then
    local ok2, devs = pcall(love.audio.getRecordingDevices)
    if ok2 and type(devs) == "table" then
      for i, dev in ipairs(devs) do
        state.cachedAudioIn[#state.cachedAudioIn + 1] = {
          id = i,
          name = dev.getName and dev:getName() or ("Input " .. i),
        }
      end
    end
  end
end

-- ============================================================================
-- Panel geometry
-- ============================================================================

local function getPanelRect()
  local sw, sh = love.graphics.getDimensions()
  local pw = math.max(MIN_PANEL_W, math.floor(sw * PANEL_W_RATIO))
  local ph = math.max(MIN_PANEL_H, math.floor(sh * PANEL_H_RATIO))
  local px = math.floor((sw - pw) / 2)
  local py = math.floor((sh - ph) / 2)
  return { x = px, y = py, w = pw, h = ph }
end

local function pointInRect(mx, my, r)
  return r and mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h
end

-- ============================================================================
-- Permission helpers
-- ============================================================================

local PERMISSION_CATEGORIES = {
  { id = "clipboard",  label = "Clipboard" },
  { id = "storage",    label = "Storage" },
  { id = "network",    label = "Network" },
  { id = "filesystem", label = "Filesystem" },
  { id = "gpu",        label = "GPU Compute" },
  { id = "sysmon",     label = "System Monitor" },
  { id = "browse",     label = "Browser" },
  { id = "process",    label = "Processes" },
}

local function isPermAllowed(catId)
  -- User override wins
  if state.permOverrides[catId] == false then return false end
  -- Then check permit system
  if permit and permit.check then
    return permit.check(catId)
  end
  return true  -- no permit system = allow all
end

local function getAuditCount(catId)
  if audit and audit.getBlockedCount then
    return audit.getBlockedCount(catId) or 0
  end
  return 0
end

-- ============================================================================
-- Drawing helpers
-- ============================================================================

local function drawRoundedRect(mode, x, y, w, h, r)
  love.graphics.rectangle(mode, x, y, w, h, r, r)
end

local function drawCheckbox(x, y, size, checked)
  if checked then
    love.graphics.setColor(C.checkOn)
    drawRoundedRect("fill", x, y, size, size, 3)
    -- Checkmark
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setLineWidth(2)
    love.graphics.line(
      x + size * 0.22, y + size * 0.50,
      x + size * 0.42, y + size * 0.72,
      x + size * 0.78, y + size * 0.28
    )
    love.graphics.setLineWidth(1)
  else
    love.graphics.setColor(C.checkOff)
    drawRoundedRect("line", x, y, size, size, 3)
  end
end

local function drawDot(x, y, r, color)
  love.graphics.setColor(color)
  love.graphics.circle("fill", x, y, r)
end

local function drawChevron(x, y, size, collapsed)
  love.graphics.setColor(C.chevron)
  if collapsed then
    -- Right-pointing
    love.graphics.polygon("fill",
      x, y,
      x + size, y + size / 2,
      x, y + size
    )
  else
    -- Down-pointing
    love.graphics.polygon("fill",
      x, y,
      x + size, y,
      x + size / 2, y + size
    )
  end
end

local function drawButton(x, y, w, h, label, hovered, style)
  style = style or "normal"
  local bgColor, textColor
  if style == "block" then
    bgColor = hovered and C.btnBlockHov or C.btnBlockBg
    textColor = C.red
  elseif style == "active" then
    bgColor = hovered and C.btnHover or C.btnBg
    textColor = C.green
  else
    bgColor = hovered and C.btnHover or C.btnBg
    textColor = C.itemText
  end

  love.graphics.setColor(bgColor)
  drawRoundedRect("fill", x, y, w, h, 3)
  love.graphics.setColor(textColor)
  local font = getFont(11)
  love.graphics.setFont(font)
  local tw = font:getWidth(label)
  love.graphics.print(label, math.floor(x + (w - tw) / 2), math.floor(y + (h - font:getHeight()) / 2))

  return { x = x, y = y, w = w, h = h }
end

-- ============================================================================
-- Main draw
-- ============================================================================

function SystemPanel.draw()
  if not state.open then return end

  local sw, sh = love.graphics.getDimensions()
  local pr = getPanelRect()
  state.panelRect = pr

  love.graphics.push("all")
  love.graphics.origin()
  love.graphics.setScissor()

  -- Backdrop
  love.graphics.setColor(C.backdrop)
  love.graphics.rectangle("fill", 0, 0, sw, sh)

  -- Panel background
  love.graphics.setColor(C.panelBg)
  drawRoundedRect("fill", pr.x, pr.y, pr.w, pr.h, CORNER_R)
  love.graphics.setColor(C.border)
  drawRoundedRect("line", pr.x, pr.y, pr.w, pr.h, CORNER_R)

  -- Title bar
  love.graphics.setColor(C.titleBg)
  drawRoundedRect("fill", pr.x, pr.y, pr.w, TITLE_BAR_H, CORNER_R)
  -- Cover bottom corners of title
  love.graphics.rectangle("fill", pr.x, pr.y + TITLE_BAR_H - CORNER_R, pr.w, CORNER_R)

  love.graphics.setColor(C.titleText)
  local titleFont = getFont(14)
  love.graphics.setFont(titleFont)
  love.graphics.print("System", pr.x + 14, pr.y + math.floor((TITLE_BAR_H - titleFont:getHeight()) / 2))

  -- F11 badge
  love.graphics.setColor(C.dimText)
  local badgeFont = getFont(10)
  love.graphics.setFont(badgeFont)
  local badgeText = "F11"
  local badgeW = badgeFont:getWidth(badgeText) + 10
  love.graphics.print(badgeText, pr.x + pr.w - badgeW - 40, pr.y + math.floor((TITLE_BAR_H - badgeFont:getHeight()) / 2))

  -- Close button
  local closeSize = 14
  local closeX = pr.x + pr.w - closeSize - 12
  local closeY = pr.y + math.floor((TITLE_BAR_H - closeSize) / 2)
  state.closeRect = { x = closeX - 4, y = closeY - 4, w = closeSize + 8, h = closeSize + 8 }
  love.graphics.setColor(state.hoverClose and C.closeHover or C.closeNormal)
  love.graphics.setLineWidth(2)
  love.graphics.line(closeX, closeY, closeX + closeSize, closeY + closeSize)
  love.graphics.line(closeX + closeSize, closeY, closeX, closeY + closeSize)
  love.graphics.setLineWidth(1)

  -- Content area (scrollable)
  local contentX = pr.x
  local contentY = pr.y + TITLE_BAR_H
  local contentW = pr.w
  local contentH = pr.h - TITLE_BAR_H - STATUS_BAR_H

  love.graphics.setScissor(contentX, contentY, contentW, contentH)

  local curY = contentY - state.scrollY
  local leftPad = 14
  local rightPad = 14
  local innerW = contentW - leftPad - rightPad

  state.itemRects = {}
  state.sectionRects = {}

  -- ── Section: Controllers ──────────────────────
  curY = drawSection(curY, contentX + leftPad, innerW, "controllers", "CONTROLLERS", function(y, x, w)
    if #state.cachedControllers == 0 then
      love.graphics.setColor(C.dimText)
      love.graphics.setFont(getFont(11))
      love.graphics.print("No controllers connected", x + 20, y + 4)
      return y + ITEM_ROW_H
    end
    for _, ctrl in ipairs(state.cachedControllers) do
      local entry = state.devices.controllers[ctrl.id] or {}
      local blocked = entry.blocked
      local player = entry.player

      -- Status dot
      drawDot(x + 10, y + ITEM_ROW_H / 2, 4, blocked and C.red or C.green)

      -- Name
      love.graphics.setColor(blocked and C.dimText or C.itemText)
      love.graphics.setFont(getFont(12))
      local nameW = math.min(getFont(12):getWidth(ctrl.name), w - 200)
      love.graphics.printf(ctrl.name, x + 22, y + 6, nameW + 10, "left")

      -- Player badge
      if player and not blocked then
        local pLabel = "P" .. player
        local pColor = C.playerColors[player] or C.accent
        love.graphics.setColor(pColor)
        love.graphics.setFont(getFont(11))
        love.graphics.print(pLabel, x + w - 130, y + 6)
      end

      -- Block/Unblock button
      local btnLabel = blocked and "Unblock" or "Block"
      local btnStyle = blocked and "active" or "block"
      local btnW = 58
      local btnX = x + w - btnW
      local btnY = y + (ITEM_ROW_H - BTN_H) / 2
      local key = "ctrl:" .. ctrl.id
      local hovered = state.hoverItems[key] ~= nil
      local rect = drawButton(btnX, btnY, btnW, BTN_H, btnLabel, hovered, btnStyle)
      rect.action = blocked and "unblock" or "block"
      rect.category = "controllers"
      rect.deviceId = ctrl.id
      state.itemRects[key] = rect

      y = y + ITEM_ROW_H

      -- Controller type selector + button mapping (only if not blocked and gamepadMaps available)
      if not blocked and gamepadMaps then
        local currentProfile = gamepadMaps.getProfile(ctrl.id)
        local profiles = gamepadMaps.getProfiles()

        -- Profile selector row
        love.graphics.setColor(C.dimText)
        love.graphics.setFont(getFont(10))
        love.graphics.print("Type:", x + 22, y + 5)

        local profX = x + 60
        for _, prof in ipairs(profiles) do
          local isActive = (prof.id == currentProfile)
          local profKey = "profile:" .. ctrl.id .. ":" .. prof.id
          local profHovered = state.hoverItems[profKey] ~= nil
          local profW = getFont(10):getWidth(prof.label) + 12
          local profBtnStyle = isActive and "active" or "normal"
          local profRect = drawButton(profX, y + 2, profW, BTN_H - 2, prof.label, profHovered, profBtnStyle)
          profRect.action = "set_profile"
          profRect.deviceId = ctrl.id
          profRect.profileId = prof.id
          state.itemRects[profKey] = profRect
          profX = profX + profW + 4
        end
        y = y + ITEM_ROW_H

        -- Controller visual diagram (live input feedback)
        if gamepadVisual then
          local visScale = 0.65
          local visW, visH = gamepadVisual.getSize(currentProfile, visScale)
          local visCX = x + w / 2  -- center in panel
          local visCY = y + visH / 2 + 8

          -- Subtle background behind the visual
          love.graphics.setColor(0, 0, 0, 0.15)
          love.graphics.rectangle("fill", x + 22, y + 2, w - 44, visH + 16, 8, 8)

          -- Draw the controller with live state
          local numId = tonumber(ctrl.id) or ctrl.id
          local btns = getGamepadButtons and getGamepadButtons(numId) or {}
          local axs = getGamepadAxes and getGamepadAxes(numId) or {}
          gamepadVisual.draw(currentProfile, visCX, visCY, visScale, btns, axs)

          -- Reset color after visual
          love.graphics.setColor(1, 1, 1, 1)
          y = y + visH + 24
        end

        -- Button mapping sub-section (collapsed by default)
        local mapKey = "map:" .. ctrl.id
        -- Default collapsed: nil = collapsed, true = expanded (toggled via section click)
        local mapCollapsed = not state.collapsed[mapKey]
        love.graphics.setColor(C.dimText)
        love.graphics.setFont(getFont(10))
        drawChevron(x + 22, y + 6, 8, mapCollapsed)
        love.graphics.print("Button Mapping", x + 34, y + 4)
        state.sectionRects[mapKey] = { x = x + 22, y = y, w = w - 22, h = ITEM_ROW_H }
        y = y + ITEM_ROW_H

        if not mapCollapsed then
          local resolved = gamepadMaps.getResolvedMap(ctrl.id)

          -- Build reverse map: action → button/axis name
          local actionToButton = {}
          for btn, act in pairs(resolved.buttons) do
            actionToButton[act] = btn
          end
          local actionToAxis = {}
          for ax, act in pairs(resolved.axes) do
            actionToAxis[act] = ax
          end

          -- Show actions grouped: each action → what input is bound to it
          -- Button actions
          love.graphics.setColor(C.sectionText)
          love.graphics.setFont(getFont(9))
          love.graphics.print("BUTTON ACTIONS", x + 30, y + 2)
          y = y + 16

          local buttonActions = {
            "navigate_up", "navigate_down", "navigate_left", "navigate_right",
            "confirm", "back", "menu",
            "group_prev", "group_next",
            "panel_prev", "panel_next",
            "scroll_up", "scroll_down", "scroll_left", "scroll_right",
          }

          for _, action in ipairs(buttonActions) do
            local label = gamepadMaps.getActionLabel(action)
            local boundBtn = actionToButton[action]

            -- Check if this action is in listen mode
            local isListening = state.remapListen
              and state.remapListen.deviceId == ctrl.id
              and state.remapListen.targetAction == action
              and state.remapListen.inputType == "button"

            -- Action label
            love.graphics.setColor(C.itemText)
            love.graphics.setFont(getFont(10))
            love.graphics.print(label, x + 34, y + 3)

            -- Current binding or listen prompt
            if isListening then
              love.graphics.setColor(C.accent)
              love.graphics.setFont(getFont(10))
              local timeLeft = math.ceil(state.remapListen.timeout)
              love.graphics.print("Press a button... (" .. timeLeft .. "s)", x + 200, y + 3)
            elseif boundBtn then
              love.graphics.setColor(C.green)
              love.graphics.setFont(getFont(10))
              love.graphics.print(boundBtn, x + 200, y + 3)
            else
              love.graphics.setColor(C.dimText)
              love.graphics.setFont(getFont(10))
              love.graphics.print("(none)", x + 200, y + 3)
            end

            -- Remap button
            if not isListening then
              local remapKey = "remap:" .. ctrl.id .. ":btn:" .. action
              local remapHov = state.hoverItems[remapKey] ~= nil
              local remapRect = drawButton(x + w - 58, y + 1, 52, BTN_H - 4, "Remap", remapHov, "normal")
              remapRect.action = "remap_button"
              remapRect.deviceId = ctrl.id
              remapRect.targetAction = action
              state.itemRects[remapKey] = remapRect
            end

            y = y + 20
          end

          -- Axis actions
          love.graphics.setColor(C.sectionText)
          love.graphics.setFont(getFont(9))
          love.graphics.print("STICK / AXIS ACTIONS", x + 30, y + 2)
          y = y + 16

          local axisActions = {
            "navigate_x", "navigate_y",
            "scroll_x", "scroll_y",
            "panel_prev", "panel_next",
          }

          for _, action in ipairs(axisActions) do
            local label = gamepadMaps.getActionLabel(action)
            local boundAxis = actionToAxis[action]

            local isListening = state.remapListen
              and state.remapListen.deviceId == ctrl.id
              and state.remapListen.targetAction == action
              and state.remapListen.inputType == "axis"

            love.graphics.setColor(C.itemText)
            love.graphics.setFont(getFont(10))
            love.graphics.print(label, x + 34, y + 3)

            if isListening then
              love.graphics.setColor(C.accent)
              love.graphics.setFont(getFont(10))
              local timeLeft = math.ceil(state.remapListen.timeout)
              love.graphics.print("Move a stick... (" .. timeLeft .. "s)", x + 200, y + 3)
            elseif boundAxis then
              love.graphics.setColor(C.green)
              love.graphics.setFont(getFont(10))
              love.graphics.print(boundAxis, x + 200, y + 3)
            else
              love.graphics.setColor(C.dimText)
              love.graphics.setFont(getFont(10))
              love.graphics.print("(none)", x + 200, y + 3)
            end

            if not isListening then
              local remapKey = "remap:" .. ctrl.id .. ":ax:" .. action
              local remapHov = state.hoverItems[remapKey] ~= nil
              local remapRect = drawButton(x + w - 58, y + 1, 52, BTN_H - 4, "Remap", remapHov, "normal")
              remapRect.action = "remap_axis"
              remapRect.deviceId = ctrl.id
              remapRect.targetAction = action
              state.itemRects[remapKey] = remapRect
            end

            y = y + 20
          end

          y = y + 4  -- padding after mappings
        end
      end
    end
    return y
  end)

  -- ── Section: MIDI ─────────────────────────────
  curY = drawSection(curY, contentX + leftPad, innerW, "midi", "MIDI", function(y, x, w)
    if #state.cachedMidi == 0 then
      love.graphics.setColor(C.dimText)
      love.graphics.setFont(getFont(11))
      love.graphics.print("No MIDI devices detected", x + 20, y + 4)
      return y + ITEM_ROW_H
    end
    for _, dev in ipairs(state.cachedMidi) do
      local entry = state.devices.midi[dev.id] or {}
      local blocked = entry.blocked

      drawDot(x + 10, y + ITEM_ROW_H / 2, 4, blocked and C.red or (dev.connected and C.green or C.orange))

      love.graphics.setColor(blocked and C.dimText or C.itemText)
      love.graphics.setFont(getFont(12))
      love.graphics.printf(dev.name, x + 22, y + 6, w - 200, "left")

      local btnLabel = blocked and "Unblock" or "Block"
      local btnStyle = blocked and "active" or "block"
      local btnW = 58
      local key = "midi:" .. dev.id
      local hovered = state.hoverItems[key] ~= nil
      local rect = drawButton(x + w - btnW, y + (ITEM_ROW_H - BTN_H) / 2, btnW, BTN_H, btnLabel, hovered, btnStyle)
      rect.action = blocked and "unblock" or "block"
      rect.category = "midi"
      rect.deviceId = dev.id
      state.itemRects[key] = rect

      y = y + ITEM_ROW_H
    end
    return y
  end)

  -- ── Section: Audio ────────────────────────────
  curY = drawSection(curY, contentX + leftPad, innerW, "audio", "AUDIO", function(y, x, w)
    love.graphics.setFont(getFont(12))

    -- Output
    love.graphics.setColor(C.dimText)
    love.graphics.print("Output:", x + 10, y + 6)
    local outName = state.audioOut or "Default"
    love.graphics.setColor(C.itemText)
    love.graphics.print(outName, x + 80, y + 6)
    y = y + ITEM_ROW_H

    -- Input
    love.graphics.setColor(C.dimText)
    love.graphics.print("Input:", x + 10, y + 6)
    if #state.cachedAudioIn > 0 then
      local inName = state.audioIn or state.cachedAudioIn[1].name
      love.graphics.setColor(C.itemText)
      love.graphics.print(inName, x + 80, y + 6)
    else
      love.graphics.setColor(C.dimText)
      love.graphics.print("No input devices", x + 80, y + 6)
    end
    y = y + ITEM_ROW_H

    return y
  end)

  -- ── Section: Serial / GPIO ────────────────────
  curY = drawSection(curY, contentX + leftPad, innerW, "serial", "SERIAL / GPIO", function(y, x, w)
    if #state.cachedSerial == 0 then
      love.graphics.setColor(C.dimText)
      love.graphics.setFont(getFont(11))
      love.graphics.print("No serial devices detected", x + 20, y + 4)
      return y + ITEM_ROW_H
    end
    for _, dev in ipairs(state.cachedSerial) do
      local entry = state.devices.serial[dev.id] or {}
      local blocked = entry.blocked

      drawDot(x + 10, y + ITEM_ROW_H / 2, 4, blocked and C.red or C.green)

      love.graphics.setColor(blocked and C.dimText or C.itemText)
      love.graphics.setFont(getFont(12))
      love.graphics.print(dev.name, x + 22, y + 6)

      local btnLabel = blocked and "Unblock" or "Block"
      local btnStyle = blocked and "active" or "block"
      local btnW = 58
      local key = "serial:" .. dev.id
      local hovered = state.hoverItems[key] ~= nil
      local rect = drawButton(x + w - btnW, y + (ITEM_ROW_H - BTN_H) / 2, btnW, BTN_H, btnLabel, hovered, btnStyle)
      rect.action = blocked and "unblock" or "block"
      rect.category = "serial"
      rect.deviceId = dev.id
      state.itemRects[key] = rect

      y = y + ITEM_ROW_H
    end
    return y
  end)

  -- ── Section: Camera ───────────────────────────
  curY = drawSection(curY, contentX + leftPad, innerW, "camera", "CAMERA", function(y, x, w)
    love.graphics.setColor(C.dimText)
    love.graphics.setFont(getFont(11))
    love.graphics.print("No camera devices detected", x + 20, y + 4)
    return y + ITEM_ROW_H
  end)

  -- ── Section: Permissions ──────────────────────
  curY = drawSection(curY, contentX + leftPad, innerW, "permissions", "PERMISSIONS", function(y, x, w)
    for _, cat in ipairs(PERMISSION_CATEGORIES) do
      local allowed = isPermAllowed(cat.id)
      local blocked = getAuditCount(cat.id)
      local userOverride = state.permOverrides[cat.id]

      -- Checkbox
      local cbSize = 16
      local cbX = x + 10
      local cbY = y + (ITEM_ROW_H - cbSize) / 2
      drawCheckbox(cbX, cbY, cbSize, allowed)

      -- Label
      love.graphics.setColor(allowed and C.itemText or C.dimText)
      love.graphics.setFont(getFont(12))
      love.graphics.print(cat.label, x + 34, y + 6)

      -- Blocked count
      if blocked > 0 then
        love.graphics.setColor(C.orange)
        love.graphics.setFont(getFont(10))
        love.graphics.print(blocked .. " blocked", x + w - 120, y + 7)
      end

      -- User override indicator
      if userOverride == false then
        love.graphics.setColor(C.red)
        love.graphics.setFont(getFont(10))
        love.graphics.print("(user blocked)", x + w - 220, y + 7)
      end

      -- Clickable area for the checkbox
      local key = "perm:" .. cat.id
      state.itemRects[key] = {
        x = cbX - 4, y = y, w = w, h = ITEM_ROW_H,
        action = "toggle_perm",
        category = cat.id,
      }

      y = y + ITEM_ROW_H
    end
    return y
  end)

  -- Track total content height for scrollbar
  state.contentH = (curY + state.scrollY) - contentY
  state.maxScrollY = math.max(0, state.contentH - contentH)

  -- Scrollbar
  if state.contentH > contentH then
    local sbX = pr.x + pr.w - 8
    local sbH = contentH
    local thumbH = math.max(20, (contentH / state.contentH) * sbH)
    local thumbY = contentY + (state.scrollY / state.maxScrollY) * (sbH - thumbH)

    love.graphics.setColor(C.scrollbar)
    love.graphics.rectangle("fill", sbX, contentY, 4, sbH)
    love.graphics.setColor(C.scrollthumb)
    drawRoundedRect("fill", sbX, thumbY, 4, thumbH, 2)
  end

  love.graphics.setScissor()

  -- Status bar
  local statusY = pr.y + pr.h - STATUS_BAR_H
  love.graphics.setColor(C.statusBg)
  love.graphics.rectangle("fill", pr.x, statusY, pr.w, STATUS_BAR_H)
  love.graphics.setColor(C.border)
  love.graphics.line(pr.x, statusY, pr.x + pr.w, statusY)

  -- Reset All button
  local resetLabel = "Reset All"
  local resetFont = getFont(11)
  love.graphics.setFont(resetFont)
  local resetW = resetFont:getWidth(resetLabel) + 16
  local resetX = pr.x + pr.w / 2 - resetW / 2
  local resetY = statusY + (STATUS_BAR_H - BTN_H) / 2
  state.resetRect = drawButton(resetX, resetY, resetW, BTN_H, resetLabel, state.hoverReset, "normal")

  -- Enforcing status
  love.graphics.setColor(C.statusText)
  love.graphics.setFont(getFont(10))
  local enforceText = (permit and permit.isEnforcing and permit.isEnforcing())
    and "Permits enforced" or "No permit manifest"
  love.graphics.print(enforceText, pr.x + 10, statusY + 5)

  love.graphics.pop()
end

--- Draw a collapsible section. Returns the new curY.
function drawSection(curY, x, w, name, label, contentFn)
  local isCollapsed = state.collapsed[name]

  -- Section header
  love.graphics.setColor(C.sectionBg)
  love.graphics.rectangle("fill", x, curY, w, SECTION_HEAD_H)
  love.graphics.setColor(C.border)
  love.graphics.line(x, curY + SECTION_HEAD_H, x + w, curY + SECTION_HEAD_H)

  -- Chevron
  drawChevron(x + 8, curY + 10, 10, isCollapsed)

  -- Section label
  love.graphics.setColor(C.sectionText)
  love.graphics.setFont(getFont(11))
  love.graphics.print(label, x + 24, curY + 8)

  state.sectionRects[name] = { x = x, y = curY, w = w, h = SECTION_HEAD_H }
  curY = curY + SECTION_HEAD_H

  if not isCollapsed then
    curY = contentFn(curY, x, w)
    curY = curY + 4  -- padding after section content
  end

  return curY
end

-- ============================================================================
-- Input handling
-- ============================================================================

function SystemPanel.keypressed(key)
  if key == state.toggleKey then
    state.open = not state.open
    if state.open then
      scanDevices()
      state.scrollY = 0
    end
    return true
  end

  if not state.open then return false end

  if key == "escape" then
    state.open = false
    return true
  end

  return true  -- consume all keys while open
end

function SystemPanel.mousepressed(x, y, button)
  if not state.open then return false end
  if button ~= 1 then return true end

  local pr = state.panelRect
  if not pr then return true end

  -- Click outside panel = close
  if not pointInRect(x, y, pr) then
    state.open = false
    return true
  end

  -- Close button
  if pointInRect(x, y, state.closeRect) then
    state.open = false
    return true
  end

  -- Reset button
  if state.resetRect and pointInRect(x, y, state.resetRect) then
    state.permOverrides = {}
    for id, entry in pairs(state.devices.controllers) do
      entry.blocked = false
    end
    for id, entry in pairs(state.devices.midi) do
      entry.blocked = false
    end
    for id, entry in pairs(state.devices.serial) do
      entry.blocked = false
    end
    -- Apply to permit system
    if permit and permit.clearUserOverrides then
      permit.clearUserOverrides()
    end
    markDirty()
    return true
  end

  -- Section headers (collapse/expand)
  for name, rect in pairs(state.sectionRects) do
    if pointInRect(x, y, rect) then
      state.collapsed[name] = not state.collapsed[name]
      markDirty()
      return true
    end
  end

  -- Item buttons
  for key, rect in pairs(state.itemRects) do
    if pointInRect(x, y, rect) then
      if rect.action == "block" then
        local cat = state.devices[rect.category]
        if cat and cat[rect.deviceId] then
          cat[rect.deviceId].blocked = true
          markDirty()
        end
      elseif rect.action == "unblock" then
        local cat = state.devices[rect.category]
        if cat and cat[rect.deviceId] then
          cat[rect.deviceId].blocked = false
          markDirty()
        end
      elseif rect.action == "toggle_perm" then
        local catId = rect.category
        if state.permOverrides[catId] == false then
          state.permOverrides[catId] = nil
          if permit and permit.setUserOverride then
            permit.setUserOverride(catId, nil)
          end
        else
          state.permOverrides[catId] = false
          if permit and permit.setUserOverride then
            permit.setUserOverride(catId, false)
          end
        end
        markDirty()
      elseif rect.action == "set_profile" and gamepadMaps then
        gamepadMaps.setProfile(rect.deviceId, rect.profileId)
      elseif rect.action == "remap_button" and gamepadMaps then
        -- Enter listen mode: wait for user to press a button
        state.remapListen = {
          deviceId = rect.deviceId,
          targetAction = rect.targetAction,
          inputType = "button",
          timeout = 5.0,
        }
      elseif rect.action == "remap_axis" and gamepadMaps then
        -- Enter listen mode: wait for user to move an axis
        state.remapListen = {
          deviceId = rect.deviceId,
          targetAction = rect.targetAction,
          inputType = "axis",
          timeout = 5.0,
        }
      elseif rect.action == "clear_binding" and gamepadMaps then
        -- Clear a specific override (revert to profile default)
        if rect.bindingType == "button" then
          gamepadMaps.setButtonOverride(rect.deviceId, rect.buttonName, nil)
        elseif rect.bindingType == "axis" then
          gamepadMaps.setAxisOverride(rect.deviceId, rect.axisName, nil)
        end
      end
      return true
    end
  end

  return true  -- consume click inside panel
end

function SystemPanel.mousereleased(x, y, button)
  if not state.open then return false end
  return true
end

function SystemPanel.mousemoved(x, y)
  if not state.open then return end

  -- Update hover states
  state.hoverClose = state.closeRect and pointInRect(x, y, state.closeRect)
  state.hoverReset = state.resetRect and pointInRect(x, y, state.resetRect)

  state.hoverItems = {}
  for key, rect in pairs(state.itemRects) do
    if pointInRect(x, y, rect) then
      state.hoverItems[key] = rect.action
    end
  end
end

function SystemPanel.wheelmoved(x, y)
  if not state.open then return false end

  state.scrollY = state.scrollY - y * SCROLL_SPEED
  state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))
  return true
end

function SystemPanel.textinput(text)
  if not state.open then return false end
  return true  -- consume while open
end

-- ============================================================================
-- Update
-- ============================================================================

function SystemPanel.update(dt)
  if not state.open then
    -- Still handle save timer even when closed
    if state.dirty then
      state.saveTimer = state.saveTimer - dt
      if state.saveTimer <= 0 then
        savePrefs()
      end
    end
    return
  end

  -- Debounced save
  if state.dirty then
    state.saveTimer = state.saveTimer - dt
    if state.saveTimer <= 0 then
      savePrefs()
    end
  end

  -- Remap listen mode timeout
  if state.remapListen then
    state.remapListen.timeout = state.remapListen.timeout - dt
    if state.remapListen.timeout <= 0 then
      state.remapListen = nil  -- cancelled by timeout
    end
  end

  -- Periodic device rescan (every 3 seconds while open)
  state.rescanTimer = state.rescanTimer + dt
  if state.rescanTimer >= 3.0 then
    state.rescanTimer = 0
    scanDevices()
  end
end

--- Called from init.lua when a gamepad button is pressed while the panel is open.
--- If in listen mode, captures the button and assigns it to the target action.
--- @param button string  SDL button name
--- @param joystickId number
--- @return boolean  true if consumed
function SystemPanel.gamepadpressed(button, joystickId)
  if not state.open then return false end

  -- If in listen mode, capture this button
  if state.remapListen and state.remapListen.inputType == "button" then
    local listen = state.remapListen
    -- Find what action this button currently has and swap it
    -- First: clear any existing button that has this action
    -- Then: set this button to the target action
    if gamepadMaps then
      gamepadMaps.setButtonOverride(listen.deviceId, button, listen.targetAction)
    end
    state.remapListen = nil
    return true
  end

  -- Consume all gamepad input while panel is open
  return true
end

--- Called from init.lua when a gamepad axis moves while the panel is open.
--- If in listen mode for an axis, captures it.
--- @param axis string  SDL axis name
--- @param value number
--- @param joystickId number
--- @return boolean  true if consumed
function SystemPanel.gamepadaxis(axis, value, joystickId)
  if not state.open then return false end

  -- If in listen mode for axis, capture when moved past threshold
  if state.remapListen and state.remapListen.inputType == "axis" then
    if math.abs(value) > 0.5 then
      local listen = state.remapListen
      if gamepadMaps then
        gamepadMaps.setAxisOverride(listen.deviceId, axis, listen.targetAction)
      end
      state.remapListen = nil
      return true
    end
  end

  return true  -- consume while open
end

-- ============================================================================
-- Public API
-- ============================================================================

function SystemPanel.init(deps)
  deps = deps or {}
  permit = deps.permit
  audit = deps.audit
  midi = deps.midi
  audioEngine = deps.audioEngine
  gamepadMaps = deps.gamepadMaps
  getGamepadButtons = deps.getGamepadButtons
  getGamepadAxes = deps.getGamepadAxes

  loadPrefs()

  -- Apply persisted permission overrides to the permit system
  if permit and permit.setUserOverride then
    for catId, val in pairs(state.permOverrides) do
      permit.setUserOverride(catId, val)
    end
  end

  scanDevices()
end

function SystemPanel.isOpen()
  return state.open
end

--- Check if a device is blocked by the user.
--- @param category string  "controllers", "midi", or "serial"
--- @param id string|number  device identifier
--- @return boolean
function SystemPanel.isDeviceBlocked(category, id)
  local cat = state.devices[category]
  if not cat then return false end
  local entry = cat[tostring(id)]
  return entry and entry.blocked == true
end

--- Get the player number assigned to a controller.
--- @param joystickId number|string
--- @return number|nil  player number (1-4) or nil
function SystemPanel.getPlayerAssignment(joystickId)
  local entry = state.devices.controllers[tostring(joystickId)]
  return entry and entry.player or nil
end

--- Notify the panel that a device was added (for live updates).
function SystemPanel.notifyDeviceAdded(category, id, name)
  if state.open then scanDevices() end
end

--- Notify the panel that a device was removed.
function SystemPanel.notifyDeviceRemoved(category, id)
  if state.open then scanDevices() end
end

return SystemPanel
