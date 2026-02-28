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

      -- Rendering state
      scrollY      = 0,
      frameCounter = 0,

      -- Row history (for transition traces)
      rowHistory = {},
    }

    -- Live mode: create vterm now, PTY spawns on first tick
    if mode == "live" then
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

    if state.mode == "live" then
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

          -- Record if enabled
          if state.recorder then
            state.recorder:capture(data)
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
      if state.player then
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
    if state.vterm then
      state.vterm:free()
      state.vterm = nil
    end
    if state.player then
      state.player:destroy()
      state.player = nil
    end
    if state.recorder then
      state.recorder:stop()
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

    -- Resolve the active vterm
    local vterm = state.vterm
    if state.player then
      vterm = state.player:getVTerm()
    end
    if not vterm then return end

    -- Font setup
    local fontSize = 13
    local badgeFontSize = 9
    local font = Measure and Measure.getFont(fontSize, nil, nil)
    local badgeFont = Measure and Measure.getFont(badgeFontSize, nil, nil)
    local lineHeight = font and font:getHeight() or 16
    local charWidth = font and font:getWidth("M") or 8

    -- Background
    love.graphics.setColor(BG_COLOR[1], BG_COLOR[2], BG_COLOR[3], BG_COLOR[4] * alpha)
    love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

    -- Compute content area
    local showTimeline = props.showTimeline and state.mode == "playback" and state.player
    local timelineHeight = showTimeline and 32 or 0
    local contentHeight = c.h - timelineHeight
    local showTokens = props.showTokens

    -- Token badge gutter width
    local gutterWidth = showTokens and 80 or 0

    -- Scissor to content area
    love.graphics.setScissor(c.x, c.y, c.w, contentHeight)

    -- Build a lookup from row index to classified entry
    local rowLookup = {}
    for _, entry in ipairs(state.classifiedCache) do
      rowLookup[entry.row] = entry
    end

    -- Determine visible row range based on scroll
    local rows, cols = vterm:size()
    local maxScroll = math.max(0, rows * lineHeight - contentHeight)
    state.scrollY = math.max(0, math.min(state.scrollY, maxScroll))

    local firstVisibleRow = math.floor(state.scrollY / lineHeight)
    local lastVisibleRow = math.min(rows - 1, firstVisibleRow + math.ceil(contentHeight / lineHeight))

    -- Render visible rows
    for row = firstVisibleRow, lastVisibleRow do
      local text = vterm:getRowText(row)
      local yPos = c.y + (row * lineHeight) - state.scrollY

      -- Skip rows fully outside the visible area
      if yPos + lineHeight < c.y or yPos > c.y + contentHeight then
        goto nextRow
      end

      local entry = rowLookup[row]
      local kind = entry and entry.kind or "output"
      local tokenColor = getTokenColor(kind)

      -- Token badge (left gutter)
      if showTokens and entry and entry.kind ~= "output" then
        -- Badge background
        love.graphics.setColor(0.15, 0.18, 0.25, 0.8 * alpha)
        local badgeWidth = badgeFont and badgeFont:getWidth(kind) + 6 or 50
        love.graphics.rectangle("fill", c.x + 2, yPos + 1, badgeWidth, lineHeight - 2, 3, 3)

        -- Badge text
        love.graphics.setColor(tokenColor[1], tokenColor[2], tokenColor[3], 0.7 * alpha)
        if badgeFont then
          love.graphics.setFont(badgeFont)
          love.graphics.print(kind, c.x + 5, yPos + (lineHeight - badgeFontSize) / 2)
        end
      end

      -- Row text
      if #text > 0 then
        love.graphics.setColor(tokenColor[1], tokenColor[2], tokenColor[3], tokenColor[4] * alpha)
        if font then
          love.graphics.setFont(font)
          love.graphics.print(text, c.x + gutterWidth + 4, yPos)
        end
      end

      ::nextRow::
    end

    -- Cursor
    if vterm:isCursorVisible() and state.mode == "live" then
      local cursor = vterm:getCursor()
      local cursorX = c.x + gutterWidth + 4 + cursor.col * charWidth
      local cursorY = c.y + (cursor.row * lineHeight) - state.scrollY
      if cursorY >= c.y and cursorY + lineHeight <= c.y + contentHeight then
        love.graphics.setColor(0.89, 0.91, 0.94, 0.7 * alpha)
        love.graphics.rectangle("fill", cursorX, cursorY, charWidth, lineHeight)
      end
    end

    love.graphics.setScissor()

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

    if state.mode == "live" then
      -- Forward keyboard to PTY via key-to-escape-sequence mapping
      if state.pty and state.connected then
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
          state.pty:write(seq)
          return true
        end
      end
      return false

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

    if state.mode == "live" and state.pty and state.connected then
      state.pty:write(text)
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
    local scrollAmount = 3 * (ensureMeasure() and Measure.getFont(13, nil, nil):getHeight() or 16)
    state.scrollY = state.scrollY - wy * scrollAmount
    -- Clamping happens in render
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
