--[[
  imaging/ops/detect.lua -- Foreground/object detection operations

  GPU-accelerated foreground segmentation using border-sample color distance.
  Algorithm:
    1. Sample border pixels (top/bottom/left/right edges) as "definite background"
    2. Compute per-pixel color distance to the mean background color
    3. Threshold to produce a binary foreground mask
    4. Morphological cleanup (erode then dilate via blur + threshold)
    5. Feather the mask edges for smooth compositing

  All heavy lifting runs on the GPU via GLSL shaders.

  Registered operations:
    detect_foreground  -- produces a grayscale mask canvas (white=fg, black=bg)

  RPC handlers (registered via capabilities/imaging.lua):
    imaging:detect_foreground   -- returns maskId in MaskRegistry
    imaging:composite_background -- composites fg over new bg using mask
]]

local Imaging    = require("lua.imaging")
local ShaderCache = require("lua.imaging.shader_cache")
local MaskRegistry = require("lua.imaging.mask_registry")

local floor, max, min = math.floor, math.max, math.min

-- ============================================================================
-- Helper: render a shader to a new canvas
-- ============================================================================

local function applyShader(shaderName, shaderCode, source, w, h, setupFn)
  local shader = ShaderCache.get(shaderName, shaderCode)
  if not shader then return source end

  local output = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(output)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)

  if setupFn then setupFn(shader) end

  love.graphics.setShader(shader)
  love.graphics.draw(source, 0, 0)
  love.graphics.setShader()
  love.graphics.pop()

  return output
end

-- ============================================================================
-- Step 1: Sample border pixels to compute mean background color (CPU)
-- ============================================================================

--- Sample border pixels from an ImageData and return mean RGB + color list.
--- @param imageData love.ImageData
--- @param borderWidth number  How many pixels from each edge to sample
--- @return table  { r, g, b } mean background color (0-1 range)
--- @return table  Array of { r, g, b } sampled colors for variance calc
local function sampleBorderColors(imageData, borderWidth)
  borderWidth = max(1, floor(borderWidth or 8))
  local w = imageData:getWidth()
  local h = imageData:getHeight()
  local sumR, sumG, sumB = 0, 0, 0
  local count = 0
  local samples = {}

  -- Sample from 4 border strips
  local function samplePixel(px, py)
    if px >= 0 and px < w and py >= 0 and py < h then
      local r, g, b = imageData:getPixel(px, py)
      sumR = sumR + r
      sumG = sumG + g
      sumB = sumB + b
      count = count + 1
      -- Keep a subsample for variance (every 4th pixel)
      if count % 4 == 0 then
        samples[#samples + 1] = { r = r, g = g, b = b }
      end
    end
  end

  -- Top and bottom strips
  for y = 0, borderWidth - 1 do
    for x = 0, w - 1, 2 do  -- every other pixel for speed
      samplePixel(x, y)
      samplePixel(x, h - 1 - y)
    end
  end
  -- Left and right strips (avoid corners already sampled)
  for x = 0, borderWidth - 1 do
    for y = borderWidth, h - 1 - borderWidth, 2 do
      samplePixel(x, y)
      samplePixel(w - 1 - x, y)
    end
  end

  if count == 0 then
    return { r = 0, g = 0, b = 0 }, samples
  end

  local safeCount = math.max(1, count)
  local mean = {
    r = sumR / safeCount,
    g = sumG / safeCount,
    b = sumB / safeCount,
  }

  return mean, samples
end

--- Compute color variance from samples relative to mean.
local function computeVariance(mean, samples)
  if #samples == 0 then return 0.05 end
  local sum = 0
  for _, s in ipairs(samples) do
    local dr = s.r - mean.r
    local dg = s.g - mean.g
    local db = s.b - mean.b
    sum = sum + (dr * dr + dg * dg + db * db)
  end
  return sum / #samples
end

-- ============================================================================
-- Step 2: Color distance shader — classify each pixel as fg/bg
-- ============================================================================

local colorDistanceShader = [[
  extern vec3 bgColor;
  extern float threshold;
  extern float softness;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc);
    vec3 diff = pixel.rgb - bgColor;
    float dist = length(diff);

    // Smooth step from bg (0) to fg (1)
    float mask = smoothstep(threshold - softness, threshold + softness, dist);

    // Also incorporate alpha — transparent pixels are background
    mask = mask * pixel.a;

    return vec4(mask, mask, mask, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 3: Multi-sample color distance (uses multiple bg color clusters)
-- ============================================================================

local multiColorDistanceShader = [[
  extern vec3 bgColor1;
  extern vec3 bgColor2;
  extern vec3 bgColor3;
  extern vec3 bgColor4;
  extern float threshold;
  extern float softness;
  extern int numColors;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc);

    // Minimum distance to any background sample
    float minDist = length(pixel.rgb - bgColor1);
    if (numColors >= 2) minDist = min(minDist, length(pixel.rgb - bgColor2));
    if (numColors >= 3) minDist = min(minDist, length(pixel.rgb - bgColor3));
    if (numColors >= 4) minDist = min(minDist, length(pixel.rgb - bgColor4));

    float mask = smoothstep(threshold - softness, threshold + softness, minDist);
    mask = mask * pixel.a;

    return vec4(mask, mask, mask, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 4: Morphological operations (erode/dilate via blur + threshold)
-- ============================================================================

local thresholdMaskShader = [[
  extern float cutoff;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    float v = Texel(tex, tc).r;
    float mask = step(cutoff, v);
    return vec4(mask, mask, mask, 1.0) * color;
  }
]]

local function erode(mask, w, h, radius)
  -- Blur then threshold high = erode (shrinks white regions)
  local blurOp = Imaging.getOps()["gaussian_blur"]
  if not blurOp then return mask end
  local blurred = blurOp.gpu(mask, w, h, { radius = radius })
  local result = applyShader("threshold_mask", thresholdMaskShader, blurred, w, h, function(s)
    s:send("cutoff", 0.75)
  end)
  blurred:release()
  return result
end

local function dilate(mask, w, h, radius)
  -- Blur then threshold low = dilate (grows white regions)
  local blurOp = Imaging.getOps()["gaussian_blur"]
  if not blurOp then return mask end
  local blurred = blurOp.gpu(mask, w, h, { radius = radius })
  local result = applyShader("threshold_mask", thresholdMaskShader, blurred, w, h, function(s)
    s:send("cutoff", 0.25)
  end)
  blurred:release()
  return result
end

-- ============================================================================
-- Step 5: Edge-aware refinement shader
-- Uses the edge map to sharpen mask boundaries along detected edges.
-- ============================================================================

local edgeRefineShader = [[
  extern Image edgeMap;
  extern float edgeStrength;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    float mask = Texel(tex, tc).r;
    float edge = Texel(edgeMap, tc).r;

    // Where edges are strong, push mask toward 0 or 1
    // This sharpens the mask along object boundaries
    float sharpened = mix(mask, step(0.5, mask), edge * edgeStrength);

    return vec4(sharpened, sharpened, sharpened, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 6: Background composite shader
-- ============================================================================

local compositeShader = [[
  extern Image bgImage;
  extern Image mask;

  vec4 effect(vec4 color, Image fgImage, vec2 tc, vec2 sc) {
    vec4 fg = Texel(fgImage, tc);
    vec4 bg = Texel(bgImage, tc);
    float w = Texel(mask, tc).r;

    return mix(bg, fg, w) * color;
  }
]]

-- ============================================================================
-- K-means-lite: cluster border samples into up to 4 representative colors
-- ============================================================================

local function clusterColors(samples, k)
  k = min(k or 4, max(1, #samples))
  if #samples == 0 then
    return { { r = 0, g = 0, b = 0 } }
  end
  if #samples <= k then return samples end

  -- Initialize centers from evenly-spaced samples
  local centers = {}
  for i = 1, k do
    local idx = floor((i - 1) * #samples / k) + 1
    centers[i] = { r = samples[idx].r, g = samples[idx].g, b = samples[idx].b }
  end

  -- 5 iterations of k-means
  for _ = 1, 5 do
    local sums = {}
    local counts = {}
    for i = 1, k do
      sums[i] = { r = 0, g = 0, b = 0 }
      counts[i] = 0
    end

    for _, s in ipairs(samples) do
      local bestDist = math.huge
      local bestIdx = 1
      for i = 1, k do
        local dr = s.r - centers[i].r
        local dg = s.g - centers[i].g
        local db = s.b - centers[i].b
        local d = dr * dr + dg * dg + db * db
        if d < bestDist then
          bestDist = d
          bestIdx = i
        end
      end
      sums[bestIdx].r = sums[bestIdx].r + s.r
      sums[bestIdx].g = sums[bestIdx].g + s.g
      sums[bestIdx].b = sums[bestIdx].b + s.b
      counts[bestIdx] = counts[bestIdx] + 1
    end

    for i = 1, k do
      if counts[i] > 0 then
        centers[i].r = sums[i].r / counts[i]
        centers[i].g = sums[i].g / counts[i]
        centers[i].b = sums[i].b / counts[i]
      end
    end
  end

  return centers
end

-- ============================================================================
-- Main detection pipeline
-- ============================================================================

--- Run foreground detection on a source canvas.
--- @param source love.Canvas  Input image
--- @param params table  { threshold, softness, borderWidth, morphRadius, featherRadius, edgeWeight }
--- @return love.Canvas  Grayscale mask (white = foreground)
local function detectForeground(source, params)
  params = params or {}
  local w = source:getWidth()
  local h = source:getHeight()

  -- 1. Sample border colors (CPU — fast, only reads border strips)
  local imageData = source:newImageData()
  local borderWidth = params.borderWidth or max(8, floor(min(w, h) * 0.05))
  local meanBg, samples = sampleBorderColors(imageData, borderWidth)
  local variance = computeVariance(meanBg, samples)
  imageData:release()

  -- Auto-threshold: higher variance = need higher threshold
  local baseThreshold = params.threshold or (0.18 + math.sqrt(variance) * 0.5)
  local softness = params.softness or (baseThreshold * 0.4)
  baseThreshold = max(0.05, min(0.8, baseThreshold))
  softness = max(0.01, min(0.3, softness))

  -- 2. Cluster border samples for multi-color background matching
  local clusters = clusterColors(samples, 4)
  local numClusters = #clusters

  -- 3. Generate initial mask via color distance
  local rawMask
  if numClusters >= 2 then
    rawMask = applyShader("multi_color_dist", multiColorDistanceShader, source, w, h, function(s)
      s:send("bgColor1", { clusters[1].r, clusters[1].g, clusters[1].b })
      s:send("bgColor2", { clusters[min(2, numClusters)].r, clusters[min(2, numClusters)].g, clusters[min(2, numClusters)].b })
      s:send("bgColor3", { clusters[min(3, numClusters)].r, clusters[min(3, numClusters)].g, clusters[min(3, numClusters)].b })
      s:send("bgColor4", { clusters[min(4, numClusters)].r, clusters[min(4, numClusters)].g, clusters[min(4, numClusters)].b })
      s:send("threshold", baseThreshold)
      s:send("softness", softness)
      s:send("numColors", numClusters)
    end)
  else
    rawMask = applyShader("color_dist", colorDistanceShader, source, w, h, function(s)
      s:send("bgColor", { meanBg.r, meanBg.g, meanBg.b })
      s:send("threshold", baseThreshold)
      s:send("softness", softness)
    end)
  end

  -- 4. Edge detection for boundary refinement
  local edgeWeight = params.edgeWeight or 0.8
  local edgeOp = Imaging.getOps()["edge_detect"]
  if edgeOp and edgeWeight > 0 then
    local edgeMap = edgeOp.gpu(source, w, h, { method = "sobel" })
    local refined = applyShader("edge_refine", edgeRefineShader, rawMask, w, h, function(s)
      s:send("edgeMap", edgeMap)
      s:send("edgeStrength", edgeWeight)
    end)
    edgeMap:release()
    rawMask:release()
    rawMask = refined
  end

  -- 5. Morphological cleanup: erode (remove noise) then dilate (restore shape)
  local morphRadius = params.morphRadius or max(2, floor(min(w, h) * 0.008))
  local eroded = erode(rawMask, w, h, morphRadius)
  rawMask:release()
  local dilated = dilate(eroded, w, h, morphRadius + 1)
  eroded:release()

  -- 6. Feather the mask edges
  local featherRadius = params.featherRadius or max(2, floor(min(w, h) * 0.01))
  if featherRadius > 0 then
    local blurOp = Imaging.getOps()["gaussian_blur"]
    if blurOp then
      local feathered = blurOp.gpu(dilated, w, h, { radius = featherRadius })
      dilated:release()
      return feathered
    end
  end

  return dilated
end

--- Composite foreground over a new background using a mask.
--- @param fg love.Canvas  Foreground image
--- @param bg love.Canvas  Background image (will be scaled to match fg size)
--- @param mask love.Canvas  Grayscale mask (white = use fg)
--- @return love.Canvas  Composited result
local function compositeBackground(fg, bg, mask)
  local w = fg:getWidth()
  local h = fg:getHeight()

  -- Scale background to match foreground dimensions
  local bgScaled = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(bgScaled)
  love.graphics.clear(0, 0, 0, 1)
  love.graphics.setColor(1, 1, 1, 1)
  local bgW, bgH = bg:getWidth(), bg:getHeight()
  local sx = w / bgW
  local sy = h / bgH
  local scale = max(sx, sy)  -- cover (no letterbox)
  local drawW = bgW * scale
  local drawH = bgH * scale
  local ox = (w - drawW) / 2
  local oy = (h - drawH) / 2
  love.graphics.draw(bg, ox, oy, 0, scale, scale)
  love.graphics.pop()

  -- Composite
  local shader = ShaderCache.get("composite_bg", compositeShader)
  if not shader then
    bgScaled:release()
    return fg
  end

  local output = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(output)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)
  shader:send("bgImage", bgScaled)
  shader:send("mask", mask)
  love.graphics.setShader(shader)
  love.graphics.draw(fg, 0, 0)
  love.graphics.setShader()
  love.graphics.pop()

  bgScaled:release()
  return output
end

-- ============================================================================
-- Register as imaging pipeline op
-- ============================================================================

Imaging.registerOp("detect_foreground", {
  gpu = function(canvas, w, h, params)
    return detectForeground(canvas, params)
  end,
})

-- ============================================================================
-- Module exports (used by RPC handlers in capabilities/imaging.lua)
-- ============================================================================

return {
  detectForeground = detectForeground,
  compositeBackground = compositeBackground,
  sampleBorderColors = sampleBorderColors,
  clusterColors = clusterColors,
}
