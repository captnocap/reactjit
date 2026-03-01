function love.conf(t)
  t.window.title    = os.getenv("REACTJIT_WINDOW_TITLE") or "DevTools"
  t.window.width    = tonumber(os.getenv("REACTJIT_WINDOW_WIDTH")) or 800
  t.window.height   = tonumber(os.getenv("REACTJIT_WINDOW_HEIGHT")) or 500
  t.window.resizable = true
  t.window.vsync    = 0   -- no vsync: avoids GPU contention on multi-monitor setups
  t.modules.audio   = false
  t.modules.joystick = false
  t.modules.physics = false
  t.modules.video   = false
end
