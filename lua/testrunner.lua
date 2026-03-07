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
    test:audit      — walk the tree and detect layout violations
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
      if k == "children" then
        -- React strips children from props; match against text content instead
        if nodeText(node) ~= v then return false end
      elseif not node.props or node.props[k] ~= v then
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

--- Capture a cropped region of the current frame to a PNG file.
--- args: { x, y, w, h, path, padding? }
function Testrunner.screenshot_region(args)
  local pad  = args.padding or 4
  local x    = math.max(0, math.floor(args.x - pad))
  local y    = math.max(0, math.floor(args.y - pad))
  local w    = math.floor(args.w + pad * 2)
  local h    = math.floor(args.h + pad * 2)
  local path = args.path or "test-region.png"

  love.graphics.captureScreenshot(function(imageData)
    -- Clamp to source bounds
    local srcW, srcH = imageData:getDimensions()
    if x + w > srcW then w = srcW - x end
    if y + h > srcH then h = srcH - y end
    if w <= 0 or h <= 0 then return end

    local cropped = love.image.newImageData(w, h)
    cropped:paste(imageData, 0, 0, x, y, w, h)
    local fileData = cropped:encode("png")
    local f = io.open(path, "wb")
    if f then
      f:write(fileData:getString())
      f:close()
    end
  end)
  return {}
end

-- ---------------------------------------------------------------------------
-- Layout audit — detect clipping, overlap, and off-viewport issues
-- ---------------------------------------------------------------------------

local OVERFLOW_CLIP = { hidden = true, scroll = true, auto = true }

local function isAbsolute(node)
  local s = node.style or {}
  return s.position == "absolute"
end

local function isHidden(node)
  local s = node.style or {}
  return s.display == "none" or s.visibility == "hidden" or (s.opacity ~= nil and s.opacity == 0)
end

local function parentClips(node)
  local s = node.style or {}
  return OVERFLOW_CLIP[s.overflow] == true
end

--- Check if a scroll ancestor already clips this node (content scrolled out
--- of view is not a real violation).
local function hasScrollAncestor(node)
  local cur = node.parent
  while cur do
    local s = cur.style or {}
    if s.overflow == "scroll" or s.overflow == "auto" then return true end
    cur = cur.parent
  end
  return false
end

local TOLERANCE = 2    -- px forgiveness for subpixel rounding
local OVERLAP_MIN = 4  -- px² minimum overlap area to report

--- Recursive audit walker. Collects violations into `out`.
local function auditNode(node, vpW, vpH, out)
  if not node.computed then return end
  if isHidden(node) then return end

  local c = node.computed
  local nx, ny, nw, nh = c.x, c.y, c.w, c.h

  -- Skip zero-size nodes for parent/sibling checks (they're harmless)
  local hasSize = nw > 0 and nh > 0

  -- ── 1. Child overflows parent ───────────────────────────────────────────
  local parent = node.parent
  if hasSize and parent and parent.computed then
    local pc = parent.computed
    local px, py, pw, ph = pc.x, pc.y, pc.w, pc.h

    -- Only flag if parent does NOT clip and child is NOT absolute
    if not parentClips(parent) and not isAbsolute(node) and pw > 0 and ph > 0 then
      local overR = (nx + nw) - (px + pw)
      local overB = (ny + nh) - (py + ph)
      local overL = px - nx
      local overT = py - ny

      if overR > TOLERANCE or overB > TOLERANCE or overL > TOLERANCE or overT > TOLERANCE then
        local dirs = {}
        if overR > TOLERANCE then dirs[#dirs + 1] = "right +" .. math.floor(overR) .. "px" end
        if overB > TOLERANCE then dirs[#dirs + 1] = "bottom +" .. math.floor(overB) .. "px" end
        if overL > TOLERANCE then dirs[#dirs + 1] = "left +" .. math.floor(overL) .. "px" end
        if overT > TOLERANCE then dirs[#dirs + 1] = "top +" .. math.floor(overT) .. "px" end
        out[#out + 1] = {
          rule     = "child-overflow",
          severity = "error",
          message  = (node.debugName or node.type) .. " overflows parent "
                     .. (parent.debugName or parent.type) .. ": " .. table.concat(dirs, ", "),
          nodeId   = node.id,
          nodeName = node.debugName or node.type,
          nodeRect = { x = nx, y = ny, w = nw, h = nh },
          parentId = parent.id,
          parentName = parent.debugName or parent.type,
          parentRect = { x = px, y = py, w = pw, h = ph },
        }
      end
    end
  end

  -- ── 2. Sibling overlap ─────────────────────────────────────────────────
  -- Check each pair of non-absolute, visible children for overlap.
  -- Only run this check on the parent (avoid duplicate pairs).
  local children = node.children or {}
  local visibleKids = {}
  for _, child in ipairs(children) do
    if child.computed and not isAbsolute(child) and not isHidden(child) then
      local cc = child.computed
      if cc.w > 0 and cc.h > 0 then
        visibleKids[#visibleKids + 1] = child
      end
    end
  end

  for i = 1, #visibleKids do
    for j = i + 1, #visibleKids do
      local a = visibleKids[i].computed
      local b = visibleKids[j].computed
      -- AABB overlap test
      local overlapX = math.max(0, math.min(a.x + a.w, b.x + b.w) - math.max(a.x, b.x))
      local overlapY = math.max(0, math.min(a.y + a.h, b.y + b.h) - math.max(a.y, b.y))
      local overlapArea = overlapX * overlapY
      if overlapArea > OVERLAP_MIN then
        out[#out + 1] = {
          rule     = "sibling-overlap",
          severity = "warning",
          message  = (visibleKids[i].debugName or visibleKids[i].type) .. " overlaps "
                     .. (visibleKids[j].debugName or visibleKids[j].type)
                     .. " by " .. math.floor(overlapX) .. "x" .. math.floor(overlapY) .. "px",
          nodeId   = visibleKids[i].id,
          nodeName = visibleKids[i].debugName or visibleKids[i].type,
          nodeRect = { x = a.x, y = a.y, w = a.w, h = a.h },
          siblingId   = visibleKids[j].id,
          siblingName = visibleKids[j].debugName or visibleKids[j].type,
          siblingRect = { x = b.x, y = b.y, w = b.w, h = b.h },
          parentId = node.id,
          parentName = node.debugName or node.type,
        }
      end
    end
  end

  -- ── 3. Off-viewport ────────────────────────────────────────────────────
  if hasSize and not hasScrollAncestor(node) then
    local fullyOut = (nx + nw < 0) or (ny + nh < 0) or (nx > vpW) or (ny > vpH)
    if fullyOut then
      out[#out + 1] = {
        rule     = "off-viewport",
        severity = "warning",
        message  = (node.debugName or node.type) .. " is entirely off-screen at ("
                   .. math.floor(nx) .. "," .. math.floor(ny) .. ") "
                   .. math.floor(nw) .. "x" .. math.floor(nh),
        nodeId   = node.id,
        nodeName = node.debugName or node.type,
        nodeRect = { x = nx, y = ny, w = nw, h = nh },
      }
    end
  end

  -- ── Recurse into children ──────────────────────────────────────────────
  for _, child in ipairs(children) do
    auditNode(child, vpW, vpH, out)
  end
end

--- Run a full layout audit on the current tree.
--- Returns an array of violation objects.
function Testrunner.audit(args)
  local root = Tree.getTree()
  if not root then return {} end

  local vpW = love.graphics.getWidth()
  local vpH = love.graphics.getHeight()

  local violations = {}
  auditNode(root, vpW, vpH, violations)

  -- Optional: filter by scope (testId of a subtree root)
  if args and args.scope then
    local scopeType  = args.scope.type
    local scopeProps = args.scope.props
    if scopeType or scopeProps then
      -- Find the scoped root, then filter violations to only descendants
      local scopeIds = {}
      local function markDescendants(n)
        scopeIds[n.id] = true
        for _, child in ipairs(n.children or {}) do
          markDescendants(child)
        end
      end
      local nodes = Tree.getNodes()
      for _, n in pairs(nodes) do
        if matchesQuery(n, scopeType, scopeProps) then
          markDescendants(n)
        end
      end
      local filtered = {}
      for _, v in ipairs(violations) do
        if scopeIds[v.nodeId] or scopeIds[v.parentId] or scopeIds[v.siblingId] then
          filtered[#filtered + 1] = v
        end
      end
      violations = filtered
    end
  end

  -- Optional: filter by severity
  if args and args.severity then
    local sev = args.severity
    local filtered = {}
    for _, v in ipairs(violations) do
      if v.severity == sev then filtered[#filtered + 1] = v end
    end
    violations = filtered
  end

  -- Optional: filter by rule
  if args and args.rule then
    local r = args.rule
    local filtered = {}
    for _, v in ipairs(violations) do
      if v.rule == r then filtered[#filtered + 1] = v end
    end
    violations = filtered
  end

  return violations
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
