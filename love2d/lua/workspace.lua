--[[
  workspace.lua — Binary split tree manager for i3-style tiling

  All tree state and operations live here. React just reads the tree
  and declares layout. Input (drag, split, close, swap) handled in Lua.
]]

local Workspace = {}

local tree = nil
local counter = 0
local focusedId = "tile-0"
local swapSource = nil

local function uid()
  counter = counter + 1
  return "n" .. counter
end

-- ── Tree operations ──

local function splitLeaf(node, leafId, newApp, dir)
  if node.type == "leaf" then
    if node.id == leafId then
      return {
        type = "split", id = uid(), direction = dir, ratio = 0.5,
        children = { node, { type = "leaf", id = uid(), app = newApp } },
      }
    end
    return node
  end
  return {
    type = node.type, id = node.id, direction = node.direction, ratio = node.ratio,
    children = {
      splitLeaf(node.children[1], leafId, newApp, dir),
      splitLeaf(node.children[2], leafId, newApp, dir),
    },
  }
end

local function removeLeaf(node, leafId)
  if node.type == "leaf" then
    return node.id == leafId and nil or node
  end
  local l = removeLeaf(node.children[1], leafId)
  local r = removeLeaf(node.children[2], leafId)
  if not l then return r end
  if not r then return l end
  return {
    type = node.type, id = node.id, direction = node.direction, ratio = node.ratio,
    children = { l, r },
  }
end

local function findRatio(node, splitId)
  if node.type == "leaf" then return 0.5 end
  if node.id == splitId then return node.ratio end
  local l = findRatio(node.children[1], splitId)
  if node.children[1].type == "split" and node.children[1].id == splitId then return l end
  if l ~= 0.5 then return l end
  return findRatio(node.children[2], splitId)
end

local function setRatio(node, splitId, ratio)
  if node.type == "leaf" then return node end
  local clamped = math.max(0.15, math.min(0.85, ratio))
  if node.id == splitId then
    return {
      type = node.type, id = node.id, direction = node.direction, ratio = clamped,
      children = node.children,
    }
  end
  return {
    type = node.type, id = node.id, direction = node.direction, ratio = node.ratio,
    children = {
      setRatio(node.children[1], splitId, ratio),
      setRatio(node.children[2], splitId, ratio),
    },
  }
end

local function findApp(node, id)
  if node.type == "leaf" then
    return node.id == id and node.app or nil
  end
  return findApp(node.children[1], id) or findApp(node.children[2], id)
end

local function swapLeaves(node, idA, idB, appA, appB)
  if node.type == "leaf" then
    if node.id == idA then return { type = "leaf", id = node.id, app = appB } end
    if node.id == idB then return { type = "leaf", id = node.id, app = appA } end
    return node
  end
  return {
    type = node.type, id = node.id, direction = node.direction, ratio = node.ratio,
    children = {
      swapLeaves(node.children[1], idA, idB, appA, appB),
      swapLeaves(node.children[2], idA, idB, appA, appB),
    },
  }
end

-- ── Public API (called via bridge.rpc) ──

function Workspace.init(defaultApp)
  tree = { type = "leaf", id = "tile-0", app = defaultApp }
  focusedId = "tile-0"
  swapSource = nil
  return true
end

function Workspace.getTree()
  return tree
end

function Workspace.getFocusedId()
  return focusedId
end

function Workspace.getSwapSource()
  return swapSource
end

function Workspace.setFocus(leafId)
  focusedId = leafId
  return true
end

function Workspace.split(leafId, newApp, direction)
  if not tree then return false end
  tree = splitLeaf(tree, leafId, newApp, direction)
  return true
end

function Workspace.remove(leafId)
  if not tree then return false end
  local result = removeLeaf(tree, leafId)
  if result then
    tree = result
  end
  return true
end

function Workspace.adjustRatio(splitId, delta)
  if not tree then return false end
  local current = findRatio(tree, splitId)
  tree = setRatio(tree, splitId, current + delta)
  return true
end

function Workspace.swapTap(leafId)
  if swapSource == nil then
    swapSource = leafId
    return "selected"
  end
  if swapSource == leafId then
    swapSource = nil
    return "deselected"
  end
  -- Do the swap
  local appA = findApp(tree, swapSource)
  local appB = findApp(tree, leafId)
  if appA and appB then
    tree = swapLeaves(tree, swapSource, leafId, appA, appB)
  end
  swapSource = nil
  return "swapped"
end

-- ── RPC handlers (registered in init.lua like other modules) ──

function Workspace.getHandlers()
  return {
    ["workspace:init"] = function(args)
      return Workspace.init(args)
    end,
    ["workspace:getState"] = function()
      return {
        tree = tree,
        focusedId = focusedId,
        swapSource = swapSource,
      }
    end,
    ["workspace:setFocus"] = function(args)
      focusedId = args.leafId
      return true
    end,
    ["workspace:split"] = function(args)
      return Workspace.split(args.leafId, args.app, args.direction)
    end,
    ["workspace:remove"] = function(args)
      return Workspace.remove(args.leafId)
    end,
    ["workspace:adjustRatio"] = function(args)
      return Workspace.adjustRatio(args.splitId, args.delta)
    end,
    ["workspace:swapTap"] = function(args)
      return Workspace.swapTap(args.leafId)
    end,
  }
end

return Workspace
