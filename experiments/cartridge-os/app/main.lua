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

  typedef struct {
    uint32_t type;
    uint32_t timestamp;
    uint32_t windowID;
    uint32_t which;
    uint32_t state;
    int32_t  x;
    int32_t  y;
    int32_t  xrel;
    int32_t  yrel;
  } SDL_MouseMotionEvent;

  typedef struct {
    uint32_t type;
    uint32_t timestamp;
    uint32_t windowID;
    uint32_t which;
    int32_t  x;
    int32_t  y;
    uint32_t direction;
  } SDL_MouseWheelEvent;

  typedef struct {
    uint32_t type;
    uint32_t timestamp;
    uint32_t windowID;
    uint32_t which;
    uint8_t  button;
    uint8_t  state;
    uint8_t  clicks;
    uint8_t  padding1;
    int32_t  x;
    int32_t  y;
  } SDL_MouseButtonEvent;

  typedef struct {
    uint32_t type;
    uint32_t timestamp;
    uint32_t windowID;
    char     text[32];
  } SDL_TextInputEvent;

  typedef void SDL_Window;
  typedef void *SDL_GLContext;
  typedef struct SDL_Surface {
    uint32_t flags;
    void    *format;
    int      w, h;
    int      pitch;
    void    *pixels;
    void    *userdata;
    int      locked;
    void    *list_blitmap;
    int      clip_x, clip_y, clip_w, clip_h;
    int      refcount;
  } SDL_Surface;
  typedef struct SDL_Cursor SDL_Cursor;

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
  int           SDL_ShowCursor(int toggle);
  uint32_t      SDL_GetMouseState(int *x, int *y);
  uint32_t      SDL_GetRelativeMouseState(int *x, int *y);
  int           SDL_SetRelativeMouseMode(int enabled);
  void          SDL_StartTextInput(void);
  void          SDL_StopTextInput(void);

  SDL_Surface  *SDL_CreateRGBSurfaceFrom(void *pixels, int w, int h,
                  int depth, int pitch, uint32_t Rmask, uint32_t Gmask,
                  uint32_t Bmask, uint32_t Amask);
  void          SDL_FreeSurface(SDL_Surface *surface);
  SDL_Cursor   *SDL_CreateColorCursor(SDL_Surface *surface, int hot_x, int hot_y);
  void          SDL_SetCursor(SDL_Cursor *cursor);
  void          SDL_FreeCursor(SDL_Cursor *cursor);
]]

local sdl = ffi.load("SDL2")

local SDL_INIT_VIDEO        = 0x00000020
local SDL_WINDOW_OPENGL              = 0x00000002
local SDL_WINDOW_SHOWN               = 0x00000004
local SDL_WINDOW_FULLSCREEN          = 0x00000001
local SDL_WINDOW_FULLSCREEN_DESKTOP  = 0x00001001
local SDL_WINDOWPOS_UNDEFINED = 0x1FFF0000
local SDL_QUIT_EVENT         = 0x100
local SDL_MOUSEMOTION_EVENT  = 0x400
local SDL_MOUSEBUTTONDOWN    = 0x401
local SDL_MOUSEBUTTONUP      = 0x402
local SDL_MOUSEWHEEL_EVENT   = 0x403
local SDL_KEYDOWN_EVENT      = 0x300
local SDL_TEXTINPUT_EVENT    = 0x303

-- kmsdrm will pick the native mode; these are just initial hints
local W, H = 0, 0
local mouseX, mouseY = 0, 0

-- ── Init ──────────────────────────────────────────────────────────────────────

-- Load input modules: USB stack + HID + PS/2 fallback + evdev
io.write("[cartridge] loading input modules...\n"); io.flush()
local input_mods = {
  -- USB host controllers (xHCI for USB 3.x, EHCI for 2.0, UHCI/OHCI for 1.x)
  "usb-common", "usbcore", "xhci-hcd", "xhci-pci", "ehci-hcd", "ehci-pci",
  "uhci-hcd", "ohci-hcd", "ohci-pci",
  -- HID (keyboard/mouse class drivers)
  "hid", "hid-generic", "usbhid",
  -- virtio-input (for VMs)
  "virtio_input",
  -- PS/2 fallback
  "psmouse",
  -- userspace device nodes
  "evdev", "mousedev",
}
for _, mod in ipairs(input_mods) do
  os.execute("modprobe " .. mod .. " 2>/dev/null")
end
-- Give the kernel a moment to enumerate input devices
local function usleep(ms) local t=os.clock()+ms/1000 while os.clock()<t do end end
usleep(300)

local pi = io.popen("ls /dev/input/ 2>&1")
if pi then
  io.write("[cartridge] /dev/input/: ")
  for line in pi:lines() do io.write(line .. " ") end
  io.write("\n"); pi:close()
end
io.flush()

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

-- FULLSCREEN_DESKTOP lets kmsdrm pick the native CRTC mode instead of
-- trying to modeset to a specific resolution (which causes ENOSPC pageflip
-- errors on virtio-gpu when the requested mode doesn't match).
io.write("[cartridge] SDL_CreateWindow (fullscreen desktop)...\n"); io.flush()
local window = sdl.SDL_CreateWindow(
  "CartridgeOS",
  SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED,
  W, H,
  bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN, SDL_WINDOW_FULLSCREEN_DESKTOP)
)
if window == nil then
  io.write("[cartridge] fullscreen_desktop failed: " .. ffi.string(sdl.SDL_GetError()) .. "\n"); io.flush()
  -- fallback: try real fullscreen with explicit mode
  W, H = 1280, 720
  window = sdl.SDL_CreateWindow(
    "CartridgeOS",
    SDL_WINDOWPOS_UNDEFINED, SDL_WINDOWPOS_UNDEFINED,
    W, H,
    bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN, SDL_WINDOW_FULLSCREEN)
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
mouseX, mouseY = math.floor(W/2), math.floor(H/2)
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

-- ── Console ───────────────────────────────────────────────────────────────────

local EventBus = require("eventbus")
local Commands = require("commands")
local Console  = require("console")

Console.init({
  GL   = GL,
  Font = Font,
  rect = rect,
  W    = W,
  H    = H,
})

-- ── Read boot facts + verdict pipe from init.c ──────────────────────────────

-- Boot facts: /run/boot-facts (key=value, written by init.c, read-only)
local bootFacts = {}
do
  local f = io.open("/run/boot-facts", "r")
  if f then
    for line in f:lines() do
      local k, v = line:match("^([^=]+)=(.*)$")
      if k then bootFacts[k] = v end
    end
    f:close()
  end
end

-- Verdict pipe: FD 3 (17-byte binary struct from init.c)
-- struct cart_verdict { uint8_t code; uint8_t key_id[8]; uint64_t boot_time; }
local verdictCode = nil
local verdictKeyId = nil
do
  local f = io.open("/proc/self/fd/3", "rb")
  if f then
    local data = f:read("*a")
    f:close()
    if data and #data >= 17 then
      verdictCode = data:byte(1)
      verdictKeyId = ""
      for i = 2, 9 do
        verdictKeyId = verdictKeyId .. string.format("%02x", data:byte(i))
      end
    end
  end
end

-- Close FD 3 if it exists (we've read it)
pcall(function()
  local fd3 = io.open("/proc/self/fd/3", "r")
  if fd3 then fd3:close() end
end)

-- Verdict code names (must match cart.h CART_VERDICT_*)
local VERDICT_NAMES = {
  [0] = "unsigned", [1] = "verified", [2] = "bad_sig",
  [3] = "bad_hash", [4] = "bad_format", [5] = "no_cart",
}

local verdictName = VERDICT_NAMES[verdictCode] or bootFacts.verdict or "unknown"

-- Emit startup events
EventBus.emit("os", "CartridgeOS v0.1.0 booted")
if verdictCode then
  EventBus.emit("os", "cart verdict: " .. verdictName .. " (code " .. verdictCode .. ")")
end
if bootFacts.verdict then
  EventBus.emit("os", "boot-facts verdict: " .. bootFacts.verdict)
end
EventBus.emit("os", "kernel " .. kernel .. " (uptime " .. uptimeSec .. "s)")
EventBus.emit("gpu", "kmsdrm initialized, DRI: " .. dri_str)
EventBus.emit("gpu", "OpenGL context " .. W .. "x" .. H)
EventBus.emit("input", "USB + HID + evdev loaded")

-- Count input devices
local inputDevCount = 0
local id = io.popen("ls /dev/input/ 2>/dev/null")
if id then
  for _ in id:lines() do inputDevCount = inputDevCount + 1 end
  id:close()
end
if inputDevCount > 0 then
  EventBus.emit("input", inputDevCount .. " input device(s) detected")
end

-- ── Boot screen (trust gate) ──────────────────────────────────────────────────

local BootScreen = require("bootscreen")
BootScreen.init({
  GL          = GL,
  Font        = Font,
  rect        = rect,
  roundedRect = roundedRect,
  text        = text,
  centeredText = centeredText,
  W           = W,
  H           = H,
})
BootScreen.loadManifest("/app/manifest.json")
BootScreen.setVerdict(verdictName)

-- Console commands for manifest inspection
Commands.register("manifest", {
  desc = "Show loaded cartridge manifest",
  usage = "manifest",
  exec = function()
    local m = BootScreen.getManifest()
    if not m then
      return { type = "error", data = "no manifest loaded" }
    end
    local lines = {}
    table.insert(lines, { text = "  name:    " .. (m.name or "?"), color = {0.8, 0.8, 1.0} })
    table.insert(lines, { text = "  version: " .. (m.version or "?"), color = {0.8, 0.8, 1.0} })
    if m.build then
      if m.build.commit then
        table.insert(lines, { text = "  commit:  " .. m.build.commit, color = {0.6, 0.7, 0.8} })
      end
      if m.build.toolchain then
        table.insert(lines, { text = "  toolchain: " .. m.build.toolchain, color = {0.6, 0.7, 0.8} })
      end
    end
    if m.signature then
      table.insert(lines, { text = "  signature: present", color = {1.0, 0.8, 0.2} })
    else
      table.insert(lines, { text = "  signature: none", color = {0.4, 0.4, 0.5} })
    end
    return { type = "lines", data = lines }
  end,
})

Commands.register("verify", {
  desc = "Show cart verification status",
  usage = "verify",
  exec = function()
    local lines = {}
    table.insert(lines, {
      text = "  verdict:  " .. verdictName,
      color = verdictName == "verified" and {0.3, 0.85, 0.4} or
              verdictName == "unsigned" and {1.0, 0.8, 0.2} or {1.0, 0.3, 0.3},
    })
    if verdictCode then
      table.insert(lines, { text = "  code:     " .. verdictCode, color = {0.6, 0.6, 0.7} })
    end
    if verdictKeyId then
      table.insert(lines, { text = "  key_id:   " .. verdictKeyId, color = {0.6, 0.6, 0.7} })
    end
    for _, key in ipairs({"manifest_hash", "payload_hash", "pubkey", "boot_time", "cart_path"}) do
      if bootFacts[key] then
        local val = bootFacts[key]
        if #val > 32 then val = val:sub(1, 32) .. "..." end
        table.insert(lines, { text = "  " .. key .. ": " .. val, color = {0.5, 0.5, 0.6} })
      end
    end
    return { type = "lines", data = lines }
  end,
})

Commands.register("permit", {
  desc = "Show capability permits",
  usage = "permit",
  exec = function()
    local m = BootScreen.getManifest()
    if not m or not m.capabilities then
      return { type = "error", data = "no manifest loaded" }
    end
    local lines = {}
    local order = {"gpu","storage","network","filesystem","clipboard","process","browse","ipc","sysmon"}
    for _, cap in ipairs(order) do
      local val = m.capabilities[cap]
      local status, color
      if not val or val == false then
        status = "denied"
        color = {0.4, 0.4, 0.5}
      elseif val == true then
        status = "granted"
        color = {0.3, 0.85, 0.4}
      elseif type(val) == "table" then
        local parts = {}
        for k, v in pairs(val) do
          parts[#parts + 1] = type(k) == "number" and tostring(v) or (k .. "=" .. tostring(v))
        end
        status = "scoped: " .. table.concat(parts, ", ")
        color = {1.0, 0.8, 0.2}
      else
        status = tostring(val)
        color = {0.6, 0.6, 0.6}
      end
      local pad = string.rep(" ", 14 - #cap)
      table.insert(lines, { text = "  " .. cap .. pad .. status, color = color })
    end
    return { type = "lines", data = lines }
  end,
})

-- ── Run loop ──────────────────────────────────────────────────────────────────

local event    = ffi.new("SDL2_Event")
local running  = true
local t0       = sdl.SDL_GetTicks()
local lastTick = t0
local cursorStyle = "arrow"
local appError = nil  -- set if paintFrame pcall fails
local textInputActive = false
local appPhase = "boot"  -- "boot" | "running" | "denied"

-- ── Hardware cursors ─────────────────────────────────────────────────────────

-- Build an ARGB pixel buffer and create an SDL hardware cursor from it.
-- pixelFunc(pixels, size) fills the uint32_t[size*size] ARGB buffer.
local function makeHWCursor(size, hotX, hotY, pixelFunc)
  local pixels = ffi.new("uint32_t[?]", size * size)
  ffi.fill(pixels, size * size * 4, 0)  -- transparent
  pixelFunc(pixels, size)
  local surface = sdl.SDL_CreateRGBSurfaceFrom(
    pixels, size, size, 32, size * 4,
    0x00FF0000, 0x0000FF00, 0x000000FF, 0xFF000000)
  if surface == nil then
    io.write("[cursor] SDL_CreateRGBSurfaceFrom failed: " .. ffi.string(sdl.SDL_GetError()) .. "\n")
    return nil, pixels  -- keep pixels alive
  end
  local cursor = sdl.SDL_CreateColorCursor(surface, hotX, hotY)
  sdl.SDL_FreeSurface(surface)
  if cursor == nil then
    io.write("[cursor] SDL_CreateColorCursor failed: " .. ffi.string(sdl.SDL_GetError()) .. "\n")
  end
  return cursor, pixels  -- must keep pixels alive while cursor exists
end

local function argb(a, r, g, b)
  return bit.bor(
    bit.lshift(math.floor(a * 255), 24),
    bit.lshift(math.floor(r * 255), 16),
    bit.lshift(math.floor(g * 255), 8),
    math.floor(b * 255))
end

local function setPixel(pixels, size, x, y, color)
  if x >= 0 and x < size and y >= 0 and y < size then
    pixels[y * size + x] = color
  end
end

-- Arrow cursor: 32x32, classic pointer with black outline + white fill
local arrowCursor, arrowPixels = makeHWCursor(32, 0, 0, function(px, sz)
  -- Define arrow shape as scanlines: {y, x_start, x_end}
  -- Classic arrow pointing down-right from (0,0)
  local shape = {
    {0,  0, 0},
    {1,  0, 1},
    {2,  0, 2},
    {3,  0, 3},
    {4,  0, 4},
    {5,  0, 5},
    {6,  0, 6},
    {7,  0, 7},
    {8,  0, 8},
    {9,  0, 9},
    {10, 0, 10},
    {11, 0, 11},
    {12, 0, 5},
    {13, 0, 4},  {13, 5, 6},
    {14, 0, 3},  {14, 6, 7},
    {15, 0, 2},  {15, 7, 8},
    {16, 0, 1},  {16, 8, 9},
    {17, 0, 0},  {17, 9, 10},
  }
  local black = argb(1, 0, 0, 0)
  local white = argb(1, 1, 1, 1)

  -- Fill shape with white
  for _, s in ipairs(shape) do
    for x = s[2], s[3] do
      setPixel(px, sz, x, s[1], white)
    end
  end

  -- Black border: scan for white pixels with transparent neighbors
  for y = 0, sz - 1 do
    for x = 0, sz - 1 do
      if px[y * sz + x] == 0 then  -- transparent
        -- Check if any neighbor is white
        local hasWhite = false
        for dy = -1, 1 do
          for dx = -1, 1 do
            if not (dx == 0 and dy == 0) then
              local nx, ny = x + dx, y + dy
              if nx >= 0 and nx < sz and ny >= 0 and ny < sz then
                if px[ny * sz + nx] == white then hasWhite = true end
              end
            end
          end
        end
        if hasWhite then
          setPixel(px, sz, x, y, black)
        end
      end
    end
  end
end)

-- Scimitar cursor: 32x32, pixel art scaled 2x
local scimPixelDef = {
  -- {row, col, r, g, b}
  {0,10, 0.6,0.8,0.9}, {0,11, 0.7,0.9,1.0},
  {1,9,  0.5,0.7,0.9}, {1,10, 0.8,0.9,1.0}, {1,11, 0.9,1.0,1.0}, {1,12, 0.6,0.7,0.8},
  {2,8,  0.4,0.6,0.8}, {2,9,  0.7,0.9,1.0}, {2,10, 0.9,1.0,1.0}, {2,11, 0.8,0.9,1.0}, {2,12, 0.5,0.6,0.7},
  {3,7,  0.4,0.5,0.7}, {3,8,  0.7,0.8,1.0}, {3,9,  0.9,1.0,1.0}, {3,10, 0.8,0.9,1.0}, {3,11, 0.5,0.6,0.7},
  {4,6,  0.3,0.5,0.7}, {4,7,  0.6,0.8,1.0}, {4,8,  0.9,1.0,1.0}, {4,9,  0.7,0.8,0.9}, {4,10, 0.4,0.5,0.6},
  {5,5,  0.3,0.4,0.6}, {5,6,  0.6,0.8,0.9}, {5,7,  0.8,0.9,1.0}, {5,8,  0.6,0.7,0.8},
  {6,5,  0.3,0.4,0.5}, {6,6,  0.5,0.7,0.8}, {6,7,  0.5,0.6,0.7},
  {7,5,  0.3,0.3,0.4}, {7,6,  0.4,0.5,0.6},
  {8,3,  0.7,0.6,0.2}, {8,4,  0.9,0.8,0.3}, {8,5,  1.0,0.9,0.4}, {8,6,  0.9,0.8,0.3}, {8,7,  0.7,0.6,0.2},
  {9,5,   0.4,0.25,0.1}, {10,5, 0.35,0.2,0.08}, {11,5, 0.4,0.25,0.1},
  {12,4, 0.6,0.5,0.2}, {12,5, 0.9,0.8,0.3}, {12,6, 0.6,0.5,0.2},
  {13,5, 0.5,0.4,0.15},
}

local scimCursor, scimPixels = makeHWCursor(32, 10, 0, function(px, sz)
  local black = argb(0.7, 0, 0, 0)
  -- Draw each pixel at 2x scale
  for _, p in ipairs(scimPixelDef) do
    local row, col, r, g, b = p[1], p[2], p[3], p[4], p[5]
    local color = argb(1, r, g, b)
    local bx, by = col * 2, row * 2
    setPixel(px, sz, bx,     by,     color)
    setPixel(px, sz, bx + 1, by,     color)
    setPixel(px, sz, bx,     by + 1, color)
    setPixel(px, sz, bx + 1, by + 1, color)
  end
  -- Black outline on exposed edges
  local filled = {}
  for _, p in ipairs(scimPixelDef) do
    local bx, by = p[2] * 2, p[1] * 2
    filled[by * sz + bx] = true
    filled[by * sz + bx + 1] = true
    filled[(by+1) * sz + bx] = true
    filled[(by+1) * sz + bx + 1] = true
  end
  for _, p in ipairs(scimPixelDef) do
    local bx, by = p[2] * 2, p[1] * 2
    for _, fy in ipairs({by, by+1}) do
      for _, fx in ipairs({bx, bx+1}) do
        for dy = -1, 1 do
          for dx = -1, 1 do
            if not (dx == 0 and dy == 0) then
              local nx, ny = fx + dx, fy + dy
              if nx >= 0 and nx < sz and ny >= 0 and ny < sz then
                if not filled[ny * sz + nx] and px[ny * sz + nx] == 0 then
                  setPixel(px, sz, nx, ny, black)
                end
              end
            end
          end
        end
      end
    end
  end
end)

-- Activate arrow cursor by default
if arrowCursor ~= nil then
  sdl.SDL_SetCursor(arrowCursor)
  sdl.SDL_ShowCursor(1)
  io.write("[cursor] hardware arrow cursor active\n"); io.flush()
else
  io.write("[cursor] hardware cursor failed, using default\n"); io.flush()
  sdl.SDL_ShowCursor(1)
end

local function setCursorStyle(style)
  cursorStyle = style
  if style == "scimitar" and scimCursor ~= nil then
    sdl.SDL_SetCursor(scimCursor)
  elseif arrowCursor ~= nil then
    sdl.SDL_SetCursor(arrowCursor)
  end
end

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
  local hint = Console.isOpen() and "`:close console" or "`:open console"
  centeredText(hint, W/2, footerY + 14, 13, 0.3, 0.3, 0.4, 1)

  local versionStr = "v0.1.0"
  local vw = Font.measureWidth(versionStr, 13)
  text(versionStr, W - cardX - vw, footerY + 14, 13, 0.3, 0.3, 0.4, 1)
end

-- ── Main loop ─────────────────────────────────────────────────────────────────

while running do
  local frameStart = sdl.SDL_GetTicks()
  local dt = (frameStart - lastTick) / 1000.0
  lastTick = frameStart

  -- ── Event polling ─────────────────────────────────────────────────────────
  while sdl.SDL_PollEvent(event) == 1 do
    local etype = event.type

    if etype == SDL_QUIT_EVENT then
      running = false

    elseif etype == SDL_MOUSEMOTION_EVENT then
      local m = ffi.cast("SDL_MouseMotionEvent*", event)
      -- Use absolute coordinates (usb-tablet provides them).
      -- SDL window coords may differ from drawable coords (KMSDRM picks
      -- native CRTC mode), so we use the absolute x,y directly — KMSDRM
      -- fullscreen means window coords == drawable coords.
      mouseX = math.max(0, math.min(W, m.x))
      mouseY = math.max(0, math.min(H, m.y))

    elseif etype == SDL_MOUSEBUTTONDOWN then
      local mb = ffi.cast("SDL_MouseButtonEvent*", event)
      if mb.button == 1 then  -- left click
        if not Console.isOpen() and appPhase == "boot" then
          BootScreen.handleClick(mb.x, mb.y)
          if BootScreen.getState() == "confirmed" then
            appPhase = "running"
            EventBus.emit("os", "cartridge approved — launching")
          elseif BootScreen.getState() == "denied" then
            appPhase = "denied"
            EventBus.emit("os", "cartridge DENIED by user")
          end
        end
      end

    elseif etype == SDL_MOUSEWHEEL_EVENT then
      if Console.isOpen() then
        local mw = ffi.cast("SDL_MouseWheelEvent*", event)
        Console.handleScroll(mw.y)
      end

    elseif etype == SDL_TEXTINPUT_EVENT then
      if Console.isOpen() then
        local ti = ffi.cast("SDL_TextInputEvent*", event)
        Console.handleTextInput(ffi.string(ti.text))
      end

    elseif etype == SDL_KEYDOWN_EVENT then
      local ptr = ffi.cast("uint32_t*", event)
      local scancode = ptr[4]

      -- Backtick (scancode 53) — ALWAYS toggles console regardless of phase
      if scancode == 53 then
        local action = Console.toggle()
        if action == "open" then
          sdl.SDL_StartTextInput()
          textInputActive = true
        elseif action == "close" then
          sdl.SDL_StopTextInput()
          textInputActive = false
        end

      elseif Console.isOpen() then
        -- Console eats all key events when open
        local consumed, action = Console.handleKeyDown(scancode)
        if action == "close" then
          sdl.SDL_StopTextInput()
          textInputActive = false
        end

      elseif appPhase == "boot" then
        -- Boot screen gets keys when console is closed
        BootScreen.handleKeyDown(scancode)
        if BootScreen.getState() == "confirmed" then
          appPhase = "running"
          EventBus.emit("os", "cartridge approved — launching")
        elseif BootScreen.getState() == "denied" then
          appPhase = "denied"
          EventBus.emit("os", "cartridge DENIED by user")
        end

      else
        -- Normal app key handling (running phase)
        if scancode == 59 then
          setCursorStyle(cursorStyle == "arrow" and "scimitar" or "arrow")
        end
      end
    end
  end

  -- ── Update ──────────────────────────────────────────────────────────────────
  Console.update(dt)
  if appPhase == "boot" then
    BootScreen.update(dt)
  end

  -- ── Render ──────────────────────────────────────────────────────────────────
  if appPhase == "boot" then
    BootScreen.draw()

  elseif appPhase == "running" then
    local ok, err = pcall(paintFrame, frameStart)
    if not ok then
      GL.glClearColor(0.08, 0.02, 0.02, 1)
      GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))
      GL.glLoadIdentity()

      if not appError then
        appError = tostring(err)
        EventBus.emit("os", "app crash: " .. appError)
      end

      text("APP ERROR", 60, 60, 24, 1, 0.3, 0.3, 1)
      text(appError, 60, 100, 14, 0.8, 0.4, 0.4, 1)
      text("console is still alive  --  press ` to open", 60, 140, 14, 0.5, 0.5, 0.6, 1)
    end

  elseif appPhase == "denied" then
    GL.glClearColor(0.06, 0.02, 0.02, 1)
    GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))
    GL.glLoadIdentity()

    centeredText("Cartridge Denied", W / 2, H / 2 - 40, 32, 0.8, 0.3, 0.3, 1)
    centeredText("The cartridge was not approved for launch.", W / 2, H / 2 + 10, 16, 0.5, 0.4, 0.4, 1)
    centeredText("Press ` to open console, or close the window.", W / 2, H / 2 + 40, 14, 0.4, 0.4, 0.5, 1)
  end

  -- Console always draws on top (all phases)
  Console.draw()

  sdl.SDL_GL_SwapWindow(window)
  sdl.SDL_Delay(1)
end

-- Cleanup
if textInputActive then
  sdl.SDL_StopTextInput()
end
Font.done()
if arrowCursor ~= nil then sdl.SDL_FreeCursor(arrowCursor) end
if scimCursor  ~= nil then sdl.SDL_FreeCursor(scimCursor)  end
sdl.SDL_GL_DeleteContext(ctx)
sdl.SDL_DestroyWindow(window)
sdl.SDL_Quit()
io.write("[cartridge] clean exit\n"); io.flush()
