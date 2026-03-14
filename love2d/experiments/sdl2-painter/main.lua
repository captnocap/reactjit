--[[
  main.lua -- SDL2 window + OpenGL context + run loop
  Entry point for the SDL2 painter proof-of-concept.
  Run with: luajit main.lua
]]

local ffi = require("ffi")
local bit = require("bit")

-- ============================================================================
-- SDL2 FFI
-- ============================================================================

ffi.cdef[[
  typedef uint32_t  SDL2_Uint32;
  typedef uint8_t   SDL2_Uint8;
  typedef int32_t   SDL2_Sint32;

  typedef union {
    SDL2_Uint32 type;
    SDL2_Uint8  padding[56];
  } SDL2_Event;

  typedef void SDL_Window;
  typedef void *SDL_GLContext;

  int           SDL_Init(SDL2_Uint32 flags);
  void          SDL_Quit(void);
  SDL_Window   *SDL_CreateWindow(const char *title, int x, int y,
                                  int w, int h, SDL2_Uint32 flags);
  void          SDL_DestroyWindow(SDL_Window *window);
  int           SDL_GL_SetAttribute(int attr, int value);
  SDL_GLContext SDL_GL_CreateContext(SDL_Window *window);
  void          SDL_GL_DeleteContext(SDL_GLContext ctx);
  void          SDL_GL_SwapWindow(SDL_Window *window);
  int           SDL_PollEvent(SDL2_Event *event);
  SDL2_Uint32   SDL_GetTicks(void);
  void          SDL_Delay(SDL2_Uint32 ms);
  const char   *SDL_GetError(void);
]]

local sdl = ffi.load("SDL2")

-- SDL constants
local SDL_INIT_VIDEO        = 0x00000020
local SDL_WINDOW_OPENGL     = 0x00000002
local SDL_WINDOW_SHOWN      = 0x00000004
local SDL_WINDOW_RESIZABLE  = 0x00000020
local SDL_WINDOWPOS_CENTERED = 0x2FFF0000
local SDL_QUIT_EVENT        = 0x100
local SDL_KEYDOWN           = 0x300

-- SDL_GLattr constants
local SDL_GL_RED_SIZE              = 0
local SDL_GL_GREEN_SIZE            = 1
local SDL_GL_BLUE_SIZE             = 2
local SDL_GL_ALPHA_SIZE            = 3
local SDL_GL_DOUBLEBUFFER          = 5
local SDL_GL_DEPTH_SIZE            = 6
local SDL_GL_STENCIL_SIZE          = 7
local SDL_GL_CONTEXT_MAJOR_VERSION = 17
local SDL_GL_CONTEXT_MINOR_VERSION = 18

-- ============================================================================
-- Window & GL context
-- ============================================================================

local W, H = 1280, 720

local err = sdl.SDL_Init(SDL_INIT_VIDEO)
if err ~= 0 then
  error("SDL_Init failed: " .. ffi.string(sdl.SDL_GetError()))
end

sdl.SDL_GL_SetAttribute(SDL_GL_RED_SIZE,              8)
sdl.SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE,            8)
sdl.SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE,             8)
sdl.SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE,            8)
sdl.SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER,          1)
sdl.SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE,            24)
sdl.SDL_GL_SetAttribute(SDL_GL_STENCIL_SIZE,          8)
sdl.SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 2)
sdl.SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 1)

local window = sdl.SDL_CreateWindow(
  "ReactJIT SDL2 Painter",
  SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
  W, H,
  bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN, SDL_WINDOW_RESIZABLE)
)
if window == nil then
  error("SDL_CreateWindow failed: " .. ffi.string(sdl.SDL_GetError()))
end

local ctx = sdl.SDL_GL_CreateContext(window)
if ctx == nil then
  error("SDL_GL_CreateContext failed: " .. ffi.string(sdl.SDL_GetError()))
end

-- ============================================================================
-- OpenGL setup (done here to avoid circular requires)
-- ============================================================================

local GL = require("gl")

GL.glViewport(0, 0, W, H)
GL.glClearColor(0.05, 0.05, 0.09, 1.0)
GL.glEnable(GL.BLEND)
GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)

-- Projection: (0,0) = top-left, (W,H) = bottom-right
GL.glMatrixMode(GL.PROJECTION)
GL.glLoadIdentity()
GL.glOrtho(0, W, H, 0, -1, 1)

GL.glMatrixMode(GL.MODELVIEW)
GL.glLoadIdentity()

-- ============================================================================
-- Init subsystems
-- ============================================================================

local Font    = require("font")
local Painter = require("painter")
local TestScene = require("test_scene")

Font.init()
Painter.init({ width = W, height = H })

-- Pre-build scene once (it's static — no React state here)
local scene = TestScene.build()

print("[main] Entering render loop. Press Escape or close window to exit.")

-- ============================================================================
-- Run loop
-- ============================================================================

local event    = ffi.new("SDL2_Event")
local running  = true
local TARGET_MS = math.floor(1000 / 60)

while running do

  -- Event pump
  while sdl.SDL_PollEvent(event) == 1 do
    if event.type == SDL_QUIT_EVENT then
      running = false
    elseif event.type == SDL_KEYDOWN then
      -- Escape = quit
      -- event.padding[10] is the scancode byte (SDL_Scancode = Uint32 at offset 16)
      -- Simpler: just check quit via close button, skip keycode parsing for POC
    end
  end

  -- Clear
  GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))

  -- Reset modelview
  GL.glLoadIdentity()

  -- Paint
  Painter.paint(scene)

  -- Swap
  sdl.SDL_GL_SwapWindow(window)

  -- ~60 fps cap
  sdl.SDL_Delay(TARGET_MS)
end

-- ============================================================================
-- Cleanup
-- ============================================================================

Font.done()
sdl.SDL_GL_DeleteContext(ctx)
sdl.SDL_DestroyWindow(window)
sdl.SDL_Quit()
print("[main] Clean exit.")
