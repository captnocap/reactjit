--[[
  masks/halftone.lua — Halftone dot pattern mask

  Generates a comic book / newspaper style halftone print effect
  using a fragment shader to convert brightness into localized dot sizes.

  React usage:
    <Halftone mask />
    <Halftone mask dotSize={10} angle={45} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local max = math.max

local Halftone = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local shaderCode = [[
  extern float dotSize;
  extern float angle;
  extern float mx;
  extern vec2 resolution;
  
  mat2 rotate2d(float a){
      return mat2(cos(a), -sin(a), sin(a), cos(a));
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 c = Texel(tex, tc);
    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    
    // Rotate coords
    vec2 pos = sc.xy;
    pos = rotate2d(angle) * pos;
    
    // Grid cell
    vec2 nearest = round(pos / dotSize) * dotSize;
    float dist = length(pos - nearest);
    
    // Dot radius depends on luminance (darker = larger dot)
    // max radius is dotSize / 2 * sqrt(2) to cover corners
    float radius = (1.0 - luma) * (dotSize * 0.707);
    
    float edgeWidth = 1.0; // Anti-aliasing
    float dot = 1.0 - smoothstep(radius - edgeWidth, radius + edgeWidth, dist);
    
    // Mix between original and halftone based on mx intensity
    vec3 htColor = vec3(1.0 - dot); // Black dots on white background
    
    vec3 finalColor = mix(c.rgb, c.rgb * htColor, mx);

    return vec4(finalColor, c.a) * color;
  }
]]

local shader = nil

local function getShader()
  if not shader then
    shader = love.graphics.newShader(shaderCode)
  end
  return shader
end

function Halftone.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function Halftone.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function Halftone.draw(state, w, h, source)
  local props = state.props or {}
  local dSize = max(2.0, Util.prop(props, "dotSize", 8.0))
  local angle = Util.prop(props, "angle", 0.785398) -- 45 degrees
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)

  if effectMix <= 0 then
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    return
  end

  local s = getShader()
  s:send("dotSize", dSize)
  s:send("angle", angle)
  s:send("mx", effectMix)
  s:send("resolution", {w, h})

  love.graphics.setShader(s)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)
  love.graphics.setShader()
end

Masks.register("Halftone", Halftone)

return Halftone
