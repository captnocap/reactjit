--[[
  capabilities/notification.lua — Native OS notification via subprocess

  Two modes, automatic:
  - No children → lightweight text-only subprocess (title + body, ~200 lines of Lua, instant)
  - Has children → full ReactJIT window with notification semantics (borderless, always-on-top,
    auto-dismiss, no-focus, stacking — renders your full React tree)

  React usage:
    -- Text-only (fast path):
    <Notification title="Build Complete" body="All tests passed" />
    <Notification title="Error" body="Connection lost" duration={8} accent="#f38ba8" />

    -- Rich content (full React tree):
    <Notification position="top-right" duration={8}>
      <Box style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
        <Image src="avatar.png" style={{ width: 32, height: 32, borderRadius: 16 }} />
        <Text style={{ fontWeight: 'bold' }}>New message from Alice</Text>
      </Box>
    </Notification>

  Props:
    title      string   Notification title (bold)
    body       string   Body text
    duration   number   Seconds before auto-dismiss (default 5)
    position   string   "top-right" | "top-left" | "bottom-right" | "bottom-left"
    accent     string   Hex color for accent stripe (default "4C9EFF")
    display    number   Monitor index (1-based). Default: same as parent window.
    x          number   Exact X position (overrides position-based placement)
    y          number   Exact Y position (overrides position-based placement)
    width      number   Notification width (default 380)
    height     number   Notification height (default 100)

  Events:
    onDismiss  {}       Fires when the notification disappears (timeout or click)
]]

local Capabilities = require("lua.capabilities")
local IPC = require("lua.window_ipc")
local processRegistry = require("lua.process_registry")

-- Active notifications for stacking: array of { id, position, display, y, expireAt }
local active = {}
local nextId = 1

-- Default notification window dimensions
local DEFAULT_W = 380
local DEFAULT_H = 100
local GAP = 12

-- Resolve directory paths
local notifWindowPath, childWindowPath
do
  local info = debug.getinfo(1, "S")
  local thisFile = info and info.source and info.source:gsub("^@", "") or ""
  local luaDir = thisFile:match("(.*/lua)/") or thisFile:match("(.*\\lua)\\")
  if luaDir then
    notifWindowPath = luaDir .. "/notification_window"
    childWindowPath = luaDir .. "/child_window"
  else
    notifWindowPath = "lua/notification_window"
    childWindowPath = "lua/child_window"
  end
end

-- Rich mode children: notifId → { server, conn, port, nodeId, initSent, pid }
local richChildren = {}

--- Get the display index the parent window is currently on.
local function getParentDisplay()
  local ok, x, y, d = pcall(love.window.getPosition)
  if ok and d and d > 0 then return d end
  return 1
end

--- Get the bounds of a display via SDL2 FFI.
local _sdlBoundsReady = false
local _SDL_GetDisplayBounds

local function getDisplayBounds(displayIndex)
  if not _sdlBoundsReady then
    _sdlBoundsReady = true
    pcall(function()
      local ffi = require("ffi")
      pcall(ffi.cdef, [[
        typedef struct { int x, y, w, h; } SDL_Rect;
        int SDL_GetDisplayBounds(int displayIndex, SDL_Rect* rect);
      ]])
      _SDL_GetDisplayBounds = ffi.C.SDL_GetDisplayBounds
    end)
  end

  if _SDL_GetDisplayBounds then
    local ffi = require("ffi")
    local rect = ffi.new("SDL_Rect[1]")
    local ret = _SDL_GetDisplayBounds(displayIndex - 1, rect)
    if ret == 0 then
      return rect[0].x, rect[0].y, rect[0].w, rect[0].h
    end
  end

  local w, h = love.window.getDesktopDimensions(displayIndex)
  return 0, 0, w, h
end

--- Compute the notification position on a specific display.
--- Returns display-relative coordinates.
local function computePosition(position, displayIndex, stackIndex, notifW, notifH)
  local _, _, dw, dh = getDisplayBounds(displayIndex)

  local x, y
  if position == "top-left" or position == "bottom-left" then
    x = GAP
  else
    x = dw - notifW - GAP
  end

  if position == "bottom-right" or position == "bottom-left" then
    y = dh - notifH - GAP - stackIndex * (notifH + GAP)
  else
    y = GAP + stackIndex * (notifH + GAP)
  end

  return x, y
end

--- Count how many active notifications share the same position + display.
local function countAtPosition(position, displayIndex)
  local count = 0
  for _, n in ipairs(active) do
    if n.position == position and n.display == displayIndex then
      count = count + 1
    end
  end
  return count
end

--- Remove a notification from the active list by id.
local function removeActive(id)
  for i, n in ipairs(active) do
    if n.id == id then
      table.remove(active, i)
      return
    end
  end
end

--- Capture the currently focused X11 window (for refocus after spawn).
local function captureActiveWindow()
  local h = io.popen("xdotool getactivewindow 2>/dev/null")
  if not h then return "" end
  local id = h:read("*l") or ""
  h:close()
  return id
end

-- ============================================================================
-- Text-only mode: lightweight subprocess
-- ============================================================================

local function spawnTextOnly(title, body, duration, x, y, accent, displayIndex, refocusWin, notifW, notifH)
  local envParts = {
    string.format('REACTJIT_NOTIF_TITLE=%q', title or "Notification"),
    string.format('REACTJIT_NOTIF_BODY=%q', body or ""),
    string.format('REACTJIT_NOTIF_DURATION=%s', tostring(duration or 5)),
    string.format('REACTJIT_NOTIF_WIDTH=%d', notifW),
    string.format('REACTJIT_NOTIF_HEIGHT=%d', notifH),
    string.format('REACTJIT_NOTIF_X=%d', x),
    string.format('REACTJIT_NOTIF_Y=%d', y),
    string.format('REACTJIT_NOTIF_DISPLAY=%d', displayIndex or 1),
  }
  if accent then
    envParts[#envParts + 1] = string.format('REACTJIT_NOTIF_ACCENT=%s', accent)
  end
  if refocusWin and refocusWin ~= "" then
    envParts[#envParts + 1] = string.format('REACTJIT_NOTIF_REFOCUS=%s', refocusWin)
  end
  local baseCmd = table.concat(envParts, ' ') .. ' love ' .. notifWindowPath
  io.write("[notification] spawning text-only: " .. baseCmd .. "\n"); io.flush()
  local pidHandle = io.popen(baseCmd .. " & echo $!")
  if pidHandle then
    local pid = pidHandle:read("*l")
    pidHandle:close()
    if pid and pid:match("%d+") then
      processRegistry.register(pid)
      return pid
    end
  end
end

-- ============================================================================
-- Rich mode: full React tree via child_window IPC
-- ============================================================================

local function spawnRichChild(notifW, notifH, ipcPort, opts)
  opts = opts or {}
  local envParts = {
    string.format('REACTJIT_WINDOW_TITLE=%q', "Notification"),
    string.format('REACTJIT_WINDOW_WIDTH=%d', notifW),
    string.format('REACTJIT_WINDOW_HEIGHT=%d', notifH),
    string.format('REACTJIT_IPC_PORT=%d', ipcPort),
    'REACTJIT_WINDOW_BORDERLESS=1',
    'REACTJIT_WINDOW_ALWAYS_ON_TOP=1',
    'REACTJIT_WINDOW_NOTIFICATION=1',
  }
  if opts.duration then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_NOTIF_DURATION=%s', tostring(opts.duration))
  end
  if opts.accent then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_NOTIF_ACCENT=%s', opts.accent)
  end
  if opts.x then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_X=%d', opts.x)
  end
  if opts.y then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_Y=%d', opts.y)
  end
  if opts.display then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_DISPLAY=%d', opts.display)
  end
  if opts.refocusWin and opts.refocusWin ~= "" then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_NOTIF_REFOCUS=%s', opts.refocusWin)
  end
  local baseCmd = table.concat(envParts, ' ') .. ' love ' .. childWindowPath
  io.write("[notification] spawning rich: " .. baseCmd .. "\n"); io.flush()
  local pidHandle = io.popen(baseCmd .. " & echo $!")
  if pidHandle then
    local pid = pidHandle:read("*l")
    pidHandle:close()
    if pid and pid:match("%d+") then
      processRegistry.register(pid)
      return pid
    end
  end
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("Notification", {
  visual = false,
  rendersInOwnSurface = true,

  schema = {
    title    = { type = "string", default = "Notification", desc = "Notification title" },
    body     = { type = "string", default = "",             desc = "Body text" },
    duration = { type = "number", default = 5,              desc = "Seconds before auto-dismiss" },
    position = { type = "string", default = "top-right",    desc = "Screen position: top-right, top-left, bottom-right, bottom-left" },
    accent   = { type = "string", default = "4C9EFF",       desc = "Accent color hex" },
    display  = { type = "number", default = 0,              desc = "Monitor index (1-based). 0 = same as parent window." },
    x        = { type = "number", default = -1,             desc = "Exact X position (-1 = auto from position)" },
    y        = { type = "number", default = -1,             desc = "Exact Y position (-1 = auto from position)" },
    width    = { type = "number", default = 380,            desc = "Notification window width" },
    height   = { type = "number", default = 100,            desc = "Notification window height" },
  },

  events = { "onDismiss" },

  create = function(nodeId, props)
    local position = props.position or "top-right"
    local dur      = props.duration or 5
    local richMode = props._richMode == true
    local notifW   = props.width  or DEFAULT_W
    local notifH   = props.height or DEFAULT_H

    -- Resolve display
    local displayIndex = props.display
    if not displayIndex or displayIndex <= 0 then
      displayIndex = getParentDisplay()
    end
    local displayCount = love.window.getDisplayCount()
    if displayIndex > displayCount then displayIndex = 1 end

    -- Resolve position
    local x, y
    if props.x and props.x >= 0 and props.y and props.y >= 0 then
      x, y = props.x, props.y
    else
      local stackIndex = countAtPosition(position, displayIndex)
      x, y = computePosition(position, displayIndex, stackIndex, notifW, notifH)
    end

    local id = nextId
    nextId = nextId + 1

    -- Track in active list
    active[#active + 1] = {
      id       = id,
      position = position,
      display  = displayIndex,
      y        = y,
      expireAt = love.timer.getTime() + dur,
    }

    -- Capture active window BEFORE spawning
    local refocusWin = captureActiveWindow()

    if richMode then
      -- Rich mode: IPC-based child window with notification semantics
      local server, port = IPC.createServer()
      if not server then
        io.write("[notification] rich mode: failed to create IPC server\n"); io.flush()
        return { notifId = id, duration = dur, elapsed = 0, richMode = false }
      end

      local pid = spawnRichChild(notifW, notifH, port, {
        duration   = dur,
        accent     = props.accent,
        x          = x,
        y          = y,
        display    = displayIndex,
        refocusWin = refocusWin,
      })

      richChildren[id] = {
        server   = server,
        conn     = nil,
        port     = port,
        nodeId   = nodeId,
        initSent = false,
        pid      = pid,
      }

      io.write(string.format("[notification] #%d rich mode on display=%d at (%d,%d)\n", id, displayIndex, x, y)); io.flush()
      return { notifId = id, duration = dur, elapsed = 0, richMode = true }
    else
      -- Text-only mode: lightweight subprocess
      spawnTextOnly(props.title, props.body, dur, x, y, props.accent, displayIndex, refocusWin, notifW, notifH)
      io.write(string.format("[notification] #%d text-only on display=%d at (%d,%d)\n", id, displayIndex, x, y)); io.flush()
      return { notifId = id, duration = dur, elapsed = 0, richMode = false }
    end
  end,

  update = function(nodeId, props, prev, state)
    -- Notifications are fire-and-forget; no updates
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.notifId then return end

    -- Rich mode: handle IPC
    if state.richMode then
      local child = richChildren[state.notifId]
      if child then
        -- Accept pending connection
        if not child.conn then
          child.conn = IPC.accept(child.server)
        end

        -- Send initial subtree once connected
        if child.conn and not child.initSent then
          local tree = package.loaded["lua.tree"]
          if tree then
            local nodes = tree.getNodes()
            local windowNode = nodes and nodes[nodeId]
            if windowNode and windowNode.children and #windowNode.children > 0 then
              local commands = IPC.serializeSubtree(windowNode)
              IPC.send(child.conn, { type = "init", commands = commands })
              child.initSent = true
              io.write("[notification] rich #" .. state.notifId .. " sent init (" .. #commands .. " commands)\n"); io.flush()
            end
          end
        end

        -- Poll for events from child
        if child.conn then
          local msgs, dead = IPC.poll(child.conn)
          if dead then
            -- Child disconnected (closed itself after duration)
            removeActive(state.notifId)
            pushEvent({
              type = "capability",
              payload = { targetId = nodeId, handler = "onDismiss", data = {} },
            })
            state.notifId = nil
            return
          end
          for _, msg in ipairs(msgs) do
            if msg.type == "event" and msg.payload then
              pushEvent({ type = msg.payload.type, payload = msg.payload })
            elseif msg.type == "windowEvent" and msg.handler then
              if msg.handler == "onClose" then
                -- Notification dismissed by click
                pushEvent({
                  type = "capability",
                  payload = { targetId = nodeId, handler = "onDismiss", data = {} },
                })
              end
            end
          end
        end
      end
    end

    -- Auto-dismiss timer (both modes)
    state.elapsed = (state.elapsed or 0) + dt
    if state.elapsed >= state.duration then
      removeActive(state.notifId)
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onDismiss", data = {} },
      })
      state.notifId = nil
    end
  end,

  destroy = function(nodeId, state)
    if not state.notifId then return end

    -- Clean up rich mode IPC
    if state.richMode then
      local child = richChildren[state.notifId]
      if child then
        if child.conn then
          IPC.send(child.conn, { type = "quit" })
          IPC.cleanup(child.conn)
        end
        if child.server then
          pcall(function() child.server:close() end)
        end
        if child.pid then
          processRegistry.unregister(child.pid)
        end
        richChildren[state.notifId] = nil
      end
    end

    removeActive(state.notifId)
  end,
})
