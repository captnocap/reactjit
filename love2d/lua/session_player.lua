--[[
  session_player.lua — Recording playback engine with timeline control

  Replays a .rec.lua recording through a vterm instance at original timing
  (or with speed multiplier). The player owns its own vterm — the capability
  reads from it the same way it reads from a live PTY.

  Recordings are classifier-independent: the same recording can be played
  through different classifiers. This is the key insight — you don't re-record
  when you improve a classifier, you just replay.

  Usage:
    local Player = require("lua.session_player")
    local VTerm  = require("lua.vterm")

    local player = Player.new(recording, VTerm)
    player:play()
    -- in tick:
    local dirty = player:advance(dt)
    if dirty then
      -- vterm has new content, re-classify
      local vt = player:getVTerm()
    end
    player:seek(10.5)   -- jump to 10.5 seconds
    player:setSpeed(2)  -- 2x playback
    player:pause()
    player:step()       -- advance one frame
]]

local M = {}

-- ── Player instance ──────────────────────────────────────────────

local Player = {}
Player.__index = Player

function M.new(recording, VTerm)
  local self = setmetatable({}, Player)

  self.recording = recording
  self.meta      = recording.meta
  self.frames    = recording.frames

  -- Create a vterm with the recorded dimensions
  local rows = self.meta.rows or 40
  local cols = self.meta.cols or 120
  self.vterm = VTerm.new(rows, cols)

  -- Playback state
  self.time       = 0         -- current playback time (seconds)
  self.frameIndex = 0         -- index of last applied frame
  self.playing    = false
  self.speed      = 1.0
  self.dirty      = false     -- true if vterm changed since last read

  return self
end

-- ── Playback controls ────────────────────────────────────────────

function Player:play()
  self.playing = true
end

function Player:pause()
  self.playing = false
end

function Player:togglePlay()
  self.playing = not self.playing
end

function Player:setSpeed(speed)
  self.speed = math.max(0.1, math.min(speed, 20.0))
end

-- Step forward one frame (for frame-by-frame inspection)
function Player:step()
  self.playing = false
  local nextIdx = self.frameIndex + 1
  if nextIdx <= #self.frames then
    local frame = self.frames[nextIdx]
    self.vterm:feed(frame.data)
    self.time = frame.t
    self.frameIndex = nextIdx
    self.dirty = true
  end
end

-- Step backward one frame (rewinds by re-feeding from start)
function Player:stepBack()
  self.playing = false
  local targetIdx = math.max(0, self.frameIndex - 1)
  self:_rewindTo(targetIdx)
end

-- Seek to a specific time
function Player:seek(timeSeconds)
  timeSeconds = math.max(0, math.min(timeSeconds, self.meta.duration or 0))

  -- Find the target frame index
  local targetIdx = 0
  for i, frame in ipairs(self.frames) do
    if frame.t <= timeSeconds then
      targetIdx = i
    else
      break
    end
  end

  -- If seeking backward, must replay from start
  if targetIdx < self.frameIndex then
    self:_rewindTo(targetIdx)
  else
    -- Seeking forward: apply frames from current to target
    for i = self.frameIndex + 1, targetIdx do
      self.vterm:feed(self.frames[i].data)
    end
    self.frameIndex = targetIdx
    self.time = timeSeconds
    self.dirty = true
  end
end

-- Seek to a fraction (0.0 = start, 1.0 = end)
function Player:seekFraction(fraction)
  fraction = math.max(0, math.min(1, fraction))
  self:seek(fraction * (self.meta.duration or 0))
end

-- ── Advance (called every tick) ──────────────────────────────────
-- Returns true if vterm was modified (dirty)

function Player:advance(dt)
  if not self.playing then return false end

  self.dirty = false
  self.time = self.time + dt * self.speed

  -- Apply all frames up to current time
  local applied = false
  while self.frameIndex < #self.frames do
    local nextFrame = self.frames[self.frameIndex + 1]
    if nextFrame.t <= self.time then
      self.vterm:feed(nextFrame.data)
      self.frameIndex = self.frameIndex + 1
      applied = true
    else
      break
    end
  end

  if applied then
    self.dirty = true
  end

  -- Auto-pause at end
  if self.frameIndex >= #self.frames then
    self.playing = false
  end

  return self.dirty
end

-- ── State queries ────────────────────────────────────────────────

function Player:getVTerm()
  return self.vterm
end

function Player:getState()
  local duration = self.meta.duration or 0
  return {
    playing     = self.playing,
    paused      = not self.playing,
    time        = self.time,
    duration    = duration,
    progress    = duration > 0 and (self.time / duration) or 0,
    frame       = self.frameIndex,
    totalFrames = #self.frames,
    speed       = self.speed,
    atEnd       = self.frameIndex >= #self.frames,
    atStart     = self.frameIndex == 0,
    dirty       = self.dirty,
  }
end

function Player:isDirty()
  return self.dirty
end

function Player:clearDirty()
  self.dirty = false
end

-- ── Internal: rewind by replaying from start ─────────────────────
-- vterm has no "undo" — to go backward we reset and replay up to target

function Player:_rewindTo(targetIdx)
  -- Reset vterm
  local rows = self.meta.rows or 40
  local cols = self.meta.cols or 120
  self.vterm:free()
  self.vterm = require("lua.vterm").new(rows, cols)

  -- Replay frames from start to target
  for i = 1, targetIdx do
    self.vterm:feed(self.frames[i].data)
  end

  self.frameIndex = targetIdx
  if targetIdx > 0 then
    self.time = self.frames[targetIdx].t
  else
    self.time = 0
  end
  self.dirty = true
end

-- ── Cleanup ──────────────────────────────────────────────────────

function Player:destroy()
  if self.vterm then
    self.vterm:free()
    self.vterm = nil
  end
end

return M
