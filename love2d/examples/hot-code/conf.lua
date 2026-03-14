function love.conf(t)
  t.identity = "hot-code"
  t.window.title = "Hot Code"
  t.window.width = 1400
  t.window.height = 850
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.window.minwidth = 640
  t.window.minheight = 400
  t.modules.joystick = false
  t.modules.physics = false
end
