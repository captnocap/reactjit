--[[
  diagnostics.lua -- Ghost node diagnostic for ReactJIT

  Walks the full node tree after layout and classifies every node by paint
  status. Nodes that exist in the tree but won't get painted are "ghosts" —
  this module tells you which ones and why.

  Triggered via env var:  ILOVEREACT_DIAGNOSE=1
  Integrated into sdl2_init.lua run loop (waits 3 frames, runs, exits).

  Output format (structured, parseable by CLI):
    GHOST_DIAG:START
    GHOST_DIAG:NODE id=42 type=View status=zero-size ...
    GHOST_DIAG:SUMMARY total=N painted=N ghost=N info=N
    GHOST_DIAG:END
]]

local Diagnostics = {}

-- ============================================================================
-- Env var check
-- ============================================================================

function Diagnostics.isEnabled()
  return os.getenv("ILOVEREACT_DIAGNOSE") == "1"
end

-- ============================================================================
-- Node classification
-- ============================================================================

-- Status categories:
--   painted        — visible, has non-zero computed rect, passes all painter checks
--   no-computed    — node.computed is nil (never laid out, orphan)
--   zero-size      — layout ran but resolved to 0x0
--   display-none   — style.display == "none"
--   opacity-zero   — effective opacity is 0
--   non-visual-cap — non-visual capability (Audio, Timer, etc.) — expected
--   own-surface    — renders in own window (Window cap) — expected
--   off-screen     — computed rect entirely outside viewport
--   no-parent      — exists in nodes table but never appended to tree

-- Statuses that are informational (expected, not bugs)
local INFO_STATUSES = {
  ["non-visual-cap"] = true,
  ["own-surface"] = true,
}

local function classifyNode(node, capabilities, vpW, vpH, rootChildren)
  -- Check if node has a parent or is a root child
  if not node.parent then
    local isRoot = false
    for _, rc in ipairs(rootChildren) do
      if rc.id == node.id then isRoot = true; break end
    end
    if not isRoot then
      return "no-parent"
    end
  end

  local s = node.style or {}

  -- Capability checks (before computed, since non-visual caps get zero-sized by layout)
  if capabilities then
    if capabilities.isNonVisual(node.type)
       and not capabilities.rendersInOwnSurface(node.type) then
      return "non-visual-cap"
    end
    if capabilities.rendersInOwnSurface(node.type)
       and not node._isWindowRoot then
      return "own-surface"
    end
  end

  -- display:none
  if s.display == "none" then
    return "display-none"
  end

  -- No computed rect at all
  if not node.computed then
    return "no-computed"
  end

  local c = node.computed

  -- Zero-size
  if c.w <= 0 and c.h <= 0 then
    return "zero-size"
  end

  -- Opacity zero
  if (s.opacity or 1) <= 0 then
    return "opacity-zero"
  end

  -- Off-screen (entirely outside viewport)
  if c.x + c.w < 0 or c.y + c.h < 0 or c.x > vpW or c.y > vpH then
    return "off-screen"
  end

  return "painted"
end

-- ============================================================================
-- Main diagnostic run
-- ============================================================================

--- Walk all nodes and classify them. Prints structured output to stdout.
--- @param tree       table  The tree module (has getNodes, getTree)
--- @param caps       table  The capabilities module (has isNonVisual, rendersInOwnSurface)
--- @param vpW        number Viewport width
--- @param vpH        number Viewport height
--- @return table     { total, painted, ghost, info, nodes = { {id, type, status, ...}, ... } }
function Diagnostics.run(tree, caps, vpW, vpH, quiet)
  local allNodes = tree.getNodes()

  -- Build root children list for orphan detection
  local root = tree.getTree()
  local rootChildren = {}
  if root then
    if root._isSyntheticRoot then
      rootChildren = root.children or {}
    else
      rootChildren = { root }
    end
  end

  local results = {
    total = 0,
    painted = 0,
    ghost = 0,
    info = 0,
    nodes = {},
  }

  if not quiet then io.write("GHOST_DIAG:START\n") end

  for id, node in pairs(allNodes) do
    results.total = results.total + 1
    local status = classifyNode(node, caps, vpW, vpH, rootChildren)

    if status == "painted" then
      results.painted = results.painted + 1
    elseif INFO_STATUSES[status] then
      results.info = results.info + 1
      -- Still report info-level nodes
      results.nodes[#results.nodes + 1] = {
        id = id,
        type = node.type,
        status = status,
        debugName = node.debugName,
        parentId = node.parent and node.parent.id or nil,
        computed = node.computed,
      }
    else
      results.ghost = results.ghost + 1
      results.nodes[#results.nodes + 1] = {
        id = id,
        type = node.type,
        status = status,
        debugName = node.debugName,
        parentId = node.parent and node.parent.id or nil,
        computed = node.computed,
      }
    end
  end

  -- Sort by status (ghosts first, then info), then by id
  table.sort(results.nodes, function(a, b)
    local aIsInfo = INFO_STATUSES[a.status] and 1 or 0
    local bIsInfo = INFO_STATUSES[b.status] and 1 or 0
    if aIsInfo ~= bIsInfo then return aIsInfo < bIsInfo end
    return tostring(a.id) < tostring(b.id)
  end)

  -- Print each ghost/info node (only in non-quiet mode, for CLI parsing)
  if not quiet then
    for _, entry in ipairs(results.nodes) do
      local c = entry.computed
      local computedStr = "none"
      if c then
        computedStr = string.format("%dx%d@(%d,%d)", c.w, c.h, c.x, c.y)
      end
      io.write(string.format(
        "GHOST_DIAG:NODE id=%s type=%s status=%s computed=%s debugName=%s parent=%s\n",
        tostring(entry.id),
        tostring(entry.type),
        entry.status,
        computedStr,
        tostring(entry.debugName or "-"),
        tostring(entry.parentId or "none")
      ))
    end

    io.write(string.format(
      "GHOST_DIAG:SUMMARY total=%d painted=%d ghost=%d info=%d\n",
      results.total, results.painted, results.ghost, results.info
    ))
    io.write("GHOST_DIAG:END\n")
    io.flush()
  end

  return results
end

return Diagnostics
