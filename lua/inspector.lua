--[[
  inspector.lua -- Visual debug overlay for reactjit

  Self-contained module using raw Love2D drawing calls (like errors.lua).
  Does not touch the React tree/layout/painter pipeline. Zero impact when
  disabled (one boolean check per frame per hook).

  Usage:
    local inspector = require("lua.inspector")
    -- In love.keypressed:  if inspector.keypressed(key) then return end
    -- In love.mousepressed: if inspector.mousepressed(x, y, btn) then return end
    -- In love.mousemoved:   inspector.mousemoved(x, y)
    -- In love.update:       inspector.update(dt)
    -- In love.draw (after paint): inspector.draw(root)

  Controls:
    F12   -- Toggle inspector on/off
    Tab   -- Toggle tree panel sidebar
    `     -- Toggle console (requires console.lua)
]]

local ZIndex = require("lua.zindex")
local Measure = require("lua.measure")
local SourceEditor = require("lua.source_editor")
local WM = require("lua.window_manager")
local console = nil  -- lazy-loaded to avoid circular deps

-- UTF-8 lib (LuaJIT doesn't have the Lua 5.3 utf8 global)
local ok_utf8, utf8lib = pcall(function() return utf8 end)
if not ok_utf8 or not utf8lib then
  local ok_require, mod = pcall(require, "utf8")
  if ok_require then
    utf8lib = mod
  else
    utf8lib = nil
  end
end

-- Forward declarations (defined later in the file)
local handleEditKey
local handleEditTextInput
local cancelEdit

local Inspector = {}

-- ============================================================================
-- State
-- ============================================================================

local state = {
  enabled    = false,
  pickMode   = true,       -- hover highlight + canvas click-to-select active?
  treePanel  = false,     -- sidebar visible?
  hoveredNode = nil,       -- node under cursor (deep hit test)
  selectedNode = nil,      -- clicked/locked node for detail panel
  playgroundLink = nil,    -- hover link from TextEditor (line + token)
  mouseX     = 0,
  mouseY     = 0,
  -- Performance
  fps        = 0,
  fpsTimer   = 0,
  fpsFrames  = 0,
  layoutMs   = 0,
  paintMs    = 0,
  nodeCount  = 0,
  nodeCountDirty = true,  -- recalc on next draw
  -- Hit test cache
  lastHitX   = -1,
  lastHitY   = -1,
  -- Layout/paint timing
  layoutStart = 0,
  paintStart  = 0,
  -- Tree panel scroll
  treeScrollY = 0,
  -- Detail panel scroll
  detailScrollY = 0,
  -- Collapsed nodes in tree panel (id -> true)
  collapsed  = {},
  -- Cached tree node positions for click detection
  treeNodePositions = {},  -- array of { node, y, lineH }
  -- Region bounds (set by drawTreeInRegion/drawDetailInRegion, used for input routing)
  treeRegion = nil,   -- {x, y, w, h}
  detailRegion = nil,  -- {x, y, w, h}
  -- Inline style editing
  editState = nil,  -- nil or { node, section, prop, propIndex, text, cursor, originalValue, liveApplied }
  detailPropPositions = {},  -- { section, prop, y, h, valueX, value }
  -- View mode toggle: "lua" | "hybrid" | "react"
  viewMode = "hybrid",
  -- Toggle bar region (set during draw, used for click detection)
  toggleBarRegion = nil,  -- { x, y, w, h }
  -- Clickable parent/child navigation in detail panel
  detailParentPosition = nil,  -- { node, y, h } or nil
  detailChildPositions = {},   -- array of { node, y, h }
  -- Add-prop mode: two-phase inline editor for injecting new style properties
  -- nil = inactive, { phase = "key"|"value", text, cursor, propName } = active
  addPropState = nil,
}

-- ============================================================================
-- Colors (RGBA 0-1)
-- ============================================================================

local MARGIN_COLOR  = { 0.961, 0.620, 0.043, 0.25 }  -- #f59e0b
local PADDING_COLOR = { 0.133, 0.773, 0.369, 0.25 }   -- #22c55e
local CONTENT_COLOR = { 0.235, 0.522, 0.969, 0.25 }   -- #3b82f6
local BORDER_COLOR  = { 0.961, 0.620, 0.043, 0.8 }    -- outline

local TOOLTIP_BG    = { 0.07, 0.07, 0.12, 0.92 }
local TOOLTIP_BORDER = { 0.25, 0.25, 0.35, 0.8 }
local TOOLTIP_TEXT   = { 0.88, 0.90, 0.94, 1 }
local TOOLTIP_DIM    = { 0.55, 0.58, 0.65, 1 }
local TOOLTIP_ACCENT = { 0.38, 0.65, 0.98, 1 }

local TREE_BG       = { 0.05, 0.05, 0.10, 0.88 }
local TREE_HOVER    = { 0.20, 0.25, 0.40, 0.5 }
local TREE_SELECT   = { 0.25, 0.35, 0.55, 0.6 }
local TREE_TEXT     = { 0.78, 0.80, 0.84, 1 }
local TREE_DIM      = { 0.45, 0.48, 0.55, 1 }
local TREE_ACCENT   = { 0.38, 0.65, 0.98, 1 }

local PERF_BG       = { 0.05, 0.05, 0.10, 0.8 }
local PERF_TEXT     = { 0.78, 0.80, 0.84, 1 }
local PERF_GOOD     = { 0.30, 0.80, 0.40, 1 }
local PERF_WARN     = { 0.95, 0.75, 0.20, 1 }

local DETAIL_BG     = { 0.05, 0.05, 0.10, 0.92 }

local TREE_WIDTH = 280
local DETAIL_WIDTH = 300

-- Scrollbar helper (thin thumb, no track)
local function drawScrollbar(rx, ry, rw, rh, scrollY, contentH)
  if not contentH or contentH <= rh then return end
  local maxScroll = math.max(1, contentH - rh)
  local thumbH = math.max(20, rh * (rh / contentH))
  local thumbY = ry + (scrollY / maxScroll) * (rh - thumbH)
  love.graphics.setColor(1, 1, 1, 0.25)
  love.graphics.rectangle("fill", rx + rw - 5, thumbY, 3, thumbH, 1, 1)
end

-- JSX tree view constants
local INDENT_SIZE = 16

local TYPE_TO_PRIMITIVE = {
  View       = "Box",
  Text       = "Text",
  Image      = "Image",
  Video      = "Video",
  VideoPlayer= "VideoPlayer",
  TextInput  = "TextInput",
  TextEditor = "TextEditor",
  CodeBlock  = "CodeBlock",
}

-- JSX syntax highlighting colors
local JSX_TYPE      = { 0.50, 0.53, 0.60, 1 }    -- type prefix (dim)
local JSX_BRACKET   = { 0.50, 0.52, 0.58, 1 }    -- < > brackets
local JSX_COMP      = { 0.56, 0.68, 0.98, 1 }    -- component names (accent blue)
local JSX_PRIM      = { 0.35, 0.78, 0.78, 1 }    -- primitive names (teal)
local JSX_PROP_KEY  = { 0.90, 0.78, 0.35, 1 }    -- prop keys (yellow)
local JSX_PROP_VAL  = { 0.50, 0.82, 0.50, 1 }    -- prop values (green)
local JSX_TEXT_COL  = { 0.92, 0.72, 0.48, 1 }    -- text content (orange)
local JSX_CLOSE_NAM = { 0.56, 0.68, 0.98, 0.50 } -- closing tag name (dim accent)
local JSX_CLOSE_BRK = { 0.50, 0.52, 0.58, 0.50 } -- closing tag brackets (dim)
local JSX_GUIDE     = { 0.25, 0.27, 0.35, 0.35 } -- guide lines (very dim)
local JSX_DOTS      = { 0.55, 0.55, 0.60, 1 }    -- "..." collapsed indicator
local JSX_DIMS      = { 0.50, 0.52, 0.58, 0.8 }  -- dimensions on anonymous nodes
local JSX_HANDLER   = { 0.90, 0.70, 0.20, 0.85 } -- handler badge (amber)

-- Column layout: 3-tier typography
local COL_CARET       = { 0.40, 0.42, 0.50, 0.60 }   -- dim tier: caret, guides
local COL_TYPE        = { 0.50, 0.53, 0.60, 0.80 }    -- muted tier: type badge
local COL_IDENTITY    = { 0.88, 0.90, 0.94, 1 }       -- normal tier: primitive identity
local COL_COMP        = { 0.56, 0.68, 0.98, 1 }       -- normal tier: component name (accent)
local COL_METADATA    = { 0.48, 0.50, 0.58, 0.70 }    -- muted tier: metadata tags
local COL_JSX_DIM     = { 0.42, 0.44, 0.52, 0.50 }    -- dim tier: JSX preview
local COL_TEXT_VAL    = { 0.92, 0.72, 0.48, 0.90 }    -- text content (orange)
local COL_SELECT_BAR  = { 0.38, 0.65, 0.98, 0.90 }    -- selection accent bar

-- View mode toggle bar
local TOGGLE_BG       = { 0.08, 0.08, 0.14, 1 }       -- toggle bar background
local TOGGLE_ACTIVE   = { 0.38, 0.65, 0.98, 0.25 }    -- active segment fill
local TOGGLE_BORDER   = { 0.25, 0.27, 0.35, 0.6 }     -- segment borders
local TOGGLE_TEXT_ON  = { 0.88, 0.90, 0.94, 1 }        -- active segment text
local TOGGLE_TEXT_OFF = { 0.45, 0.48, 0.55, 0.8 }      -- inactive segment text
local TOGGLE_HEIGHT   = 22                              -- toggle bar height
local VIEW_MODES      = { "lua", "hybrid", "react" }
local VIEW_MODE_LABELS = { lua = "Lua", hybrid = "Hybrid", react = "React" }

-- Node classification colors + labels
local CLASS_STATIC   = { 0.40, 0.55, 0.75, 0.70 }  -- cool blue: never re-rendered
local CLASS_REACTIVE = { 0.95, 0.75, 0.20, 0.80 }  -- amber: updates on interaction
local CLASS_HOTSPOT  = { 0.95, 0.40, 0.30, 0.90 }  -- red: high-frequency re-render
local CLASS_LABELS = {
  static   = { "S", CLASS_STATIC },
  reactive = { "R", CLASS_REACTIVE },
  hotspot  = { "H", CLASS_HOTSPOT },
}

--- Derive a content kind from node render count.
--- @param node table
--- @return string "static"|"reactive"|"hotspot"
local function classifyNode(node)
  local rc = node.renderCount or 0
  if rc <= 1 then return "static" end
  if rc > 20 then return "hotspot" end
  return "reactive"
end

-- Inline edit colors
local EDIT_BG       = { 0.12, 0.12, 0.20, 1 }
local EDIT_BORDER   = { 0.38, 0.65, 0.98, 0.6 }
local EDIT_TEXT     = { 0.92, 0.94, 0.96, 1 }
local EDIT_CURSOR   = { 0.38, 0.65, 0.98, 1 }
-- Detail panel property colors
local PROP_KEY_COL  = { 0.70, 0.55, 0.85, 1 }    -- purple for style keys
local PROP_VAL_COL  = { 0.88, 0.90, 0.94, 1 }    -- bright for values
local SECTION_COL   = { 0.45, 0.48, 0.55, 1 }    -- section headers

-- Sizing provenance colors
local PROV_EXPLICIT  = { 0.30, 0.80, 0.40, 1 }   -- green: you set this
local PROV_FLEX      = { 0.38, 0.65, 0.98, 1 }   -- blue: parent flex assigned
local PROV_CONTENT   = { 0.88, 0.90, 0.94, 1 }   -- white: auto from content
local PROV_PARENT    = { 0.95, 0.75, 0.20, 1 }   -- yellow: inherited parent width
local PROV_FALLBACK  = { 0.95, 0.40, 0.30, 1 }   -- red: surface fallback (viewport/4)
local PROV_ROOT      = { 0.65, 0.55, 0.85, 1 }   -- purple: root viewport fill

-- Human-readable provenance labels
local PROV_LABELS = {
  ["explicit"]         = { "EXPLICIT",         "you set this in style",     PROV_EXPLICIT },
  ["flex"]             = { "FLEX",             "parent flex distributed",   PROV_FLEX },
  ["stretch"]          = { "STRETCH",          "parent cross-axis stretch", PROV_FLEX },
  ["content"]          = { "CONTENT",          "auto-sized from children",  PROV_CONTENT },
  ["text"]             = { "TEXT",             "measured from text content", PROV_CONTENT },
  ["parent"]           = { "PARENT WIDTH",     "inherited parent's width",  PROV_PARENT },
  ["root"]             = { "ROOT FILL",        "auto-filled viewport",      PROV_ROOT },
  ["surface-fallback"] = { "SURFACE FALLBACK", "viewport/4 (empty surface)",PROV_FALLBACK },
  ["aspect-ratio"]     = { "ASPECT RATIO",     "derived from other axis",   PROV_FLEX },
  ["scroll-default"]   = { "SCROLL DEFAULT",   "scroll needs explicit h",   PROV_FALLBACK },
  ["unknown"]          = { "???",              "could not determine",       PROV_FALLBACK },
}

-- Forward declarations (defined later, called in mousepressed)
local startEditing
local commitEdit

-- Cached fonts (created lazily on first draw, avoids allocation per frame)
local fontSmall = nil   -- 11px, used by tooltip/tree/detail/perf
local function getFont()
  if not fontSmall then fontSmall = Measure.getFont(11) end
  return fontSmall
end

-- ============================================================================
-- Scroll parent helper
-- ============================================================================

--- Walk up the parent chain to find the nearest scroll container.
local function findScrollParent(node)
  local p = node.parent
  while p do
    if p.scrollState then return p end
    p = p.parent
  end
  return nil
end

--- Accumulate scroll offsets from all scroll ancestors of a node.
--- Returns total scrollX, scrollY that must be subtracted from layout
--- coordinates to get visual (screen) coordinates.
local function getAccumulatedScroll(node)
  local sx, sy = 0, 0
  local p = node.parent
  while p do
    if p.scrollState then
      sx = sx + (p.scrollState.scrollX or 0)
      sy = sy + (p.scrollState.scrollY or 0)
    end
    p = p.parent
  end
  return sx, sy
end

-- ============================================================================
-- Deep hit test (returns ANY node under cursor, not just hasHandlers)
-- ============================================================================

local function deepHitTest(node, mx, my)
  if not node or not node.computed then return nil end
  local s = node.style or {}
  local c = node.computed

  if s.display == "none" then return nil end

  -- Check if mouse is within node bounds (in current coordinate space)
  if mx < c.x or mx > c.x + c.w or my < c.y or my > c.y + c.h then
    return nil
  end

  -- If this node is a scroll container, adjust mouse coordinates for children.
  -- Children are laid out at their layout positions but painted with a scroll
  -- offset, so we need to ADD the scroll offset to the mouse position to
  -- convert from visual (screen) space back to layout space.
  local childMx, childMy = mx, my
  if node.scrollState then
    childMx = mx + (node.scrollState.scrollX or 0)
    childMy = my + (node.scrollState.scrollY or 0)
  end

  -- Walk children in reverse paint order (topmost first)
  local children = node.children or {}
  local paintOrder = ZIndex.getSortedChildren(children)
  for i = #paintOrder, 1, -1 do
    local hit = deepHitTest(paintOrder[i], childMx, childMy)
    if hit then return hit end
  end

  -- Return this node (no hasHandlers check)
  return node
end

-- ============================================================================
-- Node counting
-- ============================================================================

local function countNodes(node)
  if not node then return 0 end
  local count = 1
  for _, child in ipairs(node.children or {}) do
    count = count + countNodes(child)
  end
  return count
end

-- ============================================================================
-- Style helpers
-- ============================================================================

local function getMargins(s)
  local mt = s.marginTop or s.margin or 0
  local mr = s.marginRight or s.margin or 0
  local mb = s.marginBottom or s.margin or 0
  local ml = s.marginLeft or s.margin or 0
  return mt, mr, mb, ml
end

local function getPadding(s)
  local pt = s.paddingTop or s.padding or 0
  local pr = s.paddingRight or s.padding or 0
  local pb = s.paddingBottom or s.padding or 0
  local pl = s.paddingLeft or s.padding or 0
  return pt, pr, pb, pl
end

local function getBorderWidths(s)
  local bt = s.borderTopWidth or s.borderWidth or 0
  local br = s.borderRightWidth or s.borderWidth or 0
  local bb = s.borderBottomWidth or s.borderWidth or 0
  local bl = s.borderLeftWidth or s.borderWidth or 0
  return bt, br, bb, bl
end

-- Format a value for display (truncate long strings)
local function fmtVal(v)
  if type(v) == "string" then
    if #v > 24 then return '"' .. v:sub(1, 21) .. '..."' end
    return '"' .. v .. '"'
  elseif type(v) == "number" then
    if v == math.floor(v) then return tostring(v) end
    return string.format("%.1f", v)
  elseif type(v) == "boolean" then
    return tostring(v)
  elseif type(v) == "table" then
    return "{...}"
  end
  return tostring(v)
end

-- ============================================================================
-- Public API: Timing wrappers
-- ============================================================================

function Inspector.isEnabled()
  return state.enabled
end

function Inspector.beginLayout()
  state.layoutStart = love.timer.getTime()
  state.nodeCountDirty = true  -- tree changed, recount after layout
end

function Inspector.endLayout(root)
  state.layoutMs = (love.timer.getTime() - state.layoutStart) * 1000
  if root then
    state.nodeCount = countNodes(root)
    state.nodeCountDirty = false
  end
  if state.enabled then
    -- Invalidate hit test cache since node positions may have changed
    state.lastHitX = -1
    state.lastHitY = -1
  end
end

function Inspector.beginPaint()
  state.paintStart = love.timer.getTime()
end

function Inspector.endPaint()
  state.paintMs = (love.timer.getTime() - state.paintStart) * 1000
end

--- Mark node count as stale (call after tree mutations)
function Inspector.markDirty()
  state.nodeCountDirty = true
end

--- Open the inspector and select a specific node (used by context menu "Inspect").
--- Enables the inspector if not already active, opens the tree panel,
--- and focuses on the given node.
function Inspector.inspectNode(node)
  if not node then return end
  state.enabled = true
  state.treePanel = true
  state.selectedNode = node
  state.detailScrollY = 0
  state.scrollToSelected = true
end

--- Return the currently selected node (used by devtools to decide whether to show detail panel).
function Inspector.getSelectedNode()
  return state.selectedNode
end

--- Select a node directly (used by devtools child process for remote selection).
function Inspector.selectNode(node)
  if not node then return end
  state.selectedNode = node
  state.detailScrollY = 0
  state.scrollToSelected = true
end

--- Set perf data from external source (used by devtools child process).
function Inspector.setPerfData(perf)
  if not perf then return end
  if perf.fps then state.fps = perf.fps end
  if perf.layoutMs then state.layoutMs = perf.layoutMs end
  if perf.paintMs then state.paintMs = perf.paintMs end
  if perf.nodeCount then state.nodeCount = perf.nodeCount end
end

--- No-op init for child process compatibility.
function Inspector.init() end

--- Clear the selected node (used by devtools Escape handling).
function Inspector.clearSelection()
  state.editState = nil
  state.selectedNode = nil
  state.detailScrollY = 0
end

--- Whether the inspector is in inline edit mode.
function Inspector.isEditing()
  return state.editState ~= nil
end

--- Set callback for triggering tree re-layout after style edits.
local markDirtyCallback = nil
function Inspector.setMarkDirty(fn)
  markDirtyCallback = fn
end

--- Enable inspector overlays (called by devtools when panel opens).
function Inspector.enable()
  state.enabled = true
end

--- Disable inspector and clear all state (called by devtools when panel closes).
function Inspector.disable()
  state.enabled = false
  state.hoveredNode = nil
  state.selectedNode = nil
  state.playgroundLink = nil
  state.editState = nil
  state.treePanel = false
  state.treeRegion = nil
  state.detailRegion = nil
end

--- Toggle hover-highlight + canvas click-to-select mode.
--- When false, the devtools panel stays open but mouse events flow through to the app.
function Inspector.setPickMode(on)
  state.pickMode = on
  if not on then
    state.hoveredNode = nil
  end
end

function Inspector.isPickMode()
  return state.pickMode
end

--- Set cross-link highlight data from playground TextEditor hover.
--- link: nil | { line: number, token?: string, level?: string }
function Inspector.setPlaygroundLink(link)
  if not link then
    state.playgroundLink = nil
    return
  end

  local level = link.level
  local line = tonumber(link.line)
  if level == "clean" or not line or line < 1 then
    state.playgroundLink = nil
    return
  end

  local token = nil
  if type(link.token) == "string" and link.token ~= "" then
    token = link.token
  end

  state.playgroundLink = {
    line = line,
    token = token,
    level = level,
  }
end

--- Return performance data (used by console :perf command)
function Inspector.getPerfData()
  return {
    fps = state.fps,
    layoutMs = state.layoutMs,
    paintMs = state.paintMs,
    nodeCount = state.nodeCount,
  }
end

-- ============================================================================
-- Public API: Update
-- ============================================================================

function Inspector.update(dt)
  -- FPS counter (sampled every 0.5s)
  state.fpsFrames = state.fpsFrames + 1
  state.fpsTimer = state.fpsTimer + dt
  if state.fpsTimer >= 0.5 then
    state.fps = math.floor(state.fpsFrames / state.fpsTimer + 0.5)
    state.fpsFrames = 0
    state.fpsTimer = 0
  end
end

-- ============================================================================
-- Public API: Input handling
-- ============================================================================

--- Handle keypress. Returns true if consumed.
function Inspector.keypressed(key)
  if key == "f12" then
    state.enabled = not state.enabled
    if not state.enabled then
      state.hoveredNode = nil
      state.selectedNode = nil
      state.treePanel = false
      -- Close console when inspector closes
      if console and console.isVisible() then
        console.hide()
      end
    end
    return true
  end

  if not state.enabled then return false end

  -- Edit mode gets highest priority
  if state.editState then
    return handleEditKey(key)
  end

  -- Source editor gets next priority when active
  if SourceEditor.isActive() then
    -- Escape deactivates the source editor
    if key == "escape" then
      SourceEditor.deactivate()
      return true
    end
    if SourceEditor.keypressed(key) then return true end
  end

  -- Console toggle (backtick)
  if key == "`" then
    if console then
      console.toggle()
    end
    return true
  end

  -- Route to console first when it's open
  if console and console.isVisible() then
    return console.keypressed(key)
  end

  if key == "tab" then
    state.treePanel = not state.treePanel
    state.treeScrollY = 0
    return true
  end

  -- Escape clears selection
  if key == "escape" then
    if state.selectedNode then
      state.selectedNode = nil
      state.detailScrollY = 0
      SourceEditor.close()
      return true
    end
  end

  return false
end

--- Handle text input. Returns true if consumed.
function Inspector.textinput(text)
  if not state.enabled then return false end

  -- Edit mode
  if state.editState then
    return handleEditTextInput(text)
  end

  -- Source editor
  if SourceEditor.isActive() then
    if SourceEditor.textinput(text) then return true end
  end

  -- Route to console
  if console and console.isVisible() then
    return console.textinput(text)
  end

  return false
end

--- Handle mouse press. Returns true if consumed.
--- Uses stored region bounds (set by drawTreeInRegion/drawDetailInRegion) for hit detection.
function Inspector.mousepressed(x, y, button)
  -- Tree/detail region clicks work whenever the regions are set (including embed).
  -- Canvas pick mode clicks require state.enabled (full inspector active).

  -- Detail panel click (uses stored region from drawDetailInRegion)
  if state.selectedNode and state.detailRegion then
    local dr = state.detailRegion
    if x >= dr.x and x < dr.x + dr.w and y >= dr.y and y < dr.y + dr.h then
      -- Source editor gets first crack (it knows its own region)
      if SourceEditor.mousepressed(x, y, button) then
        -- Clicking in source editor deactivates inline style editing
        if state.editState then commitEdit() end
        return true
      end

      -- If we got here, click was NOT in the source editor — deactivate it
      SourceEditor.deactivate()

      -- Check if click is on an editable property value or the [+ add] button
      for i, entry in ipairs(state.detailPropPositions) do
        if entry.y + entry.h > dr.y and entry.y < dr.y + dr.h then  -- visible
          if y >= entry.y and y < entry.y + entry.h and x >= entry.valueX then
            if state.editState then commitEdit() end
            if entry.section == "addProp" then
              -- Start add-prop mode: phase 1 = type prop name
              state.addPropState = {
                node = state.selectedNode,
                phase = "key",
                text = "",
                cursor = 0,
              }
              -- Re-use editState for the inline editor rendering
              state.editState = {
                node = state.selectedNode,
                section = "addProp",
                prop = "__add__",
                propIndex = 0,
                text = "",
                cursor = 0,
                originalValue = nil,
                liveApplied = false,
              }
              return true
            end
            startEditing(entry, i)
            return true
          end
        end
      end
      -- Check if click is on the parent link
      if state.detailParentPosition then
        local pp = state.detailParentPosition
        if y >= pp.y and y < pp.y + pp.h and pp.node then
          if state.editState then commitEdit() end
          Inspector.selectNode(pp.node)
          return true
        end
      end

      -- Check if click is on a child entry
      for _, cp in ipairs(state.detailChildPositions) do
        if y >= cp.y and y < cp.y + cp.h and cp.node then
          if state.editState then commitEdit() end
          Inspector.selectNode(cp.node)
          return true
        end
      end

      -- Click elsewhere in detail: commit current edit
      if state.editState then
        commitEdit()
      end
      return true
    end
  end

  -- View mode toggle bar click
  if state.toggleBarRegion then
    local tb = state.toggleBarRegion
    if x >= tb.x and x < tb.x + tb.w and y >= tb.y and y < tb.y + tb.h then
      local idx = math.floor((x - tb.x) / tb.segW) + 1
      if idx >= 1 and idx <= 3 then
        state.viewMode = VIEW_MODES[idx]
      end
      return true
    end
  end

  -- Tree panel click (uses stored region from drawTreeInRegion)
  if state.treeRegion then
    local tr = state.treeRegion
    if x >= tr.x and x < tr.x + tr.w and y >= tr.y and y < tr.y + tr.h then
      -- Find which node was clicked using cached positions
      for _, entry in ipairs(state.treeNodePositions) do
        if y >= entry.y and y < entry.y + entry.lineH then
          -- Check if click is on the collapse indicator (the ">" / "v" zone)
          local hasChildren = entry.node.children and #entry.node.children > 0
          local isSingleText = hasChildren and #entry.node.children == 1 and entry.node.children[1].type == "__TEXT__"
          local collapseX = tr.x + 8 + (entry.depth or 0) * INDENT_SIZE - 8
          if hasChildren and not entry.isClosingTag and not isSingleText and x >= collapseX - 4 and x <= collapseX + 12 then
            -- Toggle collapse
            local nid = entry.node.id
            state.collapsed[nid] = not state.collapsed[nid]
          else
            -- Select / deselect node
            if state.selectedNode == entry.node then
              state.selectedNode = nil
              state.detailScrollY = 0
            else
              state.selectedNode = entry.node
              state.detailScrollY = 0
            end
          end
          return true
        end
      end
      return true  -- consumed by tree panel even if no node hit
    end
  end

  -- Clicking in viewport: select hovered node (only when inspector is fully enabled)
  if not state.enabled then return false end
  if state.pickMode and state.hoveredNode then
    -- Resolve to a node that actually appears in the tree panel:
    -- - Empty __TEXT__ nodes are skipped by drawTreeNode
    -- - Single-text-child __TEXT__ nodes are inlined into their parent row
    -- In both cases, select the parent instead so scroll-to can find a match.
    local target = state.hoveredNode
    if target.type == "__TEXT__" and target.parent then
      local parent = target.parent
      local siblings = parent.children or {}
      local isOnlyTextChild = #siblings == 1 and (target.text or "") ~= ""
      local isEmpty = (target.text or "") == ""
      if isEmpty or isOnlyTextChild then
        target = parent
      end
    end

    if state.selectedNode == target then
      state.selectedNode = nil
      state.detailScrollY = 0
    else
      state.selectedNode = target
      state.detailScrollY = 0
      state.scrollToSelected = true  -- tree panel will auto-scroll on next draw
      Inspector.setPickMode(false)   -- drop out of pick mode after selecting
    end
    return true
  end

  return false
end

--- Handle mouse movement (does not consume — hover tracking always runs).
function Inspector.mousemoved(x, y)
  state.mouseX = x
  state.mouseY = y
end

--- Handle mouse wheel (scroll tree panel or detail panel).
--- Uses stored region bounds for hit detection.
function Inspector.wheelmoved(x, y)
  -- Region-based scrolling works whenever regions are set (including embed)

  -- Map horizontal tilt to vertical scroll when no vertical input
  local dy = y
  if dy == 0 and x ~= 0 then dy = x end

  -- Source editor scroll (check before detail panel — editor is inside it)
  if SourceEditor.wheelmoved(x, dy) then
    return true
  end

  -- Detail panel scroll (uses stored region)
  if state.selectedNode and state.detailRegion then
    local dr = state.detailRegion
    if state.mouseX >= dr.x and state.mouseX < dr.x + dr.w
       and state.mouseY >= dr.y and state.mouseY < dr.y + dr.h then
      state.detailScrollY = state.detailScrollY - dy * 20
      if state.detailScrollY < 0 then state.detailScrollY = 0 end
      local maxScroll = math.max(0, (state.detailContentH or 0) - dr.h)
      if state.detailScrollY > maxScroll then state.detailScrollY = maxScroll end
      return true
    end
  end

  -- Tree panel scroll (uses stored region)
  if state.treeRegion then
    local tr = state.treeRegion
    if state.mouseX >= tr.x and state.mouseX < tr.x + tr.w
       and state.mouseY >= tr.y and state.mouseY < tr.y + tr.h then
      state.treeScrollY = state.treeScrollY - dy * 20
      if state.treeScrollY < 0 then state.treeScrollY = 0 end
      local maxScroll = math.max(0, (state.treeContentH or 0) - tr.h)
      if state.treeScrollY > maxScroll then state.treeScrollY = maxScroll end
      return true
    end
  end

  return false
end

-- ============================================================================
-- Console integration
-- ============================================================================

--- Set the console module reference (called from init.lua after console is loaded)
function Inspector.setConsole(consoleModule)
  console = consoleModule
end

-- ============================================================================
-- Public API: Draw
-- ============================================================================

--- Draw canvas overlays: hover highlight, selected outline, tooltip, perf bar.
--- These render on the main canvas above the content, not inside the devtools panel.
--- Called by devtools.draw() regardless of active tab.
function Inspector.drawOverlays(root)
  if not state.enabled then return end
  if not root then return end

  local ok, drawErr = pcall(function()
    -- Update hovered node via deep hit test (only in pick mode, skip if mouse hasn't moved)
    if state.pickMode then
      if state.mouseX ~= state.lastHitX or state.mouseY ~= state.lastHitY then
        state.hoveredNode = deepHitTest(root, state.mouseX, state.mouseY)
        state.lastHitX = state.mouseX
        state.lastHitY = state.mouseY
      end
    end

    -- Recount nodes only when tree has changed
    if state.nodeCountDirty then
      state.nodeCount = countNodes(root)
      state.nodeCountDirty = false
    end

    -- Save graphics state
    love.graphics.push("all")
    love.graphics.origin()
    love.graphics.setScissor()

    if state.pickMode then drawHoverOverlay() end
    drawSelectedOverlay()
    if state.pickMode then drawTooltip() end
    -- Note: perf bar is now drawn by devtools.lua as a bottom status bar

    -- Restore graphics state
    love.graphics.pop()
  end)

  if not ok then
    pcall(function()
      io.write("[inspector] Overlay draw error: " .. tostring(drawErr) .. "\n")
      io.flush()
    end)
  end
end

--- Draw the tree panel inside a region {x, y, w, h}.
--- Called by devtools when Elements tab is active.
function Inspector.drawTreeInRegion(root, region)
  if not root then return end
  state.treeRegion = region

  -- Resolve hoveredNode from tree positions BEFORE drawing so the highlight
  -- is correct on the same frame.  Uses previous frame's treeNodePositions
  -- which share the same Y coordinates (fixed lineH, same tree structure).
  -- Without this, drawOverlays' deepHitTest can clear hoveredNode to nil
  -- (mouse is over the devtools panel, not the canvas) and the tree highlight
  -- flickers on every frame during animations.
  if state.mouseX >= region.x and state.mouseX < region.x + region.w
     and state.mouseY >= region.y and state.mouseY < region.y + region.h then
    state.hoveredNode = nil
    for _, entry in ipairs(state.treeNodePositions) do
      if state.mouseY >= entry.y and state.mouseY < entry.y + entry.lineH then
        state.hoveredNode = entry.node
        break
      end
    end
  end

  drawTreePanel(root, region.x, region.y, region.w, region.h)

  -- Refresh hoveredNode with current frame's treeNodePositions (just rebuilt
  -- by drawTreePanel).  This keeps the canvas hover overlay (drawn by
  -- drawOverlays on the next frame) pointing at the correct node.
  if state.mouseX >= region.x and state.mouseX < region.x + region.w
     and state.mouseY >= region.y and state.mouseY < region.y + region.h then
    state.hoveredNode = nil
    for _, entry in ipairs(state.treeNodePositions) do
      if state.mouseY >= entry.y and state.mouseY < entry.y + entry.lineH then
        state.hoveredNode = entry.node
        break
      end
    end
  end
end

--- Draw the detail panel inside a region {x, y, w, h}.
--- Called by devtools when Elements tab is active and a node is selected.
function Inspector.drawDetailInRegion(region)
  if not state.selectedNode then return end
  state.detailRegion = region
  drawDetailPanel(region.x, region.y, region.w, region.h)
end

--- Backward-compatible draw: overlays + console (for standalone use without devtools).
function Inspector.draw(root)
  Inspector.drawOverlays(root)
  if console then
    console.draw()
  end
end

-- ============================================================================
-- Drawing: Hover overlay
-- ============================================================================

local PLAYGROUND_TOKEN_TO_HOST_TYPE = {
  Box = "View",
  Text = "Text",
  Image = "Image",
  Video = "Video",
  Pressable = "View",
  ScrollView = "View",
  TextInput = "TextInput",
  TextEditor = "TextEditor",
}

local function collectPlaygroundNodes(node, line, out)
  if not node then return end
  local p = node.props or {}
  local taggedLine = tonumber(p.__rjitPlaygroundLine)
  if taggedLine and taggedLine == line and node.computed and node.type ~= "__TEXT__" then
    out[#out + 1] = node
  end
  for _, child in ipairs(node.children or {}) do
    collectPlaygroundNodes(child, line, out)
  end
end

local function isJSXTagPunctuation(token)
  return token == "<" or token == ">" or token == "</" or token == "/>" or token == "<>" or token == "</>"
end

local function filterPlaygroundNodesByToken(nodes, token)
  if not token or token == "" or isJSXTagPunctuation(token) then
    return nodes
  end

  local hostType = PLAYGROUND_TOKEN_TO_HOST_TYPE[token]
  local filtered = {}
  for _, node in ipairs(nodes) do
    local p = node.props or {}
    if p.__rjitPlaygroundTag == token then
      filtered[#filtered + 1] = node
    elseif hostType and node.type == hostType then
      filtered[#filtered + 1] = node
    end
  end
  return filtered
end

local function pickSmallestNode(nodes)
  local best = nil
  local bestArea = nil
  for _, node in ipairs(nodes) do
    local c = node.computed
    if c then
      local area = math.max(1, c.w * c.h)
      if not bestArea or area < bestArea then
        best = node
        bestArea = area
      end
    end
  end
  return best
end

--- Draw inspector-style highlight for the JSX element currently hovered
--- in playground TextEditor. This runs even when devtools panel is closed.
function Inspector.drawPlaygroundLinkOverlay(root)
  local link = state.playgroundLink
  if not link or not root then return end

  local line = tonumber(link.line)
  if not line or line < 1 then return end

  local matches = {}
  collectPlaygroundNodes(root, line, matches)
  if #matches == 0 then return end

  local tokenMatches = filterPlaygroundNodesByToken(matches, link.token)
  if #tokenMatches > 0 then
    matches = tokenMatches
  elseif link.token and link.token ~= "" and not isJSXTagPunctuation(link.token) then
    -- Token did not map to a JSX node on this line.
    return
  end

  local target = pickSmallestNode(matches)
  if not target then return end

  local prevHovered = state.hoveredNode
  local prevSelected = state.selectedNode

  local ok = pcall(function()
    love.graphics.push("all")
    love.graphics.origin()
    love.graphics.setScissor()
    state.hoveredNode = target
    state.selectedNode = nil
    drawHoverOverlay()
    love.graphics.pop()
  end)

  state.hoveredNode = prevHovered
  state.selectedNode = prevSelected

  if not ok then
    -- Keep this path silent: it's a best-effort teaching aid.
  end
end

function drawHoverOverlay()
  local node = state.hoveredNode
  if not node or not node.computed then return end
  -- Don't draw hover overlay if this node is already selected
  if node == state.selectedNode then return end

  local s = node.style or {}
  local c = node.computed

  -- Apply scroll offset so the overlay matches the painted position.
  -- Layout coordinates are in "content space" but the painter draws with
  -- a scroll translate, so we need the same transform here.
  local scrollX, scrollY = getAccumulatedScroll(node)
  local hasScroll = scrollX ~= 0 or scrollY ~= 0
  if hasScroll then
    love.graphics.push()
    love.graphics.translate(-scrollX, -scrollY)
  end

  local mt, mr, mb, ml = getMargins(s)
  local pt, pr, pb, pl = getPadding(s)
  local bt, br, bb, bl = getBorderWidths(s)

  -- Margin area (orange)
  if mt > 0 or mr > 0 or mb > 0 or ml > 0 then
    love.graphics.setColor(MARGIN_COLOR)
    -- Top margin
    if mt > 0 then love.graphics.rectangle("fill", c.x - ml, c.y - mt, c.w + ml + mr, mt) end
    -- Bottom margin
    if mb > 0 then love.graphics.rectangle("fill", c.x - ml, c.y + c.h, c.w + ml + mr, mb) end
    -- Left margin
    if ml > 0 then love.graphics.rectangle("fill", c.x - ml, c.y, ml, c.h) end
    -- Right margin
    if mr > 0 then love.graphics.rectangle("fill", c.x + c.w, c.y, mr, c.h) end
  end

  -- Padding area (green) — the area between border and content
  local innerX = c.x + bl
  local innerY = c.y + bt
  local innerW = c.w - bl - br
  local innerH = c.h - bt - bb

  if pt > 0 or pr > 0 or pb > 0 or pl > 0 then
    love.graphics.setColor(PADDING_COLOR)
    -- Top padding
    if pt > 0 then love.graphics.rectangle("fill", innerX, innerY, innerW, pt) end
    -- Bottom padding
    if pb > 0 then love.graphics.rectangle("fill", innerX, innerY + innerH - pb, innerW, pb) end
    -- Left padding
    if pl > 0 then love.graphics.rectangle("fill", innerX, innerY + pt, pl, innerH - pt - pb) end
    -- Right padding
    if pr > 0 then love.graphics.rectangle("fill", innerX + innerW - pr, innerY + pt, pr, innerH - pt - pb) end
  end

  -- Content area (blue)
  local contentX = innerX + pl
  local contentY = innerY + pt
  local contentW = math.max(0, innerW - pl - pr)
  local contentH = math.max(0, innerH - pt - pb)
  love.graphics.setColor(CONTENT_COLOR)
  love.graphics.rectangle("fill", contentX, contentY, contentW, contentH)

  -- Border outline
  love.graphics.setColor(BORDER_COLOR)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", c.x, c.y, c.w, c.h)

  if hasScroll then
    love.graphics.pop()
  end
end

-- ============================================================================
-- Drawing: Selected node overlay (brighter/thicker outline)
-- ============================================================================

function drawSelectedOverlay()
  local node = state.selectedNode
  if not node or not node.computed then return end

  local c = node.computed

  -- Apply accumulated scroll offset from all scroll ancestors
  local scrollX, scrollY = getAccumulatedScroll(node)
  local hasScroll = scrollX ~= 0 or scrollY ~= 0
  if hasScroll then
    love.graphics.push()
    love.graphics.translate(-scrollX, -scrollY)
  end

  -- Solid bright outline for selected node
  love.graphics.setColor(TOOLTIP_ACCENT[1], TOOLTIP_ACCENT[2], TOOLTIP_ACCENT[3], 0.8)
  love.graphics.setLineWidth(2)
  love.graphics.rectangle("line", c.x, c.y, c.w, c.h)

  -- Light fill
  love.graphics.setColor(TOOLTIP_ACCENT[1], TOOLTIP_ACCENT[2], TOOLTIP_ACCENT[3], 0.08)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

  if hasScroll then
    love.graphics.pop()
  end
end

-- ============================================================================
-- Drawing: Tooltip
-- ============================================================================

function drawTooltip()
  local node = state.hoveredNode
  if not node or not node.computed then return end

  local s = node.style or {}
  local c = node.computed

  -- Build tooltip lines
  local lines = {}
  local accents = {} -- indices that should use accent color
  local lineColors = {} -- per-line color overrides

  -- Component name (if available)
  if node.debugName then
    lines[#lines + 1] = "<" .. node.debugName .. ">"
    accents[#lines] = true
  end

  -- Node type + id
  local header = (node.type or "?")
  if node.id then header = header .. "  #" .. tostring(node.id) end
  lines[#lines + 1] = header
  if not node.debugName then accents[#lines] = true end

  -- Source location (if available)
  if node.debugSource and node.debugSource.fileName then
    local file = node.debugSource.fileName:match("([^/]+)$") or node.debugSource.fileName
    local loc = file
    if node.debugSource.lineNumber then
      loc = loc .. ":" .. tostring(node.debugSource.lineNumber)
    end
    lines[#lines + 1] = loc
  end

  -- Computed dimensions with provenance
  local wProv = PROV_LABELS[c.wSource or "unknown"] or PROV_LABELS["unknown"]
  local hProv = PROV_LABELS[c.hSource or "unknown"] or PROV_LABELS["unknown"]
  lines[#lines + 1] = string.format("%d x %d", math.floor(c.w), math.floor(c.h))
  -- Show original style value in tooltip when explicit
  local wLabel = wProv[1]
  local hLabel = hProv[1]
  if c.wSource == "explicit" and s.width ~= nil then
    wLabel = fmtVal(s.width)
  end
  if c.hSource == "explicit" and s.height ~= nil then
    hLabel = fmtVal(s.height)
  end
  lines[#lines + 1] = string.format("w:%s  h:%s", wLabel, hLabel)
  -- Use the "worst" provenance color for the summary line (fallback > parent > flex > content > explicit)
  local provPriority = { ["surface-fallback"] = 5, ["scroll-default"] = 5, ["unknown"] = 5,
    ["parent"] = 4, ["root"] = 3, ["flex"] = 2, ["stretch"] = 2, ["aspect-ratio"] = 2,
    ["content"] = 1, ["text"] = 1, ["explicit"] = 0 }
  local wPri = provPriority[c.wSource or "unknown"] or 5
  local hPri = provPriority[c.hSource or "unknown"] or 5
  local worstSource = wPri >= hPri and (c.wSource or "unknown") or (c.hSource or "unknown")
  local worstProv = PROV_LABELS[worstSource] or PROV_LABELS["unknown"]
  lineColors[#lines] = worstProv[3]

  -- Non-default style properties
  local skipProps = { display = true }
  local styleCount = 0
  if s then
    for k, v in pairs(s) do
      if not skipProps[k] and v ~= nil and v ~= "" then
        if styleCount < 8 then  -- limit tooltip size
          lines[#lines + 1] = k .. ": " .. fmtVal(v)
          styleCount = styleCount + 1
        end
      end
    end
    if styleCount >= 8 then
      lines[#lines + 1] = "... +" .. (styleCount - 8) .. " more"
    end
  end

  -- Text content
  if node.props and node.props.text then
    local text = node.props.text
    if #text > 30 then text = text:sub(1, 27) .. "..." end
    lines[#lines + 1] = 'text: "' .. text .. '"'
  end

  -- Measure tooltip size
  local font = getFont()
  local lineH = font:getHeight() + 2
  local pad = 8
  local maxW = 0
  for _, line in ipairs(lines) do
    local w = font:getWidth(line)
    if w > maxW then maxW = w end
  end
  local tooltipW = maxW + pad * 2
  local tooltipH = #lines * lineH + pad * 2

  -- Position: near cursor, flip at screen edges (respect devtools panel)
  local screenW = love.graphics.getWidth()
  local devtools = require("lua.devtools")
  local bottomLimit = devtools.getViewportHeight()
  local tx = state.mouseX + 16
  local ty = state.mouseY + 16

  if tx + tooltipW > screenW - 8 then tx = state.mouseX - tooltipW - 8 end
  if ty + tooltipH > bottomLimit - 8 then ty = state.mouseY - tooltipH - 8 end
  if tx < 4 then tx = 4 end
  if ty < 4 then ty = 4 end

  -- Draw tooltip background
  love.graphics.setColor(TOOLTIP_BG)
  love.graphics.rectangle("fill", tx, ty, tooltipW, tooltipH, 4, 4)
  love.graphics.setColor(TOOLTIP_BORDER)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", tx, ty, tooltipW, tooltipH, 4, 4)

  -- Draw text
  love.graphics.setFont(font)
  local textY = ty + pad
  for i, line in ipairs(lines) do
    if lineColors[i] then
      love.graphics.setColor(lineColors[i])
    elseif accents[i] then
      love.graphics.setColor(TOOLTIP_ACCENT)
    elseif i == 2 then
      love.graphics.setColor(TOOLTIP_DIM)
    else
      love.graphics.setColor(TOOLTIP_TEXT)
    end
    love.graphics.print(line, tx + pad, textY)
    textY = textY + lineH
  end
end

-- ============================================================================
-- Drawing: Tree panel sidebar
-- ============================================================================

function drawTreePanel(root, rx, ry, rw, rh)
  local font = getFont()
  local lineH = font:getHeight() + 6  -- +2px breathing room
  local pad = 8

  -- Reset position cache
  state.treeNodePositions = {}

  -- Background
  love.graphics.setColor(TREE_BG)
  love.graphics.rectangle("fill", rx, ry, rw, rh)

  -- ── View mode toggle bar ──
  local barY = ry + 4
  local barH = TOGGLE_HEIGHT
  local barPad = 8
  local segW = math.floor((rw - barPad * 2) / 3)
  local barX = rx + barPad

  -- Toggle background
  love.graphics.setColor(TOGGLE_BG)
  love.graphics.rectangle("fill", barX, barY, segW * 3, barH, 3, 3)

  -- Draw each segment
  for i, mode in ipairs(VIEW_MODES) do
    local sx = barX + (i - 1) * segW
    local isActive = (state.viewMode == mode)

    if isActive then
      love.graphics.setColor(TOGGLE_ACTIVE)
      love.graphics.rectangle("fill", sx, barY, segW, barH, 3, 3)
    end

    -- Segment border
    love.graphics.setColor(TOGGLE_BORDER)
    love.graphics.rectangle("line", sx, barY, segW, barH, 3, 3)

    -- Label
    love.graphics.setFont(font)
    love.graphics.setColor(isActive and TOGGLE_TEXT_ON or TOGGLE_TEXT_OFF)
    local label = VIEW_MODE_LABELS[mode]
    local lw = font:getWidth(label)
    love.graphics.print(label, sx + math.floor((segW - lw) / 2), barY + math.floor((barH - font:getHeight()) / 2))
  end

  -- Store toggle bar region for click detection
  state.toggleBarRegion = { x = barX, y = barY, w = segW * 3, h = barH, segW = segW }

  -- Offset tree content below toggle bar
  local treeTop = ry + barH + 10
  local treeH = rh - (barH + 10)

  -- Right border
  love.graphics.setColor(TOOLTIP_BORDER)
  love.graphics.rectangle("fill", rx + rw - 1, ry, 1, rh)

  -- Scissor to tree region (below toggle)
  love.graphics.setScissor(rx, treeTop, rw, treeH)
  love.graphics.setFont(font)

  -- Walk tree and draw lines
  local drawY = treeTop - state.treeScrollY
  local endY = drawTreeNode(root, 0, drawY, font, lineH, pad, treeTop, treeTop + treeH, rx, rw)

  -- Store content height for scroll clamping (+ bottom padding so last line isn't clipped)
  state.treeContentH = (endY - drawY) + pad
  local maxTreeScroll = math.max(0, state.treeContentH - treeH)
  if state.treeScrollY > maxTreeScroll then state.treeScrollY = maxTreeScroll end

  -- Auto-scroll to selected node (after positions are cached)
  if state.scrollToSelected and state.selectedNode then
    local found = false
    for _, entry in ipairs(state.treeNodePositions) do
      if entry.node == state.selectedNode then
        found = true
        -- entry.y is the drawn position (includes current scroll offset)
        -- Convert to absolute position in the tree content
        local absY = entry.y + state.treeScrollY - treeTop
        local visibleH = treeH
        if entry.y < treeTop or entry.y + lineH > treeTop + treeH then
          -- Node is outside visible area — scroll to center it
          state.treeScrollY = math.max(0, absY - visibleH / 2)
        end
        break
      end
    end

    if not found then
      -- Node wasn't drawn — likely hidden under a collapsed ancestor.
      -- Uncollapse all ancestors and retry on next frame.
      local ancestor = state.selectedNode.parent
      local uncollapsed = false
      while ancestor do
        if state.collapsed[ancestor.id] then
          state.collapsed[ancestor.id] = nil
          uncollapsed = true
        end
        ancestor = ancestor.parent
      end
      -- Keep scrollToSelected = true so the next frame (with expanded tree) retries
      if uncollapsed then return end
    end

    state.scrollToSelected = false
  end

  drawScrollbar(rx, treeTop, rw, treeH, state.treeScrollY, state.treeContentH)
  love.graphics.setScissor()
end

-- ============================================================================
-- JSX tree view helpers
-- ============================================================================

--- Draw an array of {color, text} segments at position (x, y), returns ending x
local function drawSegments(segs, x, y, font)
  for _, seg in ipairs(segs) do
    love.graphics.setColor(seg[1])
    love.graphics.print(seg[2], x, y)
    x = x + font:getWidth(seg[2])
  end
  return x
end

--- Append a handler count badge to a segments list (e.g. " ⚡3")
local function appendHandlerBadge(segs, node)
  if node.hasHandlers and node.handlerMeta and type(node.handlerMeta) == "table" then
    local count = 0
    for _ in pairs(node.handlerMeta) do count = count + 1 end
    if count > 0 then
      segs[#segs + 1] = { JSX_HANDLER, " \xe2\x9a\xa1" .. count }
    end
  elseif node.hasHandlers then
    segs[#segs + 1] = { JSX_HANDLER, " \xe2\x9a\xa1" }
  end
end

--- Get the display name for a node (component name or primitive name)
local function getTagName(node)
  return node.debugName or TYPE_TO_PRIMITIVE[node.type] or node.type or "?"
end

--- Get the color for a node's tag name
local function getNameColor(node)
  if node.debugName then return JSX_COMP end
  return JSX_PRIM
end

--- Get the dimmed version of a name color (for closing tags)
local function getDimNameColor(node)
  local c = getNameColor(node)
  return { c[1], c[2], c[3], (c[4] or 1) * 0.5 }
end

--- Strip invalid UTF-8 byte sequences so love.graphics.print never crashes
local function sanitizeUTF8(s)
  local result = {}
  local i = 1
  local len = #s
  while i <= len do
    local b = s:byte(i)
    if b < 0x80 then
      result[#result+1] = s:sub(i, i)
      i = i + 1
    elseif b < 0xC0 then
      -- stray continuation byte — skip
      i = i + 1
    elseif b < 0xE0 then
      local b2 = s:byte(i+1)
      if b2 and b2 >= 0x80 and b2 < 0xC0 then
        result[#result+1] = s:sub(i, i+1); i = i + 2
      else i = i + 1 end
    elseif b < 0xF0 then
      local b2, b3 = s:byte(i+1), s:byte(i+2)
      if b2 and b2 >= 0x80 and b2 < 0xC0 and b3 and b3 >= 0x80 and b3 < 0xC0 then
        result[#result+1] = s:sub(i, i+2); i = i + 3
      else i = i + 1 end
    elseif b < 0xF8 then
      local b2, b3, b4 = s:byte(i+1), s:byte(i+2), s:byte(i+3)
      if b2 and b2 >= 0x80 and b2 < 0xC0 and b3 and b3 >= 0x80 and b3 < 0xC0
         and b4 and b4 >= 0x80 and b4 < 0xC0 then
        result[#result+1] = s:sub(i, i+3); i = i + 4
      else i = i + 1 end
    else
      i = i + 1
    end
  end
  return table.concat(result)
end

--- Get text content from a __TEXT__ node, truncated to ~40 chars
local function getTextContent(node)
  local text = node.text or (node.props and node.props.text) or ""
  text = tostring(text)
  if #text > 40 then
    -- Walk back to a valid UTF-8 boundary before appending "..."
    local i = 37
    while i > 0 do
      local b = text:byte(i) or 0
      if b < 0x80 or b >= 0xC0 then break end  -- ASCII or lead byte
      i = i - 1
    end
    text = text:sub(1, i) .. "..."
  end
  return sanitizeUTF8(text)
end

--- Append inline prop segments to a segments array (max 3 props)
local function appendPropSegments(segs, node)
  local s = node.style or {}
  local p = node.props or {}
  local count = 0

  local function addProp(key, val)
    if count >= 3 then return end
    segs[#segs + 1] = { JSX_BRACKET, " " }
    segs[#segs + 1] = { JSX_PROP_KEY, key .. "=" }
    segs[#segs + 1] = { JSX_PROP_VAL, val }
    count = count + 1
  end

  if p.key then addProp("key", fmtVal(p.key)) end
  if s.flexDirection == "row" then addProp("flex", '"row"') end
  if s.width and s.height then
    addProp("size", fmtVal(s.width) .. "x" .. fmtVal(s.height))
  elseif s.width then
    addProp("w", fmtVal(s.width))
  elseif s.height then
    addProp("h", fmtVal(s.height))
  end
  if p.src then
    local src = tostring(p.src)
    if #src > 20 then src = "..." .. src:sub(-17) end
    addProp("src", '"' .. src .. '"')
  end
  if p.placeholder then addProp("placeholder", fmtVal(p.placeholder)) end
end

--- Check if a __TEXT__ node has empty content (hidden by default)
local function isEmptyTextNode(node)
  if node.type ~= "__TEXT__" then return false end
  local text = node.text or ""
  return text == ""
end

-- ============================================================================
-- Column-layout tree helpers
-- ============================================================================

--- Truncate a string to fit within maxW pixels, appending "..." if needed.
local function truncateToWidth(font, str, maxW)
  if font:getWidth(str) <= maxW then return str end
  local ellipsis = "..."
  local ellW = font:getWidth(ellipsis)
  if maxW <= ellW then return ellipsis end
  for i = #str, 1, -1 do
    local prefix = str:sub(1, i)
    if font:getWidth(prefix) + ellW <= maxW then
      return prefix .. ellipsis
    end
  end
  return ellipsis
end

--- Build a JSX-style preview string: <TagName prop=val prop=val>
local function buildJsxPreview(node, isSingleTextChild)
  local tagName = getTagName(node)
  local s = node.style or {}
  local p = node.props or {}
  local parts = { "<" .. tagName }
  local count = 0

  local function addProp(key, val)
    if count >= 3 then return end
    parts[#parts + 1] = " " .. key .. "=" .. val
    count = count + 1
  end

  if p.key then addProp("key", fmtVal(p.key)) end
  if s.flexGrow and s.flexGrow > 0 then addProp("flexGrow", fmtVal(s.flexGrow)) end
  if s.flexDirection == "row" then addProp("flex", '"row"') end
  if s.width then addProp("w", fmtVal(s.width)) end
  if s.height then addProp("h", fmtVal(s.height)) end
  if p.src then
    local src = tostring(p.src)
    if #src > 20 then src = ".." .. src:sub(-18) end
    addProp("src", '"' .. src .. '"')
  end
  if count < 3 and p.placeholder then addProp("placeholder", fmtVal(p.placeholder)) end

  local hasChildren = node.children and #node.children > 0
  if hasChildren and not isSingleTextChild then
    parts[#parts + 1] = ">"
  else
    parts[#parts + 1] = " />"
  end
  return table.concat(parts)
end

-- ============================================================================
-- Recursive tree node drawing — column layout with typography tiers
-- Returns the next Y position
-- ============================================================================

function drawTreeNode(node, depth, y, font, lineH, pad, clipTop, clipBottom, rx, rw)
  if not node then return y end

  -- Skip empty text nodes (React sometimes inserts these)
  if isEmptyTextNode(node) then return y end

  local typeName = node.type or "?"
  local isTextNode = (typeName == "__TEXT__")
  local children = node.children or {}
  local hasChildren = #children > 0
  local isCollapsed = state.collapsed[node.id]
  local tagName = getTagName(node)
  local isLeaf = not hasChildren

  -- Single __TEXT__ child → inline text after identity
  local isSingleTextChild = (not isTextNode and hasChildren
    and #children == 1 and children[1].type == "__TEXT__"
    and (children[1].text or "") ~= "")

  local visible = y + lineH > clipTop and y < clipBottom
  local openingY = y
  local caretW = font:getWidth("v")  -- caret width, used for guide alignment

  -- Cache position for click/hover detection
  state.treeNodePositions[#state.treeNodePositions + 1] = {
    node = node, y = y, lineH = lineH, depth = depth,
  }

  if visible then
    local isSelected = (node == state.selectedNode)
    local isHovered = (node == state.hoveredNode)

    -- Row background
    if isSelected then
      love.graphics.setColor(TREE_SELECT)
      love.graphics.rectangle("fill", rx, y, rw, lineH)
      -- 2px left accent bar
      love.graphics.setColor(COL_SELECT_BAR)
      love.graphics.rectangle("fill", rx, y, 2, lineH)
    elseif isHovered then
      love.graphics.setColor(TREE_HOVER)
      love.graphics.rectangle("fill", rx, y, rw, lineH)
    end

    love.graphics.setFont(font)
    local indent = rx + pad + depth * INDENT_SIZE
    local textY = y + 2

    -- ── Column 1: Caret ──
    love.graphics.setColor(COL_CARET)
    if isTextNode or isLeaf or isSingleTextChild then
      love.graphics.print("-", indent, textY)
    elseif isCollapsed then
      love.graphics.print(">", indent, textY)
    else
      love.graphics.print("v", indent, textY)
    end

    local x = indent + caretW + 5
    local mode = state.viewMode

    if isTextNode then
      -- ── Text node: TXT "content" (same in all modes) ──
      love.graphics.setColor(COL_TYPE)
      love.graphics.print("TXT", x, textY)
      x = x + font:getWidth("TXT") + 6

      local text = getTextContent(node)
      love.graphics.setColor(COL_TEXT_VAL)
      love.graphics.print('"' .. text .. '"', x, textY)

    elseif mode == "lua" then
      -- ══ Lua mode: Type primary, identity secondary, layout metadata prominent ══

      -- Type (primary — bright)
      love.graphics.setColor(COL_IDENTITY)
      love.graphics.print(typeName, x, textY)
      x = x + font:getWidth(typeName) + 6

      -- Identity (secondary — muted, only if named)
      if node.debugName then
        love.graphics.setColor(COL_METADATA)
        love.graphics.print(tagName, x, textY)
        x = x + font:getWidth(tagName)
      end

      -- Inline text
      if isSingleTextChild then
        local text = getTextContent(children[1])
        love.graphics.setColor(COL_TEXT_VAL)
        local str = '  "' .. text .. '"'
        love.graphics.print(str, x, textY)
        x = x + font:getWidth(str)
      end

      -- Layout metadata (prominent — brighter than normal metadata)
      local meta = {}
      local s = node.style or {}
      if node.computed then
        meta[#meta + 1] = math.floor(node.computed.w) .. "x" .. math.floor(node.computed.h)
      end
      if s.flexGrow and s.flexGrow > 0 then meta[#meta + 1] = "grow=" .. s.flexGrow end
      if s.flexDirection == "row" then meta[#meta + 1] = "row" end
      if node.computed and node.computed.wSource then
        meta[#meta + 1] = "w:" .. node.computed.wSource
      end
      if node.computed and node.computed.hSource then
        meta[#meta + 1] = "h:" .. node.computed.hSource
      end
      if s.overflow then meta[#meta + 1] = "overflow:" .. s.overflow end
      if #meta > 0 then
        love.graphics.setColor(COL_TYPE)
        local metaStr = "  " .. table.concat(meta, "  ")
        love.graphics.print(metaStr, x, textY)
        x = x + font:getWidth(metaStr)
      end

      -- Collapsed
      if isCollapsed and hasChildren and not isSingleTextChild then
        love.graphics.setColor(COL_METADATA)
        love.graphics.print("  ...", x, textY)
        x = x + font:getWidth("  ...")
      end

      -- Node ID right-aligned
      if node.id then
        local idStr = "#" .. node.id
        love.graphics.setColor(COL_METADATA)
        love.graphics.print(idStr, rx + rw - pad - font:getWidth(idStr), textY)
      end

    elseif mode == "react" then
      -- ══ React mode: JSX-style display, no Lua internals ══

      -- Opening bracket + tag name (primary)
      love.graphics.setColor(COL_JSX_DIM)
      love.graphics.print("<", x, textY)
      x = x + font:getWidth("<")

      if node.debugName then
        love.graphics.setColor(COL_COMP)
      else
        love.graphics.setColor(COL_IDENTITY)
      end
      love.graphics.print(tagName, x, textY)
      x = x + font:getWidth(tagName)

      -- Inline text
      if isSingleTextChild then
        love.graphics.setColor(COL_JSX_DIM)
        love.graphics.print(">", x, textY)
        x = x + font:getWidth(">")
        local text = getTextContent(children[1])
        love.graphics.setColor(COL_TEXT_VAL)
        love.graphics.print(text, x, textY)
        x = x + font:getWidth(text)
        love.graphics.setColor(COL_JSX_DIM)
        local closeStr = "</" .. tagName .. ">"
        love.graphics.print(closeStr, x, textY)
        x = x + font:getWidth(closeStr)
      else
        -- Props inline
        local s = node.style or {}
        local p = node.props or {}
        local propCount = 0
        local function drawProp(key, val)
          if propCount >= 3 then return end
          love.graphics.setColor(COL_JSX_DIM)
          love.graphics.print(" ", x, textY)
          x = x + font:getWidth(" ")
          love.graphics.setColor(JSX_PROP_KEY)
          love.graphics.print(key, x, textY)
          x = x + font:getWidth(key)
          love.graphics.setColor(COL_JSX_DIM)
          love.graphics.print("=", x, textY)
          x = x + font:getWidth("=")
          love.graphics.setColor(JSX_PROP_VAL)
          love.graphics.print(val, x, textY)
          x = x + font:getWidth(val)
          propCount = propCount + 1
        end

        if p.key then drawProp("key", fmtVal(p.key)) end
        if s.flexGrow and s.flexGrow > 0 then drawProp("flexGrow", fmtVal(s.flexGrow)) end
        if s.flexDirection == "row" then drawProp("flexDirection", '"row"') end
        if s.width then drawProp("width", fmtVal(s.width)) end
        if s.height then drawProp("height", fmtVal(s.height)) end
        if propCount < 3 and p.src then drawProp("src", fmtVal(p.src)) end

        -- Closing
        love.graphics.setColor(COL_JSX_DIM)
        if isLeaf then
          love.graphics.print(" />", x, textY)
        elseif isCollapsed then
          love.graphics.print(">", x, textY)
          x = x + font:getWidth(">")
          love.graphics.setColor(COL_METADATA)
          love.graphics.print("...", x, textY)
        else
          love.graphics.print(">", x, textY)
        end
      end

      -- Handler badge
      if node.hasHandlers then
        local badgeStr = " @"
        if node.handlerMeta and type(node.handlerMeta) == "table" then
          local count = 0
          for _ in pairs(node.handlerMeta) do count = count + 1 end
          if count > 0 then badgeStr = " @" .. count end
        end
        love.graphics.setColor(JSX_HANDLER)
        love.graphics.print(badgeStr, x, textY)
      end

    else
      -- ══ Hybrid mode (default): type muted, identity bright, JSX right-aligned ══

      -- Type badge (muted)
      love.graphics.setColor(COL_TYPE)
      love.graphics.print(typeName, x, textY)
      x = x + font:getWidth(typeName) + 6

      -- Identity (bright)
      if node.debugName then
        love.graphics.setColor(COL_COMP)
      else
        love.graphics.setColor(COL_IDENTITY)
      end
      love.graphics.print(tagName, x, textY)
      x = x + font:getWidth(tagName)

      -- Inline text
      if isSingleTextChild then
        local text = getTextContent(children[1])
        love.graphics.setColor(COL_TEXT_VAL)
        local str = '  "' .. text .. '"'
        love.graphics.print(str, x, textY)
        x = x + font:getWidth(str)
      end

      -- Metadata (muted)
      local meta = {}
      local s = node.style or {}
      if s.flexGrow and s.flexGrow > 0 then meta[#meta + 1] = "grow=" .. s.flexGrow end
      if s.flexDirection == "row" then meta[#meta + 1] = "row" end
      if node.computed then
        meta[#meta + 1] = math.floor(node.computed.w) .. "x" .. math.floor(node.computed.h)
      end
      if #meta > 0 then
        love.graphics.setColor(COL_METADATA)
        local metaStr = "  " .. table.concat(meta, "  ")
        love.graphics.print(metaStr, x, textY)
        x = x + font:getWidth(metaStr)
      end

      -- Collapsed
      if isCollapsed and hasChildren and not isSingleTextChild then
        love.graphics.setColor(COL_METADATA)
        love.graphics.print("  ...", x, textY)
        x = x + font:getWidth("  ...")
      end

      -- Handler badge
      if node.hasHandlers then
        local badgeStr = " @"
        if node.handlerMeta and type(node.handlerMeta) == "table" then
          local count = 0
          for _ in pairs(node.handlerMeta) do count = count + 1 end
          if count > 0 then badgeStr = " @" .. count end
        end
        love.graphics.setColor(JSX_HANDLER)
        love.graphics.print(badgeStr, x, textY)
        x = x + font:getWidth(badgeStr)
      end

      -- JSX preview (right-aligned, dim)
      local jsxStr = buildJsxPreview(node, isSingleTextChild)
      if jsxStr and #jsxStr > 0 then
        local rightEdge = rx + rw - pad
        local maxJsxW = rightEdge - x - 12
        if maxJsxW > 40 then
          love.graphics.setColor(COL_JSX_DIM)
          local jsxW = font:getWidth(jsxStr)
          if jsxW > maxJsxW then
            jsxStr = truncateToWidth(font, jsxStr, maxJsxW)
            jsxW = font:getWidth(jsxStr)
          end
          love.graphics.print(jsxStr, rightEdge - jsxW, textY)
        end
      end
    end

    -- ── Classification badge (all modes, right-aligned) ──
    if not isTextNode then
      local kind = classifyNode(node)
      local cls = CLASS_LABELS[kind]
      if cls and kind ~= "static" then
        -- Only show badge for non-static nodes (static is the baseline)
        local badge = cls[1]
        local badgeColor = cls[2]
        local rightEdge = rx + rw - pad
        local badgeW = font:getWidth(badge) + 6
        local badgeX = rightEdge - badgeW
        -- Background pill
        love.graphics.setColor(badgeColor[1], badgeColor[2], badgeColor[3], 0.15)
        love.graphics.rectangle("fill", badgeX, y + 2, badgeW, lineH - 4, 3, 3)
        -- Letter
        love.graphics.setColor(badgeColor)
        love.graphics.print(badge, badgeX + 3, textY)
      end
    end
  end

  y = y + lineH

  -- Draw children and closing tag (if expanded with multiple children)
  if hasChildren and not isCollapsed and not isSingleTextChild then
    for _, child in ipairs(children) do
      y = drawTreeNode(child, depth + 1, y, font, lineH, pad, clipTop, clipBottom, rx, rw)
    end

    -- Indent guide line from opening to closing tag
    local guideX = rx + pad + depth * INDENT_SIZE + math.floor(caretW / 2)
    if openingY + lineH < clipBottom and y > clipTop then
      love.graphics.setColor(COL_CARET)
      love.graphics.setLineWidth(1)
      local gy1 = math.max(openingY + lineH, clipTop)
      local gy2 = math.min(y, clipBottom)
      love.graphics.line(guideX, gy1, guideX, gy2)
    end

    -- Cache closing tag position for click/hover
    state.treeNodePositions[#state.treeNodePositions + 1] = {
      node = node, y = y, lineH = lineH, depth = depth, isClosingTag = true,
    }

    -- Closing tag (minimal, dim)
    local closingVisible = y + lineH > clipTop and y < clipBottom
    if closingVisible then
      if node == state.selectedNode then
        love.graphics.setColor(TREE_SELECT)
        love.graphics.rectangle("fill", rx, y, rw, lineH)
        love.graphics.setColor(COL_SELECT_BAR)
        love.graphics.rectangle("fill", rx, y, 2, lineH)
      elseif node == state.hoveredNode then
        love.graphics.setColor(TREE_HOVER)
        love.graphics.rectangle("fill", rx, y, rw, lineH)
      end

      local indent = rx + pad + depth * INDENT_SIZE
      local cx = indent + caretW + 5
      if state.viewMode == "lua" then
        -- Lua mode: minimal closing marker
        love.graphics.setColor(COL_CARET)
        love.graphics.print("/" .. typeName, cx, y + 2)
      elseif state.viewMode == "react" then
        -- React mode: JSX closing tag
        love.graphics.setColor(COL_JSX_DIM)
        love.graphics.print("</", cx, y + 2)
        cx = cx + font:getWidth("</")
        love.graphics.setColor(node.debugName and { COL_COMP[1], COL_COMP[2], COL_COMP[3], 0.5 } or { COL_IDENTITY[1], COL_IDENTITY[2], COL_IDENTITY[3], 0.5 })
        love.graphics.print(tagName, cx, y + 2)
        cx = cx + font:getWidth(tagName)
        love.graphics.setColor(COL_JSX_DIM)
        love.graphics.print(">", cx, y + 2)
      else
        -- Hybrid mode: dim closing tag
        love.graphics.setColor(COL_JSX_DIM)
        love.graphics.print("</" .. tagName .. ">", cx, y + 2)
      end
    end

    y = y + lineH
  end

  return y
end

-- ============================================================================
-- Inline style editing
-- ============================================================================

--- Parse a text value into the appropriate Lua type
local function parseStyleValue(text)
  if text == "" or text == "nil" then return nil end
  if text == "true" then return true end
  if text == "false" then return false end
  local num = tonumber(text)
  if num then return num end
  -- Keep as string (percentages, colors, etc.)
  return text
end

--- Start editing a property from a detailPropPositions entry
startEditing = function(entry, idx)
  local valStr
  if entry.value == nil then
    valStr = ""
  elseif type(entry.value) == "number" then
    if entry.value == math.floor(entry.value) then
      valStr = tostring(math.floor(entry.value))
    else
      valStr = string.format("%.2f", entry.value)
    end
  else
    valStr = tostring(entry.value)
  end
  state.editState = {
    node = state.selectedNode,
    section = entry.section,
    prop = entry.prop,
    propIndex = idx or 0,
    text = valStr,
    cursor = #valStr,
    originalValue = entry.value,
    liveApplied = false,
  }
end

--- Commit the current edit (apply value and exit edit mode)
commitEdit = function()
  if not state.editState then return end
  local es = state.editState

  -- Add-prop mode: two-phase commit
  if es.section == "addProp" and state.addPropState then
    local aps = state.addPropState
    if aps.phase == "key" then
      -- Phase 1 complete: got prop name, move to phase 2 (value)
      local propName = es.text:match("^%s*(.-)%s*$")  -- trim
      if propName and #propName > 0 then
        aps.phase = "value"
        aps.propName = propName
        aps.text = ""
        aps.cursor = 0
        -- Reset editState for phase 2
        state.editState = {
          node = es.node,
          section = "addProp",
          prop = propName,
          propIndex = 0,
          text = "",
          cursor = 0,
          originalValue = nil,
          liveApplied = false,
        }
        return  -- don't clear editState yet
      else
        -- Empty name: cancel
        state.addPropState = nil
        state.editState = nil
        return
      end
    elseif aps.phase == "value" then
      -- Phase 2 complete: apply the new property
      local value = parseStyleValue(es.text)
      if es.node and es.node.style then
        es.node.style[aps.propName] = value
      end
      if markDirtyCallback then markDirtyCallback() end
      state.addPropState = nil
      state.editState = nil
      return
    end
  end

  local value = parseStyleValue(es.text)
  if es.section == "style" and es.node and es.node.style then
    es.node.style[es.prop] = value
  end
  if markDirtyCallback then markDirtyCallback() end
  state.editState = nil
end

--- Cancel the current edit (restore original value if live-applied)
cancelEdit = function()
  if not state.editState then return end
  local es = state.editState
  if es.liveApplied and es.node and es.node.style then
    es.node.style[es.prop] = es.originalValue
    if markDirtyCallback then markDirtyCallback() end
  end
  state.addPropState = nil
  state.editState = nil
end

--- Apply edit value live (for arrow key increment/decrement)
local function applyEditLive()
  if not state.editState then return end
  local es = state.editState
  local value = parseStyleValue(es.text)
  if es.section == "style" and es.node and es.node.style then
    es.node.style[es.prop] = value
    es.liveApplied = true
  end
  if markDirtyCallback then markDirtyCallback() end
end

--- Handle a keypress while in edit mode. Returns true if consumed.
handleEditKey = function(key)
  local es = state.editState
  if not es then return false end

  if key == "return" or key == "kpenter" then
    commitEdit()
    return true

  elseif key == "escape" then
    cancelEdit()
    return true

  elseif key == "backspace" then
    if es.cursor > 0 then
      es.text = es.text:sub(1, es.cursor - 1) .. es.text:sub(es.cursor + 1)
      es.cursor = es.cursor - 1
    end
    return true

  elseif key == "delete" then
    if es.cursor < #es.text then
      es.text = es.text:sub(1, es.cursor) .. es.text:sub(es.cursor + 2)
    end
    return true

  elseif key == "left" then
    es.cursor = math.max(0, es.cursor - 1)
    return true

  elseif key == "right" then
    es.cursor = math.min(#es.text, es.cursor + 1)
    return true

  elseif key == "home" then
    es.cursor = 0
    return true

  elseif key == "end" then
    es.cursor = #es.text
    return true

  elseif key == "up" then
    local num = tonumber(es.text)
    if num then
      local step = love.keyboard.isDown("lshift", "rshift") and 10 or 1
      num = num + step
      if num == math.floor(num) then
        es.text = tostring(math.floor(num))
      else
        es.text = string.format("%.2f", num)
      end
      es.cursor = #es.text
      applyEditLive()
    end
    return true

  elseif key == "down" then
    local num = tonumber(es.text)
    if num then
      local step = love.keyboard.isDown("lshift", "rshift") and 10 or 1
      num = num - step
      if num == math.floor(num) then
        es.text = tostring(math.floor(num))
      else
        es.text = string.format("%.2f", num)
      end
      es.cursor = #es.text
      applyEditLive()
    end
    return true

  elseif key == "tab" then
    local prevIndex = es.propIndex
    commitEdit()
    -- Navigate to next/prev property
    local shift = love.keyboard.isDown("lshift", "rshift")
    local nextIdx = shift and (prevIndex - 1) or (prevIndex + 1)
    if nextIdx >= 1 and nextIdx <= #state.detailPropPositions then
      startEditing(state.detailPropPositions[nextIdx], nextIdx)
    end
    return true
  end

  return false
end

--- Handle text input while in edit mode. Returns true if consumed.
handleEditTextInput = function(text)
  local es = state.editState
  if not es then return false end
  es.text = es.text:sub(1, es.cursor) .. text .. es.text:sub(es.cursor + 1)
  es.cursor = es.cursor + #text
  return true
end

--- Draw the inline text editor at the given position
local function drawInlineEditor(ex, ey, maxW, lineH, font)
  local es = state.editState
  if not es then return end

  -- Editor background
  local textW = math.max(font:getWidth(es.text) + 12, 60)
  local edW = math.min(textW, maxW)
  love.graphics.setColor(EDIT_BG)
  love.graphics.rectangle("fill", ex - 2, ey - 1, edW, lineH + 1, 2, 2)
  love.graphics.setColor(EDIT_BORDER)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", ex - 2, ey - 1, edW, lineH + 1, 2, 2)

  -- Text
  love.graphics.setColor(EDIT_TEXT)
  love.graphics.print(es.text, ex + 1, ey)

  -- Blinking cursor (blink every 0.5s)
  local blink = (love.timer.getTime() % 1.0) < 0.6
  if blink then
    local cursorX = ex + 1 + font:getWidth(es.text:sub(1, es.cursor))
    love.graphics.setColor(EDIT_CURSOR)
    love.graphics.rectangle("fill", cursorX, ey + 1, 1, lineH - 2)
  end
end

-- ============================================================================
-- Drawing: Detail panel (right side, shows full props/style of selected node)
-- ============================================================================

function drawDetailPanel(rx, ry, rw, rh)
  local node = state.selectedNode
  if not node then return end

  -- Cancel edit if the selected node changed
  if state.editState and state.editState.node ~= node then
    state.editState = nil
    state.addPropState = nil
  end

  local font = getFont()
  local lineH = font:getHeight() + 2
  local pad = 10

  -- Reset position caches
  state.detailPropPositions = {}
  state.detailParentPosition = nil
  state.detailChildPositions = {}

  -- Background
  love.graphics.setColor(DETAIL_BG)
  love.graphics.rectangle("fill", rx, ry, rw, rh)

  -- Left border
  love.graphics.setColor(TOOLTIP_BORDER)
  love.graphics.rectangle("fill", rx, ry, 1, rh)

  -- Scissor to region
  love.graphics.setScissor(rx, ry, rw, rh)
  love.graphics.setFont(font)

  local x = rx + pad
  local y = ry + pad - state.detailScrollY
  local contentW = rw - pad * 2

  -- Header with component name
  local header
  if node.debugName then
    header = "<" .. node.debugName .. ">"
  else
    header = node.type or "?"
  end
  header = header .. "  #" .. tostring(node.id or "?")
  love.graphics.setColor(TOOLTIP_ACCENT)
  love.graphics.print(header, x, y)
  y = y + lineH

  -- Source location (if available)
  if node.debugSource then
    love.graphics.setColor(TREE_DIM)
    if node.debugSource.fileName then
      local file = node.debugSource.fileName
      local shortFile = file:match("([^/]+)$") or file
      local loc = shortFile
      if node.debugSource.lineNumber then
        loc = loc .. ":" .. tostring(node.debugSource.lineNumber)
      end
      love.graphics.print(loc, x, y)
      y = y + lineH
    end
  end

  -- Parent link (clickable)
  if node.parent then
    local parentName = node.parent.debugName and ("<" .. node.parent.debugName .. ">") or (node.parent.type or "?")
    local parentLabel = "\xe2\x86\x91 " .. parentName  -- ↑ parent
    local parentPC = node.parent.computed
    if parentPC then
      parentLabel = parentLabel .. string.format("  %dx%d", math.floor(parentPC.w), math.floor(parentPC.h))
    end
    -- Hover highlight
    local isParentHovered = state.mouseX >= x and state.mouseY >= y
      and state.mouseY < y + lineH and state.mouseX < rx + rw - pad
      and y + lineH > ry and y < ry + rh
    love.graphics.setColor(isParentHovered and TOOLTIP_ACCENT or TREE_DIM)
    love.graphics.print(parentLabel, x, y)
    state.detailParentPosition = { node = node.parent, y = y, h = lineH }
    y = y + lineH
  end
  y = y + 6

  -- ── Box model diagram ──
  local c = node.computed
  local s = node.style or {}
  if c then
    local mt, mr, mb, ml = getMargins(s)
    local pt, pr, pb, pl = getPadding(s)
    local boxW = math.min(contentW, 220)
    local boxH = 100
    local boxX = x + math.floor((contentW - boxW) / 2)
    local boxY = y

    -- Margin layer (outermost)
    love.graphics.setColor(0.96, 0.62, 0.04, 0.12)
    love.graphics.rectangle("fill", boxX, boxY, boxW, boxH, 3, 3)
    love.graphics.setColor(0.96, 0.62, 0.04, 0.3)
    love.graphics.setLineWidth(1)
    love.graphics.rectangle("line", boxX, boxY, boxW, boxH, 3, 3)

    -- Padding layer
    local padX = boxX + 24
    local padY = boxY + 18
    local padW = boxW - 48
    local padH = boxH - 36
    love.graphics.setColor(0.13, 0.77, 0.37, 0.12)
    love.graphics.rectangle("fill", padX, padY, padW, padH, 2, 2)
    love.graphics.setColor(0.13, 0.77, 0.37, 0.3)
    love.graphics.rectangle("line", padX, padY, padW, padH, 2, 2)

    -- Content layer (innermost)
    local cntX = padX + 18
    local cntY = padY + 14
    local cntW = padW - 36
    local cntH = padH - 28
    love.graphics.setColor(0.24, 0.52, 0.97, 0.15)
    love.graphics.rectangle("fill", cntX, cntY, cntW, cntH, 2, 2)
    love.graphics.setColor(0.24, 0.52, 0.97, 0.3)
    love.graphics.rectangle("line", cntX, cntY, cntW, cntH, 2, 2)

    -- Content dimensions
    love.graphics.setColor(TOOLTIP_TEXT)
    local dimStr = math.floor(c.w) .. " x " .. math.floor(c.h)
    local dimW = font:getWidth(dimStr)
    love.graphics.print(dimStr, cntX + math.floor((cntW - dimW) / 2), cntY + math.floor((cntH - lineH) / 2))

    -- Margin values (top, right, bottom, left)
    love.graphics.setColor(0.96, 0.62, 0.04, 0.8)
    local mtStr = tostring(mt)
    love.graphics.print(mtStr, boxX + math.floor((boxW - font:getWidth(mtStr)) / 2), boxY + 2)
    love.graphics.print(tostring(mb), boxX + math.floor((boxW - font:getWidth(tostring(mb))) / 2), boxY + boxH - lineH - 1)
    love.graphics.print(tostring(ml), boxX + 3, boxY + math.floor((boxH - lineH) / 2))
    love.graphics.print(tostring(mr), boxX + boxW - font:getWidth(tostring(mr)) - 3, boxY + math.floor((boxH - lineH) / 2))

    -- Padding values
    love.graphics.setColor(0.13, 0.77, 0.37, 0.8)
    local ptStr = tostring(pt)
    love.graphics.print(ptStr, padX + math.floor((padW - font:getWidth(ptStr)) / 2), padY + 1)
    love.graphics.print(tostring(pb), padX + math.floor((padW - font:getWidth(tostring(pb))) / 2), padY + padH - lineH)
    love.graphics.print(tostring(pl), padX + 2, padY + math.floor((padH - lineH) / 2))
    love.graphics.print(tostring(pr), padX + padW - font:getWidth(tostring(pr)) - 2, padY + math.floor((padH - lineH) / 2))

    -- Labels
    love.graphics.setColor(SECTION_COL)
    love.graphics.print("margin", boxX + 2, boxY - lineH + 2)
    love.graphics.print("padding", padX + 2, padY - lineH + 3)

    y = boxY + boxH + 6
  end

  -- Separator
  love.graphics.setColor(TOOLTIP_BORDER)
  love.graphics.rectangle("fill", rx + 4, y, rw - 8, 1)
  y = y + 6

  -- ── Sizing provenance (the key debugging info) ──
  if c then
    love.graphics.setColor(SECTION_COL)
    love.graphics.print("sizing", x, y)
    y = y + lineH

    -- Position
    love.graphics.setColor(TREE_DIM)
    love.graphics.print(string.format("x: %d   y: %d", math.floor(c.x), math.floor(c.y)), x, y)
    y = y + lineH + 2

    -- Helper: draw a single axis math chain
    local function drawAxisChain(axis, val, source, detail, style)
      local prov = PROV_LABELS[source or "unknown"] or PROV_LABELS["unknown"]
      -- Primary line: "w: 51  PARENT WIDTH"
      love.graphics.setColor(TOOLTIP_TEXT)
      local prefix = string.format("%s: %d  ", axis, math.floor(val))
      love.graphics.print(prefix, x, y)
      love.graphics.setColor(prov[3])
      love.graphics.print(prov[1], x + font:getWidth(prefix), y)
      y = y + lineH

      -- Math chain lines (indented)
      local indent = x + 12
      local d = detail or {}

      if source == "explicit" then
        love.graphics.setColor(TREE_DIM)
        local sv = d.styleValue or (axis == "w" and style.width or style.height)
        love.graphics.print("style." .. (axis == "w" and "width" or "height") .. " = " .. fmtVal(sv), indent, y)
        y = y + lineH

      elseif source == "parent" then
        -- Show the full derivation: parent outer → padding → inner (= this width)
        local parentOuter = node.parent and node.parent.computed and node.parent.computed.w
        local pL = d.padL or 0
        local pR = d.padR or 0
        local pw_inner = d.parentW

        if parentOuter and pw_inner then
          love.graphics.setColor(TREE_DIM)
          love.graphics.print(string.format("parent outer: %d", math.floor(parentOuter)), indent, y)
          y = y + lineH
          if pL > 0 or pR > 0 then
            love.graphics.print(string.format("  - pad %dL %dR = inner %d", pL, pR, math.floor(pw_inner)), indent, y)
          else
            love.graphics.print(string.format("  = inner %d (no padding)", math.floor(pw_inner)), indent, y)
          end
          y = y + lineH
          -- If the value doesn't match inner, siblings/shrink are involved
          if math.abs(val - pw_inner) > 0.5 then
            -- Try to find flex info from parent
            local pfi = node.parent and node.parent.computed and node.parent.computed.flexInfo
            if pfi then
              for _, fl in ipairs(pfi.lines or {}) do
                for _, item in ipairs(fl.items or {}) do
                  if item.id == node.id then
                    love.graphics.setColor(PROV_FLEX)
                    if item.shrink and item.shrink > 0 and item.delta < 0 then
                      love.graphics.print(string.format("  shrink: %d (overflow, shrink=%s)", math.floor(item.delta), fmtVal(item.shrink)), indent, y)
                    elseif item.grow and item.grow > 0 and item.delta > 0 then
                      love.graphics.print(string.format("  grow: +%d (grow=%s)", math.floor(item.delta), fmtVal(item.grow)), indent, y)
                    else
                      love.graphics.print(string.format("  adjusted: %d by flex", math.floor(item.delta)), indent, y)
                    end
                    y = y + lineH
                    break
                  end
                end
              end
            end
            love.graphics.setColor(TOOLTIP_ACCENT)
            love.graphics.print(string.format("  = %d", math.floor(val)), indent, y)
            y = y + lineH
          end
        else
          love.graphics.setColor(TREE_DIM)
          love.graphics.print("parent w = " .. (pw_inner and math.floor(pw_inner) or "?"), indent, y)
          y = y + lineH
        end

      elseif source == "flex" then
        love.graphics.setColor(TREE_DIM)
        if d.origBasis then
          love.graphics.print(string.format("basis: %d", math.floor(d.origBasis)), indent, y)
          y = y + lineH
        end
        if d.freeSpace then
          local freeLabel = d.freeSpace >= 0 and "free" or "overflow"
          love.graphics.print(string.format("%s: %d in container %d", freeLabel, math.floor(d.freeSpace), math.floor(d.parentMainSize or 0)), indent, y)
          y = y + lineH
        end
        if d.grow and d.grow > 0 and d.totalGrow and d.totalGrow > 0 then
          love.graphics.setColor(PROV_FLEX)
          love.graphics.print(string.format("grow: %s/%s x %d = +%d",
            fmtVal(d.grow), fmtVal(d.totalGrow), math.floor(d.freeSpace or 0), math.floor(d.delta or 0)), indent, y)
          y = y + lineH
        elseif d.shrink and d.delta and d.delta < 0 then
          love.graphics.setColor(PROV_PARENT)
          love.graphics.print(string.format("shrink: %s x %d = %d",
            fmtVal(d.shrink), math.floor(-(d.freeSpace or 0)), math.floor(d.delta)), indent, y)
          y = y + lineH
        end
        if d.gap and d.gap > 0 then
          love.graphics.setColor(TREE_DIM)
          love.graphics.print(string.format("gap: %d (%d siblings)", math.floor(d.gap), d.siblingCount or 0), indent, y)
          y = y + lineH
        end
        love.graphics.setColor(TOOLTIP_ACCENT)
        love.graphics.print(string.format("= %d", math.floor(val)), indent, y)
        y = y + lineH

      elseif source == "stretch" then
        love.graphics.setColor(TREE_DIM)
        local parentCross = d.parentW or d.parentH
        if parentCross then
          love.graphics.print(string.format("parent cross: %d", math.floor(parentCross)), indent, y)
        else
          love.graphics.print("parent cross-axis stretch", indent, y)
        end
        y = y + lineH

      elseif source == "content" then
        love.graphics.setColor(TREE_DIM)
        local nc = d.childCount or (node.children and #node.children or 0)
        love.graphics.print(string.format("auto from %d children", nc), indent, y)
        y = y + lineH

      elseif source == "text" then
        love.graphics.setColor(TREE_DIM)
        local fs = (d and d.fontSize) or s.fontSize or "?"
        love.graphics.print("measured from text (fontSize " .. tostring(fs) .. ")", indent, y)
        y = y + lineH

      elseif source == "surface-fallback" then
        love.graphics.setColor(PROV_FALLBACK)
        local pv = d.parentH or d.parentW or d.viewportH or d.viewportW or "?"
        love.graphics.print(string.format("empty surface: %s / 4 = %d", tostring(pv and math.floor(pv) or "?"), math.floor(val)), indent, y)
        y = y + lineH

      elseif source == "root" then
        love.graphics.setColor(PROV_ROOT)
        love.graphics.print("auto-filled from viewport", indent, y)
        y = y + lineH

      elseif source == "aspect-ratio" then
        love.graphics.setColor(TREE_DIM)
        love.graphics.print("derived from other axis (ar=" .. fmtVal(s.aspectRatio or "?") .. ")", indent, y)
        y = y + lineH

      else
        love.graphics.setColor(TREE_DIM)
        love.graphics.print(prov[2], indent, y)
        y = y + lineH
      end

      y = y + 2
    end

    drawAxisChain("w", c.w, c.wSource, c.wDetail, s)
    drawAxisChain("h", c.h, c.hSource, c.hDetail, s)
  end

  -- Separator
  love.graphics.setColor(TOOLTIP_BORDER)
  love.graphics.rectangle("fill", rx + 4, y, rw - 8, 1)
  y = y + 6

  -- ── Style (editable) ──
  if s then
    -- Collect and sort style keys for stable ordering
    local styleKeys = {}
    for k, v in pairs(s) do
      if v ~= nil and v ~= "" then
        styleKeys[#styleKeys + 1] = k
      end
    end
    table.sort(styleKeys)

    if #styleKeys > 0 then
      love.graphics.setColor(SECTION_COL)
      love.graphics.print("style", x, y)
      y = y + lineH

      for _, k in ipairs(styleKeys) do
        local v = s[k]
        local keyStr = k .. ": "
        local keyW = font:getWidth(keyStr)
        local valueX = x + keyW

        -- Check if this property is being edited
        local isEditing = state.editState
          and state.editState.section == "style"
          and state.editState.prop == k
          and state.editState.node == node

        -- Draw key
        love.graphics.setColor(PROP_KEY_COL)
        love.graphics.print(keyStr, x, y)

        if isEditing then
          -- Draw inline editor
          drawInlineEditor(valueX, y, rx + rw - valueX - pad, lineH, font)
        else
          -- Draw value (clickable)
          -- Hover highlight: check if mouse is over this value
          local isHovered = state.mouseX >= valueX and state.mouseY >= y
            and state.mouseY < y + lineH and state.mouseX < rx + rw - pad
            and y + lineH > ry and y < ry + rh  -- visible
          if isHovered then
            love.graphics.setColor(TOOLTIP_ACCENT)
          else
            love.graphics.setColor(PROP_VAL_COL)
          end
          love.graphics.print(fmtVal(v), valueX, y)

          -- Store position for click detection
          state.detailPropPositions[#state.detailPropPositions + 1] = {
            section = "style",
            prop = k,
            y = y,
            h = lineH,
            valueX = valueX,
            value = v,
          }
        end

        y = y + lineH
      end
      y = y + 4
    end

    -- [+ add] button or active add-prop editor
    if state.addPropState and state.addPropState.node == node then
      local aps = state.addPropState
      if aps.phase == "key" then
        -- Phase 1: typing prop name
        love.graphics.setColor(SECTION_COL)
        love.graphics.print("prop: ", x, y)
        drawInlineEditor(x + font:getWidth("prop: "), y, rx + rw - x - font:getWidth("prop: ") - pad, lineH, font)
        y = y + lineH
      elseif aps.phase == "value" then
        -- Phase 2: typing value for the named prop
        love.graphics.setColor(PROP_KEY_COL)
        love.graphics.print(aps.propName .. ": ", x, y)
        drawInlineEditor(x + font:getWidth(aps.propName .. ": "), y, rx + rw - x - font:getWidth(aps.propName .. ": ") - pad, lineH, font)
        y = y + lineH
      end
    else
      -- Show [+ add] button
      local addLabel = "[+ add]"
      local isAddHovered = state.mouseX >= x and state.mouseY >= y
        and state.mouseY < y + lineH and state.mouseX < x + font:getWidth(addLabel)
        and y + lineH > ry and y < ry + rh
      love.graphics.setColor(isAddHovered and TOOLTIP_ACCENT or TREE_DIM)
      love.graphics.print(addLabel, x, y)
      state.detailPropPositions[#state.detailPropPositions + 1] = {
        section = "addProp",
        prop = "__add__",
        y = y,
        h = lineH,
        valueX = x,
        value = nil,
      }
      y = y + lineH
    end
    y = y + 4
  end

  -- Separator
  love.graphics.setColor(TOOLTIP_BORDER)
  love.graphics.rectangle("fill", rx + 4, y, rw - 8, 1)
  y = y + 6

  -- ── Props (excluding style, read-only) ──
  if node.props then
    local hasProps = false
    for k, v in pairs(node.props) do
      if k ~= "style" then
        if not hasProps then
          love.graphics.setColor(SECTION_COL)
          love.graphics.print("props", x, y)
          y = y + lineH
          hasProps = true
        end
        love.graphics.setColor(TREE_DIM)
        love.graphics.print(k, x, y)
        love.graphics.setColor(TOOLTIP_TEXT)
        love.graphics.print(fmtVal(v), x + font:getWidth(k .. "  "), y)
        y = y + lineH
      end
    end
    if hasProps then y = y + 4 end
  end

  -- ── Children summary (clickable) ──
  local nc = node.children and #node.children or 0
  if nc > 0 then
    love.graphics.setColor(SECTION_COL)
    love.graphics.print("children (" .. nc .. ")", x, y)
    y = y + lineH
    for i, child in ipairs(node.children) do
      if i > 20 then
        love.graphics.setColor(TREE_DIM)
        love.graphics.print("... +" .. (nc - 20) .. " more", x, y)
        y = y + lineH
        break
      end
      local cc = child.computed
      local dims = cc and string.format("%dx%d", math.floor(cc.w), math.floor(cc.h)) or "?"
      local childName = child.debugName and ("<" .. child.debugName .. ">") or (child.type or "?")
      -- Hover highlight for clickable children
      local isChildHovered = state.mouseX >= x and state.mouseY >= y
        and state.mouseY < y + lineH and state.mouseX < rx + rw - pad
        and y + lineH > ry and y < ry + rh
      love.graphics.setColor(isChildHovered and TOOLTIP_ACCENT or TOOLTIP_TEXT)
      love.graphics.print(string.format("[%d] %s  %s", i, childName, dims), x, y)
      state.detailChildPositions[#state.detailChildPositions + 1] = { node = child, y = y, h = lineH }
      y = y + lineH
    end
  end

  -- ── Handlers ──
  if node.hasHandlers then
    -- Separator
    love.graphics.setColor(TOOLTIP_BORDER)
    love.graphics.rectangle("fill", rx + 4, y, rw - 8, 1)
    y = y + 6

    love.graphics.setColor(SECTION_COL)
    love.graphics.print("handlers", x, y)
    y = y + lineH

    if node.handlerMeta and type(node.handlerMeta) == "table" then
      -- Sort handler names for stable ordering
      local handlerNames = {}
      for name in pairs(node.handlerMeta) do
        handlerNames[#handlerNames + 1] = name
      end
      table.sort(handlerNames)

      local maxSnipW = rw - pad * 2 - 10  -- available width for snippet

      for _, name in ipairs(handlerNames) do
        local snippet = node.handlerMeta[name] or ""
        -- Draw handler name in accent color
        love.graphics.setColor(PERF_GOOD)
        local nameStr = name
        love.graphics.print(nameStr, x, y)
        -- Draw snippet in dim color, truncated to fit
        local nameW = font:getWidth(nameStr .. "  ")
        local snippetX = x + nameW
        local availW = rx + rw - pad - snippetX
        if availW > 20 then
          love.graphics.setColor(TREE_DIM)
          -- Truncate snippet to fit available width
          local displaySnip = snippet
          if font:getWidth(displaySnip) > availW then
            -- Truncate at UTF-8 character boundaries to avoid invalid byte sequences
            if utf8lib then
              local len = utf8lib.len(displaySnip) or 0
              while len > 0 do
                local bytePos = utf8lib.offset(displaySnip, len) -- byte offset of last char
                displaySnip = displaySnip:sub(1, bytePos - 1)
                len = len - 1
                if font:getWidth(displaySnip .. "\xe2\x80\xa6") <= availW then break end
              end
            else
              -- Byte-level fallback (may cut mid-codepoint but won't crash)
              while #displaySnip > 0 and font:getWidth(displaySnip .. "\xe2\x80\xa6") > availW do
                displaySnip = displaySnip:sub(1, -2)
              end
            end
            displaySnip = displaySnip .. "\xe2\x80\xa6"
          end
          love.graphics.print(displaySnip, snippetX, y)
        end
        y = y + lineH
      end
    else
      -- Fallback: no metadata available, just show the flag
      love.graphics.setColor(PERF_GOOD)
      love.graphics.print("event handlers active", x, y)
      y = y + lineH
    end
  end

  -- Hint
  y = y + 8
  love.graphics.setColor(TREE_DIM)
  love.graphics.print("Click values to edit  |  Arrow keys +/-", x, y)
  y = y + lineH + pad

  -- ── Source Editor ──
  if node.debugSource and node.debugSource.fileName then
    y = y + 4
    love.graphics.setColor(SECTION_COL)
    local srcLabel = "source"
    if SourceEditor.isDirty() then srcLabel = srcLabel .. "  \xe2\x97\x8f" end -- ●
    love.graphics.print(srcLabel, x, y)

    -- Show filename on the right
    local shortFile = node.debugSource.fileName:match("([^/]+)$") or node.debugSource.fileName
    love.graphics.setColor(TREE_DIM)
    local fileW = font:getWidth(shortFile)
    love.graphics.print(shortFile, rx + rw - pad - fileW, y)
    y = y + lineH + 4

    -- Open file if not already open (or selected node changed)
    local srcPath = node.debugSource.fileName
    if SourceEditor.getPath() ~= srcPath then
      SourceEditor.open(srcPath, node.debugSource.lineNumber)
    end

    -- Editor region: fixed height, rendered inline in the detail panel
    -- Use remaining viewport height or minimum 200px
    local editorH = math.max(200, rh - (y - ry) - 10)
    -- Temporarily pop the detail panel's scissor so the editor can set its own
    love.graphics.setScissor()
    SourceEditor.draw(rx + 2, y, rw - 4, editorH, font)
    -- Restore detail panel scissor
    love.graphics.setScissor(rx, ry, rw, rh)
    y = y + editorH + pad
  else
    -- No source info — close editor if open
    if SourceEditor.getPath() then
      SourceEditor.close()
    end
  end

  -- Store content height for scroll clamping (+ bottom padding so last line isn't clipped)
  local contentH = (y - ry) + state.detailScrollY + pad
  state.detailContentH = contentH
  local maxDetailScroll = math.max(0, contentH - rh)
  if state.detailScrollY > maxDetailScroll then state.detailScrollY = maxDetailScroll end

  drawScrollbar(rx, ry, rw, rh, state.detailScrollY, contentH)
  love.graphics.setScissor()
end

-- ============================================================================
-- Drawing: Performance bar
-- ============================================================================

function drawPerfBar()
  local font = getFont()
  local screenW = love.graphics.getWidth()
  local screenH = love.graphics.getHeight()
  local pad = 6
  local lineH = font:getHeight() + 2

  -- Read RSS from /proc/self/statm (Linux)
  local rssMB = nil
  do
    local f = io.open("/proc/self/statm", "r")
    if f then
      local line = f:read("*l")
      f:close()
      if line then
        local _, rss = line:match("(%d+)%s+(%d+)")
        if rss then rssMB = tonumber(rss) * 4 / 1024 end
      end
    end
  end

  -- Build perf text
  local fpsColor = state.fps >= 55 and PERF_GOOD or PERF_WARN
  local items = {
    { label = "FPS", value = tostring(state.fps), color = fpsColor },
    { label = "Layout", value = string.format("%.1fms", state.layoutMs), color = PERF_TEXT },
    { label = "Paint", value = string.format("%.1fms", state.paintMs), color = PERF_TEXT },
    { label = "Nodes", value = tostring(state.nodeCount), color = PERF_TEXT },
    { label = "RSS", value = rssMB and string.format("%.0f MB", rssMB) or "?", color = PERF_TEXT },
    { label = "Win", value = (function()
      local mw = WM.getMain()
      if mw then return mw.width .. "x" .. mw.height end
      return screenW .. "x" .. screenH
    end)(), color = PERF_TEXT },
  }

  -- Measure width
  love.graphics.setFont(font)
  local totalW = pad
  for _, item in ipairs(items) do
    totalW = totalW + font:getWidth(item.label .. ": " .. item.value) + pad * 2
  end

  local barH = lineH + pad * 2
  local barX = screenW - totalW - pad
  local barY = pad

  -- Background
  love.graphics.setColor(PERF_BG)
  love.graphics.rectangle("fill", barX, barY, totalW, barH, 4, 4)

  -- Text
  local textX = barX + pad
  local textY = barY + pad
  for i, item in ipairs(items) do
    love.graphics.setColor(TREE_DIM)
    love.graphics.print(item.label .. ": ", textX, textY)
    textX = textX + font:getWidth(item.label .. ": ")
    love.graphics.setColor(item.color)
    love.graphics.print(item.value, textX, textY)
    textX = textX + font:getWidth(item.value) + pad * 2
  end
end

return Inspector
