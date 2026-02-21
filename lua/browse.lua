--[[
  browse.lua — TCP client for the browse session (stealth Firefox)

  Connects to a running `browse` session's TCP command server (default
  port 7331) and sends JSON-line commands. Runs in a love.thread worker
  so the main thread never blocks.

  Protocol (JSON lines over TCP):
    Client sends:   {"cmd": "navigate", "url": "..."}\n
    Server replies: {"ok": true, "result": {...}}\n
                    {"ok": false, "error": "..."}\n

  Usage (from init.lua):
    local browse = require("lua.browse")
    browse.init()
    browse.request(id, { cmd = "navigate", url = "https://example.com" })
    local responses = browse.poll()

  The worker maintains a persistent TCP connection. If it drops, the
  next request will reconnect automatically.
]]

local Browse = {}

local requestChannel = nil
local responseChannel = nil
local worker = nil
local initialized = false

local WORKER_CODE = [[
require("love.timer")
local requestChannel = love.thread.getChannel("browse_requests")
local responseChannel = love.thread.getChannel("browse_responses")

local socket = require("socket")
local sock = nil
local buf = ""

local function connect(host, port)
  if sock then
    pcall(function() sock:close() end)
    sock = nil
  end
  buf = ""
  local s = socket.tcp()
  s:settimeout(10)
  local ok, err = s:connect(host, port)
  if not ok then return nil, err end
  s:settimeout(30)  -- per-command timeout
  sock = s
  return true
end

local function sendCommand(cmd)
  if not sock then return nil, "Not connected" end
  local ok_json, json = pcall(require, "json")
  if not ok_json then ok_json, json = pcall(require, "lib.json") end
  if not ok_json then ok_json, json = pcall(require, "lua.json") end
  if not ok_json then return nil, "JSON library not found" end

  local payload = json.encode(cmd) .. "\n"
  local _, err = sock:send(payload)
  if err then
    sock:close()
    sock = nil
    return nil, "Send failed: " .. tostring(err)
  end

  -- Read response (newline-delimited JSON)
  while not buf:find("\n") do
    local data, rerr = sock:receive("*l")
    if not data then
      if rerr == "timeout" then
        -- For long operations, keep trying
        love.timer.sleep(0.1)
      else
        sock:close()
        sock = nil
        return nil, "Receive failed: " .. tostring(rerr)
      end
    else
      buf = buf .. data .. "\n"
    end
  end

  local line
  line, buf = buf:match("^(.-)\n(.*)$")
  if not line then return nil, "No response" end

  local ok2, resp = pcall(json.decode, line)
  if not ok2 then return nil, "Bad JSON response" end

  return resp
end

-- Worker loop
while true do
  local req = requestChannel:pop()
  if not req then
    love.timer.sleep(0.05)
  elseif req == "stop" then
    if sock then pcall(function() sock:close() end) end
    break
  else
    local id = req.id
    local cmd = req.cmd
    local host = req.host or "127.0.0.1"
    local port = req.port or 7331

    -- Auto-connect if needed
    if not sock then
      local ok, err = connect(host, port)
      if not ok then
        responseChannel:push({
          id = id,
          error = "Browse connect failed: " .. tostring(err),
        })
        goto continue
      end
    end

    local resp, err = sendCommand(cmd)
    if not resp then
      responseChannel:push({ id = id, error = err })
    elseif not resp.ok then
      responseChannel:push({ id = id, error = resp.error or "Command failed" })
    else
      responseChannel:push({ id = id, result = resp.result })
    end

    ::continue::
  end
end
]]

function Browse.init()
  if initialized then return end
  initialized = true

  requestChannel = love.thread.getChannel("browse_requests")
  responseChannel = love.thread.getChannel("browse_responses")

  local thread = love.thread.newThread(WORKER_CODE)
  thread:start()
  worker = thread
end

--- Send a command to the browse session.
--- @param id string|number  Unique request ID
--- @param cmd table  The command object (must have `cmd` field)
--- @param host string?  Session host (default: 127.0.0.1)
--- @param port number?  Session port (default: 7331)
function Browse.request(id, cmd, host, port)
  if not initialized then
    return { id = id, error = "Browse module not initialized" }
  end

  requestChannel:push({
    id = id,
    cmd = cmd,
    host = host or "127.0.0.1",
    port = port or 7331,
  })

  return nil  -- async
end

--- Poll for completed browse responses (non-blocking).
--- @return table[]  Array of completed responses
function Browse.poll()
  if not initialized then return {} end

  local responses = {}
  while true do
    local resp = responseChannel:pop()
    if not resp then break end
    responses[#responses + 1] = resp
  end

  -- Restart worker if it crashed
  if worker and not worker:isRunning() then
    local err = worker:getError()
    if err then
      print("[reactjit] Browse worker crashed: " .. tostring(err))
    end
    local newThread = love.thread.newThread(WORKER_CODE)
    newThread:start()
    worker = newThread
  end

  return responses
end

--- Shut down the worker thread.
function Browse.destroy()
  if not initialized then return end

  requestChannel:push("stop")
  if worker and worker:isRunning() then
    worker:wait()
  end
  worker = nil
  initialized = false
end

return Browse
