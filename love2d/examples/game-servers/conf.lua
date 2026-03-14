function love.conf(t)
  t.identity = "game-servers"
  t.window.title = "Game Server Dashboard"
  t.window.width = 1200
  t.window.height = 800
  t.window.vsync = 1
  t.window.resizable = true
  t.modules.joystick = false
  t.modules.physics = false
end
