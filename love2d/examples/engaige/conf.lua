function love.conf(t)
  t.identity = "reactjit-app"
  t.window.title = "ReactJIT App"
  t.window.width = 800
  t.window.height = 600
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.modules.joystick = true
  t.modules.physics = false
end
