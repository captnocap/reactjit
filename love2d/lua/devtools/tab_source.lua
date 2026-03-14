--[[
  devtools/tab_source.lua — Source tab: point at any element, get its source code for live editing

  Click anything on the canvas while this tab is active → the element's source
  file opens at the exact JSX line. Edit inline, Ctrl+S saves to disk (HMR
  picks up the change automatically).

  Requires JSX dev transform (--jsx-dev / RJIT_DEV=1) so nodes carry
  debugSource = { fileName, lineNumber }. In production builds nodes have no
  debugSource and the tab shows a hint explaining this.

  Public API:
    SourceTab.draw(ctx, region)          -- draw the full tab content
    SourceTab.keypressed(ctx, key)       -- returns true if consumed
    SourceTab.textinput(ctx, text)       -- returns true if consumed
    SourceTab.wheelmoved(ctx, dx, dy)    -- returns true if consumed
    SourceTab.mousepressed(ctx, x, y, b) -- returns true if consumed
    SourceTab.onTabActivated(ctx)        -- call when switching to this tab
]]

local SourceEditor = require("lua.source_editor")

local M = {}

-- ============================================================================
-- Module state
-- ============================================================================

local state = {
  lastNodeId   = nil,   -- id of last inspected node (detect changes)
  region       = nil,   -- { x, y, w, h } set during draw, used for input routing
  headerRegion = nil,   -- { x, y, w, h } of the header strip
  saveHint     = nil,   -- { text, timer } ephemeral "Saved!" flash
}

-- ============================================================================
-- Colors (matches devtools dark theme)
-- ============================================================================

local BG           = { 0.05, 0.05, 0.10, 0.92 }
local HEADER_BG    = { 0.06, 0.06, 0.11, 1 }
local HEADER_BORDER = { 0.20, 0.20, 0.30, 1 }
local TEXT_DIM     = { 0.45, 0.48, 0.55, 1 }
local TEXT_NORMAL  = { 0.75, 0.78, 0.85, 1 }
local TEXT_BRIGHT  = { 0.88, 0.90, 0.94, 1 }
local ACCENT       = { 0.38, 0.65, 0.98, 1 }
local ACCENT_DIM   = { 0.28, 0.50, 0.78, 1 }
local DIRTY_DOT    = { 0.96, 0.62, 0.04, 1 }
local SAVE_FLASH   = { 0.30, 0.80, 0.40, 1 }
local HINT_BG      = { 0.07, 0.07, 0.13, 1 }
local HINT_TEXT    = { 0.40, 0.42, 0.50, 1 }
local PICK_ACTIVE  = { 0.38, 0.65, 0.98, 1 }
local PICK_IDLE    = { 0.35, 0.38, 0.48, 1 }

local HEADER_H = 28

-- ============================================================================
-- Helpers
-- ============================================================================

local function clamp(v, lo, hi)
  return math.max(lo, math.min(hi, v))
end

--- Returns the short display name for a file path (last 2 segments).
local function shortPath(path)
  if not path then return "" end
  local parts = {}
  for seg in path:gmatch("[^/\\]+") do
    parts[#parts + 1] = seg
  end
  if #parts >= 2 then
    return parts[#parts - 1] .. "/" .. parts[#parts]
  end
  return parts[#parts] or path
end

--- Returns just the filename.
local function basename(path)
  if not path then return "" end
  return path:match("([^/\\]+)$") or path
end

-- ============================================================================
-- Public API
-- ============================================================================

function M.onTabActivated(ctx)
  -- Enable pick mode so hovering over the canvas lights up elements
  if ctx and ctx.inspector then
    ctx.inspector.setPickMode(true)
  end
  -- If a file is already open, give the editor focus
  if SourceEditor.getPath() then
    SourceEditor.activate()
  end
end

--- Draw the source tab.
--- @param ctx table   Shared devtools context (inspector, tree, getFont, …)
--- @param region table { x, y, w, h }
function M.draw(ctx, region)
  state.region = region
  local font = ctx.getFont()
  local fh = font:getHeight()
  local pad = 8

  -- ── Sync selected node → open source file ─────────────────────────────────
  local node = ctx.inspector and ctx.inspector.getSelectedNode()
  local nodeId = node and node.id

  if nodeId ~= state.lastNodeId then
    state.lastNodeId = nodeId
    if node and node.debugSource and node.debugSource.fileName then
      local src = node.debugSource
      SourceEditor.open(src.fileName, src.lineNumber)
      SourceEditor.activate()  -- give keyboard focus immediately
    elseif node and not (node.debugSource and node.debugSource.fileName) then
      -- Node selected but has no source info (production build or native node)
      SourceEditor.close()
    end
  end

  -- ── Save-flash timer ──────────────────────────────────────────────────────
  if state.saveHint and state.saveHint.timer then
    state.saveHint.timer = state.saveHint.timer - love.timer.getDelta()
    if state.saveHint.timer <= 0 then state.saveHint = nil end
  end

  love.graphics.push("all")
  love.graphics.origin()

  local rx, ry, rw, rh = region.x, region.y, region.w, region.h

  -- Panel background
  love.graphics.setColor(BG)
  love.graphics.rectangle("fill", rx, ry, rw, rh)

  love.graphics.setFont(font)

  -- ── Header strip ──────────────────────────────────────────────────────────
  local hx, hy, hw, hh = rx, ry, rw, HEADER_H
  state.headerRegion = { x = hx, y = hy, w = hw, h = hh }

  love.graphics.setColor(HEADER_BG)
  love.graphics.rectangle("fill", hx, hy, hw, hh)
  love.graphics.setColor(HEADER_BORDER)
  love.graphics.rectangle("fill", hx, hy + hh - 1, hw, 1)

  local textY = hy + math.floor((hh - fh) / 2)
  local x = hx + pad

  -- Pick mode indicator
  local pickOn = ctx.inspector and ctx.inspector.isPickMode()
  love.graphics.setColor(pickOn and PICK_ACTIVE or PICK_IDLE)
  local pickLabel = pickOn and "\xe2\x8c\x96 pick" or "\xe2\x8c\x96 pick"  -- ⌖
  love.graphics.print(pickLabel, x, textY)
  x = x + font:getWidth(pickLabel) + pad * 2

  -- Separator
  love.graphics.setColor(HEADER_BORDER)
  love.graphics.rectangle("fill", x, hy + 6, 1, hh - 12)
  x = x + pad

  -- File breadcrumb (or placeholder)
  local openPath = SourceEditor.getPath()
  if openPath then
    -- Show short path
    local short = shortPath(openPath)
    love.graphics.setColor(TEXT_DIM)
    local dirPart = short:match("(.+)/[^/]+$")
    local filePart = basename(openPath)
    if dirPart then
      love.graphics.print(dirPart .. "/", x, textY)
      x = x + font:getWidth(dirPart .. "/")
    end
    love.graphics.setColor(TEXT_BRIGHT)
    love.graphics.print(filePart, x, textY)
    x = x + font:getWidth(filePart)

    -- Line number
    local sel = ctx.inspector and ctx.inspector.getSelectedNode()
    local ln = sel and sel.debugSource and sel.debugSource.lineNumber
    if ln then
      love.graphics.setColor(TEXT_DIM)
      local lnStr = ":" .. tostring(ln)
      love.graphics.print(lnStr, x, textY)
      x = x + font:getWidth(lnStr)
    end
  else
    love.graphics.setColor(HINT_TEXT)
    love.graphics.print("no file open", x, textY)
  end

  -- Right-aligned: dirty dot + save hint / flash
  local rightX = hx + hw - pad
  if state.saveHint then
    love.graphics.setColor(SAVE_FLASH)
    local sw = font:getWidth(state.saveHint.text)
    love.graphics.print(state.saveHint.text, rightX - sw, textY)
    rightX = rightX - sw - pad
  elseif SourceEditor.isDirty() then
    love.graphics.setColor(DIRTY_DOT)
    love.graphics.print("\xe2\x97\x8f", rightX - font:getWidth("\xe2\x97\x8f"), textY)  -- ●
    rightX = rightX - font:getWidth("\xe2\x97\x8f") - pad
    love.graphics.setColor(TEXT_DIM)
    local hint = "Ctrl+S to save"
    love.graphics.print(hint, rightX - font:getWidth(hint), textY)
  end

  -- ── Content area ──────────────────────────────────────────────────────────
  local contentY = hy + hh
  local contentH = rh - hh

  if openPath then
    -- Full-height source editor
    love.graphics.setScissor()
    SourceEditor.draw(rx, contentY, rw, contentH, font)
  else
    -- Empty state hint
    love.graphics.setScissor(rx, contentY, rw, contentH)
    love.graphics.setColor(HINT_BG)
    love.graphics.rectangle("fill", rx, contentY, rw, contentH)

    local lines
    if node and not (node.debugSource and node.debugSource.fileName) then
      -- Node selected but no source info
      lines = {
        { text = "No source info for this element", color = TEXT_NORMAL },
        { text = "This node was compiled without the JSX dev transform.", color = HINT_TEXT },
        { text = "Run in dev mode (rjit dev) to enable source mapping.", color = HINT_TEXT },
      }
    else
      -- Nothing selected yet
      lines = {
        { text = "\xe2\x8c\x96  Click any element on the canvas", color = ACCENT },
        { text = "to open its source file here for live editing.", color = TEXT_DIM },
        { text = "Ctrl+S saves to disk  \xe2\x80\xa2  HMR reloads automatically", color = HINT_TEXT },
      }
    end

    local totalH = #lines * (fh + 6)
    local startY = contentY + math.floor((contentH - totalH) / 2)
    for i, line in ipairs(lines) do
      love.graphics.setColor(line.color)
      local lw = font:getWidth(line.text)
      love.graphics.print(line.text, rx + math.floor((rw - lw) / 2), startY + (i - 1) * (fh + 6))
    end
    love.graphics.setScissor()
  end

  love.graphics.pop()
end

--- Handle keypressed. Returns true if consumed.
function M.keypressed(ctx, key)
  local ctrl = love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui")

  -- Ctrl+S: save
  if ctrl and key == "s" then
    if SourceEditor.isDirty() then
      local saved = SourceEditor.save()
      if saved then
        state.saveHint = { text = "Saved!", timer = 1.5 }
      end
    end
    return true
  end

  return SourceEditor.keypressed(key)
end

--- Handle text input. Returns true if consumed.
function M.textinput(ctx, text)
  return SourceEditor.textinput(text)
end

--- Handle mouse wheel. Returns true if consumed.
function M.wheelmoved(ctx, dx, dy)
  return SourceEditor.wheelmoved(dx, dy)
end

--- Handle mouse press. Returns true if consumed.
function M.mousepressed(ctx, x, y, btn)
  local r = state.region
  if not r then return false end
  if x < r.x or x > r.x + r.w or y < r.y or y > r.y + r.h then return false end

  -- Click in editor content area
  return SourceEditor.mousepressed(x, y, btn)
end

return M
