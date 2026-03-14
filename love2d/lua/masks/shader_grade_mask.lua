--[[
  masks/shader_grade_mask.lua — Standalone shader grading post-processing mask

  Wraps the shader_grade.lua helper as a registered mask type so it can be
  used directly from React: <ShaderGrade mask shaderHue={10} shaderSaturation={1.2} />

  Also reads theme shader defaults via Masks.getThemeShaderGrade() when
  explicit props are not provided.

  React usage:
    <ShaderGrade mask />
    <ShaderGrade mask shaderHue={10} shaderSaturation={1.2} shaderGrain={0.05} />
]]

local Masks = require("lua.masks")
local ShaderGrade = require("lua.masks.shader_grade")
local Util = require("lua.effects.util")

local ShaderGradeMask = {}

function ShaderGradeMask.create(w, h, props)
  return { time = 0 }
end

function ShaderGradeMask.update(state, dt, props, w, h, mouse)
  state.props = props or {}
  local speed = Util.prop(props, "speed", 1.0)
  state.time = state.time + dt * speed
end

function ShaderGradeMask.draw(state, w, h, source)
  local props = state.props or {}

  -- Read theme defaults for shader grade
  local themeGrade = Masks.getThemeShaderGrade() or {}

  -- Props override theme defaults; theme defaults override neutral values
  local opts = {
    hue = props.shaderHue or themeGrade.hueShift or 0,
    saturation = props.shaderSaturation or themeGrade.saturation or 1,
    value = props.shaderValue or themeGrade.value or 1,
    contrast = props.shaderContrast or themeGrade.contrast or 1,
    posterize = props.shaderPosterize or themeGrade.posterize or 0,
    grain = props.shaderGrain or themeGrade.grain or 0,
    tint = props.shaderTint or themeGrade.tint,
    tintMix = props.shaderTintMix or themeGrade.tintMix or 0,
    vignette = props.shaderVignette or themeGrade.vignette or 0,
    time = state.time,
    gain = props.shaderGain or 1,
  }

  ShaderGrade.draw(source, w, h, opts)
end

Masks.register("ShaderGrade", ShaderGradeMask)

return ShaderGradeMask
