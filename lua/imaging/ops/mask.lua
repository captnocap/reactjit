--[[
  imaging/ops/mask.lua -- Selection mask compositing operation

  Registered operations:
    apply_mask  -- composite the pipeline's processed canvas with the original
                   using a grayscale mask: output = mix(original, processed, mask.r)

  The mask canvas is fetched from MaskRegistry by maskId, or accepted directly
  as params.mask (a love.Canvas or love.Image).
]]

local Imaging      = require("lua.imaging")
local ShaderCache  = require("lua.imaging.shader_cache")
local MaskRegistry = require("lua.imaging.mask_registry")

-- ============================================================================
-- apply_mask shader
-- ============================================================================
-- processed  = current canvas in the pipeline (post-ops)
-- original   = the canvas before any ops ran (injected via params)
-- mask       = grayscale canvas; 1.0 = fully processed, 0.0 = fully original

local applyMaskShader = [[
  extern Image original;
  extern Image mask;

  vec4 effect(vec4 color, Image processed, vec2 tc, vec2 sc) {
    vec4 orig = Texel(original, tc);
    vec4 proc = Texel(processed, tc);
    float w   = Texel(mask, tc).r;
    return mix(orig, proc, w) * color;
  }
]]

Imaging.registerOp("apply_mask", {
  gpu = function(canvas, w, h, params)
    local original = params.original
    local mask     = params.mask

    -- Accept maskId as an alternative to a direct canvas reference
    if not mask and params.maskId then
      mask = MaskRegistry.get(params.maskId)
    end

    if not original then
      io.write("[apply_mask] params.original is required\n"); io.flush()
      return canvas
    end
    if not mask then
      io.write("[apply_mask] params.mask or params.maskId is required\n"); io.flush()
      return canvas
    end

    local shader = ShaderCache.get("apply_mask", applyMaskShader)
    if not shader then return canvas end

    local output = love.graphics.newCanvas(w, h)
    love.graphics.push("all")
    love.graphics.setCanvas(output)
    love.graphics.clear(0, 0, 0, 0)
    love.graphics.setColor(1, 1, 1, 1)

    shader:send("original", original)
    shader:send("mask",     mask)
    love.graphics.setShader(shader)
    love.graphics.draw(canvas, 0, 0)
    love.graphics.setShader()
    love.graphics.pop()

    return output
  end,
})
