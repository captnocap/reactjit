--[[
  theme_menu.lua -- Theme browser + tuning overlay

  A Lua-side overlay (F9 by default) for browsing themes and tuning semantic
  color tokens in real time.

  What this panel does:
    - Left column: scrollable theme list + swatch strips
    - Right column: primitive showcase (Box/Text/Pressable/Input/Status chips)
      rendered entirely from active theme tokens
    - Right column editor: choose semantic token, edit hex, apply/reset

  Usage:
    local themeMenu = require("lua.theme_menu")
    themeMenu.init({ key = "f9", onSwitch = function(name, theme, overrides) ... end })
    -- In love.keypressed:   if themeMenu.keypressed(key) then return end
    -- In love.mousepressed: if themeMenu.mousepressed(x, y, btn) then return end
    -- In love.mousereleased: themeMenu.mousereleased(x, y, btn)
    -- In love.mousemoved:   themeMenu.mousemoved(x, y)
    -- In love.wheelmoved:   if themeMenu.wheelmoved(x, y) then return end
    -- In love.textinput:    if themeMenu.textinput(text) then return end
    -- In love.draw:         themeMenu.draw()

  Controls:
    F9 (configurable)   -- Toggle menu
    Up/Down arrows      -- Navigate theme list
    Enter               -- Apply selected theme
    Tab / Shift+Tab     -- Cycle editable token
    Escape              -- Close input (if editing), otherwise close menu
    Mouse click         -- Select theme, token, buttons
    Scroll wheel        -- Scroll theme list
]]

local ThemeMenu = {}

local Color = require("lua.color")

-- ============================================================================
-- State
-- ============================================================================

local state = {
  open          = false,
  toggleKey     = "f9",

  -- Theme data
  themes        = nil,      -- reference to lua/themes registry
  themeNames    = {},       -- sorted list of theme IDs
  currentName   = nil,      -- active theme ID
  currentTheme  = nil,      -- active resolved theme (with overrides merged)
  customColors  = {},       -- { [themeName] = { [token] = "#rrggbb" } }

  -- Navigation
  selectedIdx   = 1,
  hoverIdx      = nil,
  scrollY       = 0,
  maxScrollY    = 0,

  -- Editor state
  editKeyIdx        = 1,    -- index in EDIT_KEYS
  editorText        = "",
  editingInput      = false,
  hoverEditorToken  = nil,
  hoverApply        = false,
  hoverResetToken   = false,
  hoverResetTheme   = false,

  -- Hover
  hoverClose    = false,

  -- Layout cache
  panelRect         = nil,
  listRect          = nil,
  cardRects         = {},   -- { [idx] = { x, y, w, h } }
  closeRect         = nil,
  editorTokenRects  = {},   -- { [idx] = { x, y, w, h } }
  inputRect         = nil,
  applyRect         = nil,
  resetTokenRect    = nil,
  resetThemeRect    = nil,

  -- Status
  statusMessage   = nil,
  statusKind      = "info",
  statusExpiresAt = 0,

  -- Callback
  onSwitch      = nil,      -- function(name, resolvedTheme, overrides)
}

-- ============================================================================
-- Visual constants
-- ============================================================================

local PANEL_W_RATIO   = 0.82
local PANEL_H_RATIO   = 0.84
local MIN_PANEL_W     = 820
local MIN_PANEL_H     = 520
local TITLE_BAR_H     = 36
local STATUS_BAR_H    = 26
local CORNER_R        = 6
local BODY_PAD        = 10
local SECTION_PAD     = 6
local SCROLL_SPEED    = 32

local LIST_RATIO      = 0.43
local LIST_HEADER_H   = 24
local CARD_H          = 74
local CARD_PAD        = 7
local CARD_INNER_PAD  = 10
local SWATCH_SIZE     = 12
local SWATCH_GAP      = 3
local SWATCH_RADIUS   = 2

local SHOWCASE_RATIO  = 0.52
local INPUT_H         = 26
local BUTTON_H        = 24

local SWATCH_KEYS = {
  "bg", "bgAlt", "bgElevated", "primary", "accent",
  "text", "textSecondary", "surface", "border",
  "error", "warning", "success", "info",
}
local MAX_CARD_SWATCHES = 20

local EDIT_KEYS = {
  "bg", "bgAlt", "bgElevated",
  "surface", "surfaceHover", "border", "borderFocus",
  "text", "textSecondary", "textDim",
  "primary", "primaryHover", "primaryPressed",
  "accent", "error", "warning", "success", "info",
}

-- Forward declarations for helpers referenced before definition.
local ensureVisible
local syncEditorTextFromTheme
local applyThemeByName

-- ============================================================================
-- Font cache
-- ============================================================================

local fonts = {}
local function getFont(size)
  if not fonts[size] then fonts[size] = love.graphics.newFont(size) end
  return fonts[size]
end

-- ============================================================================
-- Basic helpers
-- ============================================================================

local function setColor(c)
  love.graphics.setColor(c[1], c[2], c[3], c[4] or 1)
end

local function drawRoundedRect(mode, x, y, w, h, r)
  r = math.min(r, math.min(w, h) / 2)
  love.graphics.rectangle(mode, x, y, w, h, r, r)
end

local function drawText(text, x, y, font, color)
  love.graphics.setFont(font)
  setColor(color)
  love.graphics.print(text, x, y)
end

local function drawCenteredText(text, x, y, w, font, color)
  love.graphics.setFont(font)
  setColor(color)
  love.graphics.printf(text, x, y, w, "center")
end

local function drawRightText(text, rightX, y, font, color)
  love.graphics.setFont(font)
  setColor(color)
  love.graphics.print(text, rightX - font:getWidth(text), y)
end

local function inRect(mx, my, r)
  return r and mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h
end

local function tableSize(t)
  if type(t) ~= "table" then return 0 end
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

local function copyMap(m)
  if type(m) ~= "table" then return nil end
  local out = {}
  for k, v in pairs(m) do out[k] = v end
  return out
end

local function copyTheme(theme)
  if type(theme) ~= "table" then return nil end
  local out = {}
  for k, v in pairs(theme) do out[k] = v end
  if type(theme.colors) == "table" then
    out.colors = copyMap(theme.colors)
  end
  return out
end

local function hexToRGBA(hex)
  if not hex or type(hex) ~= "string" then return nil end
  local r, g, b, a = Color.parse(hex)
  if r then return { r, g, b, a } end
  return nil
end

local function normalizeColorInput(raw)
  if type(raw) ~= "string" then return nil end
  local text = raw:gsub("^%s+", ""):gsub("%s+$", "")
  if text == "" then return nil end

  if text:match("^%x+$") and (#text == 3 or #text == 4 or #text == 6 or #text == 8) then
    text = "#" .. text
  end

  local r, g, b, a = Color.parse(text)
  if not r then return nil end
  return Color.toHex(r, g, b, a)
end

local function withAlpha(rgba, alpha)
  return { rgba[1], rgba[2], rgba[3], alpha }
end

local function luminance(c)
  return 0.2126 * c[1] + 0.7152 * c[2] + 0.0722 * c[3]
end

local function contrastRatio(a, b)
  local la = luminance(a) + 0.05
  local lb = luminance(b) + 0.05
  if la < lb then la, lb = lb, la end
  return la / lb
end

local function pickTextColor(bg, optionA, optionB)
  local cA = contrastRatio(bg, optionA)
  local cB = contrastRatio(bg, optionB)
  if cA >= cB then return optionA end
  return optionB
end

local function colorFromTokens(colors, key, fallbackA, fallbackB, fallbackC)
  if type(colors) ~= "table" then return nil end

  local order = { key, fallbackA, fallbackB, fallbackC }
  for _, token in ipairs(order) do
    if token and colors[token] then
      local rgba = hexToRGBA(colors[token])
      if rgba then return rgba end
    end
  end
  return nil
end

local function collectCardSwatches(colors)
  if type(colors) ~= "table" then return {} end
  local out = {}
  local seen = {}

  for _, key in ipairs(SWATCH_KEYS) do
    local rgba = hexToRGBA(colors[key])
    if rgba then
      out[#out + 1] = rgba
      seen[key] = true
    end
  end

  if #out < MAX_CARD_SWATCHES then
    local extras = {}
    for key, value in pairs(colors) do
      if not seen[key] and type(value) == "string" then
        local rgba = hexToRGBA(value)
        if rgba then extras[#extras + 1] = { key = key, rgba = rgba } end
      end
    end
    table.sort(extras, function(a, b) return a.key < b.key end)
    for i = 1, math.min(#extras, MAX_CARD_SWATCHES - #out) do
      out[#out + 1] = extras[i].rgba
    end
  end

  return out
end

local function titleCaseWord(word)
  if type(word) ~= "string" or word == "" then return "" end
  return word:sub(1, 1):upper() .. word:sub(2)
end

local function formatThemeLabel(name)
  if type(name) ~= "string" or name == "" then return "Unknown Theme" end
  local words = {}
  for part in name:gmatch("[^-]+") do
    words[#words + 1] = titleCaseWord(part)
  end
  return table.concat(words, " ")
end

-- ============================================================================
-- Panel geometry
-- ============================================================================

local function getPanelRect()
  local sw, sh = love.graphics.getDimensions()
  local pw = math.max(MIN_PANEL_W, math.floor(sw * PANEL_W_RATIO))
  local ph = math.max(MIN_PANEL_H, math.floor(sh * PANEL_H_RATIO))
  pw = math.min(pw, sw - 32)
  ph = math.min(ph, sh - 32)
  return {
    x = math.floor((sw - pw) / 2),
    y = math.floor((sh - ph) / 2),
    w = pw,
    h = ph,
  }
end

local function getLayout(p)
  local bodyY = p.y + TITLE_BAR_H
  local bodyH = p.h - TITLE_BAR_H - STATUS_BAR_H

  local usableW = p.w - BODY_PAD * 3
  local listW = math.floor(usableW * LIST_RATIO)
  local minListW = 270
  local maxListW = math.max(minListW, usableW - 300)
  listW = math.max(minListW, math.min(listW, maxListW))
  local detailW = usableW - listW

  local list = {
    x = p.x + BODY_PAD,
    y = bodyY + BODY_PAD,
    w = listW,
    h = bodyH - BODY_PAD * 2,
  }

  local listContent = {
    x = list.x + SECTION_PAD,
    y = list.y + LIST_HEADER_H + 1,
    w = list.w - SECTION_PAD * 2,
    h = list.h - LIST_HEADER_H - SECTION_PAD,
  }

  local detail = {
    x = list.x + list.w + BODY_PAD,
    y = list.y,
    w = detailW,
    h = list.h,
  }

  local showcaseH = math.floor((detail.h - SECTION_PAD) * SHOWCASE_RATIO)
  showcaseH = math.max(170, math.min(showcaseH, detail.h - 170))

  local showcase = {
    x = detail.x,
    y = detail.y,
    w = detail.w,
    h = showcaseH,
  }

  local editor = {
    x = detail.x,
    y = detail.y + showcaseH + SECTION_PAD,
    w = detail.w,
    h = detail.h - showcaseH - SECTION_PAD,
  }

  return {
    list = list,
    listContent = listContent,
    detail = detail,
    showcase = showcase,
    editor = editor,
  }
end

-- ============================================================================
-- Theme helpers
-- ============================================================================

local function buildThemeNames(registry)
  local names = {}
  for name in pairs(registry) do
    names[#names + 1] = name
  end
  table.sort(names, function(a, b)
    local fa = a:match("^(.+)-") or a
    local fb = b:match("^(.+)-") or b
    if fa ~= fb then return fa < fb end
    return a < b
  end)
  return names
end

local function getThemeByName(name)
  if not state.themes or not name then return nil end
  return state.themes[name]
end

local function getResolvedThemeInternal(name)
  local base = getThemeByName(name)
  if not base then return nil end

  local resolved = copyTheme(base)
  if not resolved then return nil end

  local overrides = state.customColors[name]
  if type(overrides) == "table" and type(resolved.colors) == "table" then
    for key, value in pairs(overrides) do
      resolved.colors[key] = value
    end
  end
  return resolved
end

local function getUiTheme()
  local name = state.currentName or state.themeNames[state.selectedIdx] or state.themeNames[1]
  if not name then return nil end
  return getResolvedThemeInternal(name)
end

local function buildUiColors(colors)
  local bg          = colorFromTokens(colors, "bg", "bgAlt", "surface")
  local bgAlt       = colorFromTokens(colors, "bgAlt", "bg", "surface")
  local bgElevated  = colorFromTokens(colors, "bgElevated", "surface", "bgAlt")
  local surface     = colorFromTokens(colors, "surface", "bgElevated", "bgAlt")
  local surfaceHover = colorFromTokens(colors, "surfaceHover", "surface", "bgElevated")
  local text        = colorFromTokens(colors, "text", "textSecondary", "primary")
  local textSecondary = colorFromTokens(colors, "textSecondary", "text", "textDim")
  local textDim     = colorFromTokens(colors, "textDim", "textSecondary", "text")
  local border      = colorFromTokens(colors, "border", "textDim", "surface")
  local borderFocus = colorFromTokens(colors, "borderFocus", "primary", "accent")
  local primary     = colorFromTokens(colors, "primary", "accent", "text")
  local accent      = colorFromTokens(colors, "accent", "primary", "text")
  local error       = colorFromTokens(colors, "error", "accent", "primary")
  local warning     = colorFromTokens(colors, "warning", "accent", "primary")
  local success     = colorFromTokens(colors, "success", "primary", "accent")

  if not (bg and bgAlt and bgElevated and surface and text and border and primary) then
    return nil
  end

  return {
    backdrop      = withAlpha(bg, 0.68),
    panelBg       = withAlpha(bgAlt, 0.98),
    titleBg       = withAlpha(bgElevated, 0.98),
    titleText     = text,
    border        = withAlpha(border, 0.90),
    sectionBg     = withAlpha(surface, 0.95),

    cardBg        = withAlpha(surface, 0.96),
    cardHover     = withAlpha(surfaceHover or bgElevated, 0.99),
    cardActive    = withAlpha(bgElevated, 1),
    cardBorder    = withAlpha(border, 0.55),
    activeBorder  = withAlpha(borderFocus or primary, 0.95),
    themeName     = textSecondary or text,
    themeNameActive = primary,

    closeNormal   = textDim or textSecondary or text,
    closeHover    = error or accent or primary,

    statusBg      = withAlpha(bgAlt, 1),
    statusText    = textSecondary or text,
    statusError   = error or text,
    statusSuccess = success or primary,
    statusWarn    = warning or accent or text,

    scrollbar     = withAlpha(border, 0.55),
    scrollThumb   = withAlpha(primary, 0.85),
    swatchBorder  = withAlpha(border, 0.65),

    inputBg       = withAlpha(bg, 0.70),
    inputBorder   = withAlpha(border, 0.90),
    inputFocus    = withAlpha(borderFocus or primary, 1),
    inputText     = text,
    placeholder   = textDim or textSecondary or text,

    buttonApply   = withAlpha(primary, 0.95),
    buttonReset   = withAlpha(warning or accent or primary, 0.95),
    buttonDanger  = withAlpha(error or accent or primary, 0.95),

    mutedText     = textDim or textSecondary or text,
  }
end

local function currentEditableThemeName()
  return state.currentName or state.themeNames[state.selectedIdx]
end

syncEditorTextFromTheme = function(themeName)
  local key = EDIT_KEYS[state.editKeyIdx]
  if not key then
    state.editorText = ""
    return
  end

  local resolved = themeName and getResolvedThemeInternal(themeName) or nil
  local color = resolved and resolved.colors and resolved.colors[key] or ""
  state.editorText = type(color) == "string" and color or ""
end

local function setEditKey(idx)
  local total = #EDIT_KEYS
  if total == 0 then return end
  local normalized = ((idx - 1) % total) + 1
  state.editKeyIdx = normalized
  syncEditorTextFromTheme(currentEditableThemeName())
end

local function setStatus(msg, kind, ttl)
  state.statusMessage = msg
  state.statusKind = kind or "info"
  state.statusExpiresAt = love.timer.getTime() + (ttl or 2.5)
end

local function themeOverridesCopy(name)
  return copyMap(state.customColors[name])
end

local function setThemeOverride(name, key, value)
  local normalized = normalizeColorInput(value)
  if not normalized then return false, "Invalid color. Use #rgb, #rrggbb, or #rrggbbaa." end

  if not name or not getThemeByName(name) then
    return false, "No active theme selected."
  end

  local overrides = state.customColors[name]
  if type(overrides) ~= "table" then
    overrides = {}
    state.customColors[name] = overrides
  end
  overrides[key] = normalized
  state.editorText = normalized
  return true, normalized
end

local function clearThemeOverride(name, key)
  local overrides = state.customColors[name]
  if type(overrides) ~= "table" then return false end
  if overrides[key] == nil then return false end

  overrides[key] = nil
  if next(overrides) == nil then
    state.customColors[name] = nil
  end
  return true
end

local function clearThemeOverrides(name)
  if state.customColors[name] == nil then return false end
  state.customColors[name] = nil
  return true
end

-- ============================================================================
-- Public API
-- ============================================================================

function ThemeMenu.init(opts)
  opts = opts or {}
  state.toggleKey = opts.key or "f9"
  state.onSwitch = opts.onSwitch
end

function ThemeMenu.setThemes(registry)
  state.themes = registry
  state.themeNames = buildThemeNames(registry)

  if state.currentName then
    for i, name in ipairs(state.themeNames) do
      if name == state.currentName then
        state.selectedIdx = i
        break
      end
    end
    state.currentTheme = getResolvedThemeInternal(state.currentName) or state.currentTheme
  elseif state.themeNames[1] then
    state.selectedIdx = 1
  end

  syncEditorTextFromTheme(currentEditableThemeName())
end

function ThemeMenu.setCurrentTheme(name, theme)
  state.currentName = name

  local resolved = getResolvedThemeInternal(name)
  state.currentTheme = resolved or theme

  for i, n in ipairs(state.themeNames) do
    if n == name then
      state.selectedIdx = i
      break
    end
  end

  syncEditorTextFromTheme(currentEditableThemeName())
end

function ThemeMenu.getResolvedTheme(name)
  local resolved = getResolvedThemeInternal(name or state.currentName)
  if not resolved then return nil end
  return copyTheme(resolved)
end

function ThemeMenu.getThemeOverrides(name)
  return themeOverridesCopy(name or state.currentName)
end

function ThemeMenu.setThemeOverrides(name, overrides)
  if not name or type(overrides) ~= "table" then return end
  local nextOverrides = {}
  for _, key in ipairs(EDIT_KEYS) do
    local normalized = normalizeColorInput(overrides[key])
    if normalized then nextOverrides[key] = normalized end
  end

  if next(nextOverrides) then
    state.customColors[name] = nextOverrides
  else
    state.customColors[name] = nil
  end

  if state.currentName == name then
    state.currentTheme = getResolvedThemeInternal(name) or state.currentTheme
    syncEditorTextFromTheme(name)
  end
end

function ThemeMenu.isOpen()
  return state.open
end

local function open()
  state.open = true
  state.hoverIdx = nil
  state.scrollY = 0
  state.cardRects = {}
  state.editorTokenRects = {}
  state.editingInput = false
  state.hoverEditorToken = nil

  if not state.currentName and state.themeNames[1] then
    state.currentName = state.themeNames[1]
    state.currentTheme = getResolvedThemeInternal(state.currentName)
  end

  if state.currentName then
    for i, n in ipairs(state.themeNames) do
      if n == state.currentName then
        state.selectedIdx = i
        break
      end
    end
  end

  syncEditorTextFromTheme(currentEditableThemeName())
end

local function close()
  state.open = false
  state.editingInput = false
end

applyThemeByName = function(name, force)
  if not name or not state.themes or not state.themes[name] then return end
  if not force and name == state.currentName then return end

  local resolved = getResolvedThemeInternal(name)
  if not resolved then return end

  state.currentName = name
  state.currentTheme = resolved
  syncEditorTextFromTheme(name)

  if state.onSwitch then
    state.onSwitch(name, resolved, themeOverridesCopy(name) or {})
  end
end

local function switchTheme(idx, force)
  local name = state.themeNames[idx]
  if not name then return end
  state.selectedIdx = idx
  applyThemeByName(name, force == true)
end

local function applyEditorValue()
  local themeName = currentEditableThemeName()
  local key = EDIT_KEYS[state.editKeyIdx]
  if not themeName or not key then return end

  local ok, result = setThemeOverride(themeName, key, state.editorText)
  if not ok then
    setStatus(result, "error", 3.2)
    return
  end

  applyThemeByName(themeName, true)
  setStatus(string.format("%s set to %s", key, result), "success", 2.0)
end

local function resetEditorToken()
  local themeName = currentEditableThemeName()
  local key = EDIT_KEYS[state.editKeyIdx]
  if not themeName or not key then return end

  local removed = clearThemeOverride(themeName, key)
  syncEditorTextFromTheme(themeName)
  applyThemeByName(themeName, true)

  if removed then
    setStatus(string.format("%s restored to base value", key), "info", 2.0)
  else
    setStatus(string.format("%s is already at base value", key), "warn", 2.0)
  end
end

local function resetEditorTheme()
  local themeName = currentEditableThemeName()
  if not themeName then return end

  local removed = clearThemeOverrides(themeName)
  syncEditorTextFromTheme(themeName)
  applyThemeByName(themeName, true)

  if removed then
    setStatus("All custom colors cleared for current theme", "info", 2.2)
  else
    setStatus("No custom colors to clear", "warn", 2.0)
  end
end

-- ============================================================================
-- Compatibility hooks (no-op now that live canvas preview was removed)
-- ============================================================================

function ThemeMenu.beginCapture() end
function ThemeMenu.endCapture() end

-- ============================================================================
-- Draw helpers
-- ============================================================================

local function drawThemeList(layout, ui, fontName, fontStatus)
  local list = layout.list
  local content = layout.listContent

  setColor(ui.sectionBg)
  drawRoundedRect("fill", list.x, list.y, list.w, list.h, 4)
  setColor(ui.border)
  drawRoundedRect("line", list.x, list.y, list.w, list.h, 4)

  drawText("Themes", list.x + 8, list.y + 4, fontName, ui.titleText)
  drawText("Click a card to apply", list.x + 74, list.y + 5, fontStatus, ui.mutedText)
  drawRightText(tostring(#state.themeNames), list.x + list.w - 8, list.y + 4, fontName, ui.mutedText)

  love.graphics.setScissor(content.x, content.y, content.w, content.h)

  state.cardRects = {}
  local curY = content.y - state.scrollY + CARD_PAD
  local totalContentH = 0

  for i, name in ipairs(state.themeNames) do
    local resolvedTheme = getResolvedThemeInternal(name)
    local colors = resolvedTheme and resolvedTheme.colors
    local themeLabel = formatThemeLabel(name)
    local cardX = content.x
    local cardW = content.w

    local isActive = (name == state.currentName)
    local isHover = (state.hoverIdx == i)
    local isSelected = (state.selectedIdx == i)
    local overridesCount = tableSize(state.customColors[name])

    state.cardRects[i] = { x = cardX, y = curY, w = cardW, h = CARD_H }

    local drawTop = curY + CARD_H >= content.y
    local drawBottom = curY <= content.y + content.h
    if drawTop and drawBottom then
      local bg = ui.cardBg
      if isActive then bg = ui.cardActive
      elseif isHover then bg = ui.cardHover end
      setColor(bg)
      drawRoundedRect("fill", cardX, curY, cardW, CARD_H, 4)

      if isActive then
        setColor(ui.activeBorder)
        love.graphics.setLineWidth(2)
      elseif isSelected then
        setColor(ui.activeBorder)
        love.graphics.setLineWidth(1)
      else
        setColor(ui.cardBorder)
        love.graphics.setLineWidth(1)
      end
      drawRoundedRect("line", cardX, curY, cardW, CARD_H, 4)
      love.graphics.setLineWidth(1)

      local nameColor = isActive and ui.themeNameActive or ui.themeName
      local titleY = curY + 5
      drawText(themeLabel, cardX + CARD_INNER_PAD, titleY, fontName, nameColor)
      drawText(name, cardX + CARD_INNER_PAD, titleY + 14, fontStatus, ui.mutedText)

      if isActive then
        local badgeText = "ACTIVE"
        local badgeW = fontStatus:getWidth(badgeText) + 10
        local badgeH = 14
        local badgeX = cardX + cardW - CARD_INNER_PAD - badgeW
        local badgeY = titleY
        setColor(withAlpha(ui.activeBorder, 0.20))
        drawRoundedRect("fill", badgeX, badgeY, badgeW, badgeH, 7)
        setColor(ui.activeBorder)
        drawRoundedRect("line", badgeX, badgeY, badgeW, badgeH, 7)
        drawCenteredText(badgeText, badgeX, badgeY + 2, badgeW, fontStatus, ui.themeNameActive)
      end

      if overridesCount > 0 then
        drawRightText(
          "+" .. tostring(overridesCount) .. " custom",
          cardX + cardW - CARD_INNER_PAD,
          titleY + 15,
          fontStatus,
          ui.themeNameActive
        )
      end

      if colors then
        local swatches = collectCardSwatches(colors)
        if #swatches > 0 then
          local rows = 2
          local cols = math.ceil(#swatches / rows)
          local swatchGapX = 4
          local swatchGapY = 3
          local gridW = cardW - CARD_INNER_PAD * 2
          local swatchW = math.floor((gridW - swatchGapX * (cols - 1)) / cols)
          local swatchH = 9
          local swatchGridH = rows * swatchH + (rows - 1) * swatchGapY
          local swatchY = curY + CARD_H - swatchGridH - 8
          local swatchX = cardX + CARD_INNER_PAD

          for idx, rgba in ipairs(swatches) do
            local row = (idx - 1) % rows
            local col = math.floor((idx - 1) / rows)
            local x = swatchX + col * (swatchW + swatchGapX)
            local y = swatchY + row * (swatchH + swatchGapY)
            setColor(rgba)
            drawRoundedRect("fill", x, y, swatchW, swatchH, SWATCH_RADIUS)
            setColor(ui.swatchBorder)
            drawRoundedRect("line", x, y, swatchW, swatchH, SWATCH_RADIUS)
          end
        end
      end
    end

    curY = curY + CARD_H + CARD_PAD
    totalContentH = totalContentH + CARD_H + CARD_PAD
  end

  state.maxScrollY = math.max(0, totalContentH + CARD_PAD - content.h)
  state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))

  if state.maxScrollY > 0 then
    local scrollbarW = 4
    local scrollbarX = list.x + list.w - scrollbarW - 3
    local thumbRatio = content.h / (totalContentH + CARD_PAD)
    local thumbH = math.max(20, math.floor(content.h * thumbRatio))
    local scrollRatio = state.scrollY / state.maxScrollY
    local thumbY = content.y + math.floor((content.h - thumbH) * scrollRatio)

    setColor(ui.scrollbar)
    love.graphics.rectangle("fill", scrollbarX, content.y, scrollbarW, content.h, 2, 2)
    setColor(ui.scrollThumb)
    love.graphics.rectangle("fill", scrollbarX, thumbY, scrollbarW, thumbH, 2, 2)
  end

  love.graphics.setScissor()
end

local function drawPrimitiveShowcase(layout, ui, fontName, fontStatus)
  local pane = layout.showcase
  local theme = state.currentTheme or getResolvedThemeInternal(state.currentName)
  local colors = theme and theme.colors or nil
  if not colors then return end

  setColor(ui.sectionBg)
  drawRoundedRect("fill", pane.x, pane.y, pane.w, pane.h, 4)
  setColor(ui.border)
  drawRoundedRect("line", pane.x, pane.y, pane.w, pane.h, 4)

  drawText("Primitive Showcase", pane.x + 8, pane.y + 4, fontName, ui.titleText)

  local surface = colorFromTokens(colors, "surface", "bgElevated", "bgAlt")
  local bg = colorFromTokens(colors, "bg", "bgAlt", "surface")
  local bgAlt = colorFromTokens(colors, "bgAlt", "bg", "surface")
  local bgElevated = colorFromTokens(colors, "bgElevated", "surface", "bgAlt")
  local border = colorFromTokens(colors, "border", "textDim", "surface")
  local borderFocus = colorFromTokens(colors, "borderFocus", "primary", "accent")
  local text = colorFromTokens(colors, "text", "textSecondary", "primary")
  local textSecondary = colorFromTokens(colors, "textSecondary", "text", "textDim")
  local textDim = colorFromTokens(colors, "textDim", "textSecondary", "text")
  local primary = colorFromTokens(colors, "primary", "accent", "text")
  local accent = colorFromTokens(colors, "accent", "primary", "text")
  local success = colorFromTokens(colors, "success", "primary", "accent")
  local warning = colorFromTokens(colors, "warning", "accent", "primary")
  local error = colorFromTokens(colors, "error", "accent", "primary")

  if not (surface and bg and border and text and primary and accent and success and warning and error) then
    return
  end

  local contentX = pane.x + 10
  local contentY = pane.y + 24
  local contentW = pane.w - 20
  local contentH = pane.h - 32

  setColor(withAlpha(bg, 0.96))
  drawRoundedRect("fill", contentX, contentY, contentW, contentH, 4)
  setColor(withAlpha(border, 0.95))
  drawRoundedRect("line", contentX, contentY, contentW, contentH, 4)

  drawText("Text, Box, Pressable, Input, Status", contentX + 8, contentY + 6, fontStatus, textSecondary or text)

  local rowW = contentW - 16
  local rowX = contentX + 8
  local blockTopY = contentY + 24
  local blockBottomY = contentY + contentH - 8
  local availableH = math.max(160, blockBottomY - blockTopY)
  local spacing = math.max(6, math.floor(availableH * 0.04))

  local boxH = math.max(36, math.floor(availableH * 0.22))
  local actionH = math.max(28, math.floor(availableH * 0.16))
  local inputH = math.max(26, math.floor(availableH * 0.15))
  local progressH = math.max(10, math.floor(availableH * 0.07))
  local chipH = math.max(18, math.floor(availableH * 0.14))
  local usedH = boxH + actionH + inputH + progressH + chipH + spacing * 4

  if usedH > availableH then
    local overflow = usedH - availableH
    local shrink = math.min(overflow, math.max(0, chipH - 18))
    chipH = chipH - shrink
    overflow = overflow - shrink
    if overflow > 0 then
      shrink = math.min(overflow, math.max(0, actionH - 28))
      actionH = actionH - shrink
      overflow = overflow - shrink
    end
    if overflow > 0 then
      shrink = math.min(overflow, math.max(0, boxH - 36))
      boxH = boxH - shrink
      overflow = overflow - shrink
    end
    if overflow > 0 then
      shrink = math.min(overflow, math.max(0, inputH - 26))
      inputH = inputH - shrink
      overflow = overflow - shrink
    end
    if overflow > 0 then
      spacing = math.max(4, spacing - math.ceil(overflow / 4))
    end
  end

  local y = blockTopY

  -- Box primitive
  setColor(withAlpha(surface, 0.95))
  drawRoundedRect("fill", rowX, y, rowW, boxH, 4)
  setColor(withAlpha(border, 0.85))
  drawRoundedRect("line", rowX, y, rowW, boxH, 4)
  drawCenteredText("Box", rowX, y + math.floor((boxH - 14) / 2), rowW, fontName, text)

  y = y + boxH + spacing

  -- Pressable + Badge row
  local buttonW = math.floor(rowW * 0.58)
  local onPrimary = pickTextColor(primary, text, bg)
  setColor(primary)
  drawRoundedRect("fill", rowX, y, buttonW, actionH, 4)
  drawCenteredText("Pressable", rowX, y + math.floor((actionH - 12) / 2), buttonW, fontStatus, onPrimary)

  local badgeX = rowX + buttonW + 8
  local badgeW = rowW - buttonW - 8
  local onAccent = pickTextColor(accent, text, bg)
  setColor(accent)
  drawRoundedRect("fill", badgeX, y, badgeW, actionH, math.floor(actionH / 2))
  drawCenteredText("Badge", badgeX, y + math.floor((actionH - 12) / 2), badgeW, fontStatus, onAccent)

  y = y + actionH + spacing

  -- TextInput primitive
  setColor(withAlpha(bgAlt or bg, 0.94))
  drawRoundedRect("fill", rowX, y, rowW, inputH, 4)
  setColor(withAlpha(borderFocus or border, 0.95))
  drawRoundedRect("line", rowX, y, rowW, inputH, 4)
  drawText("TextInput placeholder", rowX + 8, y + math.floor((inputH - 12) / 2), fontStatus, textDim or textSecondary or text)

  y = y + inputH + spacing

  -- Progress primitive
  setColor(withAlpha(bgElevated or surface, 0.95))
  drawRoundedRect("fill", rowX, y, rowW, progressH, math.floor(progressH / 2))
  setColor(success)
  drawRoundedRect("fill", rowX, y, math.floor(rowW * 0.63), progressH, math.floor(progressH / 2))

  y = y + progressH + spacing

  -- Status chips (Error / Warn / Success)
  local chipGap = 6
  local chipW = math.floor((rowW - chipGap * 2) / 3)

  local onError = pickTextColor(error, text, bg)
  local onWarn = pickTextColor(warning, text, bg)
  local onSuccess = pickTextColor(success, text, bg)

  setColor(error)
  drawRoundedRect("fill", rowX, y, chipW, chipH, math.floor(chipH / 2))
  drawCenteredText("Error", rowX, y + math.floor((chipH - 12) / 2), chipW, fontStatus, onError)

  setColor(warning)
  drawRoundedRect("fill", rowX + chipW + chipGap, y, chipW, chipH, math.floor(chipH / 2))
  drawCenteredText("Warning", rowX + chipW + chipGap, y + math.floor((chipH - 12) / 2), chipW, fontStatus, onWarn)

  setColor(success)
  drawRoundedRect("fill", rowX + (chipW + chipGap) * 2, y, chipW, chipH, math.floor(chipH / 2))
  drawCenteredText("Success", rowX + (chipW + chipGap) * 2, y + math.floor((chipH - 12) / 2), chipW, fontStatus, onSuccess)
end

local function drawTokenEditor(layout, ui, fontName, fontStatus)
  local pane = layout.editor

  setColor(ui.sectionBg)
  drawRoundedRect("fill", pane.x, pane.y, pane.w, pane.h, 4)
  setColor(ui.border)
  drawRoundedRect("line", pane.x, pane.y, pane.w, pane.h, 4)

  local themeName = currentEditableThemeName() or "none"
  local resolvedTheme = getResolvedThemeInternal(themeName)
  local activeKey = EDIT_KEYS[state.editKeyIdx] or "none"
  local activeValue = (resolvedTheme and resolvedTheme.colors and resolvedTheme.colors[activeKey]) or "--"

  drawText("Theme Color Tuning", pane.x + 8, pane.y + 4, fontName, ui.titleText)
  drawRightText(formatThemeLabel(themeName), pane.x + pane.w - 8, pane.y + 4, fontStatus, ui.mutedText)

  local innerX = pane.x + 8
  local innerY = pane.y + 22
  local innerW = pane.w - 16
  local innerH = pane.h - 30

  drawText("Selected token: " .. activeKey, innerX, innerY, fontStatus, ui.themeNameActive)
  drawRightText(activeValue, innerX + innerW, innerY, fontStatus, ui.mutedText)

  local gridTopY = innerY + 14
  local reservedFooter = INPUT_H + BUTTON_H + 26

  local cols = 3
  if innerW >= 760 then cols = 4 end
  if innerW <= 390 then cols = 2 end
  local rows = math.ceil(#EDIT_KEYS / cols)
  local gridH = math.max(80, innerH - (gridTopY - innerY) - reservedFooter)
  local rowH = math.max(16, math.min(24, math.floor(gridH / rows)))
  local colGap = 6
  local colW = math.floor((innerW - colGap * (cols - 1)) / cols)

  state.editorTokenRects = {}

  for idx, key in ipairs(EDIT_KEYS) do
    local col = (idx - 1) % cols
    local row = math.floor((idx - 1) / cols)
    local x = innerX + col * (colW + colGap)
    local y = gridTopY + row * rowH
    local rect = { x = x, y = y, w = colW, h = rowH - 2 }
    state.editorTokenRects[idx] = rect

    local isActive = (idx == state.editKeyIdx)
    local isHover = (idx == state.hoverEditorToken)

    local bg = ui.inputBg
    if isActive then bg = ui.cardActive
    elseif isHover then bg = ui.cardHover end

    setColor(bg)
    drawRoundedRect("fill", rect.x, rect.y, rect.w, rect.h, 3)

    local borderColor = isActive and ui.inputFocus or ui.inputBorder
    setColor(borderColor)
    drawRoundedRect("line", rect.x, rect.y, rect.w, rect.h, 3)

    local swatch = resolvedTheme and resolvedTheme.colors and hexToRGBA(resolvedTheme.colors[key]) or nil
    if swatch then
      local swatchSize = math.min(10, rect.h - 8)
      setColor(swatch)
      drawRoundedRect("fill", rect.x + 4, rect.y + 4, swatchSize, swatchSize, 2)
      setColor(ui.swatchBorder)
      drawRoundedRect("line", rect.x + 4, rect.y + 4, swatchSize, swatchSize, 2)
    end

    drawText(
      key,
      rect.x + 18,
      rect.y + math.floor((rect.h - fontStatus:getHeight()) / 2),
      fontStatus,
      isActive and ui.themeNameActive or ui.themeName
    )
  end

  local tokenGridBottomY = gridTopY + rows * rowH
  local inputY = tokenGridBottomY + 8
  local maxInputY = innerY + innerH - (INPUT_H + BUTTON_H + 16)
  if inputY > maxInputY then inputY = maxInputY end

  local inputW = innerW
  state.inputRect = { x = innerX, y = inputY, w = inputW, h = INPUT_H }

  drawText("Hex value", innerX, inputY - 11, fontStatus, ui.mutedText)

  setColor(ui.inputBg)
  drawRoundedRect("fill", innerX, inputY, inputW, INPUT_H, 4)
  setColor(state.editingInput and ui.inputFocus or ui.inputBorder)
  drawRoundedRect("line", innerX, inputY, inputW, INPUT_H, 4)

  local displayText = state.editorText ~= "" and state.editorText or "#rrggbb"
  local displayColor = (state.editorText ~= "") and ui.inputText or ui.placeholder
  drawText(displayText, innerX + 6, inputY + 6, fontName, displayColor)

  if state.editingInput and math.floor(love.timer.getTime() * 2) % 2 == 0 then
    local tw = getFont(11):getWidth(displayText)
    local cursorX = math.min(innerX + inputW - 6, innerX + 6 + tw + 1)
    setColor(ui.inputFocus)
    love.graphics.line(cursorX, inputY + 4, cursorX, inputY + INPUT_H - 4)
  end

  local buttonY = inputY + INPUT_H + 8
  local buttonGap = 6
  local buttonW = math.floor((innerW - buttonGap * 2) / 3)

  state.applyRect = { x = innerX, y = buttonY, w = buttonW, h = BUTTON_H }
  state.resetTokenRect = { x = innerX + buttonW + buttonGap, y = buttonY, w = buttonW, h = BUTTON_H }
  state.resetThemeRect = { x = innerX + (buttonW + buttonGap) * 2, y = buttonY, w = buttonW, h = BUTTON_H }

  local function drawButton(rect, bg, text, textColor, hovered)
    setColor(bg)
    drawRoundedRect("fill", rect.x, rect.y, rect.w, rect.h, 4)
    setColor(hovered and ui.inputFocus or ui.border)
    drawRoundedRect("line", rect.x, rect.y, rect.w, rect.h, 4)
    drawCenteredText(text, rect.x, rect.y + 6, rect.w, fontStatus, textColor)
  end

  local onApply = pickTextColor(ui.buttonApply, ui.titleText, ui.inputBg)
  local onReset = pickTextColor(ui.buttonReset, ui.titleText, ui.inputBg)
  local onDanger = pickTextColor(ui.buttonDanger, ui.titleText, ui.inputBg)

  drawButton(state.applyRect, ui.buttonApply, "Apply Color", onApply, state.hoverApply)
  drawButton(state.resetTokenRect, ui.buttonReset, "Reset Token", onReset, state.hoverResetToken)
  drawButton(state.resetThemeRect, ui.buttonDanger, "Reset Theme", onDanger, state.hoverResetTheme)

  drawText(
    "Tip: Tab cycles tokens. Enter applies typed value.",
    innerX,
    buttonY + BUTTON_H + 4,
    fontStatus,
    ui.mutedText
  )
end

-- ============================================================================
-- Draw
-- ============================================================================

function ThemeMenu.draw()
  if not state.open then return end
  if not state.themes or #state.themeNames == 0 then return end

  local p = getPanelRect()
  state.panelRect = p

  local uiTheme = getUiTheme()
  if not uiTheme or not uiTheme.colors then return end
  local ui = buildUiColors(uiTheme.colors)
  if not ui then return end

  local fontTitle = getFont(14)
  local fontName = getFont(12)
  local fontStatus = getFont(10)

  -- Backdrop
  setColor(ui.backdrop)
  love.graphics.rectangle("fill", 0, 0, love.graphics.getDimensions())

  -- Panel
  setColor(ui.panelBg)
  drawRoundedRect("fill", p.x, p.y, p.w, p.h, CORNER_R)
  setColor(ui.border)
  drawRoundedRect("line", p.x, p.y, p.w, p.h, CORNER_R)

  -- Title bar
  setColor(ui.titleBg)
  drawRoundedRect("fill", p.x, p.y, p.w, TITLE_BAR_H, CORNER_R)
  love.graphics.rectangle("fill", p.x, p.y + TITLE_BAR_H - CORNER_R, p.w, CORNER_R)
  drawText("Theme Studio", p.x + 12, p.y + 7, fontTitle, ui.titleText)
  drawText("F9 toggles panel", p.x + 112, p.y + 10, fontStatus, ui.mutedText)

  local closeX = p.x + p.w - 34
  local closeY = p.y + 6
  state.closeRect = { x = closeX, y = closeY, w = 24, h = 24 }
  setColor(withAlpha(ui.cardBg, 0.85))
  drawRoundedRect("fill", closeX, closeY, 24, 24, 4)
  setColor(state.hoverClose and ui.closeHover or ui.closeNormal)
  drawRoundedRect("line", closeX, closeY, 24, 24, 4)
  drawCenteredText("X", closeX, closeY + 5, 24, fontStatus, state.hoverClose and ui.closeHover or ui.closeNormal)

  setColor(ui.border)
  love.graphics.line(p.x, p.y + TITLE_BAR_H, p.x + p.w, p.y + TITLE_BAR_H)

  local layout = getLayout(p)
  state.listRect = layout.listContent

  drawThemeList(layout, ui, fontName, fontStatus)
  drawPrimitiveShowcase(layout, ui, fontName, fontStatus)
  drawTokenEditor(layout, ui, fontName, fontStatus)

  -- Status bar
  local statusY = p.y + p.h - STATUS_BAR_H
  setColor(ui.statusBg)
  drawRoundedRect("fill", p.x, statusY, p.w, STATUS_BAR_H, CORNER_R)
  love.graphics.rectangle("fill", p.x, statusY, p.w, CORNER_R)
  setColor(ui.border)
  love.graphics.line(p.x, statusY, p.x + p.w, statusY)

  local statusMsg = string.format(
    "Current: %s | %d themes | Enter apply | Esc close",
    formatThemeLabel(state.currentName or "none"),
    #state.themeNames
  )
  local statusColor = ui.statusText

  if state.statusMessage and love.timer.getTime() <= state.statusExpiresAt then
    statusMsg = state.statusMessage
    if state.statusKind == "error" then
      statusColor = ui.statusError
    elseif state.statusKind == "success" then
      statusColor = ui.statusSuccess
    elseif state.statusKind == "warn" then
      statusColor = ui.statusWarn
    else
      statusColor = ui.statusText
    end
  end

  drawText(statusMsg, p.x + 10, statusY + 6, fontStatus, statusColor)
end

-- ============================================================================
-- Input handlers
-- ============================================================================

local function appendEditorInput(text)
  if type(text) ~= "string" or text == "" then return end
  for ch in text:gmatch(".") do
    if ch:match("[%x]") or ch == "#" then
      if #state.editorText < 9 then
        if ch == "#" then
          if not state.editorText:find("#", 1, true) and #state.editorText == 0 then
            state.editorText = state.editorText .. ch
          end
        else
          state.editorText = state.editorText .. ch:lower()
        end
      end
    end
  end
end

function ThemeMenu.keypressed(key)
  if key == state.toggleKey then
    if state.open then close() else open() end
    return true
  end
  if not state.open then return false end

  if key == "escape" then
    if state.editingInput then
      state.editingInput = false
      syncEditorTextFromTheme(currentEditableThemeName())
      setStatus("Color editing cancelled", "info", 1.5)
    else
      close()
    end
    return true
  end

  local ctrl = love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui")

  if state.editingInput then
    if key == "backspace" then
      if #state.editorText > 0 then
        state.editorText = state.editorText:sub(1, #state.editorText - 1)
      end
      return true
    elseif key == "return" or key == "kpenter" then
      applyEditorValue()
      return true
    elseif key == "tab" then
      local dir = love.keyboard.isDown("lshift", "rshift") and -1 or 1
      setEditKey(state.editKeyIdx + dir)
      return true
    elseif ctrl and key == "v" and love.system and love.system.getClipboardText then
      appendEditorInput(love.system.getClipboardText() or "")
      return true
    end
    return true
  end

  if key == "up" then
    state.selectedIdx = math.max(1, state.selectedIdx - 1)
    ensureVisible(state.selectedIdx)
    return true
  elseif key == "down" then
    state.selectedIdx = math.min(#state.themeNames, state.selectedIdx + 1)
    ensureVisible(state.selectedIdx)
    return true
  elseif key == "return" or key == "kpenter" then
    switchTheme(state.selectedIdx, false)
    return true
  elseif key == "tab" then
    local dir = love.keyboard.isDown("lshift", "rshift") and -1 or 1
    setEditKey(state.editKeyIdx + dir)
    return true
  elseif key == "left" then
    setEditKey(state.editKeyIdx - 1)
    return true
  elseif key == "right" then
    setEditKey(state.editKeyIdx + 1)
    return true
  elseif key == "e" then
    state.editingInput = true
    return true
  end

  return true
end

function ThemeMenu.mousepressed(x, y, button)
  if not state.open then return false end

  if not inRect(x, y, state.panelRect) then
    close()
    return true
  end

  if inRect(x, y, state.closeRect) then
    close()
    return true
  end

  if button ~= 1 then return true end

  if inRect(x, y, state.inputRect) then
    state.editingInput = true
    return true
  else
    state.editingInput = false
  end

  if inRect(x, y, state.applyRect) then
    applyEditorValue()
    return true
  end
  if inRect(x, y, state.resetTokenRect) then
    resetEditorToken()
    return true
  end
  if inRect(x, y, state.resetThemeRect) then
    resetEditorTheme()
    return true
  end

  for i, rect in ipairs(state.editorTokenRects) do
    if inRect(x, y, rect) then
      setEditKey(i)
      return true
    end
  end

  for i, rect in ipairs(state.cardRects) do
    if inRect(x, y, rect) then
      state.selectedIdx = i
      switchTheme(i, false)
      return true
    end
  end

  return true
end

function ThemeMenu.mousereleased(x, y, button)
  if not state.open then return false end
  return true
end

function ThemeMenu.mousemoved(x, y)
  if not state.open then return end

  state.hoverClose = inRect(x, y, state.closeRect)

  state.hoverIdx = nil
  if inRect(x, y, state.listRect) then
    for i, rect in ipairs(state.cardRects) do
      if inRect(x, y, rect) then
        state.hoverIdx = i
        break
      end
    end
  end

  state.hoverEditorToken = nil
  for i, rect in ipairs(state.editorTokenRects) do
    if inRect(x, y, rect) then
      state.hoverEditorToken = i
      break
    end
  end

  state.hoverApply = inRect(x, y, state.applyRect)
  state.hoverResetToken = inRect(x, y, state.resetTokenRect)
  state.hoverResetTheme = inRect(x, y, state.resetThemeRect)
end

function ThemeMenu.wheelmoved(x, y)
  if not state.open then return false end

  local mx, my = love.mouse.getPosition()
  if inRect(mx, my, state.listRect) then
    state.scrollY = state.scrollY - y * SCROLL_SPEED
    state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))
  end
  return true
end

function ThemeMenu.textinput(text)
  if not state.open then return false end
  if state.editingInput then
    appendEditorInput(text)
  end
  return true
end

-- ============================================================================
-- Scroll helpers
-- ============================================================================

ensureVisible = function(idx)
  local p = getPanelRect()
  local layout = getLayout(p)
  local listH = layout.listContent.h

  local cardTop = (idx - 1) * (CARD_H + CARD_PAD) + CARD_PAD
  local cardBottom = cardTop + CARD_H

  local totalContentH = (#state.themeNames) * (CARD_H + CARD_PAD)
  state.maxScrollY = math.max(0, totalContentH + CARD_PAD - listH)

  if cardTop < state.scrollY then
    state.scrollY = cardTop
  elseif cardBottom > state.scrollY + listH then
    state.scrollY = cardBottom - listH
  end

  state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))
end

return ThemeMenu
