--[[
  capabilities/notification.lua — Native OS notification via subprocess

  React usage:
    <Notification title="Build Complete" body="All tests passed" />
    <Notification title="Error" body="Connection lost" duration={8} position="bottom-right" />

  Spawns a small borderless Love2D window positioned at the screen edge.
  The window renders autonomously and exits after the duration. No IPC needed.

  Props:
    title      string   Notification title (bold)
    body       string   Body text
    duration   number   Seconds before auto-dismiss (default 5)
    position   string   "top-right" | "top-left" | "bottom-right" | "bottom-left" (default "top-right")
    accent     string   Hex color for accent stripe (default "4C9EFF")

  Events:
    onDismiss  {}       Fires when the notification disappears (timeout or click)
]]

local Capabilities = require("lua.capabilities")

-- Active notifications for stacking: array of { id, position, y, expireAt }
local active = {}
local nextId = 1

-- Notification window dimensions
local NOTIF_W = 380
local NOTIF_H = 100
local GAP = 12

-- Resolve the notification_window directory path
local notifWindowPath
do
  local info = debug.getinfo(1, "S")
  local thisFile = info and info.source and info.source:gsub("^@", "") or ""
  local luaDir = thisFile:match("(.*/lua)/") or thisFile:match("(.*\\lua)\\")
  if luaDir then
    notifWindowPath = luaDir .. "/notification_window"
  else
    notifWindowPath = "lua/notification_window"
  end
end

--- Compute the Y position for a new notification, stacking with existing ones.
local function computeStackY(position, screenH, stackIndex)
  if position == "bottom-right" or position == "bottom-left" then
    return screenH - NOTIF_H - GAP - stackIndex * (NOTIF_H + GAP)
  else
    -- top-right, top-left (default)
    return GAP + stackIndex * (NOTIF_H + GAP)
  end
end

--- Count how many active notifications share the same position.
local function countAtPosition(position)
  local count = 0
  for _, n in ipairs(active) do
    if n.position == position then
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

--- Spawn the notification subprocess.
local function spawnNotification(title, body, duration, x, y, accent)
  local envParts = {
    string.format('REACTJIT_NOTIF_TITLE=%q', title or "Notification"),
    string.format('REACTJIT_NOTIF_BODY=%q', body or ""),
    string.format('REACTJIT_NOTIF_DURATION=%s', tostring(duration or 5)),
    string.format('REACTJIT_NOTIF_WIDTH=%d', NOTIF_W),
    string.format('REACTJIT_NOTIF_HEIGHT=%d', NOTIF_H),
    string.format('REACTJIT_NOTIF_X=%d', x),
    string.format('REACTJIT_NOTIF_Y=%d', y),
  }
  if accent then
    envParts[#envParts + 1] = string.format('REACTJIT_NOTIF_ACCENT=%s', accent)
  end
  local cmd = table.concat(envParts, ' ') .. ' love ' .. notifWindowPath .. ' &'
  io.write("[notification] spawning: " .. cmd .. "\n"); io.flush()
  os.execute(cmd)
end

Capabilities.register("Notification", {
  visual = false,

  schema = {
    title    = { type = "string", default = "Notification", desc = "Notification title" },
    body     = { type = "string", default = "",             desc = "Body text" },
    duration = { type = "number", default = 5,              desc = "Seconds before auto-dismiss" },
    position = { type = "string", default = "top-right",    desc = "Screen position: top-right, top-left, bottom-right, bottom-left" },
    accent   = { type = "string", default = "4C9EFF",       desc = "Accent color hex" },
  },

  events = { "onDismiss" },

  create = function(nodeId, props)
    local position = props.position or "top-right"
    local dur      = props.duration or 5

    -- Get screen dimensions from parent
    local screenW, screenH = love.window.getDesktopDimensions()

    -- Compute position
    local stackIndex = countAtPosition(position)
    local y = computeStackY(position, screenH, stackIndex)
    local x
    if position == "top-left" or position == "bottom-left" then
      x = GAP
    else
      x = screenW - NOTIF_W - GAP
    end

    local id = nextId
    nextId = nextId + 1

    -- Track in active list
    active[#active + 1] = {
      id       = id,
      position = position,
      y        = y,
      expireAt = love.timer.getTime() + dur,
    }

    -- Spawn the subprocess
    spawnNotification(props.title, props.body, dur, x, y, props.accent)

    io.write(string.format("[notification] #%d created at (%d, %d) duration=%ds\n", id, x, y, dur))
    io.flush()

    return { notifId = id, duration = dur, elapsed = 0 }
  end,

  update = function(nodeId, props, prev, state)
    -- Notifications are fire-and-forget; no updates
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.notifId then return end
    state.elapsed = (state.elapsed or 0) + dt
    if state.elapsed >= state.duration then
      -- Notification has expired — fire onDismiss
      removeActive(state.notifId)
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler  = "onDismiss",
          data     = {},
        },
      })
      state.notifId = nil -- stop ticking
    end
  end,

  destroy = function(nodeId, state)
    if state.notifId then
      removeActive(state.notifId)
      io.write("[notification] #" .. state.notifId .. " destroyed\n"); io.flush()
    end
  end,
})
