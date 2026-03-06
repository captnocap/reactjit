--[[
  devtools/tab_logs.lua — Logs tab: debug log channel toggle grid

  Extracted from devtools/main.lua. Displays a scrollable grid of debug log
  channels with toggle pills, plus HMR settings.

  Usage:
    local LogsTab = require("lua.devtools.tab_logs")

    -- Drawing and input:
    LogsTab.draw(ctx, region)
    LogsTab.mousepressed(ctx, x, y, button, region)
    LogsTab.mousemoved(ctx, x, y, region)
    LogsTab.wheelmoved(ctx, x, y)

  The `ctx` table must provide:
    ctx.bridge           — QuickJS bridge (for JS channel sync)
    ctx.getFont          — function() returning a Love2D font (size 11)
    ctx.drawScrollbar    — function(rx, ry, rw, rh, scrollY, contentH)

  Scroll state accessors (for scrollbar drag in main.lua):
    LogsTab.getScrollState()   — returns { scrollY, contentH, region }
    LogsTab.setScrollY(value)  — set scroll position (from drag)
    LogsTab.resetState()       — reset scroll and rebuild channel list
]]

local Style = require("lua.devtools.style")
local Log   = require("lua.debug_log")
local HotState = require("lua.hotstate")

local M = {}

-- ============================================================================
-- Constants
-- ============================================================================

local LOG_ROW_H     = 32
local LOG_TOGGLE_W  = 40
local LOG_PAD_X     = 16
local LOG_PAD_Y     = 12
local LOG_HEADER_H  = 36
local LOG_BTN_H     = 28
local LOG_BTN_PAD   = 6

-- ============================================================================
-- Module-local state
-- ============================================================================

local sortedChannels = nil
local logsScrollY    = 0
local logsRegion     = nil
local logsContentHStored = 0
local logsHoverRow   = nil  -- index into sortedChannels, or "all"/"none"/"hmr_state"

-- ============================================================================
-- Helpers
-- ============================================================================

local function getSortedChannels()
  if not sortedChannels then
    sortedChannels = {}
    for name in pairs(Log.CHANNELS) do
      sortedChannels[#sortedChannels + 1] = name
    end
    table.sort(sortedChannels)
  end
  return sortedChannels
end

--- Toggle a channel (handles JS-side sync for recon/dispatch).
local function toggleChannel(name, bridge)
  Log.toggle(name)
  local jsChannels = { recon = true, dispatch = true }
  if jsChannels[name] and bridge then
    pcall(function() bridge:eval("if(typeof __debugLog!=='undefined')__debugLog.toggle('" .. name .. "')") end)
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Return scroll state for scrollbar drag handling in main.lua.
function M.getScrollState()
  return {
    scrollY  = logsScrollY,
    contentH = logsContentHStored,
    region   = logsRegion,
  }
end

--- Set scroll position (called from scrollbar drag in main.lua).
function M.setScrollY(value)
  logsScrollY = value
end

--- Reset state (called on refresh).
function M.resetState()
  sortedChannels = nil
  logsScrollY = 0
end

--- Clear hover state (called when tab is not active).
function M.clearHover()
  logsHoverRow = nil
end

--- Draw the logs tab content.
function M.draw(ctx, region)
  logsRegion = region

  local font = ctx.getFont()
  love.graphics.setFont(font)
  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  -- Opaque background
  love.graphics.setColor(Style.logs.bg)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)

  local channels = getSortedChannels()
  local fh = font:getHeight()
  local x0 = region.x + LOG_PAD_X
  local y0 = region.y + LOG_PAD_Y - logsScrollY

  -- Header
  love.graphics.setColor(Style.logs.header)
  love.graphics.print("Debug Log Channels", x0, y0 + math.floor((LOG_HEADER_H - fh) / 2))

  -- All / None buttons (right-aligned in header)
  local btnW = font:getWidth("All") + 16
  local noneW = font:getWidth("None") + 16
  local btnY = y0 + math.floor((LOG_HEADER_H - LOG_BTN_H) / 2)
  local noneX = region.x + region.w - LOG_PAD_X - noneW
  local allX = noneX - btnW - LOG_BTN_PAD

  -- "All" button
  love.graphics.setColor(logsHoverRow == "all" and Style.logs.buttonHover or Style.logs.buttonBg)
  love.graphics.rectangle("fill", allX, btnY, btnW, LOG_BTN_H, 4, 4)
  love.graphics.setColor(Style.logs.buttonText)
  love.graphics.print("All", allX + 8, btnY + math.floor((LOG_BTN_H - fh) / 2))

  -- "None" button
  love.graphics.setColor(logsHoverRow == "none" and Style.logs.buttonHover or Style.logs.buttonBg)
  love.graphics.rectangle("fill", noneX, btnY, noneW, LOG_BTN_H, 4, 4)
  love.graphics.setColor(Style.logs.buttonText)
  love.graphics.print("None", noneX + 8, btnY + math.floor((LOG_BTN_H - fh) / 2))

  -- Channel rows
  local rowY = y0 + LOG_HEADER_H

  for i, name in ipairs(channels) do
    local chDef = Log.CHANNELS[name]
    local isOn = Log.isOn(name)
    local isHovered = logsHoverRow == i

    -- Row background (subtle highlight on hover)
    if isHovered then
      love.graphics.setColor(0.10, 0.12, 0.18, 1)
      love.graphics.rectangle("fill", region.x, rowY, region.w, LOG_ROW_H)
    end

    -- Toggle pill
    local pillX = x0
    local pillY = rowY + math.floor((LOG_ROW_H - 18) / 2)
    local pillW = LOG_TOGGLE_W
    local pillH = 18
    local pillR = 9

    love.graphics.setColor(isOn and Style.logs.onBg or Style.logs.offBg)
    love.graphics.rectangle("fill", pillX, pillY, pillW, pillH, pillR, pillR)

    -- Toggle dot
    local dotR = 6
    local dotX = isOn and (pillX + pillW - dotR - 4) or (pillX + dotR + 4)
    local dotY = pillY + pillH / 2
    love.graphics.setColor(isOn and Style.logs.onDot or Style.logs.offDot)
    love.graphics.circle("fill", dotX, dotY, dotR)

    -- Channel name (use channel's own color when on)
    local nameX = pillX + pillW + 12
    love.graphics.setColor(isOn and chDef.color or Style.logs.name)
    love.graphics.print(name, nameX, rowY + math.floor((LOG_ROW_H - fh) / 2))

    -- Description
    local descX = nameX + font:getWidth(name) + 16
    love.graphics.setColor(Style.logs.desc)
    local desc = chDef.desc
    -- Truncate if too long
    local maxDescW = region.x + region.w - descX - LOG_PAD_X
    if maxDescW > 0 then
      while font:getWidth(desc) > maxDescW and #desc > 3 do
        desc = desc:sub(1, -2)
      end
      love.graphics.print(desc, descX, rowY + math.floor((LOG_ROW_H - fh) / 2))
    end

    rowY = rowY + LOG_ROW_H
  end

  -- HMR Settings section
  rowY = rowY + 8
  love.graphics.setColor(Style.logs.divider)
  love.graphics.rectangle("fill", x0, rowY, region.w - LOG_PAD_X * 2, 1)
  rowY = rowY + 8

  love.graphics.setColor(Style.logs.header)
  love.graphics.print("HMR Settings", x0, rowY + math.floor((LOG_HEADER_H - fh) / 2))
  rowY = rowY + LOG_HEADER_H

  -- HMR State Preservation toggle
  local hmrOn = HotState.isEnabled()
  local hmrIsHovered = logsHoverRow == "hmr_state"

  if hmrIsHovered then
    love.graphics.setColor(0.10, 0.12, 0.18, 1)
    love.graphics.rectangle("fill", region.x, rowY, region.w, LOG_ROW_H)
  end

  local hmrPillX = x0
  local hmrPillY = rowY + math.floor((LOG_ROW_H - 18) / 2)
  local hmrPillW = LOG_TOGGLE_W
  local hmrPillH = 18
  local hmrPillR = 9

  love.graphics.setColor(hmrOn and Style.logs.onBg or Style.logs.offBg)
  love.graphics.rectangle("fill", hmrPillX, hmrPillY, hmrPillW, hmrPillH, hmrPillR, hmrPillR)

  local hmrDotR = 6
  local hmrDotX = hmrOn and (hmrPillX + hmrPillW - hmrDotR - 4) or (hmrPillX + hmrDotR + 4)
  local hmrDotY = hmrPillY + hmrPillH / 2
  love.graphics.setColor(hmrOn and Style.logs.onDot or Style.logs.offDot)
  love.graphics.circle("fill", hmrDotX, hmrDotY, hmrDotR)

  local hmrNameX = hmrPillX + hmrPillW + 12
  love.graphics.setColor(hmrOn and { 0.38, 0.82, 0.98, 1 } or Style.logs.name)
  love.graphics.print("State Preservation", hmrNameX, rowY + math.floor((LOG_ROW_H - fh) / 2))

  local hmrDescX = hmrNameX + font:getWidth("State Preservation") + 16
  love.graphics.setColor(Style.logs.desc)
  local hmrDesc = hmrOn and "useState survives hot reload" or "useState resets on hot reload"
  local hmrMaxW = region.x + region.w - hmrDescX - LOG_PAD_X
  if hmrMaxW > 0 then
    love.graphics.print(hmrDesc, hmrDescX, rowY + math.floor((LOG_ROW_H - fh) / 2))
  end

  rowY = rowY + LOG_ROW_H

  -- Hint at bottom
  local hintY = rowY + 8
  if hintY + fh < region.y + region.h + logsScrollY then
    love.graphics.setColor(0.35, 0.38, 0.45, 1)
    love.graphics.print("Tip: REACTJIT_DEBUG=tree,layout love love  (enable at startup)", x0, hintY)
    love.graphics.print("Output goes to terminal AND console tab", x0, hintY + fh + 2)
  end

  local logsContentH = LOG_PAD_Y + LOG_HEADER_H + #channels * LOG_ROW_H + 16 + 1 + 8 + LOG_HEADER_H + LOG_ROW_H + 30
  logsContentHStored = logsContentH
  ctx.drawScrollbar(region.x, region.y, region.w, region.h, logsScrollY, logsContentH)
  love.graphics.setScissor()
end

--- Handle click on logs tab. Returns true if consumed.
function M.mousepressed(ctx, x, y, button, region)
  if button ~= 1 then return false end
  if x < region.x or x > region.x + region.w then return false end
  if y < region.y or y > region.y + region.h then return false end

  local bridge = ctx.bridge
  local font = ctx.getFont()
  local fh = font:getHeight()
  local x0 = region.x + LOG_PAD_X
  local y0 = region.y + LOG_PAD_Y - logsScrollY
  local channels = getSortedChannels()

  -- Check All/None buttons
  local btnW = font:getWidth("All") + 16
  local noneW = font:getWidth("None") + 16
  local btnY = y0 + math.floor((LOG_HEADER_H - LOG_BTN_H) / 2)
  local noneX = region.x + region.w - LOG_PAD_X - noneW
  local allX = noneX - btnW - LOG_BTN_PAD

  if y >= btnY and y < btnY + LOG_BTN_H then
    if x >= allX and x < allX + btnW then
      Log.all(true)
      if bridge then
        pcall(function() bridge:eval("if(typeof __debugLog!=='undefined')__debugLog.all(true)") end)
      end
      return true
    end
    if x >= noneX and x < noneX + noneW then
      Log.all(false)
      if bridge then
        pcall(function() bridge:eval("if(typeof __debugLog!=='undefined')__debugLog.all(false)") end)
      end
      return true
    end
  end

  -- Check channel rows
  local rowY = y0 + LOG_HEADER_H
  for i, name in ipairs(channels) do
    if y >= rowY and y < rowY + LOG_ROW_H then
      toggleChannel(name, bridge)
      return true
    end
    rowY = rowY + LOG_ROW_H
  end

  -- HMR Settings section: divider(8+1+8) + header(LOG_HEADER_H) + toggle row
  local hmrRowY = rowY + 8 + 1 + 8 + LOG_HEADER_H
  if y >= hmrRowY and y < hmrRowY + LOG_ROW_H then
    HotState.setEnabled(not HotState.isEnabled())
    if bridge then
      if HotState.isEnabled() then
        pcall(function() bridge:eval("if(typeof __enableStatePreservation==='function')__enableStatePreservation()") end)
      else
        pcall(function() bridge:eval("if(typeof __disableStatePreservation==='function')__disableStatePreservation()") end)
      end
    end
    return true
  end

  return true
end

--- Handle mouse movement on logs tab for hover effects.
function M.mousemoved(ctx, x, y, region)
  logsHoverRow = nil
  if not region then return end
  if x < region.x or x > region.x + region.w then return end
  if y < region.y or y > region.y + region.h then return end

  local font = ctx.getFont()
  local y0 = region.y + LOG_PAD_Y - logsScrollY
  local channels = getSortedChannels()

  -- Check All/None buttons
  local btnW = font:getWidth("All") + 16
  local noneW = font:getWidth("None") + 16
  local btnY = y0 + math.floor((LOG_HEADER_H - LOG_BTN_H) / 2)
  local noneX = region.x + region.w - LOG_PAD_X - noneW
  local allX = noneX - btnW - LOG_BTN_PAD

  if y >= btnY and y < btnY + LOG_BTN_H then
    if x >= allX and x < allX + btnW then
      logsHoverRow = "all"; return
    end
    if x >= noneX and x < noneX + noneW then
      logsHoverRow = "none"; return
    end
  end

  -- Check channel rows
  local rowY = y0 + LOG_HEADER_H
  for i, name in ipairs(channels) do
    if y >= rowY and y < rowY + LOG_ROW_H then
      logsHoverRow = i; return
    end
    rowY = rowY + LOG_ROW_H
  end

  -- HMR Settings toggle row
  local hmrRowY = rowY + 8 + 1 + 8 + LOG_HEADER_H
  if y >= hmrRowY and y < hmrRowY + LOG_ROW_H then
    logsHoverRow = "hmr_state"; return
  end
end

--- Handle wheel scroll on logs tab.
function M.wheelmoved(ctx, x, y)
  -- Map horizontal tilt to vertical scroll when no vertical input
  local dy = y
  if dy == 0 and x ~= 0 then dy = x end
  logsScrollY = math.max(0, logsScrollY - dy * 20)
  -- Clamp to content height (use stored value from draw)
  if logsRegion and logsContentHStored > 0 then
    local maxScroll = math.max(0, logsContentHStored - logsRegion.h)
    logsScrollY = math.min(logsScrollY, maxScroll)
  end
  return true
end

return M
