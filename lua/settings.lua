--[[
  settings.lua -- API key management overlay

  A Lua-side overlay (like inspector/console) that lets users configure
  API keys for services detected in their app. Renders with raw Love2D
  calls — zero impact on the React tree.

  Usage:
    local settings = require("lua.settings")
    settings.init({ key = "f10" })
    -- In love.keypressed:   if settings.keypressed(key) then return end
    -- In love.mousepressed: if settings.mousepressed(x, y, btn) then return end
    -- In love.mousereleased: settings.mousereleased(x, y, btn)
    -- In love.mousemoved:   settings.mousemoved(x, y)
    -- In love.wheelmoved:   if settings.wheelmoved(x, y) then return end
    -- In love.textinput:    if settings.textinput(text) then return end
    -- In love.draw:         settings.draw()

  Controls:
    F10 (configurable)  -- Toggle settings open/closed
    Tab / Shift+Tab     -- Navigate between fields
    Enter               -- Save current field / open field
    Escape              -- Close (deselect field first, then close panel)
]]

local Settings = {}

-- ============================================================================
-- JSON (reuse whatever the host loaded)
-- ============================================================================

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end
if not ok_json then ok_json, json = pcall(require, "lua.json") end
if not ok_json then json = { encode = tostring, decode = function() return {} end } end

-- ============================================================================
-- State
-- ============================================================================

local state = {
  open        = false,
  toggleKey   = "f10",

  -- Service definitions (set via setServices or bridge event)
  services    = {},          -- array of service definition tables
  categories  = {},          -- ordered list of { name, services[] }

  -- Input
  activeField = nil,         -- { serviceId, fieldKey } or nil
  inputBuffer = "",          -- current text being edited
  cursor      = 0,           -- cursor position in inputBuffer
  cursorBlink = 0,           -- blink timer

  -- Reveal
  revealed    = {},          -- { ["serviceId.fieldKey"] = true }

  -- Persistence
  keys        = {},          -- { ["serviceId.fieldKey"] = "value" }
  dirty       = false,       -- needs save
  saveTimer   = 0,           -- debounce timer

  -- Scroll
  scrollY     = 0,
  maxScrollY  = 0,
  contentH    = 0,

  -- Collapsed categories
  collapsed   = {},          -- { [categoryName] = true }

  -- Hover state (for interactive elements)
  hoverClose  = false,
  hoverField  = nil,         -- "serviceId.fieldKey" or nil
  hoverReveal = nil,         -- "serviceId.fieldKey" or nil

  -- Layout cache (computed each draw)
  panelRect   = nil,         -- { x, y, w, h }
  fieldRects  = {},          -- { ["serviceId.fieldKey"] = { x, y, w, h } }
  revealRects = {},          -- { ["serviceId.fieldKey"] = { x, y, w, h } }
  catRects    = {},          -- { [categoryName] = { x, y, w, h } }
  closeRect   = nil,         -- { x, y, w, h }
}

-- ============================================================================
-- Visual constants
-- ============================================================================

local PANEL_W_RATIO  = 0.60
local PANEL_H_RATIO  = 0.70
local MIN_PANEL_W    = 400
local MIN_PANEL_H    = 300
local TITLE_BAR_H    = 32
local SECTION_HEAD_H = 28
local FIELD_ROW_H    = 30
local FIELD_LABEL_W  = 160
local FIELD_PAD      = 8
local SERVICE_HEAD_H = 24
local SCROLL_SPEED   = 30
local CORNER_R       = 6
local INPUT_H        = 22
local STATUS_BAR_H   = 22

-- Colors (dark theme, matching devtools palette)
local C = {
  backdrop    = { 0.00, 0.00, 0.00, 0.45 },
  panelBg     = { 0.06, 0.06, 0.11, 0.96 },
  titleBg     = { 0.08, 0.08, 0.14, 1 },
  titleText   = { 0.88, 0.90, 0.94, 1 },
  border      = { 0.20, 0.20, 0.30, 0.8 },
  sectionBg   = { 0.08, 0.08, 0.13, 1 },
  sectionText = { 0.55, 0.58, 0.65, 1 },
  serviceName = { 0.78, 0.80, 0.86, 1 },
  fieldLabel  = { 0.55, 0.58, 0.65, 1 },
  inputBg     = { 0.10, 0.10, 0.16, 1 },
  inputBorder = { 0.25, 0.25, 0.35, 0.8 },
  inputText   = { 0.88, 0.90, 0.94, 1 },
  inputFocus  = { 0.38, 0.65, 0.98, 1 },
  placeholder = { 0.35, 0.38, 0.45, 1 },
  cursor      = { 0.38, 0.65, 0.98, 1 },
  dotGreen    = { 0.30, 0.80, 0.40, 1 },
  dotDim      = { 0.30, 0.30, 0.40, 1 },
  closeNormal = { 0.55, 0.58, 0.65, 1 },
  closeHover  = { 0.95, 0.45, 0.45, 1 },
  statusBg    = { 0.06, 0.06, 0.11, 1 },
  statusText  = { 0.45, 0.48, 0.55, 1 },
  revealBtn   = { 0.45, 0.48, 0.55, 1 },
  revealHover = { 0.70, 0.72, 0.78, 1 },
  accent      = { 0.38, 0.65, 0.98, 1 },
  chevron     = { 0.45, 0.48, 0.55, 1 },
  scrollbar   = { 0.25, 0.25, 0.35, 0.6 },
  scrollthumb = { 0.40, 0.42, 0.50, 0.8 },
}

-- Cached fonts
local fonts = {}
local function getFont(size)
  if not fonts[size] then fonts[size] = love.graphics.newFont(size) end
  return fonts[size]
end

-- ============================================================================
-- Built-in service definitions (always available, no bridge needed)
-- ============================================================================

local BUILTIN_SERVICES = {
  -- AI
  { id = "openai",    name = "OpenAI",    category = "ai", auth = { type = "bearer", fields = {
    { key = "apiKey", label = "API Key", placeholder = "sk-..." },
    { key = "baseURL", label = "Base URL (optional)", secret = false, placeholder = "https://api.openai.com" },
  }}},
  { id = "anthropic", name = "Anthropic", category = "ai", auth = { type = "header", fields = {
    { key = "apiKey", label = "API Key", placeholder = "sk-ant-..." },
    { key = "baseURL", label = "Base URL (optional)", secret = false, placeholder = "https://api.anthropic.com" },
  }}},
  -- Media
  { id = "spotify",   name = "Spotify",   category = "media", auth = { type = "bearer", fields = {
    { key = "token", label = "OAuth2 Token", placeholder = "Bearer token from OAuth flow" },
  }}},
  { id = "tmdb",      name = "TMDB",      category = "media", auth = { type = "query", fields = {
    { key = "apiKey", label = "API Key", placeholder = "v3 API key" },
  }}},
  { id = "plex",      name = "Plex",      category = "media", auth = { type = "header", fields = {
    { key = "baseUrl", label = "Server URL", secret = false, placeholder = "http://localhost:32400" },
    { key = "token",   label = "X-Plex-Token", placeholder = "Plex authentication token" },
  }}},
  { id = "jellyfin",  name = "Jellyfin",  category = "media", auth = { type = "header", fields = {
    { key = "baseUrl", label = "Server URL", secret = false, placeholder = "http://localhost:8096" },
    { key = "apiKey",  label = "API Key", placeholder = "Jellyfin API key" },
  }}},
  { id = "trakt",     name = "Trakt",     category = "media", auth = { type = "header", fields = {
    { key = "clientId", label = "Client ID", placeholder = "Trakt application client ID" },
    { key = "token",    label = "Access Token (optional)", placeholder = "OAuth token for user data" },
  }}},
  { id = "lastfm",    name = "Last.fm",   category = "media", auth = { type = "query", fields = {
    { key = "apiKey", label = "API Key", placeholder = "Last.fm API key" },
  }}},
  { id = "polypizza", name = "Poly Pizza", category = "media", auth = { type = "header", fields = {
    { key = "apiKey", label = "API Key", placeholder = "Poly Pizza API key" },
  }}},
  -- Dev
  { id = "github",    name = "GitHub",    category = "dev", auth = { type = "bearer", fields = {
    { key = "token", label = "Personal Access Token", placeholder = "ghp_..." },
  }}},
  { id = "steam",     name = "Steam",     category = "dev", auth = { type = "query", fields = {
    { key = "apiKey", label = "Web API Key", placeholder = "Steam Web API key" },
  }}},
  { id = "nasa",      name = "NASA",      category = "dev", auth = { type = "query", fields = {
    { key = "apiKey", label = "API Key", placeholder = "DEMO_KEY or api.nasa.gov key" },
  }}},
  -- Smart Home
  { id = "homeassistant", name = "Home Assistant", category = "smart-home", auth = { type = "bearer", fields = {
    { key = "baseUrl", label = "Server URL", secret = false, placeholder = "http://homeassistant.local:8123" },
    { key = "token",   label = "Long-Lived Access Token", placeholder = "ey..." },
  }}},
  { id = "hue",       name = "Philips Hue", category = "smart-home", auth = { type = "url-path", fields = {
    { key = "bridgeIp", label = "Bridge IP", secret = false, placeholder = "192.168.1.x" },
    { key = "apiKey",   label = "API Key", placeholder = "Press bridge button then generate" },
  }}},
  -- Productivity
  { id = "notion",    name = "Notion",    category = "productivity", auth = { type = "bearer", fields = {
    { key = "token", label = "Internal Integration Token", placeholder = "secret_..." },
  }}},
  { id = "todoist",   name = "Todoist",   category = "productivity", auth = { type = "bearer", fields = {
    { key = "token", label = "API Token", placeholder = "Todoist API token" },
  }}},
  { id = "google",    name = "Google",    category = "productivity", auth = { type = "bearer", fields = {
    { key = "token", label = "OAuth2 Token", placeholder = "Bearer token from OAuth flow" },
  }}},
  -- Finance
  { id = "ynab",      name = "YNAB",      category = "finance", auth = { type = "bearer", fields = {
    { key = "token", label = "Personal Access Token", placeholder = "YNAB API token" },
  }}},
  { id = "coingecko", name = "CoinGecko", category = "finance", auth = { type = "header", fields = {
    { key = "apiKey", label = "API Key (optional)", placeholder = "Free tier works without key" },
  }}},
  -- Social
  { id = "telegram",  name = "Telegram Bot", category = "social", auth = { type = "url-path", fields = {
    { key = "botToken", label = "Bot Token", placeholder = "123456:ABC-DEF..." },
  }}},
  { id = "weather",   name = "OpenWeatherMap", category = "social", auth = { type = "query", fields = {
    { key = "apiKey", label = "API Key", placeholder = "OpenWeatherMap API key" },
  }}},
}

-- ============================================================================
-- Category display names and order
-- ============================================================================

local CATEGORY_ORDER = {
  'ai', 'media', 'dev', 'smart-home', 'productivity', 'finance', 'social', 'custom',
}

local CATEGORY_LABELS = {
  ['ai']           = 'AI Providers',
  ['media']        = 'Media',
  ['dev']          = 'Developer',
  ['smart-home']   = 'Smart Home',
  ['productivity'] = 'Productivity',
  ['finance']      = 'Finance',
  ['social']       = 'Social',
  ['custom']       = 'Custom',
}

-- ============================================================================
-- Persistence
-- ============================================================================

local KEYS_PATH = "save/settings"
local KEYS_FILE = "save/settings/api_keys.json"

local function loadKeys()
  local content = love.filesystem.read(KEYS_FILE)
  if not content then return {} end
  local ok, data = pcall(json.decode, content)
  if ok and type(data) == "table" then return data end
  return {}
end

local function saveKeys()
  love.filesystem.createDirectory(KEYS_PATH)
  local ok, encoded = pcall(json.encode, state.keys)
  if ok then
    love.filesystem.write(KEYS_FILE, encoded)
  end
  state.dirty = false
end

-- ============================================================================
-- Service registry helpers
-- ============================================================================

--- Build ordered category list from services array.
local function buildCategories(services)
  local byCategory = {}
  for _, svc in ipairs(services) do
    local cat = svc.category or 'custom'
    if not byCategory[cat] then byCategory[cat] = {} end
    table.insert(byCategory[cat], svc)
  end

  local result = {}
  for _, catId in ipairs(CATEGORY_ORDER) do
    if byCategory[catId] and #byCategory[catId] > 0 then
      table.insert(result, {
        id    = catId,
        label = CATEGORY_LABELS[catId] or catId,
        services = byCategory[catId],
      })
    end
  end
  return result
end

--- Check if a service has all required fields configured.
local function isServiceConfigured(svc)
  if not svc.auth or not svc.auth.fields then return false end
  for _, field in ipairs(svc.auth.fields) do
    local k = svc.id .. "." .. field.key
    if not state.keys[k] or state.keys[k] == "" then
      return false
    end
  end
  return true
end

--- Count configured services.
local function countConfigured()
  local total, configured = 0, 0
  for _, svc in ipairs(state.services) do
    total = total + 1
    if isServiceConfigured(svc) then configured = configured + 1 end
  end
  return configured, total
end

--- Get the composite key for a service field.
local function fieldKey(serviceId, fKey)
  return serviceId .. "." .. fKey
end

-- ============================================================================
-- Field editing
-- ============================================================================

local function startEditing(serviceId, fKey)
  local k = fieldKey(serviceId, fKey)
  state.activeField = { serviceId = serviceId, fieldKey = fKey }
  state.inputBuffer = state.keys[k] or ""
  state.cursor = #state.inputBuffer
  state.cursorBlink = 0
end

local function stopEditing(save)
  if not state.activeField then return end
  if save then
    local k = fieldKey(state.activeField.serviceId, state.activeField.fieldKey)
    state.keys[k] = state.inputBuffer
    state.dirty = true
    state.saveTimer = 0.5  -- debounce save
  end
  state.activeField = nil
  state.inputBuffer = ""
  state.cursor = 0
end

local function isEditing(serviceId, fKey)
  if not state.activeField then return false end
  return state.activeField.serviceId == serviceId
    and state.activeField.fieldKey == fKey
end

-- ============================================================================
-- Panel geometry
-- ============================================================================

local function getPanelRect()
  local sw, sh = love.graphics.getDimensions()
  local pw = math.max(MIN_PANEL_W, math.floor(sw * PANEL_W_RATIO))
  local ph = math.max(MIN_PANEL_H, math.floor(sh * PANEL_H_RATIO))
  local px = math.floor((sw - pw) / 2)
  local py = math.floor((sh - ph) / 2)
  return { x = px, y = py, w = pw, h = ph }
end

-- ============================================================================
-- Drawing helpers
-- ============================================================================

local function setColor(c)
  love.graphics.setColor(c[1], c[2], c[3], c[4] or 1)
end

local function drawRoundedRect(mode, x, y, w, h, r)
  love.graphics.rectangle(mode, x, y, w, h, r or 0, r or 0)
end

local function drawText(text, x, y, font, color, maxW)
  love.graphics.setFont(font)
  setColor(color)
  if maxW then
    -- Truncate with ellipsis if too wide
    local tw = font:getWidth(text)
    if tw > maxW then
      while #text > 1 and font:getWidth(text .. "...") > maxW do
        text = text:sub(1, -2)
      end
      text = text .. "..."
    end
  end
  love.graphics.print(text, math.floor(x), math.floor(y))
end

-- ============================================================================
-- Main draw
-- ============================================================================

function Settings.draw()
  if not state.open then return end

  local sw, sh = love.graphics.getDimensions()
  local p = getPanelRect()
  state.panelRect = p

  -- Update blink timer
  state.cursorBlink = (state.cursorBlink + love.timer.getDelta()) % 1.0

  -- Save debounce
  if state.dirty then
    state.saveTimer = state.saveTimer - love.timer.getDelta()
    if state.saveTimer <= 0 then
      saveKeys()
    end
  end

  local fontTitle  = getFont(14)
  local fontSection = getFont(12)
  local fontLabel  = getFont(11)
  local fontInput  = getFont(12)
  local fontStatus = getFont(10)

  -- ── Backdrop ──
  setColor(C.backdrop)
  love.graphics.rectangle("fill", 0, 0, sw, sh)

  -- ── Panel background ──
  setColor(C.panelBg)
  drawRoundedRect("fill", p.x, p.y, p.w, p.h, CORNER_R)
  setColor(C.border)
  love.graphics.setLineWidth(1)
  drawRoundedRect("line", p.x, p.y, p.w, p.h, CORNER_R)

  -- ── Title bar ──
  setColor(C.titleBg)
  drawRoundedRect("fill", p.x, p.y, p.w, TITLE_BAR_H, CORNER_R)
  -- Bottom edge of title (cover rounded corners)
  love.graphics.rectangle("fill", p.x, p.y + TITLE_BAR_H - CORNER_R, p.w, CORNER_R)

  drawText("Settings", p.x + 12, p.y + 8, fontTitle, C.titleText)

  -- Close button
  local closeX = p.x + p.w - 28
  local closeY = p.y + 6
  local closeW, closeH = 20, 20
  state.closeRect = { x = closeX, y = closeY, w = closeW, h = closeH }
  local closeColor = state.hoverClose and C.closeHover or C.closeNormal
  local closeFont = getFont(14)
  love.graphics.setFont(closeFont)
  setColor(closeColor)
  love.graphics.print("x", closeX + 5, closeY + 2)

  -- Title bar border
  setColor(C.border)
  love.graphics.line(p.x, p.y + TITLE_BAR_H, p.x + p.w, p.y + TITLE_BAR_H)

  -- ── Content area (clipped + scrolled) ──
  local contentX = p.x
  local contentY = p.y + TITLE_BAR_H
  local contentW = p.w
  local contentH = p.h - TITLE_BAR_H - STATUS_BAR_H

  love.graphics.setScissor(contentX, contentY, contentW, contentH)

  local curY = contentY - state.scrollY + 8
  state.fieldRects = {}
  state.revealRects = {}
  state.catRects = {}

  for _, cat in ipairs(state.categories) do
    -- Category header
    local isCollapsed = state.collapsed[cat.id]
    local chevron = isCollapsed and ">" or "v"

    state.catRects[cat.id] = { x = contentX, y = curY, w = contentW, h = SECTION_HEAD_H }

    setColor(C.sectionBg)
    love.graphics.rectangle("fill", contentX, curY, contentW, SECTION_HEAD_H)

    drawText(chevron, contentX + 10, curY + 7, fontSection, C.chevron)
    drawText(cat.label, contentX + 24, curY + 7, fontSection, C.sectionText)

    -- Configured count badge
    local catConfigured, catTotal = 0, 0
    for _, svc in ipairs(cat.services) do
      catTotal = catTotal + 1
      if isServiceConfigured(svc) then catConfigured = catConfigured + 1 end
    end
    local badge = catConfigured .. "/" .. catTotal
    local badgeW = fontStatus:getWidth(badge) + 12
    drawText(badge, contentX + contentW - badgeW - 8, curY + 8, fontStatus, C.sectionText)

    curY = curY + SECTION_HEAD_H

    if not isCollapsed then
      for _, svc in ipairs(cat.services) do
        -- Service header row
        local configured = isServiceConfigured(svc)
        local dotColor = configured and C.dotGreen or C.dotDim

        -- Status dot
        setColor(dotColor)
        love.graphics.circle("fill", contentX + 18, curY + SERVICE_HEAD_H / 2, 4)

        -- Service name
        drawText(svc.name, contentX + 30, curY + 5, fontLabel, C.serviceName)

        curY = curY + SERVICE_HEAD_H

        -- Auth fields
        if svc.auth and svc.auth.fields then
          for _, field in ipairs(svc.auth.fields) do
            local fk = fieldKey(svc.id, field.key)
            local editing = isEditing(svc.id, field.key)
            local isRevealed = state.revealed[fk]
            local isSecret = (field.secret ~= false)  -- default true

            -- Field label
            drawText(field.label, contentX + 36, curY + 6, fontLabel, C.fieldLabel, FIELD_LABEL_W - 10)

            -- Input box
            local inputX = contentX + 36 + FIELD_LABEL_W
            local inputW = contentW - 36 - FIELD_LABEL_W - 50 -- room for reveal btn
            local inputY = curY + 3

            state.fieldRects[fk] = { x = inputX, y = inputY, w = inputW, h = INPUT_H }

            -- Input background
            local borderColor = editing and C.inputFocus or
              (state.hoverField == fk and C.accent or C.inputBorder)
            setColor(C.inputBg)
            drawRoundedRect("fill", inputX, inputY, inputW, INPUT_H, 3)
            setColor(borderColor)
            love.graphics.setLineWidth(1)
            drawRoundedRect("line", inputX, inputY, inputW, INPUT_H, 3)

            -- Input text
            local displayText
            if editing then
              displayText = state.inputBuffer
            else
              displayText = state.keys[fk] or ""
            end

            if displayText == "" and not editing then
              -- Placeholder
              local ph = field.placeholder or ""
              drawText(ph, inputX + 4, inputY + 4, fontInput, C.placeholder, inputW - 8)
            else
              -- Mask or show
              local showText
              if isSecret and not isRevealed and not editing then
                showText = string.rep("*", math.min(#displayText, 24))
              else
                showText = displayText
              end
              drawText(showText, inputX + 4, inputY + 4, fontInput, C.inputText, inputW - 8)
            end

            -- Cursor (when editing)
            if editing then
              local blinkOn = state.cursorBlink < 0.5
              if blinkOn then
                local beforeCursor = state.inputBuffer:sub(1, state.cursor)
                local cursorX = inputX + 4 + fontInput:getWidth(beforeCursor)
                setColor(C.cursor)
                love.graphics.setLineWidth(1)
                love.graphics.line(cursorX, inputY + 3, cursorX, inputY + INPUT_H - 3)
              end
            end

            -- Reveal/hide toggle (eye icon, drawn as text for simplicity)
            if isSecret then
              local revX = inputX + inputW + 6
              local revY = inputY
              local revW, revH = 20, INPUT_H
              state.revealRects[fk] = { x = revX, y = revY, w = revW, h = revH }

              local revColor = state.hoverReveal == fk and C.revealHover or C.revealBtn
              local revText = isRevealed and "o" or "-"
              drawText(revText, revX + 4, revY + 4, fontLabel, revColor)
            end

            curY = curY + FIELD_ROW_H
          end
        end

        curY = curY + 4 -- spacing between services
      end
    end

    curY = curY + 4 -- spacing between categories
  end

  state.contentH = (curY + state.scrollY) - contentY
  state.maxScrollY = math.max(0, state.contentH - contentH)

  love.graphics.setScissor()

  -- ── Scrollbar ──
  if state.maxScrollY > 0 then
    local scrollbarX = p.x + p.w - 8
    local scrollbarY = contentY
    local scrollbarH = contentH
    local thumbRatio = contentH / state.contentH
    local thumbH = math.max(20, scrollbarH * thumbRatio)
    local thumbY = scrollbarY + (state.scrollY / state.maxScrollY) * (scrollbarH - thumbH)

    setColor(C.scrollbar)
    love.graphics.rectangle("fill", scrollbarX, scrollbarY, 6, scrollbarH, 3, 3)
    setColor(C.scrollthumb)
    love.graphics.rectangle("fill", scrollbarX, thumbY, 6, thumbH, 3, 3)
  end

  -- ── Status bar ──
  local statusY = p.y + p.h - STATUS_BAR_H
  setColor(C.statusBg)
  love.graphics.rectangle("fill", p.x, statusY, p.w, STATUS_BAR_H)
  setColor(C.border)
  love.graphics.line(p.x, statusY, p.x + p.w, statusY)

  local configured, total = countConfigured()
  local statusMsg = configured .. "/" .. total .. " services configured"
  drawText(statusMsg, p.x + 10, statusY + 5, fontStatus, C.statusText)

  local keyHint = "Press " .. state.toggleKey:upper() .. " to close"
  local hintW = fontStatus:getWidth(keyHint)
  drawText(keyHint, p.x + p.w - hintW - 10, statusY + 5, fontStatus, C.statusText)
end

-- ============================================================================
-- Hit testing
-- ============================================================================

local function pointInRect(px, py, r)
  if not r then return false end
  return px >= r.x and px <= r.x + r.w and py >= r.y and py <= r.y + r.h
end

-- ============================================================================
-- Input handling
-- ============================================================================

function Settings.keypressed(key)
  -- Toggle key always works
  if key == state.toggleKey then
    Settings.toggle()
    return true
  end

  if not state.open then return false end

  -- Escape: deselect field first, then close
  if key == "escape" then
    if state.activeField then
      stopEditing(true)
    else
      state.open = false
    end
    return true
  end

  -- If editing a field
  if state.activeField then
    if key == "return" then
      stopEditing(true)
      return true
    end

    if key == "backspace" then
      if state.cursor > 0 then
        state.inputBuffer = state.inputBuffer:sub(1, state.cursor - 1)
          .. state.inputBuffer:sub(state.cursor + 1)
        state.cursor = state.cursor - 1
      end
      state.cursorBlink = 0
      return true
    end

    if key == "delete" then
      if state.cursor < #state.inputBuffer then
        state.inputBuffer = state.inputBuffer:sub(1, state.cursor)
          .. state.inputBuffer:sub(state.cursor + 2)
      end
      state.cursorBlink = 0
      return true
    end

    if key == "left" then
      if state.cursor > 0 then state.cursor = state.cursor - 1 end
      state.cursorBlink = 0
      return true
    end

    if key == "right" then
      if state.cursor < #state.inputBuffer then state.cursor = state.cursor + 1 end
      state.cursorBlink = 0
      return true
    end

    if key == "home" then
      state.cursor = 0
      state.cursorBlink = 0
      return true
    end

    if key == "end" then
      state.cursor = #state.inputBuffer
      state.cursorBlink = 0
      return true
    end

    -- Ctrl+A select all (just move cursor to end for now)
    if key == "a" and love.keyboard.isDown("lctrl", "rctrl") then
      state.cursor = #state.inputBuffer
      state.cursorBlink = 0
      return true
    end

    -- Ctrl+V paste
    if key == "v" and love.keyboard.isDown("lctrl", "rctrl") then
      local clipboard = love.system.getClipboardText() or ""
      -- Strip newlines
      clipboard = clipboard:gsub("\n", ""):gsub("\r", "")
      state.inputBuffer = state.inputBuffer:sub(1, state.cursor)
        .. clipboard
        .. state.inputBuffer:sub(state.cursor + 1)
      state.cursor = state.cursor + #clipboard
      state.cursorBlink = 0
      return true
    end

    -- Tab: save and move to next field
    if key == "tab" then
      stopEditing(true)
      -- Find next field
      local allFields = {}
      for _, cat in ipairs(state.categories) do
        if not state.collapsed[cat.id] then
          for _, svc in ipairs(cat.services) do
            if svc.auth and svc.auth.fields then
              for _, f in ipairs(svc.auth.fields) do
                table.insert(allFields, { serviceId = svc.id, fieldKey = f.key })
              end
            end
          end
        end
      end

      local currentIdx = nil
      for i, af in ipairs(allFields) do
        if state.activeField
          and af.serviceId == state.activeField.serviceId
          and af.fieldKey == state.activeField.fieldKey then
          currentIdx = i
          break
        end
      end

      -- Tricky: activeField was just cleared by stopEditing. Use captured value.
      -- Actually let's find next based on where we just were.
      if currentIdx then
        local shift = love.keyboard.isDown("lshift", "rshift")
        local nextIdx = shift and (currentIdx - 1) or (currentIdx + 1)
        if nextIdx >= 1 and nextIdx <= #allFields then
          local next = allFields[nextIdx]
          startEditing(next.serviceId, next.fieldKey)
        end
      end
      return true
    end

    -- Consume all other keys when editing
    return true
  end

  -- Not editing — consume keys to prevent pass-through
  return true
end

function Settings.textinput(text)
  if not state.open then return false end
  if not state.activeField then return true end  -- consume but ignore

  -- Don't insert the toggle key character
  if text == state.toggleKey then return true end

  state.inputBuffer = state.inputBuffer:sub(1, state.cursor)
    .. text
    .. state.inputBuffer:sub(state.cursor + 1)
  state.cursor = state.cursor + #text
  state.cursorBlink = 0
  return true
end

function Settings.mousepressed(x, y, button)
  if not state.open then return false end
  if button ~= 1 then return true end

  local p = state.panelRect
  if not p then return true end

  -- Click outside panel = close
  if not pointInRect(x, y, p) then
    stopEditing(true)
    state.open = false
    return true
  end

  -- Close button
  if pointInRect(x, y, state.closeRect) then
    stopEditing(true)
    state.open = false
    return true
  end

  -- Category collapse toggles
  for catId, rect in pairs(state.catRects) do
    if pointInRect(x, y, rect) then
      state.collapsed[catId] = not state.collapsed[catId]
      return true
    end
  end

  -- Reveal toggles
  for fk, rect in pairs(state.revealRects) do
    if pointInRect(x, y, rect) then
      state.revealed[fk] = not state.revealed[fk]
      return true
    end
  end

  -- Field clicks
  for fk, rect in pairs(state.fieldRects) do
    if pointInRect(x, y, rect) then
      -- Parse serviceId and fieldKey from composite key
      local dot = fk:find("%.")
      if dot then
        local svcId = fk:sub(1, dot - 1)
        local fKey = fk:sub(dot + 1)
        -- Save any current edit
        if state.activeField then stopEditing(true) end
        startEditing(svcId, fKey)
      end
      return true
    end
  end

  -- Click somewhere else in panel: deselect
  if state.activeField then
    stopEditing(true)
  end

  return true
end

function Settings.mousereleased(x, y, button)
  if not state.open then return false end
  return true
end

function Settings.mousemoved(x, y)
  if not state.open then return false end

  -- Update hover states
  state.hoverClose = pointInRect(x, y, state.closeRect)
  state.hoverField = nil
  state.hoverReveal = nil

  for fk, rect in pairs(state.fieldRects) do
    if pointInRect(x, y, rect) then
      state.hoverField = fk
      break
    end
  end

  for fk, rect in pairs(state.revealRects) do
    if pointInRect(x, y, rect) then
      state.hoverReveal = fk
      break
    end
  end

  return true  -- consume mouse movement when open
end

function Settings.wheelmoved(x, y)
  if not state.open then return false end

  state.scrollY = state.scrollY - y * SCROLL_SPEED
  state.scrollY = math.max(0, math.min(state.scrollY, state.maxScrollY))
  return true
end

-- ============================================================================
-- Public API
-- ============================================================================

function Settings.init(config)
  config = config or {}
  state.toggleKey = config.key or "f10"
  state.keys = loadKeys()
  -- Load built-in services immediately — no bridge needed
  Settings.setServices(BUILTIN_SERVICES)
end

function Settings.isOpen()
  return state.open
end

function Settings.toggle()
  if state.open then
    stopEditing(true)
    state.open = false
  else
    state.open = true
    state.scrollY = 0
    state.cursorBlink = 0
  end
end

function Settings.setServices(services)
  state.services = services or {}
  state.categories = buildCategories(state.services)
end

function Settings.getKeys()
  return state.keys
end

function Settings.getKey(serviceId, fieldKey)
  return state.keys[fieldKey and (serviceId .. "." .. fieldKey) or serviceId]
end

function Settings.setKey(serviceId, fKey, value)
  state.keys[fieldKey(serviceId, fKey)] = value
  state.dirty = true
  state.saveTimer = 0.1
end

return Settings
