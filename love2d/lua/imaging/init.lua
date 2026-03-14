--[[
  imaging/init.lua — GIMP-style image processing library

  Pure Lua module for image manipulation using Love2D's Canvas and shader APIs.
  Hybrid GPU/CPU: operations use GLSL shaders by default, with CPU fallback
  via ImageData when needed.

  Usage (pipeline — lazy, chainable):
    local Imaging = require("lua.imaging")
    local result = Imaging.from("photo.jpg")
      :brightness(0.2)
      :contrast(1.5)
      :gaussianBlur(3)
      :apply()

  Usage (immediate — single operation):
    local result = Imaging.brightness(canvas, 0.2)

  Usage (from existing canvas):
    local result = Imaging.fromCanvas(canvas)
      :invert()
      :apply()
]]

local Pipeline = require("lua.imaging.pipeline")

local Imaging = {}

-- Break circular require during op loading:
-- ops/*.lua require("lua.imaging") to call Imaging.registerOp(...).
-- Publish the module table early so those requires resolve to this table.
package.loaded["lua.imaging"] = Imaging

-- Operation registry: name -> { gpu = fn(canvas, w, h, params), cpu = fn(canvas, w, h, params) }
local ops = {}

-- ============================================================================
-- Operation registration
-- ============================================================================

--- Register an operation with GPU and/or CPU implementations.
--- @param name string  Operation name (e.g. "brightness")
--- @param def table  { gpu = function(canvas, w, h, params) -> canvas, cpu = function(canvas, w, h, params) -> canvas }
function Imaging.registerOp(name, def)
  assert(name, "Imaging.registerOp: name required")
  assert(type(def) == "table", "Imaging.registerOp: def must be a table")
  assert(def.gpu or def.cpu, "Imaging.registerOp: need at least gpu or cpu implementation")
  ops[name] = def
end

--- Get the operation registry (used by Pipeline:apply).
--- @return table
function Imaging.getOps()
  return ops
end

--- List all registered operations.
--- @return table  Array of operation names
function Imaging.listOps()
  local result = {}
  for name in pairs(ops) do
    result[#result + 1] = name
  end
  table.sort(result)
  return result
end

-- ============================================================================
-- Pipeline constructors
-- ============================================================================

--- Create a pipeline from an image file path.
--- @param src string  Image file path
--- @return Pipeline
function Imaging.from(src)
  local image = love.graphics.newImage(src)
  local w, h = image:getWidth(), image:getHeight()
  local canvas = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(image, 0, 0)
  love.graphics.pop()
  image:release()

  local p = Pipeline.new(canvas)
  -- Bind the registry so Pipeline:apply() can find operations
  local origApply = p.apply
  function p:apply()
    return origApply(self, ops)
  end
  local origPreview = p.preview
  function p:preview(scale)
    return origPreview(self, ops, scale)
  end
  return p
end

--- Create a pipeline from an existing Canvas.
--- @param canvas love.Canvas
--- @return Pipeline
function Imaging.fromCanvas(canvas)
  local p = Pipeline.new(canvas)
  local origApply = p.apply
  function p:apply()
    return origApply(self, ops)
  end
  local origPreview = p.preview
  function p:preview(scale)
    return origPreview(self, ops, scale)
  end
  return p
end

--- Create a pipeline from ImageData (CPU pixel buffer).
--- @param imageData love.ImageData
--- @return Pipeline
function Imaging.fromImageData(imageData)
  local image = love.graphics.newImage(imageData)
  local w, h = image:getWidth(), image:getHeight()
  local canvas = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(image, 0, 0)
  love.graphics.pop()
  image:release()

  local p = Pipeline.new(canvas)
  local origApply = p.apply
  function p:apply()
    return origApply(self, ops)
  end
  local origPreview = p.preview
  function p:preview(scale)
    return origPreview(self, ops, scale)
  end
  return p
end

-- ============================================================================
-- Immediate-mode API (single operation, returns new canvas)
-- ============================================================================

--- Apply a single operation immediately.
--- @param opName string  Operation name
--- @param canvas love.Canvas  Input canvas
--- @param ... any  Operation parameters (passed as the params table)
--- @return love.Canvas  Result canvas
function Imaging.apply(opName, canvas, params)
  local opDef = ops[opName]
  if not opDef then
    error("Imaging.apply: unknown operation '" .. tostring(opName) .. "'")
  end
  local fn = opDef.gpu or opDef.cpu
  local w = canvas:getWidth()
  local h = canvas:getHeight()
  return fn(canvas, w, h, params or {})
end

-- ============================================================================
-- Immediate convenience functions
-- ============================================================================

-- These are generated dynamically after ops are loaded.
-- Call Imaging.brightness(canvas, 0.2) -> Imaging.apply("brightness", canvas, { amount = 0.2 })

-- ============================================================================
-- Canvas utilities
-- ============================================================================

--- Create a new blank canvas.
--- @param w number  Width
--- @param h number  Height
--- @param r number  Fill color red (0-1, default 0)
--- @param g number  Fill color green (0-1, default 0)
--- @param b number  Fill color blue (0-1, default 0)
--- @param a number  Fill color alpha (0-1, default 1)
--- @return love.Canvas
function Imaging.newCanvas(w, h, r, g, b, a)
  local canvas = love.graphics.newCanvas(w, h)
  love.graphics.push("all")
  love.graphics.setCanvas(canvas)
  love.graphics.clear(r or 0, g or 0, b or 0, a or 1)
  love.graphics.pop()
  return canvas
end

--- Convert a Canvas to ImageData (for CPU operations or saving).
--- @param canvas love.Canvas
--- @return love.ImageData
function Imaging.toImageData(canvas)
  return canvas:newImageData()
end

--- Save a canvas to file.
--- @param canvas love.Canvas
--- @param path string  Output file path
--- @param format string  "png" or "jpg" (default "png")
function Imaging.save(canvas, path, format)
  local data = canvas:newImageData()
  local fileData = data:encode(format or "png")
  love.filesystem.write(path, fileData)
  data:release()
end

-- ============================================================================
-- Auto-load operations
-- ============================================================================

function Imaging.loadOps()
  local opFiles = {
    "color",
    "filter",
    "blend",
    "mask",
    "detect",
    "flood_detect",
  }
  for _, name in ipairs(opFiles) do
    local ok, err = pcall(require, "lua.imaging.ops." .. name)
    if not ok then
      io.write("[imaging] WARNING: failed to load ops." .. name .. ": " .. tostring(err) .. "\n")
      io.flush()
    end
  end
end

-- Load operations on require
Imaging.loadOps()

return Imaging
