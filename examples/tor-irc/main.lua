local ReactLove = require("lua.init")

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
  ReactLove.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = "lib/libquickjs",
    tor = { autoStart = true, hsPort = 6667 },
  })
end

function love.update(dt)
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

function love.joystickadded(joystick)
  ReactLove.joystickadded(joystick)
end

function love.joystickremoved(joystick)
  ReactLove.joystickremoved(joystick)
end

function love.gamepadpressed(joystick, button)
  ReactLove.gamepadpressed(joystick, button)
end

function love.gamepadreleased(joystick, button)
  ReactLove.gamepadreleased(joystick, button)
end

function love.gamepadaxis(joystick, axis, value)
  ReactLove.gamepadaxis(joystick, axis, value)
end

function love.quit()
  ReactLove.quit()
end
