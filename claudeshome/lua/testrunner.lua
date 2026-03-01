--[[
  testrunner.lua — Lua-side engine for `rjit test`

  Provides query, interaction, screenshot, and reporting APIs consumed
  via bridge RPC calls from the test shim running inside QuickJS.

  RPC methods (registered in init.lua):
    test:query      — find nodes by type / props, returns layout rects
    test:click      — inject mousepressed + mousereleased at (x, y)
    test:type       — inject textinput characters
    test:key        — inject keypressed + keyreleased
    test:wait       — no-op; RPC round-trip naturally spans one frame
    test:screenshot — capture a PNG to the given path
    test:done       — print results, quit Love2D with exit code
]]

local Testrunner = {}

local Tree = nil

--- Call this from init.lua after M.tree is available.
function Testrunner.init(config)
  Tree = config.tree
end

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

local function nodeText(node)
  if node.type == "__TEXT__" then return node.text or "" end
  local parts = {}
  for _, child in ipairs(node.children or {}) do
    local t = nodeText(child)
    if t ~= "" then table.insert(parts, t) end
  end
  return table.concat(parts, "")
end

local function matchesQuery(node, queryType, queryProps)
  -- Skip un-laid-out nodes
  if not node.computed then return false end
  -- Match component type by debugName ("Pressable", "Box") or raw type ("View", "Text")
  if queryType then
    if node.debugName ~= queryType and node.type ~= queryType then
      return false
    end
  end
  -- Match props
  if queryProps then
    for k, v in pairs(queryProps) do
      if not node.props or node.props[k] ~= v then
        return false
      end
    end
  end
  return true
end

local function safeProps(node)
  local out = {}
  if node.props then
    for k, v in pairs(node.props) do
      local t = type(v)
      if t == "string" or t == "number" or t == "boolean" then
        out[k] = v
      end
    end
  end
  return out
end

-- ---------------------------------------------------------------------------
-- Public API (each function maps 1:1 to an RPC method)
-- ---------------------------------------------------------------------------

--- Walk the entire tree and return descriptors for nodes matching type/props.
function Testrunner.query(args)
  local queryType  = args and args.type
  local queryProps = args and args.props
  local nodes   = Tree.getNodes()
  local results = {}
  for _, node in pairs(nodes) do
    if matchesQuery(node, queryType, queryProps) then
      local c = node.computed
      table.insert(results, {
        id        = node.id,
        type      = node.type,
        debugName = node.debugName or node.type,
        props     = safeProps(node),
        text      = nodeText(node),
        x  = c.x,  y  = c.y,
        w  = c.w,  h  = c.h,
        cx = c.x + c.w * 0.5,
        cy = c.y + c.h * 0.5,
      })
    end
  end
  return results
end

--- Inject a mouse press + release at (x, y).
function Testrunner.click(args)
  local x      = math.floor(args.x)
  local y      = math.floor(args.y)
  local button = args.button or 1
  if love.handlers then
    if love.handlers.mousepressed  then love.handlers.mousepressed(x, y, button, false) end
    if love.handlers.mousereleased then love.handlers.mousereleased(x, y, button, false) end
  end
  return {}
end

--- Inject textinput events, one character at a time.
function Testrunner.type_text(args)
  local text = args.text or ""
  if love.handlers and love.handlers.textinput then
    for i = 1, #text do
      love.handlers.textinput(text:sub(i, i))
    end
  end
  return {}
end

--- Inject a key press + release (for Enter, Backspace, arrow keys, etc.).
function Testrunner.key(args)
  local key      = tostring(args.key)
  local scancode = tostring(args.scancode or key)
  if love.handlers then
    if love.handlers.keypressed  then love.handlers.keypressed(key, scancode, false) end
    if love.handlers.keyreleased then love.handlers.keyreleased(key, scancode) end
  end
  return {}
end

--- No-op — just returning completes the RPC, which takes one full frame.
--- JS awaits this to let React process previous interactions.
function Testrunner.wait(_args)
  return {}
end

--- Capture the current frame to a PNG file.
function Testrunner.screenshot(args)
  local path = (args and args.path) or "test-screenshot.png"
  love.graphics.captureScreenshot(function(imageData)
    local fileData = imageData:encode("png")
    local f = io.open(path, "wb")
    if f then
      f:write(fileData:getString())
      f:close()
    end
  end)
  return {}
end

--- Print structured test results and quit Love2D.
--- Exit code 0 if all tests passed, 1 if any failed.
function Testrunner.report(args)
  local results = (args and args.results) or {}
  local passed, failed = 0, 0
  for _, r in ipairs(results) do
    if r.passed then
      passed = passed + 1
      io.write("TEST_PASS: " .. tostring(r.name) .. "\n")
    else
      failed = failed + 1
      io.write("TEST_FAIL: " .. tostring(r.name) .. ": " .. tostring(r.error or "unknown") .. "\n")
    end
    io.flush()
  end
  io.write("TEST_DONE: " .. passed .. "/" .. #results .. "\n")
  io.flush()
  love.event.quit(failed > 0 and 1 or 0)
  return {}
end

return Testrunner
