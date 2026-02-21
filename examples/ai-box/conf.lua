function love.conf(t)
  t.identity = "ai-box"
  t.window.title = "AI Box"
  t.window.width = 1440
  t.window.height = 900
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.modules.joystick = true
  t.modules.physics = false
end
