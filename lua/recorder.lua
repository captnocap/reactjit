--[[
  recorder.lua — Video recorder for ReactJIT

  Captures frames from the Love2D framebuffer at configurable FPS and pipes
  raw RGBA pixels to an ffmpeg subprocess. No temp files, no PNG encoding —
  ffmpeg runs in its own process and encodes in parallel.

  Usage (via RPC from React):
    bridge.rpc('recorder:start', { fps: 30, format: 'mp4', output: '/tmp/demo.mp4' })
    // ... do things ...
    bridge.rpc('recorder:stop')  // → { path: '/tmp/demo.mp4', frames: 210, duration: 7.0 }

  Usage (via React hook):
    const { recording, start, stop, filePath } = useRecorder();

  Supported formats:
    mp4  — H.264 via libx264 (default, universal playback)
    webm — VP9 via libvpx-vp9 (open format, royalty-free)

  Requires: ffmpeg on PATH.
]]

local ffi = require("ffi")

local Recorder = {}

local state = {
  recording = false,
  fps = 30,
  frameInterval = 1 / 30,
  elapsed = 0,
  frameCount = 0,
  startTime = 0,
  outputPath = nil,
  format = "mp4",
  pendingCapture = false,
  pipe = nil,
  width = 0,
  height = 0,
}

-- ── Format configs ──────────────────────────────────────────

local FORMATS = {
  mp4 = {
    ext = ".mp4",
    codec = "-c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p",
  },
  webm = {
    ext = ".webm",
    codec = "-c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 30 -b:v 0 -pix_fmt yuv420p",
  },
}

-- ── Internal ────────────────────────────────────────────────

local function openPipe()
  local fmt = FORMATS[state.format]
  if not fmt then
    io.write("[recorder] Unknown format: " .. tostring(state.format) .. "\n")
    io.flush()
    return false
  end

  local cmd = string.format(
    'ffmpeg -y -f rawvideo -pix_fmt rgba -s %dx%d -r %d -i - %s "%s" 2>/dev/null',
    state.width, state.height, state.fps,
    fmt.codec, state.outputPath
  )

  state.pipe = io.popen(cmd, "w")
  if not state.pipe then
    io.write("[recorder] ERROR: Could not open ffmpeg pipe\n")
    io.flush()
    return false
  end

  return true
end

local function closePipe()
  if state.pipe then
    state.pipe:close()
    state.pipe = nil
  end
end

-- ── Public API ──────────────────────────────────────────────

--- Start recording.
--- @param opts table? { fps = number, format = string, output = string }
function Recorder.start(opts)
  if state.recording then
    return { error = "already recording" }
  end

  opts = opts or {}
  state.fps = opts.fps or 30
  state.frameInterval = 1 / state.fps
  state.elapsed = 0
  state.frameCount = 0
  state.startTime = love.timer.getTime()
  state.pendingCapture = false
  state.format = opts.format or "mp4"

  -- Validate format
  if not FORMATS[state.format] then
    return { error = "unknown format: " .. tostring(state.format) .. ". Use mp4 or webm." }
  end

  -- Get window dimensions for the raw pipe
  state.width, state.height = love.graphics.getDimensions()

  -- Default output: project directory
  local source = love.filesystem.getSource()
  local ext = FORMATS[state.format].ext
  state.outputPath = opts.output or (source .. "/recording" .. ext)

  -- Open the ffmpeg pipe
  if not openPipe() then
    return { error = "ffmpeg pipe failed — is ffmpeg installed?" }
  end

  state.recording = true
  io.write(string.format("[recorder] Started %s @ %dfps %dx%d → %s\n",
    state.format, state.fps, state.width, state.height, state.outputPath))
  io.flush()
  return true
end

--- Call from love.update(dt). Tracks timing for frame capture.
function Recorder.update(dt)
  if not state.recording then return end
  state.elapsed = state.elapsed + dt
end

--- Call at the end of love.draw(). Captures the frame if interval has elapsed.
--- Pipes raw RGBA pixels directly to ffmpeg — no PNG encoding, no temp files.
function Recorder.captureIfReady()
  if not state.recording then return end
  if state.pendingCapture then return end
  if state.elapsed < state.frameInterval then return end

  state.elapsed = state.elapsed - state.frameInterval
  state.frameCount = state.frameCount + 1
  state.pendingCapture = true

  love.graphics.captureScreenshot(function(imageData)
    if state.pipe then
      -- Get raw pixel data via FFI pointer — no PNG encode step
      local w, h = imageData:getDimensions()
      if w == state.width and h == state.height then
        local ptr = imageData:getFFIPointer()
        local size = w * h * 4
        local raw = ffi.string(ptr, size)
        state.pipe:write(raw)
      end
    end
    state.pendingCapture = false
  end)
end

--- Stop recording and finalize the video.
--- @return table { path = string, frames = number, duration = number } | { error = string }
function Recorder.stop()
  if not state.recording then
    return { error = "not recording" }
  end

  state.recording = false
  local frameCount = state.frameCount
  local outputPath = state.outputPath
  local duration = love.timer.getTime() - state.startTime

  io.write(string.format("[recorder] Stopped. %d frames, %.1fs\n", frameCount, duration))
  io.flush()

  -- Close the pipe — ffmpeg finishes encoding remaining frames
  closePipe()

  if frameCount == 0 then
    return { error = "no frames captured" }
  end

  io.write("[recorder] Saved: " .. outputPath .. "\n")
  io.flush()
  return { path = outputPath, frames = frameCount, duration = duration }
end

--- Check recording status.
function Recorder.status()
  local duration = 0
  if state.recording then
    duration = love.timer.getTime() - state.startTime
  end
  return {
    recording = state.recording,
    frames = state.frameCount,
    fps = state.fps,
    format = state.format,
    duration = duration,
    output = state.outputPath,
    width = state.width,
    height = state.height,
  }
end

-- ── RPC handler registry ────────────────────────────────────

function Recorder.getHandlers()
  return {
    ["recorder:start"] = function(args)
      return Recorder.start(args)
    end,
    ["recorder:stop"] = function()
      return Recorder.stop()
    end,
    ["recorder:status"] = function()
      return Recorder.status()
    end,
  }
end

return Recorder
