--[[
  ReactJIT Web Landing Page — main.lua

  Entry point for Love2D running inside the browser via Emscripten.
  Uses Module.FS bridge (bridge_fs.lua) for Lua <-> JS communication.
  Dev overlays disabled — this is a public-facing page.
]]

local ReactJIT = require("lua.init")

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
  ReactJIT.init({
    mode = "wasm",
    namespace = "default",
    screenshot = false,  -- F2
    themeMenu = false,   -- F9
    settings = false,    -- F10
    systemPanel = false, -- F11
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
