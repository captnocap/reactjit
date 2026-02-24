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
  typedef struct { uint32_t type; uint32_t ts; uint32_t wid;
                   char *file; }
                   SDL2_DropEvent;
  typedef union {
    uint32_t               type;
    SDL2_MouseButtonEvent  button;
    SDL2_MouseMotionEvent  motion;
    SDL2_MouseWheelEvent   wheel;
    SDL2_KeyboardEvent     key;
    SDL2_TextInputEvent    text;
    SDL2_WindowEvent       window;
    SDL2_DropEvent         drop;
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
  int           SDL_GL_MakeCurrent(SDL_Window *win, SDL_GLContext ctx);
  int           SDL_GL_SetSwapInterval(int interval);
  char         *SDL_GetClipboardText(void);
  int           SDL_SetClipboardText(const char *text);
  int           SDL_HasClipboardText(void);
  void          SDL_free(void *mem);
  void          SDL_GetWindowPosition(SDL_Window *win, int *x, int *y);
  void          SDL_EventState(uint32_t type, int state);
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
local SDL_DROPFILE     = 0x1000
local SDL_DROPTEXT     = 0x1001
local SDL_DROPBEGIN    = 0x1002
local SDL_DROPCOMPLETE = 0x1003

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
-- HMR helpers
-- ============================================================================

local function readTextFile(path)
  local fh, openErr = io.open(path, "rb")
  if not fh then return nil, openErr end
  local data = fh:read("*a")
  fh:close()
  if not data then return nil, "read failed" end
  return data
end

--- Serialize a Lua value to a JavaScript source literal string.
--- Handles strings, numbers, booleans, nil, and nested tables.
local function luaTableToJSLiteral(val)
  local t = type(val)
  if t == "string" then
    local escaped = val:gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "\\r")
    return '"' .. escaped .. '"'
  elseif t == "number" then
    return tostring(val)
  elseif t == "boolean" then
    return val and "true" or "false"
  elseif t == "nil" then
    return "null"
  elseif t == "table" then
    if val[1] ~= nil then
      local parts = {}
      for i, v in ipairs(val) do parts[i] = luaTableToJSLiteral(v) end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      local parts = {}
      for k, v in pairs(val) do
        parts[#parts + 1] = '"' .. tostring(k) .. '":' .. luaTableToJSLiteral(v)
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  end
  return "null"
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
  local bridgeLibPath = config.libpath or "lib/libquickjs.so"

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
  local Images  = Target.images
  local Painter = Target.painter
  local Measure = Target.measure

  Font.init(config.fontFamily)
  Painter.init({ width = W, height = H, images = Images, videos = Target.videos })

  local ok_json, json = pcall(require, "lua.json")
  if not ok_json then error("[sdl2_init] lua.json required") end

  local tree    = require("lua.tree")
  local layout  = require("lua.layout")
  local events  = require("lua.events")
  tree.init({ images = Images, videos = Target.videos })
  events.setTreeModule(tree)
  layout.init({ measure = Measure })

  -- Focus and Lua-owned text widgets
  local focus      = require("lua.focus")
  local textinput  = require("lua.textinput")
  local texteditor = require("lua.texteditor")
  local codeblock  = require("lua.codeblock")
  textinput.init({ measure = Measure })
  texteditor.init({ measure = Measure })
  codeblock.init({ measure = Measure })

  -- ------------------------------------------------------------------
  -- 3a. Window manager (multi-window support)
  -- ------------------------------------------------------------------
  local WM = require("lua.window_manager")
  WM.init({ sdl = sdl })
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
  -- 3c. Devtools, errors, inspector, console
  -- ------------------------------------------------------------------
  local errors    = require("lua.errors")
  local inspector = require("lua.inspector")
  local console   = require("lua.console")
  local devtools  = require("lua.devtools")

  local Bridge  = require("lua.bridge_quickjs")
  local bridge  = Bridge.new(bridgeLibPath)
  local bundleSource, bundleErr = readTextFile(bundle)
  if not bundleSource then
    error("[sdl2_init] Failed to read bundle '" .. tostring(bundle) .. "': " .. tostring(bundleErr))
  end
  bridge:eval("globalThis.__deferMount = true;", "<pre-bundle>")
  bridge:eval(bundleSource, bundle)
  bridge:callGlobal("__mount")
  bridge:tick()

  -- Helper for viewport events
  local function pushEvent(ev) bridge:pushEvent(ev) end

  -- Init console + devtools
  console.init({ bridge = bridge, tree = tree, inspector = inspector })
  devtools.init({ inspector = inspector, console = console, tree = tree, bridge = bridge, pushEvent = pushEvent })

  -- ------------------------------------------------------------------
  -- 3c2. Widgets (unified init for Slider/Fader/Knob/Switch/Checkbox/Radio/Select)
  -- ------------------------------------------------------------------
  local widgets = require("lua.widgets")
  widgets.init({ measure = Measure })

  -- ------------------------------------------------------------------
  -- 3c3. Permit + audit + manifest (must init before system panel)
  -- ------------------------------------------------------------------
  local permit      = require("lua.permit")
  local audit       = require("lua.audit")
  local manifestMod = require("lua.manifest")

  -- ------------------------------------------------------------------
  -- 3c4. Overlays (theme menu, settings, system panel, context menu)
  -- ------------------------------------------------------------------
  local themeMenu   = require("lua.theme_menu")
  local settings    = require("lua.settings")
  local systemPanel = require("lua.system_panel")
  local contextmenu = nil
  local textselection = nil

  local themes = nil
  local currentThemeName = "catppuccin-mocha"
  local currentTheme = nil

  local function markAllWindowsForLayout()
    for _, win in ipairs(WM.getAll()) do
      win.needsLayout = true
    end
  end

  local function applyThemeByName(name, opts)
    opts = opts or {}
    if not name or not themes or not themes[name] then return false end

    currentThemeName = name

    local resolvedTheme = opts.resolvedTheme
    if not resolvedTheme and themeMenu.getResolvedTheme then
      resolvedTheme = themeMenu.getResolvedTheme(name)
    end
    currentTheme = resolvedTheme or themes[name]

    Painter.setTheme(currentTheme)
    if tree then tree.markDirty() end
    markAllWindowsForLayout()
    themeMenu.setCurrentTheme(name, currentTheme)

    if opts.emitSwitch then
      pushEvent({
        type = "theme:switch",
        payload = {
          type = "theme:switch",
          name = name,
          overrides = opts.overrides or {},
        },
      })
    end

    return true
  end

  local function loadThemes()
    local thOk, thMod = pcall(require, "lua.themes")
    if not thOk or type(thMod) ~= "table" then
      io.write("[sdl2_init] Failed to load lua.themes: " .. tostring(thMod) .. "\n"); io.flush()
      return
    end

    themes = thMod
    themeMenu.setThemes(themes)
    if not themes[currentThemeName] then
      for name in pairs(themes) do
        currentThemeName = name
        break
      end
    end

    applyThemeByName(currentThemeName)
  end

  themeMenu.init({
    key = "f9",
    onSwitch = function(name, resolvedTheme, overrides)
      applyThemeByName(name, {
        resolvedTheme = resolvedTheme,
        overrides = overrides,
        emitSwitch = true,
      })
    end
  })
  loadThemes()
  settings.init({ key = "f10" })
  systemPanel.init({
    permit = permit,
    audit = audit,
  })

  local ok_ts, tsMod = pcall(require, "lua.textselection")
  if ok_ts then
    textselection = tsMod
    textselection.init({ measure = Measure, events = events, tree = tree })
  end

  local ok_cm, cmMod = pcall(require, "lua.contextmenu")
  if ok_cm then
    contextmenu = cmMod
    contextmenu.init({ measure = Measure, events = events, textselection = textselection, inspector = inspector, devtools = devtools })
  end

  -- ------------------------------------------------------------------
  -- 3c5. Video backend + VideoPlayer
  -- ------------------------------------------------------------------
  local Videos = Target.videos
  local videoplayer = nil
  if Videos then
    Videos.initBackend()
    local vpOk, vpMod = pcall(require, "lua.sdl2_videoplayer")
    if vpOk then
      videoplayer = vpMod
      videoplayer.init({ measure = Measure, videos = Videos })
    end
  end

  -- App-wide text search
  local search = require("lua.search")

  -- ------------------------------------------------------------------
  -- 3c6. Drag and drop (X11 hover detection + SDL2 drop events)
  -- ------------------------------------------------------------------
  local dragdrop = nil
  local lastDragHoverId = nil
  do
    local ddOk, ddMod = pcall(require, "lua.dragdrop")
    if ddOk then
      dragdrop = ddMod
      -- Inject SDL2 window accessors so dragdrop.poll() can do bounds checking
      -- without love.window (which doesn't exist in the SDL2 target).
      love = love or {}
      love.window = love.window or {}
      love.window.getPosition = function()
        local wx = ffi.new("int[1]")
        local wy = ffi.new("int[1]")
        sdl.SDL_GetWindowPosition(window, wx, wy)
        return tonumber(wx[0]), tonumber(wy[0])
      end
      love.window.getMode = function()
        return W, H
      end
      dragdrop.init({ sdl = sdl })
      -- Enable SDL2 drop events (they are disabled by default)
      sdl.SDL_EventState(SDL_DROPFILE, 1)
      sdl.SDL_EventState(SDL_DROPTEXT, 1)
      sdl.SDL_EventState(SDL_DROPBEGIN, 1)
      sdl.SDL_EventState(SDL_DROPCOMPLETE, 1)
      io.write("[sdl2_init] drag-and-drop initialized\n"); io.flush()
    else
      io.write("[sdl2_init] dragdrop module not available: " .. tostring(ddMod) .. "\n"); io.flush()
    end
  end

  -- File drop helpers (shared logic with init.lua)
  local FILE_DROP_PREVIEW_MAX_BYTES = 128 * 1024

  local FILE_DROP_TEXT_EXTENSIONS = {
    txt = true, text = true, md = true, markdown = true, rst = true,
    log = true, csv = true, tsv = true, json = true, yaml = true,
    yml = true, toml = true, ini = true, cfg = true, conf = true,
    xml = true, html = true, css = true, js = true, jsx = true,
    ts = true, tsx = true, lua = true, py = true, rb = true,
    go = true, rs = true, c = true, h = true, cpp = true, hpp = true,
    java = true, kt = true, swift = true, cs = true, sh = true,
    bash = true, zsh = true, fish = true, ps1 = true, bat = true,
    cmd = true, sql = true,
  }

  local function fileNameFromPath(path)
    if type(path) ~= "string" then return nil end
    return path:match("([^/\\]+)$") or path
  end

  local function fileExtensionFromPath(path)
    if type(path) ~= "string" then return nil end
    local ext = path:match("%.([^./\\]+)$")
    return ext and string.lower(ext) or nil
  end

  local function normalizeFileDropMode(value)
    if type(value) ~= "string" then return nil end
    local mode = string.lower(value)
    if mode == "upload" or mode == "preview" then return mode end
    return nil
  end

  local function resolveFileDropMode(node)
    local current = node
    while current do
      local props = current.props
      if props then
        local mode = normalizeFileDropMode(props.fileDropMode)
        if mode then return mode end
      end
      current = current.parent
    end
    return "upload"
  end

  local function stripUtf8Bom(text)
    if type(text) ~= "string" or #text < 3 then return text end
    local b1, b2, b3 = text:byte(1, 3)
    if b1 == 0xEF and b2 == 0xBB and b3 == 0xBF then return text:sub(4) end
    return text
  end

  local function isLikelyBinary(data)
    if type(data) ~= "string" or #data == 0 then return false end
    if data:find("\0", 1, true) then return true end
    local control = 0
    local len = #data
    for i = 1, len do
      local b = data:byte(i)
      if b < 9 or (b > 13 and b < 32) then
        control = control + 1
        if control > (len * 0.10) then return true end
      end
    end
    return false
  end

  local function readFilePreviewFromPath(filePath)
    local f = io.open(filePath, "rb")
    if not f then return nil, false, "preview_open_failed" end
    local raw = f:read(FILE_DROP_PREVIEW_MAX_BYTES + 1)
    f:close()
    if type(raw) ~= "string" then return nil, false, "preview_read_failed" end
    local truncated = #raw > FILE_DROP_PREVIEW_MAX_BYTES
    if truncated then raw = raw:sub(1, FILE_DROP_PREVIEW_MAX_BYTES) end
    if isLikelyBinary(raw) then return nil, truncated, "preview_binary_file" end
    return stripUtf8Bom(raw), truncated, nil
  end

  local function getFileSizeFromPath(filePath)
    local f = io.open(filePath, "rb")
    if not f then return nil end
    local size = f:seek("end")
    f:close()
    return size
  end

  local function handleFileDrop(filePath)
    if not bridge then return end
    local root = tree.getTree()
    if not root then return end

    -- Get mouse position (SDL_GetMouseState is most reliable during drops)
    local mx, my = 0, 0
    if dragdrop then
      local ddx, ddy = dragdrop.getMousePosition()
      if ddx then mx, my = ddx, ddy end
    end

    local hit = events.hitTest(root, mx, my)
    if not hit then return end

    local fileName = fileNameFromPath(filePath)
    local fileExtension = fileExtensionFromPath(filePath)
    local fileDropMode = resolveFileDropMode(hit)
    local size = getFileSizeFromPath(filePath)

    local dropMeta = {
      fileDropMode = fileDropMode,
      fileName = fileName,
      fileExtension = fileExtension,
    }

    if fileDropMode == "preview" then
      if fileExtension and not FILE_DROP_TEXT_EXTENSIONS[fileExtension] then
        dropMeta.filePreviewError = "preview_unsupported_extension"
      else
        local previewText, truncated, previewErr = readFilePreviewFromPath(filePath)
        if previewText ~= nil then
          dropMeta.filePreviewText = previewText
          dropMeta.filePreviewTruncated = truncated
          dropMeta.filePreviewEncoding = "utf-8"
        else
          dropMeta.filePreviewError = previewErr
          dropMeta.filePreviewTruncated = truncated
        end
      end
    end

    local bubblePath = events.buildBubblePath(hit)
    pushEvent(events.createFileDropEvent("filedrop", hit.id, mx, my, filePath, size, bubblePath, dropMeta))
  end

  local function handleDirectoryDrop(dirPath)
    if not bridge then return end
    local root = tree.getTree()
    if not root then return end

    local mx, my = 0, 0
    if dragdrop then
      local ddx, ddy = dragdrop.getMousePosition()
      if ddx then mx, my = ddx, ddy end
    end

    local hit = events.hitTest(root, mx, my)
    if not hit then return end

    local bubblePath = events.buildBubblePath(hit)
    pushEvent(events.createFileDropEvent("directorydrop", hit.id, mx, my, dirPath, nil, bubblePath))
  end

  -- ------------------------------------------------------------------
  -- 3d. Capabilities (audio, timer, window, etc.)
  -- ------------------------------------------------------------------
  local capabilities = require("lua.capabilities")
  capabilities.loadAll()

  -- ------------------------------------------------------------------
  -- 3e. RPC handler registry
  -- ------------------------------------------------------------------
  local rpcHandlers = {}

  -- Capabilities RPC (capabilities:list, capabilities:schema)
  for method, handler in pairs(capabilities.getHandlers()) do
    rpcHandlers[method] = handler
  end

  -- Permit + audit + manifest RPC handlers (always available)
  for method, handler in pairs(permit.getHandlers()) do
    rpcHandlers[method] = handler
  end
  for method, handler in pairs(audit.getHandlers()) do
    rpcHandlers[method] = handler
  end
  for method, handler in pairs(manifestMod.getHandlers()) do
    rpcHandlers[method] = handler
  end

  -- Clipboard RPC handlers (SDL2 FFI)
  rpcHandlers["clipboard:read"] = function()
    local ptr = sdl.SDL_GetClipboardText()
    if ptr ~= nil then
      local text = ffi.string(ptr)
      sdl.SDL_free(ptr)
      return text
    end
    return ""
  end
  rpcHandlers["clipboard:write"] = function(args)
    sdl.SDL_SetClipboardText(args.text or "")
    return true
  end

  -- Diagnostics RPC handler (ghost node analysis, used by storybook crawl)
  rpcHandlers["diagnose:run"] = function()
    local dok, diagMod = pcall(require, "lua.diagnostics")
    if not dok then
      return { error = "Failed to load diagnostics: " .. tostring(diagMod) }
    end
    return diagMod.run(tree, capabilities, W, H, true)
  end

  -- Expose runtime perf counters for dashboards/stress stories.
  rpcHandlers["dev:perf"] = function()
    if inspector and inspector.getPerfData then
      return inspector.getPerfData()
    end
    return {
      fps = 0,
      layoutMs = 0,
      paintMs = 0,
      nodeCount = 0,
    }
  end

  -- App-wide text search RPC handlers
  rpcHandlers["search:query"] = function(args)
    local root = tree.getTree()
    if not root then return {} end
    local hotIndex = search.buildHotIndex(root)
    local matches  = search.query(hotIndex, args and args.query or "")
    local out = {}
    for _, m in ipairs(matches) do
      out[#out + 1] = {
        path = m.path, text = m.text, context = m.context, propKey = m.propKey,
        matchStart = m.matchStart, matchEnd = m.matchEnd,
        x = m.x, y = m.y, w = m.w, h = m.h,
      }
    end
    return out
  end

  rpcHandlers["search:navigate"] = function(args)
    local root = tree.getTree()
    if not root then return false end
    if args and args.path then
      local node = search.resolvePath(root, args.path)
      if node then search.navigateTo(node); return true end
    end
    if args and args.text then
      return search.navigateByText(root, args.text)
    end
    return false
  end

  rpcHandlers["search:clear"] = function()
    search.clearHighlight()
    return true
  end

  -- System monitoring RPC handlers (sys:info/sys:monitor/sys:ports/...).
  if permit.check("sysmon") then
    local smOk, smMod = pcall(require, "lua.sysmon")
    if smOk and smMod then
      for method, handler in pairs(smMod.getHandlers()) do
        rpcHandlers[method] = handler
      end
      io.write("[sdl2_init] sysmon module loaded\n"); io.flush()
    end
  end

  -- HTTP module (optional — graceful degradation)
  local http = nil
  local httpOk, httpMod = pcall(require, "lua.http")
  if httpOk and httpMod then
    http = httpMod
    io.write("[sdl2_init] HTTP module loaded\n"); io.flush()
  end

  -- Audio engine (optional)
  local audioEngine = nil
  local aeOk, aeMod = pcall(require, "lua.audio.engine")
  if aeOk and aeMod then
    audioEngine = aeMod
    for method, handler in pairs(audioEngine.getHandlers()) do
      rpcHandlers[method] = handler
    end
    rpcHandlers["audio:init"] = function(args)
      args = args or {}
      args.bridge = bridge
      audioEngine.init(args)
      return true
    end
    io.write("[sdl2_init] Audio engine loaded\n"); io.flush()
  end

  -- Push initial viewport
  bridge:pushEvent({ type="viewport", payload={width=W, height=H} })

  local root
  local hmrFrameCounter = 0
  local hmrLastBundle = bundleSource
  local hmrHasLoaded = bundleSource ~= nil

  local function reloadBundle(nextBundleSource)
    io.write("[sdl2_init] Hot reload starting...\n"); io.flush()

    -- Read dev state before tearing down the old context.
    local devStateCache = nil
    local dsOk, dsValue = pcall(function() return bridge:callGlobalReturn("__getDevState") end)
    if dsOk and dsValue ~= nil then
      devStateCache = dsValue
    end

    if bridge then bridge:destroy() end

    if Images and Images.clearCache then
      Images.clearCache()
    end
    if Videos and Videos.clearCache then
      Videos.clearCache()
    end
    Measure.clearCache()
    errors.clear()

    tree.init({ images = Images, videos = Target.videos })
    root = nil
    focus.clear()
    if contextmenu and contextmenu.close then contextmenu.close() end
    events.setActiveWindow(mainWin)
    events.clearHover()
    events.clearPressedNode()
    pcall(function() events.endDrag(mainWin.mx or 0, mainWin.my or 0) end)
    for _, win in ipairs(WM.getAll()) do
      win.needsLayout = true
      win.hoveredNode = nil
      win.pressedNode = nil
      if win.dragState then
        win.dragState.active = false
        win.dragState.targetId = nil
        win.dragState.thresholdCrossed = false
      end
    end

    local newBridgeOk, newBridgeOrErr = pcall(Bridge.new, bridgeLibPath)
    if not newBridgeOk then
      errors.push({
        source = "lua",
        message = tostring(newBridgeOrErr),
        context = "SDL2 HMR (bridge init)",
      })
      return false
    end
    bridge = newBridgeOrErr
    console.updateRefs({ bridge = bridge, tree = tree })
    devtools.init({ inspector = inspector, console = console, tree = tree, bridge = bridge, pushEvent = pushEvent })

    if not nextBundleSource then
      local readOk, readErr
      nextBundleSource, readErr = readTextFile(bundle)
      readOk = nextBundleSource ~= nil
      if not readOk then
        errors.push({
          source = "lua",
          message = "Failed to read bundle '" .. tostring(bundle) .. "': " .. tostring(readErr),
          context = "SDL2 HMR (bundle read)",
        })
        return false
      end
    end

    local preOk, preErr = pcall(function()
      bridge:eval("globalThis.__deferMount = true;", "<pre-bundle>")
      if devStateCache then
        local jsLiteral = luaTableToJSLiteral(devStateCache)
        bridge:eval("globalThis.__devState = " .. jsLiteral .. ";", "<hmr-state>")
      end
    end)
    if not preOk then
      errors.push({
        source = "js",
        message = tostring(preErr),
        context = "SDL2 HMR (pre-bundle setup)",
      })
      return false
    end

    local evalOk, evalErr = pcall(function()
      bridge:eval(nextBundleSource, bundle)
    end)
    if not evalOk then
      errors.push({
        source = "js",
        message = tostring(evalErr),
        context = "SDL2 HMR (bundle eval)",
      })
      return false
    end

    local mountOk, mountErr = pcall(function()
      bridge:callGlobal("__mount")
      bridge:tick()
    end)
    if not mountOk then
      errors.push({
        source = "js",
        message = tostring(mountErr),
        context = "SDL2 HMR (mount)",
      })
      return false
    end

    bridge:pushEvent({ type = "viewport", payload = { width = W, height = H } })

    io.write("[sdl2_init] Hot reload complete (" .. #nextBundleSource .. " bytes)\n"); io.flush()
    return true
  end

  -- ------------------------------------------------------------------
  -- 4. Run loop
  -- ------------------------------------------------------------------
  local event   = ffi.new("SDL2_Event")
  local running = true
  local TARGET_MS = math.floor(1000/60)

  -- Enable vsync so SDL_GL_SwapWindow throttles to display refresh rate.
  -- If vsync fails (returns -1), fall back to manual frame cap.
  local vsyncOk = sdl.SDL_GL_SetSwapInterval(1) == 0
  if vsyncOk then
    io.write("[sdl2_init] vsync enabled\n"); io.flush()
  else
    io.write("[sdl2_init] vsync not available, using manual frame cap\n"); io.flush()
  end

  local lastTicks = sdl.SDL_GetTicks()

  -- ------------------------------------------------------------------
  -- 4a. Diagnostic mode (ILOVEREACT_DIAGNOSE=1)
  -- ------------------------------------------------------------------
  local diagEnabled = os.getenv("ILOVEREACT_DIAGNOSE") == "1"
  local diagFrameCount = 0
  local diagWaitFrames = 3  -- let tree mutations + layout settle
  local diagDone = false

  if diagEnabled then
    io.write("[sdl2_init] diagnostic mode enabled\n"); io.flush()
  end

  io.write("[sdl2_init] entering run loop\n"); io.flush()

  while running do
    local now = sdl.SDL_GetTicks()
    local frameDeltaMs = now - lastTicks
    if frameDeltaMs < 1 then frameDeltaMs = 1 end    -- avoid zero dt
    if frameDeltaMs > 100 then frameDeltaMs = 100 end -- clamp spikes
    lastTicks = now
    local frameStart = now
    local dt = frameDeltaMs / 1000

    -- ---- HMR poll (dev mode): check bundle content every ~60 frames ----
    hmrFrameCounter = hmrFrameCounter + 1
    if hmrFrameCounter % 60 == 0 then
      local latestBundle = readTextFile(bundle)
      if latestBundle then
        if hmrLastBundle == nil then
          hmrLastBundle = latestBundle
        elseif latestBundle ~= hmrLastBundle then
          hmrLastBundle = latestBundle
          if hmrHasLoaded then
            local reloadOk, reloadErr = pcall(reloadBundle, latestBundle)
            if not reloadOk then
              errors.push({
                source = "lua",
                message = tostring(reloadErr),
                context = "SDL2 HMR (reload panic)",
              })
            end
          end
        end
        hmrHasLoaded = true
      end
    end

    -- ---- Per-frame overlay/tooling updates ----
    systemPanel.update(dt)
    inspector.update(dt)
    console.update(dt)

    -- ---- Drag-hover polling (X11 XDnD + SDL2 global mouse) ----
    if dragdrop then
      dragdrop.poll()
      if dragdrop.isDragHovering() then
        local root = tree.getTree()
        if root then
          local dx, dy = dragdrop.getPosition()
          local hit = events.hitTest(root, dx, dy)
          local hitId = hit and hit.id or nil

          if hitId ~= lastDragHoverId then
            if lastDragHoverId then
              pushEvent(events.createFileDropEvent("filedragleave", lastDragHoverId, dx, dy, nil, nil, nil))
            end
            if hit then
              local bubblePath = events.buildBubblePath(hit)
              pushEvent(events.createFileDropEvent("filedragenter", hit.id, dx, dy, nil, nil, bubblePath))
            end
            lastDragHoverId = hitId
          end
        end
      elseif lastDragHoverId then
        pushEvent(events.createFileDropEvent("filedragleave", lastDragHoverId, 0, 0, nil, nil, nil))
        lastDragHoverId = nil
      end
    end

    -- ---- Event pump (pcall-wrapped so crashes show in error overlay) ----
    local _pumpOk, _pumpErr = pcall(function()
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
          systemPanel.mousemoved(mx, my)
          settings.mousemoved(mx, my)
          themeMenu.mousemoved(mx, my)
          devtools.mousemoved(mx, my)
        end

        events.setActiveWindow(evtWin)
        local winRoot = getWindowRoot(evtWin, tree)
        if winRoot then
          local hoverEvents = events.updateHover(winRoot, mx, my)
          for _, evt in ipairs(hoverEvents) do
            pushEvent(evt)
          end
        end

        -- Text widget drag selection
        local focusedNode = focus.get()
        if focusedNode then
          if focusedNode.type == "TextInput" then
            local cx, cy = events.screenToContent(focusedNode, mx, my)
            textinput.handleMouseMoved(focusedNode, cx, cy)
          elseif focusedNode.type == "TextEditor" then
            local cx, cy = events.screenToContent(focusedNode, mx, my)
            texteditor.handleMouseMoved(focusedNode, cx, cy)
          end
        end

        -- VideoPlayer hover/drag tracking
        if videoplayer and tree then
          local nodes = tree.getNodes()
          if nodes then
            for _, node in pairs(nodes) do
              if node.type == "VideoPlayer" and node._vp then
                videoplayer.handleMouseMoved(node, mx, my)
              end
            end
          end
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
          Shim.setMouseButton(btn, t == SDL_MOUSEBTNDOWN)
        end

        -- Fullscreen VideoPlayer gets ALL mouse input (bypass normal hit-test)
        if videoplayer and t == SDL_MOUSEBTNDOWN and btn == 1 then
          local fsNode = videoplayer.getFullscreenNode()
          if fsNode then
            videoplayer.handleMousePressed(fsNode, mx, my, btn)
            goto mouse_done
          end
        end

        -- Route to devtools first (main window only)
        -- Error overlay gets first priority on clicks
        if evtWin.isMain and t == SDL_MOUSEBTNDOWN and errors.mousepressed(mx, my, btn) then
          -- consumed by error overlay
        else

        local devConsumed = false
        if evtWin.isMain then
          if t == SDL_MOUSEBTNDOWN then
            devConsumed = devtools.mousepressed(mx, my, btn)
          else
            devConsumed = devtools.mousereleased(mx, my, btn)
          end
        end

        if not devConsumed then
          -- Overlay panels get mouse events before the tree
          local overlayConsumed = false
          if t == SDL_MOUSEBTNDOWN then
            if systemPanel.mousepressed(mx, my, btn) then overlayConsumed = true
            elseif settings.mousepressed(mx, my, btn) then overlayConsumed = true
            elseif themeMenu.mousepressed(mx, my, btn) then overlayConsumed = true
            elseif contextmenu and contextmenu.isOpen() then
              contextmenu.handleMousePressed(mx, my, btn)
              overlayConsumed = true
            elseif btn == 3 and contextmenu then
              -- Right-click: open context menu
              local winRoot = getWindowRoot(evtWin, tree)
              contextmenu.open(mx, my, winRoot, pushEvent)
              overlayConsumed = true
            end
          elseif t == SDL_MOUSEBTNUP then
            if systemPanel.mousereleased(mx, my, btn) then overlayConsumed = true
            elseif settings.mousereleased(mx, my, btn) then overlayConsumed = true
            elseif themeMenu.mousereleased(mx, my, btn) then overlayConsumed = true
            end
          end

          if not overlayConsumed then
          local winRoot = getWindowRoot(evtWin, tree)
          if winRoot then
            local hit = events.hitTest(winRoot, mx, my)
            if hit then
              if t == SDL_MOUSEBTNDOWN then
                events.setPressedNode(hit)

                -- Blur any previously focused text widget when clicking elsewhere
                local prevFocused = focus.get()
                local isTextHit = (hit.type == "TextInput" or hit.type == "TextEditor")
                if prevFocused and prevFocused ~= hit then
                  if prevFocused.type == "TextInput" then
                    local value = textinput.blur(prevFocused)
                    focus.clear()
                    pushEvent({
                      type = "textinput:blur",
                      payload = { type = "textinput:blur", targetId = prevFocused.id, value = value },
                    })
                  elseif prevFocused.type == "TextEditor" then
                    local value = texteditor.blur(prevFocused)
                    focus.clear()
                    pushEvent({
                      type = "texteditor:blur",
                      payload = { type = "texteditor:blur", targetId = prevFocused.id, value = value },
                    })
                  end
                end

                -- TextEditor focus + mouse press
                if hit.type == "TextEditor" then
                  local cx, cy = events.screenToContent(hit, mx, my)
                  if texteditor.handleMousePressed(hit, cx, cy, btn) then
                    if not focus.isFocused(hit) then
                      focus.set(hit)
                      pushEvent({
                        type = "texteditor:focus",
                        payload = { type = "texteditor:focus", targetId = hit.id },
                      })
                    end
                  end

                -- TextInput focus + mouse press
                elseif hit.type == "TextInput" then
                  if not focus.isFocused(hit) then
                    focus.set(hit)
                    textinput.focus(hit)
                    pushEvent({
                      type = "textinput:focus",
                      payload = { type = "textinput:focus", targetId = hit.id, value = textinput.getValue(hit) },
                    })
                  end
                  local cx, cy = events.screenToContent(hit, mx, my)
                  textinput.handleMousePressed(hit, cx, cy, btn)

                -- CodeBlock copy button
                elseif hit.type == "CodeBlock" then
                  local cx, cy = events.screenToContent(hit, mx, my)
                  codeblock.handleMousePressed(hit, cx, cy, btn)

                -- VideoPlayer: handle internally in Lua
                elseif hit.type == "VideoPlayer" then
                  if videoplayer then
                    videoplayer.handleMousePressed(hit, mx, my, btn)
                  end
                end

                local path = events.buildBubblePath(hit)
                bridge:pushEvent(
                  events.createEvent("click", hit.id, mx, my, btn, path))
              else
                -- Mouse button up: release drag on focused text widget
                local focusedNode = focus.get()
                if focusedNode then
                  if focusedNode.type == "TextInput" then
                    textinput.handleMouseReleased(focusedNode)
                  elseif focusedNode.type == "TextEditor" then
                    texteditor.handleMouseReleased(focusedNode)
                  end
                end

                -- VideoPlayer drag release (seek/volume)
                if videoplayer and tree then
                  local allNodes = tree.getNodes()
                  if allNodes then
                    for _, vnode in pairs(allNodes) do
                      if vnode.type == "VideoPlayer" and vnode._vp then
                        videoplayer.handleMouseReleased(vnode, mx, my, btn)
                      end
                    end
                  end
                end

                events.clearPressedNode()
                local path = events.buildBubblePath(hit)
                bridge:pushEvent(
                  events.createEvent("release", hit.id, mx, my, btn, path))
              end
            elseif t == SDL_MOUSEBTNDOWN then
              -- Click outside any node: blur focused text widget
              local prevFocused = focus.get()
              if prevFocused then
                if prevFocused.type == "TextInput" then
                  local value = textinput.blur(prevFocused)
                  focus.clear()
                  pushEvent({
                    type = "textinput:blur",
                    payload = { type = "textinput:blur", targetId = prevFocused.id, value = value },
                  })
                elseif prevFocused.type == "TextEditor" then
                  local value = texteditor.blur(prevFocused)
                  focus.clear()
                  pushEvent({
                    type = "texteditor:blur",
                    payload = { type = "texteditor:blur", targetId = prevFocused.id, value = value },
                  })
                end
              end
            elseif t == SDL_MOUSEBTNUP then
              local focusedNode = focus.get()
              if focusedNode then
                if focusedNode.type == "TextInput" then
                  textinput.handleMouseReleased(focusedNode)
                elseif focusedNode.type == "TextEditor" then
                  texteditor.handleMouseReleased(focusedNode)
                end
              end
              -- VideoPlayer drag release (even outside hit node)
              if videoplayer and tree then
                local allNodes = tree.getNodes()
                if allNodes then
                  for _, vnode in pairs(allNodes) do
                    if vnode.type == "VideoPlayer" and vnode._vp then
                      videoplayer.handleMouseReleased(vnode, mx, my, btn)
                    end
                  end
                end
              end
              events.clearPressedNode()
            end
          end
          end -- if not overlayConsumed
        end
        end -- error overlay if-else
        ::mouse_done::

      elseif t == SDL_MOUSEWHEEL then
        local wid = event.wheel.wid
        local evtWin = WM.getBySDLId(wid) or mainWin
        local dx = event.wheel.x
        local dy = event.wheel.y
        local mx, my = evtWin.mx, evtWin.my

        events.setActiveWindow(evtWin)

        -- Route to overlay panels first, then devtools, then tree
        local wheelConsumed = false
        if evtWin.isMain then
          if systemPanel.isOpen() and systemPanel.wheelmoved(dx, dy) then wheelConsumed = true
          elseif settings.isOpen() and settings.wheelmoved(dx, dy) then wheelConsumed = true
          elseif themeMenu.isOpen() and themeMenu.wheelmoved(dx, dy) then wheelConsumed = true
          elseif devtools.wheelmoved(dx, dy) then wheelConsumed = true
          end
        end

        if not wheelConsumed then
          local winRoot = getWindowRoot(evtWin, tree)
          if winRoot then
            local hit = events.hitTest(winRoot, mx, my)
            if hit then
              -- TextEditor handles its own scroll entirely in Lua
              if hit.type == "TextEditor" then
                texteditor.handleWheel(hit, dx, dy)
              end
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

          -- Overlay panels (F9 theme, F10 settings, F11 system)
          elseif systemPanel.keypressed(keyname) then
            consumed = true
          elseif settings.keypressed(keyname) then
            consumed = true
          elseif themeMenu.keypressed(keyname) then
            consumed = true

          -- Context menu (Escape to close)
          elseif contextmenu and contextmenu.isOpen() and contextmenu.keypressed(keyname) then
            consumed = true

          -- Focused TextEditor gets next shot at keys
          elseif focus.get() and focus.get().type == "TextEditor" then
            local focusedNode = focus.get()
            local result = texteditor.handleKeyPressed(focusedNode, keyname, tostring(scan), isRep)
            if result == "blur" then
              local value = texteditor.blur(focusedNode)
              focus.clear()
              pushEvent({
                type = "texteditor:blur",
                payload = { type = "texteditor:blur", targetId = focusedNode.id, value = value },
              })
              consumed = true
            elseif result == "submit" then
              local value = texteditor.getValue(focusedNode)
              pushEvent({
                type = "texteditor:submit",
                payload = { type = "texteditor:submit", targetId = focusedNode.id, value = value },
              })
              consumed = true
            elseif result == false then
              -- TextEditor didn't handle this key combo, let it through
            elseif result then
              consumed = true
            end

          -- Focused TextInput gets next shot at keys
          elseif focus.get() and focus.get().type == "TextInput" then
            local focusedNode = focus.get()
            local result = textinput.handleKeyPressed(focusedNode, keyname, tostring(scan), isRep)
            if result == "blur" then
              local value = textinput.blur(focusedNode)
              focus.clear()
              pushEvent({
                type = "textinput:blur",
                payload = { type = "textinput:blur", targetId = focusedNode.id, value = value },
              })
              consumed = true
            elseif result == "submit" then
              local value = textinput.getValue(focusedNode)
              pushEvent({
                type = "textinput:submit",
                payload = { type = "textinput:submit", targetId = focusedNode.id, value = value },
              })
              consumed = true
            elseif result then
              consumed = true
            end

          -- Route to fullscreen or hovered VideoPlayer (space, arrows, m, f, l)
          elseif videoplayer then
            local fsNode = videoplayer.getFullscreenNode()
            if fsNode then
              if videoplayer.handleKeyPressed(fsNode, keyname) then
                consumed = true
              end
            elseif events then
              local hoveredNode = events.getHoveredNode()
              if hoveredNode and hoveredNode.type == "VideoPlayer" then
                if videoplayer.handleKeyPressed(hoveredNode, keyname) then
                  consumed = true
                end
              end
            end
          end

          if not consumed then
          -- Escape: quit (only if devtools and text widgets didn't consume it)
          if keyname == "escape" then
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
          end -- if keyname == "escape" / elseif ctrl
          end -- if not consumed
        end -- if t == SDL_KEYDOWN

        -- Forward to JS if not consumed by Lua
        if not consumed then
          bridge:pushEvent(events.createKeyEvent(evtype, keyname, tostring(scan), isRep, mods))
        end

      elseif t == SDL_TEXTINPUT then
        local text = ffi.string(event.text.text)
        if text ~= "" then
          -- Route to overlay panels first, then devtools, then text widgets
          if systemPanel.textinput(text) then
            -- consumed by system panel
          elseif settings.textinput(text) then
            -- consumed by settings
          elseif themeMenu.textinput(text) then
            -- consumed by theme menu
          elseif devtools.textinput(text) then
            -- consumed by devtools
          elseif focus.get() and focus.get().type == "TextEditor" then
            texteditor.handleTextInput(focus.get(), text)
          elseif focus.get() and focus.get().type == "TextInput" then
            textinput.handleTextInput(focus.get(), text)
          else
            bridge:pushEvent(events.createTextInputEvent(text))
          end
        end

      elseif t == SDL_DROPFILE or t == SDL_DROPTEXT then
        -- SDL2 delivers dropped file/text paths via SDL_DropEvent.
        -- The .file pointer is allocated by SDL and must be freed with SDL_free.
        local filePtr = event.drop.file
        if filePtr ~= nil then
          local filePath = ffi.string(filePtr)
          sdl.SDL_free(filePtr)

          -- Distinguish files from directories.
          -- io.open(path.."/.", "r") succeeds only for directories on POSIX.
          local isDir = false
          local dh = io.open(filePath .. "/.", "r")
          if dh then
            dh:close()
            isDir = true
          end

          if isDir then
            handleDirectoryDrop(filePath)
          else
            handleFileDrop(filePath)
          end
        end

      -- SDL_DROPBEGIN / SDL_DROPCOMPLETE are bookend events for multi-file drops.
      -- We don't need special handling — each individual SDL_DROPFILE is dispatched above.
      elseif t == SDL_DROPBEGIN or t == SDL_DROPCOMPLETE then
        -- no-op, free file pointer if present (shouldn't be, but be safe)
        local filePtr = event.drop.file
        if filePtr ~= nil then
          sdl.SDL_free(filePtr)
        end

      end
    end
    end) -- pcall event pump
    if not _pumpOk then
      errors.push({
        source = "lua",
        message = tostring(_pumpErr),
        context = "event pump",
      })
    end

    -- ---- Bridge tick ----
    bridge:tick()
    local evtOk, evtErr = pcall(function() bridge:callGlobal("_pollAndDispatchEvents") end)
    if not evtOk then
      errors.push({
        source = "bridge",
        message = tostring(evtErr),
        context = "event dispatch (_pollAndDispatchEvents)",
      })
    end

    -- ---- Drain commands → update tree ----
    local commands = bridge:drainCommands()
    if #commands > 0 then
      -- Filter out RPC calls, HTTP requests, and other non-tree commands
      local treeCommands = commands
      local hasSpecial = false
      for _, cmd in ipairs(commands) do
        if type(cmd) == "table" then
          local ct = cmd.type
          if ct == "rpc:call" or ct == "http:request" or ct == "http:stream"
             or ct == "theme:set" then
            hasSpecial = true
            break
          end
        end
      end

      if hasSpecial then
        treeCommands = {}
        for _, cmd in ipairs(commands) do
          if type(cmd) == "table" and cmd.type == "rpc:call" then
            local payload = cmd.payload
            if payload and payload.method and payload.id then
              local handler = rpcHandlers[payload.method]
              if handler then
                local rok, result = pcall(handler, payload.args)
                if rok then
                  pushEvent({ type = "rpc:" .. payload.id, payload = { result = result } })
                else
                  pushEvent({ type = "rpc:" .. payload.id, payload = { error = tostring(result) } })
                end
              else
                pushEvent({ type = "rpc:" .. payload.id, payload = { error = "Unknown RPC method: " .. payload.method } })
              end
            end
          elseif type(cmd) == "table" and cmd.type == "http:request" then
            local payload = cmd.payload
            if payload and payload.id and payload.url then
              if http then
                local immediate = http.request(payload.id, {
                  url = payload.url,
                  method = payload.method,
                  headers = payload.headers,
                  body = payload.body,
                })
                if immediate then
                  pushEvent({
                    type = "http:response",
                    payload = { _json = json.encode(immediate) },
                  })
                end
              else
                pushEvent({
                  type = "http:response",
                  payload = { _json = json.encode({
                    id = payload.id,
                    status = 0,
                    headers = {},
                    body = "",
                    error = "HTTP module not available",
                  }) },
                })
              end
            end
          elseif type(cmd) == "table" and cmd.type == "http:stream" then
            local payload = cmd.payload
            if payload and payload.id and payload.url then
              if http then
                local immediate = http.streamRequest(payload.id, {
                  url = payload.url,
                  method = payload.method,
                  headers = payload.headers,
                  body = payload.body,
                })
                if immediate then
                  pushEvent({
                    type = "http:response",
                    payload = { _json = json.encode(immediate) },
                  })
                end
              else
                pushEvent({
                  type = "http:stream:error",
                  payload = { id = payload.id, error = "HTTP module not available" },
                })
              end
            end
          elseif type(cmd) == "table" and cmd.type == "theme:set" then
            local payload = cmd.payload
            local name = payload and payload.name
            if applyThemeByName(name) then
              io.write("[sdl2_init] Theme switched to: " .. tostring(name) .. "\n"); io.flush()
            end
          else
            treeCommands[#treeCommands + 1] = cmd
          end
        end
      end

      if #treeCommands > 0 then
        local tOk, tErr = pcall(tree.applyCommands, treeCommands)
        if not tOk then
          errors.push({
            source = "lua",
            message = tostring(tErr),
            context = "tree.applyCommands",
          })
        else
          -- Mark all windows as needing layout when tree changes
          for _, win in ipairs(WM.getAll()) do
            win.needsLayout = true
          end
        end
      end
    end

    -- ---- HTTP poll (deliver completed async responses) ----
    if http then
      local responses = http.poll()
      for _, resp in ipairs(responses) do
        if resp.type == "chunk" then
          pushEvent({ type = "http:stream:chunk", payload = { id = resp.id, data = resp.data } })
        elseif resp.type == "done" then
          pushEvent({ type = "http:stream:done", payload = { id = resp.id, status = resp.status, headers = resp.headers } })
        elseif resp.type == "error" then
          pushEvent({ type = "http:stream:error", payload = { id = resp.id, error = resp.error } })
        else
          pushEvent({ type = "http:response", payload = { _json = json.encode(resp) } })
        end
      end
    end

    -- ---- Audio engine update ----
    if audioEngine then audioEngine.update(dt) end

    -- ---- Text widget blink timers + change events ----
    local focusedNode = focus.get()
    if focusedNode then
      if focusedNode.type == "TextInput" then
        textinput.update(focusedNode, dt)
        local is = focusedNode.inputState
        if is and is.text ~= is.lastValue then
          pushEvent({
            type = "textinput:change",
            payload = { type = "textinput:change", targetId = focusedNode.id, value = is.text },
          })
          is.lastValue = is.text
        end
      elseif focusedNode.type == "TextEditor" then
        texteditor.update(focusedNode, dt)
      end
    end

    -- ---- Search highlight timer ----
    search.tick(dt)

    -- ---- Capabilities sync ----
    Shim.setDelta(dt)
    capabilities.syncWithTree(tree.getNodes(), pushEvent, dt)

    -- ---- Video sync + render + poll ----
    if Videos then
      Videos.syncWithTree(tree.getNodes())
      Videos.renderAll()

      -- Poll video status events (ready/error)
      local videoEvents = Videos.poll()
      for _, evt in ipairs(videoEvents) do
        if evt.status == "error" then
          pushEvent({
            type = "video:error",
            payload = { src = evt.src, message = evt.message, targetId = evt.nodeId },
          })
        else
          local nodes = Videos.getNodesForSrc(evt.src)
          for _, nodeId in ipairs(nodes) do
            pushEvent({
              type = "video:" .. evt.status,
              payload = { src = evt.src, targetId = nodeId },
            })
          end
        end
      end

      -- Poll playback events (onReady, onPlay, onPause, onTimeUpdate, onEnded)
      local playbackEvents = Videos.pollPlayback()
      for _, evt in ipairs(playbackEvents) do
        pushEvent({
          type = "video:playback",
          payload = evt,
        })
      end
    end

    -- ---- VideoPlayer controls update ----
    if videoplayer and tree then
      videoplayer.update(dt, tree.getNodes())
    end

    -- ---- Window animations (animated resize) ----
    WM.tick(dt)

    -- ---- Per-window layout + paint ----
    local allWindows = WM.getAll()

    for _, win in ipairs(allWindows) do
      local winRoot = getWindowRoot(win, tree)
      if winRoot and win.needsLayout then
        if win.isMain then inspector.beginLayout() end
        local lOk, lErr
        if win.isMain then
          local vh = devtools.getViewportHeight()
          lOk, lErr = pcall(layout.layout, winRoot, 0, 0, win.width, vh)
        else
          winRoot._isWindowRoot = true
          lOk, lErr = pcall(layout.layout, winRoot, 0, 0, win.width, win.height)
          winRoot._isWindowRoot = nil
        end
        if not lOk then
          errors.push({
            source = "lua",
            message = tostring(lErr),
            context = "layout (window #" .. win.id .. ")",
          })
        end
        if win.isMain then inspector.endLayout(winRoot) end
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

      -- Ensure pixel store is clean before painting (mpv may have dirtied it)
      if Videos then Videos.ensurePixelStore() end

      Painter.setDimensions(win.width, win.height)

      local winRoot = getWindowRoot(win, tree)
      if winRoot then
        -- Mark as window root so painter doesn't skip it via rendersInOwnSurface
        if not win.isMain then winRoot._isWindowRoot = true end
        if win.isMain then inspector.beginPaint() end
        local ok, err = pcall(Painter.paint, winRoot)
        if win.isMain then inspector.endPaint() end
        if not win.isMain then winRoot._isWindowRoot = nil end
        if not ok then
          errors.push({
            source = "lua",
            message = tostring(err),
            context = "paint (window #" .. win.id .. ")",
          })
        end
      end

      -- Overlays (main window only, drawn on top of everything)
      if win.isMain then
        root = winRoot  -- keep for cleanup compatibility

        -- Reset GL state that the painter may have left dirty (stencil, scissor,
        -- blend, texture, transform). Without this, overlays may be invisible
        -- if the painter crashed mid-draw with stencil test enabled.
        GL.glDisable(GL.SCISSOR_TEST)
        GL.glDisable(GL.STENCIL_TEST)
        GL.glDisable(GL.TEXTURE_2D)
        GL.glEnable(GL.BLEND)
        GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
        GL.glMatrixMode(GL.MODELVIEW)
        GL.glLoadIdentity()
        GL.glColor4f(1, 1, 1, 1)

        -- Search highlight (before devtools so inspector can inspect it)
        do
          local sh = search.getHighlight()
          if sh and sh.node and sh.node.computed then
            local c = sh.node.computed
            GL.glEnable(GL.BLEND)
            GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
            GL.glColor4f(0.2, 0.6, 1.0, sh.alpha * 0.25)
            GL.glBegin(GL.QUADS)
            GL.glVertex2f(c.x,         c.y        )
            GL.glVertex2f(c.x + c.w,   c.y        )
            GL.glVertex2f(c.x + c.w,   c.y + c.h  )
            GL.glVertex2f(c.x,         c.y + c.h  )
            GL.glEnd()
            -- Outline
            GL.glColor4f(0.4, 0.75, 1.0, sh.alpha * 0.85)
            GL.glLineWidth(2)
            GL.glBegin(GL.LINE_LOOP)
            GL.glVertex2f(c.x,         c.y        )
            GL.glVertex2f(c.x + c.w,   c.y        )
            GL.glVertex2f(c.x + c.w,   c.y + c.h  )
            GL.glVertex2f(c.x,         c.y + c.h  )
            GL.glEnd()
            GL.glColor4f(1, 1, 1, 1)
          end
        end

        devtools.draw(winRoot)
        if settings.isOpen() then settings.draw() end
        if systemPanel.isOpen() then systemPanel.draw() end
        if themeMenu.isOpen() then themeMenu.draw() end
        if contextmenu and contextmenu.isOpen() then contextmenu.draw() end
        errors.draw()
      end

      sdl.SDL_GL_SwapWindow(win.sdlWindow)
    end

    -- ---- Diagnostic capture (after paint, like screenshot) ----
    if diagEnabled and not diagDone then
      diagFrameCount = diagFrameCount + 1
      if diagFrameCount >= diagWaitFrames then
        diagDone = true
        local dok, diagMod = pcall(require, "lua.diagnostics")
        if dok then
          diagMod.run(tree, capabilities, W, H)
        else
          io.write("[sdl2_init] failed to load diagnostics: " .. tostring(diagMod) .. "\n")
          io.flush()
        end
        running = false
      end
    end

    -- ---- Frame cap (only when vsync is not available) ----
    if not vsyncOk then
      local elapsed = sdl.SDL_GetTicks() - frameStart
      if elapsed < TARGET_MS then sdl.SDL_Delay(TARGET_MS - elapsed) end
    end
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

  if Videos then Videos.shutdown() end
  if dragdrop then dragdrop.cleanup() end
  bridge:destroy()
  Font.done()
  sdl.SDL_GL_DeleteContext(ctx)
  sdl.SDL_DestroyWindow(window)
  sdl.SDL_Quit()
  io.write("[sdl2_init] clean exit\n"); io.flush()
end

return SDL2Init
