--[[
  masks/shader_grade.lua — Shared shader grading pass for masks

  Reuses the imaging shader stack patterns (HSV shift, contrast, posterize)
  and exposes a single draw helper for mask modules.
]]

local ShaderCache = require("lua.imaging.shader_cache")
local Color = require("lua.color")

local ShaderGrade = {}

local abs = math.abs
local max = math.max

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local shaderCode = [[
  extern float hueShift;
  extern float satMul;
  extern float valMul;
  extern float contrast;
  extern float posterizeLevels;
  extern float grain;
  extern vec3 tintColor;
  extern float tintMix;
  extern float vignette;
  extern float time;
  extern float gain;

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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + time * 13.1) * 43758.5453123);
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 px = Texel(tex, tc) * color;
    vec3 hsv = rgb2hsv(px.rgb);
    hsv.x = fract(hsv.x + hueShift / 360.0);
    hsv.y = clamp(hsv.y * satMul, 0.0, 1.0);
    hsv.z = clamp(hsv.z * valMul, 0.0, 1.0);

    vec3 rgb = hsv2rgb(hsv);
    rgb = (rgb - 0.5) * contrast + 0.5;

    if (posterizeLevels > 1.5) {
      rgb = floor(rgb * posterizeLevels + 0.5) / posterizeLevels;
    }

    rgb = mix(rgb, rgb * tintColor, clamp(tintMix, 0.0, 1.0));

    if (grain > 0.0001) {
      float n = (hash(sc.xy) - 0.5) * grain;
      rgb += vec3(n);
    }

    if (vignette > 0.0001) {
      vec2 uv = tc * 2.0 - 1.0;
      float vig = smoothstep(1.2, 0.2, dot(uv, uv));
      rgb *= mix(1.0, vig, vignette);
    }

    rgb = clamp(rgb * gain, 0.0, 1.0);
    return vec4(rgb, px.a);
  }
]]

local function parseTint(value, fallback)
  local r, g, b = Color.parse(value)
  if r then return r, g, b end

  local fr, fg, fb = Color.parse(fallback)
  if fr then return fr, fg, fb end

  return 1, 1, 1
end

local function isNeutral(opts)
  local hue = opts.hue or 0
  local sat = opts.saturation or 1
  local val = opts.value or 1
  local contrast = opts.contrast or 1
  local posterize = opts.posterize or 0
  local grain = opts.grain or 0
  local tintMix = opts.tintMix or 0
  local vignette = opts.vignette or 0
  local gain = opts.gain or 1

  return abs(hue) < 0.001
    and abs(sat - 1) < 0.001
    and abs(val - 1) < 0.001
    and abs(contrast - 1) < 0.001
    and posterize <= 1.5
    and grain <= 0.0001
    and tintMix <= 0.0001
    and vignette <= 0.0001
    and abs(gain - 1) < 0.001
end

--- Draw source through the shared grading shader.
--- @param source love.Canvas
--- @param w number
--- @param h number
--- @param opts table
--- @return boolean ok
function ShaderGrade.draw(source, w, h, opts)
  opts = opts or {}
  local x = opts.x or 0
  local y = opts.y or 0
  local alpha = clamp(opts.alpha or 1, 0, 1)

  if isNeutral(opts) then
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.draw(source, x, y)
    love.graphics.setColor(1, 1, 1, 1)
    return true
  end

  local shader = ShaderCache.get("mask_shader_grade_v1", shaderCode)
  if not shader then
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.draw(source, x, y)
    love.graphics.setColor(1, 1, 1, 1)
    return false
  end

  local tr, tg, tb = parseTint(opts.tint, opts.fallbackTint or "#ffffff")

  shader:send("hueShift", opts.hue or 0)
  shader:send("satMul", max(0, opts.saturation or 1))
  shader:send("valMul", max(0, opts.value or 1))
  shader:send("contrast", max(0, opts.contrast or 1))
  shader:send("posterizeLevels", max(0, opts.posterize or 0))
  shader:send("grain", clamp(opts.grain or 0, 0, 1))
  shader:send("tintColor", { tr, tg, tb })
  shader:send("tintMix", clamp(opts.tintMix or 0, 0, 1))
  shader:send("vignette", clamp(opts.vignette or 0, 0, 1))
  shader:send("time", opts.time or 0)
  shader:send("gain", max(0, opts.gain or 1))

  local ok = pcall(function()
    love.graphics.setShader(shader)
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.draw(source, x, y)
    love.graphics.setShader()
    love.graphics.setColor(1, 1, 1, 1)
  end)

  if not ok then
    love.graphics.setShader()
    love.graphics.setColor(1, 1, 1, alpha)
    love.graphics.draw(source, x, y)
    love.graphics.setColor(1, 1, 1, 1)
  end

  return ok
end

return ShaderGrade
