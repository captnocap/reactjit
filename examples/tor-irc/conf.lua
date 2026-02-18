function love.conf(t)
  t.identity = "tor-irc"
  t.window.title = "Tor IRC"
  t.window.width = 900
  t.window.height = 620
  t.window.vsync = 1
  t.window.resizable = true
  t.modules.joystick = false
  t.modules.physics = false
end
