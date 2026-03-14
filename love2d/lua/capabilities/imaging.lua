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

local Capabilities   = require("lua.capabilities")
local Imaging        = require("lua.imaging")
local json           = require("lua.json")
local MaskRegistry   = require("lua.imaging.mask_registry")

-- Per-instance canvas cache: nodeId -> canvas
local renderCache = {}
local blendLayerCache = {}
local blendLayerClock = 0
local blendLayerCacheMax = 24
local composeCache = {}
local composeCacheClock = 0
local composeCacheMax = 8

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local function releaseCanvas(canvas)
  if canvas and canvas.release then
    canvas:release()
  end
end

local function newTransparentCanvas(w, h)
  local canvas = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.pop()
  return canvas
end

local function evictBlendLayerCache()
  local count = 0
  for _ in pairs(blendLayerCache) do
    count = count + 1
  end
  if count <= blendLayerCacheMax then return end
  local victimPath, victimUsed = nil, nil
  for path, entry in pairs(blendLayerCache) do
    if not victimUsed or entry.lastUsed < victimUsed then
      victimPath = path
      victimUsed = entry.lastUsed
    end
  end
  if victimPath then
    local victim = blendLayerCache[victimPath]
    if victim and victim.image then victim.image:release() end
    blendLayerCache[victimPath] = nil
  end
end

local function getCachedBlendLayer(path)
  if type(path) ~= "string" or path == "" then
    return nil, "layerSrc must be a non-empty string"
  end
  blendLayerClock = blendLayerClock + 1
  local entry = blendLayerCache[path]
  if entry and entry.image then
    entry.lastUsed = blendLayerClock
    return entry.image, nil
  end
  local ok, imgOrErr = pcall(love.graphics.newImage, path)
  if not ok or not imgOrErr then
    return nil, tostring(imgOrErr)
  end
  blendLayerCache[path] = { image = imgOrErr, lastUsed = blendLayerClock }
  evictBlendLayerCache()
  return imgOrErr, nil
end

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

local function loadSourceCanvas(src, fallbackW, fallbackH, fallbackPattern)
  if src and src ~= "" then
    local loadOk, img = pcall(love.graphics.newImage, src)
    if loadOk and img then
      local iw, ih = img:getWidth(), img:getHeight()
      local source = newTransparentCanvas(iw, ih)
      love.graphics.push("all")
      love.graphics.setCanvas(source)
      love.graphics.clear(0, 0, 0, 0)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.draw(img, 0, 0)
      love.graphics.pop()
      img:release()
      return source, nil
    end
    if fallbackPattern then
      return generateTestPattern(fallbackW, fallbackH), "Failed to load: " .. tostring(src)
    end
    return nil, "Failed to load: " .. tostring(src)
  end
  if fallbackPattern then
    return generateTestPattern(fallbackW, fallbackH), nil
  end
  return newTransparentCanvas(fallbackW, fallbackH), nil
end

local function decodeOperations(opsInput)
  if opsInput == nil or opsInput == "" or opsInput == "[]" then
    return {}, nil
  end
  if type(opsInput) == "table" then
    return opsInput, nil
  end
  if type(opsInput) ~= "string" then
    return nil, "operations must be JSON string or array table"
  end
  local ok, decoded = pcall(json.decode, opsInput)
  if not ok or type(decoded) ~= "table" then
    return nil, "invalid operations JSON"
  end
  return decoded, nil
end

--- Process a source canvas through an operation pipeline.
local function processImage(source, opsInput)
  local opsList, decodeErr = decodeOperations(opsInput)
  if not opsList then
    return source, false, decodeErr
  end
  if #opsList == 0 then
    return source, false, nil
  end

  local pipeline = Imaging.fromCanvas(source)
  for _, op in ipairs(opsList) do
    local name = type(op) == "table" and op.op or nil
    if name then
      local params = {}
      for k, v in pairs(op) do
        if k ~= "op" then params[k] = v end
      end

      if name == "blend" and not params.layer and params.layerSrc then
        local layerImg, layerErr = getCachedBlendLayer(params.layerSrc)
        if layerImg then
          params.layer = layerImg
        else
          io.write("[imaging:blend] Failed to load layerSrc '" .. tostring(params.layerSrc) .. "': " .. tostring(layerErr) .. "\n")
          io.flush()
        end
      end

      pipeline:op(name, params)
    end
  end

  local execOk, result = pcall(function() return pipeline:apply() end)
  if execOk and result then
    return result, true, nil
  end
  return source, false, tostring(result)
end

local function drawLayerInto(target, layer, x, y, opacity)
  love.graphics.push("all")
  love.graphics.setCanvas(target)
  love.graphics.setColor(1, 1, 1, opacity or 1)
  love.graphics.draw(layer, x or 0, y or 0)
  love.graphics.pop()
end

local function resolveLayerNumber(layer, key, fallback)
  if type(layer) ~= "table" then return fallback end
  local v = tonumber(layer[key])
  if v ~= nil then return v end
  local transform = layer.transform
  if type(transform) == "table" then
    local tv = tonumber(transform[key])
    if tv ~= nil then return tv end
  end
  return fallback
end

local function resolveLayerRotation(layer)
  local rotation = resolveLayerNumber(layer, "rotation", 0)
  local transform = type(layer) == "table" and layer.transform or nil
  local unit = (type(layer) == "table" and layer.rotationUnit) or (type(transform) == "table" and transform.rotationUnit) or "degrees"
  if unit == "radians" then
    return rotation
  end
  return math.rad(rotation)
end

local function resolveLayerPivot(layer, drawW, drawH)
  local pivotX = resolveLayerNumber(layer, "pivotX", nil)
  local pivotY = resolveLayerNumber(layer, "pivotY", nil)
  local transform = type(layer) == "table" and layer.transform or nil
  local pivot = nil
  if type(layer) == "table" and type(layer.pivot) == "table" then
    pivot = layer.pivot
  elseif type(transform) == "table" and type(transform.pivot) == "table" then
    pivot = transform.pivot
  end

  if pivot and (pivotX == nil or pivotY == nil) then
    local px = tonumber(pivot.x)
    local py = tonumber(pivot.y)
    local unit = pivot.unit
    local isRelative = pivot.relative == true or unit == "relative" or unit == "normalized"
    if pivotX == nil and px ~= nil then
      pivotX = isRelative and (px * drawW) or px
    end
    if pivotY == nil and py ~= nil then
      pivotY = isRelative and (py * drawH) or py
    end
  end

  if pivotX == nil then pivotX = drawW * 0.5 end
  if pivotY == nil then pivotY = drawH * 0.5 end
  return pivotX, pivotY
end

local function resolveLayerCrop(layer, sourceW, sourceH)
  if type(layer) ~= "table" then return nil end
  local transform = layer.transform
  local crop = layer.crop
  if type(crop) ~= "table" and type(transform) == "table" and type(transform.crop) == "table" then
    crop = transform.crop
  end
  if type(crop) ~= "table" then return nil end

  local x = math.floor(tonumber(crop.x) or 0)
  local y = math.floor(tonumber(crop.y) or 0)
  local w = math.floor(tonumber(crop.width or crop.w) or (sourceW - x))
  local h = math.floor(tonumber(crop.height or crop.h) or (sourceH - y))

  x = clamp(x, 0, math.max(0, sourceW - 1))
  y = clamp(y, 0, math.max(0, sourceH - 1))
  w = clamp(w, 0, sourceW - x)
  h = clamp(h, 0, sourceH - y)

  if w <= 0 or h <= 0 then return nil end
  return { x = x, y = y, width = w, height = h }
end

local function extractCroppedLayer(layerCanvas, layer)
  local sourceW = layerCanvas:getWidth()
  local sourceH = layerCanvas:getHeight()
  local crop = resolveLayerCrop(layer, sourceW, sourceH)
  if not crop then
    return layerCanvas, false
  end

  local output = newTransparentCanvas(crop.width, crop.height)
  local quad = love.graphics.newQuad(crop.x, crop.y, crop.width, crop.height, sourceW, sourceH)
  love.graphics.push("all")
  love.graphics.setCanvas(output)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(layerCanvas, quad, 0, 0)
  love.graphics.pop()
  return output, true
end

local function drawLayerTransformedInto(target, layerCanvas, layer, opacity)
  opacity = clamp(tonumber(opacity) or 1, 0, 1)
  local x = resolveLayerNumber(layer, "x", 0)
  local y = resolveLayerNumber(layer, "y", 0)
  local uniformScale = resolveLayerNumber(layer, "scale", 1)
  local scaleX = resolveLayerNumber(layer, "scaleX", uniformScale)
  local scaleY = resolveLayerNumber(layer, "scaleY", uniformScale)
  local rotation = resolveLayerRotation(layer)
  local pivotX, pivotY = resolveLayerPivot(layer, layerCanvas:getWidth(), layerCanvas:getHeight())

  love.graphics.push("all")
  love.graphics.setCanvas(target)
  love.graphics.setColor(1, 1, 1, opacity)
  love.graphics.draw(layerCanvas, x, y, rotation, scaleX, scaleY, pivotX, pivotY)
  love.graphics.pop()
end

local function compositeLayer(base, layerCanvas, layer)
  layer = layer or {}
  local blendMode = layer.blendMode or "normal"
  local opacity = clamp(tonumber(layer.opacity) or 1, 0, 1)
  local drawCanvas, ownsDrawCanvas = extractCroppedLayer(layerCanvas, layer)

  if blendMode == "normal" then
    local output = newTransparentCanvas(base:getWidth(), base:getHeight())
    drawLayerInto(output, base, 0, 0, 1)
    drawLayerTransformedInto(output, drawCanvas, layer, opacity)
    if ownsDrawCanvas then releaseCanvas(drawCanvas) end
    return output
  end

  local overlay = newTransparentCanvas(base:getWidth(), base:getHeight())
  drawLayerTransformedInto(overlay, drawCanvas, layer, 1)
  local blended = Imaging.apply("blend", base, {
    mode = blendMode,
    layer = overlay,
    opacity = opacity,
  })
  releaseCanvas(overlay)
  if ownsDrawCanvas then releaseCanvas(drawCanvas) end
  return blended
end

-- ============================================================================
-- DrawCanvas registry access (optional -- only wired if draw_canvas loaded)
-- ============================================================================

local function getDrawCanvas(drawCanvasId)
  local ok, dcMod = pcall(require, "lua.capabilities.draw_canvas")
  if ok and dcMod and dcMod.getCanvas then
    return dcMod.getCanvas(drawCanvasId)
  end
  return nil
end

local function renderLayerTree(layer, fallbackW, fallbackH)
  if type(layer) ~= "table" then return nil, "layer must be a table" end
  if layer.visible == false then return nil, nil end

  -- If this layer references a live DrawCanvas, use that canvas as source
  local source, loadErr
  if layer.drawCanvasId and layer.drawCanvasId ~= "" then
    local dc = getDrawCanvas(layer.drawCanvasId)
    if dc then
      source = newTransparentCanvas(dc:getWidth(), dc:getHeight())
      love.graphics.push("all")
      love.graphics.setCanvas(source)
      love.graphics.clear(0, 0, 0, 0)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.draw(dc, 0, 0)
      love.graphics.pop()
    else
      return nil, "drawCanvasId '" .. tostring(layer.drawCanvasId) .. "' not found"
    end
  else
    source, loadErr = loadSourceCanvas(layer.src, fallbackW, fallbackH, false)
  end
  if not source then
    return nil, loadErr
  end

  local current = source
  local layerOps = layer.operations or {}
  local processed, didProcess, processErr = processImage(current, layerOps)
  current = processed
  if processErr then
    -- Keep rendering with best-effort output.
    io.write("[imaging:compose] layer op failed: " .. tostring(processErr) .. "\n")
    io.flush()
  end

  if type(layer.children) == "table" and #layer.children > 0 then
    for _, child in ipairs(layer.children) do
      local childCanvas = nil
      local childErr = nil
      local ok, err = pcall(function()
        childCanvas, childErr = renderLayerTree(child, current:getWidth(), current:getHeight())
      end)
      if ok and childCanvas then
        local merged = compositeLayer(current, childCanvas, child)
        if merged then
          if current ~= source or didProcess then
            releaseCanvas(current)
          end
          current = merged
        end
        releaseCanvas(childCanvas)
      elseif childErr then
        io.write("[imaging:compose] child layer failed: " .. tostring(childErr) .. "\n")
        io.flush()
      elseif not ok then
        io.write("[imaging:compose] child layer crashed: " .. tostring(err) .. "\n")
        io.flush()
      end
    end
  end

  if current ~= source then
    releaseCanvas(source)
  end
  return current, nil
end

local function evictComposeCache()
  local count = 0
  for _ in pairs(composeCache) do count = count + 1 end
  if count <= composeCacheMax then return end
  local victimKey, victimUsed = nil, nil
  for key, entry in pairs(composeCache) do
    if not victimUsed or entry.lastUsed < victimUsed then
      victimKey = key
      victimUsed = entry.lastUsed
    end
  end
  if victimKey then
    local victim = composeCache[victimKey]
    if victim and victim.canvas then releaseCanvas(victim.canvas) end
    composeCache[victimKey] = nil
  end
end

local function rememberComposition(cacheKey, canvas)
  if type(cacheKey) ~= "string" or cacheKey == "" then return end
  composeCacheClock = composeCacheClock + 1
  local existing = composeCache[cacheKey]
  if existing and existing.canvas then
    releaseCanvas(existing.canvas)
  end
  composeCache[cacheKey] = {
    canvas = canvas,
    lastUsed = composeCacheClock,
  }
  evictComposeCache()
end

local function getCachedComposition(cacheKey)
  if type(cacheKey) ~= "string" or cacheKey == "" then return nil end
  local entry = composeCache[cacheKey]
  if not entry or not entry.canvas then return nil end
  composeCacheClock = composeCacheClock + 1
  entry.lastUsed = composeCacheClock
  return entry.canvas
end

local function decodeComposition(input)
  if type(input) == "table" then return input, nil end
  if type(input) ~= "string" then
    return nil, "composition must be a table or JSON string"
  end
  local ok, decoded = pcall(json.decode, input)
  if not ok or type(decoded) ~= "table" then
    return nil, "invalid composition JSON"
  end
  return decoded, nil
end

local function composeFromGraph(composition)
  if type(composition) ~= "table" then
    return nil, "composition must be a table"
  end
  local width = math.max(1, math.floor(tonumber(composition.width) or 1))
  local height = math.max(1, math.floor(tonumber(composition.height) or 1))
  local layers = composition.layers
  if type(layers) ~= "table" then
    return nil, "composition.layers must be an array"
  end

  local base = newTransparentCanvas(width, height)
  for _, layer in ipairs(layers) do
    local layerCanvas, layerErr = renderLayerTree(layer, width, height)
    if layerCanvas then
      local merged = compositeLayer(base, layerCanvas, layer)
      releaseCanvas(base)
      base = merged
      releaseCanvas(layerCanvas)
    elseif layerErr then
      io.write("[imaging:compose] layer skipped: " .. tostring(layerErr) .. "\n")
      io.flush()
    end
  end
  return base, nil
end

-- ============================================================================
-- Mask compositing (post-pipeline selection blend)
-- ============================================================================

--- Blend processed result with original using a grayscale mask canvas.
--- output = mix(original, processed, mask.r)
local maskCompositeShader = [[
  extern Image original;
  extern Image mask;
  vec4 effect(vec4 color, Image processed, vec2 tc, vec2 sc) {
    vec4 orig = Texel(original, tc);
    vec4 proc = Texel(processed, tc);
    float w   = Texel(mask, tc).r;
    return mix(orig, proc, w) * color;
  }
]]

local function compositeMasked(source, processed, maskCanvas, w, h)
  local ShaderCache = require("lua.imaging.shader_cache")
  local shader = ShaderCache.get("apply_mask_rpc", maskCompositeShader)
  if not shader then return processed end

  local output = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(output)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)
  shader:send("original", source)
  shader:send("mask",     maskCanvas)
  love.graphics.setShader(shader)
  love.graphics.draw(processed, 0, 0)
  love.graphics.setShader()
  love.graphics.pop()
  return output
end

local mergeMasksShader = [[
  extern Image baseMask;

  vec4 effect(vec4 color, Image addedMask, vec2 tc, vec2 sc) {
    float base = Texel(baseMask, tc).r;
    float added = Texel(addedMask, tc).r;
    float merged = max(base, added);
    return vec4(merged, merged, merged, 1.0) * color;
  }
]]

local function mergeMaskCanvases(baseMask, addedMask, w, h)
  local ShaderCache = require("lua.imaging.shader_cache")
  local shader = ShaderCache.get("merge_mask_rpc", mergeMasksShader)
  if not shader then return addedMask end

  local output = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(output)
  love.graphics.clear(0, 0, 0, 1)
  love.graphics.setColor(1, 1, 1, 1)
  shader:send("baseMask", baseMask)
  love.graphics.setShader(shader)
  love.graphics.draw(addedMask, 0, 0)
  love.graphics.setShader()
  love.graphics.pop()
  return output
end

--- Rasterize an array of selection shapes to a grayscale Love2D Canvas.
--- Each shape is drawn white (selected) on a black background.
--- mode: "replace" draws all shapes fresh; future modes (add/subtract/intersect)
---       will accept a baseMaskId to modify an existing mask.
local function rasterizeSelectionShapes(shapes, width, height, mode, baseMaskId, featherRadius)
  width  = math.max(1, math.floor(tonumber(width)  or 1))
  height = math.max(1, math.floor(tonumber(height) or 1))
  featherRadius = math.max(0, tonumber(featherRadius) or 0)

  local canvas = love.graphics.newCanvas(width, height)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)

  if mode == "add" and baseMaskId then
    local base = MaskRegistry.get(baseMaskId)
    if base then
      love.graphics.clear(0, 0, 0, 1)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.setBlendMode("alpha")
      love.graphics.draw(base, 0, 0)
    else
      love.graphics.clear(0, 0, 0, 1)
    end
  elseif mode == "subtract" and baseMaskId then
    local base = MaskRegistry.get(baseMaskId)
    if base then
      love.graphics.clear(0, 0, 0, 1)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.setBlendMode("alpha")
      love.graphics.draw(base, 0, 0)
    else
      love.graphics.clear(0, 0, 0, 1)
    end
  else
    -- replace: start with solid black
    love.graphics.clear(0, 0, 0, 1)
  end

  if mode == "subtract" then
    love.graphics.setColor(0, 0, 0, 1)
    love.graphics.setBlendMode("replace")
  else
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setBlendMode("alpha")
  end

  for _, shape in ipairs(shapes) do
    if type(shape) == "table" then
      local stype = shape.type or shape.kind or "rect"
      if stype == "rect" then
        local x = tonumber(shape.x) or 0
        local y = tonumber(shape.y) or 0
        local w = tonumber(shape.width  or shape.w) or width
        local h = tonumber(shape.height or shape.h) or height
        love.graphics.rectangle("fill", x, y, w, h)
      elseif stype == "ellipse" then
        local cx = tonumber(shape.x) or (width  * 0.5)
        local cy = tonumber(shape.y) or (height * 0.5)
        local rx = tonumber(shape.width  or shape.rx or shape.r) or (width  * 0.25)
        local ry = tonumber(shape.height or shape.ry or shape.r) or (height * 0.25)
        love.graphics.ellipse("fill", cx, cy, rx, ry)
      elseif stype == "polygon" and type(shape.points) == "table" and #shape.points >= 3 then
        local flat = {}
        for _, pt in ipairs(shape.points) do
          flat[#flat + 1] = tonumber(pt[1] or pt.x) or 0
          flat[#flat + 1] = tonumber(pt[2] or pt.y) or 0
        end
        if #flat >= 6 then
          pcall(love.graphics.polygon, "fill", flat)
        end
      end
    end
  end

  love.graphics.pop()
  if featherRadius <= 0 then
    return canvas
  end

  local pipeline = Imaging.fromCanvas(canvas)
  pipeline:op("gaussian_blur", { radius = featherRadius })
  local ok, blurred = pcall(function()
    return pipeline:apply()
  end)
  if not ok or not blurred then
    return canvas
  end
  if blurred ~= canvas then
    releaseCanvas(canvas)
  end
  return blurred
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
    -- Defensive guard: if prop diffing misses an UPDATE, detect value changes here.
    if props.src ~= state.lastSrc or props.operations ~= state.lastOps then
      state.dirty = true
    end

    if not state.dirty then return end
    state.dirty = false
    state.lastSrc = props.src
    state.lastOps = props.operations

    local source, sourceErr = loadSourceCanvas(props.src, 260, 180, true)
    if sourceErr and pushEvent then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = sourceErr },
      })
    end

    -- Process
    local result, didProcess, processErr = processImage(source, props.operations)
    if processErr and pushEvent then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = processErr },
      })
    end

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
  ["imaging:apply"] = function(args)
    args = args or {}
    local source, sourceErr = loadSourceCanvas(
      args.src,
      tonumber(args.width) or 260,
      tonumber(args.height) or 180,
      true
    )

    local result, didProcess, processErr = processImage(source, args.operations)
    local finalErr = processErr or sourceErr

    -- Optional selection mask: composite result with original using mask
    if args.maskId and args.maskId ~= "" then
      local maskCanvas = MaskRegistry.get(args.maskId)
      if maskCanvas then
        local w = result:getWidth()
        local h = result:getHeight()
        local masked = compositeMasked(source, result, maskCanvas, w, h)
        if masked ~= result then
          if result ~= source then releaseCanvas(result) end
          result = masked
          didProcess = true
        end
      else
        finalErr = finalErr or ("maskId '" .. args.maskId .. "' not found in registry")
      end
    end

    local outputPath = nil
    if args.output and args.output ~= "" then
      local ok, saveErr = pcall(Imaging.save, result, args.output)
      if ok then
        outputPath = args.output
      else
        finalErr = finalErr or tostring(saveErr)
      end
    end

    local width, height = result:getWidth(), result:getHeight()
    if result ~= source then
      releaseCanvas(source)
    end
    releaseCanvas(result)

    return {
      ok = finalErr == nil,
      width = width,
      height = height,
      didProcess = didProcess,
      outputPath = outputPath,
      error = finalErr,
    }
  end,

  ["imaging:compose"] = function(args)
    args = args or {}
    local composition, decodeErr = decodeComposition(args.composition)
    if not composition then
      return {
        ok = false,
        width = 0,
        height = 0,
        error = decodeErr,
      }
    end

    local cacheKey = args.cacheKey
    if not cacheKey and type(args.composition) == "string" then
      cacheKey = args.composition
    end

    local cacheHit = false
    local result = getCachedComposition(cacheKey)
    if result then
      cacheHit = true
    else
      local composeErr = nil
      result, composeErr = composeFromGraph(composition)
      if not result then
        return {
          ok = false,
          width = 0,
          height = 0,
          error = composeErr,
        }
      end
      if cacheKey then
        local clone = newTransparentCanvas(result:getWidth(), result:getHeight())
        drawLayerInto(clone, result, 0, 0, 1)
        rememberComposition(cacheKey, clone)
      end
    end

    local outputPath = nil
    local outputErr = nil
    if args.output and args.output ~= "" then
      local ok, saveErr = pcall(Imaging.save, result, args.output)
      if ok then
        outputPath = args.output
      else
        outputErr = tostring(saveErr)
      end
    end

    local width, height = result:getWidth(), result:getHeight()
    if not cacheHit then
      releaseCanvas(result)
    end

    return {
      ok = outputErr == nil,
      width = width,
      height = height,
      outputPath = outputPath,
      cacheHit = cacheHit,
      dirtyRegions = {
        { x = 0, y = 0, width = width, height = height },
      },
      error = outputErr,
    }
  end,

  ["imaging:list_ops"] = function()
    return Imaging.listOps()
  end,

  ["imaging:blend_modes"] = function()
    return Imaging.blendModes and Imaging.blendModes() or {}
  end,

  ["imaging:clear_cache"] = function()
    for _, entry in pairs(blendLayerCache) do
      if entry and entry.image then entry.image:release() end
    end
    blendLayerCache = {}
    for _, entry in pairs(composeCache) do
      if entry and entry.canvas then releaseCanvas(entry.canvas) end
    end
    composeCache = {}
    return true
  end,

  -- -------------------------------------------------------------------------
  -- Selection mask RPCs
  -- -------------------------------------------------------------------------

  --- Rasterize selection shapes to a grayscale mask canvas held in memory.
  --- Returns a maskId handle for use with imaging:apply's maskId param.
  ["imaging:selection_rasterize"] = function(args)
    args = args or {}
    local shapes = args.shapes
    if type(shapes) == "string" then
      local ok, decoded = pcall(require("lua.json").decode, shapes)
      shapes = ok and decoded or nil
    end
    if type(shapes) ~= "table" or #shapes == 0 then
      return { ok = false, error = "shapes must be a non-empty array" }
    end

    local width  = tonumber(args.width)  or 260
    local height = tonumber(args.height) or 180
    local mode   = args.mode or "replace"
    local featherRadius = tonumber(args.featherRadius) or 0
    local baseMaskId = args.baseMaskId

    local ok, result = pcall(rasterizeSelectionShapes, shapes, width, height, mode, baseMaskId, featherRadius)
    if not ok or not result then
      return { ok = false, error = tostring(result) }
    end

    -- Release replaced mask when mode is replace + baseMaskId is same slot
    -- (caller controls lifecycle -- just store the new one)
    local maskId = MaskRegistry.store(result)
    return { ok = true, maskId = maskId }
  end,

  --- Release a mask canvas from the in-memory registry.
  ["imaging:mask_release"] = function(args)
    args = args or {}
    if args.maskId then
      MaskRegistry.release(args.maskId)
    end
    return { ok = true }
  end,

  --- Return diagnostic info about the mask registry.
  ["imaging:mask_info"] = function()
    return { count = MaskRegistry.count() }
  end,

  -- -------------------------------------------------------------------------
  -- Object detection RPCs
  -- -------------------------------------------------------------------------

  --- Detect foreground in an image and return a mask handle.
  --- The mask is stored in MaskRegistry for use with imaging:composite_background
  --- or imaging:apply (via maskId).
  ---
  --- @param args.src string  Source image path
  --- @param args.threshold number  (optional) Color distance threshold (0-1, auto if omitted)
  --- @param args.softness number  (optional) Transition softness
  --- @param args.borderWidth number  (optional) Border sampling width in pixels
  --- @param args.morphRadius number  (optional) Morphological cleanup radius
  --- @param args.featherRadius number  (optional) Edge feather radius
  --- @param args.edgeWeight number  (optional) Edge refinement strength (0-1)
  --- @return { ok, maskId, width, height, error }
  ["imaging:detect_foreground"] = function(args)
    args = args or {}
    local Detect = require("lua.imaging.ops.detect")

    -- Load source image
    local src = args.src
    if not src or src == "" then
      return { ok = false, error = "src is required" }
    end

    local loadOk, img = pcall(love.graphics.newImage, src)
    if not loadOk or not img then
      return { ok = false, error = "Failed to load: " .. tostring(src) }
    end

    local iw, ih = img:getWidth(), img:getHeight()
    local source = love.graphics.newCanvas(iw, ih)
    love.graphics.push("all")
    love.graphics.setCanvas(source)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(img, 0, 0)
    love.graphics.pop()
    img:release()

    local detectOk, mask = pcall(Detect.detectForeground, source, {
      threshold = args.threshold and tonumber(args.threshold) or nil,
      softness = args.softness and tonumber(args.softness) or nil,
      borderWidth = args.borderWidth and tonumber(args.borderWidth) or nil,
      morphRadius = args.morphRadius and tonumber(args.morphRadius) or nil,
      featherRadius = args.featherRadius and tonumber(args.featherRadius) or nil,
      edgeWeight = args.edgeWeight and tonumber(args.edgeWeight) or nil,
      spatialWeight = args.spatialWeight and tonumber(args.spatialWeight) or nil,
      sharpWeight = args.sharpWeight and tonumber(args.sharpWeight) or nil,
      refine = args.refine,
    })

    source:release()

    if not detectOk or not mask then
      return { ok = false, error = "Detection failed: " .. tostring(mask) }
    end

    local maskId = MaskRegistry.store(mask)
    return {
      ok = true,
      maskId = maskId,
      width = iw,
      height = ih,
    }
  end,

  --- Composite a foreground image over a new background using a detection mask.
  ---
  --- @param args.src string  Foreground image path
  --- @param args.background string  Background image path
  --- @param args.maskId string  Mask handle from imaging:detect_foreground
  --- @param args.output string  (optional) Output file path
  --- @return { ok, width, height, outputPath, error }
  ["imaging:composite_background"] = function(args)
    args = args or {}
    local Detect = require("lua.imaging.ops.detect")

    if not args.src or args.src == "" then
      return { ok = false, error = "src is required" }
    end
    if not args.background or args.background == "" then
      return { ok = false, error = "background is required" }
    end
    if not args.maskId or args.maskId == "" then
      return { ok = false, error = "maskId is required" }
    end

    local maskCanvas = MaskRegistry.get(args.maskId)
    if not maskCanvas then
      return { ok = false, error = "maskId '" .. args.maskId .. "' not found" }
    end

    -- Load foreground
    local fgOk, fgImg = pcall(love.graphics.newImage, args.src)
    if not fgOk or not fgImg then
      return { ok = false, error = "Failed to load fg: " .. tostring(args.src) }
    end
    local fw, fh = fgImg:getWidth(), fgImg:getHeight()
    local fgCanvas = love.graphics.newCanvas(fw, fh)
    love.graphics.push("all")
    love.graphics.setCanvas(fgCanvas)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(fgImg, 0, 0)
    love.graphics.pop()
    fgImg:release()

    -- Load background
    local bgOk, bgImg = pcall(love.graphics.newImage, args.background)
    if not bgOk or not bgImg then
      fgCanvas:release()
      return { ok = false, error = "Failed to load bg: " .. tostring(args.background) }
    end
    local bw, bh = bgImg:getWidth(), bgImg:getHeight()
    local bgCanvas = love.graphics.newCanvas(bw, bh)
    love.graphics.push("all")
    love.graphics.setCanvas(bgCanvas)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(bgImg, 0, 0)
    love.graphics.pop()
    bgImg:release()

    -- Composite
    local compOk, result = pcall(Detect.compositeBackground, fgCanvas, bgCanvas, maskCanvas)
    fgCanvas:release()
    bgCanvas:release()

    if not compOk or not result then
      return { ok = false, error = "Composite failed: " .. tostring(result) }
    end

    -- Save if output specified
    local outputPath = nil
    if args.output and args.output ~= "" then
      local saveOk, saveErr = pcall(Imaging.save, result, args.output)
      if saveOk then
        outputPath = args.output
      else
        result:release()
        return { ok = false, error = "Save failed: " .. tostring(saveErr) }
      end
    end

    local rw, rh = result:getWidth(), result:getHeight()
    result:release()

    return {
      ok = true,
      width = rw,
      height = rh,
      outputPath = outputPath,
    }
  end,

  -- -------------------------------------------------------------------------
  -- Seed-point flood detection RPCs
  -- -------------------------------------------------------------------------

  --- Detect a region by flood-filling from a seed point, then refining the
  --- boundary through multi-channel edge consensus (Sobel + Laplacian +
  --- luminance gradient + chroma gradient, averaged).
  ---
  --- @param args.src string  Source image path
  --- @param args.seedX number  Seed point X coordinate (pixels)
  --- @param args.seedY number  Seed point Y coordinate (pixels)
  --- @param args.tolerance number  (optional) Color distance threshold (0-1, default 0.2)
  --- @param args.adaptive boolean  (optional) Compare against running mean (default true)
  --- @param args.baseMaskId string  (optional) Existing mask handle to merge into
  --- @param args.edgeStrength number  (optional) Edge refinement strength (0-1)
  --- @param args.edgeThreshold number  (optional) Edge detection sensitivity
  --- @param args.morphRadius number  (optional) Morphological cleanup radius
  --- @param args.featherRadius number  (optional) Edge feather radius
  --- @param args.output string  (optional) Save mask to file
  --- @return { ok, maskId, width, height, meanColor, error }
  ["imaging:flood_detect"] = function(args)
    args = args or {}
    local FloodDetect = require("lua.imaging.ops.flood_detect")

    local src = args.src
    if not src or src == "" then
      return { ok = false, error = "src is required" }
    end

    local seedX = tonumber(args.seedX)
    local seedY = tonumber(args.seedY)
    if not seedX or not seedY then
      return { ok = false, error = "seedX and seedY are required" }
    end

    -- Load source image
    local loadOk, img = pcall(love.graphics.newImage, src)
    if not loadOk or not img then
      return { ok = false, error = "Failed to load: " .. tostring(src) }
    end

    local iw, ih = img:getWidth(), img:getHeight()
    local source = love.graphics.newCanvas(iw, ih)
    love.graphics.push("all")
    love.graphics.setCanvas(source)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(img, 0, 0)
    love.graphics.pop()
    img:release()

    local detectOk, mask, meanColor = pcall(function()
      return FloodDetect.floodDetect(source, seedX, seedY, {
        tolerance = args.tolerance and tonumber(args.tolerance) or nil,
        adaptive = args.adaptive,
        edgeStrength = args.edgeStrength and tonumber(args.edgeStrength) or nil,
        edgeThreshold = args.edgeThreshold and tonumber(args.edgeThreshold) or nil,
        morphRadius = args.morphRadius and tonumber(args.morphRadius) or nil,
        featherRadius = args.featherRadius and tonumber(args.featherRadius) or nil,
      })
    end)

    source:release()

    if not detectOk or not mask then
      return { ok = false, error = "Flood detection failed: " .. tostring(mask) }
    end

    if args.baseMaskId and args.baseMaskId ~= "" then
      local baseMask = MaskRegistry.get(args.baseMaskId)
      if not baseMask then
        if mask and mask.release then mask:release() end
        return { ok = false, error = "baseMaskId not found: " .. tostring(args.baseMaskId) }
      end

      local merged = mergeMaskCanvases(baseMask, mask, iw, ih)
      if merged ~= mask and mask.release then
        mask:release()
      end
      mask = merged
    end

    -- Save mask if output specified
    if args.output and args.output ~= "" then
      pcall(Imaging.save, mask, args.output)
    end

    local maskId = MaskRegistry.store(mask)
    return {
      ok = true,
      maskId = maskId,
      width = iw,
      height = ih,
      meanColor = meanColor,
    }
  end,
}

local Caps = require("lua.capabilities")
local _origGetHandlers = Caps.getHandlers
Caps.getHandlers = function()
  local merged = _origGetHandlers()
  for method, fn in pairs(handlers) do
    merged[method] = fn
  end
  return merged
end

return handlers
