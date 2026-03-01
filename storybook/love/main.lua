--[[
  Storybook runner for desktop Love2D.

  Runs in native mode: QuickJS loads the bundled storybook React app,
  the reconciler sends mutation commands, and Lua renders via
  tree → layout → painter.
]]

-- Add the monorepo root to the require path so lua.* modules resolve.
-- From storybook/love/, two levels up is the repo root where lua/ lives.
-- A symlink at storybook/love/lua → ../../lua also exists as a fallback
-- for Love2D's own filesystem searcher.
package.path = package.path .. ";../../?.lua;../../?/init.lua"

local ReactJIT = require("lua.init")

-- Custom BSOD: replaces Love2D's blue error screen (last resort fallback)
love.errorhandler = require("lua.bsod")

function love.load()
  print("[main.lua] love.load START")
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)

  local ok, err = pcall(function()
    ReactJIT.init({
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

-- update/draw already have internal pcall wrapping — call directly
function love.update(dt)
  ReactJIT.update(dt)
end

function love.draw()
  ReactJIT.draw()
end

-- All input callbacks go through safeCall: pcall + event trail recording.
-- If any callback errors, we enter crash recovery mode instead of the blue screen.
function love.mousepressed(x, y, button)
  ReactJIT.safeCall("mousepressed", x, y, button)
end

function love.mousereleased(x, y, button)
  ReactJIT.safeCall("mousereleased", x, y, button)
end

function love.mousemoved(x, y, dx, dy)
  ReactJIT.safeCall("mousemoved", x, y)
end

function love.wheelmoved(x, y)
  ReactJIT.safeCall("wheelmoved", x, y)
end

function love.resize(w, h)
  ReactJIT.safeCall("resize", w, h)
end

function love.focus(hasFocus)
  ReactJIT.safeCall("focus", hasFocus)
end

function love.keypressed(key, scancode, isrepeat)
  ReactJIT.safeCall("keypressed", key, scancode, isrepeat)
end

function love.keyreleased(key, scancode)
  ReactJIT.safeCall("keyreleased", key, scancode)
end

function love.textinput(text)
  ReactJIT.safeCall("textinput", text)
end

function love.filedropped(file)
  ReactJIT.safeCall("filedropped", file)
end

function love.directorydropped(dir)
  ReactJIT.safeCall("directorydropped", dir)
end

-- quit must return a value — keep as direct call
function love.quit()
  ReactJIT.quit()
end

-- ReactJIT: register handler for secondary window close events.
-- Love2D dispatches custom messages via love.handlers[messageName].
love.handlers.windowclose = function(sdlWindowId)
  ReactJIT.windowclose(sdlWindowId)
end
