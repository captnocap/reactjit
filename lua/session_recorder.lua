--[[
  session_recorder.lua — PTY output recorder for terminal sessions

  Captures raw PTY bytes with high-resolution timestamps. Recordings are
  classifier-independent: they store the raw terminal stream, not classified
  tokens. Classification happens at playback time, so you can replay the
  same recording through different classifiers and see different interpretations.

  Recording format:
    {
      meta = { cli, rows, cols, recorded, duration, frameCount },
      frames = { { t = seconds, data = "raw bytes" }, ... }
    }

  Serialized as Lua source for zero-dependency loading (no JSON parser needed).

  Usage:
    local Recorder = require("lua.session_recorder")
    local rec = Recorder.new({ cli = "claude", rows = 40, cols = 120 })
    rec:capture(ptyData)       -- call each time PTY produces output
    rec:save("session.rec.lua") -- serialize to file
    local data = rec:export()   -- get the table without saving
]]

local M = {}

-- ── Recorder instance ────────────────────────────────────────────

local Recorder = {}
Recorder.__index = Recorder

function M.new(opts)
  opts = opts or {}
  local self = setmetatable({}, Recorder)
  self.meta = {
    cli       = opts.cli or "unknown",
    rows      = opts.rows or 40,
    cols      = opts.cols or 120,
    recorded  = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    duration  = 0,
    frameCount = 0,
  }
  self.frames = {}
  self._startTime = nil
  self._recording = false
  return self
end

function Recorder:start()
  self._startTime = self._getTime()
  self._recording = true
end

function Recorder:stop()
  if self._recording and self._startTime then
    self.meta.duration = self._getTime() - self._startTime
  end
  self._recording = false
  self.meta.frameCount = #self.frames
end

function Recorder:capture(data)
  if not data or #data == 0 then return end

  -- Auto-start on first capture
  if not self._recording then
    self:start()
  end

  local t = self._getTime() - self._startTime
  self.frames[#self.frames + 1] = { t = t, data = data }
  self.meta.frameCount = #self.frames
  self.meta.duration = t
end

function Recorder:export()
  return {
    meta = self.meta,
    frames = self.frames,
  }
end

-- ── Serialization ────────────────────────────────────────────────
-- Serialize as valid Lua source that returns the recording table.
-- Uses string.format %q for safe byte escaping of PTY data.

local function serializeValue(val, indent)
  indent = indent or ""
  local t = type(val)
  if t == "string" then
    return string.format("%q", val)
  elseif t == "number" then
    return string.format("%.6f", val)
  elseif t == "boolean" then
    return tostring(val)
  elseif t == "nil" then
    return "nil"
  elseif t == "table" then
    local parts = {}
    local nextIndent = indent .. "  "

    -- Check if it's an array (sequential integer keys starting at 1)
    local isArray = true
    local maxN = 0
    for k in pairs(val) do
      if type(k) == "number" and k >= 1 and k == math.floor(k) then
        if k > maxN then maxN = k end
      else
        isArray = false
      end
    end
    if maxN ~= #val then isArray = false end

    if isArray then
      -- Compact format for frame arrays
      if maxN > 10 then
        for i = 1, maxN do
          parts[i] = nextIndent .. serializeValue(val[i], nextIndent)
        end
        return "{\n" .. table.concat(parts, ",\n") .. "\n" .. indent .. "}"
      else
        for i = 1, maxN do
          parts[i] = serializeValue(val[i], nextIndent)
        end
        return "{ " .. table.concat(parts, ", ") .. " }"
      end
    else
      for k, v in pairs(val) do
        local key
        if type(k) == "string" and k:match("^[%a_][%w_]*$") then
          key = k
        else
          key = "[" .. serializeValue(k) .. "]"
        end
        parts[#parts + 1] = nextIndent .. key .. " = " .. serializeValue(v, nextIndent)
      end
      return "{\n" .. table.concat(parts, ",\n") .. "\n" .. indent .. "}"
    end
  end
  return "nil"
end

function Recorder:save(path)
  self:stop()
  local recording = self:export()
  local lua = "-- SemanticTerminal recording: " .. self.meta.cli .. " (" .. self.meta.recorded .. ")\n"
  lua = lua .. "-- Duration: " .. string.format("%.1fs", self.meta.duration) .. ", Frames: " .. self.meta.frameCount .. "\n"
  lua = lua .. "return " .. serializeValue(recording) .. "\n"

  local f = io.open(path, "w")
  if f then
    f:write(lua)
    f:close()
    return true
  end
  return false, "Failed to write: " .. path
end

-- ── Time source ──────────────────────────────────────────────────
-- Uses love.timer if available, falls back to os.clock

function Recorder._getTime()
  if love and love.timer then
    return love.timer.getTime()
  end
  return os.clock()
end

-- ── Load a recording from file ───────────────────────────────────

function M.load(path)
  local chunk, err = loadfile(path)
  if not chunk then return nil, "Failed to load recording: " .. tostring(err) end
  local ok, recording = pcall(chunk)
  if not ok then return nil, "Failed to execute recording: " .. tostring(recording) end
  if type(recording) ~= "table" or not recording.meta or not recording.frames then
    return nil, "Invalid recording format"
  end
  return recording
end

return M
