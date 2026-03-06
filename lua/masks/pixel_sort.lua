--[[
  masks/pixel_sort.lua — Pixel Sorting / Melt mask

  Uses a GLSL shader to stretch/sort pixels vertically based on a 
  luminance threshold, creating a classic "glitch art" melting effect.

  React usage:
    <PixelSort mask />
    <PixelSort mask threshold={0.7} length={0.2} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local max = math.max

local PixelSort = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local shaderCode = [[
  extern float threshold;
  extern float sortLength;
  extern float time;

  // Pseudo-random function
  float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 c = Texel(tex, tc);
    vec4 outColor = c;
    
    // We sample upwards. If a pixel above us is bright enough, it "melts" down to us.
    // The distance it melts depends on its brightness and sortLength.
    float maxDist = sortLength;
    
    // Small noise offset per column so they don't melt in perfectly flat lines
    float n = rand(vec2(tc.x, 0.0));
    int steps = int(20.0 + n * 10.0);
    
    for(int i = 1; i < 30; i++) {
      if (i > steps) break;
      float f = float(i) / float(steps);
      vec2 sampleTc = tc - vec2(0.0, f * maxDist);
      if (sampleTc.y < 0.0) break;
      
      vec4 sm = Texel(tex, sampleTc);
      float luma = dot(sm.rgb, vec3(0.299, 0.587, 0.114));
      
      if (luma > threshold + n * 0.1) {
         outColor = sm; // Take the color of the melted pixel
      }
    }
    
    return outColor * color;
  }
]]

local shader = nil

local function getShader()
  if not shader then
    shader = love.graphics.newShader(shaderCode)
  end
  return shader
end

function PixelSort.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function PixelSort.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function PixelSort.draw(state, w, h, source)
  local props = state.props or {}
  local threshold = clamp(Util.prop(props, "threshold", 0.6), 0.0, 1.0)
  local length = clamp(Util.prop(props, "length", 0.15), 0.0, 1.0)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)

  if effectMix <= 0 then
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    return
  end

  local s = getShader()
  s:send("threshold", threshold)
  s:send("sortLength", length * effectMix)
  s:send("time", state.time)

  love.graphics.setShader(s)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)
  love.graphics.setShader()
end

Masks.register("PixelSort", PixelSort)

return PixelSort
