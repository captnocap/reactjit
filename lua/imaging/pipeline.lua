--[[
  imaging/pipeline.lua — Chainable image processing pipeline

  Queues operations for lazy execution. Operations are applied in order
  when :apply() is called, returning a final Canvas.

  Usage:
    local Pipeline = require("lua.imaging.pipeline")
    local p = Pipeline.new(sourceCanvas)
    p:op("brightness", { amount = 0.2 })
     :op("gaussian_blur", { radius = 3 })
     :apply()  -- returns Canvas
]]

local Pipeline = {}
Pipeline.__index = Pipeline

--- Create a new pipeline from a source canvas.
--- @param source love.Canvas  The input canvas
--- @return Pipeline
function Pipeline.new(source)
  local self = setmetatable({}, Pipeline)
  self.source = source
  self.ops = {}
  return self
end

--- Queue an operation.
--- @param name string  Operation name (e.g. "brightness", "gaussian_blur")
--- @param params table  Operation parameters
--- @return Pipeline  self (for chaining)
function Pipeline:op(name, params)
  self.ops[#self.ops + 1] = { name = name, params = params or {} }
  return self
end

-- Convenience chainable methods for all operations.
-- Each one queues the named op with the given params.

function Pipeline:brightness(amount) return self:op("brightness", { amount = amount }) end
function Pipeline:contrast(factor) return self:op("contrast", { factor = factor }) end
function Pipeline:levels(inBlack, inWhite, gamma, outBlack, outWhite)
  return self:op("levels", { inBlack = inBlack, inWhite = inWhite, gamma = gamma, outBlack = outBlack, outWhite = outWhite })
end
function Pipeline:curves(points) return self:op("curves", { points = points }) end
function Pipeline:hueSaturation(hue, saturation, value)
  return self:op("hue_saturation", { hue = hue, saturation = saturation, value = value })
end
function Pipeline:invert() return self:op("invert", {}) end
function Pipeline:threshold(level) return self:op("threshold", { level = level }) end
function Pipeline:posterize(levels) return self:op("posterize", { levels = levels }) end
function Pipeline:desaturate(method) return self:op("desaturate", { method = method or "luminosity" }) end
function Pipeline:colorize(hue, saturation, lightness)
  return self:op("colorize", { hue = hue, saturation = saturation, lightness = lightness })
end
function Pipeline:channelMixer(matrix) return self:op("channel_mixer", { matrix = matrix }) end
function Pipeline:gradientMap(gradient) return self:op("gradient_map", { gradient = gradient }) end

-- Filters
function Pipeline:gaussianBlur(radius) return self:op("gaussian_blur", { radius = radius }) end
function Pipeline:boxBlur(radius) return self:op("box_blur", { radius = radius }) end
function Pipeline:motionBlur(angle, distance) return self:op("motion_blur", { angle = angle, distance = distance }) end
function Pipeline:sharpen(amount) return self:op("sharpen", { amount = amount }) end
function Pipeline:edgeDetect(method) return self:op("edge_detect", { method = method or "sobel" }) end
function Pipeline:emboss(angle, depth) return self:op("emboss", { angle = angle, depth = depth }) end
function Pipeline:pixelize(size) return self:op("pixelize", { size = size }) end

-- Blend
function Pipeline:blend(mode, layer, opacity)
  return self:op("blend", { mode = mode, layer = layer, opacity = opacity or 1.0 })
end

--- Execute all queued operations and return the final canvas.
--- The registry is passed in by the Imaging module (avoids circular require).
--- @param registry table  Operation registry { name -> { gpu=fn, cpu=fn } }
--- @return love.Canvas  The processed result
function Pipeline:apply(registry)
  local current = self.source
  local w = current:getWidth()
  local h = current:getHeight()

  for i, step in ipairs(self.ops) do
    local opDef = registry[step.name]
    if not opDef then
      io.write("[imaging:pipeline] Unknown operation: " .. step.name .. "\n")
      io.flush()
    else
      -- Try GPU first, fall back to CPU
      local fn = opDef.gpu or opDef.cpu
      if fn then
        local ok, result = pcall(fn, current, w, h, step.params)
        if ok and result then
          -- Release intermediate canvases (but not the original source)
          if current ~= self.source and i > 1 then
            current:release()
          end
          current = result
        else
          io.write("[imaging:pipeline] Op '" .. step.name .. "' failed: " .. tostring(result) .. "\n")
          io.flush()
          -- Try CPU fallback if GPU failed
          if fn == opDef.gpu and opDef.cpu then
            local ok2, result2 = pcall(opDef.cpu, current, w, h, step.params)
            if ok2 and result2 then
              if current ~= self.source and i > 1 then
                current:release()
              end
              current = result2
            end
          end
        end
      end
    end
  end

  return current
end

--- Execute pipeline at reduced resolution for preview.
--- @param registry table  Operation registry
--- @param scale number  Scale factor (e.g. 0.5 for half resolution)
--- @return love.Canvas  Preview result
function Pipeline:preview(registry, scale)
  scale = scale or 0.5
  local w = math.floor(self.source:getWidth() * scale)
  local h = math.floor(self.source:getHeight() * scale)

  -- Downscale source
  local small = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(small)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(self.source, 0, 0, 0, scale, scale)
  love.graphics.pop()

  -- Run pipeline on small canvas
  local preview = Pipeline.new(small)
  preview.ops = self.ops
  local result = preview:apply(registry)

  if small ~= result then
    small:release()
  end

  return result
end

return Pipeline
