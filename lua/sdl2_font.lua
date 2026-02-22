--[[
  sdl2_font.lua -- FreeType glyph rasterizer + per-glyph GL texture cache
  Framework version of experiments/sdl2-painter/font.lua.
  Loads ft_helper.so from lib/ (placed there by reactjit update / make cli-setup).
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
]]

local loader = require("lua.lib_loader")
local ft = loader.load("ft_helper")

local Font = {}

local cache       = {}
local currentSize = nil

local FONT_CANDIDATES = {
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
  print("[sdl2_font] loaded: " .. path)
end

local function ensureSize(size)
  if currentSize == size then return end
  ft.ft_set_size(size)
  currentSize = size
  if not cache[size] then cache[size] = {} end
end

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

local function loadGlyph(size, cp)
  local sc = cache[size]
  if sc[cp] then return sc[cp] end

  local ow   = ffi.new("int[1]")
  local oh   = ffi.new("int[1]")
  local ol   = ffi.new("int[1]")
  local ot   = ffi.new("int[1]")
  local oa   = ffi.new("int[1]")
  local obl  = ffi.new("int[1]")
  local obuf = ffi.new("unsigned char*[1]")

  local ok = ft.ft_render_char(cp, ow, oh, ol, ot, oa, obl, obuf)

  local g = { texId = 0, w = 0, h = 0, left = 0, top = 0, advance = 0 }

  if ok ~= 0 then
    g.left    = ol[0]
    g.top     = ot[0]
    g.advance = oa[0]
    g.w       = ow[0]
    g.h       = oh[0]

    if g.w > 0 and g.h > 0 then
      local ids = ffi.new("unsigned int[1]")
      GL.glGenTextures(1, ids)
      g.texId = ids[0]
      GL.glBindTexture(GL.TEXTURE_2D, g.texId)
      GL.glPixelStorei(GL.UNPACK_ALIGNMENT, 1)
      GL.glTexImage2D(GL.TEXTURE_2D, 0, GL.ALPHA,
                      g.w, g.h, 0, GL.ALPHA, GL.UNSIGNED_BYTE, obuf[0])
      GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
      GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
      GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
      GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
      GL.glBindTexture(GL.TEXTURE_2D, 0)
      ft.ft_free_buffer(obuf[0])
    end
  end

  sc[cp] = g
  return g
end

function Font.draw(text, x, y, size, r, g, b, a)
  ensureSize(size)
  local ascender  = ft.ft_get_ascender()
  local baselineY = y + ascender
  local cx = x
  local i  = 1
  while i <= #text do
    local cp, len = utf8next(text, i)
    if not cp then break end
    local gi = loadGlyph(size, cp)
    if gi.texId ~= 0 then
      local gx, gy = cx + gi.left, baselineY - gi.top
      GL.glEnable(GL.TEXTURE_2D)
      GL.glBindTexture(GL.TEXTURE_2D, gi.texId)
      GL.glColor4f(r, g, b, a)
      GL.glBegin(GL.TRIANGLE_STRIP)
        GL.glTexCoord2f(0,0); GL.glVertex2f(gx,         gy)
        GL.glTexCoord2f(1,0); GL.glVertex2f(gx + gi.w,  gy)
        GL.glTexCoord2f(0,1); GL.glVertex2f(gx,         gy + gi.h)
        GL.glTexCoord2f(1,1); GL.glVertex2f(gx + gi.w,  gy + gi.h)
      GL.glEnd()
      GL.glBindTexture(GL.TEXTURE_2D, 0)
      GL.glDisable(GL.TEXTURE_2D)
    end
    cx = cx + gi.advance
    i  = i + len
  end
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

function Font.done()
  ft.ft_done()
end

return Font
