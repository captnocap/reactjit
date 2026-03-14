--[[
  markdown.lua -- Lua-owned markdown parser + renderer

  Same pattern as codeblock.lua: React emits a 'Markdown' host element,
  Lua does all parsing and rendering. No TypeScript string manipulation.

  Provides:
    - Markdown.measure(node, includeWidth?) -> { width, height }
    - Markdown.render(node, c, effectiveOpacity)

  Supported markdown:
    - Headings (# ## ###)
    - Code blocks (``` with language)
    - Inline code (`code`)
    - Bullet lists (- or *)
    - Numbered lists (1. 2. 3.)
    - Blockquotes (> text)
    - Tables (| col | col |)
    - Bold (**text**), italic (*text*), bold+italic (***text***)
    - Horizontal rules (--- or ***)
    - Plain text paragraphs
]]

local Color   = require("lua.color")
local Syntax  = require("lua.syntax")

local Markdown = {}

-- Weak-keyed cache: parsed blocks + measurement per node
local cache = setmetatable({}, { __mode = "k" })

local Measure = nil

local function getMeasure()
  if not Measure then
    Measure = require("lua.measure")
  end
  return Measure
end

-- ============================================================================
-- Colors
-- ============================================================================

local COLORS = {
  text        = Color.toTable("#cdd6f4"),
  heading     = Color.toTable("#cba6f7"),
  bullet      = Color.toTable("#f9e2af"),
  blockquoteBg = Color.toTable("#1a1a2e"),
  blockquoteBorder = Color.toTable("#45475a"),
  blockquoteText = Color.toTable("#a6adc8"),
  inlineCode  = Color.toTable("#fab387"),
  inlineCodeBg = Color.toTable("#1e1e2e"),
  bold        = Color.toTable("#f5e0dc"),
  italic      = Color.toTable("#b4befe"),
  link        = Color.toTable("#89b4fa"),
  tableBorder = Color.toTable("#313244"),
  tableHeader = Color.toTable("#585b70"),
  hrColor     = Color.toTable("#45475a"),
  muted       = Color.toTable("#6c7086"),
}

-- ============================================================================
-- Parser — text → block list
-- ============================================================================

-- Block types:
--   { type="heading",    level=1..3, text="..." }
--   { type="code",       lang="lua", lines={"..."} }
--   { type="paragraph",  spans={{text, style}...} }
--   { type="bullet",     spans={{text, style}...}, indent=0 }
--   { type="numbered",   spans={{text, style}...}, number=1 }
--   { type="blockquote", spans={{text, style}...} }
--   { type="table",      headers={"..."}, rows={{"..."}...} }
--   { type="hr" }

--- Parse inline formatting: bold, italic, inline code, links → span list
--- Each span: { text=string, style="normal"|"bold"|"italic"|"bolditalic"|"code"|"link" }
local function parseInline(text)
  local spans = {}
  local i = 1
  local len = #text
  local buf = ""

  local function flush()
    if #buf > 0 then
      spans[#spans + 1] = { text = buf, style = "normal" }
      buf = ""
    end
  end

  while i <= len do
    local c = text:sub(i, i)

    -- Inline code: `...`
    if c == "`" then
      flush()
      local j = text:find("`", i + 1, true)
      if j then
        spans[#spans + 1] = { text = text:sub(i + 1, j - 1), style = "code" }
        i = j + 1
      else
        buf = buf .. c
        i = i + 1
      end

    -- Bold+italic: ***...***
    elseif text:sub(i, i + 2) == "***" then
      flush()
      local j = text:find("***", i + 3, true)
      if j then
        spans[#spans + 1] = { text = text:sub(i + 3, j - 1), style = "bolditalic" }
        i = j + 3
      else
        buf = buf .. "***"
        i = i + 3
      end

    -- Bold: **...**
    elseif text:sub(i, i + 1) == "**" then
      flush()
      local j = text:find("**", i + 2, true)
      if j then
        spans[#spans + 1] = { text = text:sub(i + 2, j - 1), style = "bold" }
        i = j + 2
      else
        buf = buf .. "**"
        i = i + 2
      end

    -- Italic: *...*  (single asterisk, not followed by another *)
    elseif c == "*" and text:sub(i + 1, i + 1) ~= "*" then
      flush()
      local j = text:find("*", i + 1, true)
      if j and text:sub(j + 1, j + 1) ~= "*" then
        spans[#spans + 1] = { text = text:sub(i + 1, j - 1), style = "italic" }
        i = j + 1
      else
        buf = buf .. c
        i = i + 1
      end

    -- Link: [text](url)
    elseif c == "[" then
      local closeBracket = text:find("]", i + 1, true)
      if closeBracket and text:sub(closeBracket + 1, closeBracket + 1) == "(" then
        local closeParen = text:find(")", closeBracket + 2, true)
        if closeParen then
          flush()
          spans[#spans + 1] = { text = text:sub(i + 1, closeBracket - 1), style = "link" }
          i = closeParen + 1
        else
          buf = buf .. c
          i = i + 1
        end
      else
        buf = buf .. c
        i = i + 1
      end

    else
      buf = buf .. c
      i = i + 1
    end
  end

  flush()
  return spans
end

--- Parse full markdown text into block list
local function parseBlocks(text)
  local blocks = {}
  local lines = {}
  for line in (text .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end

  local i = 1
  local numLines = #lines

  while i <= numLines do
    local line = lines[i]
    local trimmed = line:match("^%s*(.-)%s*$")

    -- Code fence
    if trimmed:match("^```") then
      local lang = trimmed:match("^```(%w*)")
      local codeLines = {}
      i = i + 1
      while i <= numLines do
        if lines[i]:match("^%s*```%s*$") then
          i = i + 1
          break
        end
        codeLines[#codeLines + 1] = lines[i]
        i = i + 1
      end
      blocks[#blocks + 1] = { type = "code", lang = lang ~= "" and lang or nil, lines = codeLines }

    -- Heading
    elseif trimmed:match("^#+%s") then
      local hashes, rest = trimmed:match("^(#+)%s+(.+)$")
      if hashes then
        blocks[#blocks + 1] = { type = "heading", level = math.min(#hashes, 3), text = rest }
      end
      i = i + 1

    -- Horizontal rule
    elseif trimmed:match("^%-%-%-+$") or trimmed:match("^%*%*%*+$") then
      blocks[#blocks + 1] = { type = "hr" }
      i = i + 1

    -- Table: detect by pipe-delimited lines
    elseif trimmed:match("^|.*|$") then
      local headerLine = trimmed
      local headers = {}
      for cell in headerLine:gmatch("|([^|]+)") do
        local t = cell:match("^%s*(.-)%s*$")
        if t and #t > 0 then headers[#headers + 1] = t end
      end
      -- Skip separator line (|---|---|)
      if i + 1 <= numLines and lines[i + 1]:match("^%s*|[-%s|:]+|%s*$") then
        i = i + 2
      else
        i = i + 1
      end
      local rows = {}
      while i <= numLines do
        local rowLine = lines[i]:match("^%s*(.-)%s*$")
        if not rowLine:match("^|.*|$") then break end
        local cells = {}
        for cell in rowLine:gmatch("|([^|]+)") do
          local t = cell:match("^%s*(.-)%s*$")
          if t then cells[#cells + 1] = t end
        end
        rows[#rows + 1] = cells
        i = i + 1
      end
      blocks[#blocks + 1] = { type = "table", headers = headers, rows = rows }

    -- Blockquote
    elseif trimmed:match("^>%s?") then
      local quoteText = trimmed:gsub("^>%s?", "")
      -- Gather consecutive blockquote lines
      i = i + 1
      while i <= numLines do
        local next = lines[i]:match("^%s*(.-)%s*$")
        if not next:match("^>%s?") then break end
        quoteText = quoteText .. " " .. next:gsub("^>%s?", "")
        i = i + 1
      end
      blocks[#blocks + 1] = { type = "blockquote", spans = parseInline(quoteText) }

    -- Bullet list
    elseif trimmed:match("^[-*]%s+") then
      local content = trimmed:gsub("^[-*]%s+", "")
      blocks[#blocks + 1] = { type = "bullet", spans = parseInline(content) }
      i = i + 1

    -- Numbered list
    elseif trimmed:match("^%d+%.%s+") then
      local num = tonumber(trimmed:match("^(%d+)%."))
      local content = trimmed:gsub("^%d+%.%s+", "")
      blocks[#blocks + 1] = { type = "numbered", spans = parseInline(content), number = num or 1 }
      i = i + 1

    -- Empty line
    elseif #trimmed == 0 then
      i = i + 1

    -- Plain paragraph
    else
      local paraText = trimmed
      i = i + 1
      -- Gather consecutive non-special lines into one paragraph
      while i <= numLines do
        local next = lines[i]:match("^%s*(.-)%s*$")
        if #next == 0 or next:match("^```") or next:match("^#+%s") or next:match("^[-*]%s+")
           or next:match("^%d+%.%s+") or next:match("^>%s?") or next:match("^|.*|$")
           or next:match("^%-%-%-+$") or next:match("^%*%*%*+$") then
          break
        end
        paraText = paraText .. " " .. next
        i = i + 1
      end
      blocks[#blocks + 1] = { type = "paragraph", spans = parseInline(paraText) }
    end
  end

  return blocks
end

-- ============================================================================
-- Cache management
-- ============================================================================

local function getEntry(node)
  local entry = cache[node]
  if not entry then
    entry = {}
    cache[node] = entry
  end
  return entry
end

local function extractText(node)
  -- Read from props.text first, then children
  local props = node.props or {}
  if props.text and #props.text > 0 then return props.text end
  local children = node.children
  if children and #children > 0 then
    local parts = {}
    for _, child in ipairs(children) do
      if child.type == "__TEXT__" and child.text then
        parts[#parts + 1] = child.text
      elseif child.type == "Text" and child.children then
        for _, tc in ipairs(child.children) do
          if tc.type == "__TEXT__" and tc.text then
            parts[#parts + 1] = tc.text
          end
        end
      end
    end
    if #parts > 0 then return table.concat(parts, "\n") end
  end
  return ""
end

local function ensureBlocks(entry, text)
  if entry.blocks and entry.textPtr == text then
    return entry.blocks
  end
  -- Content-based check
  local sig = #text <= 64 and (#text .. ":" .. text) or (#text .. ":" .. text:sub(1, 64))
  if entry.blocks and entry.textSig == sig then
    entry.textPtr = text
    return entry.blocks
  end
  entry.textPtr = text
  entry.textSig = sig
  entry.blocks = parseBlocks(text)
  entry._measured = nil
  return entry.blocks
end

-- ============================================================================
-- Measurement
-- ============================================================================

local HEADING_SIZES = { 20, 16, 14 }
local BASE_FONT_SIZE = 12
local LINE_SPACING = 4
local BLOCK_SPACING = 8
local CODE_PADDING = 8
local BLOCKQUOTE_PADDING = 10
local TABLE_CELL_PAD = 6

--- Measure span width using the given font
local function measureSpans(spans, font)
  local w = 0
  for _, span in ipairs(spans) do
    w = w + font:getWidth(span.text)
  end
  return w
end

--- Word-wrap spans into lines that fit within maxW.
--- Returns a list of lines, each a list of spans.
local function wrapSpans(spans, font, maxW)
  if maxW <= 0 then maxW = 99999 end
  local lines = {}
  local currentLine = {}
  local currentW = 0

  for _, span in ipairs(spans) do
    -- Split span text by words
    local words = {}
    for word in span.text:gmatch("%S+") do
      words[#words + 1] = word
    end

    for wi, word in ipairs(words) do
      local wordW = font:getWidth(word)
      local spaceW = (currentW > 0 or wi > 1) and font:getWidth(" ") or 0

      if currentW > 0 and currentW + spaceW + wordW > maxW then
        -- Wrap to new line
        lines[#lines + 1] = currentLine
        currentLine = {}
        currentW = 0
        spaceW = 0
      end

      if currentW > 0 then
        currentLine[#currentLine + 1] = { text = " ", style = span.style }
        currentW = currentW + spaceW
      end
      currentLine[#currentLine + 1] = { text = word, style = span.style }
      currentW = currentW + wordW
    end
  end

  if #currentLine > 0 then
    lines[#lines + 1] = currentLine
  end

  return lines
end

function Markdown.measure(node, includeWidth)
  local props = node.props or {}
  local text = extractText(node)
  local baseFontSize = getMeasure().scaleFontSize(props.fontSize or BASE_FONT_SIZE, node)
  local entry = getEntry(node)
  local blocks = ensureBlocks(entry, text)

  -- Use _flexW or parent width for wrapping
  local maxW = node._flexW or (node.computed and node.computed.w) or 400
  local s = node.style or {}
  local padL = s.paddingLeft or s.paddingHorizontal or s.padding or 0
  local padR = s.paddingRight or s.paddingHorizontal or s.padding or 0
  local padT = s.paddingTop or s.paddingVertical or s.padding or 0
  local padB = s.paddingBottom or s.paddingVertical or s.padding or 0
  local innerW = maxW - padL - padR

  local totalH = 0
  local maxContentW = 0

  for bi, block in ipairs(blocks) do
    if bi > 1 then totalH = totalH + BLOCK_SPACING end

    if block.type == "heading" then
      local fontSize = getMeasure().scaleFontSize(HEADING_SIZES[block.level] or 14, node)
      local font = getMeasure().getFont(fontSize, nil, nil)
      local lineH = font:getHeight()
      -- Wrap heading text too
      local wrapped = wrapSpans(parseInline(block.text), font, innerW)
      totalH = totalH + #wrapped * (lineH + LINE_SPACING)
      for _, line in ipairs(wrapped) do
        local w = measureSpans(line, font)
        if w > maxContentW then maxContentW = w end
      end

    elseif block.type == "code" then
      local codeFontSize = getMeasure().scaleFontSize(baseFontSize - 2, node)
      local font = getMeasure().getFont(codeFontSize, nil, nil)
      local lineH = font:getHeight()
      totalH = totalH + #block.lines * lineH + CODE_PADDING * 2
      for _, line in ipairs(block.lines) do
        local w = font:getWidth(line) + CODE_PADDING * 2
        if w > maxContentW then maxContentW = w end
      end

    elseif block.type == "paragraph" or block.type == "bullet" or block.type == "numbered" or block.type == "blockquote" then
      local font = getMeasure().getFont(baseFontSize, nil, nil)
      local lineH = font:getHeight()
      local wrapW = innerW
      if block.type == "bullet" or block.type == "numbered" then
        wrapW = wrapW - 20  -- indent
      elseif block.type == "blockquote" then
        wrapW = wrapW - BLOCKQUOTE_PADDING * 2 - 4  -- border + padding
      end
      local wrapped = wrapSpans(block.spans, font, wrapW)
      local blockH = #wrapped * (lineH + LINE_SPACING)
      if block.type == "blockquote" then
        blockH = blockH + BLOCKQUOTE_PADDING * 2
      end
      totalH = totalH + blockH

    elseif block.type == "table" then
      local font = getMeasure().getFont(baseFontSize, nil, nil)
      local lineH = font:getHeight()
      local rowH = lineH + TABLE_CELL_PAD * 2
      totalH = totalH + rowH * (1 + #block.rows) -- header + data rows
      -- Width: sum of column widths
      local tw = 0
      for _, h in ipairs(block.headers) do
        tw = tw + font:getWidth(h) + TABLE_CELL_PAD * 2
      end
      if tw > maxContentW then maxContentW = tw end

    elseif block.type == "hr" then
      totalH = totalH + 1 + BLOCK_SPACING
    end
  end

  totalH = totalH + padT + padB

  local result = entry._measureResult
  if not result then
    result = { width = 0, height = 0 }
    entry._measureResult = result
  end
  result.width = includeWidth and (maxContentW + padL + padR) or 0
  result.height = totalH
  return result
end

-- ============================================================================
-- Rendering
-- ============================================================================

local function setColor(color, opacity)
  love.graphics.setColor(color[1], color[2], color[3], (color[4] or 1) * opacity)
end

--- Draw a list of inline spans at (x, y), returns total width drawn
local function drawSpans(spans, font, x, y, opacity, codeFont)
  local dx = x
  for _, span in ipairs(spans) do
    if span.style == "code" then
      local cf = codeFont or font
      local tw = cf:getWidth(span.text)
      -- Background for inline code
      setColor(COLORS.inlineCodeBg, opacity)
      love.graphics.rectangle("fill", dx - 2, y - 1, tw + 4, font:getHeight() + 2, 2, 2)
      setColor(COLORS.inlineCode, opacity)
      love.graphics.setFont(cf)
      love.graphics.print(span.text, dx, y)
      love.graphics.setFont(font)
      dx = dx + tw
    elseif span.style == "bold" or span.style == "bolditalic" then
      setColor(COLORS.bold, opacity)
      love.graphics.print(span.text, dx, y)
      dx = dx + font:getWidth(span.text)
    elseif span.style == "italic" then
      setColor(COLORS.italic, opacity)
      love.graphics.print(span.text, dx, y)
      dx = dx + font:getWidth(span.text)
    elseif span.style == "link" then
      setColor(COLORS.link, opacity)
      love.graphics.print(span.text, dx, y)
      local tw = font:getWidth(span.text)
      -- Underline
      love.graphics.setLineWidth(1)
      love.graphics.line(dx, y + font:getHeight() - 1, dx + tw, y + font:getHeight() - 1)
      dx = dx + tw
    else
      setColor(COLORS.text, opacity)
      love.graphics.print(span.text, dx, y)
      dx = dx + font:getWidth(span.text)
    end
  end
  return dx - x
end

--- Draw wrapped spans (multiple lines)
local function drawWrappedSpans(wrappedLines, font, x, y, opacity, codeFont)
  local lineH = font:getHeight() + LINE_SPACING
  for li, lineSpans in ipairs(wrappedLines) do
    drawSpans(lineSpans, font, x, y + (li - 1) * lineH, opacity, codeFont)
  end
  return #wrappedLines * lineH
end

function Markdown.render(node, c, effectiveOpacity)
  local props = node.props or {}
  local text = extractText(node)
  local baseFontSize = getMeasure().scaleFontSize(props.fontSize or BASE_FONT_SIZE, node)
  local s = node.style or {}
  local padL = s.paddingLeft or s.paddingHorizontal or s.padding or 0
  local padR = s.paddingRight or s.paddingHorizontal or s.padding or 0
  local padT = s.paddingTop or s.paddingVertical or s.padding or 0

  local entry = getEntry(node)
  local blocks = ensureBlocks(entry, text)

  local innerW = c.w - padL - padR

  -- Scissor to bounds
  local psx, psy, psw, psh = love.graphics.getScissor()
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
  love.graphics.intersectScissor(sx, sy, math.max(0, sx2 - sx), math.max(0, sy2 - sy))

  local baseFont = getMeasure().getFont(baseFontSize, nil, nil)
  local codeFontSize = getMeasure().scaleFontSize(baseFontSize - 2, node)
  local codeFont = getMeasure().getFont(codeFontSize, nil, nil)

  local curY = c.y + padT
  local leftX = c.x + padL

  for bi, block in ipairs(blocks) do
    if bi > 1 then curY = curY + BLOCK_SPACING end

    if block.type == "heading" then
      local fontSize = getMeasure().scaleFontSize(HEADING_SIZES[block.level] or 14, node)
      local font = getMeasure().getFont(fontSize, nil, nil)
      love.graphics.setFont(font)
      setColor(COLORS.heading, effectiveOpacity)
      local wrapped = wrapSpans(parseInline(block.text), font, innerW)
      local lineH = font:getHeight() + LINE_SPACING
      for li, lineSpans in ipairs(wrapped) do
        drawSpans(lineSpans, font, leftX, curY + (li - 1) * lineH, effectiveOpacity, codeFont)
      end
      curY = curY + #wrapped * lineH

    elseif block.type == "code" then
      -- Render code block with syntax highlighting (reuse Syntax module)
      local font = codeFont
      love.graphics.setFont(font)
      local lineH = font:getHeight()
      local blockH = #block.lines * lineH + CODE_PADDING * 2

      -- Background
      setColor(Color.toTable("#0d1117"), effectiveOpacity)
      love.graphics.rectangle("fill", leftX, curY, innerW, blockH, 4, 4)
      -- Border
      love.graphics.setColor(1, 1, 1, 0.08 * effectiveOpacity)
      love.graphics.setLineWidth(1)
      love.graphics.rectangle("line", leftX, curY, innerW, blockH, 4, 4)

      -- Language label
      if block.lang then
        local labelFont = getMeasure().getFont(getMeasure().scaleFontSize(9, node), nil, nil)
        love.graphics.setFont(labelFont)
        setColor(COLORS.muted, effectiveOpacity)
        love.graphics.print(block.lang, leftX + innerW - labelFont:getWidth(block.lang) - CODE_PADDING, curY + 3)
        love.graphics.setFont(font)
      end

      -- Syntax-highlighted lines
      local resolvedLang = block.lang or Syntax.detectLanguage(block.lines)
      for li, line in ipairs(block.lines) do
        local ly = curY + CODE_PADDING + (li - 1) * lineH
        local tokens = Syntax.tokenizeLine(line, resolvedLang)
        local lx = leftX + CODE_PADDING
        for _, tok in ipairs(tokens) do
          setColor(tok.color, effectiveOpacity)
          love.graphics.print(tok.text, lx, ly)
          lx = lx + font:getWidth(tok.text)
        end
      end

      curY = curY + blockH

    elseif block.type == "paragraph" then
      love.graphics.setFont(baseFont)
      local wrapped = wrapSpans(block.spans, baseFont, innerW)
      curY = curY + drawWrappedSpans(wrapped, baseFont, leftX, curY, effectiveOpacity, codeFont)

    elseif block.type == "bullet" then
      love.graphics.setFont(baseFont)
      -- Bullet dot
      setColor(COLORS.bullet, effectiveOpacity)
      local dotY = curY + baseFont:getHeight() / 2
      love.graphics.circle("fill", leftX + 6, dotY, 2.5)
      -- Content
      local wrapped = wrapSpans(block.spans, baseFont, innerW - 20)
      curY = curY + drawWrappedSpans(wrapped, baseFont, leftX + 20, curY, effectiveOpacity, codeFont)

    elseif block.type == "numbered" then
      love.graphics.setFont(baseFont)
      setColor(COLORS.bullet, effectiveOpacity)
      love.graphics.print(block.number .. ".", leftX, curY)
      local wrapped = wrapSpans(block.spans, baseFont, innerW - 20)
      curY = curY + drawWrappedSpans(wrapped, baseFont, leftX + 20, curY, effectiveOpacity, codeFont)

    elseif block.type == "blockquote" then
      love.graphics.setFont(baseFont)
      local wrapped = wrapSpans(block.spans, baseFont, innerW - BLOCKQUOTE_PADDING * 2 - 4)
      local lineH = baseFont:getHeight() + LINE_SPACING
      local blockH = #wrapped * lineH + BLOCKQUOTE_PADDING * 2

      -- Background
      setColor(COLORS.blockquoteBg, effectiveOpacity)
      love.graphics.rectangle("fill", leftX, curY, innerW, blockH, 3, 3)
      -- Left border
      setColor(COLORS.blockquoteBorder, effectiveOpacity)
      love.graphics.rectangle("fill", leftX, curY, 3, blockH, 1, 1)

      -- Text
      setColor(COLORS.blockquoteText, effectiveOpacity)
      for li, lineSpans in ipairs(wrapped) do
        drawSpans(lineSpans, baseFont, leftX + 4 + BLOCKQUOTE_PADDING, curY + BLOCKQUOTE_PADDING + (li - 1) * lineH, effectiveOpacity, codeFont)
      end
      curY = curY + blockH

    elseif block.type == "table" then
      love.graphics.setFont(baseFont)
      local lineH = baseFont:getHeight()
      local rowH = lineH + TABLE_CELL_PAD * 2
      local numCols = #block.headers

      -- Calculate column widths (even split for now)
      local colW = math.floor(innerW / math.max(numCols, 1))

      -- Header row
      setColor(COLORS.tableHeader, effectiveOpacity)
      love.graphics.rectangle("fill", leftX, curY, innerW, rowH)
      setColor(COLORS.text, effectiveOpacity)
      for ci, header in ipairs(block.headers) do
        love.graphics.print(header, leftX + (ci - 1) * colW + TABLE_CELL_PAD, curY + TABLE_CELL_PAD)
      end
      curY = curY + rowH

      -- Data rows
      for _, row in ipairs(block.rows) do
        -- Row border
        setColor(COLORS.tableBorder, effectiveOpacity)
        love.graphics.setLineWidth(1)
        love.graphics.line(leftX, curY, leftX + innerW, curY)

        setColor(COLORS.text, effectiveOpacity)
        for ci, cell in ipairs(row) do
          if ci <= numCols then
            love.graphics.print(cell, leftX + (ci - 1) * colW + TABLE_CELL_PAD, curY + TABLE_CELL_PAD)
          end
        end
        curY = curY + rowH
      end

    elseif block.type == "hr" then
      setColor(COLORS.hrColor, effectiveOpacity)
      love.graphics.setLineWidth(1)
      local hrY = curY + BLOCK_SPACING / 2
      love.graphics.line(leftX, hrY, leftX + innerW, hrY)
      curY = curY + 1 + BLOCK_SPACING
    end
  end

  -- Restore scissor
  if psx then
    love.graphics.setScissor(psx, psy, psw, psh)
  else
    love.graphics.setScissor()
  end
end

-- ============================================================================
-- Init
-- ============================================================================

function Markdown.init(config)
  config = config or {}
  Measure = config.measure
end

return Markdown
