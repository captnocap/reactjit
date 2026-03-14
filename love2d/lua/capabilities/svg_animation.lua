--[[
  capabilities/svg_animation.lua — Animated SVG rendering capability.

  Four effects:
    reveal   — Stroke draw-on: progressively reveals SVG paths
    morph    — Interpolates geometry between two SVGs
    elements — Per-element animation (transform, color, opacity) by ID
    follow   — Computes position along an SVG path, pushes {x,y,angle} to React

  React usage:
    <SVGAnimation src={svgString} effect="reveal" duration={2000} />
    <SVGAnimation src={svgA} srcTo={svgB} effect="morph" duration={1500} loop />
    <SVGAnimation src={svg} effect="elements" targets={{ "eye": { opacity: 0, duration: 500 } }} />
    <SVGAnimation src={svg} effect="follow" pathId="track" duration={3000} onProgress={handlePos} />
]]

local Capabilities = require("lua.capabilities")
local SVG = require("lua.svg")
local SVGAnim = require("lua.svg_animate")
local Color = require("lua.color")

local min = math.min
local max = math.max

-- ============================================================================
-- Helpers
-- ============================================================================

--- Try to parse an SVG from string content or file path.
local function parseSVG(src)
  if not src or src == "" then return nil end
  -- If it starts with < it's inline SVG
  if src:sub(1, 1) == "<" then
    return SVG.parse(src)
  end
  return SVG.load(src)
end

--- Parse a color string to {r,g,b,a} table.
local function parseColorProp(val)
  if not val or val == "" then return nil end
  if type(val) == "table" then return val end
  local r, g, b, a = Color.parse(val)
  if r then return { r, g, b, a } end
  return nil
end

--- Pre-compute arc-length data for all subpaths in all elements of a doc.
local function precomputeLengths(doc)
  if not doc then return {}, 0 end
  local elemData = {}
  local grandTotal = 0

  for i, elem in ipairs(doc.elements) do
    local spData = {}
    local elemTotal = 0
    for j, sp in ipairs(elem.subpaths) do
      local cumDist, totalLen, n = SVGAnim.polylineCumDist(sp)
      spData[j] = { cumDist = cumDist, totalLen = totalLen, n = n }
      elemTotal = elemTotal + totalLen
    end
    elemData[i] = { subpaths = spData, totalLen = elemTotal }
    grandTotal = grandTotal + elemTotal
  end

  return elemData, grandTotal
end

-- ============================================================================
-- Effect: Reveal (stroke draw-on)
-- ============================================================================

local function renderReveal(node, c, opacity, state)
  local doc = state.doc
  if not doc then return end

  local x, y, w, h = c.x, c.y, c.w, c.h
  local scale = state.scale or 1
  local t = state.easedT or 0
  local grandTotal = state.grandTotal
  local props = node.props or {}

  -- Resolve override colors
  local strokeCol = state.strokeColorParsed
  local strokeW = props.strokeWidth

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(scale, scale)

  local distSoFar = 0

  for i, elem in ipairs(doc.elements) do
    local ed = state.elemData[i]
    if not ed then goto continueElem end

    local fill = elem.fill
    local stroke = strokeCol or elem.stroke or fill
    local sw = strokeW or elem.strokeWidth or 2

    for j, sp in ipairs(elem.subpaths) do
      local spd = ed.subpaths[j]
      if not spd or spd.n < 2 then goto continueSp end

      -- Map global t to this subpath's range
      local spStart = distSoFar / max(grandTotal, 1e-6)
      local spEnd = (distSoFar + spd.totalLen) / max(grandTotal, 1e-6)
      distSoFar = distSoFar + spd.totalLen

      local localT = 0
      if t >= spEnd then
        localT = 1
      elseif t > spStart then
        localT = (t - spStart) / max(spEnd - spStart, 1e-6)
      end

      if localT <= 0 then goto continueSp end

      -- Draw partial stroke
      local partial = SVGAnim.slicePolyline(sp, spd.cumDist, spd.n, spd.totalLen, localT)
      if #partial >= 4 then
        if stroke then
          local a = (stroke[4] or 1) * (elem.opacity or 1) * opacity
          love.graphics.setColor(stroke[1], stroke[2], stroke[3], a)
        else
          love.graphics.setColor(1, 1, 1, opacity)
        end
        love.graphics.setLineWidth(sw * scale)
        love.graphics.setLineJoin("bevel")
        love.graphics.line(partial)
      end

      -- Optionally reveal fill when subpath is fully drawn
      if props.fillReveal and localT >= 1 and fill and elem.closed[j] and #sp >= 6 then
        local a = (fill[4] or 1) * (elem.opacity or 1) * (elem.fillOpacity or 1) * opacity
        love.graphics.setColor(fill[1], fill[2], fill[3], a)
        local tris = elem.triangles[j]
        if tris then
          for _, tri in ipairs(tris) do
            love.graphics.polygon("fill", tri)
          end
        else
          pcall(love.graphics.polygon, "fill", sp)
        end
      end

      ::continueSp::
    end
    ::continueElem::
  end

  love.graphics.pop()
end

-- ============================================================================
-- Effect: Morph (interpolate between two SVGs)
-- ============================================================================

local function renderMorph(node, c, opacity, state)
  local matched = state.matched
  if not matched or #matched == 0 then return end

  local x, y = c.x, c.y
  local scale = state.scale or 1
  local t = state.easedT or 0

  love.graphics.push()
  love.graphics.translate(x, y)
  love.graphics.scale(scale, scale)

  for _, pair in ipairs(matched) do
    local verts = SVGAnim.lerpVertices(pair.vertsA, pair.vertsB, t)
    local fill = SVGAnim.lerpColor(pair.fillA, pair.fillB, t)
    local stroke = SVGAnim.lerpColor(pair.strokeA, pair.strokeB, t)
    local sw = pair.strokeWidthA * (1 - t) + pair.strokeWidthB * t
    local closed = t < 0.5 and pair.closedA or pair.closedB

    -- Fill
    if fill and closed and #verts >= 6 then
      love.graphics.setColor(fill[1], fill[2], fill[3], (fill[4] or 1) * opacity)
      local ok, tris = pcall(love.math.triangulate, verts)
      if ok and tris then
        for _, tri in ipairs(tris) do
          love.graphics.polygon("fill", tri)
        end
      else
        -- Fallback: try direct polygon (works for convex)
        pcall(love.graphics.polygon, "fill", verts)
      end
    end

    -- Stroke
    if stroke and #verts >= 4 then
      love.graphics.setColor(stroke[1], stroke[2], stroke[3], (stroke[4] or 1) * opacity)
      love.graphics.setLineWidth(sw * scale)
      love.graphics.setLineJoin("bevel")
      love.graphics.line(verts)
    end
  end

  love.graphics.pop()
end

-- ============================================================================
-- Effect: Elements (per-element animation by ID)
-- ============================================================================

local function renderElements(node, c, opacity, state)
  local doc = state.doc
  if not doc then return end

  local x, y = c.x, c.y
  local scale = state.scale or 1
  local targets = state.targets or {}
  local elapsed = state.elapsed or 0

  for _, elem in ipairs(doc.elements) do
    local target = elem.id and targets[elem.id]

    if target then
      -- Compute per-element progress
      local delay = (target.delay or 0)
      local dur = (target.duration or state.duration or 2000)
      local easingName = target.easing or state.easingName or "easeInOut"
      local elemElapsed = elapsed - delay
      local rawT = 0
      if elemElapsed > 0 then
        rawT = min(elemElapsed / max(dur, 1), 1)
      end
      local et = SVGAnim.resolveEasing(easingName, rawT)

      -- Interpolate fill
      local fillOverride = nil
      if target.fill then
        local targetFill = parseColorProp(target.fill)
        if targetFill then
          fillOverride = SVGAnim.lerpColor(elem.fill, targetFill, et)
        end
      end

      -- Interpolate opacity
      local opOverride = nil
      if target.opacity ~= nil then
        opOverride = elem.opacity * (1 - et) + target.opacity * et
      end

      -- Apply transform
      love.graphics.push()
      love.graphics.translate(x, y)
      love.graphics.scale(scale, scale)

      -- Per-element transform (translate, rotate, scale around element center)
      local tx = (target.translateX or 0) * et
      local ty = (target.translateY or 0) * et
      local rot = (target.rotate or 0) * et
      local sc = 1 + ((target.scale or 1) - 1) * et

      if tx ~= 0 or ty ~= 0 then
        love.graphics.translate(tx, ty)
      end

      if rot ~= 0 or sc ~= 1 then
        -- Find element center for rotation/scale pivot
        local sp = elem.subpaths[1]
        if sp and #sp >= 2 then
          local cx, cy = 0, 0
          local n = #sp / 2
          for vi = 1, n do
            cx = cx + sp[vi * 2 - 1]
            cy = cy + sp[vi * 2]
          end
          cx, cy = cx / n, cy / n
          love.graphics.translate(cx, cy)
          if rot ~= 0 then love.graphics.rotate(rot) end
          if sc ~= 1 then love.graphics.scale(sc, sc) end
          love.graphics.translate(-cx, -cy)
        end
      end

      SVG.drawElement(elem, 0, 0, 1, fillOverride, nil, opOverride)
      love.graphics.pop()
    else
      -- No animation target: draw normally
      SVG.drawElement(elem, x, y, scale)
    end
  end
end

-- ============================================================================
-- Effect: Follow (path following — position computed in tick, SVG drawn here)
-- ============================================================================

local function renderFollow(node, c, opacity, state)
  local doc = state.doc
  if not doc then return end
  SVG.draw(doc, c.x, c.y, state.scale or 1)
end

-- ============================================================================
-- Capability Registration
-- ============================================================================

Capabilities.register("SVGAnimation", {
  visual = true,

  schema = {
    src         = { type = "string",  desc = "SVG string or file path" },
    srcTo       = { type = "string",  desc = "Target SVG (morph effect only)" },
    effect      = { type = "string",  default = "reveal", desc = "reveal|morph|elements|follow" },
    duration    = { type = "number",  default = 2000,     desc = "Animation duration in ms" },
    easing      = { type = "string",  default = "easeInOut", desc = "Easing function name" },
    loop        = { type = "bool",    default = false,    desc = "Loop the animation" },
    playing     = { type = "bool",    default = true,     desc = "Play/pause control" },
    progress    = { type = "number",  desc = "Manual progress override 0-1 (bypasses timer)" },
    scale       = { type = "number",  default = 1,        desc = "Render scale factor" },
    -- Reveal
    strokeColor = { type = "string",  desc = "Override stroke color for reveal" },
    strokeWidth = { type = "number",  desc = "Override stroke width for reveal" },
    fillReveal  = { type = "bool",    default = false,    desc = "Also reveal fills progressively" },
    -- Elements
    targets     = { type = "table",   desc = "Per-element animation targets by ID" },
    -- Follow
    pathId      = { type = "string",  desc = "Element ID to use as motion path" },
  },

  events = { "onProgress", "onComplete" },

  create = function(nodeId, props)
    local doc = parseSVG(props.src)
    local elemData, grandTotal = precomputeLengths(doc)

    local state = {
      doc = doc,
      elemData = elemData,
      grandTotal = grandTotal,
      elapsed = 0,
      easedT = 0,
      effect = props.effect or "reveal",
      duration = props.duration or 2000,
      easingName = props.easing or "easeInOut",
      scale = props.scale or 1,
      playing = props.playing ~= false,
      loop = props.loop or false,
      completed = false,
      targets = props.targets,
      strokeColorParsed = parseColorProp(props.strokeColor),
      -- Morph state
      docTo = nil,
      matched = nil,
      -- Follow state
      followPath = nil,
      followCumDist = nil,
      followN = nil,
      followTotalLen = nil,
    }

    -- Morph: parse target SVG and match subpaths
    if state.effect == "morph" and props.srcTo then
      state.docTo = parseSVG(props.srcTo)
      if doc and state.docTo then
        state.matched = SVGAnim.matchSubpaths(doc, state.docTo)
      end
    end

    -- Follow: find the path element
    if state.effect == "follow" and doc and props.pathId then
      for _, elem in ipairs(doc.elements) do
        if elem.id == props.pathId and elem.subpaths[1] then
          local sp = elem.subpaths[1]
          local cd, tl, n = SVGAnim.polylineCumDist(sp)
          state.followPath = sp
          state.followCumDist = cd
          state.followN = n
          state.followTotalLen = tl
          break
        end
      end
    end

    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Re-parse if src changed
    if props.src ~= prev.src then
      state.doc = parseSVG(props.src)
      state.elemData, state.grandTotal = precomputeLengths(state.doc)
    end

    -- Re-parse morph target
    if props.srcTo ~= prev.srcTo then
      state.docTo = parseSVG(props.srcTo)
      if state.doc and state.docTo then
        state.matched = SVGAnim.matchSubpaths(state.doc, state.docTo)
      end
    end

    -- Update scalar props
    state.effect = props.effect or "reveal"
    state.duration = props.duration or 2000
    state.easingName = props.easing or "easeInOut"
    state.scale = props.scale or 1
    state.loop = props.loop or false
    state.targets = props.targets
    state.strokeColorParsed = parseColorProp(props.strokeColor)

    -- Play/pause
    if props.playing ~= nil then
      local shouldPlay = props.playing ~= false
      if shouldPlay and not state.playing then
        -- Resuming: reset if completed
        if state.completed then
          state.elapsed = 0
          state.completed = false
        end
      end
      state.playing = shouldPlay
    end

    -- Re-find follow path if pathId changed
    if props.pathId ~= prev.pathId and state.effect == "follow" and state.doc then
      state.followPath = nil
      for _, elem in ipairs(state.doc.elements) do
        if elem.id == props.pathId and elem.subpaths[1] then
          local sp = elem.subpaths[1]
          local cd, tl, n = SVGAnim.polylineCumDist(sp)
          state.followPath = sp
          state.followCumDist = cd
          state.followN = n
          state.followTotalLen = tl
          break
        end
      end
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.playing then return end

    -- Manual progress override
    if props.progress then
      local rawT = min(max(props.progress, 0), 1)
      state.easedT = SVGAnim.resolveEasing(state.easingName, rawT)
      state.elapsed = rawT * state.duration
      return
    end

    -- Advance timer
    state.elapsed = state.elapsed + dt * 1000
    local rawT = state.elapsed / max(state.duration, 1)

    if rawT >= 1 then
      if state.loop then
        state.elapsed = state.elapsed - state.duration
        rawT = state.elapsed / max(state.duration, 1)
      else
        rawT = 1
        if not state.completed then
          state.completed = true
          state.playing = false
          if pushEvent then
            pushEvent({
              type = "capability",
              payload = { targetId = nodeId, handler = "onComplete" },
            })
          end
        end
      end
    end

    state.easedT = SVGAnim.resolveEasing(state.easingName, min(rawT, 1))

    -- Push progress
    if pushEvent then
      local payload = {
        targetId = nodeId,
        handler = "onProgress",
        progress = state.easedT,
      }

      -- Follow: compute position along path
      if state.effect == "follow" and state.followPath then
        local fx, fy = SVGAnim.sampleAt(
          state.followPath, state.followCumDist, state.followN, state.easedT
        )
        local angle = SVGAnim.tangentAt(
          state.followPath, state.followCumDist, state.followN, state.easedT
        )
        payload.x = fx * (state.scale or 1)
        payload.y = fy * (state.scale or 1)
        payload.angle = angle
      end

      pushEvent({ type = "capability", payload = payload })
    end
  end,

  render = function(node, c, opacity)
    local inst = Capabilities._instances and Capabilities._instances[node.id]
    if not inst then return end
    local state = inst.state

    local effect = state.effect
    if effect == "reveal" then
      renderReveal(node, c, opacity, state)
    elseif effect == "morph" then
      renderMorph(node, c, opacity, state)
    elseif effect == "elements" then
      renderElements(node, c, opacity, state)
    elseif effect == "follow" then
      renderFollow(node, c, opacity, state)
    end
  end,

  destroy = function(nodeId, state)
    -- No GPU resources to release
  end,
})
