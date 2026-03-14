local ReactJIT = require("lua.init")

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

-- update/draw already have internal pcall wrapping
function love.update(dt)
  ReactJIT.update(dt)
end

function love.draw()
  ReactJIT.draw()
end

-- Input callbacks go through safeCall: pcall + event trail recording
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

function love.joystickadded(joystick)
  ReactJIT.safeCall("joystickadded", joystick)
end

function love.joystickremoved(joystick)
  ReactJIT.safeCall("joystickremoved", joystick)
end

function love.gamepadpressed(joystick, button)
  ReactJIT.safeCall("gamepadpressed", joystick, button)
end

function love.gamepadreleased(joystick, button)
  ReactJIT.safeCall("gamepadreleased", joystick, button)
end

function love.gamepadaxis(joystick, axis, value)
  ReactJIT.safeCall("gamepadaxis", joystick, axis, value)
end

-- quit must return a value — keep as direct call
function love.quit()
  ReactJIT.quit()
end
