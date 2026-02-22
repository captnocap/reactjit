--[[
  sdl2_init.lua -- SDL2 entry point for the ReactJIT SDL2 target

  Replaces Love2D's load/update/draw callbacks with a direct SDL2 run loop.
  Loads the QuickJS bridge, wires up the React reconciler, translates SDL2
  input events into framework events, and paints each frame with the GL painter.

  Supports multiple windows: the main window renders the full React tree,
  child windows render subtrees attached to <Window> capability nodes.
  All windows share one QuickJS bridge, one tree, one event queue.

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

local loader = require("lua.lib_loader")
local sdl = loader.load("SDL2")

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

local SDL_WINDOWEVENT_RESIZED      = 5
local SDL_WINDOWEVENT_FOCUS_GAINED = 12
local SDL_WINDOWEVENT_FOCUS_LOST   = 13
local SDL_WINDOWEVENT_CLOSE        = 14

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

--- Get the root node for a given window.
--- For the main window, returns the full tree root.
--- For child windows, returns the Window capability node (whose children
--- are the content to render in that window).
local function getWindowRoot(win, tree)
  if win.isMain then
    return tree.getTree()
  end
  if win.rootNodeId then
    local nodes = tree.getNodes()
    return nodes[win.rootNodeId]
  end
  return nil
end

function SDL2Init.run(config)
  config = config or {}
  local W     = config.width  or 1280
  local H     = config.height or 720
  local title = config.title  or "ReactJIT"
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

  -- ------------------------------------------------------------------
  -- 3a. Window manager (multi-window support)
  -- ------------------------------------------------------------------
  local WM = require("lua.window_manager")
  WM.init(sdl)
  local mainWin = WM.registerMain(window, ctx, W, H)

  -- ------------------------------------------------------------------
  -- 3b. Love2D compatibility shim (for inspector/devtools/console)
  -- ------------------------------------------------------------------
  local Shim = require("lua.sdl2_love_shim")
  Shim.init({
    font   = Font,
    sdl    = sdl,
    width  = W,
    height = H,
  })

  -- ------------------------------------------------------------------
  -- 3c. Devtools (inspector, console, unified panel)
  -- ------------------------------------------------------------------
  local inspector = require("lua.inspector")
  local console   = require("lua.console")
  local devtools  = require("lua.devtools")

  local Bridge  = require("lua.bridge_quickjs")
  local bridge  = Bridge.new("lib/libquickjs.so")
  bridge:eval("globalThis.__deferMount = true;", "<pre-bundle>")
  bridge:eval(io.open(bundle):read("*a"), bundle)
  bridge:callGlobal("__mount")
  bridge:tick()

  -- Helper for viewport events
  local function pushEvent(ev) bridge:pushEvent(ev) end

  -- Init console + devtools
  console.init({ bridge = bridge, tree = tree, inspector = inspector })
  devtools.init({ inspector = inspector, console = console, tree = tree, bridge = bridge, pushEvent = pushEvent })

  -- ------------------------------------------------------------------
  -- 3d. Capabilities (audio, timer, window, etc.)
  -- ------------------------------------------------------------------
  local capabilities = require("lua.capabilities")
  capabilities.loadAll()

  -- Push initial viewport
  bridge:pushEvent({ type="viewport", payload={width=W, height=H} })

  local root

  -- ------------------------------------------------------------------
  -- 4. Run loop
  -- ------------------------------------------------------------------
  local event   = ffi.new("SDL2_Event")
  local running = true
  local TARGET_MS = math.floor(1000/60)

  io.write("[sdl2_init] entering run loop\n"); io.flush()

  while running do
    local frameStart = sdl.SDL_GetTicks()

    -- ---- Event pump ----
    while sdl.SDL_PollEvent(event) == 1 do
      local t = event.type

      if t == SDL_QUIT then
        running = false

      elseif t == SDL_WINDOWEVENT then
        local wid = event.window.wid
        local evtWin = WM.getBySDLId(wid) or mainWin
        local we = event.window.event

        if we == SDL_WINDOWEVENT_RESIZED then
          WM.handleResize(evtWin)
          if evtWin.isMain then
            -- Update main window locals + subsystems
            W, H = evtWin.width, evtWin.height
            scaleX, scaleY = evtWin.scaleX, evtWin.scaleY
            -- GL state update for main context (already current)
            GL.glViewport(0, 0, W, H)
            GL.glMatrixMode(GL.PROJECTION)
            GL.glLoadIdentity()
            GL.glOrtho(0, W, H, 0, -1, 1)
            GL.glMatrixMode(GL.MODELVIEW)
            Painter.setDimensions(W, H)
            Shim.setDimensions(W, H)
            bridge:pushEvent({ type="viewport", payload={width=W, height=H} })
          else
            -- Child window resized — push resize event to capability
            if evtWin.rootNodeId then
              bridge:pushEvent({
                type = "capability",
                payload = {
                  targetId = evtWin.rootNodeId,
                  handler = "onResize",
                  width = evtWin.width,
                  height = evtWin.height,
                },
              })
            end
          end

        elseif we == SDL_WINDOWEVENT_CLOSE then
          if evtWin.isMain then
            running = false
          elseif evtWin.rootNodeId then
            -- Push close event to React — let the user handle it
            bridge:pushEvent({
              type = "capability",
              payload = {
                targetId = evtWin.rootNodeId,
                handler = "onClose",
              },
            })
          end

        elseif we == SDL_WINDOWEVENT_FOCUS_GAINED then
          if not evtWin.isMain and evtWin.rootNodeId then
            bridge:pushEvent({
              type = "capability",
              payload = {
                targetId = evtWin.rootNodeId,
                handler = "onFocus",
              },
            })
          end

        elseif we == SDL_WINDOWEVENT_FOCUS_LOST then
          if not evtWin.isMain and evtWin.rootNodeId then
            bridge:pushEvent({
              type = "capability",
              payload = {
                targetId = evtWin.rootNodeId,
                handler = "onBlur",
              },
            })
          end
        end

      elseif t == SDL_MOUSEMOTION then
        local wid = event.motion.wid
        local evtWin = WM.getBySDLId(wid) or mainWin
        local mx = event.motion.x * evtWin.scaleX
        local my = event.motion.y * evtWin.scaleY
        evtWin.mx, evtWin.my = mx, my

        if evtWin.isMain then
          Shim.setMousePosition(mx, my)
          devtools.mousemoved(mx, my)
        end

        events.setActiveWindow(evtWin)
        local winRoot = getWindowRoot(evtWin, tree)
        if winRoot then
          events.updateHover(winRoot, mx, my)
        end

      elseif t == SDL_MOUSEBTNDOWN or t == SDL_MOUSEBTNUP then
        local wid = event.button.wid
        local evtWin = WM.getBySDLId(wid) or mainWin
        local btn = event.button.button  -- 1=left, 2=middle, 3=right
        local mx = event.button.x * evtWin.scaleX
        local my = event.button.y * evtWin.scaleY
        evtWin.mx, evtWin.my = mx, my

        events.setActiveWindow(evtWin)

        if evtWin.isMain then
          Shim.setMousePosition(mx, my)
        end

        -- Route to devtools first (main window only)
        local devConsumed = false
        if evtWin.isMain then
          if t == SDL_MOUSEBTNDOWN then
            devConsumed = devtools.mousepressed(mx, my, btn)
          else
            devConsumed = devtools.mousereleased(mx, my, btn)
          end
        end

        if not devConsumed then
          local winRoot = getWindowRoot(evtWin, tree)
          if winRoot then
            local hit = events.hitTest(winRoot, mx, my)
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
        end

      elseif t == SDL_MOUSEWHEEL then
        local wid = event.wheel.wid
        local evtWin = WM.getBySDLId(wid) or mainWin
        local dx = event.wheel.x
        local dy = event.wheel.y
        local mx, my = evtWin.mx, evtWin.my

        events.setActiveWindow(evtWin)

        -- Route to devtools first (main window only)
        local devConsumed = evtWin.isMain and devtools.wheelmoved(dx, dy)

        if not devConsumed then
          local winRoot = getWindowRoot(evtWin, tree)
          if winRoot then
            local hit = events.hitTest(winRoot, mx, my)
            if hit then
              -- Update Lua-side scroll state for immediate visual response
              local scrollContainer = events.findScrollableContainer(hit, dx, -dy)
              if scrollContainer and scrollContainer.scrollState then
                local ss = scrollContainer.scrollState
                local scrollSpeed = 40
                local newScrollX = (ss.scrollX or 0) - dx * scrollSpeed
                local newScrollY = (ss.scrollY or 0) - dy * scrollSpeed
                tree.setScroll(scrollContainer.id, newScrollX, newScrollY)
                evtWin.needsLayout = true
              end
              -- Send wheel event to JS
              local path = events.buildBubblePath(hit)
              bridge:pushEvent(
                events.createWheelEvent(hit.id, mx, my, dx, -dy, path))
            end
          end
        end

      elseif t == SDL_KEYDOWN or t == SDL_KEYUP then
        local evtype  = (t == SDL_KEYDOWN) and "keydown" or "keyup"
        local sym     = event.key.keysym.sym
        local scan    = event.key.keysym.scancode
        local kmod    = event.key.keysym.mod
        local isRep   = event.key["repeat"] ~= 0
        local keyname = sdlKeynameToLove(sym)
        local ctrl  = bit.band(kmod, 0x00C0) ~= 0
        local shift = bit.band(kmod, 0x0003) ~= 0
        local alt   = bit.band(kmod, 0x0300) ~= 0
        local meta  = bit.band(kmod, 0x0C00) ~= 0
        local mods = { ctrl = ctrl, shift = shift, alt = alt, meta = meta }

        -- Update shim key state
        Shim.setKeyDown(keyname, t == SDL_KEYDOWN)

        -- ── Lua-side key shortcuts (on keydown only) ──
        local consumed = false
        if t == SDL_KEYDOWN then
          -- Devtools gets first shot at keys (F12, backtick, Escape, etc.)
          if devtools.keypressed(keyname) then
            consumed = true
            mainWin.needsLayout = true

          -- Escape: quit (only if devtools didn't consume it)
          elseif keyname == "escape" then
            running = false
            consumed = true

          -- Ctrl+=/Ctrl+-/Ctrl+0: text scale
          elseif ctrl or meta then
            if keyname == "=" or keyname == "kp+" then
              Measure.setTextScale(Measure.getTextScale() + 0.1)
              if tree then tree.markDirty() end
              mainWin.needsLayout = true
              consumed = true
            elseif keyname == "-" or keyname == "kp-" then
              Measure.setTextScale(Measure.getTextScale() - 0.1)
              if tree then tree.markDirty() end
              mainWin.needsLayout = true
              consumed = true
            elseif keyname == "0" or keyname == "kp0" then
              Measure.setTextScale(1.0)
              if tree then tree.markDirty() end
              mainWin.needsLayout = true
              consumed = true
            end
          end
        end

        -- Forward to JS if not consumed by Lua
        if not consumed then
          bridge:pushEvent(events.createKeyEvent(evtype, keyname, tostring(scan), isRep, mods))
        end

      elseif t == SDL_TEXTINPUT then
        local text = ffi.string(event.text.text)
        if text ~= "" then
          -- Route to devtools first (console text input)
          if not devtools.textinput(text) then
            bridge:pushEvent(events.createTextInputEvent(text))
          end
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
      -- Mark all windows as needing layout when tree changes
      for _, win in ipairs(WM.getAll()) do
        win.needsLayout = true
      end
    end

    -- ---- Capabilities sync ----
    local dt = TARGET_MS / 1000
    capabilities.syncWithTree(tree.getNodes(), pushEvent, dt)

    -- ---- Per-window layout + paint ----
    local allWindows = WM.getAll()

    for _, win in ipairs(allWindows) do
      local winRoot = getWindowRoot(win, tree)
      if winRoot and win.needsLayout then
        if win.isMain then
          local vh = devtools.getViewportHeight()
          layout.layout(winRoot, 0, 0, win.width, vh)
        else
          -- Mark node as window root so layout doesn't skip it via isNonVisual
          winRoot._isWindowRoot = true
          layout.layout(winRoot, 0, 0, win.width, win.height)
          winRoot._isWindowRoot = nil
        end
        win.needsLayout = false
      end
    end

    for _, win in ipairs(allWindows) do
      -- Switch GL context to this window
      sdl.SDL_GL_MakeCurrent(win.sdlWindow, win.glContext)
      GL.glViewport(0, 0, win.width, win.height)
      GL.glMatrixMode(GL.PROJECTION)
      GL.glLoadIdentity()
      GL.glOrtho(0, win.width, win.height, 0, -1, 1)
      GL.glMatrixMode(GL.MODELVIEW)
      GL.glLoadIdentity()

      GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))

      Painter.setDimensions(win.width, win.height)

      local winRoot = getWindowRoot(win, tree)
      if winRoot then
        -- Mark as window root so painter doesn't skip it via rendersInOwnSurface
        if not win.isMain then winRoot._isWindowRoot = true end
        local ok, err = pcall(Painter.paint, winRoot)
        if not win.isMain then winRoot._isWindowRoot = nil end
        if not ok then
          io.write("[sdl2_init] paint error (window #" .. win.id .. "): " .. tostring(err) .. "\n")
          io.flush()
        end
      end

      -- Devtools overlay (main window only)
      if win.isMain then
        root = winRoot  -- keep for cleanup compatibility
        devtools.draw(winRoot)
      end

      sdl.SDL_GL_SwapWindow(win.sdlWindow)
    end

    -- ---- Frame cap ----
    local elapsed = sdl.SDL_GetTicks() - frameStart
    if elapsed < TARGET_MS then sdl.SDL_Delay(TARGET_MS - elapsed) end
  end

  -- ------------------------------------------------------------------
  -- 5. Cleanup
  -- ------------------------------------------------------------------
  -- Destroy child windows first
  for _, win in ipairs(WM.getAll()) do
    if not win.isMain then
      WM.destroy(win.id)
    end
  end

  bridge:destroy()
  Font.done()
  sdl.SDL_GL_DeleteContext(ctx)
  sdl.SDL_DestroyWindow(window)
  sdl.SDL_Quit()
  io.write("[sdl2_init] clean exit\n"); io.flush()
end

return SDL2Init
