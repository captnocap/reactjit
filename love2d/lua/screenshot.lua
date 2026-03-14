--[[
  screenshot.lua -- Headless screenshot capture for reactjit

  Triggered via environment variable REACTJIT_SCREENSHOT=1.
  Waits a few frames for layout to settle, captures a screenshot
  using love.graphics.captureScreenshot(), prints the output path,
  and quits.

  Supports targeting:
    - Full page (default)
    - --node <debugName|testId>  crops to a specific node's layout rect
    - --region x,y,w,h           crops to pixel coordinates

  Usage (in init.lua):
    local screenshot = require("lua.screenshot")
    screenshot.init({
      outputPath = os.getenv("REACTJIT_SCREENSHOT_OUTPUT") or "screenshot.png",
      tree = M.tree,
      node = os.getenv("REACTJIT_SCREENSHOT_NODE"),
      region = os.getenv("REACTJIT_SCREENSHOT_REGION"),
      padding = tonumber(os.getenv("REACTJIT_SCREENSHOT_PAD")) or 8,
    })
    -- In update: screenshot.update()
    -- In draw:   screenshot.captureIfReady()
]]

local Screenshot = {}

-- ============================================================================
-- State
-- ============================================================================

local state = {
  enabled    = false,
  outputPath = "screenshot.png",
  frameCount = 0,
  captured   = false,
  waitFrames = 3,
  tree       = nil,
  node       = nil,     -- debugName or testId to find
  region     = nil,     -- {x, y, w, h} pixel coords
  padding    = 8,       -- px padding around node crops
}

-- ============================================================================
-- Internal: find node by debugName or testId
-- ============================================================================

local function findNode(tree, target)
  local nodes = tree.getNodes()
  -- First pass: exact testId match
  for _, node in pairs(nodes) do
    if node.props and node.props.testId == target and node.computed then
      return node
    end
  end
  -- Second pass: debugName match
  for _, node in pairs(nodes) do
    if node.debugName == target and node.computed then
      return node
    end
  end
  -- Third pass: type match
  for _, node in pairs(nodes) do
    if node.type == target and node.computed then
      return node
    end
  end
  return nil
end

-- ============================================================================
-- Internal: crop ImageData to a region
-- ============================================================================

local function cropImage(imageData, x, y, w, h, pad)
  local srcW, srcH = imageData:getDimensions()
  local cx = math.max(0, math.floor(x - pad))
  local cy = math.max(0, math.floor(y - pad))
  local cw = math.floor(w + pad * 2)
  local ch = math.floor(h + pad * 2)
  -- Clamp to source bounds
  if cx + cw > srcW then cw = srcW - cx end
  if cy + ch > srcH then ch = srcH - cy end
  if cw <= 0 or ch <= 0 then return nil end

  local cropped = love.image.newImageData(cw, ch)
  cropped:paste(imageData, 0, 0, cx, cy, cw, ch)
  return cropped
end

-- ============================================================================
-- Internal: resolve target region from node or explicit coords
-- ============================================================================

local function resolveRegion()
  -- Explicit region takes priority
  if state.region then
    return state.region
  end
  -- Node targeting
  if state.node and state.tree then
    local node = findNode(state.tree, state.node)
    if node and node.computed then
      local c = node.computed
      io.write("[screenshot] Found node '" .. state.node .. "' at "
        .. math.floor(c.x) .. "," .. math.floor(c.y) .. " "
        .. math.floor(c.w) .. "x" .. math.floor(c.h) .. "\n"); io.flush()
      return { x = c.x, y = c.y, w = c.w, h = c.h }
    else
      io.write("[screenshot] WARNING: Node '" .. state.node .. "' not found, capturing full page\n"); io.flush()
      return nil
    end
  end
  return nil
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Initialize screenshot mode.
--- @param config table { outputPath, tree, node, region, padding }
function Screenshot.init(config)
  config = config or {}
  state.enabled = true
  state.outputPath = config.outputPath or "screenshot.png"
  state.frameCount = 0
  state.captured = false
  state.tree = config.tree
  state.node = config.node
  state.padding = config.padding or 8
  state.listMode = config.listMode or false

  -- Parse region string "x,y,w,h"
  if config.region and type(config.region) == "string" then
    local parts = {}
    for n in config.region:gmatch("[^,]+") do
      parts[#parts + 1] = tonumber(n)
    end
    if #parts == 4 then
      state.region = { x = parts[1], y = parts[2], w = parts[3], h = parts[4] }
    else
      io.write("[screenshot] WARNING: Invalid region format, expected x,y,w,h\n"); io.flush()
    end
  end

  local target = "full page"
  if state.node then target = "node '" .. state.node .. "'" end
  if state.region then target = "region " .. config.region end
  io.write("[screenshot] Mode enabled, target: " .. target .. ", output: " .. state.outputPath .. "\n"); io.flush()
end

--- Call from love.update(). Increments frame counter.
function Screenshot.update()
  if not state.enabled or state.captured then return end
  state.frameCount = state.frameCount + 1
end

--- Call at the END of love.draw(). Captures screenshot on the target frame.
--- love.graphics.captureScreenshot() captures at the end of the current draw.
function Screenshot.captureIfReady()
  if not state.enabled or state.captured then return end
  if state.frameCount < state.waitFrames then return end

  state.captured = true

  -- List mode: dump targetable nodes and quit (no screenshot)
  if state.listMode and state.tree then
    io.write("SCREENSHOT_NODES_START\n")
    local nodes = state.tree.getNodes()
    local seen = {}
    for _, node in pairs(nodes) do
      if node.computed and node.computed.w > 0 and node.computed.h > 0 then
        local c = node.computed
        local tid = node.props and node.props.testId
        local dn = node.debugName
        -- Emit testId entries
        if tid and not seen["tid:" .. tid] then
          seen["tid:" .. tid] = true
          io.write(string.format("  testId=%-30s %4dx%-4d at %d,%d\n",
            tid, math.floor(c.w), math.floor(c.h), math.floor(c.x), math.floor(c.y)))
        end
        -- Emit debugName entries (deduplicate, show first/largest)
        if dn and dn ~= "" and not seen["dn:" .. dn] then
          seen["dn:" .. dn] = true
          io.write(string.format("  name=%-31s %4dx%-4d at %d,%d\n",
            dn, math.floor(c.w), math.floor(c.h), math.floor(c.x), math.floor(c.y)))
        end
      end
    end
    io.write("SCREENSHOT_NODES_END\n"); io.flush()
    love.event.quit(0)
    return
  end

  io.write("[screenshot] Capturing frame " .. state.frameCount .. "...\n"); io.flush()

  love.graphics.captureScreenshot(function(imageData)
    local region = resolveRegion()
    local finalData

    if region then
      finalData = cropImage(imageData, region.x, region.y, region.w, region.h, state.padding)
      if not finalData then
        io.write("[screenshot] ERROR: Crop region is empty or out of bounds\n"); io.flush()
        love.event.quit(1)
        return
      end
    else
      finalData = imageData
    end

    local fileData = finalData:encode("png")
    local f = io.open(state.outputPath, "wb")
    if f then
      f:write(fileData:getString())
      f:close()
      local w, h = finalData:getDimensions()
      io.write("SCREENSHOT_SAVED:" .. state.outputPath .. " (" .. w .. "x" .. h .. ")\n"); io.flush()
    else
      io.write("[screenshot] ERROR: Could not write to " .. state.outputPath .. "\n"); io.flush()
    end
    love.event.quit(0)
  end)
end

--- Check if screenshot mode is enabled.
function Screenshot.isEnabled()
  return state.enabled
end

return Screenshot
