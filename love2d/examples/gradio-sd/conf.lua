function love.conf(t)
  t.identity = "gradio-sd"
  t.window.title = "Gradio — ReactJIT"
  t.window.width = 900
  t.window.height = 700
  t.window.vsync = 1
  t.window.msaa = 4
  t.window.resizable = true
  t.window.minwidth = 640
  t.window.minheight = 400
  t.modules.joystick = false
  t.modules.physics = false
end
