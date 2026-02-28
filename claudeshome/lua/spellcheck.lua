--[[
  spellcheck.lua -- Lightweight spell checker over SQLite dictionary

  Checks words against a frequency-ranked dictionary and generates
  suggestions using edit-distance-1 candidates. Designed to be fast
  enough for real-time use in TextInput/TextEditor.

  Usage:
    local spellcheck = require("lua.spellcheck")
    spellcheck.init()                          -- loads dictionary.db

    spellcheck.check("hello")                  -- true
    spellcheck.check("helo")                   -- false

    local suggestions = spellcheck.suggest("helo")  -- {"hello", "hero", "help", ...}

  The dictionary is a SQLite DB with (word, freq, lang) rows.
  Ships with English by default; other languages can be added later.
]]

local sqlite = require("lua.sqlite")

local SpellCheck = {}
SpellCheck.available = false

local db = nil
local lang = "en"

-- ============================================================================
-- Initialization
-- ============================================================================

--- Initialize the spell checker by opening the dictionary database.
--- @param config table|nil  { path = "dictionary.db", lang = "en" }
function SpellCheck.init(config)
  if not sqlite.available then
    if _G._reactjit_verbose then io.write("[spellcheck] SQLite not available — spell check disabled\n"); io.flush() end
    return
  end

  config = config or {}
  lang = config.lang or "en"

  -- Find dictionary.db — check Love2D filesystem paths
  local paths = {
    "data/dictionary.db",
  }

  local dictPath = nil
  if love and love.filesystem then
    for _, p in ipairs(paths) do
      local info = love.filesystem.getInfo(p)
      if info then
        -- Resolve to absolute path for SQLite (which uses OS filesystem, not Love2D's)
        local source = love.filesystem.getSource()
        dictPath = source .. "/" .. p
        break
      end
    end
  end

  if not dictPath then
    if _G._reactjit_verbose then io.write("[spellcheck] dictionary.db not found — spell check disabled\n"); io.flush() end
    return
  end

  -- Open with absolute path (bypass Love2D save directory resolution)
  local ok, result = pcall(sqlite.open, dictPath)
  if not ok then
    if _G._reactjit_verbose then io.write("[spellcheck] Failed to open dictionary: " .. tostring(result) .. "\n"); io.flush() end
    return
  end

  db = result
  local count = db:scalar("SELECT COUNT(*) FROM words WHERE lang = ?", lang)
  if _G._reactjit_verbose then io.write("[spellcheck] Loaded " .. (count or 0) .. " words (" .. lang .. ")\n"); io.flush() end
  SpellCheck.available = true
end

--- Set the active language.
function SpellCheck.setLang(newLang)
  lang = newLang
end

--- Get the active language.
function SpellCheck.getLang()
  return lang
end

-- ============================================================================
-- Word checking
-- ============================================================================

--- Check if a word is in the dictionary.
--- @param word string  The word to check (case-insensitive)
--- @return boolean
function SpellCheck.check(word)
  if not db then return true end  -- no dictionary = assume correct
  if not word or #word == 0 then return true end

  -- Skip numbers, single chars, URLs, paths
  if word:match("^%d") then return true end
  if #word <= 1 then return true end
  if word:match("^https?://") then return true end
  if word:match("/") then return true end

  local lower = word:lower()
  return db:exists("SELECT 1 FROM words WHERE word = ? AND lang = ?", lower, lang)
end

--- Check all words in a text string. Returns an array of misspelled words
--- with their positions.
---
---   local errors = spellcheck.checkText("I hav a speling eror")
---   -- { {word="hav", start=3, stop=5}, {word="speling", start=9, stop=15}, ... }
---
--- @param text string
--- @return table[]  Array of { word, start, stop }
function SpellCheck.checkText(text)
  if not db then return {} end
  if not text or #text == 0 then return {} end

  local errors = {}
  -- Match word boundaries (sequences of letters/apostrophes)
  local pos = 1
  while pos <= #text do
    local s, e, word = text:find("([%a']+)", pos)
    if not s then break end

    -- Strip leading/trailing apostrophes
    local clean = word:gsub("^'+", ""):gsub("'+$", "")
    if #clean > 1 and not SpellCheck.check(clean) then
      errors[#errors + 1] = { word = clean, start = s, stop = e }
    end

    pos = e + 1
  end

  return errors
end

-- ============================================================================
-- Suggestions (edit distance 1)
-- ============================================================================

--- Generate spelling suggestions for a misspelled word.
--- Uses edit-distance-1 candidates checked against the dictionary,
--- ranked by word frequency.
---
--- @param word string  The misspelled word
--- @param limit number|nil  Max suggestions to return (default 5)
--- @return string[]  Array of suggested corrections
function SpellCheck.suggest(word, limit)
  if not db then return {} end
  if not word or #word == 0 then return {} end

  limit = limit or 5
  local lower = word:lower()
  local candidates = {}
  local seen = {}

  -- Generate all edit-distance-1 variants
  local len = #lower
  local alphabet = "abcdefghijklmnopqrstuvwxyz"

  -- Deletes: remove one character
  for i = 1, len do
    local c = lower:sub(1, i-1) .. lower:sub(i+1)
    if not seen[c] then seen[c] = true; candidates[#candidates + 1] = c end
  end

  -- Transposes: swap adjacent characters
  for i = 1, len - 1 do
    local c = lower:sub(1, i-1) .. lower:sub(i+1, i+1) .. lower:sub(i, i) .. lower:sub(i+2)
    if not seen[c] then seen[c] = true; candidates[#candidates + 1] = c end
  end

  -- Replaces: replace one character
  for i = 1, len do
    for j = 1, 26 do
      local ch = alphabet:sub(j, j)
      if ch ~= lower:sub(i, i) then
        local c = lower:sub(1, i-1) .. ch .. lower:sub(i+1)
        if not seen[c] then seen[c] = true; candidates[#candidates + 1] = c end
      end
    end
  end

  -- Inserts: add one character
  for i = 1, len + 1 do
    for j = 1, 26 do
      local ch = alphabet:sub(j, j)
      local c = lower:sub(1, i-1) .. ch .. lower:sub(i)
      if not seen[c] then seen[c] = true; candidates[#candidates + 1] = c end
    end
  end

  -- Batch-check candidates against dictionary
  -- SQLite IN clause with parameterized values
  if #candidates == 0 then return {} end

  -- Check in batches (SQLite has a variable limit ~999)
  local BATCH = 500
  local results = {}

  for i = 1, #candidates, BATCH do
    local batch = {}
    local placeholders = {}
    for j = i, math.min(i + BATCH - 1, #candidates) do
      batch[#batch + 1] = candidates[j]
      placeholders[#placeholders + 1] = "?"
    end
    -- Add lang param at the end
    batch[#batch + 1] = lang

    local sql = "SELECT word, freq FROM words WHERE word IN ("
      .. table.concat(placeholders, ",")
      .. ") AND lang = ? ORDER BY freq DESC"

    local rows = db:query(sql, batch)
    for _, row in ipairs(rows) do
      results[#results + 1] = row
    end
  end

  -- Sort by frequency (highest first) and return top N
  table.sort(results, function(a, b) return a.freq > b.freq end)

  local suggestions = {}
  for i = 1, math.min(limit, #results) do
    suggestions[i] = results[i].word
  end
  return suggestions
end

-- ============================================================================
-- Cleanup
-- ============================================================================

function SpellCheck.close()
  if db then
    db:close()
    db = nil
    SpellCheck.available = false
  end
end

return SpellCheck
