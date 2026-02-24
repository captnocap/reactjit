--[[
  search.lua — App-wide text search over the live node tree.

  Two tiers:

    Hot  — direct node refs, built from the live rendered tree each query.
           Zero indirection: the match IS the node. Scroll to it, highlight it,
           inspect its parent — all immediate. The structural path ("2.0.1")
           is the node's address in the live tree, derived the same way the
           reconciler derives it during diffing. No IDs, no registration.

    Cold — structural paths + text extracted at compile time by `rjit search-index`.
           Covers stories/screens that aren't currently rendered. When a result is
           selected, the target mounts and the path resolves directly.

  RPC surface:
    search:query    { query }          → [{ path, text, context, x, y, w, h, matchStart, matchEnd }]
    search:navigate { path?, text? }   → scroll + highlight the node (by path or text content)
    search:clear    {}                 → remove active highlight
]]

local Search = {}

-- ── Hot index ───────────────────────────────────────────────

-- Text-bearing props to harvest from non-__TEXT__ nodes
local TEXT_PROPS = { "placeholder", "label", "description", "title" }

--- Build a flat index of all text-bearing nodes in the live tree.
--- Returns array of { node, text, path, context }.
---   path    = "2.0.1"  — dot-separated 0-based child indices from root.
---             Same addressing the reconciler uses for diffing: [root, child[2], child[0], child[1]].
---             Resolves back to a live node via resolvePath() with zero lookup overhead.
---   context = ["Text", "ScrollView", ...]  — ancestor types, innermost first
function Search.buildHotIndex(root)
  local index = {}

  local function walk(node, pathParts, context)
    -- Explicit text nodes
    if node.type == "__TEXT__" then
      local t = node.text
      if t and type(t) == "string" and t:match("%S") then
        index[#index + 1] = {
          node    = node,
          text    = t,
          path    = table.concat(pathParts, "."),
          context = context,
        }
      end
    else
      -- Text-bearing props on any element (placeholder, label, etc.)
      if node.props then
        for _, prop in ipairs(TEXT_PROPS) do
          local v = node.props[prop]
          if v and type(v) == "string" and v:match("%S") then
            index[#index + 1] = {
              node    = node,
              text    = v,
              path    = table.concat(pathParts, ".") .. ":" .. prop,
              context = context,
              propKey = prop,
            }
          end
        end
      end
    end

    -- Recurse into children with path tracking
    if node.children then
      local childCtx = context
      if node.type ~= "__TEXT__" and node.type ~= "View" then
        childCtx = { node.type }
        for i = 1, #context do childCtx[i + 1] = context[i] end
      end
      for i, child in ipairs(node.children) do
        local childPath = { table.unpack(pathParts) }
        childPath[#childPath + 1] = tostring(i - 1)  -- 0-based (matches reconciler)
        walk(child, childPath, childCtx)
      end
    end
  end

  if root then walk(root, {}, {}) end
  return index
end

--- Case-insensitive substring query over a hot index.
--- Returns matched entries with layout coordinates and match range.
function Search.query(hotIndex, q)
  if not q or q == "" then return {} end
  q = q:lower()
  local results = {}
  for _, entry in ipairs(hotIndex) do
    local lower = entry.text:lower()
    local s = lower:find(q, 1, true)
    if s then
      local c = entry.node.computed
      results[#results + 1] = {
        node       = entry.node,
        text       = entry.text,
        path       = entry.path,
        context    = entry.context,
        propKey    = entry.propKey,
        matchStart = s,
        matchEnd   = s + #q - 1,
        x = c and c.x or 0,
        y = c and c.y or 0,
        w = c and c.w or 0,
        h = c and c.h or 0,
      }
    end
  end
  return results
end

--- Resolve a structural path back to a live node.
--- path = "2.0.1" → root.children[3].children[1].children[2]  (0-based → 1-based)
--- This is deterministic and mirrors the reconciler's fiber path.
function Search.resolvePath(root, path)
  if not path or path == "" then return root end
  local node = root
  for part in path:gmatch("[^%.]+") do
    if part:find(":") then break end  -- prop suffix ("3:placeholder"), stop here
    local idx = tonumber(part)
    if not idx or not node.children then return nil end
    node = node.children[idx + 1]    -- 0-based → 1-based
    if not node then return nil end
  end
  return node
end

-- ── Navigation & highlight ───────────────────────────────────

local _highlightNode  = nil
local _highlightTimer = 0

--- Scroll to + flash-highlight a node.
--- If the node is inside a ScrollView, scrolls to make it visible.
function Search.navigateTo(node)
  if not node then return end
  _highlightNode  = node
  _highlightTimer = 2.0  -- seconds (fades out in the last 0.5s)

  local c = node.computed
  if not c then return end

  -- Walk parent chain to find enclosing ScrollView(s) and reveal the node
  local ancestor = node.parent
  while ancestor do
    if ancestor.type == "ScrollView" and ancestor.scrollState then
      local ac = ancestor.computed
      if ac then
        local ss = ancestor.scrollState
        -- node.computed.y is absolute screen position.
        -- Content offset within ScrollView = absolute_y - sv_y + current_scrollY
        local contentY = c.y - ac.y + (ss.scrollY or 0)
        -- Center the node in the viewport
        local targetY  = contentY - (ac.h * 0.5) + (c.h * 0.5)
        local maxY     = math.max(0, (ss.contentH or 0) - ac.h)
        ss.scrollY     = math.max(0, math.min(targetY, maxY))
      end
      break
    end
    ancestor = ancestor.parent
  end
end

--- Navigate by text content — for cold-tier results that need post-mount resolution.
--- After a story/screen mounts, this finds the node by text and navigates to it.
function Search.navigateByText(root, text)
  if not root or not text then return false end
  local hotIndex = Search.buildHotIndex(root)
  local lower = text:lower()
  for _, entry in ipairs(hotIndex) do
    if entry.text:lower() == lower then
      Search.navigateTo(entry.node)
      return true
    end
  end
  return false
end

--- Advance the highlight fade timer. Call once per frame with dt seconds.
function Search.tick(dt)
  if _highlightTimer > 0 then
    _highlightTimer = _highlightTimer - dt
    if _highlightTimer <= 0 then
      _highlightTimer = 0
      _highlightNode  = nil
    end
  end
end

--- Return current highlight state for drawing: { node, alpha } or nil.
--- Alpha is 1.0 during active phase, fades to 0 in last 0.5s.
function Search.getHighlight()
  if not _highlightNode then return nil end
  local alpha = math.min(1.0, _highlightTimer / 0.5)
  return { node = _highlightNode, alpha = alpha }
end

--- Clear the active highlight immediately.
function Search.clearHighlight()
  _highlightNode  = nil
  _highlightTimer = 0
end

return Search
