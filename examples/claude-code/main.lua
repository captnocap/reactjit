local ReactJIT = require("lua.init")

-- Load custom capabilities before init so they register in time
require("lua.claude_session")
require("lua.claude_canvas")

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

function love.quit()
  ReactJIT.quit()
end
