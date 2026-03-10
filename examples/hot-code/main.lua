local ReactJIT = require("lua.init")
local Capabilities = require("lua.capabilities")

-- Load ClaudeCanvas capability
require("lua.claude_canvas")

-- Custom RPC: read a file and return its contents + metadata
local origGetHandlers = Capabilities.getHandlers
Capabilities.getHandlers = function()
  local h = origGetHandlers()
  h["file:read"] = function(args)
    local path = args and args.path
    if not path or path == "" then
      return { error = "no path" }
    end
    local f = io.open(path, "r")
    if not f then
      return { error = "not found", path = path }
    end
    local content = f:read("*a")
    f:close()
    -- Truncate very large files to avoid choking the bridge
    local maxLen = 64000
    local truncated = false
    if #content > maxLen then
      content = content:sub(1, maxLen)
      truncated = true
    end
    return { content = content, path = path, truncated = truncated }
  end
  return h
end

-- Custom BSOD: replaces Love2D's blue error screen
love.errorhandler = require("lua.bsod")

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
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

function love.mousefocus(focused)
  ReactJIT.safeCall("mousefocus", focused)
end

function love.resize(w, h)
  ReactJIT.safeCall("resize", w, h)
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

function love.focus(hasFocus)
  ReactJIT.safeCall("focus", hasFocus)
end

function love.quit()
  ReactJIT.quit()
end
