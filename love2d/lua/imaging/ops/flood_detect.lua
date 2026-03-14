--[[
  imaging/ops/flood_detect.lua -- Seed-point flood detection with multi-channel edge consensus

  Algorithm:
    1. User provides a seed point (x, y) on the subject they want to select
    2. CPU flood fill expands outward from seed by color similarity
       - Each pixel within a tolerance radius of the seed color joins the region
       - Expansion continues until the color distance exceeds the threshold
    3. The raw flood mask is refined through 4 independent edge detection channels:
       a. Sobel (gradient magnitude)
       b. Laplacian (second derivative)
       c. Luminance gradient (brightness discontinuities)
       d. Color gradient (chroma channel edges)
    4. All 4 edge channels are averaged to produce a consensus edge map
    5. The consensus edge sharpens the flood mask boundary
    6. Morphological cleanup + feathering produces the final mask

  All edge detection runs on the GPU. The flood fill runs on the CPU (ImageData)
  because it's inherently sequential (expanding wavefront).
]]

local Imaging     = require("lua.imaging")
local ShaderCache = require("lua.imaging.shader_cache")
local MaskRegistry = require("lua.imaging.mask_registry")

local floor, max, min, sqrt, abs = math.floor, math.max, math.min, math.sqrt, math.abs

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
-- Step 1: CPU flood fill from seed point
-- ============================================================================

--- Flood fill from a seed point, expanding by color similarity.
--- Returns a 2D boolean grid (true = in region) and the region's mean color.
---
--- Uses a BFS wavefront. A pixel joins the region if its color distance
--- to the seed color is within `tolerance`. As the region grows, we also
--- track the running mean color so adaptive expansion can work.
---
--- @param imageData love.ImageData
--- @param seedX number  Seed X coordinate (pixels)
--- @param seedY number  Seed Y coordinate (pixels)
--- @param tolerance number  Color distance threshold (0-1 range, Euclidean in RGB)
--- @param adaptive boolean  If true, compare against running region mean instead of seed
--- @return love.ImageData  Grayscale mask (white = in region)
--- @return table  { r, g, b } mean color of the selected region
local function floodFillFromSeed(imageData, seedX, seedY, tolerance, adaptive)
  local w = imageData:getWidth()
  local h = imageData:getHeight()
  tolerance = max(0.01, min(1.0, tolerance or 0.2))

  -- Clamp seed to valid range
  seedX = max(0, min(w - 1, floor(seedX)))
  seedY = max(0, min(h - 1, floor(seedY)))

  -- Get seed color
  local sr, sg, sb = imageData:getPixel(seedX, seedY)

  -- Visited grid (flat array for speed)
  local visited = {}
  local inRegion = {}
  local function idx(x, y) return y * w + x end

  -- BFS queue
  local queue = {}
  local qHead = 1
  local qTail = 1

  -- Seed the queue
  queue[qTail] = { seedX, seedY }
  qTail = qTail + 1
  visited[idx(seedX, seedY)] = true
  inRegion[idx(seedX, seedY)] = true

  -- Running mean for adaptive mode
  local sumR, sumG, sumB = sr, sg, sb
  local regionCount = 1

  -- 4-connected neighbors
  local dx = { 1, -1, 0, 0 }
  local dy = { 0, 0, 1, -1 }

  -- Expand
  while qHead < qTail do
    local current = queue[qHead]
    qHead = qHead + 1
    local cx, cy = current[1], current[2]

    for d = 1, 4 do
      local nx = cx + dx[d]
      local ny = cy + dy[d]

      if nx >= 0 and nx < w and ny >= 0 and ny < h then
        local ni = idx(nx, ny)
        if not visited[ni] then
          visited[ni] = true

          local pr, pg, pb = imageData:getPixel(nx, ny)

          -- Compare against seed or running mean
          local refR, refG, refB
          if adaptive and regionCount > 0 then
            local safeCount = max(1, regionCount)
            refR = sumR / safeCount
            refG = sumG / safeCount
            refB = sumB / safeCount
          else
            refR, refG, refB = sr, sg, sb
          end

          local dr = pr - refR
          local dg = pg - refG
          local db = pb - refB
          local dist = sqrt(dr * dr + dg * dg + db * db)

          if dist <= tolerance then
            inRegion[ni] = true
            queue[qTail] = { nx, ny }
            qTail = qTail + 1
            sumR = sumR + pr
            sumG = sumG + pg
            sumB = sumB + pb
            regionCount = regionCount + 1
          end
        end
      end
    end
  end

  -- Convert boolean grid to ImageData mask
  local maskData = love.image.newImageData(w, h)
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      if inRegion[idx(x, y)] then
        maskData:setPixel(x, y, 1, 1, 1, 1)
      else
        maskData:setPixel(x, y, 0, 0, 0, 1)
      end
    end
  end

  local safeCount = max(1, regionCount)
  local meanColor = {
    r = sumR / safeCount,
    g = sumG / safeCount,
    b = sumB / safeCount,
  }

  return maskData, meanColor
end

-- ============================================================================
-- Step 2: Multi-channel edge detection shaders
-- ============================================================================

-- Channel 1: Sobel (already exists in filter.lua, but we need a standalone version)
local sobelShader = [[
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    float tl = dot(Texel(tex, tc + vec2(-1, -1) * texelSize).rgb, vec3(0.333));
    float t  = dot(Texel(tex, tc + vec2( 0, -1) * texelSize).rgb, vec3(0.333));
    float tr = dot(Texel(tex, tc + vec2( 1, -1) * texelSize).rgb, vec3(0.333));
    float l  = dot(Texel(tex, tc + vec2(-1,  0) * texelSize).rgb, vec3(0.333));
    float r  = dot(Texel(tex, tc + vec2( 1,  0) * texelSize).rgb, vec3(0.333));
    float bl = dot(Texel(tex, tc + vec2(-1,  1) * texelSize).rgb, vec3(0.333));
    float b  = dot(Texel(tex, tc + vec2( 0,  1) * texelSize).rgb, vec3(0.333));
    float br = dot(Texel(tex, tc + vec2( 1,  1) * texelSize).rgb, vec3(0.333));

    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
    float edge = sqrt(gx*gx + gy*gy);

    return vec4(edge, edge, edge, 1.0) * color;
  }
]]

-- Channel 2: Laplacian
local laplacianShader = [[
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    float c = dot(Texel(tex, tc).rgb, vec3(0.333));
    float t = dot(Texel(tex, tc + vec2(0, -1) * texelSize).rgb, vec3(0.333));
    float b = dot(Texel(tex, tc + vec2(0,  1) * texelSize).rgb, vec3(0.333));
    float l = dot(Texel(tex, tc + vec2(-1, 0) * texelSize).rgb, vec3(0.333));
    float r = dot(Texel(tex, tc + vec2( 1, 0) * texelSize).rgb, vec3(0.333));

    float edge = abs(4.0 * c - t - b - l - r);
    return vec4(edge, edge, edge, 1.0) * color;
  }
]]

-- Channel 3: Luminance gradient (perceptual brightness edges)
local luminanceGradShader = [[
  extern vec2 texelSize;

  float luminance(vec3 c) {
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    float c0 = luminance(Texel(tex, tc).rgb);
    float t  = luminance(Texel(tex, tc + vec2(0, -1) * texelSize).rgb);
    float b  = luminance(Texel(tex, tc + vec2(0,  1) * texelSize).rgb);
    float l  = luminance(Texel(tex, tc + vec2(-1, 0) * texelSize).rgb);
    float r  = luminance(Texel(tex, tc + vec2( 1, 0) * texelSize).rgb);

    float gx = r - l;
    float gy = b - t;
    float edge = sqrt(gx*gx + gy*gy) * 2.0;

    return vec4(edge, edge, edge, 1.0) * color;
  }
]]

-- Channel 4: Color gradient (chroma edges — detects edges invisible in grayscale)
local chromaGradShader = [[
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec3 c0 = Texel(tex, tc).rgb;
    vec3 t  = Texel(tex, tc + vec2(0, -1) * texelSize).rgb;
    vec3 b  = Texel(tex, tc + vec2(0,  1) * texelSize).rgb;
    vec3 l  = Texel(tex, tc + vec2(-1, 0) * texelSize).rgb;
    vec3 r  = Texel(tex, tc + vec2( 1, 0) * texelSize).rgb;

    // Color distance in each direction
    float dt = length(c0 - t);
    float db = length(c0 - b);
    float dl = length(c0 - l);
    float dr = length(c0 - r);

    float edge = max(max(dt, db), max(dl, dr));
    return vec4(edge, edge, edge, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 3: Average multiple edge channels into consensus edge map
-- ============================================================================

local averageEdgesShader = [[
  extern Image channel2;
  extern Image channel3;
  extern Image channel4;

  vec4 effect(vec4 color, Image channel1, vec2 tc, vec2 sc) {
    float e1 = Texel(channel1, tc).r;
    float e2 = Texel(channel2, tc).r;
    float e3 = Texel(channel3, tc).r;
    float e4 = Texel(channel4, tc).r;

    float avg = (e1 + e2 + e3 + e4) * 0.25;
    return vec4(avg, avg, avg, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 4: Use consensus edges to refine the flood mask
-- ============================================================================

local edgeRefineMaskShader = [[
  extern Image edgeMap;
  extern float edgeStrength;
  extern float edgeThreshold;

  vec4 effect(vec4 color, Image mask, vec2 tc, vec2 sc) {
    float m = Texel(mask, tc).r;
    float edge = Texel(edgeMap, tc).r;

    // Where strong edges exist near the mask boundary, snap to hard edge
    // If we're inside the mask (m > 0.5) and there's a strong edge, keep inside
    // If we're outside (m < 0.5) and there's a strong edge, keep outside
    // The edge acts as a barrier that the mask can't bleed through
    float edgeFactor = smoothstep(edgeThreshold, edgeThreshold + 0.1, edge) * edgeStrength;
    float refined = mix(m, step(0.5, m), edgeFactor);

    return vec4(refined, refined, refined, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 5: Morphological helpers (reuse pattern from detect.lua)
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
  local blurOp = Imaging.getOps()["gaussian_blur"]
  if not blurOp then return mask end
  local blurred = blurOp.gpu(mask, w, h, { radius = radius })
  local result = applyShader("flood_threshold_mask", thresholdMaskShader, blurred, w, h, function(s)
    s:send("cutoff", 0.75)
  end)
  blurred:release()
  return result
end

local function dilate(mask, w, h, radius)
  local blurOp = Imaging.getOps()["gaussian_blur"]
  if not blurOp then return mask end
  local blurred = blurOp.gpu(mask, w, h, { radius = radius })
  local result = applyShader("flood_threshold_mask", thresholdMaskShader, blurred, w, h, function(s)
    s:send("cutoff", 0.25)
  end)
  blurred:release()
  return result
end

-- ============================================================================
-- Main pipeline: seed-flood + multi-channel edge consensus
-- ============================================================================

--- Run seed-point flood detection with multi-channel edge consensus.
--- @param source love.Canvas  Input image
--- @param seedX number  Seed X coordinate (pixel)
--- @param seedY number  Seed Y coordinate (pixel)
--- @param params table  { tolerance, adaptive, edgeStrength, edgeThreshold, morphRadius, featherRadius }
--- @return love.Canvas  Grayscale mask (white = selected region)
--- @return table  { r, g, b } mean color of the selected region
local function floodDetect(source, seedX, seedY, params)
  params = params or {}
  local w = source:getWidth()
  local h = source:getHeight()

  -- 1. CPU flood fill from seed point
  local imageData = source:newImageData()
  local tolerance = params.tolerance or 0.2
  local adaptive = params.adaptive ~= false  -- default true
  local maskData, meanColor = floodFillFromSeed(imageData, seedX, seedY, tolerance, adaptive)
  imageData:release()

  -- Convert mask ImageData to Canvas
  local maskImage = love.graphics.newImage(maskData)
  maskData:release()
  local rawMask = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(rawMask)
  love.graphics.clear(0, 0, 0, 1)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(maskImage, 0, 0)
  love.graphics.pop()
  maskImage:release()

  -- 2. Run 4 edge detection channels on the SOURCE image
  local texelSetup = function(s) s:send("texelSize", { 1 / w, 1 / h }) end

  local edgeSobel = applyShader("flood_sobel", sobelShader, source, w, h, texelSetup)
  local edgeLaplacian = applyShader("flood_laplacian", laplacianShader, source, w, h, texelSetup)
  local edgeLuminance = applyShader("flood_luminance_grad", luminanceGradShader, source, w, h, texelSetup)
  local edgeChroma = applyShader("flood_chroma_grad", chromaGradShader, source, w, h, texelSetup)

  -- 3. Average all 4 channels into consensus edge map
  local consensusEdge = applyShader("flood_avg_edges", averageEdgesShader, edgeSobel, w, h, function(s)
    s:send("channel2", edgeLaplacian)
    s:send("channel3", edgeLuminance)
    s:send("channel4", edgeChroma)
  end)

  -- Release individual channels
  edgeSobel:release()
  edgeLaplacian:release()
  edgeLuminance:release()
  edgeChroma:release()

  -- 4. Refine flood mask using consensus edges
  local edgeStrength = params.edgeStrength or 0.9
  local edgeThreshold = params.edgeThreshold or 0.08

  local refined = applyShader("flood_edge_refine", edgeRefineMaskShader, rawMask, w, h, function(s)
    s:send("edgeMap", consensusEdge)
    s:send("edgeStrength", edgeStrength)
    s:send("edgeThreshold", edgeThreshold)
  end)

  rawMask:release()
  consensusEdge:release()

  -- 5. Morphological cleanup
  local morphRadius = params.morphRadius or max(2, floor(min(w, h) * 0.005))
  local eroded = erode(refined, w, h, morphRadius)
  refined:release()
  local dilated = dilate(eroded, w, h, morphRadius + 1)
  eroded:release()

  -- 6. Feather edges
  local featherRadius = params.featherRadius or max(2, floor(min(w, h) * 0.008))
  if featherRadius > 0 then
    local blurOp = Imaging.getOps()["gaussian_blur"]
    if blurOp then
      local feathered = blurOp.gpu(dilated, w, h, { radius = featherRadius })
      dilated:release()
      return feathered, meanColor
    end
  end

  return dilated, meanColor
end

-- ============================================================================
-- Register as imaging pipeline op
-- ============================================================================

Imaging.registerOp("flood_detect", {
  -- This op needs seedX/seedY so it only works via params, not as a filter chain
  gpu = function(canvas, w, h, params)
    local seedX = tonumber(params.seedX) or floor(w * 0.5)
    local seedY = tonumber(params.seedY) or floor(h * 0.5)
    local mask = floodDetect(canvas, seedX, seedY, params)
    return mask
  end,
})

-- ============================================================================
-- Module exports
-- ============================================================================

return {
  floodDetect = floodDetect,
  floodFillFromSeed = floodFillFromSeed,
}
