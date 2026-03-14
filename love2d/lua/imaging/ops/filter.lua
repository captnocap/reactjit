--[[
  imaging/ops/filter.lua — Convolution and spatial filter operations

  All filters use GPU shaders by default. Blur uses two-pass separable
  convolution for O(n) per pixel instead of O(n²).

  Registered operations:
    gaussian_blur, box_blur, motion_blur, sharpen, edge_detect, emboss, pixelize
]]

local Imaging = require("lua.imaging")
local ShaderCache = require("lua.imaging.shader_cache")

local floor, max, min, sqrt, exp, pi = math.floor, math.max, math.min, math.sqrt, math.exp, math.pi
local cos, sin = math.cos, math.sin

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
-- Gaussian Blur (two-pass separable)
-- ============================================================================

-- Single-direction blur shader. Direction is set via uniform.
local blurShader = [[
  extern vec2 direction; // (1,0) for horizontal, (0,1) for vertical
  extern float weights[32];
  extern float offsets[32];
  extern int numSamples;
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 result = Texel(tex, tc) * weights[0];
    for (int i = 1; i < numSamples; i++) {
      vec2 offset = direction * offsets[i] * texelSize;
      result += Texel(tex, tc + offset) * weights[i];
      result += Texel(tex, tc - offset) * weights[i];
    }
    return result * color;
  }
]]

--- Compute Gaussian kernel weights and offsets.
--- @param radius number  Blur radius in pixels
--- @return table weights, table offsets, number numSamples
local function gaussianKernel(radius)
  radius = max(1, min(floor(radius), 31))
  local sigma = radius / 3
  local weights = {}
  local offsets = {}
  local sum = 0

  -- Center weight
  weights[1] = 1.0
  offsets[1] = 0
  sum = 1.0

  for i = 1, radius do
    local w = exp(-(i * i) / (2 * sigma * sigma))
    weights[i + 1] = w
    offsets[i + 1] = i
    sum = sum + w * 2 -- symmetric
  end

  -- Normalize
  for i = 1, radius + 1 do
    weights[i] = weights[i] / sum
  end

  -- Pad to 32
  while #weights < 32 do
    weights[#weights + 1] = 0
    offsets[#offsets + 1] = 0
  end

  return weights, offsets, radius + 1
end

Imaging.registerOp("gaussian_blur", {
  gpu = function(canvas, w, h, params)
    local radius = params.radius or 3
    local weights, offsets, numSamples = gaussianKernel(radius)

    -- Horizontal pass
    local hPass = applyShader("blur_pass", blurShader, canvas, w, h, function(s)
      s:send("direction", { 1, 0 })
      s:send("weights", unpack(weights))
      s:send("offsets", unpack(offsets))
      s:send("numSamples", numSamples)
      s:send("texelSize", { 1 / w, 1 / h })
    end)

    -- Vertical pass
    local result = applyShader("blur_pass", blurShader, hPass, w, h, function(s)
      s:send("direction", { 0, 1 })
      s:send("weights", unpack(weights))
      s:send("offsets", unpack(offsets))
      s:send("numSamples", numSamples)
      s:send("texelSize", { 1 / w, 1 / h })
    end)

    hPass:release()
    return result
  end,
})

-- ============================================================================
-- Box Blur (two-pass separable, uniform weights)
-- ============================================================================

Imaging.registerOp("box_blur", {
  gpu = function(canvas, w, h, params)
    local radius = max(1, min(floor(params.radius or 3), 31))
    local size = radius * 2 + 1
    local weight = 1 / size
    local weights = {}
    local offsets = {}
    for i = 1, 32 do
      weights[i] = (i <= radius + 1) and weight or 0
      offsets[i] = (i <= radius + 1) and (i - 1) or 0
    end

    local hPass = applyShader("blur_pass", blurShader, canvas, w, h, function(s)
      s:send("direction", { 1, 0 })
      s:send("weights", unpack(weights))
      s:send("offsets", unpack(offsets))
      s:send("numSamples", radius + 1)
      s:send("texelSize", { 1 / w, 1 / h })
    end)

    local result = applyShader("blur_pass", blurShader, hPass, w, h, function(s)
      s:send("direction", { 0, 1 })
      s:send("weights", unpack(weights))
      s:send("offsets", unpack(offsets))
      s:send("numSamples", radius + 1)
      s:send("texelSize", { 1 / w, 1 / h })
    end)

    hPass:release()
    return result
  end,
})

-- ============================================================================
-- Motion Blur (directional)
-- ============================================================================

local motionBlurShader = [[
  extern vec2 direction;
  extern int samples;
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 result = vec4(0.0);
    float weight = 1.0 / float(samples);
    for (int i = 0; i < samples; i++) {
      float t = (float(i) / float(samples - 1)) - 0.5;
      vec2 offset = direction * t * texelSize;
      result += Texel(tex, tc + offset) * weight;
    }
    return result * color;
  }
]]

Imaging.registerOp("motion_blur", {
  gpu = function(canvas, w, h, params)
    local angle = (params.angle or 0) * pi / 180
    local distance = params.distance or 10
    local samples = max(3, min(floor(distance), 64))
    local dx = cos(angle) * distance
    local dy = sin(angle) * distance

    return applyShader("motion_blur", motionBlurShader, canvas, w, h, function(s)
      s:send("direction", { dx, dy })
      s:send("samples", samples)
      s:send("texelSize", { 1 / w, 1 / h })
    end)
  end,
})

-- ============================================================================
-- Sharpen (Unsharp Mask: original + amount * (original - blur))
-- ============================================================================

local sharpenShader = [[
  extern Image blurred;
  extern float amount;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 orig = Texel(tex, tc);
    vec4 blur = Texel(blurred, tc);
    vec4 sharp = orig + (orig - blur) * amount;
    return vec4(clamp(sharp.rgb, 0.0, 1.0), orig.a) * color;
  }
]]

Imaging.registerOp("sharpen", {
  gpu = function(canvas, w, h, params)
    local amount = params.amount or 1.0
    -- First blur the image
    local blurOp = Imaging.getOps()["gaussian_blur"]
    local blurred = blurOp.gpu(canvas, w, h, { radius = 2 })

    local shader = ShaderCache.get("sharpen", sharpenShader)
    if not shader then
      blurred:release()
      return canvas
    end

    local output = love.graphics.newCanvas(w, h)
    love.graphics.push("all")
    love.graphics.setCanvas(output)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)

    shader:send("blurred", blurred)
    shader:send("amount", amount)
    love.graphics.setShader(shader)
    love.graphics.draw(canvas, 0, 0)
    love.graphics.setShader()
    love.graphics.pop()

    blurred:release()
    return output
  end,
})

-- ============================================================================
-- Edge Detection (Sobel / Laplacian)
-- ============================================================================

local sobelShader = [[
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    // Sobel kernels
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

    return vec4(edge, edge, edge, Texel(tex, tc).a) * color;
  }
]]

local laplacianShader = [[
  extern vec2 texelSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 center = Texel(tex, tc);
    float c = dot(center.rgb, vec3(0.333));
    float t = dot(Texel(tex, tc + vec2(0, -1) * texelSize).rgb, vec3(0.333));
    float b = dot(Texel(tex, tc + vec2(0,  1) * texelSize).rgb, vec3(0.333));
    float l = dot(Texel(tex, tc + vec2(-1, 0) * texelSize).rgb, vec3(0.333));
    float r = dot(Texel(tex, tc + vec2( 1, 0) * texelSize).rgb, vec3(0.333));

    float edge = abs(4.0 * c - t - b - l - r);
    return vec4(edge, edge, edge, center.a) * color;
  }
]]

Imaging.registerOp("edge_detect", {
  gpu = function(canvas, w, h, params)
    local method = params.method or "sobel"
    local code = method == "laplacian" and laplacianShader or sobelShader
    local name = "edge_" .. method

    return applyShader(name, code, canvas, w, h, function(s)
      s:send("texelSize", { 1 / w, 1 / h })
    end)
  end,
})

-- ============================================================================
-- Emboss
-- ============================================================================

local embossShader = [[
  extern vec2 texelSize;
  extern float angle;
  extern float depth;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec2 dir = vec2(cos(angle), sin(angle));
    vec4 sample1 = Texel(tex, tc - dir * texelSize);
    vec4 sample2 = Texel(tex, tc + dir * texelSize);
    vec3 diff = (sample2.rgb - sample1.rgb) * depth;
    vec3 result = vec3(0.5) + diff;
    return vec4(clamp(result, 0.0, 1.0), Texel(tex, tc).a) * color;
  }
]]

Imaging.registerOp("emboss", {
  gpu = function(canvas, w, h, params)
    local angle = (params.angle or 135) * pi / 180
    local depth = params.depth or 1.0

    return applyShader("emboss", embossShader, canvas, w, h, function(s)
      s:send("texelSize", { 1 / w, 1 / h })
      s:send("angle", angle)
      s:send("depth", depth)
    end)
  end,
})

-- ============================================================================
-- Pixelize (mosaic / block averaging)
-- ============================================================================

local pixelizeShader = [[
  extern vec2 blockSize;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec2 block = floor(tc / blockSize) * blockSize + blockSize * 0.5;
    return Texel(tex, block) * color;
  }
]]

Imaging.registerOp("pixelize", {
  gpu = function(canvas, w, h, params)
    local size = max(params.size or 8, 1)
    return applyShader("pixelize", pixelizeShader, canvas, w, h, function(s)
      s:send("blockSize", { size / w, size / h })
    end)
  end,
})
