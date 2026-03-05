--[[
  masks.lua — Foreground post-processing mask registry and lifecycle manager

  The counterpart to effects.lua's background mode. A mask captures the parent
  node's fully rendered content (background + children) and applies a visual
  post-processing filter on top: scanlines, CRT distortion, VHS artifacts,
  dithering, ASCII conversion, etc.

  Follows the same registration pattern as effects:
    Masks.register("CRT", { create, update, draw })

  But draw receives the source canvas:
    draw(state, w, h, sourceCanvas)

  Usage:
    <Box>
      <Spirograph background />
      <Text fontSize={18}>Hello</Text>
      <CRT mask />
    </Box>
]]

local Masks = {}

-- Registry: typeName -> mask module { create, update, draw }
local registry = {}

-- Live instances: nodeId -> { type, state, outputCanvas, width, height, parentId, props }
local instances = {}

-- Reverse lookup: parentId -> nodeId (so painter can find the mask for a node)
local maskByParent = {}

-- Canvas pool: reusable temp canvases keyed by "WxH"
local canvasPool = {}

local floor = math.floor
local ceil = math.ceil
local max = math.max

-- Expand bounds to include visual descendants so masks don't hard-clip
-- absolutely-positioned overlays or other content extending past parent bounds.
local function unionDescendantBounds(node, minX, minY, maxX, maxY)
  if not node then return minX, minY, maxX, maxY end
  local children = node.children or {}
  for _, child in ipairs(children) do
    local cs = child.style or {}
    if cs.display ~= "none" then
      local cc = child.computed
      if cc and cc.w and cc.h and cc.w > 0 and cc.h > 0 then
        local x1 = cc.x or 0
        local y1 = cc.y or 0
        local x2 = x1 + cc.w
        local y2 = y1 + cc.h
        if x1 < minX then minX = x1 end
        if y1 < minY then minY = y1 end
        if x2 > maxX then maxX = x2 end
        if y2 > maxY then maxY = y2 end
      end
      minX, minY, maxX, maxY = unionDescendantBounds(child, minX, minY, maxX, maxY)
    end
  end
  return minX, minY, maxX, maxY
end

-- ============================================================================
-- Registration
-- ============================================================================

--- Register a mask type.
--- @param typeName string  The node type React will CREATE (e.g. "CRT")
--- @param mod table  Mask module with create(w, h, props), update(state, dt, props, w, h, mouse), draw(state, w, h, source)
function Masks.register(typeName, mod)
  assert(typeName, "Masks.register: typeName required")
  assert(type(mod) == "table", "Masks.register: mod must be a table")
  assert(mod.create, "Masks.register: mod.create required")
  assert(mod.update, "Masks.register: mod.update required")
  assert(mod.draw, "Masks.register: mod.draw required")
  registry[typeName] = mod
end

--- Check if a node type is a registered mask.
function Masks.isMaskType(typeName)
  return registry[typeName] ~= nil
end

--- Check if a specific node is a mask-mode element (for layout skip).
--- @param node table  The tree node
function Masks.isMask(node)
  if not registry[node.type] then return false end
  local props = node.props or {}
  return props.mask == true
end

--- Check if a parent node has a mask child registered.
--- @param parentNodeId number
--- @return boolean
function Masks.hasMask(parentNodeId)
  return maskByParent[parentNodeId] ~= nil
end

-- ============================================================================
-- Tree sync (called per-frame from init.lua)
-- ============================================================================

--- Sync masks with the React tree. Discovers mask nodes, manages instances.
function Masks.syncWithTree(nodes)
  local seen = {}

  for id, node in pairs(nodes) do
    local mod = registry[node.type]
    if mod then
      local props = node.props or {}
      local isMask = props.mask == true
      if isMask then
        seen[id] = true
        local parentId = node.parent and node.parent.id or nil

        if not instances[id] then
          -- New mask instance
          instances[id] = {
            type = node.type,
            state = nil,
            outputCanvas = nil,
            width = 0,
            height = 0,
            parentId = parentId,
            props = props,
            needsInit = true,
          }
          if parentId then
            maskByParent[parentId] = id
          end
        else
          -- Existing: update props
          local inst = instances[id]
          if inst.type ~= node.type then
            local oldMod = registry[inst.type]
            if oldMod and oldMod.destroy then
              oldMod.destroy(inst.state)
            end
            inst.type = node.type
            inst.state = nil
            inst.needsInit = true
          end
          inst.props = props

          -- Update parent mapping
          if parentId then
            if inst.parentId and inst.parentId ~= parentId and maskByParent[inst.parentId] == id then
              maskByParent[inst.parentId] = nil
            end
            maskByParent[parentId] = id
          elseif inst.parentId and maskByParent[inst.parentId] == id then
            maskByParent[inst.parentId] = nil
          end
          inst.parentId = parentId
        end

        -- Resolve dimensions from parent
        local c = node.parent and node.parent.computed
        if c then
          local parentNode = node.parent
          local px = c.x or 0
          local py = c.y or 0
          local pw = c.w or 0
          local ph = c.h or 0
          local minX = px
          local minY = py
          local maxX = px + pw
          local maxY = py + ph
          minX, minY, maxX, maxY = unionDescendantBounds(parentNode, minX, minY, maxX, maxY)

          local capX = floor(minX)
          local capY = floor(minY)
          local capW = max(1, ceil(maxX) - capX)
          local capH = max(1, ceil(maxY) - capY)
          local inst = instances[id]

          inst.screenX = px
          inst.screenY = py
          inst.captureX = capX
          inst.captureY = capY

          if capW > 0 and capH > 0 and (inst.width ~= capW or inst.height ~= capH) then
            if inst.outputCanvas then inst.outputCanvas:release() end
            inst.outputCanvas = love.graphics.newCanvas(capW, capH)
            inst.width = capW
            inst.height = capH
            inst.needsInit = true
          end
        end
      end
    end
  end

  -- Cleanup: destroy instances whose nodes were removed
  for id, inst in pairs(instances) do
    if not seen[id] then
      if inst.outputCanvas then inst.outputCanvas:release() end
      if inst.parentId and maskByParent[inst.parentId] == id then
        maskByParent[inst.parentId] = nil
      end
      local mod = registry[inst.type]
      if mod and mod.destroy then
        mod.destroy(inst.state)
      end
      instances[id] = nil
    end
  end
end

-- ============================================================================
-- Mouse tracking (same approach as effects.lua)
-- ============================================================================

local lastMx, lastMy = 0, 0
local mouseDx, mouseDy = 0, 0
local mouseSpeed = 0
local mouseIdleTime = 0

local function pollMouse(dt)
  local mx, my = love.mouse.getPosition()
  mouseDx = mx - lastMx
  mouseDy = my - lastMy
  mouseSpeed = math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy) / math.max(dt, 0.001)
  if math.abs(mouseDx) > 0.5 or math.abs(mouseDy) > 0.5 then
    mouseIdleTime = 0
  else
    mouseIdleTime = mouseIdleTime + dt
  end
  lastMx, lastMy = mx, my
end

local function instanceMouse(inst)
  local x, y, w, h = 0, 0, inst.width, inst.height
  if inst.screenX then
    x = inst.screenX
    y = inst.screenY
  end
  local localX = lastMx - x
  local localY = lastMy - y
  local inside = localX >= 0 and localX <= w and localY >= 0 and localY <= h
  return {
    x = localX,
    y = localY,
    dx = mouseDx,
    dy = mouseDy,
    speed = mouseSpeed,
    inside = inside,
    idle = mouseIdleTime,
  }
end

--- Update all mask instances (animation state, no rendering).
function Masks.updateAll(dt)
  pollMouse(dt)
  for id, inst in pairs(instances) do
    local mod = registry[inst.type]
    if mod and inst.width > 0 and inst.height > 0 then
      if inst.needsInit then
        inst.state = mod.create(inst.width, inst.height, inst.props)
        inst.needsInit = false
      end
      local mouse = instanceMouse(inst)
      mod.update(inst.state, dt, inst.props, inst.width, inst.height, mouse)
    end
  end
end

-- ============================================================================
-- Canvas pool for temporary source capture
-- ============================================================================

local function getPooledCanvas(w, h)
  local key = w .. "x" .. h
  local pool = canvasPool[key]
  if pool and #pool > 0 then
    return table.remove(pool)
  end
  return love.graphics.newCanvas(w, h)
end

local function returnPooledCanvas(canvas, w, h)
  local key = w .. "x" .. h
  if not canvasPool[key] then canvasPool[key] = {} end
  -- Cap pool size to prevent memory bloat
  if #canvasPool[key] < 4 then
    canvasPool[key][#canvasPool[key] + 1] = canvas
  else
    canvas:release()
  end
end

--- Get a temporary canvas for the painter to capture a node's content into.
--- The painter should call this at the start of painting a masked node.
--- @param parentNodeId number
--- @return love.Canvas|nil, number, number, number, number
---   tempCanvas, width, height, captureX, captureY
function Masks.getTempCanvas(parentNodeId)
  local maskNodeId = maskByParent[parentNodeId]
  if not maskNodeId then return nil end
  local inst = instances[maskNodeId]
  if not inst or inst.width <= 0 or inst.height <= 0 then return nil end
  local canvas = getPooledCanvas(inst.width, inst.height)
  local captureX = inst.captureX or inst.screenX or 0
  local captureY = inst.captureY or inst.screenY or 0
  return canvas, inst.width, inst.height, captureX, captureY
end

--- Apply the mask to a captured source canvas and return the result.
--- Called by painter after rendering children to the temp canvas.
--- @param parentNodeId number
--- @param sourceCanvas love.Canvas  The captured content
--- @return love.Canvas|nil  The processed output canvas (owned by the mask instance)
function Masks.applyMask(parentNodeId, sourceCanvas)
  local maskNodeId = maskByParent[parentNodeId]
  if not maskNodeId then return nil end
  local inst = instances[maskNodeId]
  if not inst or not inst.state or not inst.outputCanvas then return nil end

  local mod = registry[inst.type]
  if not mod then return nil end

  love.graphics.push("all")
  love.graphics.setCanvas({inst.outputCanvas, stencil = true})
  -- Render mask modules in an unclipped local space; any parent clipping is
  -- applied later when painter composites the final output canvas.
  love.graphics.setScissor()
  love.graphics.setStencilTest()
  love.graphics.setBlendMode("alpha")
  love.graphics.clear(0, 0, 0, 0)
  local okDraw, drawErr = xpcall(function()
    mod.draw(inst.state, inst.width, inst.height, sourceCanvas)
  end, debug.traceback)
  love.graphics.pop()

  -- Fail-open: if a mask draw throws, keep rendering the unmasked source so
  -- the frame stays valid and we don't leave canvas state dirty.
  if not okDraw then
    local okFallback = pcall(function()
      love.graphics.push("all")
      love.graphics.setCanvas({inst.outputCanvas, stencil = true})
      love.graphics.setScissor()
      love.graphics.setStencilTest()
      love.graphics.setBlendMode("alpha")
      love.graphics.clear(0, 0, 0, 0)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.draw(sourceCanvas, 0, 0)
      love.graphics.pop()
    end)
    if _G._reactjit_verbose then
      io.write("[masks] draw failed (" .. tostring(inst.type) .. "): " .. tostring(drawErr) .. "\n")
      if not okFallback then
        io.write("[masks] fallback draw also failed\n")
      end
      io.flush()
    end
  end

  -- Return the temp canvas to the pool
  returnPooledCanvas(sourceCanvas, inst.width, inst.height)

  return inst.outputCanvas
end

-- ============================================================================
-- Auto-load masks from lua/masks/ directory
-- ============================================================================

function Masks.loadAll()
  local maskFiles = {
    "scanlines",
    "crt",
    "vhs",
    "dither",
    "ascii",
    "luma_mesh",
    "optical_flow",
    "data_mosh",
    "feedback",
    "hard_glitch",
    "soft_glitch",
    "stretch",
    "fish_eye",
    "tile",
    "watercolor",
  }
  for _, name in ipairs(maskFiles) do
    local ok, err = pcall(require, "lua.masks." .. name)
    if ok then
      if _G._reactjit_verbose then io.write("[masks] Loaded: " .. name .. "\n"); io.flush() end
    else
      if _G._reactjit_verbose then io.write("[masks] Failed to load " .. name .. ": " .. tostring(err) .. "\n"); io.flush() end
    end
  end
end

return Masks
