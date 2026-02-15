--[[
  console.lua -- Interactive eval console for react-love

  Self-contained module using raw Love2D drawing calls (like errors.lua).
  Does not touch the React tree/layout/painter pipeline.

  Features:
    - Dual-mode eval: JS (default) and Lua (:lua prefix)
    - Tab autocomplete for commands, JS globals, node IDs, Lua globals
    - Watch expressions: re-evaluate every frame and display live
    - Macros: save and replay command sequences
    - Live style editing: :style <id> <prop> <value>
    - Node search: :find <type|text|style query>
    - Boilerplate templates: :template <name>
    - Built-in commands: :tree, :nodes, :perf, :find, :watch, :macro, :style, etc.

  Usage:
    local console = require("lua.console")
    console.init({ bridge = bridge, tree = tree, inspector = inspector })

  Controls:
    `  (backtick) -- Toggle console on/off (only when inspector is enabled)
    Enter         -- Execute command
    Tab           -- Autocomplete
    Up/Down       -- History navigation
    Escape        -- Close console / dismiss autocomplete
    Ctrl+L        -- Clear output
    Ctrl+W        -- Delete word backward
    Ctrl+U        -- Clear input line
]]

local Console = {}

-- ============================================================================
-- Dependencies (injected via init)
-- ============================================================================

local bridge    = nil   -- bridge_quickjs instance (for JS eval)
local tree      = nil   -- tree.lua module (for :tree, :nodes)
local inspector = nil   -- inspector.lua module (for :perf, isEnabled check)

-- ============================================================================
-- State
-- ============================================================================

local state = {
  visible     = false,
  input       = "",
  cursorPos   = 0,
  cursorBlink = 0,
  output      = {},          -- array of { text, color } lines
  scrollY     = 0,
  history     = {},
  historyIdx  = 0,
  historyDraft = "",
  -- Autocomplete
  acItems     = {},          -- current completion candidates
  acIndex     = 0,           -- selected candidate (0 = none)
  acVisible   = false,
  acPrefix    = "",          -- the text being completed
  -- Watch expressions
  watches     = {},          -- array of { expr, mode = "js"|"lua", lastResult = "" }
  -- Macros
  macros      = {},          -- name -> array of command strings
  recording   = nil,         -- name of macro being recorded, or nil
  recordBuffer = {},         -- commands recorded so far
}

local MAX_OUTPUT = 500
local MAX_HISTORY = 100

-- ============================================================================
-- Colors (matching inspector dark theme)
-- ============================================================================

local COLORS = {
  bg         = { 0.05, 0.05, 0.10, 0.92 },
  border     = { 0.25, 0.25, 0.35, 0.8 },
  inputBg    = { 0.08, 0.08, 0.14, 1 },
  inputText  = { 0.88, 0.90, 0.94, 1 },
  prompt     = { 0.38, 0.65, 0.98, 1 },
  cursor     = { 0.88, 0.90, 0.94, 0.9 },
  result     = { 0.55, 0.85, 0.55, 1 },
  error      = { 0.95, 0.45, 0.45, 1 },
  info       = { 0.55, 0.58, 0.65, 1 },
  command    = { 0.78, 0.80, 0.84, 1 },
  dim        = { 0.45, 0.48, 0.55, 1 },
  accent     = { 0.38, 0.65, 0.98, 1 },
  lua        = { 0.85, 0.65, 0.35, 1 },
  watch      = { 0.65, 0.55, 0.90, 1 },
  macro      = { 0.90, 0.55, 0.65, 1 },
  acBg       = { 0.10, 0.10, 0.16, 0.95 },
  acSelected = { 0.20, 0.28, 0.45, 0.9 },
  acText     = { 0.78, 0.80, 0.84, 1 },
  acDim      = { 0.45, 0.48, 0.55, 1 },
}

-- ============================================================================
-- Output helpers
-- ============================================================================

local function pushOutput(text, color)
  state.output[#state.output + 1] = { text = text, color = color or COLORS.result }
  if #state.output > MAX_OUTPUT then
    table.remove(state.output, 1)
  end
  state.scrollY = math.huge  -- auto-scroll, clamped in draw
end

local function pushCommand(text, isLua)
  local prefix = isLua and ":lua " or "> "
  local color = isLua and COLORS.lua or COLORS.prompt
  pushOutput(prefix .. text, color)
end

-- ============================================================================
-- Serialization
-- ============================================================================

local function serialize(val, depth)
  depth = depth or 0
  if depth > 3 then return "{...}" end
  local t = type(val)
  if t == "string" then
    if #val > 200 then return '"' .. val:sub(1, 197) .. '..."' end
    return '"' .. val .. '"'
  elseif t == "number" or t == "boolean" then
    return tostring(val)
  elseif t == "nil" then
    return "nil"
  elseif t == "table" then
    local parts = {}
    local count = 0
    local isArray = val[1] ~= nil
    if isArray then
      for i, v in ipairs(val) do
        if count >= 10 then parts[#parts + 1] = "..."; break end
        parts[#parts + 1] = serialize(v, depth + 1)
        count = count + 1
      end
      return "[ " .. table.concat(parts, ", ") .. " ]"
    else
      for k, v in pairs(val) do
        if count >= 10 then parts[#parts + 1] = "..."; break end
        parts[#parts + 1] = tostring(k) .. ": " .. serialize(v, depth + 1)
        count = count + 1
      end
      return "{ " .. table.concat(parts, ", ") .. " }"
    end
  end
  return tostring(val)
end

-- ============================================================================
-- Node introspection helpers
-- ============================================================================

local function countNodes(node)
  if not node then return 0 end
  local count = 1
  for _, child in ipairs(node.children or {}) do
    count = count + countNodes(child)
  end
  return count
end

local function dumpNode(node)
  if not node then
    pushOutput("Node not found", COLORS.error)
    return
  end
  pushOutput(string.format("%s  #%s", node.type or "?", tostring(node.id)), COLORS.accent)
  local c = node.computed
  if c then
    pushOutput(string.format("  position: x=%d y=%d w=%d h=%d",
      math.floor(c.x), math.floor(c.y), math.floor(c.w), math.floor(c.h)), COLORS.info)
  end
  if node.props then
    for k, v in pairs(node.props) do
      if k ~= "style" then
        pushOutput(string.format("  prop.%s: %s", k, serialize(v)), COLORS.info)
      end
    end
  end
  local s = node.style
  if s then
    for k, v in pairs(s) do
      pushOutput(string.format("  style.%s: %s", k, serialize(v)), COLORS.dim)
    end
  end
  local nc = node.children and #node.children or 0
  if nc > 0 then
    pushOutput(string.format("  children: %d", nc), COLORS.info)
  end
  if node.hasHandlers then
    pushOutput("  has event handlers", COLORS.result)
  end
end

--- Walk all nodes and collect matches
local function walkNodes(root, fn)
  if not root then return end
  fn(root)
  for _, child in ipairs(root.children or {}) do
    walkNodes(child, fn)
  end
end

-- ============================================================================
-- Eval engines
-- ============================================================================

local function evalJS(code)
  if not bridge or not bridge.evalReturn then
    pushOutput("JS eval not available (requires native mode with QuickJS)", COLORS.error)
    return
  end

  local wrapped = string.format(
    [[(function() { try { var __r = eval(%s); return typeof __r === 'undefined' ? 'undefined' : (typeof __r === 'object' ? JSON.stringify(__r, null, 2) : String(__r)); } catch(__e) { return 'Error: ' + __e.message; } })()]],
    '"' .. code:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r') .. '"'
  )

  local ok, result = pcall(function()
    return bridge:evalReturn(wrapped)
  end)

  if ok then
    if result ~= nil then
      local str = tostring(result)
      for line in (str .. "\n"):gmatch("([^\n]*)\n") do
        local color = COLORS.result
        if line:match("^Error:") then color = COLORS.error end
        pushOutput(line, color)
      end
    else
      pushOutput("undefined", COLORS.dim)
    end
  else
    pushOutput(tostring(result), COLORS.error)
  end
end

--- Eval JS silently and return the string result (for watches)
local function evalJSSilent(code)
  if not bridge or not bridge.evalReturn then return "n/a" end
  local wrapped = string.format(
    [[(function() { try { var __r = eval(%s); return typeof __r === 'undefined' ? 'undefined' : (typeof __r === 'object' ? JSON.stringify(__r) : String(__r)); } catch(__e) { return 'Error: ' + __e.message; } })()]],
    '"' .. code:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r') .. '"'
  )
  local ok, result = pcall(function() return bridge:evalReturn(wrapped) end)
  if ok and result ~= nil then return tostring(result) end
  return ok and "undefined" or tostring(result)
end

local function evalLua(code)
  local printBuffer = {}
  local oldPrint = print
  print = function(...)
    local args = {...}
    local parts = {}
    for i = 1, select("#", ...) do
      parts[#parts + 1] = tostring(args[i])
    end
    printBuffer[#printBuffer + 1] = table.concat(parts, "\t")
  end

  local fn, compileErr = loadstring("return " .. code)
  if not fn then
    fn, compileErr = loadstring(code)
  end

  if not fn then
    print = oldPrint
    pushOutput("Compile error: " .. tostring(compileErr), COLORS.error)
    return
  end

  local ok, result = pcall(fn)
  print = oldPrint

  for _, line in ipairs(printBuffer) do
    pushOutput(line, COLORS.info)
  end

  if ok then
    if result ~= nil then
      pushOutput(serialize(result), COLORS.result)
    end
  else
    pushOutput("Runtime error: " .. tostring(result), COLORS.error)
  end
end

--- Eval Lua silently and return string result (for watches)
local function evalLuaSilent(code)
  local fn = loadstring("return " .. code)
  if not fn then fn = loadstring(code) end
  if not fn then return "compile error" end
  local ok, result = pcall(fn)
  if ok then return result ~= nil and serialize(result) or "nil" end
  return "error: " .. tostring(result)
end

-- ============================================================================
-- Autocomplete
-- ============================================================================

local BUILTIN_COMMANDS = {
  { cmd = ":help",      desc = "Show all commands" },
  { cmd = ":clear",     desc = "Clear console output" },
  { cmd = ":tree",      desc = "Show element tree summary" },
  { cmd = ":nodes ",    desc = "Inspect node by ID" },
  { cmd = ":perf",      desc = "Performance stats" },
  { cmd = ":lua ",      desc = "Evaluate Lua expression" },
  { cmd = ":find ",     desc = "Search nodes by type/text/style" },
  { cmd = ":style ",    desc = "Live-edit node style" },
  { cmd = ":watch ",    desc = "Add watch expression" },
  { cmd = ":unwatch ",  desc = "Remove watch expression" },
  { cmd = ":watches",   desc = "List active watches" },
  { cmd = ":macro ",    desc = "Manage macros" },
  { cmd = ":record ",   desc = "Start recording a macro" },
  { cmd = ":stop",      desc = "Stop recording macro" },
  { cmd = ":play ",     desc = "Play a recorded macro" },
  { cmd = ":macros",    desc = "List saved macros" },
  { cmd = ":template ", desc = "Insert boilerplate template" },
  { cmd = ":templates", desc = "List available templates" },
  { cmd = ":dump ",     desc = "Dump subtree from node ID" },
  { cmd = ":highlight ",desc = "Flash-highlight a node by ID" },
  { cmd = ":measure ",  desc = "Measure text with current fonts" },
  { cmd = ":env",       desc = "Show bridge/mode/runtime info" },
}

--- Build autocomplete candidates for current input
local function buildCompletions(input)
  local items = {}

  -- Command completions (input starts with :)
  if input == "" or input:sub(1, 1) == ":" then
    for _, entry in ipairs(BUILTIN_COMMANDS) do
      if entry.cmd:sub(1, #input) == input then
        items[#items + 1] = { text = entry.cmd, desc = entry.desc }
      end
    end
    -- Macro names for :play
    if input:match("^:play%s*") then
      for name in pairs(state.macros) do
        local full = ":play " .. name
        if full:sub(1, #input) == input then
          items[#items + 1] = { text = full, desc = "Run macro" }
        end
      end
    end
    -- Template names for :template
    if input:match("^:template%s*") then
      for name in pairs(TEMPLATES) do
        local full = ":template " .. name
        if full:sub(1, #input) == input then
          items[#items + 1] = { text = full, desc = "Insert template" }
        end
      end
    end
    return items
  end

  -- JS global completions (basic — enumerate common globals)
  if bridge and bridge.evalReturn and #input >= 2 then
    local ok, globals = pcall(function()
      return bridge:evalReturn(
        [[(function(){ var p = Object.getOwnPropertyNames(globalThis).filter(function(k){ return k.indexOf(']] .. input:gsub("'", "\\'") .. [[') === 0; }).slice(0, 12); return p.join(','); })()]]
      )
    end)
    if ok and globals and globals ~= "" then
      for name in globals:gmatch("[^,]+") do
        items[#items + 1] = { text = name, desc = "JS global" }
      end
    end
  end

  return items
end

local function showAutocomplete()
  local input = state.input
  state.acItems = buildCompletions(input)
  state.acPrefix = input
  state.acIndex = 0
  state.acVisible = #state.acItems > 0
end

local function applyCompletion()
  if not state.acVisible or state.acIndex < 1 then return false end
  local item = state.acItems[state.acIndex]
  if item then
    state.input = item.text
    state.cursorPos = #state.input
    state.acVisible = false
    return true
  end
  return false
end

local function dismissAutocomplete()
  state.acVisible = false
  state.acIndex = 0
  state.acItems = {}
end

-- ============================================================================
-- Templates
-- ============================================================================

TEMPLATES = {
  box = {
    desc = "Basic Box component",
    code = [[<Box style={{ width: '100%', height: '100%', backgroundColor: '#1e1e2e' }}>
  <Text style={{ fontSize: 16, color: '#cdd6f4' }}>Hello</Text>
</Box>]],
  },
  flexrow = {
    desc = "Horizontal flex row",
    code = [[<Box style={{ flexDirection: 'row', width: '100%', gap: 8, padding: 12 }}>
  <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#45475a' }} />
  <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#585b70' }} />
  <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#6c7086' }} />
</Box>]],
  },
  card = {
    desc = "Card with header and body",
    code = [[<Box style={{ width: 300, backgroundColor: '#1e1e2e', borderRadius: 8, padding: 16 }}>
  <Text style={{ fontSize: 18, color: '#cdd6f4', marginBottom: 8 }}>Card Title</Text>
  <Text style={{ fontSize: 13, color: '#a6adc8' }}>Card body text goes here.</Text>
</Box>]],
  },
  scrollview = {
    desc = "ScrollView container",
    code = [[<ScrollView style={{ width: '100%', height: 300, backgroundColor: '#181825' }}>
  {/* Content here */}
</ScrollView>]],
  },
  pressable = {
    desc = "Pressable button",
    code = [[<Pressable
  onPress={() => console.log('pressed!')}
  style={{ backgroundColor: '#89b4fa', paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16, borderRadius: 6 }}
>
  <Text style={{ fontSize: 14, color: '#1e1e2e' }}>Click Me</Text>
</Pressable>]],
  },
  grid = {
    desc = "CSS-like grid layout using flex",
    code = [[<Box style={{ width: '100%', height: '100%', padding: 16, gap: 16 }}>
  <Box style={{ flexDirection: 'row', width: '100%', gap: 16, flexGrow: 1 }}>
    <Box style={{ flexGrow: 2, backgroundColor: '#313244', borderRadius: 8 }} />
    <Box style={{ flexGrow: 1, backgroundColor: '#313244', borderRadius: 8 }} />
  </Box>
  <Box style={{ flexDirection: 'row', width: '100%', gap: 16, flexGrow: 1 }}>
    <Box style={{ flexGrow: 1, backgroundColor: '#313244', borderRadius: 8 }} />
    <Box style={{ flexGrow: 1, backgroundColor: '#313244', borderRadius: 8 }} />
    <Box style={{ flexGrow: 1, backgroundColor: '#313244', borderRadius: 8 }} />
  </Box>
</Box>]],
  },
  catppuccin = {
    desc = "Catppuccin Mocha color palette reference",
    code = [[// Catppuccin Mocha
const colors = {
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink: '#f5c2e7',
  mauve: '#cba6f7', red: '#f38ba8', maroon: '#eba0ac',
  peach: '#fab387', yellow: '#f9e2af', green: '#a6e3a1',
  teal: '#94e2d5', sky: '#89dceb', sapphire: '#74c7ec',
  blue: '#89b4fa', lavender: '#b4befe', text: '#cdd6f4',
  subtext1: '#bac2de', subtext0: '#a6adc8', overlay2: '#9399b2',
  overlay1: '#7f849c', overlay0: '#6c7086', surface2: '#585b70',
  surface1: '#45475a', surface0: '#313244', base: '#1e1e2e',
  mantle: '#181825', crust: '#11111b',
};]],
  },
}

-- ============================================================================
-- Built-in commands
-- ============================================================================

local builtins = {}

function builtins.help()
  pushOutput("Console commands:", COLORS.accent)
  pushOutput("", COLORS.info)
  pushOutput("  Evaluation", COLORS.accent)
  pushOutput("  <expr>            Evaluate JavaScript expression", COLORS.info)
  pushOutput("  :lua <expr>       Evaluate Lua expression", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("  Introspection", COLORS.accent)
  pushOutput("  :tree             Show element tree summary", COLORS.info)
  pushOutput("  :nodes <id>       Inspect a node by ID", COLORS.info)
  pushOutput("  :find <query>     Search nodes (type:Box, text:hello, style:bg)", COLORS.info)
  pushOutput("  :dump <id>        Dump subtree from a node", COLORS.info)
  pushOutput("  :perf             Performance stats", COLORS.info)
  pushOutput("  :env              Runtime environment info", COLORS.info)
  pushOutput("  :highlight <id>   Flash-highlight a node", COLORS.info)
  pushOutput("  :measure <text>   Measure text dimensions", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("  Live editing", COLORS.accent)
  pushOutput("  :style <id> <prop> <val>  Set node style property", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("  Watches", COLORS.accent)
  pushOutput("  :watch <expr>     Add JS watch expression", COLORS.info)
  pushOutput("  :watch lua <expr> Add Lua watch expression", COLORS.info)
  pushOutput("  :unwatch <n>      Remove watch by index", COLORS.info)
  pushOutput("  :watches          List all watches", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("  Macros", COLORS.accent)
  pushOutput("  :record <name>    Start recording macro", COLORS.info)
  pushOutput("  :stop             Stop recording", COLORS.info)
  pushOutput("  :play <name>      Play a macro", COLORS.info)
  pushOutput("  :macros           List saved macros", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("  Templates", COLORS.accent)
  pushOutput("  :template <name>  Show a boilerplate template", COLORS.info)
  pushOutput("  :templates        List available templates", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("  General", COLORS.accent)
  pushOutput("  :clear            Clear output", COLORS.info)
  pushOutput("  :help             Show this help", COLORS.info)
  pushOutput("", COLORS.info)
  pushOutput("Keys: Tab = autocomplete, Up/Down = history, Ctrl+L = clear, Ctrl+W = delete word, Ctrl+U = clear line", COLORS.dim)
end

function builtins.tree()
  if not tree then pushOutput("Tree module not available", COLORS.error); return end
  local root = tree.getTree()
  if not root then pushOutput("No tree root", COLORS.dim); return end
  local nc = countNodes(root)
  local c = root.computed
  if c then
    pushOutput(string.format("Root: %dx%d  |  %d nodes  |  %d children",
      math.floor(c.w), math.floor(c.h), nc, #(root.children or {})), COLORS.accent)
  else
    pushOutput(string.format("Root: (no layout)  |  %d nodes", nc), COLORS.accent)
  end
  for i, child in ipairs(root.children or {}) do
    if i > 10 then
      pushOutput(string.format("  ... +%d more", #root.children - 10), COLORS.dim)
      break
    end
    local cc = child.computed
    local dims = cc and string.format("%dx%d", math.floor(cc.w), math.floor(cc.h)) or "?"
    pushOutput(string.format("  [%d] %s #%s  %s", i, child.type or "?", tostring(child.id), dims), COLORS.info)
  end
end

function builtins.nodes(args)
  if not tree then pushOutput("Tree module not available", COLORS.error); return end
  local id = tonumber(args)
  if not id then pushOutput("Usage: :nodes <id>", COLORS.error); return end
  local nodes = tree.getNodes()
  if not nodes then pushOutput("No nodes table", COLORS.error); return end
  dumpNode(nodes[id])
end

function builtins.perf()
  if not inspector then pushOutput("Inspector not available", COLORS.error); return end
  local perf = inspector.getPerfData and inspector.getPerfData()
  if perf then
    pushOutput(string.format("FPS: %d  |  Layout: %.1fms  |  Paint: %.1fms  |  Nodes: %d",
      perf.fps, perf.layoutMs, perf.paintMs, perf.nodeCount), COLORS.accent)
  else
    pushOutput("Performance data not available", COLORS.dim)
  end
end

function builtins.clear()
  state.output = {}
  state.scrollY = 0
end

function builtins.env()
  pushOutput("Runtime environment:", COLORS.accent)
  pushOutput(string.format("  Bridge: %s", bridge and (bridge.evalReturn and "QuickJS (native)" or "FS (canvas/web)") or "none"), COLORS.info)
  local mode = "unknown"
  -- Try to detect mode from the ReactLove module if accessible
  local rok, rl = pcall(require, "lua.init")
  if rok and rl and rl.getMode then mode = rl.getMode() or "unknown" end
  pushOutput(string.format("  Mode: %s", mode), COLORS.info)
  pushOutput(string.format("  Love2D: %s", love._version or "unknown"), COLORS.info)
  local w, h = love.graphics.getDimensions()
  pushOutput(string.format("  Window: %dx%d", w, h), COLORS.info)
  pushOutput(string.format("  Console output: %d lines", #state.output), COLORS.info)
  pushOutput(string.format("  History: %d commands", #state.history), COLORS.info)
  pushOutput(string.format("  Watches: %d active", #state.watches), COLORS.info)
  pushOutput(string.format("  Macros: %d saved", (function() local n=0; for _ in pairs(state.macros) do n=n+1 end; return n end)()), COLORS.info)
end

function builtins.find(query)
  if not tree then pushOutput("Tree module not available", COLORS.error); return end
  local root = tree.getTree()
  if not root then pushOutput("No tree", COLORS.dim); return end

  local matches = {}
  local field, value = query:match("^(%w+):(.+)$")

  if not field then
    -- Bare query: search by type name (case-insensitive)
    local q = query:lower()
    walkNodes(root, function(node)
      if node.type and node.type:lower():find(q, 1, true) then
        matches[#matches + 1] = node
      end
    end)
  elseif field == "type" then
    local q = value:lower()
    walkNodes(root, function(node)
      if node.type and node.type:lower():find(q, 1, true) then
        matches[#matches + 1] = node
      end
    end)
  elseif field == "text" then
    local q = value:lower()
    walkNodes(root, function(node)
      if node.props and node.props.text and node.props.text:lower():find(q, 1, true) then
        matches[#matches + 1] = node
      end
    end)
  elseif field == "style" then
    -- Search for nodes that have a specific style property set
    walkNodes(root, function(node)
      if node.style then
        for k in pairs(node.style) do
          if k:lower():find(value:lower(), 1, true) then
            matches[#matches + 1] = node
            break
          end
        end
      end
    end)
  elseif field == "id" then
    local id = tonumber(value)
    if id then
      local nodes = tree.getNodes()
      if nodes and nodes[id] then matches[#matches + 1] = nodes[id] end
    end
  elseif field == "handler" or field == "handlers" then
    walkNodes(root, function(node)
      if node.hasHandlers then matches[#matches + 1] = node end
    end)
  else
    pushOutput("Unknown search field: " .. field, COLORS.error)
    pushOutput("Fields: type, text, style, id, handler", COLORS.dim)
    return
  end

  pushOutput(string.format("Found %d nodes matching '%s':", #matches, query), COLORS.accent)
  for i, node in ipairs(matches) do
    if i > 20 then
      pushOutput(string.format("  ... +%d more", #matches - 20), COLORS.dim)
      break
    end
    local c = node.computed
    local dims = c and string.format("(%d,%d %dx%d)", math.floor(c.x), math.floor(c.y), math.floor(c.w), math.floor(c.h)) or ""
    local textSnip = ""
    if node.props and node.props.text then
      local t = node.props.text
      textSnip = #t > 20 and (' "' .. t:sub(1, 17) .. '..."') or (' "' .. t .. '"')
    end
    pushOutput(string.format("  #%s %s %s%s", tostring(node.id), node.type or "?", dims, textSnip), COLORS.info)
  end
end

function builtins.dump(args)
  if not tree then pushOutput("Tree module not available", COLORS.error); return end
  local id = tonumber(args)
  if not id then pushOutput("Usage: :dump <id>", COLORS.error); return end
  local nodes = tree.getNodes()
  if not nodes or not nodes[id] then pushOutput("Node not found: " .. args, COLORS.error); return end

  local function dumpRecursive(node, depth)
    if depth > 8 then pushOutput(string.rep("  ", depth) .. "...", COLORS.dim); return end
    local c = node.computed
    local dims = c and string.format("%dx%d", math.floor(c.w), math.floor(c.h)) or "?"
    local prefix = string.rep("  ", depth)
    local textSnip = ""
    if node.props and node.props.text then
      local t = node.props.text
      textSnip = #t > 30 and (' "' .. t:sub(1, 27) .. '..."') or (' "' .. t .. '"')
    end
    pushOutput(string.format("%s%s #%s  %s%s", prefix, node.type or "?", tostring(node.id), dims, textSnip),
      depth == 0 and COLORS.accent or COLORS.info)
    for _, child in ipairs(node.children or {}) do
      dumpRecursive(child, depth + 1)
    end
  end

  dumpRecursive(nodes[id], 0)
end

function builtins.style(args)
  if not tree then pushOutput("Tree module not available", COLORS.error); return end
  local id, prop, value = args:match("^(%d+)%s+(%S+)%s+(.+)$")
  id = tonumber(id)
  if not id or not prop or not value then
    pushOutput("Usage: :style <id> <property> <value>", COLORS.error)
    pushOutput("  Example: :style 5 backgroundColor #ff0000", COLORS.dim)
    pushOutput("  Example: :style 5 width 200", COLORS.dim)
    pushOutput("  Example: :style 5 flexGrow 1", COLORS.dim)
    return
  end

  local nodes = tree.getNodes()
  if not nodes or not nodes[id] then pushOutput("Node not found: " .. id, COLORS.error); return end

  local node = nodes[id]
  if not node.style then node.style = {} end

  -- Coerce value
  local numVal = tonumber(value)
  if numVal then
    value = numVal
  elseif value == "true" then
    value = true
  elseif value == "false" then
    value = false
  elseif value == "nil" or value == "none" then
    value = nil
  end

  local oldVal = node.style[prop]
  node.style[prop] = value
  tree.markDirty()  -- trigger re-layout

  pushOutput(string.format("Set #%d style.%s: %s -> %s",
    id, prop, serialize(oldVal), serialize(value)), COLORS.result)
end

function builtins.highlight(args)
  if not tree then pushOutput("Tree module not available", COLORS.error); return end
  local id = tonumber(args)
  if not id then pushOutput("Usage: :highlight <id>", COLORS.error); return end
  local nodes = tree.getNodes()
  if not nodes or not nodes[id] then pushOutput("Node not found: " .. args, COLORS.error); return end

  -- Store highlight state for the draw function to pick up
  state.highlightNode = nodes[id]
  state.highlightTimer = 1.5  -- seconds to flash
  pushOutput(string.format("Highlighting #%d for 1.5s", id), COLORS.result)
end

function builtins.measure(args)
  if not args or args == "" then
    pushOutput("Usage: :measure <text> [fontSize]", COLORS.error)
    return
  end
  local text, fontSizeStr = args:match("^(.+)%s+(%d+)$")
  if not text then text = args end
  local fontSize = tonumber(fontSizeStr) or 14
  local font = love.graphics.newFont(fontSize)
  local w = font:getWidth(text)
  local h = font:getHeight()
  pushOutput(string.format("Text: \"%s\" at %dpx -> %dx%d", text, fontSize, w, h), COLORS.result)
end

-- Watch commands
function builtins.watch(args)
  if not args or args == "" then
    pushOutput("Usage: :watch <js expr>  or  :watch lua <lua expr>", COLORS.error)
    return
  end
  local watchMode, expr = args:match("^lua%s+(.+)$")
  if watchMode then
    -- It's a lua watch — watchMode is actually the expression
    state.watches[#state.watches + 1] = { expr = watchMode, mode = "lua", lastResult = "" }
    pushOutput(string.format("Watch #%d (Lua): %s", #state.watches, watchMode), COLORS.watch)
  else
    state.watches[#state.watches + 1] = { expr = args, mode = "js", lastResult = "" }
    pushOutput(string.format("Watch #%d (JS): %s", #state.watches, args), COLORS.watch)
  end
end

function builtins.unwatch(args)
  local idx = tonumber(args)
  if not idx or idx < 1 or idx > #state.watches then
    pushOutput("Usage: :unwatch <index>  (1-" .. #state.watches .. ")", COLORS.error)
    return
  end
  local removed = table.remove(state.watches, idx)
  pushOutput(string.format("Removed watch #%d: %s", idx, removed.expr), COLORS.watch)
end

function builtins.watchesList()
  if #state.watches == 0 then
    pushOutput("No active watches", COLORS.dim)
    return
  end
  pushOutput("Active watches:", COLORS.accent)
  for i, w in ipairs(state.watches) do
    pushOutput(string.format("  [%d] (%s) %s = %s", i, w.mode, w.expr, w.lastResult), COLORS.watch)
  end
end

-- Macro commands
function builtins.record(name)
  if not name or name == "" then
    pushOutput("Usage: :record <name>", COLORS.error)
    return
  end
  state.recording = name
  state.recordBuffer = {}
  pushOutput(string.format("Recording macro '%s'... (type :stop to finish)", name), COLORS.macro)
end

function builtins.stop()
  if not state.recording then
    pushOutput("Not recording", COLORS.dim)
    return
  end
  state.macros[state.recording] = state.recordBuffer
  pushOutput(string.format("Saved macro '%s' (%d commands)", state.recording, #state.recordBuffer), COLORS.macro)
  state.recording = nil
  state.recordBuffer = {}
end

function builtins.play(name)
  if not name or name == "" then
    pushOutput("Usage: :play <name>", COLORS.error)
    return
  end
  local commands = state.macros[name]
  if not commands then
    pushOutput("Macro not found: " .. name, COLORS.error)
    local names = {}
    for n in pairs(state.macros) do names[#names + 1] = n end
    if #names > 0 then pushOutput("Available: " .. table.concat(names, ", "), COLORS.dim) end
    return
  end
  pushOutput(string.format("Playing macro '%s' (%d commands):", name, #commands), COLORS.macro)
  for _, cmd in ipairs(commands) do
    executeCommand(cmd)
  end
end

function builtins.macrosList()
  local names = {}
  for name, cmds in pairs(state.macros) do
    names[#names + 1] = string.format("  %s (%d commands)", name, #cmds)
  end
  if #names == 0 then
    pushOutput("No macros saved. Use :record <name> to start.", COLORS.dim)
    return
  end
  pushOutput("Saved macros:", COLORS.accent)
  for _, line in ipairs(names) do
    pushOutput(line, COLORS.macro)
  end
end

function builtins.template(name)
  if not name or name == "" then
    pushOutput("Usage: :template <name>", COLORS.error)
    pushOutput("Use :templates to list available templates", COLORS.dim)
    return
  end
  local tmpl = TEMPLATES[name]
  if not tmpl then
    pushOutput("Unknown template: " .. name, COLORS.error)
    local names = {}
    for n in pairs(TEMPLATES) do names[#names + 1] = n end
    table.sort(names)
    pushOutput("Available: " .. table.concat(names, ", "), COLORS.dim)
    return
  end
  pushOutput(tmpl.desc .. ":", COLORS.accent)
  for line in (tmpl.code .. "\n"):gmatch("([^\n]*)\n") do
    pushOutput("  " .. line, COLORS.info)
  end
end

function builtins.templatesList()
  pushOutput("Available templates:", COLORS.accent)
  local names = {}
  for name in pairs(TEMPLATES) do names[#names + 1] = name end
  table.sort(names)
  for _, name in ipairs(names) do
    pushOutput(string.format("  %-12s %s", name, TEMPLATES[name].desc), COLORS.info)
  end
  pushOutput("", COLORS.info)
  pushOutput("Use :template <name> to view code", COLORS.dim)
end

-- ============================================================================
-- Command execution
-- ============================================================================

local function executeCommand(input)
  local trimmed = input:match("^%s*(.-)%s*$")
  if trimmed == "" then return end

  -- Add to history (skip if replaying from macro)
  if #state.history == 0 or state.history[#state.history] ~= trimmed then
    state.history[#state.history + 1] = trimmed
    if #state.history > MAX_HISTORY then
      table.remove(state.history, 1)
    end
  end
  state.historyIdx = 0

  -- Record if recording (but don't record meta-commands)
  if state.recording and not trimmed:match("^:stop") and not trimmed:match("^:record") and not trimmed:match("^:play") then
    state.recordBuffer[#state.recordBuffer + 1] = trimmed
  end

  -- Parse command
  if trimmed:match("^:help") then builtins.help()
  elseif trimmed:match("^:clear") then builtins.clear()
  elseif trimmed:match("^:tree") then pushCommand(trimmed, true); builtins.tree()
  elseif trimmed:match("^:nodes%s+(.+)") then pushCommand(trimmed, true); builtins.nodes(trimmed:match("^:nodes%s+(.+)"))
  elseif trimmed:match("^:perf") then pushCommand(trimmed, true); builtins.perf()
  elseif trimmed:match("^:env") then pushCommand(trimmed, true); builtins.env()
  elseif trimmed:match("^:find%s+(.+)") then pushCommand(trimmed, true); builtins.find(trimmed:match("^:find%s+(.+)"))
  elseif trimmed:match("^:dump%s+(.+)") then pushCommand(trimmed, true); builtins.dump(trimmed:match("^:dump%s+(.+)"))
  elseif trimmed:match("^:style%s+(.+)") then pushCommand(trimmed, true); builtins.style(trimmed:match("^:style%s+(.+)"))
  elseif trimmed:match("^:highlight%s+(.+)") then pushCommand(trimmed, true); builtins.highlight(trimmed:match("^:highlight%s+(.+)"))
  elseif trimmed:match("^:measure%s+(.+)") then pushCommand(trimmed, true); builtins.measure(trimmed:match("^:measure%s+(.+)"))
  elseif trimmed:match("^:watch%s+(.+)") then pushCommand(trimmed, true); builtins.watch(trimmed:match("^:watch%s+(.+)"))
  elseif trimmed:match("^:unwatch%s+(.+)") then pushCommand(trimmed, true); builtins.unwatch(trimmed:match("^:unwatch%s+(.+)"))
  elseif trimmed:match("^:watches") then builtins.watchesList()
  elseif trimmed:match("^:record%s+(.+)") then builtins.record(trimmed:match("^:record%s+(.+)"))
  elseif trimmed:match("^:stop") then builtins.stop()
  elseif trimmed:match("^:play%s+(.+)") then builtins.play(trimmed:match("^:play%s+(.+)"))
  elseif trimmed:match("^:macros") then builtins.macrosList()
  elseif trimmed:match("^:template%s+(.+)") then pushCommand(trimmed, true); builtins.template(trimmed:match("^:template%s+(.+)"))
  elseif trimmed:match("^:templates") then builtins.templatesList()
  elseif trimmed:match("^:lua%s+(.+)") then
    local code = trimmed:match("^:lua%s+(.+)")
    pushCommand(code, true); evalLua(code)
  else
    local code = trimmed:match("^>%s*(.+)") or trimmed
    pushCommand(code, false); evalJS(code)
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

function Console.init(config)
  config = config or {}
  bridge = config.bridge
  tree = config.tree
  inspector = config.inspector
end

function Console.updateRefs(config)
  config = config or {}
  if config.bridge then bridge = config.bridge end
  if config.tree then tree = config.tree end
end

function Console.isVisible()
  return state.visible
end

function Console.show()
  state.visible = true
  state.cursorBlink = 0
end

function Console.hide()
  state.visible = false
  dismissAutocomplete()
end

function Console.toggle()
  if state.visible then Console.hide() else Console.show() end
end

-- ============================================================================
-- Input handling
-- ============================================================================

function Console.keypressed(key)
  if not state.visible then return false end

  -- Autocomplete navigation
  if state.acVisible then
    if key == "tab" or key == "down" then
      state.acIndex = state.acIndex + 1
      if state.acIndex > #state.acItems then state.acIndex = 1 end
      return true
    elseif key == "up" then
      state.acIndex = state.acIndex - 1
      if state.acIndex < 1 then state.acIndex = #state.acItems end
      return true
    elseif key == "return" then
      if state.acIndex > 0 then
        applyCompletion()
        return true
      end
      -- Fall through to normal return handling
    elseif key == "escape" then
      dismissAutocomplete()
      return true
    else
      -- Any other key dismisses autocomplete
      dismissAutocomplete()
      -- Fall through to normal key handling
    end
  end

  if key == "escape" then
    Console.hide()
    return true
  end

  if key == "return" then
    executeCommand(state.input)
    state.input = ""
    state.cursorPos = 0
    return true
  end

  if key == "tab" then
    showAutocomplete()
    if #state.acItems == 1 then
      -- Single match: apply immediately
      state.acIndex = 1
      applyCompletion()
    elseif #state.acItems > 1 then
      state.acIndex = 1
    end
    return true
  end

  if key == "backspace" then
    if state.cursorPos > 0 then
      state.input = state.input:sub(1, state.cursorPos - 1) .. state.input:sub(state.cursorPos + 1)
      state.cursorPos = state.cursorPos - 1
    end
    state.cursorBlink = 0
    return true
  end

  if key == "delete" then
    if state.cursorPos < #state.input then
      state.input = state.input:sub(1, state.cursorPos) .. state.input:sub(state.cursorPos + 2)
    end
    return true
  end

  if key == "left" then
    state.cursorPos = math.max(0, state.cursorPos - 1)
    state.cursorBlink = 0
    return true
  end

  if key == "right" then
    state.cursorPos = math.min(#state.input, state.cursorPos + 1)
    state.cursorBlink = 0
    return true
  end

  if key == "home" then
    state.cursorPos = 0; state.cursorBlink = 0; return true
  end

  if key == "end" then
    state.cursorPos = #state.input; state.cursorBlink = 0; return true
  end

  if key == "up" then
    if #state.history == 0 then return true end
    if state.historyIdx == 0 then
      state.historyDraft = state.input
      state.historyIdx = #state.history
    elseif state.historyIdx > 1 then
      state.historyIdx = state.historyIdx - 1
    end
    state.input = state.history[state.historyIdx]
    state.cursorPos = #state.input
    state.cursorBlink = 0
    return true
  end

  if key == "down" then
    if state.historyIdx == 0 then return true end
    if state.historyIdx >= #state.history then
      state.historyIdx = 0
      state.input = state.historyDraft
    else
      state.historyIdx = state.historyIdx + 1
      state.input = state.history[state.historyIdx]
    end
    state.cursorPos = #state.input
    state.cursorBlink = 0
    return true
  end

  -- Ctrl shortcuts
  if love.keyboard.isDown("lctrl", "rctrl") then
    if key == "l" then builtins.clear(); return true end
    if key == "a" then state.cursorPos = 0; return true end
    if key == "e" then state.cursorPos = #state.input; return true end
    if key == "u" then
      -- Clear input line
      state.input = state.input:sub(state.cursorPos + 1)
      state.cursorPos = 0
      return true
    end
    if key == "w" then
      -- Delete word backward
      if state.cursorPos > 0 then
        local before = state.input:sub(1, state.cursorPos)
        -- Strip trailing spaces, then strip non-spaces
        local trimmed = before:gsub("%s+$", ""):gsub("%S+$", "")
        state.input = trimmed .. state.input:sub(state.cursorPos + 1)
        state.cursorPos = #trimmed
      end
      return true
    end
  end

  return true  -- consume all keys when console is open
end

function Console.textinput(text)
  if not state.visible then return false end
  if text == "`" then return false end  -- toggle key

  state.input = state.input:sub(1, state.cursorPos) .. text .. state.input:sub(state.cursorPos + 1)
  state.cursorPos = state.cursorPos + #text
  state.cursorBlink = 0
  -- Dismiss autocomplete on typing (will be refreshed on next Tab)
  dismissAutocomplete()
  return true
end

function Console.wheelmoved(x, y)
  if not state.visible then return false end
  state.scrollY = state.scrollY - y * 16
  if state.scrollY < 0 then state.scrollY = 0 end
  return true
end

function Console.update(dt)
  if not state.visible then return end
  state.cursorBlink = state.cursorBlink + dt

  -- Update highlight timer
  if state.highlightTimer then
    state.highlightTimer = state.highlightTimer - dt
    if state.highlightTimer <= 0 then
      state.highlightTimer = nil
      state.highlightNode = nil
    end
  end

  -- Update watch expressions (every ~0.5s to avoid perf hit)
  state._watchTimer = (state._watchTimer or 0) + dt
  if state._watchTimer >= 0.5 then
    state._watchTimer = 0
    for _, w in ipairs(state.watches) do
      if w.mode == "js" then
        w.lastResult = evalJSSilent(w.expr)
      else
        w.lastResult = evalLuaSilent(w.expr)
      end
    end
  end
end

-- ============================================================================
-- Drawing
-- ============================================================================

function Console.draw()
  if not state.visible then
    -- Still draw highlight overlay if active
    drawHighlight()
    return
  end

  local ok, drawErr = pcall(function()
    local screenW = love.graphics.getWidth()
    local screenH = love.graphics.getHeight()
    local consoleH = math.max(200, math.floor(screenH * 0.4))
    local consoleY = screenH - consoleH

    local font = love.graphics.newFont(12)
    local lineH = font:getHeight() + 2
    local pad = 10
    local inputH = lineH + pad * 2

    -- Save graphics state
    love.graphics.push("all")
    love.graphics.origin()
    love.graphics.setScissor()

    -- Background
    love.graphics.setColor(COLORS.bg)
    love.graphics.rectangle("fill", 0, consoleY, screenW, consoleH)

    -- Top border
    love.graphics.setColor(COLORS.border)
    love.graphics.rectangle("fill", 0, consoleY, screenW, 1)

    -- Title bar
    love.graphics.setFont(font)
    love.graphics.setColor(COLORS.accent)
    local title = "Console  (` close  |  Tab autocomplete  |  :help)"
    if state.recording then
      title = "Console  [RECORDING: " .. state.recording .. "]  :stop to finish"
    end
    love.graphics.print(title, pad, consoleY + 4)

    local titleH = lineH + 6

    -- Watch bar (below title, above output)
    local watchH = 0
    if #state.watches > 0 then
      watchH = #state.watches * lineH + 4
      local watchY = consoleY + titleH
      love.graphics.setColor(0.08, 0.06, 0.14, 0.8)
      love.graphics.rectangle("fill", 0, watchY, screenW, watchH)
      love.graphics.setColor(COLORS.border)
      love.graphics.rectangle("fill", 0, watchY + watchH - 1, screenW, 1)

      love.graphics.setFont(font)
      for i, w in ipairs(state.watches) do
        local wy = watchY + (i - 1) * lineH + 2
        love.graphics.setColor(COLORS.watch)
        love.graphics.print(string.format("[%d] %s = ", i, w.expr), pad, wy)
        local labelW = font:getWidth(string.format("[%d] %s = ", i, w.expr))
        -- Color the result based on error or not
        if w.lastResult:match("^Error:") or w.lastResult:match("^error:") then
          love.graphics.setColor(COLORS.error)
        else
          love.graphics.setColor(COLORS.result)
        end
        love.graphics.print(w.lastResult, pad + labelW, wy)
      end
    end

    local outputY = consoleY + titleH + watchH
    local outputH = consoleH - titleH - watchH - inputH

    -- Output area (scissored)
    love.graphics.setScissor(0, outputY, screenW, outputH)

    local totalContentH = #state.output * lineH
    local maxScroll = math.max(0, totalContentH - outputH)
    if state.scrollY > maxScroll then state.scrollY = maxScroll end

    local startY = outputY - state.scrollY
    love.graphics.setFont(font)
    for i, entry in ipairs(state.output) do
      local y = startY + (i - 1) * lineH
      if y + lineH > outputY and y < outputY + outputH then
        love.graphics.setColor(entry.color)
        love.graphics.print(entry.text, pad, y)
      end
    end

    love.graphics.setScissor()

    -- Scroll indicator
    if totalContentH > outputH and maxScroll > 0 then
      local barH = math.max(20, outputH * (outputH / totalContentH))
      local barY = outputY + (state.scrollY / maxScroll) * (outputH - barH)
      love.graphics.setColor(COLORS.dim)
      love.graphics.rectangle("fill", screenW - 4, barY, 3, barH, 1, 1)
    end

    -- Input area
    local inputY = consoleY + consoleH - inputH
    love.graphics.setColor(COLORS.inputBg)
    love.graphics.rectangle("fill", 0, inputY, screenW, inputH)

    love.graphics.setColor(COLORS.border)
    love.graphics.rectangle("fill", 0, inputY, screenW, 1)

    -- Prompt (changes when recording)
    love.graphics.setFont(font)
    local promptStr = state.recording and "REC> " or "> "
    love.graphics.setColor(state.recording and COLORS.macro or COLORS.prompt)
    love.graphics.print(promptStr, pad, inputY + pad)
    local promptW = font:getWidth(promptStr)

    -- Input text
    love.graphics.setColor(COLORS.inputText)
    love.graphics.print(state.input, pad + promptW, inputY + pad)

    -- Cursor
    if math.floor(state.cursorBlink * 2) % 2 == 0 then
      local cursorX = pad + promptW + font:getWidth(state.input:sub(1, state.cursorPos))
      love.graphics.setColor(COLORS.cursor)
      love.graphics.rectangle("fill", cursorX, inputY + pad, 1.5, lineH)
    end

    -- Autocomplete popup
    if state.acVisible and #state.acItems > 0 then
      drawAutocomplete(font, lineH, pad, promptW, inputY)
    end

    -- Restore graphics state
    love.graphics.pop()

    -- Draw highlight overlay (outside the console push/pop so it's on the main canvas)
    drawHighlight()
  end)

  if not ok then
    pcall(function()
      io.write("[console] Draw error: " .. tostring(drawErr) .. "\n")
      io.flush()
    end)
  end
end

-- ============================================================================
-- Drawing: Autocomplete popup
-- ============================================================================

function drawAutocomplete(font, lineH, pad, promptW, inputY)
  local items = state.acItems
  local maxShow = math.min(#items, 10)
  local acW = 0
  for i = 1, maxShow do
    local w = font:getWidth(items[i].text .. "  " .. (items[i].desc or ""))
    if w > acW then acW = w end
  end
  acW = acW + pad * 2
  local acH = maxShow * lineH + 4

  -- Position above input line
  local acX = pad + promptW
  local acY = inputY - acH - 2

  -- Background
  love.graphics.setColor(COLORS.acBg)
  love.graphics.rectangle("fill", acX, acY, acW, acH, 4, 4)
  love.graphics.setColor(COLORS.border)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", acX, acY, acW, acH, 4, 4)

  -- Items
  love.graphics.setFont(font)
  for i = 1, maxShow do
    local y = acY + (i - 1) * lineH + 2
    if i == state.acIndex then
      love.graphics.setColor(COLORS.acSelected)
      love.graphics.rectangle("fill", acX + 2, y, acW - 4, lineH, 2, 2)
    end
    love.graphics.setColor(i == state.acIndex and COLORS.accent or COLORS.acText)
    love.graphics.print(items[i].text, acX + pad, y)
    if items[i].desc then
      local tw = font:getWidth(items[i].text)
      love.graphics.setColor(COLORS.acDim)
      love.graphics.print("  " .. items[i].desc, acX + pad + tw, y)
    end
  end
end

-- ============================================================================
-- Drawing: Node highlight overlay
-- ============================================================================

function drawHighlight()
  if not state.highlightNode or not state.highlightTimer then return end
  local node = state.highlightNode
  if not node.computed then return end

  local c = node.computed
  -- Pulsing highlight
  local alpha = math.abs(math.sin(state.highlightTimer * 4)) * 0.5 + 0.2

  love.graphics.push("all")
  love.graphics.origin()
  love.graphics.setScissor()

  -- Fill
  love.graphics.setColor(0.95, 0.55, 0.20, alpha * 0.3)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

  -- Border
  love.graphics.setColor(0.95, 0.55, 0.20, alpha)
  love.graphics.setLineWidth(2)
  love.graphics.rectangle("line", c.x, c.y, c.w, c.h)

  -- Label
  local font = love.graphics.newFont(11)
  love.graphics.setFont(font)
  local label = string.format("#%s %s", tostring(node.id), node.type or "?")
  love.graphics.setColor(0.95, 0.55, 0.20, alpha + 0.3)
  love.graphics.print(label, c.x + 2, c.y - 14)

  love.graphics.pop()
end

return Console
