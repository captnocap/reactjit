function love.conf(t)
  t.identity = "reactjit-storybook"
  t.window.title = "reactjit storybook"
  t.window.width = 800
  t.window.height = 600
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.modules.joystick = false
  t.modules.physics = true
end
