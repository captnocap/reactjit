--[[
  color.lua -- Single source of truth for color parsing

  Every Lua module that handles colors (painter, animate, textinput,
  texteditor, codeblock) delegates to this module. One parser, one
  place to add new formats.

  Supported formats:
    - Hex strings: "#rgb", "#rgba", "#rrggbb", "#rrggbbaa"
    - CSS named colors: "white", "red", "cornflowerblue", etc. (148 colors)
    - "transparent"
    - rgb(r, g, b) / rgba(r, g, b, a)  (values 0-255)
    - hsl(h, s%, l%) / hsla(h, s%, l%, a)
    - RGBA tables: {r, g, b, a} (values 0-1)

  API:
    Color.parse(c)              -> r, g, b, a (0-1 range) or nil
    Color.set(c)                -> calls love.graphics.setColor()
    Color.toTable(c, fallback)  -> {r, g, b, a} table or fallback
    Color.toHex(r, g, b, a)    -> "#rrggbb" or "#rrggbbaa" string
]]

local Color = {}

-- One-time warning tracker to avoid spamming the console
local warned = {}

-- ============================================================================
-- CSS named colors (full set, 148 colors, pre-computed to 0-1 range)
-- ============================================================================

local NAMED = {
  aliceblue            = { 0.941, 0.973, 1.000, 1 },
  antiquewhite         = { 0.980, 0.922, 0.843, 1 },
  aqua                 = { 0.000, 1.000, 1.000, 1 },
  aquamarine           = { 0.498, 1.000, 0.831, 1 },
  azure                = { 0.941, 1.000, 1.000, 1 },
  beige                = { 0.961, 0.961, 0.863, 1 },
  bisque               = { 1.000, 0.894, 0.769, 1 },
  black                = { 0.000, 0.000, 0.000, 1 },
  blanchedalmond       = { 1.000, 0.922, 0.804, 1 },
  blue                 = { 0.000, 0.000, 1.000, 1 },
  blueviolet           = { 0.541, 0.169, 0.886, 1 },
  brown                = { 0.647, 0.165, 0.165, 1 },
  burlywood            = { 0.871, 0.722, 0.529, 1 },
  cadetblue            = { 0.373, 0.620, 0.627, 1 },
  chartreuse           = { 0.498, 1.000, 0.000, 1 },
  chocolate            = { 0.824, 0.412, 0.118, 1 },
  coral                = { 1.000, 0.498, 0.314, 1 },
  cornflowerblue       = { 0.392, 0.584, 0.929, 1 },
  cornsilk             = { 1.000, 0.973, 0.863, 1 },
  crimson              = { 0.863, 0.078, 0.235, 1 },
  cyan                 = { 0.000, 1.000, 1.000, 1 },
  darkblue             = { 0.000, 0.000, 0.545, 1 },
  darkcyan             = { 0.000, 0.545, 0.545, 1 },
  darkgoldenrod        = { 0.722, 0.525, 0.043, 1 },
  darkgray             = { 0.663, 0.663, 0.663, 1 },
  darkgreen            = { 0.000, 0.392, 0.000, 1 },
  darkgrey             = { 0.663, 0.663, 0.663, 1 },
  darkkhaki            = { 0.741, 0.718, 0.420, 1 },
  darkmagenta          = { 0.545, 0.000, 0.545, 1 },
  darkolivegreen       = { 0.333, 0.420, 0.184, 1 },
  darkorange           = { 1.000, 0.549, 0.000, 1 },
  darkorchid           = { 0.600, 0.196, 0.800, 1 },
  darkred              = { 0.545, 0.000, 0.000, 1 },
  darksalmon           = { 0.914, 0.588, 0.478, 1 },
  darkseagreen         = { 0.561, 0.737, 0.561, 1 },
  darkslateblue        = { 0.282, 0.239, 0.545, 1 },
  darkslategray        = { 0.184, 0.310, 0.310, 1 },
  darkslategrey        = { 0.184, 0.310, 0.310, 1 },
  darkturquoise        = { 0.000, 0.808, 0.820, 1 },
  darkviolet           = { 0.580, 0.000, 0.827, 1 },
  deeppink             = { 1.000, 0.078, 0.576, 1 },
  deepskyblue          = { 0.000, 0.749, 1.000, 1 },
  dimgray              = { 0.412, 0.412, 0.412, 1 },
  dimgrey              = { 0.412, 0.412, 0.412, 1 },
  dodgerblue           = { 0.118, 0.565, 1.000, 1 },
  firebrick            = { 0.698, 0.133, 0.133, 1 },
  floralwhite          = { 1.000, 0.980, 0.941, 1 },
  forestgreen          = { 0.133, 0.545, 0.133, 1 },
  fuchsia              = { 1.000, 0.000, 1.000, 1 },
  gainsboro            = { 0.863, 0.863, 0.863, 1 },
  ghostwhite           = { 0.973, 0.973, 1.000, 1 },
  gold                 = { 1.000, 0.843, 0.000, 1 },
  goldenrod            = { 0.855, 0.647, 0.125, 1 },
  gray                 = { 0.502, 0.502, 0.502, 1 },
  green                = { 0.000, 0.502, 0.000, 1 },
  greenyellow          = { 0.678, 1.000, 0.184, 1 },
  grey                 = { 0.502, 0.502, 0.502, 1 },
  honeydew             = { 0.941, 1.000, 0.941, 1 },
  hotpink              = { 1.000, 0.412, 0.706, 1 },
  indianred            = { 0.804, 0.361, 0.361, 1 },
  indigo               = { 0.294, 0.000, 0.510, 1 },
  ivory                = { 1.000, 1.000, 0.941, 1 },
  khaki                = { 0.941, 0.902, 0.549, 1 },
  lavender             = { 0.902, 0.902, 0.980, 1 },
  lavenderblush        = { 1.000, 0.941, 0.961, 1 },
  lawngreen            = { 0.486, 0.988, 0.000, 1 },
  lemonchiffon         = { 1.000, 0.980, 0.804, 1 },
  lightblue            = { 0.678, 0.847, 0.902, 1 },
  lightcoral           = { 0.941, 0.502, 0.502, 1 },
  lightcyan            = { 0.878, 1.000, 1.000, 1 },
  lightgoldenrodyellow = { 0.980, 0.980, 0.824, 1 },
  lightgray            = { 0.827, 0.827, 0.827, 1 },
  lightgreen           = { 0.565, 0.933, 0.565, 1 },
  lightgrey            = { 0.827, 0.827, 0.827, 1 },
  lightpink            = { 1.000, 0.714, 0.757, 1 },
  lightsalmon          = { 1.000, 0.627, 0.478, 1 },
  lightseagreen        = { 0.125, 0.698, 0.667, 1 },
  lightskyblue         = { 0.529, 0.808, 0.980, 1 },
  lightslategray       = { 0.467, 0.533, 0.600, 1 },
  lightslategrey       = { 0.467, 0.533, 0.600, 1 },
  lightsteelblue       = { 0.690, 0.769, 0.871, 1 },
  lightyellow          = { 1.000, 1.000, 0.878, 1 },
  lime                 = { 0.000, 1.000, 0.000, 1 },
  limegreen            = { 0.196, 0.804, 0.196, 1 },
  linen                = { 0.980, 0.941, 0.902, 1 },
  magenta              = { 1.000, 0.000, 1.000, 1 },
  maroon               = { 0.502, 0.000, 0.000, 1 },
  mediumaquamarine     = { 0.400, 0.804, 0.667, 1 },
  mediumblue           = { 0.000, 0.000, 0.804, 1 },
  mediumorchid         = { 0.729, 0.333, 0.827, 1 },
  mediumpurple         = { 0.576, 0.439, 0.859, 1 },
  mediumseagreen       = { 0.235, 0.702, 0.443, 1 },
  mediumslateblue      = { 0.482, 0.408, 0.933, 1 },
  mediumspringgreen    = { 0.000, 0.980, 0.604, 1 },
  mediumturquoise      = { 0.282, 0.820, 0.800, 1 },
  mediumvioletred      = { 0.780, 0.082, 0.522, 1 },
  midnightblue         = { 0.098, 0.098, 0.439, 1 },
  mintcream            = { 0.961, 1.000, 0.980, 1 },
  mistyrose            = { 1.000, 0.894, 0.882, 1 },
  moccasin             = { 1.000, 0.894, 0.710, 1 },
  navajowhite          = { 1.000, 0.871, 0.678, 1 },
  navy                 = { 0.000, 0.000, 0.502, 1 },
  oldlace              = { 0.992, 0.961, 0.902, 1 },
  olive                = { 0.502, 0.502, 0.000, 1 },
  olivedrab            = { 0.420, 0.557, 0.137, 1 },
  orange               = { 1.000, 0.647, 0.000, 1 },
  orangered            = { 1.000, 0.271, 0.000, 1 },
  orchid               = { 0.855, 0.439, 0.839, 1 },
  palegoldenrod        = { 0.933, 0.910, 0.667, 1 },
  palegreen            = { 0.596, 0.984, 0.596, 1 },
  paleturquoise        = { 0.686, 0.933, 0.933, 1 },
  palevioletred        = { 0.859, 0.439, 0.576, 1 },
  papayawhip           = { 1.000, 0.937, 0.835, 1 },
  peachpuff            = { 1.000, 0.855, 0.725, 1 },
  peru                 = { 0.804, 0.522, 0.247, 1 },
  pink                 = { 1.000, 0.753, 0.796, 1 },
  plum                 = { 0.867, 0.627, 0.867, 1 },
  powderblue           = { 0.690, 0.878, 0.902, 1 },
  purple               = { 0.502, 0.000, 0.502, 1 },
  rebeccapurple        = { 0.400, 0.200, 0.600, 1 },
  red                  = { 1.000, 0.000, 0.000, 1 },
  rosybrown            = { 0.737, 0.561, 0.561, 1 },
  royalblue            = { 0.255, 0.412, 0.882, 1 },
  saddlebrown          = { 0.545, 0.271, 0.075, 1 },
  salmon               = { 0.980, 0.502, 0.447, 1 },
  sandybrown           = { 0.957, 0.643, 0.376, 1 },
  seagreen             = { 0.180, 0.545, 0.341, 1 },
  seashell             = { 1.000, 0.961, 0.933, 1 },
  sienna               = { 0.627, 0.322, 0.176, 1 },
  silver               = { 0.753, 0.753, 0.753, 1 },
  skyblue              = { 0.529, 0.808, 0.922, 1 },
  slateblue            = { 0.416, 0.353, 0.804, 1 },
  slategray            = { 0.439, 0.502, 0.565, 1 },
  slategrey            = { 0.439, 0.502, 0.565, 1 },
  snow                 = { 1.000, 0.980, 0.980, 1 },
  springgreen          = { 0.000, 1.000, 0.498, 1 },
  steelblue            = { 0.275, 0.510, 0.706, 1 },
  tan                  = { 0.824, 0.706, 0.549, 1 },
  teal                 = { 0.000, 0.502, 0.502, 1 },
  thistle              = { 0.847, 0.749, 0.847, 1 },
  tomato               = { 1.000, 0.388, 0.278, 1 },
  turquoise            = { 0.251, 0.878, 0.816, 1 },
  violet               = { 0.933, 0.510, 0.933, 1 },
  wheat                = { 0.961, 0.871, 0.702, 1 },
  white                = { 1.000, 1.000, 1.000, 1 },
  whitesmoke           = { 0.961, 0.961, 0.961, 1 },
  yellow               = { 1.000, 1.000, 0.000, 1 },
  yellowgreen          = { 0.604, 0.804, 0.196, 1 },
}

-- ============================================================================
-- HSL to RGB conversion
-- ============================================================================

local function hueToRgb(p, q, t)
  if t < 0 then t = t + 1 end
  if t > 1 then t = t - 1 end
  if t < 1/6 then return p + (q - p) * 6 * t end
  if t < 1/2 then return q end
  if t < 2/3 then return p + (q - p) * (2/3 - t) * 6 end
  return p
end

local function hslToRgb(h, s, l)
  if s == 0 then
    return l, l, l
  end
  local q = l < 0.5 and (l * (1 + s)) or (l + s - l * s)
  local p = 2 * l - q
  return hueToRgb(p, q, h + 1/3),
         hueToRgb(p, q, h),
         hueToRgb(p, q, h - 1/3)
end

-- ============================================================================
-- Core parser
-- ============================================================================

--- Parse any supported color value to RGBA components (0-1 range).
--- @param c any  Color value (string, table, or nil)
--- @return number|nil r, number|nil g, number|nil b, number|nil a
function Color.parse(c)
  if not c then return nil end

  -- Table passthrough: {r, g, b, a}
  if type(c) == "table" then
    return c[1] or 0, c[2] or 0, c[3] or 0, c[4] or 1
  end

  if type(c) ~= "string" then return nil end

  -- "transparent"
  if c == "transparent" then return 0, 0, 0, 0 end

  -- Hex: #rrggbb or #rrggbbaa
  local r, g, b, a = c:match("^#(%x%x)(%x%x)(%x%x)(%x?%x?)$")
  if r then
    local alpha = 1
    if a and a ~= "" then alpha = tonumber(a, 16) / 255 end
    return tonumber(r, 16) / 255, tonumber(g, 16) / 255, tonumber(b, 16) / 255, alpha
  end

  -- Hex shorthand: #rgb or #rgba
  local rs, gs, bs, as = c:match("^#(%x)(%x)(%x)(%x?)$")
  if rs then
    local alpha = 1
    if as and as ~= "" then alpha = tonumber(as .. as, 16) / 255 end
    return tonumber(rs .. rs, 16) / 255, tonumber(gs .. gs, 16) / 255, tonumber(bs .. bs, 16) / 255, alpha
  end

  -- CSS named colors (case-insensitive)
  local named = NAMED[c:lower()]
  if named then
    return named[1], named[2], named[3], named[4]
  end

  -- rgb(r, g, b) or rgba(r, g, b, a)  — values 0-255
  local rr, gg, bb = c:match("^rgba?%(%s*(%d+)%s*,%s*(%d+)%s*,%s*(%d+)%s*[,)]")
  if rr then
    local aa = c:match("^rgba?%(%s*%d+%s*,%s*%d+%s*,%s*%d+%s*,%s*([%d%.]+)%s*%)")
    local alpha = aa and tonumber(aa) or 1
    return tonumber(rr) / 255, tonumber(gg) / 255, tonumber(bb) / 255, alpha
  end

  -- hsl(h, s%, l%) or hsla(h, s%, l%, a)
  local hh, ss, ll = c:match("^hsla?%(%s*(%d+)%s*,%s*(%d+)%%%s*,%s*(%d+)%%%s*[,)]")
  if hh then
    local aa = c:match("^hsla?%(%s*%d+%s*,%s*%d+%%%s*,%s*%d+%%%s*,%s*([%d%.]+)%s*%)")
    local alpha = aa and tonumber(aa) or 1
    local hr, hg, hb = hslToRgb(tonumber(hh) / 360, tonumber(ss) / 100, tonumber(ll) / 100)
    return hr, hg, hb, alpha
  end

  -- Unrecognized — warn once
  if not warned[c] then
    warned[c] = true
    io.write(string.format("[color] Unrecognized color: \"%s\"\n", c))
  end
  return nil
end

-- ============================================================================
-- Convenience wrappers
-- ============================================================================

--- Set the active Love2D drawing color from any supported color value.
--- @param c any  Color value (string, table, or nil)
function Color.set(c)
  local r, g, b, a = Color.parse(c)
  if r then
    love.graphics.setColor(r, g, b, a)
  end
end

--- Parse a color to an RGBA table, with a fallback for unparseable values.
--- @param c any  Color value
--- @param fallback any  Value returned if c is nil or unparseable
--- @return table|any  {r, g, b, a} table (0-1 range) or fallback
function Color.toTable(c, fallback)
  local r, g, b, a = Color.parse(c)
  if r then
    return { r, g, b, a }
  end
  return fallback
end

--- Convert RGBA components (0-1) to a hex color string.
--- @param r number Red 0-1
--- @param g number Green 0-1
--- @param b number Blue 0-1
--- @param a number|nil Alpha 0-1 (omits alpha channel if >= 1)
--- @return string Hex color string
function Color.toHex(r, g, b, a)
  local ri = math.floor(r * 255 + 0.5)
  local gi = math.floor(g * 255 + 0.5)
  local bi = math.floor(b * 255 + 0.5)
  if a ~= nil and a < 0.999 then
    local ai = math.floor(a * 255 + 0.5)
    return string.format("#%02x%02x%02x%02x", ri, gi, bi, ai)
  end
  return string.format("#%02x%02x%02x", ri, gi, bi)
end

return Color
