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
    test:divider-audit — detect text nodes overlapping thin separators
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

--- Sleep for N seconds (real wall-clock pause, not frame-count).
function Testrunner.sleep(args)
  local seconds = (args and args.seconds) or 2
  love.timer.sleep(seconds)
  return { slept = seconds }
end

--- Write a text file to disk (for test reports/diagnostics).
function Testrunner.writeFile(args)
  local path = args and args.path or "/tmp/test-report.txt"
  local content = args and args.content or ""
  local f = io.open(path, "w")
  if f then
    f:write(content)
    f:close()
    return { ok = true, path = path }
  end
  return { ok = false, error = "Could not open " .. path }
end

--- Resize the Love2D window.
--- Love2D fires love.resize automatically on the next frame.
function Testrunner.resize(args)
  local w = args.width or 800
  local h = args.height or 600
  love.window.updateMode(w, h)
  return { width = w, height = h }
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

-- ---------------------------------------------------------------------------
-- Text-specific audit — detect text overlap, escape, truncation, clipping
-- ---------------------------------------------------------------------------

local MeasureModule = nil  -- lazy-loaded to avoid early require

local TEXT_TYPES = { Text = true, __TEXT__ = true }
local TEXT_BEARING = { Text = true, __TEXT__ = true, CodeBlock = true }

--- Collect all text-bearing nodes (Text, __TEXT__, CodeBlock) with valid rects.
--- Only collects nodes that are on-screen (within viewport bounds).
local function collectTextNodes(node, vpW, vpH, out)
  if not node or not node.computed then return end
  local c = node.computed
  if c.w <= 0 or c.h <= 0 then return end
  if isHidden(node) then return end

  -- Skip nodes entirely off-viewport
  if c.x + c.w < 0 or c.y + c.h < 0 or c.x > vpW or c.y > vpH then return end

  if TEXT_BEARING[node.type] then
    out[#out + 1] = node
  end

  for _, child in ipairs(node.children or {}) do
    collectTextNodes(child, vpW, vpH, out)
  end
end

--- AABB overlap area between two rects
local function overlapArea(ax, ay, aw, ah, bx, by, bw, bh)
  local ox = math.max(0, math.min(ax + aw, bx + bw) - math.max(ax, bx))
  local oy = math.max(0, math.min(ay + ah, by + bh) - math.max(ay, by))
  return ox * oy, ox, oy
end

--- Check if node is a descendant of ancestor
local function isDescendant(node, ancestor)
  local cur = node.parent
  while cur do
    if cur == ancestor then return true end
    cur = cur.parent
  end
  return false
end

--- Get the nearest scroll ancestor (or nil if none).
--- Nodes in different scroll contexts shouldn't be compared for overlap
--- because their computed positions are in different coordinate spaces.
local function getScrollAncestor(node)
  local cur = node.parent
  while cur do
    local s = cur.style or {}
    if s.overflow == "scroll" or s.overflow == "auto"
       or cur.type == "ScrollView" then
      return cur
    end
    cur = cur.parent
  end
  return nil
end

--- Check if two nodes share the same scroll context.
local function sameScrollContext(a, b)
  return getScrollAncestor(a) == getScrollAncestor(b)
end

--- Get the effective font size for a text node (with __TEXT__ inheritance)
local function getEffectiveFontSize(node)
  local s = node.style or {}
  local fs = s.fontSize
  if not fs and node.type == "__TEXT__" and node.parent then
    fs = (node.parent.style or {}).fontSize
  end
  return fs or 14
end

--- Run a text-focused layout audit.
--- Returns an array of violation objects with rules:
---   text-overlap       — two text-bearing nodes overlap each other
---   text-codeblock-overlap — a Text node overlaps a CodeBlock node
---   text-escape        — text node extends beyond its parent's bounds
---   text-truncation    — measured text width exceeds allocated node width
function Testrunner.text_audit(args)
  local root = Tree.getTree()
  if not root then return {} end

  local vpW = love.graphics.getWidth()
  local vpH = love.graphics.getHeight()
  local violations = {}

  -- Lazy-load measure (needs Love2D graphics to be up)
  if not MeasureModule then
    local ok, m = pcall(require, "lua.measure")
    if ok then MeasureModule = m end
  end

  -- Collect all text-bearing nodes (on-screen only)
  local textNodes = {}
  collectTextNodes(root, vpW, vpH, textNodes)

  -- Separate into categories
  -- Use only "Text" (not __TEXT__) for overlap checks — __TEXT__ is always
  -- a child of Text and shares its parent's rect, causing 4x duplicates.
  local textParents = {}   -- type == "Text" only
  local allText = {}       -- Text + __TEXT__ (for escape/truncation checks)
  local codeBlocks = {}    -- CodeBlock
  for _, n in ipairs(textNodes) do
    if n.type == "Text" then
      textParents[#textParents + 1] = n
      allText[#allText + 1] = n
    elseif n.type == "__TEXT__" then
      allText[#allText + 1] = n
    elseif n.type == "CodeBlock" then
      codeBlocks[#codeBlocks + 1] = n
    end
  end

  -- ── 1. Text↔Text overlap ─────────────────────────────────────────────
  -- Only compare Text parents (not __TEXT__) to avoid duplicate reports.
  -- Only compare nodes in the same scroll context.
  for i = 1, #textParents do
    local a = textParents[i]
    local ac = a.computed
    for j = i + 1, #textParents do
      local b = textParents[j]
      -- Skip parent-child pairs and cross-scroll-context comparisons
      if not isDescendant(a, b) and not isDescendant(b, a)
         and sameScrollContext(a, b) then
        local bc = b.computed
        local area, ox, oy = overlapArea(ac.x, ac.y, ac.w, ac.h, bc.x, bc.y, bc.w, bc.h)
        if area > OVERLAP_MIN then
          violations[#violations + 1] = {
            rule     = "text-overlap",
            severity = "error",
            message  = (a.debugName or a.type) .. " overlaps "
                       .. (b.debugName or b.type)
                       .. " by " .. math.floor(ox) .. "x" .. math.floor(oy) .. "px"
                       .. " (text: \"" .. string.sub(nodeText(a), 1, 30) .. "\")",
            nodeId   = a.id,
            nodeName = a.debugName or a.type,
            nodeRect = { x = ac.x, y = ac.y, w = ac.w, h = ac.h },
            siblingId   = b.id,
            siblingName = b.debugName or b.type,
            siblingRect = { x = bc.x, y = bc.y, w = bc.w, h = bc.h },
          }
        end
      end
    end
  end

  -- ── 2. Text↔CodeBlock overlap ─────────────────────────────────────────
  -- Only compare Text parents (not __TEXT__) against CodeBlocks.
  -- Only compare nodes in the same scroll context.
  for _, t in ipairs(textParents) do
    local tc = t.computed
    for _, cb in ipairs(codeBlocks) do
      if not isDescendant(t, cb) and not isDescendant(cb, t)
         and sameScrollContext(t, cb) then
        local cbc = cb.computed
        local area, ox, oy = overlapArea(tc.x, tc.y, tc.w, tc.h, cbc.x, cbc.y, cbc.w, cbc.h)
        if area > OVERLAP_MIN then
          violations[#violations + 1] = {
            rule     = "text-codeblock-overlap",
            severity = "error",
            message  = (t.debugName or t.type) .. " overlaps CodeBlock"
                       .. " by " .. math.floor(ox) .. "x" .. math.floor(oy) .. "px"
                       .. " (text: \"" .. string.sub(nodeText(t), 1, 30) .. "\")",
            nodeId   = t.id,
            nodeName = t.debugName or t.type,
            nodeRect = { x = tc.x, y = tc.y, w = tc.w, h = tc.h },
            siblingId   = cb.id,
            siblingName = "CodeBlock",
            siblingRect = { x = cbc.x, y = cbc.y, w = cbc.w, h = cbc.h },
          }
        end
      end
    end
  end

  -- ── 3. Text escaping container ────────────────────────────────────────
  -- Check Text nodes only (not __TEXT__ — they inherit parent's rect)
  for _, n in ipairs(textParents) do
    local parent = n.parent
    if parent and parent.computed then
      local nc = n.computed
      local pc = parent.computed
      -- Skip if parent clips (overflow: hidden/scroll)
      if not parentClips(parent) and not isAbsolute(n)
         and pc.w > 0 and pc.h > 0 then
        local overR = (nc.x + nc.w) - (pc.x + pc.w)
        local overB = (nc.y + nc.h) - (pc.y + pc.h)
        local overL = pc.x - nc.x
        local overT = pc.y - nc.y
        if overR > TOLERANCE or overB > TOLERANCE or overL > TOLERANCE or overT > TOLERANCE then
          local dirs = {}
          if overR > TOLERANCE then dirs[#dirs + 1] = "right +" .. math.floor(overR) .. "px" end
          if overB > TOLERANCE then dirs[#dirs + 1] = "bottom +" .. math.floor(overB) .. "px" end
          if overL > TOLERANCE then dirs[#dirs + 1] = "left +" .. math.floor(overL) .. "px" end
          if overT > TOLERANCE then dirs[#dirs + 1] = "top +" .. math.floor(overT) .. "px" end
          violations[#violations + 1] = {
            rule     = "text-escape",
            severity = "error",
            message  = (n.debugName or n.type) .. " escapes container "
                       .. (parent.debugName or parent.type) .. ": " .. table.concat(dirs, ", ")
                       .. " (text: \"" .. string.sub(nodeText(n), 1, 30) .. "\")",
            nodeId   = n.id,
            nodeName = n.debugName or n.type,
            nodeRect = { x = nc.x, y = nc.y, w = nc.w, h = nc.h },
            parentId = parent.id,
            parentName = parent.debugName or parent.type,
            parentRect = { x = pc.x, y = pc.y, w = pc.w, h = pc.h },
          }
        end
      end
    end
  end

  -- ── 4. Text truncation (measured width > allocated width) ─────────────
  -- Check __TEXT__ nodes (they hold actual text content for measurement)
  if MeasureModule then
    for _, n in ipairs(allText) do
      local nc = n.computed
      if nc.w > 0 then
        local text = nodeText(n)
        if text ~= "" then
          local ok, result = pcall(function()
            local fontSize = getEffectiveFontSize(n)
            local s = n.style or {}
            local fontFamily = s.fontFamily
            if not fontFamily and n.type == "__TEXT__" and n.parent then
              fontFamily = (n.parent.style or {}).fontFamily
            end
            local fontWeight = s.fontWeight
            if not fontWeight and n.type == "__TEXT__" and n.parent then
              fontWeight = (n.parent.style or {}).fontWeight
            end
            local ts = MeasureModule.resolveTextScale(n)
            fontSize = math.floor(fontSize * ts)

            local font = MeasureModule.getFont(fontSize, fontFamily, fontWeight)
            local letterSpacing = s.letterSpacing
            if not letterSpacing and n.type == "__TEXT__" and n.parent then
              letterSpacing = (n.parent.style or {}).letterSpacing
            end
            return MeasureModule.getWidthWithSpacing(font, text, letterSpacing)
          end)
          if ok and result then
            local measuredW = result
            local overflow = measuredW - nc.w
            if overflow > TOLERANCE then
              local s = n.style or {}
              local textOverflow = s.textOverflow
              if not textOverflow and n.type == "__TEXT__" and n.parent then
                textOverflow = (n.parent.style or {}).textOverflow
              end
              local parentClipping = n.parent and parentClips(n.parent)
              if not parentClipping and not hasScrollAncestor(n) then
                violations[#violations + 1] = {
                  rule     = "text-truncation",
                  severity = "warning",
                  message  = (n.debugName or n.type)
                             .. " text overflows by " .. math.floor(overflow) .. "px"
                             .. " (measured=" .. math.floor(measuredW) .. " alloc=" .. math.floor(nc.w) .. ")"
                             .. " (text: \"" .. string.sub(text, 1, 30) .. "\")",
                  nodeId   = n.id,
                  nodeName = n.debugName or n.type,
                  nodeRect = { x = nc.x, y = nc.y, w = nc.w, h = nc.h },
                  measuredWidth = measuredW,
                  allocatedWidth = nc.w,
                }
              end
            end
          end
        end
      end
    end
  end

  return violations
end

-- ---------------------------------------------------------------------------
-- Divider audit — detect text nodes overlapping thin separator elements
-- ---------------------------------------------------------------------------

--- A "divider" is any laid-out node whose computed size is very thin in one
--- axis (<=2px) and spans a meaningful length in the other (>20px).
--- This catches both horizontal and vertical separators regardless of their
--- component type or debug name.

local DIVIDER_THICKNESS = 2   -- max px in thin axis
local DIVIDER_MIN_SPAN  = 20  -- min px in long axis

--- Collect all divider-like nodes in the tree.
local function collectDividers(node, vpW, vpH, out)
  if not node or not node.computed then return end
  local c = node.computed
  if c.w <= 0 or c.h <= 0 then return end
  if isHidden(node) then return end
  -- Skip off-viewport
  if c.x + c.w < 0 or c.y + c.h < 0 or c.x > vpW or c.y > vpH then return end

  -- Horizontal divider: thin height, wide width
  local isHDiv = c.h <= DIVIDER_THICKNESS and c.w >= DIVIDER_MIN_SPAN
  -- Vertical divider: thin width, tall height
  local isVDiv = c.w <= DIVIDER_THICKNESS and c.h >= DIVIDER_MIN_SPAN

  if isHDiv or isVDiv then
    out[#out + 1] = { node = node, horizontal = isHDiv }
  end

  for _, child in ipairs(node.children or {}) do
    collectDividers(child, vpW, vpH, out)
  end
end

--- Run a divider-focused layout audit.
--- Finds all thin separator elements and checks if any text node overlaps them.
--- Returns an array of violation objects with rule = "text-divider-overlap".
function Testrunner.divider_audit(args)
  local root = Tree.getTree()
  if not root then return {} end

  local vpW = love.graphics.getWidth()
  local vpH = love.graphics.getHeight()
  local violations = {}

  -- Collect dividers
  local dividers = {}
  collectDividers(root, vpW, vpH, dividers)

  -- Collect text nodes (reuse existing helper)
  local textNodes = {}
  collectTextNodes(root, vpW, vpH, textNodes)

  -- Filter to Text parents only (not __TEXT__) to avoid duplicates
  local textParents = {}
  for _, n in ipairs(textNodes) do
    if n.type == "Text" then
      textParents[#textParents + 1] = n
    end
  end

  -- Check each text node against each divider for overlap
  for _, t in ipairs(textParents) do
    local tc = t.computed
    for _, d in ipairs(dividers) do
      local dn = d.node
      local dc = dn.computed
      -- Skip parent-child pairs
      if not isDescendant(t, dn) and not isDescendant(dn, t)
         and sameScrollContext(t, dn) then
        local area, ox, oy = overlapArea(
          tc.x, tc.y, tc.w, tc.h,
          dc.x, dc.y, dc.w, dc.h
        )
        if area > OVERLAP_MIN then
          local orient = d.horizontal and "horizontal" or "vertical"
          violations[#violations + 1] = {
            rule     = "text-divider-overlap",
            severity = "error",
            message  = (t.debugName or t.type)
                       .. " overlaps " .. orient .. " divider"
                       .. " by " .. math.floor(ox) .. "x" .. math.floor(oy) .. "px"
                       .. " (text: \"" .. string.sub(nodeText(t), 1, 40) .. "\")",
            nodeId   = t.id,
            nodeName = t.debugName or t.type,
            nodeRect = { x = tc.x, y = tc.y, w = tc.w, h = tc.h },
            dividerId   = dn.id,
            dividerName = dn.debugName or dn.type,
            dividerRect = { x = dc.x, y = dc.y, w = dc.w, h = dc.h },
            dividerOrientation = orient,
          }
        end
      end
    end
  end

  return {
    violations = violations,
    stats = {
      dividers = #dividers,
      textNodes = #textParents,
      vpW = vpW,
      vpH = vpH,
    },
    -- Dump first 10 dividers for debugging
    dividerDump = (function()
      local dump = {}
      for i = 1, math.min(10, #dividers) do
        local d = dividers[i]
        local dc = d.node.computed
        dump[#dump + 1] = {
          name = d.node.debugName or d.node.type,
          horizontal = d.horizontal,
          x = dc.x, y = dc.y, w = dc.w, h = dc.h,
        }
      end
      return dump
    end)(),
  }
end

-- ---------------------------------------------------------------------------
-- Text wrap diagnostics — detailed per-node wrap metrics for regression tests
-- ---------------------------------------------------------------------------

--- Return detailed wrapping metrics for every text node in the tree.
--- For each __TEXT__ node, resolves fontSize, lineHeight, text scale,
--- measures natural (unconstrained) width, and computes wrap line count.
--- This gives tests the data needed to detect pathological wrapping
--- (e.g. text wrapping MORE at larger viewports).
function Testrunner.text_wrap_diagnostics(_args)
  local root = Tree.getTree()
  if not root then return {} end

  -- Lazy-load measure
  if not MeasureModule then
    local ok, m = pcall(require, "lua.measure")
    if ok then MeasureModule = m end
  end
  if not MeasureModule then return {} end

  local vpW = love.graphics.getWidth()
  local vpH = love.graphics.getHeight()

  local results = {}

  local function walk(node)
    if not node or not node.computed then return end
    local c = node.computed
    if c.w <= 0 or c.h <= 0 then return end
    if isHidden(node) then return end

    -- Only check __TEXT__ nodes (actual text content holders)
    if node.type == "__TEXT__" and node.text and node.text ~= "" then
      local text = node.text
      local textLen = #text

      -- Resolve font properties (with __TEXT__ → parent inheritance)
      local s = node.style or {}
      local ps = (node.parent and node.parent.style) or {}

      local fontSize = s.fontSize or ps.fontSize or 14
      local fontFamily = s.fontFamily or ps.fontFamily
      local fontWeight = s.fontWeight or ps.fontWeight
      local lineHeight = s.lineHeight or ps.lineHeight
      local letterSpacing = s.letterSpacing or ps.letterSpacing
      local noWrap = s.textNoWrap or ps.textNoWrap or s.noWrap or ps.noWrap

      -- Apply text scale
      local ts = MeasureModule.resolveTextScale(node)
      local scaledFontSize = math.floor(fontSize * ts)
      local scaledLineHeight = lineHeight and math.floor(lineHeight * ts) or nil

      -- Get the font and effective line height
      local font = MeasureModule.getFont(scaledFontSize, fontFamily, fontWeight)
      local effectiveLH = scaledLineHeight or font:getHeight()

      -- Measure natural (unconstrained) width — single-line
      local naturalResult = MeasureModule.measureText(text, scaledFontSize, nil, fontFamily,
        scaledLineHeight, letterSpacing, nil, fontWeight, false)
      local naturalW = naturalResult.width

      -- Measure with actual node width as constraint
      local constrainW = c.w
      local wrappedResult = MeasureModule.measureText(text, scaledFontSize, constrainW, fontFamily,
        scaledLineHeight, letterSpacing, nil, fontWeight, noWrap)

      -- Compute metrics
      local numLines = math.max(1, math.floor(wrappedResult.height / effectiveLH + 0.5))
      local charsPerLine = textLen / numLines
      local wrapRatio = naturalW > 0 and (constrainW / naturalW) or 1

      -- Parent container info
      local parentW = 0
      local parentDebugName = ""
      if node.parent and node.parent.computed then
        parentW = node.parent.computed.w
        parentDebugName = node.parent.debugName or node.parent.type or ""
      end

      results[#results + 1] = {
        id = node.id,
        text = string.sub(text, 1, 80),
        textLen = textLen,
        x = c.x, y = c.y, w = c.w, h = c.h,
        fontSize = scaledFontSize,
        lineHeight = effectiveLH,
        textScale = ts,
        naturalW = naturalW,
        numLines = numLines,
        charsPerLine = math.floor(charsPerLine * 10) / 10,
        wrapRatio = math.floor(wrapRatio * 1000) / 1000,
        noWrap = noWrap and true or false,
        parentW = parentW,
        parentName = parentDebugName,
        vpW = vpW,
        vpH = vpH,
      }
    end

    for _, child in ipairs(node.children or {}) do
      walk(child)
    end
  end

  walk(root)
  return results
end

-- ---------------------------------------------------------------------------
-- Scroll height diagnostic — walk the tree and report scroll container sizes
-- ---------------------------------------------------------------------------

--- Walk the tree and collect all scroll containers with their viewport height
--- and content height. Used to detect "massive gap" layout bugs where content
--- height is disproportionately large relative to the viewport.
function Testrunner.scroll_heights(_args)
  local root = Tree.getTree()
  if not root then return {} end

  local vpW = love.graphics.getWidth()
  local vpH = love.graphics.getHeight()
  local containers = {}

  local function walk(node, depth)
    if not node or not node.computed then return end
    local c = node.computed
    local s = node.style or {}

    -- Collect scroll containers
    if node.scrollState and (s.overflow == "scroll" or s.overflow == "auto") then
      local ss = node.scrollState
      local ratio = (c.h > 0) and (ss.contentH / c.h) or 0
      containers[#containers + 1] = {
        id        = node.id,
        type      = node.type,
        debugName = node.debugName or "",
        depth     = depth,
        x = c.x, y = c.y, w = c.w, h = c.h,
        contentW  = ss.contentW,
        contentH  = ss.contentH,
        ratio     = math.floor(ratio * 100) / 100,
        overflow  = s.overflow,
      }
    end

    -- Also collect nodes with unusually large heights (> 3x viewport)
    -- that are NOT inside a scroll container's content area
    if c.h > vpH * 3 and not node.scrollState then
      containers[#containers + 1] = {
        id        = node.id,
        type      = node.type,
        debugName = node.debugName or "",
        depth     = depth,
        x = c.x, y = c.y, w = c.w, h = c.h,
        contentW  = 0,
        contentH  = 0,
        ratio     = 0,
        overflow  = s.overflow or "",
        flag      = "oversized",
      }
    end

    for _, child in ipairs(node.children or {}) do
      walk(child, depth + 1)
    end
  end

  walk(root, 0)

  return {
    vpW = vpW,
    vpH = vpH,
    containers = containers,
  }
end

-- ---------------------------------------------------------------------------
-- Gamepad simulation — virtual controller for testing
-- ---------------------------------------------------------------------------

-- Mock joystick object that implements the Love2D Joystick interface
-- just enough for ReactJIT's gamepad handlers.
local MockJoystick = {}
MockJoystick.__index = MockJoystick

local _mockJoysticks = {}

local function getMockJoystick(id)
  if not _mockJoysticks[id] then
    local j = setmetatable({}, MockJoystick)
    j._id = id
    j._name = "Virtual Controller " .. id
    j._guid = "virtual-" .. id
    j._axes = {}
    j._buttons = {}
    _mockJoysticks[id] = j
  end
  return _mockJoysticks[id]
end

function MockJoystick:getID() return self._id end
function MockJoystick:getName() return self._name end
function MockJoystick:getGUID() return self._guid end
function MockJoystick:isGamepad() return true end
function MockJoystick:isConnected() return true end
function MockJoystick:getGamepadAxis(axis) return self._axes[axis] or 0 end
function MockJoystick:isGamepadDown(button) return self._buttons[button] or false end
function MockJoystick:getAxisCount() return 6 end
function MockJoystick:getButtonCount() return 16 end
function MockJoystick:getHatCount() return 0 end

--- Simulate connecting a virtual controller.
function Testrunner.gamepad_connect(args)
  local id = (args and args.joystickId) or 1
  local mock = getMockJoystick(id)
  -- Fire joystickadded if available
  local ReactJIT = require("lua.init")
  if ReactJIT.joystickadded then
    ReactJIT.joystickadded(mock)
  end
  return { joystickId = id }
end

--- Simulate a gamepad button press.
function Testrunner.gamepad_pressed(args)
  local id = (args and args.joystickId) or 1
  local button = args and args.button
  if not button then return { error = "missing button" } end
  local mock = getMockJoystick(id)
  mock._buttons[button] = true
  local ReactJIT = require("lua.init")
  if ReactJIT.gamepadpressed then
    ReactJIT.gamepadpressed(mock, button)
  end
  return {}
end

--- Simulate a gamepad button release.
function Testrunner.gamepad_released(args)
  local id = (args and args.joystickId) or 1
  local button = args and args.button
  if not button then return { error = "missing button" } end
  local mock = getMockJoystick(id)
  mock._buttons[button] = false
  local ReactJIT = require("lua.init")
  if ReactJIT.gamepadreleased then
    ReactJIT.gamepadreleased(mock, button)
  end
  return {}
end

--- Simulate a gamepad axis movement.
function Testrunner.gamepad_axis(args)
  local id = (args and args.joystickId) or 1
  local axis = args and args.axis
  local value = (args and args.value) or 0
  if not axis then return { error = "missing axis" } end
  local mock = getMockJoystick(id)
  mock._axes[axis] = value
  local ReactJIT = require("lua.init")
  if ReactJIT.gamepadaxis then
    ReactJIT.gamepadaxis(mock, axis, value)
  end
  return {}
end

--- Query focus state — returns the currently focused node's info.
function Testrunner.get_focused(args)
  local focus = require("lua.focus")
  local node = focus.get()
  if not node then return { found = false } end
  local c = node.computed or {}
  return {
    found = true,
    id = node.id,
    type = node.type,
    debugName = node.debugName or node.type,
    props = safeProps(node),
    text = nodeText(node),
    x = c.x or 0, y = c.y or 0,
    w = c.w or 0, h = c.h or 0,
  }
end

--- Query scroll state of a node by type/props.
function Testrunner.get_scroll(args)
  local queryType  = args and args.type
  local queryProps = args and args.props
  local nodes = Tree.getNodes()
  for _, node in pairs(nodes) do
    if matchesQuery(node, queryType, queryProps) then
      if node.scrollState then
        local ss = node.scrollState
        local c = node.computed or {}
        return {
          found = true,
          id = node.id,
          scrollX = ss.scrollX or 0,
          scrollY = ss.scrollY or 0,
          contentW = ss.contentW or 0,
          contentH = ss.contentH or 0,
          viewportW = c.w or 0,
          viewportH = c.h or 0,
        }
      end
    end
  end
  return { found = false }
end

--- Query all focusable nodes in the active group.
function Testrunner.get_focusables(_args)
  local focus = require("lua.focus")
  local rings = focus.getAllRings()
  local focused = focus.getAllFocused()
  local result = { rings = {}, focused = {} }
  for _, r in ipairs(rings or {}) do
    result.rings[#result.rings + 1] = { x = r.x, y = r.y, w = r.w, h = r.h }
  end
  for _, f in ipairs(focused or {}) do
    local c = f.node and f.node.computed or {}
    result.focused[#result.focused + 1] = {
      id = f.node and f.node.id,
      debugName = f.node and (f.node.debugName or f.node.type),
      text = f.node and nodeText(f.node) or "",
      x = c.x or 0, y = c.y or 0,
      w = c.w or 0, h = c.h or 0,
    }
  end
  return result
end

--- Emit a single TEST_PASS or TEST_FAIL line to stdout immediately.
--- Used by sweep tests that report per-component results in real time.
function Testrunner.emit(args)
  if args.passed then
    io.write("TEST_PASS: " .. tostring(args.name) .. "\n")
  else
    io.write("TEST_FAIL: " .. tostring(args.name) .. ": " .. tostring(args.error or "unknown") .. "\n")
  end
  io.flush()
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
