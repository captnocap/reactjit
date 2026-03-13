--[[
  sprites.lua — Sprite atlas registry and quad-based frame rendering

  Manages sprite sheet atlases for themed UI elements. Each atlas is a grid
  of uniform-sized frames that can be rendered by index or named key.

  Used by the painter when a "Sprite" node type is encountered, and by the
  theme system to swap sprite sets on theme change.

  Usage from React:
    <ThemeSprite atlas="icons" frame="arrow-right" style={{ width: 24, height: 24 }} />

  The React component sends props: src, cols, rows, frameWidth, frameHeight, frameIndex
  The painter calls Sprites.draw() with these values.
]]

local Sprites = {}

-- Cached images: src path -> Love2D Image
local imageCache = {}

-- Cached quads: "src:col:row:fw:fh" -> Love2D Quad
local quadCache = {}

--- Load or retrieve a cached image.
--- @param src string  Path to the sprite sheet image
--- @return love.Image|nil
local function getImage(src)
  if imageCache[src] then return imageCache[src] end
  local ok, img = pcall(love.graphics.newImage, src)
  if ok and img then
    img:setFilter("nearest", "nearest")
    imageCache[src] = img
    return img
  end
  return nil
end

--- Get or create a quad for a specific frame in an atlas.
--- @param src string  Image path (for cache key)
--- @param frameIndex number  0-based frame index
--- @param cols number  Grid columns
--- @param rows number  Grid rows
--- @param fw number  Frame width in pixels
--- @param fh number  Frame height in pixels
--- @param imgW number  Total image width
--- @param imgH number  Total image height
--- @return love.Quad|nil
local function getQuad(src, frameIndex, cols, rows, fw, fh, imgW, imgH)
  local key = src .. ":" .. frameIndex .. ":" .. cols .. ":" .. rows
  if quadCache[key] then return quadCache[key] end

  local col = frameIndex % cols
  local row = math.floor(frameIndex / cols)
  if row >= rows then return nil end

  local quad = love.graphics.newQuad(col * fw, row * fh, fw, fh, imgW, imgH)
  quadCache[key] = quad
  return quad
end

--- Draw a sprite frame at the given position and size.
--- @param src string  Path to sprite sheet
--- @param frameIndex number  0-based frame index
--- @param cols number  Grid columns
--- @param rows number  Grid rows
--- @param fw number  Frame width in pixels
--- @param fh number  Frame height in pixels
--- @param x number  Draw x position
--- @param y number  Draw y position
--- @param w number  Draw width
--- @param h number  Draw height
--- @param opacity number  Opacity 0-1
function Sprites.draw(src, frameIndex, cols, rows, fw, fh, x, y, w, h, opacity)
  local img = getImage(src)
  if not img then return end

  local imgW, imgH = img:getDimensions()
  local quad = getQuad(src, frameIndex, cols, rows, fw, fh, imgW, imgH)
  if not quad then return end

  local sx = w / fw
  local sy = h / fh

  love.graphics.setColor(1, 1, 1, opacity or 1)
  love.graphics.draw(img, quad, x, y, 0, sx, sy)
end

--- Clear all cached images and quads (call on theme change if sprite sheets differ).
function Sprites.clearCache()
  imageCache = {}
  quadCache = {}
end

--- Check if a node type is a Sprite.
--- @param typeName string
--- @return boolean
function Sprites.isSprite(typeName)
  return typeName == "Sprite"
end

return Sprites
