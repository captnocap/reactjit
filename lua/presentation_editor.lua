--[[
  presentation_editor.lua -- Lua-owned single-slide presentation editor

  Hot interaction lives entirely in Lua:
    - selection
    - pan / zoom
    - drag move
    - corner-handle resize

  JS owns the durable document. Lua only emits boundary events:
    - presentationeditor:patch
    - presentationeditor:selectionchange
    - presentationeditor:camerachange
]]

local Color = require("lua.color")

local PresentationEditor = {}

local Measure = nil
local pendingEvents = {}

local HANDLE_SIZE = 10
local MIN_NODE_SIZE = 24
local MARQUEE_DRAG_THRESHOLD = 4
local CAMERA_COMMIT_DELAY = 0.18

local FALLBACK_WORKSPACE_BG = { 0.06, 0.08, 0.12, 1 }
local FALLBACK_SLIDE_BG = { 0.96, 0.97, 0.99, 1 }
local FALLBACK_TEXT = { 0.09, 0.11, 0.16, 1 }
local FALLBACK_MUTED = { 0.28, 0.33, 0.42, 1 }
local FALLBACK_ACCENT = { 0.95, 0.54, 0.16, 1 }
local FALLBACK_SELECTION = { 0.95, 0.54, 0.16, 0.24 }

local function clamp(value, minValue, maxValue)
  if value < minValue then return minValue end
  if value > maxValue then return maxValue end
  return value
end

local function approxEqual(a, b, epsilon)
  epsilon = epsilon or 0.001
  return math.abs((a or 0) - (b or 0)) <= epsilon
end

local function copyFrame(frame)
  frame = frame or {}
  return {
    x = frame.x or 0,
    y = frame.y or 0,
    width = frame.width or 0,
    height = frame.height or 0,
    rotation = frame.rotation or 0,
    zIndex = frame.zIndex or 0,
  }
end

local function copyCamera(camera)
  camera = camera or {}
  return {
    x = camera.x or 0,
    y = camera.y or 0,
    zoom = camera.zoom or 1,
    rotation = camera.rotation or 0,
  }
end

local function cameraMatches(a, b)
  a = a or {}
  b = b or {}
  return approxEqual(a.x, b.x)
    and approxEqual(a.y, b.y)
    and approxEqual(a.zoom or 1, b.zoom or 1)
    and approxEqual(a.rotation or 0, b.rotation or 0)
end

local function frameMatches(a, b)
  a = a or {}
  b = b or {}
  return approxEqual(a.x, b.x)
    and approxEqual(a.y, b.y)
    and approxEqual(a.width, b.width)
    and approxEqual(a.height, b.height)
    and approxEqual(a.rotation or 0, b.rotation or 0)
    and approxEqual(a.zIndex or 0, b.zIndex or 0)
end

local function parseColor(value, fallback)
  local r, g, b, a = Color.parse(value)
  if r then
    return r, g, b, a or 1
  end
  fallback = fallback or { 1, 1, 1, 1 }
  return fallback[1], fallback[2], fallback[3], fallback[4] or 1
end

local function setParsedColor(value, opacity, fallback)
  local r, g, b, a = parseColor(value, fallback)
  love.graphics.setColor(r, g, b, (a or 1) * (opacity or 1))
end

local function queueEvent(nodeId, eventType, payload)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    payload = payload,
  }
end

local function emitPatch(nodeId, patch, transient)
  queueEvent(nodeId, "presentationeditor:patch", {
    type = "presentationeditor:patch",
    targetId = nodeId,
    patch = patch,
    transient = transient or false,
  })
end

local function emitSelectionChange(nodeId, selection)
  queueEvent(nodeId, "presentationeditor:selectionchange", {
    type = "presentationeditor:selectionchange",
    targetId = nodeId,
    selection = selection or {},
  })
end

local function emitCameraChange(nodeId, slideId, camera, transient)
  queueEvent(nodeId, "presentationeditor:camerachange", {
    type = "presentationeditor:camerachange",
    targetId = nodeId,
    slideId = slideId,
    camera = copyCamera(camera),
    transient = transient or false,
  })
end

local function ensureState(node)
  local state = node._presentationEditor
  if state then return state end

  state = {
    slideId = nil,
    camera = { x = 0, y = 0, zoom = 1, rotation = 0 },
    selection = {},
    frameOverrides = {},
    gesture = nil,
    cameraDirty = false,
    cameraCommitTimer = nil,
    lastLayout = nil,
    lastDocumentUpdatedAt = nil,
    lastCommandId = nil,
  }

  node._presentationEditor = state
  return state
end

local function getMinZoom(node)
  local props = node.props or {}
  return props.minZoom or 0.25
end

local function getMaxZoom(node)
  local props = node.props or {}
  return props.maxZoom or 6
end

local function clampCameraZoom(node, camera)
  camera.zoom = clamp(camera.zoom or 1, getMinZoom(node), getMaxZoom(node))
  return camera
end

local function getActiveSlide(document, preferredSlideId)
  if not document or not document.slides or #document.slides == 0 then return nil end
  if preferredSlideId then
    for _, slide in ipairs(document.slides) do
      if slide.id == preferredSlideId then
        return slide
      end
    end
  end
  return document.slides[1]
end

local function getStage(document)
  local settings = document and document.settings or {}
  local stage = settings.stage or {}
  return {
    width = stage.width or 1600,
    height = stage.height or 900,
  }
end

local function resolveFrame(nodeDef, overrides)
  if overrides and nodeDef.id and overrides[nodeDef.id] then
    return overrides[nodeDef.id]
  end
  return nodeDef.frame or { x = 0, y = 0, width = 0, height = 0, rotation = 0, zIndex = 0 }
end

local function sortedNodes(nodes)
  local ordered = {}
  for index, nodeDef in ipairs(nodes or {}) do
    ordered[#ordered + 1] = { node = nodeDef, index = index }
  end

  table.sort(ordered, function(a, b)
    local af = a.node.frame or {}
    local bf = b.node.frame or {}
    local az = af.zIndex or 0
    local bz = bf.zIndex or 0
    if az == bz then
      return a.index < b.index
    end
    return az < bz
  end)

  return ordered
end

local function pointInRect(px, py, x, y, w, h)
  return px >= x and px <= x + w and py >= y and py <= y + h
end

local function findNodeRecord(nodes, nodeId, parentX, parentY, overrides)
  for _, entry in ipairs(sortedNodes(nodes)) do
    local nodeDef = entry.node
    local frame = resolveFrame(nodeDef, overrides)
    local absX = parentX + (frame.x or 0)
    local absY = parentY + (frame.y or 0)

    if nodeDef.id == nodeId then
      return {
        node = nodeDef,
        frame = frame,
        absX = absX,
        absY = absY,
        parentX = parentX,
        parentY = parentY,
      }
    end

    if nodeDef.kind == "group" and nodeDef.children then
      local nested = findNodeRecord(nodeDef.children, nodeId, absX, absY, overrides)
      if nested then return nested end
    end
  end

  return nil
end

local function hitTestNodes(nodes, worldX, worldY, parentX, parentY, overrides)
  local ordered = sortedNodes(nodes)
  for i = #ordered, 1, -1 do
    local nodeDef = ordered[i].node
    if not nodeDef.hidden then
      local frame = resolveFrame(nodeDef, overrides)
      local absX = parentX + (frame.x or 0)
      local absY = parentY + (frame.y or 0)
      local width = frame.width or 0
      local height = frame.height or 0

      if nodeDef.kind == "group" and nodeDef.children then
        local allowChildren = true
        if nodeDef.clip then
          allowChildren = pointInRect(worldX, worldY, absX, absY, width, height)
        end
        if allowChildren then
          local nested = hitTestNodes(nodeDef.children, worldX, worldY, absX, absY, overrides)
          if nested then return nested end
        end
      end

      if (nodeDef.kind == "text" or nodeDef.kind == "shape") and pointInRect(worldX, worldY, absX, absY, width, height) then
        return {
          node = nodeDef,
          frame = frame,
          absX = absX,
          absY = absY,
          parentX = parentX,
          parentY = parentY,
        }
      end
    end
  end

  return nil
end

local function copySelectionItem(item)
  return {
    slideId = item.slideId,
    nodeId = item.nodeId,
  }
end

local function normalizeSelectionItems(selection)
  if not selection then return {} end

  local nextSelection = {}
  local seen = {}

  if selection.slideId and selection.nodeId then
    nextSelection[1] = copySelectionItem(selection)
    return nextSelection
  end

  for _, item in ipairs(selection) do
    if item and item.slideId and item.nodeId then
      local key = tostring(item.slideId) .. ":" .. tostring(item.nodeId)
      if not seen[key] then
        seen[key] = true
        nextSelection[#nextSelection + 1] = copySelectionItem(item)
      end
    end
  end

  return nextSelection
end

local function selectionKey(selection)
  if not selection or #selection == 0 then return "" end

  local parts = {}
  for index, item in ipairs(selection) do
    parts[index] = tostring(item.slideId) .. ":" .. tostring(item.nodeId)
  end

  return table.concat(parts, "|")
end

local function setSelection(node, state, selection)
  local nextSelection = normalizeSelectionItems(selection)
  if selectionKey(state.selection) == selectionKey(nextSelection) then
    state.selection = nextSelection
    return
  end
  state.selection = nextSelection
  emitSelectionChange(node.id, nextSelection)
end

local function isNodeSelected(state, slideId, nodeId)
  for _, selected in ipairs(state.selection or {}) do
    if selected.slideId == slideId and selected.nodeId == nodeId then
      return true
    end
  end
  return false
end

local function getSelectionRecords(state, slide)
  local records = {}
  local seen = {}

  for _, selected in ipairs(state.selection or {}) do
    if selected.slideId == slide.id and not seen[selected.nodeId] then
      local record = findNodeRecord(slide.nodes, selected.nodeId, 0, 0, state.frameOverrides)
      if record then
        seen[selected.nodeId] = true
        records[#records + 1] = record
      end
    end
  end

  return records
end

local function collectSelectableSelections(nodes, slideId, selections)
  selections = selections or {}

  for _, entry in ipairs(sortedNodes(nodes)) do
    local nodeDef = entry.node
    if not nodeDef.hidden then
      if nodeDef.kind == "group" and nodeDef.children then
        collectSelectableSelections(nodeDef.children, slideId, selections)
      elseif nodeDef.kind == "text" or nodeDef.kind == "shape" then
        selections[#selections + 1] = {
          slideId = slideId,
          nodeId = nodeDef.id,
        }
      end
    end
  end

  return selections
end

local function mergeSelections(a, b)
  local merged = {}

  for _, item in ipairs(normalizeSelectionItems(a)) do
    merged[#merged + 1] = item
  end

  for _, item in ipairs(normalizeSelectionItems(b)) do
    merged[#merged + 1] = item
  end

  return normalizeSelectionItems(merged)
end

local function rectsIntersect(ax, ay, aw, ah, bx, by, bw, bh)
  return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by
end

local function normalizeRect(x1, y1, x2, y2)
  local left = math.min(x1, x2)
  local top = math.min(y1, y2)
  return left, top, math.abs(x2 - x1), math.abs(y2 - y1)
end

local function collectSelectionsInRect(nodes, slideId, x, y, w, h, parentX, parentY, overrides, selections)
  selections = selections or {}

  for _, entry in ipairs(sortedNodes(nodes)) do
    local nodeDef = entry.node
    if not nodeDef.hidden then
      local frame = resolveFrame(nodeDef, overrides)
      local absX = parentX + (frame.x or 0)
      local absY = parentY + (frame.y or 0)
      local width = frame.width or 0
      local height = frame.height or 0

      if nodeDef.kind == "group" and nodeDef.children then
        local allowChildren = true
        if nodeDef.clip then
          allowChildren = rectsIntersect(x, y, w, h, absX, absY, width, height)
        end
        if allowChildren then
          collectSelectionsInRect(nodeDef.children, slideId, x, y, w, h, absX, absY, overrides, selections)
        end
      elseif (nodeDef.kind == "text" or nodeDef.kind == "shape") and rectsIntersect(x, y, w, h, absX, absY, width, height) then
        selections[#selections + 1] = {
          slideId = slideId,
          nodeId = nodeDef.id,
        }
      end
    end
  end

  return normalizeSelectionItems(selections)
end

local function activateSlide(node, state, slide)
  state.slideId = slide and slide.id or nil
  state.selection = {}
  state.frameOverrides = {}
  state.gesture = nil
  state.cameraDirty = false
  state.cameraCommitTimer = nil
  state.camera = slide and clampCameraZoom(node, copyCamera(slide.camera)) or { x = 0, y = 0, zoom = 1, rotation = 0 }
end

local function applyCommand(node, state, document, slide)
  local props = node.props or {}
  local commandId = props.commandId
  if commandId == nil or commandId == state.lastCommandId then
    return slide
  end

  state.lastCommandId = commandId

  local command = props.command
  if type(command) ~= "table" then
    return slide
  end

  if command.type == "loadDocument" then
    local targetSlide = getActiveSlide(document, props.slideId or state.slideId)
    if targetSlide then
      activateSlide(node, state, targetSlide)
      return targetSlide
    end
    return slide
  end

  if command.type == "setActiveSlide" then
    if props.slideId and props.slideId ~= command.slideId then
      return slide
    end

    local targetSlide = getActiveSlide(document, command.slideId)
    if targetSlide then
      activateSlide(node, state, targetSlide)
      return targetSlide
    end

    return slide
  end

  if command.type == "setSelection" then
    local nextSelection = normalizeSelectionItems(command.selection)
    local primarySelection = nextSelection[1]
    if not primarySelection then
      setSelection(node, state, nil)
      return slide
    end

    local targetSlide = getActiveSlide(document, primarySelection.slideId)
    if not targetSlide then
      setSelection(node, state, nil)
      return slide
    end

    if targetSlide.id ~= slide.id then
      if props.slideId and props.slideId ~= targetSlide.id then
        return slide
      end

      activateSlide(node, state, targetSlide)
      slide = targetSlide
    end

    local liveSelection = {}
    for _, selected in ipairs(nextSelection) do
      if selected.slideId == slide.id then
        local liveNode = findNodeRecord(slide.nodes, selected.nodeId, 0, 0, nil)
        if liveNode then
          liveSelection[#liveSelection + 1] = {
            slideId = slide.id,
            nodeId = selected.nodeId,
          }
        end
      end
    end

    setSelection(node, state, liveSelection)
  end

  return slide
end

local function syncState(node, state)
  local document = node.props and node.props.document or nil
  local slide = getActiveSlide(document, (node.props and node.props.slideId) or state.slideId)

  if not document or not slide then
    activateSlide(node, state, nil)
    state.lastDocumentUpdatedAt = nil
    return nil, nil
  end

  local documentChanged = state.lastDocumentUpdatedAt ~= nil and state.lastDocumentUpdatedAt ~= document.updatedAt

  clampCameraZoom(node, state.camera)

  if state.slideId ~= slide.id then
    activateSlide(node, state, slide)
    state.lastDocumentUpdatedAt = document.updatedAt
    return document, slide
  end

  if state.cameraDirty then
    if cameraMatches(state.camera, slide.camera) then
      state.cameraDirty = false
      state.cameraCommitTimer = nil
    elseif documentChanged and not state.gesture then
      state.camera = clampCameraZoom(node, copyCamera(slide.camera))
      state.cameraDirty = false
      state.cameraCommitTimer = nil
    end
  elseif not state.gesture and not cameraMatches(state.camera, slide.camera) then
    state.camera = clampCameraZoom(node, copyCamera(slide.camera))
  end

  for nodeId, override in pairs(state.frameOverrides) do
    local liveNode = findNodeRecord(slide.nodes, nodeId, 0, 0, nil)
    if (not liveNode) or frameMatches(liveNode.frame, override) or documentChanged then
      state.frameOverrides[nodeId] = nil
    end
  end

  local liveSelection = {}
  for _, selected in ipairs(state.selection or {}) do
    if selected.slideId == slide.id then
      local liveNode = findNodeRecord(slide.nodes, selected.nodeId, 0, 0, nil)
      if liveNode then
        liveSelection[#liveSelection + 1] = {
          slideId = slide.id,
          nodeId = selected.nodeId,
        }
      end
    end
  end

  if selectionKey(liveSelection) ~= selectionKey(state.selection) then
    setSelection(node, state, liveSelection)
  end

  slide = applyCommand(node, state, document, slide)
  state.lastDocumentUpdatedAt = document.updatedAt

  return document, slide
end

local function getViewportLayout(node, state, document)
  local computed = node.computed
  local stage = getStage(document)
  local showFrame = not (node.props and node.props.showFrame == false)
  local padding = showFrame and 28 or 12
  local usableW = math.max(1, (computed.w or 0) - padding * 2)
  local usableH = math.max(1, (computed.h or 0) - padding * 2)
  local fitScale = math.min(usableW / stage.width, usableH / stage.height)
  if fitScale <= 0 then fitScale = 1 end

  clampCameraZoom(node, state.camera)

  return {
    x = computed.x or 0,
    y = computed.y or 0,
    w = computed.w or 0,
    h = computed.h or 0,
    centerX = (computed.x or 0) + (computed.w or 0) * 0.5,
    centerY = (computed.y or 0) + (computed.h or 0) * 0.5,
    stageW = stage.width,
    stageH = stage.height,
    fitScale = fitScale,
    scale = fitScale * (state.camera.zoom or 1),
  }
end

local function screenToWorld(layout, camera, sx, sy)
  local scale = layout.scale
  if scale == 0 then scale = 0.0001 end
  return
    layout.stageW * 0.5 + (camera.x or 0) + (sx - layout.centerX) / scale,
    layout.stageH * 0.5 + (camera.y or 0) + (sy - layout.centerY) / scale
end

local function worldToScreen(layout, camera, wx, wy)
  return
    layout.centerX + (wx - layout.stageW * 0.5 - (camera.x or 0)) * layout.scale,
    layout.centerY + (wy - layout.stageH * 0.5 - (camera.y or 0)) * layout.scale
end

local function getHandleWorldPosition(record, handle)
  local frame = record.frame
  if handle == "nw" then
    return record.absX, record.absY
  elseif handle == "ne" then
    return record.absX + frame.width, record.absY
  elseif handle == "sw" then
    return record.absX, record.absY + frame.height
  end
  return record.absX + frame.width, record.absY + frame.height
end

local function hitResizeHandle(state, slide, layout, sx, sy)
  local selectionRecords = getSelectionRecords(state, slide)
  if #selectionRecords ~= 1 then return nil, nil end

  local record = selectionRecords[1]

  local half = HANDLE_SIZE * 0.5
  local handleNames = { "nw", "ne", "se", "sw" }
  for _, handle in ipairs(handleNames) do
    local wx, wy = getHandleWorldPosition(record, handle)
    local hx, hy = worldToScreen(layout, state.camera, wx, wy)
    if math.abs(sx - hx) <= half and math.abs(sy - hy) <= half then
      return handle, record
    end
  end

  return nil, record
end

local function resolveSlideBackground(document, slide)
  if slide and slide.backgroundColor then
    return slide.backgroundColor
  end
  local settings = document and document.settings or nil
  if settings and settings.backgroundColor then
    return settings.backgroundColor
  end
  local theme = document and document.theme or nil
  if theme and theme.colors and theme.colors.background then
    return theme.colors.background
  end
  return nil
end

local function resolveTextColor(document, nodeDef)
  local textStyle = nodeDef.textStyle or {}
  local style = nodeDef.style or {}
  if textStyle.color then return textStyle.color end
  if style.color then return style.color end
  local theme = document and document.theme or nil
  if theme and theme.colors and theme.colors.foreground then
    return theme.colors.foreground
  end
  return nil
end

local function resolveAccentColor(document)
  local theme = document and document.theme or nil
  if theme and theme.colors and theme.colors.accent then
    return theme.colors.accent
  end
  return nil
end

local function getFontForText(nodeDef)
  local textStyle = nodeDef.textStyle or {}
  local style = nodeDef.style or {}
  local fontSize = textStyle.fontSize or style.fontSize or 28
  local fontFamily = textStyle.fontFamily or style.fontFamily
  local fontWeight = textStyle.fontWeight or style.fontWeight
  if Measure and Measure.getFont then
    return Measure.getFont(fontSize, fontFamily, fontWeight)
  end
  if love.graphics and love.graphics.newFont then
    return love.graphics.newFont(fontSize)
  end
  return love.graphics.getFont()
end

local function drawShape(document, nodeDef, frame, absX, absY, opacity)
  local width = frame.width or 0
  local height = frame.height or 0
  local strokeWidth = nodeDef.strokeWidth or 2
  local shape = nodeDef.shape or "rectangle"

  if shape == "line" then
    setParsedColor(nodeDef.stroke or resolveAccentColor(document), opacity, FALLBACK_ACCENT)
    love.graphics.setLineWidth(strokeWidth)
    love.graphics.line(absX, absY, absX + width, absY + height)
    return
  end

  if nodeDef.fill then
    setParsedColor(nodeDef.fill, opacity, FALLBACK_MUTED)
    if shape == "ellipse" then
      love.graphics.ellipse("fill", absX + width * 0.5, absY + height * 0.5, width * 0.5, height * 0.5)
    else
      love.graphics.rectangle("fill", absX, absY, width, height, nodeDef.radius or 0, nodeDef.radius or 0)
    end
  end

  if nodeDef.stroke then
    setParsedColor(nodeDef.stroke, opacity, FALLBACK_ACCENT)
    love.graphics.setLineWidth(strokeWidth)
    if shape == "ellipse" then
      love.graphics.ellipse("line", absX + width * 0.5, absY + height * 0.5, width * 0.5, height * 0.5)
    else
      love.graphics.rectangle("line", absX, absY, width, height, nodeDef.radius or 0, nodeDef.radius or 0)
    end
  end
end

local function drawText(document, nodeDef, frame, absX, absY, opacity)
  local width = math.max(1, frame.width or 0)
  local padding = 12
  local font = getFontForText(nodeDef)
  local textStyle = nodeDef.textStyle or {}
  local style = nodeDef.style or {}
  local align = textStyle.textAlign or style.textAlign or "left"

  if font then
    love.graphics.setFont(font)
  end

  setParsedColor(resolveTextColor(document, nodeDef), opacity, FALLBACK_TEXT)
  love.graphics.printf(
    tostring(nodeDef.text or ""),
    absX + padding,
    absY + padding,
    math.max(1, width - padding * 2),
    align
  )

  if nodeDef.style and nodeDef.style.borderColor then
    setParsedColor(nodeDef.style.borderColor, opacity, FALLBACK_MUTED)
    love.graphics.setLineWidth((nodeDef.style.borderWidth or 1))
    love.graphics.rectangle("line", absX, absY, width, height, style.borderRadius or 0, style.borderRadius or 0)
  end
end

local function drawNodes(document, slide, nodes, parentX, parentY, opacity, state, layout)
  for _, entry in ipairs(sortedNodes(nodes)) do
    local nodeDef = entry.node
    if not nodeDef.hidden then
      local frame = resolveFrame(nodeDef, state.frameOverrides)
      local absX = parentX + (frame.x or 0)
      local absY = parentY + (frame.y or 0)
      local nodeOpacity = opacity * (nodeDef.opacity or 1)

      if nodeDef.kind == "shape" then
        drawShape(document, nodeDef, frame, absX, absY, nodeOpacity)
      elseif nodeDef.kind == "text" then
        drawText(document, nodeDef, frame, absX, absY, nodeOpacity)
      elseif nodeDef.kind == "group" and nodeDef.children then
        local restoreScissor = nil
        if nodeDef.clip then
          local sx1, sy1 = worldToScreen(layout, state.camera, absX, absY)
          local sx2, sy2 = worldToScreen(layout, state.camera, absX + (frame.width or 0), absY + (frame.height or 0))
          local prevScissor = { love.graphics.getScissor() }
          love.graphics.intersectScissor(
            math.min(sx1, sx2),
            math.min(sy1, sy2),
            math.abs(sx2 - sx1),
            math.abs(sy2 - sy1)
          )
          restoreScissor = prevScissor
        end

        drawNodes(document, slide, nodeDef.children, absX, absY, nodeOpacity, state, layout)

        if restoreScissor then
          if restoreScissor[1] then
            love.graphics.setScissor(unpack(restoreScissor))
          else
            love.graphics.setScissor()
          end
        end
      end
    end
  end
end

local function drawSelection(document, slide, state, layout, opacity)
  local selectionRecords = getSelectionRecords(state, slide)

  local accent = resolveAccentColor(document)
  local gesture = state.gesture
  if gesture and gesture.mode == "marquee" and gesture.dragged then
    local left, top, width, height = normalizeRect(
      gesture.startWorldX,
      gesture.startWorldY,
      gesture.currentWorldX,
      gesture.currentWorldY
    )
    setParsedColor(accent, opacity, FALLBACK_SELECTION)
    love.graphics.rectangle("fill", left, top, width, height)
    setParsedColor(accent, opacity, FALLBACK_ACCENT)
    love.graphics.setLineWidth(2 / math.max(layout.scale, 0.0001))
    love.graphics.rectangle("line", left, top, width, height)
  end

  if #selectionRecords == 0 then return end

  local outlineWidth = 2 / math.max(layout.scale, 0.0001)
  local handleWorldSize = HANDLE_SIZE / math.max(layout.scale, 0.0001)

  for _, record in ipairs(selectionRecords) do
    local frame = record.frame
    setParsedColor(accent, opacity, FALLBACK_SELECTION)
    love.graphics.rectangle("fill", record.absX, record.absY, frame.width, frame.height)

    setParsedColor(accent, opacity, FALLBACK_ACCENT)
    love.graphics.setLineWidth(outlineWidth)
    love.graphics.rectangle("line", record.absX, record.absY, frame.width, frame.height)
  end

  if #selectionRecords == 1 then
    local record = selectionRecords[1]
    local handleNames = { "nw", "ne", "se", "sw" }
    for _, handle in ipairs(handleNames) do
      local hx, hy = getHandleWorldPosition(record, handle)
      love.graphics.rectangle(
        "fill",
        hx - handleWorldSize * 0.5,
        hy - handleWorldSize * 0.5,
        handleWorldSize,
        handleWorldSize
      )
    end
  end
end

local function drawEmptyState(node, opacity)
  local c = node.computed
  if not c then return end
  local prevScissor = { love.graphics.getScissor() }

  love.graphics.push("all")
  love.graphics.intersectScissor(c.x, c.y, c.w, c.h)
  love.graphics.setColor(FALLBACK_WORKSPACE_BG[1], FALLBACK_WORKSPACE_BG[2], FALLBACK_WORKSPACE_BG[3], FALLBACK_WORKSPACE_BG[4] * opacity)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)
  love.graphics.setColor(FALLBACK_TEXT[1], FALLBACK_TEXT[2], FALLBACK_TEXT[3], FALLBACK_TEXT[4] * opacity)
  love.graphics.printf("PresentationEditor: no slide loaded", c.x + 20, c.y + c.h * 0.5 - 8, math.max(1, c.w - 40), "center")
  love.graphics.pop()

  if prevScissor[1] then
    love.graphics.setScissor(unpack(prevScissor))
  else
    love.graphics.setScissor()
  end
end

local function resizeFrameFromHandle(frame, handle, dx, dy)
  local x = frame.x or 0
  local y = frame.y or 0
  local width = frame.width or 0
  local height = frame.height or 0

  local right = x + width
  local bottom = y + height

  if handle == "nw" or handle == "sw" then
    x = math.min(x + dx, right - MIN_NODE_SIZE)
    width = right - x
  elseif handle == "ne" or handle == "se" then
    width = math.max(MIN_NODE_SIZE, width + dx)
  end

  if handle == "nw" or handle == "ne" then
    y = math.min(y + dy, bottom - MIN_NODE_SIZE)
    height = bottom - y
  elseif handle == "sw" or handle == "se" then
    height = math.max(MIN_NODE_SIZE, height + dy)
  end

  return {
    x = x,
    y = y,
    width = width,
    height = height,
    rotation = frame.rotation or 0,
    zIndex = frame.zIndex or 0,
  }
end

local function commitCameraPatch(node, state, slideId)
  emitCameraChange(node.id, slideId, state.camera, false)
  emitPatch(node.id, {
    type = "updateSlide",
    slideId = slideId,
    changes = {
      camera = {
        x = state.camera.x,
        y = state.camera.y,
        zoom = state.camera.zoom,
        rotation = state.camera.rotation,
      },
    },
  }, false)
end

local function emitNodeFramePatch(nodeId, slideId, targetNodeId, frame)
  emitPatch(nodeId, {
    type = "updateNode",
    slideId = slideId,
    nodeId = targetNodeId,
    changes = {
      frame = {
        x = frame.x,
        y = frame.y,
        width = frame.width,
        height = frame.height,
      },
    },
  }, false)
end

function PresentationEditor.init(config)
  config = config or {}
  Measure = config.measure
end

function PresentationEditor.drainEvents()
  local events = pendingEvents
  pendingEvents = {}
  return events
end

function PresentationEditor.update(dt, nodes)
  if not nodes then return end

  for _, node in pairs(nodes) do
    if node.type == "PresentationEditor" then
      local state = ensureState(node)
      local _, slide = syncState(node, state)
      if slide and state.cameraDirty and not state.gesture and state.cameraCommitTimer then
        state.cameraCommitTimer = state.cameraCommitTimer - dt
        if state.cameraCommitTimer <= 0 then
          state.cameraCommitTimer = nil
          commitCameraPatch(node, state, slide.id)
        end
      end
    end
  end
end

function PresentationEditor.handleMousePressed(node, sx, sy, button)
  if button ~= 1 then return false end

  local state = ensureState(node)
  local document, slide = syncState(node, state)
  if not document or not slide or not node.computed then return false end

  local layout = getViewportLayout(node, state, document)
  state.lastLayout = layout

  if not pointInRect(sx, sy, layout.x, layout.y, layout.w, layout.h) then
    return false
  end

  local shiftDown = love.keyboard.isDown("lshift", "rshift")
  local handle, selectedRecord = hitResizeHandle(state, slide, layout, sx, sy)
  if handle and selectedRecord and not selectedRecord.node.locked then
    local worldX, worldY = screenToWorld(layout, state.camera, sx, sy)
    state.gesture = {
      mode = "resize",
      nodeId = selectedRecord.node.id,
      handle = handle,
      startWorldX = worldX,
      startWorldY = worldY,
      startFrame = copyFrame(selectedRecord.frame),
    }
    return true
  end

  local worldX, worldY = screenToWorld(layout, state.camera, sx, sy)
  local hit = hitTestNodes(slide.nodes, worldX, worldY, 0, 0, state.frameOverrides)
  if hit then
    if shiftDown then
      if not isNodeSelected(state, slide.id, hit.node.id) then
        setSelection(node, state, mergeSelections(state.selection, {
          slideId = slide.id,
          nodeId = hit.node.id,
        }))
      end
    elseif not isNodeSelected(state, slide.id, hit.node.id) then
      setSelection(node, state, { slideId = slide.id, nodeId = hit.node.id })
    end

    if not hit.node.locked then
      local moveSelection = getSelectionRecords(state, slide)
      local startFrames = {}
      for _, record in ipairs(moveSelection) do
        if not record.node.locked then
          startFrames[record.node.id] = copyFrame(record.frame)
        end
      end

      state.gesture = {
        mode = "move",
        startWorldX = worldX,
        startWorldY = worldY,
        startFrames = startFrames,
      }
    else
      state.gesture = nil
    end
    return true
  end

  if shiftDown then
    state.gesture = {
      mode = "marquee",
      additive = true,
      startWorldX = worldX,
      startWorldY = worldY,
      currentWorldX = worldX,
      currentWorldY = worldY,
      startScreenX = sx,
      startScreenY = sy,
      dragged = false,
      baseSelection = normalizeSelectionItems(state.selection),
    }
    return true
  end

  setSelection(node, state, nil)

  local props = node.props or {}
  if props.allowPan == false then
    state.gesture = nil
    return true
  end

  state.gesture = {
    mode = "pan",
    startScreenX = sx,
    startScreenY = sy,
    startCamera = copyCamera(state.camera),
  }
  return true
end

function PresentationEditor.handleMouseMoved(node, sx, sy)
  local state = ensureState(node)
  local gesture = state.gesture
  if not gesture then return false end

  local document, slide = syncState(node, state)
  if not document or not slide then
    state.gesture = nil
    return false
  end

  local layout = getViewportLayout(node, state, document)
  state.lastLayout = layout

  if gesture.mode == "pan" then
    local dx = sx - gesture.startScreenX
    local dy = sy - gesture.startScreenY
    state.camera.x = gesture.startCamera.x - dx / math.max(layout.scale, 0.0001)
    state.camera.y = gesture.startCamera.y - dy / math.max(layout.scale, 0.0001)
    state.cameraDirty = true
    state.cameraCommitTimer = nil
    emitCameraChange(node.id, slide.id, state.camera, true)
    return true
  end

  local worldX, worldY = screenToWorld(layout, state.camera, sx, sy)

  if gesture.mode == "marquee" then
    gesture.currentWorldX = worldX
    gesture.currentWorldY = worldY
    if not gesture.dragged then
      gesture.dragged = math.abs(sx - gesture.startScreenX) >= MARQUEE_DRAG_THRESHOLD
        or math.abs(sy - gesture.startScreenY) >= MARQUEE_DRAG_THRESHOLD
    end
    return true
  end

  local dx = worldX - gesture.startWorldX
  local dy = worldY - gesture.startWorldY

  if gesture.mode == "move" then
    for nodeId, startFrame in pairs(gesture.startFrames or {}) do
      local nextFrame = copyFrame(startFrame)
      nextFrame.x = startFrame.x + dx
      nextFrame.y = startFrame.y + dy
      state.frameOverrides[nodeId] = nextFrame
    end
    return true
  end

  if gesture.mode == "resize" then
    state.frameOverrides[gesture.nodeId] = resizeFrameFromHandle(gesture.startFrame, gesture.handle, dx, dy)
    return true
  end

  return false
end

function PresentationEditor.handleMouseReleased(node, _sx, _sy, button)
  if button ~= 1 then return false end

  local state = ensureState(node)
  local gesture = state.gesture
  if not gesture then return false end

  local _, slide = syncState(node, state)
  state.gesture = nil

  if not slide then return false end

  if gesture.mode == "pan" then
    commitCameraPatch(node, state, slide.id)
    return true
  end

  if gesture.mode == "move" then
    for nodeId, startFrame in pairs(gesture.startFrames or {}) do
      local nextFrame = state.frameOverrides[nodeId]
      if nextFrame then
        if frameMatches(nextFrame, startFrame) then
          state.frameOverrides[nodeId] = nil
        else
          emitNodeFramePatch(node.id, slide.id, nodeId, nextFrame)
        end
      end
    end
    return true
  end

  if gesture.mode == "marquee" then
    if not gesture.dragged then
      setSelection(node, state, gesture.baseSelection)
      return true
    end

    local left, top, width, height = normalizeRect(
      gesture.startWorldX,
      gesture.startWorldY,
      gesture.currentWorldX,
      gesture.currentWorldY
    )
    local marqueeSelection = collectSelectionsInRect(
      slide.nodes,
      slide.id,
      left,
      top,
      width,
      height,
      0,
      0,
      state.frameOverrides
    )
    if gesture.additive then
      setSelection(node, state, mergeSelections(gesture.baseSelection, marqueeSelection))
    else
      setSelection(node, state, marqueeSelection)
    end
    return true
  end

  local nextFrame = state.frameOverrides[gesture.nodeId]
  if not nextFrame then
    return true
  end

  if frameMatches(nextFrame, gesture.startFrame) then
    state.frameOverrides[gesture.nodeId] = nil
    return true
  end

  emitNodeFramePatch(node.id, slide.id, gesture.nodeId, nextFrame)

  return true
end

function PresentationEditor.handleWheel(node, _dx, dy)
  if dy == 0 then return false end

  local props = node.props or {}
  if props.allowZoom == false then return false end

  local state = ensureState(node)
  local document, slide = syncState(node, state)
  if not document or not slide then return false end

  local layout = getViewportLayout(node, state, document)
  local mouseX, mouseY = love.mouse.getPosition()
  if not pointInRect(mouseX, mouseY, layout.x, layout.y, layout.w, layout.h) then
    return false
  end

  local beforeWorldX, beforeWorldY = screenToWorld(layout, state.camera, mouseX, mouseY)
  local nextZoom = clamp((state.camera.zoom or 1) * math.pow(1.12, dy), getMinZoom(node), getMaxZoom(node))
  if approxEqual(nextZoom, state.camera.zoom or 1) then
    return true
  end

  state.camera.zoom = nextZoom

  local nextLayout = getViewportLayout(node, state, document)
  state.camera.x = beforeWorldX - nextLayout.stageW * 0.5 - (mouseX - nextLayout.centerX) / math.max(nextLayout.scale, 0.0001)
  state.camera.y = beforeWorldY - nextLayout.stageH * 0.5 - (mouseY - nextLayout.centerY) / math.max(nextLayout.scale, 0.0001)
  state.lastLayout = nextLayout
  state.cameraDirty = true
  state.cameraCommitTimer = CAMERA_COMMIT_DELAY

  emitCameraChange(node.id, slide.id, state.camera, true)
  return true
end

function PresentationEditor.handleKeyPressed(node, key, _scancode, _isrepeat)
  local state = ensureState(node)
  local _, slide = syncState(node, state)
  if not slide then return false end

  if key == "a" and love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui") then
    setSelection(node, state, collectSelectableSelections(slide.nodes, slide.id))
    return true
  end

  if key == "escape" then
    if #state.selection > 0 then
      setSelection(node, state, nil)
      return true
    end
    return false
  end

  local selectionRecords = getSelectionRecords(state, slide)

  if (key == "delete" or key == "backspace") and #selectionRecords > 0 then
    local remainingSelection = {}
    for _, record in ipairs(selectionRecords) do
      if record.node.locked then
        remainingSelection[#remainingSelection + 1] = {
          slideId = slide.id,
          nodeId = record.node.id,
        }
      else
        state.frameOverrides[record.node.id] = nil
        emitPatch(node.id, {
          type = "removeNode",
          slideId = slide.id,
          nodeId = record.node.id,
        }, false)
      end
    end
    setSelection(node, state, remainingSelection)
    return true
  end

  local moveX = 0
  local moveY = 0
  if key == "left" then
    moveX = -1
  elseif key == "right" then
    moveX = 1
  elseif key == "up" then
    moveY = -1
  elseif key == "down" then
    moveY = 1
  end

  if (moveX ~= 0 or moveY ~= 0) and #selectionRecords > 0 then
    local step = love.keyboard.isDown("lshift", "rshift") and 10 or 1
    for _, record in ipairs(selectionRecords) do
      if not record.node.locked then
        local nextFrame = copyFrame(record.frame)
        nextFrame.x = nextFrame.x + moveX * step
        nextFrame.y = nextFrame.y + moveY * step
        state.frameOverrides[record.node.id] = nextFrame
        emitNodeFramePatch(node.id, slide.id, record.node.id, nextFrame)
      end
    end
    return true
  end

  if key == "=" or key == "kp+" or key == "-" or key == "kp-" or key == "0" or key == "kp0" then
    if key == "0" or key == "kp0" then
      state.camera = { x = 0, y = 0, zoom = 1, rotation = 0 }
    elseif key == "=" or key == "kp+" then
      state.camera.zoom = clamp((state.camera.zoom or 1) * 1.15, getMinZoom(node), getMaxZoom(node))
    else
      state.camera.zoom = clamp((state.camera.zoom or 1) / 1.15, getMinZoom(node), getMaxZoom(node))
    end
    state.cameraDirty = true
    state.cameraCommitTimer = nil
    commitCameraPatch(node, state, slide.id)
    return true
  end

  return false
end

function PresentationEditor.draw(node, opacity)
  local state = ensureState(node)
  if not node.computed then return end
  local document, slide = syncState(node, state)
  if not document or not slide then
    drawEmptyState(node, opacity or 1)
    return
  end

  local c = node.computed
  local layout = getViewportLayout(node, state, document)
  state.lastLayout = layout

  local prevScissor = { love.graphics.getScissor() }
  love.graphics.push("all")
  love.graphics.intersectScissor(c.x, c.y, c.w, c.h)

  setParsedColor(nil, opacity, FALLBACK_WORKSPACE_BG)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

  love.graphics.translate(layout.centerX, layout.centerY)
  love.graphics.scale(layout.scale, layout.scale)
  love.graphics.translate(-(layout.stageW * 0.5 + state.camera.x), -(layout.stageH * 0.5 + state.camera.y))

  local shadowOffset = 12 / math.max(layout.scale, 0.0001)
  love.graphics.setColor(0, 0, 0, 0.16 * (opacity or 1))
  love.graphics.rectangle("fill", shadowOffset, shadowOffset, layout.stageW, layout.stageH, 18 / layout.scale, 18 / layout.scale)

  setParsedColor(resolveSlideBackground(document, slide), opacity, FALLBACK_SLIDE_BG)
  love.graphics.rectangle("fill", 0, 0, layout.stageW, layout.stageH, 18 / layout.scale, 18 / layout.scale)

  if not (node.props and node.props.showGrid == false) then
    setParsedColor(nil, opacity, FALLBACK_MUTED)
    love.graphics.setLineWidth(1 / math.max(layout.scale, 0.0001))
    local gridStep = 80
    local x = 0
    while x <= layout.stageW do
      love.graphics.line(x, 0, x, layout.stageH)
      x = x + gridStep
    end
    local y = 0
    while y <= layout.stageH do
      love.graphics.line(0, y, layout.stageW, y)
      y = y + gridStep
    end
  end

  if not (node.props and node.props.showFrame == false) then
    setParsedColor(resolveAccentColor(document), opacity, FALLBACK_ACCENT)
    love.graphics.setLineWidth(2 / math.max(layout.scale, 0.0001))
    love.graphics.rectangle("line", 0, 0, layout.stageW, layout.stageH, 18 / layout.scale, 18 / layout.scale)
  end

  drawNodes(document, slide, slide.nodes, 0, 0, opacity or 1, state, layout)
  drawSelection(document, slide, state, layout, opacity or 1)

  love.graphics.pop()

  if prevScissor[1] then
    love.graphics.setScissor(unpack(prevScissor))
  else
    love.graphics.setScissor()
  end
end

return PresentationEditor
