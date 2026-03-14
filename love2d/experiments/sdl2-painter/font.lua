--[[
  font.lua -- FreeType glyph rasterizer + per-glyph GL texture cache
  Each unique (size, codepoint) pair gets its own GL_ALPHA texture.
  For a production build this would use a packed atlas; for the POC
  individual textures are simpler to reason about.
]]
local ffi = require("ffi")
local GL  = require("gl")

-- FreeType helper (compiled from ft_helper.c → ft_helper.so)
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

-- Load from the same directory as this script
local script_dir = debug.getinfo(1, "S").source:match("@(.*/)") or "./"
local ft = ffi.load(script_dir .. "ft_helper.so")

local Font = {}

-- glyph cache: [size][charcode] = { texId, w, h, left, top, advance }
local cache       = {}
local currentSize = nil

local FONT_CANDIDATES = {
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
  "/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf",
}

local function findFont()
  for _, p in ipairs(FONT_CANDIDATES) do
    local f = io.open(p, "r")
    if f then f:close(); return p end
  end
  error("[font] No suitable font found. Install liberation-fonts or dejavu-fonts.")
end

function Font.init()
  local err = ft.ft_init()
  if err ~= 0 then error("[font] FreeType init failed: " .. err) end
  local path = findFont()
  err = ft.ft_load_font(path)
  if err ~= 0 then error("[font] FreeType load failed (" .. err .. "): " .. path) end
  print("[font] loaded: " .. path)
end

local function ensureSize(size)
  if currentSize == size then return end
  ft.ft_set_size(size)
  currentSize = size
  if not cache[size] then cache[size] = {} end
end

local function loadGlyph(size, cp)
  local sc = cache[size]
  if sc[cp] then return sc[cp] end

  local ow  = ffi.new("int[1]")
  local oh  = ffi.new("int[1]")
  local ol  = ffi.new("int[1]")
  local ot  = ffi.new("int[1]")
  local oa  = ffi.new("int[1]")
  local obl = ffi.new("int[1]")
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
                      g.w, g.h, 0,
                      GL.ALPHA, GL.UNSIGNED_BYTE, obuf[0])
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

-- Decode one UTF-8 codepoint from string s starting at byte index i.
-- Returns (codepoint, bytes_consumed).
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

--[[
  Draw a UTF-8 string.
  x, y   = top-left of the text box (y is the top, baseline is offset by ascender)
  size   = font size in pixels
  r,g,b,a = color
]]
function Font.draw(text, x, y, size, r, g, b, a)
  ensureSize(size)
  local ascender = ft.ft_get_ascender()
  local baselineY = y + ascender
  local cx = x
  local i  = 1
  while i <= #text do
    local cp, len = utf8next(text, i)
    if not cp then break end

    local g_info = loadGlyph(size, cp)
    if g_info.texId ~= 0 then
      local gx = cx + g_info.left
      local gy = baselineY - g_info.top
      local gw = g_info.w
      local gh = g_info.h
      GL.glEnable(GL.TEXTURE_2D)
      GL.glBindTexture(GL.TEXTURE_2D, g_info.texId)
      GL.glColor4f(r, g, b, a)
      GL.glBegin(GL.TRIANGLE_STRIP)
        GL.glTexCoord2f(0, 0); GL.glVertex2f(gx,      gy)
        GL.glTexCoord2f(1, 0); GL.glVertex2f(gx + gw, gy)
        GL.glTexCoord2f(0, 1); GL.glVertex2f(gx,      gy + gh)
        GL.glTexCoord2f(1, 1); GL.glVertex2f(gx + gw, gy + gh)
      GL.glEnd()
      GL.glBindTexture(GL.TEXTURE_2D, 0)
      GL.glDisable(GL.TEXTURE_2D)
    end

    cx = cx + g_info.advance
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
