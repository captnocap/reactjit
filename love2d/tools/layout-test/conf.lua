function love.conf(t)
  t.identity = "layout-test"
  t.window.title = "Layout Test Harness"
  t.window.width = 800
  t.window.height = 600
  t.window.vsync = 0
  t.modules.audio = false
  t.modules.joystick = false
  t.modules.physics = false
  t.modules.sound = false
  t.modules.video = false
end
