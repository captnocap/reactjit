local ReactJIT = require("lua.init")

-- ── Keystroke module ─────────────────────────────────────────
-- Lua owns all input. React is just a view.

local buffer   = ""          -- live typing buffer
local resolved = {}          -- list of submitted strings

local function pushState()
  local bridge = ReactJIT.getBridge()
  if not bridge then return end
  bridge:pushEvent({
    type = "keystroke",
    payload = {
      buffer   = buffer,
      resolved = resolved,
    }
  })
end

-- RPC so React can read initial state on mount
ReactJIT.rpc("keystroke:state", function()
  return { buffer = buffer, resolved = resolved }
end)

-- ── Love2D lifecycle ─────────────────────────────────────────

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
  love.keyboard.setKeyRepeat(true)
  ReactJIT.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = "lib/libquickjs",
  })
end

function love.update(dt)
  ReactJIT.update(dt)
end

function love.draw()
  ReactJIT.draw()
end

function love.mousepressed(x, y, button)
  ReactJIT.mousepressed(x, y, button)
end

function love.mousereleased(x, y, button)
  ReactJIT.mousereleased(x, y, button)
end

function love.mousemoved(x, y, dx, dy)
  ReactJIT.mousemoved(x, y)
end

function love.wheelmoved(x, y)
  ReactJIT.wheelmoved(x, y)
end

function love.resize(w, h)
  ReactJIT.resize(w, h)
end

function love.keypressed(key, scancode, isrepeat)
  -- Lua owns the input logic
  if key == "return" then
    if #buffer > 0 then
      table.insert(resolved, buffer)
      buffer = ""
      pushState()
    end
    return  -- don't forward enter to ReactJIT
  elseif key == "backspace" then
    if #buffer > 0 then
      buffer = buffer:sub(1, -2)
      pushState()
    end
    return  -- don't forward backspace to ReactJIT
  end

  -- everything else still goes to ReactJIT for inspector/devtools
  ReactJIT.keypressed(key, scancode, isrepeat)
end

function love.keyreleased(key, scancode)
  ReactJIT.keyreleased(key, scancode)
end

function love.textinput(text)
  -- Lua captures the character, appends to buffer
  buffer = buffer .. text
  pushState()
  -- don't forward to ReactJIT — we own this
end

function love.filedropped(file)
  ReactJIT.filedropped(file)
end

function love.directorydropped(dir)
  ReactJIT.directorydropped(dir)
end

function love.quit()
  ReactJIT.quit()
end
