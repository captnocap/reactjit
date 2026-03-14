--[[
  devtools/tab_wireframe.lua — Wireframe tab: mini viewport showing all nodes as outlines

  Extracted from devtools/main.lua. Draws a scaled wireframe of the entire
  instance tree with depth-based coloring, render-count heatmapping, and an
  optional flex-pressure overlay that visualises flex distribution on
  selected containers.

  Usage:
    local wf = require("lua.devtools.tab_wireframe")
    wf.draw(ctx, root, region)
    local node = wf.hitTest(x, y)
]]

local Style = require("lua.devtools.style")

local M = {}

-- ============================================================================
-- Module-local state
-- ============================================================================

local wfHoverNode  = nil    -- node under cursor in wireframe
local wfNodeRects  = {}     -- array of { node, sx, sy, sw, sh } for hit testing
local wfLastRootId = nil    -- track root identity to detect tree rebuilds (HMR)
local wfShowFlex   = true   -- flex pressure overlay toggle
local flexToggleRect = nil  -- { x, y, w, h } for the flex pill button

-- ============================================================================
-- Helpers
-- ============================================================================

--- Get the depth-based color for a node.
local function getWfDepthColor(depth)
  local colors = Style.wireframe.depthColors
  local idx = math.min(depth + 1, #colors)
  return colors[idx]
end

-- ============================================================================
-- drawWfNode — recursive wireframe renderer
-- ============================================================================

--- Recursively draw nodes as wireframe outlines.
--- @param node table         The tree node
--- @param scale number       Scale factor (viewport -> region)
--- @param offX number        X offset in screen coords
--- @param offY number        Y offset in screen coords
--- @param depth number       Tree depth (for color)
--- @param clipRect table|nil { x1, y1, x2, y2 } in scaled coords — parent's clip bounds
--- @param inspector table|nil Inspector module for selection queries
--- @param getFont function   Returns the small font
local function drawWfNode(node, scale, offX, offY, depth, clipRect, inspector, getFont)
  if not node or not node.computed then return end
  local c = node.computed
  if c.w <= 0 or c.h <= 0 then return end

  -- Scaled screen coordinates
  local sx = offX + c.x * scale
  local sy = offY + c.y * scale
  local sw = c.w * scale
  local sh = c.h * scale

  -- Skip tiny rects (less than 1px either dimension)
  if sw < 1 and sh < 1 then return end

  -- Clip: skip nodes entirely outside, clamp partial overlaps to clip bounds
  if clipRect then
    if sx + sw < clipRect.x1 or sx > clipRect.x2 then return end
    if sy + sh < clipRect.y1 or sy > clipRect.y2 then return end
    -- Clamp visible rect to clip bounds
    local cx1 = math.max(sx, clipRect.x1)
    local cy1 = math.max(sy, clipRect.y1)
    local cx2 = math.min(sx + sw, clipRect.x2)
    local cy2 = math.min(sy + sh, clipRect.y2)
    sx, sy, sw, sh = cx1, cy1, cx2 - cx1, cy2 - cy1
    if sw < 1 or sh < 1 then return end
  end

  -- Store for hit testing (clamped rect)
  wfNodeRects[#wfNodeRects + 1] = { node = node, sx = sx, sy = sy, sw = sw, sh = sh }

  -- Determine color
  local isSelected = inspector and inspector.getSelectedNode() == node
  local isHovered = wfHoverNode == node

  local wf = Style.wireframe

  if isSelected then
    -- Selected: filled highlight + bright outline
    love.graphics.setColor(wf.selected[1], wf.selected[2], wf.selected[3], 0.15)
    love.graphics.rectangle("fill", sx, sy, sw, sh)
    love.graphics.setColor(wf.selected)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", sx, sy, sw, sh)
    love.graphics.setLineWidth(1)
  elseif isHovered then
    -- Hovered: subtle fill + outline
    love.graphics.setColor(wf.hover[1], wf.hover[2], wf.hover[3], 0.10)
    love.graphics.rectangle("fill", sx, sy, sw, sh)
    love.graphics.setColor(wf.hover)
    love.graphics.rectangle("line", sx, sy, sw, sh)
  else
    -- Normal: classify by render count for non-text nodes
    local col
    if node.type == "__TEXT__" then
      col = wf.textNode
    else
      local rc = node.renderCount or 0
      if rc > 20 then
        col = Style.perf.hotspot
      elseif rc > 1 then
        col = Style.perf.reactive
      else
        col = getWfDepthColor(depth)
      end
    end
    love.graphics.setColor(col)
    love.graphics.rectangle("line", sx, sy, sw, sh)
  end

  -- Label only on selected node (avoids visual clutter that looks like clipping)
  if isSelected and sw > 30 and sh > 12 and node.type ~= "__TEXT__" then
    local label = node.debugName or node.type or ""
    if #label > 0 then
      local font = getFont()
      local labelW = font:getWidth(label)
      if labelW < sw - 4 then
        love.graphics.setColor(wf.selected)
        love.graphics.setFont(font)
        love.graphics.print(label, sx + 2, sy + 1)
      end
    end
  end

  -- Recurse into children — propagate clip rect for overflow containers
  if node.children then
    local childClip = clipRect
    local s = node.style or {}
    if s.overflow == "hidden" or s.overflow == "scroll" or s.overflow == "auto" then
      -- This node clips its children to its own bounds
      childClip = { x1 = sx, y1 = sy, x2 = sx + sw, y2 = sy + sh }
    end
    for _, child in ipairs(node.children) do
      drawWfNode(child, scale, offX, offY, depth + 1, childClip, inspector, getFont)
    end
  end
end

-- ============================================================================
-- drawFlexOverlay — flex pressure visualisation on selected container
-- ============================================================================

--- Draw the flex pressure overlay on the wireframe.
--- Shows flex distribution bars and summary when a flex container is selected.
local function drawFlexOverlay(selectedNode, scale, offX, offY, region, getFont)
  if not selectedNode then return end
  local c = selectedNode.computed
  if not c or not c.flexInfo then return end
  local fi = c.flexInfo

  local flex = Style.wireframe.flex

  -- Build lookup: childId -> screen rect from wfNodeRects
  local childRects = {}
  for _, r in ipairs(wfNodeRects) do
    childRects[r.node.id] = r
  end

  -- Find the selected node's own screen rect
  local selRect = childRects[selectedNode.id]
  if not selRect then return end

  local font = getFont()
  love.graphics.setFont(font)
  local fh = font:getHeight()

  for lineIdx, flexLine in ipairs(fi.lines) do
    if not flexLine then goto continueLine end
    local itemCount = #flexLine.items
    if itemCount == 0 then goto continueLine end

    -- Container summary header above the node
    if lineIdx == 1 then
      local summaryParts = {}
      summaryParts[#summaryParts + 1] = string.format("%.0fpx", fi.mainSize)
      summaryParts[#summaryParts + 1] = string.format("basis:%.0f", flexLine.totalBasis)
      if flexLine.freeSpace >= 0 then
        summaryParts[#summaryParts + 1] = string.format("free:%.0f", flexLine.freeSpace)
      else
        summaryParts[#summaryParts + 1] = string.format("over:%.0f", -flexLine.freeSpace)
      end
      summaryParts[#summaryParts + 1] = string.format("%d items", itemCount)
      local summary = table.concat(summaryParts, "  |  ")
      local tw = font:getWidth(summary)

      -- Position header above the selected node rect
      local hx = selRect.sx + math.floor((selRect.sw - tw) / 2)
      local hy = selRect.sy - fh - 6
      -- Clamp to region bounds
      hx = math.max(region.x + 2, math.min(hx, region.x + region.w - tw - 2))
      hy = math.max(region.y + 2, hy)

      -- Background pill
      love.graphics.setColor(flex.headerBg)
      love.graphics.rectangle("fill", hx - 4, hy - 1, tw + 8, fh + 2, 3, 3)
      -- Text
      love.graphics.setColor(flex.text)
      love.graphics.print(summary, hx, hy)
    end

    -- Draw allocation bars on each child
    local barH = 4  -- bar thickness in screen pixels
    local barW = 4  -- bar thickness for column direction

    for _, item in ipairs(flexLine.items) do
      local r = childRects[item.id]
      if not r then goto continueItem end
      if r.sw < 3 or r.sh < 3 then goto continueItem end

      local totalFinal = 0
      for _, it in ipairs(flexLine.items) do totalFinal = totalFinal + it.finalBasis end
      if totalFinal <= 0 then goto continueItem end

      if fi.isRow then
        -- Horizontal bar at bottom of child rect
        local barY = r.sy + r.sh - barH - 1

        -- Basis portion (gray)
        love.graphics.setColor(flex.basis)
        love.graphics.rectangle("fill", r.sx, barY, r.sw, barH)

        -- Delta portion overlay
        if math.abs(item.delta) > 0.5 then
          local deltaFrac = math.abs(item.delta) / fi.mainSize
          local deltaW = math.max(2, r.sw * deltaFrac * itemCount)
          deltaW = math.min(deltaW, r.sw)
          if item.delta > 0 then
            -- Grow: amber bar from right side of basis
            love.graphics.setColor(flex.grow)
            love.graphics.rectangle("fill", r.sx + r.sw - deltaW, barY, deltaW, barH)
          else
            -- Shrink: blue bar from right side
            love.graphics.setColor(flex.shrink)
            love.graphics.rectangle("fill", r.sx + r.sw - deltaW, barY, deltaW, barH)
          end
        end

        -- Label if wide enough
        if r.sw > 40 then
          local label
          if item.grow > 0 and item.delta > 0.5 then
            label = string.format("+%.0f (g:%.0f)", item.delta, item.grow)
          elseif item.delta < -0.5 then
            label = string.format("%.0f (s)", item.delta)
          else
            label = string.format("%.0fpx", item.finalBasis)
          end
          local lw = font:getWidth(label)
          if lw < r.sw - 4 then
            love.graphics.setColor(flex.text)
            love.graphics.print(label, r.sx + 2, barY - fh - 1)
          end
        end
      else
        -- Column: vertical bar at right of child rect
        local barX = r.sx + r.sw - barW - 1

        love.graphics.setColor(flex.basis)
        love.graphics.rectangle("fill", barX, r.sy, barW, r.sh)

        -- Delta portion overlay
        if math.abs(item.delta) > 0.5 then
          local deltaFrac = math.abs(item.delta) / fi.mainSize
          local deltaH = math.max(2, r.sh * deltaFrac * itemCount)
          deltaH = math.min(deltaH, r.sh)
          if item.delta > 0 then
            love.graphics.setColor(flex.grow)
            love.graphics.rectangle("fill", barX, r.sy + r.sh - deltaH, barW, deltaH)
          else
            love.graphics.setColor(flex.shrink)
            love.graphics.rectangle("fill", barX, r.sy + r.sh - deltaH, barW, deltaH)
          end
        end

        -- Label if tall enough
        if r.sh > 40 and r.sw > 30 then
          local label
          if item.grow > 0 and item.delta > 0.5 then
            label = string.format("+%.0f", item.delta)
          elseif item.delta < -0.5 then
            label = string.format("%.0f", item.delta)
          else
            label = string.format("%.0f", item.finalBasis)
          end
          love.graphics.setColor(flex.text)
          love.graphics.print(label, barX - font:getWidth(label) - 2, r.sy + 2)
        end
      end

      ::continueItem::
    end

    ::continueLine::
  end
end

-- ============================================================================
-- M.draw — main draw entry point for the wireframe tab
-- ============================================================================

--- Draw the wireframe tab content.
--- @param ctx table   { inspector, getFont }
--- @param root table  Root instance tree node
--- @param region table { x, y, w, h }
function M.draw(ctx, root, region)
  if not root then return end

  local inspector = ctx.inspector
  local getFont   = ctx.getFont

  local wf = Style.wireframe

  -- Detect tree rebuild (HMR) — root node ID changes when tree is torn down
  local rootId = root.id
  if wfLastRootId and rootId ~= wfLastRootId then
    wfHoverNode = nil
    wfNodeRects = {}
  end
  wfLastRootId = rootId

  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  -- Dark background for the viewport area
  love.graphics.setColor(wf.bg)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)

  -- Use the root node's computed size as the viewport — this is what the
  -- layout engine actually used, regardless of window resize or panel docking.
  local appW, appH
  if root.computed and root.computed.w > 0 and root.computed.h > 0 then
    appW = root.computed.w
    appH = root.computed.h
  else
    appW, appH = love.graphics.getDimensions()
  end

  if appW <= 0 or appH <= 0 then
    love.graphics.setScissor()
    return
  end

  -- Compute scale to fit app viewport into the wireframe region with padding
  local pad = 16
  local availW = region.w - pad * 2
  local availH = region.h - pad * 2
  if availW <= 0 or availH <= 0 then
    love.graphics.setScissor()
    return
  end

  local scaleX = availW / appW
  local scaleY = availH / appH
  local scale = math.min(scaleX, scaleY)

  -- Center the viewport representation in the region
  local scaledW = appW * scale
  local scaledH = appH * scale
  local offX = region.x + pad + math.floor((availW - scaledW) / 2)
  local offY = region.y + pad + math.floor((availH - scaledH) / 2)

  -- Draw viewport border
  love.graphics.setColor(wf.viewportBorder)
  love.graphics.rectangle("line", offX - 1, offY - 1, scaledW + 2, scaledH + 2)

  -- Clear hit test rects and rebuild during draw
  wfNodeRects = {}

  -- Draw all nodes recursively
  love.graphics.setLineWidth(1)
  drawWfNode(root, scale, offX, offY, 0, nil, inspector, getFont)

  -- Flex pressure overlay
  local flexHasOverlay = false
  if wfShowFlex and inspector then
    local selNode = inspector.getSelectedNode()
    if selNode then
      local c = selNode.computed
      if c and c.flexInfo then
        flexHasOverlay = true
        drawFlexOverlay(selNode, scale, offX, offY, region, getFont)
      end
    end
  end

  -- Bottom bar: scale label + flex toggle
  local font = getFont()
  love.graphics.setFont(font)
  local fh = font:getHeight()
  local bottomY = region.y + region.h - fh - 10

  -- Flex toggle pill button (left side)
  local flexLabel = wfShowFlex and "\xe2\x97\x8f Flex" or "\xe2\x97\x8b Flex"  -- filled/hollow circle
  local flexTw = font:getWidth(flexLabel)
  local pillPadX, pillPadY = 8, 3
  local pillX = region.x + 8
  local pillY = bottomY - pillPadY
  local pillW = flexTw + pillPadX * 2
  local pillH = fh + pillPadY * 2

  -- Check hover for visual feedback
  local mx, my = love.mouse.getPosition()
  local isFlexHover = mx >= pillX and mx < pillX + pillW and my >= pillY and my < pillY + pillH

  local flex = wf.flex

  if wfShowFlex then
    -- Active: solid pill using flex.grow color with different alphas
    local gr = flex.grow
    love.graphics.setColor(gr[1], gr[2], gr[3], isFlexHover and 0.45 or 0.30)
    love.graphics.rectangle("fill", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(gr[1], gr[2], gr[3], 0.90)
    love.graphics.rectangle("line", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(gr[1], gr[2] + 0.10, gr[3] + 0.20, 1)
  else
    -- Inactive: ghost pill using palette.textMuted with low alphas
    local tm = Style.palette.textMuted
    love.graphics.setColor(tm[1], tm[2], tm[3], isFlexHover and 0.20 or 0.05)
    love.graphics.rectangle("fill", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(tm[1], tm[2], tm[3], 0.35)
    love.graphics.rectangle("line", pillX, pillY, pillW, pillH, 4, 4)
    love.graphics.setColor(tm[1], tm[2], tm[3], 0.50)
  end
  love.graphics.print(flexLabel, pillX + pillPadX, bottomY)

  -- Hint when flex is on but no overlay is showing
  if wfShowFlex and not flexHasOverlay then
    local hint = "click a flex container to see distribution"
    local hintW = font:getWidth(hint)
    local hintX = pillX + pillW + 10
    love.graphics.setColor(Style.palette.textMuted[1], Style.palette.textMuted[2], Style.palette.textMuted[3], 0.50)
    love.graphics.print(hint, hintX, bottomY)
  end

  -- Store flex toggle hit rect for click handling
  flexToggleRect = { x = pillX, y = pillY, w = pillW, h = pillH }

  -- Scale label (right side)
  love.graphics.setColor(Style.statusBar.text)
  local scaleLabel = string.format("%.0f%%", scale * 100)
  local labelW = font:getWidth(scaleLabel)
  love.graphics.print(scaleLabel, region.x + region.w - labelW - 8, bottomY)

  love.graphics.setScissor()
end

-- ============================================================================
-- M.hitTest — find deepest node under cursor
-- ============================================================================

--- Hit test wireframe tab: find the deepest (last-drawn) node under the cursor.
--- @param x number Screen X
--- @param y number Screen Y
--- @return table|nil The tree node under the cursor, or nil
function M.hitTest(x, y)
  -- Walk in reverse order (last drawn = frontmost / deepest)
  for i = #wfNodeRects, 1, -1 do
    local r = wfNodeRects[i]
    if x >= r.sx and x < r.sx + r.sw and y >= r.sy and y < r.sy + r.sh then
      return r.node
    end
  end
  return nil
end

-- ============================================================================
-- Accessors
-- ============================================================================

function M.getHoverNode()
  return wfHoverNode
end

function M.setHoverNode(node)
  wfHoverNode = node
end

--- Clear wireframe stale state (call on HMR or manual refresh).
function M.refresh(ctx)
  wfHoverNode = nil
  wfNodeRects = {}
  wfLastRootId = nil
  local inspector = ctx and ctx.inspector
  if inspector then inspector.clearSelection() end
end

--- Get the flex toggle button's hit rect.
--- @return table|nil { x, y, w, h }
function M.getFlexToggle()
  return flexToggleRect
end

--- Toggle flex pressure overlay on/off.
function M.toggleFlex()
  wfShowFlex = not wfShowFlex
end

--- Query whether flex overlay is currently enabled.
--- @return boolean
function M.isFlexOn()
  return wfShowFlex
end

return M
