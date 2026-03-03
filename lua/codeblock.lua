--[[
  codeblock.lua -- Lua-owned code block renderer

  Renders syntax-highlighted code with tight line spacing.
  No React layout involvement for line positioning — we calculate positions
  directly like texteditor.lua does.

  Provides:
    - CodeBlock.measure(node, includeWidth?) -> { width, height }
    - CodeBlock.render(node, c, effectiveOpacity)
]]

local Measure = nil
local Color   = require("lua.color")
local Syntax  = require("lua.syntax")

-- Lazy-load Measure if init() was never called (e.g. subprocess windows)
local function getMeasure()
  if not Measure then
    Measure = require("lua.measure")
  end
  return Measure
end

local CodeBlock = {}
-- Weak-keyed per-node cache so removed nodes are GC'd without explicit cleanup.
local renderCache = setmetatable({}, { __mode = "k" }) -- [node] = entry
local debugStatsEnabled = os.getenv("RJIT_CODEBLOCK_STATS") == "1"
local debugStats = {
  hits = 0,
  misses = 0,
  tokenLinesBuilt = 0,
  printTimer = 0,
}

-- ============================================================================
-- Churn detection — catch wrapper re-renders that feed new string identity
-- ============================================================================

local CHURN_WARN_THRESHOLD  = 10   -- identity changes/sec before warning
local CHURN_KILL_THRESHOLD  = 30   -- identity changes/sec before kill switch
local churnTracker = setmetatable({}, { __mode = "k" }) -- [node] = state

local function getChurnState(node)
  local cs = churnTracker[node]
  if not cs then
    cs = {
      identityChanges = 0,    -- identity changes this window
      contentChanges = 0,     -- actual content changes this window
      windowStart = 0,        -- love.timer.getTime() at window start
      rate = 0,               -- computed identity changes/sec
      contentRate = 0,        -- computed content changes/sec
      killed = false,         -- syntax highlighting disabled
      warned = false,         -- warning already emitted this window
      lastContentSig = nil,   -- length + prefix hash for content comparison
    }
    churnTracker[node] = cs
  end
  return cs
end

--- Cheap content signature: length .. ":" .. first 64 bytes.
--- Same content = same sig, even if string pointer differs.
local function contentSig(code)
  local len = #code
  if len <= 64 then return len .. ":" .. code end
  return len .. ":" .. code:sub(1, 64)
end

--- Call on every render/measure to track prop identity churn.
--- Returns true if syntax highlighting should be suppressed (kill switch active).
local function checkChurn(node, code)
  local cs = getChurnState(node)
  local now = love.timer.getTime()

  -- Reset window every second
  if now - cs.windowStart >= 1.0 then
    cs.rate = cs.identityChanges
    cs.contentRate = cs.contentChanges
    cs.identityChanges = 0
    cs.contentChanges = 0
    cs.windowStart = now
    cs.warned = false
    -- Recover from kill switch if churn stopped
    if cs.killed and cs.rate < CHURN_WARN_THRESHOLD then
      cs.killed = false
      io.write("[CODEBLOCK] churn subsided — re-enabling syntax highlighting\n")
      io.flush()
    end
  end

  -- Fast path: same string pointer = no identity change, zero allocations.
  -- Hoisted constants (the correct pattern) always hit this path.
  if cs.lastCodePtr == code then
    return cs.killed
  end

  -- Pointer changed — check if content actually changed (costs a contentSig allocation).
  local sig = contentSig(code)
  if cs.lastContentSig ~= nil then
    cs.identityChanges = cs.identityChanges + 1
    if sig ~= cs.lastContentSig then
      cs.contentChanges = cs.contentChanges + 1
    end
  end
  cs.lastCodePtr = code
  cs.lastContentSig = sig

  -- Warn on churn
  if not cs.warned and cs.rate >= CHURN_WARN_THRESHOLD then
    io.write(string.format(
      "[CODEBLOCK WARNING] code prop identity changed %d/sec but content hash changed %d/sec. " ..
      "Suspect wrapper re-rendering. Node: %s\n",
      cs.rate, cs.contentRate, tostring(node.id or node)
    ))
    io.flush()
    cs.warned = true
  end

  -- Kill switch
  if not cs.killed and cs.rate >= CHURN_KILL_THRESHOLD and cs.contentRate == 0 then
    cs.killed = true
    io.write(string.format(
      "[CODEBLOCK KILL SWITCH] syntax highlighting DISABLED — %d identity changes/sec, " ..
      "0 content changes. Freezing token cache. Node: %s\n",
      cs.rate, tostring(node.id or node)
    ))
    io.flush()
  end

  return cs.killed
end

-- ============================================================================
-- Init
-- ============================================================================

function CodeBlock.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- Helpers
-- ============================================================================

local function setColorWithOpacity(color, opacity)
  love.graphics.setColor(color[1], color[2], color[3], (color[4] or 1) * opacity)
end

--- Split code into lines. Returns a table of strings.
local function splitLines(code)
  local lines = {}
  for line in (code .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end
  return lines
end

local function getNodeEntry(node)
  local entry = renderCache[node]
  if not entry then
    entry = {}
    renderCache[node] = entry
  end
  return entry
end

--- Extract code string from node: reads children Text nodes, falls back to props.code.
--- Each Text child becomes one line.
local function extractCode(node)
  local children = node.children
  if children and #children > 0 then
    local lines = {}
    for _, child in ipairs(children) do
      if child.type == "Text" then
        -- Text nodes have __TEXT__ children with .text
        local textParts = {}
        local textChildren = child.children
        if textChildren then
          for _, tc in ipairs(textChildren) do
            if tc.type == "__TEXT__" and tc.text then
              textParts[#textParts + 1] = tc.text
            end
          end
        end
        lines[#lines + 1] = table.concat(textParts)
      elseif child.type == "__TEXT__" and child.text then
        lines[#lines + 1] = child.text
      end
    end
    if #lines > 0 then return table.concat(lines, "\n") end
  end
  return (node.props or {}).code or ""
end

local function ensureLines(entry, code)
  -- Fast path: same string pointer = same content, zero allocations.
  -- Hoisted constants (the correct pattern) always hit this path.
  if entry.lines and entry.codePtr == code then
    return entry.lines
  end
  -- Slow path: content-based memoization (survives new string identity with same content).
  local sig = contentSig(code)
  if entry.lines and entry.codeSig == sig then
    entry.codePtr = code  -- update pointer for future fast path
    return entry.lines
  end
  entry.codePtr = code
  entry.code = code
  entry.codeSig = sig
  entry.lines = splitLines(code)
  entry.langKey = nil
  entry.langResolved = nil
  entry.tokenLines = nil
  entry.measure = nil
  return entry.lines
end

--- Resolve the language string, running auto-detect if needed.
local function resolveLanguage(lang, lines, code)
  if not lang or lang == "" or lang == "auto" then
    return Syntax.detectLanguage(lines or splitLines(code or ""))
  end
  return lang
end

-- ============================================================================
-- Measurement
-- ============================================================================

function CodeBlock.measure(node, includeWidth)
  local props = node.props or {}
  local code = extractCode(node)
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 10, node)
  local entry = getNodeEntry(node)
  local lines = ensureLines(entry, code)
  local measureBySize = entry.measure
  if not measureBySize then
    measureBySize = {}
    entry.measure = measureBySize
  end
  local m = measureBySize[fontSize]
  local needWidth = (includeWidth == true)
  if not m or (needWidth and m.width == nil) then
    local font = getMeasure().getFont(fontSize, nil, nil)
    if not m then
      m = { lineHeight = font:getHeight() }
      measureBySize[fontSize] = m
    end
    if needWidth and m.width == nil then
      local maxWidth = 0
      for _, line in ipairs(lines) do
        local w = font:getWidth(line)
        if w > maxWidth then maxWidth = w end
      end
      m.width = maxWidth
    end
  end

  -- Reuse a cached result table to avoid per-call allocations.
  -- The caller reads width/height immediately and doesn't hold a reference.
  local result = entry._measureResult
  if not result then
    result = { width = 0, height = 0 }
    entry._measureResult = result
  end
  result.width = needWidth and (m.width or 0) or 0
  result.height = #lines * (m.lineHeight or 0)
  return result
end

local function getTokenizedLinesCached(node, code, langProp)
  local entry = getNodeEntry(node)
  local lines = ensureLines(entry, code)

  -- Churn detection: track identity changes, engage kill switch if needed
  local killed = checkChurn(node, code)

  -- If kill switch active, return frozen cache or plain text
  if killed and entry.tokenLines then
    return lines, entry.langResolved or "plain", entry.tokenLines
  end

  local langKey = langProp or "auto"
  if entry.tokenLines and entry.langKey == langKey then
    if debugStatsEnabled then
      debugStats.hits = debugStats.hits + 1
    end
    return lines, entry.langResolved, entry.tokenLines
  end

  -- If kill switch active but no cached tokens, use plain text (no tokenizer)
  if killed then
    local plainColor = Syntax.colors and Syntax.colors.text or {0.8, 0.8, 0.8, 1.0}
    local tokenLines = {}
    for i, line in ipairs(lines) do
      tokenLines[i] = {{text = line, color = plainColor}}
    end
    entry.langKey = langKey
    entry.langResolved = "plain"
    entry.tokenLines = tokenLines
    return lines, "plain", tokenLines
  end

  local langResolved = resolveLanguage(langProp, lines, code)
  local tokenLines = {}
  for i, line in ipairs(lines) do
    tokenLines[i] = Syntax.tokenizeLine(line, langResolved)
  end
  if debugStatsEnabled then
    debugStats.misses = debugStats.misses + 1
    debugStats.tokenLinesBuilt = debugStats.tokenLinesBuilt + #lines
  end

  entry.langKey = langKey
  entry.langResolved = langResolved
  entry.tokenLines = tokenLines
  return lines, langResolved, tokenLines
end

local copyStates = setmetatable({}, { __mode = "k" })  -- [node] = { copied = false, timer = 0 }

local function getCopyState(node)
  local state = copyStates[node]
  if not state then
    state = { copied = false, timer = 0 }
    copyStates[node] = state
  end
  return state
end

--- Returns the bounding rect of the copy button for a given node's computed rect.
local function getCopyButtonRect(c, btnFont)
  local label = "Copy"
  local textW = btnFont:getWidth(label)
  local textH = btnFont:getHeight()
  local padH, padV = 8, 3
  local btnW = textW + padH * 2
  local btnH = textH + padV * 2
  local margin = 6
  local bx = c.x + c.w - btnW - margin
  local by = c.y + margin
  return bx, by, btnW, btnH
end

function CodeBlock.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  local c = node.computed
  if not c then return false end

  local btnFont = getMeasure().getFont(9, nil, nil)
  local bx, by, bw, bh = getCopyButtonRect(c, btnFont)

  if mx >= bx and mx <= bx + bw and my >= by and my <= by + bh then
    local code = extractCode(node)
    pcall(function() love.system.setClipboardText(code) end)
    local cs = getCopyState(node)
    cs.copied = true
    cs.timer = 2.0
    return true
  end
  return false
end

function CodeBlock.update(dt)
  for _, cs in pairs(copyStates) do
    if cs.copied then
      cs.timer = cs.timer - dt
      if cs.timer <= 0 then
        cs.copied = false
        cs.timer = 0
      end
    end
  end

  if debugStatsEnabled then
    debugStats.printTimer = debugStats.printTimer + (dt or 0)
    if debugStats.printTimer >= 1.0 then
      debugStats.printTimer = 0
      local cacheEntries = 0
      for _ in pairs(renderCache) do
        cacheEntries = cacheEntries + 1
      end
      local luaMemMB = collectgarbage("count") / 1024
      -- Collect churn stats across all tracked nodes
      local maxChurnRate, maxContentRate, killedCount = 0, 0, 0
      for _, cs in pairs(churnTracker) do
        if cs.rate > maxChurnRate then maxChurnRate = cs.rate end
        if cs.contentRate > maxContentRate then maxContentRate = cs.contentRate end
        if cs.killed then killedCount = killedCount + 1 end
      end
      io.write(string.format(
        "[CB-STATS] hits=%d misses=%d tokenLines=%d cache=%d mem=%.1fMB | churn: id=%d/s content=%d/s killed=%d\n",
        debugStats.hits, debugStats.misses, debugStats.tokenLinesBuilt,
        cacheEntries, luaMemMB, maxChurnRate, maxContentRate, killedCount
      ))
      io.flush()
    end
  end
end

--- Return diagnostic stats for crash reports / panic snapshots.
function CodeBlock.getDiagnostics()
  local cacheEntries = 0
  for _ in pairs(renderCache) do
    cacheEntries = cacheEntries + 1
  end
  local maxChurnRate, maxContentRate, killedCount = 0, 0, 0
  local worstNode = nil
  for node, cs in pairs(churnTracker) do
    if cs.rate > maxChurnRate then
      maxChurnRate = cs.rate
      worstNode = node
    end
    if cs.contentRate > maxContentRate then maxContentRate = cs.contentRate end
    if cs.killed then killedCount = killedCount + 1 end
  end
  return {
    cacheEntries = cacheEntries,
    cacheHits = debugStats.hits,
    cacheMisses = debugStats.misses,
    tokenLinesBuilt = debugStats.tokenLinesBuilt,
    churnIdentityRate = maxChurnRate,
    churnContentRate = maxContentRate,
    churnKilledNodes = killedCount,
    churnWorstNode = worstNode and tostring(worstNode.id or worstNode) or nil,
    luaMemMB = collectgarbage("count") / 1024,
  }
end

-- ============================================================================
-- Rendering
-- ============================================================================

-- Pre-computed color tables (allocated once, reused every frame)
local DEFAULT_BG_COLOR    = Color.toTable("#0d1117")
local DEFAULT_BORDER_COLOR = Color.toTable("#1e293b")
local BTN_BG_NORMAL       = Color.toTable("#1e293b")
local BTN_BG_COPIED       = Color.toTable("#1a3a2a")
local BTN_TEXT_NORMAL      = Color.toTable("#64748b")
local BTN_TEXT_COPIED      = Color.toTable("#4ade80")

-- Per-node color cache (weak-keyed, avoids Color.toTable per-frame for string bg/border)
local colorCache = setmetatable({}, { __mode = "k" }) -- [node] = { bgStr, bg, borderStr, border }

local function getCachedColor(node, colorStr, field)
  local cc = colorCache[node]
  if not cc then cc = {}; colorCache[node] = cc end
  if cc[field .. "Str"] == colorStr then return cc[field] end
  local tbl = Color.toTable(colorStr)
  cc[field .. "Str"] = colorStr
  cc[field] = tbl
  return tbl
end

function CodeBlock.render(node, c, effectiveOpacity)
  local props = node.props or {}
  local code = extractCode(node)
  local lang
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 10, node)
  local s = node.style or {}
  local padding = s.padding or 10

  -- Background (zero allocations for default or cached string colors)
  local bgColor = s.backgroundColor
  if type(bgColor) == "string" then
    bgColor = getCachedColor(node, bgColor, "bg")
  elseif type(bgColor) ~= "table" then
    bgColor = DEFAULT_BG_COLOR
  end
  setColorWithOpacity(bgColor, effectiveOpacity)
  local br = s.borderRadius or 4
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, br, br)

  -- Border
  if s.borderWidth and s.borderWidth > 0 then
    local borderColor = s.borderColor
    if type(borderColor) == "string" then
      borderColor = getCachedColor(node, borderColor, "border")
    elseif type(borderColor) ~= "table" then
      borderColor = DEFAULT_BORDER_COLOR
    end
    setColorWithOpacity(borderColor, effectiveOpacity)
    love.graphics.setLineWidth(s.borderWidth)
    love.graphics.rectangle("line", c.x, c.y, c.w, c.h, br, br)
  end

  -- Split lines
  local lines, resolvedLang, tokenLines = getTokenizedLinesCached(node, code, props.language)
  lang = resolvedLang

  -- Get font and line height
  local font = getMeasure().getFont(fontSize, nil, nil)
  love.graphics.setFont(font)
  local lineHeight = font:getHeight()

  -- Scissor to code area (avoid table allocation — use 4 locals instead)
  local psx, psy, psw, psh = love.graphics.getScissor()
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)

  -- Center content vertically when allocated more height than needed
  local contentHeight = #lines * lineHeight
  local innerHeight = c.h - 2 * padding
  local yOffset = 0
  if contentHeight < innerHeight then
    yOffset = math.floor((innerHeight - contentHeight) / 2)
  end

  -- Render each line with token-based syntax highlighting
  for i, line in ipairs(lines) do
    local y = c.y + padding + yOffset + (i - 1) * lineHeight
    local tokens = tokenLines[i] or Syntax.tokenizeLine(line, lang)
    local x = c.x + padding
    for _, tok in ipairs(tokens) do
      setColorWithOpacity(tok.color, effectiveOpacity)
      love.graphics.print(tok.text, x, y)
      x = x + font:getWidth(tok.text)
    end
  end

  -- Draw text selection highlight
  CodeBlock.drawHighlight(node, c, padding, lines, font, lineHeight, effectiveOpacity, yOffset)

  -- Restore previous scissor state
  if psx then
    love.graphics.setScissor(psx, psy, psw, psh)
  else
    love.graphics.setScissor()
  end

  -- Copy button — only when hovered or showing "Copied!"
  local cs = getCopyState(node)
  local mx, my = love.mouse.getPosition()
  local isHovered = mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h
  if isHovered or cs.copied then
    local btnFont = getMeasure().getFont(9, nil, nil)
    local bx, by, bw, bh = getCopyButtonRect(c, btnFont)

    local btnBg = cs.copied and BTN_BG_COPIED or BTN_BG_NORMAL
    setColorWithOpacity(btnBg, effectiveOpacity)
    love.graphics.rectangle("fill", bx, by, bw, bh, 3, 3)

    local btnColor = cs.copied and BTN_TEXT_COPIED or BTN_TEXT_NORMAL
    setColorWithOpacity(btnColor, effectiveOpacity)
    love.graphics.setFont(btnFont)
    local label = cs.copied and "Copied!" or "Copy"
    love.graphics.print(label, bx + 8, by + 3)
  end
end

-- ============================================================================
-- Text selection support
-- ============================================================================

--- Get the plain-text lines and font info for a CodeBlock node.
--- Used by textselection.lua to extract selected text.
function CodeBlock.getLines(node)
  local props = node.props or {}
  local code = extractCode(node)
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 10, node)
  local s = node.style or {}
  local padding = s.padding or 10
  local font = getMeasure().getFont(fontSize, nil, nil)
  local lineHeight = font:getHeight()

  local entry = getNodeEntry(node)
  local lines = ensureLines(entry, code)
  return lines, font, lineHeight, padding
end

--- Map screen coordinates to (line, col) within this CodeBlock.
--- Returns 1-based line, 0-based col (byte offset).
function CodeBlock.screenToPos(node, mx, my)
  local c = node.computed
  if not c then return 1, 0 end

  local lines, font, lineHeight, padding = CodeBlock.getLines(node)

  -- Convert screen coords to content-space (account for scroll ancestors)
  local sx, sy = mx, my
  local ok, Events = pcall(require, "lua.events")
  if ok and Events and Events.screenToContent then
    sx, sy = Events.screenToContent(node, mx, my)
  end

  -- Account for vertical centering offset (same calculation as render)
  local contentHeight = #lines * lineHeight
  local innerHeight = c.h - 2 * padding
  local yOffset = 0
  if contentHeight < innerHeight then
    yOffset = math.floor((innerHeight - contentHeight) / 2)
  end

  local relY = sy - c.y - padding - yOffset
  local line = math.floor(relY / lineHeight) + 1
  line = math.max(1, math.min(line, #lines))

  local lineText = lines[line] or ""
  local relX = sx - c.x - padding
  local col = 0
  local bytePos = 1
  local len = #lineText

  while bytePos <= len do
    local b = lineText:byte(bytePos)
    local cpLen = (b < 0x80 and 1) or (b < 0xE0 and 2) or (b < 0xF0 and 3) or 4
    local endByte = math.min(bytePos + cpLen - 1, len)

    local substr = lineText:sub(1, endByte)
    local w = font:getWidth(substr)
    if w > relX then
      local prevSubstr = lineText:sub(1, bytePos - 1)
      local prevW = (bytePos > 1) and font:getWidth(prevSubstr) or 0
      col = (relX - prevW < w - relX) and (bytePos - 1) or endByte
      break
    end
    col = endByte
    bytePos = endByte + 1
  end

  return line, col
end

--- Draw selection highlight rectangles for this CodeBlock.
--- Called during render, inside the scissor region.
function CodeBlock.drawHighlight(node, c, padding, lines, font, lineHeight, effectiveOpacity, yOffset)
  -- Lazy-require to avoid circular dependency at load time
  local ok, TextSelection = pcall(require, "lua.textselection")
  if not ok or not TextSelection then return end

  local sel = TextSelection.get()
  if not sel then return end

  -- Check if this node is part of the selection range
  local startNode = sel.startNode
  local endNode = sel.endNode
  if startNode ~= node and endNode ~= node then
    local order = sel.order
    if not order then return end
    local idx = order.indexByNode and order.indexByNode[node]
    local sIdx = order.indexByNode and order.indexByNode[startNode]
    local eIdx = order.indexByNode and order.indexByNode[endNode]
    if not idx or not sIdx or not eIdx then return end
    local lo, hi = math.min(sIdx, eIdx), math.max(sIdx, eIdx)
    if idx < lo or idx > hi then return end
  end

  -- Determine which lines/cols are selected in this node
  local startLine, startCol, endLine, endCol

  -- Normalize direction
  local rangeStartNode, rangeStartLine, rangeStartCol
  local rangeEndNode, rangeEndLine, rangeEndCol
  local order = sel.order
  if order and order.indexByNode then
    local sIdx = order.indexByNode[sel.startNode] or 0
    local eIdx = order.indexByNode[sel.endNode] or 0
    if sIdx < eIdx or (sIdx == eIdx and (sel.startLine < sel.endLine or (sel.startLine == sel.endLine and sel.startCol <= sel.endCol))) then
      rangeStartNode, rangeStartLine, rangeStartCol = sel.startNode, sel.startLine, sel.startCol
      rangeEndNode, rangeEndLine, rangeEndCol = sel.endNode, sel.endLine, sel.endCol
    else
      rangeStartNode, rangeStartLine, rangeStartCol = sel.endNode, sel.endLine, sel.endCol
      rangeEndNode, rangeEndLine, rangeEndCol = sel.startNode, sel.startLine, sel.startCol
    end
  else
    rangeStartNode, rangeStartLine, rangeStartCol = sel.startNode, sel.startLine, sel.startCol
    rangeEndNode, rangeEndLine, rangeEndCol = sel.endNode, sel.endLine, sel.endCol
  end

  if node == rangeStartNode then
    startLine, startCol = rangeStartLine, rangeStartCol
  else
    startLine, startCol = 1, 0
  end

  if node == rangeEndNode then
    endLine, endCol = rangeEndLine, rangeEndCol
  else
    endLine = #lines
    endCol = #(lines[endLine] or "")
  end

  if startLine > endLine or (startLine == endLine and startCol >= endCol) then return end

  love.graphics.setColor(0.22, 0.35, 0.55, 0.55 * effectiveOpacity)

  yOffset = yOffset or 0
  for i = startLine, endLine do
    local lineText = lines[i] or ""
    local x0 = c.x + padding
    local y0 = c.y + padding + yOffset + (i - 1) * lineHeight

    local lsx, lex
    if i == startLine and startCol > 0 then
      lsx = font:getWidth(lineText:sub(1, startCol))
    else
      lsx = 0
    end

    if i == endLine and endCol > 0 then
      lex = font:getWidth(lineText:sub(1, endCol))
    elseif i == endLine then
      lex = 0
    else
      lex = font:getWidth(lineText)
    end

    if lex > lsx then
      love.graphics.rectangle("fill", x0 + lsx, y0, lex - lsx, lineHeight)
    end
  end
end

return CodeBlock
