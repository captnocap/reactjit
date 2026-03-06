function love.conf(t)
  t.window.title    = os.getenv("REACTJIT_WINDOW_TITLE") or "ReactJIT"
  t.window.width    = tonumber(os.getenv("REACTJIT_WINDOW_WIDTH")) or 640
  t.window.height   = tonumber(os.getenv("REACTJIT_WINDOW_HEIGHT")) or 480
  t.window.resizable = true
  t.window.vsync    = 1
  t.window.borderless = os.getenv("REACTJIT_WINDOW_BORDERLESS") == "1"
  local display = tonumber(os.getenv("REACTJIT_WINDOW_DISPLAY"))
  if display and display > 0 then
    t.window.display = display
  end
  t.modules.audio   = false
  t.modules.joystick = false
  t.modules.physics = true
  t.modules.video   = false
end
