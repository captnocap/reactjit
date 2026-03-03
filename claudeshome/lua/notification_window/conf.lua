function love.conf(t)
  t.window.title     = os.getenv("REACTJIT_NOTIF_TITLE") or "Notification"
  t.window.width     = tonumber(os.getenv("REACTJIT_NOTIF_WIDTH")) or 380
  t.window.height    = tonumber(os.getenv("REACTJIT_NOTIF_HEIGHT")) or 100
  t.window.borderless = true
  t.window.resizable = false
  t.window.vsync     = 1
  t.modules.audio    = false
  t.modules.joystick = false
  t.modules.physics  = false
  t.modules.video    = false
end
