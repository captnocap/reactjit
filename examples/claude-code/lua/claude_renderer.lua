--[[
  claude_renderer.lua — Terminal-style renderer for Claude Code stream events

  Full Lua visual renderer that paints the chat canvas directly via love.graphics.
  Mirrors the Claude Code CLI aesthetic: monospace text, colored bullets,
  collapsible tool blocks, inline diffs with red/green line backgrounds.

  Architecture:
    - Maintains a blocks[] array that grows as stream events arrive
    - Each block has a type, content, and rendering metadata
    - render() paints all visible blocks within the scissored node rect
    - measure() returns the total content height for scroll sizing

  Follows the codeblock.lua pattern:
    - init(config) receives Measure module
    - measure(node) -> { width, height }
    - render(node, c, effectiveOpacity)
    - Uses transformPoint for scissor-safe scroll containers
]]

local Measure = nil
local Color   = require("lua.color")
local Syntax  = require("lua.syntax")

local Renderer = {}

-- ============================================================================
-- Constants
-- ============================================================================

local COLORS = {
  bg          = Color.toTable("#0f172a"),
  text        = Color.toTable("#e2e8f0"),
  textDim     = Color.toTable("#94a3b8"),
  textMuted   = Color.toTable("#64748b"),
  bulletText  = Color.toTable("#e2e8f0"),
  bulletTool  = Color.toTable("#eab308"),  -- yellow for tool calls
  bulletError = Color.toTable("#ef4444"),  -- red for errors
  bulletActive= Color.toTable("#f97316"),  -- orange for in-progress
  promptBg    = Color.toTable("#1e293b"),
  promptText  = Color.toTable("#e2e8f0"),
  promptCaret = Color.toTable("#94a3b8"),
  diffAdd     = Color.toTable("#1e3a1e"),
  diffRemove  = Color.toTable("#3a1e1e"),
  diffBorder  = Color.toTable("#334155"),
  diffHeader  = Color.toTable("#1e293b"),
  toolOutput  = Color.toTable("#94a3b8"),
  border      = Color.toTable("#334155"),
  statusBg    = Color.toTable("#0f172a"),
  statusText  = Color.toTable("#64748b"),
  systemText  = Color.toTable("#64748b"),
  inputHighlight = Color.toTable("#1e293b"),
}

local MARGIN_LEFT   = 16   -- left margin for all content
local BULLET_SIZE   = 6    -- bullet dot radius
local BULLET_GAP    = 10   -- gap between bullet and text
local INDENT        = 20   -- indentation for tool output
local BLOCK_GAP     = 6    -- vertical gap between blocks
local DIFF_PADDING  = 8    -- padding inside diff box
local LINE_NUM_WIDTH = 32  -- width reserved for line numbers in diffs

-- ============================================================================
-- Init
-- ============================================================================

function Renderer.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- State management (per-session block lists)
-- ============================================================================

-- sessionId -> { blocks = {}, scrollY = 0, ... }
local _sessions = {}

function Renderer.getSession(sessionId)
  if not _sessions[sessionId] then
    _sessions[sessionId] = {
      blocks = {},
      scrollY = 0,
      inputText = "",
      inputHistory = {},
      inputHistoryIdx = 0,
      streamingText = "",
      isStreaming = false,
      elapsedTime = 0,
      tokenCount = 0,
      model = "",
      status = "idle",
    }
  end
  return _sessions[sessionId]
end

function Renderer.clearSession(sessionId)
  _sessions[sessionId] = nil
end

-- ============================================================================
-- Block creation
-- ============================================================================

local function newBlock(btype, data)
  data = data or {}
  data.type = btype
  data.timestamp = os.clock()
  data.collapsed = data.collapsed or false
  return data
end

--- Add a user input block ("> prompt text")
function Renderer.addUserInput(sessionId, text)
  local session = Renderer.getSession(sessionId)
  session.blocks[#session.blocks + 1] = newBlock("user_input", {
    content = text,
  })
end

--- Add a text block (bullet + assistant text)
function Renderer.addText(sessionId, text)
  local session = Renderer.getSession(sessionId)
  session.blocks[#session.blocks + 1] = newBlock("text", {
    content = text,
  })
end

--- Add a tool start block (bullet + ToolName(args))
function Renderer.addToolStart(sessionId, toolName, toolId, input)
  local session = Renderer.getSession(sessionId)
  -- Extract file_path from input if present
  local filePath = nil
  if type(input) == "table" then
    filePath = input.file_path or input.path or input.command
  end
  session.blocks[#session.blocks + 1] = newBlock("tool_start", {
    toolName = toolName,
    toolId = toolId,
    input = input,
    filePath = filePath,
    output = nil,
    collapsed = true,  -- start collapsed
  })
end

--- Add output to the most recent tool block
function Renderer.addToolOutput(sessionId, text)
  local session = Renderer.getSession(sessionId)
  -- Find the last tool_start block
  for i = #session.blocks, 1, -1 do
    if session.blocks[i].type == "tool_start" then
      session.blocks[i].output = text
      break
    end
  end
end

--- Add a diff block (Edit tool visualization)
function Renderer.addDiff(sessionId, filePath, oldStr, newStr)
  local session = Renderer.getSession(sessionId)
  local diffLines = Renderer.computeDiff(oldStr or "", newStr or "")
  session.blocks[#session.blocks + 1] = newBlock("diff", {
    filePath = filePath,
    diffLines = diffLines,
    collapsed = false,
  })
end

--- Add an error block
function Renderer.addError(sessionId, text)
  local session = Renderer.getSession(sessionId)
  session.blocks[#session.blocks + 1] = newBlock("error", {
    content = text,
  })
end

--- Add a system info block (version, model, cwd)
function Renderer.addSystem(sessionId, text)
  local session = Renderer.getSession(sessionId)
  session.blocks[#session.blocks + 1] = newBlock("system", {
    content = text,
  })
end

--- Update streaming text (partial assistant message)
function Renderer.setStreaming(sessionId, text)
  local session = Renderer.getSession(sessionId)
  session.streamingText = text or ""
  session.isStreaming = (text ~= nil and text ~= "")
end

--- Update status
function Renderer.setStatus(sessionId, status, model, elapsed, tokens)
  local session = Renderer.getSession(sessionId)
  if status then session.status = status end
  if model then session.model = model end
  if elapsed then session.elapsedTime = elapsed end
  if tokens then session.tokenCount = tokens end
end

--- Adjust scroll position by delta pixels. Positive delta = scroll down.
function Renderer.adjustScroll(sessionId, delta, viewportH)
  local session = Renderer.getSession(sessionId)
  session.scrollY = session.scrollY + delta
  if session.scrollY < 0 then session.scrollY = 0 end
  local maxScroll = (session._contentHeight or 0) - (viewportH or 600)
  if maxScroll < 0 then maxScroll = 0 end
  if session.scrollY > maxScroll then session.scrollY = maxScroll end
  -- If user scrolled away from bottom, mark it so auto-scroll doesn't fight them
  session._userScrolled = (session.scrollY < maxScroll - 5)
end

--- Scroll to bottom (clears user-scrolled flag)
function Renderer.scrollToBottom(sessionId, viewportH)
  local session = Renderer.getSession(sessionId)
  local maxScroll = (session._contentHeight or 0) - (viewportH or 600)
  if maxScroll < 0 then maxScroll = 0 end
  session.scrollY = maxScroll
  session._userScrolled = false
end

--- Toggle collapse on the Nth tool block (0-indexed from bottom)
function Renderer.toggleCollapse(sessionId, blockIdx)
  local session = Renderer.getSession(sessionId)
  local block = session.blocks[blockIdx]
  if block and (block.type == "tool_start" or block.type == "diff") then
    block.collapsed = not block.collapsed
  end
end

-- ============================================================================
-- Simple line diff computation
-- ============================================================================

function Renderer.computeDiff(oldStr, newStr)
  local oldLines = {}
  for line in (oldStr .. "\n"):gmatch("([^\n]*)\n") do
    oldLines[#oldLines + 1] = line
  end
  local newLines = {}
  for line in (newStr .. "\n"):gmatch("([^\n]*)\n") do
    newLines[#newLines + 1] = line
  end

  local result = {}

  -- Simple approach: show old lines as removals, new lines as additions
  -- with shared context lines between them
  local oldSet = {}
  for _, line in ipairs(oldLines) do
    oldSet[line] = (oldSet[line] or 0) + 1
  end

  local newSet = {}
  for _, line in ipairs(newLines) do
    newSet[line] = (newSet[line] or 0) + 1
  end

  -- Mark removals (in old but not enough in new)
  local newCounts = {}
  for _, line in ipairs(newLines) do
    newCounts[line] = (newCounts[line] or 0) + 1
  end

  for i, line in ipairs(oldLines) do
    if newCounts[line] and newCounts[line] > 0 then
      newCounts[line] = newCounts[line] - 1
      -- context line (appears in both)
    else
      result[#result + 1] = { type = "remove", lineNum = i, text = line }
    end
  end

  -- Mark additions (in new but not enough in old)
  local oldCounts = {}
  for _, line in ipairs(oldLines) do
    oldCounts[line] = (oldCounts[line] or 0) + 1
  end

  for i, line in ipairs(newLines) do
    if oldCounts[line] and oldCounts[line] > 0 then
      oldCounts[line] = oldCounts[line] - 1
      result[#result + 1] = { type = "context", lineNum = i, text = line }
    else
      result[#result + 1] = { type = "add", lineNum = i, text = line }
    end
  end

  return result
end

-- ============================================================================
-- Helpers
-- ============================================================================

local function setColorWithOpacity(color, opacity)
  love.graphics.setColor(color[1], color[2], color[3], (color[4] or 1) * opacity)
end

--- Word-wrap text to fit within a given pixel width using the current font.
--- Handles long unbreakable strings (paths, URLs) by breaking mid-word.
local function wrapText(font, text, maxWidth)
  if not text or text == "" then return { "" } end
  if maxWidth <= 0 then return { text } end

  -- Break a single word that exceeds maxWidth into character-level chunks
  local function breakWord(word)
    local chunks = {}
    local chunk = ""
    for i = 1, #word do
      local ch = word:sub(i, i)
      if font:getWidth(chunk .. ch) > maxWidth and #chunk > 0 then
        chunks[#chunks + 1] = chunk
        chunk = ch
      else
        chunk = chunk .. ch
      end
    end
    if #chunk > 0 then chunks[#chunks + 1] = chunk end
    return chunks
  end

  local lines = {}
  -- First split by actual newlines
  for segment in (text .. "\n"):gmatch("([^\n]*)\n") do
    if font:getWidth(segment) <= maxWidth then
      lines[#lines + 1] = segment
    else
      -- Word wrap this segment
      local current = ""
      for word in segment:gmatch("%S+") do
        -- If the word itself is wider than maxWidth, break it
        if font:getWidth(word) > maxWidth then
          -- Flush current line first
          if current ~= "" then
            lines[#lines + 1] = current
            current = ""
          end
          local chunks = breakWord(word)
          for ci, chunk in ipairs(chunks) do
            if ci < #chunks then
              lines[#lines + 1] = chunk
            else
              current = chunk  -- last chunk continues as current line
            end
          end
        else
          local test = current == "" and word or (current .. " " .. word)
          if font:getWidth(test) > maxWidth and current ~= "" then
            lines[#lines + 1] = current
            current = word
          else
            current = test
          end
        end
      end
      lines[#lines + 1] = current
    end
  end
  return lines
end

--- Get a compact tool summary string
local function toolSummary(block)
  local name = block.toolName or "unknown"
  local fp = block.filePath
  if fp then
    return name .. "(" .. fp .. ")"
  end
  return name
end

-- ============================================================================
-- Measurement
-- ============================================================================

function Renderer.measure(node)
  if not Measure then return { width = 400, height = 300 } end

  local props = node.props or {}
  local sessionId = props.sessionId or "default"
  local session = Renderer.getSession(sessionId)

  local fontSize = 13
  local font = Measure.getFont(fontSize, nil, nil)
  local boldFont = Measure.getFont(fontSize, nil, "bold")
  local smallFont = Measure.getFont(11, nil, nil)
  local lineHeight = font:getHeight()
  local parentW = (node.computed and node.computed.w) or 800

  local contentWidth = parentW - MARGIN_LEFT * 2
  local textWidth = contentWidth - BULLET_SIZE * 2 - BULLET_GAP
  local totalHeight = 12  -- top padding

  for _, block in ipairs(session.blocks) do
    if block.type == "user_input" then
      local wrapped = wrapText(font, "> " .. (block.content or ""), contentWidth)
      totalHeight = totalHeight + #wrapped * lineHeight + 8 + BLOCK_GAP

    elseif block.type == "text" then
      local wrapped = wrapText(font, block.content or "", textWidth)
      totalHeight = totalHeight + #wrapped * lineHeight + BLOCK_GAP

    elseif block.type == "tool_start" then
      totalHeight = totalHeight + lineHeight + BLOCK_GAP
      if not block.collapsed and block.output then
        local wrapped = wrapText(smallFont, block.output, textWidth - INDENT)
        totalHeight = totalHeight + #wrapped * smallFont:getHeight() + 4
      end

    elseif block.type == "diff" then
      totalHeight = totalHeight + lineHeight + 4  -- header
      if not block.collapsed and block.diffLines then
        totalHeight = totalHeight + #block.diffLines * lineHeight + DIFF_PADDING * 2 + 4
      end
      totalHeight = totalHeight + BLOCK_GAP

    elseif block.type == "error" then
      local wrapped = wrapText(font, block.content or "", textWidth)
      totalHeight = totalHeight + #wrapped * lineHeight + BLOCK_GAP

    elseif block.type == "system" then
      local wrapped = wrapText(smallFont, block.content or "", contentWidth)
      totalHeight = totalHeight + #wrapped * smallFont:getHeight() + BLOCK_GAP
    end
  end

  -- Streaming text
  if session.isStreaming and session.streamingText ~= "" then
    local wrapped = wrapText(font, session.streamingText, textWidth)
    totalHeight = totalHeight + #wrapped * lineHeight + BLOCK_GAP
  end

  -- Bottom padding for input area + status
  totalHeight = totalHeight + lineHeight + 40

  return { width = parentW, height = totalHeight }
end

-- ============================================================================
-- Rendering
-- ============================================================================

function Renderer.render(node, c, effectiveOpacity)
  if not Measure then return end

  local props = node.props or {}
  local sessionId = props.sessionId or "default"
  local session = Renderer.getSession(sessionId)

  local fontSize = 13
  local font = Measure.getFont(fontSize, nil, nil)
  local boldFont = Measure.getFont(fontSize, nil, "bold")
  local smallFont = Measure.getFont(11, nil, nil)
  local lineHeight = font:getHeight()
  local smallLineHeight = smallFont:getHeight()

  local contentWidth = c.w - MARGIN_LEFT * 2
  local textWidth = contentWidth - BULLET_SIZE * 2 - BULLET_GAP
  local textStartX = c.x + MARGIN_LEFT + BULLET_SIZE * 2 + BULLET_GAP

  -- Scissor to node rect (transform-aware for scroll containers)
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  love.graphics.setScissor(sx, sy, c.w, c.h)

  -- Background (fixed, not scrolled)
  setColorWithOpacity(COLORS.bg, effectiveOpacity)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

  -- Apply scroll offset — content moves up by scrollY
  local scrollY = session.scrollY or 0
  local curY = c.y + 12 - scrollY  -- top padding, offset by scroll
  love.graphics.setFont(font)

  for _, block in ipairs(session.blocks) do

    -- ── User input: "> prompt text" with highlight bg ──
    if block.type == "user_input" then
      local wrapped = wrapText(font, "> " .. (block.content or ""), contentWidth)
      -- Highlight background
      setColorWithOpacity(COLORS.inputHighlight, effectiveOpacity)
      love.graphics.rectangle("fill", c.x, curY, c.w, #wrapped * lineHeight + 8, 4, 4)
      -- Text
      setColorWithOpacity(COLORS.promptText, effectiveOpacity)
      love.graphics.setFont(font)
      for i, line in ipairs(wrapped) do
        love.graphics.print(line, c.x + MARGIN_LEFT, curY + 4 + (i - 1) * lineHeight)
      end
      curY = curY + #wrapped * lineHeight + 8 + BLOCK_GAP

    -- ── Text: bullet + flowing text ──
    elseif block.type == "text" then
      -- Bullet
      setColorWithOpacity(COLORS.bulletText, effectiveOpacity)
      love.graphics.circle("fill", c.x + MARGIN_LEFT + BULLET_SIZE, curY + lineHeight / 2, BULLET_SIZE / 2)
      -- Text
      setColorWithOpacity(COLORS.text, effectiveOpacity)
      love.graphics.setFont(font)
      local wrapped = wrapText(font, block.content or "", textWidth)
      for i, line in ipairs(wrapped) do
        love.graphics.print(line, textStartX, curY + (i - 1) * lineHeight)
      end
      curY = curY + #wrapped * lineHeight + BLOCK_GAP

    -- ── Tool start: bullet + Bold(ToolName)(args) ──
    elseif block.type == "tool_start" then
      -- Yellow bullet
      setColorWithOpacity(COLORS.bulletTool, effectiveOpacity)
      love.graphics.circle("fill", c.x + MARGIN_LEFT + BULLET_SIZE, curY + lineHeight / 2, BULLET_SIZE / 2)
      -- Tool name (bold)
      love.graphics.setFont(boldFont)
      setColorWithOpacity(COLORS.text, effectiveOpacity)
      local summary = toolSummary(block)
      love.graphics.print(summary, textStartX, curY)
      -- Collapse indicator
      local indicator = block.collapsed and "(ctrl+r to expand)" or ""
      if block.output and block.collapsed then
        love.graphics.setFont(smallFont)
        setColorWithOpacity(COLORS.textMuted, effectiveOpacity)
        love.graphics.print(indicator, textStartX + boldFont:getWidth(summary) + 8, curY + 2)
      end
      curY = curY + lineHeight

      -- Expanded tool output
      if not block.collapsed and block.output then
        love.graphics.setFont(smallFont)
        setColorWithOpacity(COLORS.toolOutput, effectiveOpacity)
        local wrapped = wrapText(smallFont, block.output, textWidth - INDENT)
        for i, line in ipairs(wrapped) do
          love.graphics.print(line, textStartX + INDENT, curY + (i - 1) * smallLineHeight)
        end
        curY = curY + #wrapped * smallLineHeight + 4
      end
      curY = curY + BLOCK_GAP

    -- ── Diff: bordered box with red/green lines ──
    elseif block.type == "diff" then
      local diffLines = block.diffLines or {}
      -- Header
      setColorWithOpacity(COLORS.diffHeader, effectiveOpacity)
      local headerH = lineHeight + 4
      love.graphics.rectangle("fill", c.x + MARGIN_LEFT, curY, contentWidth, headerH)
      love.graphics.setFont(boldFont)
      setColorWithOpacity(COLORS.text, effectiveOpacity)
      love.graphics.print(block.filePath or "file", c.x + MARGIN_LEFT + DIFF_PADDING, curY + 2)
      curY = curY + headerH

      if not block.collapsed then
        -- Diff body border
        local bodyH = #diffLines * lineHeight + DIFF_PADDING * 2
        setColorWithOpacity(COLORS.diffBorder, effectiveOpacity)
        love.graphics.setLineWidth(1)
        love.graphics.rectangle("line", c.x + MARGIN_LEFT, curY, contentWidth, bodyH)

        local lineY = curY + DIFF_PADDING
        love.graphics.setFont(font)
        for _, dl in ipairs(diffLines) do
          -- Line background
          if dl.type == "add" then
            setColorWithOpacity(COLORS.diffAdd, effectiveOpacity)
            love.graphics.rectangle("fill", c.x + MARGIN_LEFT + 1, lineY, contentWidth - 2, lineHeight)
          elseif dl.type == "remove" then
            setColorWithOpacity(COLORS.diffRemove, effectiveOpacity)
            love.graphics.rectangle("fill", c.x + MARGIN_LEFT + 1, lineY, contentWidth - 2, lineHeight)
          end

          -- Line number
          setColorWithOpacity(COLORS.textMuted, effectiveOpacity)
          local numStr = tostring(dl.lineNum or "")
          love.graphics.print(numStr, c.x + MARGIN_LEFT + DIFF_PADDING, lineY)

          -- +/- prefix
          local prefix = dl.type == "add" and "+" or (dl.type == "remove" and "-" or " ")
          setColorWithOpacity(
            dl.type == "add" and Color.toTable("#4ade80") or
            dl.type == "remove" and Color.toTable("#f87171") or
            COLORS.textDim,
            effectiveOpacity
          )
          love.graphics.print(prefix, c.x + MARGIN_LEFT + DIFF_PADDING + LINE_NUM_WIDTH, lineY)

          -- Line text (with syntax highlighting)
          local tokens = Syntax.tokenizeLine(dl.text or "")
          local tx = c.x + MARGIN_LEFT + DIFF_PADDING + LINE_NUM_WIDTH + font:getWidth("+ ")
          for _, tok in ipairs(tokens) do
            setColorWithOpacity(tok.color, effectiveOpacity)
            love.graphics.print(tok.text, tx, lineY)
            tx = tx + font:getWidth(tok.text)
          end

          lineY = lineY + lineHeight
        end

        curY = curY + bodyH + 4
      end
      curY = curY + BLOCK_GAP

    -- ── Error: red bullet + text ──
    elseif block.type == "error" then
      setColorWithOpacity(COLORS.bulletError, effectiveOpacity)
      love.graphics.circle("fill", c.x + MARGIN_LEFT + BULLET_SIZE, curY + lineHeight / 2, BULLET_SIZE / 2)
      setColorWithOpacity(COLORS.bulletError, effectiveOpacity)
      love.graphics.setFont(font)
      local wrapped = wrapText(font, block.content or "", textWidth)
      for i, line in ipairs(wrapped) do
        love.graphics.print(line, textStartX, curY + (i - 1) * lineHeight)
      end
      curY = curY + #wrapped * lineHeight + BLOCK_GAP

    -- ── System: dimmed info text ──
    elseif block.type == "system" then
      love.graphics.setFont(smallFont)
      setColorWithOpacity(COLORS.systemText, effectiveOpacity)
      local wrapped = wrapText(smallFont, block.content or "", contentWidth)
      for i, line in ipairs(wrapped) do
        love.graphics.print(line, c.x + MARGIN_LEFT, curY + (i - 1) * smallLineHeight)
      end
      curY = curY + #wrapped * smallLineHeight + BLOCK_GAP
    end
  end

  -- ── Streaming text (partial assistant message) ──
  if session.isStreaming and session.streamingText ~= "" then
    -- Orange bullet (active)
    setColorWithOpacity(COLORS.bulletActive, effectiveOpacity)
    love.graphics.circle("fill", c.x + MARGIN_LEFT + BULLET_SIZE, curY + lineHeight / 2, BULLET_SIZE / 2)
    -- Text
    setColorWithOpacity(COLORS.text, effectiveOpacity)
    love.graphics.setFont(font)
    local wrapped = wrapText(font, session.streamingText, textWidth)
    for i, line in ipairs(wrapped) do
      love.graphics.print(line, textStartX, curY + (i - 1) * lineHeight)
    end
    curY = curY + #wrapped * lineHeight + BLOCK_GAP
  end

  -- Track content height for scroll clamping
  -- curY is currently offset by scroll, so add scrollY back to get true content height
  local contentHeight = (curY + scrollY) - c.y + lineHeight + 40
  session._contentHeight = contentHeight

  -- Clamp scroll
  local maxScroll = contentHeight - c.h
  if maxScroll < 0 then maxScroll = 0 end
  if session.scrollY > maxScroll then session.scrollY = maxScroll end

  -- Auto-scroll to bottom during streaming, but only if user hasn't scrolled away
  if session.isStreaming and not session._userScrolled then
    session.scrollY = maxScroll
  end

  -- ── Status bar at bottom (fixed, not scrolled) ──
  local statusY = c.y + c.h - smallLineHeight - 8
  love.graphics.setFont(smallFont)
  setColorWithOpacity(COLORS.statusText, effectiveOpacity)
  local statusLeft = session.status
  if session.model and session.model ~= "" then
    statusLeft = statusLeft .. "  |  " .. session.model
  end
  love.graphics.print(statusLeft, c.x + MARGIN_LEFT, statusY)
  -- Right-aligned hints
  local hints = "? for shortcuts"
  local hintsW = smallFont:getWidth(hints)
  love.graphics.print(hints, c.x + c.w - hintsW - MARGIN_LEFT, statusY)

  -- Reset scissor
  love.graphics.setScissor()

  -- Permission overlay removed — React Modal handles it now.
  -- Status bar shows "awaiting approval" when permission is active.
  if session.permissionPrompt then
    love.graphics.setFont(smallFont)
    setColorWithOpacity(Color.toTable("#f97316"), effectiveOpacity)
    local awaitText = "Awaiting approval: " .. (session.permissionPrompt.action or "tool")
    love.graphics.print(awaitText, c.x + MARGIN_LEFT, statusY - smallLineHeight - 4)
  end
end

-- ── Permission prompt API ──────────────────────────────────────────

function Renderer.showPermissionPrompt(sessionId, permInfo)
  local session = Renderer.getSession(sessionId)
  session.permissionPrompt = {
    action = permInfo.action,
    target = permInfo.target,
    rawQuestion = permInfo.rawQuestion,
  }
end

function Renderer.resolvePermissionPrompt(sessionId, label)
  local session = Renderer.getSession(sessionId)
  if session.permissionPrompt then
    Renderer.addSystem(sessionId, label .. ": " .. (session.permissionPrompt.target or "tool"))
  end
  session.permissionPrompt = nil
end

function Renderer.getPermissionPrompt(sessionId)
  local session = Renderer.getSession(sessionId)
  return session.permissionPrompt
end

return Renderer
