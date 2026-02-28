--[[
  classifiers/claude_code.lua — Semantic classifier for the Claude Code CLI

  The reference implementation. 25+ tokens covering every UI element Claude Code
  produces: conversation turns, tool calls, thinking indicators, permission gates,
  menus, pickers, task lists, diffs, plan mode, and all the chrome.

  This classifier was built by staring at Claude Code output for hundreds of hours.
  It knows every transition state, every Unicode prefix character, every color-based
  reclassification rule. It is the proof that a CLI can be fully semantically mapped.

  Usage:
    local classifier = require("lua.classifiers.claude_code")
    local kind, extra1, extra2 = classifier.classifyRow(text, row, totalRows)

  The classifier also provides adjacency refinement, turn detection, group types,
  and block types — everything the SemanticTerminal needs to build a complete
  semantic graph of a Claude Code session.
]]

local M = {}

M.name = "claude_code"
M.version = "1.0"
M.cli = "claude"
M.description = "Full semantic classifier for the Claude Code CLI — 25+ tokens covering all UI states"

-- ── Token vocabulary ─────────────────────────────────────────────

M.tokens = {
  -- Conversation
  "user_prompt", "user_text", "user_input",
  "thinking", "thought_complete",
  "assistant_text",
  "tool", "result",
  "diff", "error",
  -- Chrome
  "banner", "status_bar", "idle_prompt",
  "input_border", "input_zone",
  "box_drawing",
  -- Interactive
  "menu_title", "menu_option", "menu_desc",
  "list_selectable", "list_selected", "list_info",
  "search_box", "selector", "confirmation", "hint",
  "picker_title", "picker_item", "picker_selected", "picker_meta",
  "permission",
  -- Plan mode
  "plan_border", "plan_mode", "wizard_step",
  -- Tasks
  "task_summary", "task_done", "task_open", "task_active",
  -- Other
  "slash_menu", "image_attachment",
}

-- ── Row classification ───────────────────────────────────────────

function M.classifyRow(text, row, totalRows)
  -- Permission prompt
  local action, target = text:match("Do you want to (%w+)%s+(.-)%?")
  if action then return "permission", action, target end

  -- Numbered menu/selection options
  if text:match("^%s*[>]?%s*%d+%.%s+") then return "menu_option" end
  if text:find("\xe2\x9d\xaf", 1, true) then
    local pos = text:find("\xe2\x9d\xaf", 1, true)
    local after = text:sub(pos + 3):gsub("^\194\160", ""):gsub("^%s+", "")
    if after:match("^%d+%.%s") then return "menu_option" end
  end

  -- Banner / version
  if text:find("Claude Code v%d", 1, false) then return "banner" end
  if row <= 5 and text:find("Claude Code", 1, true) then return "banner" end

  -- Model indicator in splash area
  if row <= 5 and (text:match("Opus [%d%.]+") or text:match("Sonnet [%d%.]+") or text:match("Haiku [%d%.]+")) then
    return "banner"
  end

  -- Banner: working directory
  if row <= 5 and text:find("~/", 1, true) then return "banner" end

  -- Interactive menu elements
  if text:find("\xe2\x86\x90 \xe2\x86\x92", 1, true) or text:find("to adjust", 1, true) then return "selector" end
  if text:find("Enter to confirm", 1, true) then return "confirmation" end
  if text:match("^%s*Select%s+") then return "menu_title" end

  -- Picker titles
  if text:match("^%s*Resume Session") then return "picker_title" end

  -- Picker metadata
  if text:match("%d+%s+%a+ ago") and text:find("\xc2\xb7", 1, true) then return "picker_meta" end

  -- Status bar
  if text:match("%d+%s*tokens") or text:match("%$%d") then return "status_bar" end
  if text:find("for shortcuts", 1, true) or text:find("for short", 1, true)
     or text:find("esc to interrupt", 1, true) then return "status_bar" end

  -- Idle prompt
  if row >= totalRows - 8 then
    local stripped = text:match("^%s*(.-)%s*$")
    if stripped == "\xe2\x9d\xaf" or stripped == ">" then return "idle_prompt" end
  end

  -- User prompt
  if text:find("\xe2\x9d\xaf", 1, true) and not text:find("Imagining", 1, true) then
    local pos = text:find("\xe2\x9d\xaf", 1, true)
    local rest = text:sub(pos + 3):gsub("^\194\160", ""):gsub("^%s+", "")
    if #rest > 0 then return "user_prompt" end
  end
  if text:match("^> .") then return "user_prompt" end

  -- Thought complete
  if text:find("\xe2\x9c\xbb", 1, true) then return "thought_complete" end

  -- Task active (live progress)
  if text:find("\xe2\x80\xa6", 1, true) and (text:find("\xc2\xb7 \xe2\x86\x93", 1, true) or text:find("tokens", 1, true)) then
    return "task_active"
  end

  -- Task summary
  if text:match("%d+%s+tasks?%s*%(") then return "task_summary" end

  -- Task done / open
  if text:find("\xe2\x9c\x94", 1, true) then return "task_done" end
  if text:find("\xe2\x97\xbb", 1, true) then return "task_open" end

  -- Thinking
  if text:find("Imagining", 1, true) or text:find("Thinking", 1, true) then
    return "thinking"
  end

  -- Plan mode transitions
  if text:find("Entered plan mode", 1, true) or text:find("Exited plan mode", 1, true) then return "plan_mode" end
  if text:find("exploring and designing", 1, true) or text:find("now exploring", 1, true) then return "plan_mode" end

  -- Tool use
  local hasBullet = text:find("\xe2\x97\x8f ", 1, true) or text:find("\xe2\x80\xa2 ", 1, true) or text:find("\xe2\x97\x86 ", 1, true)
  if hasBullet and text:match("[\xe2\x97\x8f\xe2\x80\xa2\xe2\x97\x86]%s+%a+%(") then return "tool" end

  -- Diff lines
  if text:match("^%+") or text:match("^%-") then return "diff" end

  -- Image attachment
  if text:find("\xe2\x8e\xbf", 1, true) and text:find("[Image", 1, true) then return "image_attachment" end

  -- Result bracket
  if text:find("\xe2\x8e\xbf", 1, true) then return "result" end

  -- Box drawing
  if text:find("\xe2\x94\x8c", 1, true) or text:find("\xe2\x95\xad", 1, true)
     or text:find("\xe2\x94\x82", 1, true)
     or text:find("\xe2\x94\x94", 1, true) or text:find("\xe2\x95\xb0", 1, true) then
    return "box_drawing"
  end
  local stripped = text:match("^%s*(.-)%s*$")
  if stripped:find("\xe2\x95\x8c\xe2\x95\x8c\xe2\x95\x8c", 1, true) then return "plan_border" end
  if stripped:find("\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80", 1, true) then return "box_drawing" end

  -- Wizard step
  if text:find("\xe2\x96\xa1", 1, true) and (text:find("\xe2\x86\x90", 1, true) or text:find("\xe2\x86\x92", 1, true)) then
    return "wizard_step"
  end

  -- Image attachment standalone
  if text:find("[Image", 1, true) then return "image_attachment" end

  -- Error
  if text:match("^%s*[Ee]rror:") then return "error" end

  return "text"
end

-- ── Adjacency refinement ─────────────────────────────────────────
-- Called after classifyRow with context from the previous row.
-- Refines "text" into more specific tokens based on what came before.

function M.refineAdjacency(kind, prevKind, text, context)
  -- text after user_prompt/user_text = user_text (multi-line input)
  if kind == "text" and (prevKind == "user_prompt" or prevKind == "user_text") then
    return "user_text"
  end

  -- text after assistant-attributed tokens = assistant_text
  if (kind == "text" or kind == "menu_option") and (
    prevKind == "tool" or prevKind == "thinking" or prevKind == "thought_complete"
    or prevKind == "result" or prevKind == "assistant_text"
    or prevKind == "task_done" or prevKind == "task_open"
    or prevKind == "task_summary" or prevKind == "task_active"
    or prevKind == "diff" or prevKind == "plan_border") then
    return "assistant_text"
  end

  -- text after menu_option = menu_desc
  if kind == "text" and prevKind == "menu_option" then
    return "menu_desc"
  end

  -- Footer hints
  if kind == "text" and (text:find("Enter to select", 1, true)
     or text:find("Arrow keys", 1, true) or text:find("Esc to cancel", 1, true)
     or text:find("Esc to go back", 1, true) or text:find("Type to search", 1, true)
     or (text:find("Ctrl+", 1, true) and text:find(" to ", 1, true))) then
    return "hint"
  end

  return kind
end

-- ── Turn detection ───────────────────────────────────────────────

function M.isTurnStart(kind)
  return kind == "user_prompt"
end

-- ── Group types ──────────────────────────────────────────────────

M.groupTypes = {
  menu_title = "menu", menu_option = "menu", menu_desc = "menu",
  list_selectable = "menu", list_selected = "menu", list_info = "menu",
  search_box = "menu", selector = "menu", confirmation = "menu", hint = "menu",
  picker_title = "picker", picker_item = "picker",
  picker_selected = "picker", picker_meta = "picker",
  task_summary = "task", task_done = "task", task_open = "task", task_active = "task",
  permission = "permission",
  plan_border = "plan", plan_mode = "plan", wizard_step = "plan",
}

-- ── Block types ──────────────────────────────────────────────────

M.blockTypes = {
  assistant_text = true, user_text = true, diff = true,
  text = true, banner = true, thinking = true, plan_mode = true,
  status_bar = true, input_border = true,
}

-- ── Metadata map overrides ───────────────────────────────────────
-- The claude_code classifier uses the framework defaults, which were
-- originally derived from this classifier. No overrides needed.
M.roleMap = nil
M.scopeMap = nil
M.laneMap = nil

return M
