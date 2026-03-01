local ProcessManager = require("lua.process_manager")
local HEADLESS = os.getenv("DEVCTL_HEADLESS") ~= nil

-- ── PID file ────────────────────────────────────────────────────────────────────

local PID_FILE = os.getenv("HOME") .. "/.config/devctl/daemon.pid"

local function writePid()
  os.execute('mkdir -p "' .. os.getenv("HOME") .. '/.config/devctl"')
  local f = io.open(PID_FILE, "w")
  if f then
    -- Love2D doesn't expose getpid, but we can get it from /proc
    local pf = io.open("/proc/self/stat", "r")
    if pf then
      local pid = pf:read("*l"):match("^(%d+)")
      pf:close()
      if pid then f:write(pid) end
    end
    f:close()
  end
end

local function removePid()
  os.remove(PID_FILE)
end

-- ── Headless mode (daemon) ──────────────────────────────────────────────────────

if HEADLESS then
  function love.load()
    writePid()
    ProcessManager.init()
    io.write("[devctl] daemon started (headless)\n"); io.flush()
  end

  function love.update(dt)
    ProcessManager.tick(dt)
  end

  function love.quit()
    ProcessManager.shutdown()
    removePid()
  end

  return
end

-- ── GUI mode ────────────────────────────────────────────────────────────────────

local ReactJIT = require("lua.init")

function love.load()
  writePid()
  love.graphics.setBackgroundColor(0.03, 0.03, 0.05)
  ReactJIT.init({
    mode = "native",
    bundlePath = "love/bundle.js",
    libpath = "lib/libquickjs",
  })
  ProcessManager.init()

  -- Register RPCs for React UI
  ReactJIT.rpc("pm:list", function() return ProcessManager.list() end)
  ReactJIT.rpc("pm:start", function(args)
    io.write("[devctl] pm:start called for: " .. tostring(args and args.name) .. "\n"); io.flush()
    local result = ProcessManager.start(args)
    io.write("[devctl] pm:start result: " .. tostring(result and result.ok or result and result.error) .. "\n"); io.flush()
    return result
  end)
  ReactJIT.rpc("pm:stop", function(args) return ProcessManager.stop(args) end)
  ReactJIT.rpc("pm:restart", function(args) return ProcessManager.restart(args) end)
  ReactJIT.rpc("pm:logs", function(args) return ProcessManager.logs(args) end)
  ReactJIT.rpc("pm:add", function(args) return ProcessManager.add(args) end)
  ReactJIT.rpc("pm:remove", function(args) return ProcessManager.remove(args) end)
  ReactJIT.rpc("pm:ports", function() return ProcessManager.ports() end)
  ReactJIT.rpc("pm:save", function() return ProcessManager.saveConfig() end)
end

function love.update(dt)
  ReactJIT.update(dt)
  local ok, err = pcall(ProcessManager.tick, dt)
  if not ok then
    io.write("[devctl] ProcessManager.tick error: " .. tostring(err) .. "\n"); io.flush()
  end
end

function love.draw()
  ReactJIT.draw()
end

function love.mousepressed(x, y, button) ReactJIT.mousepressed(x, y, button) end
function love.mousereleased(x, y, button) ReactJIT.mousereleased(x, y, button) end
function love.mousemoved(x, y, dx, dy) ReactJIT.mousemoved(x, y) end
function love.wheelmoved(x, y) ReactJIT.wheelmoved(x, y) end
function love.resize(w, h) ReactJIT.resize(w, h) end
function love.keypressed(key, scancode, isrepeat) ReactJIT.keypressed(key, scancode, isrepeat) end
function love.keyreleased(key, scancode) ReactJIT.keyreleased(key, scancode) end
function love.textinput(text) ReactJIT.textinput(text) end

function love.quit()
  ProcessManager.shutdown()
  removePid()
  ReactJIT.quit()
end
