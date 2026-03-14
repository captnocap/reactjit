function love.conf(t)
  t.identity = "cartridge-inspector"
  t.window.title = "Cartridge Inspector"
  t.window.width = 900
  t.window.height = 600
  t.window.vsync = 1
  t.window.resizable = true
  t.modules.joystick = false
  t.modules.physics = false
end
