--[[
  CartridgeOS — main.lua
  Boots directly into iLoveReact on KMS/DRM.
  No X11. No Wayland. No display server.
  Just: kernel → SDL2 (kmsdrm) → OpenGL → LuaJIT → this.
]]

-- /app/ contains gl.lua, font.lua, ft_helper.so
package.path = "/app/?.lua;" .. package.path

local ffi = require("ffi")
local bit = require("bit")

-- ── SDL2 FFI ──────────────────────────────────────────────────────────────────

ffi.cdef[[
  typedef union { uint32_t type; uint8_t padding[56]; } SDL2_Event;
  typedef void SDL_Window;
  typedef void *SDL_GLContext;

  int           SDL_Init(uint32_t flags);
  void          SDL_Quit(void);
  SDL_Window   *SDL_CreateWindow(const char *title, int x, int y,
                                  int w, int h, uint32_t flags);
  void          SDL_DestroyWindow(SDL_Window *win);
  int           SDL_GL_SetAttribute(int attr, int value);
  SDL_GLContext SDL_GL_CreateContext(SDL_Window *win);
  void          SDL_GL_DeleteContext(SDL_GLContext ctx);
  void          SDL_GL_SwapWindow(SDL_Window *win);
  int           SDL_PollEvent(SDL2_Event *event);
  uint32_t      SDL_GetTicks(void);
  void          SDL_Delay(uint32_t ms);
  const char   *SDL_GetError(void);
  void          SDL_GL_GetDrawableSize(SDL_Window *win, int *w, int *h);
]]

local sdl = ffi.load("SDL2")

local SDL_INIT_VIDEO        = 0x00000020
local SDL_WINDOW_OPENGL     = 0x00000002
local SDL_WINDOW_SHOWN      = 0x00000004
local SDL_WINDOW_FULLSCREEN = 0x00000001
local SDL_WINDOWPOS_UNDEFINED = 0x1FFF0000
local SDL_QUIT_EVENT        = 0x100

-- In kmsdrm mode the window covers the full screen native resolution
local W, H = 1280, 720

-- ── Init ──────────────────────────────────────────────────────────────────────

io.write("[cartridge] SDL_Init...\n"); io.flush()
local initErr = sdl.SDL_Init(SDL_INIT_VIDEO)
io.write("[cartridge] SDL_Init returned: " .. initErr .. "\n"); io.flush()
if initErr ~= 0 then
  error("[cartridge] SDL_Init: " .. ffi.string(sdl.SDL_GetError()))
end

io.write("[cartridge] Setting GL attributes...\n"); io.flush()
sdl.SDL_GL_SetAttribute(0,  8)   -- GL_RED_SIZE
sdl.SDL_GL_SetAttribute(1,  8)   -- GL_GREEN_SIZE
sdl.SDL_GL_SetAttribute(2,  8)   -- GL_BLUE_SIZE
sdl.SDL_GL_SetAttribute(3,  8)   -- GL_ALPHA_SIZE
sdl.SDL_GL_SetAttribute(5,  1)   -- GL_DOUBLEBUFFER
sdl.SDL_GL_SetAttribute(6,  24)  -- GL_DEPTH_SIZE
sdl.SDL_GL_SetAttribute(7,  8)   -- GL_STENCIL_SIZE

io.write("[cartridge] SDL_CreateWindow (fullscreen)...\n"); io.flush()
local window = sdl.SDL_CreateWindow(
  "CartridgeOS",
  SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED,
  W, H,
  bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN, SDL_WINDOW_FULLSCREEN)
)
if window == nil then
  io.write("[cartridge] fullscreen failed: " .. ffi.string(sdl.SDL_GetError()) .. ", trying windowed\n"); io.flush()
  window = sdl.SDL_CreateWindow(
    "CartridgeOS",
    SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED,
    W, H,
    bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN)
  )
end
if window == nil then
  error("[cartridge] SDL_CreateWindow: " .. ffi.string(sdl.SDL_GetError()))
end
io.write("[cartridge] window created\n"); io.flush()

io.write("[cartridge] SDL_GL_CreateContext...\n"); io.flush()
local ctx = sdl.SDL_GL_CreateContext(window)
if ctx == nil then
  error("[cartridge] SDL_GL_CreateContext: " .. ffi.string(sdl.SDL_GetError()))
end
io.write("[cartridge] GL context created\n"); io.flush()

-- Get actual drawable size (handles HiDPI / kmsdrm native res)
local dw = ffi.new("int[1]"); local dh = ffi.new("int[1]")
sdl.SDL_GL_GetDrawableSize(window, dw, dh)
W, H = dw[0], dh[0]
io.write("[cartridge] drawable: " .. W .. "x" .. H .. "\n"); io.flush()

-- ── OpenGL setup ──────────────────────────────────────────────────────────────

io.write("[cartridge] require gl...\n"); io.flush()
local GL = require("gl")
io.write("[cartridge] GL loaded\n"); io.flush()

GL.glViewport(0, 0, W, H)
GL.glEnable(GL.BLEND)
GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
GL.glMatrixMode(GL.PROJECTION)
GL.glLoadIdentity()
GL.glOrtho(0, W, H, 0, -1, 1)   -- top-left origin
GL.glMatrixMode(GL.MODELVIEW)
GL.glLoadIdentity()

-- ── Font ──────────────────────────────────────────────────────────────────────

io.write("[cartridge] require font...\n"); io.flush()
local Font = require("font")
io.write("[cartridge] font loaded, init...\n"); io.flush()
Font.init()
io.write("[cartridge] font ready\n"); io.flush()

-- ── Helpers ───────────────────────────────────────────────────────────────────

local function rect(x, y, w, h, r, g, b, a)
  GL.glColor4f(r, g, b, a or 1)
  GL.glBegin(GL.QUADS)
    GL.glVertex2f(x,     y)
    GL.glVertex2f(x + w, y)
    GL.glVertex2f(x + w, y + h)
    GL.glVertex2f(x,     y + h)
  GL.glEnd()
end

local function roundedRect(x, y, w, h, radius, r, g, b, a)
  a = a or 1
  local segments = 12
  GL.glColor4f(r, g, b, a)

  local function corner(cx, cy, startAngle)
    GL.glBegin(GL.TRIANGLE_FAN)
      GL.glVertex2f(cx, cy)
      for i = 0, segments do
        local angle = startAngle + i * (math.pi / 2) / segments
        GL.glVertex2f(cx + math.cos(angle) * radius,
                      cy + math.sin(angle) * radius)
      end
    GL.glEnd()
  end

  rect(x + radius, y,          w - radius*2, h,          r, g, b, a)
  rect(x,          y + radius, radius,       h - radius*2, r, g, b, a)
  rect(x + w - radius, y + radius, radius,  h - radius*2, r, g, b, a)

  corner(x + radius,         y + radius,         math.pi)
  corner(x + w - radius,     y + radius,         math.pi * 1.5)
  corner(x + w - radius,     y + h - radius,     0)
  corner(x + radius,         y + h - radius,     math.pi * 0.5)
end

local function text(str, x, y, size, r, g, b, a)
  Font.draw(str, x, y, size, r or 1, g or 1, b or 1, a or 1)
end

local function centeredText(str, cx, y, size, r, g, b, a)
  local tw = Font.measureWidth(str, size)
  text(str, cx - tw/2, y, size, r, g, b, a)
end

-- ── System info ───────────────────────────────────────────────────────────────

local function readFile(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local s = f:read("*l"); f:close()
  return s
end

local kernel    = readFile("/proc/version"):match("Linux version (%S+)") or "unknown"
local uptime    = readFile("/proc/uptime"):match("^(%S+)") or "0"
local uptimeSec = math.floor(tonumber(uptime) or 0)

local dri_devs = {}
local p = io.popen("ls /dev/dri/ 2>/dev/null")
if p then
  for line in p:lines() do table.insert(dri_devs, line) end
  p:close()
end
local dri_str = #dri_devs > 0 and table.concat(dri_devs, "  ") or "none"

-- ── Run loop ──────────────────────────────────────────────────────────────────

local event    = ffi.new("SDL2_Event")
local running  = true
local TARGET_MS = math.floor(1000 / 60)
local t0       = sdl.SDL_GetTicks()

io.write("[cartridge] entering render loop at " .. W .. "x" .. H .. "\n"); io.flush()

local function paintFrame(t)
  local elapsed = (t - t0) / 1000.0

  GL.glClearColor(0.04, 0.04, 0.08, 1)
  GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))
  GL.glLoadIdentity()

  -- Left accent bar
  local accentH = H
  rect(0, 0, 6, accentH, 0.4, 0.3, 1.0)

  -- Header card
  local cardW = W - 120
  local cardX = 60
  local cardY = 60
  roundedRect(cardX, cardY, cardW, 200, 16, 0.10, 0.10, 0.16, 1)

  GL.glEnable(GL.SCISSOR_TEST)
  GL.glScissor(cardX, H - (cardY + 200), cardW, 200)
  rect(cardX, cardY, 4, 200, 0.4, 0.3, 1.0)
  GL.glDisable(GL.SCISSOR_TEST)

  centeredText("CartridgeOS", W/2, cardY + 30, 56, 1, 1, 1, 1)
  centeredText("iLoveReact  --  no X11, no Wayland, no display server",
               W/2, cardY + 110, 18, 0.6, 0.6, 0.8, 1)
  centeredText("just kernel -> kmsdrm -> SDL2 -> OpenGL -> LuaJIT -> React",
               W/2, cardY + 140, 16, 0.4, 0.4, 0.6, 1)

  -- Status panels
  local statY = cardY + 230
  local statW = (cardW - 40) / 2
  local stat2X = cardX + statW + 40

  roundedRect(cardX,  statY, statW, 130, 12, 0.08, 0.10, 0.14, 1)
  roundedRect(stat2X, statY, statW, 130, 12, 0.08, 0.10, 0.14, 1)

  text("SYSTEM", cardX + 20, statY + 16, 11, 0.4, 0.3, 0.8, 1)
  text("kernel  " .. kernel,            cardX + 20, statY + 44, 15, 0.7, 0.7, 0.9, 1)
  text("uptime  " .. uptimeSec .. "s",  cardX + 20, statY + 70, 15, 0.7, 0.7, 0.9, 1)

  text("DISPLAY", stat2X + 20, statY + 16, 11, 0.4, 0.3, 0.8, 1)
  text("driver  kmsdrm",           stat2X + 20, statY + 44, 15, 0.7, 0.7, 0.9, 1)
  text("DRI     " .. dri_str,      stat2X + 20, statY + 70, 15, 0.7, 0.7, 0.9, 1)

  -- Colour palette
  local palY  = statY + 160
  local palW  = math.floor((cardW - 7 * 12) / 8)
  local colors = {
    {0.94, 0.33, 0.31}, {0.98, 0.60, 0.25}, {0.97, 0.82, 0.28},
    {0.39, 0.78, 0.49}, {0.30, 0.69, 0.93}, {0.40, 0.46, 0.93},
    {0.72, 0.40, 0.93}, {0.93, 0.40, 0.72},
  }
  for i, c in ipairs(colors) do
    local bx = cardX + (i-1) * (palW + 12)
    roundedRect(bx, palY, palW, 36, 8, c[1], c[2], c[3], 1)
  end

  -- Animated pulse bar
  local pulseY = palY + 60
  roundedRect(cardX, pulseY, cardW, 24, 6, 0.08, 0.08, 0.13, 1)
  local pct  = (math.sin(elapsed * 1.5) + 1) / 2
  local barW = math.max(16, math.floor(pct * (cardW - 16)))
  local alpha = 0.6 + 0.4 * pct
  roundedRect(cardX + 8, pulseY + 6, barW, 12, 4,
              0.4 + 0.3 * pct, 0.3 + 0.2 * (1-pct), 1.0, alpha)

  -- Footer
  local footerY = H - 44
  rect(0, footerY, W, 44, 0.06, 0.06, 0.10, 1)
  rect(0, footerY, W, 1,  0.15, 0.15, 0.25, 1)
  text("iLoveReact", cardX, footerY + 14, 14, 0.4, 0.3, 0.9, 1)
  centeredText("Press Ctrl+Alt+Del to quit", W/2, footerY + 14, 13, 0.3, 0.3, 0.4, 1)

  local versionStr = "v0.1.0"
  local vw = Font.measureWidth(versionStr, 13)
  text(versionStr, W - cardX - vw, footerY + 14, 13, 0.3, 0.3, 0.4, 1)
end

while running do
  local frameStart = sdl.SDL_GetTicks()

  while sdl.SDL_PollEvent(event) == 1 do
    if event.type == SDL_QUIT_EVENT then
      running = false
    end
  end

  paintFrame(frameStart)

  sdl.SDL_GL_SwapWindow(window)

  local elapsed = sdl.SDL_GetTicks() - frameStart
  if elapsed < TARGET_MS then sdl.SDL_Delay(TARGET_MS - elapsed) end
end

-- Cleanup
Font.done()
sdl.SDL_GL_DeleteContext(ctx)
sdl.SDL_DestroyWindow(window)
sdl.SDL_Quit()
io.write("[cartridge] clean exit\n"); io.flush()
