--[[
  capabilities/semantic_terminal.lua — Visual, hittable semantic terminal capability

  The main integration point for the Semantic Terminal feature. Manages a
  PTY + vterm + classifier + semantic graph pipeline, with support for both
  live mode and recording playback.

  In live mode, a PTY is spawned and its output is fed through vterm, classified
  row-by-row, and rendered with token-appropriate colors. In playback mode,
  a .rec.lua recording is replayed through a player instance.

  Both modes share the same classification and rendering pipeline:
    PTY/playback -> vterm -> classifier -> semantic graph -> render

  React usage:
    -- Live terminal with semantic coloring:
    <SemanticTerminal command="bash" classifier="basic" />

    -- Playback of a recorded session:
    <SemanticTerminal mode="playback" playbackSrc="session.rec.lua"
      classifier="claude_code" showTokens showTimeline />

    -- Live + recording:
    <SemanticTerminal command="claude" classifier="claude_code" recording />
]]

local Capabilities = require("lua.capabilities")
local PTY          = require("lua.pty")
local VTerm        = require("lua.vterm")
local Graph        = require("lua.semantic_graph")
local Recorder     = require("lua.session_recorder")
local Player       = require("lua.session_player")
local Color        = require("lua.color")
local Scissor      = require("lua.scissor")
local Tree         = require("lua.tree")

-- ── Lazy-loaded Measure module (not available at require time) ──────────────

local Measure = nil

local function ensureMeasure()
  if not Measure then
    local ok, m = pcall(require, "lua.measure")
    if ok then Measure = m end
  end
  return Measure
end

-- ── Classifier loader ──────────────────────────────────────────────────────

local function loadClassifier(name)
  local ok, cls = pcall(require, "lua.classifiers." .. name)
  if ok then return cls end
  return require("lua.classifiers.basic")
end

-- ── Event push helper (same pattern as terminal.lua) ───────────────────────

local function pushCap(pushEvent, nodeId, handler, data)
  if not pushEvent then return end
  local payload = { targetId = nodeId, handler = handler }
  if data then for k, v in pairs(data) do payload[k] = v end end
  pushEvent({ type = "capability", payload = payload })
end

-- ── Token color palette ────────────────────────────────────────────────────

local TOKEN_COLORS = {
  -- Conversation
  user_prompt      = "#60a5fa",
  user_text        = "#e2e8f0",
  assistant_text   = "#e2e8f0",
  thinking         = "#a78bfa",
  thought_complete = "#94a3b8",
  tool             = "#eab308",
  result           = "#94a3b8",
  diff             = "#4ade80",
  error            = "#f87171",
  -- Chrome
  banner           = "#94a3b8",
  status_bar       = "#64748b",
  box_drawing      = "#334155",
  -- Interactive
  permission       = "#f97316",
  menu_title       = "#e2e8f0",
  menu_option      = "#e2e8f0",
  list_selected    = "#f97316",
  -- Tasks
  task_done        = "#4ade80",
  task_active      = "#f97316",
  task_open        = "#94a3b8",
  task_summary     = "#60a5fa",
  -- Basic classifier tokens
  command          = "#60a5fa",
  output           = "#e2e8f0",
  success          = "#4ade80",
  heading          = "#e2e8f0",
  separator        = "#334155",
  progress         = "#f97316",
}

-- Pre-resolved RGBA tables (0-1 range) — built once on first use
local TOKEN_COLORS_RESOLVED = {}

local function getTokenColor(kind)
  if TOKEN_COLORS_RESOLVED[kind] then
    return TOKEN_COLORS_RESOLVED[kind]
  end
  local hex = TOKEN_COLORS[kind] or "#e2e8f0"
  local tbl = Color.toTable(hex, { 0.89, 0.91, 0.94, 1 })
  TOKEN_COLORS_RESOLVED[kind] = tbl
  return tbl
end

local BG_COLOR = Color.toTable("#0f172a", { 0.06, 0.09, 0.16, 1 })

-- ── Classification pipeline ────────────────────────────────────────────────
-- Runs the classifier over all vterm rows and builds the classifiedCache.

local function classifyVTerm(vterm, classifier, state)
  local rows, cols = vterm:size()
  local cache = {}
  local prevKind = nil
  local turnId = 0
  local groupId = 0
  local currentGroupType = nil
  local blockId = 0
  local blockKind = nil

  -- Find last non-empty row
  local lastNonEmpty = -1
  for r = rows - 1, 0, -1 do
    local text = vterm:getRowText(r)
    if #text > 0 then
      lastNonEmpty = r
      break
    end
  end

  for row = 0, lastNonEmpty do
    local text = vterm:getRowText(row)
    if #text == 0 then
      -- Empty row: use "output" kind, no nodeId
      cache[#cache + 1] = {
        row = row,
        kind = "output",
        text = "",
        nodeId = nil,
        turnId = turnId,
        groupId = groupId,
        groupType = currentGroupType,
        colors = {},
      }
      prevKind = "output"
      blockKind = nil
    else
      -- Classify the row
      local kind = classifier.classifyRow(text, row, lastNonEmpty + 1)

      -- Adjacency refinement
      if classifier.refineAdjacency then
        kind = classifier.refineAdjacency(kind, prevKind, text, {})
      end

      -- Turn detection
      if classifier.isTurnStart and classifier.isTurnStart(kind) then
        turnId = turnId + 1
      end

      -- Group detection
      local groupTypes = classifier.groupTypes or {}
      local newGroupType = groupTypes[kind]
      if newGroupType then
        if newGroupType ~= currentGroupType then
          groupId = groupId + 1
          currentGroupType = newGroupType
        end
      else
        currentGroupType = nil
      end

      -- Block coalescing: consecutive rows of the same "block type" share a nodeId
      local blockTypes = classifier.blockTypes or {}
      local nodeId
      if blockTypes[kind] and kind == blockKind then
        nodeId = "b:" .. blockId
      else
        blockId = blockId + 1
        blockKind = blockTypes[kind] and kind or nil
        if blockKind then
          nodeId = "b:" .. blockId
        else
          nodeId = "r:" .. row
        end
      end

      -- Update row history for transition traces
      if not state.rowHistory[row] then
        state.rowHistory[row] = {}
      end
      local hist = state.rowHistory[row]
      if #hist == 0 or hist[#hist].kind ~= kind then
        hist[#hist + 1] = { kind = kind, frame = state.frameCounter }
      end

      cache[#cache + 1] = {
        row = row,
        kind = kind,
        text = text,
        nodeId = nodeId,
        turnId = turnId,
        groupId = groupId > 0 and groupId or nil,
        groupType = currentGroupType,
        colors = { TOKEN_COLORS[kind] },
      }

      prevKind = kind
    end
  end

  return cache
end

-- ── Full classification pipeline for arbitrary text rows ──────────────────
-- Runs classifyRow + refineAdjacency + turn detection + group detection + block coalescing.
-- Input: array of { text = "...", row = N }, classifier table, optional prevKind
-- Returns: array of { row, kind, nodeId, turnId, groupId, groupType }

local function classifyRows(texts, classifier, opts)
  opts = opts or {}
  local prevKind = opts.prevKind or nil
  local turnId   = opts.turnId or 0
  local groupId  = opts.groupId or 0
  local currentGroupType = opts.currentGroupType or nil
  local blockId  = opts.blockId or 0
  local blockKind = opts.blockKind or nil
  local totalRows = opts.totalRows or #texts
  local results = {}

  for _, entry in ipairs(texts) do
    local text = entry.text
    local row  = entry.row
    local kind = "output"

    if classifier and classifier.classifyRow and #text > 0 then
      kind = classifier.classifyRow(text, row, totalRows)
      if classifier.refineAdjacency then
        kind = classifier.refineAdjacency(kind, prevKind, text, {})
      end
    end

    -- Turn detection
    if classifier and classifier.isTurnStart and classifier.isTurnStart(kind) then
      turnId = turnId + 1
    end

    -- Group detection
    local groupTypes = classifier and classifier.groupTypes or {}
    local newGroupType = groupTypes[kind]
    if newGroupType then
      if newGroupType ~= currentGroupType then
        groupId = groupId + 1
        currentGroupType = newGroupType
      end
    else
      currentGroupType = nil
    end

    -- Block coalescing
    local blockTypes = classifier and classifier.blockTypes or {}
    local nodeId
    if blockTypes[kind] and kind == blockKind then
      nodeId = "b:" .. blockId
    else
      blockId = blockId + 1
      blockKind = blockTypes[kind] and kind or nil
      if blockKind then
        nodeId = "b:" .. blockId
      else
        nodeId = "r:" .. row
      end
    end

    results[#results + 1] = {
      row       = row,
      kind      = kind,
      nodeId    = nodeId,
      turnId    = turnId,
      groupId   = groupId > 0 and groupId or nil,
      groupType = currentGroupType,
    }

    prevKind = kind
  end

  return results, {
    prevKind = prevKind,
    turnId = turnId,
    groupId = groupId,
    currentGroupType = currentGroupType,
    blockId = blockId,
    blockKind = blockKind,
  }
end

-- ── Export helpers ────────────────────────────────────────────────────────

-- Sample all distinct fg colors from a row of vterm cells
local function sampleRowColors(vterm, gridRow, cols)
  local colors = {}
  local seen = {}
  for col = 0, cols - 1 do
    local cell = vterm:getCell(gridRow, col)
    if cell and cell.fg then
      local label = string.format("%d,%d,%d", cell.fg[1], cell.fg[2], cell.fg[3])
      if not seen[label] then
        seen[label] = true
        colors[#colors + 1] = label
      end
    end
  end
  return colors
end

-- Sample colors from a scrollback row
local function sampleScrollbackColors(sbRow)
  local colors = {}
  local seen = {}
  if not sbRow then return colors end
  for _, cell in ipairs(sbRow) do
    if cell.fg then
      local label = string.format("%d,%d,%d", cell.fg[1], cell.fg[2], cell.fg[3])
      if not seen[label] then
        seen[label] = true
        colors[#colors + 1] = label
      end
    end
  end
  return colors
end

-- Strip ANSI escape sequences from text
local function stripAnsi(text)
  return text:gsub("\27%[%d*;?%d*;?%d*;?%d*m", ""):gsub("\27%[[%d;]*[A-Za-z]", ""):gsub("\27%].-\27\\", "")
end

-- ── PTY spawn helper ──────────────────────────────────────────────────────

local function buildEnv(props)
  local env = {}
  env.TERM      = "xterm-256color"
  env.COLORTERM = "truecolor"
  return env
end

local function spawnPTY(props)
  local command = props.command or "bash"
  local args = {}
  if props.args and #props.args > 0 then
    for word in props.args:gmatch("%S+") do
      args[#args + 1] = word
    end
  end

  return PTY.open({
    shell = command,
    args  = args,
    cwd   = props.cwd,
    env   = buildEnv(props),
    rows  = props.rows or 40,
    cols  = props.cols or 120,
  })
end

-- ── Format time as MM:SS ──────────────────────────────────────────────────

local function formatTime(seconds)
  seconds = math.max(0, seconds)
  local m = math.floor(seconds / 60)
  local s = math.floor(seconds % 60)
  return string.format("%02d:%02d", m, s)
end

-- ── Capability registration ───────────────────────────────────────────────

Capabilities.register("SemanticTerminal", {
  visual   = true,
  hittable = true,

  schema = {
    mode           = { type = "string", default = "live",  desc = "live | playback" },
    command        = { type = "string", default = "bash",  desc = "Command to run in live mode" },
    args           = { type = "string",                    desc = "Command arguments (space-separated)" },
    cwd            = { type = "string",                    desc = "Working directory" },
    rows           = { type = "number", default = 40,      desc = "Terminal rows" },
    cols           = { type = "number", default = 120,     desc = "Terminal columns" },
    classifier     = { type = "string", default = "basic", desc = "Classifier name (from lua/classifiers/)" },
    recording      = { type = "bool",   default = false,   desc = "Record PTY output" },
    playbackSrc    = { type = "string",                    desc = "Path to .rec.lua file for playback mode" },
    playbackSpeed  = { type = "number", default = 1.0,     desc = "Playback speed multiplier" },
    showTokens     = { type = "bool",   default = false,   desc = "Show token badges overlay" },
    showGraph      = { type = "bool",   default = false,   desc = "Show semantic graph panel" },
    showTimeline   = { type = "bool",   default = true,    desc = "Show timeline scrubber in playback mode" },
    showDebug      = { type = "bool",   default = false,   desc = "Show debug footer with vterm/classifier info" },
    session        = { type = "string",                    desc = "Attach to existing Terminal PTY session instead of spawning" },
  },

  events = {
    "onClassifiedRow",
    "onGraphUpdate",
    "onStateChange",
    "onRecordingDone",
    "onPlaybackEnd",
  },

  -- ── Create ────────────────────────────────────────────────────────────────

  create = function(nodeId, props)
    local mode = props.mode or "live"
    local classifierName = props.classifier or "basic"
    local classifier = loadClassifier(classifierName)

    local state = {
      -- Mode
      mode = mode,

      -- Live mode
      pty       = nil,
      vterm     = nil,
      connected = false,

      -- Session attachment: if `session` prop is set, we borrow the Terminal's PTY
      attachedSession = props.session or nil,

      -- Playback mode
      player = nil,

      -- Shared
      classifier     = classifier,
      classifierName = classifierName,
      graph          = nil,
      prevGraph      = nil,
      classifiedCache = {},

      -- Recording
      recorder = nil,
      _sessionTimestamp = os.date("!%Y%m%d_%H%M%S"),

      -- Rendering state
      scrollY      = 0,
      _userScrolled = false,
      _blinkTimer   = 0,
      _blinkOn      = true,
      frameCounter = 0,

      -- Row history (for transition traces)
      rowHistory = {},
    }

    -- Session attachment: don't create our own vterm, we'll borrow from the Terminal
    if props.session then
      -- vterm will be resolved on each tick from the Terminal's session
      state.connected = true  -- we're "connected" to the other session
    elseif mode == "live" then
      -- Live mode: create vterm now, PTY spawns on first tick
      local r = props.rows or 40
      local c = props.cols or 120
      state.vterm = VTerm.new(r, c)
    end

    -- Playback mode: load recording and create player
    if mode == "playback" and props.playbackSrc then
      local recording, err = Recorder.load(props.playbackSrc)
      if recording then
        state.player = Player.new(recording, VTerm)
        state.player:setSpeed(props.playbackSpeed or 1.0)
        state.player:play()
      else
        io.write("[semantic_terminal] Failed to load recording: " .. tostring(err) .. "\n")
        io.flush()
        -- Create a blank vterm so rendering doesn't crash
        state.vterm = VTerm.new(props.rows or 40, props.cols or 120)
      end
    end

    -- Recording: create recorder if enabled
    if props.recording and mode == "live" then
      state.recorder = Recorder.new({
        cli  = props.command or "bash",
        rows = props.rows or 40,
        cols = props.cols or 120,
      })
    end

    return state
  end,

  -- ── Update ────────────────────────────────────────────────────────────────

  update = function(nodeId, props, prev, state)
    -- Session attachment changed
    if props.session ~= (prev.session or nil) then
      state.attachedSession = props.session or nil
      state.classifiedCache = {}
    end

    -- Classifier changed: reload and re-classify
    local classifierName = props.classifier or "basic"
    if classifierName ~= state.classifierName then
      state.classifier = loadClassifier(classifierName)
      state.classifierName = classifierName
      -- Force re-classification on next tick
      state.classifiedCache = {}
    end

    -- Playback speed changed
    if state.player and props.playbackSpeed and props.playbackSpeed ~= (prev.playbackSpeed or 1.0) then
      state.player:setSpeed(props.playbackSpeed)
    end

    -- Live mode: resize PTY and vterm if rows/cols changed
    if state.mode == "live" and state.vterm then
      local newRows = props.rows or 40
      local newCols = props.cols or 120
      local oldRows = prev.rows or 40
      local oldCols = prev.cols or 120
      if newRows ~= oldRows or newCols ~= oldCols then
        state.vterm:resize(newRows, newCols)
        if state.pty then
          state.pty:resize(newRows, newCols)
        end
      end
    end
  end,

  -- ── Tick ──────────────────────────────────────────────────────────────────

  tick = function(nodeId, state, dt, pushEvent, props)
    state.frameCounter = state.frameCounter + 1
    local needsClassify = false

    -- Cursor blink timer (0.5s on, 0.5s off)
    state._blinkTimer = state._blinkTimer + dt
    if state._blinkTimer >= 0.5 then
      state._blinkTimer = state._blinkTimer - 0.5
      state._blinkOn = not state._blinkOn
    end

    -- Auto-resize: fit vterm rows/cols to layout dimensions (like terminal.lua)
    local node = Tree.getNodes()[nodeId]
    if node and node.computed and state.vterm and not state.attachedSession then
      local cw, ch = node.computed.w, node.computed.h
      if cw and ch and cw > 0 and ch > 0 then
        ensureMeasure()
        local font = Measure and Measure.getFont(13, "monospace", nil)
        local lineH = font and font:getHeight() or 16
        local charW = font and font:getWidth("M") or 8
        -- Subtract debug footer and timeline from available height
        local showDebug = props.showDebug
        local debugFontH = Measure and Measure.getFont(10, "monospace", nil):getHeight() or 12
        local debugH = showDebug and (debugFontH * 3 + 8) or 0
        local showTimeline = props.showTimeline and state.mode == "playback" and state.player
        local timelineH = showTimeline and 32 or 0
        local availH = ch - debugH - timelineH
        local fitCols = math.max(20, math.floor(cw / charW))
        local fitRows = math.max(4, math.floor(availH / lineH))
        local curRows, curCols = state.vterm:size()
        if fitCols ~= curCols or fitRows ~= curRows then
          state.vterm:resize(fitRows, fitCols)
          if state.pty then state.pty:resize(fitRows, fitCols) end
        end
      end
    end

    -- Session attachment mode: borrow vterm from an existing Terminal session
    if state.attachedSession then
      local termAPI = Capabilities._terminalAPI
      if termAPI then
        local termState = termAPI.getSessionState(state.attachedSession)
        if termState then
          local borrowedVterm = termState.vterm
          if borrowedVterm then
            -- Check if vterm content changed
            if borrowedVterm ~= state._lastBorrowedVterm then
              state._lastBorrowedVterm = borrowedVterm
              needsClassify = true
            end
            -- Also classify periodically (every 10 frames) to catch scrollback changes
            if state.frameCounter % 10 == 0 then
              needsClassify = true
            end
          end
          -- Capture raw PTY data for recording (Terminal stashes last read)
          -- Only capture frames that contain newlines (command output, not per-keystroke echo)
          if state.recorder and termState._lastRawData then
            local data = termState._lastRawData
            termState._lastRawData = nil  -- consume so we don't double-capture
            if data:find("\n") or data:find("\r") then
              state.recorder:capture(data)
            else
              -- Buffer non-newline data until we see a newline
              state._recBuf = (state._recBuf or "") .. data
            end
            -- Flush buffer when we do get a newline
            if state._recBuf and (data:find("\n") or data:find("\r")) then
              state.recorder:capture(state._recBuf)
              state._recBuf = nil
            end
          end
        end
      end

    elseif state.mode == "live" then
      -- Auto-spawn PTY on first tick
      if not state.connected then
        local pty, err = spawnPTY(props)
        if pty then
          state.pty       = pty
          state.connected = true
          pushCap(pushEvent, nodeId, "onStateChange", { state = "connected" })
        else
          pushCap(pushEvent, nodeId, "onStateChange", { state = "error", error = tostring(err) })
        end
        return
      end

      -- Drain PTY output every frame
      if state.pty and state.connected then
        local data = state.pty:read()
        if data then
          -- Feed to vterm
          state.vterm:feed(data)
          needsClassify = true

          -- Record if enabled (batch on newlines, not per-keystroke)
          if state.recorder then
            if data:find("\n") or data:find("\r") then
              if state._recBuf then
                state.recorder:capture(state._recBuf .. data)
                state._recBuf = nil
              else
                state.recorder:capture(data)
              end
            else
              state._recBuf = (state._recBuf or "") .. data
            end
          end
        end

        -- Check for process exit
        if not state.pty:alive() then
          local code = state.pty:exitCode()
          state.connected = false
          state.pty:close()
          state.pty = nil
          pushCap(pushEvent, nodeId, "onStateChange", { state = "exited", exitCode = code })

          -- Save recording on exit
          if state.recorder then
            state.recorder:stop()
            pushCap(pushEvent, nodeId, "onRecordingDone", {
              frameCount = state.recorder.meta.frameCount,
              duration   = state.recorder.meta.duration,
            })
          end
        end
      end

    elseif state.mode == "playback" and state.player then
      -- Advance playback
      local dirty = state.player:advance(dt)
      if dirty then
        needsClassify = true
      end

      -- Auto-pause at end: fire event
      local ps = state.player:getState()
      if ps.atEnd and not state._endFired then
        state._endFired = true
        pushCap(pushEvent, nodeId, "onPlaybackEnd", {})
      end
    end

    -- Classification pass
    if needsClassify then
      local vterm = state.vterm
      if state.attachedSession then
        local termAPI = Capabilities._terminalAPI
        if termAPI then
          vterm = termAPI.getSessionVTerm(state.attachedSession)
        end
      elseif state.player then
        vterm = state.player:getVTerm()
      end

      if vterm then
        state.classifiedCache = classifyVTerm(vterm, state.classifier, state)

        -- Build semantic graph
        state.prevGraph = state.graph
        state.graph = Graph.build(
          state.classifiedCache,
          state.rowHistory,
          state.frameCounter,
          state.classifier
        )

        -- Push events to React
        pushCap(pushEvent, nodeId, "onGraphUpdate", {
          nodeCount  = state.graph and #state.graph.nodeOrder or 0,
          turnCount  = state.graph and state.graph.state.turnCount or 0,
          frame      = state.frameCounter,
        })

        -- Push onClassifiedRow for the last classified row
        if #state.classifiedCache > 0 then
          local last = state.classifiedCache[#state.classifiedCache]
          pushCap(pushEvent, nodeId, "onClassifiedRow", {
            row  = last.row,
            kind = last.kind,
            text = last.text,
          })
        end
      end
    end
  end,

  -- ── Destroy ───────────────────────────────────────────────────────────────

  destroy = function(nodeId, state)
    if state.pty then
      state.pty:close()
      state.pty = nil
    end
    -- Only free our own vterm, not borrowed ones
    if state.vterm and not state.attachedSession then
      state.vterm:free()
      state.vterm = nil
    end
    if state.player then
      state.player:destroy()
      state.player = nil
    end
    -- Auto-save on destroy: recording (.rec.lua) + annotated export (.txt)
    local ts = state._sessionTimestamp or os.date("!%Y%m%d_%H%M%S")

    if state.recorder then
      state.recorder:stop()
      local recPath = "recording_" .. ts .. ".rec.lua"
      local ok, err = state.recorder:save(recPath)
      if ok then
        io.write("[semantic_terminal] recording saved: " .. recPath .. "\n"); io.flush()
      else
        io.write("[semantic_terminal] recording save failed: " .. tostring(err) .. "\n"); io.flush()
      end
    end

    -- Save annotated export with semantic debug info
    local vterm = state.vterm
    if state.attachedSession then
      local termAPI = Capabilities._terminalAPI
      if termAPI then vterm = termAPI.getSessionVTerm(state.attachedSession) end
    elseif state.player then
      vterm = state.player and state.player:getVTerm()
    end
    if vterm then
      local exportPath = "recording_" .. ts .. ".txt"
      local rowLookup = {}
      for _, entry in ipairs(state.classifiedCache) do
        rowLookup[entry.row] = entry
      end
      local vtRows, vtCols = vterm:size()
      local sbCount = vterm:scrollbackCount()
      local f = io.open(exportPath, "w")
      if f then
        f:write("-- SemanticTerminal buffer export\n")
        f:write(string.format("-- %s  classifier=%s  scrollback=%d  grid=%dx%d  frame=%d\n",
          os.date("!%Y-%m-%dT%H:%M:%SZ"), state.classifierName, sbCount, vtRows, vtCols, state.frameCounter))
        f:write("-- Format: [kind] <content>\\t<colors>\\t<grouping>\\t<row>\n")
        f:write("--\n")
        -- Collect all rows and classify with full pipeline
        local classifier = state.classifier
        local allTexts = {}
        local sbRows = {}
        for i = 0, sbCount - 1 do
          local sbRow = vterm:getScrollbackRow(i + 1)
          local text = ""
          if sbRow then
            local chars = {}
            for j, cell in ipairs(sbRow) do chars[j] = cell.char or "" end
            text = table.concat(chars)
          end
          allTexts[#allTexts + 1] = { text = stripAnsi(text), row = i }
          sbRows[#sbRows + 1] = sbRow
        end
        for r = 0, vtRows - 1 do
          allTexts[#allTexts + 1] = { text = stripAnsi(vterm:getRowText(r)), row = sbCount + r }
        end
        local classified = classifyRows(allTexts, classifier, { totalRows = sbCount + vtRows })
        for idx, entry in ipairs(classified) do
          local isScrollback = idx <= sbCount
          local colors
          if isScrollback then
            colors = sampleScrollbackColors(sbRows[idx])
          else
            local gridRow = idx - sbCount - 1
            colors = sampleRowColors(vterm, gridRow, vtCols)
          end
          local colorStr = #colors > 0 and table.concat(colors, " ") or "-"
          local nodeId = entry.nodeId or "-"
          f:write(string.format("[%s] %s\t[%s]\t[%s]\t%d\n", entry.kind, allTexts[idx].text, colorStr, nodeId, allTexts[idx].row))
        end
        f:close()
        io.write("[semantic_terminal] export saved: " .. exportPath .. "\n"); io.flush()
      end
    end
  end,

  -- ── Measure ───────────────────────────────────────────────────────────────
  -- Returns nil to let the layout engine handle sizing (flexGrow, explicit dims).

  measure = function(node)
    return nil
  end,

  -- ── Render ────────────────────────────────────────────────────────────────
  -- Paints terminal content with semantic token coloring.

  render = function(node, c, effectiveOpacity)
    if not c or c.w <= 0 or c.h <= 0 then return end
    ensureMeasure()

    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state
    local props = capInst.props

    local alpha = effectiveOpacity or 1

    -- Resolve the active vterm (own, borrowed, or playback)
    local vterm = state.vterm
    if state.attachedSession then
      local termAPI = Capabilities._terminalAPI
      if termAPI then
        vterm = termAPI.getSessionVTerm(state.attachedSession)
      end
    elseif state.player then
      vterm = state.player:getVTerm()
    end
    if not vterm then return end

    -- Font setup
    local fontSize = 13
    local badgeFontSize = 9
    local font = Measure and Measure.getFont(fontSize, "monospace", nil)
    local badgeFont = Measure and Measure.getFont(badgeFontSize, "monospace", nil)
    local lineHeight = font and font:getHeight() or 16
    local charWidth = font and font:getWidth("M") or 8

    -- Background
    love.graphics.setColor(BG_COLOR[1], BG_COLOR[2], BG_COLOR[3], BG_COLOR[4] * alpha)
    love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

    -- Compute content area
    local showTimeline = props.showTimeline and state.mode == "playback" and state.player
    local timelineHeight = showTimeline and 32 or 0
    local showDebug = props.showDebug
    local debugFont = showDebug and Measure and Measure.getFont(10, "monospace", nil)
    local debugFontH = debugFont and debugFont:getHeight() or 12
    local debugHeight = showDebug and (debugFontH * 3 + 8) or 0
    local contentHeight = c.h - timelineHeight - debugHeight
    local showTokens = props.showTokens

    -- Compute layout widths based on showTokens mode (matches claude_canvas debug layout)
    local tagFont = showTokens and Measure and Measure.getFont(badgeFontSize, "monospace", nil) or nil
    local cellOffsetX, rowNumW
    if showTokens and tagFont then
      local tagW = tagFont:getWidth("[list_selectable] ")
      cellOffsetX = tagW + 4
      rowNumW = 180  -- right margin for row numbers + nodeId + colors
    else
      cellOffsetX = 8
      rowNumW = 0
    end
    local cellAreaW = c.w - cellOffsetX - rowNumW
    local maxCellCols = math.max(1, math.floor(cellAreaW / charWidth))

    -- Scissor to content area
    local prevScissor = Scissor.saveIntersected(c.x, c.y, c.w, contentHeight)

    -- Build a lookup from row index to classified entry
    -- (classifier row indices are grid-relative; offset by sbCount for total-row indexing)
    local rowLookup = {}
    for _, entry in ipairs(state.classifiedCache) do
      rowLookup[entry.row] = entry
    end

    -- Scrollback + grid row count
    local vtRows, cols = vterm:size()
    local sbCount = vterm:scrollbackCount()

    -- Find last non-empty grid row (avoid phantom scroll from trailing empty rows)
    local lastNonEmptyGrid = 0
    for r = vtRows - 1, 0, -1 do
      if #(vterm:getRowText(r)) > 0 then lastNonEmptyGrid = r; break end
    end
    local totalRows = sbCount + lastNonEmptyGrid + 1

    -- Scroll bounds: scrollback + used grid rows vs viewport
    local totalContentH = totalRows * lineHeight
    local maxScroll = math.max(0, totalContentH - contentHeight)

    -- Auto-scroll to bottom when new content arrives (unless user scrolled up)
    if not state._userScrolled then
      state.scrollY = maxScroll
    end
    state.scrollY = math.max(0, math.min(state.scrollY, maxScroll))
    -- Detect user scroll: if we're not at the bottom, user scrolled up
    state._userScrolled = (state.scrollY < maxScroll - 2)

    local firstVisibleRow = math.floor(state.scrollY / lineHeight)
    local lastVisibleRow = math.min(totalRows - 1, firstVisibleRow + math.ceil(contentHeight / lineHeight) + 1)

    -- Helper: get cell for a total-row index (scrollback or grid)
    local function getCell(totalRow, col)
      if totalRow < sbCount then
        -- Scrollback row (1-indexed in vterm scrollback API)
        local sbRow = vterm:getScrollbackRow(totalRow + 1)
        if sbRow and sbRow[col + 1] then return sbRow[col + 1] end
        return { char = "", fg = nil, bg = nil, bold = false }
      else
        -- Grid row
        return vterm:getCell(totalRow - sbCount, col)
      end
    end

    -- Helper: get row text for a total-row index
    local function getRowText(totalRow)
      if totalRow < sbCount then
        local sbRow = vterm:getScrollbackRow(totalRow + 1)
        if not sbRow then return "" end
        local chars = {}
        for i, cell in ipairs(sbRow) do
          chars[i] = cell.char or ""
        end
        return table.concat(chars)
      else
        return vterm:getRowText(totalRow - sbCount)
      end
    end

    -- Per-row color sampling (for debug display, only when showTokens)
    local rowColors = {}

    -- Render visible rows (total-row index: 0..sbCount-1 = scrollback, sbCount..totalRows-1 = grid)
    for row = firstVisibleRow, lastVisibleRow do
      local text = getRowText(row)
      -- Classifier uses grid-relative indices
      local gridRow = row - sbCount
      local yPos = c.y + (row * lineHeight) - state.scrollY

      -- Skip rows fully outside the visible area
      if yPos + lineHeight < c.y or yPos > c.y + contentHeight then
        goto nextRow
      end

      -- Alternating row background for visual tracking
      if row % 2 == 1 then
        love.graphics.setColor(1, 1, 1, 0.03 * alpha)
        love.graphics.rectangle("fill", c.x, yPos, c.w, lineHeight)
      end

      local entry = rowLookup[gridRow]
      local kind = entry and entry.kind or "output"
      local tokenColor = getTokenColor(kind)
      local isSpecific = kind ~= "output"

      -- Left edge accent bar: bright for specific tokens, dim for output
      if isSpecific then
        love.graphics.setColor(tokenColor[1], tokenColor[2], tokenColor[3], 0.9 * alpha)
        love.graphics.rectangle("fill", c.x, yPos, 2, lineHeight)
      else
        love.graphics.setColor(0.3, 0.33, 0.4, 0.25 * alpha)
        love.graphics.rectangle("fill", c.x, yPos + lineHeight * 0.35, 2, lineHeight * 0.3)
      end

      -- [kind] tag prefix (like claude_canvas debug mode)
      if showTokens and tagFont then
        love.graphics.setFont(tagFont)
        if isSpecific then
          love.graphics.setColor(tokenColor[1], tokenColor[2], tokenColor[3], 0.7 * alpha)
        else
          love.graphics.setColor(0.4, 0.5, 0.6, 0.35 * alpha)
        end
        love.graphics.print("[" .. kind .. "]", c.x + 4, yPos + 2)
      end

      -- Row text: render cell-by-cell with vterm ANSI colors
      if #text > 0 and font then
        love.graphics.setFont(font)
        local textX = c.x + cellOffsetX

        -- Sample all distinct fg colors on this row (for debug display)
        local colorList, colorSeen = {}, {}
        local sampledFg = nil

        local col = 0
        while col < math.min(cols, maxCellCols) do
          local cell = getCell(row, col)
          if cell.char == "" or cell.char == " " then
            -- Draw bg on space/empty cells if present
            if cell.bg then
              love.graphics.setColor(cell.bg[1] / 255, cell.bg[2] / 255, cell.bg[3] / 255, alpha)
              love.graphics.rectangle("fill", textX + col * charWidth, yPos, charWidth, lineHeight)
            end
            col = col + 1
          else
            -- Sample fg color for debug
            if showTokens and cell.fg then
              if not sampledFg then sampledFg = cell.fg end
              local label = string.format("%d,%d,%d", cell.fg[1], cell.fg[2], cell.fg[3])
              if not colorSeen[label] then
                colorSeen[label] = true
                colorList[#colorList + 1] = label
              end
            end

            -- Start a span of same-fg chars for performance
            local spanStart = col
            local spanFg = cell.fg
            local spanBg = cell.bg
            local spanBold = cell.bold
            local spanChars = { cell.char }
            col = col + (cell.width and cell.width > 0 and cell.width or 1)

            while col < math.min(cols, maxCellCols) do
              local nc = getCell(row, col)
              if nc.char == "" or nc.char == " " then break end
              local sameFg = (spanFg == nil and nc.fg == nil) or
                (spanFg and nc.fg and spanFg[1] == nc.fg[1] and spanFg[2] == nc.fg[2] and spanFg[3] == nc.fg[3])
              local sameBold = (spanBold == nc.bold)
              if not sameFg or not sameBold then break end
              -- Sample this cell too
              if showTokens and nc.fg then
                local label = string.format("%d,%d,%d", nc.fg[1], nc.fg[2], nc.fg[3])
                if not colorSeen[label] then
                  colorSeen[label] = true
                  colorList[#colorList + 1] = label
                end
              end
              spanChars[#spanChars + 1] = nc.char
              col = col + (nc.width and nc.width > 0 and nc.width or 1)
            end

            -- Draw bg for span if present
            if spanBg then
              love.graphics.setColor(spanBg[1] / 255, spanBg[2] / 255, spanBg[3] / 255, alpha)
              love.graphics.rectangle("fill", textX + spanStart * charWidth, yPos, #spanChars * charWidth, lineHeight)
            end

            -- Draw fg text with ANSI color (or token color fallback)
            if spanFg then
              love.graphics.setColor(spanFg[1] / 255, spanFg[2] / 255, spanFg[3] / 255, alpha)
            else
              love.graphics.setColor(tokenColor[1], tokenColor[2], tokenColor[3], tokenColor[4] * alpha)
            end

            -- Bold font if available
            if spanBold and Measure then
              local boldFont = Measure.getFont(fontSize, "monospace", "bold")
              if boldFont then love.graphics.setFont(boldFont) end
            end

            love.graphics.print(table.concat(spanChars), textX + spanStart * charWidth, yPos)

            if spanBold and font then
              love.graphics.setFont(font)
            end
          end
        end

        -- Store sampled colors for right-side debug
        rowColors[row] = { fg = sampledFg, colors = colorList }
      end

      ::nextRow::
    end

    -- Right-side debug overlay: row numbers + nodeId + fg colors (like claude_canvas)
    if showTokens and tagFont then
      love.graphics.setFont(tagFont)
      for row = firstVisibleRow, lastVisibleRow do
        local yPos = c.y + (row * lineHeight) - state.scrollY
        if yPos + lineHeight < c.y or yPos > c.y + contentHeight then goto nextDebug end

        local gridRow = row - sbCount
        local entry = rowLookup[gridRow]
        local kind = entry and entry.kind or "output"
        local isSpecific = kind ~= "output"
        local tokenColor = getTokenColor(kind)
        local text = getRowText(row)

        -- Row number (right edge)
        if isSpecific then
          love.graphics.setColor(0.3, 1, 0.3, 0.5 * alpha)
        elseif #text > 0 then
          love.graphics.setColor(0.3, 1, 0.3, 0.3 * alpha)
        else
          love.graphics.setColor(1, 1, 1, 0.15 * alpha)
        end
        love.graphics.print(string.format("%3d", row), c.x + c.w - 30, yPos)

        -- NodeId next to row number
        if entry and entry.nodeId then
          love.graphics.setColor(0.6, 0.8, 0.4, 0.6 * alpha)
          local mw = tagFont:getWidth(entry.nodeId .. "  ")
          love.graphics.print(entry.nodeId, c.x + c.w - 34 - mw, yPos)
        end

        -- All distinct fg colors further left
        local rc = rowColors[row]
        if rc and rc.colors and #rc.colors > 0 then
          love.graphics.setColor(0.5, 0.5, 0.5, 0.5 * alpha)
          local rmWidth = 0
          if entry and entry.nodeId then
            rmWidth = tagFont:getWidth(entry.nodeId .. "    ")
          end
          local colorStr = table.concat(rc.colors, " ")
          local cw2 = tagFont:getWidth(colorStr .. "  ")
          love.graphics.print(colorStr, c.x + c.w - 34 - rmWidth - cw2, yPos)
        end

        ::nextDebug::
      end
      if font then love.graphics.setFont(font) end
    end

    -- Cursor (blinks 0.5s on / 0.5s off — cursor.row is grid-relative, offset by sbCount)
    local showCursor = state.mode == "live" or state.attachedSession
    if vterm:isCursorVisible() and showCursor and state._blinkOn then
      local cursor = vterm:getCursor()
      local cursorX = c.x + cellOffsetX + cursor.col * charWidth
      local cursorY = c.y + ((cursor.row + sbCount) * lineHeight) - state.scrollY
      if cursorY >= c.y and cursorY + lineHeight <= c.y + contentHeight then
        love.graphics.setColor(0.89, 0.91, 0.94, 0.7 * alpha)
        love.graphics.rectangle("fill", cursorX, cursorY, charWidth, lineHeight)
      end
    end

    Scissor.restore(prevScissor)

    -- ── Debug footer ─────────────────────────────────────────────────────────
    if showDebug and debugFont then
      local dbgY = c.y + contentHeight
      -- Background
      love.graphics.setColor(0.06, 0.08, 0.12, 0.95 * alpha)
      love.graphics.rectangle("fill", c.x, dbgY, c.w, debugHeight)
      -- Top border
      love.graphics.setColor(0.2, 0.23, 0.3, alpha)
      love.graphics.rectangle("fill", c.x, dbgY, c.w, 1)

      love.graphics.setFont(debugFont)
      love.graphics.setColor(1, 1, 0.2, 0.8 * alpha)
      local vtRows, vtCols = vterm:size()
      love.graphics.print(
        string.format("cols=%d rows=%d  w=%.0f h=%.0f  classifier=%s",
          vtCols, vtRows, c.w, c.h, state.classifierName),
        c.x + 8, dbgY + 3)
      love.graphics.print(
        string.format("mode=%s  connected=%s  frame=%d  cached=%d  scroll=%.0f",
          state.mode, tostring(state.connected), state.frameCounter,
          #state.classifiedCache, state.scrollY),
        c.x + 8, dbgY + 3 + debugFontH)
      -- Graph info
      local graphInfo = "graph: none"
      if state.graph and state.graph.state then
        local gs = state.graph.state
        graphInfo = string.format("graph: %d nodes  %d turns  %d groups",
          gs.nodeCount or 0, gs.turnCount or 0, gs.groupCount or 0)
      end
      if state.attachedSession then
        graphInfo = graphInfo .. "  session=" .. state.attachedSession
      end
      love.graphics.print(graphInfo, c.x + 8, dbgY + 3 + debugFontH * 2)

      -- Recording indicator (right-aligned on line 1)
      if state.recorder then
        local recLabel = "● REC"
        if state.recorder.meta and state.recorder.meta.frameCount then
          recLabel = recLabel .. string.format("  %d frames", state.recorder.meta.frameCount)
        end
        love.graphics.setColor(1, 0.3, 0.3, 0.9 * alpha)
        local recW = debugFont:getWidth(recLabel)
        love.graphics.print(recLabel, c.x + c.w - recW - 8, dbgY + 3)
      end

      -- Export path hint (right-aligned on line 2)
      local exportPath = "recording_" .. state._sessionTimestamp
      love.graphics.setColor(0.6, 0.7, 0.8, 0.5 * alpha)
      local expLabel = "export: " .. exportPath
      local expW = debugFont:getWidth(expLabel)
      love.graphics.print(expLabel, c.x + c.w - expW - 8, dbgY + 3 + debugFontH)
    end

    -- ── Timeline scrubber (playback mode) ──────────────────────────────────

    if showTimeline and state.player then
      local ps = state.player:getState()

      local tlY = c.y + contentHeight
      local tlH = timelineHeight
      local barPad = 8
      local barH = 6
      local barY = tlY + (tlH - barH) / 2

      -- Timeline background
      love.graphics.setColor(0.08, 0.1, 0.15, 0.95 * alpha)
      love.graphics.rectangle("fill", c.x, tlY, c.w, tlH)

      -- Top border
      love.graphics.setColor(0.2, 0.23, 0.3, alpha)
      love.graphics.rectangle("fill", c.x, tlY, c.w, 1)

      -- Progress bar track
      local trackX = c.x + barPad
      local trackW = c.w - barPad * 2 - 200  -- leave room for labels
      love.graphics.setColor(0.15, 0.18, 0.25, alpha)
      love.graphics.rectangle("fill", trackX, barY, trackW, barH, 3, 3)

      -- Progress bar fill
      local progress = math.max(0, math.min(1, ps.progress))
      local fillW = trackW * progress
      love.graphics.setColor(0.38, 0.65, 0.98, alpha)
      love.graphics.rectangle("fill", trackX, barY, fillW, barH, 3, 3)

      -- Playhead indicator
      local headX = trackX + fillW
      love.graphics.setColor(0.89, 0.91, 0.94, alpha)
      love.graphics.circle("fill", headX, barY + barH / 2, 5)

      -- Labels on the right
      if font then
        love.graphics.setFont(font)
      end
      local labelX = trackX + trackW + 10

      -- Time display
      local timeStr = formatTime(ps.time) .. " / " .. formatTime(ps.duration)
      love.graphics.setColor(0.58, 0.63, 0.73, alpha)
      if font then love.graphics.print(timeStr, labelX, tlY + 2) end

      -- Frame counter + speed + play/pause
      local infoStr = string.format("f%d/%d  %.1fx  %s",
        ps.frame, ps.totalFrames, ps.speed,
        ps.playing and "\xe2\x96\xb6" or "\xe2\x8f\xb8")
      if font then
        love.graphics.setFont(badgeFont or font)
        love.graphics.print(infoStr, labelX, tlY + 17)
      end
    end
  end,

  -- ── Keyboard handling ─────────────────────────────────────────────────────

  handleKeyPressed = function(node, key, scancode, isRepeat)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return false end
    local state = capInst.state

    -- Resolve the PTY to write to: own or borrowed from attached session
    local pty = state.pty
    if state.attachedSession then
      local termAPI = Capabilities._terminalAPI
      if termAPI then
        local termState = termAPI.getSessionState(state.attachedSession)
        if termState then pty = termState.pty end
      end
    end

    if state.mode == "live" or state.attachedSession then
      -- Reset blink (show cursor immediately on input) and auto-scroll to bottom
      state._blinkTimer = 0
      state._blinkOn = true
      state._userScrolled = false

      -- Forward keyboard to PTY via key-to-escape-sequence mapping
      if pty then
        local seq = nil
        if key == "return" then seq = "\r"
        elseif key == "backspace" then seq = "\x7f"
        elseif key == "tab" then seq = "\t"
        elseif key == "escape" then seq = "\x1b"
        elseif key == "up" then seq = "\x1b[A"
        elseif key == "down" then seq = "\x1b[B"
        elseif key == "right" then seq = "\x1b[C"
        elseif key == "left" then seq = "\x1b[D"
        elseif key == "home" then seq = "\x1b[H"
        elseif key == "end" then seq = "\x1b[F"
        elseif key == "pageup" then seq = "\x1b[5~"
        elseif key == "pagedown" then seq = "\x1b[6~"
        elseif key == "delete" then seq = "\x1b[3~"
        elseif key == "insert" then seq = "\x1b[2~"
        end

        -- Ctrl+key combos
        if love.keyboard.isDown("lctrl", "rctrl") then
          if key == "c" then seq = "\x03"
          elseif key == "d" then seq = "\x04"
          elseif key == "z" then seq = "\x1a"
          elseif key == "l" then seq = "\x0c"
          elseif key == "a" then seq = "\x01"
          elseif key == "e" then seq = "\x05"
          elseif key == "k" then seq = "\x0b"
          elseif key == "u" then seq = "\x15"
          elseif key == "w" then seq = "\x17"
          end
        end

        if seq then
          pty:write(seq)
          return true
        end
      end
      -- Consume the event even if no PTY (prevent bubbling to storybook nav)
      return true

    elseif state.mode == "playback" and state.player then
      -- Playback controls
      if key == "space" then
        state.player:togglePlay()
        return true
      elseif key == "left" then
        state.player:stepBack()
        return true
      elseif key == "right" then
        state.player:step()
        return true
      elseif key == "[" then
        local ps = state.player:getState()
        state.player:setSpeed(ps.speed - 0.5)
        return true
      elseif key == "]" then
        local ps = state.player:getState()
        state.player:setSpeed(ps.speed + 0.5)
        return true
      elseif key == "home" then
        state.player:seek(0)
        state._endFired = false
        return true
      elseif key == "end" then
        state.player:seek(state.player.meta.duration or 0)
        return true
      end
      return false
    end

    return false
  end,

  -- ── Text input handling (live mode: forward raw text to PTY) ──────────────

  handleTextInput = function(node, text)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state

    -- Resolve PTY: own or borrowed from attached Terminal session
    local pty = state.pty
    if state.attachedSession then
      local termAPI = Capabilities._terminalAPI
      if termAPI then
        local termState = termAPI.getSessionState(state.attachedSession)
        if termState then pty = termState.pty end
      end
    end

    if (state.mode == "live" or state.attachedSession) and pty then
      pty:write(text)
    end
  end,

  -- ── Mouse handling ────────────────────────────────────────────────────────

  handleMousePressed = function(node, mx, my, button)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state
    local props = capInst.props

    -- Check if click is on the timeline bar (playback mode)
    if state.mode == "playback" and state.player and props.showTimeline then
      local c = node.computed
      if not c then return end

      local timelineY = c.y + c.h - 32
      if my >= timelineY and my <= c.y + c.h then
        -- Clicked on timeline: seek to position
        local barPad = 8
        local trackX = c.x + barPad
        local trackW = c.w - barPad * 2 - 200
        if mx >= trackX and mx <= trackX + trackW then
          local fraction = (mx - trackX) / trackW
          state.player:seekFraction(fraction)
          state._endFired = false
        end
      end
    end
  end,

  -- ── Scroll handling ───────────────────────────────────────────────────────

  handleWheelMoved = function(node, wx, wy)
    local capInst = Capabilities.getInstance(node.id)
    if not capInst then return end
    local state = capInst.state
    local props = capInst.props

    -- In playback mode, check if mouse is over timeline to adjust speed
    if state.mode == "playback" and state.player and props.showTimeline then
      local c = node.computed
      if c then
        local mouseY = love.mouse and love.mouse.getY() or 0
        local timelineY = c.y + c.h - 32
        if mouseY >= timelineY then
          local ps = state.player:getState()
          state.player:setSpeed(ps.speed + wy * 0.5)
          return
        end
      end
    end

    -- Normal scroll: adjust scrollY
    local c = node.computed
    if not c or c.h <= 0 then return false end

    -- Resolve vterm: own, attached, or playback
    local vterm = state.vterm
    if state.attachedSession then
      local termAPI = Capabilities._terminalAPI
      if termAPI then
        vterm = termAPI.getSessionVTerm(state.attachedSession)
      end
    elseif state.mode == "playback" and state.player then
      vterm = state.player:getVTerm()
    end
    if not vterm then return false end

    local lineHeight = ensureMeasure() and Measure.getFont(13, nil, nil):getHeight() or 16
    local vtRows = vterm:size()
    local sbCount = vterm:scrollbackCount()
    -- Clip to last non-empty grid row (match render)
    local lastNonEmptyGrid = 0
    for r = vtRows - 1, 0, -1 do
      if #(vterm:getRowText(r)) > 0 then lastNonEmptyGrid = r; break end
    end
    local totalRows = sbCount + lastNonEmptyGrid + 1
    local showTimeline = props.showTimeline and state.mode == "playback" and state.player
    local timelineH = showTimeline and 32 or 0
    local showDebug = props.showDebug
    local debugFontH = ensureMeasure() and Measure.getFont(10, "monospace", nil):getHeight() or 12
    local debugH = showDebug and (debugFontH * 3 + 8) or 0
    local viewportH = c.h - timelineH - debugH
    local maxScroll = math.max(0, totalRows * lineHeight - viewportH)

    -- Nothing to scroll
    if maxScroll <= 0 then return false end

    local prevScrollY = state.scrollY
    local scrollAmount = 3 * lineHeight
    state.scrollY = math.max(0, math.min(state.scrollY - wy * scrollAmount, maxScroll))

    -- Track user scroll intent (scrolled away from bottom)
    state._userScrolled = (state.scrollY < maxScroll - 2)

    -- Consume only if scroll actually changed
    return state.scrollY ~= prevScrollY
  end,
})

-- ── RPC handlers ──────────────────────────────────────────────────────────

local rpc = {}

-- Re-run classifier on current vterm state
rpc["semantic_terminal:classify"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No SemanticTerminal instance: " .. tostring(args.id) } end

  local state = inst.state
  local vterm = state.vterm
  if state.player then
    vterm = state.player:getVTerm()
  end
  if not vterm then return { error = "No vterm available" } end

  -- Optionally switch classifier
  if args.classifier then
    state.classifier = loadClassifier(args.classifier)
    state.classifierName = args.classifier
  end

  state.classifiedCache = classifyVTerm(vterm, state.classifier, state)
  state.prevGraph = state.graph
  state.graph = Graph.build(
    state.classifiedCache, state.rowHistory,
    state.frameCounter, state.classifier
  )

  return { ok = true, rows = #state.classifiedCache }
end

-- Return current graph as a serializable table
rpc["semantic_terminal:get_graph"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state
  if not state.graph then return { nodes = {}, state = {} } end

  -- Serialize graph nodes for transport (strip non-serializable fields)
  local nodes = {}
  for _, nid in ipairs(state.graph.nodeOrder) do
    local n = state.graph.nodes[nid]
    if n then
      nodes[#nodes + 1] = {
        id       = n.id,
        type     = n.type,
        kind     = n.kind,
        role     = n.role,
        lane     = n.lane,
        scope    = n.scope,
        turnId   = n.turnId,
        rowStart = n.rowStart,
        rowEnd   = n.rowEnd,
        text     = n.text,
        lines    = n.lines,
      }
    end
  end

  return {
    nodes = nodes,
    state = state.graph.state,
    frame = state.graph.frame,
    tree  = Graph.formatTree(state.graph),
  }
end

-- Return current player/session state
rpc["semantic_terminal:get_state"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state
  local result = {
    mode           = state.mode,
    connected      = state.connected,
    classifierName = state.classifierName,
    frameCounter   = state.frameCounter,
    cacheSize      = #state.classifiedCache,
    hasRecorder    = state.recorder ~= nil,
  }

  if state.player then
    result.playback = state.player:getState()
  end

  if state.graph and state.graph.state then
    result.graphState = state.graph.state
  end

  return result
end

-- Playback control
rpc["semantic_terminal:playback_control"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state
  if not state.player then return { error = "No player (not in playback mode)" } end

  local action = args.action
  if action == "play" then
    state.player:play()
    state._endFired = false
  elseif action == "pause" then
    state.player:pause()
  elseif action == "seek" then
    state.player:seek(tonumber(args.value) or 0)
    state._endFired = false
  elseif action == "step" then
    state.player:step()
  elseif action == "stepBack" then
    state.player:stepBack()
  elseif action == "speed" then
    state.player:setSpeed(tonumber(args.value) or 1.0)
  else
    return { error = "Unknown action: " .. tostring(action) }
  end

  return { ok = true, state = state.player:getState() }
end

-- Save current recording to file
rpc["semantic_terminal:save_recording"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state
  if not state.recorder then return { error = "Recording not enabled" } end

  local path = args.path or ("recording_" .. os.date("!%Y%m%d_%H%M%S") .. ".rec.lua")
  local ok, err = state.recorder:save(path)
  if ok then
    return { ok = true, path = path }
  else
    return { error = tostring(err) }
  end
end

-- Export entire buffer with per-line semantic debug annotations + color sequences
-- Returns structured data or writes to file.
rpc["semantic_terminal:export_buffer"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state
  local vterm = state.vterm
  if state.attachedSession then
    local termAPI = Caps._terminalAPI
    if termAPI then
      vterm = termAPI.getSessionVTerm(state.attachedSession)
    end
  elseif state.player then
    vterm = state.player:getVTerm()
  end
  if not vterm then return { error = "No vterm available" } end

  -- Build row lookup from classified cache (grid-relative indices)
  local rowLookup = {}
  for _, entry in ipairs(state.classifiedCache) do
    rowLookup[entry.row] = entry
  end

  local vtRows, vtCols = vterm:size()
  local sbCount = vterm:scrollbackCount()
  local lines = {}

  -- Collect all rows (scrollback + grid) and classify with full pipeline
  local classifier = state.classifier
  local allTexts = {}

  -- Scrollback rows
  local sbTexts = {}  -- parallel array for color sampling
  for i = 0, sbCount - 1 do
    local sbRow = vterm:getScrollbackRow(i + 1)
    local text = ""
    if sbRow then
      local chars = {}
      for j, cell in ipairs(sbRow) do chars[j] = cell.char or "" end
      text = table.concat(chars)
    end
    local cleanText = stripAnsi(text)
    allTexts[#allTexts + 1] = { text = cleanText, row = i }
    sbTexts[#sbTexts + 1] = sbRow
  end

  -- Grid rows
  for r = 0, vtRows - 1 do
    local text = vterm:getRowText(r)
    allTexts[#allTexts + 1] = { text = stripAnsi(text), row = sbCount + r }
  end

  -- Run full classification pipeline (classify + refine + turns + groups + block coalescing)
  local classified = classifyRows(allTexts, classifier, { totalRows = sbCount + vtRows })

  -- Build lines from classification results
  for idx, entry in ipairs(classified) do
    local isScrollback = idx <= sbCount
    local colors
    if isScrollback then
      colors = sampleScrollbackColors(sbTexts[idx])
    else
      local gridRow = idx - sbCount - 1
      colors = sampleRowColors(vterm, gridRow, vtCols)
    end
    lines[#lines + 1] = {
      row     = allTexts[idx].row,
      zone    = isScrollback and "scrollback" or "grid",
      gridRow = not isScrollback and (idx - sbCount - 1) or nil,
      kind    = entry.kind,
      nodeId  = entry.nodeId,
      turnId  = entry.turnId,
      groupId = entry.groupId,
      text    = allTexts[idx].text,
      colors  = colors,
    }
  end

  local result = {
    lines = lines,
    meta = {
      classifier   = state.classifierName,
      scrollback   = sbCount,
      gridRows     = vtRows,
      gridCols     = vtCols,
      totalLines   = #lines,
      cacheEntries = #state.classifiedCache,
      frame        = state.frameCounter,
      mode         = state.mode,
      session      = state.attachedSession,
      timestamp    = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    },
  }

  -- If path given, write to file as annotated text
  if args.path then
    local f, err = io.open(args.path, "w")
    if not f then return { error = "Cannot write: " .. tostring(err) } end

    f:write("-- SemanticTerminal buffer export\n")
    f:write(string.format("-- %s  classifier=%s  scrollback=%d  grid=%dx%d  frame=%d\n",
      result.meta.timestamp, state.classifierName, sbCount, vtRows, vtCols, state.frameCounter))
    f:write("--\n")
    f:write("-- Format mirrors the semantic terminal debug render:\n")
    f:write("-- [kind] <content> [colors] [grouping] [row]\n")
    f:write("-- Edit the [kind] tag to retag identifiers, then re-import.\n")
    f:write("--\n")

    for _, line in ipairs(lines) do
      local colorStr = #line.colors > 0 and table.concat(line.colors, " ") or "-"
      local groupStr = line.nodeId or "-"
      f:write(string.format("[%s] %s\t[%s]\t[%s]\t%d\n",
        line.kind,
        line.text,
        colorStr,
        groupStr,
        line.row))
    end

    f:close()
    return { ok = true, path = args.path, totalLines = #lines }
  end

  return result
end

-- Import re-tagged buffer: accepts the same format as export, updates classifier cache
rpc["semantic_terminal:import_tags"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state

  if args.path then
    -- Read from file: parse the annotated text format
    local f, err = io.open(args.path, "r")
    if not f then return { error = "Cannot read: " .. tostring(err) } end

    local newCache = {}
    local sbCount = state.vterm and state.vterm:scrollbackCount() or 0
    for line in f:lines() do
      -- Skip comment lines
      if not line:match("^%-%-") then
        -- Parse: [kind] text\t[colors]\t[grouping]\trow
        local kind, text, colorStr, nodeId, rowStr =
          line:match("^%[(.-)%]%s(.-)%\t%[(.-)%]%\t%[(.-)%]%\t(%d+)$")
        if kind and rowStr then
          kind = kind:match("^%s*(.-)%s*$")  -- trim whitespace from kind
          local row = tonumber(rowStr)
          local gridRow = row - sbCount
          if gridRow >= 0 then
            newCache[#newCache + 1] = {
              row     = gridRow,
              kind    = kind,
              text    = text or "",
              nodeId  = nodeId ~= "-" and nodeId or nil,
              colors  = { TOKEN_COLORS[kind] or TOKEN_COLORS.output },
            }
          end
        end
      end
    end

    f:close()
    state.classifiedCache = newCache
    return { ok = true, imported = #newCache }

  elseif args.tags then
    -- Direct tag update: array of { gridRow, kind }
    local rowLookup = {}
    for _, entry in ipairs(state.classifiedCache) do
      rowLookup[entry.row] = entry
    end
    local updated = 0
    for _, tag in ipairs(args.tags) do
      local entry = rowLookup[tag.gridRow or tag.row]
      if entry then
        entry.kind = tag.kind
        entry.colors = { TOKEN_COLORS[tag.kind] or TOKEN_COLORS.output }
        if tag.nodeId then entry.nodeId = tag.nodeId end
        updated = updated + 1
      end
    end
    return { ok = true, updated = updated }
  end

  return { error = "Provide 'path' (file) or 'tags' (array of {gridRow, kind})" }
end

-- Start/stop recording on the fly (toggle without needing prop change)
rpc["semantic_terminal:toggle_recording"] = function(args)
  local Caps = require("lua.capabilities")
  local inst = Caps.getInstance(args.id)
  if not inst then return { error = "No instance" } end

  local state = inst.state

  if state.recorder then
    -- Stop and save
    state.recorder:stop()
    local path = args.path or ("recording_" .. os.date("!%Y%m%d_%H%M%S") .. ".rec.lua")
    local ok, err = state.recorder:save(path)
    state.recorder = nil
    if ok then
      return { ok = true, action = "stopped", path = path }
    else
      return { error = "Save failed: " .. tostring(err) }
    end
  else
    -- Start recording
    state.recorder = Recorder.new({
      rows = state.vterm and select(1, state.vterm:size()) or 40,
      cols = state.vterm and select(2, state.vterm:size()) or 120,
    })
    return { ok = true, action = "started" }
  end
end

-- ── Register RPC handlers ─────────────────────────────────────────────────
-- Same pattern as terminal.lua: augment Capabilities.getHandlers()

local Caps     = require("lua.capabilities")
local _origGet = Caps.getHandlers
Caps.getHandlers = function()
  local h = _origGet()
  for method, fn in pairs(rpc) do h[method] = fn end
  return h
end

io.write("[semantic_terminal] capability registered\n"); io.flush()
