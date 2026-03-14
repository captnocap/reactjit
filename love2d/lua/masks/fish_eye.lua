--[[
  masks/fish_eye.lua — Fisheye / barrel distortion mask

  Uses a GLSL shader for proper barrel distortion. Maps UV coordinates
  through a radial distortion function centered on the element.

  React usage:
    <FishEye mask />
    <FishEye mask strength={0.5} />
]]

local Masks = require("lua.masks")
local Util = require("lua.effects.util")

local max = math.max

local FishEye = {}

local function clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

local shaderCode = [[
  extern float strength;
  extern vec2 center;

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec2 uv = tc - center;
    float r = length(uv);
    float maxR = 0.5;

    // Barrel distortion: push pixels outward from center
    float distorted = r * (1.0 + strength * r * r / (maxR * maxR));
    vec2 newUV = center + normalize(uv) * distorted;

    // Clamp to valid range
    if (newUV.x < 0.0 || newUV.x > 1.0 || newUV.y < 0.0 || newUV.y > 1.0) {
      return vec4(0.0, 0.0, 0.0, 0.0);
    }

    return Texel(tex, newUV) * color;
  }
]]

local shader = nil

local function getShader()
  if not shader then
    shader = love.graphics.newShader(shaderCode)
  end
  return shader
end

function FishEye.create(w, h, props)
  return {
    time = 0,
    props = props or {},
  }
end

function FishEye.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function FishEye.draw(state, w, h, source)
  local props = state.props or {}
  local strength = clamp(Util.prop(props, "strength", 0.4), -1, 2)
  local effectMix = clamp(Util.prop(props, "intensity", 1.0), 0, 1)
  local animated = Util.boolProp(props, "animated", false)
  local t = state.time

  if effectMix <= 0 then
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(source, 0, 0)
    return
  end

  local s = getShader()
  local finalStrength = strength * effectMix
  if animated then
    finalStrength = finalStrength * (0.7 + math.sin(t * 2) * 0.3)
  end

  s:send("strength", finalStrength)
  s:send("center", { 0.5, 0.5 })

  love.graphics.setShader(s)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(source, 0, 0)
  love.graphics.setShader()
end

Masks.register("FishEye", FishEye)

return FishEye
