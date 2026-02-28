--[[
  semantic_graph.lua — Generic semantic graph builder for terminal classification

  Consumes a classifiedCache (row tokens + nodeIds + transition traces from any
  classifier) and produces a SemanticGraph: a tree of nodes with stable identity,
  parent links, lane metadata, session state flags, and frame diffs.

  This is the framework's structural interpretation layer. It sits between the
  classifier (which labels rows) and the skin (which renders them). The classifier
  produces tokens; the graph builder produces meaning.

  Usage:
    local Graph = require("lua.semantic_graph")
    local graph = Graph.build(classifiedCache, rowHistory, frameCounter, classifier)
    local diff  = Graph.diff(prevGraph, graph)
    local text  = Graph.formatTree(graph)

  The classifier argument is optional. If provided, its roleMap/scopeMap/laneMap
  override the defaults. This lets each CLI's classifier define its own semantics
  without touching the graph builder.
]]

local M = {}

-- ── Default metadata maps ────────────────────────────────────────
-- These are reasonable defaults for conversational CLIs (chat, REPL).
-- Classifiers can override any of them via their roleMap/scopeMap/laneMap fields.

local DEFAULT_SCOPE_MAP = {
  banner = "session", status_bar = "session",
  input_zone = "session", input_border = "session", user_input = "session",
}

local DEFAULT_ROLE_MAP = {
  user_prompt = "user", user_text = "user", user_input = "user",
  thinking = "assistant", thought_complete = "assistant",
  assistant_text = "assistant", tool = "assistant", result = "assistant",
  diff = "assistant", error = "assistant",
  banner = "system", status_bar = "system", input_border = "system",
  input_zone = "system", box_drawing = "system",
  menu_title = "system", menu_option = "system", menu_desc = "system",
  list_selectable = "system", list_selected = "system", list_info = "system",
  search_box = "system", confirmation = "system", hint = "system",
  selector = "system", picker_title = "system", picker_item = "system",
  picker_selected = "system", picker_meta = "system",
  permission = "system", plan_border = "assistant", plan_mode = "system", wizard_step = "system",
  task_summary = "assistant", task_done = "assistant",
  task_open = "assistant", task_active = "assistant",
  slash_menu = "user",
  image_attachment = "user",
  -- Basic classifier tokens (shell-generic)
  command = "user", output = "system", success = "system",
  heading = "system", separator = "system", progress = "system",
}

local DEFAULT_LANE_MAP = {
  user_prompt = "prompt", user_text = "text", user_input = "prompt",
  thinking = "think", thought_complete = "think",
  assistant_text = "text", tool = "tool", result = "result",
  diff = "diff", error = "error",
  banner = "state", status_bar = "state",
  input_zone = "prompt", input_border = "prompt",
  box_drawing = "state",
  menu_title = "state", menu_option = "state", menu_desc = "state",
  list_selectable = "state", list_selected = "state", list_info = "state",
  search_box = "state", confirmation = "state", hint = "state",
  selector = "state", picker_title = "state", picker_item = "state",
  picker_selected = "state", picker_meta = "state",
  permission = "state", plan_border = "state", plan_mode = "state", wizard_step = "state",
  task_summary = "state", task_done = "state",
  task_open = "state", task_active = "state",
  slash_menu = "prompt",
  image_attachment = "prompt",
  -- Basic classifier tokens
  command = "prompt", output = "text", success = "text",
  heading = "state", separator = "state", progress = "state",
}

-- ── Merge helper ─────────────────────────────────────────────────

local function mergeMaps(default, override)
  if not override then return default end
  local merged = {}
  for k, v in pairs(default) do merged[k] = v end
  for k, v in pairs(override) do merged[k] = v end
  return merged
end

-- ── Node type promotion ──────────────────────────────────────────
-- Some tokens get promoted to richer node types based on content

local function deriveNodeType(kind, text, classifier)
  -- Classifier-provided promotion
  if classifier and classifier.deriveNodeType then
    local promoted = classifier.deriveNodeType(kind, text)
    if promoted then return promoted end
  end
  -- Default: "Interrupted" results are decision prompts
  if kind == "result" and text and text:find("Interrupted", 1, true) then
    return "interrupt_prompt"
  end
  return kind
end

-- ── Scope detection from nodeId prefix ───────────────────────────

local function scopeFromId(nodeId)
  if not nodeId then return "turn" end
  if nodeId:sub(1, 2) == "s:" then return "session" end
  if nodeId:sub(1, 1) == "g" then return "group" end
  return "turn"
end

-- ── Parent ID derivation ─────────────────────────────────────────

local function deriveParentId(nodeId, turnId, groupId, groupType)
  if not nodeId then return "session:root" end
  local scope = scopeFromId(nodeId)
  if scope == "session" then
    return "session:root"
  else
    return "turn:t" .. turnId
  end
end

-- ── Aggregate transition trace for a block of rows ───────────────

local function aggregateTrace(rowHistory, rows)
  if not rowHistory then return {}, 0 end
  local allKinds = {}
  local maxCount = 0
  for _, row in ipairs(rows) do
    local hist = rowHistory[row]
    if hist and #hist > maxCount then
      maxCount = #hist
      allKinds = {}
      for _, h in ipairs(hist) do
        allKinds[#allKinds + 1] = h.kind
      end
    end
  end
  return allKinds, maxCount
end

-- ── Build the graph from classifiedCache ─────────────────────────

function M.build(cache, rowHistory, frame, classifier)
  -- Resolve metadata maps (classifier overrides take precedence)
  local roleMap  = mergeMaps(DEFAULT_ROLE_MAP,  classifier and classifier.roleMap)
  local scopeMap = mergeMaps(DEFAULT_SCOPE_MAP, classifier and classifier.scopeMap)
  local laneMap  = mergeMaps(DEFAULT_LANE_MAP,  classifier and classifier.laneMap)

  local nodes = {}
  local turnIds = {}
  local nodeOrder = {}
  local nodeOrderSet = {}

  -- Pass 1: group rows by nodeId into blocks
  for _, entry in ipairs(cache) do
    local nid = entry.nodeId
    if not nid then goto continue end

    if not nodes[nid] then
      nodes[nid] = {
        id = nid,
        type = deriveNodeType(entry.kind, entry.text, classifier),
        kind = entry.kind,
        parentId = deriveParentId(nid, entry.turnId, entry.groupId, entry.groupType),
        scope = scopeFromId(nid),
        role = roleMap[entry.kind] or "system",
        lane = laneMap[entry.kind] or "state",
        turnId = entry.turnId,
        groupId = entry.groupId,
        groupType = entry.groupType,
        rows = {},
        lines = {},
        colors = {},
        rowStart = entry.row,
        rowEnd = entry.row,
        text = entry.text,
        childrenIds = {},
      }
      if not nodeOrderSet[nid] then
        nodeOrder[#nodeOrder + 1] = nid
        nodeOrderSet[nid] = true
      end
    end

    local node = nodes[nid]
    node.rows[#node.rows + 1] = entry.row
    node.lines[#node.lines + 1] = entry.text
    node.rowEnd = entry.row

    if entry.colors then
      for _, c in ipairs(entry.colors) do
        local found = false
        for _, ec in ipairs(node.colors) do
          if ec == c then found = true; break end
        end
        if not found then node.colors[#node.colors + 1] = c end
      end
    end

    if entry.turnId and entry.turnId > 0 then
      turnIds[entry.turnId] = true
    end

    ::continue::
  end

  -- Pass 2: aggregate transition traces per node
  if rowHistory then
    for _, node in pairs(nodes) do
      local trace, traceCount = aggregateTrace(rowHistory, node.rows)
      node.trace = trace
      node.traceCount = traceCount
    end
  end

  -- Pass 3: create structural containers (session root + turn roots)
  nodes["session:root"] = {
    id = "session:root",
    type = "root",
    kind = "root",
    parentId = nil,
    scope = "session",
    role = "system",
    lane = "state",
    turnId = 0,
    rows = {},
    lines = {},
    colors = {},
    rowStart = 0,
    rowEnd = 0,
    text = "",
    childrenIds = {},
    trace = {},
    traceCount = 0,
  }

  local turnList = {}
  for tid in pairs(turnIds) do turnList[#turnList + 1] = tid end
  table.sort(turnList)

  for _, tid in ipairs(turnList) do
    local turnNid = "turn:t" .. tid
    nodes[turnNid] = {
      id = turnNid,
      type = "turn",
      kind = "turn",
      parentId = "session:root",
      scope = "session",
      role = "system",
      lane = "state",
      turnId = tid,
      rows = {},
      lines = {},
      colors = {},
      rowStart = 0,
      rowEnd = 0,
      text = "",
      childrenIds = {},
      trace = {},
      traceCount = 0,
    }
  end

  -- Pass 4: wire parent->children links
  for _, nid in ipairs(nodeOrder) do
    local node = nodes[nid]
    if node.parentId and nodes[node.parentId] then
      local parent = nodes[node.parentId]
      parent.childrenIds[#parent.childrenIds + 1] = nid
    end
  end
  for _, tid in ipairs(turnList) do
    local turnNid = "turn:t" .. tid
    nodes["session:root"].childrenIds[#nodes["session:root"].childrenIds + 1] = turnNid
  end

  -- Pass 5: derive session state flags
  local state = {
    mode = "idle",
    modeNodeId = nil,
    streaming = false,
    streamingKind = nil,
    streamingNodeId = nil,
    awaitingInput = false,
    awaitingDecision = false,
    decisionNodeId = nil,
    modalOpen = false,
    modalNodeId = nil,
    focus = "s:input",
    interruptPending = false,
    interruptNodeId = nil,
    turnCount = #turnList,
    currentTurnId = turnList[#turnList] or 0,
  }

  -- Classifier can provide custom state derivation
  if classifier and classifier.deriveState then
    classifier.deriveState(state, nodes, nodeOrder)
  else
    -- Default state derivation (works for conversational CLIs)
    for _, nid in ipairs(nodeOrder) do
      local node = nodes[nid]
      if node.type == "interrupt_prompt" then
        state.awaitingDecision = true
        state.decisionNodeId = nid
        state.interruptPending = true
        state.interruptNodeId = nid
      end
      if node.kind == "thinking" then
        state.streaming = true
        state.streamingKind = "thinking"
        state.streamingNodeId = nid
      end
      if node.kind == "tool" then
        state.streaming = true
        state.streamingKind = "tool"
        state.streamingNodeId = nid
      end
      if node.kind == "assistant_text" then
        state.streaming = true
        state.streamingKind = "text"
        state.streamingNodeId = nid
      end
      if node.kind == "permission" then
        state.mode = "permission"
        state.modeNodeId = nid
        state.awaitingInput = true
        state.modalOpen = true
        state.modalNodeId = nid
      end
      if node.kind == "picker_title" or node.kind == "picker_selected" then
        state.mode = "picker"
        state.modeNodeId = nid
        state.modalOpen = true
        state.modalNodeId = nid
      end
      if node.kind == "menu_title" then
        state.mode = "menu"
        state.modeNodeId = nid
        state.modalOpen = true
        state.modalNodeId = nid
      end
      if node.kind == "plan_border" or node.kind == "plan_mode" then
        state.mode = "plan"
        state.modeNodeId = nid
      end
    end

    if nodes["s:input"] and not state.streaming and not state.modalOpen then
      state.awaitingInput = true
      state.mode = "idle"
    end
  end

  return {
    nodes = nodes,
    nodeOrder = nodeOrder,
    turnList = turnList,
    state = state,
    frame = frame,
  }
end

-- ── Diff engine ──────────────────────────────────────────────────

function M.diff(prev, curr)
  if not prev then
    local ops = {}
    for _, nid in ipairs(curr.nodeOrder) do
      ops[#ops + 1] = { op = "add", id = nid, node = curr.nodes[nid] }
    end
    ops[#ops + 1] = { op = "add", id = "session:root", node = curr.nodes["session:root"] }
    for _, tid in ipairs(curr.turnList) do
      ops[#ops + 1] = { op = "add", id = "turn:t" .. tid, node = curr.nodes["turn:t" .. tid] }
    end
    ops[#ops + 1] = { op = "setState", state = curr.state }
    return ops
  end

  local ops = {}
  local prevIds = {}
  for _, nid in ipairs(prev.nodeOrder) do prevIds[nid] = true end
  if prev.nodes["session:root"] then prevIds["session:root"] = true end
  for _, tid in ipairs(prev.turnList) do prevIds["turn:t" .. tid] = true end

  local currIds = {}
  for _, nid in ipairs(curr.nodeOrder) do currIds[nid] = true end
  if curr.nodes["session:root"] then currIds["session:root"] = true end
  for _, tid in ipairs(curr.turnList) do currIds["turn:t" .. tid] = true end

  for nid in pairs(currIds) do
    if not prevIds[nid] then
      ops[#ops + 1] = { op = "add", id = nid, node = curr.nodes[nid] }
    end
  end

  for nid in pairs(prevIds) do
    if not currIds[nid] then
      ops[#ops + 1] = { op = "remove", id = nid }
    end
  end

  for nid in pairs(currIds) do
    if prevIds[nid] then
      local pn = prev.nodes[nid]
      local cn = curr.nodes[nid]
      if pn and cn then
        local changed = false
        if pn.text ~= cn.text then changed = true end
        if pn.rowStart ~= cn.rowStart or pn.rowEnd ~= cn.rowEnd then changed = true end
        if #pn.lines ~= #cn.lines then changed = true end
        if pn.type ~= cn.type then changed = true end
        if #pn.childrenIds ~= #cn.childrenIds then changed = true end
        if changed then
          ops[#ops + 1] = { op = "update", id = nid, node = cn, prev = pn }
        end
      end
    end
  end

  local stateChanged = false
  for k, v in pairs(curr.state) do
    if prev.state[k] ~= v then stateChanged = true; break end
  end
  if stateChanged then
    ops[#ops + 1] = { op = "setState", state = curr.state, prevState = prev.state }
  end

  return ops
end

-- ── Debug: format graph as text ──────────────────────────────────

function M.formatTree(graph, indent)
  indent = indent or ""
  local lines = {}
  local function walk(nid, depth)
    local node = graph.nodes[nid]
    if not node then return end
    local prefix = string.rep("  ", depth)
    local rowRange = ""
    if node.rows and #node.rows > 0 then
      if #node.rows == 1 then
        rowRange = string.format(" [r%d]", node.rows[1])
      elseif node.rowEnd - node.rowStart + 1 == #node.rows then
        rowRange = string.format(" [r%d-%d]", node.rowStart, node.rowEnd)
      else
        rowRange = string.format(" [%d rows: r%d..r%d]", #node.rows, node.rowStart, node.rowEnd)
      end
    end
    local trace = ""
    if node.traceCount and node.traceCount > 1 then
      trace = string.format(" (%dx)", node.traceCount)
    end
    lines[#lines + 1] = string.format("%s%s (%s) %s/%s/%s%s%s",
      prefix, nid, node.type,
      node.scope, node.role, node.lane,
      rowRange, trace)
    for _, childId in ipairs(node.childrenIds or {}) do
      walk(childId, depth + 1)
    end
  end
  walk("session:root", 0)
  return table.concat(lines, "\n")
end

return M
