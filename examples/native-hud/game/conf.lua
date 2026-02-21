function love.conf(t)
  t.identity = "reactjit-native-hud"
  t.window.title = "reactjit — native HUD"
  t.window.width = 1024
  t.window.height = 768
  t.window.vsync = 1
  t.window.resizable = true
  t.modules.joystick = false
  t.modules.physics = false
end
