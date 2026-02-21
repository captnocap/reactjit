--[[
  renderer.lua — Frame-to-buffer renderer for ReactJIT Neovim target.

  Receives a JSON draw command array and renders it into a Neovim buffer
  using buffer lines and extmark highlights.
]]

local highlights = require("reactjit.highlights")

local M = {}

--- Render a frame (array of draw commands) into a Neovim buffer.
--- @param buf number Buffer handle
--- @param frame table Array of draw commands from the render server
--- @param width number Buffer width in columns
--- @param height number Buffer height in rows
function M.render(buf, frame, width, height)
  if not vim.api.nvim_buf_is_valid(buf) then return end

  local ns = highlights.get_namespace()

  -- Build a grid of characters and background colors
  local lines = {}
  for row = 1, height do
    lines[row] = string.rep(" ", width)
  end

  -- Clear previous extmarks
  vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)

  -- Set buffer lines
  vim.api.nvim_buf_set_option(buf, "modifiable", true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  -- Apply draw commands
  for _, cmd in ipairs(frame) do
    local x = cmd.x or 0
    local y = cmd.y or 0
    local w = cmd.w or 0
    local h = cmd.h or 1

    -- Background fill: apply highlight to region
    if cmd.bg and not cmd.text then
      local hl = highlights.get_or_create(nil, cmd.bg)
      for row = y, math.min(y + h - 1, height - 1) do
        vim.api.nvim_buf_set_extmark(buf, ns, row, x, {
          end_row = row,
          end_col = math.min(x + w, width),
          hl_group = hl,
        })
      end
    end

    -- Text: write into buffer and apply fg/bg highlight
    if cmd.text then
      local row = y
      if row >= 0 and row < height then
        local text = cmd.text
        local col_start = x
        local col_end = math.min(x + #text, width)
        text = text:sub(1, col_end - col_start)

        -- Replace characters in the line
        local line = lines[row + 1] or string.rep(" ", width)
        local before = line:sub(1, col_start)
        local after = line:sub(col_end + 1)
        lines[row + 1] = before .. text .. after

        -- Apply highlight
        local hl = highlights.get_or_create(cmd.fg, cmd.bg)
        vim.api.nvim_buf_set_extmark(buf, ns, row, col_start, {
          end_row = row,
          end_col = col_end,
          hl_group = hl,
        })
      end
    end
  end

  -- Update buffer with text changes
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.api.nvim_buf_set_option(buf, "modifiable", false)
end

return M
