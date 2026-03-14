function love.conf(t)
  t.window.title     = os.getenv("REACTJIT_NOTIF_TITLE") or "Notification"
  t.window.width     = tonumber(os.getenv("REACTJIT_NOTIF_WIDTH")) or 380
  t.window.height    = tonumber(os.getenv("REACTJIT_NOTIF_HEIGHT")) or 100
  t.window.borderless = true
  t.window.resizable = false
  t.window.vsync     = 1
  local display = tonumber(os.getenv("REACTJIT_NOTIF_DISPLAY"))
  if display and display > 0 then
    t.window.display = display
  end
  -- Strip everything we don't need — notification only draws rects + text
  t.modules.audio    = false
  t.modules.data     = false
  t.modules.image    = false
  t.modules.joystick = false
  t.modules.keyboard = false
  t.modules.math     = false
  t.modules.physics  = false
  t.modules.sound    = false
  t.modules.system   = false
  t.modules.thread   = false
  t.modules.touch    = false
  t.modules.video    = false
end
