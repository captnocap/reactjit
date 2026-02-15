--[[
  Storybook runner for desktop Love2D.

  Runs in native mode: QuickJS loads the bundled storybook React app,
  the reconciler sends mutation commands, and Lua renders via
  tree → layout → painter.
]]

-- Add the project root to the require path so lua.* modules resolve
package.path = package.path .. ";../../../?.lua;../../../?/init.lua"

local ReactLove = require("lua.init")

function love.load()
  print("[main.lua] love.load START")
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)

  local ok, err = pcall(function()
    ReactLove.init({
      mode = "native",
      bundlePath = "bundle.js",
      libpath = "lib/libquickjs",
      tor = {
        autoStart = true,
        hsPort = 8080,
      },
    })
  end)
  if ok then
    print("[main.lua] love.load END - init completed")
  else
    print("[main.lua] love.load FAILED: " .. tostring(err))
  end
end

local _frameCount = 0
function love.update(dt)
  _frameCount = _frameCount + 1
  if _frameCount <= 3 then
    print("[main.lua] love.update frame=" .. _frameCount)
  end
  ReactLove.update(dt)
end

function love.draw()
  ReactLove.draw()
end

function love.mousepressed(x, y, button)
  ReactLove.mousepressed(x, y, button)
end

function love.mousereleased(x, y, button)
  ReactLove.mousereleased(x, y, button)
end

function love.mousemoved(x, y, dx, dy)
  ReactLove.mousemoved(x, y)
end

function love.wheelmoved(x, y)
  ReactLove.wheelmoved(x, y)
end

function love.resize(w, h)
  ReactLove.resize(w, h)
end

function love.keypressed(key, scancode, isrepeat)
  if key == "escape" then love.event.quit() end
  ReactLove.keypressed(key, scancode, isrepeat)
end

function love.keyreleased(key, scancode)
  ReactLove.keyreleased(key, scancode)
end

function love.textinput(text)
  ReactLove.textinput(text)
end

function love.filedropped(file)
  ReactLove.filedropped(file)
end

function love.directorydropped(dir)
  ReactLove.directorydropped(dir)
end

function love.quit()
  ReactLove.quit()
end
