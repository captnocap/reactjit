--[[
  sdl2_init.lua -- SDL2 entry point for the iLoveReact SDL2 target

  Replaces Love2D's load/update/draw callbacks with a direct SDL2 run loop.
  Loads the QuickJS bridge, wires up the React reconciler, translates SDL2
  input events into framework events, and paints each frame with the GL painter.

  Usage (project main.lua):
    require("lua.sdl2_init").run({
      bundle = "sdl2/bundle.js",   -- compiled JS bundle
      width  = 1280,
      height = 720,
      title  = "My App",
    })
]]

local ffi = require("ffi")
local bit = require("bit")
local GL  = require("lua.sdl2_gl")

-- ============================================================================
-- SDL2 FFI
-- ============================================================================

ffi.cdef[[
  /* Basic SDL types */
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid; uint32_t which;
                   uint8_t button; uint8_t state; uint8_t clicks; uint8_t pad;
                   int32_t x; int32_t y; }  SDL2_MouseButtonEvent;
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid; uint32_t which;
                   uint32_t state; int32_t x; int32_t y; int32_t xrel; int32_t yrel; }
                   SDL2_MouseMotionEvent;
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid; uint32_t which;
                   int32_t x; int32_t y; uint32_t direction; }
                   SDL2_MouseWheelEvent;
  typedef struct { uint32_t scancode; int32_t sym; uint16_t mod; uint16_t unused; }
                   SDL2_Keysym;
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid;
                   uint8_t state; uint8_t repeat; uint8_t p2; uint8_t p3;
                   SDL2_Keysym keysym; }
                   SDL2_KeyboardEvent;
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid; char text[32]; }
                   SDL2_TextInputEvent;
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid;
                   uint8_t event; uint8_t p1; uint8_t p2; uint8_t p3;
                   int32_t data1; int32_t data2; }
                   SDL2_WindowEvent;
  typedef union {
    uint32_t               type;
    SDL2_MouseButtonEvent  button;
    SDL2_MouseMotionEvent  motion;
    SDL2_MouseWheelEvent   wheel;
    SDL2_KeyboardEvent     key;
    SDL2_TextInputEvent    text;
    SDL2_WindowEvent       window;
    uint8_t                padding[56];
  } SDL2_Event;

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
  void          SDL_GetWindowSize(SDL_Window *win, int *w, int *h);
  void          SDL_StartTextInput(void);
]]

local sdl = ffi.load("SDL2")

local SDL_INIT_VIDEO       = 0x00000020
local SDL_WINDOW_OPENGL    = 0x00000002
local SDL_WINDOW_SHOWN     = 0x00000004
local SDL_WINDOW_RESIZABLE = 0x00000020
local SDL_WINDOWPOS_CENTERED = 0x2FFF0000

local SDL_QUIT         = 0x100
local SDL_WINDOWEVENT  = 0x200
local SDL_KEYDOWN      = 0x300
local SDL_KEYUP        = 0x301
local SDL_TEXTINPUT    = 0x303
local SDL_MOUSEMOTION  = 0x400
local SDL_MOUSEBTNDOWN = 0x401
local SDL_MOUSEBTNUP   = 0x402
local SDL_MOUSEWHEEL   = 0x403

local SDL_WINDOWEVENT_RESIZED = 5

-- SDL_GLattr
local GL_RED_SIZE              = 0
local GL_GREEN_SIZE            = 1
local GL_BLUE_SIZE             = 2
local GL_ALPHA_SIZE            = 3
local GL_DOUBLEBUFFER          = 5
local GL_DEPTH_SIZE            = 6
local GL_STENCIL_SIZE          = 7
local GL_CONTEXT_MAJOR_VERSION = 17
local GL_CONTEXT_MINOR_VERSION = 18

-- ============================================================================
-- Key mapping: SDL2 Keycode → Love2D-compatible key name
-- ============================================================================

local KEYMAP = {
  [13]         = "return",
  [27]         = "escape",
  [8]          = "backspace",
  [9]          = "tab",
  [32]         = "space",
  [0x4000004f] = "right",
  [0x40000050] = "left",
  [0x40000051] = "down",
  [0x40000052] = "up",
  [0x4000007f] = "delete",
  [0x4000004a] = "home",
  [0x4000004d] = "end",
  [0x4000004b] = "pageup",
  [0x4000004e] = "pagedown",
  [0x4000003a] = "f1",  [0x4000003b] = "f2",  [0x4000003c] = "f3",
  [0x4000003d] = "f4",  [0x4000003e] = "f5",  [0x4000003f] = "f6",
  [0x40000040] = "f7",  [0x40000041] = "f8",  [0x40000042] = "f9",
  [0x40000043] = "f10", [0x40000044] = "f11", [0x40000045] = "f12",
}

local function sdlKeynameToLove(sym)
  local mapped = KEYMAP[sym]
  if mapped then return mapped end
  -- Printable ASCII (space=32 handled above)
  if sym >= 33 and sym <= 126 then return string.char(sym) end
  return "unknown"
end

-- ============================================================================
-- Module
-- ============================================================================

local SDL2Init = {}

function SDL2Init.run(config)
  config = config or {}
  local W     = config.width  or 1280
  local H     = config.height or 720
  local title = config.title  or "iLoveReact"
  local bundle = config.bundle or "sdl2/bundle.js"

  -- ------------------------------------------------------------------
  -- 1. SDL2 + OpenGL window
  -- ------------------------------------------------------------------
  if sdl.SDL_Init(SDL_INIT_VIDEO) ~= 0 then
    error("[sdl2_init] SDL_Init: " .. ffi.string(sdl.SDL_GetError()))
  end

  sdl.SDL_GL_SetAttribute(GL_RED_SIZE,              8)
  sdl.SDL_GL_SetAttribute(GL_GREEN_SIZE,            8)
  sdl.SDL_GL_SetAttribute(GL_BLUE_SIZE,             8)
  sdl.SDL_GL_SetAttribute(GL_ALPHA_SIZE,            8)
  sdl.SDL_GL_SetAttribute(GL_DOUBLEBUFFER,          1)
  sdl.SDL_GL_SetAttribute(GL_DEPTH_SIZE,            24)
  sdl.SDL_GL_SetAttribute(GL_STENCIL_SIZE,          8)
  sdl.SDL_GL_SetAttribute(GL_CONTEXT_MAJOR_VERSION, 2)
  sdl.SDL_GL_SetAttribute(GL_CONTEXT_MINOR_VERSION, 1)

  local window = sdl.SDL_CreateWindow(
    title,
    SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, W, H,
    bit.bor(SDL_WINDOW_OPENGL, SDL_WINDOW_SHOWN, SDL_WINDOW_RESIZABLE)
  )
  if window == nil then
    error("[sdl2_init] SDL_CreateWindow: " .. ffi.string(sdl.SDL_GetError()))
  end

  local ctx = sdl.SDL_GL_CreateContext(window)
  if ctx == nil then
    error("[sdl2_init] SDL_GL_CreateContext: " .. ffi.string(sdl.SDL_GetError()))
  end

  -- Actual drawable size (handles HiDPI scaling)
  local dw = ffi.new("int[1]"); local dh = ffi.new("int[1]")
  sdl.SDL_GL_GetDrawableSize(window, dw, dh)
  -- Window size (for mouse coordinate mapping)
  local ww = ffi.new("int[1]"); local wh = ffi.new("int[1]")
  sdl.SDL_GetWindowSize(window, ww, wh)
  W, H = dw[0], dh[0]
  local scaleX = W / ww[0]
  local scaleY = H / wh[0]
  io.write("[sdl2_init] " .. W .. "x" .. H .. " (scale " .. scaleX .. "x" .. scaleY .. ")\n"); io.flush()

  -- ------------------------------------------------------------------
  -- 2. OpenGL state
  -- ------------------------------------------------------------------
  GL.glViewport(0, 0, W, H)
  GL.glClearColor(0.05, 0.05, 0.09, 1.0)
  GL.glEnable(GL.BLEND)
  GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)

  GL.glMatrixMode(GL.PROJECTION)
  GL.glLoadIdentity()
  GL.glOrtho(0, W, H, 0, -1, 1)   -- top-left origin
  GL.glMatrixMode(GL.MODELVIEW)
  GL.glLoadIdentity()

  -- Enable SDL text input (fires SDL_TEXTINPUT events)
  sdl.SDL_StartTextInput()

  -- ------------------------------------------------------------------
  -- 3. Framework subsystems
  -- ------------------------------------------------------------------
  local Target  = require("lua.target_sdl2")
  local Font    = require("lua.sdl2_font")
  local Painter = Target.painter
  local Measure = Target.measure

  Font.init(config.fontFamily)
  Painter.init({ width = W, height = H })

  local ok_json, json = pcall(require, "lua.json")
  if not ok_json then error("[sdl2_init] lua.json required") end

  local tree    = require("lua.tree")
  local layout  = require("lua.layout")
  local events  = require("lua.events")
  events.setTreeModule(tree)
  layout.init({ measure = Measure })

  local Bridge  = require("lua.bridge_quickjs")
  local bridge  = Bridge.new("lib/libquickjs.so")
  bridge:eval("globalThis.__deferMount = true;", "<pre-bundle>")
  bridge:eval(io.open(bundle):read("*a"), bundle)
  bridge:callGlobal("__mount")
  bridge:tick()
  -- Push initial viewport
  bridge:pushEvent({ type="viewport", payload={width=W, height=H} })

  local needsLayout = true
  local root

  -- ------------------------------------------------------------------
  -- 4. Run loop
  -- ------------------------------------------------------------------
  local event   = ffi.new("SDL2_Event")
  local running = true
  local TARGET_MS = math.floor(1000/60)
  local mx, my  = 0, 0

  io.write("[sdl2_init] entering run loop\n"); io.flush()

  while running do
    local frameStart = sdl.SDL_GetTicks()

    -- ---- Event pump ----
    while sdl.SDL_PollEvent(event) == 1 do
      local t = event.type

      if t == SDL_QUIT then
        running = false

      elseif t == SDL_WINDOWEVENT then
        if event.window.event == SDL_WINDOWEVENT_RESIZED then
          -- Recalculate drawable vs window sizes for HiDPI
          sdl.SDL_GL_GetDrawableSize(window, dw, dh)
          sdl.SDL_GetWindowSize(window, ww, wh)
          W, H = dw[0], dh[0]
          scaleX = W / ww[0]
          scaleY = H / wh[0]
          GL.glViewport(0, 0, W, H)
          GL.glMatrixMode(GL.PROJECTION)
          GL.glLoadIdentity()
          GL.glOrtho(0, W, H, 0, -1, 1)
          GL.glMatrixMode(GL.MODELVIEW)
          Painter.setDimensions(W, H)
          bridge:pushEvent({ type="viewport", payload={width=W, height=H} })
          needsLayout = true
        end

      elseif t == SDL_MOUSEMOTION then
        mx = event.motion.x * scaleX
        my = event.motion.y * scaleY
        if root then
          events.updateHover(root, mx, my)
        end

      elseif t == SDL_MOUSEBTNDOWN or t == SDL_MOUSEBTNUP then
        local btn    = event.button.button  -- 1=left, 2=middle, 3=right
        mx = event.button.x * scaleX
        my = event.button.y * scaleY
        if root then
          local hit = events.hitTest(root, mx, my)
          if hit then
            if t == SDL_MOUSEBTNDOWN then
              events.setPressedNode(hit)
              local path = events.buildBubblePath(hit)
              bridge:pushEvent(
                events.createEvent("click", hit.id, mx, my, btn, path))
            else
              events.clearPressedNode()
              local path = events.buildBubblePath(hit)
              bridge:pushEvent(
                events.createEvent("release", hit.id, mx, my, btn, path))
            end
          elseif t == SDL_MOUSEBTNUP then
            events.clearPressedNode()
          end
        end

      elseif t == SDL_MOUSEWHEEL then
        local dx = event.wheel.x
        local dy = event.wheel.y
        if root then
          local hit = events.hitTest(root, mx, my)
          if hit then
            -- Update Lua-side scroll state for immediate visual response
            local scrollContainer = events.findScrollableContainer(hit, dx, -dy)
            if scrollContainer and scrollContainer.scrollState then
              local ss = scrollContainer.scrollState
              local scrollSpeed = 40
              local newScrollX = (ss.scrollX or 0) - dx * scrollSpeed
              local newScrollY = (ss.scrollY or 0) - dy * scrollSpeed
              tree.setScroll(scrollContainer.id, newScrollX, newScrollY)
              needsLayout = true
            end
            -- Send wheel event to JS
            local path = events.buildBubblePath(hit)
            bridge:pushEvent(
              events.createWheelEvent(hit.id, mx, my, dx, -dy, path))
          end
        end

      elseif t == SDL_KEYDOWN or t == SDL_KEYUP then
        local evtype  = (t == SDL_KEYDOWN) and "keydown" or "keyup"
        local sym     = event.key.keysym.sym
        local scan    = event.key.keysym.scancode
        local kmod    = event.key.keysym.mod
        local isRep   = event.key["repeat"] ~= 0
        local keyname = sdlKeynameToLove(sym)
        local mods = {
          ctrl  = bit.band(kmod, 0x00C0) ~= 0,  -- KMOD_CTRL
          shift = bit.band(kmod, 0x0003) ~= 0,  -- KMOD_SHIFT
          alt   = bit.band(kmod, 0x0300) ~= 0,  -- KMOD_ALT
          meta  = bit.band(kmod, 0x0C00) ~= 0,  -- KMOD_GUI
        }
        bridge:pushEvent(events.createKeyEvent(evtype, keyname, tostring(scan), isRep, mods))

      elseif t == SDL_TEXTINPUT then
        local text = ffi.string(event.text.text)
        if text ~= "" then
          bridge:pushEvent(events.createTextInputEvent(text))
        end
      end
    end

    -- ---- Bridge tick ----
    bridge:tick()
    pcall(function() bridge:callGlobal("_pollAndDispatchEvents") end)

    -- ---- Drain commands → update tree ----
    local commands = bridge:drainCommands()
    if #commands > 0 then
      tree.applyCommands(commands)
      needsLayout = true
    end

    -- ---- Layout ----
    root = tree.getTree()
    if root and needsLayout then
      layout.layout(root, 0, 0, W, H)
      needsLayout = false
    end

    -- ---- Paint ----
    GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))
    GL.glLoadIdentity()

    if root then
      local ok, err = pcall(Painter.paint, root)
      if not ok then
        io.write("[sdl2_init] paint error: " .. tostring(err) .. "\n")
        io.flush()
      end
    end

    sdl.SDL_GL_SwapWindow(window)

    -- ---- Frame cap ----
    local elapsed = sdl.SDL_GetTicks() - frameStart
    if elapsed < TARGET_MS then sdl.SDL_Delay(TARGET_MS - elapsed) end
  end

  -- ------------------------------------------------------------------
  -- 5. Cleanup
  -- ------------------------------------------------------------------
  bridge:destroy()
  Font.done()
  sdl.SDL_GL_DeleteContext(ctx)
  sdl.SDL_DestroyWindow(window)
  sdl.SDL_Quit()
  io.write("[sdl2_init] clean exit\n"); io.flush()
end

return SDL2Init
