--[[
  overlay_shm.lua — Shared memory transport for fullscreen game overlay

  Love2D renders the overlay to an FBO (Canvas), then copies pixels into
  a POSIX shared memory segment each frame. The LD_PRELOAD hook in the
  game process reads this segment and composites it onto the game's
  framebuffer.

  Protocol matches native/overlay-hook/overlay_hook.c:
    Offset 0:   uint32 magic    (0x524A4954 = "RJIT")
    Offset 4:   uint32 width
    Offset 8:   uint32 height
    Offset 12:  uint32 frame_seq (incremented each frame)
    Offset 16:  uint32 flags    (bit 0: visible, bit 1: interactive)
    Offset 20:  12 bytes padding (align to 32)
    Offset 32:  width * height * 4 bytes RGBA pixel data
]]

local ffi = require("ffi")

local OverlaySHM = {}

-- ── POSIX shm + mmap FFI ────────────────────────────────────────────────────

pcall(ffi.cdef, [[
  int shm_open(const char* name, int oflag, unsigned int mode);
  int shm_unlink(const char* name);
  int ftruncate(int fd, long length);
  void* mmap(void* addr, size_t len, int prot, int flags, int fd, long offset);
  int munmap(void* addr, size_t len);
  int close(int fd);
  int getpid(void);

  // GL (already declared by videos.lua or bridge, but pcall protects us)
  void glReadPixels(int x, int y, int width, int height,
                    unsigned int format, unsigned int type, void* data);
]])

-- Constants
local O_CREAT  = 0x40
local O_RDWR   = 0x02
local PROT_READ  = 0x1
local PROT_WRITE = 0x2
local MAP_SHARED = 0x01
local MAP_FAILED = ffi.cast("void*", -1)

local RJIT_MAGIC = 0x524A4954
local SHM_HEADER_SIZE = 32
local FLAG_VISIBLE  = 1
local FLAG_INTERACT = 2

local GL_RGBA          = 0x1908
local GL_UNSIGNED_BYTE = 0x1401
local GL_FRAMEBUFFER_BINDING = 0x8CA6

-- ── State ───────────────────────────────────────────────────────────────────

local shmName   = nil   -- "/rjit-overlay-{pid}"
local shmFd     = -1
local shmPtr    = nil   -- uint8_t* mmap'd region
local shmSize   = 0
local shmHeader = nil   -- cast to header struct
local canvas    = nil   -- Love2D Canvas (FBO)
local canvasW   = 0
local canvasH   = 0
local frameSeq  = 0

-- Pre-allocated buffer for GL state query
local savedFbo = ffi.new("int[1]")

-- ── Header struct (cast over shm region) ────────────────────────────────────

ffi.cdef[[
  typedef struct {
    uint32_t magic;
    uint32_t width;
    uint32_t height;
    uint32_t frame_seq;
    uint32_t flags;
    uint8_t  _pad[12];
  } rjit_shm_header_t;
]]

-- ── Public API ──────────────────────────────────────────────────────────────

function OverlaySHM.init(width, height)
  canvasW = width or love.graphics.getWidth()
  canvasH = height or love.graphics.getHeight()

  local pid = ffi.C.getpid()
  shmName = string.format("/rjit-overlay-%d", pid)

  -- Total size: header + pixels
  shmSize = SHM_HEADER_SIZE + canvasW * canvasH * 4

  -- Create shared memory segment
  shmFd = ffi.C.shm_open(shmName, bit.bor(O_CREAT, O_RDWR), tonumber("0666", 8))
  if shmFd < 0 then
    io.write("[overlay_shm] ERROR: shm_open failed\n"); io.flush()
    return false
  end

  -- Set size
  if ffi.C.ftruncate(shmFd, shmSize) ~= 0 then
    io.write("[overlay_shm] ERROR: ftruncate failed\n"); io.flush()
    ffi.C.close(shmFd)
    ffi.C.shm_unlink(shmName)
    shmFd = -1
    return false
  end

  -- Map
  shmPtr = ffi.C.mmap(nil, shmSize, bit.bor(PROT_READ, PROT_WRITE), MAP_SHARED, shmFd, 0)
  if shmPtr == MAP_FAILED then
    io.write("[overlay_shm] ERROR: mmap failed\n"); io.flush()
    ffi.C.close(shmFd)
    ffi.C.shm_unlink(shmName)
    shmFd = -1
    shmPtr = nil
    return false
  end

  -- Zero the region
  ffi.fill(shmPtr, shmSize, 0)

  -- Write header
  shmHeader = ffi.cast("rjit_shm_header_t*", shmPtr)
  shmHeader.magic     = RJIT_MAGIC
  shmHeader.width     = canvasW
  shmHeader.height    = canvasH
  shmHeader.frame_seq = 0
  shmHeader.flags     = FLAG_VISIBLE  -- start visible

  -- Create Love2D Canvas for FBO rendering
  canvas = love.graphics.newCanvas(canvasW, canvasH)

  io.write(string.format(
    "[overlay_shm] Created %s (%d x %d, %.1f MB)\n",
    shmName, canvasW, canvasH, shmSize / 1024 / 1024
  ))
  io.flush()

  -- Print the shm name so the CLI can read it
  io.write("RJIT_SHM_READY:" .. shmName .. "\n")
  io.flush()

  return true
end

function OverlaySHM.getName()
  return shmName
end

function OverlaySHM.beginFrame()
  if not canvas then return end
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 0)
end

function OverlaySHM.endFrame(overlayState)
  if not canvas or not shmPtr then return end

  love.graphics.setCanvas()  -- back to default target

  -- Read pixels from the Canvas FBO into the shm pixel region
  -- We need to bind the canvas FBO, then glReadPixels
  love.graphics.setCanvas(canvas)

  ffi.C.glGetIntegerv(GL_FRAMEBUFFER_BINDING, savedFbo)
  local pixelDst = ffi.cast("uint8_t*", shmPtr) + SHM_HEADER_SIZE
  ffi.C.glReadPixels(0, 0, canvasW, canvasH, GL_RGBA, GL_UNSIGNED_BYTE, pixelDst)

  love.graphics.setCanvas()

  -- Update header
  frameSeq = frameSeq + 1
  shmHeader.frame_seq = frameSeq

  -- Update flags from overlay state
  if overlayState then
    local flags = 0
    if overlayState.mode ~= "hidden" then
      flags = bit.bor(flags, FLAG_VISIBLE)
    end
    if overlayState.mode == "interactive" then
      flags = bit.bor(flags, FLAG_INTERACT)
    end
    shmHeader.flags = flags
  end
end

function OverlaySHM.getCanvas()
  return canvas
end

function OverlaySHM.shutdown()
  if shmPtr and shmPtr ~= MAP_FAILED then
    ffi.C.munmap(shmPtr, shmSize)
    shmPtr = nil
    shmHeader = nil
  end
  if shmFd >= 0 then
    ffi.C.close(shmFd)
    shmFd = -1
  end
  if shmName then
    ffi.C.shm_unlink(shmName)
    io.write("[overlay_shm] Unlinked " .. shmName .. "\n"); io.flush()
    shmName = nil
  end
  if canvas then
    canvas:release()
    canvas = nil
  end
end

return OverlaySHM
