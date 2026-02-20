--[[
  bootscreen.lua — CartridgeOS trust gate / startup screen

  Shows the cartridge manifest before launch:
  - Identity (name, version, build info)
  - Capabilities color-coded by risk
  - Verification status (sources, build, signature)
  - Confirm (Enter) or Deny (Escape)

  The console overlay still works during this screen.
]]

local json = require("json")
local EventBus = require("eventbus")
local bit = require("bit")

local BootScreen = {}

-- Injected deps (set by init)
local GL, Font
local rect, roundedRect, text, centeredText
local W, H = 0, 0

-- State
local state    = "loading"  -- "loading" | "ready" | "confirmed" | "denied"
local manifest = nil
local errors   = nil
local fadeIn   = 0          -- 0→1 fade animation
local pulse    = 0          -- button pulse timer
local selectedButton = 1   -- 1 = Launch, 2 = Deny
local initVerdict = nil     -- "verified" | "unsigned" | "bad_sig" etc (from init.c)

-- ── Capability metadata ────────────────────────────────────────────────────

local CAP_ORDER = {
  "gpu", "keyboard", "mouse", "usb",
  "storage", "network", "filesystem",
  "clipboard", "process", "browse", "ipc", "sysmon",
}

local CAP_LABELS = {
  gpu        = "GPU acceleration",
  keyboard   = "Keyboard input",
  mouse      = "Mouse / pointer",
  usb        = "USB devices",
  storage    = "Local storage",
  network    = "Network access",
  filesystem = "File system",
  clipboard  = "Clipboard",
  process    = "Process spawning",
  browse     = "Browser session",
  ipc        = "Inter-cart comms",
  sysmon     = "System monitoring",
}

local function classifyRisk(cap, value)
  if not value or value == false then return "denied" end

  -- Wildcard = dangerous
  if type(value) == "table" then
    for _, v in pairs(value) do
      if v == "*" then return "danger" end
    end
  end

  if cap == "gpu" then return "safe" end
  if cap == "keyboard" then return "safe" end
  if cap == "mouse" then return "safe" end
  if cap == "usb" then return "caution" end
  if cap == "storage" then return "safe" end
  if cap == "browse" then return "danger" end
  if cap == "sysmon" then return "danger" end
  if cap == "process" then
    return value == true and "danger" or "caution"
  end
  if type(value) == "table" then return "caution" end
  if value == true then return "caution" end

  return "safe"
end

local RISK_COLORS = {
  safe    = {0.3, 0.85, 0.4},
  caution = {1.0, 0.8, 0.2},
  danger  = {1.0, 0.3, 0.3},
  denied  = {0.35, 0.35, 0.4},
}

-- ── Init ───────────────────────────────────────────────────────────────────

function BootScreen.init(deps)
  GL           = deps.GL
  Font         = deps.Font
  rect         = deps.rect
  roundedRect  = deps.roundedRect
  text         = deps.text
  centeredText = deps.centeredText
  W            = deps.W
  H            = deps.H
end

function BootScreen.loadManifest(path)
  local f = io.open(path, "r")
  if not f then
    manifest = nil
    errors = {"manifest not found: " .. path}
    state = "ready"
    EventBus.emit("os", "no manifest found — unsigned cartridge")
    return
  end

  local contents = f:read("*a")
  f:close()

  local ok, result = pcall(json.decode, contents)
  if not ok then
    manifest = nil
    errors = {"JSON parse error: " .. tostring(result)}
    state = "ready"
    EventBus.emit("os", "manifest parse error")
    return
  end

  manifest = result

  -- Validate
  local valid = true
  errors = {}
  if type(manifest.name) ~= "string" or manifest.name == "" then
    valid = false; errors[#errors + 1] = "missing name"
  end
  if type(manifest.version) ~= "string" or manifest.version == "" then
    valid = false; errors[#errors + 1] = "missing version"
  end
  if type(manifest.capabilities) ~= "table" then
    valid = false; errors[#errors + 1] = "missing capabilities"
  end

  if not valid then
    EventBus.emit("os", "manifest invalid: " .. table.concat(errors, ", "))
  else
    errors = nil
    EventBus.emit("os", "manifest: " .. (manifest.name or "?") .. " v" .. (manifest.version or "?"))
    local granted = 0
    if manifest.capabilities then
      for _, v in pairs(manifest.capabilities) do
        if v and v ~= false then granted = granted + 1 end
      end
    end
    EventBus.emit("os", granted .. " capability(s) requested")
  end

  state = "ready"
end

-- ── Public API ─────────────────────────────────────────────────────────────

function BootScreen.getState()   return state    end
function BootScreen.getManifest() return manifest end

function BootScreen.setVerdict(verdict)
  initVerdict = verdict
end

-- Button geometry (computed per-frame in draw, cached for hit testing)
local btnLayout = { launchX = 0, launchY = 0, denyX = 0, denyY = 0, btnW = 180, btnH = 36 }

function BootScreen.handleKeyDown(scancode)
  if state ~= "ready" then return false end
  if scancode == 40 then state = "confirmed"; return true end  -- Enter
  if scancode == 41 then state = "denied";    return true end  -- Escape
  if scancode == 80 or scancode == 79 or scancode == 43 then   -- L/R/Tab
    selectedButton = selectedButton == 1 and 2 or 1
    return true
  end
  return false
end

function BootScreen.handleClick(mx, my)
  if state ~= "ready" then return false end
  local b = btnLayout
  -- Launch button
  if mx >= b.launchX and mx <= b.launchX + b.btnW
     and my >= b.launchY and my <= b.launchY + b.btnH then
    state = "confirmed"
    return true
  end
  -- Deny button
  if mx >= b.denyX and mx <= b.denyX + b.btnW
     and my >= b.denyY and my <= b.denyY + b.btnH then
    state = "denied"
    return true
  end
  return false
end

function BootScreen.update(dt)
  if fadeIn < 1 then fadeIn = math.min(1, fadeIn + dt * 2.5) end
  pulse = pulse + dt
end

-- ── Helpers ────────────────────────────────────────────────────────────────

local function bullet(x, y, filled, color, alpha)
  if filled then
    rect(x, y, 8, 8, color[1], color[2], color[3], alpha * 0.9)
  else
    rect(x, y, 8, 8, color[1], color[2], color[3], alpha * 0.4)
    rect(x + 1, y + 1, 6, 6, 0.08, 0.08, 0.14, alpha * 0.95)
  end
end

-- ── Draw ───────────────────────────────────────────────────────────────────

function BootScreen.draw()
  if state ~= "ready" and state ~= "loading" then return end
  if state == "loading" then return end

  local a = fadeIn

  -- Background
  GL.glClearColor(0.03, 0.03, 0.07, 1)
  GL.glClear(bit.bor(GL.COLOR_BUFFER_BIT, GL.STENCIL_BUFFER_BIT))
  GL.glLoadIdentity()

  -- Card layout
  local cardW = math.min(700, W - 120)
  local cardX = math.floor((W - cardW) / 2)
  local cardTopY = 110
  local capCount = #CAP_ORDER
  -- Estimate card height
  local cardH = 60 + (capCount * 22) + 140 + 80
  if manifest and manifest.build then cardH = cardH + 20 end

  -- Card background + accent
  roundedRect(cardX, cardTopY, cardW, cardH, 16, 0.08, 0.08, 0.14, a * 0.95)
  GL.glEnable(GL.SCISSOR_TEST)
  GL.glScissor(cardX, H - (cardTopY + cardH), 6, cardH)
  rect(cardX, cardTopY, 6, cardH, 0.4, 0.3, 1.0, a * 0.8)
  GL.glDisable(GL.SCISSOR_TEST)

  -- OS branding
  centeredText("CartridgeOS", W / 2, 40, 28, 0.4, 0.3, 1.0, a)
  centeredText("trust gate", W / 2, 76, 12, 0.4, 0.4, 0.6, a * 0.7)

  local y = cardTopY + 16

  -- ── Identity ────────────────────────────────────────────────────────────
  if manifest then
    local name = manifest.name or "Unknown Cartridge"
    local ver  = "v" .. (manifest.version or "0.0.0")

    text(name, cardX + 20, y, 24, 1, 1, 1, a)
    local vw = Font.measureWidth(ver, 16)
    text(ver, cardX + cardW - 20 - vw, y + 6, 16, 0.5, 0.5, 0.7, a)
    y = y + 34

    if manifest.build then
      local parts = {}
      if manifest.build.commit then parts[#parts + 1] = "build " .. manifest.build.commit end
      if manifest.build.timestamp then
        parts[#parts + 1] = manifest.build.timestamp:match("^(%d%d%d%d%-%d%d%-%d%d)") or manifest.build.timestamp
      end
      if manifest.build.toolchain then parts[#parts + 1] = manifest.build.toolchain end
      if #parts > 0 then
        text(table.concat(parts, "  "), cardX + 20, y, 12, 0.4, 0.4, 0.6, a * 0.8)
        y = y + 20
      end
    end
  else
    text("UNSIGNED CARTRIDGE", cardX + 20, y, 20, 1.0, 0.4, 0.2, a)
    y = y + 28
    if errors then
      for _, err in ipairs(errors) do
        text(err, cardX + 20, y, 12, 0.8, 0.4, 0.4, a * 0.8)
        y = y + 18
      end
    end
  end

  -- Divider
  y = y + 8
  rect(cardX + 16, y, cardW - 32, 1, 0.2, 0.2, 0.3, a * 0.6)
  y = y + 12

  -- ── Capabilities ────────────────────────────────────────────────────────
  text("CAPABILITIES", cardX + 20, y, 11, 0.5, 0.4, 0.9, a)
  y = y + 24

  local caps = manifest and manifest.capabilities or {}

  for _, cap in ipairs(CAP_ORDER) do
    local value = caps[cap]
    local risk = classifyRisk(cap, value)
    local c = RISK_COLORS[risk]

    bullet(cardX + 24, y + 4, risk ~= "denied", c, a)
    text(CAP_LABELS[cap] or cap, cardX + 40, y, 14, c[1], c[2], c[3], a)

    -- Value description
    local desc
    if risk == "denied" then
      desc = "denied"
    elseif value == true then
      desc = cap == "gpu" and "granted (default)" or "granted"
    elseif type(value) == "table" then
      local parts = {}
      for k, v in pairs(value) do
        parts[#parts + 1] = type(k) == "number" and tostring(v) or (tostring(k) .. ":" .. tostring(v))
      end
      desc = table.concat(parts, ", ")
      if #desc > 40 then desc = desc:sub(1, 37) .. "..." end
    else
      desc = tostring(value)
    end
    text(desc, cardX + 200, y, 13, c[1] * 0.8, c[2] * 0.8, c[3] * 0.8, a * 0.7)

    if risk ~= "denied" then
      local bw = Font.measureWidth(risk, 10)
      text(risk, cardX + cardW - 24 - bw, y + 2, 10, c[1], c[2], c[3], a * 0.6)
    end

    y = y + 22
  end

  -- Divider
  y = y + 8
  rect(cardX + 16, y, cardW - 32, 1, 0.2, 0.2, 0.3, a * 0.6)
  y = y + 12

  -- ── Verification ────────────────────────────────────────────────────────
  text("VERIFICATION", cardX + 20, y, 11, 0.5, 0.4, 0.9, a)
  y = y + 24

  if manifest then
    -- Sources
    local srcN = manifest.sources and #manifest.sources or 0
    local srcHash = false
    if manifest.sources then
      for _, s in ipairs(manifest.sources) do
        if s.hash then srcHash = true; break end
      end
    end
    local srcOk = srcN > 0
    local sc = srcOk and {0.3, 0.85, 0.4} or {0.35, 0.35, 0.4}
    bullet(cardX + 24, y + 4, srcOk, sc, a)
    text("sources", cardX + 40, y, 14, sc[1], sc[2], sc[3], a)
    text(srcOk and (srcN .. " file(s)" .. (srcHash and ", hashes present" or "")) or "no source declarations",
         cardX + 160, y, 13, sc[1] * 0.8, sc[2] * 0.8, sc[3] * 0.8, a * 0.7)
    y = y + 22

    -- Build
    local bOk = manifest.build and manifest.build.commit
    local bc = bOk and {0.3, 0.85, 0.4} or {0.35, 0.35, 0.4}
    bullet(cardX + 24, y + 4, bOk, bc, a)
    text("build", cardX + 40, y, 14, bc[1], bc[2], bc[3], a)
    text(bOk and ("commit " .. manifest.build.commit .. ", " .. (manifest.build.toolchain or "?")) or "no build metadata",
         cardX + 160, y, 13, bc[1] * 0.8, bc[2] * 0.8, bc[3] * 0.8, a * 0.7)
    y = y + 22

    -- Signature / init.c verdict
    local sigC, sigD, sigFilled
    if initVerdict == "verified" then
      sigC = {0.3, 0.85, 0.4}
      sigD = "Ed25519 VERIFIED by PID 1"
      sigFilled = true
    elseif initVerdict == "unsigned" then
      sigC = {1.0, 0.8, 0.2}
      sigD = "UNSIGNED (dev mode)"
      sigFilled = false
    elseif initVerdict == "bad_sig" or initVerdict == "bad_hash" then
      sigC = {1.0, 0.3, 0.3}
      sigD = "FAILED: " .. (initVerdict or "unknown")
      sigFilled = false
    elseif manifest.signature and manifest.signature ~= "" then
      sigC = {1.0, 0.8, 0.2}
      sigD = "signature present (unverified)"
      sigFilled = false
    else
      sigC = {0.35, 0.35, 0.4}
      sigD = "not signed"
      sigFilled = false
    end
    bullet(cardX + 24, y + 4, sigFilled, sigC, a)
    text("signature", cardX + 40, y, 14, sigC[1], sigC[2], sigC[3], a)
    text(sigD, cardX + 160, y, 13, sigC[1] * 0.8, sigC[2] * 0.8, sigC[3] * 0.8, a * 0.7)
    y = y + 22
  else
    text("cannot verify — no manifest", cardX + 24, y, 14, 0.8, 0.4, 0.3, a)
    y = y + 22
  end

  -- Divider
  y = y + 8
  rect(cardX + 16, y, cardW - 32, 1, 0.2, 0.2, 0.3, a * 0.6)
  y = y + 16

  -- ── Buttons ─────────────────────────────────────────────────────────────
  local btnW = 180
  local btnH = 36
  local gap = 40
  local bx = math.floor((W - btnW * 2 - gap) / 2)

  -- Cache for hit testing
  btnLayout.launchX = bx
  btnLayout.launchY = y
  btnLayout.denyX   = bx + btnW + gap
  btnLayout.denyY   = y
  btnLayout.btnW    = btnW
  btnLayout.btnH    = btnH

  -- Launch
  local lS = selectedButton == 1
  local lP = lS and (0.8 + 0.2 * math.sin(pulse * 3)) or 0.5
  roundedRect(bx, y, btnW, btnH, 8,
    lS and 0.15 or 0.08, lS and 0.35 or 0.12, lS and 0.15 or 0.08, a * lP)
  local lf1, lf2, lf3 = lS and 0.3 or 0.3, lS and 0.9 or 0.5, lS and 0.4 or 0.3
  local lt = "ENTER  —  Launch"
  local ltw = Font.measureWidth(lt, 13)
  text(lt, bx + (btnW - ltw) / 2, y + 10, 13, lf1, lf2, lf3, a)

  -- Deny
  local dS = selectedButton == 2
  local dP = dS and (0.8 + 0.2 * math.sin(pulse * 3)) or 0.5
  local dx = bx + btnW + gap
  roundedRect(dx, y, btnW, btnH, 8,
    dS and 0.35 or 0.12, dS and 0.12 or 0.08, dS and 0.12 or 0.08, a * dP)
  local df1, df2, df3 = dS and 1.0 or 0.5, dS and 0.4 or 0.3, dS and 0.4 or 0.3
  local dt = "ESC  —  Deny"
  local dtw = Font.measureWidth(dt, 13)
  text(dt, dx + (btnW - dtw) / 2, y + 10, 13, df1, df2, df3, a)

  -- Footer hint
  centeredText("`:console", W / 2, H - 32, 12, 0.3, 0.3, 0.5, a * 0.5)
end

return BootScreen
