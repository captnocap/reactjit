--[[
  lua/capabilities/convert.lua — @reactjit/convert backend

  ALL conversion math lives here. The TS side is one line:
    export const useConvert = () => useLoveRPC<any>('convert:convert')

  RPC:
    convert:convert    { from, to, value } → result
    convert:categories {}                  → string[]
    convert:units      { category }        → string[]
    convert:size       {}                  → number
]]

local M = {}

-- ── Registry ───────────────────────────────────────────────────────────────

local _converters = {}   -- "from->to" -> fn(value) -> result
local _categories = {}   -- category -> { unit -> true }

local function reg(from, to, fn, category)
  _converters[from:lower() .. "->" .. to:lower()] = fn
  if category then
    if not _categories[category] then _categories[category] = {} end
    _categories[category][from:lower()] = true
    _categories[category][to:lower()]   = true
  end
end

-- Register a group of units with conversion factors relative to a base.
-- factors: unit -> how many base units equal 1 of this unit.
local function reg_group(category, base, factors)
  local all = { [base] = 1 }
  for unit, factor in pairs(factors) do all[unit] = factor end
  for from, ff in pairs(all) do
    for to, tf in pairs(all) do
      if from ~= to then
        local factor = ff / tf
        reg(from, to, function(v) return v * factor end, category)
      end
    end
  end
end

-- ── Length (base: m) ───────────────────────────────────────────────────────

reg_group("length", "m", {
  mm=0.001, cm=0.01, km=1000,
  ["in"]=0.0254, ft=0.3048, yd=0.9144, mi=1609.344,
  nm=1e-9, um=1e-6,
})

-- ── Weight (base: g) ───────────────────────────────────────────────────────

reg_group("weight", "g", {
  mg=0.001, kg=1000, oz=28.3495, lb=453.592,
  ton=907185, tonne=1e6,
})

-- ── Temperature (non-linear) ───────────────────────────────────────────────

reg("c", "f", function(c) return c * 9/5 + 32 end,             "temperature")
reg("f", "c", function(f) return (f - 32) * 5/9 end,           "temperature")
reg("c", "k", function(c) return c + 273.15 end,               "temperature")
reg("k", "c", function(k) return k - 273.15 end,               "temperature")
reg("f", "k", function(f) return (f - 32) * 5/9 + 273.15 end, "temperature")
reg("k", "f", function(k) return (k - 273.15) * 9/5 + 32 end, "temperature")

-- ── Volume (base: ml) ──────────────────────────────────────────────────────

reg_group("volume", "ml", {
  l=1000, gal=3785.41, qt=946.353, pt=473.176,
  cup=236.588, fl_oz=29.5735, tbsp=14.7868, tsp=4.92892,
})

-- ── Speed (base: mps) ──────────────────────────────────────────────────────

reg_group("speed", "mps", {
  kph=0.277778, mph=0.44704, knots=0.514444,
})

-- ── Area (base: m2) ────────────────────────────────────────────────────────

reg_group("area", "m2", {
  mm2=1e-6, cm2=1e-4, km2=1e6,
  in2=6.4516e-4, ft2=0.092903, yd2=0.836127, mi2=2.59e6,
  ha=1e4, acre=4046.86,
})

-- ── Time (base: s) ─────────────────────────────────────────────────────────

reg_group("time", "s", {
  ms=0.001, min=60, hr=3600, day=86400,
  week=604800, month=2629746, year=31556952,
})

-- ── Data (base: b) ─────────────────────────────────────────────────────────

reg_group("data", "b", {
  kb=1e3, mb=1e6, gb=1e9, tb=1e12, pb=1e15,
  kib=1024, mib=1048576, gib=1073741824, tib=1099511627776,
})

-- ── Pressure (base: pa) ────────────────────────────────────────────────────

reg_group("pressure", "pa", {
  kpa=1000, bar=100000, atm=101325, psi=6894.76,
  mmhg=133.322, torr=133.322,
})

-- ── Energy (base: j) ───────────────────────────────────────────────────────

reg_group("energy", "j", {
  kj=1000, cal=4.184, kcal=4184, wh=3600, kwh=3600000,
  btu=1055.06, ev=1.602176634e-19,
})

-- ── Angle (base: deg) ──────────────────────────────────────────────────────

reg_group("angle", "deg", {
  rad = 180 / math.pi,
  grad = 0.9,
  turn = 360,
})

-- ── Color ──────────────────────────────────────────────────────────────────

local NAMED_COLORS = {
  black="#000000", white="#ffffff", red="#ff0000", green="#008000",
  blue="#0000ff", yellow="#ffff00", cyan="#00ffff", magenta="#ff00ff",
  orange="#ffa500", purple="#800080", pink="#ffc0cb", brown="#a52a2a",
  gray="#808080", grey="#808080", silver="#c0c0c0", gold="#ffd700",
  navy="#000080", teal="#008080", olive="#808000", maroon="#800000",
  lime="#00ff00", aqua="#00ffff", fuchsia="#ff00ff",
  coral="#ff7f50", salmon="#fa8072", tomato="#ff6347",
  chocolate="#d2691e", tan="#d2b48c", wheat="#f5deb3",
  ivory="#fffff0", beige="#f5f5dc", linen="#faf0e6",
  lavender="#e6e6fa", plum="#dda0dd", orchid="#da70d6",
  turquoise="#40e0d0", skyblue="#87ceeb", steelblue="#4682b4",
  indigo="#4b0082", violet="#ee82ee", crimson="#dc143c",
  khaki="#f0e68c", sienna="#a0522d", peru="#cd853f",
}

local HEX_TO_NAME = {}
for name, hex in pairs(NAMED_COLORS) do HEX_TO_NAME[hex] = name end

local function hex_to_rgb(hex)
  local h = hex:match("^#?(.+)$")
  if #h == 3 then
    h = h:sub(1,1):rep(2) .. h:sub(2,2):rep(2) .. h:sub(3,3):rep(2)
  end
  return {
    r = tonumber(h:sub(1,2), 16),
    g = tonumber(h:sub(3,4), 16),
    b = tonumber(h:sub(5,6), 16),
  }
end

local function rgb_to_hex(rgb)
  return string.format("#%02x%02x%02x",
    math.min(255, math.max(0, math.floor(rgb.r + 0.5))),
    math.min(255, math.max(0, math.floor(rgb.g + 0.5))),
    math.min(255, math.max(0, math.floor(rgb.b + 0.5)))
  )
end

local function rgb_to_hsl(rgb)
  local r, g, b = rgb.r/255, rgb.g/255, rgb.b/255
  local max, min = math.max(r,g,b), math.min(r,g,b)
  local l = (max + min) / 2
  if max == min then return { h=0, s=0, l=l } end
  local d = max - min
  local s = l > 0.5 and d/(2-max-min) or d/(max+min)
  local h
  if max == r then     h = ((g-b)/d + (g < b and 6 or 0)) / 6
  elseif max == g then h = ((b-r)/d + 2) / 6
  else                 h = ((r-g)/d + 4) / 6 end
  return { h=h*360, s=s, l=l }
end

local function hsl_to_rgb(hsl)
  local h, s, l = hsl.h, hsl.s, hsl.l
  if s == 0 then
    local v = math.floor(l*255 + 0.5)
    return { r=v, g=v, b=v }
  end
  local function hue2rgb(p, q, t)
    if t < 0 then t = t+1 end
    if t > 1 then t = t-1 end
    if t < 1/6 then return p + (q-p)*6*t end
    if t < 1/2 then return q end
    if t < 2/3 then return p + (q-p)*(2/3-t)*6 end
    return p
  end
  local q = l < 0.5 and l*(1+s) or l+s-l*s
  local p = 2*l - q
  local hn = h / 360
  return {
    r = math.floor(hue2rgb(p, q, hn+1/3)*255 + 0.5),
    g = math.floor(hue2rgb(p, q, hn    )*255 + 0.5),
    b = math.floor(hue2rgb(p, q, hn-1/3)*255 + 0.5),
  }
end

local function rgb_to_hsv(rgb)
  local r, g, b = rgb.r/255, rgb.g/255, rgb.b/255
  local max, min = math.max(r,g,b), math.min(r,g,b)
  local d = max - min
  local s = max == 0 and 0 or d/max
  local h = 0
  if d ~= 0 then
    if max == r then     h = ((g-b)/d + (g < b and 6 or 0)) / 6
    elseif max == g then h = ((b-r)/d + 2) / 6
    else                 h = ((r-g)/d + 4) / 6 end
  end
  return { h=h*360, s=s, v=max }
end

local function hsv_to_rgb(hsv)
  local h, s, v = hsv.h, hsv.s, hsv.v
  local i = math.floor(h/60) % 6
  local f = h/60 - math.floor(h/60)
  local p = v*(1-s)
  local q = v*(1-f*s)
  local t = v*(1-(1-f)*s)
  local r, g, b
  if     i==0 then r,g,b = v,t,p
  elseif i==1 then r,g,b = q,v,p
  elseif i==2 then r,g,b = p,v,t
  elseif i==3 then r,g,b = p,q,v
  elseif i==4 then r,g,b = t,p,v
  else              r,g,b = v,p,q end
  return {
    r = math.floor(r*255 + 0.5),
    g = math.floor(g*255 + 0.5),
    b = math.floor(b*255 + 0.5),
  }
end

reg("hex",   "rgb",   hex_to_rgb,                                        "color")
reg("rgb",   "hex",   rgb_to_hex,                                        "color")
reg("rgb",   "hsl",   rgb_to_hsl,                                        "color")
reg("hsl",   "rgb",   hsl_to_rgb,                                        "color")
reg("rgb",   "hsv",   rgb_to_hsv,                                        "color")
reg("hsv",   "rgb",   hsv_to_rgb,                                        "color")
reg("hex",   "hsl",   function(v) return rgb_to_hsl(hex_to_rgb(v)) end, "color")
reg("hsl",   "hex",   function(v) return rgb_to_hex(hsl_to_rgb(v)) end, "color")
reg("hex",   "hsv",   function(v) return rgb_to_hsv(hex_to_rgb(v)) end, "color")
reg("hsv",   "hex",   function(v) return rgb_to_hex(hsv_to_rgb(v)) end, "color")
reg("named", "hex",   function(v)
  local h = NAMED_COLORS[v:lower()]
  if not h then error("Unknown color name: " .. tostring(v)) end
  return h
end, "color")
reg("hex",   "named", function(v)
  local n = HEX_TO_NAME[v:lower()]
  if not n then error("No named color for: " .. tostring(v)) end
  return n
end, "color")

-- ── Encoding ───────────────────────────────────────────────────────────────

local function text_to_base64(text)
  return (love.data.encode("string", "base64", text):gsub("\n", ""))
end

local function base64_to_text(b64)
  return love.data.decode("string", "base64", b64)
end

local function text_to_hex_enc(text)
  return (text:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

local function hex_enc_to_text(hex)
  return (hex:gsub("%x%x", function(h) return string.char(tonumber(h, 16)) end))
end

local function text_to_url(text)
  return (text:gsub("[^A-Za-z0-9%-_.~]", function(c)
    return string.format("%%%02X", c:byte())
  end))
end

local function url_to_text(enc)
  local s = enc:gsub("%%(%x%x)", function(h) return string.char(tonumber(h, 16)) end)
  return (s:gsub("%+", " "))
end

local HTML_ENC = { ["&"]="&amp;", ["<"]="&lt;", [">"]="&gt;", ['"']="&quot;", ["'"]="&#39;" }
local HTML_DEC = { amp="&", lt="<", gt=">", quot='"', apos="'", ["#39"]="'", nbsp=" " }

local function text_to_html(text)
  return (text:gsub('[&<>"\']', HTML_ENC))
end

local function html_to_text(html)
  return (html:gsub("&([^;]+);", function(entity)
    if entity:sub(1,1) == "#" then
      local n = entity:sub(2)
      if n:sub(1,1):lower() == "x" then
        return string.char(tonumber(n:sub(2), 16))
      else
        return string.char(tonumber(n, 10))
      end
    end
    return HTML_DEC[entity] or ("&" .. entity .. ";")
  end))
end

reg("text",    "base64",  text_to_base64,  "encoding")
reg("base64",  "text",    base64_to_text,  "encoding")
reg("text",    "hex-enc", text_to_hex_enc, "encoding")
reg("hex-enc", "text",    hex_enc_to_text, "encoding")
reg("text",    "url",     text_to_url,     "encoding")
reg("url",     "text",    url_to_text,     "encoding")
reg("text",    "html",    text_to_html,    "encoding")
reg("html",    "text",    html_to_text,    "encoding")

-- ── Number bases ───────────────────────────────────────────────────────────

local function to_binary(n)
  n = math.floor(n)
  if n == 0 then return "0" end
  local bits = {}
  while n > 0 do
    table.insert(bits, 1, tostring(n % 2))
    n = math.floor(n / 2)
  end
  return table.concat(bits)
end

reg("decimal", "binary",   function(v) return to_binary(v) end,                         "number-base")
reg("binary",  "decimal",  function(v) return tonumber(v, 2) end,                        "number-base")
reg("decimal", "octal",    function(v) return string.format("%o", math.floor(v)) end,    "number-base")
reg("octal",   "decimal",  function(v) return tonumber(v, 8) end,                        "number-base")
reg("decimal", "hex-num",  function(v) return string.format("%x", math.floor(v)) end,    "number-base")
reg("hex-num", "decimal",  function(v) return tonumber(v, 16) end,                       "number-base")
reg("binary",  "octal",    function(v) return string.format("%o", tonumber(v, 2)) end,   "number-base")
reg("octal",   "binary",   function(v) return to_binary(tonumber(v, 8)) end,             "number-base")
reg("binary",  "hex-num",  function(v) return string.format("%x", tonumber(v, 2)) end,   "number-base")
reg("hex-num", "binary",   function(v) return to_binary(tonumber(v, 16)) end,            "number-base")
reg("octal",   "hex-num",  function(v) return string.format("%x", tonumber(v, 8)) end,   "number-base")
reg("hex-num", "octal",    function(v) return string.format("%o", tonumber(v, 16)) end,  "number-base")

-- ── RPC handlers ───────────────────────────────────────────────────────────

function M.getHandlers()
  return {
    ["convert:convert"] = function(args)
      local from = (args.from or ""):lower()
      local to   = (args.to   or ""):lower()
      local fn   = _converters[from .. "->" .. to]
      if not fn then
        return { error = "no converter: " .. from .. " -> " .. to }
      end
      local ok, result = pcall(fn, args.value)
      if not ok then return { error = tostring(result) } end
      return { result = result }
    end,

    ["convert:categories"] = function()
      local cats = {}
      for cat in pairs(_categories) do cats[#cats+1] = cat end
      table.sort(cats)
      return cats
    end,

    ["convert:units"] = function(args)
      local cat = _categories[args and args.category or ""]
      if not cat then return {} end
      local units = {}
      for unit in pairs(cat) do units[#units+1] = unit end
      table.sort(units)
      return units
    end,

    ["convert:size"] = function()
      local n = 0
      for _ in pairs(_converters) do n = n + 1 end
      return n
    end,
  }
end

return M
