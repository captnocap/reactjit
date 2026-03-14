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
-- Step 3b: Multi-cue saliency shader (color + spatial + sharpness)
-- ============================================================================

local saliencyShader = [[
  extern vec3 bgColor1;
  extern vec3 bgColor2;
  extern vec3 bgColor3;
  extern vec3 bgColor4;
  extern float threshold;
  extern float softness;
  extern int numColors;
  extern vec2 texelSize;
  extern float spatialWeight;
  extern float sharpWeight;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc);

    // Cue 1: Color distance from background clusters
    float minDist = length(pixel.rgb - bgColor1);
    if (numColors >= 2) minDist = min(minDist, length(pixel.rgb - bgColor2));
    if (numColors >= 3) minDist = min(minDist, length(pixel.rgb - bgColor3));
    if (numColors >= 4) minDist = min(minDist, length(pixel.rgb - bgColor4));
    float colorScore = smoothstep(threshold - softness, threshold + softness, minDist);

    // Cue 2: Spatial center prior — subjects tend to be centered
    float cx = tc.x - 0.5;
    float cy = tc.y - 0.5;
    float centerDist = sqrt(cx * cx + cy * cy);
    float spatialScore = 1.0 - smoothstep(0.15, 0.6, centerDist);

    // Cue 3: Local sharpness via Laplacian energy (in-focus = foreground)
    float lum = dot(pixel.rgb, vec3(0.299, 0.587, 0.114));
    float tL = dot(Texel(tex, tc + vec2( 0,-1) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float bL = dot(Texel(tex, tc + vec2( 0, 1) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float lL = dot(Texel(tex, tc + vec2(-1, 0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float rL = dot(Texel(tex, tc + vec2( 1, 0) * texelSize).rgb, vec3(0.299, 0.587, 0.114));
    float laplacian = abs(4.0 * lum - tL - bL - lL - rL);
    float sharpScore = smoothstep(0.005, 0.05, laplacian);

    // Combine cues (weighted)
    float colorW = max(0.0, 1.0 - spatialWeight - sharpWeight);
    float saliency = colorScore * colorW + spatialScore * spatialWeight + sharpScore * sharpWeight;
    saliency = clamp(saliency, 0.0, 1.0) * pixel.a;

    return vec4(saliency, saliency, saliency, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 3c: Iterative refinement shader (fg/bg color model re-estimation)
-- ============================================================================

local refinementShader = [[
  extern vec3 fgColor1;
  extern vec3 fgColor2;
  extern vec3 fgColor3;
  extern vec3 fgColor4;
  extern vec3 bgRefColor1;
  extern vec3 bgRefColor2;
  extern vec3 bgRefColor3;
  extern vec3 bgRefColor4;
  extern int numFgColors;
  extern int numBgColors;
  extern Image initialMask;
  extern float blendFactor;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc);
    float initial = Texel(initialMask, tc).r;

    // Distance to nearest fg cluster
    float fgDist = length(pixel.rgb - fgColor1);
    if (numFgColors >= 2) fgDist = min(fgDist, length(pixel.rgb - fgColor2));
    if (numFgColors >= 3) fgDist = min(fgDist, length(pixel.rgb - fgColor3));
    if (numFgColors >= 4) fgDist = min(fgDist, length(pixel.rgb - fgColor4));

    // Distance to nearest bg cluster
    float bgDist = length(pixel.rgb - bgRefColor1);
    if (numBgColors >= 2) bgDist = min(bgDist, length(pixel.rgb - bgRefColor2));
    if (numBgColors >= 3) bgDist = min(bgDist, length(pixel.rgb - bgRefColor3));
    if (numBgColors >= 4) bgDist = min(bgDist, length(pixel.rgb - bgRefColor4));

    // Relative distance: closer to fg = higher mask
    float epsilon = 0.001;
    float refined = bgDist / (fgDist + bgDist + epsilon);

    // Blend with initial for stability
    float result = mix(initial, refined, blendFactor);
    result = clamp(result, 0.0, 1.0) * pixel.a;

    return vec4(result, result, result, 1.0) * color;
  }
]]

-- ============================================================================
-- Step 3d: Spatial vignette — kill mask edges, keep center
-- ============================================================================

local spatialVignetteShader = [[
  extern float innerRadius;
  extern float outerRadius;

  vec4 effect(vec4 color, Image mask, vec2 tc, vec2 sc) {
    float m = Texel(mask, tc).r;
    float cx = tc.x - 0.5;
    float cy = tc.y - 0.5;
    float dist = sqrt(cx * cx + cy * cy);
    float vignette = 1.0 - smoothstep(innerRadius, outerRadius, dist);
    float result = m * vignette;
    return vec4(result, result, result, 1.0) * color;
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
-- Sample fg/bg pixels from an initial mask for refinement
-- ============================================================================

--- Sample pixels from image regions where the mask indicates fg or bg.
--- @param imageData love.ImageData  Source image
--- @param maskData love.ImageData  Initial mask (white = fg)
--- @param isForeground boolean  true = sample where mask > fgThreshold, false = where mask < bgThreshold
--- @param fgThreshold number  (optional) Foreground sampling threshold, default 0.45
--- @param bgThreshold number  (optional) Background sampling threshold, default 0.2
--- @return table  Array of { r, g, b } samples
local function sampleFromMask(imageData, maskData, isForeground, fgThreshold, bgThreshold)
  fgThreshold = fgThreshold or 0.45
  bgThreshold = bgThreshold or 0.2
  local w = imageData:getWidth()
  local h = imageData:getHeight()
  local samples = {}

  -- Stride of 3 for performance (don't need every pixel)
  for y = 0, h - 1, 3 do
    for x = 0, w - 1, 3 do
      local mr = maskData:getPixel(x, y)
      local include = false
      if isForeground and mr > fgThreshold then include = true end
      if not isForeground and mr < bgThreshold then include = true end

      if include then
        local r, g, b = imageData:getPixel(x, y)
        samples[#samples + 1] = { r = r, g = g, b = b }
      end
    end
  end

  return samples
end

-- ============================================================================
-- Connected component filter: keep only the largest white blob near center
-- ============================================================================

--- Given a binary mask (ImageData), flood-fill from the white pixel nearest to
--- center and zero out all other white regions. This removes disconnected
--- background fragments (windows, plants, etc.) that the saliency shader
--- incorrectly classified as foreground.
---
--- @param maskData love.ImageData  Binary mask (r > 0.5 = white)
--- @return love.ImageData  Cleaned mask (same object, modified in place)
local function keepLargestCenteredComponent(maskData)
  local w = maskData:getWidth()
  local h = maskData:getHeight()
  local cx, cy = floor(w / 2), floor(h / 2)

  -- Build flat boolean grid of white pixels
  local white = {}
  local function idx(x, y) return y * w + x end
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local r = maskData:getPixel(x, y)
      white[idx(x, y)] = (r > 0.5)
    end
  end

  -- Find the nearest white pixel to center (spiral outward)
  local seedX, seedY = nil, nil
  local maxSearch = max(w, h)
  for radius = 0, maxSearch do
    for dy = -radius, radius do
      for dx = -radius, radius do
        if math.abs(dx) == radius or math.abs(dy) == radius then
          local sx = cx + dx
          local sy = cy + dy
          if sx >= 0 and sx < w and sy >= 0 and sy < h then
            if white[idx(sx, sy)] then
              seedX, seedY = sx, sy
              break
            end
          end
        end
      end
      if seedX then break end
    end
    if seedX then break end
  end

  if not seedX then return maskData end  -- no white pixels at all

  -- BFS flood fill from seed — mark all connected white pixels
  local keep = {}
  local queue = {}
  local qHead, qTail = 1, 1
  queue[qTail] = { seedX, seedY }
  qTail = qTail + 1
  keep[idx(seedX, seedY)] = true

  local ddx = { 1, -1, 0, 0 }
  local ddy = { 0, 0, 1, -1 }

  while qHead < qTail do
    local cur = queue[qHead]
    qHead = qHead + 1
    for d = 1, 4 do
      local nx = cur[1] + ddx[d]
      local ny = cur[2] + ddy[d]
      if nx >= 0 and nx < w and ny >= 0 and ny < h then
        local ni = idx(nx, ny)
        if white[ni] and not keep[ni] then
          keep[ni] = true
          queue[qTail] = { nx, ny }
          qTail = qTail + 1
        end
      end
    end
  end

  -- Zero out all white pixels NOT in the kept component
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local i = idx(x, y)
      if white[i] and not keep[i] then
        maskData:setPixel(x, y, 0, 0, 0, 1)
      end
    end
  end

  return maskData
end

-- ============================================================================
-- Main detection pipeline
-- ============================================================================

--- Run foreground detection on a source canvas.
--- Uses multi-cue saliency (color distance + spatial prior + sharpness) for
--- robust segmentation even when foreground and background share colors.
--- Optionally performs iterative refinement by re-estimating fg/bg color models
--- from the initial mask.
---
--- @param source love.Canvas  Input image
--- @param params table  {
---   threshold, softness, borderWidth, morphRadius, featherRadius, edgeWeight,
---   spatialWeight (0-1, center prior strength, default 0.25),
---   sharpWeight (0-1, sharpness cue strength, default 0.2),
---   refine (boolean, enable iterative refinement, default true),
--- }
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

  -- Auto-threshold: higher variance = need higher threshold
  local baseThreshold = params.threshold or (0.18 + math.sqrt(variance) * 0.5)
  local softness = params.softness or (baseThreshold * 0.4)
  baseThreshold = max(0.05, min(0.8, baseThreshold))
  softness = max(0.01, min(0.3, softness))

  -- 2. Cluster border samples for multi-color background matching
  local clusters = clusterColors(samples, 4)
  local numClusters = #clusters

  -- 3. Generate initial mask via multi-cue saliency
  local spatialW = tonumber(params.spatialWeight) or 0.25
  local sharpW = tonumber(params.sharpWeight) or 0.2
  -- Clamp so color always has some weight
  spatialW = max(0, min(0.45, spatialW))
  sharpW = max(0, min(0.45, sharpW))

  local rawMask = applyShader("saliency_detect", saliencyShader, source, w, h, function(s)
    s:send("bgColor1", { clusters[1].r, clusters[1].g, clusters[1].b })
    s:send("bgColor2", { clusters[min(2, numClusters)].r, clusters[min(2, numClusters)].g, clusters[min(2, numClusters)].b })
    s:send("bgColor3", { clusters[min(3, numClusters)].r, clusters[min(3, numClusters)].g, clusters[min(3, numClusters)].b })
    s:send("bgColor4", { clusters[min(4, numClusters)].r, clusters[min(4, numClusters)].g, clusters[min(4, numClusters)].b })
    s:send("threshold", baseThreshold)
    s:send("softness", softness)
    s:send("numColors", numClusters)
    s:send("texelSize", { 1 / w, 1 / h })
    s:send("spatialWeight", spatialW)
    s:send("sharpWeight", sharpW)
  end)

  -- 4. Iterative refinement: sample fg/bg from initial mask, re-segment
  local doRefine = params.refine ~= false  -- default true
  if doRefine then
    local maskData = rawMask:newImageData()

    -- Sample fg and bg pixels from image using the initial mask
    local fgSamples = sampleFromMask(imageData, maskData, true)
    local bgSamples = sampleFromMask(imageData, maskData, false)

    -- Cluster each into up to 4 representative colors
    local fgClusters = clusterColors(fgSamples, 4)
    local bgClusters = clusterColors(bgSamples, 4)
    local numFg = #fgClusters
    local numBg = #bgClusters

    if numFg > 0 and numBg > 0 then
      local refined = applyShader("refine_mask", refinementShader, source, w, h, function(s)
        s:send("fgColor1", { fgClusters[1].r, fgClusters[1].g, fgClusters[1].b })
        s:send("fgColor2", { fgClusters[min(2, numFg)].r, fgClusters[min(2, numFg)].g, fgClusters[min(2, numFg)].b })
        s:send("fgColor3", { fgClusters[min(3, numFg)].r, fgClusters[min(3, numFg)].g, fgClusters[min(3, numFg)].b })
        s:send("fgColor4", { fgClusters[min(4, numFg)].r, fgClusters[min(4, numFg)].g, fgClusters[min(4, numFg)].b })
        s:send("bgRefColor1", { bgClusters[1].r, bgClusters[1].g, bgClusters[1].b })
        s:send("bgRefColor2", { bgClusters[min(2, numBg)].r, bgClusters[min(2, numBg)].g, bgClusters[min(2, numBg)].b })
        s:send("bgRefColor3", { bgClusters[min(3, numBg)].r, bgClusters[min(3, numBg)].g, bgClusters[min(3, numBg)].b })
        s:send("bgRefColor4", { bgClusters[min(4, numBg)].r, bgClusters[min(4, numBg)].g, bgClusters[min(4, numBg)].b })
        s:send("numFgColors", numFg)
        s:send("numBgColors", numBg)
        s:send("initialMask", rawMask)
        s:send("blendFactor", 0.35)
      end)
      rawMask:release()
      rawMask = refined
    end

    maskData:release()
  end

  -- Release imageData now that refinement is done
  imageData:release()

  -- 5. Binarize the saliency mask before morph — push soft values toward 0/1
  --    Without this, the morph erode (threshold 0.75) destroys the 0.5-0.7 range
  --    where the subject body lives when fg/bg colors are similar.
  local binaryCutoff = tonumber(params.binaryCutoff) or 0.4
  local binarized = applyShader("pre_morph_binarize", thresholdMaskShader, rawMask, w, h, function(s)
    s:send("cutoff", binaryCutoff)
  end)
  rawMask:release()
  rawMask = binarized

  -- 5b. Spatial vignette: multiply the binary mask by a radial falloff to
  --     hard-kill background fragments at image edges (windows, plants, shelves).
  --     The centered subject survives; edge artifacts die.
  local vignetteInner = tonumber(params.vignetteInner) or 0.35
  local vignetteOuter = tonumber(params.vignetteOuter) or 0.58
  if vignetteOuter > 0 then
    local vignetted = applyShader("spatial_vignette", spatialVignetteShader, rawMask, w, h, function(s)
      s:send("innerRadius", vignetteInner)
      s:send("outerRadius", vignetteOuter)
    end)
    rawMask:release()
    rawMask = vignetted
  end

  -- 6. Edge detection for boundary refinement
  local edgeWeight = params.edgeWeight or 0.8
  local edgeOp = Imaging.getOps()["edge_detect"]
  if edgeOp and edgeWeight > 0 then
    local edgeMap = edgeOp.gpu(source, w, h, { method = "sobel" })
    local edgeRefined = applyShader("edge_refine", edgeRefineShader, rawMask, w, h, function(s)
      s:send("edgeMap", edgeMap)
      s:send("edgeStrength", edgeWeight)
    end)
    edgeMap:release()
    rawMask:release()
    rawMask = edgeRefined
  end

  -- 7. Morphological cleanup: erode (remove noise) then dilate (restore shape)
  local morphRadius = params.morphRadius or max(2, floor(min(w, h) * 0.008))
  local eroded = erode(rawMask, w, h, morphRadius)
  rawMask:release()
  local dilated = dilate(eroded, w, h, morphRadius + 1)
  eroded:release()

  -- 8. Feather the mask edges
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
