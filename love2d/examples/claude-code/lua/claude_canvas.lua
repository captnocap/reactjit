--[[
  claude_canvas.lua — Visual capability for the Claude Code terminal canvas

  Registers "ClaudeCanvas" as a visual, hittable capability that:
    - Delegates rendering to claude_renderer.lua
    - Handles keyboard input for the inline "> " prompt
    - Communicates with claude_session.lua to send messages / interrupt

  React usage:
    <Native type="ClaudeCanvas" sessionId="main" />

  All interactivity lives here in Lua — React only declares the layout box.
  The canvas receives focus via click (like TextInput) and then captures
  all keyboard/textinput events through the framework's generic capability
  keyboard routing.
]]

local Capabilities = require("lua.capabilities")
local Renderer     = require("lua.claude_renderer")
local Session      = require("lua.claude_session")
local Graph        = require("lua.claude_graph")
local Color        = require("lua.color")
local Focus        = require("lua.focus")
local Tree         = require("lua.tree")

local Measure = nil

-- Per-instance input state (keyed by nodeId)
local _inputStates = {}
local function getInputState(nodeId)
  if not _inputStates[nodeId] then
    _inputStates[nodeId] = {
      text = "",
      cursorPos = 0,
      blinkTimer = 0,
      blinkOn = true,
      history = {},
      historyIdx = 0,
      viewportH = 600,  -- updated each render frame
      scrollY = 0,      -- scroll offset in pixels (0 = top, positive = scrolled down)
    }
  end
  return _inputStates[nodeId]
end

-- Cached classified rows from last render frame (for clipboard dump)
local _lastClassified = {}  -- nodeId -> { rows = { { row, kind, text, nodeId, turnId, groupId, groupType, colors } } }

-- Per-row classification history: tracks every kind transition (persistent across frames)
local _rowHistory = {}      -- nodeId -> { [row] = { {kind, nodeId, frame}, ... } }
local _frameCounter = 0     -- monotonic frame counter for history timestamps
local _lastRowKind = {}     -- nodeId -> { [row] = lastKind } for change detection

-- Semantic graph (persistent across frames, rebuilt each frame, diffed)
local _lastGraph = {}       -- nodeId -> SemanticGraph
local _lastDiff = {}        -- nodeId -> diff ops from previous frame

-- sessionId -> nodeId reverse lookup (populated in create)
local _sessionNodeMap = {}  -- "default" -> numeric nodeId

-- Scroll step sizes
local SCROLL_LINE = 40   -- pixels per mouse wheel notch
local SCROLL_PAGE = 400  -- pixels per PgUp/PgDn (updated to viewport height at render)

-- ── Input editing helpers ──────────────────────────────────────────

local function insertText(inputState, text)
  local before = inputState.text:sub(1, inputState.cursorPos)
  local after = inputState.text:sub(inputState.cursorPos + 1)
  inputState.text = before .. text .. after
  inputState.cursorPos = inputState.cursorPos + #text
  inputState.blinkOn = true
  inputState.blinkTimer = 0
end

-- ── Colors ─────────────────────────────────────────────────────────

local COLORS = {
  inputBg     = Color.toTable("#1e293b"),
  inputText   = Color.toTable("#e2e8f0"),
  inputCaret  = Color.toTable("#94a3b8"),
  inputPrompt = Color.toTable("#64748b"),
}

-- ── Capability Registration ────────────────────────────────────────

Capabilities.register("ClaudeCanvas", {
  visual   = true,
  hittable = true,  -- can receive focus and keyboard events

  schema = {
    sessionId = { type = "string", desc = "Session ID linking to a ClaudeCode instance" },
  },

  events = {},

  create = function(nodeId, props)
    -- Initialize renderer with the Measure module (once)
    if not Measure then
      local ok, m = pcall(require, "lua.measure")
      if ok then
        Measure = m
        Renderer.init({ measure = m })
      end
    end

    local sessionId = props.sessionId or "default"
    Renderer.getSession(sessionId)
    _sessionNodeMap[sessionId] = nodeId

    return {
      sessionId = sessionId,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.sessionId and props.sessionId ~= state.sessionId then
      state.sessionId = props.sessionId
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Don't grab focus — the Input bar owns focus and forwards keystrokes here
    -- via keystrokeTarget/submitTarget props.
    state._focusGrabbed = true

    local inputState = getInputState(nodeId)
    inputState.blinkTimer = inputState.blinkTimer + dt
    if inputState.blinkTimer >= 0.53 then
      inputState.blinkTimer = 0
      inputState.blinkOn = not inputState.blinkOn
    end

    -- Sync proxy input cursor directly from vterm cursor position.
    -- getPromptState() fails in splash mode — bypass it entirely.
    -- The vterm cursor IS the SSoT for cursor position.
    local sessionId = props and props.sessionId or "default"
    local vt = Session.getVTerm(sessionId)
    if vt then
      local cursor = vt:getCursor()
      if cursor then
        -- Find the prompt prefix width by scanning for ❯/>/! symbol + space
        local promptWidth = 0
        local boundary = Session.getInputBoundary(sessionId) or 0
        if cursor.row >= boundary then
          for col = 0, math.min(15, cursor.col) do
            local cell = vt:getCell(cursor.row, col)
            if cell and cell.char then
              local ch = cell.char
              if ch:find("❯", 1, true) or ch == "!" or ch == ">" or ch == "›" then
                -- Prompt symbol found. Skip it + the space/NBSP after it.
                promptWidth = col + 2
                break
              end
            end
          end
        end

        local cursorCol = math.max(0, cursor.col - promptWidth)

        local allNodes = Tree.getNodes()
        if allNodes then
          for _, n in pairs(allNodes) do
            if n.type == "TextInput" and n.props and n.props.keystrokeTarget == "ClaudeCanvas" then
              if n.inputState then
                -- Convert cell column to byte offset
                local bytePos = 0
                local cellCount = 0
                for char in n.inputState.text:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
                  if cellCount >= cursorCol then break end
                  bytePos = bytePos + #char
                  cellCount = cellCount + 1
                end
                n.inputState.cursorPos = math.min(bytePos, #n.inputState.text)
              end
              break
            end
          end
        end
      end
    end
  end,

  destroy = function(nodeId, state)
    _inputStates[nodeId] = nil
  end,

  -- ── Visual capability methods (painter.lua / layout.lua) ──────

  measure = function(node)
    return Renderer.measure(node)
  end,

  render = function(node, c, effectiveOpacity)
    local nodeId = node.id
    local props = node.props or {}
    local sessionId = props.sessionId or "default"

    -- Save viewport height for scroll calculations in key handler
    local inputState = getInputState(nodeId)
    inputState.viewportH = c.h

    -- Resize vterm to match cols prop (if provided)
    if props.cols then
      Session.resize(props.cols, nil, sessionId)
    end

    -- ── Compute bottom reserved area (debug overlay only) ─────────
    local inputState = getInputState(nodeId)
    if not Measure then return end

    local fontSize = 13
    local font = Measure.getFont(fontSize, nil, nil)
    local lineHeight = font:getHeight()

    -- Debug overlay height (3 lines of debug text + margin)
    local df = Measure.getFont(10, nil, nil)
    local dfH = df:getHeight()
    local debugH = dfH * 3 + 5  -- 3 lines + gap
    local bottomMargin = 10
    local debugTop = c.y + c.h - debugH - bottomMargin

    -- The content area stops at the debug overlay top
    local contentBottom = debugTop
    local contentRect = { x = c.x, y = c.y, w = c.w, h = contentBottom - c.y }

    -- ── Render ALL vterm rows with semantic tags ─────────────────
    -- No boundary cutoff. Every row gets classified. React layer decides display.
    _frameCounter = _frameCounter + 1
    local vterm = Session.getVTerm()
    local boundary = Session.getInputBoundary()

    -- Sanity check: boundary must be near the bottom of content.
    -- During streaming, stale boundary from a previous settle can land mid-content.
    -- The real input zone is always the last ~10 rows. If boundary is too far up, ignore it.
    if vterm then
      local vtRows = vterm:size()
      local lastRow = 0
      for r = vtRows - 1, 0, -1 do
        if #(vterm:getRowText(r)) > 0 then lastRow = r; break end
      end
      if boundary < lastRow - 15 then
        boundary = vtRows  -- no input zone (treat everything as content)
      end
    end

    if vterm and Measure then
      local vtFont = Measure.getFont(13, nil, nil)
      local tagFont = Measure.getFont(9, nil, nil)
      local charW = vtFont:getWidth("M")
      local lineH = vtFont:getHeight()
      local rows, cols = vterm:size()

      -- Measure tag prefix width for offsetting cell content
      local tagW = tagFont:getWidth("[list_selectable] ")  -- widest tag as reference
      local cellOffsetX = tagW + 4
      -- Right side reserve: row numbers + color debug info
      local rowNumW = 180  -- row number + "255,255,255 153,153,153 def" color labels
      -- Available width for vterm cells between tag and row numbers
      local cellAreaW = c.w - cellOffsetX - rowNumW
      local maxCellCols = math.max(1, math.floor(cellAreaW / charW))

      love.graphics.setColor(Color.toTable("#0f172a")[1], Color.toTable("#0f172a")[2],
                             Color.toTable("#0f172a")[3], effectiveOpacity)
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

      love.graphics.setScissor(contentRect.x, contentRect.y, contentRect.w, contentRect.h)

      -- Find last non-empty row to avoid rendering 200 blank lines
      local lastNonEmpty = 0
      for row = rows - 1, 0, -1 do
        if #(vterm:getRowText(row)) > 0 then
          lastNonEmpty = row
          break
        end
      end

      -- Clamp scroll: max = total content height - visible area
      local totalContentH = (lastNonEmpty + 1) * lineH + 16
      local maxScroll = math.max(0, totalContentH - contentRect.h)
      if inputState.scrollY > maxScroll then inputState.scrollY = maxScroll end

      local scrollY = inputState.scrollY
      local prevKind = nil
      local blockKind = nil  -- first semantic kind in current blank-line-delimited block
      local inMenu = false
      local rowColors = {}  -- row -> { fg, hasText }
      local rowMeta = {}    -- row -> { nodeId, turnId, groupId, groupType }

      -- Turn and group counters
      local currentTurnId = 0
      local currentGroupId = 0
      local currentGroupType = nil

      local classifiedCache = {}  -- built during render, stored for clipboard dump

      -- Group type lookup: which tokens form interactive groups
      local GROUP_TYPES = {
        menu_title = "menu", menu_option = "menu", menu_desc = "menu",
        list_selectable = "menu", list_selected = "menu", list_info = "menu",
        search_box = "menu", selector = "menu", confirmation = "menu", hint = "menu",
        picker_title = "picker", picker_item = "picker",
        picker_selected = "picker", picker_meta = "picker",
        task_summary = "task", task_done = "task", task_open = "task", task_active = "task",
        permission = "permission",
        plan_border = "plan", plan_mode = "plan", wizard_step = "plan",
      }

      -- Block types: consecutive rows of same kind share one nodeId
      local BLOCK_TYPES = {
        assistant_text = true, user_text = true, diff = true,
        text = true, banner = true, thinking = true, plan_mode = true,
        status_bar = true, input_border = true,
        tool = true, result = true,
      }

      -- Per-turn sequence counters (reset on turn change)
      local turnThinkSeq = 0
      local turnToolSeq = 0
      local turnResultSeq = 0
      local turnAsstSeq = 0
      local turnDiffSeq = 0
      local turnErrorSeq = 0
      local turnBoxSeq = 0
      local turnPlanSeq = 0
      local turnWizardSeq = 0
      local turnImageSeq = 0

      -- Per-group item counters (reset on group change)
      local groupItemIndex = 0
      local groupMetaIndex = 0

      -- Current node tracking
      local currentNodeId = nil

      for row = 0, lastNonEmpty do
        local py = c.y + 8 + row * lineH - scrollY
        local inViewport = (py + lineH >= c.y) and (py <= contentBottom)

        -- Alternating row background for visual tracking (draw-only)
        if inViewport and row % 2 == 1 then
          love.graphics.setColor(1, 1, 1, 0.03 * effectiveOpacity)
          love.graphics.rectangle("fill", c.x, py, c.w, lineH)
        end

        local rowText = vterm:getRowText(row)
        if #rowText == 0 or rowText:match("^%s*$") then
          blockKind = nil  -- blank line resets the block
        end
        if #rowText > 0 then
          -- Classify with zone awareness
          local kind = Session.classifyRow(rowText, row, rows)

          -- Lookahead: rows followed by picker_meta are part of a picker list
          if row < lastNonEmpty then
            local nextText = vterm:getRowText(row + 1)
            if #nextText > 0 and Session.classifyRow(nextText, row + 1, rows) == "picker_meta" then
              if kind == "user_prompt" then
                kind = "picker_selected"
              elseif kind == "text" then
                kind = "picker_item"
              end
            end
          end

          -- Sample ALL distinct fg colors on this row
          local borderChars = { ["│"] = true, ["┌"] = true, ["╭"] = true,
            ["└"] = true, ["╰"] = true, ["─"] = true, ["┐"] = true,
            ["╮"] = true, ["┘"] = true, ["╯"] = true, ["┤"] = true,
            ["├"] = true, ["┬"] = true, ["┴"] = true, ["╌"] = true }
          local sampledFg = nil       -- first content cell's fg (for brightness check)
          local hasTextContent = false
          local colorSet = {}         -- unique color strings seen
          local colorList = {}        -- ordered unique color labels
          local colorSeen = {}
          for col = 0, math.min(cols - 1, 80) do
            local cell = vterm:getCell(row, col)
            if cell and cell.char and #cell.char > 0
               and cell.char ~= " " and not borderChars[cell.char] then
              if not hasTextContent then
                hasTextContent = true
                sampledFg = cell.fg
              end
              local label
              if cell.fg then
                label = string.format("%d,%d,%d", cell.fg[1], cell.fg[2], cell.fg[3])
              else
                label = "def"
              end
              if not colorSeen[label] then
                colorSeen[label] = true
                colorList[#colorList + 1] = label
              end
            end
          end
          rowColors[row] = { fg = sampledFg, hasText = hasTextContent, colors = colorList }

          -- Brightness-based reclassification for box_drawing rows with text content
          if kind == "box_drawing" and hasTextContent then
            if not sampledFg then
              kind = "list_selectable"
            else
              local brightness = (sampledFg[1] + sampledFg[2] + sampledFg[3]) / 3
              if brightness > 180 then
                kind = "list_selectable"
              elseif brightness > 80 then
                kind = "list_info"
              end
            end
          end

          -- Adjacency: text after user_prompt/user_text = user_text (multi-line input)
          if kind == "text" and (prevKind == "user_prompt" or prevKind == "user_text") then
            kind = "user_text"
          end

          -- Block inheritance: blank lines delimit blocks, first major semantic
          -- row sets the kind for ALL other rows in the same block.
          -- Major kinds that SET the block (everything else inherits):
          local BLOCK_SETTERS = {
            banner = true, user_prompt = true, thinking = true,
            tool = true, result = true, diff = true,
            plan_mode = true, permission = true, error = true,
            status_bar = true, input_border = true, input_zone = true,
            idle_prompt = true, thought_complete = true, task_active = true,
            image_attachment = true,
          }
          if BLOCK_SETTERS[kind] then
            blockKind = kind
          elseif blockKind then
            kind = blockKind
          end

          -- Adjacency: text after menu_option = menu_desc (option description)
          -- Only applies when menu_option survived reclassification (i.e., actual interactive menu)
          if kind == "text" and prevKind == "menu_option" then
            kind = "menu_desc"
          end

          -- Footer hints: keyboard shortcuts, navigation instructions
          if kind == "text" and (rowText:find("Enter to select", 1, true)
             or rowText:find("Arrow keys", 1, true)
             or rowText:find("Esc to cancel", 1, true)
             or rowText:find("Esc to go back", 1, true)
             or rowText:find("Type to search", 1, true)
             or (rowText:find("Ctrl+", 1, true) and rowText:find(" to ", 1, true))) then
            kind = "hint"
          end

          -- Structure check: detect menu context after box_drawing separator
          if prevKind == "box_drawing" then
            if kind == "list_selectable" then
              if rowText:find("Search", 1, true) then
                kind = "search_box"
              else
                kind = "menu_title"
              end
              inMenu = true
            elseif (kind == "list_info" or kind == "text") and rowText:find("Search", 1, true) then
              -- Search box inside ╭───╮ borders gets brightness-reclassified to list_info
              kind = "search_box"
            elseif kind == "text" and sampledFg then
              -- Colored text after separator = menu title (e.g. "Manage MCP servers" in purple)
              local brightness = (sampledFg[1] + sampledFg[2] + sampledFg[3]) / 3
              if brightness > 150 then
                kind = "menu_title"
                inMenu = true
              end
            end
          end

          -- Inside a menu: reclassify text/user_prompt based on color
          if inMenu and row < boundary then
            if kind == "user_prompt" then
              kind = "list_selected"
            elseif kind == "text" and not sampledFg then
              -- def fg inside a menu = selectable item
              kind = "list_selectable"
            elseif kind == "text" and sampledFg then
              local brightness = (sampledFg[1] + sampledFg[2] + sampledFg[3]) / 3
              if brightness > 180 then
                kind = "list_selectable"
              elseif brightness > 80 then
                kind = "list_info"
              end
            end
          end

          -- Override: rows in the input zone get zone-specific tags
          if row >= boundary then
            if Session.isSeparatorRow(vterm, row) then
              kind = "input_border"
            elseif kind == "user_prompt" or kind == "idle_prompt" then
              kind = "user_input"
            elseif kind == "status_bar" then
              kind = "status_bar"
            elseif kind == "confirmation" or kind == "menu_option" or kind == "selector" or kind == "menu_title" then
              -- keep these as-is
            elseif rowText:match("^%s*/[%w%-]") then
              kind = "slash_menu"
            else
              kind = "input_zone"
            end
          end

          -- ── Turn + group tracking ───────────────────────────────
          -- turnId: increments on user_prompt (new conversation turn)
          if kind == "user_prompt" then
            currentTurnId = currentTurnId + 1
            -- Reset per-turn sequence counters
            turnThinkSeq = 0; turnToolSeq = 0; turnResultSeq = 0; turnAsstSeq = 0
            turnDiffSeq = 0; turnErrorSeq = 0; turnBoxSeq = 0
            turnPlanSeq = 0; turnWizardSeq = 0; turnImageSeq = 0
          end

          -- groupId: increments when entering a new interactive group
          local groupType = GROUP_TYPES[kind]
          if groupType ~= currentGroupType then
            if groupType then
              currentGroupId = currentGroupId + 1
              -- Reset per-group counters
              groupItemIndex = 0; groupMetaIndex = 0
            end
            currentGroupType = groupType
          end

          -- ── nodeId minting ─────────────────────────────────────
          local continues = BLOCK_TYPES[kind] and kind == prevKind
          if not continues then
            local nid
            -- Session singletons
            if kind == "banner" then nid = "s:banner"
            elseif kind == "input_zone" or kind == "user_input" or kind == "input_border" then nid = "s:input"
            elseif kind == "status_bar" then nid = "s:status"
            -- Turn-scoped
            elseif kind == "user_prompt" then nid = "t" .. currentTurnId .. ":prompt"
            elseif kind == "user_text" then nid = "t" .. currentTurnId .. ":utext"
            elseif kind == "thinking" then
              turnThinkSeq = turnThinkSeq + 1
              nid = "t" .. currentTurnId .. ":think:" .. turnThinkSeq
            elseif kind == "thought_complete" then nid = "t" .. currentTurnId .. ":thought"
            elseif kind == "tool" then
              turnToolSeq = turnToolSeq + 1
              nid = "t" .. currentTurnId .. ":tool:" .. turnToolSeq
            elseif kind == "result" then
              turnResultSeq = turnResultSeq + 1
              nid = "t" .. currentTurnId .. ":result:" .. turnResultSeq
            elseif kind == "assistant_text" then
              turnAsstSeq = turnAsstSeq + 1
              nid = "t" .. currentTurnId .. ":asst:" .. turnAsstSeq
            elseif kind == "diff" then
              turnDiffSeq = turnDiffSeq + 1
              nid = "t" .. currentTurnId .. ":diff:" .. turnDiffSeq
            elseif kind == "error" then
              turnErrorSeq = turnErrorSeq + 1
              nid = "t" .. currentTurnId .. ":error:" .. turnErrorSeq
            elseif kind == "plan_mode" then
              nid = "t" .. currentTurnId .. ":plan_mode"
            elseif kind == "plan_border" then
              turnPlanSeq = turnPlanSeq + 1
              nid = "t" .. currentTurnId .. ":plan:" .. turnPlanSeq
            elseif kind == "wizard_step" then
              turnWizardSeq = turnWizardSeq + 1
              nid = "t" .. currentTurnId .. ":wizard:" .. turnWizardSeq
            elseif kind == "image_attachment" then
              turnImageSeq = turnImageSeq + 1
              nid = "t" .. currentTurnId .. ":image:" .. turnImageSeq
            elseif kind == "permission" then
              nid = "t" .. currentTurnId .. ":perm"
            elseif kind == "box_drawing" then
              turnBoxSeq = turnBoxSeq + 1
              nid = "t" .. currentTurnId .. ":box:" .. turnBoxSeq
            -- Group-scoped
            elseif kind == "menu_title" then nid = "g" .. currentGroupId .. ":menu:title"
            elseif kind == "menu_option" then
              groupItemIndex = groupItemIndex + 1
              nid = "g" .. currentGroupId .. ":menu:item:" .. groupItemIndex
            elseif kind == "menu_desc" then
              nid = "g" .. currentGroupId .. ":menu:desc:" .. groupItemIndex
            elseif kind == "list_selectable" then
              groupItemIndex = groupItemIndex + 1
              nid = "g" .. currentGroupId .. ":menu:item:" .. groupItemIndex
            elseif kind == "list_selected" then
              nid = "g" .. currentGroupId .. ":menu:sel"
            elseif kind == "list_info" then
              nid = "g" .. currentGroupId .. ":menu:info:" .. groupItemIndex
            elseif kind == "search_box" then
              nid = "g" .. currentGroupId .. ":search"
            elseif kind == "confirmation" then
              nid = "g" .. currentGroupId .. ":confirm"
            elseif kind == "hint" then
              local gid = currentGroupId > 0 and currentGroupId or 0
              nid = "g" .. gid .. ":hint"
            elseif kind == "selector" then
              nid = "g" .. currentGroupId .. ":selector"
            elseif kind == "picker_title" then
              nid = "g" .. currentGroupId .. ":pick:title"
            elseif kind == "picker_selected" then
              nid = "g" .. currentGroupId .. ":pick:sel"
            elseif kind == "picker_item" then
              groupItemIndex = groupItemIndex + 1
              nid = "g" .. currentGroupId .. ":pick:item:" .. groupItemIndex
            elseif kind == "picker_meta" then
              groupMetaIndex = groupMetaIndex + 1
              nid = "g" .. currentGroupId .. ":pick:meta:" .. groupMetaIndex
            elseif kind == "slash_menu" then
              nid = "g" .. currentGroupId .. ":slash"
            -- Fallback
            else
              nid = "t" .. currentTurnId .. ":" .. kind
            end
            currentNodeId = nid
          end

          rowMeta[row] = {
            nodeId = currentNodeId,
            turnId = currentTurnId,
            groupId = groupType and currentGroupId or nil,
            groupType = groupType,
          }

          -- Cache for clipboard dump
          local rc = rowColors[row]
          classifiedCache[#classifiedCache + 1] = {
            row = row,
            kind = kind,
            text = rowText,
            nodeId = currentNodeId,
            turnId = currentTurnId,
            groupId = groupType and currentGroupId or nil,
            groupType = groupType,
            colors = rc and rc.colors or {},
          }

          -- Track classification history (persistent across frames)
          if not _lastRowKind[nodeId] then _lastRowKind[nodeId] = {} end
          if not _rowHistory[nodeId] then _rowHistory[nodeId] = {} end
          if _lastRowKind[nodeId][row] ~= kind then
            if not _rowHistory[nodeId][row] then _rowHistory[nodeId][row] = {} end
            local hist = _rowHistory[nodeId][row]
            hist[#hist + 1] = { kind = kind, nid = currentNodeId, frame = _frameCounter }
            _lastRowKind[nodeId][row] = kind
          end

          -- blockKind already updated by BLOCK_SETTERS above
          prevKind = kind

          -- Drawing: only for visible rows
          if inViewport then
            -- Draw tag prefix
            love.graphics.setFont(tagFont)
            -- Color-code by zone: blue=content, orange=input zone
            if row >= boundary then
              love.graphics.setColor(1.0, 0.6, 0.2, 0.7 * effectiveOpacity)
            else
              love.graphics.setColor(0.4, 0.7, 1.0, 0.6 * effectiveOpacity)
            end
            love.graphics.print("[" .. kind .. "]", c.x + 4, py + 2)

            -- Draw cells between tag prefix and row numbers
            love.graphics.setFont(vtFont)
            for col = 0, math.min(cols - 1, maxCellCols - 1) do
              local cell = vterm:getCell(row, col)
              if cell.char and #cell.char > 0 and cell.char ~= " " then
                local px = c.x + cellOffsetX + col * charW
                if cell.fg then
                  love.graphics.setColor(cell.fg[1]/255, cell.fg[2]/255, cell.fg[3]/255, effectiveOpacity)
                else
                  love.graphics.setColor(COLORS.inputText[1], COLORS.inputText[2],
                                         COLORS.inputText[3], effectiveOpacity)
                end
                love.graphics.print(cell.char, px, py)
              end
            end
          end  -- inViewport drawing
        end
        ::continue_row::
      end
      love.graphics.setScissor()

      -- ── Prompt cursor ─────────────────────────────────────────
      -- The CLI (Ink) parks the vterm cursor below visible content.
      -- Find the prompt row by scanning for ❯ in the input zone,
      -- then draw cursor after the last non-empty cell on that row.
      if inputState.blinkOn and boundary > 0 then
        local promptRow = nil
        local promptCol = nil
        for row = boundary, lastNonEmpty do
          local rowText = vterm:getRowText(row)
          if rowText:find("❯", 1, true) or rowText:match("^>%s") then
            promptRow = row
            -- Find the last non-empty cell to place cursor after text
            local lastCell = 0
            for col = 0, cols - 1 do
              local cell = vterm:getCell(row, col)
              if cell and cell.char and #cell.char > 0 and cell.char ~= " " then
                lastCell = col + 1
              end
            end
            promptCol = lastCell
            break
          end
        end
        if promptRow then
          local cy = c.y + 8 + promptRow * lineH - scrollY
          local cx = c.x + cellOffsetX + promptCol * charW
          if cy >= c.y and cy + lineH <= contentBottom then
            love.graphics.setColor(0.9, 0.9, 0.95, 0.85 * effectiveOpacity)
            love.graphics.rectangle("fill", cx, cy, charW, lineH)
          end
        end
      end

      -- Store classified cache for clipboard dump hotkey
      _lastClassified[nodeId] = classifiedCache

      -- Build semantic graph from classified cache
      local prevGraph = _lastGraph[nodeId]
      local graph = Graph.build(classifiedCache, _rowHistory[nodeId], _frameCounter)
      _lastDiff[nodeId] = Graph.diff(prevGraph, graph)
      _lastGraph[nodeId] = graph

      -- Row numbers
      local numFont = Measure.getFont(9, nil, nil)
      love.graphics.setFont(numFont)
      for row = 0, lastNonEmpty do
        local py = c.y + 8 + row * lineH - scrollY
        if py + lineH < c.y then goto continue_num end
        if py > contentBottom then break end
        local rowText = vterm:getRowText(row)
        if row >= boundary then
          love.graphics.setColor(1, 0.6, 0.2, 0.5)  -- orange for input zone
        elseif #rowText > 0 then
          love.graphics.setColor(0.3, 1, 0.3, 0.5)
        else
          love.graphics.setColor(1, 1, 1, 0.15)
        end
        love.graphics.print(string.format("%3d", row), c.x + c.w - 30, py)
        -- Show nodeId next to row number
        local rm = rowMeta[row]
        if rm and rm.nodeId then
          love.graphics.setColor(0.6, 0.8, 0.4, 0.6)
          local mw = numFont:getWidth(rm.nodeId .. "  ")
          love.graphics.print(rm.nodeId, c.x + c.w - 34 - mw, py)
        end
        -- Show all distinct fg colors further left
        local rc = rowColors[row]
        if rc and rc.colors and #rc.colors > 0 then
          love.graphics.setColor(0.5, 0.5, 0.5, 0.5)
          local rmWidth = 0
          if rm and rm.nodeId then
            rmWidth = numFont:getWidth(rm.nodeId .. "    ")
          end
          local colorStr = table.concat(rc.colors, " ")
          local cw = numFont:getWidth(colorStr .. "  ")
          love.graphics.print(colorStr, c.x + c.w - 34 - rmWidth - cw, py)
        end
        ::continue_num::
      end
    end

    -- ── Debug overlay (above input bar) ─────────────────────────
    local dbg = Session.getDebugInfo()
    local dvt = Session.getVTerm()
    local dRows, dCols = 0, 0
    if dvt then dRows, dCols = dvt:size() end
    love.graphics.setFont(df)
    love.graphics.setColor(1, 1, 0, 0.8)
    love.graphics.print(
      string.format("cols=%d rows=%d w=%.0f h=%.0f", dCols, dRows, c.w, c.h),
      c.x + 8, debugTop)
    love.graphics.print(
      string.format("mode=%s alive=%s boundary=%d dirty=%d",
        dbg.mode, tostring(dbg.alive), dbg.boundary, dbg.dirty),
      c.x + 8, debugTop + dfH)
    love.graphics.print(
      string.format("lastDmg=%dms settle=%dms streamLen=%d vtContent=%d",
        dbg.lastDmg, dbg.settle, dbg.streaming, dbg.vtContent or 0),
      c.x + 8, debugTop + dfH * 2)

  end,

  -- ── Keyboard event routing (called by init.lua) ───────────────
  -- All keystrokes pass through to the PTY in real-time.
  -- Our input bar is a visual mirror of the vterm prompt line.

  handleKeyPressed = function(node, key, scancode, isrepeat)
    local nodeId = node.id
    local props = node.props or {}
    local sessionId = props.sessionId or "default"
    local inputState = getInputState(nodeId)

    -- Reset cursor blink on every key press
    inputState.blinkOn = true
    inputState.blinkTimer = 0

    -- Check for permission prompt — intercept y/a/n/Esc
    -- Permission renders natively through vterm; we just need to route keystrokes
    if Session.getMode() == "permission" then
      if key == "y" or key == "return" or key == "kpenter" then
        Session.respond(1)
        return true
      elseif key == "a" then
        Session.respond(2)
        return true
      elseif key == "n" or key == "escape" then
        Session.respond(3)
        return true
      end
      return true
    end

    -- ── UI-only controls (don't pass to PTY) ────────────────────

    -- Scroll: PgUp / PgDn / Shift+Up / Shift+Down
    if key == "pageup" then
      inputState.scrollY = inputState.scrollY - (inputState.viewportH - 60)
      if inputState.scrollY < 0 then inputState.scrollY = 0 end
      return true
    elseif key == "pagedown" then
      inputState.scrollY = inputState.scrollY + (inputState.viewportH - 60)
      return true
    end
    if love.keyboard.isDown("lshift", "rshift") then
      if key == "up" then
        inputState.scrollY = inputState.scrollY - SCROLL_LINE
        if inputState.scrollY < 0 then inputState.scrollY = 0 end
        return true
      elseif key == "down" then
        inputState.scrollY = inputState.scrollY + SCROLL_LINE
        return true
      end
    end

    -- Ctrl+L: clear our renderer display (UI-only, doesn't affect CLI)
    if key == "l" and love.keyboard.isDown("lctrl", "rctrl") then
      Renderer.clearSession(sessionId)
      Renderer.getSession(sessionId)
      return true
    end

    -- Ctrl+Shift+D: dump classified transcript to clipboard
    if key == "d" and love.keyboard.isDown("lctrl", "rctrl") and love.keyboard.isDown("lshift", "rshift") then
      local cache = _lastClassified[nodeId]
      if cache and #cache > 0 then
        local lines = {}
        for _, entry in ipairs(cache) do
          local meta = "t" .. entry.turnId
          if entry.groupId then
            meta = meta .. " g" .. entry.groupId .. ":" .. entry.groupType
          end
          local colors = #entry.colors > 0 and table.concat(entry.colors, " ") or ""
          -- Build transition history suffix for rows that flapped
          local histSuffix = ""
          local hist = _rowHistory[nodeId] and _rowHistory[nodeId][entry.row]
          if hist and #hist > 1 then
            local kinds = {}
            for _, h in ipairs(hist) do kinds[#kinds + 1] = h.kind end
            histSuffix = "  [" .. #hist .. "x: " .. table.concat(kinds, "→") .. "]"
          end
          lines[#lines + 1] = string.format("%3d %-20s %-28s %-16s %-30s %s%s",
            entry.row,
            "[" .. entry.kind .. "]",
            entry.nodeId or "",
            meta,
            colors,
            entry.text,
            histSuffix)
        end
        love.system.setClipboardText(table.concat(lines, "\n"))
        io.write("[CLIPBOARD] Copied " .. #lines .. " classified rows\n"); io.flush()
      end
      return true
    end

    -- Ctrl+Shift+G: dump semantic graph tree to clipboard
    if key == "g" and love.keyboard.isDown("lctrl", "rctrl") and love.keyboard.isDown("lshift", "rshift") then
      local graph = _lastGraph[nodeId]
      if graph then
        local lines = {}
        -- Header: state flags
        lines[#lines + 1] = "=== SEMANTIC GRAPH (frame " .. graph.frame .. ") ==="
        lines[#lines + 1] = string.format("state: mode=%s streaming=%s streamingKind=%s awaitingInput=%s awaitingDecision=%s focus=%s",
          graph.state.mode,
          tostring(graph.state.streaming),
          graph.state.streamingKind or "none",
          tostring(graph.state.awaitingInput),
          tostring(graph.state.awaitingDecision),
          graph.state.focus or "nil")
        if graph.state.modeNodeId then
          lines[#lines + 1] = "  modeNodeId: " .. graph.state.modeNodeId
        end
        if graph.state.interruptPending then
          lines[#lines + 1] = "  interruptPending: " .. (graph.state.interruptNodeId or "?")
        end
        if graph.state.modalOpen then
          lines[#lines + 1] = "  modalOpen: " .. (graph.state.modalNodeId or "?")
        end
        lines[#lines + 1] = ""

        -- Tree view
        lines[#lines + 1] = Graph.formatTree(graph)
        lines[#lines + 1] = ""

        -- Diff summary
        local diff = _lastDiff[nodeId]
        if diff and #diff > 0 then
          lines[#lines + 1] = "=== DIFF (" .. #diff .. " ops) ==="
          for _, op in ipairs(diff) do
            if op.op == "add" then
              lines[#lines + 1] = "  + " .. op.id .. " (" .. (op.node and op.node.type or "?") .. ")"
            elseif op.op == "remove" then
              lines[#lines + 1] = "  - " .. op.id
            elseif op.op == "update" then
              lines[#lines + 1] = "  ~ " .. op.id .. " (" .. (op.node and op.node.type or "?") .. ")"
            elseif op.op == "setState" then
              lines[#lines + 1] = "  ! state: mode=" .. op.state.mode
            end
          end
        else
          lines[#lines + 1] = "=== DIFF: no changes ==="
        end

        love.system.setClipboardText(table.concat(lines, "\n"))
        io.write("[CLIPBOARD] Copied semantic graph (" .. #graph.nodeOrder .. " nodes, " .. #(diff or {}) .. " diff ops)\n"); io.flush()
      end
      return true
    end

    -- Ctrl+R: expand/collapse the last tool block (UI-only)
    if key == "r" and love.keyboard.isDown("lctrl", "rctrl") then
      local session = Renderer.getSession(sessionId)
      for i = #session.blocks, 1, -1 do
        local block = session.blocks[i]
        if block.type == "tool_start" or block.type == "diff" then
          Renderer.toggleCollapse(sessionId, i)
          break
        end
      end
      return true
    end

    -- ── PTY passthrough ─────────────────────────────────────────
    -- Don't send keystrokes until CLI prompt is ready
    if not Session.isReady() then return false end

    -- ANSI escape sequences for special keys
    local ANSI = {
      up        = "\27[A",
      down      = "\27[B",
      right     = "\27[C",
      left      = "\27[D",
      home      = "\27[H",
      ["end"]   = "\27[F",
      delete    = "\27[3~",
      backspace = "\127",
      tab       = "\t",
      escape    = "\27",
    }

    io.write("[KEY] keyPressed → PTY: '" .. key .. "'\n"); io.flush()

    -- Enter: capture prompt text for renderer, then send \r to PTY
    if key == "return" or key == "kpenter" then
      local prompt = Session.getPromptState()
      if prompt and prompt.text and #prompt.text > 0 then
        -- Strip leading whitespace from prompt text
        local text = prompt.text:match("^%s*(.-)%s*$") or prompt.text
        if #text > 0 then
          Renderer.addUserInput(sessionId, text)
        end
      end
      Renderer.scrollToBottom(sessionId, inputState.viewportH)
      Session.writeRaw("\r")
      return true
    end

    -- Ctrl+key combos → send as control characters
    -- Skip if Shift is also held — those are UI hotkeys (Ctrl+Shift+D, etc.)
    if love.keyboard.isDown("lctrl", "rctrl") and not love.keyboard.isDown("lshift", "rshift") then
      -- Ctrl+V: paste (image or text) into PTY
      if key == "v" then
        -- Check if clipboard has image data
        local hasImage = false
        local imgCheck = io.popen("xclip -selection clipboard -target TARGETS -o 2>/dev/null")
        if imgCheck then
          local targets = imgCheck:read("*a") or ""
          imgCheck:close()
          if targets:find("image/png") or targets:find("image/jpeg") then
            -- Generate UUID-ish filename
            local f = io.open("/proc/sys/kernel/random/uuid", "r")
            local uuid = f and f:read("*l") or tostring(os.clock()):gsub("%.", "")
            if f then f:close() end
            -- Save to Claude's image cache
            local cacheDir = os.getenv("HOME") .. "/.claude/image-cache"
            os.execute("mkdir -p " .. cacheDir)
            local imgType = targets:find("image/png") and "image/png" or "image/jpeg"
            local ext = imgType == "image/png" and ".png" or ".jpg"
            local imgPath = cacheDir .. "/" .. uuid .. ext
            os.execute("xclip -selection clipboard -target " .. imgType .. " -o > " .. imgPath .. " 2>/dev/null")
            io.write("[PASTE] Saved clipboard image to " .. imgPath .. "\n"); io.flush()
            hasImage = true
            -- Send Ctrl+V (0x16) to PTY so Claude Code's own handler detects the image
            Session.writeRaw("\x16")
          end
        end
        -- Fall back to text paste if no image
        if not hasImage then
          local clipboard = love.system.getClipboardText()
          if clipboard then
            Session.writeRaw(clipboard)
          end
        end
        return true
      end
      -- Ctrl+C: send interrupt
      if key == "c" then
        Session.writeRaw("\x03")
        return true
      end
      -- Ctrl+A: beginning of line
      if key == "a" then
        Session.writeRaw("\x01")
        return true
      end
      -- Ctrl+E: end of line
      if key == "e" then
        Session.writeRaw("\x05")
        return true
      end
      -- Ctrl+U: clear line
      if key == "u" then
        Session.writeRaw("\x15")
        return true
      end
      -- Ctrl+W: delete word backward
      if key == "w" then
        Session.writeRaw("\x17")
        return true
      end
      -- Ctrl+K: kill to end of line
      if key == "k" then
        Session.writeRaw("\x0b")
        return true
      end
      return true  -- consume other Ctrl combos
    end

    -- Special keys with ANSI sequences
    if ANSI[key] then
      Session.writeRaw(ANSI[key])
      return true
    end

    -- Regular keys are handled by handleTextInput below
    return false
  end,

  handleTextInput = function(node, text)
    -- Don't send keystrokes until CLI prompt is ready
    if not Session.isReady() then return end
    io.write("[KEY] textInput → PTY: '" .. text .. "'\n"); io.flush()
    -- Send typed characters directly to PTY
    Session.writeRaw(text)
  end,

  handleWheelMoved = function(node, dx, dy)
    local inputState = getInputState(node.id)
    -- dy is positive when scrolling up, negative when scrolling down (love2d convention)
    inputState.scrollY = inputState.scrollY - dy * SCROLL_LINE
    if inputState.scrollY < 0 then inputState.scrollY = 0 end
  end,
})

-- ── Module exports ─────────────────────────────────────────────────

local Canvas = {}

--- Get the current input text for a canvas node (for testing)
function Canvas.getInputText(nodeId)
  return getInputState(nodeId).text
end

--- Resolve a sessionId to the canvas nodeId
local function resolveNodeId(sessionId)
  return _sessionNodeMap[sessionId or "default"]
end

--- Get the semantic graph for a session
function Canvas.getGraphForSession(sessionId)
  local nid = resolveNodeId(sessionId)
  if not nid then return nil end
  return _lastGraph[nid]
end

--- Get the classified rows cache for a session
function Canvas.getClassifiedForSession(sessionId)
  local nid = resolveNodeId(sessionId)
  if not nid then return nil end
  return _lastClassified[nid]
end

--- Get the canvas nodeId for a session (for direct access)
function Canvas.getNodeIdForSession(sessionId)
  return resolveNodeId(sessionId)
end

return Canvas
