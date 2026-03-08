--[[
  find_overlay.lua — Ctrl+F interactive find-in-page text search overlay.

  Draws a floating search bar (top-right), highlights all matches in the tree,
  and navigates between them with Enter / Shift+Enter (or arrow keys).
  Builds on search.lua for indexing, querying, and scroll-into-view.
]]

local Search  = require("lua.search")
local Measure = require("lua.measure")

local FindOverlay = {}

-- ── State ──────────────────────────────────────────────────────

local state = {
  open       = false,
  query      = "",
  cursorPos  = 0,
  cursorBlink = 0,

  results    = {},   -- array of search.query() results
  activeIdx  = 0,    -- 1-based index of the currently focused result (0 = none)

  -- cached tree ref for reuse between draw frames
  root       = nil,
}

-- ── Appearance ─────────────────────────────────────────────────

local BAR_W       = 320
local BAR_H       = 36
local BAR_PAD     = 10
local BAR_MARGIN  = 12
local FONT_SIZE   = 14
local CORNER_R    = 6

local COLORS = {
  barBg       = { 0.12, 0.12, 0.14, 0.95 },
  barBorder   = { 0.30, 0.30, 0.35, 1 },
  inputText   = { 0.92, 0.93, 0.96, 1 },
  placeholder = { 0.50, 0.52, 0.56, 1 },
  cursor      = { 0.70, 0.82, 1.0,  1 },
  countText   = { 0.55, 0.58, 0.62, 1 },
  matchFill   = { 0.20, 0.60, 1.00, 0.15 },
  matchBorder = { 0.40, 0.75, 1.00, 0.50 },
  activeFill  = { 1.00, 0.60, 0.10, 0.30 },
  activeBorder= { 1.00, 0.70, 0.20, 0.90 },
}

-- ── Helpers ────────────────────────────────────────────────────

local function rebuildResults()
  local root = state.root
  if not root or state.query == "" then
    state.results  = {}
    state.activeIdx = 0
    return
  end
  local hotIndex = Search.buildHotIndex(root)
  state.results  = Search.query(hotIndex, state.query)
  if #state.results > 0 then
    state.activeIdx = 1
    Search.navigateTo(state.results[1].node)
  else
    state.activeIdx = 0
  end
end

local function navigateToActive()
  if state.activeIdx > 0 and state.activeIdx <= #state.results then
    Search.navigateTo(state.results[state.activeIdx].node)
  end
end

-- ── Public API ─────────────────────────────────────────────────

function FindOverlay.isOpen()
  return state.open
end

function FindOverlay.open(root)
  if state.open then
    -- Already open — re-focus (select all text for easy replacement)
    return
  end
  state.open       = true
  state.query      = ""
  state.cursorPos  = 0
  state.cursorBlink = 0
  state.results    = {}
  state.activeIdx  = 0
  state.root       = root
end

function FindOverlay.close()
  state.open = false
  state.query = ""
  state.cursorPos = 0
  state.results = {}
  state.activeIdx = 0
  Search.clearHighlight()
end

function FindOverlay.setRoot(root)
  state.root = root
end

--- Call once per frame with dt.
function FindOverlay.tick(dt)
  if not state.open then return end
  state.cursorBlink = state.cursorBlink + dt
end

-- ── Input ──────────────────────────────────────────────────────

--- Returns true if consumed.
function FindOverlay.keypressed(key)
  -- Ctrl+F toggles the overlay (checked before state.open guard)
  if key == "f" and love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui") then
    if state.open then
      FindOverlay.close()
    else
      -- Caller (init.lua) will call FindOverlay.open(root)
      return true  -- signal to init.lua to call open()
    end
    return true
  end

  if not state.open then return false end

  -- Escape closes
  if key == "escape" then
    FindOverlay.close()
    return true
  end

  -- Enter / Shift+Enter: navigate matches
  if key == "return" then
    if #state.results == 0 then return true end
    if love.keyboard.isDown("lshift", "rshift") then
      -- Previous
      state.activeIdx = state.activeIdx - 1
      if state.activeIdx < 1 then state.activeIdx = #state.results end
    else
      -- Next
      state.activeIdx = state.activeIdx + 1
      if state.activeIdx > #state.results then state.activeIdx = 1 end
    end
    navigateToActive()
    return true
  end

  -- Backspace
  if key == "backspace" then
    if state.cursorPos > 0 then
      -- Ctrl+Backspace: delete word
      if love.keyboard.isDown("lctrl", "rctrl") then
        local before = state.query:sub(1, state.cursorPos)
        local trimmed = before:gsub("%s+$", ""):gsub("%S+$", "")
        state.query = trimmed .. state.query:sub(state.cursorPos + 1)
        state.cursorPos = #trimmed
      else
        state.query = state.query:sub(1, state.cursorPos - 1) .. state.query:sub(state.cursorPos + 1)
        state.cursorPos = state.cursorPos - 1
      end
      state.cursorBlink = 0
      rebuildResults()
    end
    return true
  end

  -- Delete
  if key == "delete" then
    if state.cursorPos < #state.query then
      state.query = state.query:sub(1, state.cursorPos) .. state.query:sub(state.cursorPos + 2)
      rebuildResults()
    end
    return true
  end

  -- Arrow keys
  if key == "left" then
    state.cursorPos = math.max(0, state.cursorPos - 1)
    state.cursorBlink = 0
    return true
  end
  if key == "right" then
    state.cursorPos = math.min(#state.query, state.cursorPos + 1)
    state.cursorBlink = 0
    return true
  end
  if key == "home" then
    state.cursorPos = 0; state.cursorBlink = 0; return true
  end
  if key == "end" then
    state.cursorPos = #state.query; state.cursorBlink = 0; return true
  end

  -- Ctrl+A: select all (move cursor to end for now)
  if key == "a" and love.keyboard.isDown("lctrl", "rctrl") then
    state.cursorPos = #state.query
    state.cursorBlink = 0
    return true
  end

  return true  -- consume all keys while open
end

--- Returns true if consumed.
function FindOverlay.textinput(text)
  if not state.open then return false end

  state.query = state.query:sub(1, state.cursorPos) .. text .. state.query:sub(state.cursorPos + 1)
  state.cursorPos = state.cursorPos + #text
  state.cursorBlink = 0
  rebuildResults()
  return true
end

-- ── Drawing ────────────────────────────────────────────────────

--- Draw match highlights on the scene (called from ReactJIT.draw).
--- Draws rectangles over every matching text node.
function FindOverlay.drawHighlights()
  if not state.open or #state.results == 0 then return end

  love.graphics.push("all")
  love.graphics.setBlendMode("alpha")

  for i, r in ipairs(state.results) do
    local c = r.node and r.node.computed
    if not c then goto continue end

    -- Use the parent's computed rect for __TEXT__ nodes (they often have 0 size)
    local x, y, w, h = c.x, c.y, c.w, c.h
    if (w == 0 or h == 0) and r.node.parent and r.node.parent.computed then
      local pc = r.node.parent.computed
      x, y, w, h = pc.x, pc.y, pc.w, pc.h
    end

    if w > 0 and h > 0 then
      if i == state.activeIdx then
        -- Active match: orange highlight
        love.graphics.setColor(COLORS.activeFill)
        love.graphics.rectangle("fill", x, y, w, h, 2, 2)
        love.graphics.setColor(COLORS.activeBorder)
        love.graphics.setLineWidth(2)
        love.graphics.rectangle("line", x, y, w, h, 2, 2)
      else
        -- Other matches: blue highlight
        love.graphics.setColor(COLORS.matchFill)
        love.graphics.rectangle("fill", x, y, w, h, 2, 2)
        love.graphics.setColor(COLORS.matchBorder)
        love.graphics.setLineWidth(1)
        love.graphics.rectangle("line", x, y, w, h, 2, 2)
      end
    end

    ::continue::
  end

  love.graphics.pop()
end

--- Draw the search bar UI (top-right floating bar).
function FindOverlay.drawBar()
  if not state.open then return end

  local ww = love.graphics.getWidth()
  local font = Measure.getFont(FONT_SIZE)

  love.graphics.push("all")
  love.graphics.origin()
  love.graphics.setScissor()
  love.graphics.setFont(font)

  local barX = ww - BAR_W - BAR_MARGIN
  local barY = BAR_MARGIN

  -- Background
  love.graphics.setColor(COLORS.barBg)
  love.graphics.rectangle("fill", barX, barY, BAR_W, BAR_H, CORNER_R, CORNER_R)

  -- Border
  love.graphics.setColor(COLORS.barBorder)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", barX, barY, BAR_W, BAR_H, CORNER_R, CORNER_R)

  -- Count badge (right side)
  local countText = ""
  if #state.results > 0 then
    countText = state.activeIdx .. "/" .. #state.results
  elseif state.query ~= "" then
    countText = "0 results"
  end
  local countW = font:getWidth(countText)
  local textY  = barY + (BAR_H - font:getHeight()) / 2

  if countText ~= "" then
    love.graphics.setColor(COLORS.countText)
    love.graphics.print(countText, barX + BAR_W - BAR_PAD - countW, textY)
  end

  -- Input area
  local inputX = barX + BAR_PAD
  local inputW = BAR_W - BAR_PAD * 2 - (countW > 0 and (countW + 8) or 0)

  -- Scissor to input area
  love.graphics.setScissor(inputX, barY, inputW, BAR_H)

  if state.query == "" then
    -- Placeholder
    love.graphics.setColor(COLORS.placeholder)
    love.graphics.print("Find in page...", inputX, textY)
  else
    -- Query text
    love.graphics.setColor(COLORS.inputText)
    love.graphics.print(state.query, inputX, textY)
  end

  -- Cursor
  local blinkOn = (state.cursorBlink % 1.0) < 0.5
  if blinkOn then
    local cursorX = inputX + font:getWidth(state.query:sub(1, state.cursorPos))
    love.graphics.setColor(COLORS.cursor)
    love.graphics.setLineWidth(1.5)
    love.graphics.line(cursorX, barY + 6, cursorX, barY + BAR_H - 6)
  end

  love.graphics.setScissor()
  love.graphics.pop()
end

return FindOverlay
