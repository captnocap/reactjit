function love.conf(t)
  t.identity = "workspace"
  t.window.title = "Workspace"
  t.window.width = 1920
  t.window.height = 1080
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.window.minwidth = 800
  t.window.minheight = 600
  t.modules.joystick = true
  t.modules.physics = false
end
