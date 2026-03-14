--[[
  ReactJIT Storybook — packaged main.lua

  Self-contained entry point for the fused storybook binary.
  lua/ modules live inside the .love zip, libquickjs.so lives
  in lib/ alongside the binary.
]]

local ReactJIT = require("lua.init")

-- Resolve lib/ path from the real filesystem (next to game.love, not inside it).
local function resolveLibPath()
  if arg and arg[1] then
    local dir = arg[1]:match("(.+)/[^/]+$")
    if dir then return dir .. "/lib/libquickjs" end
  end
  return "lib/libquickjs"
end

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
  ReactJIT.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = resolveLibPath(),
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

function love.filedropped(file)
  ReactJIT.filedropped(file)
end

function love.directorydropped(dir)
  ReactJIT.directorydropped(dir)
end

function love.quit()
  ReactJIT.quit()
end
