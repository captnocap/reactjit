--[[
  event_trail.lua — Ring buffer of recent semantic events for crash diagnostics.

  Records meaningful user actions (clicks, keypresses, focus changes, etc.)
  with component context. Noisy low-level events (mousemoved, mousedragged)
  are never recorded — they add no diagnostic value.

  Semantic recording:
    trail.recordSemantic("Clicked Pressable 'Save' (App > Toolbar > Pressable)")
    trail.recordSemantic("keypressed: ctrl+s")
    trail.recordSemantic("Focused TextInput (placeholder='Search...')")

  Raw recording (for events not yet enriched):
    trail.record("keypressed", "f12")   -- falls back to raw format if no semantic

  On crash:
    trail.freeze()
    local text = trail.format()
]]

local Trail = {}

local MAX_EVENTS = 60
local buffer = {}
local frozen = false
local startTime = nil

local function now()
  if not startTime then startTime = love.timer.getTime() end
  return love.timer.getTime() - startTime
end

-- Events we never want to see in a crash report
local MUTED = {
  mousemoved   = true,
  mousedragged = true,
}

--- Build a short ancestry label from a node, e.g. "App > Sidebar > Pressable"
--- Walks up .parent chain, collects debugName or type, max 4 levels.
local function ancestorLabel(node)
  local parts = {}
  local n = node
  local depth = 0
  while n and depth < 5 do
    local label = n.debugName or n.type or "?"
    if label ~= "__TEXT__" then
      table.insert(parts, 1, label)
    end
    n = n.parent
    depth = depth + 1
  end
  if #parts == 0 then return tostring(node.type or "?") end
  return table.concat(parts, " > ")
end

--- Extract display text from a node — checks direct .text, then walks children
--- for __TEXT__ nodes, concatenates up to ~40 chars.
local function nodeText(node)
  if node.text and node.text ~= "" then
    return node.text
  end
  if node.children then
    local parts = {}
    for _, child in ipairs(node.children) do
      if child.type == "__TEXT__" and child.text then
        parts[#parts + 1] = child.text
      end
    end
    if #parts > 0 then
      local s = table.concat(parts, "")
      if #s > 40 then s = s:sub(1, 40) .. "…" end
      return s
    end
  end
  return nil
end

--- Push an entry into the ring buffer.
local function push(label)
  if frozen then return end
  if #buffer >= MAX_EVENTS then
    table.remove(buffer, 1)
  end
  buffer[#buffer + 1] = { label = label, time = now() }
end

--- Record a raw Love2D event. Muted events are silently dropped.
--- For enriched click/key events, prefer recordSemantic or recordClick.
--- @param eventType string
--- @param argsStr string|nil
function Trail.record(eventType, argsStr)
  if MUTED[eventType] then return end
  local label = eventType
  if argsStr and argsStr ~= "" then
    label = eventType .. ": " .. argsStr
  end
  push(label)
end

--- Record a fully-formed semantic label directly.
--- Use this from init.lua after hit-testing resolves the target node.
--- @param label string  Human-readable description, e.g. "Clicked Pressable 'Save'"
function Trail.recordSemantic(label)
  push(label)
end

--- Record a click event with full node context.
--- Call this from mousepressed after hitTest resolves.
--- @param node table        The hit node from hitTest
--- @param button number     1=left, 2=right, 3=middle
function Trail.recordClick(node, button)
  if not node then
    push("Clicked: nothing (missed React tree)")
    return
  end
  local btn = button == 2 and "Right-clicked" or button == 3 and "Middle-clicked" or "Clicked"
  local typ = node.type or "?"
  local text = nodeText(node)
  local testId = node.props and node.props.testId
  local label
  if testId then
    label = btn .. " " .. typ .. " [testId='" .. testId .. "']"
  elseif text then
    label = btn .. " " .. typ .. " '" .. text .. "'"
  else
    label = btn .. " " .. typ
  end
  label = label .. "  (" .. ancestorLabel(node) .. ")"
  push(label)
end

--- Record a keypressed event in readable form.
--- @param key string       Love2D key name
--- @param mods table|nil   { ctrl, shift, alt } booleans
function Trail.recordKey(key, mods)
  local parts = {}
  if mods then
    if mods.ctrl  then parts[#parts+1] = "ctrl"  end
    if mods.shift then parts[#parts+1] = "shift" end
    if mods.alt   then parts[#parts+1] = "alt"   end
  end
  parts[#parts+1] = key
  push("keypressed: " .. table.concat(parts, "+"))
end

--- Freeze the trail — no new events will be recorded.
--- Call this when a crash occurs so the trail stays intact.
function Trail.freeze()
  frozen = true
end

--- Unfreeze the trail (e.g. after recovery/reload).
function Trail.unfreeze()
  frozen = false
end

--- Clear the trail and unfreeze.
function Trail.clear()
  buffer = {}
  frozen = false
end

--- Get the raw trail buffer (array of {label, time}).
function Trail.getTrail()
  return buffer
end

--- Format the trail as a human-readable string for the crash report.
--- Shows most recent events first.
--- @param limit number|nil  Max events to show (default 20)
function Trail.format(limit)
  limit = limit or 20
  local lines = {}
  local start = math.max(1, #buffer - limit + 1)

  lines[#lines + 1] = "EVENT TRAIL (" .. #buffer .. " events, last " .. math.min(limit, #buffer) .. " shown)"
  lines[#lines + 1] = string.rep("-", 60)

  for i = #buffer, start, -1 do
    local e = buffer[i]
    local timeStr = string.format("%8.3fs", e.time)
    lines[#lines + 1] = timeStr .. "  " .. e.label
  end

  return table.concat(lines, "\n")
end

return Trail
