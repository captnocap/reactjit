--[[
  reactjit.lua — AwesomeWM widget for ReactJIT

  Renders React UIs as AwesomeWM widgets using Cairo.
  Spawns a Node.js process and reads newline-delimited JSON draw commands
  from stdout. Renders to a Cairo surface and updates a wibox.widget.imagebox.

  Usage in rc.lua:
    local ilr = require("reactjit")
    local widget = ilr.widget({
      entry = "path/to/dist/main.js",
      width = 400,
      height = 30,
    })
    -- Add widget to your wibar
]]

local awful = require("awful")
local wibox = require("wibox")
local lgi = require("lgi")
local cairo = lgi.cairo
local Pango = lgi.Pango
local PangoCairo = lgi.PangoCairo

-- JSON decoder: try to load dkjson from the same directory
local json_decode
do
  local ok, dkjson = pcall(require, "dkjson")
  if ok then
    json_decode = dkjson.decode
  else
    -- Fallback: try cjson
    ok, cjson = pcall(require, "cjson")
    if ok then
      json_decode = cjson.decode
    else
      -- Minimal fallback using awesome's built-in
      json_decode = function(str)
        -- awesome 4.3+ may have json via gears
        local gears_ok, gears = pcall(require, "gears.json")
        if gears_ok then
          return gears.decode(str)
        end
        return nil, "No JSON decoder available"
      end
    end
  end
end

local M = {}

--- Parse a CSS hex color (#RRGGBB) to Cairo RGBA values.
--- @param hex string CSS hex color string
--- @return number, number, number, number r, g, b, a (0-1 range)
local function parseColor(hex)
  if not hex or type(hex) ~= "string" then
    return 0, 0, 0, 1
  end
  local r, g, b = hex:match("#(%x%x)(%x%x)(%x%x)")
  if r then
    return tonumber(r, 16) / 255, tonumber(g, 16) / 255, tonumber(b, 16) / 255, 1
  end
  return 0, 0, 0, 1
end

--- Create an ReactJIT widget for AwesomeWM.
--- @param opts table Options: entry (string), width (number), height (number), font_size (number)
--- @return table wibox.widget.imagebox
function M.widget(opts)
  opts = opts or {}
  local entry = opts.entry or "dist/main.js"
  local width = opts.width or 400
  local height = opts.height or 30
  local font_size = opts.font_size or 14

  local img = cairo.ImageSurface(cairo.Format.ARGB32, width, height)
  local widget = wibox.widget.imagebox()

  local function render(frame)
    local cr = cairo.Context(img)

    -- Clear
    cr:set_operator(cairo.Operator.CLEAR)
    cr:paint()
    cr:set_operator(cairo.Operator.OVER)

    for _, cmd in ipairs(frame) do
      -- Background fill
      if cmd.bg and not cmd.text then
        cr:set_source_rgba(parseColor(cmd.bg))
        cr:rectangle(cmd.x, cmd.y, cmd.w, cmd.h)
        cr:fill()
      end

      -- Text with background
      if cmd.text then
        if cmd.bg then
          cr:set_source_rgba(parseColor(cmd.bg))
          cr:rectangle(cmd.x, cmd.y, cmd.w, cmd.h)
          cr:fill()
        end

        cr:set_source_rgba(parseColor(cmd.fg or "#FFFFFF"))

        local layout = PangoCairo.create_layout(cr)
        layout:set_text(cmd.text, -1)
        local font_desc = Pango.FontDescription.from_string("monospace " .. font_size)
        layout:set_font_description(font_desc)

        cr:move_to(cmd.x, cmd.y)
        PangoCairo.show_layout(cr, layout)
      end
    end

    widget:set_image(img)
  end

  -- Accumulate partial lines
  local partial = ""

  awful.spawn.with_line_callback("node " .. entry, {
    stdout = function(line)
      if line and line ~= "" then
        local ok, frame = pcall(json_decode, line)
        if ok and type(frame) == "table" then
          render(frame)
        end
      end
    end,
    stderr = function(line)
      if line and line ~= "" then
        require("naughty").notify({
          title = "ReactJIT",
          text = line,
          preset = require("naughty").config.presets.warning,
        })
      end
    end,
  })

  return widget
end

return M
