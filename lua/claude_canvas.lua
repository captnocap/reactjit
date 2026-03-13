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
local Scissor      = require("lua.scissor")
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

-- Classified snapshots: captured on submit (Enter) and slash (/) after settle
local _snapshots = {}       -- nodeId -> { { trigger, frame, timestamp, rows } }
local _pendingCaptures = {} -- nodeId -> { { trigger, framesLeft }, ... }
local _lastSettleDmg = {}   -- nodeId -> lastDamageAt when last settle snapshot fired (dedup)

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
    sessionId     = { type = "string", desc = "Session ID linking to a ClaudeCode instance" },
    debugVisible  = { type = "bool", default = true, desc = "Show debug overlays (row nums, tags, colors)" },
    recording     = { type = "bool", default = false, desc = "Enable recording + auto-save on destroy" },
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
      _sessionTimestamp = os.date("!%Y%m%d_%H%M%S"),
      _recording = props.recording or false,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.sessionId and props.sessionId ~= state.sessionId then
      state.sessionId = props.sessionId
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local inputState = getInputState(nodeId)
    inputState.blinkTimer = inputState.blinkTimer + dt
    if inputState.blinkTimer >= 0.53 then
      inputState.blinkTimer = 0
      inputState.blinkOn = not inputState.blinkOn
    end

    -- Recording uses the session's recorder directly (Session.getRecorder())
    -- No need to feed our own — the session captures all raw PTY data
  end,

  destroy = function(nodeId, state)
    local ts = state._sessionTimestamp or os.date("!%Y%m%d_%H%M%S")

    -- Auto-save .rec.lua recording (from session's recorder which has the actual PTY data)
    if state._recording then
      local sessionRec = Session.getRecorder()
      if sessionRec and sessionRec.meta.frameCount > 0 then
        local recPath = "recording_" .. ts .. ".rec.lua"
        local ok = sessionRec:save(recPath)
        if ok then
          io.write("[claude_canvas] Recording saved: " .. recPath ..
            " (" .. sessionRec.meta.frameCount .. " frames, " ..
            string.format("%.1fs", sessionRec.meta.duration) .. ")\n")
          io.flush()
        end
      end
    end

    -- Auto-save classified .txt export
    local cache = _lastClassified[nodeId]
    local vterm = Session.getVTerm()
    if cache and #cache > 0 and vterm then
      local txtPath = "recording_" .. ts .. ".txt"
      local f = io.open(txtPath, "w")
      if f then
        local vtRows, vtCols = vterm:size()
        f:write("-- ClaudeCanvas buffer export\n")
        f:write(string.format("-- %s  classifier=claude_code  grid=%dx%d  frame=%d\n",
          os.date("!%Y-%m-%dT%H:%M:%SZ"), vtRows, vtCols, _frameCounter))
        f:write("-- Format: [kind] <content>\\t[colors]\\t[grouping]\\t<row>\n")
        f:write("--\n")
        for _, entry in ipairs(cache) do
          local colorStr = #entry.colors > 0 and table.concat(entry.colors, " ") or "-"
          local nodeIdStr = entry.nodeId or "-"
          f:write(string.format("[%s] %s\t[%s]\t[%s]\t%d\n",
            entry.kind, entry.text, colorStr, nodeIdStr, entry.row))
        end
        f:close()
        io.write("[claude_canvas] Export saved: " .. txtPath .. " (" .. #cache .. " rows)\n")
        io.flush()
      end
    end

    -- Auto-save snapshots (transient menus captured on submit/slash)
    local snaps = _snapshots[nodeId]
    if snaps and #snaps > 0 then
      local snapPath = "recording_" .. ts .. ".snapshots.txt"
      local f = io.open(snapPath, "w")
      if f then
        f:write("-- ClaudeCanvas classified snapshots\n")
        f:write(string.format("-- %s  snapshots=%d\n", os.date("!%Y-%m-%dT%H:%M:%SZ"), #snaps))
        f:write("-- Captured on submit (Enter) and slash (/) to preserve transient menus\n")
        f:write("--\n")
        for si, snap in ipairs(snaps) do
          f:write(string.format("== snapshot %d  trigger=%s  frame=%d  %s ==\n",
            si, snap.trigger, snap.frame, snap.timestamp))
          for _, entry in ipairs(snap.rows) do
            local colorStr = #entry.colors > 0 and table.concat(entry.colors, " ") or "-"
            local nid = entry.nodeId or "-"
            f:write(string.format("[%s] %s\t[%s]\t[%s]\t%d\n",
              entry.kind, entry.text, colorStr, nid, entry.row))
          end
          f:write("\n")
        end
        f:close()
        io.write("[claude_canvas] Snapshots saved: " .. snapPath .. " (" .. #snaps .. " snapshots)\n")
        io.flush()
      end
    end

    _inputStates[nodeId] = nil
    _lastClassified[nodeId] = nil
    _rowHistory[nodeId] = nil
    _lastRowKind[nodeId] = nil
    _lastGraph[nodeId] = nil
    _lastDiff[nodeId] = nil
    _snapshots[nodeId] = nil
    _pendingCaptures[nodeId] = nil
    _lastSettleDmg[nodeId] = nil
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

    -- Auto-fit vterm cols to container width (once, or when width changes)
    if props.cols then
      if inputState._lastFitCols ~= props.cols then
        inputState._lastFitCols = props.cols
        Session.setDesiredSize(props.cols, nil)
      end
    elseif c.w > 0 and Measure and inputState._lastFitW ~= c.w then
      inputState._lastFitW = c.w
      local fitFont = Measure.getFont(13, nil, nil)
      local fitTagFont = Measure.getFont(9, nil, nil)
      local fitCharW = fitFont:getWidth("M")
      if fitCharW > 0 then
        local fitTagW = fitTagFont:getWidth("[list_selectable] ")
        local fitOffsetX = fitTagW + 4
        local fitRowNumW = 180
        local fitCellArea = c.w - fitOffsetX - fitRowNumW
        local fitCols = math.max(40, math.floor(fitCellArea / fitCharW))
        if inputState._lastFitCols ~= fitCols then
          inputState._lastFitCols = fitCols
          Session.setDesiredSize(fitCols, nil)
        end
      end
    end

    -- ── Compute bottom reserved area (debug overlay only) ─────────
    local inputState = getInputState(nodeId)
    if not Measure then return end

    local fontSize = 13
    local font = Measure.getFont(fontSize, nil, nil)
    local lineHeight = font:getHeight()

    -- Debug mode: must be computed before layout decisions that depend on it
    local debugVis = (props.debugVisible == nil) and true or props.debugVisible

    -- Debug overlay height (3 lines of debug text + margin)
    local df, dfH, debugTop
    if debugVis then
      df = Measure.getFont(10, nil, nil)
      dfH = df:getHeight()
      local debugH = dfH * 3 + 5  -- 3 lines + gap
      local bottomMargin = 10
      debugTop = c.y + c.h - debugH - bottomMargin
    end

    -- The content area stops at the debug overlay top (or bottom of canvas)
    local contentBottom = debugVis and debugTop or (c.y + c.h)
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

      -- Debug mode: show tag labels, row numbers, color strings
      local cellOffsetX, rowNumW
      if debugVis then
        local tagW = tagFont:getWidth("[list_selectable] ")
        cellOffsetX = tagW + 4
        rowNumW = 180
      else
        cellOffsetX = 8
        rowNumW = 0
      end
      local cellAreaW = c.w - cellOffsetX - rowNumW
      local maxCellCols = math.max(1, math.floor(cellAreaW / charW))

      love.graphics.setColor(Color.toTable("#0f172a")[1], Color.toTable("#0f172a")[2],
                             Color.toTable("#0f172a")[3], effectiveOpacity)
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

      local prevScissor = Scissor.saveIntersected(contentRect.x, contentRect.y, contentRect.w, contentRect.h)

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
      local promptVtRow = nil  -- vterm row of the ❯ prompt (for cursor drawing)

      -- Group type lookup: which tokens form interactive groups
      local GROUP_TYPES = {
        menu_title = "menu", menu_option = "menu", menu_desc = "menu",
        menu_example = "menu", form_label = "menu", form_field = "menu",
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
        status_bar = true, input_border = true, warning = true,
        tool = true, result = true, form_field = true, menu_example = true,
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

          -- Sample ALL distinct fg colors on this row (debug only — expensive per-cell loop)
          local sampledFg = nil
          local hasTextContent = false
          if debugVis then
            local borderChars = { ["│"] = true, ["┌"] = true, ["╭"] = true,
              ["└"] = true, ["╰"] = true, ["─"] = true, ["┐"] = true,
              ["╮"] = true, ["┘"] = true, ["╯"] = true, ["┤"] = true,
              ["├"] = true, ["┬"] = true, ["┴"] = true, ["╌"] = true }
            local colorList = {}
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
          end

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

          -- Adjacency: text after assistant_text = assistant_text (multi-line response)
          if kind == "text" and (prevKind == "assistant_text") then
            kind = "assistant_text"
          end

          -- Adjacency: text after user_prompt/user_text = user_text (multi-line input)
          -- But NOT if this row is already classified as assistant_text
          if kind == "text" and (prevKind == "user_prompt" or prevKind == "user_text") then
            kind = "user_text"
          end

          -- Block inheritance: blank lines delimit blocks, first major semantic
          -- row sets the kind for ALL other rows in the same block.
          -- Major kinds that SET the block (everything else inherits):
          local BLOCK_SETTERS = {
            banner = true, thinking = true,
            tool = true, result = true, diff = true,
            plan_mode = true, permission = true, error = true, warning = true,
            status_bar = true, input_border = true, input_zone = true,
            idle_prompt = true, thought_complete = true, task_active = true,
            image_attachment = true, assistant_text = true,
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

          -- Form label: list_selectable rows ending with ":" inside menu context
          -- e.g. "Possible matcher values for field trigger:", "Matcher:"
          if inMenu and (kind == "list_selectable") then
            local trimmed = rowText:match("^%s*(.-)%s*$")
            if trimmed:sub(-1) == ":" then
              kind = "form_label"
            end
          end

          -- Form field: box_drawing rows forming ╭ │ ╰ bordered input box inside menu context
          -- Detect ╭───╮ / │ │ / ╰───╯ patterns when preceded by form_label
          if inMenu and kind == "box_drawing" then
            if rowText:find("╭", 1, true) or rowText:find("╰", 1, true)
               or (rowText:find("│", 1, true) and prevKind == "form_field") then
              -- Only reclassify if previous row was form_label or form_field
              if prevKind == "form_label" or prevKind == "form_field" then
                kind = "form_field"
              end
            end
          end

          -- Menu example: assistant_text (bullet rows) after a menu_title containing "Example"
          -- e.g. "Example Matchers:" followed by "• Write (single tool)"
          if kind == "assistant_text" and prevKind == "menu_example" then
            kind = "menu_example"
          end
          if kind == "assistant_text" and prevKind == "menu_title" then
            -- Check if previous menu_title contained "Example"
            if row > 0 then
              local prevText = vterm:getRowText(row - 1)
              if prevText:find("Example", 1, true) then
                kind = "menu_example"
              end
            end
          end

          -- Override: rows in the input zone get zone-specific tags
          if row >= boundary then
            if Session.isSeparatorRow(vterm, row) then
              kind = "input_border"
            elseif kind == "user_prompt" or kind == "idle_prompt" then
              kind = "user_input"
              if not promptVtRow then promptVtRow = row end
            elseif kind == "status_bar" then
              kind = "status_bar"
            elseif kind == "confirmation" or kind == "menu_option" or kind == "selector" or kind == "menu_title" then
              -- keep these as-is
            elseif rowText:match("^%s*/[%w%-]") or rowText:find("/[%w%-].*…") then
              kind = "slash_menu"
            else
              kind = "input_zone"
            end
          end

          -- ── Turn + group tracking ───────────────────────────────
          -- turnId: increments on user_prompt ONLY when it's the actual ❯ prompt row,
          -- not continuation lines that inherited user_prompt from block context
          if kind == "user_prompt" and rowText:find("❯", 1, true) then
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
            elseif kind == "warning" then
              nid = "t" .. currentTurnId .. ":warning"
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
              -- Share parent menu_option's nodeId so they're one logical node
              nid = "g" .. currentGroupId .. ":menu:item:" .. groupItemIndex
            elseif kind == "form_label" then
              groupItemIndex = groupItemIndex + 1
              nid = "g" .. currentGroupId .. ":form:label:" .. groupItemIndex
            elseif kind == "form_field" then
              nid = "g" .. currentGroupId .. ":form:field:" .. groupItemIndex
            elseif kind == "menu_example" then
              nid = "g" .. currentGroupId .. ":menu:example"
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
            -- Draw tag prefix (debug only)
            if debugVis then
              love.graphics.setFont(tagFont)
              -- Color-code by zone: blue=content, orange=input zone
              if row >= boundary then
                love.graphics.setColor(1.0, 0.6, 0.2, 0.7 * effectiveOpacity)
              else
                love.graphics.setColor(0.4, 0.7, 1.0, 0.6 * effectiveOpacity)
              end
              love.graphics.print("[" .. kind .. "]", c.x + 4, py + 2)
            end

            -- Draw cells
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
      Scissor.restore(prevScissor)

      -- ── Prompt cursor ─────────────────────────────────────────
      -- We are the terminal. The cursor is our box overlay.
      -- Ink renders its cursor as a reverse-video cell on the prompt row.
      -- Scan for that cell to find the actual cursor column.
      if inputState.blinkOn and promptVtRow then
        local cursorCol = nil
        local scanCols = select(2, vterm:size())
        for col = 0, scanCols - 1 do
          local cell = vterm:getCell(promptVtRow, col)
          if cell then
            local hasBg = cell.bg and (cell.bg[1] > 0 or cell.bg[2] > 0 or cell.bg[3] > 0)
            if cell.reverse or hasBg then
              cursorCol = col
              break
            end
          end
        end
        if cursorCol then
          local cy = c.y + 8 + promptVtRow * lineH - scrollY
          local cx = c.x + cellOffsetX + cursorCol * charW
          if cy >= c.y and cy + lineH <= contentBottom then
            love.graphics.setColor(0.9, 0.9, 0.95, 0.85 * effectiveOpacity)
            love.graphics.rectangle("fill", cx, cy, charW, lineH)
          end
        end
      end

      -- Store classified cache for clipboard dump hotkey
      _lastClassified[nodeId] = classifiedCache

      -- Pending snapshot captures (multiple can be in flight: immediate + delayed)
      local pendings = _pendingCaptures[nodeId]
      if pendings and #pendings > 0 then
        local remaining = {}
        for _, pending in ipairs(pendings) do
          pending.framesLeft = pending.framesLeft - 1
          if pending.framesLeft <= 0 then
            if not _snapshots[nodeId] then _snapshots[nodeId] = {} end
            local snap = {
              trigger   = pending.trigger,
              frame     = _frameCounter,
              timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
              rows      = {},
            }
            for _, entry in ipairs(classifiedCache) do
              snap.rows[#snap.rows + 1] = {
                row     = entry.row,
                kind    = entry.kind,
                text    = entry.text,
                nodeId  = entry.nodeId,
                colors  = entry.colors,
              }
            end
            _snapshots[nodeId][#_snapshots[nodeId] + 1] = snap
          else
            remaining[#remaining + 1] = pending
          end
        end
        _pendingCaptures[nodeId] = #remaining > 0 and remaining or nil
      end

      -- Settle-based snapshot: auto-capture when a form_field is visible and damage settles
      -- This catches text typed into form fields (no Enter or / trigger)
      local hasFormField = false
      for _, entry in ipairs(classifiedCache) do
        if entry.kind == "form_field" then hasFormField = true; break end
      end
      if hasFormField then
        local dbgSettle = Session.getDebugInfo()
        local dmgAge = dbgSettle.lastDmg or -1
        -- Damage happened recently (< 2s ago) and has settled (settle timer expired)
        if dmgAge > 200 and dmgAge < 2000 and (dbgSettle.settle or 0) < 0 then
          local lastDmgKey = _lastSettleDmg[nodeId]
          -- Only capture if this is a new settle epoch (different damage timestamp)
          if lastDmgKey ~= dmgAge then
            _lastSettleDmg[nodeId] = dmgAge
            if not _pendingCaptures[nodeId] then _pendingCaptures[nodeId] = {} end
            local pc = _pendingCaptures[nodeId]
            pc[#pc + 1] = { trigger = "settle", framesLeft = 1 }
          end
        end
      else
        -- Reset settle dedup when no form field visible
        _lastSettleDmg[nodeId] = nil
      end

      -- Build semantic graph from classified cache
      local prevGraph = _lastGraph[nodeId]
      local graph = Graph.build(classifiedCache, _rowHistory[nodeId], _frameCounter)
      _lastDiff[nodeId] = Graph.diff(prevGraph, graph)
      _lastGraph[nodeId] = graph

      -- Row numbers (debug only)
      if debugVis then
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
    end

    -- ── Debug overlay (above input bar) ─────────────────────────
    if debugVis then
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
          dbg.mode or "?", tostring(dbg.alive), dbg.boundary or 0, dbg.dirty or 0),
        c.x + 8, debugTop + dfH)

      -- Recording indicator + session recorder info
      local capInst = Capabilities.getInstance(nodeId)
      local capState = capInst and capInst.state
      local sessionRec = Session.getRecorder()
      local recFrames = sessionRec and sessionRec.meta.frameCount or 0
      local recDur = sessionRec and sessionRec.meta.duration or 0
      local recIndicator = ""
      if capState and capState._recording then
        recIndicator = string.format("  REC. %d frames %.1fs  export: recording_%s",
          recFrames, recDur, capState._sessionTimestamp or "?")
      end
      love.graphics.print(
        string.format("lastDmg=%dms settle=%dms streamLen=%d vtContent=%d%s",
          dbg.lastDmg or 0, dbg.settle or 0, dbg.streaming or 0, dbg.vtContent or 0, recIndicator),
        c.x + 8, debugTop + dfH * 2)
    end

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

    -- io.write("[KEY] keyPressed → PTY: '" .. key .. "'\n"); io.flush()

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
      -- Schedule TWO classified snapshots:
      -- 1. Immediate (1 frame) — captures current state (which menu item is selected)
      -- 2. Delayed (30 frames ≈ 0.5s) — captures result after menu transitions
      if not _pendingCaptures[nodeId] then _pendingCaptures[nodeId] = {} end
      local pc = _pendingCaptures[nodeId]
      pc[#pc + 1] = { trigger = "submit:before", framesLeft = 1 }
      pc[#pc + 1] = { trigger = "submit:after", framesLeft = 30 }
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
      -- Arrow keys change selector/menu state without Enter — schedule a snapshot
      -- to capture the new selection (e.g. effort level ← → adjust, menu ↑↓ nav)
      if key == "left" or key == "right" or key == "up" or key == "down" then
        if not _pendingCaptures[nodeId] then _pendingCaptures[nodeId] = {} end
        local pc = _pendingCaptures[nodeId]
        pc[#pc + 1] = { trigger = "arrow", framesLeft = 10 }
      end
      Session.writeRaw(ANSI[key])
      return true
    end

    -- Regular character keys are handled by handleTextInput, but we still
    -- consume the event here so it doesn't bubble to parent React handlers
    -- (e.g. storybook j/k navigation stealing keystrokes from the terminal).
    return true
  end,

  handleTextInput = function(node, text)
    -- Don't send keystrokes until CLI prompt is ready
    if not Session.isReady() then return end
    -- Schedule classified snapshot when / is typed (slash menu renders immediately)
    -- Capture after ~20 frames (~0.33s) to let the menu settle
    if text == "/" then
      if not _pendingCaptures[node.id] then _pendingCaptures[node.id] = {} end
      local pc = _pendingCaptures[node.id]
      pc[#pc + 1] = { trigger = "slash", framesLeft = 20 }
    end
    -- Send typed characters directly to PTY
    Session.writeRaw(text)
  end,

  handleWheelMoved = function(node, dx, dy)
    local inputState = getInputState(node.id)
    -- dy is positive when scrolling up, negative when scrolling down (love2d convention)
    local prevScrollY = inputState.scrollY
    inputState.scrollY = inputState.scrollY - dy * SCROLL_LINE
    if inputState.scrollY < 0 then inputState.scrollY = 0 end
    -- Consume the event so it doesn't bubble to parent ScrollView
    return true
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

-- ── RPCs ──────────────────────────────────────────────────────────────────

local rpc = {}

-- Export classified buffer as annotated text
rpc["claude_canvas:export_buffer"] = function(args)
  local Caps = require("lua.capabilities")

  -- Resolve nodeId from sessionId
  local nodeId = args.id
  if not nodeId and args.sessionId then
    nodeId = _sessionNodeMap[args.sessionId or "default"]
  end
  if not nodeId then
    -- Fall back to first available
    for _, nid in pairs(_sessionNodeMap) do nodeId = nid; break end
  end
  if not nodeId then return { error = "No ClaudeCanvas instance found" } end

  local cache = _lastClassified[nodeId]
  if not cache or #cache == 0 then return { error = "No classified data available" } end

  local vterm = Session.getVTerm()
  local vtRows, vtCols = 0, 0
  if vterm then vtRows, vtCols = vterm:size() end

  local lines = {}
  for _, entry in ipairs(cache) do
    lines[#lines + 1] = {
      row     = entry.row,
      kind    = entry.kind,
      nodeId  = entry.nodeId,
      turnId  = entry.turnId,
      groupId = entry.groupId,
      text    = entry.text,
      colors  = entry.colors or {},
    }
  end

  local result = {
    lines = lines,
    meta = {
      classifier   = "claude_code",
      gridRows     = vtRows,
      gridCols     = vtCols,
      totalLines   = #lines,
      frame        = _frameCounter,
      timestamp    = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    },
  }

  -- If path given, write to file as annotated text
  if args.path then
    local f, err = io.open(args.path, "w")
    if not f then return { error = "Cannot write: " .. tostring(err) } end

    f:write("-- ClaudeCanvas buffer export\n")
    f:write(string.format("-- %s  classifier=claude_code  grid=%dx%d  frame=%d\n",
      result.meta.timestamp, vtRows, vtCols, _frameCounter))
    f:write("--\n")
    f:write("-- Format mirrors the claude canvas debug render:\n")
    f:write("-- [kind] <content> [colors] [grouping] [row]\n")
    f:write("-- Edit the [kind] tag to retag identifiers, then re-import.\n")
    f:write("--\n")

    for _, line in ipairs(lines) do
      local colorStr = #line.colors > 0 and table.concat(line.colors, " ") or "-"
      local groupStr = line.nodeId or "-"
      f:write(string.format("[%s] %s\t[%s]\t[%s]\t%d\n",
        line.kind, line.text, colorStr, groupStr, line.row))
    end

    f:close()
    return { ok = true, path = args.path, totalLines = #lines }
  end

  return result
end

-- Toggle recording on/off
rpc["claude_canvas:toggle_recording"] = function(args)
  local nodeId = args.id
  if not nodeId and args.sessionId then
    nodeId = _sessionNodeMap[args.sessionId or "default"]
  end
  if not nodeId then
    for _, nid in pairs(_sessionNodeMap) do nodeId = nid; break end
  end
  if not nodeId then return { error = "No ClaudeCanvas instance found" } end

  local inst = Capabilities.getInstance(nodeId)
  if not inst then return { error = "No instance" } end
  local state = inst.state

  state._recording = not state._recording
  if state._recording then
    state._sessionTimestamp = os.date("!%Y%m%d_%H%M%S")
  end
  return { recording = state._recording, timestamp = state._sessionTimestamp }
end

-- Register RPCs into the capability handler table
local _origGetHandlers = Capabilities.getHandlers
Capabilities.getHandlers = function()
  local h = _origGetHandlers()
  for method, fn in pairs(rpc) do h[method] = fn end
  return h
end

return Canvas
