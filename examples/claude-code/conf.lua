function love.conf(t)
  t.identity = "claude-code"
  t.window.title = "Claude Code"
  t.window.width = 1200
  t.window.height = 800
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.window.minwidth = 480
  t.window.minheight = 320
  t.modules.joystick = true
  t.modules.physics = false
end
