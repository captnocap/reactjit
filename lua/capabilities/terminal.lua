--[[
  capabilities/terminal.lua — PTY terminal sessions with damage-driven vterm

  Spawns shells over a PTY and feeds output through libvterm for structured,
  damage-driven updates. Only dirty rows are extracted — no naive per-frame
  full reads. Architecture lifted from claude_session.lua, minus the semantic
  classification layer.

  ── Terminal types ────────────────────────────────────────────────────────────

  "user"     Interactive bash/zsh as the current OS user. Cannot escalate
             privileges. Safe for general shell interaction.

  "root"     Interactive shell via `sudo -i <shell>`. Requires passwordless
             sudo OR the PTY naturally shows the password prompt — either way
             the caller handles it. Use intentionally.

  "template" Stateless, ephemeral execution. Declare a bash environment (env
             vars, cwd, shell flags). Each command sent spawns its own fresh
             PTY: `bash --norc --noprofile -c "<cmd>"`. Exits when done, fires
             onExit. Perfect for sandboxed one-shot commands.

  ── Architecture ─────────────────────────────────────────────────────────────

  WRITES (you -> shell): direct to PTY stdin via bridge.rpc('pty:write')
  READS  (shell -> you): PTY stdout -> vterm:feed() -> damage callbacks ->
                         settle timer -> extract dirty rows -> onDirtyRows event

  The settle timer (SETTLE_MS) batches rapid terminal output. Damage resets
  the timer; rows are only extracted once the screen is calm. This prevents
  flooding React with per-character updates during fast output.

  Raw PTY bytes are still pushed as onData for backward compatibility.

  ── React usage ──────────────────────────────────────────────────────────────

    -- Interactive user shell (one-liner):
    <Terminal type="user" onData={(e) => append(e.data)} />

    -- Structured row updates (vterm-backed):
    <Terminal type="user" onDirtyRows={(e) => setRows(e.rows)} />

    -- Hook pattern (managed state + send/resize helpers):
    const { output, send, resize, terminalProps } = usePTY({ type: 'user' })
    <Terminal {...terminalProps} />

  ── RPC ──────────────────────────────────────────────────────────────────────

    bridge.rpc('pty:write',  { session, data })         → { ok }
    bridge.rpc('pty:resize', { session, rows, cols })   → { ok }
    bridge.rpc('pty:kill',   { session, signal? })      → { ok }
    bridge.rpc('pty:focus',  { session })               → { ok }
    bridge.rpc('pty:list')                              → [{ id, session, ... }]
    bridge.rpc('pty:screen', { session })               → { rows: [...], cursor: {...} }

    `session` is the string session name or numeric nodeId.
    Omit to target the focused session.
]]

local Capabilities = require("lua.capabilities")
local PTY          = require("lua.pty")
local VTerm        = require("lua.vterm")

-- ── Constants ───────────────────────────────────────────────────────────────

local SETTLE_MS = 120  -- ms after last damage before extracting dirty rows

-- ── Clock (monotonic, milliseconds) ─────────────────────────────────────────

local function now_ms()
  if love and love.timer then
    return love.timer.getTime() * 1000
  end
  return os.clock() * 1000
end

-- ── Session registry ─────────────────────────────────────────────────────────

local _sessions     = {}   -- nodeId -> state
local _sessionNames = {}   -- session string -> nodeId
local _focusedId    = nil  -- nodeId of the "focused" session (fallback for RPC)

-- ── Helpers ──────────────────────────────────────────────────────────────────

local function resolveSession(idOrName)
  if type(idOrName) == "number" then
    return _sessions[idOrName], idOrName
  end
  if type(idOrName) == "string" then
    local nid = _sessionNames[idOrName]
    if nid then return _sessions[nid], nid end
  end
  return _sessions[_focusedId], _focusedId
end

local function pushCap(pushEvent, nodeId, handler, data)
  if not pushEvent then return end
  local payload = { targetId = nodeId, handler = handler }
  if data then for k, v in pairs(data) do payload[k] = v end end
  pushEvent({ type = "capability", payload = payload })
end

-- ── Spawn helpers ────────────────────────────────────────────────────────────

local function buildEnv(props)
  local env = {}
  if props.env then
    for k, v in pairs(props.env) do env[k] = v end
  end
  env.TERM      = env.TERM      or "xterm-256color"
  env.COLORTERM = env.COLORTERM or "truecolor"
  return env
end

local function spawnPTY(props, command)
  local ptyType = props.type or "user"
  local shell   = props.shell or "bash"
  local args    = {}

  if ptyType == "root" then
    shell = "sudo"
    args  = { "-i", props.shell or "bash" }

  elseif ptyType == "template" then
    shell = props.shell or "bash"
    if command then
      args = { "--norc", "--noprofile", "-c", command }
    else
      args = { "--norc", "--noprofile" }
    end
  end

  return PTY.open({
    shell = shell,
    args  = args,
    cwd   = props.cwd,
    env   = buildEnv(props),
    rows  = props.rows or 24,
    cols  = props.cols or 80,
  })
end

-- ── Capability registration ─────────────────────────────────────────────────

Capabilities.register("Terminal", {
  visual = false,

  schema = {
    type        = { type = "string",  default = "user",   desc = "user | root | template" },
    shell       = { type = "string",  default = "bash",   desc = "Shell: bash | zsh" },
    cwd         = { type = "string",                      desc = "Working directory" },
    rows        = { type = "number",  default = 24,       desc = "Terminal rows" },
    cols        = { type = "number",  default = 80,       desc = "Terminal columns" },
    env         = { type = "object",                      desc = "Environment overrides { KEY: value | false }" },
    session     = { type = "string",                      desc = "Named session ID for RPC targeting" },
    autoConnect = { type = "bool",    default = true,     desc = "Auto-spawn shell on mount" },
    transport   = { type = "string",  default = "bridge", desc = "bridge | ws | http | tor" },
  },

  events = { "onData", "onDirtyRows", "onCursorMove", "onConnect", "onExit", "onError" },

  create = function(nodeId, props)
    local rows = props.rows or 24
    local cols = props.cols or 80

    local state = {
      pty           = nil,
      vterm         = nil,
      connected     = false,
      rows          = rows,
      cols          = cols,
      session       = props.session,
      ptyType       = props.type or "user",
      -- Damage tracking
      _pendingDirty = {},
      _lastDamageAt = nil,
      settleAt      = nil,
    }

    _sessions[nodeId] = state
    if props.session then _sessionNames[props.session] = nodeId end
    if not _focusedId then _focusedId = nodeId end
    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Live resize: update both PTY and vterm together
    if props.rows ~= prev.rows or props.cols ~= prev.cols then
      local r = props.rows or 24
      local c = props.cols or 80
      if state.vterm then
        state.vterm:resize(r, c)
      end
      if state.pty then
        state.pty:resize(r, c)
      end
      state.rows = r
      state.cols = c
      -- Clear pending dirty — grid reflows after resize
      state._pendingDirty = {}
    end
    -- Update named session mapping if session prop changed
    if props.session ~= state.session then
      if state.session then _sessionNames[state.session] = nil end
      state.session = props.session
      if props.session then _sessionNames[props.session] = nodeId end
    end
    state.ptyType = props.type or "user"
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    -- Auto-connect on first tick: spawn PTY + create vterm
    if not state.connected and props.autoConnect ~= false then
      local rows = props.rows or 24
      local cols = props.cols or 80

      -- Create vterm first
      state.vterm = VTerm.new(rows, cols)

      -- Spawn PTY
      local pty, err = spawnPTY(props)
      if pty then
        state.pty       = pty
        state.connected = true
        pushCap(pushEvent, nodeId, "onConnect", {
          shell   = props.shell or "bash",
          ptyType = props.type or "user",
          session = props.session,
        })
      else
        -- Clean up vterm on spawn failure
        if state.vterm then state.vterm:free(); state.vterm = nil end
        pushCap(pushEvent, nodeId, "onError", { error = tostring(err) })
      end
      return
    end

    if not state.pty or not state.connected then return end

    -- Read PTY output -> feed into vterm
    local data = state.pty:read()
    if data and #data > 0 then
      -- Push raw bytes for backward compat (onData still fires)
      pushCap(pushEvent, nodeId, "onData", { data = data })

      -- Feed into vterm for structured damage tracking
      if state.vterm then
        state.vterm:feed(data)
      end
    end

    -- Drain damage events from vterm
    if state.vterm then
      local events = state.vterm:drain()

      if events.damaged then
        -- Accumulate dirty rows
        for _, row in ipairs(events.dirtyRows) do
          state._pendingDirty[row] = true
        end
        state.settleAt = now_ms() + SETTLE_MS
        state._lastDamageAt = now_ms()
      end

      -- Cursor movement events (fire immediately, no settle needed)
      if events.cursorMoved then
        local cursor = state.vterm:getCursor()
        if cursor then
          pushCap(pushEvent, nodeId, "onCursorMove", {
            row     = cursor.row,
            col     = cursor.col,
            visible = cursor.visible,
          })
        end
      end
    end

    -- Settle: extract dirty rows once screen is calm
    if state.settleAt and now_ms() >= state.settleAt then
      state.settleAt = nil

      local dirtyList = {}
      for r in pairs(state._pendingDirty) do
        dirtyList[#dirtyList + 1] = r
      end
      table.sort(dirtyList)

      if #dirtyList > 0 and state.vterm then
        local rowData = {}
        for _, r in ipairs(dirtyList) do
          rowData[#rowData + 1] = {
            row  = r,
            text = state.vterm:getRowText(r),
          }
        end
        pushCap(pushEvent, nodeId, "onDirtyRows", { rows = rowData })
        state._pendingDirty = {}
      end
    end

    -- Check for process exit
    if not state.pty:alive() then
      local code = state.pty:exitCode()
      state.connected = false
      state.pty:close()
      state.pty = nil
      pushCap(pushEvent, nodeId, "onExit", { exitCode = code })
    end
  end,

  destroy = function(nodeId, state)
    if state.pty then
      state.pty:kill()
      state.pty:close()
      state.pty = nil
    end
    if state.vterm then
      state.vterm:free()
      state.vterm = nil
    end
    if state.session then _sessionNames[state.session] = nil end
    _sessions[nodeId] = nil
    if _focusedId == nodeId then
      _focusedId = next(_sessions)
    end
  end,
})

-- ── RPC handlers ─────────────────────────────────────────────────────────────

local rpc = {}

-- Write raw bytes to a PTY session (keystrokes, commands, control sequences)
rpc["pty:write"] = function(args)
  local state = resolveSession(args.session or args.id)
  if not state then
    return { error = "No PTY session: " .. tostring(args.session or args.id or "focused") }
  end

  -- Template mode: "command" spawns a fresh ephemeral PTY
  if state.ptyType == "template" and not state.pty and args.command then
    -- Create vterm for the ephemeral session if needed
    if not state.vterm then
      state.vterm = VTerm.new(state.rows, state.cols)
    end
    local pty, err = spawnPTY({ type = "template", shell = "bash", env = args.env }, args.command)
    if pty then
      state.pty       = pty
      state.connected = true
    else
      return { error = "Failed to spawn template PTY: " .. tostring(err) }
    end
  end

  if not state.pty then
    return { error = "PTY not connected" }
  end

  local ok = state.pty:write(args.data or "")
  return { ok = ok }
end

-- Resize the terminal window (sends SIGWINCH to the shell + resizes vterm)
rpc["pty:resize"] = function(args)
  local state = resolveSession(args.session or args.id)
  if not state then return { error = "No PTY session" } end
  local r = args.rows or 24
  local c = args.cols or 80
  if state.vterm then state.vterm:resize(r, c) end
  if state.pty then state.pty:resize(r, c) end
  state.rows = r
  state.cols = c
  state._pendingDirty = {}  -- clear — grid reflows
  return { ok = true }
end

-- Send a signal to the child process
rpc["pty:kill"] = function(args)
  local state = resolveSession(args.session or args.id)
  if not state then return { error = "No PTY session" } end
  if state.pty then state.pty:kill(args.signal) end
  return { ok = true }
end

-- Set the focused session (used when session is omitted in other RPC calls)
rpc["pty:focus"] = function(args)
  if args.session then
    local nid = _sessionNames[args.session]
    if nid and _sessions[nid] then
      _focusedId = nid
      return { ok = true }
    end
    return { error = "Unknown session: " .. args.session }
  end
  if args.id and _sessions[args.id] then
    _focusedId = args.id
    return { ok = true }
  end
  return { error = "Session not found" }
end

-- List all active terminal sessions
rpc["pty:list"] = function()
  local list = {}
  for id, s in pairs(_sessions) do
    list[#list + 1] = {
      id        = id,
      session   = s.session,
      connected = s.connected,
      ptyType   = s.ptyType,
      rows      = s.rows,
      cols      = s.cols,
    }
  end
  return list
end

-- Read the full vterm screen state (for debugging or screen dump)
rpc["pty:screen"] = function(args)
  local state = resolveSession(args and (args.session or args.id))
  if not state or not state.vterm then return { error = "No vterm" } end
  return {
    rows   = state.vterm:getRows(),
    cursor = state.vterm:getCursor(),
  }
end

-- ── Register RPC handlers ────────────────────────────────────────────────────

local Caps     = require("lua.capabilities")
local _origGet = Caps.getHandlers
Caps.getHandlers = function()
  local h = _origGet()
  for method, fn in pairs(rpc) do h[method] = fn end
  return h
end
