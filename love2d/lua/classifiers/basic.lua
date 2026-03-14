--[[
  classifiers/basic.lua — Minimal semantic classifier for any CLI

  This is the floor. Five tokens. Works for any shell session by detecting
  common text patterns: commands ($ or > prefix), errors (red or "error:"),
  success markers, headings, and separators. Everything else is "output."

  Use this as a starting point. Someone who knows a specific CLI will write
  a better classifier that produces richer tokens. This one proves the
  contract works with the absolute minimum.

  Usage:
    local classifier = require("lua.classifiers.basic")
    local kind = classifier.classifyRow(text, row, totalRows)
]]

return {
  name = "basic",
  version = "1.0",
  cli = "*",
  description = "Minimal classifier for any shell — error, success, command, heading, separator, progress, output",

  -- Token vocabulary
  tokens = { "error", "success", "command", "heading", "separator", "progress", "output" },

  -- Classify a single row of terminal text
  classifyRow = function(text, row, totalRows)
    local stripped = text:match("^%s*(.-)%s*$") or ""
    if #stripped == 0 then return "output" end

    -- Separator: lines made entirely of ─, ═, -, =, *, ~, or box-drawing chars
    if stripped:match("^[─═%-=~%*_╌╍┄┅┈┉]+$") then return "separator" end
    if stripped:match("^[╭╮╰╯┌┐└┘│├┤┬┴┼─]+$") then return "separator" end

    -- Error patterns
    if text:match("^%s*[Ee]rror[:%[]") then return "error" end
    if text:match("^%s*[Ff]ailed") then return "error" end
    if text:match("^%s*FAIL") then return "error" end
    if text:match("^%s*panic:") then return "error" end
    if text:match("^%s*fatal:") then return "error" end
    if text:match("^%s*[Ee]xception:") then return "error" end
    if text:match("^%s*✗") or text:match("^%s*✘") then return "error" end

    -- Success patterns
    if text:match("^%s*[Dd]one") then return "success" end
    if text:match("^%s*OK") then return "success" end
    if text:match("^%s*PASS") then return "success" end
    if text:match("^%s*[Ss]uccess") then return "success" end
    if text:match("^%s*✓") or text:match("^%s*✔") then return "success" end

    -- Progress: percentage, ETA, spinner-like patterns
    if text:match("%d+%%") then return "progress" end
    if text:match("ETA") or text:match("eta") then return "progress" end
    if text:match("%.%.%.%s*$") then return "progress" end

    -- Command: shell prompt patterns ($ or > prefix with text after)
    if text:match("^%s*%$%s+.") then return "command" end
    if text:match("^%s*>%s+.") then return "command" end
    if text:match("^%s*#%s+.") and row <= 3 then return "heading" end
    -- Prompt patterns: user@host:path$
    if text:match("%w+@%w+[:%~].-[%$#]%s+.") then return "command" end

    -- Heading: capitalized short lines, === or --- underlines
    if #stripped < 60 and stripped:match("^[A-Z][A-Z%s%-_:]+$") then return "heading" end
    if stripped:match("^=+$") or stripped:match("^%-%-%-+$") then return "heading" end

    return "output"
  end,

  -- A command starts a new "turn"
  isTurnStart = function(kind)
    return kind == "command"
  end,

  -- Block types: consecutive rows of same kind share one nodeId
  blockTypes = {
    output = true, error = true, success = true,
  },

  -- No interactive groups in basic mode
  groupTypes = {},
}
