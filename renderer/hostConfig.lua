local M = {}

local function deep_clone(value, seen)
  if type(value) ~= "table" then
    return value
  end
  seen = seen or {}
  if seen[value] then
    return seen[value]
  end
  local out = {}
  seen[value] = out
  for k, v in pairs(value) do
    out[deep_clone(k, seen)] = deep_clone(v, seen)
  end
  return out
end

local function array_index_of(list, item)
  for i, value in ipairs(list or {}) do
    if value == item then
      return i
    end
  end
  return nil
end

local function remove_value(list, item)
  local idx = array_index_of(list, item)
  if idx then
    table.remove(list, idx)
  end
end

local function insert_before(list, item, before)
  remove_value(list, item)
  if before ~= nil then
    local idx = array_index_of(list, before)
    if idx then
      table.insert(list, idx, item)
      return
    end
  end
  table.insert(list, item)
end

local function sorted_keys(map)
  local keys = {}
  for key in pairs(map or {}) do
    keys[#keys + 1] = key
  end
  table.sort(keys)
  return keys
end

local function handler_signature(fn)
  local info = debug and debug.getinfo and debug.getinfo(fn, "Sln")
  if not info then
    return "(native)"
  end
  local source = info.short_src or info.source or "(unknown)"
  local line = info.linedefined or 0
  local last = info.lastlinedefined or line
  if last ~= line then
    return string.format("%s:%d-%d", source, line, last)
  end
  return string.format("%s:%d", source, line)
end

function M.extractHandlers(props)
  local clean = {}
  local handlers = {}

  for key, value in pairs(props or {}) do
    if key ~= "children" and type(key) == "string" and key:sub(1, 2) == "on" and type(value) == "function" then
      handlers[key] = value
    elseif key ~= "children" then
      clean[key] = value
    end
  end

  return clean, handlers
end

local function diff_style_objects(old_style, new_style)
  local changed = {}
  local removed = {}
  local has_changed = false

  old_style = old_style or {}
  new_style = new_style or {}

  for key, value in pairs(new_style) do
    if old_style[key] ~= value then
      changed[key] = value
      has_changed = true
    end
  end

  for key in pairs(old_style) do
    if new_style[key] == nil then
      removed[#removed + 1] = key
      has_changed = true
    end
  end

  if not has_changed then
    return nil, removed
  end

  return changed, removed
end

function M.diffCleanProps(old_clean, new_clean)
  local diff = {}
  local remove_keys = {}
  local remove_style_keys = {}
  local has_diff = false

  old_clean = old_clean or {}
  new_clean = new_clean or {}

  for key, new_value in pairs(new_clean) do
    local old_value = old_clean[key]
    if key == "style" then
      local style_diff, removed = diff_style_objects(old_value, new_value)
      if style_diff then
        diff.style = style_diff
        has_diff = true
      end
      remove_style_keys = removed
      if #remove_style_keys > 0 then
        has_diff = true
      end
    elseif old_value ~= new_value then
      diff[key] = new_value
      has_diff = true
    end
  end

  for key in pairs(old_clean) do
    if key ~= "style" and new_clean[key] == nil then
      remove_keys[#remove_keys + 1] = key
      has_diff = true
    end
  end

  if not has_diff then
    return nil
  end

  return {
    diff = diff,
    removeKeys = remove_keys,
    removeStyleKeys = remove_style_keys,
  }
end

function M.coalesceCommands(commands)
  local update_index = {}
  local output = {}

  for _, cmd in ipairs(commands or {}) do
    if cmd.op == "UPDATE" and cmd.id ~= nil then
      local existing_idx = update_index[cmd.id]
      if existing_idx ~= nil then
        local existing = output[existing_idx]
        local prev_style = existing.props and existing.props.style

        existing.props = existing.props or {}
        for key, value in pairs(cmd.props or {}) do
          existing.props[key] = deep_clone(value)
        end

        if prev_style and cmd.props and cmd.props.style then
          local merged = deep_clone(prev_style)
          for key, value in pairs(cmd.props.style) do
            merged[key] = deep_clone(value)
          end
          existing.props.style = merged
        end

        if cmd.removeKeys then
          existing.removeKeys = existing.removeKeys or {}
          for _, key in ipairs(cmd.removeKeys) do
            existing.removeKeys[#existing.removeKeys + 1] = key
          end
        end

        if cmd.removeStyleKeys then
          existing.removeStyleKeys = existing.removeStyleKeys or {}
          for _, key in ipairs(cmd.removeStyleKeys) do
            existing.removeStyleKeys[#existing.removeStyleKeys + 1] = key
          end
        end

        if cmd.hasHandlers ~= nil then
          existing.hasHandlers = cmd.hasHandlers
        end
        if cmd.handlerNames ~= nil then
          existing.handlerNames = deep_clone(cmd.handlerNames)
        end
      else
        update_index[cmd.id] = #output + 1
        output[#output + 1] = deep_clone(cmd)
      end
    else
      output[#output + 1] = deep_clone(cmd)
    end
  end

  return output
end

function M.buildHandlerMeta(handlers)
  local keys = sorted_keys(handlers)
  if #keys == 0 then
    return nil
  end

  local meta = {}
  for _, name in ipairs(keys) do
    meta[name] = handler_signature(handlers[name])
  end

  return meta
end

function M.newEmitter()
  local emitter = {
    pendingCommands = {},
    handlerRegistry = {},
    nodeIdCounter = 0,
  }

  function emitter:nextId()
    self.nodeIdCounter = self.nodeIdCounter + 1
    return self.nodeIdCounter
  end

  function emitter:emit(cmd)
    self.pendingCommands[#self.pendingCommands + 1] = cmd
  end

  function emitter:createText(text)
    local id = self:nextId()
    self:emit({ op = "CREATE_TEXT", id = id, text = tostring(text) })
    return id
  end

  function emitter:createInstance(type_name, props)
    local id = self:nextId()
    local clean, handlers = M.extractHandlers(props or {})
    local handler_names = sorted_keys(handlers)
    local cmd = {
      op = "CREATE",
      id = id,
      type = type_name,
      props = clean,
    }

    if #handler_names > 0 then
      cmd.hasHandlers = true
      cmd.handlerNames = handler_names
      cmd.handlerMeta = M.buildHandlerMeta(handlers)
    end

    self.handlerRegistry[id] = handlers
    self:emit(cmd)
    return id, clean, handlers
  end

  function emitter:append(parent_id, child_id)
    self:emit({ op = "APPEND", parentId = parent_id, childId = child_id })
  end

  function emitter:appendToRoot(child_id)
    self:emit({ op = "APPEND_TO_ROOT", childId = child_id })
  end

  function emitter:remove(parent_id, child_id)
    self:emit({ op = "REMOVE", parentId = parent_id, childId = child_id })
  end

  function emitter:removeFromRoot(child_id)
    self:emit({ op = "REMOVE_FROM_ROOT", childId = child_id })
  end

  function emitter:update(node_id, old_clean, new_clean, old_handlers, new_handlers)
    local diff = M.diffCleanProps(old_clean, new_clean)
    local old_names = sorted_keys(old_handlers)
    local new_names = sorted_keys(new_handlers)
    if not diff and #old_names == #new_names then
      local same = true
      for i = 1, #old_names do
        if old_names[i] ~= new_names[i] then
          same = false
          break
        end
      end
      if same then
        return nil
      end
    end

    local cmd = {
      op = "UPDATE",
      id = node_id,
      props = (diff and diff.diff) or {},
    }

    if diff then
      if #diff.removeKeys > 0 then
        cmd.removeKeys = diff.removeKeys
      end
      if #diff.removeStyleKeys > 0 then
        cmd.removeStyleKeys = diff.removeStyleKeys
      end
    end

    if #new_names > 0 then
      cmd.hasHandlers = true
      cmd.handlerNames = new_names
      cmd.handlerMeta = M.buildHandlerMeta(new_handlers)
    elseif #old_names > 0 then
      cmd.hasHandlers = false
      cmd.handlerNames = {}
      cmd.handlerMeta = nil
    end

    self.handlerRegistry[node_id] = new_handlers or {}
    self:emit(cmd)
    return cmd
  end

  function emitter:flush()
    local out = M.coalesceCommands(self.pendingCommands)
    self.pendingCommands = {}
    return out
  end

  return emitter
end

function M.newTreeState()
  return {
    children = {},
    nodesById = {},
  }
end

local function ensureTree(tree)
  if type(tree) ~= "table" then
    tree = nil
  end
  if tree == nil then
    tree = M.newTreeState()
  end
  tree.children = tree.children or {}
  tree.nodesById = tree.nodesById or {}
  return tree
end

local function ensureNode(tree, id)
  local node = tree.nodesById[id]
  if node == nil then
    node = {
      _id = id,
      children = {},
    }
    tree.nodesById[id] = node
  elseif node.children == nil then
    node.children = {}
  end
  return node
end

local function applyUpdate(node, cmd)
  node.props = node.props or {}

  for _, key in ipairs(cmd.removeKeys or {}) do
    node.props[key] = nil
  end

  if node.props.style == nil and ((cmd.props or {}).style ~= nil or #(cmd.removeStyleKeys or {}) > 0) then
    node.props.style = {}
  end

  if node.props.style ~= nil then
    for _, key in ipairs(cmd.removeStyleKeys or {}) do
      node.props.style[key] = nil
    end
  end

  for key, value in pairs(cmd.props or {}) do
    if key == "style" and type(value) == "table" then
      local merged = deep_clone(node.props.style or {})
      for style_key, style_value in pairs(value) do
        merged[style_key] = deep_clone(style_value)
      end
      node.props.style = merged
    else
      node.props[key] = deep_clone(value)
    end
  end

  if cmd.hasHandlers ~= nil then
    node.hasHandlers = cmd.hasHandlers
  end
  if cmd.handlerNames ~= nil then
    node.handlerNames = deep_clone(cmd.handlerNames)
  end
  if cmd.handlerMeta ~= nil then
    node.handlerMeta = deep_clone(cmd.handlerMeta)
  end
end

local function removeFromParentList(list, node)
  remove_value(list, node)
end

function M.applyCommand(tree, cmd)
  tree = ensureTree(tree)
  if type(cmd) ~= "table" then
    return tree
  end

  if cmd.op == "CREATE_TEXT" then
    local node = ensureNode(tree, cmd.id)
    node.type = nil
    node.props = node.props or {}
    node.children = nil
    node._text = tostring(cmd.text)
    return tree
  end

  if cmd.op == "CREATE" then
    local node = ensureNode(tree, cmd.id)
    node.type = cmd.type
    node.props = deep_clone(cmd.props or {})
    node.children = node.children or {}
    node._text = nil
    if cmd.hasHandlers ~= nil then
      node.hasHandlers = cmd.hasHandlers
    end
    if cmd.handlerNames ~= nil then
      node.handlerNames = deep_clone(cmd.handlerNames)
    end
    if cmd.handlerMeta ~= nil then
      node.handlerMeta = deep_clone(cmd.handlerMeta)
    end
    return tree
  end

  if cmd.op == "APPEND" then
    local parent = ensureNode(tree, cmd.parentId)
    local child = ensureNode(tree, cmd.childId)
    parent.children = parent.children or {}
    insert_before(parent.children, child)
    child._parentId = parent._id
    return tree
  end

  if cmd.op == "APPEND_TO_ROOT" then
    local child = ensureNode(tree, cmd.childId)
    insert_before(tree.children, child)
    child._parentId = nil
    return tree
  end

  if cmd.op == "INSERT_BEFORE" then
    local parent = ensureNode(tree, cmd.parentId)
    local child = ensureNode(tree, cmd.childId)
    local before = tree.nodesById[cmd.beforeId]
    parent.children = parent.children or {}
    insert_before(parent.children, child, before)
    child._parentId = parent._id
    return tree
  end

  if cmd.op == "INSERT_BEFORE_ROOT" then
    local child = ensureNode(tree, cmd.childId)
    local before = tree.nodesById[cmd.beforeId]
    insert_before(tree.children, child, before)
    child._parentId = nil
    return tree
  end

  if cmd.op == "UPDATE" then
    local node = ensureNode(tree, cmd.id)
    applyUpdate(node, cmd)
    return tree
  end

  if cmd.op == "UPDATE_TEXT" then
    local node = ensureNode(tree, cmd.id)
    node._text = tostring(cmd.text)
    if type(node.children) == "table" and node.children[1] and node.children[1]._text ~= nil then
      node.children[1]._text = tostring(cmd.text)
    end
    return tree
  end

  if cmd.op == "REMOVE" then
    local parent = tree.nodesById[cmd.parentId]
    local child = tree.nodesById[cmd.childId]
    if parent and parent.children and child then
      removeFromParentList(parent.children, child)
    end
    return tree
  end

  if cmd.op == "REMOVE_FROM_ROOT" then
    local child = tree.nodesById[cmd.childId]
    if child then
      removeFromParentList(tree.children, child)
    end
    return tree
  end

  return tree
end

function M.applyCommands(tree, commands)
  tree = ensureTree(tree)
  for _, cmd in ipairs(commands or {}) do
    M.applyCommand(tree, cmd)
  end
  return tree
end

return M
