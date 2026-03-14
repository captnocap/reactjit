--[[
  render_source.lua — External display capture, virtual displays, and VM rendering

  Capture backends:
    XShm:    X server -> shared memory (XShmGetImage, <1ms) -> BGRX->RGBA -> GPU texture
    FFmpeg:  Device/display -> FFmpeg -> rawvideo pipe -> love.thread -> GPU texture
    VNC:     QEMU VM -> VNC RFB protocol -> love.thread -> GPU texture

  React usage:
    <Render source="screen:0" />                    -- screen capture via XShm
    <Render source="cam:0" fps={30} />              -- webcam via FFmpeg/v4l2
    <Render source="hdmi:0" interactive />           -- HDMI capture card
    <Render source="window:Firefox" interactive />   -- window capture
    <Render source="display" />                      -- virtual display (Xephyr/Xvfb)
    <Render source="debian.iso" interactive />       -- boot VM from ISO
    <Render source="vm:disk.qcow2" vmMemory={4096} /> -- VM from disk image
]]

local ffi = require("ffi")
local bit = require("bit")
local Log = require("lua.debug_log")

local RenderSource = {}
local feeds = {}

-- ============================================================================
-- Feed recycling pool — prevents process restart on React tree restructuring
-- When a Render node unmounts, its feed goes here instead of being killed.
-- When a new Render mounts with the same command, it grabs the feed from the pool.
-- ============================================================================
local recyclePool = {}    -- { command = { feed = ..., recycledAt = timestamp } }
local RECYCLE_TTL = 5.0   -- seconds before a recycled feed is actually killed

-- ============================================================================
-- X11 + XShm FFI bindings (screen capture fast path)
-- ============================================================================

local libX11, libXext
local xshm_ok = false
local xdpy = nil       -- Display* (shared across all screen feeds)
local xroot = nil       -- root Window
local xscreen = 0       -- default screen number

-- Constants
local ZPixmap = 2
local IPC_PRIVATE = 0
local IPC_CREAT = 512   -- 01000 octal
local IPC_RMID = 0
local SHM_PERMS = 950   -- IPC_CREAT | 0666

local function initXShm()
  if xshm_ok then return true end

  local cdef_ok = pcall(ffi.cdef, [[
    // X11 opaque types
    typedef struct _XDisplay Display;
    typedef struct _Visual Visual;
    typedef unsigned long XID;
    typedef XID Window;
    typedef XID Drawable;

    // XImage -- need to read data, width, height, bytes_per_line
    typedef struct _XImage {
      int width, height;
      int xoffset;
      int format;
      char *data;
      int byte_order;
      int bitmap_unit;
      int bitmap_bit_order;
      int bitmap_pad;
      int depth;
      int bytes_per_line;
      int bits_per_pixel;
      unsigned long red_mask, green_mask, blue_mask;
      void *obdata;
      struct { void *a, *b, *c, *d, *e, *f; } funcs;
    } XImage;

    // XShm segment info
    typedef struct {
      unsigned long shmseg;
      int shmid;
      char *shmaddr;
      int readOnly;
    } XShmSegmentInfo;

    // XGetWindowAttributes
    typedef struct {
      int x, y;
      int width, height;
      int border_width;
      int depth;
      Visual *visual;
      Window root;
      int _class;
      int bit_gravity, win_gravity;
      int backing_store;
      unsigned long backing_planes, backing_pixel;
      int save_under;
      long event_mask;
      long do_not_propagate_mask;
      int override_redirect;
      void *screen;
      void *colormap;
      int map_state;
    } XWindowAttributes;

    // X11 core
    Display *XOpenDisplay(const char *name);
    int XCloseDisplay(Display *dpy);
    Window XDefaultRootWindow(Display *dpy);
    int XDefaultScreen(Display *dpy);
    Visual *XDefaultVisual(Display *dpy, int scr);
    int XDefaultDepth(Display *dpy, int scr);
    int XDisplayWidth(Display *dpy, int scr);
    int XDisplayHeight(Display *dpy, int scr);
    int XGetWindowAttributes(Display *dpy, Window w, XWindowAttributes *attr);

    // XShm
    int XShmQueryExtension(Display *dpy);
    XImage *XShmCreateImage(Display *dpy, Visual *vis, unsigned int depth,
                            int format, char *data, XShmSegmentInfo *info,
                            unsigned int w, unsigned int h);
    int XShmAttach(Display *dpy, XShmSegmentInfo *info);
    int XShmDetach(Display *dpy, XShmSegmentInfo *info);
    int XShmGetImage(Display *dpy, Drawable d, XImage *img,
                     int x, int y, unsigned long plane_mask);

    // We don't call XDestroyImage because it free()s data which points to shm.
    // Instead we manually clean up.
    void XFree(void *data);

    // POSIX shared memory
    int shmget(int key, size_t size, int shmflg);
    void *shmat(int shmid, const void *addr, int shmflg);
    int shmdt(const void *addr);
    int shmctl(int shmid, int cmd, void *buf);
  ]])
  if not cdef_ok then return false end

  -- Load X11 + Xext shared libraries
  local ok1, x11 = pcall(ffi.load, "X11")
  local ok2, xext = pcall(ffi.load, "Xext")
  if not ok1 or not ok2 then return false end
  libX11 = x11
  libXext = xext

  -- Open display connection (dedicated for capture -- doesn't interfere with Love2D's)
  local display_name = os.getenv("DISPLAY")
  if not display_name then return false end
  xdpy = libX11.XOpenDisplay(display_name)
  if xdpy == nil then return false end

  -- Check XShm extension
  if libXext.XShmQueryExtension(xdpy) == 0 then
    libX11.XCloseDisplay(xdpy)
    xdpy = nil
    return false
  end

  xscreen = libX11.XDefaultScreen(xdpy)
  xroot = libX11.XDefaultRootWindow(xdpy)
  xshm_ok = true
  return true
end

--- Create an XShm capture context for a screen region.
--- @param w number  capture width
--- @param h number  capture height
--- @return table|nil  { ximage, shminfo, shmaddr }
local function createXShmCapture(w, h)
  if not xshm_ok then return nil end

  local visual = libX11.XDefaultVisual(xdpy, xscreen)
  local depth = libX11.XDefaultDepth(xdpy, xscreen)

  local shminfo = ffi.new("XShmSegmentInfo")

  local ximage = libXext.XShmCreateImage(xdpy, visual, depth, ZPixmap,
    nil, shminfo, w, h)
  if ximage == nil then return nil end

  -- Allocate shared memory segment
  local shmsize = ximage.bytes_per_line * ximage.height
  shminfo.shmid = ffi.C.shmget(IPC_PRIVATE, shmsize, SHM_PERMS)
  if shminfo.shmid < 0 then
    libX11.XFree(ximage)
    return nil
  end

  -- Attach shared memory
  shminfo.shmaddr = ffi.cast("char*", ffi.C.shmat(shminfo.shmid, nil, 0))
  if shminfo.shmaddr == ffi.cast("char*", -1) then
    ffi.C.shmctl(shminfo.shmid, IPC_RMID, nil)
    libX11.XFree(ximage)
    return nil
  end

  ximage.data = shminfo.shmaddr
  shminfo.readOnly = 0

  -- Attach to X server
  libXext.XShmAttach(xdpy, shminfo)

  -- Mark segment for deletion when all processes detach
  ffi.C.shmctl(shminfo.shmid, IPC_RMID, nil)

  return { ximage = ximage, shminfo = shminfo }
end

--- Destroy an XShm capture context.
local function destroyXShmCapture(cap)
  if not cap then return end
  if xdpy ~= nil then
    libXext.XShmDetach(xdpy, cap.shminfo)
  end
  ffi.C.shmdt(cap.shminfo.shmaddr)
  -- Don't XDestroyImage -- it would free() the shm pointer.
  -- Just XFree the XImage struct itself.
  cap.ximage.data = nil
  libX11.XFree(cap.ximage)
end

--- Capture a frame via XShm and convert BGRX -> RGBA into dest buffer.
--- @param cap table  from createXShmCapture
--- @param drawable cdata  X11 Drawable (root window or specific window)
--- @param ox number  x offset within drawable
--- @param oy number  y offset within drawable
--- @param dest cdata  uint8_t* destination (ImageData FFI pointer)
--- @param w number  width
--- @param h number  height
--- @return boolean  success
local function captureXShm(cap, drawable, ox, oy, dest, w, h)
  -- XShmGetImage: copies drawable pixels into shared memory (<1ms for 1080p)
  local ok = libXext.XShmGetImage(xdpy, drawable, cap.ximage, ox, oy,
    0xFFFFFFFFULL)  -- AllPlanes
  if ok == 0 then return false end

  -- Convert BGRX -> RGBA
  -- X11 32bpp little-endian: memory bytes are [B, G, R, X]
  -- Love2D RGBA:             memory bytes are [R, G, B, A]
  -- Swap byte 0<>2, set byte 3 to 0xFF
  local src = ffi.cast("uint8_t*", cap.ximage.data)
  local bpl = cap.ximage.bytes_per_line
  local npixels = w * h

  -- Fast path: if bytes_per_line == w*4 (no padding), do contiguous conversion
  if bpl == w * 4 then
    for i = 0, npixels * 4 - 1, 4 do
      dest[i]     = src[i + 2]  -- R
      dest[i + 1] = src[i + 1]  -- G
      dest[i + 2] = src[i]      -- B
      dest[i + 3] = 255          -- A
    end
  else
    -- Handle row padding
    for y = 0, h - 1 do
      local srcRow = y * bpl
      local dstRow = y * w * 4
      for x = 0, w - 1 do
        local si = srcRow + x * 4
        local di = dstRow + x * 4
        dest[di]     = src[si + 2]
        dest[di + 1] = src[si + 1]
        dest[di + 2] = src[si]
        dest[di + 3] = 255
      end
    end
  end

  return true
end

-- ============================================================================
-- Utility helpers
-- ============================================================================

local function parseResolution(res)
  if not res then return 1280, 720 end
  local w, h = res:match("^(%d+)x(%d+)$")
  return tonumber(w) or 1280, tonumber(h) or 720
end

local function findFreeDisplay()
  for i = 10, 99 do
    local lockfile = "/tmp/.X" .. i .. "-lock"
    local f = io.open(lockfile, "r")
    if not f then return i end
    f:close()
  end
  return nil
end

local function findFreeVNCPort()
  local socket_ok, socket = pcall(require, "socket")
  if not socket_ok then return 5910 end  -- fallback
  for port = 5910, 5999 do
    local s = socket.tcp()
    s:settimeout(0.1)
    local ok, err = s:connect("127.0.0.1", port)
    s:close()
    if not ok then return port end  -- port is free if connect fails
  end
  return nil
end

local function findFreeADBPort()
  local socket_ok, socket = pcall(require, "socket")
  if not socket_ok then return 5556 end  -- fallback
  for port = 5556, 5599 do
    local s = socket.tcp()
    s:settimeout(0.1)
    local ok, err = s:connect("127.0.0.1", port)
    s:close()
    if not ok then return port end
  end
  return nil
end

local function spawnProcess(cmd)
  local handle = io.popen("sh -c '" .. cmd .. " & echo $!' 2>/dev/null", "r")
  if not handle then return nil end
  local output = handle:read("*l")
  handle:close()
  if not output then return nil end
  local pid = tonumber(output:match("(%d+)"))
  return pid
end

-- ============================================================================
-- Source type parsing
-- ============================================================================

local VM_EXTENSIONS = {
  iso = true, img = true, qcow2 = true, qcow = true,
  vmdk = true, vdi = true, vhd = true,
}

local function parseSource(source)
  if not source then return nil end

  -- Virtual display
  if source == "self" or source == "display" then
    return { type = "display" }
  end
  local displayRes = source:match("^display:(.+)$")
  if displayRes then
    return { type = "display", resolution = displayRes }
  end

  -- Direct VNC connection (vnc:host:port)
  local vncHost, vncPort = source:match("^vnc:([%w%.%-]+):(%d+)$")
  if vncHost and vncPort then
    return { type = "vnc_direct", host = vncHost, port = tonumber(vncPort) }
  end

  -- Explicit VM prefix
  local vmPath = source:match("^vm:(.+)$")
  if vmPath then
    return { type = "vm", path = vmPath }
  end

  -- Virtual monitor capture (XShm on a named xrandr region)
  local monName = source:match("^monitor:(.+)$")
  if monName then
    return { type = "monitor", name = monName }
  end

  -- Screen capture
  local screenIdx = source:match("^screen:(%d+)$")
  if screenIdx then
    return { type = "screen", index = tonumber(screenIdx) }
  end

  -- Webcam
  local camIdx = source:match("^cam:(%d+)$")
  if camIdx then
    return { type = "cam", device = "/dev/video" .. camIdx, index = tonumber(camIdx) }
  end

  -- HDMI capture
  local hdmiIdx = source:match("^hdmi:(%d+)$")
  if hdmiIdx then
    return { type = "hdmi", device = "/dev/video" .. hdmiIdx, index = tonumber(hdmiIdx) }
  end

  -- Window capture
  local winTitle = source:match("^window:(.+)$")
  if winTitle then
    return { type = "window", title = winTitle }
  end

  -- Direct v4l2 device
  if source:match("^/dev/video%d+$") then
    return { type = "v4l2", device = source }
  end

  -- Auto-detect VM by file extension
  local ext = source:match("%.(%w+)$")
  if ext and VM_EXTENSIONS[ext:lower()] then
    return { type = "vm", path = source }
  end

  return { type = "unknown", raw = source }
end

-- ============================================================================
-- FFmpeg fallback (for cam/hdmi/v4l2/window/display sources)
-- ============================================================================

local function buildFFmpegCmd(parsed, opts)
  local fps = opts.fps or 30
  local resolution = opts.resolution or "1280x720"
  local w, h = resolution:match("^(%d+)x(%d+)$")
  w = tonumber(w) or 1280
  h = tonumber(h) or 720

  local Q = "-nostdin -loglevel quiet -probesize 32 -analyzeduration 0 -fflags nobuffer -flags low_delay"

  if parsed.type == "cam" or parsed.type == "hdmi" or parsed.type == "v4l2" then
    return string.format(
      "ffmpeg %s -f v4l2 -framerate %d -video_size %dx%d -i %s "
      .. "-f rawvideo -pix_fmt rgba -an -sn - 2>/dev/null",
      Q, fps, w, h, parsed.device
    ), w, h

  elseif parsed.type == "window" then
    return string.format(
      "bash -c '"
      .. "WID=$(xdotool search --name \"%s\" | head -1); "
      .. "if [ -z \"$WID\" ]; then exit 1; fi; "
      .. "ffmpeg %s -f x11grab -framerate %d -window_id $WID "
      .. "-i %s -vf scale=%d:%d "
      .. "-f rawvideo -pix_fmt rgba -an -sn - 2>/dev/null"
      .. "'",
      parsed.title, Q, fps, os.getenv("DISPLAY") or ":0", w, h
    ), w, h

  else
    return nil, 0, 0
  end
end

local READER_THREAD_CODE = [[
local controlChannel = love.thread.getChannel(...)
local feedId = controlChannel:demand()
local cmd = controlChannel:demand()
local frameW = controlChannel:demand()
local frameH = controlChannel:demand()

local frameChannel = love.thread.getChannel("render_frames_" .. feedId)
local statusChannel = love.thread.getChannel("render_status_" .. feedId)
local frameSize = frameW * frameH * 4

statusChannel:push("starting")

local proc = io.popen(cmd, "r")
if not proc then
  statusChannel:push("error:Failed to start FFmpeg")
  return
end

statusChannel:push("running")

while true do
  local ctrl = controlChannel:pop()
  if ctrl == "stop" then break end

  local frameData = proc:read(frameSize)
  if not frameData or #frameData < frameSize then
    statusChannel:push("error:FFmpeg pipe closed")
    break
  end

  frameChannel:clear()
  frameChannel:push(frameData)
end

proc:close()
statusChannel:push("stopped")
]]

-- ============================================================================
-- VNC reader thread (for VM capture via QEMU VNC)
-- ============================================================================

local VNC_READER_THREAD_CODE = [=[
local controlChannel = love.thread.getChannel(...)
local feedId = controlChannel:demand()
local host = controlChannel:demand()
local port = controlChannel:demand()
local targetFps = controlChannel:demand()

local frameChannel = love.thread.getChannel("render_frames_" .. feedId)
local statusChannel = love.thread.getChannel("render_status_" .. feedId)
local infoChannel = love.thread.getChannel("render_info_" .. feedId)

local socket = require("socket")

-- X11 keysym mapping for Love2D key names
local KEYSYM = {
  ["return"] = 0xff0d, ["escape"] = 0xff1b, ["backspace"] = 0xff08,
  ["tab"] = 0xff09, ["space"] = 0x20, ["delete"] = 0xffff,
  ["up"] = 0xff52, ["down"] = 0xff54, ["left"] = 0xff51, ["right"] = 0xff53,
  ["home"] = 0xff50, ["end"] = 0xff57, ["pageup"] = 0xff55, ["pagedown"] = 0xff56,
  ["insert"] = 0xff63,
  ["lshift"] = 0xffe1, ["rshift"] = 0xffe2,
  ["lctrl"] = 0xffe3, ["rctrl"] = 0xffe4,
  ["lalt"] = 0xffe9, ["ralt"] = 0xffea,
  ["lgui"] = 0xffeb, ["rgui"] = 0xffec,
  ["capslock"] = 0xffe5, ["numlock"] = 0xff7f, ["scrolllock"] = 0xff14,
  ["f1"] = 0xffbe, ["f2"] = 0xffbf, ["f3"] = 0xffc0, ["f4"] = 0xffc1,
  ["f5"] = 0xffc2, ["f6"] = 0xffc3, ["f7"] = 0xffc4, ["f8"] = 0xffc5,
  ["f9"] = 0xffc6, ["f10"] = 0xffc7, ["f11"] = 0xffc8, ["f12"] = 0xffc9,
  ["-"] = 0x2d, ["="] = 0x3d, ["["] = 0x5b, ["]"] = 0x5d,
  ["\\"] = 0x5c, [";"] = 0x3b, ["'"] = 0x27, ["`"] = 0x60,
  [","] = 0x2c, ["."] = 0x2e, ["/"] = 0x2f,
}

local function keyToKeysym(key)
  if KEYSYM[key] then return KEYSYM[key] end
  if #key == 1 then return string.byte(key) end
  return nil
end

--- Encode a 16-bit big-endian value as two bytes
local function u16be(n)
  return string.char(math.floor(n / 256) % 256, n % 256)
end

--- Encode a 32-bit big-endian value as four bytes
local function u32be(n)
  return string.char(
    math.floor(n / 16777216) % 256,
    math.floor(n / 65536) % 256,
    math.floor(n / 256) % 256,
    n % 256
  )
end

--- Decode 16-bit big-endian from string at offset (1-based)
local function readU16(s, off)
  return string.byte(s, off) * 256 + string.byte(s, off + 1)
end

--- Decode 32-bit big-endian from string at offset (1-based)
local function readU32(s, off)
  return string.byte(s, off) * 16777216
       + string.byte(s, off + 1) * 65536
       + string.byte(s, off + 2) * 256
       + string.byte(s, off + 3)
end

--- Receive exactly n bytes (blocking)
local function recvExact(sock, n)
  local parts = {}
  local got = 0
  while got < n do
    local data, err, partial = sock:receive(n - got)
    if data then
      parts[#parts + 1] = data
      got = got + #data
    elseif partial and #partial > 0 then
      parts[#parts + 1] = partial
      got = got + #partial
    else
      return nil, err
    end
  end
  return table.concat(parts)
end

statusChannel:push("connecting")

-- Connect with retries (QEMU takes time to start)
local sock
for attempt = 1, 30 do
  sock = socket.tcp()
  sock:settimeout(2)
  local ok = sock:connect(host, port)
  if ok then break end
  sock:close()
  sock = nil
  socket.sleep(1)
  local ctrl = controlChannel:pop()
  if ctrl == "stop" then statusChannel:push("stopped"); return end
end

if not sock then
  statusChannel:push("error:Failed to connect to VNC server")
  return
end

-- RFB version handshake
sock:settimeout(5)
local serverVer = recvExact(sock, 12)
if not serverVer then
  statusChannel:push("error:No RFB version from server")
  sock:close()
  return
end
sock:send("RFB 003.008\n")

-- Security handshake
local nTypesRaw = recvExact(sock, 1)
if not nTypesRaw then
  statusChannel:push("error:No security types")
  sock:close()
  return
end
local nTypes = string.byte(nTypesRaw)
if nTypes == 0 then
  -- Server sent error
  statusChannel:push("error:VNC server refused connection")
  sock:close()
  return
end
local types = recvExact(sock, nTypes)
-- Select SecurityType 1 (None) -- QEMU localhost uses no auth
sock:send(string.char(1))
-- SecurityResult for RFB 3.8 (4 bytes, 0 = OK)
local secResult = recvExact(sock, 4)
if not secResult or readU32(secResult, 1) ~= 0 then
  statusChannel:push("error:VNC security handshake failed")
  sock:close()
  return
end

-- ClientInit: shared = true
sock:send(string.char(1))

-- ServerInit: width(2) + height(2) + pixelFormat(16) + nameLen(4) + name
local serverInit = recvExact(sock, 24)
if not serverInit then
  statusChannel:push("error:No ServerInit")
  sock:close()
  return
end
local fbWidth = readU16(serverInit, 1)
local fbHeight = readU16(serverInit, 3)
local nameLen = readU32(serverInit, 25 - 4)  -- bytes 21-24
if nameLen > 0 and nameLen < 10000 then
  recvExact(sock, nameLen)  -- discard server name
end

-- Report actual dimensions to main thread
infoChannel:push(fbWidth)
infoChannel:push(fbHeight)

-- SetPixelFormat: 32bpp RGBA (matches Love2D ImageData layout)
sock:send(string.char(0, 0, 0, 0) -- type=0, padding x3
  .. string.char(
    32,   -- bits-per-pixel
    24,   -- depth
    0,    -- big-endian = false (little-endian)
    1,    -- true-colour = true
    0, 255, -- red-max = 255
    0, 255, -- green-max = 255
    0, 255, -- blue-max = 255
    0,    -- red-shift = 0
    8,    -- green-shift = 8
    16,   -- blue-shift = 16
    0, 0, 0 -- padding
  ))

-- SetEncodings: RAW + DesktopSize pseudo-encoding (-223 = 0xFFFFFF21)
-- DesktopSize notifies us when the VM switches display resolution (e.g. GRUB→SDL2)
sock:send(string.char(2, 0) .. u16be(2) .. u32be(0) .. u32be(0xFFFFFF21))

statusChannel:push("ready")

local frameInterval = 1.0 / targetFps
local firstFrame = true

while true do
  -- Process control messages (stop + input forwarding)
  local ctrl = controlChannel:pop()
  while ctrl do
    if ctrl == "stop" then
      sock:close()
      statusChannel:push("stopped")
      return
    end
    -- Input forwarding: "key:<down|up>:<keysym>"
    local kdir, kval = ctrl:match("^key:(%a+):(%d+)$")
    if kdir and kval then
      local keysym = tonumber(kval)
      if keysym then
        -- KeyEvent: type(1) + downFlag(1) + padding(2) + key(4)
        sock:send(string.char(4, kdir == "down" and 1 or 0, 0, 0) .. u32be(keysym))
      end
    end
    -- Input forwarding: "mouse:<x>:<y>:<buttonMask>"
    local mx, my, mb = ctrl:match("^mouse:(%d+):(%d+):(%d+)$")
    if mx then
      -- PointerEvent: type(1) + buttonMask(1) + x(2) + y(2)
      sock:send(string.char(5, tonumber(mb)) .. u16be(tonumber(mx)) .. u16be(tonumber(my)))
    end
    ctrl = controlChannel:pop()
  end

  -- Request full framebuffer update (non-incremental — partial rect compositing not yet implemented)
  sock:send(string.char(3, 0) .. u16be(0) .. u16be(0) .. u16be(fbWidth) .. u16be(fbHeight))

  -- Read FramebufferUpdate response
  sock:settimeout(2)
  local msgType = recvExact(sock, 1)
  if not msgType then goto continue end

  if string.byte(msgType) == 0 then
    -- FramebufferUpdate: padding(1) + numRects(2)
    local updateHdr = recvExact(sock, 3)
    if not updateHdr then goto continue end
    local numRects = readU16(updateHdr, 2)

    -- Allocate full framebuffer if needed
    local fullSize = fbWidth * fbHeight * 4
    local framebuf = string.rep("\0", fullSize)
    local gotFullFrame = false

    for r = 1, numRects do
      -- Rectangle header: x(2) + y(2) + w(2) + h(2) + encoding(4)
      local rectHdr = recvExact(sock, 12)
      if not rectHdr then goto continue end

      local rx = readU16(rectHdr, 1)
      local ry = readU16(rectHdr, 3)
      local rw = readU16(rectHdr, 5)
      local rh = readU16(rectHdr, 7)
      local encoding = readU32(rectHdr, 9)

      -- DesktopSize pseudo-encoding (-223 = 0xFFFFFF21): resolution changed
      if encoding == 0xFFFFFF21 then
        fbWidth = rw
        fbHeight = rh
        fullSize = fbWidth * fbHeight * 4
        framebuf = string.rep("\0", fullSize)
        -- Push new dimensions so main thread can resize ImageData
        infoChannel:push(fbWidth)
        infoChannel:push(fbHeight)
      elseif encoding == 0 then
        -- RAW encoding
        local pixSize = rw * rh * 4
        if pixSize > 0 then
          local pixData = recvExact(sock, pixSize)
          if not pixData then goto continue end

          -- If single full-screen rect, use directly
          if rx == 0 and ry == 0 and rw == fbWidth and rh == fbHeight then
            framebuf = pixData
            gotFullFrame = true
          end
          -- Partial rects: would need compositing (skip for V1, most VMs send full frames)
        end
      else
        -- Unknown encoding, skip its pixel data if any
        local pixSize = rw * rh * 4
        if pixSize > 0 then recvExact(sock, pixSize) end
      end
    end

    if gotFullFrame or numRects > 0 then
      frameChannel:clear()
      frameChannel:push(framebuf)
      firstFrame = false
    end
  else
    -- Unknown message type, skip
    -- Bell (type 2) = 0 bytes, ServerCutText (type 3) = read and discard
    if string.byte(msgType) == 3 then
      local cutHdr = recvExact(sock, 7) -- padding(3) + length(4)
      if cutHdr then
        local cutLen = readU32(cutHdr, 4)
        if cutLen > 0 and cutLen < 10000000 then
          recvExact(sock, cutLen)
        end
      end
    end
  end

  ::continue::
  -- Minimal sleep — VNC round-trip is the natural rate limiter
  socket.sleep(0.001)
end
]=]

-- ============================================================================
-- Virtual display management (Xephyr / Xvfb)
-- ============================================================================

local function createDisplayFeed(nodeId, props)
  local resolution = props.resolution or "1920x1080"
  local w, h = parseResolution(resolution)

  local displayNum = findFreeDisplay()
  if not displayNum then
    feeds[nodeId] = { status = "error", error = "No free display number", nodeId = nodeId }
    return feeds[nodeId]
  end

  -- Try Xvfb first (headless, no window), then Xephyr (nested, visible)
  local xServerPid = spawnProcess(string.format(
    "Xvfb :%d -screen 0 %dx%dx24 2>/dev/null",
    displayNum, w, h
  ))
  local xServerType = "xvfb"

  if not xServerPid then
    xServerPid = spawnProcess(string.format(
      "Xephyr :%d -screen %dx%d -no-host-grab -resizeable 2>/dev/null",
      displayNum, w, h
    ))
    xServerType = "xephyr"
  end

  if not xServerPid then
    feeds[nodeId] = { status = "error", error = "Install xvfb or xserver-xephyr: apt install xvfb", nodeId = nodeId }
    return feeds[nodeId]
  end

  local Registry = require("lua.process_registry")
  Registry.register(xServerPid)

  -- Wait for X server to start (poll lock file)
  local waited = 0
  while waited < 5 do
    local f = io.open("/tmp/.X" .. displayNum .. "-lock", "r")
    if f then f:close(); break end
    local sok, s = pcall(require, "socket")
    if sok then s.sleep(0.1) else os.execute("sleep 0.1") end
    waited = waited + 0.1
  end

  Log.log("render", "Virtual display :%d started (%s, pid %d, %dx%d)",
    displayNum, xServerType, xServerPid, w, h)

  -- Auto-launch command into the virtual display
  local appPid
  if props.command and props.command ~= "" then
    local appCmd = string.format("DISPLAY=:%d unset CLAUDECODE; %s", displayNum, props.command)
    Log.log("render", "Launching into :%d: %s", displayNum, appCmd)
    appPid = spawnProcess(appCmd)
    if appPid then
      Registry.register(appPid)
      Log.log("render", "Launched pid %d into :%d", appPid, displayNum)
    else
      Log.log("render", "Failed to launch: %s", appCmd)
    end
  end

  -- Open dedicated X11 connection to the virtual display for XShm capture
  local displayName = string.format(":%d", displayNum)
  local displayDpy, displayRoot, displayScreen
  local xshmCap

  -- Ensure X11/XShm FFI bindings are loaded (normally triggered by screen capture)
  initXShm()

  if libX11 and libXext then
    -- Wait a moment for the X server to be fully ready for connections
    local sok, s = pcall(require, "socket")
    if sok then s.sleep(0.5) else os.execute("sleep 0.5") end

    displayDpy = libX11.XOpenDisplay(displayName)
    if displayDpy ~= nil then
      -- Check XShm on this display
      if libXext.XShmQueryExtension(displayDpy) ~= 0 then
        displayScreen = libX11.XDefaultScreen(displayDpy)
        displayRoot = libX11.XDefaultRootWindow(displayDpy)

        -- Create XShm capture context for this display
        local visual = libX11.XDefaultVisual(displayDpy, displayScreen)
        local depth = libX11.XDefaultDepth(displayDpy, displayScreen)
        local shminfo = ffi.new("XShmSegmentInfo")
        local ximage = libXext.XShmCreateImage(displayDpy, visual, depth, ZPixmap, nil, shminfo, w, h)

        if ximage ~= nil then
          local shmsize = ximage.bytes_per_line * ximage.height
          shminfo.shmid = ffi.C.shmget(IPC_PRIVATE, shmsize, SHM_PERMS)
          if shminfo.shmid >= 0 then
            shminfo.shmaddr = ffi.cast("char*", ffi.C.shmat(shminfo.shmid, nil, 0))
            if shminfo.shmaddr ~= ffi.cast("char*", -1) then
              ximage.data = shminfo.shmaddr
              shminfo.readOnly = 0
              libXext.XShmAttach(displayDpy, shminfo)
              ffi.C.shmctl(shminfo.shmid, IPC_RMID, nil)
              xshmCap = { ximage = ximage, shminfo = shminfo }
              Log.log("render", "XShm capture ready for :%d", displayNum)
            else
              ffi.C.shmctl(shminfo.shmid, IPC_RMID, nil)
              libX11.XFree(ximage)
            end
          else
            libX11.XFree(ximage)
          end
        end
      end

      if not xshmCap then
        libX11.XCloseDisplay(displayDpy)
        displayDpy = nil
        Log.log("render", "XShm not available for :%d, falling back to ffmpeg", displayNum)
      end
    else
      Log.log("render", "Cannot open X connection to :%d", displayNum)
    end
  end

  local imageData = love.image.newImageData(w, h)

  -- If XShm is available, use direct capture (no ffmpeg). Otherwise fall back to ffmpeg.
  local feed
  if xshmCap then
    feed = {
      nodeId = nodeId,
      parsed = { type = "display" },
      backend = "display_xshm",
      width = w,
      height = h,
      imageData = imageData,
      image = nil,
      status = "ready",
      frameCount = 0,
      interactive = props.interactive ~= false,
      source = props.source,
      displayNum = displayNum,
      xServerPid = xServerPid,
      xServerType = xServerType,
      appPid = appPid,
      command = props.command,
      -- Per-display XShm state
      displayDpy = displayDpy,
      displayRoot = displayRoot,
      displayScreen = displayScreen,
      xshmCap = xshmCap,
    }
  else
    -- Fallback: ffmpeg x11grab
    local fps = props.fps or 30
    local Q = "-nostdin -loglevel quiet -probesize 32 -analyzeduration 0 -fflags nobuffer -flags low_delay"
    local cmd = string.format(
      "ffmpeg %s -f x11grab -framerate %d -video_size %dx%d -i :%d -f rawvideo -pix_fmt rgba -an -sn - 2>/dev/null",
      Q, fps, w, h, displayNum
    )
    local feedId = tostring(nodeId):gsub("[^%w]", "_")
    local controlChannel = love.thread.getChannel("render_control_" .. feedId)
    local frameChannel = love.thread.getChannel("render_frames_" .. feedId)
    local statusChannel = love.thread.getChannel("render_status_" .. feedId)
    controlChannel:clear()
    frameChannel:clear()
    statusChannel:clear()
    local thread = love.thread.newThread(READER_THREAD_CODE)
    controlChannel:push(feedId)
    controlChannel:push(cmd)
    controlChannel:push(w)
    controlChannel:push(h)
    thread:start("render_control_" .. feedId)

    feed = {
      nodeId = nodeId,
      parsed = { type = "display" },
      backend = "display",
      width = w,
      height = h,
      imageData = imageData,
      image = nil,
      thread = thread,
      controlChannel = controlChannel,
      frameChannel = frameChannel,
      statusChannel = statusChannel,
      status = "starting",
      frameCount = 0,
      interactive = props.interactive ~= false,
      source = props.source,
      displayNum = displayNum,
      xServerPid = xServerPid,
      xServerType = xServerType,
      appPid = appPid,
      command = props.command,
    }
  end

  feeds[nodeId] = feed
  return feed
end

-- ============================================================================
-- VM management (QEMU + VNC capture)
-- ============================================================================

local function createVMFeed(nodeId, parsed, props)
  local resolution = props.resolution or "1280x720"
  local w, h = parseResolution(resolution)
  local memory = (props.vmMemory and props.vmMemory > 0) and props.vmMemory or 2048
  local cpus = (props.vmCpus and props.vmCpus > 0) and props.vmCpus or 2
  local fps = props.fps or 30

  -- Find free VNC port
  local vncPort = findFreeVNCPort()
  if not vncPort then
    Log.log("render", "No free VNC port for VM")
    feeds[nodeId] = { status = "error", error = "No free VNC port", nodeId = nodeId }
    return feeds[nodeId]
  end
  local vncDisplay = vncPort - 5900

  -- Resolve the ISO/disk path
  local path = parsed.path
  -- If relative path, try to resolve from love.filesystem source
  if not path:match("^/") then
    local srcDir = love.filesystem.getSource()
    if srcDir then path = srcDir .. "/" .. path end
  end

  -- Build QEMU command
  local ext = (path:match("%.(%w+)$") or ""):lower()
  local driveFlags
  if ext == "iso" then
    driveFlags = string.format("-cdrom %q -boot d", path)
  elseif ext == "qcow2" then
    driveFlags = string.format("-drive file=%q,format=qcow2", path)
  elseif ext == "vmdk" then
    driveFlags = string.format("-drive file=%q,format=vmdk", path)
  elseif ext == "vdi" then
    driveFlags = string.format("-drive file=%q,format=vdi", path)
  else
    driveFlags = string.format("-drive file=%q,format=raw", path)
  end

  -- Check for KVM acceleration
  local kvmFlag = ""
  local kvmFile = io.open("/dev/kvm", "r")
  if kvmFile then
    kvmFile:close()
    kvmFlag = "-enable-kvm"
  end

  -- Find free ADB port for host forwarding
  local adbPort = findFreeADBPort()
  local netFlags = ""
  if adbPort then
    netFlags = string.format("-netdev user,id=net0,hostfwd=tcp::%d-:5555 -device virtio-net-pci,netdev=net0", adbPort)
  end

  local qemuCmd = string.format(
    "qemu-system-x86_64 %s -m %d -smp %d %s %s -vga none -device virtio-vga-gl -display egl-headless -vnc :%d -usb -device usb-tablet",
    kvmFlag, memory, cpus, driveFlags, netFlags, vncDisplay
  )

  Log.log("render", "Starting VM: %s (ADB port: %s)", qemuCmd, tostring(adbPort))

  local qemuPid = spawnProcess(qemuCmd)
  if not qemuPid then
    Log.log("render", "Failed to start QEMU")
    feeds[nodeId] = { status = "error", error = "Failed to start QEMU. Is qemu-system-x86_64 installed?", nodeId = nodeId }
    return feeds[nodeId]
  end

  -- Register for cleanup
  local Registry = require("lua.process_registry")
  Registry.register(qemuPid)

  Log.log("render", "VM started (pid %d, VNC :%d, %dMB RAM, %d CPUs)", qemuPid, vncDisplay, memory, cpus)

  -- Start VNC reader thread
  local feedId = tostring(nodeId):gsub("[^%w]", "_")
  local controlChannel = love.thread.getChannel("render_control_" .. feedId)
  local frameChannel = love.thread.getChannel("render_frames_" .. feedId)
  local statusChannel = love.thread.getChannel("render_status_" .. feedId)
  local infoChannel = love.thread.getChannel("render_info_" .. feedId)

  controlChannel:clear()
  frameChannel:clear()
  statusChannel:clear()
  infoChannel:clear()

  local thread = love.thread.newThread(VNC_READER_THREAD_CODE)
  controlChannel:push(feedId)
  controlChannel:push("127.0.0.1")
  controlChannel:push(vncPort)
  controlChannel:push(fps)
  thread:start("render_control_" .. feedId)

  -- VNC will report actual framebuffer dimensions via infoChannel
  -- For now, use requested resolution (will be updated in updateAll)
  local imageData = love.image.newImageData(w, h)

  local feed = {
    nodeId = nodeId,
    parsed = parsed,
    backend = "vnc",
    width = w,
    height = h,
    imageData = imageData,
    image = nil,
    thread = thread,
    controlChannel = controlChannel,
    frameChannel = frameChannel,
    statusChannel = statusChannel,
    infoChannel = infoChannel,
    status = "connecting",
    frameCount = 0,
    interactive = props.interactive ~= false,  -- default true for VMs
    source = props.source,
    qemuPid = qemuPid,
    vncPort = vncPort,
    vncDisplay = vncDisplay,
    vncDimsReceived = false,
    adbPort = adbPort,
  }

  feeds[nodeId] = feed
  return feed
end

-- ============================================================================
-- Direct VNC connection (no QEMU spawn)
-- ============================================================================

local function createVNCDirectFeed(nodeId, parsed, props)
  local resolution = props.resolution or "1280x720"
  local w, h = parseResolution(resolution)
  local fps = props.fps or 30
  local host = parsed.host
  local port = parsed.port

  Log.log("render", "Connecting to VNC at %s:%d", host, port)

  -- Start VNC reader thread
  local feedId = tostring(nodeId):gsub("[^%w]", "_")
  local controlChannel = love.thread.getChannel("render_control_" .. feedId)
  local frameChannel = love.thread.getChannel("render_frames_" .. feedId)
  local statusChannel = love.thread.getChannel("render_status_" .. feedId)
  local infoChannel = love.thread.getChannel("render_info_" .. feedId)

  controlChannel:clear()
  frameChannel:clear()
  statusChannel:clear()
  infoChannel:clear()

  local thread = love.thread.newThread(VNC_READER_THREAD_CODE)
  controlChannel:push(feedId)
  controlChannel:push(host)
  controlChannel:push(port)
  controlChannel:push(fps)
  thread:start("render_control_" .. feedId)

  local imageData = love.image.newImageData(w, h)

  local feed = {
    nodeId = nodeId,
    parsed = parsed,
    backend = "vnc",
    width = w,
    height = h,
    imageData = imageData,
    image = nil,
    thread = thread,
    controlChannel = controlChannel,
    frameChannel = frameChannel,
    statusChannel = statusChannel,
    infoChannel = infoChannel,
    status = "connecting",
    frameCount = 0,
    interactive = props.interactive ~= false,
    source = props.source,
    vncPort = port,
    vncDisplay = port - 5900,
  }

  feeds[nodeId] = feed
  return feed
end

-- ============================================================================
-- Feed lifecycle
-- ============================================================================

function RenderSource.create(nodeId, props)
  local parsed = parseSource(props.source)
  if not parsed or parsed.type == "unknown" then
    Log.log("render", "Unknown source: %s", tostring(props.source))
    return { status = "error", error = "Unknown source: " .. tostring(props.source) }
  end

  -- Virtual display
  if parsed.type == "display" then
    return createDisplayFeed(nodeId, props)
  end

  -- Direct VNC
  if parsed.type == "vnc_direct" then
    return createVNCDirectFeed(nodeId, parsed, props)
  end

  -- VM
  if parsed.type == "vm" then
    return createVMFeed(nodeId, parsed, props)
  end

  -- Monitor capture: XShm on a named xrandr virtual monitor region
  if parsed.type == "monitor" and initXShm() then
    local monName = parsed.name
    local rw, rh = 1920, 1080
    if props.resolution then
      local pw, ph = props.resolution:match("^(%d+)x(%d+)$")
      if pw then rw, rh = tonumber(pw), tonumber(ph) end
    end

    -- Get current screen extent
    local screenW = libX11.XDisplayWidth(xdpy, xscreen)
    local screenH = libX11.XDisplayHeight(xdpy, xscreen)

    -- Query existing monitor geometry or create it to the right of the screen
    local ox, oy = screenW, 0
    local handle = io.popen("xrandr --listmonitors 2>/dev/null")
    if handle then
      for line in handle:lines() do
        -- Match: " N: +MonName WxH+X+Y ..."
        local mw, mh, mx, my, name = line:match("(%d+)/[%d]+x(%d+)/[%d]+%+(%d+)%+(%d+)%s+(%S+)$")
        if name == monName then
          ox, oy = tonumber(mx), tonumber(my)
          rw, rh = tonumber(mw), tonumber(mh)
          break
        end
      end
      handle:close()
    end

    -- Extend framebuffer if needed and register the virtual monitor
    local needW = ox + rw
    local needH = math.max(screenH, oy + rh)
    if needW > screenW or needH > screenH then
      os.execute(string.format("xrandr --fb %dx%d 2>/dev/null", needW, needH))
      Log.log("render", "Extended framebuffer to %dx%d for monitor:%s", needW, needH, monName)
    end

    -- Create/update the virtual monitor
    os.execute(string.format(
      "xrandr --setmonitor %s %d/%dx%d/%d+%d+%d none 2>/dev/null",
      monName, rw, 0, rh, 0, ox, oy
    ))
    Log.log("render", "Registered virtual monitor %s: %dx%d+%d+%d", monName, rw, rh, ox, oy)

    local cap = createXShmCapture(rw, rh)
    if cap then
      local imageData = love.image.newImageData(rw, rh)
      local feed = {
        nodeId = nodeId,
        parsed = parsed,
        backend = "xshm",
        width = rw,
        height = rh,
        captureOX = ox,
        captureOY = oy,
        xshmCap = cap,
        imageData = imageData,
        image = nil,
        status = "ready",
        frameCount = 0,
        interactive = props.interactive == true,
        source = props.source,
        monitorName = monName,
      }
      feeds[nodeId] = feed
      return feed
    end
  end

  -- Screen capture: XShm fast path
  if parsed.type == "screen" and initXShm() then
    local screenW = libX11.XDisplayWidth(xdpy, xscreen)
    local screenH = libX11.XDisplayHeight(xdpy, xscreen)

    -- Use explicit resolution if specified, otherwise capture full screen
    local w, h = screenW, screenH
    if props.resolution then
      local rw, rh = props.resolution:match("^(%d+)x(%d+)$")
      if rw then w, h = tonumber(rw), tonumber(rh) end
    end

    local cap = createXShmCapture(w, h)
    if cap then
      local imageData = love.image.newImageData(w, h)
      local feed = {
        nodeId = nodeId,
        parsed = parsed,
        backend = "xshm",
        width = w,
        height = h,
        xshmCap = cap,
        imageData = imageData,
        image = nil,
        status = "ready",
        frameCount = 0,
        interactive = props.interactive == true,
        source = props.source,
      }
      feeds[nodeId] = feed
      return feed
    end
    -- XShm failed, fall through to FFmpeg
  end

  -- Window capture: XShm on root window at window's position (captures composited GL content)
  if parsed.type == "window" and initXShm() then
    -- Find window position via xdotool
    local handle = io.popen(string.format(
      'bash -c \'WID=$(xdotool search --name "%s" | head -1); '
      .. 'if [ -n "$WID" ]; then eval $(xdotool getwindowgeometry --shell $WID); '
      .. 'echo "$WID $X $Y $WIDTH $HEIGHT"; fi\' 2>/dev/null', parsed.title))
    local line = handle and handle:read("*l") or nil
    if handle then handle:close() end

    if line then
      local wid, wx, wy, ww, wh = line:match("(%d+) (%d+) (%d+) (%d+) (%d+)")
      wid = tonumber(wid)
      wx = tonumber(wx)
      wy = tonumber(wy)
      ww = tonumber(ww)
      wh = tonumber(wh)

      if wid and ww and wh then
        -- Clamp capture region to root window bounds (BadMatch if out of bounds)
        local screenW = libX11.XDisplayWidth(xdpy, xscreen)
        local screenH = libX11.XDisplayHeight(xdpy, xscreen)
        if wx + ww > screenW then ww = screenW - wx end
        if wy + wh > screenH then wh = screenH - wy end
        if wx < 0 then ww = ww + wx; wx = 0 end
        if wy < 0 then wh = wh + wy; wy = 0 end
        if ww <= 0 or wh <= 0 then
          Log.log("render", "Window %s is offscreen, skipping", parsed.title)
          return nil
        end

        local cap = createXShmCapture(ww, wh)
        if cap then
          local imageData = love.image.newImageData(ww, wh)
          local feed = {
            nodeId = nodeId,
            parsed = parsed,
            backend = "xshm",
            width = ww,
            height = wh,
            captureOX = wx,
            captureOY = wy,
            xshmCap = cap,
            imageData = imageData,
            image = nil,
            status = "ready",
            frameCount = 0,
            interactive = props.interactive == true,
            source = props.source,
            windowTitle = parsed.title,
          }
          feeds[nodeId] = feed
          Log.log("render", "XShm window capture (root+offset): %s at +%d+%d %dx%d", parsed.title, wx, wy, ww, wh)
          return feed
        end
      end
    else
      Log.log("render", "Window not found: %s", parsed.title)
    end
  end

  -- FFmpeg fallback for cam/hdmi/v4l2/window (and screen if XShm unavailable)
  local opts = {
    fps = props.fps or 30,
    resolution = props.resolution or "1280x720",
  }

  -- For screen sources that couldn't use XShm, build FFmpeg command
  local cmd, w, h
  if parsed.type == "screen" then
    local resolution = props.resolution or "1280x720"
    w, h = resolution:match("^(%d+)x(%d+)$")
    w = tonumber(w) or 1280
    h = tonumber(h) or 720
    local Q = "-nostdin -loglevel quiet -probesize 32 -analyzeduration 0 -fflags nobuffer -flags low_delay"
    local display = os.getenv("DISPLAY") or ":0"
    cmd = string.format(
      "ffmpeg %s -f x11grab -framerate %d -video_size %dx%d -i %s "
      .. "-f rawvideo -pix_fmt rgba -an -sn - 2>/dev/null",
      Q, opts.fps, w, h, display
    )
  else
    cmd, w, h = buildFFmpegCmd(parsed, opts)
  end

  if not cmd then
    return { status = "error", error = "No capture method for: " .. tostring(props.source) }
  end

  local imageData = love.image.newImageData(w, h)

  local feedId = tostring(nodeId):gsub("[^%w]", "_")
  local controlChannel = love.thread.getChannel("render_control_" .. feedId)
  local frameChannel = love.thread.getChannel("render_frames_" .. feedId)
  local statusChannel = love.thread.getChannel("render_status_" .. feedId)

  controlChannel:clear()
  frameChannel:clear()
  statusChannel:clear()

  local thread = love.thread.newThread(READER_THREAD_CODE)
  controlChannel:push(feedId)
  controlChannel:push(cmd)
  controlChannel:push(w)
  controlChannel:push(h)
  thread:start("render_control_" .. feedId)

  local feed = {
    nodeId = nodeId,
    parsed = parsed,
    backend = "ffmpeg",
    width = w,
    height = h,
    imageData = imageData,
    image = nil,
    thread = thread,
    controlChannel = controlChannel,
    frameChannel = frameChannel,
    statusChannel = statusChannel,
    status = "starting",
    frameCount = 0,
    interactive = props.interactive == true,
    source = props.source,
  }

  feeds[nodeId] = feed
  return feed
end

-- Actually destroy a feed (kill processes, free resources)
local function destroyFeedFinal(feed)
  local Registry = require("lua.process_registry")

  if feed.backend == "xshm" then
    destroyXShmCapture(feed.xshmCap)

  elseif feed.backend == "ffmpeg" then
    if feed.controlChannel then feed.controlChannel:push("stop") end
    if feed.thread and feed.thread:isRunning() then feed.thread:wait() end
    if feed.frameChannel then feed.frameChannel:clear() end
    if feed.statusChannel then feed.statusChannel:clear() end
    if feed.controlChannel then feed.controlChannel:clear() end

  elseif feed.backend == "display_xshm" then
    if feed.xshmCap and feed.displayDpy then
      libXext.XShmDetach(feed.displayDpy, feed.xshmCap.shminfo)
      ffi.C.shmdt(feed.xshmCap.shminfo.shmaddr)
      feed.xshmCap.ximage.data = nil
      libX11.XFree(feed.xshmCap.ximage)
    end
    if feed.displayDpy then
      libX11.XCloseDisplay(feed.displayDpy)
    end
    if feed.appPid then
      os.execute("kill " .. feed.appPid .. " 2>/dev/null")
      Registry.unregister(feed.appPid)
    end
    if feed.xServerPid then
      os.execute("kill " .. feed.xServerPid .. " 2>/dev/null")
      Registry.unregister(feed.xServerPid)
      Log.log("render", "Virtual display :%d stopped", feed.displayNum or 0)
    end

  elseif feed.backend == "display" then
    if feed.controlChannel then feed.controlChannel:push("stop") end
    if feed.thread and feed.thread:isRunning() then feed.thread:wait() end
    if feed.frameChannel then feed.frameChannel:clear() end
    if feed.statusChannel then feed.statusChannel:clear() end
    if feed.controlChannel then feed.controlChannel:clear() end
    if feed.appPid then
      os.execute("kill " .. feed.appPid .. " 2>/dev/null")
      Registry.unregister(feed.appPid)
    end
    if feed.xServerPid then
      os.execute("kill " .. feed.xServerPid .. " 2>/dev/null")
      Registry.unregister(feed.xServerPid)
      Log.log("render", "Virtual display :%d stopped (pid %d)", feed.displayNum or 0, feed.xServerPid)
    end

  elseif feed.backend == "vnc" then
    if feed.controlChannel then feed.controlChannel:push("stop") end
    if feed.thread and feed.thread:isRunning() then feed.thread:wait() end
    if feed.frameChannel then feed.frameChannel:clear() end
    if feed.statusChannel then feed.statusChannel:clear() end
    if feed.infoChannel then feed.infoChannel:clear() end
    if feed.controlChannel then feed.controlChannel:clear() end
    if feed.qemuPid then
      os.execute("kill " .. feed.qemuPid .. " 2>/dev/null")
      Registry.unregister(feed.qemuPid)
      Log.log("render", "VM stopped (pid %d)", feed.qemuPid)
    end
  end

  if feed.imageData then feed.imageData:release() end
  if feed.image then feed.image:release() end

  -- Remove xrandr virtual monitor if this was a monitor: source
  if feed.monitorName then
    os.execute(string.format("xrandr --delmonitor %s 2>/dev/null", feed.monitorName))
    Log.log("render", "Removed virtual monitor: %s", feed.monitorName)
  end
end

function RenderSource.destroy(nodeId)
  local feed = feeds[nodeId]
  if not feed then return end

  -- Recycle feeds instead of killing — they might be remounted after tree restructure
  local recycleKey = feed.command or feed.source
  local recyclable = feed.backend == "display_xshm" or feed.backend == "display" or feed.backend == "vnc"
  if recyclable and recycleKey then
    feed.nodeId = nil  -- detach from old node
    recyclePool[recycleKey] = { feed = feed, recycledAt = love.timer.getTime() }
    feeds[nodeId] = nil
    Log.log("render", "Recycled feed (%s): %s", feed.backend, recycleKey)
    return
  end

  destroyFeedFinal(feed)
  feeds[nodeId] = nil
end

-- ============================================================================
-- Per-frame sync and update
-- ============================================================================

function RenderSource.syncWithTree(nodes)
  -- Phase 1: collect which Render nodes exist
  local seen = {}
  for id, node in pairs(nodes) do
    if node.type == "Render" then
      seen[id] = true
    end
  end

  -- Phase 2: destroy/recycle feeds for removed nodes FIRST (fills the pool)
  for id in pairs(feeds) do
    if not seen[id] then
      RenderSource.destroy(id)
    end
  end

  -- Phase 3: create/update feeds (can now find recycled feeds in the pool)
  for id, node in pairs(nodes) do
    if node.type == "Render" then
      local props = node.props or {}

      if not feeds[id] then
        -- Check recycle pool for a matching feed (by command or source)
        local poolKey = props.command or props.source
        if poolKey and recyclePool[poolKey] then
          local recycled = recyclePool[poolKey]
          local feed = recycled.feed
          feed.nodeId = id
          feeds[id] = feed
          recyclePool[poolKey] = nil
          Log.log("render", "Reused recycled feed for: %s", poolKey)
        else
          RenderSource.create(id, props)
        end
      elseif feeds[id].source ~= props.source
          or (feeds[id].command and feeds[id].command ~= (props.command or "")) then
        -- Source or command changed (e.g. tile swap) — recycle old, grab or create new
        RenderSource.destroy(id)
        local poolKey = props.command or props.source
        if poolKey and recyclePool[poolKey] then
          local recycled = recyclePool[poolKey]
          local feed = recycled.feed
          feed.nodeId = id
          feeds[id] = feed
          recyclePool[poolKey] = nil
          Log.log("render", "Reused recycled feed for: %s", poolKey)
        else
          RenderSource.create(id, props)
        end
      end
    end
  end
end

function RenderSource.updateAll()
  -- Clean up expired recycled feeds
  local now = love.timer.getTime()
  for cmd, entry in pairs(recyclePool) do
    if now - entry.recycledAt > RECYCLE_TTL then
      Log.log("render", "Recycle expired, destroying: %s", cmd)
      destroyFeedFinal(entry.feed)
      recyclePool[cmd] = nil
    end
  end

  for nodeId, feed in pairs(feeds) do

    if feed.backend == "xshm" then
      -- XShm fast path: capture directly on main thread (<1ms)
      local dest = ffi.cast("uint8_t*", feed.imageData:getFFIPointer())
      local ox = feed.captureOX or 0
      local oy = feed.captureOY or 0
      local ok = captureXShm(feed.xshmCap, xroot, ox, oy, dest,
        feed.width, feed.height)

      if ok then
        if feed.image then
          feed.image:replacePixels(feed.imageData)
        else
          feed.image = love.graphics.newImage(feed.imageData)
          feed.image:setFilter("linear", "linear")
        end
        feed.frameCount = feed.frameCount + 1
      end

    elseif feed.backend == "display_xshm" then
      -- Direct XShm capture from virtual display (no ffmpeg)
      local dest = ffi.cast("uint8_t*", feed.imageData:getFFIPointer())
      -- Use per-display connection and root window
      local cap = feed.xshmCap
      local dpy = feed.displayDpy
      local root = feed.displayRoot
      local ok = libXext.XShmGetImage(dpy, root, cap.ximage, 0, 0, 0xFFFFFFFFULL)
      if ok ~= 0 then
        -- BGRX -> RGBA conversion
        local src = ffi.cast("uint8_t*", cap.ximage.data)
        local bpl = cap.ximage.bytes_per_line
        local w, h = feed.width, feed.height
        if bpl == w * 4 then
          for i = 0, w * h * 4 - 1, 4 do
            dest[i]     = src[i + 2]
            dest[i + 1] = src[i + 1]
            dest[i + 2] = src[i]
            dest[i + 3] = 255
          end
        else
          for y = 0, h - 1 do
            local srcRow = y * bpl
            local dstRow = y * w * 4
            for x = 0, w - 1 do
              local si = srcRow + x * 4
              local di = dstRow + x * 4
              dest[di]     = src[si + 2]
              dest[di + 1] = src[si + 1]
              dest[di + 2] = src[si]
              dest[di + 3] = 255
            end
          end
        end

        if feed.image then
          feed.image:replacePixels(feed.imageData)
        else
          feed.image = love.graphics.newImage(feed.imageData)
          feed.image:setFilter("linear", "linear")
        end
        feed.frameCount = feed.frameCount + 1
      end

    elseif feed.backend == "ffmpeg" or feed.backend == "display" then
      -- FFmpeg/display: read from thread channel
      local status = feed.statusChannel:pop()
      while status do
        if status:match("^error:") then
          feed.status = "error"
          feed.error = status:sub(7)
        elseif status == "running" then
          feed.status = "ready"
        elseif status == "stopped" then
          feed.status = "stopped"
        end
        status = feed.statusChannel:pop()
      end

      local frameData = feed.frameChannel:pop()
      if frameData and #frameData == feed.width * feed.height * 4 then
        local ptr = ffi.cast("uint8_t*", feed.imageData:getFFIPointer())
        ffi.copy(ptr, frameData, #frameData)

        if feed.image then
          feed.image:replacePixels(feed.imageData)
        else
          feed.image = love.graphics.newImage(feed.imageData)
          feed.image:setFilter("linear", "linear")
        end
        feed.frameCount = feed.frameCount + 1
      end

    elseif feed.backend == "vnc" then
      -- VNC: read status and dimension info from thread
      local status = feed.statusChannel:pop()
      while status do
        if status:match("^error:") then
          feed.status = "error"
          feed.error = status:sub(7)
          Log.log("render", "VNC error: %s", feed.error)
        elseif status == "ready" then
          feed.status = "ready"
        elseif status == "stopped" then
          feed.status = "stopped"
        end
        status = feed.statusChannel:pop()
      end

      -- Check for dimension info from VNC (initial handshake + DesktopSize resize events)
      if feed.infoChannel then
        local vncW = feed.infoChannel:pop()
        local vncH = feed.infoChannel:pop()
        if vncW and vncH then
          -- If VNC framebuffer size differs from our ImageData, recreate
          if vncW ~= feed.width or vncH ~= feed.height then
            Log.log("render", "VNC framebuffer resize: %dx%d (was %dx%d)", vncW, vncH, feed.width, feed.height)
            feed.width = vncW
            feed.height = vncH
            if feed.imageData then feed.imageData:release() end
            if feed.image then feed.image:release(); feed.image = nil end
            feed.imageData = love.image.newImageData(vncW, vncH)
            -- Clear stale frames with old dimensions
            feed.frameChannel:clear()
          end
        end
      end

      -- Read frame data from VNC reader thread
      local frameData = feed.frameChannel:pop()
      if frameData and #frameData == feed.width * feed.height * 4 then
        local ptr = ffi.cast("uint8_t*", feed.imageData:getFFIPointer())
        ffi.copy(ptr, frameData, #frameData)

        -- VNC sends depth=24 (RGB + padding byte=0). Love2D needs alpha=255.
        local npx = feed.width * feed.height
        for i = 0, npx - 1 do
          ptr[i * 4 + 3] = 255
        end

        if feed.image then
          feed.image:replacePixels(feed.imageData)
        else
          feed.image = love.graphics.newImage(feed.imageData)
          feed.image:setFilter("linear", "linear")
        end
        feed.frameCount = feed.frameCount + 1
      end
    end
  end
end

function RenderSource.renderAll()
  -- No-op: painter draws the Image directly
end

-- ============================================================================
-- Image retrieval
-- ============================================================================

function RenderSource.get(nodeId)
  local feed = feeds[nodeId]
  if not feed then return nil end
  return feed.image
end

function RenderSource.getStatus(nodeId)
  local feed = feeds[nodeId]
  return feed and feed.status or "none"
end

function RenderSource.getDimensions(nodeId)
  local feed = feeds[nodeId]
  if not feed then return nil, nil end
  return feed.width, feed.height
end

--- Convert screen coordinates to source-local coordinates.
--- Accounts for the node's position and objectFit scaling.
--- @param nodeId any    Node ID
--- @param screenX number  Screen X
--- @param screenY number  Screen Y
--- @param nodeX number    Node computed X
--- @param nodeY number    Node computed Y
--- @param nodeW number    Node computed width
--- @param nodeH number    Node computed height
--- @param objectFit string  "contain", "cover", or "fill"
--- @return number, number  Source-local X, Y
function RenderSource.screenToLocal(nodeId, screenX, screenY, nodeX, nodeY, nodeW, nodeH, objectFit)
  local feed = feeds[nodeId]
  if not feed then return screenX - nodeX, screenY - nodeY end

  local srcW, srcH = feed.width, feed.height
  local lx = screenX - nodeX
  local ly = screenY - nodeY

  objectFit = objectFit or "contain"

  if objectFit == "contain" then
    local scale = math.min(nodeW / srcW, nodeH / srcH)
    local drawW = srcW * scale
    local drawH = srcH * scale
    local offsetX = (nodeW - drawW) / 2
    local offsetY = (nodeH - drawH) / 2
    lx = (lx - offsetX) / scale
    ly = (ly - offsetY) / scale
  elseif objectFit == "cover" then
    local scale = math.max(nodeW / srcW, nodeH / srcH)
    local drawW = srcW * scale
    local drawH = srcH * scale
    local offsetX = (nodeW - drawW) / 2
    local offsetY = (nodeH - drawH) / 2
    lx = (lx - offsetX) / scale
    ly = (ly - offsetY) / scale
  else -- "fill"
    lx = lx * srcW / nodeW
    ly = ly * srcH / nodeH
  end

  return lx, ly
end

--- Get the virtual display number (for "display" backend, so apps can target it)
function RenderSource.getDisplayNum(nodeId)
  local feed = feeds[nodeId]
  if not feed then return nil end
  return feed.displayNum
end

--- Get VM info (for "vnc" backend)
function RenderSource.getVMInfo(nodeId)
  local feed = feeds[nodeId]
  if not feed or feed.backend ~= "vnc" then return nil end
  return {
    pid = feed.qemuPid,
    vncPort = feed.vncPort,
    vncDisplay = feed.vncDisplay,
    memory = feed.parsed and feed.parsed.memory,
  }
end

-- ============================================================================
-- Input forwarding
-- ============================================================================

function RenderSource.forwardMouse(nodeId, eventType, localX, localY, button)
  local feed = feeds[nodeId]
  if not feed or not feed.interactive then return end

  local parsed = feed.parsed

  if feed.backend == "vnc" then
    -- VNC protocol: every PointerEvent must include the FULL current button state
    if feed.controlChannel then
      if not feed.vncButtonMask then feed.vncButtonMask = 0 end
      local bit_val = 0
      if button == 1 then bit_val = 1
      elseif button == 2 then bit_val = 4
      elseif button == 3 then bit_val = 2 end

      if eventType == "mousepressed" then
        feed.vncButtonMask = bit.bor(feed.vncButtonMask, bit_val)
      elseif eventType == "mousereleased" then
        feed.vncButtonMask = bit.band(feed.vncButtonMask, bit.bnot(bit_val))
      end
      -- mousemoved: keep current mask unchanged
      feed.controlChannel:push(string.format("mouse:%d:%d:%d",
        math.floor(localX), math.floor(localY), feed.vncButtonMask))
    end
    return
  end

  if feed.backend == "display" or feed.backend == "display_xshm" then
    -- xdotool on the virtual display
    local displayEnv = string.format("DISPLAY=:%d", feed.displayNum)
    local sx, sy = math.floor(localX), math.floor(localY)
    if eventType == "mousepressed" then
      os.execute(string.format("%s xdotool mousemove %d %d mousedown %d &", displayEnv, sx, sy, button))
    elseif eventType == "mousereleased" then
      os.execute(string.format("%s xdotool mousemove %d %d mouseup %d &", displayEnv, sx, sy, button))
    elseif eventType == "mousemoved" then
      os.execute(string.format("%s xdotool mousemove %d %d &", displayEnv, sx, sy))
    end
    return
  end

  -- Screen / window capture: xdotool on main display
  if parsed.type == "screen" then
    local sx, sy = math.floor(localX), math.floor(localY)
    if eventType == "mousepressed" then
      os.execute(string.format("xdotool mousemove %d %d mousedown %d &", sx, sy, button))
    elseif eventType == "mousereleased" then
      os.execute(string.format("xdotool mousemove %d %d mouseup %d &", sx, sy, button))
    elseif eventType == "mousemoved" then
      os.execute(string.format("xdotool mousemove %d %d &", sx, sy))
    end

  elseif parsed.type == "window" then
    if eventType == "mousepressed" then
      os.execute(string.format(
        "bash -c 'WID=$(xdotool search --name \"%s\" | head -1); "
        .. "xdotool mousemove --window $WID %d %d mousedown %d' &",
        parsed.title, math.floor(localX), math.floor(localY), button
      ))
    elseif eventType == "mousereleased" then
      os.execute(string.format(
        "bash -c 'WID=$(xdotool search --name \"%s\" | head -1); "
        .. "xdotool mousemove --window $WID %d %d mouseup %d' &",
        parsed.title, math.floor(localX), math.floor(localY), button
      ))
    end
  end
end

-- Map Love2D key names to X11 keysym names (xdotool format)
local LOVE_TO_X11 = {
  ["backspace"] = "BackSpace", ["return"] = "Return", ["escape"] = "Escape",
  ["tab"] = "Tab", ["space"] = "space", ["delete"] = "Delete",
  ["up"] = "Up", ["down"] = "Down", ["left"] = "Left", ["right"] = "Right",
  ["home"] = "Home", ["end"] = "End", ["pageup"] = "Prior", ["pagedown"] = "Next",
  ["insert"] = "Insert",
  ["lshift"] = "Shift_L", ["rshift"] = "Shift_R",
  ["lctrl"] = "Control_L", ["rctrl"] = "Control_R",
  ["lalt"] = "Alt_L", ["ralt"] = "Alt_R",
  ["lgui"] = "Super_L", ["rgui"] = "Super_R",
  ["capslock"] = "Caps_Lock", ["numlock"] = "Num_Lock", ["scrolllock"] = "Scroll_Lock",
  ["f1"] = "F1", ["f2"] = "F2", ["f3"] = "F3", ["f4"] = "F4",
  ["f5"] = "F5", ["f6"] = "F6", ["f7"] = "F7", ["f8"] = "F8",
  ["f9"] = "F9", ["f10"] = "F10", ["f11"] = "F11", ["f12"] = "F12",
}

function RenderSource.forwardKey(nodeId, eventType, key)
  local feed = feeds[nodeId]
  if not feed or not feed.interactive then return end

  -- Translate Love2D key name to X11 keysym name
  local xkey = LOVE_TO_X11[key] or key

  if feed.backend == "vnc" then
    -- VNC protocol key forwarding via control channel
    if feed.controlChannel then
      -- Map Love2D key name to X11 keysym
      local keysym
      local KEYSYM = {
        ["return"] = 0xff0d, ["escape"] = 0xff1b, ["backspace"] = 0xff08,
        ["tab"] = 0xff09, ["space"] = 0x20, ["delete"] = 0xffff,
        ["up"] = 0xff52, ["down"] = 0xff54, ["left"] = 0xff51, ["right"] = 0xff53,
        ["home"] = 0xff50, ["end"] = 0xff57, ["pageup"] = 0xff55, ["pagedown"] = 0xff56,
        ["insert"] = 0xff63,
        ["lshift"] = 0xffe1, ["rshift"] = 0xffe2,
        ["lctrl"] = 0xffe3, ["rctrl"] = 0xffe4,
        ["lalt"] = 0xffe9, ["ralt"] = 0xffea,
        ["lgui"] = 0xffeb, ["rgui"] = 0xffec,
        ["capslock"] = 0xffe5, ["numlock"] = 0xff7f, ["scrolllock"] = 0xff14,
        ["f1"] = 0xffbe, ["f2"] = 0xffbf, ["f3"] = 0xffc0, ["f4"] = 0xffc1,
        ["f5"] = 0xffc2, ["f6"] = 0xffc3, ["f7"] = 0xffc4, ["f8"] = 0xffc5,
        ["f9"] = 0xffc6, ["f10"] = 0xffc7, ["f11"] = 0xffc8, ["f12"] = 0xffc9,
      }
      keysym = KEYSYM[key]
      if not keysym and #key == 1 then keysym = string.byte(key) end
      if keysym then
        local dir = (eventType == "keypressed") and "down" or "up"
        feed.controlChannel:push(string.format("key:%s:%d", dir, keysym))
      end
    end
    return
  end

  if feed.backend == "display" or feed.backend == "display_xshm" then
    local displayEnv = string.format("DISPLAY=:%d", feed.displayNum)
    if eventType == "keypressed" then
      os.execute(string.format("%s xdotool keydown %s &", displayEnv, xkey))
    elseif eventType == "keyreleased" then
      os.execute(string.format("%s xdotool keyup %s &", displayEnv, xkey))
    end
    return
  end

  -- Screen / window capture
  local parsed = feed.parsed
  if parsed.type == "screen" or parsed.type == "window" then
    if eventType == "keypressed" then
      os.execute(string.format("xdotool keydown %s &", xkey))
    elseif eventType == "keyreleased" then
      os.execute(string.format("xdotool keyup %s &", xkey))
    end
  end
end

function RenderSource.forwardText(nodeId, text)
  local feed = feeds[nodeId]
  if not feed or not feed.interactive then return end

  if feed.backend == "vnc" then
    -- VNC: send each character as key press/release
    if feed.controlChannel then
      for i = 1, #text do
        local ch = text:sub(i, i)
        local keysym = string.byte(ch)
        feed.controlChannel:push(string.format("key:down:%d", keysym))
        feed.controlChannel:push(string.format("key:up:%d", keysym))
      end
    end
    return
  end

  if feed.backend == "display" or feed.backend == "display_xshm" then
    local displayEnv = string.format("DISPLAY=:%d", feed.displayNum)
    -- xdotool type handles UTF-8 and special chars properly
    -- Escape single quotes in the text for shell safety
    local escaped = text:gsub("'", "'\\''")
    os.execute(string.format("%s xdotool type -- '%s' &", displayEnv, escaped))
    return
  end

  -- Screen / window capture
  local parsed = feed.parsed
  if parsed.type == "screen" or parsed.type == "window" then
    local escaped = text:gsub("'", "'\\''")
    os.execute(string.format("xdotool type -- '%s' &", escaped))
  end
end

function RenderSource.isInteractive(nodeId)
  local feed = feeds[nodeId]
  return feed and feed.interactive or false
end

-- ============================================================================
-- Cleanup
-- ============================================================================

function RenderSource.clearAll()
  for nodeId in pairs(feeds) do
    RenderSource.destroy(nodeId)
  end
  -- Close the shared X11 display connection (for screen capture)
  if xdpy ~= nil then
    libX11.XCloseDisplay(xdpy)
    xdpy = nil
    xshm_ok = false
  end
end

return RenderSource
