local ReactJIT = require("lua.init")
local Capabilities = require("lua.capabilities")
local Session      = require("lua.claude_session")

-- Load custom capabilities before init so they register in time
require("lua.claude_canvas")

-- F5 debug toggle — exposed as RPC so React can poll it
local _showDebug = true
local origGetHandlers = Capabilities.getHandlers
Capabilities.getHandlers = function()
  local h = origGetHandlers()
  h["app:debugToggle"] = function()
    return { show = _showDebug }
  end
  return h
end

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

-- Ctrl+V image paste: save clipboard image to Claude's cache, send Ctrl+V to PTY
local function tryImagePaste()
  local ok, result = pcall(function()
    local imgCheck = io.popen("xclip -selection clipboard -target TARGETS -o 2>/dev/null")
    if not imgCheck then return false end
    local targets = imgCheck:read("*a") or ""
    imgCheck:close()
    if not (targets:find("image/png") or targets:find("image/jpeg")) then return false end

    local f = io.open("/proc/sys/kernel/random/uuid", "r")
    local uuid = f and f:read("*l") or tostring(os.clock()):gsub("%.", "")
    if f then f:close() end

    local cacheDir = os.getenv("HOME") .. "/.claude/image-cache"
    os.execute("mkdir -p " .. cacheDir)
    local imgType = targets:find("image/png") and "image/png" or "image/jpeg"
    local ext = imgType == "image/png" and ".png" or ".jpg"
    local imgPath = cacheDir .. "/" .. uuid .. ext
    os.execute("xclip -selection clipboard -target " .. imgType .. " -o > " .. imgPath .. " 2>/dev/null")
    Session.writeRaw("\x16")
    return true
  end)
  if not ok then
    io.write("[IMAGE-PASTE] Error: " .. tostring(result) .. "\n"); io.flush()
    return false
  end
  return result
end

function love.keypressed(key, scancode, isrepeat)
  if key == "f5" then
    _showDebug = not _showDebug
    return
  end
  -- Ctrl+V (no shift): image paste only. Ctrl+Shift+V: text paste (falls through).
  if key == "v" and love.keyboard.isDown("lctrl", "rctrl")
     and not love.keyboard.isDown("lshift", "rshift") then
    if tryImagePaste() then return end
    -- No image in clipboard — swallow so only Ctrl+Shift+V does text paste
    return
  end
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

function love.joystickadded(joystick)
  ReactJIT.joystickadded(joystick)
end

function love.joystickremoved(joystick)
  ReactJIT.joystickremoved(joystick)
end

function love.gamepadpressed(joystick, button)
  ReactJIT.gamepadpressed(joystick, button)
end

function love.gamepadreleased(joystick, button)
  ReactJIT.gamepadreleased(joystick, button)
end

function love.gamepadaxis(joystick, axis, value)
  ReactJIT.gamepadaxis(joystick, axis, value)
end

function love.focus(hasFocus)
  ReactJIT.focus(hasFocus)
end

function love.quit()
  ReactJIT.quit()
end
