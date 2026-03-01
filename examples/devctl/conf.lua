function love.conf(t)
  t.identity = "devctl"
  t.modules.joystick = false
  t.modules.physics = false

  if os.getenv("DEVCTL_HEADLESS") then
    -- Daemon mode: no window, no graphics, no audio — just the process manager + socket
    t.modules.window = false
    t.modules.graphics = false
    t.modules.audio = false
    t.modules.sound = false
    t.modules.image = false
    t.modules.font = false
    t.window = nil
  else
    -- GUI mode
    t.window.title = "devctl"
    t.window.width = 1000
    t.window.height = 700
    t.window.vsync = 1
    t.window.resizable = true
  end
end
