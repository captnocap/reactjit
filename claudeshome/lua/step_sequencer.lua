--[[
  step_sequencer.lua -- Lua-owned step sequencer component

  Handles all drawing and interaction in Lua for zero-latency response.
  React sends props (pattern, tracks, steps, colors) via the reconciler;
  Lua owns the drag state and paints directly. Toggle events are pushed
  back to JS via buffered events (stepsequencer:toggle).

  Supports drag-to-paint: holding mouse and dragging across cells
  applies the same on/off state as the first toggled cell.
]]

local StepSequencer = {}

-- Injected dependencies
local Measure = nil

-- Pending events to push to JS (drained each frame by init.lua)
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function StepSequencer.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._stepsequencer then
    node._stepsequencer = {
      isDragging = false,
      dragMode = true,    -- true = painting ON, false = painting OFF
      lastTrack = -1,
      lastStep = -1,
      overrides = {},     -- optimistic local state: [track*1000+step] = bool
    }
  end
  return node._stepsequencer
end

-- ============================================================================
-- Helpers
-- ============================================================================

local function parseColor(hex)
  if type(hex) ~= "string" then return 1, 1, 1, 1 end
  hex = hex:gsub("^#", "")
  if #hex == 6 then
    local r = tonumber(hex:sub(1, 2), 16) / 255
    local g = tonumber(hex:sub(3, 4), 16) / 255
    local b = tonumber(hex:sub(5, 6), 16) / 255
    return r, g, b, 1
  elseif #hex == 8 then
    local r = tonumber(hex:sub(1, 2), 16) / 255
    local g = tonumber(hex:sub(3, 4), 16) / 255
    local b = tonumber(hex:sub(5, 6), 16) / 255
    local a = tonumber(hex:sub(7, 8), 16) / 255
    return r, g, b, a
  end
  return 1, 1, 1, 1
end

local function queueEvent(nodeId, eventType, payload)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    value = payload,
  }
end

--- Safely decode JSON — handles both string and pre-parsed table props.
local _cjson = nil
local function safeDecode(val, fallback)
  if type(val) == "table" then return val end
  if type(val) ~= "string" or val == "" then return fallback end
  if not _cjson then
    local ok, mod = pcall(require, "cjson")
    if ok then _cjson = mod else _cjson = false end
  end
  if _cjson then
    local ok, result = pcall(_cjson.decode, val)
    if ok then return result end
  end
  return fallback
end

local DEFAULT_COLORS = {
  "#6366f1", "#22c55e", "#f59e0b", "#ec4899",
  "#06b6d4", "#ef4444", "#8b5cf6", "#14b8a6",
}

local function getProps(node)
  local props = node.props or {}
  local pattern = safeDecode(props.pattern, {})
  local trackLabels = safeDecode(props.trackLabels, nil)
  local trackColors = safeDecode(props.trackColors, nil)

  return {
    steps = tonumber(props.steps) or 16,
    tracks = tonumber(props.tracks) or 1,
    pattern = pattern,
    currentStep = props.currentStep,  -- nil means no playhead
    trackLabels = trackLabels,
    trackColors = trackColors,
    stepSize = tonumber(props.stepSize) or 24,
    disabled = props.disabled or false,
    labelWidth = tonumber(props.labelWidth) or 40,
    gap = tonumber(props.gap) or 2,
  }
end

--- Get the boolean value at pattern[track][step] (0-indexed from JS).
--- overrides table takes priority for optimistic local updates.
local function getPatternValue(pattern, track, step, overrides)
  local key = track * 1000 + step
  if overrides and overrides[key] ~= nil then
    return overrides[key]
  end
  -- Pattern is 0-indexed from JS: pattern[track][step]
  -- After JSON decode, Lua arrays are 1-indexed
  local row = pattern[track + 1]
  if not row then return false end
  local val = row[step + 1]
  return val == true
end

-- ============================================================================
-- Font helper
-- ============================================================================

local LABEL_FONT_SIZE = 9

local function getFontHandle(fontSize)
  if Measure and Measure.getFont then
    return Measure.getFont(fontSize)
  end
  if love and love.graphics and love.graphics.newFont then
    return love.graphics.newFont(fontSize)
  end
  return nil
end

-- ============================================================================
-- Geometry: hit-test a mouse position to (track, step)
-- ============================================================================

--- Returns track (0-indexed), step (0-indexed) or nil if outside grid.
local function hitTestCell(p, localX, localY)
  local labelW = p.labelWidth + p.gap
  local cellX = localX - labelW
  if cellX < 0 then return nil, nil end

  local cellStride = p.stepSize + p.gap
  local rowStride = p.stepSize + p.gap

  local step = math.floor(cellX / cellStride)
  local track = math.floor(localY / rowStride)

  -- Verify we're inside a cell, not in a gap
  local cellLocalX = cellX - step * cellStride
  local cellLocalY = localY - track * rowStride
  if cellLocalX > p.stepSize or cellLocalY > p.stepSize then
    return nil, nil
  end

  if step < 0 or step >= p.steps then return nil, nil end
  if track < 0 or track >= p.tracks then return nil, nil end

  return track, step
end

-- ============================================================================
-- Drawing
-- ============================================================================

function StepSequencer.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity

  -- Clear overrides where the pattern has caught up
  for key, val in pairs(state.overrides) do
    local t = math.floor(key / 1000)
    local s = key - t * 1000
    local row = p.pattern[t + 1]
    local propVal = row and (row[s + 1] == true) or false
    if propVal == val then
      state.overrides[key] = nil
    end
  end

  local originX = c.x
  local originY = c.y

  local labelFont = getFontHandle(LABEL_FONT_SIZE)
  local cellStride = p.stepSize + p.gap
  local rowStride = p.stepSize + p.gap

  for track = 0, p.tracks - 1 do
    local colorIdx = (track % #DEFAULT_COLORS) + 1
    local trackColor = (p.trackColors and p.trackColors[track + 1]) or DEFAULT_COLORS[colorIdx]
    local trackLabel = (p.trackLabels and p.trackLabels[track + 1]) or ("T" .. (track + 1))

    local rowY = originY + track * rowStride

    -- ── Draw track label ──────────────────────────
    if labelFont then
      local tr, tg, tb, ta = parseColor(trackColor)
      love.graphics.setColor(tr, tg, tb, ta * opacity)
      love.graphics.setFont(labelFont)
      local labelY = rowY + (p.stepSize - labelFont:getHeight()) / 2
      love.graphics.print(trackLabel, originX, labelY)
    end

    -- ── Draw step cells ──────────────────────────
    local labelW = p.labelWidth + p.gap
    for step = 0, p.steps - 1 do
      local isActive = getPatternValue(p.pattern, track, step, state.overrides)
      local isCurrent = p.currentStep == step
      local isBeat = step % 4 == 0

      local cellX = originX + labelW + step * cellStride
      local cellY = rowY
      local cellW = p.stepSize
      local cellH = p.stepSize
      local radius = 3

      -- Background color
      local bgColor
      if isActive then
        if isCurrent then
          bgColor = "#fbbf24"  -- gold for active + current
        else
          bgColor = trackColor
        end
      elseif isCurrent then
        -- Current step but inactive: dim gold
        love.graphics.setColor(0.984, 0.749, 0.141, 0.25 * opacity)  -- #fbbf24 at 40%
        love.graphics.rectangle("fill", cellX, cellY, cellW, cellH, radius, radius)
        bgColor = nil  -- already drawn
      else
        bgColor = "#1e2030"
      end

      if bgColor then
        local r, g, b, a = parseColor(bgColor)
        love.graphics.setColor(r, g, b, a * opacity)
        love.graphics.rectangle("fill", cellX, cellY, cellW, cellH, radius, radius)
      end

      -- Border
      local borderColor
      if isCurrent then
        borderColor = "#fbbf24"
      elseif isBeat and not isActive then
        borderColor = "#2e3348"
      end

      if borderColor then
        local br, bg2, bb, ba = parseColor(borderColor)
        love.graphics.setLineWidth(1)
        love.graphics.setColor(br, bg2, bb, ba * opacity)
        love.graphics.rectangle("line", cellX, cellY, cellW, cellH, radius, radius)
      end

      -- Beat dot (small circle on beat markers when inactive)
      if isBeat and not isActive and not isCurrent then
        local dotSize = math.max(2, math.floor(p.stepSize * 0.125))
        local dotX = cellX + (cellW - dotSize) / 2
        local dotY = cellY + (cellH - dotSize) / 2
        love.graphics.setColor(0.180, 0.200, 0.282, opacity)  -- #2e3348
        love.graphics.rectangle("fill", dotX, dotY, dotSize, dotSize, 1, 1)
      end
    end
  end

  love.graphics.setLineWidth(1)
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function StepSequencer.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  local c = node.computed
  if not c then return false end

  local localX = mx - c.x
  local localY = my - c.y
  local track, step = hitTestCell(p, localX, localY)

  if track == nil then return false end

  local wasActive = getPatternValue(p.pattern, track, step, state.overrides)
  local newActive = not wasActive

  state.isDragging = true
  state.dragMode = newActive   -- paint this state on all dragged-over cells
  state.lastTrack = track
  state.lastStep = step

  -- Optimistic update so drawing reflects the change immediately
  state.overrides[track * 1000 + step] = newActive

  queueEvent(node.id, "stepsequencer:toggle", {
    track = track,
    step = step,
    active = newActive,
  })

  return true
end

function StepSequencer.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)
  local c = node.computed
  if not c then return false end

  local localX = mx - c.x
  local localY = my - c.y
  local track, step = hitTestCell(p, localX, localY)

  if track == nil then return true end  -- still dragging, just outside grid

  -- Only fire if we entered a new cell
  if track == state.lastTrack and step == state.lastStep then
    return true
  end

  state.lastTrack = track
  state.lastStep = step

  -- Apply drag mode (paint on or paint off)
  local isActive = getPatternValue(p.pattern, track, step, state.overrides)
  if isActive ~= state.dragMode then
    -- Optimistic update so drawing reflects the change immediately
    state.overrides[track * 1000 + step] = state.dragMode
    queueEvent(node.id, "stepsequencer:toggle", {
      track = track,
      step = step,
      active = state.dragMode,
    })
  end

  return true
end

function StepSequencer.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  state.lastTrack = -1
  state.lastStep = -1

  return true
end

-- ============================================================================
-- Event draining (called by init.lua each frame)
-- ============================================================================

function StepSequencer.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return StepSequencer
