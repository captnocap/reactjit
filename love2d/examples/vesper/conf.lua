function love.conf(t)
  t.identity = "vesper"
  t.window.title = "Vesper"
  t.window.width = 1280
  t.window.height = 800
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.modules.joystick = true
  t.modules.physics = false
end
