--[[
  highlights.lua — Dynamic highlight group cache for ReactJIT Neovim target.

  Creates and caches Neovim highlight groups on demand.
  Each unique fg/bg combination gets a named highlight group ILR_<fg>_<bg>.
  Supports 24-bit color via guifg/guibg.
]]

local M = {}

local cache = {}
local ns_id = nil

function M.init()
  ns_id = vim.api.nvim_create_namespace("reactjit")
  cache = {}
  return ns_id
end

function M.get_namespace()
  return ns_id
end

--- Get or create a highlight group for the given fg/bg CSS color pair.
--- @param fg string|nil CSS hex color for foreground (e.g., "#FFFFFF")
--- @param bg string|nil CSS hex color for background (e.g., "#3366CC")
--- @return string highlight group name
function M.get_or_create(fg, bg)
  local key = (fg or "NONE") .. "_" .. (bg or "NONE")
  if cache[key] then
    return cache[key]
  end

  local name = "ILR_" .. key:gsub("#", ""):gsub("_", "_")
  local hl = {}
  if fg and fg ~= "NONE" then hl.fg = fg end
  if bg and bg ~= "NONE" then hl.bg = bg end

  vim.api.nvim_set_hl(0, name, hl)
  cache[key] = name
  return name
end

--- Clear all cached highlight groups.
function M.clear()
  cache = {}
end

return M
