--[[
  tree.lua -- Retained element tree + command interpreter

  This is the "DOM equivalent" for reactjit. The React reconciler on the JS
  side sends mutation commands (CREATE, APPEND, UPDATE, REMOVE, etc.) and this
  module applies them to build and maintain an in-memory tree of UI nodes.

  The layout engine and painter operate on this tree.
]]

local Log = require("lua.debug_log")

local Images = nil    -- Injected at init time via Tree.init()
local Videos = nil    -- Injected at init time via Tree.init()
local Animate = nil   -- Injected at init time via Tree.init()
local Scene3D = nil   -- Injected at init time via Tree.init()

local Tree = {}

-- ============================================================================
-- State
-- ============================================================================

local nodes = {}          -- id -> node
local rootChildren = {}   -- ordered list of top-level children
local treeDirty = true
local syntheticRoot = nil -- cached wrapper when #rootChildren > 1

-- Mutation stats (reset each frame by consumer)
local mutationStats = { total = 0, creates = 0, updates = 0, removes = 0 }

-- ============================================================================
-- Internal helpers
-- ============================================================================

local MAX_CLEANUP_DEPTH = 32

local function cloneStyleTable(style)
  if type(style) ~= "table" then return {} end
  local out = {}
  for k, v in pairs(style) do
    out[k] = v
  end
  return out
end

--- Recursively remove a node and all its descendants from the nodes table.
--- Depth-limited to MAX_CLEANUP_DEPTH to guard against pathologically deep trees.
local function cleanup(id, depth)
  depth = depth or 0
  if depth > MAX_CLEANUP_DEPTH then
    io.write("[tree] cleanup depth limit reached at id=" .. tostring(id) .. "\n")
    io.flush()
    nodes[id] = nil
    return
  end

  local n = nodes[id]
  if n then
    Log.log("tree", "cleanup id=%s type=%s children=%d", tostring(id), tostring(n.type), #n.children)
    -- Unload image if this is an Image node
    if Images and n.type == "Image" and n.props and n.props.src then
      Images.unload(n.props.src)
    end

    -- Video cleanup is handled by Videos.syncWithTree() each frame

    -- Clean up Scene3D resources (canvas, meshes)
    if Scene3D and n.type == "Scene3D" then
      Scene3D.cleanup(n.id)
    end

    -- Clean up active transitions/animations
    if Animate then
      Animate.onNodeRemoved(id)
    end

    -- Recursively cleanup children
    for _, c in ipairs(n.children) do
      cleanup(c.id, depth + 1)
    end
    nodes[id] = nil
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Initialize tree state with target-specific dependencies.
--- Call once at startup.
--- @param config table|nil  { images = ImagesModule } (images may be nil for targets without image support)
function Tree.init(config)
  config = config or {}
  Images = config.images
  Videos = config.videos
  Animate = config.animate
  Scene3D = config.scene3d
  nodes = {}
  rootChildren = {}
  treeDirty = true
  syntheticRoot = nil
end

--- Apply an array of mutation commands from the React reconciler.
--- Each command is a table with an `op` field and associated data.
--- Return current mutation stats and reset counters.
function Tree.getMutationStats()
  local s = { total = mutationStats.total, creates = mutationStats.creates, updates = mutationStats.updates, removes = mutationStats.removes }
  mutationStats.total = 0
  mutationStats.creates = 0
  mutationStats.updates = 0
  mutationStats.removes = 0
  return s
end

local COMMAND_BUDGET = 1000000

function Tree.applyCommands(commands)
  if #commands > COMMAND_BUDGET then
    error(string.format(
      "[BUDGET] Tree received %d commands in one frame (limit %d). Likely infinite reconciler loop.",
      #commands, COMMAND_BUDGET))
  end
  mutationStats.total = mutationStats.total + #commands
  for _, cmd in ipairs(commands) do
    local op = cmd.op

    if op == "CREATE" or op == "CREATE_TEXT" then
      mutationStats.creates = mutationStats.creates + 1
    elseif op == "UPDATE" or op == "UPDATE_TEXT" then
      mutationStats.updates = mutationStats.updates + 1
    elseif op == "REMOVE" or op == "REMOVE_FROM_ROOT" then
      mutationStats.removes = mutationStats.removes + 1
    end

    if op == "CREATE" then
      Log.log("tree", "CREATE id=%s type=%s debugName=%s handlers=%s", tostring(cmd.id), tostring(cmd.type), tostring(cmd.debugName or "-"), tostring(cmd.hasHandlers or false))
      local props = cmd.props or {}
      local style = cloneStyleTable(props.style)
      nodes[cmd.id] = {
        id = cmd.id,
        type = cmd.type,
        props = props,
        style = style,
        hasHandlers = cmd.hasHandlers or false,
        handlerMeta = cmd.handlerMeta,  -- { onClick = "() => ...", ... } for inspector
        children = {},
        parent = nil,
        computed = nil,
        -- Debug info from React component (for inspector)
        debugName = cmd.debugName,
        debugSource = cmd.debugSource,
        -- Render tracking for classification
        renderCount = 1,
      }
      -- Pre-load image and establish ref count
      if Images and cmd.type == "Image" and props.src then
        Images.load(props.src)
      end
      -- Video loading is handled by Videos.syncWithTree() each frame
      -- Set up keyframe animation if present on creation
      if Animate and style.animation then
        Animate.setupAnimation(nodes[cmd.id], style.animation)
      end
      treeDirty = true

    elseif op == "CREATE_TEXT" then
      Log.log("tree", "CREATE_TEXT id=%s text=%q", tostring(cmd.id), tostring(cmd.text):sub(1, 60))
      local textVal = cmd.text
      nodes[cmd.id] = {
        id = cmd.id,
        type = "__TEXT__",
        text = textVal,
        style = {},
        children = {},
        parent = nil,
        computed = nil,
      }
      treeDirty = true

    elseif op == "APPEND" then
      local parent = nodes[cmd.parentId]
      local child = nodes[cmd.childId]
      if parent and child then
        Log.log("tree", "APPEND child=%s(%s) -> parent=%s(%s)", tostring(cmd.childId), tostring(child.type), tostring(cmd.parentId), tostring(parent.type))
        child.parent = parent
        parent.children[#parent.children + 1] = child
        treeDirty = true
      end

    elseif op == "APPEND_TO_ROOT" then
      local child = nodes[cmd.childId]
      if child then
        Log.log("tree", "APPEND_TO_ROOT child=%s(%s)", tostring(cmd.childId), tostring(child.type))
        rootChildren[#rootChildren + 1] = child
        treeDirty = true
      end

    elseif op == "UPDATE" then
      local node = nodes[cmd.id]
      if node and cmd.props then
        local changedKeys = {}
        for k in pairs(cmd.props) do changedKeys[#changedKeys + 1] = k end
        Log.log("tree", "UPDATE id=%s type=%s keys=[%s] removeStyle=[%s]", tostring(cmd.id), tostring(node.type), table.concat(changedKeys, ","), cmd.removeStyleKeys and table.concat(cmd.removeStyleKeys, ",") or "")
        -- Handle image src changes: unload old, load new
        if Images and node.type == "Image" and cmd.props.src and cmd.props.src ~= node.props.src then
          if node.props.src then Images.unload(node.props.src) end
          Images.load(cmd.props.src)
        end

        -- Video src changes are handled by Videos.syncWithTree() each frame

        -- Apply changed props (partial diff)
        for k, v in pairs(cmd.props) do
          if k == "style" then
            -- In-place merge style properties (v is a partial style diff)
            if type(v) == "table" then
              if not node.props.style then node.props.style = {} end
              if not node.style then node.style = {} end

              -- Snapshot old values before merge (needed for transitions)
              local oldValues = nil
              if Animate and node.style.transition then
                oldValues = {}
                for sk in pairs(v) do
                  oldValues[sk] = node.style[sk]
                end
              end

              -- Apply the style diff
              for sk, sv in pairs(v) do
                node.style[sk] = sv
                node.props.style[sk] = sv
              end

              -- Set up keyframe animation if the animation prop changed
              if Animate and v.animation then
                Animate.setupAnimation(node, v.animation)
              end

              -- Let animate module process transitions for changed properties
              if Animate and oldValues then
                Animate.processStyleUpdate(node, oldValues, v)
              end
            end
          else
            node.props[k] = v
          end
        end

        -- Handle removed style keys
        if cmd.removeStyleKeys then
          for _, sk in ipairs(cmd.removeStyleKeys) do
            if node.style then node.style[sk] = nil end
            if node.props.style then node.props.style[sk] = nil end
          end
        end

        -- Handle removed non-style keys
        if cmd.removeKeys then
          for _, k in ipairs(cmd.removeKeys) do
            node.props[k] = nil
          end
        end

        -- Update hasHandlers flag + handler metadata for inspector
        if cmd.hasHandlers ~= nil then
          node.hasHandlers = cmd.hasHandlers
        end
        if cmd.handlerMeta ~= nil then
          node.handlerMeta = cmd.handlerMeta
        end

        -- Update render count from JS reconciler
        if cmd.renderCount then
          node.renderCount = cmd.renderCount
        end

        treeDirty = true
      end

    elseif op == "UPDATE_TEXT" then
      local node = nodes[cmd.id]
      if node then
        Log.log("tree", "UPDATE_TEXT id=%s text=%q", tostring(cmd.id), tostring(cmd.text):sub(1, 60))
        node.text = cmd.text
        treeDirty = true
      end

    elseif op == "REMOVE" then
      Log.log("tree", "REMOVE child=%s from parent=%s", tostring(cmd.childId), tostring(cmd.parentId))
      local parent = nodes[cmd.parentId]
      if parent then
        for i, c in ipairs(parent.children) do
          if c.id == cmd.childId then
            table.remove(parent.children, i)
            break
          end
        end
      end
      cleanup(cmd.childId)
      treeDirty = true

    elseif op == "REMOVE_FROM_ROOT" then
      Log.log("tree", "REMOVE_FROM_ROOT child=%s", tostring(cmd.childId))
      for i, c in ipairs(rootChildren) do
        if c.id == cmd.childId then
          table.remove(rootChildren, i)
          break
        end
      end
      cleanup(cmd.childId)
      treeDirty = true

    elseif op == "INSERT_BEFORE" then
      Log.log("tree", "INSERT_BEFORE child=%s before=%s parent=%s", tostring(cmd.childId), tostring(cmd.beforeId), tostring(cmd.parentId))
      local parent = nodes[cmd.parentId]
      local child = nodes[cmd.childId]
      if parent and child then
        child.parent = parent
        for i, c in ipairs(parent.children) do
          if c.id == cmd.beforeId then
            table.insert(parent.children, i, child)
            treeDirty = true
            break
          end
        end
      end

    elseif op == "INSERT_BEFORE_ROOT" then
      Log.log("tree", "INSERT_BEFORE_ROOT child=%s before=%s", tostring(cmd.childId), tostring(cmd.beforeId))
      local child = nodes[cmd.childId]
      if child then
        for i, c in ipairs(rootChildren) do
          if c.id == cmd.beforeId then
            table.insert(rootChildren, i, child)
            treeDirty = true
            break
          end
        end
      end

    elseif op == "SCROLL_UPDATE" then
      local node = nodes[cmd.id]
      if node then
        Tree.setScroll(cmd.id, cmd.scrollX or 0, cmd.scrollY or 0)
      end
    end
  end
end

--- Return the root node of the tree.
--- If there is exactly one root child, return it directly.
--- Otherwise wrap rootChildren in a synthetic full-size View.
function Tree.getTree()
  if #rootChildren == 0 then syntheticRoot = nil; return nil end
  if #rootChildren == 1 then syntheticRoot = nil; return rootChildren[1] end
  -- Reuse cached wrapper so layout's computed values persist across calls
  if not syntheticRoot then
    syntheticRoot = {
      id = 0,
      type = "View",
      style = { width = "100%", height = "100%" },
      children = rootChildren,
      props = {},
      computed = nil,
    }
  end
  -- Always keep children in sync (rootChildren may have changed)
  syntheticRoot.children = rootChildren
  return syntheticRoot
end

--- Return the raw nodes table (id -> node).
function Tree.getNodes()
  return nodes
end

--- Return true if the tree has been mutated since the last clearDirty().
function Tree.isDirty()
  return treeDirty
end

--- Clear the dirty flag. Call after layout has been recomputed.
function Tree.clearDirty()
  treeDirty = false
end

--- Force the tree to be marked dirty (e.g. on window resize).
function Tree.markDirty()
  Log.log("tree", "markDirty (external)")
  treeDirty = true
end

--- Set the scroll position for a node.
--- Clamps to valid range based on content dimensions.
--- @param nodeId number|string The node ID
--- @param scrollX number Desired horizontal scroll position
--- @param scrollY number Desired vertical scroll position
function Tree.setScroll(nodeId, scrollX, scrollY)
  local node = nodes[nodeId]
  if not node then return end

  -- Initialize scrollState if needed
  if not node.scrollState then
    node.scrollState = { scrollX = 0, scrollY = 0, contentW = 0, contentH = 0 }
  end

  local ss = node.scrollState
  local c = node.computed

  -- Clamp scroll positions
  local maxScrollX = 0
  local maxScrollY = 0
  if c then
    maxScrollX = math.max(0, (ss.contentW or 0) - c.w)
    maxScrollY = math.max(0, (ss.contentH or 0) - c.h)
  end

  local horizontalMode = node.props and node.props.horizontal
  if horizontalMode == true then
    maxScrollY = 0
    scrollY = 0
  elseif horizontalMode == false then
    maxScrollX = 0
    scrollX = 0
  end

  local function sanitize(v, maxValue)
    if type(v) ~= "number" then return 0 end
    if v ~= v then return 0 end -- NaN
    if v == math.huge then return maxValue end
    if v == -math.huge then return 0 end
    return v
  end

  local nextX = sanitize(scrollX, maxScrollX)
  local nextY = sanitize(scrollY, maxScrollY)
  ss.scrollX = math.max(0, math.min(nextX, maxScrollX))
  ss.scrollY = math.max(0, math.min(nextY, maxScrollY))
end

-- ============================================================================
-- Lua-side subtree declaration (Love reconciler Tier 1)
--
-- Capabilities can declare child nodes directly in Lua without going through
-- the JS bridge. This lets a visual capability compose its output from the
-- same primitives React uses (View, __TEXT__, Image, etc.) instead of manual
-- love.graphics draw calls.
--
-- Node IDs use the string format "lua:<parentId>:<key>" to avoid collisions
-- with the JS reconciler's positive-integer ID space.
-- ============================================================================

-- Track which parent nodes have Lua-declared children: parentId -> { key -> nodeId }
local declaredChildren = {}

--- Recursively stamp a template subtree into the tree under a parent node.
--- @param parentId number|string  The parent node's ID
--- @param template table  Template tree: { type, key, style?, props?, text?, children? }
--- @return table  Handles: flat table mapping key -> nodeId for every keyed node
local function stampTemplate(parentId, template, handles)
  handles = handles or {}

  for i, tmpl in ipairs(template) do
    local key = tmpl.key or tostring(i)
    local nodeId = "lua:" .. tostring(parentId) .. ":" .. key

    local style = {}
    if tmpl.style then
      for k, v in pairs(tmpl.style) do style[k] = v end
    end

    local props = {}
    if tmpl.props then
      for k, v in pairs(tmpl.props) do props[k] = v end
    end
    props.style = style

    local node = {
      id = nodeId,
      type = tmpl.type or "View",
      props = props,
      style = style,
      text = tmpl.text,
      hasHandlers = false,
      children = {},
      parent = nodes[parentId],
      computed = nil,
      debugName = "lua:" .. key,
      renderCount = 1,
      _luaDeclared = true,  -- marker for cleanup
    }

    nodes[nodeId] = node

    -- Append as child of parent
    local parent = nodes[parentId]
    if parent then
      parent.children[#parent.children + 1] = node
    end

    -- Store handle
    handles[key] = nodeId

    -- Recurse into children
    if tmpl.children and #tmpl.children > 0 then
      stampTemplate(nodeId, tmpl.children, handles)
    end
  end

  return handles
end

--- Declare a subtree of children under a parent node from a Lua template.
--- Returns a handles table mapping template keys to node IDs for later updates.
---
--- @param parentId number|string  The capability node's ID in the tree
--- @param template table  Array of child templates: { { type, key, style?, text?, children? }, ... }
--- @return table  Handles: { [key] = nodeId, ... }
function Tree.declareChildren(parentId, template)
  local parent = nodes[parentId]
  if not parent then
    io.write("[tree] declareChildren: parent " .. tostring(parentId) .. " not found\n")
    io.flush()
    return {}
  end

  -- Remove any previous declaration for this parent
  if declaredChildren[parentId] then
    Tree.removeDeclaredChildren(parentId)
  end

  local handles = stampTemplate(parentId, template)
  declaredChildren[parentId] = handles
  treeDirty = true

  Log.log("tree", "declareChildren parent=%s keys=%d", tostring(parentId), #template)
  return handles
end

--- Update props on a Lua-declared child node.
--- For __TEXT__ nodes, set `props.text` to update the text content.
---
--- @param nodeId string  The node ID (from handles table)
--- @param props table  Props to merge: { text?, style?, ... }
function Tree.updateChildProps(nodeId, props)
  local node = nodes[nodeId]
  if not node then return end

  for k, v in pairs(props) do
    if k == "text" then
      -- For text nodes, update the text field directly
      node.text = v
    elseif k == "style" then
      -- Merge style in-place
      if type(v) == "table" then
        if not node.style then node.style = {} end
        if not node.props.style then node.props.style = {} end
        for sk, sv in pairs(v) do
          node.style[sk] = sv
          node.props.style[sk] = sv
        end
      end
    else
      node.props[k] = v
    end
  end

  treeDirty = true
end

--- Remove all Lua-declared children from a parent node.
--- @param parentId number|string  The parent node ID
function Tree.removeDeclaredChildren(parentId)
  local handles = declaredChildren[parentId]
  if not handles then return end

  -- Remove declared nodes from parent's children list
  local parent = nodes[parentId]
  if parent then
    local kept = {}
    for _, child in ipairs(parent.children) do
      if not child._luaDeclared then
        kept[#kept + 1] = child
      end
    end
    parent.children = kept
  end

  -- Recursively clean up declared nodes from the nodes table
  for key, nodeId in pairs(handles) do
    cleanup(nodeId)
  end

  declaredChildren[parentId] = nil
  treeDirty = true
end

return Tree
