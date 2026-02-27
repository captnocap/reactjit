--[[
  init.lua -- Main integration module for reactjit

  This is the entry point that a Love2D game requires:

    local ReactJIT = require("lua")

  It auto-detects whether we are running in the browser (love.js / WASM with
  Module.FS transport) or natively (embedded QuickJS), and wires up the
  appropriate bridge, tree, layout, painter, and events modules.
]]

-- Colorize [tag] prefixes in terminal output (must be first)
require("lua.log_colors")

local ReactJIT = {}

-- ============================================================================
-- Submodule references (populated in init)
--
-- All lazy-loaded modules live in M{} so that functions referencing them
-- consume a single upvalue instead of 60+. PUC Lua 5.1 (used by love.js)
-- has a hard 60-upvalue limit per function; LuaJIT doesn't, but this keeps
-- both happy.
-- ============================================================================

local M = {
  bridge   = nil,   -- bridge_fs or bridge_quickjs instance
  tree     = nil,   -- tree.lua module
  layout   = nil,   -- layout.lua module
  painter  = nil,   -- painter.lua module
  events   = nil,   -- events.lua module
  measure  = nil,   -- measure.lua module (text measurement + font cache)
  errors     = require("lua.errors"),
  Log        = require("lua.debug_log"),
  inspector  = require("lua.inspector"),
  console    = require("lua.console"),
  devtools   = require("lua.devtools"),
  settings    = require("lua.settings"),
  themeMenu   = require("lua.theme_menu"),
  systemPanel = require("lua.system_panel"),
  screenshot = nil,
  inspectorEnabled = true,
  settingsEnabled  = true,
  themeMenuEnabled = true,
  animate  = nil,
  images   = nil,
  videos   = nil,
  scene3d  = nil,
  mapmod   = nil,
  gamemod  = nil,
  emumod   = nil,
  effectsmod = nil,
  masksmod   = nil,
  videoplayer = nil,
  focus    = require("lua.focus"),
  texteditor = nil,
  textinput  = nil,
  codeblock  = nil,
  textselection = nil,
  widgets    = nil,
  contextmenu = nil,
  osk      = nil,
  http     = nil,
  network  = nil,
  tor      = nil,
  torHostnameEmitted = false,
  sqlite   = nil,
  docstore = nil,
  spellcheck = nil,
  dragdrop = nil,
  lastDragHoverId = nil,
  audioEngine = nil,
  capabilities = nil,
  httpserver = nil,
  browse   = nil,
  sysmon   = nil,
  permit   = require("lua.permit"),
  audit    = require("lua.audit"),
  quarantine = nil,
  manifestMod = require("lua.manifest"),
  cartReader  = require("lua.cart_reader"),
  themes   = nil,
  search   = nil,
  currentThemeName = 'catppuccin-mocha',
  currentTheme     = nil,
  controllerToast = {
    timer = nil,
    text = nil,
    fadeStart = 0.5,
  },
}

-- Convenience aliases for the most frequently accessed modules.
-- These are used in tight loops (update/draw) where M.xxx would add noise.
-- Everything else should go through M.
local errors     = M.errors
local Log        = M.Log
local inspector  = M.inspector
local console    = M.console
local devtools   = M.devtools
local settings   = M.settings
local themeMenu  = M.themeMenu
local systemPanel = M.systemPanel
local focus      = M.focus
local permit     = M.permit
local audit      = M.audit
local manifestMod = M.manifestMod
local cartReader  = M.cartReader

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then error("[reactjit] JSON library required but not found") end

local rpcHandlers = {}  -- RPC method -> handler function

--- Wrap an RPC handler with a permit check.  When the permit system is
--- enforcing and the category is denied, the call is blocked + audited
--- and returns nil, "capability denied: <category>".
--- @param category   string    permit category (e.g. "clipboard", "storage")
--- @param handler    function  the original RPC handler
--- @param details_fn function|nil  optional (args) -> table for audit details
local function gated(category, handler, details_fn)
  return function(args)
    if not permit.check(category) then
      local details = details_fn and details_fn(args) or {}
      audit.log("blocked", category, details, { declared = permit.getDeclared() and permit.getDeclared()[category] })
      return nil, "capability denied: " .. category
    end
    return handler(args)
  end
end

-- Scrollbar drag state
local scrollbarDrag = nil  -- { node, axis="v"|"h", startMouse, startScroll }

-- Text selection pending state: stashed on mousedown, promoted to selection on drag
local textSelectPending = nil  -- { node, startX, startY, line, col }
local TEXT_SELECT_THRESHOLD = 3  -- pixels of movement before drag becomes selection

local mode     = nil   -- "web", "native", or "canvas"
local basePath = nil   -- directory containing these modules
local initConfig = nil -- stashed config from init() for reload()

-- Interaction style overlay tracking (hoverStyle / activeStyle / focusStyle)
-- Maps nodeId -> { [propKey] = baseValue } for properties overridden by interaction
local interactionBase = {}

-- Track previously focused nodes for focusStyle updates
local prevFocusedNodeIds = {}  -- { [nodeId] = true }

-- HMR state
local hmrFrameCounter = 0
local hmrLastMtime    = nil
local hmrHasLoaded    = false

-- Helper: does the current mode run the rendering pipeline?
local function isRendering()
  return mode == "native" or mode == "canvas" or mode == "wasm"
end

-- ============================================================================
-- Mode detection
-- ============================================================================

--- Detect whether we are running in the browser (love.js) or natively.
--- In web mode, the presence of a /__bridge_namespace file signals Module.FS.
local function detectMode(config)
  if config and config.mode and config.mode ~= "auto" then
    return config.mode
  end

  -- Check for the Module.FS sentinel file
  local ns = (config and config.namespace) or "default"
  local sentinelPath = "__bridge_" .. ns .. "_ready"
  if love.filesystem.getInfo("/__bridge_namespace")
    or love.filesystem.getInfo(sentinelPath) then
    return "web"
  end

  return "native"
end

-- ============================================================================
-- Resolve require paths
-- ============================================================================

--- Figure out where our sibling modules live so requires work regardless
--- of how the user has set up their project.
local function resolveBasePath()
  -- The init.lua file is loaded via require("lua") or require("lua.init").
  -- We need the directory portion so we can require siblings.
  local info = debug.getinfo(1, "S")
  local source = info and info.source or ""
  -- Strip the leading @ that Lua adds to file-based sources
  source = source:gsub("^@", "")
  local dir = source:match("^(.*[/\\])") or ""
  return dir
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Push an event to the bridge (handles mode differences).
--- In native mode bridge:pushEvent() is used; in canvas mode bridge.emit() is used.
local function pushEvent(evt)
  Log.log("bridge", "pushEvent type=%s target=%s", tostring(evt.type), tostring(evt.payload and evt.payload.targetId or "-"))
  if mode == "native" then
    M.bridge:pushEvent(evt)
  elseif mode == "canvas" or mode == "wasm" then
    M.bridge.emit(evt.type, evt.payload)
  end
end

--- Emit a synthetic scroll event after Lua updates a scroll container.
--- This keeps JS-side ScrollView callbacks in sync with native scroll state.
local function emitScrollEvent(node)
  if not node or not node.scrollState or not M.events then return end
  local c = node.computed or {}
  local ss = node.scrollState
  local bubblePath = M.events.buildBubblePath(node)
  pushEvent(M.events.createScrollEvent(
    node.id,
    ss.scrollX or 0,
    ss.scrollY or 0,
    ss.contentW or c.w or 0,
    ss.contentH or c.h or 0,
    c.w or 0,
    c.h or 0,
    bubblePath
  ))
end

--- Emit layout events for nodes that registered onLayout handlers.
--- Only emits when computed geometry changes to avoid per-frame spam.
local function emitLayoutEvents(root)
  if not root or not M.events then return end
  local stack = { root }
  while #stack > 0 do
    local node = table.remove(stack)
    local c = node.computed
    local p = node.props or {}
    if c and p.__hasOnLayout then
      local last = node.__layoutLast
      if not last
        or last.x ~= c.x
        or last.y ~= c.y
        or last.w ~= c.w
        or last.h ~= c.h
      then
        node.__layoutLast = { x = c.x, y = c.y, w = c.w, h = c.h }
        pushEvent(M.events.createLayoutEvent(node.id, c.x, c.y, c.w, c.h))
      end
    end
    for _, child in ipairs(node.children or {}) do
      stack[#stack + 1] = child
    end
  end
end

-- ============================================================================
-- Gamepad helpers
-- ============================================================================

--- Walk up from a node to find the nearest scroll ancestor.
local function findScrollAncestor(node)
  local current = node.parent
  while current do
    if current.style and (current.style.overflow == "scroll" or current.style.overflow == "auto") then
      return current
    end
    current = current.parent
  end
  return nil
end

-- ============================================================================
-- Theme loading helper (used in both canvas and native init branches)
-- ============================================================================

local function loadThemes()
  local thOk, thMod = pcall(require, "lua.themes")
  if thOk and type(thMod) == "table" then
    M.themes = thMod
    if M.themeMenuEnabled then themeMenu.setThemes(M.themes) end
    local resolvedTheme = nil
    if M.themeMenuEnabled and themeMenu.getResolvedTheme then
      resolvedTheme = themeMenu.getResolvedTheme(M.currentThemeName)
    end
    M.currentTheme = resolvedTheme or M.themes[M.currentThemeName]
    if M.painter then M.painter.setTheme(M.currentTheme) end
    if M.textinput and M.textinput.setTheme then M.textinput.setTheme(M.currentTheme) end
    if M.texteditor and M.texteditor.setTheme then M.texteditor.setTheme(M.currentTheme) end
    if M.themeMenuEnabled then
      themeMenu.setCurrentTheme(M.currentThemeName, M.currentTheme)
    end
  end
end

-- ============================================================================
-- Interaction style overlay (hoverStyle / activeStyle / focusStyle)
-- ============================================================================

--- Apply or remove hoverStyle/activeStyle/focusStyle overlays on a node based
--- on current hover, pressed, and focus state. Uses the transition system for
--- smooth animations when the node has a `transition` config in its style.
--- This runs entirely in Lua for 0-frame latency feedback.
local function applyInteractionStyle(node)
  if not node or not node.props then return end

  local hoverStyle = node.props.hoverStyle
  local activeStyle = node.props.activeStyle
  local focusStyle = node.props.focusStyle
  if not hoverStyle and not activeStyle and not focusStyle then return end

  local isHovered = M.events and M.events.getHoveredNode() == node
  local isPressed = M.events and M.events.getPressedNode() == node
  local isFocused = focus.getInputMode() == "controller" and focus.isFocused(node)

  -- Get or create base style tracking for this node
  if not interactionBase[node.id] then
    interactionBase[node.id] = {}
  end
  local base = interactionBase[node.id]

  -- Collect all overridable keys from hover, active, and focus styles
  local allKeys = {}
  if hoverStyle then for k in pairs(hoverStyle) do allKeys[k] = true end end
  if activeStyle then for k in pairs(activeStyle) do allKeys[k] = true end end
  if focusStyle then for k in pairs(focusStyle) do allKeys[k] = true end end

  local oldValues = {}
  local newValues = {}
  local anyChange = false

  for k in pairs(allKeys) do
    -- Determine if an interaction overlay is currently active for this key
    local overrideActive = (isPressed and activeStyle and activeStyle[k] ~= nil)
      or (isFocused and focusStyle and focusStyle[k] ~= nil)
      or (isHovered and hoverStyle and hoverStyle[k] ~= nil)

    if overrideActive then
      -- Save base value before applying overlay (only on first capture)
      if base[k] == nil then
        if node.style[k] == nil then
          base[k] = "__NIL__"
        else
          base[k] = node.style[k]
        end
      end
    else
      -- No overlay active: refresh base from current node.style so React
      -- UPDATE commands (e.g. active prop toggling backgroundColor) are
      -- respected instead of restoring a stale captured value.
      if node.style[k] == nil then
        base[k] = "__NIL__"
      else
        base[k] = node.style[k]
      end
    end

    -- Compute target: active > focused > hover > base (priority order)
    local target
    if isPressed and activeStyle and activeStyle[k] ~= nil then
      target = activeStyle[k]
    elseif isFocused and focusStyle and focusStyle[k] ~= nil then
      target = focusStyle[k]
    elseif isHovered and hoverStyle and hoverStyle[k] ~= nil then
      target = hoverStyle[k]
    else
      target = base[k]
      if target == "__NIL__" then target = nil end
    end

    local current = node.style[k]
    if current ~= target then
      oldValues[k] = current
      newValues[k] = target
      node.style[k] = target
      anyChange = true
    end
  end

  -- Clean up base tracking if no longer hovered, pressed, or focused
  if not isHovered and not isPressed and not isFocused then
    interactionBase[node.id] = nil
  end

  -- Trigger transitions if configured
  if anyChange and M.animate and node.style.transition then
    M.animate.processStyleUpdate(node, oldValues, newValues)
  end

  -- Mark tree dirty if anything changed (layout or visual)
  if anyChange and M.tree then
    M.tree.markDirty()
  end
end

-- ============================================================================
-- HMR helpers
-- ============================================================================

--- Serialize a Lua value to a JavaScript source literal string.
--- Handles strings, numbers, booleans, nil, and nested tables.
local function luaTableToJSLiteral(val)
  local t = type(val)
  if t == "string" then
    -- Escape backslashes, quotes, and newlines
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
      -- Array
      local parts = {}
      for i, v in ipairs(val) do parts[i] = luaTableToJSLiteral(v) end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      -- Object
      local parts = {}
      for k, v in pairs(val) do
        parts[#parts + 1] = '"' .. tostring(k) .. '":' .. luaTableToJSLiteral(v)
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  end
  return "null"
end

-- Verbose-only startup log. No-op unless _G._reactjit_verbose is set.
local function startupLog(msg)
  if _G._reactjit_verbose then
    io.write(msg .. "\n"); io.flush()
  end
end

--- Initialize reactjit.
--- config fields:
---   mode       : "auto" | "web" | "native" | "canvas"  (default "auto")
---   bundlePath : path to the JS bundle       (default "bundle.js")
---   namespace  : bridge namespace string     (default "default")
---   libpath    : path to libquickjs shared library (default "lib/libquickjs")
---   verbose    : print all subsystem load messages (default false, or REACTJIT_VERBOSE=1)
function ReactJIT.init(config)
  config = config or {}

  -- Startup verbosity: quiet by default, verbose via config or env var.
  -- Subsystems check _G._reactjit_verbose to gate their load messages.
  local verbose = config.verbose or (os.getenv("REACTJIT_VERBOSE") == "1")
  M._startupVerbose = verbose
  _G._reactjit_verbose = verbose

  basePath = resolveBasePath()

  -- Load cartridge manifest and mint capability permits.
  -- Must happen before any module loading so gates are active.
  -- Priority: manifest.json file > inline config.manifest > no enforcement
  local manifest = manifestMod.load(basePath)
  if manifest then
    local mOk, mErrs = manifestMod.validate(manifest)
    if mOk then
      manifestMod._loaded = manifest
      local mName, mVersion = manifestMod.getIdentity(manifest)
      io.write("[MANIFEST] " .. mName .. " v" .. mVersion .. "\n"); io.flush()
      permit.mint(manifestMod.getCapabilities(manifest), audit)
    else
      io.write("[MANIFEST] Validation errors (enforcement skipped):\n"); io.flush()
      for _, e in ipairs(mErrs) do
        io.write("[MANIFEST]   " .. e .. "\n"); io.flush()
      end
    end
  elseif config.manifest and config.manifest.capabilities then
    -- Backwards compat: inline manifest in config
    manifestMod._loaded = config.manifest
    permit.mint(config.manifest.capabilities, audit)
  end

  -- Enable key repeat so held keys fire keypressed repeatedly
  -- (needed for text scale Ctrl+=/-, TextEditor backspace/arrows, etc.)
  love.keyboard.setKeyRepeat(true)

  -- Inspector/console can be disabled for production builds
  M.inspectorEnabled = config.inspector ~= false
  M.screenshotEnabled = config.screenshot ~= false

  -- Settings overlay can be disabled or configured
  M.settingsEnabled = config.settings ~= false
  if M.settingsEnabled then
    local settingsKey = "f10"
    if type(config.settings) == "table" and config.settings.key then
      settingsKey = config.settings.key
    elseif type(config.settingsKey) == "string" then
      settingsKey = config.settingsKey
    end
    settings.init({ key = settingsKey })
  end

  -- Theme menu overlay can be disabled or configured
  M.themeMenuEnabled = config.themeMenu ~= false
  if M.themeMenuEnabled then
    themeMenu.init({
      key = "f9",
      onSwitch = function(name, resolvedTheme, overrides)
        if M.themes and M.themes[name] then
          M.currentThemeName = name
          M.currentTheme = resolvedTheme or M.themes[name]
          if M.painter then M.painter.setTheme(M.currentTheme) end
          if M.textinput and M.textinput.setTheme then M.textinput.setTheme(M.currentTheme) end
          if M.texteditor and M.texteditor.setTheme then M.texteditor.setTheme(M.currentTheme) end
          if M.tree then M.tree.markDirty() end
          themeMenu.setCurrentTheme(name, M.currentTheme)
          pushEvent({
            type = "theme:switch",
            payload = {
              type = "theme:switch",
              name = name,
              overrides = overrides or {},
            }
          })
        end
      end
    })
  end

  -- System panel: always initialized by default. Can be suppressed for
  -- public-facing builds (landing pages, demos) via config.systemPanel = false.
  M.systemPanelEnabled = config.systemPanel ~= false
  if M.systemPanelEnabled then
    systemPanel.init({
      permit = require("lua.permit"),
      audit = pcall(require, "lua.audit") and require("lua.audit") or nil,
      midi = pcall(require, "lua.audio.midi") and require("lua.audio.midi") or nil,
    })
  end

  mode = detectMode(config)
  local ns = config.namespace or "default"

  if mode == "web" then
    -- Web mode: use Module.FS bridge.
    -- In web mode the DOM/browser handles rendering; Lua only bridges data.
    M.bridge = require("lua.bridge_fs")
    M.bridge.init(ns)
    print("[reactjit] Initialized in WEB mode (Module.FS bridge)")

  elseif mode == "canvas" then
    -- Canvas mode: FS bridge + native rendering pipeline.
    -- React runs in the browser, reconciler commands come via /__reconciler_in.json,
    -- and Lua handles tree/layout/painter. Events go back via bridge_fs outbox.
    M.bridge = require("lua.bridge_fs")
    M.bridge.init(ns)

    M.measure = require("lua.measure")
    M.images  = require("lua.images")
    M.videos  = require("lua.videos")
    M.videos.initBackend()
    M.animate = require("lua.animate")
    M.scene3d = require("lua.scene3d")
    M.scene3d.init()
    M.mapmod = require("lua.map")
    M.mapmod.init()
    M.emumod = require("lua.emulator")
    M.emumod.init()
    M.effectsmod = require("lua.effects")
    M.effectsmod.loadAll()
    M.masksmod = require("lua.masks")
    M.masksmod.loadAll()

    M.tree    = require("lua.tree")
    M.tree.init({ images = M.images, videos = M.videos, animate = M.animate, scene3d = M.scene3d })

    M.animate.init({ tree = M.tree })

    M.layout  = require("lua.layout")
    M.layout.init({ measure = M.measure })

    M.painter = require("lua.painter")
    M.painter.init({ measure = M.measure, images = M.images, videos = M.videos, scene3d = M.scene3d, map = M.mapmod, game = nil, emulator = M.emumod, effects = M.effectsmod, masks = M.masksmod })

    M.events  = require("lua.events")
    M.events.setTreeModule(M.tree)

    M.texteditor = require("lua.texteditor")
    M.texteditor.init({ measure = M.measure, theme = M.currentTheme })

    M.textinput = require("lua.textinput")
    M.textinput.init({ measure = M.measure, theme = M.currentTheme, spellcheck = M.spellcheck })

    M.codeblock = require("lua.codeblock")
    M.codeblock.init({ measure = M.measure })

    M.videoplayer = require("lua.videoplayer")
    M.videoplayer.init({ measure = M.measure, videos = M.videos })

    M.widgets = require("lua.widgets")
    M.widgets.init({ measure = M.measure, screenToContent = M.events.screenToContent })

    M.textselection = require("lua.textselection")
    M.textselection.init({ measure = M.measure, events = M.events, tree = M.tree })

    M.contextmenu = require("lua.contextmenu")
    M.contextmenu.init({ measure = M.measure, events = M.events, textselection = M.textselection, inspector = inspector, devtools = devtools })

    M.osk = require("lua.osk")
    M.osk.init({ measure = M.measure })

    if permit.check("storage") then
      M.sqlite = require("lua.sqlite")
      M.docstore = require("lua.docstore")
    else
      io.write("[PERMIT] storage not declared — sqlite and docstore not loaded\n"); io.flush()
    end
    M.spellcheck = require("lua.spellcheck")
    M.spellcheck.init()

    focus.init(M.tree, pushEvent)

    M.events.setWidgetsModule(M.widgets)

    M.search = require("lua.search")

    loadThemes()

    print("[reactjit] Initialized in CANVAS mode (Module.FS bridge + native rendering)")
    -- Push initial viewport dimensions for canvas mode
    pushEvent({ type = "viewport", payload = { width = love.graphics.getWidth(), height = love.graphics.getHeight() } })

  elseif mode == "wasm" then
    -- WASM mode: FS bridge + native rendering pipeline, NO FFI modules.
    -- Same as canvas mode but skips videos, emulator, sqlite, crypto, etc.
    -- Used by love.js (Love2D compiled to WASM via Emscripten with PUC Lua 5.1).
    M.bridge = require("lua.bridge_fs")
    M.bridge.init(ns)

    M.measure = require("lua.measure")
    M.images  = require("lua.images")
    -- videos: SKIPPED (libmpv FFI)
    M.animate = require("lua.animate")
    M.scene3d = require("lua.scene3d")
    M.scene3d.init()
    -- map/browse/docstore/websocket/wsserver: stripped from WASM builds (use goto / PUC 5.1 incompatible)
    local ok_map, map_ = pcall(require, "lua.map")
    if ok_map then M.mapmod = map_; M.mapmod.init() end
    -- emulator: SKIPPED (FFI)
    M.effectsmod = require("lua.effects")
    M.effectsmod.loadAll()
    M.masksmod = require("lua.masks")
    M.masksmod.loadAll()

    M.tree    = require("lua.tree")
    M.tree.init({ images = M.images, videos = nil, animate = M.animate, scene3d = M.scene3d })

    M.animate.init({ tree = M.tree })

    M.layout  = require("lua.layout")
    M.layout.init({ measure = M.measure })

    M.painter = require("lua.painter")
    M.painter.init({ measure = M.measure, images = M.images, videos = nil, scene3d = M.scene3d, map = M.mapmod, game = nil, emulator = nil, effects = M.effectsmod, masks = M.masksmod })

    M.events  = require("lua.events")
    M.events.setTreeModule(M.tree)

    M.texteditor = require("lua.texteditor")
    M.texteditor.init({ measure = M.measure, theme = M.currentTheme })

    M.textinput = require("lua.textinput")
    M.textinput.init({ measure = M.measure, theme = M.currentTheme, spellcheck = M.spellcheck })

    M.codeblock = require("lua.codeblock")
    M.codeblock.init({ measure = M.measure })

    -- videoplayer: SKIPPED (depends on videos)

    M.widgets = require("lua.widgets")
    M.widgets.init({ measure = M.measure, screenToContent = M.events.screenToContent })

    M.textselection = require("lua.textselection")
    M.textselection.init({ measure = M.measure, events = M.events, tree = M.tree })

    M.contextmenu = require("lua.contextmenu")
    M.contextmenu.init({ measure = M.measure, events = M.events, textselection = M.textselection, inspector = inspector, devtools = devtools })

    M.osk = require("lua.osk")
    M.osk.init({ measure = M.measure })

    -- sqlite/docstore/spellcheck: SKIPPED (sqlite is FFI, spellcheck depends on sqlite)

    focus.init(M.tree, pushEvent)

    M.events.setWidgetsModule(M.widgets)

    loadThemes()

    print("[reactjit] Initialized in WASM mode (Module.FS bridge + native rendering, no FFI)")
    pushEvent({ type = "viewport", payload = { width = love.graphics.getWidth(), height = love.graphics.getHeight() } })

  else
    -- Native mode: use QuickJS bridge + retained tree + layout + painter.
    initConfig = {
      libpath = config.libpath or "lib/libquickjs",
      bundlePath = config.bundlePath or "bundle.js",
    }

    -- Init mpv BEFORE QuickJS — libquickjs dlopen can interfere with mpv's GL setup
    M.videos  = require("lua.videos")
    M.videos.initBackend()

    local BridgeQJS = require("lua.bridge_quickjs")
    M.bridge = BridgeQJS.new(initConfig.libpath)

    -- Initialize crypto miner detection (scans JS at eval time, .so at load time)
    local qOk, qMod = pcall(require, "lua.quarantine")
    if qOk and qMod then
      M.quarantine = qMod
      M.quarantine.init({ permit = permit, audit = audit })
      BridgeQJS.setQuarantine(M.quarantine)
    end

    M.measure = require("lua.measure")
    M.images  = require("lua.images")
    M.animate = require("lua.animate")
    M.scene3d = require("lua.scene3d")
    M.scene3d.init()
    M.mapmod = require("lua.map")
    M.mapmod.init()
    M.emumod = require("lua.emulator")
    M.emumod.init()
    M.effectsmod = require("lua.effects")
    M.effectsmod.loadAll()
    M.masksmod = require("lua.masks")
    M.masksmod.loadAll()

    M.tree    = require("lua.tree")
    M.tree.init({ images = M.images, videos = M.videos, animate = M.animate, scene3d = M.scene3d })

    M.animate.init({ tree = M.tree })

    M.layout  = require("lua.layout")
    M.layout.init({ measure = M.measure })

    M.painter = require("lua.painter")
    M.painter.init({ measure = M.measure, images = M.images, videos = M.videos, scene3d = M.scene3d, map = M.mapmod, game = nil, emulator = M.emumod, effects = M.effectsmod, masks = M.masksmod })

    M.events  = require("lua.events")
    M.events.setTreeModule(M.tree)

    M.texteditor = require("lua.texteditor")
    M.texteditor.init({ measure = M.measure, theme = M.currentTheme })

    M.textinput = require("lua.textinput")
    M.textinput.init({ measure = M.measure, theme = M.currentTheme, spellcheck = M.spellcheck })

    M.codeblock = require("lua.codeblock")
    M.codeblock.init({ measure = M.measure })

    M.videoplayer = require("lua.videoplayer")
    M.videoplayer.init({ measure = M.measure, videos = M.videos })

    M.widgets = require("lua.widgets")
    M.widgets.init({ measure = M.measure, screenToContent = M.events.screenToContent })

    M.textselection = require("lua.textselection")
    M.textselection.init({ measure = M.measure, events = M.events, tree = M.tree })

    M.contextmenu = require("lua.contextmenu")
    M.contextmenu.init({ measure = M.measure, events = M.events, textselection = M.textselection, inspector = inspector, devtools = devtools })

    M.osk = require("lua.osk")
    M.osk.init({ measure = M.measure })

    if permit.check("storage") then
      M.sqlite = require("lua.sqlite")
      M.docstore = require("lua.docstore")
    else
      io.write("[PERMIT] storage not declared — sqlite and docstore not loaded\n"); io.flush()
    end
    M.spellcheck = require("lua.spellcheck")
    M.spellcheck.init()

    focus.init(M.tree, pushEvent)

    M.events.setWidgetsModule(M.widgets)

    -- App-wide text search (hot index over live tree + cold structural paths)
    M.search = require("lua.search")

    -- Initialize async HTTP (love.thread + LuaSocket) — gated by network permit
    if permit.check("network") then
      M.http = require("lua.http")
      M.http.init()

      -- Initialize WebSocket network manager
      M.network = require("lua.network")
      M.network.init()
    else
      io.write("[PERMIT] network not declared — http and network modules not loaded\n"); io.flush()
    end

    -- Initialize Tor if enabled (opt-in via config.tor) — gated by process permit
    if config.tor and permit.check("process", "tor") then
      M.tor = require("lua.tor")
      M.torHostnameEmitted = false
      if config.tor.autoStart ~= false then
        local ok, err = M.tor.start({
          hsPort = config.tor.hsPort or 8080,
          identity = love.filesystem.getIdentity() or "default",
        })
        if ok then
          startupLog("[reactjit] Tor hidden service starting...")
        else
          io.write("[reactjit] Tor failed to start: " .. tostring(err) .. "\n"); io.flush()
        end
      end
    end

    -- Initialize drag-hover detection (X11 + SDL2, Linux only)
    local ddOk, ddMod = pcall(require, "lua.dragdrop")
    if ddOk then
      M.dragdrop = ddMod
      M.dragdrop.init()
    end

    -- Load the bundled React app into QuickJS
    local bundleJS = love.filesystem.read(initConfig.bundlePath)
    if not bundleJS then
      error("[reactjit] " .. initConfig.bundlePath .. " not found -- run `npm run build` first")
    end

    -- Tell the bundle to defer root.render() so JS_Eval returns immediately.
    -- React's synchronous LegacyRoot render would otherwise block inside JS_Eval.
    M.bridge:eval("globalThis.__deferMount = true;", "<pre-bundle>")

    print("[reactjit] Evaluating bundle (" .. #bundleJS .. " bytes)...")
    M.bridge:eval(bundleJS, initConfig.bundlePath)
    print("[reactjit] Bundle loaded OK")

    -- Don't mount yet — that happens in the first update() call so the
    -- Love2D event loop is running and we can tick timers between frames.
    ReactJIT._needsMount = true

    loadThemes()

    print("[reactjit] Initialized in NATIVE mode (QuickJS bridge)")
  end

  -- Load RPC handler modules (native and canvas modes) — gated by storage permit
  if isRendering() and permit.check("storage") then
    local sok, storage = pcall(require, "lua.storage")
    if sok then
      for method, handler in pairs(storage.getHandlers()) do
        rpcHandlers[method] = gated("storage", handler)
      end
    end
  end

  -- Register local store RPC handlers (SQLite-backed key-value persistence)
  if M.sqlite and M.sqlite.available then
    local lsOk, localstore = pcall(require, "lua.localstore")
    if lsOk then
      localstore.init()
      for method, handler in pairs(localstore.getHandlers()) do
        rpcHandlers[method] = gated("storage", handler)
      end
    end
  end

  -- Register game module RPC handler (JS → Lua commands)
  rpcHandlers["game:command"] = function(args)
    io.write("[rpc] game:command received: " .. tostring(args and args.command) .. " module=" .. tostring(args and args.module) .. "\n"); io.flush()
    if M.gamemod then return M.gamemod.handleCommand(args) end
  end

  -- Expose current inspector perf counters for stress-test dashboards.
  rpcHandlers["dev:perf"] = function()
    if inspector and inspector.getPerfData then
      return inspector.getPerfData()
    end
    return {
      fps = love.timer.getFPS(),
      layoutMs = 0,
      paintMs = 0,
      nodeCount = 0,
    }
  end

  -- ── Lua-side interval timer service ──────────────────────────────────
  -- JS calls timer:create to start a repeating timer. Lua ticks it in
  -- love.update(dt) and pushes a timer:tick event each interval.
  -- Eliminates the need for setInterval in JS hooks entirely.

  local luaTimers = {}       -- id -> { interval, elapsed, event }
  local luaTimerNextId = 0

  rpcHandlers["timer:create"] = function(args)
    luaTimerNextId = luaTimerNextId + 1
    local id = luaTimerNextId
    luaTimers[id] = {
      interval = (args.interval or 1000) / 1000,  -- ms -> seconds
      elapsed = 0,
      event = args.event or ("timer:" .. id),
      payload = args.payload,   -- optional extra data to pass back
    }
    return { id = id }
  end

  rpcHandlers["timer:cancel"] = function(args)
    if args and args.id then luaTimers[args.id] = nil end
  end

  -- Tick all lua timers. Called from ReactJIT.update(dt).
  M._tickLuaTimers = function(dt)
    for id, t in pairs(luaTimers) do
      t.elapsed = t.elapsed + dt
      if t.elapsed >= t.interval then
        t.elapsed = t.elapsed - t.interval
        pushEvent({ type = t.event, payload = t.payload or { timerId = id } })
      end
    end
  end

  -- App-wide text search RPC handlers
  rpcHandlers["search:query"] = function(args)
    if not M.search then return {} end
    local tree = M.tree and M.tree.getTree()
    if not tree then return {} end
    local hotIndex = M.search.buildHotIndex(tree)
    local matches  = M.search.query(hotIndex, args and args.query or "")
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
    if not M.search then return false end
    local tree = M.tree and M.tree.getTree()
    if not tree then return false end
    if args and args.path then
      local node = M.search.resolvePath(tree, args.path)
      if node then M.search.navigateTo(node); return true end
    end
    if args and args.text then
      return M.search.navigateByText(tree, args.text)
    end
    return false
  end

  rpcHandlers["search:clear"] = function()
    if M.search then M.search.clearHighlight() end
    return true
  end

  -- Register settings RPC handlers (API key management)
  if M.settingsEnabled then
    rpcHandlers["settings:getKeys"] = function()
      return settings.getKeys()
    end
    rpcHandlers["settings:getKey"] = function(args)
      if args and args.serviceId then
        return settings.getKey(args.serviceId, args.fieldKey)
      end
      return nil
    end
  end

  -- Register SQLite RPC handlers (available when libsqlite3 is loaded)
  if M.sqlite and M.sqlite.available then
    local sqliteDbs = {}  -- id -> Database
    local sqliteNextId = 1

    rpcHandlers["sqlite:open"] = function(args)
      local db = M.sqlite.open(args.path)  -- nil = in-memory
      local id = sqliteNextId
      sqliteNextId = sqliteNextId + 1
      sqliteDbs[id] = db
      return { id = id, path = db.path }
    end

    rpcHandlers["sqlite:close"] = function(args)
      local db = sqliteDbs[args.id]
      if db then db:close(); sqliteDbs[args.id] = nil end
      return true
    end

    rpcHandlers["sqlite:exec"] = function(args)
      local db = sqliteDbs[args.id]
      if not db then error("Unknown database id: " .. tostring(args.id)) end
      db:exec(args.sql, args.params)
      return { changes = db:changes(), lastInsertId = db:lastInsertId() }
    end

    rpcHandlers["sqlite:query"] = function(args)
      local db = sqliteDbs[args.id]
      if not db then error("Unknown database id: " .. tostring(args.id)) end
      return db:query(args.sql, args.params)
    end

    rpcHandlers["sqlite:queryOne"] = function(args)
      local db = sqliteDbs[args.id]
      if not db then error("Unknown database id: " .. tostring(args.id)) end
      return db:queryOne(args.sql, args.params)
    end

    rpcHandlers["sqlite:scalar"] = function(args)
      local db = sqliteDbs[args.id]
      if not db then error("Unknown database id: " .. tostring(args.id)) end
      return db:scalar(args.sql, args.params)
    end
  end

  -- Register docstore RPC handlers (schema-free document API)
  if M.docstore and M.docstore.available then
    local stores = {}  -- id -> Store
    local storeNextId = 1

    rpcHandlers["doc:open"] = function(args)
      local store = M.docstore.open(args.path)
      local id = storeNextId
      storeNextId = storeNextId + 1
      stores[id] = store
      return { id = id }
    end

    rpcHandlers["doc:close"] = function(args)
      local store = stores[args.id]
      if store then store:close(); stores[args.id] = nil end
      return true
    end

    rpcHandlers["doc:save"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:save(args.collection, args.doc)
    end

    rpcHandlers["doc:find"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:find(args.collection, args.query, args.opts)
    end

    rpcHandlers["doc:findOne"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:findOne(args.collection, args.query)
    end

    rpcHandlers["doc:get"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:get(args.collection, args.docId)
    end

    rpcHandlers["doc:update"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:update(args.collection, args.docId, args.patch)
    end

    rpcHandlers["doc:remove"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:remove(args.collection, args.docId)
    end

    rpcHandlers["doc:count"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:count(args.collection, args.query)
    end

    rpcHandlers["doc:collections"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:collections()
    end

    rpcHandlers["doc:drop"] = function(args)
      local store = stores[args.id]
      if not store then error("Unknown store id: " .. tostring(args.id)) end
      return store:drop(args.collection)
    end
  end

  -- Register spell check RPC handlers
  if M.spellcheck and M.spellcheck.available then
    rpcHandlers["spell:check"] = function(args)
      return M.spellcheck.check(args.word)
    end

    rpcHandlers["spell:checkText"] = function(args)
      return M.spellcheck.checkText(args.text)
    end

    rpcHandlers["spell:suggest"] = function(args)
      return M.spellcheck.suggest(args.word, args.limit)
    end

    rpcHandlers["spell:setLang"] = function(args)
      M.spellcheck.setLang(args.lang)
      return true
    end
  end

  -- Register crypto RPC handlers (libsodium + libcrypto + libblake3)
  do
    local cok, cryptomod = pcall(require, "lua.crypto")
    if cok and cryptomod.available then
      for method, handler in pairs(cryptomod.getHandlers()) do
        rpcHandlers[method] = gated("crypto", handler)
      end
    elseif not cok then
      startupLog("[reactjit] crypto module not loaded: " .. tostring(cryptomod))
    end
  end

  -- Register clipboard RPC handlers — gated by clipboard permit
  if isRendering() then
    rpcHandlers["clipboard:read"] = gated("clipboard", function()
      return love.system.getClipboardText()
    end)
    rpcHandlers["clipboard:write"] = gated("clipboard", function(args)
      love.system.setClipboardText(args.text)
      return true
    end)
  end

  -- Load system monitoring module — gated by sysmon permit
  if permit.check("sysmon") then
    local smOk, smMod = pcall(require, "lua.sysmon")
    if smOk then
      M.sysmon = smMod
      for method, handler in pairs(M.sysmon.getHandlers()) do
        rpcHandlers[method] = gated("sysmon", handler)
      end
    end
  end

  -- Register Tor RPC handlers — already gated at module load (process permit)
  if M.tor then
    rpcHandlers["tor:getHostname"] = gated("process", function()
      local hostname = M.tor.getHostname()
      return hostname
    end)
    rpcHandlers["tor:getProxyPort"] = gated("process", function()
      return M.tor.getProxyPort()
    end)
    rpcHandlers["tor:getLocalPort"] = gated("process", function()
      return M.tor.getLocalPort()
    end)
  end

  -- Load audio engine (optional — graceful degradation if not available)
  local aeOk, aeMod = pcall(require, "lua.audio.engine")
  if aeOk and aeMod then
    M.audioEngine = aeMod
    -- Register all audio RPC handlers
    for method, handler in pairs(M.audioEngine.getHandlers()) do
      rpcHandlers[method] = handler
    end
    -- Override audio:init to inject the bridge reference automatically
    rpcHandlers["audio:init"] = function(args)
      args = args or {}
      args.bridge = M.bridge
      M.audioEngine.init(args)
      return true
    end
    startupLog("[reactjit] Audio engine loaded")
  end

  -- Initialize window manager (multi-window support)
  -- Must happen before capabilities so the Window capability can use WM.create().
  local wmOk, wmMod = pcall(require, "lua.window_manager")
  if wmOk and wmMod then
    wmMod.init()  -- auto-detects Love2D backend
    wmMod.registerMain()
    startupLog("[reactjit] Window manager loaded (backend=" .. tostring(wmMod.getBackend()) .. ")")

    -- Helper: resolve window entry from optional windowId (defaults to main)
    local function resolveWindow(args)
      if args and args.windowId then
        return wmMod.get(args.windowId)
      end
      return wmMod.getMain()
    end

    -- Declarative window resize: useWindowSize(w, h, { animate, windowId })
    rpcHandlers["window:setSize"] = function(args)
      local win = resolveWindow(args)
      if not win then return false end
      local w = args.width or win.width
      local h = args.height or win.height
      if args.animate then
        wmMod.animateTo(win, w, h, args.duration or 300)
      else
        wmMod.setSize(win, w, h)
      end
      return { width = w, height = h }
    end

    -- Declarative window position: useWindowPosition(x, y, { animate, windowId })
    rpcHandlers["window:setPosition"] = function(args)
      local win = resolveWindow(args)
      if not win then return false end
      local x = args.x or 0
      local y = args.y or 0
      if args.animate then
        wmMod.animatePositionTo(win, x, y, args.duration or 300)
      else
        wmMod.setPosition(win, x, y)
      end
      return { x = x, y = y }
    end

    -- Query current window position (for revert support in hooks)
    rpcHandlers["window:getPosition"] = function(args)
      local win = resolveWindow(args)
      if not win then return false end
      local x, y = wmMod.getPosition(win)
      return { x = x, y = y }
    end

    -- Toggle always-on-top: useWindowAlwaysOnTop(true, { windowId })
    rpcHandlers["window:setAlwaysOnTop"] = function(args)
      local win = resolveWindow(args)
      if not win then return false end
      wmMod.setAlwaysOnTop(win, args.onTop)
      return { onTop = args.onTop }
    end

    -- Raise window to front
    rpcHandlers["window:raise"] = function(args)
      local win = resolveWindow(args)
      if not win then return false end
      wmMod.raise(win)
      return true
    end
  end

  -- Load declarative capabilities (Audio, Timer, etc.)
  local capOk, capMod = pcall(require, "lua.capabilities")
  if capOk and capMod then
    M.capabilities = capMod
    M.capabilities.loadAll()
    for method, handler in pairs(M.capabilities.getHandlers()) do
      rpcHandlers[method] = handler
    end
    -- Wire capabilities into events.lua for visual capability hit testing
    if M.events then M.events.setCapabilitiesModule(capMod) end
    startupLog("[reactjit] Capabilities registry loaded")
  end

  -- Load HTTP server — gated by network permit (it binds a port)
  if permit.check("network") then
    local hsOk, hsMod = pcall(require, "lua.httpserver")
    if hsOk and hsMod then
      M.httpserver = hsMod
      for method, handler in pairs(M.httpserver.getHandlers()) do
        rpcHandlers[method] = gated("network", handler)
      end
      startupLog("[reactjit] HTTP server loaded")
    end
  end

  -- Load browse module — gated by browse permit
  if permit.check("browse") then
    local brOk, brMod = pcall(require, "lua.browse")
    if brOk and brMod then
      M.browse = brMod
      M.browse.init()
      startupLog("[reactjit] Browse module loaded")
    end
  end

  -- Load archive module (optional — requires libarchive)
  local arOk, arMod = pcall(require, "lua.archive")
  if arOk and arMod and arMod.available then
    for method, handler in pairs(arMod.getHandlers()) do
      rpcHandlers[method] = handler
    end
    startupLog("[reactjit] Archive module loaded")
  end

  -- Load media scanner module (optional — directory scanning + indexing)
  local mdOk, mdMod = pcall(require, "lua.media")
  if mdOk and mdMod then
    for method, handler in pairs(mdMod.getHandlers()) do
      rpcHandlers[method] = handler
    end
    startupLog("[reactjit] Media scanner loaded")
  end

  -- Register map RPC handlers (panTo, zoomTo, flyTo, fitBounds, etc.)
  if M.mapmod then
    local mapRpcMethods = {
      "map:panTo", "map:zoomTo", "map:flyTo", "map:fitBounds",
      "map:setBearing", "map:setPitch", "map:getView",
      "map:downloadRegion", "map:downloadProgress", "map:cacheStats",
    }
    for _, method in ipairs(mapRpcMethods) do
      rpcHandlers[method] = function(args) return M.mapmod.handleRPC(method, args) end
    end
    startupLog("[reactjit] Map module loaded")
  end

  -- Register permit + audit + quarantine + manifest RPC handlers (always available for inspector queries)
  for method, handler in pairs(permit.getHandlers()) do
    rpcHandlers[method] = handler
  end
  for method, handler in pairs(audit.getHandlers()) do
    rpcHandlers[method] = handler
  end
  if M.quarantine then
    for method, handler in pairs(M.quarantine.getHandlers()) do
      rpcHandlers[method] = handler
    end
  end
  for method, handler in pairs(manifestMod.getHandlers()) do
    rpcHandlers[method] = handler
  end
  for method, handler in pairs(cartReader.getHandlers()) do
    rpcHandlers[method] = handler
  end

  -- Wire up console + inspector + devtools (only in rendering modes with inspector enabled)
  if isRendering() and M.inspectorEnabled then
    console.init({ bridge = M.bridge, tree = M.tree, inspector = inspector })
    inspector.setConsole(console)
    devtools.init({ inspector = inspector, console = console, tree = M.tree, bridge = M.bridge, pushEvent = pushEvent })
  end

  -- Screenshot mode (env var trigger, works in native and canvas modes)
  if os.getenv("ILOVEREACT_SCREENSHOT") == "1" then
    M.screenshot = require("lua.screenshot")
    M.screenshot.init({
      outputPath = os.getenv("ILOVEREACT_SCREENSHOT_OUTPUT") or "screenshot.png",
    })
  end
end

--- Call once per frame from love.update(dt).
--- Ticks the bridge, drains mutation commands, and relayouts the tree.
function ReactJIT.update(dt)
  -- System panel update runs regardless of mode (debounced save, device rescan)
  if M.systemPanelEnabled then systemPanel.update(dt) end

  if mode == "web" then
    -- Web mode: poll the Module.FS inbox and flush the outbox
    M.bridge.poll()
    M.bridge.flush()
    return
  end

  if mode == "canvas" or mode == "wasm" then
    -- Canvas/WASM mode: FS bridge + native rendering pipeline -----------

    Log.frame()

    -- Audio engine update (fill QueueableSource buffers — run early to avoid underruns)
    if M.audioEngine then M.audioEngine.update(dt) end

    -- 1. Poll the standard bridge inbox for user/state commands
    M.bridge.poll()

    -- 2. Poll the dedicated reconciler command inbox (/__reconciler_in.json)
    local reconPath = "__reconciler_in.json"
    if love.filesystem.getInfo(reconPath) then
      local raw = love.filesystem.read(reconPath)
      love.filesystem.remove(reconPath)
      if raw and raw ~= "" then
        local ok, commands = pcall(json.decode, raw)
        if ok and type(commands) == "table" then
          M.tree.applyCommands(commands)
          -- Forward mutations to devtools pop-out child
          if M.inspectorEnabled and devtools.isPoppedOut() then
            devtools.forwardMutations(commands)
          end
        end
      end
    end

    -- 3. Tick Lua-side transitions, animations, and interval timers (before layout)
    if M.animate then M.animate.tick(dt) end
    if M._tickLuaTimers then M._tickLuaTimers(dt) end

    -- 4. Relayout if tree changed
    if M.tree.isDirty() then
      local root = M.tree.getTree()
      if root then
        if M.inspectorEnabled then inspector.beginLayout() end
        local vh = M.inspectorEnabled and devtools.getViewportHeight() or nil
        M.layout.layout(root, nil, nil, nil, vh)
        emitLayoutEvents(root)
        if M.inspectorEnabled then inspector.endLayout(root) end
      end
      M.tree.clearDirty()
    end

    -- Update TextEditor/TextInput blink timer if one has focus (canvas mode)
    local canvasFocusedNode = focus.get()
    if canvasFocusedNode and canvasFocusedNode.type == "TextEditor" then
      local result = M.texteditor.update(canvasFocusedNode, dt)
      if result == "change" then
        pushEvent({
          type = "texteditor:change",
          payload = {
            type = "texteditor:change",
            targetId = canvasFocusedNode.id,
            value = M.texteditor.getValue(canvasFocusedNode),
          }
        })
      end
    elseif canvasFocusedNode and canvasFocusedNode.type == "TextInput" then
      M.textinput.update(canvasFocusedNode, dt)
      M.textinput.tickChange(canvasFocusedNode, dt, pushEvent)
    end

    -- Sync playground editor hover -> preview overlay link
    if M.inspectorEnabled and inspector and inspector.setPlaygroundLink then
      if canvasFocusedNode and canvasFocusedNode.type == "TextEditor" and M.texteditor and M.texteditor.getHoverContext then
        inspector.setPlaygroundLink(M.texteditor.getHoverContext(canvasFocusedNode))
      else
        inspector.setPlaygroundLink(nil)
      end
    end

    if M.codeblock then M.codeblock.update(dt) end

    -- Update VideoPlayer controls (auto-hide timer, canvas mode)
    if M.videoplayer and M.tree then
      M.videoplayer.update(dt, M.tree.getNodes())
    end

    if M.inspectorEnabled then inspector.update(dt) end
    if M.inspectorEnabled then console.update(dt) end
    if M.inspectorEnabled then devtools.tick(dt) end
    if M.screenshot then M.screenshot.update() end

    -- 5. Flush bridge outbox (events back to JS)
    M.bridge.flush()
    return
  end

  -- Native mode -----------------------------------------------------------

  Log.frame()

  -- Audio engine update (fill QueueableSource buffers — run early to avoid underruns)
  if M.audioEngine then M.audioEngine.update(dt) end

  -- HMR: poll bundle.js mtime every ~1 second for changes
  hmrFrameCounter = hmrFrameCounter + 1
  if hmrFrameCounter % 60 == 0 and initConfig then
    local info = love.filesystem.getInfo(initConfig.bundlePath)
    if info and info.modtime then
      if hmrLastMtime == nil then
        hmrLastMtime = info.modtime
      elseif info.modtime ~= hmrLastMtime then
        hmrLastMtime = info.modtime
        if hmrHasLoaded then
          ReactJIT.reload()
          return
        end
      end
      hmrHasLoaded = true
    end
  end

  -- Deferred mount: trigger root.render() on the first update so the
  -- Love2D event loop is already running. Uses callGlobal (JS_Call)
  -- instead of eval because JS_Eval hangs after complex React renders.
  if ReactJIT._needsMount then
    ReactJIT._needsMount = nil
    M.bridge:callGlobal("__mount")
    -- Tick immediately to drain any scheduled microtasks/timers
    M.bridge:tick()
    -- Push initial viewport dimensions so useWindowDimensions can pick them up
    pushEvent({ type = "viewport", payload = { width = love.graphics.getWidth(), height = love.graphics.getHeight() } })
  end

  -- 1. Tick JS timers + microtasks
  M.bridge:tick()

  -- 1b. Tick Lua-side interval timers (pushes events for JS polling hooks)
  if M._tickLuaTimers then M._tickLuaTimers(dt) end

  -- 2. Tell JS to process any pending input events
  local ok, err = pcall(function() M.bridge:callGlobal("_pollAndDispatchEvents") end)
  if not ok then
    errors.push({
      source = "bridge",
      message = tostring(err),
      context = "event dispatch (_pollAndDispatchEvents)",
    })
  end

  -- Note: no second bridge:tick() here. Input-triggered state updates
  -- are deferred and will be processed on the next frame's tick.
  -- The double-tick was halving JS throughput at high framerates.

  -- 4. Drain mutation commands from JS and apply to retained tree
  local commands = M.bridge:drainCommands()
  Log.log("bridge", "drainCommands: %d commands", #commands)
  if #commands > 0 then
    -- Filter out RPC calls and route them to registered handlers
    local treeCommands = commands
    local hasSpecial = false
    for _, cmd in ipairs(commands) do
      if type(cmd) == "table" then
        local t = cmd.type
        if t == "rpc:call" or t == "http:request" or t == "http:stream" or t == "browse:request"
           or t == "ws:connect" or t == "ws:send" or t == "ws:close"
           or t == "ws:listen" or t == "ws:broadcast" or t == "ws:peer:send" or t == "ws:server:stop"
           or t == "theme:set"
           or t == "settings:registry" or t == "settings:keys:set" then
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
              local ok, result = pcall(handler, payload.args)
              if ok then
                pushEvent({ type = "rpc:" .. payload.id, payload = { result = result } })
              else
                pushEvent({ type = "rpc:" .. payload.id, payload = { error = tostring(result) } })
              end
            else
              pushEvent({ type = "rpc:" .. payload.id, payload = { error = "Unknown RPC method: " .. payload.method } })
            end
          end
        elseif type(cmd) == "table" and cmd.type == "http:request" then
          -- HTTP fetch request: scan URL for mining pool indicators
          local payload = cmd.payload
          if payload and payload.url and M.quarantine and not M.quarantine.isActive() then
            local urlResult = M.quarantine.scanURL(payload.url)
            if urlResult.detected then
              M.quarantine.activate("mining_pool_connection", urlResult.matches)
            end
          end
          if payload and payload.id and payload.url then
            if M.http then
              local immediate = M.http.request(payload.id, {
                url = payload.url,
                method = payload.method,
                headers = payload.headers,
                body = payload.body,
                proxy = payload.proxy,
              })
              -- Local file reads return immediately
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
          -- HTTP streaming request: scan URL for mining pool indicators
          local payload = cmd.payload
          if payload and payload.url and M.quarantine and not M.quarantine.isActive() then
            local urlResult = M.quarantine.scanURL(payload.url)
            if urlResult.detected then
              M.quarantine.activate("mining_pool_connection", urlResult.matches)
            end
          end
          if payload and payload.id and payload.url then
            if M.http then
              local immediate = M.http.streamRequest(payload.id, {
                url = payload.url,
                method = payload.method,
                headers = payload.headers,
                body = payload.body,
                proxy = payload.proxy,
              })
              -- Local file reads return immediately (no streaming for local files)
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
        elseif type(cmd) == "table" and cmd.type == "browse:request" then
          -- Browse session command: dispatch to browse TCP client
          local payload = cmd.payload
          if payload and payload.id and payload.cmd then
            if M.browse then
              M.browse.request(payload.id, payload.cmd, payload.host, payload.port)
            else
              pushEvent({
                type = "browse:response",
                payload = { id = payload.id, error = "Browse module not available" },
              })
            end
          end
        elseif type(cmd) == "table" and cmd.type == "ws:connect" then
          -- WebSocket connect — scan URL for mining pool indicators
          local payload = cmd.payload
          if payload and payload.url and M.quarantine and not M.quarantine.isActive() then
            local urlResult = M.quarantine.scanURL(payload.url)
            if urlResult.detected then
              M.quarantine.activate("mining_pool_connection", urlResult.matches)
            end
          end
          if payload and payload.id and payload.url and M.network then
            M.network.connect(payload.id, payload.url)
          end
        elseif type(cmd) == "table" and cmd.type == "ws:send" then
          -- WebSocket send
          local payload = cmd.payload
          if payload and payload.id and M.network then
            M.network.send(payload.id, payload.data or "")
          end
        elseif type(cmd) == "table" and cmd.type == "ws:close" then
          -- WebSocket close
          local payload = cmd.payload
          if payload and payload.id and M.network then
            M.network.close(payload.id, payload.code, payload.reason)
          end
        elseif type(cmd) == "table" and cmd.type == "ws:listen" then
          -- Start WebSocket server
          local payload = cmd.payload
          if payload and payload.serverId and payload.port and M.network then
            M.network.listen(payload.serverId, payload.port, payload.host)
          end
        elseif type(cmd) == "table" and cmd.type == "ws:broadcast" then
          -- Broadcast to all server clients
          local payload = cmd.payload
          if payload and payload.serverId and M.network then
            M.network.broadcast(payload.serverId, payload.data or "")
          end
        elseif type(cmd) == "table" and cmd.type == "ws:peer:send" then
          -- Send to specific client on server
          local payload = cmd.payload
          if payload and payload.serverId and payload.clientId and M.network then
            M.network.sendToClient(payload.serverId, payload.clientId, payload.data or "")
          end
        elseif type(cmd) == "table" and cmd.type == "ws:server:stop" then
          -- Stop a server
          local payload = cmd.payload
          if payload and payload.serverId and M.network then
            M.network.stopServer(payload.serverId)
          end
        elseif type(cmd) == "table" and cmd.type == "theme:set" then
          -- Switch active theme
          local payload = cmd.payload
          local name = payload and payload.name
          if name and M.themes and M.themes[name] then
            M.currentThemeName = name
            local resolvedTheme = nil
            if M.themeMenuEnabled and themeMenu.getResolvedTheme then
              resolvedTheme = themeMenu.getResolvedTheme(name)
            end
            M.currentTheme = resolvedTheme or M.themes[name]
            if M.painter then M.painter.setTheme(M.currentTheme) end
            if M.textinput and M.textinput.setTheme then M.textinput.setTheme(M.currentTheme) end
            if M.texteditor and M.texteditor.setTheme then M.texteditor.setTheme(M.currentTheme) end
            if M.tree then M.tree.markDirty() end
            if M.themeMenuEnabled then themeMenu.setCurrentTheme(name, M.currentTheme) end
          end

        elseif type(cmd) == "table" and cmd.type == "settings:registry" then
          -- Receive service definitions from React
          local payload = cmd.payload
          if payload and payload.services and M.settingsEnabled then
            settings.setServices(payload.services)
            startupLog("[reactjit] Settings: registered " .. #payload.services .. " services")
          end

        elseif type(cmd) == "table" and cmd.type == "settings:keys:set" then
          -- React-side programmatic key update
          local payload = cmd.payload
          if payload and payload.serviceId and payload.fieldKey and M.settingsEnabled then
            settings.setKey(payload.serviceId, payload.fieldKey, payload.value)
          end

        else
          treeCommands[#treeCommands + 1] = cmd
        end
      end
    end

    if #treeCommands > 0 then
      if not ReactJIT._loggedCommands then
        ReactJIT._loggedCommands = true
        io.write("[reactjit] First batch: " .. #treeCommands .. " commands\n"); io.flush()
      end
      M.tree.applyCommands(treeCommands)

      -- Forward mutations to devtools pop-out child
      if M.inspectorEnabled and devtools.isPoppedOut() then
        devtools.forwardMutations(treeCommands)
      end

      -- Forward mutations to child window processes
      local winApi = package.loaded["lua.capabilities.window_api"]
      if winApi then
        local IPC = require("lua.window_ipc")
        local activeChildren = winApi.getChildren()
        if #activeChildren > 0 then
          -- Build the set of Window root node IDs → child window IDs
          local windowRootNodeIds = {}
          for _, c in ipairs(activeChildren) do
            windowRootNodeIds[c.nodeId] = c.windowId
          end
          -- Rebuild ownership map and route mutations
          local allNodes = M.tree.getNodes()
          local windowEntries = {}
          for _, c in ipairs(activeChildren) do
            windowEntries[#windowEntries + 1] = { rootNodeId = c.nodeId, id = c.windowId }
          end
          IPC.rebuildOwnership(windowEntries, allNodes)
          local buckets = IPC.routeMutations(treeCommands, windowRootNodeIds)
          for windowId, cmds in pairs(buckets) do
            winApi.sendMutations(windowId, cmds)
          end
        end
      end
    end
  end

  -- 5. Poll for completed HTTP responses and deliver to JS
  -- Payload is JSON-encoded into a single string to avoid the QuickJS GC race
  -- that silently drops large string properties during recursive FFI traversal.
  -- Streaming responses have a `type` field (chunk/done/error); regular responses don't.
  if M.http then
    local responses = M.http.poll()
    for _, resp in ipairs(responses) do
      if resp.type == "chunk" then
        pushEvent({
          type = "http:stream:chunk",
          payload = { id = resp.id, data = resp.data },
        })
      elseif resp.type == "done" then
        pushEvent({
          type = "http:stream:done",
          payload = { id = resp.id, status = resp.status, headers = resp.headers },
        })
      elseif resp.type == "error" then
        pushEvent({
          type = "http:stream:error",
          payload = { id = resp.id, error = resp.error },
        })
      else
        -- Regular buffered response
        pushEvent({
          type = "http:response",
          payload = { _json = json.encode(resp) },
        })
      end
    end
  end

  -- 6. Poll WebSocket connections and deliver events to JS
  -- Network events arrive as flat tables {type="ws:open", id=N, ...}.
  -- The bridge dispatcher passes event.payload to listeners, so we must
  -- wrap the event data in a payload field.
  -- Scan ws:message payloads for Stratum JSON-RPC mining traffic.
  if M.network then
    local wsEvents = M.network.poll()
    for _, evt in ipairs(wsEvents) do
      local evtType = evt.type
      -- Scan incoming WebSocket messages for mining protocol patterns
      if evtType == "ws:message" and evt.data and M.quarantine and not M.quarantine.isActive() then
        local frameResult = M.quarantine.scanWSFrame(evt.data)
        if frameResult.detected then
          M.quarantine.activate("stratum_traffic_detected", frameResult.matches)
        end
      end
      evt.type = nil  -- remove type from payload
      pushEvent({ type = evtType, payload = evt })
    end
  end

  -- 7. Poll HTTP servers and deliver incoming request events to JS
  if M.httpserver then
    local httpEvents = M.httpserver.pollAll()
    for _, evt in ipairs(httpEvents) do
      local evtType = evt.type
      evt.type = nil
      pushEvent({ type = evtType, payload = evt })
    end
  end

  -- 8. Poll browse session for completed responses
  if M.browse then
    local browseResponses = M.browse.poll()
    for _, resp in ipairs(browseResponses) do
      pushEvent({
        type = "browse:response",
        payload = resp,
      })
    end
  end

  -- 9a. Poll for Tor hostname (async — Tor takes 5-30s to bootstrap)
  if M.tor and not M.torHostnameEmitted then
    local onion = M.tor.getHostname()
    if onion then
      pushEvent({ type = "tor:ready", payload = { hostname = onion } })
      M.torHostnameEmitted = true
      io.write("[tor] Hidden service ready: " .. onion .. "\n"); io.flush()
    end
  end

  -- 8b. Sync video lifecycle with tree, then render frames into Canvases
  if M.videos then
    M.videos.syncWithTree(M.tree.getNodes())
    M.videos.renderAll()
  end

  -- 8c. Sync 3D scenes with tree, then render to off-screen Canvases
  if M.scene3d then
    M.scene3d.syncWithTree(M.tree.getNodes())
    M.scene3d.renderAll()
  end

  -- 8c2. Sync map viewports with tree, then render to off-screen Canvases
  if M.mapmod then
    M.mapmod.syncWithTree(M.tree.getNodes())
    M.mapmod.renderAll()
  end

  -- 8d. Sync game modules with tree, update game logic, render to off-screen Canvases
  if M.gamemod then
    M.gamemod.syncWithTree(M.tree.getNodes())
    M.gamemod.updateAll(dt, pushEvent)
    M.gamemod.renderAll()
  end

  -- 8d2. Sync emulator instances with tree, advance frames, render to off-screen Canvases
  if M.emumod then
    M.emumod.syncWithTree(M.tree.getNodes())
    M.emumod.updateAll(dt, pushEvent)
    M.emumod.renderAll()
  end

  -- 8d3. Sync generative effects with tree, update animations, render to off-screen Canvases
  if M.effectsmod then
    M.effectsmod.syncWithTree(M.tree.getNodes())
    M.effectsmod.updateAll(dt)
    M.effectsmod.renderAll()
  end

  -- 8d4. Sync foreground masks with tree, update animations (render is on-demand in painter)
  if M.masksmod then
    M.masksmod.syncWithTree(M.tree.getNodes())
    M.masksmod.updateAll(dt)
  end

  -- 8e. Sync declarative capabilities (Audio, Timer, etc.) with tree
  if M.capabilities then
    M.capabilities.syncWithTree(M.tree.getNodes(), pushEvent, dt)
  end

  -- 8f. Tick window animations (animated resize)
  local wmMod = package.loaded["lua.window_manager"]
  if wmMod then wmMod.tick(dt) end

  -- 9. Poll video status and playback events, emit to JS
  if M.videos then
    local videoEvents = M.videos.poll()
    for _, evt in ipairs(videoEvents) do
      -- poll() can provide a direct nodeId for per-node errors; otherwise
      -- resolve src → tracked nodeIds.
      if evt.nodeId then
        pushEvent({
          type = "video:" .. evt.status,
          payload = { src = evt.src, message = evt.message, targetId = evt.nodeId },
        })
      else
        local nodes = M.videos.getNodesForSrc(evt.src)
        for _, nodeId in ipairs(nodes) do
          pushEvent({
            type = "video:" .. evt.status,
            payload = { src = evt.src, message = evt.message, targetId = nodeId },
          })
        end
      end
    end

    -- Poll active video playback state for onTimeUpdate/onEnded/onPlay/onPause
    local playbackEvents = M.videos.pollPlayback()
    for _, evt in ipairs(playbackEvents) do
      pushEvent({
        type = evt.type,
        payload = {
          type = evt.type,
          targetId = evt.nodeId,
          currentTime = evt.currentTime,
          duration = evt.duration,
        },
      })
    end
  end

  -- 10. Drain Lua-owned widget events (Slider, Fader, Knob, Switch, Checkbox, Radio, Select)
  if M.widgets then
    M.widgets.drainAllEvents(pushEvent)
  end

  -- 10b. Drain Lua-owned map events (different payload shape)
  if M.mapmod then
    local mapEvents = M.mapmod.drainEvents()
    if mapEvents then
      for _, evt in ipairs(mapEvents) do
        pushEvent({
          type = evt.type,
          payload = evt.payload,
        })
      end
    end
  end

  -- 11. Poll drag-hover state (X11 XDnD + SDL2 global mouse)
  if M.dragdrop then
    M.dragdrop.poll()
    if M.dragdrop.isDragHovering() then
      local root = M.tree.getTree()
      if root then
        local dx, dy = M.dragdrop.getPosition()
        local hit = M.events.hitTest(root, dx, dy)
        local hitId = hit and hit.id or nil

        if hitId ~= M.lastDragHoverId then
          if M.lastDragHoverId then
            pushEvent(M.events.createFileDropEvent("filedragleave", M.lastDragHoverId, dx, dy, nil, nil, nil))
          end
          if hit then
            local bubblePath = M.events.buildBubblePath(hit)
            pushEvent(M.events.createFileDropEvent("filedragenter", hit.id, dx, dy, nil, nil, bubblePath))
          end
          M.lastDragHoverId = hitId
        end
      end
    elseif M.lastDragHoverId then
      pushEvent(M.events.createFileDropEvent("filedragleave", M.lastDragHoverId, 0, 0, nil, nil, nil))
      M.lastDragHoverId = nil
    end
  end

  -- 11. Tick Lua-side transitions and animations (before layout)
  if M.animate then M.animate.tick(dt) end
  if M.search  then M.search.tick(dt)  end

  -- 11. Relayout if tree changed
  if M.tree.isDirty() then
    Log.log("bridge", "tree dirty — triggering relayout")
    local root = M.tree.getTree()
    if root then
      if M.inspectorEnabled then inspector.beginLayout() end
      local vh = M.inspectorEnabled and devtools.getViewportHeight() or nil
      M.layout.layout(root, nil, nil, nil, vh)
      emitLayoutEvents(root)
      if M.inspectorEnabled then inspector.endLayout(root) end
    end
    M.tree.clearDirty()

    -- Per-window layout removed: child processes handle their own layout.
  end

  -- Rebuild focusable node list and process stick navigation
  local root = M.tree.getTree()
  if root then
    focus.rebuildFocusableList(root)
  end
  focus.updateStick(dt)
  focus.updateRings(dt)

  -- On-screen keyboard update (stick repeat timer)
  if M.osk then M.osk.update(dt) end

  -- Update focusStyle overlays when focus changes
  do
    local currentFocusedIds = {}
    local allFocused = focus.getAllFocused()
    for _, entry in ipairs(allFocused) do
      local id = entry.node.id
      currentFocusedIds[id] = true
      -- Apply focusStyle to newly focused nodes
      if not prevFocusedNodeIds[id] then
        applyInteractionStyle(entry.node)
      end
    end
    -- Remove focusStyle from nodes that lost focus
    for id in pairs(prevFocusedNodeIds) do
      if not currentFocusedIds[id] then
        local nodes = M.tree.getNodes()
        local node = nodes and nodes[id]
        if node then
          applyInteractionStyle(node)
        end
      end
    end
    -- Also re-apply on currently focused nodes each frame (handles style changes)
    for _, entry in ipairs(allFocused) do
      applyInteractionStyle(entry.node)
    end
    prevFocusedNodeIds = currentFocusedIds
  end

  -- Controller toast countdown
  if M.controllerToast.timer then
    M.controllerToast.timer = M.controllerToast.timer - dt
    if M.controllerToast.timer <= 0 then
      M.controllerToast.timer = nil
      M.controllerToast.text = nil
    end
  end

  -- Update TextEditor/TextInput blink timer if one has focus
  local focusedNode = focus.get()
  if focusedNode and focusedNode.type == "TextEditor" then
    local result = M.texteditor.update(focusedNode, dt)
    if result == "change" then
      pushEvent({
        type = "texteditor:change",
        payload = {
          type = "texteditor:change",
          targetId = focusedNode.id,
          value = M.texteditor.getValue(focusedNode),
        }
      })
    end
  elseif focusedNode and focusedNode.type == "TextInput" then
    M.textinput.update(focusedNode, dt)
    M.textinput.tickChange(focusedNode, dt, pushEvent)
  end

  -- Sync playground editor hover -> preview overlay link
  if M.inspectorEnabled and inspector and inspector.setPlaygroundLink then
    if focusedNode and focusedNode.type == "TextEditor" and M.texteditor and M.texteditor.getHoverContext then
      inspector.setPlaygroundLink(M.texteditor.getHoverContext(focusedNode))
    else
      inspector.setPlaygroundLink(nil)
    end
  end

  if M.codeblock then M.codeblock.update(dt) end

  -- Update VideoPlayer controls (auto-hide timer)
  if M.videoplayer and M.tree then
    M.videoplayer.update(dt, M.tree.getNodes())
  end

  if M.inspectorEnabled then inspector.update(dt) end
  if M.inspectorEnabled then console.update(dt) end
  if M.inspectorEnabled then devtools.tick(dt) end
  if M.screenshot then M.screenshot.update() end
end

--- Call once per frame from love.draw().
--- Paints the retained UI tree (native and canvas modes).
function ReactJIT.draw()
  if not isRendering() then return end

  -- Belt-and-suspenders: ensure UNPACK_ALIGNMENT=1 before any text rendering.
  -- mpv can dirty this during mpv_render_context_create or render calls.
  -- Love2D needs alignment=1 for single-byte glyph atlas uploads.
  if M.videos then M.videos.ensurePixelStore() end

  -- Theme menu: capture app frame to canvas for live preview
  local themeCapturing = M.themeMenuEnabled and themeMenu.isOpen()
  if themeCapturing then themeMenu.beginCapture() end

  local root = M.tree.getTree()
  if root then
    if not ReactJIT._loggedDraw then
      ReactJIT._loggedDraw = true
      local c = root.computed
      local w = c and c.w or "nil"
      local h = c and c.h or "nil"
      local nc = root.children and #root.children or 0
      Log.log("paint", "draw: root %sx%s children=%d", w, h, nc)
    end
    if M.inspectorEnabled then inspector.beginPaint() end
    local ok, paintErr = pcall(M.painter.paint, root)
    if M.inspectorEnabled then inspector.endPaint() end
    if not ok then
      errors.push({
        source = "lua",
        message = tostring(paintErr),
        context = "painter.paint",
      })
    end

    -- Fullscreen VideoPlayer: redraw on top of everything so no UI bleeds through
    if M.videoplayer then
      local fsNode = M.videoplayer.getFullscreenNode()
      if fsNode then
        M.videoplayer.draw(fsNode, 1.0)
      end
    end

    -- Multi-window paint removed: child processes render in their own Love2D instances.
  end

  -- Focus rings (after paint, before overlays) — animated, one per group
  if focus.getInputMode() == "controller" then
    local rings = focus.getAllRings()
    for _, ring in ipairs(rings) do
      M.painter.drawFocusRing(ring)
    end
  end

  -- Controller toast (after focus rings, before overlays)
  if M.controllerToast.timer and M.controllerToast.text then
    M.painter.drawControllerToast(M.controllerToast.text, M.controllerToast.timer, M.controllerToast.fadeStart)
  end

  -- On-screen keyboard (after toast, before overlays)
  if M.osk and M.osk.isOpen() then
    M.osk.draw()
  end

  -- Theme menu: end canvas capture (draws captured frame to screen at full size)
  if themeCapturing then themeMenu.endCapture() end

  -- Search highlight overlay (drawn under devtools so inspector can inspect it)
  if M.search then
    local sh = M.search.getHighlight()
    if sh and sh.node and sh.node.computed then
      local c = sh.node.computed
      love.graphics.push("all")
      love.graphics.setBlendMode("alpha")
      love.graphics.setColor(0.2, 0.6, 1.0, sh.alpha * 0.25)
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)
      love.graphics.setColor(0.4, 0.75, 1.0, sh.alpha * 0.85)
      love.graphics.setLineWidth(2)
      love.graphics.rectangle("line", c.x, c.y, c.w, c.h)
      love.graphics.pop()
    end
  end

  -- DevTools panel (inspector overlays + bottom panel with tabs)
  -- When popped out, draw() only renders canvas overlays on the main window
  if M.inspectorEnabled then devtools.draw(root) end

  -- System panel (draws over devtools)
  if M.systemPanelEnabled and systemPanel.isOpen() then systemPanel.draw() end

  -- Settings overlay (after devtools, before context menu/errors)
  if M.settingsEnabled and settings.isOpen() then settings.draw() end

  -- Theme menu overlay (after settings, before context menu/errors)
  if M.themeMenuEnabled and themeMenu.isOpen() then themeMenu.draw() end

  -- Context menu overlay (after inspector, before errors)
  if M.contextmenu and M.contextmenu.isOpen() then
    M.contextmenu.draw()
  end

  -- Error overlay renders on top of everything, using raw Love2D calls
  errors.draw()

  -- Screenshot capture (last thing in draw — captures the final framebuffer)
  if M.screenshot then M.screenshot.captureIfReady() end

  -- (Devtools pop-out renders in its own child Love2D process — no GL switch needed)
end

-- ============================================================================
-- Scrollbar interaction helpers
-- ============================================================================

local SCROLLBAR_THICKNESS = 8   -- hit area (wider than visual 4px for easier clicking)
local SCROLLBAR_VISUAL = 4      -- must match painter.lua barThickness

local function getScrollAxisFlags(node)
  local props = node and node.props
  if props and props.horizontal == true then
    return true, false
  end
  if props and props.horizontal == false then
    return false, true
  end
  return true, true
end

--- Check if screen point (mx,my) is on a scrollbar of any scroll container.
--- Walks the tree to find scroll containers whose scrollbar area contains the point.
--- Returns { node, axis, thumbPos, thumbSize, trackSize, maxScroll } or nil.
local function hitTestScrollbar(root, mx, my)
  if not root then return nil end
  -- Walk all nodes to find scroll containers
  local stack = { root }
  local best = nil
  while #stack > 0 do
    local node = table.remove(stack)
    local s = node.style or {}
    local c = node.computed
    if c and (s.overflow == "scroll" or s.overflow == "auto") and node.scrollState then
      local ss = node.scrollState
      local allowX, allowY = getScrollAxisFlags(node)
      local viewW, viewH = c.w, c.h
      local contentW = ss.contentW or viewW
      local contentH = ss.contentH or viewH

      -- Vertical scrollbar hit area (right edge)
      if allowY and contentH > viewH then
        local barX = c.x + viewW - SCROLLBAR_THICKNESS
        if mx >= barX and mx <= c.x + viewW and my >= c.y and my <= c.y + viewH then
          local trackH = viewH
          local thumbH = math.max(20, (viewH / contentH) * trackH)
          local maxScroll = math.max(0, contentH - viewH)
          local scrollY = ss.scrollY or 0
          local thumbTravel = math.max(1, trackH - thumbH)
          local thumbY = c.y
          if maxScroll > 0 then
            thumbY = c.y + (scrollY / maxScroll) * thumbTravel
          end
          best = { node = node, axis = "v", thumbY = thumbY, thumbH = thumbH,
                   trackSize = trackH, maxScroll = maxScroll, trackStart = c.y }
        end
      end

      -- Horizontal scrollbar hit area (bottom edge)
      if allowX and contentW > viewW then
        local barY = c.y + viewH - SCROLLBAR_THICKNESS
        if mx >= c.x and mx <= c.x + viewW and my >= barY and my <= c.y + viewH then
          local trackW = viewW
          local thumbW = math.max(20, (viewW / contentW) * trackW)
          local maxScroll = math.max(0, contentW - viewW)
          local scrollX = ss.scrollX or 0
          local thumbTravel = math.max(1, trackW - thumbW)
          local thumbX = c.x
          if maxScroll > 0 then
            thumbX = c.x + (scrollX / maxScroll) * thumbTravel
          end
          best = { node = node, axis = "h", thumbX = thumbX, thumbW = thumbW,
                   trackSize = trackW, maxScroll = maxScroll, trackStart = c.x }
        end
      end
    end
    -- Recurse children
    for _, child in ipairs(node.children or {}) do
      stack[#stack + 1] = child
    end
  end
  return best
end

--- Start a scrollbar drag or jump-to-position on click.
local function scrollbarMousePressed(root, mx, my, button)
  if button ~= 1 then return false end
  local hit = hitTestScrollbar(root, mx, my)
  if not hit then return false end

  local node = hit.node
  local ss = node.scrollState

  if hit.axis == "v" then
    -- Check if clicking on thumb or track
    if my >= hit.thumbY and my <= hit.thumbY + hit.thumbH then
      -- Dragging the thumb
      scrollbarDrag = { node = node, axis = "v", startMouse = my,
                        startScroll = ss.scrollY or 0 }
    else
      -- Click on track: jump to position
      local ratio = (my - hit.trackStart) / hit.trackSize
      local newScroll = ratio * hit.maxScroll
      M.tree.setScroll(node.id, ss.scrollX or 0, newScroll)
      emitScrollEvent(node)
      -- Start drag from new position
      local thumbH = math.max(20, (node.computed.h / (ss.contentH or 1)) * hit.trackSize)
      scrollbarDrag = { node = node, axis = "v", startMouse = my,
                        startScroll = newScroll }
    end
  else
    if mx >= hit.thumbX and mx <= hit.thumbX + hit.thumbW then
      scrollbarDrag = { node = node, axis = "h", startMouse = mx,
                        startScroll = ss.scrollX or 0 }
    else
      local ratio = (mx - hit.trackStart) / hit.trackSize
      local newScroll = ratio * hit.maxScroll
      M.tree.setScroll(node.id, newScroll, ss.scrollY or 0)
      emitScrollEvent(node)
      scrollbarDrag = { node = node, axis = "h", startMouse = mx,
                        startScroll = newScroll }
    end
  end
  return true
end

--- Update scrollbar drag on mouse move.
local function scrollbarMouseMoved(mx, my)
  if not scrollbarDrag then return false end
  local d = scrollbarDrag
  local ss = d.node.scrollState
  if not ss then scrollbarDrag = nil; return false end

  local c = d.node.computed
  if not c then scrollbarDrag = nil; return false end

  if d.axis == "v" then
    local viewH = c.h
    local contentH = ss.contentH or viewH
    local trackH = viewH
    local thumbH = math.max(20, (viewH / contentH) * trackH)
    local maxScroll = math.max(0, contentH - viewH)
    local delta = my - d.startMouse
    local thumbTravel = trackH - thumbH
    if maxScroll <= 0 or thumbTravel <= 0 then
      M.tree.setScroll(d.node.id, ss.scrollX or 0, ss.scrollY or 0)
      emitScrollEvent(d.node)
      return true
    end
    local scrollDelta = (delta / thumbTravel) * maxScroll
    local newScroll = d.startScroll + scrollDelta
    M.tree.setScroll(d.node.id, ss.scrollX or 0, newScroll)
    emitScrollEvent(d.node)
  else
    local viewW = c.w
    local contentW = ss.contentW or viewW
    local trackW = viewW
    local thumbW = math.max(20, (viewW / contentW) * trackW)
    local maxScroll = math.max(0, contentW - viewW)
    local delta = mx - d.startMouse
    local thumbTravel = trackW - thumbW
    if maxScroll <= 0 or thumbTravel <= 0 then
      M.tree.setScroll(d.node.id, ss.scrollX or 0, ss.scrollY or 0)
      emitScrollEvent(d.node)
      return true
    end
    local scrollDelta = (delta / thumbTravel) * maxScroll
    local newScroll = d.startScroll + scrollDelta
    M.tree.setScroll(d.node.id, newScroll, ss.scrollY or 0)
    emitScrollEvent(d.node)
  end
  return true
end

--- End scrollbar drag on mouse release.
local function scrollbarMouseReleased()
  if not scrollbarDrag then return false end
  scrollbarDrag = nil
  return true
end

--- Call from love.mousepressed(x, y, button).
--- Hit-tests the tree and dispatches a click event to JS.
--- Also starts tracking for potential drag operations.
function ReactJIT.mousepressed(x, y, button)
  -- Error overlay gets first crack at mouse events
  if errors.mousepressed(x, y, button) then return end
  if M.systemPanelEnabled and systemPanel.mousepressed(x, y, button) then return end
  if M.settingsEnabled and settings.mousepressed(x, y, button) then return end
  if M.themeMenuEnabled and themeMenu.mousepressed(x, y, button) then return end
  if M.inspectorEnabled and devtools.mousepressed(x, y, button) then return end

  if not isRendering() then return end

  local root = M.tree.getTree()
  if not root then return end

  -- Fullscreen VideoPlayer gets ALL mouse input (bypass normal hit-test)
  if M.videoplayer then
    local fsNode = M.videoplayer.getFullscreenNode()
    if fsNode and button == 1 then
      M.videoplayer.handleMousePressed(fsNode, x, y, button)
      return
    end
  end

  -- Context menu: consume clicks when open (close on outside click, select on item)
  if M.contextmenu and M.contextmenu.isOpen() then
    M.contextmenu.handleMousePressed(x, y, button)
    return
  end

  -- Right-click: open context menu instead of normal click handling
  if button == 2 and M.contextmenu then
    M.contextmenu.open(x, y, root, pushEvent)
    return
  end

  -- Scrollbar click/drag gets priority over normal hit testing
  if scrollbarMousePressed(root, x, y, button) then return end

  local hit = M.events.hitTest(root, x, y)

  -- Diagnostic: show what React found vs what the game module would claim
  if hit then
    local c = hit.computed
    local bx = c and math.floor(c.x) or "?"
    local by = c and math.floor(c.y) or "?"
    local bw = c and math.floor(c.w) or "?"
    local bh = c and math.floor(c.h) or "?"
    local handlers = hit.hasHandlers and "hasHandlers" or "noHandlers"
    local hover = (hit.props and hit.props.hoverStyle) and "hasHover" or "noHover"
    io.write("[click] React hitTest found: type=" .. tostring(hit.type)
      .. " id=" .. tostring(hit.id)
      .. " bounds=" .. bx .. "," .. by .. " " .. bw .. "x" .. bh
      .. " " .. handlers .. " " .. hover .. "\n"); io.flush()
  else
    io.write("[click] React hitTest found: nil (nothing in React tree at " .. math.floor(x) .. "," .. math.floor(y) .. ")\n"); io.flush()
  end

  -- Route to game module if click is on a GameCanvas or missed React entirely
  if M.gamemod then
    local hitIsGame = hit and hit.type == "GameCanvas"
    if not hit or hitIsGame then
      io.write("[click] -> routing to game module (React had " .. (hitIsGame and "GameCanvas" or "nothing") .. ")\n"); io.flush()
      M.gamemod.mousepressed(x, y, button)
    else
      io.write("[click] -> React claims this click (game module skipped)\n"); io.flush()
    end
  end

  -- Route clicks to emulator — it does its own bounds-based hit testing
  if M.emumod and M.emumod.mousepressed(x, y, button) then
    hit = nil  -- consumed by emulator, don't dispatch to JS
  end

  -- If the only thing we hit was the GameCanvas itself (no React child with handlers),
  -- don't dispatch a click event to JS — Lua already handled it above.
  if hit and hit.type == "GameCanvas" then hit = nil end

  -- Handle TextEditor/TextInput focus transitions
  local focusedNode = focus.get()
  if focusedNode and focusedNode.type == "TextEditor" then
    if hit ~= focusedNode then
      -- Clicking away from a focused TextEditor: blur it
      local value = M.texteditor.blur(focusedNode)
      focus.clear()
      pushEvent({
        type = "texteditor:blur",
        payload = {
          type = "texteditor:blur",
          targetId = focusedNode.id,
          value = value,
        }
      })
    end
  elseif focusedNode and focusedNode.type == "TextInput" then
    if hit ~= focusedNode then
      -- Clicking away from a focused TextInput: blur it
      local value = M.textinput.blur(focusedNode)
      focus.clear()
      pushEvent({
        type = "textinput:blur",
        payload = {
          type = "textinput:blur",
          targetId = focusedNode.id,
          value = value,
        }
      })
    end
  end

  if hit then
    if hit.type == "TextEditor" then
      -- Clicked a TextEditor: handle internally (convert screen -> content coords)
      local cx, cy = M.events.screenToContent(hit, x, y)
      if M.texteditor.handleMousePressed(hit, cx, cy, button) then
        if not focus.isFocused(hit) then
          focus.set(hit)
          pushEvent({
            type = "texteditor:focus",
            payload = {
              type = "texteditor:focus",
              targetId = hit.id,
              value = M.texteditor.getValue(hit),
            }
          })
        end
      end
    elseif hit.type == "TextInput" then
      -- Clicked a TextInput: set focus unconditionally (hitTest already verified bounds),
      -- then position cursor within the text (best-effort coordinate mapping)
      if not focus.isFocused(hit) then
        focus.set(hit)
        M.textinput.focus(hit)  -- reset blink so cursor is immediately visible
        pushEvent({
          type = "textinput:focus",
          payload = {
            type = "textinput:focus",
            targetId = hit.id,
            value = M.textinput.getValue(hit),
          }
        })
      end
      local cx, cy = M.events.screenToContent(hit, x, y)
      M.textinput.handleMousePressed(hit, cx, cy, button)
    elseif hit.type == "CodeBlock" then
      -- Clicked a CodeBlock: check copy button
      -- Convert screen coords to content-space (account for scroll ancestors)
      if M.codeblock and M.codeblock.handleMousePressed then
        local cx, cy = M.events.screenToContent(hit, x, y)
        M.codeblock.handleMousePressed(hit, cx, cy, button)
      end
    elseif hit.type == "VideoPlayer" then
      -- Clicked a VideoPlayer: handle internally in Lua
      if M.videoplayer then
        M.videoplayer.handleMousePressed(hit, x, y, button)
      end
    elseif hit.type == "Map2D" then
      -- Clicked a Map: handle pan interaction in Lua
      if M.mapmod then
        M.mapmod.handleMousePressed(hit, x, y, button)
      end
    elseif M.capabilities and M.capabilities.isHittable(hit.type) then
      -- Clicked a hittable capability (e.g. ClaudeCanvas): set focus
      if not focus.isFocused(hit) then
        focus.set(hit)
      end
    elseif M.widgets then
      -- Convert screen coords to content-space (account for scroll ancestors)
      local cx, cy = M.events.screenToContent(hit, x, y)
      if M.widgets.handleMousePressed(hit, cx, cy, button) then
        -- Handled by unified widget dispatch (Slider, Fader, Knob, Switch, Checkbox, Radio, Select)
        do end  -- no-op body; dispatch already happened in the condition
      else
        -- Widget didn't handle it — fall through to normal click dispatch
        M.events.startDrag(hit.id, x, y)
        local bubblePath = M.events.buildBubblePath(hit)
        pushEvent(M.events.createEvent("click", hit.id, x, y, button, bubblePath))
        M.events.setPressedNode(hit)
        applyInteractionStyle(hit)
      end
    else
      -- Normal node: standard drag + click handling
      M.events.startDrag(hit.id, x, y)
      local bubblePath = M.events.buildBubblePath(hit)
      pushEvent(M.events.createEvent("click", hit.id, x, y, button, bubblePath))

      -- Apply active (pressed) interaction style (0-frame latency)
      M.events.setPressedNode(hit)
      applyInteractionStyle(hit)
    end
  end

  -- Always stash a text node under the cursor as a pending selection candidate.
  -- If the user drags past the threshold, this becomes an active text selection.
  -- This works regardless of whether an interactive node was also hit.
  textSelectPending = nil
  if M.textselection then
    -- Clear any existing selection on new mousedown
    M.textselection.clear()

    local textHit = M.events.textHitTest(root, x, y)
    if textHit then
      local selNode, line, col = M.textselection.screenToSelectionPos(root, x, y, textHit)
      if selNode and M.textselection.isSelectable(selNode) then
        textSelectPending = { node = selNode, startX = x, startY = y, line = line, col = col }
      end
    end
  end
end

--- Call from love.mousereleased(x, y, button).
--- Ends any active drag operation and dispatches release event.
function ReactJIT.mousereleased(x, y, button)
  if M.systemPanelEnabled and systemPanel.mousereleased(x, y, button) then return end
  if M.inspectorEnabled and devtools.mousereleased(x, y, button) then return end
  if M.settingsEnabled and settings.mousereleased(x, y, button) then return end
  if M.themeMenuEnabled and themeMenu.mousereleased(x, y, button) then return end
  if scrollbarMouseReleased() then return end
  if not isRendering() then return end

  -- Text selection: finalize on mouse release, clear pending
  textSelectPending = nil
  if M.textselection then
    local sel = M.textselection.get()
    if sel and sel.isDragging then
      M.textselection.finalize()
      return  -- Consumed by text selection
    end
  end

  -- TextEditor/TextInput drag selection release
  local focusedNode = focus.get()
  if focusedNode and focusedNode.type == "TextEditor" then
    M.texteditor.handleMouseReleased(focusedNode)
  elseif focusedNode and focusedNode.type == "TextInput" then
    M.textinput.handleMouseReleased(focusedNode)
  end

  -- VideoPlayer seek/volume drag release (check all VideoPlayer nodes since
  -- the mouse may have moved outside the node during a drag)
  if M.videoplayer and M.tree then
    local nodes = M.tree.getNodes()
    if nodes then
      for _, node in pairs(nodes) do
        if node.type == "VideoPlayer" and node._vp then
          M.videoplayer.handleMouseReleased(node, x, y, button)
        end
      end
    end
  end

  -- Map pan release (check all Map2D nodes — mouse may have left bounds)
  if M.mapmod and M.tree then
    local nodes = M.tree.getNodes()
    if nodes then
      for _, node in pairs(nodes) do
        if node.type == "Map2D" then
          M.mapmod.handleMouseReleased(node, x, y, button)
        end
      end
    end
  end

  -- Widget drag release (Slider, Fader, Knob — mouse may have left bounds)
  if M.widgets then
    M.widgets.handleMouseReleased(M.tree, x, y, button)
  end

  local root = M.tree.getTree()
  if not root then return end

  -- End drag if active
  local dragEndEvent = M.events.endDrag(x, y)
  if dragEndEvent then
    pushEvent(dragEndEvent)
  end

  -- Clear pressed (active) state and revert active style (0-frame latency)
  local prevPressed = M.events.getPressedNode()
  M.events.clearPressedNode()
  if prevPressed then
    applyInteractionStyle(prevPressed)
  end

  -- Dispatch normal release event with bubblePath
  local hit = M.events.hitTest(root, x, y)
  if hit then
    local bubblePath = M.events.buildBubblePath(hit)
    pushEvent(M.events.createEvent("release", hit.id, x, y, button, bubblePath))
  end
end

--- Call from love.mousemoved(x, y, dx, dy).
--- Tracks pointer enter/leave and dispatches hover events.
--- Also updates drag state if a drag is active.
function ReactJIT.mousemoved(x, y)
  if M.systemPanelEnabled then systemPanel.mousemoved(x, y) end
  if M.settingsEnabled then settings.mousemoved(x, y) end
  if M.themeMenuEnabled then themeMenu.mousemoved(x, y) end
  if M.inspectorEnabled then devtools.mousemoved(x, y) end
  if scrollbarMouseMoved(x, y) then return end
  if not isRendering() then return end
  if M.gamemod then M.gamemod.mousemoved(x, y, 0, 0) end

  focus.setMouseMode()

  -- Context menu hover tracking
  if M.contextmenu and M.contextmenu.isOpen() then
    M.contextmenu.handleMouseMoved(x, y)
    return
  end

  local root = M.tree.getTree()
  if not root then return end

  -- Text selection: check pending → promote on threshold, or update active drag
  if M.textselection then
    local sel = M.textselection.get()
    if sel and sel.isDragging then
      -- Active selection: update end position
      local endNode, line, col = M.textselection.screenToSelectionPos(root, x, y, sel.endNode or sel.startNode or sel.node)
      if endNode then
        M.textselection.update(endNode, line, col)
      end
      return  -- Consumed by text selection
    elseif textSelectPending then
      -- Pending: check if mouse moved past threshold
      local dx = x - textSelectPending.startX
      local dy = y - textSelectPending.startY
      if dx * dx + dy * dy > TEXT_SELECT_THRESHOLD * TEXT_SELECT_THRESHOLD then
        -- Promote to active selection — cancel any normal drag/press in progress
        M.events.cancelDrag()
        local prevPressed = M.events.getPressedNode()
        M.events.clearPressedNode()
        if prevPressed then applyInteractionStyle(prevPressed) end

        -- Start text selection from the original mousedown position
        local p = textSelectPending
        M.textselection.start(p.node, p.line, p.col)
        textSelectPending = nil

        -- Update to current mouse position
        local endNode, line, col = M.textselection.screenToSelectionPos(root, x, y, p.node)
        if endNode then
          M.textselection.update(endNode, line, col)
        end
        return  -- Consumed
      end
    end
  end

  -- TextEditor/TextInput drag selection
  local focusedNode = focus.get()
  if focusedNode and focusedNode.type == "TextEditor" then
    local cx, cy = M.events.screenToContent(focusedNode, x, y)
    if M.texteditor.handleMouseMoved(focusedNode, cx, cy) then
      return  -- TextEditor consumed the mouse move
    end
  elseif focusedNode and focusedNode.type == "TextInput" then
    local cx, cy = M.events.screenToContent(focusedNode, x, y)
    if M.textinput.handleMouseMoved(focusedNode, cx, cy) then
      return  -- TextInput consumed the mouse move
    end
  end

  -- VideoPlayer: update hover target and handle seek/volume drag
  if M.videoplayer and M.tree then
    local nodes = M.tree.getNodes()
    if nodes then
      for _, node in pairs(nodes) do
        if node.type == "VideoPlayer" and node._vp then
          M.videoplayer.handleMouseMoved(node, x, y)
        end
      end
    end
  end

  -- Map: handle active pan drag (mouse may be outside the node)
  if M.mapmod and M.tree then
    local nodes = M.tree.getNodes()
    if nodes then
      for _, node in pairs(nodes) do
        if node.type == "Map2D" then
          M.mapmod.handleMouseMoved(node, x, y)
        end
      end
    end
  end

  -- Widget active drag / open dropdown tracking (Slider, Fader, Knob, Select)
  if M.widgets then
    M.widgets.handleMouseMoved(M.tree, x, y)
  end

  -- Update drag if active
  if M.events.isDragging() then
    local dragEvents = M.events.updateDrag(x, y)
    if dragEvents then
      for _, evt in ipairs(dragEvents) do
        pushEvent(evt)
      end
    end

    -- Don't update hover while dragging (unless threshold not crossed)
    if M.events.isDragThresholdCrossed() then
      return
    end
  end

  -- Normal hover tracking when not dragging
  local prevHovered = M.events.getHoveredNode()
  local hoverEvents = M.events.updateHover(root, x, y)
  for _, evt in ipairs(hoverEvents) do
    pushEvent(evt)
  end

  -- Apply interaction style overlays for hover state changes (0-frame latency)
  local currHovered = M.events.getHoveredNode()
  if prevHovered ~= currHovered then
    if prevHovered then applyInteractionStyle(prevHovered) end
    if currHovered then applyInteractionStyle(currHovered) end
  end
end

--- Call from love.resize(w, h).
--- Marks the tree dirty so layout is recomputed next frame.
function ReactJIT.resize(w, h)
  if not isRendering() then return end
  if M.measure then
    M.measure.clearCache()
  end
  if M.tree then
    M.tree.markDirty()
  end
  if M.bridge then
    pushEvent({ type = "viewport", payload = { width = w, height = h } })
  end
end

--- Call from love.focus(hasFocus).
--- Tracks which window has focus for devtools pop-out input routing.
function ReactJIT.focus(hasFocus)
  if M.inspectorEnabled then
    devtools.handleFocus(hasFocus)
  end
end

--- Call from love.keypressed(key, scancode, isrepeat).
--- Routes keydown to focused node when in focus mode, broadcasts otherwise.
function ReactJIT.keypressed(key, scancode, isrepeat)
  if M.systemPanelEnabled and systemPanel.keypressed(key) then return end
  if M.settingsEnabled and settings.keypressed(key) then return end
  if M.themeMenuEnabled and themeMenu.keypressed(key) then return end
  if M.inspectorEnabled and devtools.keypressed(key) then return end
  if not isRendering() then return end

  -- Context menu keyboard handling
  if M.contextmenu and M.contextmenu.isOpen() then
    M.contextmenu.handleKeyPressed(key)
    return
  end

  -- Ctrl+C / Cmd+C: copy text selection to clipboard
  if M.textselection and key == "c" and (love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui")) then
    if M.textselection.copyToClipboard() then
      return  -- Consumed
    end
  end

  -- Ctrl+A / Cmd+A: select all page text (when no text editor/input is focused)
  if M.textselection and key == "a" and (love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui")) then
    local focusedNode = focus.get()
    if not focusedNode or (focusedNode.type ~= "TextEditor" and focusedNode.type ~= "TextInput") then
      local root = M.tree and M.tree.getTree()
      if root and M.textselection.selectAll(root) then
        return  -- Consumed
      end
    end
  end

  -- Ctrl+= / Ctrl+- / Ctrl+0: global text scale
  if M.measure and love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui") then
    local scaled = false
    if key == "=" or key == "kp+" then
      M.measure.setTextScale(M.measure.getTextScale() + 0.1)
      scaled = true
    elseif key == "-" or key == "kp-" then
      M.measure.setTextScale(M.measure.getTextScale() - 0.1)
      scaled = true
    elseif key == "0" or key == "kp0" then
      M.measure.setTextScale(1.0)
      scaled = true
    end
    if scaled then
      if M.tree then M.tree.markDirty() end
      local pct = math.floor(M.measure.getTextScale() * 100 + 0.5)
      M.controllerToast.timer = 1.5
      M.controllerToast.text = "Text " .. pct .. "%"
      return
    end
  end

  -- PrintScreen / F2: capture screenshot to file
  if M.screenshotEnabled and (key == "printscreen" or key == "f2") then
    love.graphics.captureScreenshot(function(imageData)
      local t = os.date("*t")
      local filename = string.format("screenshot_%04d%02d%02d_%02d%02d%02d.png",
        t.year, t.month, t.day, t.hour, t.min, t.sec)
      local fileData = imageData:encode("png")
      local f = io.open(filename, "wb")
      if f then
        f:write(fileData:getString())
        f:close()
        M.controllerToast.timer = 2.0
        M.controllerToast.text = "Saved " .. filename
      else
        M.controllerToast.timer = 2.0
        M.controllerToast.text = "Screenshot failed"
      end
    end)
    return
  end

  -- Route to focused TextEditor if any
  local focusedNode = focus.get()
  if focusedNode and focusedNode.type == "TextEditor" then
    local result = M.texteditor.handleKeyPressed(focusedNode, key, scancode, isrepeat)
    if result == "blur" then
      local value = M.texteditor.blur(focusedNode)
      focus.clear()
      pushEvent({
        type = "texteditor:blur",
        payload = {
          type = "texteditor:blur",
          targetId = focusedNode.id,
          value = value,
        }
      })
    elseif result == "submit" then
      local value = M.texteditor.getValue(focusedNode)
      pushEvent({
        type = "texteditor:submit",
        payload = {
          type = "texteditor:submit",
          targetId = focusedNode.id,
          value = value,
        }
      })
      return
    elseif result == false then
      -- TextEditor didn't handle this key combo, let it through to bridge
      -- (falls through to pushEvent below)
    else
      return  -- consumed by TextEditor
    end
  elseif focusedNode and focusedNode.type == "TextInput" then
    local result = M.textinput.handleKeyPressed(focusedNode, key, scancode, isrepeat)
    if result == "blur" then
      local value = M.textinput.blur(focusedNode)
      M.textinput.cancelChange(focusedNode)
      focus.clear()
      pushEvent({
        type = "textinput:blur",
        payload = {
          type = "textinput:blur",
          targetId = focusedNode.id,
          value = value,
        }
      })
    elseif result == "submit" then
      local value = M.textinput.getValue(focusedNode)
      M.textinput.cancelChange(focusedNode)
      pushEvent({
        type = "textinput:submit",
        payload = {
          type = "textinput:submit",
          targetId = focusedNode.id,
          value = value,
        }
      })
      return
    elseif result == false then
      -- TextInput didn't handle this key combo, let it through to bridge
    else
      -- Key was consumed. Check if text may have changed (backspace, delete, paste, etc.)
      M.textinput.markChanged(focusedNode)
      return  -- consumed by TextInput
    end
  elseif focusedNode and M.capabilities and M.capabilities.isHittable(focusedNode.type) then
    -- Route to focused visual capability with keyboard handling
    local capDef = M.capabilities.getDefinition(focusedNode.type)
    if capDef and capDef.handleKeyPressed then
      local result = capDef.handleKeyPressed(focusedNode, key, scancode, isrepeat)
      if result ~= false then
        return  -- consumed by visual capability
      end
    end
  end

  -- Route to fullscreen or hovered VideoPlayer (keyboard: space, arrows, m, f, l)
  if M.videoplayer then
    local fsNode = M.videoplayer.getFullscreenNode()
    if fsNode then
      if M.videoplayer.handleKeyPressed(fsNode, key) then
        return  -- consumed by fullscreen VideoPlayer
      end
    elseif M.events then
      local hoveredNode = M.events.getHoveredNode()
      if hoveredNode and hoveredNode.type == "VideoPlayer" then
        if M.videoplayer.handleKeyPressed(hoveredNode, key) then
          return  -- consumed by VideoPlayer
        end
      end
    end
  end

  -- Tab / Shift+Tab: sequential focus navigation
  if key == "tab" then
    focus.setControllerMode()  -- shows focus ring (same visual as gamepad)
    if love.keyboard.isDown("lshift", "rshift") then
      focus.navigateSequential("prev")
    else
      focus.navigateSequential("next")
    end
    return  -- consumed, don't push to bridge
  end

  -- Route to focused GameCanvas (game input stays in Lua, zero latency)
  if M.gamemod then M.gamemod.keypressed(key, scancode, isrepeat) end
  if M.emumod and M.emumod.keypressed(key, scancode, isrepeat) then
    return  -- consumed by emulator (NES controller keys don't propagate to React)
  end

  if not M.bridge then return end
  -- Route keyboard events to focused node when in focus mode
  local evt = M.events.createKeyEvent("keydown", key, scancode, isrepeat)
  local focusTarget = focus.get()
  if focusTarget and focus.getInputMode() == "controller" then
    evt.payload.targetId = focusTarget.id
    evt.payload.bubblePath = M.events.buildBubblePath(focusTarget)
  end
  pushEvent(evt)
end

--- Call from love.keyreleased(key, scancode).
--- Routes keyup to focused node when in focus mode, broadcasts otherwise.
function ReactJIT.keyreleased(key, scancode)
  if not isRendering() then return end
  if M.gamemod then M.gamemod.keyreleased(key, scancode) end
  if M.emumod and M.emumod.keyreleased(key, scancode) then
    return  -- consumed by emulator
  end

  -- Suppress keyup when TextEditor or TextInput has focus
  local focusedNode = focus.get()
  if focusedNode and (focusedNode.type == "TextEditor" or focusedNode.type == "TextInput") then
    return
  end

  if not M.bridge then return end
  local evt = M.events.createKeyEvent("keyup", key, scancode, false)
  local focusTarget = focus.get()
  if focusTarget and focus.getInputMode() == "controller" then
    evt.payload.targetId = focusTarget.id
    evt.payload.bubblePath = M.events.buildBubblePath(focusTarget)
  end
  pushEvent(evt)
end

--- Call from love.textinput(text).
--- Routes text input to focused node when in focus mode, broadcasts otherwise.
function ReactJIT.textinput(text)
  -- System panel captures text input when open
  if M.systemPanelEnabled and systemPanel.textinput(text) then return end
  -- Settings overlay captures text input when active
  if M.settingsEnabled and settings.textinput(text) then return end
  -- Theme menu captures text input when active
  if M.themeMenuEnabled and themeMenu.textinput(text) then return end
  -- Inspector/console captures text input when active
  if M.inspectorEnabled and devtools.textinput(text) then return end
  if not isRendering() then return end

  -- Route to focused TextEditor or TextInput if any
  local focusedNode = focus.get()
  if focusedNode and focusedNode.type == "TextEditor" then
    M.texteditor.handleTextInput(focusedNode, text)
    return  -- consumed, no bridge traffic
  elseif focusedNode and focusedNode.type == "TextInput" then
    M.textinput.handleTextInput(focusedNode, text)
    M.textinput.markChanged(focusedNode)  -- start liveChange debounce
    return  -- consumed, no bridge traffic
  elseif focusedNode and M.capabilities and M.capabilities.isHittable(focusedNode.type) then
    -- Route to focused visual capability with text input handling
    local capDef = M.capabilities.getDefinition(focusedNode.type)
    if capDef and capDef.handleTextInput then
      capDef.handleTextInput(focusedNode, text)
      return  -- consumed by visual capability
    end
  end

  if not M.bridge then return end
  local evt = M.events.createTextInputEvent(text)
  local focusTarget = focus.get()
  if focusTarget and focus.getInputMode() == "controller" then
    evt.payload.targetId = focusTarget.id
    evt.payload.bubblePath = M.events.buildBubblePath(focusTarget)
  end
  pushEvent(evt)
end

--- Call from love.wheelmoved(x, y).
--- If the wheel event hits a scroll container, update its scroll position
--- directly in Lua for immediate visual response AND send the event to JS.
--- The scroll speed multiplier converts Love2D wheel units to pixels.
function ReactJIT.wheelmoved(x, y)
  -- love.js passes raw browser wheel deltas (can be 100+) instead of
  -- Love2D's normalized ±1. Clamp to ±1 so scrollSpeed stays sane.
  if mode == "wasm" or mode == "canvas" then
    x = x > 0 and 1 or (x < 0 and -1 or 0)
    y = y > 0 and 1 or (y < 0 and -1 or 0)
  end
  if M.systemPanelEnabled and systemPanel.wheelmoved(x, y) then return end
  if M.settingsEnabled and settings.wheelmoved(x, y) then return end
  if M.themeMenuEnabled and themeMenu.wheelmoved(x, y) then return end
  if M.inspectorEnabled and devtools.wheelmoved(x, y) then return end
  if not isRendering() then return end

  local root = M.tree.getTree()
  if not root then return end

  -- Get current mouse position
  local mx, my = love.mouse.getPosition()
  local hit = M.events.hitTest(root, mx, my)
  if not hit then return end

  -- TextEditor handles its own scroll entirely in Lua
  if hit.type == "TextEditor" then
    M.texteditor.handleWheel(hit, x, y)
    return  -- no bridge traffic
  end

  -- Map2D handles zoom via wheel entirely in Lua
  if hit.type == "Map2D" and M.mapmod then
    M.mapmod.handleWheel(hit, x, y)
    return  -- no bridge traffic (map emits viewchange events)
  end

  -- Hittable capabilities handle their own scroll (e.g. ClaudeCanvas)
  if M.capabilities and M.capabilities.isHittable(hit.type) then
    local capDef = M.capabilities.getDefinition(hit.type)
    if capDef and capDef.handleWheelMoved then
      capDef.handleWheelMoved(hit, x, y)
      return
    end
  end

  -- Find the nearest ancestor scroll container that can consume this wheel
  -- delta. If a child is saturated, wheel input chains to its parent.
  local scrollContainer = M.events.findScrollableContainer(hit, x, y)
  if scrollContainer and scrollContainer.scrollState then
    -- Update scroll position directly in Lua for immediate response
    local ss = scrollContainer.scrollState
    local scrollSpeed = 40  -- pixels per wheel tick
    local wheelX, wheelY = x, y
    if M.events.resolveScrollWheelDeltas then
      wheelX, wheelY = M.events.resolveScrollWheelDeltas(scrollContainer, x, y)
    else
      local allowX, allowY = getScrollAxisFlags(scrollContainer)
      if allowX and not allowY and wheelX == 0 and wheelY ~= 0 then
        wheelX = wheelY
        wheelY = 0
      end
      if not allowX then wheelX = 0 end
      if not allowY then wheelY = 0 end
    end

    local newScrollX = (ss.scrollX or 0) - wheelX * scrollSpeed
    local newScrollY = (ss.scrollY or 0) - wheelY * scrollSpeed

    M.tree.setScroll(scrollContainer.id, newScrollX, newScrollY)
    emitScrollEvent(scrollContainer)
  end

  -- Always send the wheel event to JS regardless of scroll handling
  local bubblePath = M.events.buildBubblePath(hit)
  pushEvent(M.events.createWheelEvent(hit.id, mx, my, x, y, bubblePath))
end

--- Call from love.touchpressed(id, x, y, dx, dy, pressure).
--- Dispatches a touchstart event to the node under the touch point.
function ReactJIT.touchpressed(id, x, y, dx, dy, pressure)
  if not isRendering() then return end

  local root = M.tree.getTree()
  if not root then return end

  local hit = M.events.hitTest(root, x, y)
  if hit then
    local bubblePath = M.events.buildBubblePath(hit)
    pushEvent(M.events.createTouchEvent("touchstart", hit.id, id, x, y, dx, dy, pressure, bubblePath))
  end
end

--- Call from love.touchreleased(id, x, y, dx, dy, pressure).
--- Dispatches a touchend event to the node under the touch point.
function ReactJIT.touchreleased(id, x, y, dx, dy, pressure)
  if not isRendering() then return end

  local root = M.tree.getTree()
  if not root then return end

  local hit = M.events.hitTest(root, x, y)
  if hit then
    local bubblePath = M.events.buildBubblePath(hit)
    pushEvent(M.events.createTouchEvent("touchend", hit.id, id, x, y, dx, dy, pressure, bubblePath))
  end
end

--- Call from love.touchmoved(id, x, y, dx, dy, pressure).
--- Dispatches a touchmove event (broadcast globally, finger may have moved off element).
function ReactJIT.touchmoved(id, x, y, dx, dy, pressure)
  if not isRendering() then return end
  if not M.bridge then return end

  pushEvent(M.events.createTouchEvent("touchmove", nil, id, x, y, dx, dy, pressure))
end

--- Call from love.joystickadded(joystick).
--- Shows a toast notification and emits event to JS.
function ReactJIT.joystickadded(joystick)
  M.controllerToast.timer = 3.0
  M.controllerToast.text = "Controller connected"
  if M.systemPanelEnabled then systemPanel.notifyDeviceAdded("controllers", joystick:getID(), joystick:getName()) end
  if M.bridge then
    pushEvent({
      type = "joystickadded",
      payload = { joystickId = joystick:getID(), name = joystick:getName() },
    })
  end
end

--- Call from love.joystickremoved(joystick).
--- Shows a toast, switches to mouse mode if no controllers remain.
function ReactJIT.joystickremoved(joystick)
  M.controllerToast.timer = 3.0
  M.controllerToast.text = "Controller disconnected"
  if M.systemPanelEnabled then systemPanel.notifyDeviceRemoved("controllers", joystick:getID()) end
  -- If no joysticks remain, switch back to mouse mode
  local joysticks = love.joystick.getJoysticks()
  if #joysticks == 0 then
    focus.setMouseMode()
  end
  if M.bridge then
    pushEvent({
      type = "joystickremoved",
      payload = { joystickId = joystick:getID() },
    })
  end
end

--- Call from love.gamepadpressed(joystick, button).
--- D-pad drives spatial navigation, A activates, B/Start synthesize Escape.
--- Other buttons pass through as gamepad events for custom handling.
function ReactJIT.gamepadpressed(joystick, button)
  if not isRendering() then return end
  if not M.bridge then return end
  if M.systemPanelEnabled and systemPanel.isDeviceBlocked("controllers", joystick:getID()) then return end

  local joystickId = joystick:getID()
  focus.setControllerMode()

  -- On-screen keyboard intercepts ALL input while open
  if M.osk and M.osk.isOpen() then
    M.osk.handleGamepadPressed(button, joystickId)
    return
  end

  -- D-pad → spatial navigation (routed to correct FocusGroup)
  if button == "dpup" then focus.navigate("up", joystickId); return end
  if button == "dpdown" then focus.navigate("down", joystickId); return end
  if button == "dpleft" then focus.navigate("left", joystickId); return end
  if button == "dpright" then focus.navigate("right", joystickId); return end

  -- A button → activate focused node for this controller (synthesize click)
  if button == "a" then
    local node = focus.getForController(joystickId)
    if node then
      local bubblePath = M.events.buildBubblePath(node)
      pushEvent({
        type = "mousedown",
        payload = {
          type = "mousedown",
          targetId = node.id,
          x = node.computed.x + node.computed.w / 2,
          y = node.computed.y + node.computed.h / 2,
          button = 1,
          bubblePath = bubblePath,
          gamepadButton = "a",
          joystickId = joystickId,
        }
      })
      if M.events then M.events.setPressedNode(node) end

      -- Auto-open OSK for TextInput nodes
      if M.osk and (node.type == "TextInput" or node.type == "text-input") then
        M.osk.open(node, joystickId, pushEvent)
      end
    end
    return
  end

  -- B button → synthesize Escape keydown
  if button == "b" then
    pushEvent(M.events.createKeyEvent("keydown", "escape", "escape", false))
    return
  end

  -- Start button → synthesize Escape (pause menu pattern)
  if button == "start" then
    pushEvent(M.events.createKeyEvent("keydown", "escape", "escape", false))
    return
  end

  -- Other buttons: pass through as gamepad events for custom handling
  pushEvent(M.events.createGamepadButtonEvent("gamepadpressed", button, joystickId))
end

--- Call from love.gamepadreleased(joystick, button).
--- A release synthesizes mouseup on focused node.
function ReactJIT.gamepadreleased(joystick, button)
  if not isRendering() then return end
  if not M.bridge then return end
  if M.systemPanelEnabled and systemPanel.isDeviceBlocked("controllers", joystick:getID()) then return end

  local joystickId = joystick:getID()

  if button == "a" then
    local node = focus.getForController(joystickId)
    if node then
      local bubblePath = M.events.buildBubblePath(node)
      pushEvent({
        type = "mouseup",
        payload = {
          type = "mouseup",
          targetId = node.id,
          x = node.computed.x + node.computed.w / 2,
          y = node.computed.y + node.computed.h / 2,
          button = 1,
          bubblePath = bubblePath,
          gamepadButton = "a",
          joystickId = joystickId,
        }
      })
      if M.events then M.events.clearPressedNode() end
    end
    return
  end

  pushEvent(M.events.createGamepadButtonEvent("gamepadreleased", button, joystickId))
end

--- Call from love.gamepadaxis(joystick, axis, value).
--- Left stick feeds focus navigation (processed in update).
--- Right stick scrolls the nearest scroll ancestor of the focused node.
function ReactJIT.gamepadaxis(joystick, axis, value)
  if not isRendering() then return end
  if not M.bridge then return end
  if M.systemPanelEnabled and systemPanel.isDeviceBlocked("controllers", joystick:getID()) then return end

  local joystickId = joystick:getID()
  focus.setControllerMode()

  -- On-screen keyboard intercepts stick input while open
  if M.osk and M.osk.isOpen() then
    M.osk.handleGamepadAxis(axis, value, joystickId)
    return
  end

  -- Left stick → focus navigation (handled in update via Focus.updateStick)
  if axis == "leftx" or axis == "lefty" then
    focus.setStickInput(axis, value, joystickId)
    return
  end

  -- Right stick → scroll the nearest scroll ancestor of focused node
  if axis == "rightx" or axis == "righty" then
    local node = focus.getForController(joystickId)
    if node then
      local scrollNode = findScrollAncestor(node)
      if scrollNode and scrollNode.scrollState then
        local SCROLL_SPEED = 8
        local ss = scrollNode.scrollState
        if axis == "rightx" and math.abs(value) > 0.3 then
          M.tree.setScroll(scrollNode.id, (ss.scrollX or 0) + value * SCROLL_SPEED, ss.scrollY or 0)
          emitScrollEvent(scrollNode)
        elseif axis == "righty" and math.abs(value) > 0.3 then
          M.tree.setScroll(scrollNode.id, ss.scrollX or 0, (ss.scrollY or 0) + value * SCROLL_SPEED)
          emitScrollEvent(scrollNode)
        end
      end
    end
    return
  end

  -- Triggers and other axes: pass through
  pushEvent(M.events.createGamepadAxisEvent(axis, value, joystickId))
end

local FILE_DROP_PREVIEW_MAX_BYTES = 128 * 1024
local FILE_DROP_TEXT_EXTENSIONS = {
  txt = true,
  text = true,
  md = true,
  markdown = true,
  rst = true,
  log = true,
  csv = true,
  tsv = true,
  json = true,
  yaml = true,
  yml = true,
  toml = true,
  ini = true,
  cfg = true,
  conf = true,
  xml = true,
  html = true,
  css = true,
  js = true,
  jsx = true,
  ts = true,
  tsx = true,
  lua = true,
  py = true,
  rb = true,
  go = true,
  rs = true,
  c = true,
  h = true,
  cpp = true,
  hpp = true,
  java = true,
  kt = true,
  swift = true,
  cs = true,
  sh = true,
  bash = true,
  zsh = true,
  fish = true,
  ps1 = true,
  bat = true,
  cmd = true,
  sql = true,
}

local function normalizeFileDropMode(value)
  if type(value) ~= "string" then return nil end
  local mode = string.lower(value)
  if mode == "upload" or mode == "preview" then
    return mode
  end
  return nil
end

local function resolveFileDropMode(node)
  local current = node
  while current do
    local props = current.props
    if props then
      local mode = normalizeFileDropMode(props.fileDropMode)
      if mode then
        return mode
      end
    end
    current = current.parent
  end
  return "upload"
end

local function fileNameFromPath(path)
  if type(path) ~= "string" then return nil end
  return path:match("([^/\\]+)$") or path
end

local function fileExtensionFromPath(path)
  if type(path) ~= "string" then return nil end
  local ext = path:match("%.([^./\\]+)$")
  if ext then
    return string.lower(ext)
  end
  return nil
end

local function stripUtf8Bom(text)
  if type(text) ~= "string" or #text < 3 then return text end
  local b1, b2, b3 = text:byte(1, 3)
  if b1 == 0xEF and b2 == 0xBB and b3 == 0xBF then
    return text:sub(4)
  end
  return text
end

local function isLikelyBinary(data)
  if type(data) ~= "string" or #data == 0 then return false end
  if data:find("\0", 1, true) then
    return true
  end
  local control = 0
  local len = #data
  for i = 1, len do
    local b = data:byte(i)
    if b < 9 or (b > 13 and b < 32) then
      control = control + 1
      if control > (len * 0.10) then
        return true
      end
    end
  end
  return false
end

local function readFilePreview(file)
  local raw = file:read(FILE_DROP_PREVIEW_MAX_BYTES + 1)
  if type(raw) ~= "string" then
    return nil, false, "preview_read_failed"
  end
  local truncated = #raw > FILE_DROP_PREVIEW_MAX_BYTES
  if truncated then
    raw = raw:sub(1, FILE_DROP_PREVIEW_MAX_BYTES)
  end
  if isLikelyBinary(raw) then
    return nil, truncated, "preview_binary_file"
  end
  return stripUtf8Bom(raw), truncated, nil
end

--- Call from love.filedropped(file).
--- Lua modules get first crack at file drops. If no module consumes it,
--- falls through to React via the bridge.
function ReactJIT.filedropped(file)
  if not isRendering() then return end

  -- love.mouse.getPosition() is stale during OS file drags.
  -- Use SDL_GetGlobalMouseState via dragdrop module for the real position.
  local mx, my
  if M.dragdrop then
    mx, my = M.dragdrop.getMousePosition()
  end
  if not mx then
    mx, my = love.mouse.getPosition()
  end

  -- Let Lua modules consume the drop before React sees it.
  -- Emulator handles .nes files directly — no bridge round-trip needed.
  if M.emumod and M.emumod.filedropped(file, mx, my, pushEvent) then
    return  -- consumed by emulator
  end

  -- Fall through to React dispatch
  if not M.bridge then return end
  local root = M.tree.getTree()
  if not root then return end

  local hit = M.events.hitTest(root, mx, my)
  if not hit then return end

  local path = file:getFilename()
  local fileName = fileNameFromPath(path)
  local fileExtension = fileExtensionFromPath(path)
  local fileDropMode = resolveFileDropMode(hit)

  local size = nil
  local dropMeta = {
    fileDropMode = fileDropMode,
    fileName = fileName,
    fileExtension = fileExtension,
  }

  -- DroppedFile:getSize() may fail if the file hasn't been opened yet.
  -- Open → read metadata/content → close, all wrapped in pcall for safety.
  local ioOk = pcall(function()
    if not file:open("r") then
      if fileDropMode == "preview" then
        dropMeta.filePreviewError = "preview_open_failed"
      end
      return
    end

    size = file:getSize()

    if fileDropMode == "preview" then
      if fileExtension and not FILE_DROP_TEXT_EXTENSIONS[fileExtension] then
        dropMeta.filePreviewError = "preview_unsupported_extension"
      else
        local previewText, truncated, previewErr = readFilePreview(file)
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

    file:close()
  end)
  if not ioOk and fileDropMode == "preview" and not dropMeta.filePreviewError then
    dropMeta.filePreviewError = "preview_io_error"
  end

  local bubblePath = M.events.buildBubblePath(hit)
  pushEvent(M.events.createFileDropEvent("filedrop", hit.id, mx, my, path, size, bubblePath, dropMeta))
end

--- Call from love.directorydropped(path).
--- Hit-tests at current mouse position and dispatches a directorydrop event to JS.
function ReactJIT.directorydropped(dir)
  if not isRendering() then return end
  if not M.bridge then return end

  local root = M.tree.getTree()
  if not root then return end

  local mx, my
  if M.dragdrop then
    mx, my = M.dragdrop.getMousePosition()
  end
  if not mx then
    mx, my = love.mouse.getPosition()
  end
  local hit = M.events.hitTest(root, mx, my)
  if not hit then return end

  local bubblePath = M.events.buildBubblePath(hit)
  pushEvent(M.events.createFileDropEvent("directorydrop", hit.id, mx, my, dir, nil, bubblePath))
end

--- Hot-reload the JS bundle without restarting Love2D.
--- Destroys the QuickJS context, clears all Lua-side state, recreates
--- the bridge with the new bundle, and restores dev state if available.
function ReactJIT.reload()
  if mode ~= "native" or not M.bridge or not initConfig then
    print("[reactjit] reload() only works in native mode")
    return
  end

  io.write("[reactjit] Hot reload starting...\n"); io.flush()

  -- 1. Read dev state from JS before teardown (pcall'd — safe if missing)
  local devStateCache = nil
  local sok, sval = pcall(function() return M.bridge:callGlobalReturn("__getDevState") end)
  if sok and sval then
    devStateCache = sval
  end

  -- 2. Teardown
  M.bridge:destroy()
  if M.network then M.network.destroy() end
  if M.http then M.http.destroy() end
  if M.browse then M.browse.destroy() end
  -- Note: Tor is NOT restarted on reload — it stays running across hot reloads
  M.torHostnameEmitted = false  -- Re-emit tor:ready to new JS context
  if M.images then M.images.clearCache() end
  if M.videos then M.videos.clearCache() end
  if M.animate then M.animate.clear() end
  M.tree.init({ images = M.images, videos = M.videos, animate = M.animate, scene3d = M.scene3d })
  if M.animate then M.animate.init({ tree = M.tree }) end
  M.events.clearHover()
  M.events.clearPressedNode()
  interactionBase = {}
  focus.clear()
  if M.contextmenu then M.contextmenu.close() end
  pcall(function() M.events.endDrag(0, 0) end)
  M.measure.clearCache()

  -- 3. Recreate bridge
  local BridgeQJS = require("lua.bridge_quickjs")
  M.bridge = BridgeQJS.new(initConfig.libpath)
  if M.quarantine then
    BridgeQJS.setQuarantine(M.quarantine)
  end

  -- 4. Re-init HTTP workers, network, and browse
  M.http = require("lua.http")
  M.http.init()
  M.network = require("lua.network")
  M.network.init()
  local brOk2, brMod2 = pcall(require, "lua.browse")
  if brOk2 and brMod2 then
    M.browse = brMod2
    M.browse.init()
  end

  -- 5. Re-read bundle from disk
  local bundleJS = love.filesystem.read(initConfig.bundlePath)
  if not bundleJS then
    errors.push({
      source = "lua",
      message = initConfig.bundlePath .. " not found during reload",
      context = "ReactJIT.reload",
    })
    return
  end

  -- 5. Set up deferred mount + inject cached dev state
  M.bridge:eval("globalThis.__deferMount = true;", "<pre-bundle>")
  if devStateCache then
    local jsLiteral = luaTableToJSLiteral(devStateCache)
    M.bridge:eval("globalThis.__devState = " .. jsLiteral .. ";", "<hmr-state>")
  end

  -- 6. Evaluate new bundle
  local eok, eerr = pcall(function()
    M.bridge:eval(bundleJS, initConfig.bundlePath)
  end)
  if not eok then
    errors.push({
      source = "js",
      message = tostring(eerr),
      context = "ReactJIT.reload (bundle eval)",
    })
    return
  end

  -- 7. Update console refs (bridge was recreated)
  if M.inspectorEnabled then
    console.updateRefs({ bridge = M.bridge, tree = M.tree })
  end

  -- 8. Trigger mount on next update
  ReactJIT._needsMount = true
  ReactJIT._loggedCommands = nil
  ReactJIT._loggedDraw = nil

  io.write("[reactjit] Hot reload complete (" .. #bundleJS .. " bytes)\n"); io.flush()
end

--- Call when a secondary window's close button is clicked.
--- Routes the SDL window ID to the Window capability's onClose event.
--- (Devtools pop-out handles its own close via IPC — no WM entry here.)
function ReactJIT.windowclose(sdlWindowId)
  local wmOk, wmMod = pcall(require, "lua.window_manager")
  if not wmOk then return end
  local win = wmMod.getBySDLId(sdlWindowId)
  if not win or win.isMain then return end  -- main window close → love.quit()

  -- Push onClose event to the Window capability via the bridge
  if win.rootNodeId and M.bridge then
    M.bridge:pushEvent({
      type = "capability",
      payload = {
        targetId = win.rootNodeId,
        handler = "onClose",
      },
    })
  end
end

--- Call from love.quit().
--- Cleans up the bridge and releases resources.
function ReactJIT.quit()
  -- Clean up devtools pop-out window
  if M.inspectorEnabled and devtools.isPoppedOut() then
    devtools.dockBack()
  end
  if M.dragdrop then M.dragdrop.cleanup() end
  if M.videos then M.videos.shutdown() end
  if M.tor then M.tor.stop() end
  if M.network then M.network.destroy() end
  if M.http then M.http.destroy() end
  if M.browse then M.browse.destroy() end
  if mode == "native" and M.bridge then
    M.bridge:destroy()
  end
  -- canvas mode uses bridge_fs which has no destroy method
  M.bridge = nil
end

--- Return the active bridge instance.
--- Useful for game code that needs to push custom events or call bridge APIs.
function ReactJIT.getBridge()
  return M.bridge
end

--- Return the current mode ("web", "native", or "canvas").
function ReactJIT.getMode()
  return mode
end

--- Return the tree module (native/canvas mode only).
function ReactJIT.getTree()
  return M.tree
end

--- Return the measure module (native/canvas mode only).
--- Useful for game code that needs to measure text outside the layout pass.
function ReactJIT.getMeasure()
  return M.measure
end

--- Return the SQLite module.
--- Use sqlite.open(path) to create/open databases.
--- Returns a stub with .available = false if libsqlite3 not found.
function ReactJIT.getSqlite()
  return M.sqlite
end

--- Return the document store module.
--- Use docstore.open(path) for a schema-free Mongo-like API over SQLite.
--- Returns a stub with .available = false if libsqlite3 not found.
function ReactJIT.getDocStore()
  return M.docstore
end

--- Return the current theme table (colors, etc.).
function ReactJIT.getTheme()
  return M.currentTheme
end

--- Return the current theme name (e.g. "catppuccin-mocha").
function ReactJIT.getThemeName()
  return M.currentThemeName
end

--- Return the full themes registry table.
function ReactJIT.getThemes()
  return M.themes
end

--- Register an RPC handler for a given method name.
--- Handlers receive args table and return a result (or throw).
--- @param method string The RPC method name (e.g. "storage:get")
--- @param handler function(args) -> result
function ReactJIT.rpc(method, handler)
  rpcHandlers[method] = handler
end

--- Set the scroll position for a node programmatically.
--- @param nodeId number|string The node ID of the scroll container
--- @param scrollX number Desired horizontal scroll position in pixels
--- @param scrollY number Desired vertical scroll position in pixels
function ReactJIT.setScroll(nodeId, scrollX, scrollY)
  if not isRendering() then return end
  if not M.tree then return end
  M.tree.setScroll(nodeId, scrollX or 0, scrollY or 0)
  local nodes = M.tree.getNodes and M.tree.getNodes() or nil
  if nodes then
    emitScrollEvent(nodes[nodeId])
  end
end

return ReactJIT
