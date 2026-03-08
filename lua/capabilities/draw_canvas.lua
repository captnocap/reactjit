--[[
  capabilities/draw_canvas.lua -- Interactive paint canvas capability

  Owns a Love2D Canvas that React declares and RPC calls mutate.
  The canvas is stored by a user-provided canvasId so RPCs can address it
  without needing the internal node ID.

  React usage:
    <Native type="DrawCanvas"
      canvasId="my-canvas"
      width={400}
      height={300}
      background="transparent"
    />

  RPC usage (from useDrawCanvas hook):
    canvas:paint   { canvasId, points, color, size, opacity, maskId? }
    canvas:erase   { canvasId, points, size }
    canvas:fill    { canvasId, x, y, color, tolerance? }
    canvas:clear   { canvasId, color? }
    canvas:get_pixel { canvasId, x, y }
    canvas:export  { canvasId, path }
]]

local Capabilities = require("lua.capabilities")
local Imaging      = require("lua.imaging")
local MaskRegistry = require("lua.imaging.mask_registry")
local ShaderCache  = require("lua.imaging.shader_cache")

-- Module-level canvas registry: canvasId -> love.Canvas
-- Exposed via DrawCanvas.getCanvas() so imaging.lua can pull live canvas as a layer.
local canvasRegistry = {}

local DrawCanvas = {}

local maskedStrokeShader = [[
  extern Image mask;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 stroke = Texel(tex, tc) * color;
    float weight = Texel(mask, tc).r;
    return vec4(stroke.rgb, stroke.a * weight);
  }
]]

--- Get a canvas by canvasId (used by imaging:compose for drawCanvasId layers).
function DrawCanvas.getCanvas(canvasId)
  return canvasRegistry[canvasId]
end

-- ============================================================================
-- Internal helpers
-- ============================================================================

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local function newBlankCanvas(w, h, bg)
  -- Some Love builds reject `stencil` during canvas allocation; request it only
  -- when binding the canvas as a render target.
  local canvas = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  if not bg or bg == "transparent" or bg == "" then
    love.graphics.clear(0, 0, 0, 0)
  else
    -- Parse simple hex colors (#rrggbb, #rgb) or named "black"/"white"
    local r, g, b, a = 0, 0, 0, 1
    if type(bg) == "table" then
      r = tonumber(bg[1]) or 0
      g = tonumber(bg[2]) or 0
      b = tonumber(bg[3]) or 0
      a = tonumber(bg[4]) or 1
    end
    love.graphics.clear(r, g, b, a)
  end
  love.graphics.pop()
  return canvas
end

local function resolveColor(color)
  if type(color) == "table" then
    return
      clamp(tonumber(color[1]) or 0, 0, 1),
      clamp(tonumber(color[2]) or 0, 0, 1),
      clamp(tonumber(color[3]) or 0, 0, 1),
      clamp(tonumber(color[4]) or 1, 0, 1)
  end
  return 1, 1, 1, 1
end

local function decodePoints(points)
  if type(points) == "string" then
    local ok, decoded = pcall(require("lua.json").decode, points)
    points = ok and decoded or nil
  end
  if type(points) ~= "table" then
    return nil, "points must be an array"
  end
  return points, nil
end

--- Draw a smooth stroke of circles along a point path.
local function drawStroke(canvas, points, r, g, b, a, size, maskCanvas)
  if not canvas or type(points) ~= "table" or #points == 0 then return end

  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.setBlendMode("alpha")
  love.graphics.setColor(r, g, b, a)

  local radius = math.max(0.5, size * 0.5)
  local prevX, prevY

  for i, pt in ipairs(points) do
    local x = tonumber(pt[1] or pt.x) or 0
    local y = tonumber(pt[2] or pt.y) or 0

    love.graphics.circle("fill", x, y, radius)

    if prevX then
      -- Fill in the gap between consecutive points with a thick line
      love.graphics.setLineWidth(size)
      love.graphics.setLineJoin("round")
      love.graphics.line(prevX, prevY, x, y)
    end

    prevX, prevY = x, y
  end

  love.graphics.pop()
end

local function compositeMaskedStroke(canvas, strokeCanvas, maskCanvas)
  if not canvas or not strokeCanvas or not maskCanvas then
    return false, "canvas, strokeCanvas, and maskCanvas are required"
  end

  local shader, shaderErr = ShaderCache.get("draw_canvas_masked_stroke", maskedStrokeShader)
  if not shader then
    return false, shaderErr or "failed to compile draw_canvas_masked_stroke"
  end

  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.setBlendMode("alpha")
  love.graphics.setColor(1, 1, 1, 1)
  shader:send("mask", maskCanvas)
  love.graphics.setShader(shader)
  love.graphics.draw(strokeCanvas, 0, 0)
  love.graphics.setShader()
  love.graphics.pop()

  return true
end

--- Erase along a point path (sets pixels to transparent).
local function eraseStroke(canvas, points, size)
  if not canvas or type(points) ~= "table" or #points == 0 then return end

  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.setBlendMode("replace")
  love.graphics.setColor(0, 0, 0, 0)

  local radius = math.max(0.5, size * 0.5)
  local prevX, prevY

  for _, pt in ipairs(points) do
    local x = tonumber(pt[1] or pt.x) or 0
    local y = tonumber(pt[2] or pt.y) or 0

    love.graphics.circle("fill", x, y, radius)

    if prevX then
      love.graphics.setLineWidth(size)
      love.graphics.line(prevX, prevY, x, y)
    end

    prevX, prevY = x, y
  end

  love.graphics.pop()
end

--- CPU flood fill via ImageData BFS.
local function floodFill(canvas, startX, startY, fr, fg, fb, fa, tolerance)
  startX = math.floor(startX)
  startY = math.floor(startY)
  tolerance = tolerance or 0.05

  local imageData = canvas:newImageData()
  local w = imageData:getWidth()
  local h = imageData:getHeight()

  if startX < 0 or startY < 0 or startX >= w or startY >= h then
    imageData:release()
    return
  end

  local targetR, targetG, targetB, targetA = imageData:getPixel(startX, startY)

  local function matches(r, g, b, a)
    return math.abs(r - targetR) <= tolerance
       and math.abs(g - targetG) <= tolerance
       and math.abs(b - targetB) <= tolerance
       and math.abs(a - targetA) <= tolerance
  end

  -- If already the fill color, skip
  if matches(fr, fg, fb, fa) then
    imageData:release()
    return
  end

  local visited = {}
  local queue   = {}
  local head    = 1

  local function key(x, y) return y * w + x end

  local k0 = key(startX, startY)
  visited[k0] = true
  queue[1] = { startX, startY }

  while head <= #queue do
    local p = queue[head]; head = head + 1
    local x, y = p[1], p[2]

    imageData:setPixel(x, y, fr, fg, fb, fa)

    local neighbors = { {x-1,y}, {x+1,y}, {x,y-1}, {x,y+1} }
    for _, n in ipairs(neighbors) do
      local nx, ny = n[1], n[2]
      if nx >= 0 and ny >= 0 and nx < w and ny < h then
        local nk = key(nx, ny)
        if not visited[nk] then
          visited[nk] = true
          local r2, g2, b2, a2 = imageData:getPixel(nx, ny)
          if matches(r2, g2, b2, a2) then
            queue[#queue + 1] = { nx, ny }
          end
        end
      end
    end
  end

  -- Upload the modified image data back to the canvas
  local img = love.graphics.newImage(imageData)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.setBlendMode("replace")
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(img, 0, 0)
  love.graphics.pop()
  img:release()
  imageData:release()
end

-- ============================================================================
-- DrawCanvas capability
-- ============================================================================

Capabilities.register("DrawCanvas", {
  visual = true,

  schema = {
    canvasId   = { type = "string", desc = "Stable ID for RPC addressing" },
    width      = { type = "number", desc = "Canvas width in pixels" },
    height     = { type = "number", desc = "Canvas height in pixels" },
    background = { type = "string", desc = "'transparent' or fill color", default = "transparent" },
  },

  events = { "onCreate" },

  create = function(nodeId, props)
    local w  = math.max(1, math.floor(tonumber(props.width)  or 256))
    local h  = math.max(1, math.floor(tonumber(props.height) or 256))
    local bg = props.background or "transparent"
    local canvas = newBlankCanvas(w, h, bg)

    local canvasId = props.canvasId or nodeId
    canvasRegistry[canvasId] = canvas

    return {
      canvasId = canvasId,
      width    = w,
      height   = h,
      bg       = bg,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- Recreate canvas if dimensions changed
    local w = math.max(1, math.floor(tonumber(props.width)  or state.width))
    local h = math.max(1, math.floor(tonumber(props.height) or state.height))
    local newId = props.canvasId or nodeId

    if w ~= state.width or h ~= state.height or newId ~= state.canvasId then
      local old = canvasRegistry[state.canvasId]
      if old then old:release() end
      canvasRegistry[state.canvasId] = nil

      local canvas = newBlankCanvas(w, h, props.background or state.bg or "transparent")
      canvasRegistry[newId] = canvas

      state.canvasId = newId
      state.width    = w
      state.height   = h
    end
  end,

  render = function(node, c, opacity)
    local canvas = canvasRegistry[node.props and node.props.canvasId or node.id]
    if not canvas then return end

    local cw, ch = canvas:getWidth(), canvas:getHeight()
    if cw <= 0 or ch <= 0 or c.w <= 0 or c.h <= 0 then return end

    -- Scale to fit (contain)
    local scaleX = c.w / cw
    local scaleY = c.h / ch
    local scale  = math.min(scaleX, scaleY)
    local drawW  = cw * scale
    local drawH  = ch * scale
    local ox     = (c.w - drawW) * 0.5
    local oy     = (c.h - drawH) * 0.5

    love.graphics.setColor(1, 1, 1, opacity or 1)
    love.graphics.draw(canvas, c.x + ox, c.y + oy, 0, scale, scale)
  end,

  destroy = function(nodeId, state)
    local canvas = canvasRegistry[state.canvasId]
    if canvas then
      canvas:release()
      canvasRegistry[state.canvasId] = nil
    end
  end,
})

-- ============================================================================
-- RPC handlers
-- ============================================================================

local handlers = {

  ["canvas:paint"] = function(args)
    args = args or {}
    local canvas = canvasRegistry[args.canvasId or ""]
    if not canvas then
      return { ok = false, error = "canvasId not found: " .. tostring(args.canvasId) }
    end

    local points, pointsErr = decodePoints(args.points)
    if not points then
      return { ok = false, error = pointsErr }
    end

    local r, g, b, a = resolveColor(args.color)
    local size    = math.max(1, tonumber(args.size)    or 10)
    local opacity = clamp(tonumber(args.opacity) or 1, 0, 1)

    local maskCanvas = nil
    if args.maskId and args.maskId ~= "" then
      maskCanvas = MaskRegistry.get(args.maskId)
      if not maskCanvas then
        return { ok = false, error = "maskId not found: " .. tostring(args.maskId) }
      end
    end

    if maskCanvas then
      local strokeCanvas = newBlankCanvas(canvas:getWidth(), canvas:getHeight(), "transparent")
      drawStroke(strokeCanvas, points, r, g, b, a * opacity, size, nil)

      local ok, err = compositeMaskedStroke(canvas, strokeCanvas, maskCanvas)
      strokeCanvas:release()
      if not ok then
        return { ok = false, error = tostring(err) }
      end
    else
      drawStroke(canvas, points, r, g, b, a * opacity, size, nil)
    end

    return { ok = true }
  end,

  ["canvas:erase"] = function(args)
    args = args or {}
    local canvas = canvasRegistry[args.canvasId or ""]
    if not canvas then
      return { ok = false, error = "canvasId not found: " .. tostring(args.canvasId) }
    end

    local points, pointsErr = decodePoints(args.points)
    if not points then
      return { ok = false, error = pointsErr }
    end

    local size = math.max(1, tonumber(args.size) or 10)
    eraseStroke(canvas, points, size)
    return { ok = true }
  end,

  ["canvas:fill"] = function(args)
    args = args or {}
    local canvas = canvasRegistry[args.canvasId or ""]
    if not canvas then
      return { ok = false, error = "canvasId not found: " .. tostring(args.canvasId) }
    end

    local x = tonumber(args.x) or 0
    local y = tonumber(args.y) or 0
    local r, g, b, a = resolveColor(args.color)
    local tolerance  = tonumber(args.tolerance) or 0.05

    local ok, err = pcall(floodFill, canvas, x, y, r, g, b, a, tolerance)
    if not ok then
      return { ok = false, error = tostring(err) }
    end
    return { ok = true }
  end,

  ["canvas:clear"] = function(args)
    args = args or {}
    local canvas = canvasRegistry[args.canvasId or ""]
    if not canvas then
      return { ok = false, error = "canvasId not found: " .. tostring(args.canvasId) }
    end

    love.graphics.push("all")
    love.graphics.setCanvas(canvas)
    love.graphics.setBlendMode("replace")
    if args.color then
      local r, g, b, a = resolveColor(args.color)
      love.graphics.clear(r, g, b, a)
    else
      love.graphics.clear(0, 0, 0, 0)
    end
    love.graphics.pop()
    return { ok = true }
  end,

  ["canvas:get_pixel"] = function(args)
    args = args or {}
    local canvas = canvasRegistry[args.canvasId or ""]
    if not canvas then
      return { ok = false, error = "canvasId not found" }
    end

    local x = math.floor(tonumber(args.x) or 0)
    local y = math.floor(tonumber(args.y) or 0)

    local w = canvas:getWidth()
    local h = canvas:getHeight()
    if x < 0 or y < 0 or x >= w or y >= h then
      return { ok = false, error = "pixel coordinates out of bounds" }
    end

    local data = canvas:newImageData()
    local r, g, b, a = data:getPixel(x, y)
    data:release()
    return { ok = true, r = r, g = g, b = b, a = a }
  end,

  ["canvas:export"] = function(args)
    args = args or {}
    local canvas = canvasRegistry[args.canvasId or ""]
    if not canvas then
      return { ok = false, error = "canvasId not found" }
    end

    local path = args.path
    if not path or path == "" then
      return { ok = false, error = "path is required" }
    end

    local ok, err = pcall(Imaging.save, canvas, path)
    if not ok then
      return { ok = false, error = tostring(err) }
    end
    return { ok = true, path = path }
  end,
}

-- Merge handlers into the global RPC table (same pattern as imaging.lua)
local Caps = require("lua.capabilities")
local _origGetHandlers = Caps.getHandlers
Caps.getHandlers = function()
  local merged = _origGetHandlers()
  for method, fn in pairs(handlers) do
    merged[method] = fn
  end
  return merged
end

return DrawCanvas
