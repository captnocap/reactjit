function love.conf(t)
  t.identity = "bsp-viewer"
  t.window.title = "ReactJIT — BSP Viewer"
  t.window.width = 1280
  t.window.height = 720
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.modules.joystick = true
  t.modules.physics = false
end
