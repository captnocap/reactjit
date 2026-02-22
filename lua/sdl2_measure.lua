--[[
  sdl2_measure.lua -- Text measurement for the SDL2 target.
  Implements the same interface as measure.lua but backed by FreeType
  via sdl2_font.lua instead of Love2D's font APIs.

  Interface (consumed by layout.lua and sdl2_painter.lua):
    measureText(text, fontSize, maxWidth, fontFamily, lineHeight,
                letterSpacing, numberOfLines, fontWeight) -> { width, height }
    getFont(size, fontFamily, fontWeight) -> fontHandle, isBold
    getWidthWithSpacing(fontHandle, text, letterSpacing) -> number
    resolveTextScale(node) -> number
    scaleFontSize(fontSize, node) -> number
    setTextScale(scale)
    getTextScale() -> number
    clearCache()
]]

local Font = require("lua.sdl2_font")

local Measure = {}

-- ============================================================================
-- Text scale (mirrors measure.lua)
-- ============================================================================

local textScale = 1.0

function Measure.setTextScale(scale)
  textScale = math.max(0.5, math.min(3.0, scale or 1.0))
  Measure.clearCache()
end

function Measure.getTextScale() return textScale end

function Measure.resolveTextScale(node)
  local current = node
  while current do
    local s = current.style or current.props
    if s and s.textScale then return s.textScale end
    current = current.parent
  end
  return textScale
end

function Measure.scaleFontSize(fontSize, node)
  return math.floor(fontSize * Measure.resolveTextScale(node))
end

-- ============================================================================
-- Font handle
-- A lightweight proxy that satisfies the interface layout.lua needs:
--   font:getHeight()           -- line height in pixels
--   font:getWidth(text)        -- pixel width of a string
--   font:getWrap(text, limit)  -- wrapped lines (for future use)
-- ============================================================================

local fontHandleCache = {}

local function makeFontHandle(size)
  if fontHandleCache[size] then return fontHandleCache[size] end
  local h = {
    _size = size,
    getHeight = function(self)
      return Font.lineHeight(self._size)
    end,
    getWidth = function(self, text)
      return Font.measureWidth(text, self._size)
    end,
    getWrap = function(self, text, limit)
      -- Basic word-wrap returning (nothing, lines[])
      local lines = {}
      for raw in text:gmatch("[^\n]+") do
        local words = {}
        for w in raw:gmatch("%S+") do words[#words+1] = w end
        local line = ""
        for _, word in ipairs(words) do
          local cand = line=="" and word or (line.." "..word)
          if Font.measureWidth(cand, self._size) <= limit then
            line = cand
          else
            if line~="" then lines[#lines+1] = line end
            line = word
          end
        end
        if line~="" then lines[#lines+1] = line end
      end
      if #lines==0 then lines[1]="" end
      return nil, lines
    end,
    getDescent = function(self)
      return Font.descent(self._size)
    end,
  }
  fontHandleCache[size] = h
  return h
end

-- ============================================================================
-- Core API
-- ============================================================================

-- Measurement cache to avoid re-measuring identical strings
local measureCache = {}

function Measure.clearCache()
  measureCache = {}
  fontHandleCache = {}
end

--- Returns a font handle and isBold flag.
--- fontFamily and fontWeight are currently ignored (single font for now).
function Measure.getFont(size, fontFamily, fontWeight)
  local isBold = fontWeight == "bold" or fontWeight == 700 or fontWeight == "700"
  return makeFontHandle(size), isBold
end

--- Measure text width accounting for optional letter spacing.
function Measure.getWidthWithSpacing(fontHandle, text, letterSpacing)
  local w = Font.measureWidth(text, fontHandle._size)
  if letterSpacing and letterSpacing ~= 0 then
    -- count characters (simple: byte length for ASCII)
    local n = #text
    w = w + letterSpacing * math.max(0, n - 1)
  end
  return w
end

--- Full text measurement used by layout.lua.
--- Returns { width, height } in pixels.
function Measure.measureText(text, fontSize, maxWidth, fontFamily,
                              lineHeight, letterSpacing, numberOfLines, fontWeight)
  if not text or text == "" then
    return { width = 0, height = fontSize or 14 }
  end
  text = tostring(text)

  local key = text .. "|" .. (fontSize or 14) .. "|" .. (maxWidth or "nil")
            .. "|" .. (lineHeight or "nil") .. "|" .. (numberOfLines or "nil")
  if measureCache[key] then return measureCache[key] end

  local size = fontSize or 14
  local lh   = lineHeight or Font.lineHeight(size)

  -- No wrap constraint: single line
  if not maxWidth or maxWidth <= 0 then
    local result = { width = Font.measureWidth(text, size), height = lh }
    measureCache[key] = result
    return result
  end

  -- Word-wrap
  local fh    = makeFontHandle(size)
  local _, lines = fh:getWrap(text, maxWidth)
  local numLines = #lines

  if numberOfLines and numberOfLines > 0 then
    numLines = math.min(numLines, numberOfLines)
  end

  local maxW = 0
  for i = 1, numLines do
    local lw = Font.measureWidth(lines[i], size)
    if lw > maxW then maxW = lw end
  end

  local result = { width = maxW, height = lh * numLines }
  measureCache[key] = result
  return result
end

return Measure
