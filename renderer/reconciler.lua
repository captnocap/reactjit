local host = require("renderer.hostConfig")

local M = {}

local function isTextNode(node)
  return type(node) ~= "table" or node.type == nil
end

local function cloneNode(node)
  if type(node) ~= "table" then
    return node
  end
  local out = {
    type = node.type,
    props = node.props or {},
    children = {},
    _id = node._id,
    _text = node._text,
  }
  for i, child in ipairs(node.children or {}) do
    out.children[i] = cloneNode(child)
  end
  return out
end

local function childList(node)
  local children = node and node.children
  if children == nil then
    return {}
  end
  if type(children) ~= "table" then
    return { children }
  end
  if children[1] == nil then
    return { children }
  end
  return children
end

local function mount(node, parent_id, emitter)
  if isTextNode(node) then
    local id = emitter:createText(node)
    if parent_id then
      emitter:append(parent_id, id)
    else
      emitter:appendToRoot(id)
    end
    return {
      _id = id,
      _text = tostring(node),
    }
  end

  local id, clean, handlers = emitter:createInstance(node.type, node.props or {})
  local live = {
    _id = id,
    type = node.type,
    props = clean,
    handlers = handlers,
    children = {},
  }

  if parent_id then
    emitter:append(parent_id, id)
  else
    emitter:appendToRoot(id)
  end

  local children = childList(node)
  for i, child in ipairs(children) do
    live.children[i] = mount(child, id, emitter)
  end

  return live
end

local function unmount(node, parent_id, emitter)
  if not node then
    return
  end

  for _, child in ipairs(childList(node)) do
    unmount(child, node._id, emitter)
  end

  if parent_id then
    emitter:remove(parent_id, node._id)
  else
    emitter:removeFromRoot(node._id)
  end
end

local function update(prev, next_node, parent_id, emitter)
  if not prev and not next_node then
    return nil
  end
  if not prev then
    return mount(next_node, parent_id, emitter)
  end
  if not next_node then
    unmount(prev, parent_id, emitter)
    return nil
  end

  if isTextNode(prev) or isTextNode(next_node) then
    local prev_text = prev._text or tostring(prev)
    local next_text = tostring(next_node)
    if prev_text ~= next_text then
      emitter:emit({ op = "UPDATE_TEXT", id = prev._id, text = next_text })
      prev._text = next_text
    end
    return prev
  end

  if prev.type ~= next_node.type then
    unmount(prev, parent_id, emitter)
    return mount(next_node, parent_id, emitter)
  end

  local old_clean, old_handlers = host.extractHandlers(prev.props or {})
  local new_clean, new_handlers = host.extractHandlers(next_node.props or {})
  emitter:update(prev._id, old_clean, new_clean, old_handlers, new_handlers)

  local old_children = childList(prev)
  local new_children = childList(next_node)
  local max_len = math.max(#old_children, #new_children)
  local live_children = {}

  for i = 1, max_len do
    live_children[i] = update(old_children[i], new_children[i], prev._id, emitter)
  end

  prev.props = cloneNode(next_node.props or {})
  prev.children = live_children
  return prev
end

function M.render(prev_tree, next_tree, emitter)
  emitter = emitter or host.newEmitter()
  return update(prev_tree, next_tree, nil, emitter), emitter
end

function M.applyCommands(tree, commands)
  return host.applyCommands(tree, commands)
end

return M
