--[[
  capabilities/imaging.lua — Visual image processing capability

  Renders a processed image inline in the layout tree. Load a source image,
  apply a chain of operations (color adjustments, filters, blend modes),
  and see the result live.

  React usage:
    <Native type="Imaging" src="lib/placeholders/landscape.png"
      operations='[{"op":"brightness","amount":0.2}]'
      style={{ width: 300, height: 200 }} />

  If no src is provided, generates a procedural test pattern.
]]

local Capabilities = require("lua.capabilities")
local Imaging = require("lua.imaging")
local json = require("lua.json")

-- Per-instance canvas cache: nodeId -> canvas
local renderCache = {}

--- Generate a procedural test pattern canvas (color bars + gradient).
local function generateTestPattern(w, h)
  w = w or 260
  h = h or 180
  if w <= 0 then w = 260 end
  if h <= 0 then h = 180 end
  local canvas = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 1)

  -- Color bars (top half)
  local barColors = {
    {1, 0, 0}, {0, 1, 0}, {0, 0, 1},
    {1, 1, 0}, {1, 0, 1}, {0, 1, 1},
    {1, 0.5, 0}, {0.5, 0, 1},
  }
  local barW = w / #barColors
  local barH = h * 0.5
  for i, c in ipairs(barColors) do
    love.graphics.setColor(c[1], c[2], c[3], 1)
    love.graphics.rectangle("fill", (i - 1) * barW, 0, barW, barH)
  end

  -- Gradient (bottom half)
  local gradH = h * 0.25
  for x = 0, w - 1 do
    local t = x / w
    love.graphics.setColor(t, t, t, 1)
    love.graphics.rectangle("fill", x, barH, 1, gradH)
  end

  -- HSV hue sweep (bottom quarter)
  local hueH = h * 0.25
  for x = 0, w - 1 do
    local hue = x / w
    local r, g, b
    local seg = math.floor(hue * 6)
    local f = hue * 6 - seg
    if seg == 0 or seg == 6 then r, g, b = 1, f, 0
    elseif seg == 1 then r, g, b = 1 - f, 1, 0
    elseif seg == 2 then r, g, b = 0, 1, f
    elseif seg == 3 then r, g, b = 0, 1 - f, 1
    elseif seg == 4 then r, g, b = f, 0, 1
    else r, g, b = 1, 0, 1 - f end
    love.graphics.setColor(r, g, b, 1)
    love.graphics.rectangle("fill", x, barH + gradH, 1, hueH)
  end

  love.graphics.pop()
  return canvas
end

--- Process a source canvas through an operation pipeline.
local function processImage(source, opsStr)
  if not opsStr or opsStr == "" or opsStr == "[]" then
    return source, false
  end

  local ok, opsList = pcall(json.decode, opsStr)
  if not ok or type(opsList) ~= "table" or #opsList == 0 then
    return source, false
  end

  local pipeline = Imaging.fromCanvas(source)
  for _, op in ipairs(opsList) do
    local name = op.op
    if name then
      local params = {}
      for k, v in pairs(op) do
        if k ~= "op" then params[k] = v end
      end
      pipeline:op(name, params)
    end
  end

  local execOk, result = pcall(function() return pipeline:apply() end)
  if execOk and result then
    return result, true
  end
  return source, false
end

Capabilities.register("Imaging", {
  visual = true,

  schema = {
    src        = { type = "string", desc = "Source image path (omit for test pattern)" },
    operations = { type = "string", desc = "JSON-encoded operation pipeline array" },
    output     = { type = "string", desc = "Output file path (optional, for save)" },
  },

  events = { "onComplete", "onError" },

  create = function(nodeId, props)
    return {
      dirty = true,
      lastSrc = nil,
      lastOps = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.src ~= state.lastSrc or props.operations ~= state.lastOps then
      state.dirty = true
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.dirty then return end
    state.dirty = false
    state.lastSrc = props.src
    state.lastOps = props.operations

    -- Load or generate source
    local source
    if props.src and props.src ~= "" then
      local loadOk, img = pcall(love.graphics.newImage, props.src)
      if loadOk then
        local iw, ih = img:getWidth(), img:getHeight()
        source = love.graphics.newCanvas(iw, ih)
        love.graphics.push("all")
        love.graphics.setCanvas(source)
        love.graphics.clear(0, 0, 0, 0)
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(img, 0, 0)
        love.graphics.pop()
        img:release()
      else
        source = generateTestPattern(260, 180)
        if pushEvent then
          pushEvent({
            type = "capability",
            payload = { targetId = nodeId, handler = "onError", message = "Failed to load: " .. tostring(props.src) },
          })
        end
      end
    else
      source = generateTestPattern(260, 180)
    end

    -- Process
    local result, didProcess = processImage(source, props.operations)

    -- Release old cached canvas
    local old = renderCache[nodeId]
    if old then old:release() end

    -- Release source if we created a new result canvas
    if didProcess and source ~= result then
      source:release()
    end

    renderCache[nodeId] = result

    -- Save if output specified
    if props.output and props.output ~= "" then
      pcall(Imaging.save, result, props.output)
    end

    if pushEvent then
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onComplete",
          width = result:getWidth(),
          height = result:getHeight(),
        },
      })
    end
  end,

  render = function(node, c, opacity)
    local canvas = renderCache[node.id]
    if not canvas then return end

    local cw, ch = canvas:getWidth(), canvas:getHeight()
    if cw <= 0 or ch <= 0 then return end
    if c.w <= 0 or c.h <= 0 then return end

    -- Scale to fit node bounds (contain)
    local scaleX = c.w / cw
    local scaleY = c.h / ch
    local scale = math.min(scaleX, scaleY)
    local drawW = cw * scale
    local drawH = ch * scale
    local ox = (c.w - drawW) / 2
    local oy = (c.h - drawH) / 2

    love.graphics.setColor(1, 1, 1, opacity or 1)
    love.graphics.draw(canvas, c.x + ox, c.y + oy, 0, scale, scale)
  end,

  destroy = function(nodeId, state)
    local cached = renderCache[nodeId]
    if cached then
      cached:release()
      renderCache[nodeId] = nil
    end
  end,
})

-- ============================================================================
-- RPC handlers (for hook-based API)
-- ============================================================================

local handlers = {
  ["imaging:list_ops"] = function()
    return Imaging.listOps()
  end,

  ["imaging:blend_modes"] = function()
    return Imaging.blendModes and Imaging.blendModes() or {}
  end,
}

return handlers
