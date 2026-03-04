--[[
  devtools/style.lua — Unified style tokens for all Lua dev panels

  Wired to the theme provider: call Style.setTheme(theme) whenever the
  active theme changes. All panels read from Style.* tables, so a single
  setTheme() call repaints everything.

  If no theme is set (or the theme lacks expected tokens), falls back to
  a neutral dark palette that matches the original hardcoded colors.

  Usage:
    local Style = require("lua.devtools.style")
    Style.setTheme(currentTheme)   -- called once on theme switch

    -- In any tab / panel:
    love.graphics.setColor(Style.palette.text)
    love.graphics.setColor(Style.network.header)
]]

local Color = require("lua.color")

local Style = {}

-- ============================================================================
-- Hex → RGBA helper (same as theme_menu)
-- ============================================================================

local function hexToRGBA(hex)
  if not hex or type(hex) ~= "string" then return nil end
  local r, g, b, a = Color.parse(hex)
  if r then return { r, g, b, a } end
  return nil
end

local function withAlpha(rgba, alpha)
  if not rgba then return nil end
  return { rgba[1], rgba[2], rgba[3], alpha }
end

--- Resolve a color token from a theme's colors table, with ordered fallbacks.
local function token(colors, key, fb1, fb2, fb3)
  if type(colors) ~= "table" then return nil end
  for _, k in ipairs({ key, fb1, fb2, fb3 }) do
    if k and colors[k] then
      local rgba = hexToRGBA(colors[k])
      if rgba then return rgba end
    end
  end
  return nil
end

-- ============================================================================
-- Hardcoded fallback palette (original devtools colors)
-- ============================================================================

local FALLBACK = {
  bg          = { 0.05, 0.05, 0.10, 1.00 },
  bgTranslucent = { 0.05, 0.05, 0.10, 0.92 },
  bgDeep      = { 0.03, 0.03, 0.06, 1.00 },
  bgAlt       = { 0.08, 0.08, 0.14, 1.00 },
  bgElevated  = { 0.06, 0.06, 0.11, 1.00 },
  surface     = { 0.10, 0.10, 0.16, 1.00 },
  surfaceHover = { 0.12, 0.14, 0.20, 1.00 },
  surfaceActive = { 0.18, 0.24, 0.36, 0.95 },
  text        = { 0.88, 0.90, 0.94, 1 },
  textDim     = { 0.55, 0.58, 0.65, 1 },
  textMuted   = { 0.45, 0.48, 0.55, 1 },
  header      = { 0.65, 0.68, 0.75, 1 },
  accent      = { 0.38, 0.65, 0.98, 1 },
  accentDim   = { 0.38, 0.65, 0.98, 0.60 },
  primary     = { 0.56, 0.68, 0.98, 1 },
  success     = { 0.30, 0.80, 0.40, 1 },
  warning     = { 0.95, 0.75, 0.20, 1 },
  error       = { 0.95, 0.45, 0.45, 1 },
  errorStrong = { 0.95, 0.40, 0.30, 1 },
  border      = { 0.25, 0.25, 0.35, 0.80 },
  borderDim   = { 0.18, 0.18, 0.25, 1 },
  divider     = { 0.30, 0.30, 0.42, 1 },
  scrollbar   = { 1, 1, 1, 0.25 },
  buttonBg    = { 0.12, 0.12, 0.18, 1 },
  buttonOn    = { 0.18, 0.28, 0.42, 1 },
  buttonHover = { 0.18, 0.22, 0.32, 1 },
}

-- ============================================================================
-- Live palette (rebuilt on setTheme)
-- ============================================================================

Style.palette = {}
for k, v in pairs(FALLBACK) do Style.palette[k] = v end

-- ============================================================================
-- Rebuild all style tables from a theme
-- ============================================================================

local function rebuild(colors)
  local p = Style.palette

  if colors then
    -- Map semantic theme tokens → palette with fallback chains
    p.bg            = token(colors, "bg", "bgAlt", "surface")           or FALLBACK.bg
    p.bgTranslucent = withAlpha(p.bg, 0.92)
    p.bgDeep        = withAlpha(token(colors, "crust", "mantle", "bg")  or FALLBACK.bgDeep, 1)
    p.bgAlt         = token(colors, "bgAlt", "mantle", "bg")            or FALLBACK.bgAlt
    p.bgElevated    = token(colors, "bgElevated", "surface0", "surface") or FALLBACK.bgElevated
    p.surface       = token(colors, "surface", "surface0", "bgElevated") or FALLBACK.surface
    p.surfaceHover  = token(colors, "surfaceHover", "surface1", "surface") or FALLBACK.surfaceHover
    p.surfaceActive = withAlpha(token(colors, "surface2", "surfaceHover", "surface") or FALLBACK.surfaceActive, 0.95)

    p.text          = token(colors, "text")                              or FALLBACK.text
    p.textDim       = token(colors, "textDim", "subtext0", "textSecondary") or FALLBACK.textDim
    p.textMuted     = token(colors, "overlay0", "textDim", "subtext0")   or FALLBACK.textMuted
    p.header        = token(colors, "subtext1", "textSecondary", "text") or FALLBACK.header

    p.accent        = token(colors, "blue", "primary", "accent")         or FALLBACK.accent
    p.accentDim     = withAlpha(p.accent, 0.60)
    p.primary       = token(colors, "primary", "blue", "accent")         or FALLBACK.primary
    p.success       = token(colors, "green", "success")                  or FALLBACK.success
    p.warning       = token(colors, "yellow", "warning", "peach")        or FALLBACK.warning
    p.error         = token(colors, "red", "error", "maroon")            or FALLBACK.error
    p.errorStrong   = withAlpha(p.error, 0.90)

    p.border        = withAlpha(token(colors, "border", "surface1", "overlay0") or FALLBACK.border, 0.80)
    p.borderDim     = withAlpha(p.border, 0.50)
    p.divider       = token(colors, "surface1", "border", "overlay0")    or FALLBACK.divider
    p.scrollbar     = withAlpha(p.text, 0.25)

    p.buttonBg      = withAlpha(p.surface, 1)
    p.buttonOn      = withAlpha(token(colors, "surface2", "surfaceHover") or FALLBACK.buttonOn, 1)
    p.buttonHover   = withAlpha(p.surfaceHover, 1)
  else
    -- No theme: reset to fallback
    for k, v in pairs(FALLBACK) do p[k] = v end
  end

  -- ──────────────────────────────────────────────────────────────────────
  -- Derived style classes (all reference p.* so they auto-update)
  -- ──────────────────────────────────────────────────────────────────────

  Style.tabBar = {
    height     = 26,
    bg         = p.bgAlt,
    bgActive   = p.bg,
    text       = p.textDim,
    textActive = p.text,
    accent     = p.accent,
    close      = p.textDim,
    closeHover = p.error,
  }

  Style.statusBar = {
    height = 22,
    bg     = p.bgElevated,
    text   = p.textDim,
    good   = p.success,
    warn   = p.warning,
  }

  Style.panel = {
    bg     = p.bgTranslucent,
    border = p.border,
    divider = p.divider,
    dividerHover = p.accentDim,
    minH   = 200,
  }

  Style.wireframe = {
    bg             = p.bgDeep,
    viewportBorder = withAlpha(p.divider, 0.60),
    node           = withAlpha(p.textMuted, 0.50),
    textNode       = withAlpha(p.warning, 0.40),
    selected       = p.accent,
    hover          = p.accentDim,
    label          = withAlpha(p.textDim, 0.80),
    depthColors    = {
      withAlpha(p.accent, 0.55),
      withAlpha(token(colors, "green", "success")    or p.success, 0.50),
      withAlpha(token(colors, "yellow", "warning")   or p.warning, 0.45),
      withAlpha(token(colors, "mauve", "accent")     or p.primary, 0.50),
      withAlpha(token(colors, "teal", "info")        or p.accent, 0.45),
      withAlpha(token(colors, "peach", "warning")    or p.warning, 0.40),
      withAlpha(token(colors, "pink", "accent")      or p.error, 0.45),
    },
    -- Flex overlay
    flex = {
      grow       = withAlpha(p.warning, 0.60),
      shrink     = withAlpha(p.accent, 0.60),
      basis      = { 0.50, 0.50, 0.50, 0.30 },
      text       = withAlpha(p.text, 0.90),
      headerBg   = withAlpha(p.bgAlt, 0.85),
    },
  }

  Style.perf = {
    bg          = p.bgDeep,
    budgetBg    = p.surface,
    budgetFill  = withAlpha(p.success, 0.80),
    budgetWarn  = withAlpha(p.warning, 0.80),
    budgetCrit  = withAlpha(p.errorStrong, 0.80),
    sparkLine   = withAlpha(p.accent, 0.80),
    sparkFill   = withAlpha(p.accent, 0.15),
    sparkThresh = withAlpha(p.errorStrong, 0.30),
    header      = p.header,
    label       = p.textDim,
    value       = p.text,
    reactive    = withAlpha(p.warning, 0.80),
    hotspot     = withAlpha(p.errorStrong, 0.90),
    static      = withAlpha(p.accent, 0.70),
    comp        = p.primary,
    dim         = withAlpha(p.textMuted, 0.70),
    prop        = withAlpha(p.warning, 0.80),
  }

  Style.network = {
    bg         = p.bgDeep,
    header     = p.header,
    dim        = p.textMuted,
    value      = p.text,
    buttonBg   = p.buttonBg,
    buttonOn   = p.buttonOn,
    rowHover   = p.surfaceHover,
    rowSel     = p.surfaceActive,
    err        = p.error,
    warn       = p.warning,
    good       = p.success,
    quiet      = p.textDim,
  }

  Style.logs = {
    bg         = p.bgDeep,
    onBg       = withAlpha(p.success, 0.15),
    onDot      = withAlpha(p.success, 0.85),
    offBg      = p.buttonBg,
    offDot     = withAlpha(p.textMuted, 0.70),
    name       = p.text,
    desc       = p.textMuted,
    header     = p.header,
    buttonBg   = p.buttonBg,
    buttonText = p.textDim,
    buttonHover = p.buttonHover,
    divider    = p.borderDim,
  }

  Style.console = {
    bg         = p.bgTranslucent,
    border     = p.border,
    inputBg    = p.bgAlt,
    inputText  = p.text,
    prompt     = p.accent,
    cursor     = withAlpha(p.text, 0.90),
    result     = withAlpha(p.success, 0.85),
    error      = p.error,
    info       = p.textDim,
    command    = p.text,
    dim        = p.textMuted,
    accent     = p.accent,
    lua        = withAlpha(p.warning, 0.85),
    watch      = withAlpha(token(colors, "mauve", "accent") or p.primary, 0.90),
    macro      = withAlpha(token(colors, "pink", "error")   or p.error, 0.65),
    acBg       = withAlpha(p.surface, 0.95),
    acSelected = withAlpha(p.surfaceActive, 0.90),
    acText     = p.text,
    acDim      = p.textMuted,
  }

  Style.inspector = {
    tree = {
      bg       = withAlpha(p.bg, 0.88),
      hover    = withAlpha(p.surfaceHover, 0.50),
      selected = withAlpha(p.surfaceActive, 0.60),
      text     = p.text,
      dim      = p.textMuted,
      accent   = p.accent,
      guide    = withAlpha(p.textMuted, 0.35),
    },
    tooltip = {
      bg     = withAlpha(p.bg, 0.92),
      border = p.border,
      text   = p.text,
      dim    = p.textDim,
      accent = p.accent,
    },
    boxModel = {
      margin  = withAlpha(p.warning, 0.25),
      padding = withAlpha(p.success, 0.25),
      content = withAlpha(p.accent, 0.25),
      border  = withAlpha(p.warning, 0.80),
    },
    perf = {
      bg   = withAlpha(p.bg, 0.80),
      text = p.text,
      good = p.success,
      warn = p.warning,
    },
    detail = {
      bg = withAlpha(p.bg, 0.92),
    },
    jsx = {
      typeDim   = p.textMuted,
      bracket   = withAlpha(p.textMuted, 0.85),
      comp      = p.primary,
      prim      = withAlpha(token(colors, "teal", "info") or p.accent, 1),
      propKey   = withAlpha(p.warning, 0.90),
      propVal   = withAlpha(p.success, 0.85),
      text      = withAlpha(token(colors, "peach", "warning") or p.warning, 0.85),
      closeName = withAlpha(p.primary, 0.50),
      closeBrk  = withAlpha(p.textMuted, 0.50),
      guide     = withAlpha(p.textMuted, 0.35),
    },
  }
end

-- Initialize with fallback palette
rebuild(nil)

-- ============================================================================
-- Public API
-- ============================================================================

--- Call this when the active theme changes. Pass the theme table (with .colors).
--- Pass nil to reset to fallback.
function Style.setTheme(theme)
  local colors = theme and theme.colors or nil
  rebuild(colors)
end

--- Font cache (shared across all panels)
Style._fonts = {}
function Style.getFont(size)
  size = size or 11
  if not Style._fonts[size] then
    Style._fonts[size] = love.graphics.newFont(size)
  end
  return Style._fonts[size]
end

return Style
