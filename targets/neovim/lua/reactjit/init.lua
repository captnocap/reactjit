--[[
  reactjit — Neovim plugin for ReactJIT

  Renders React UIs in Neovim floating windows.
  Spawns a Node.js process that outputs newline-delimited JSON draw commands
  to stdout, then renders them into a buffer with highlight groups.

  Usage:
    require("reactjit").setup({
      entry = "path/to/dist/main.js",
      width = 60,
      height = 20,
    })
]]

local renderer = require("reactjit.renderer")
local highlights = require("reactjit.highlights")

local M = {}

local state = {
  buf = nil,
  win = nil,
  job = nil,
}

--- Start the ReactJIT render server and display a floating window.
--- @param opts table Options: entry (string, path to JS entry), width (number), height (number), row (number), col (number)
function M.setup(opts)
  opts = opts or {}
  local entry = opts.entry or "dist/main.js"
  local width = opts.width or 60
  local height = opts.height or 20
  local row = opts.row or 2
  local col = opts.col or 10

  -- Initialize highlights namespace
  highlights.init()

  -- Create buffer
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(buf, "bufhidden", "wipe")

  -- Create floating window
  local win = vim.api.nvim_open_win(buf, false, {
    relative = "editor",
    width = width,
    height = height,
    row = row,
    col = col,
    style = "minimal",
    border = "rounded",
  })

  state.buf = buf
  state.win = win

  -- Accumulate partial lines from stdout
  local partial = ""

  -- Spawn Node.js process
  local job = vim.fn.jobstart({ "node", entry }, {
    on_stdout = function(_, data, _)
      for _, chunk in ipairs(data) do
        partial = partial .. chunk
        -- Process complete newline-delimited lines
        while true do
          local nl = partial:find("\n")
          if not nl then break end
          local line = partial:sub(1, nl - 1)
          partial = partial:sub(nl + 1)
          if line ~= "" then
            local ok, frame = pcall(vim.json.decode, line)
            if ok and type(frame) == "table" then
              vim.schedule(function()
                renderer.render(buf, frame, width, height)
              end)
            end
          end
        end
      end
    end,
    on_stderr = function(_, data, _)
      for _, line in ipairs(data) do
        if line ~= "" then
          vim.schedule(function()
            vim.notify("[reactjit] " .. line, vim.log.levels.WARN)
          end)
        end
      end
    end,
    on_exit = function(_, code, _)
      vim.schedule(function()
        if state.win and vim.api.nvim_win_is_valid(state.win) then
          vim.api.nvim_win_close(state.win, true)
        end
        state.buf = nil
        state.win = nil
        state.job = nil
        if code ~= 0 then
          vim.notify("[reactjit] Process exited with code " .. code, vim.log.levels.ERROR)
        end
      end)
    end,
    stdout_buffered = false,
    stderr_buffered = false,
  })

  if job <= 0 then
    vim.notify("[reactjit] Failed to start process: node " .. entry, vim.log.levels.ERROR)
    vim.api.nvim_win_close(win, true)
    vim.api.nvim_buf_delete(buf, { force = true })
    return nil
  end

  state.job = job

  return {
    close = function()
      M.close()
    end,
  }
end

--- Close the ReactJIT window and stop the render server.
function M.close()
  if state.job then
    vim.fn.jobstop(state.job)
    state.job = nil
  end
  if state.win and vim.api.nvim_win_is_valid(state.win) then
    vim.api.nvim_win_close(state.win, true)
  end
  state.win = nil
  state.buf = nil
  highlights.clear()
end

return M
