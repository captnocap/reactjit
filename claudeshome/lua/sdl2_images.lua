--[[
  sdl2_images.lua -- Image loading, caching, and GL texture management (SDL2 target)

  Uses image_helper.so (stb_image wrapper) to load images into RGBA8 pixel
  buffers, then uploads them as GL textures. Keeps the raw pixel buffer
  available for processing (flood fill, segmentation, etc.).

  API mirrors lua/images.lua (Love2D) so the painter can use the same interface.
]]
local ffi = require("ffi")
local GL  = require("lua.sdl2_gl")

ffi.cdef[[
  unsigned char *image_load(const char *path, int *out_w, int *out_h, int *out_channels);
  void image_free(unsigned char *data);
]]

local loader = require("lua.lib_loader")
local img_lib = loader.load("image_helper")

local Images = {}

-- ============================================================================
-- Cache
-- ============================================================================

local cache     = {}   -- path → { texId, w, h, pixels }
local refCounts = {}   -- path → int

-- Pre-allocated FFI output buffers (reused across loads)
local _ow = ffi.new("int[1]")
local _oh = ffi.new("int[1]")
local _oc = ffi.new("int[1]")
local _texIds = ffi.new("unsigned int[1]")

-- ============================================================================
-- Internal helpers
-- ============================================================================

local function createTexture(pixels, w, h)
  GL.glGenTextures(1, _texIds)
  local texId = _texIds[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 1)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA, w, h, 0,
                  GL.RGBA, GL.UNSIGNED_BYTE, pixels)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  return texId
end

local function deleteTexture(texId)
  _texIds[0] = texId
  GL.glDeleteTextures(1, _texIds)
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Return a cached image entry, loading on first access.
--- Does NOT modify ref counts — safe to call every frame from the painter.
--- @param src string  Path to image file
--- @return table|nil  { texId, w, h, pixels }
function Images.get(src)
  if not src or src == "" then return nil end
  if cache[src] then return cache[src] end

  -- Load via stb_image (force RGBA)
  local pixels = img_lib.image_load(src, _ow, _oh, _oc)
  if pixels == nil then
    io.write("[sdl2_images] Failed to load: " .. tostring(src) .. "\n")
    io.flush()
    return nil
  end

  local w = _ow[0]
  local h = _oh[0]

  -- Upload to GL texture
  local texId = createTexture(pixels, w, h)

  local entry = {
    texId  = texId,
    w      = w,
    h      = h,
    pixels = pixels,  -- uint8_t*, RGBA, (y * w + x) * 4
  }

  cache[src] = entry
  refCounts[src] = refCounts[src] or 0
  return entry
end

--- Load an image and increment its reference count.
--- Call once per Image node that uses this src (e.g. on tree CREATE).
function Images.load(src)
  local entry = Images.get(src)
  if entry then
    refCounts[src] = (refCounts[src] or 0) + 1
  end
  return entry
end

--- Decrement reference count and free resources if no longer needed.
function Images.unload(src)
  if not src or not refCounts[src] then return end

  refCounts[src] = refCounts[src] - 1

  if refCounts[src] <= 0 then
    local entry = cache[src]
    if entry then
      deleteTexture(entry.texId)
      img_lib.image_free(entry.pixels)
      cache[src] = nil
    end
    refCounts[src] = nil
  end
end

--- Get intrinsic dimensions of a loaded image.
--- @return number|nil, number|nil  width, height
function Images.getDimensions(src)
  local entry = cache[src]
  if entry then
    return entry.w, entry.h
  end
  return nil, nil
end

--- Get raw pixel buffer for an image (for processing algorithms).
--- @return ffi.cdata|nil, number, number  pixels (uint8_t*), width, height
function Images.getPixels(src)
  local entry = Images.get(src)
  if entry then
    return entry.pixels, entry.w, entry.h
  end
  return nil, 0, 0
end

--- Draw an image as a textured quad.
--- @param src string  Image path
--- @param x number    Destination X
--- @param y number    Destination Y
--- @param w number    Destination width
--- @param h number    Destination height
--- @param opacity number  Alpha multiplier (0–1)
function Images.draw(src, x, y, w, h, opacity)
  local entry = Images.get(src)
  if not entry then return end

  GL.glEnable(GL.TEXTURE_2D)
  GL.glEnable(GL.BLEND)
  GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
  GL.glBindTexture(GL.TEXTURE_2D, entry.texId)
  GL.glColor4f(1, 1, 1, opacity or 1)

  GL.glBegin(GL.QUADS)
    GL.glTexCoord2f(0, 0); GL.glVertex2f(x,     y)
    GL.glTexCoord2f(1, 0); GL.glVertex2f(x + w, y)
    GL.glTexCoord2f(1, 1); GL.glVertex2f(x + w, y + h)
    GL.glTexCoord2f(0, 1); GL.glVertex2f(x,     y + h)
  GL.glEnd()

  GL.glBindTexture(GL.TEXTURE_2D, 0)
  GL.glDisable(GL.TEXTURE_2D)
end

--- Draw a GL texture ID directly as a textured quad.
--- @param texId number  GL texture ID
--- @param x number
--- @param y number
--- @param w number
--- @param h number
--- @param opacity number
function Images.drawTexture(texId, x, y, w, h, opacity)
  GL.glEnable(GL.TEXTURE_2D)
  GL.glEnable(GL.BLEND)
  GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glColor4f(1, 1, 1, opacity or 1)

  GL.glBegin(GL.QUADS)
    GL.glTexCoord2f(0, 0); GL.glVertex2f(x,     y)
    GL.glTexCoord2f(1, 0); GL.glVertex2f(x + w, y)
    GL.glTexCoord2f(1, 1); GL.glVertex2f(x + w, y + h)
    GL.glTexCoord2f(0, 1); GL.glVertex2f(x,     y + h)
  GL.glEnd()

  GL.glBindTexture(GL.TEXTURE_2D, 0)
  GL.glDisable(GL.TEXTURE_2D)
end

--- Clear all cached images and free all resources.
function Images.clearCache()
  for src, entry in pairs(cache) do
    deleteTexture(entry.texId)
    img_lib.image_free(entry.pixels)
  end
  cache = {}
  refCounts = {}
end

return Images
