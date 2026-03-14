function love.conf(t)
  t.identity = "reactjit-synth"
  t.window.title = "ReactJIT Synth"
  t.window.width = 756
  t.window.height = 430
  t.window.vsync = 1
  t.window.resizable = true
  t.modules.joystick = true
  t.modules.physics = false
  t.modules.audio = true
  t.modules.sound = true
end
