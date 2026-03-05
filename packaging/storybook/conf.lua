function love.conf(t)
  t.identity = "reactjit-storybook"
  t.window.title = "ReactJIT Storybook"
  t.window.width = 900
  t.window.height = 700
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.modules.joystick = false
  t.modules.physics = true
end
