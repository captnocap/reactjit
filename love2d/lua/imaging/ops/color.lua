--[[
  imaging/ops/color.lua — Color adjustment operations

  All operations are GPU-first (GLSL shaders), with CPU fallback via ImageData.
  Each operation takes a Canvas and returns a new Canvas.

  Registered operations:
    brightness, contrast, levels, curves, hue_saturation, invert,
    threshold, posterize, desaturate, colorize, channel_mixer, gradient_map
]]

local Imaging = require("lua.imaging")
local ShaderCache = require("lua.imaging.shader_cache")

local floor, max, min = math.floor, math.max, math.min
local clamp = function(v, lo, hi) return min(max(v, lo), hi) end

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
-- Brightness
-- ============================================================================

local brightnessShader = [[
  extern float amount;
  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    pixel.rgb += amount;
    return vec4(clamp(pixel.rgb, 0.0, 1.0), pixel.a);
  }
]]

Imaging.registerOp("brightness", {
  gpu = function(canvas, w, h, params)
    local amount = params.amount or 0
    return applyShader("brightness", brightnessShader, canvas, w, h, function(s)
      s:send("amount", amount)
    end)
  end,
  cpu = function(canvas, w, h, params)
    local amount = (params.amount or 0) * 255
    local data = canvas:newImageData()
    data:mapPixel(function(x, y, r, g, b, a)
      return clamp(r + amount, 0, 255), clamp(g + amount, 0, 255), clamp(b + amount, 0, 255), a
    end)
    local img = love.graphics.newImage(data)
    local output = love.graphics.newCanvas(w, h)
    love.graphics.push("all")
    love.graphics.setCanvas(output)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(img, 0, 0)
    love.graphics.pop()
    img:release()
    data:release()
    return output
  end,
})

-- ============================================================================
-- Contrast
-- ============================================================================

local contrastShader = [[
  extern float factor;
  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    pixel.rgb = (pixel.rgb - 0.5) * factor + 0.5;
    return vec4(clamp(pixel.rgb, 0.0, 1.0), pixel.a);
  }
]]

Imaging.registerOp("contrast", {
  gpu = function(canvas, w, h, params)
    local factor = params.factor or 1.0
    return applyShader("contrast", contrastShader, canvas, w, h, function(s)
      s:send("factor", factor)
    end)
  end,
})

-- ============================================================================
-- Levels
-- ============================================================================

local levelsShader = [[
  extern float inBlack;
  extern float inWhite;
  extern float gamma;
  extern float outBlack;
  extern float outWhite;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    // Input mapping
    vec3 mapped = clamp((pixel.rgb - inBlack) / max(inWhite - inBlack, 0.001), 0.0, 1.0);
    // Gamma correction
    mapped = pow(mapped, vec3(1.0 / max(gamma, 0.01)));
    // Output mapping
    mapped = mapped * (outWhite - outBlack) + outBlack;
    return vec4(clamp(mapped, 0.0, 1.0), pixel.a);
  }
]]

Imaging.registerOp("levels", {
  gpu = function(canvas, w, h, params)
    return applyShader("levels", levelsShader, canvas, w, h, function(s)
      s:send("inBlack", params.inBlack or 0.0)
      s:send("inWhite", params.inWhite or 1.0)
      s:send("gamma", params.gamma or 1.0)
      s:send("outBlack", params.outBlack or 0.0)
      s:send("outWhite", params.outWhite or 1.0)
    end)
  end,
})

-- ============================================================================
-- Curves (piecewise linear approximation with up to 16 control points)
-- ============================================================================

local curvesShader = [[
  extern vec2 points[16];
  extern int numPoints;

  float curveLookup(float val) {
    if (numPoints < 2) return val;
    // Find segment
    for (int i = 0; i < numPoints - 1; i++) {
      if (val <= points[i + 1].x) {
        float t = (val - points[i].x) / max(points[i + 1].x - points[i].x, 0.001);
        return mix(points[i].y, points[i + 1].y, clamp(t, 0.0, 1.0));
      }
    }
    return points[numPoints - 1].y;
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    pixel.r = curveLookup(pixel.r);
    pixel.g = curveLookup(pixel.g);
    pixel.b = curveLookup(pixel.b);
    return vec4(clamp(pixel.rgb, 0.0, 1.0), pixel.a);
  }
]]

Imaging.registerOp("curves", {
  gpu = function(canvas, w, h, params)
    local pts = params.points or { {0, 0}, {1, 1} }
    -- Flatten to vec2 array
    local flat = {}
    for i, p in ipairs(pts) do
      flat[i] = { p[1], p[2] }
    end
    -- Pad to 16
    while #flat < 16 do
      flat[#flat + 1] = { 1, 1 }
    end

    return applyShader("curves", curvesShader, canvas, w, h, function(s)
      s:send("points", unpack(flat))
      s:send("numPoints", min(#pts, 16))
    end)
  end,
})

-- ============================================================================
-- Hue / Saturation / Value
-- ============================================================================

local hueSatShader = [[
  extern float hueShift;
  extern float satMul;
  extern float valMul;

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    vec3 hsv = rgb2hsv(pixel.rgb);
    hsv.x = fract(hsv.x + hueShift / 360.0);
    hsv.y = clamp(hsv.y * satMul, 0.0, 1.0);
    hsv.z = clamp(hsv.z * valMul, 0.0, 1.0);
    return vec4(hsv2rgb(hsv), pixel.a);
  }
]]

Imaging.registerOp("hue_saturation", {
  gpu = function(canvas, w, h, params)
    return applyShader("hue_saturation", hueSatShader, canvas, w, h, function(s)
      s:send("hueShift", params.hue or 0)
      s:send("satMul", params.saturation or 1.0)
      s:send("valMul", params.value or 1.0)
    end)
  end,
})

-- ============================================================================
-- Invert
-- ============================================================================

local invertShader = [[
  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    return vec4(1.0 - pixel.rgb, pixel.a);
  }
]]

Imaging.registerOp("invert", {
  gpu = function(canvas, w, h, params)
    return applyShader("invert", invertShader, canvas, w, h)
  end,
  cpu = function(canvas, w, h, params)
    local data = canvas:newImageData()
    data:mapPixel(function(x, y, r, g, b, a)
      return 1 - r, 1 - g, 1 - b, a
    end)
    local img = love.graphics.newImage(data)
    local output = love.graphics.newCanvas(w, h)
    love.graphics.push("all")
    love.graphics.setCanvas(output)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(img, 0, 0)
    love.graphics.pop()
    img:release()
    data:release()
    return output
  end,
})

-- ============================================================================
-- Threshold
-- ============================================================================

local thresholdShader = [[
  extern float level;
  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    float lum = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));
    float val = step(level, lum);
    return vec4(val, val, val, pixel.a);
  }
]]

Imaging.registerOp("threshold", {
  gpu = function(canvas, w, h, params)
    local level = params.level or 0.5
    return applyShader("threshold", thresholdShader, canvas, w, h, function(s)
      s:send("level", level)
    end)
  end,
})

-- ============================================================================
-- Posterize
-- ============================================================================

local posterizeShader = [[
  extern float levels;
  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    vec3 post = floor(pixel.rgb * levels + 0.5) / levels;
    return vec4(clamp(post, 0.0, 1.0), pixel.a);
  }
]]

Imaging.registerOp("posterize", {
  gpu = function(canvas, w, h, params)
    local levels = max(params.levels or 4, 2)
    return applyShader("posterize", posterizeShader, canvas, w, h, function(s)
      s:send("levels", levels)
    end)
  end,
})

-- ============================================================================
-- Desaturate
-- ============================================================================

local desaturateShader = [[
  extern int method; // 0 = luminosity, 1 = average, 2 = lightness

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    float gray;
    if (method == 0) {
      gray = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722)); // luminosity
    } else if (method == 1) {
      gray = (pixel.r + pixel.g + pixel.b) / 3.0; // average
    } else {
      gray = (max(max(pixel.r, pixel.g), pixel.b) + min(min(pixel.r, pixel.g), pixel.b)) / 2.0; // lightness
    }
    return vec4(gray, gray, gray, pixel.a);
  }
]]

local desaturateMethods = { luminosity = 0, average = 1, lightness = 2 }

Imaging.registerOp("desaturate", {
  gpu = function(canvas, w, h, params)
    local method = desaturateMethods[params.method or "luminosity"] or 0
    return applyShader("desaturate", desaturateShader, canvas, w, h, function(s)
      s:send("method", method)
    end)
  end,
})

-- ============================================================================
-- Colorize
-- ============================================================================

local colorizeShader = [[
  extern float hue;
  extern float saturation;
  extern float lightness;

  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    float h6 = h * 6.0;
    if (h6 < 1.0) rgb = vec3(c, x, 0.0);
    else if (h6 < 2.0) rgb = vec3(x, c, 0.0);
    else if (h6 < 3.0) rgb = vec3(0.0, c, x);
    else if (h6 < 4.0) rgb = vec3(0.0, x, c);
    else if (h6 < 5.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    float gray = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));
    float l = clamp(gray + lightness, 0.0, 1.0);
    vec3 rgb = hsl2rgb(hue / 360.0, saturation, l);
    return vec4(rgb, pixel.a);
  }
]]

Imaging.registerOp("colorize", {
  gpu = function(canvas, w, h, params)
    return applyShader("colorize", colorizeShader, canvas, w, h, function(s)
      s:send("hue", params.hue or 0)
      s:send("saturation", params.saturation or 0.5)
      s:send("lightness", params.lightness or 0)
    end)
  end,
})

-- ============================================================================
-- Channel Mixer (3x3 matrix on RGB)
-- ============================================================================

local channelMixerShader = [[
  extern mat3 mixMatrix;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    vec3 mixed = mixMatrix * pixel.rgb;
    return vec4(clamp(mixed, 0.0, 1.0), pixel.a);
  }
]]

Imaging.registerOp("channel_mixer", {
  gpu = function(canvas, w, h, params)
    -- matrix is { {rr, rg, rb}, {gr, gg, gb}, {br, bg, bb} }
    local m = params.matrix or { {1,0,0}, {0,1,0}, {0,0,1} }
    -- Love2D mat3 is column-major, flatten
    local flat = {
      m[1][1], m[2][1], m[3][1],
      m[1][2], m[2][2], m[3][2],
      m[1][3], m[2][3], m[3][3],
    }
    return applyShader("channel_mixer", channelMixerShader, canvas, w, h, function(s)
      s:send("mixMatrix", flat)
    end)
  end,
})

-- ============================================================================
-- Gradient Map (luminosity -> gradient color lookup)
-- ============================================================================

local gradientMapShader = [[
  extern vec4 stops[8];  // { position, r, g, b }
  extern int numStops;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 pixel = Texel(tex, tc) * color;
    float lum = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Find gradient segment
    vec3 result = vec3(stops[0].yzw);
    for (int i = 0; i < numStops - 1; i++) {
      if (lum >= stops[i].x && lum <= stops[i + 1].x) {
        float t = (lum - stops[i].x) / max(stops[i + 1].x - stops[i].x, 0.001);
        result = mix(stops[i].yzw, stops[i + 1].yzw, t);
        break;
      }
      if (lum > stops[i + 1].x) {
        result = stops[i + 1].yzw;
      }
    }

    return vec4(result, pixel.a);
  }
]]

Imaging.registerOp("gradient_map", {
  gpu = function(canvas, w, h, params)
    -- gradient is { { pos, r, g, b }, ... } where pos is 0-1
    local gradient = params.gradient or { {0, 0, 0, 0}, {1, 1, 1, 1} }
    local stops = {}
    for i, stop in ipairs(gradient) do
      stops[i] = { stop[1], stop[2], stop[3], stop[4] }
    end
    while #stops < 8 do
      stops[#stops + 1] = { 1, 1, 1, 1 }
    end

    return applyShader("gradient_map", gradientMapShader, canvas, w, h, function(s)
      s:send("stops", unpack(stops))
      s:send("numStops", min(#gradient, 8))
    end)
  end,
})
