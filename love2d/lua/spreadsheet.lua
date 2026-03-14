--[[
  spreadsheet.lua -- Lua-owned spreadsheet grid

  This is the hot path for the spreadsheet surface: drawing, selection,
  scrolling, column resize, evaluation, and direct cell editing all happen
  here in Lua. React keeps the small outer shell (formula/status bars and the
  public controlled API), but the expensive cell tree is gone.
]]

local Spreadsheet = {}

local Data = require("lua.capabilities.data")

local Measure = nil
local pendingEvents = {}

local ROW_HEADER_WIDTH = 52
local DEFAULT_COLUMN_WIDTH = 118
local DEFAULT_ROW_HEIGHT = 30
local DEFAULT_MIN_COLUMN_WIDTH = 72
local DEFAULT_MAX_COLUMN_WIDTH = 460
local DEFAULT_MAX_RANGE_CELLS = 10000
local DELETE_SENTINEL = { deleted = true }

function Spreadsheet.init(config)
  Measure = config.measure
end

local function getState(node)
  if not node._spreadsheet then
    node._spreadsheet = {
      selectedAddress = "A1",
      scrollX = 0,
      scrollY = 0,
      columnWidths = nil,
      renderedWidths = {},
      columnOffsets = {},
      totalWidth = ROW_HEADER_WIDTH,
      totalHeight = 0,
      overrides = {},
      effectiveCells = {},
      evaluation = { values = {}, errors = {} },
      editing = false,
      editingInput = "",
      dragKind = nil,
      resizeColumn = nil,
      resizeStartX = nil,
      resizeStartWidth = nil,
      needsEvaluation = true,
      needsLayout = true,
      needsStateEvent = true,
      lastStateSignature = nil,
      lastCellsRef = nil,
      lastWidthsRef = nil,
      lastSelectedProp = nil,
      lastCols = nil,
      lastRows = nil,
      lastViewportW = nil,
      lastViewportH = nil,
      lastFitColumns = nil,
      lastColumnWidth = nil,
      lastMinColumnWidth = nil,
      lastMaxColumnWidth = nil,
      lastRowHeight = nil,
    }
  end
  return node._spreadsheet
end

local function queueEvent(nodeId, eventType, payload)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    payload = payload or {},
  }
end

local function clamp(value, minValue, maxValue)
  return math.min(maxValue, math.max(minValue, value))
end

local function shallowCopyArray(values)
  local out = {}
  for i = 1, #values do
    out[i] = values[i]
  end
  return out
end

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

local function getFontHandle(fontSize)
  if Measure and Measure.getFont then
    return Measure.getFont(fontSize)
  end
  if love and love.graphics and love.graphics.newFont then
    return love.graphics.newFont(fontSize)
  end
  return nil
end

local function truncateText(font, text, maxWidth)
  text = tostring(text or "")
  if not font or maxWidth <= 0 then return "" end
  if font:getWidth(text) <= maxWidth then return text end
  local ellipsis = "..."
  local ellipsisWidth = font:getWidth(ellipsis)
  if ellipsisWidth >= maxWidth then return "" end
  local out = text
  while #out > 0 and font:getWidth(out) + ellipsisWidth > maxWidth do
    out = out:sub(1, #out - 1)
  end
  return out .. ellipsis
end

local function drawText(font, text, x, y, width, height, align, color)
  if not font then return end
  local clipped = truncateText(font, text, math.max(0, width - 8))
  local tw = font:getWidth(clipped)
  local tx = x + 4
  if align == "right" then
    tx = x + width - 4 - tw
  elseif align == "center" then
    tx = x + (width - tw) / 2
  end
  local ty = y + (height - font:getHeight()) / 2
  love.graphics.setFont(font)
  love.graphics.setColor(color[1], color[2], color[3], color[4])
  love.graphics.print(clipped, math.floor(tx + 0.5), math.floor(ty + 0.5))
end

local function intersectScissorRect(x, y, w, h)
  local sx, sy = love.graphics.transformPoint(x, y)
  local sx2, sy2 = love.graphics.transformPoint(x + w, y + h)
  local sw = math.max(0, sx2 - sx)
  local sh = math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)
end

local function toDisplayString(value)
  if type(value) == "number" then
    if value == math.floor(value) then return tostring(math.floor(value)) end
    local formatted = string.format("%.4f", value)
    formatted = formatted:gsub("%.?0+$", "")
    return formatted
  end
  return tostring(value)
end

local function isNumeric(value)
  if type(value) == "number" then return true end
  if type(value) == "boolean" then return false end
  local num = tonumber(tostring(value or ""):match("^%s*(.-)%s*$"))
  return num ~= nil
end

local function valueTypeLabel(value)
  if type(value) == "number" then return "number" end
  if type(value) == "boolean" then return "boolean" end
  if type(value) == "string" and #value == 0 then return "empty" end
  return "text"
end

local function normalizeWidthSource(source, index)
  if type(source) ~= "table" then return nil end
  return source[index + 1] or source[index]
end

local function normalizeColumnWidths(source, cols, fallbackWidth, minWidth, maxWidth)
  local out = {}
  for col = 0, cols - 1 do
    local raw = normalizeWidthSource(source, col)
    local width = tonumber(raw) or fallbackWidth
    out[col + 1] = clamp(width, minWidth, maxWidth)
  end
  return out
end

local function sum(values)
  local total = 0
  for i = 1, #values do
    total = total + values[i]
  end
  return total
end

local function fitColumnWidthsToViewport(widths, viewportWidth, rowHeaderWidth, minWidth, maxWidth)
  if #widths == 0 then return {} end

  local baseWidths = {}
  for i = 1, #widths do
    baseWidths[i] = clamp(widths[i], minWidth, maxWidth)
  end

  if type(viewportWidth) ~= "number" or viewportWidth <= rowHeaderWidth then
    return baseWidths
  end

  local availableWidth = viewportWidth - rowHeaderWidth
  local minTotal = minWidth * #widths
  local maxTotal = maxWidth * #widths

  if availableWidth <= minTotal then
    local out = {}
    for i = 1, #widths do out[i] = minWidth end
    return out
  end

  if availableWidth >= maxTotal then
    local out = {}
    for i = 1, #widths do out[i] = maxWidth end
    return out
  end

  local baseTotal = sum(baseWidths)
  if baseTotal <= 0 or math.abs(baseTotal - availableWidth) < 0.001 then
    return baseWidths
  end

  local result = {}
  local active = {}
  for i = 1, #widths do active[i] = true end
  local activeCount = #widths
  local remainingWidth = availableWidth
  local remainingBaseTotal = baseTotal

  while activeCount > 0 do
    local changed = false

    for index = 1, #widths do
      if active[index] then
        local proposed
        if remainingBaseTotal > 0 then
          proposed = remainingWidth * (baseWidths[index] / remainingBaseTotal)
        else
          proposed = remainingWidth / math.max(1, activeCount)
        end

        if proposed <= minWidth then
          result[index] = minWidth
          remainingWidth = remainingWidth - minWidth
          remainingBaseTotal = remainingBaseTotal - baseWidths[index]
          active[index] = false
          activeCount = activeCount - 1
          changed = true
        elseif proposed >= maxWidth then
          result[index] = maxWidth
          remainingWidth = remainingWidth - maxWidth
          remainingBaseTotal = remainingBaseTotal - baseWidths[index]
          active[index] = false
          activeCount = activeCount - 1
          changed = true
        end
      end
    end

    if not changed then break end
  end

  if activeCount == 0 then return result end

  local shareBaseTotal = remainingBaseTotal > 0 and remainingBaseTotal or activeCount
  for index = 1, #widths do
    if active[index] then
      local width
      if remainingBaseTotal > 0 then
        width = remainingWidth * (baseWidths[index] / math.max(1, shareBaseTotal))
      else
        width = remainingWidth / math.max(1, activeCount)
      end
      result[index] = clamp(width, minWidth, maxWidth)
    end
  end

  return result
end

local function getProps(node)
  local props = node.props or {}
  return {
    rows = tonumber(props.rows) or 20,
    cols = tonumber(props.cols) or 8,
    cells = type(props.cells) == "table" and props.cells or {},
    selectedAddress = type(props.selectedAddress) == "string" and props.selectedAddress or "A1",
    readOnly = props.readOnly or false,
    columnWidth = tonumber(props.columnWidth) or DEFAULT_COLUMN_WIDTH,
    columnWidths = type(props.columnWidths) == "table" and props.columnWidths or nil,
    resizableColumns = props.resizableColumns ~= false,
    minColumnWidth = math.max(48, tonumber(props.minColumnWidth) or DEFAULT_MIN_COLUMN_WIDTH),
    maxColumnWidth = math.max(
      math.max(48, tonumber(props.minColumnWidth) or DEFAULT_MIN_COLUMN_WIDTH),
      tonumber(props.maxColumnWidth) or DEFAULT_MAX_COLUMN_WIDTH
    ),
    fitColumnsToViewport = props.fitColumnsToViewport or false,
    rowHeight = tonumber(props.rowHeight) or DEFAULT_ROW_HEIGHT,
    autoScrollToSelection = props.autoScrollToSelection ~= false,
    colors = {
      bg = props.colorBg or "#0f172a",
      bgAlt = props.colorBgAlt or "#111827",
      surface = props.colorSurface or "#1f2937",
      border = props.colorBorder or "#334155",
      text = props.colorText or "#e5e7eb",
      textDim = props.colorTextDim or "#94a3b8",
      accent = props.colorAccent or "#22d3ee",
      accentSoft = props.colorAccentSoft or "#164e63",
      error = props.colorError or "#ef4444",
    },
  }
end

local function buildEffectiveCells(state, props)
  local effective = {}
  for address, raw in pairs(props.cells) do
    effective[Data.normalizeAddress(address)] = tostring(raw)
  end

  for address, override in pairs(state.overrides) do
    if override == DELETE_SENTINEL then
      if effective[address] == nil then
        state.overrides[address] = nil
      else
        effective[address] = nil
      end
    else
      if effective[address] == override then
        state.overrides[address] = nil
      else
        effective[address] = override
      end
    end
  end

  state.effectiveCells = effective
  state.lastCellsRef = props.cells
end

local function buildEvaluationTargets(cells, selectedAddress)
  local targets = {}
  local seen = {}
  for address in pairs(cells) do
    local normalized = Data.normalizeAddress(address)
    if not seen[normalized] then
      seen[normalized] = true
      targets[#targets + 1] = normalized
    end
  end
  if not seen[selectedAddress] then
    targets[#targets + 1] = selectedAddress
  end
  return targets
end

local function countErrors(errors)
  local total = 0
  for _ in pairs(errors) do total = total + 1 end
  return total
end

local function buildStatePayload(state)
  local address = state.selectedAddress
  local rawInput = state.effectiveCells[address] or ""
  local draftInput = state.editing and state.editingInput or rawInput
  local value = state.evaluation.values[address] or ""
  local error = state.evaluation.errors[address]
  return {
    address = address,
    rawInput = rawInput,
    draftInput = draftInput,
    value = value,
    error = error,
    editing = state.editing,
    valueType = valueTypeLabel(value),
    valueDisplay = error and "#ERR" or toDisplayString(value),
    errorCount = countErrors(state.evaluation.errors),
  }
end

local function emitStateIfNeeded(node, state)
  local payload = buildStatePayload(state)
  local signature = table.concat({
    payload.address or "",
    payload.rawInput or "",
    payload.draftInput or "",
    tostring(payload.value),
    payload.error or "",
    payload.editing and "1" or "0",
    payload.valueType or "",
    payload.valueDisplay or "",
    tostring(payload.errorCount or 0),
  }, "\31")

  if state.needsStateEvent or state.lastStateSignature ~= signature then
    state.lastStateSignature = signature
    state.needsStateEvent = false
    queueEvent(node.id, "spreadsheet:state", payload)
  end
end

local function refreshEvaluation(state, props)
  buildEffectiveCells(state, props)
  local targets = buildEvaluationTargets(state.effectiveCells, state.selectedAddress)
  state.evaluation = Data.evaluate(state.effectiveCells, targets, DEFAULT_MAX_RANGE_CELLS)
  state.needsEvaluation = false
  state.needsStateEvent = true
end

local function refreshLayout(node, state, props)
  local computed = node.computed
  if not computed then return end

  local widthPropsChanged = (
    state.columnWidths == nil
    or state.lastWidthsRef ~= props.columnWidths
    or state.lastCols ~= props.cols
    or state.lastColumnWidth ~= props.columnWidth
    or state.lastMinColumnWidth ~= props.minColumnWidth
    or state.lastMaxColumnWidth ~= props.maxColumnWidth
  )

  if widthPropsChanged then
    state.columnWidths = normalizeColumnWidths(
      props.columnWidths,
      props.cols,
      props.columnWidth,
      props.minColumnWidth,
      props.maxColumnWidth
    )
    state.lastWidthsRef = props.columnWidths
  end

  local layoutChanged = (
    state.needsLayout
    or widthPropsChanged
    or state.lastViewportW ~= computed.w
    or state.lastViewportH ~= computed.h
    or state.lastFitColumns ~= props.fitColumnsToViewport
    or state.lastCols ~= props.cols
    or state.lastRows ~= props.rows
    or state.lastRowHeight ~= props.rowHeight
  )

  if not layoutChanged then return end

  if props.fitColumnsToViewport then
    state.renderedWidths = fitColumnWidthsToViewport(
      state.columnWidths,
      computed.w,
      ROW_HEADER_WIDTH,
      props.minColumnWidth,
      props.maxColumnWidth
    )
  else
    state.renderedWidths = shallowCopyArray(state.columnWidths)
  end

  local offsets = {}
  local left = ROW_HEADER_WIDTH
  for col = 1, props.cols do
    offsets[col] = left
    left = left + (state.renderedWidths[col] or props.columnWidth)
  end

  state.columnOffsets = offsets
  state.totalWidth = ROW_HEADER_WIDTH + sum(state.renderedWidths)
  state.totalHeight = (props.rows + 1) * props.rowHeight

  state.scrollX = clamp(state.scrollX, 0, math.max(0, state.totalWidth - computed.w))
  state.scrollY = clamp(state.scrollY, 0, math.max(0, state.totalHeight - computed.h))

  state.lastViewportW = computed.w
  state.lastViewportH = computed.h
  state.lastFitColumns = props.fitColumnsToViewport
  state.lastCols = props.cols
  state.lastRows = props.rows
  state.lastColumnWidth = props.columnWidth
  state.lastMinColumnWidth = props.minColumnWidth
  state.lastMaxColumnWidth = props.maxColumnWidth
  state.lastRowHeight = props.rowHeight
  state.needsLayout = false
end

local function ensureSelectionVisible(node, state, props)
  if not props.autoScrollToSelection then return end
  local computed = node.computed
  if not computed then return end

  local location = Data.parseCellAddress(state.selectedAddress) or { col = 0, row = 0 }
  local col = clamp(location.col, 0, math.max(0, props.cols - 1))
  local row = clamp(location.row, 0, math.max(0, props.rows - 1))
  local cellLeft = state.columnOffsets[col + 1] or ROW_HEADER_WIDTH
  local cellWidth = state.renderedWidths[col + 1] or props.columnWidth
  local cellTop = props.rowHeight + row * props.rowHeight
  local cellRight = cellLeft + cellWidth
  local cellBottom = cellTop + props.rowHeight

  local viewLeft = state.scrollX + ROW_HEADER_WIDTH
  local viewTop = state.scrollY + props.rowHeight
  local viewRight = state.scrollX + computed.w
  local viewBottom = state.scrollY + computed.h

  if cellLeft < viewLeft then
    state.scrollX = cellLeft - ROW_HEADER_WIDTH
  elseif cellRight > viewRight then
    state.scrollX = cellRight - computed.w
  end

  if cellTop < viewTop then
    state.scrollY = cellTop - props.rowHeight
  elseif cellBottom > viewBottom then
    state.scrollY = cellBottom - computed.h
  end

  state.scrollX = clamp(state.scrollX, 0, math.max(0, state.totalWidth - computed.w))
  state.scrollY = clamp(state.scrollY, 0, math.max(0, state.totalHeight - computed.h))
end

local function refreshState(node)
  local state = getState(node)
  local props = getProps(node)

  local normalizedSelected = Data.normalizeAddress(props.selectedAddress)
  if state.selectedAddress == nil or state.selectedAddress == "" then
    state.selectedAddress = normalizedSelected
    state.needsEvaluation = true
    state.needsStateEvent = true
  elseif normalizedSelected ~= "" and normalizedSelected ~= state.selectedAddress and normalizedSelected ~= state.lastSelectedProp then
    state.selectedAddress = normalizedSelected
    state.needsEvaluation = true
    state.needsStateEvent = true
  end
  state.lastSelectedProp = normalizedSelected

  if state.lastCellsRef ~= props.cells then
    state.needsEvaluation = true
  end

  refreshLayout(node, state, props)

  if state.needsEvaluation then
    refreshEvaluation(state, props)
    refreshLayout(node, state, props)
    ensureSelectionVisible(node, state, props)
  end

  emitStateIfNeeded(node, state)
  return state, props
end

local function queueSelectionEvents(node, state)
  queueEvent(node.id, "spreadsheet:select", { address = state.selectedAddress })
  state.needsStateEvent = true
end

local function startEditing(node, state, props, seedInput)
  if props.readOnly then return false end
  state.editing = true
  state.editingInput = seedInput ~= nil and tostring(seedInput) or (state.effectiveCells[state.selectedAddress] or "")
  state.needsStateEvent = true
  emitStateIfNeeded(node, state)
  return true
end

local function cancelEditing(node, state)
  state.editing = false
  state.editingInput = ""
  state.needsStateEvent = true
  emitStateIfNeeded(node, state)
end

local function commitEditing(node, state, props, nextAddress)
  if not state.editing then return false end

  local address = state.selectedAddress
  local input = state.editingInput
  if #input == 0 then
    state.overrides[address] = DELETE_SENTINEL
  else
    state.overrides[address] = input
  end

  state.editing = false
  state.editingInput = ""
  state.needsEvaluation = true
  refreshEvaluation(state, props)
  queueEvent(node.id, "spreadsheet:change", {
    address = address,
    input = input,
  })

  if nextAddress then
    state.selectedAddress = Data.normalizeAddress(nextAddress)
    ensureSelectionVisible(node, state, props)
    queueSelectionEvents(node, state)
  end

  state.needsStateEvent = true
  emitStateIfNeeded(node, state)
  return true
end

local function normalizeKey(key, scancode)
  local raw = string.lower(tostring(key or scancode or ""))
  if raw == "return" then return "enter" end
  if raw == "kpenter" then return "enter" end
  if raw == "esc" then return "escape" end
  if raw == "arrowleft" then return "left" end
  if raw == "arrowright" then return "right" end
  if raw == "arrowup" then return "up" end
  if raw == "arrowdown" then return "down" end
  return raw
end

local function getNavigatedAddress(selectedAddress, rows, cols, key, shift)
  local selected = Data.parseCellAddress(selectedAddress) or { col = 0, row = 0 }
  local maxCol = math.max(0, cols - 1)
  local maxRow = math.max(0, rows - 1)
  local col = selected.col
  local row = selected.row

  if key == "left" then
    col = clamp(col - 1, 0, maxCol)
  elseif key == "right" then
    col = clamp(col + 1, 0, maxCol)
  elseif key == "up" then
    row = clamp(row - 1, 0, maxRow)
  elseif key == "down" then
    row = clamp(row + 1, 0, maxRow)
  elseif key == "enter" then
    row = clamp(row + (shift and -1 or 1), 0, maxRow)
  elseif key == "tab" then
    if shift then
      if col > 0 then
        col = col - 1
      elseif row > 0 then
        row = row - 1
        col = maxCol
      end
    elseif col < maxCol then
      col = col + 1
    elseif row < maxRow then
      row = row + 1
      col = 0
    end
  else
    return nil
  end

  return Data.buildAddress(col, row)
end

local function selectAddress(node, state, props, address)
  local normalized = Data.normalizeAddress(address)
  if normalized == state.selectedAddress then
    state.needsStateEvent = true
    emitStateIfNeeded(node, state)
    return true
  end
  state.selectedAddress = normalized
  state.needsEvaluation = true
  refreshEvaluation(state, props)
  ensureSelectionVisible(node, state, props)
  queueSelectionEvents(node, state)
  emitStateIfNeeded(node, state)
  return true
end

local function getCellAtPosition(node, state, props, mx, my)
  local computed = node.computed
  if not computed then return nil end

  local localX = mx - computed.x
  local localY = my - computed.y
  if localY < props.rowHeight then
    return nil
  end
  if localX < ROW_HEADER_WIDTH then
    return nil
  end

  local contentX = localX + state.scrollX
  local contentY = localY + state.scrollY

  local row = math.floor((contentY - props.rowHeight) / props.rowHeight)
  if row < 0 or row >= props.rows then
    return nil, contentX, contentY
  end

  local col = nil
  for idx = 1, props.cols do
    local left = state.columnOffsets[idx]
    local width = state.renderedWidths[idx] or props.columnWidth
    if contentX >= left and contentX < left + width then
      col = idx - 1
      break
    end
  end

  if col == nil then return nil, contentX, contentY end
  return Data.buildAddress(col, row), contentX, contentY
end

local function getResizeHit(state, props, localX, localY)
  if localY < 0 or localY > props.rowHeight then return nil end
  local contentX = localX + state.scrollX
  for idx = 1, props.cols do
    local right = (state.columnOffsets[idx] or ROW_HEADER_WIDTH) + (state.renderedWidths[idx] or props.columnWidth)
    if math.abs(contentX - right) <= 6 then
      return idx
    end
  end
  return nil
end

function Spreadsheet.draw(node, effectiveOpacity)
  local computed = node.computed
  if not computed or computed.w <= 0 or computed.h <= 0 then return end

  local state, props = refreshState(node)
  local colors = {
    bg = { parseColor(props.colors.bg) },
    bgAlt = { parseColor(props.colors.bgAlt) },
    surface = { parseColor(props.colors.surface) },
    border = { parseColor(props.colors.border) },
    text = { parseColor(props.colors.text) },
    textDim = { parseColor(props.colors.textDim) },
    accent = { parseColor(props.colors.accent) },
    accentSoft = { parseColor(props.colors.accentSoft) },
    error = { parseColor(props.colors.error) },
  }

  local prevScissor = { love.graphics.getScissor() }
  intersectScissorRect(computed.x, computed.y, computed.w, computed.h)
  local widgetScissorX, widgetScissorY, widgetScissorW, widgetScissorH = love.graphics.getScissor()

  local headerFont = getFontHandle(10)
  local bodyFont = getFontHandle(10)
  local rowFont = getFontHandle(9)

  local selectedLocation = Data.parseCellAddress(state.selectedAddress) or { col = 0, row = 0 }
  local firstRow = math.max(0, math.floor(math.max(0, state.scrollY - props.rowHeight) / props.rowHeight))
  local visibleRows = math.max(1, math.ceil(computed.h / props.rowHeight) + 2)
  local lastRow = math.min(props.rows - 1, firstRow + visibleRows)
  local bodyWidth = math.max(0, computed.w - ROW_HEADER_WIDTH)
  local bodyHeight = math.max(0, computed.h - props.rowHeight)

  if bodyWidth > 0 and bodyHeight > 0 then
    intersectScissorRect(computed.x + ROW_HEADER_WIDTH, computed.y + props.rowHeight, bodyWidth, bodyHeight)
    for row = firstRow, lastRow do
      local y = computed.y + props.rowHeight + row * props.rowHeight - state.scrollY
      if y + props.rowHeight >= computed.y + props.rowHeight and y <= computed.y + computed.h then
        local rowSelected = selectedLocation.row == row
        for idx = 1, props.cols do
          local width = state.renderedWidths[idx] or props.columnWidth
          local x = computed.x + (state.columnOffsets[idx] or ROW_HEADER_WIDTH) - state.scrollX
          if x + width >= computed.x + ROW_HEADER_WIDTH and x <= computed.x + computed.w then
            local address = Data.buildAddress(idx - 1, row)
            local selected = address == state.selectedAddress
            local inSelectionBand = selectedLocation.col == (idx - 1) or rowSelected
            local cellBg = colors.bgAlt
            if selected then
              cellBg = colors.accentSoft
            elseif inSelectionBand then
              cellBg = colors.surface
            end

            love.graphics.setColor(cellBg[1], cellBg[2], cellBg[3], cellBg[4] * effectiveOpacity)
            love.graphics.rectangle("fill", x, y, width, props.rowHeight)

            local borderColor = selected and colors.accent or colors.border
            love.graphics.setColor(borderColor[1], borderColor[2], borderColor[3], borderColor[4] * effectiveOpacity)
            love.graphics.rectangle("line", x, y, width, props.rowHeight)

            local displayValue
            local align = "left"
            local textColor = colors.text

            if selected and state.editing then
              local showCursor = math.floor((love.timer.getTime() or 0) * 2) % 2 == 0
              displayValue = state.editingInput .. (showCursor and "|" or "")
            else
              local error = state.evaluation.errors[address]
              local value = state.evaluation.values[address] or ""
              if error then
                displayValue = "#ERR"
                textColor = colors.error
              else
                displayValue = toDisplayString(value)
                if isNumeric(value) then align = "right" end
              end
            end

            drawText(bodyFont, displayValue, x, y, width, props.rowHeight, align, {
              textColor[1], textColor[2], textColor[3], textColor[4] * effectiveOpacity,
            })
          end
        end
      end
    end
    love.graphics.setScissor(widgetScissorX, widgetScissorY, widgetScissorW, widgetScissorH)
  end

  if computed.h > props.rowHeight then
    intersectScissorRect(computed.x, computed.y + props.rowHeight, math.min(ROW_HEADER_WIDTH, computed.w), computed.h - props.rowHeight)
    for row = firstRow, lastRow do
      local y = computed.y + props.rowHeight + row * props.rowHeight - state.scrollY
      if y + props.rowHeight >= computed.y + props.rowHeight and y <= computed.y + computed.h then
        local rowSelected = selectedLocation.row == row
        local rowBg = rowSelected and colors.accentSoft or colors.surface
        local rowX = computed.x
        love.graphics.setColor(rowBg[1], rowBg[2], rowBg[3], rowBg[4] * effectiveOpacity)
        love.graphics.rectangle("fill", rowX, y, ROW_HEADER_WIDTH, props.rowHeight)
        love.graphics.setColor(colors.border[1], colors.border[2], colors.border[3], colors.border[4] * effectiveOpacity)
        love.graphics.rectangle("line", rowX, y, ROW_HEADER_WIDTH, props.rowHeight)
        local rowTextColor = rowSelected and colors.accent or colors.textDim
        drawText(rowFont, tostring(row + 1), rowX, y, ROW_HEADER_WIDTH, props.rowHeight, "center", {
          rowTextColor[1], rowTextColor[2], rowTextColor[3], rowTextColor[4] * effectiveOpacity,
        })
      end
    end
    love.graphics.setScissor(widgetScissorX, widgetScissorY, widgetScissorW, widgetScissorH)
  end

  intersectScissorRect(computed.x, computed.y, math.min(ROW_HEADER_WIDTH, computed.w), math.min(props.rowHeight, computed.h))
  love.graphics.setColor(colors.surface[1], colors.surface[2], colors.surface[3], colors.surface[4] * effectiveOpacity)
  love.graphics.rectangle("fill", computed.x, computed.y, ROW_HEADER_WIDTH, props.rowHeight)
  love.graphics.setColor(colors.border[1], colors.border[2], colors.border[3], colors.border[4] * effectiveOpacity)
  love.graphics.rectangle("line", computed.x, computed.y, ROW_HEADER_WIDTH, props.rowHeight)
  drawText(rowFont, "ROW", computed.x, computed.y, ROW_HEADER_WIDTH, props.rowHeight, "center", {
    colors.textDim[1], colors.textDim[2], colors.textDim[3], colors.textDim[4] * effectiveOpacity,
  })
  love.graphics.setScissor(widgetScissorX, widgetScissorY, widgetScissorW, widgetScissorH)

  if computed.w > ROW_HEADER_WIDTH then
    intersectScissorRect(computed.x + ROW_HEADER_WIDTH, computed.y, computed.w - ROW_HEADER_WIDTH, math.min(props.rowHeight, computed.h))
    for idx = 1, props.cols do
      local width = state.renderedWidths[idx] or props.columnWidth
      local x = computed.x + (state.columnOffsets[idx] or ROW_HEADER_WIDTH) - state.scrollX
      if x + width >= computed.x + ROW_HEADER_WIDTH and x <= computed.x + computed.w then
        local selected = selectedLocation.col == (idx - 1)
        local bg = selected and colors.accentSoft or colors.surface
        love.graphics.setColor(bg[1], bg[2], bg[3], bg[4] * effectiveOpacity)
        love.graphics.rectangle("fill", x, computed.y, width, props.rowHeight)
        love.graphics.setColor(colors.border[1], colors.border[2], colors.border[3], colors.border[4] * effectiveOpacity)
        love.graphics.rectangle("line", x, computed.y, width, props.rowHeight)
        local textColor = selected and colors.accent or colors.text
        drawText(headerFont, Data.columnIndexToLabel(idx - 1), x, computed.y, width, props.rowHeight, "center", {
          textColor[1], textColor[2], textColor[3], textColor[4] * effectiveOpacity,
        })

        if props.resizableColumns and not props.readOnly then
          local handleColor = colors.border
          if state.dragKind == "resize" and state.resizeColumn == idx then
            handleColor = colors.accent
          end
          love.graphics.setColor(handleColor[1], handleColor[2], handleColor[3], handleColor[4] * effectiveOpacity)
          love.graphics.rectangle("fill", x + width - 2, computed.y + 5, 2, props.rowHeight - 10)
        end
      end
    end
    love.graphics.setScissor(widgetScissorX, widgetScissorY, widgetScissorW, widgetScissorH)
  end

  if prevScissor[1] then
    love.graphics.setScissor(prevScissor[1], prevScissor[2], prevScissor[3], prevScissor[4])
  else
    love.graphics.setScissor()
  end

  emitStateIfNeeded(node, state)
end

function Spreadsheet.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state, props = refreshState(node)
  local computed = node.computed
  if not computed then return false end

  local localX = mx - computed.x
  local localY = my - computed.y

  if props.resizableColumns and not props.readOnly then
    local resizeColumn = getResizeHit(state, props, localX, localY)
    if resizeColumn then
      state.dragKind = "resize"
      state.resizeColumn = resizeColumn
      state.resizeStartX = localX + state.scrollX
      state.resizeStartWidth = state.columnWidths[resizeColumn] or props.columnWidth
      return true
    end
  end

  local address = getCellAtPosition(node, state, props, mx, my)
  if not address then return false end

  if state.editing and address ~= state.selectedAddress then
    commitEditing(node, state, props)
  end

  selectAddress(node, state, props, address)
  return true
end

function Spreadsheet.handleMouseMoved(node, mx, my)
  local state, props = refreshState(node)
  if state.dragKind ~= "resize" or state.resizeColumn == nil then return false end
  local computed = node.computed
  if not computed then return false end

  local contentX = mx - computed.x + state.scrollX
  local delta = contentX - (state.resizeStartX or contentX)
  local nextWidth = clamp(
    (state.resizeStartWidth or state.columnWidths[state.resizeColumn] or props.columnWidth) + delta,
    props.minColumnWidth,
    props.maxColumnWidth
  )

  state.columnWidths[state.resizeColumn] = nextWidth
  state.needsLayout = true
  refreshLayout(node, state, props)
  return true
end

function Spreadsheet.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if state.dragKind ~= "resize" then return false end
  state.dragKind = nil
  state.resizeColumn = nil
  state.resizeStartX = nil
  state.resizeStartWidth = nil
  queueEvent(node.id, "spreadsheet:columnresize", {
    widths = shallowCopyArray(state.columnWidths or {}),
  })
  return true
end

function Spreadsheet.handleWheel(node, x, y)
  local state, props = refreshState(node)
  local computed = node.computed
  if not computed then return false end

  local wheelX = x or 0
  local wheelY = y or 0
  if wheelY ~= 0 and wheelX == 0 and love.keyboard.isDown("lshift", "rshift") then
    wheelX = wheelY
    wheelY = 0
  end

  local maxScrollX = math.max(0, state.totalWidth - computed.w)
  local maxScrollY = math.max(0, state.totalHeight - computed.h)
  if maxScrollX <= 0 and maxScrollY <= 0 then return false end

  state.scrollX = clamp(state.scrollX - wheelX * 40, 0, maxScrollX)
  state.scrollY = clamp(state.scrollY - wheelY * 40, 0, maxScrollY)
  return true
end

function Spreadsheet.handleKeyPressed(node, key, scancode, isrepeat)
  local state, props = refreshState(node)
  local normalized = normalizeKey(key, scancode)
  local shift = love.keyboard.isDown("lshift", "rshift")

  if state.editing then
    if normalized == "escape" then
      cancelEditing(node, state)
      return true
    end
    if normalized == "backspace" then
      if #state.editingInput > 0 then
        state.editingInput = state.editingInput:sub(1, #state.editingInput - 1)
        state.needsStateEvent = true
        emitStateIfNeeded(node, state)
      end
      return true
    end
    if normalized == "delete" then
      state.editingInput = ""
      state.needsStateEvent = true
      emitStateIfNeeded(node, state)
      return true
    end
    if normalized == "enter" or normalized == "tab" then
      local nextAddress = getNavigatedAddress(state.selectedAddress, props.rows, props.cols, normalized, shift)
      commitEditing(node, state, props, nextAddress)
      return true
    end
    return normalized == "left" or normalized == "right" or normalized == "up" or normalized == "down"
  end

  local nextAddress = getNavigatedAddress(state.selectedAddress, props.rows, props.cols, normalized, shift)
  if nextAddress then
    selectAddress(node, state, props, nextAddress)
    return true
  end

  if props.readOnly then return false end

  if normalized == "f2" then
    return startEditing(node, state, props)
  end
  if normalized == "backspace" or normalized == "delete" then
    return startEditing(node, state, props, "")
  end

  return false
end

function Spreadsheet.handleTextInput(node, text)
  if type(text) ~= "string" or #text == 0 then return false end

  local state, props = refreshState(node)
  if props.readOnly then return false end
  if text:match("[%z\1-\31]") then return false end

  if not state.editing then
    state.editing = true
    state.editingInput = text
  else
    state.editingInput = state.editingInput .. text
  end

  state.needsStateEvent = true
  emitStateIfNeeded(node, state)
  return true
end

function Spreadsheet.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Spreadsheet
