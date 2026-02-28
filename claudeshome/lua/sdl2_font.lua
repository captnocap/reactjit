--[[
  sdl2_font.lua -- FreeType glyph rasterizer + texture atlas
  Framework version of experiments/sdl2-painter/font.lua.
  Loads ft_helper.so from lib/ (placed there by reactjit update / make cli-setup).

  Performance: All glyphs for a given font size are packed into a single GL
  texture atlas. Font.draw() issues one glEnable + glBindTexture + glBegin/glEnd
  per call instead of per-glyph, cutting GL state changes by ~6x per character.
]]
local ffi = require("ffi")
local GL  = require("lua.sdl2_gl")

ffi.cdef[[
  int  ft_init(void);
  void ft_done(void);
  int  ft_load_font(const char *path);
  int  ft_set_size(int pixel_height);
  int  ft_render_char(unsigned long charcode,
                      int *out_w, int *out_h,
                      int *out_left, int *out_top,
                      int *out_advance_x,
                      int *out_buffer_len,
                      unsigned char **out_buffer);
  void ft_free_buffer(unsigned char *buf);
  int  ft_get_line_height(void);
  int  ft_get_ascender(void);
  int  ft_measure_text_utf8(const char *text, int byte_len);
  int  ft_wrap_text_utf8(const char *text, int byte_len, int max_width,
                         char **out_buf, int *out_buf_len);
]]

local loader = require("lua.lib_loader")
local ft = loader.load("ft_helper")

local Font = {}

-- Per-size atlas: { texId, width, height, cursorX, cursorY, rowHeight, glyphs={} }
-- glyphs[codepoint] = { u0,v0,u1,v1, w,h, left,top, advance }
local atlases     = {}
local currentSize = nil

local ATLAS_SIZE = 1024  -- 1024x1024 atlas texture

local FONT_CANDIDATES = {
  -- Project-local bundled font (full Latin/Cyrillic/Greek/Unicode coverage)
  "fonts/base/NotoSans-Regular.ttf",
  -- macOS system fonts
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/SFNSText.ttf",
  "/System/Library/Fonts/SFNS.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
  -- Debian/Ubuntu paths
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
  "/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf",
  -- Alpine Linux paths
  "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  -- Arch Linux paths
  "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  -- Generic fallbacks
  "/usr/share/fonts/LiberationSans-Regular.ttf",
  "/usr/share/fonts/DejaVuSans.ttf",
}

local function findFont(fontFamily)
  if fontFamily then
    local f = io.open(fontFamily, "r")
    if f then f:close(); return fontFamily end
  end
  for _, p in ipairs(FONT_CANDIDATES) do
    local f = io.open(p, "r")
    if f then f:close(); return p end
  end
  error("[sdl2_font] No suitable font found.")
end

function Font.init(fontFamily)
  local err = ft.ft_init()
  if err ~= 0 then error("[sdl2_font] FreeType init failed: " .. err) end
  local path = findFont(fontFamily)
  err = ft.ft_load_font(path)
  if err ~= 0 then error("[sdl2_font] Load failed (" .. err .. "): " .. path) end
end

local function ensureSize(size)
  if currentSize == size then return end
  ft.ft_set_size(size)
  currentSize = size
end

-- Create a new atlas page for a given font size (RGBA format for Mesa compat)
local function createAtlas(size)
  local ids = ffi.new("unsigned int[1]")
  GL.glGenTextures(1, ids)
  local texId = ids[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 4)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.RGBA,
                  ATLAS_SIZE, ATLAS_SIZE, 0, GL.RGBA, GL.UNSIGNED_BYTE, nil)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  local atlas = {
    texId     = texId,
    cursorX   = 1,  -- 1px padding from edge to avoid bleed
    cursorY   = 1,
    rowHeight = 0,
    glyphs    = {},
  }
  return atlas
end

local function getAtlas(size)
  if not atlases[size] then
    atlases[size] = createAtlas(size)
  end
  return atlases[size]
end

local PAD = 1  -- 1px padding between glyphs to prevent bleed

local function utf8next(s, i)
  local c = s:byte(i)
  if not c then return nil, 0 end
  local cp, len
  if     c < 0x80 then cp = c;                    len = 1
  elseif c < 0xE0 then cp = bit.band(c, 0x1F);   len = 2
  elseif c < 0xF0 then cp = bit.band(c, 0x0F);   len = 3
  else                  cp = bit.band(c, 0x07);   len = 4
  end
  for j = 1, len - 1 do
    local nb = s:byte(i + j) or 0x80
    cp = bit.bor(bit.lshift(cp, 6), bit.band(nb, 0x3F))
  end
  return cp, len
end

-- Reusable FFI buffers for ft_render_char to avoid per-call allocations
local _ow   = ffi.new("int[1]")
local _oh   = ffi.new("int[1]")
local _ol   = ffi.new("int[1]")
local _ot   = ffi.new("int[1]")
local _oa   = ffi.new("int[1]")
local _obl  = ffi.new("int[1]")
local _obuf = ffi.new("unsigned char*[1]")

local function loadGlyph(size, cp)
  local atlas = getAtlas(size)
  local g = atlas.glyphs[cp]
  if g then return g end

  ensureSize(size)
  local ok = ft.ft_render_char(cp, _ow, _oh, _ol, _ot, _oa, _obl, _obuf)

  g = { u0=0, v0=0, u1=0, v1=0, w=0, h=0, left=0, top=0, advance=0, hasPixels=false }

  if ok ~= 0 then
    g.left    = _ol[0]
    g.top     = _ot[0]
    g.advance = _oa[0]
    g.w       = _ow[0]
    g.h       = _oh[0]

    if g.w > 0 and g.h > 0 then
      -- Check if glyph fits in current row
      if atlas.cursorX + g.w + PAD > ATLAS_SIZE then
        -- Move to next row
        atlas.cursorX = 1
        atlas.cursorY = atlas.cursorY + atlas.rowHeight + PAD
        atlas.rowHeight = 0
      end

      if atlas.cursorY + g.h + PAD <= ATLAS_SIZE then
        -- Expand alpha bitmap to RGBA (white + alpha) for Mesa compat
        local pixelCount = g.w * g.h
        local rgbaBuf = ffi.new("unsigned char[?]", pixelCount * 4)
        local src = _obuf[0]
        for pi = 0, pixelCount - 1 do
          local off = pi * 4
          rgbaBuf[off]     = 255       -- R
          rgbaBuf[off + 1] = 255       -- G
          rgbaBuf[off + 2] = 255       -- B
          rgbaBuf[off + 3] = src[pi]   -- A from glyph
        end

        -- Upload RGBA glyph into atlas
        GL.glBindTexture(GL.TEXTURE_2D, atlas.texId)
        GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 4)
        GL.glTexSubImage2D(GL.TEXTURE_2D, 0,
                           atlas.cursorX, atlas.cursorY,
                           g.w, g.h,
                           GL.RGBA, GL.UNSIGNED_BYTE, rgbaBuf)
        GL.glBindTexture(GL.TEXTURE_2D, 0)

        -- Compute UV coordinates
        local invW = 1 / ATLAS_SIZE
        local invH = 1 / ATLAS_SIZE
        g.u0 = atlas.cursorX * invW
        g.v0 = atlas.cursorY * invH
        g.u1 = (atlas.cursorX + g.w) * invW
        g.v1 = (atlas.cursorY + g.h) * invH
        g.hasPixels = true

        -- Advance cursor
        atlas.cursorX = atlas.cursorX + g.w + PAD
        if g.h > atlas.rowHeight then atlas.rowHeight = g.h end
      end

      ft.ft_free_buffer(_obuf[0])
    end
  end

  atlas.glyphs[cp] = g
  return g
end

function Font.draw(text, x, y, size, r, g, b, a)
  if #text == 0 then return end
  ensureSize(size)
  local atlas = getAtlas(size)
  local ascender  = ft.ft_get_ascender()
  local baselineY = y + ascender

  -- Pre-load all glyphs BEFORE glBegin (loadGlyph uses GL calls that are
  -- illegal inside glBegin/glEnd — glBindTexture, glTexSubImage2D, etc.)
  do
    local j = 1
    while j <= #text do
      local cp, len = utf8next(text, j)
      if not cp then break end
      loadGlyph(size, cp)
      j = j + len
    end
  end

  -- Single bind + batched draw for the entire text string
  GL.glEnable(GL.TEXTURE_2D)
  GL.glBindTexture(GL.TEXTURE_2D, atlas.texId)
  GL.glColor4f(r, g, b, a)
  GL.glBegin(GL.QUADS)

  local cx = x
  local i  = 1
  while i <= #text do
    local cp, len = utf8next(text, i)
    if not cp then break end
    local gi = atlas.glyphs[cp]  -- already loaded above
    if gi and gi.hasPixels then
      local gx = cx + gi.left
      local gy = baselineY - gi.top
      GL.glTexCoord2f(gi.u0, gi.v0); GL.glVertex2f(gx,        gy)
      GL.glTexCoord2f(gi.u1, gi.v0); GL.glVertex2f(gx + gi.w, gy)
      GL.glTexCoord2f(gi.u1, gi.v1); GL.glVertex2f(gx + gi.w, gy + gi.h)
      GL.glTexCoord2f(gi.u0, gi.v1); GL.glVertex2f(gx,        gy + gi.h)
    end
    if gi then cx = cx + gi.advance end
    i  = i + len
  end

  GL.glEnd()
  GL.glBindTexture(GL.TEXTURE_2D, 0)
  GL.glDisable(GL.TEXTURE_2D)
end

--- Push text glyphs into an external quad batcher instead of issuing GL calls.
--- addQuad(texId, x, y, w, h, u0, v0, u1, v1, r, g, b, a)
--- All glyphs for a given font size share one atlas texture, so consecutive
--- text draws at the same size batch into a single GL draw call.
function Font.drawBatched(text, x, y, size, r, g, b, a, addQuad)
  if #text == 0 then return end
  ensureSize(size)
  local atlas = getAtlas(size)
  local ascender  = ft.ft_get_ascender()
  local baselineY = y + ascender

  -- Pre-load all glyphs (may trigger GL texture uploads)
  do
    local j = 1
    while j <= #text do
      local cp, len = utf8next(text, j)
      if not cp then break end
      loadGlyph(size, cp)
      j = j + len
    end
  end

  -- Push each glyph as a textured quad into the external batcher
  local texId = atlas.texId
  local cx = x
  local i  = 1
  while i <= #text do
    local cp, len = utf8next(text, i)
    if not cp then break end
    local gi = atlas.glyphs[cp]
    if gi and gi.hasPixels then
      local gx = cx + gi.left
      local gy = baselineY - gi.top
      addQuad(texId, gx, gy, gi.w, gi.h, gi.u0, gi.v0, gi.u1, gi.v1, r, g, b, a)
    end
    if gi then cx = cx + gi.advance end
    i = i + len
  end
end

-- Reusable FFI buffers for ft_wrap_text_utf8
local _wrapBuf = ffi.new("char*[1]")
local _wrapLen = ffi.new("int[1]")

function Font.wrapText(text, size, maxWidth)
  ensureSize(size)
  local numLines = ft.ft_wrap_text_utf8(text, #text, maxWidth, _wrapBuf, _wrapLen)
  if numLines <= 0 or _wrapBuf[0] == nil then
    return { "" }
  end
  local lines = {}
  local buf = _wrapBuf[0]
  local bufLen = _wrapLen[0]
  local start = 0
  for i = 0, bufLen - 1 do
    if buf[i] == 0 then
      lines[#lines + 1] = ffi.string(buf + start, i - start)
      start = i + 1
    end
  end
  ft.ft_free_buffer(ffi.cast("unsigned char*", buf))
  if #lines == 0 then lines[1] = "" end
  return lines
end

function Font.measureWidth(text, size)
  ensureSize(size)
  return ft.ft_measure_text_utf8(text, #text)
end

function Font.lineHeight(size)
  ensureSize(size)
  return ft.ft_get_line_height()
end

function Font.ascender(size)
  ensureSize(size)
  return ft.ft_get_ascender()
end

function Font.descent(size)
  ensureSize(size)
  return ft.ft_get_line_height() - ft.ft_get_ascender()
end

function Font.done()
  ft.ft_done()
end

return Font
