local ReactLove = require("lua.init")

-- lib/libquickjs.so lives next to the binary on disk, not inside the .love archive
local function resolveLibPath()
  if arg and arg[1] then
    local dir = arg[1]:match("(.+)/[^/]+$")
    if dir then return dir .. "/lib/libquickjs" end
  end
  return "lib/libquickjs"
end

function love.load()
  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)
  ReactLove.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = resolveLibPath(),
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
