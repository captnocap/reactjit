--[[
  reactjit.lua — Hammerspoon client for ReactJIT

  Renders React UIs as macOS desktop overlays using hs.canvas.
  Connects to a WebSocket server and receives JSON draw command frames.

  Usage in ~/.hammerspoon/init.lua:
    local ilr = require("reactjit")
    ilr.start({
      url = "ws://localhost:8080",
      width = 400,
      height = 300,
      x = 100,
      y = 100,
    })
]]

local M = {}

local state = {
  canvas = nil,
  ws = nil,
}

--- Parse a CSS hex color (#RRGGBB) to an hs.drawing.color table.
--- @param hex string CSS hex color string
--- @return table hs.drawing.color-compatible table
local function parseColor(hex)
  if not hex or type(hex) ~= "string" then
    return { white = 0 }
  end
  local r, g, b = hex:match("#(%x%x)(%x%x)(%x%x)")
  if r then
    return {
      red = tonumber(r, 16) / 255,
      green = tonumber(g, 16) / 255,
      blue = tonumber(b, 16) / 255,
      alpha = 1,
    }
  end
  return { white = 0 }
end

--- Render a frame of draw commands to the canvas.
--- @param canvas userdata hs.canvas object
--- @param frame table Array of draw commands
--- @param width number Canvas width
--- @param height number Canvas height
local function render(canvas, frame, width, height)
  -- Remove all existing elements
  while canvas:elementCount() > 0 do
    canvas:removeElement(1)
  end

  -- Base background (black)
  canvas:appendElements({
    type = "rectangle",
    frame = { x = 0, y = 0, w = width, h = height },
    fillColor = { white = 0 },
    action = "fill",
  })

  for _, cmd in ipairs(frame) do
    -- Background fill
    if cmd.bg and not cmd.text then
      canvas:appendElements({
        type = "rectangle",
        frame = { x = cmd.x, y = cmd.y, w = cmd.w, h = cmd.h },
        fillColor = parseColor(cmd.bg),
        action = "fill",
      })
    end

    -- Text
    if cmd.text then
      local bg = cmd.bg and parseColor(cmd.bg) or nil

      -- Draw text background if present
      if bg then
        canvas:appendElements({
          type = "rectangle",
          frame = { x = cmd.x, y = cmd.y, w = cmd.w, h = cmd.h },
          fillColor = bg,
          action = "fill",
        })
      end

      canvas:appendElements({
        type = "text",
        frame = { x = cmd.x, y = cmd.y, w = cmd.w, h = cmd.h },
        text = hs.styledtext.new(cmd.text, {
          color = parseColor(cmd.fg or "#FFFFFF"),
          font = { size = 14 },
        }),
      })
    end
  end
end

--- Start the ReactJIT Hammerspoon client.
--- @param opts table Options: url (string), width (number), height (number), x (number), y (number)
--- @return table Handle with stop() method
function M.start(opts)
  opts = opts or {}
  local url = opts.url or "ws://localhost:8080"
  local width = opts.width or 400
  local height = opts.height or 300
  local x = opts.x or 100
  local y = opts.y or 100

  -- Create canvas
  local canvas = hs.canvas.new({ x = x, y = y, w = width, h = height })
  canvas:level(hs.canvas.windowLevels.floating)
  canvas:show()
  state.canvas = canvas

  -- Connect to WebSocket
  local ws = hs.http.websocket(url, function(msg)
    local ok, frame = pcall(hs.json.decode, msg)
    if ok and type(frame) == "table" then
      render(canvas, frame, width, height)
    end
  end)

  state.ws = ws

  return {
    stop = function()
      M.stop()
    end,
  }
end

--- Stop the client and clean up.
function M.stop()
  if state.ws then
    state.ws:close()
    state.ws = nil
  end
  if state.canvas then
    state.canvas:delete()
    state.canvas = nil
  end
end

return M
