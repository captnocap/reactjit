local ReactJIT = require("lua.init")

-- Load terminal capability explicitly.
-- If "terminal" is already in capabilities.lua loadAll(), this is a no-op.
-- For development (before `reactjit update`), this allows direct loading.
local ok, err = pcall(require, "lua.capabilities.terminal")
if not ok then
  io.write("[terminal] WARNING: Could not load terminal capability: " .. tostring(err) .. "\n")
  io.write("[terminal] Run: make cli-setup && reactjit update\n")
  io.flush()
end

function love.load()
  love.graphics.setBackgroundColor(0.05, 0.05, 0.07)
  ReactJIT.init({
    mode       = "native",
    bundlePath = "love/bundle.js",
    libpath    = "lib/libquickjs",
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
  ReactJIT.keypressed(key, scancode, isrepeat)
end

function love.keyreleased(key, scancode)
  ReactJIT.keyreleased(key, scancode)
end

function love.textinput(text)
  ReactJIT.textinput(text)
end
