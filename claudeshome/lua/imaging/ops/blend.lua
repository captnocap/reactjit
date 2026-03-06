--[[
  imaging/ops/blend.lua — Layer blend mode operations

  Composites two canvases using Photoshop/GIMP-standard blend modes.
  All modes are GPU-accelerated via a single parameterized shader.

  Registered operations:
    blend — takes { mode, layer, opacity } where mode is one of:
      normal, multiply, screen, overlay, soft_light, hard_light,
      dodge, burn, difference, exclusion, addition, subtract,
      hue, saturation, color, value
]]

local Imaging = require("lua.imaging")
local ShaderCache = require("lua.imaging.shader_cache")

local max, min = math.max, math.min

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
-- Blend mode shader — all modes in one shader, selected by uniform
-- ============================================================================

local blendShader = [[
  extern Image layer;
  extern float opacity;
  extern int mode;

  // HSV conversion for component blend modes
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

  vec3 blendColors(vec3 base, vec3 blend) {
    if (mode == 0) { // normal
      return blend;
    } else if (mode == 1) { // multiply
      return base * blend;
    } else if (mode == 2) { // screen
      return 1.0 - (1.0 - base) * (1.0 - blend);
    } else if (mode == 3) { // overlay
      vec3 result;
      result.r = base.r < 0.5 ? 2.0 * base.r * blend.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r);
      result.g = base.g < 0.5 ? 2.0 * base.g * blend.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g);
      result.b = base.b < 0.5 ? 2.0 * base.b * blend.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b);
      return result;
    } else if (mode == 4) { // soft_light (Pegtop)
      return (1.0 - 2.0 * blend) * base * base + 2.0 * blend * base;
    } else if (mode == 5) { // hard_light (overlay with layers swapped)
      vec3 result;
      result.r = blend.r < 0.5 ? 2.0 * base.r * blend.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r);
      result.g = blend.g < 0.5 ? 2.0 * base.g * blend.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g);
      result.b = blend.b < 0.5 ? 2.0 * base.b * blend.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b);
      return result;
    } else if (mode == 6) { // dodge
      return clamp(base / max(1.0 - blend, 0.001), 0.0, 1.0);
    } else if (mode == 7) { // burn
      return 1.0 - clamp((1.0 - base) / max(blend, 0.001), 0.0, 1.0);
    } else if (mode == 8) { // difference
      return abs(base - blend);
    } else if (mode == 9) { // exclusion
      return base + blend - 2.0 * base * blend;
    } else if (mode == 10) { // addition
      return min(base + blend, 1.0);
    } else if (mode == 11) { // subtract
      return max(base - blend, 0.0);
    } else if (mode == 12) { // hue — apply blend's hue to base's sat+val
      vec3 bHSV = rgb2hsv(base);
      vec3 lHSV = rgb2hsv(blend);
      return hsv2rgb(vec3(lHSV.x, bHSV.y, bHSV.z));
    } else if (mode == 13) { // saturation — apply blend's sat to base
      vec3 bHSV = rgb2hsv(base);
      vec3 lHSV = rgb2hsv(blend);
      return hsv2rgb(vec3(bHSV.x, lHSV.y, bHSV.z));
    } else if (mode == 14) { // color — apply blend's hue+sat to base's val
      vec3 bHSV = rgb2hsv(base);
      vec3 lHSV = rgb2hsv(blend);
      return hsv2rgb(vec3(lHSV.x, lHSV.y, bHSV.z));
    } else if (mode == 15) { // value — apply blend's val to base
      vec3 bHSV = rgb2hsv(base);
      vec3 lHSV = rgb2hsv(blend);
      return hsv2rgb(vec3(bHSV.x, bHSV.y, lHSV.z));
    }
    return blend; // fallback
  }

  vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
    vec4 base = Texel(tex, tc);
    vec4 blend = Texel(layer, tc);

    vec3 result = blendColors(base.rgb, blend.rgb);

    // Mix with opacity
    result = mix(base.rgb, result, opacity * blend.a);

    return vec4(result, base.a) * color;
  }
]]

-- Mode name -> int index
local modeIndex = {
  normal     = 0,
  multiply   = 1,
  screen     = 2,
  overlay    = 3,
  soft_light = 4,
  hard_light = 5,
  dodge      = 6,
  burn       = 7,
  difference = 8,
  exclusion  = 9,
  addition   = 10,
  subtract   = 11,
  hue        = 12,
  saturation = 13,
  color      = 14,
  value      = 15,
}

Imaging.registerOp("blend", {
  gpu = function(canvas, w, h, params)
    local mode = params.mode or "normal"
    local layer = params.layer -- must be a Canvas or Image
    local opacity = params.opacity or 1.0

    if not layer then
      io.write("[imaging:blend] No layer provided\n")
      io.flush()
      return canvas
    end

    local modeIdx = modeIndex[mode]
    if not modeIdx then
      io.write("[imaging:blend] Unknown mode: " .. tostring(mode) .. "\n")
      io.flush()
      modeIdx = 0
    end

    return applyShader("blend", blendShader, canvas, w, h, function(s)
      s:send("layer", layer)
      s:send("opacity", opacity)
      s:send("mode", modeIdx)
    end)
  end,
})

--- Convenience: list available blend modes.
--- @return table  Array of mode name strings
function Imaging.blendModes()
  local modes = {}
  for name in pairs(modeIndex) do
    modes[#modes + 1] = name
  end
  table.sort(modes)
  return modes
end
