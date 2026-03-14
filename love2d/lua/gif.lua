--[[
  gif.lua — GIF recorder for ReactJIT

  Captures frames from the Love2D framebuffer at a configurable FPS,
  saves them as numbered PNGs via Love2D's filesystem, then shells out
  to ffmpeg to assemble a high-quality GIF with palette generation.

  Usage (via RPC from React):
    bridge.rpc('gif:start', { fps: 15, output: '/tmp/demo.gif' })
    // ... do things ...
    bridge.rpc('gif:stop')  // → returns { path: '/tmp/demo.gif', frames: 87 }

  Usage (via React hook):
    const { recording, start, stop, gifPath } = useGifRecorder();

  Requires: ffmpeg on PATH.
]]

local Gif = {}

-- Frame prefix inside Love2D's save directory
local FRAME_DIR = "gif_frames"

local state = {
  recording = false,
  fps = 15,
  frameInterval = 1 / 15,
  elapsed = 0,
  frameCount = 0,
  outputPath = nil,
  pendingCapture = false,
}

-- ── Internal ──────────────────────────────────────────────

local function frameFilename(idx)
  return string.format("%s/frame_%05d.png", FRAME_DIR, idx)
end

local function cleanFrames()
  -- Remove frame files from Love2D save directory
  local items = love.filesystem.getDirectoryItems(FRAME_DIR)
  for _, item in ipairs(items) do
    love.filesystem.remove(FRAME_DIR .. "/" .. item)
  end
  love.filesystem.remove(FRAME_DIR)
end

-- ── Public API ────────────────────────────────────────────

--- Start recording.
--- @param opts table? { fps = number, output = string }
function Gif.start(opts)
  opts = opts or {}
  state.recording = true
  state.fps = opts.fps or 15
  state.frameInterval = 1 / state.fps
  state.elapsed = 0
  state.frameCount = 0
  state.pendingCapture = false

  -- Clean any leftover frames from a previous recording
  cleanFrames()
  love.filesystem.createDirectory(FRAME_DIR)

  -- Default output: project directory
  local source = love.filesystem.getSource()
  state.outputPath = opts.output or (source .. "/recording.gif")

  io.write("[gif] Recording started (" .. state.fps .. " fps → " .. state.outputPath .. ")\n")
  io.flush()
end

--- Call from love.update(dt). Tracks timing for frame capture.
function Gif.update(dt)
  if not state.recording then return end
  state.elapsed = state.elapsed + dt
end

--- Call at the end of love.draw(). Captures the frame if interval has elapsed.
--- Uses Love2D's captureScreenshot(filename) which writes to the save directory.
function Gif.captureIfReady()
  if not state.recording then return end
  if state.pendingCapture then return end
  if state.elapsed < state.frameInterval then return end

  state.elapsed = state.elapsed - state.frameInterval
  state.frameCount = state.frameCount + 1
  state.pendingCapture = true

  local filename = frameFilename(state.frameCount)
  love.graphics.captureScreenshot(function(imageData)
    local fileData = imageData:encode("png")
    love.filesystem.write(filename, fileData)
    state.pendingCapture = false
  end)
end

--- Stop recording and assemble the GIF.
--- @return table { path = string, frames = number } | { error = string }
function Gif.stop()
  if not state.recording then
    return { error = "not recording" }
  end

  state.recording = false
  local frameCount = state.frameCount
  local outputPath = state.outputPath

  io.write("[gif] Stopped. Assembling " .. frameCount .. " frames...\n")
  io.flush()

  if frameCount == 0 then
    cleanFrames()
    return { error = "no frames captured" }
  end

  -- Absolute path to frames in Love2D's save directory
  local saveDir = love.filesystem.getSaveDirectory()
  local framesPath = saveDir .. "/" .. FRAME_DIR

  -- ffmpeg: numbered PNGs → GIF with two-pass palette for quality
  local cmd = string.format(
    'ffmpeg -y -framerate %d -i "%s/frame_%%05d.png" '
    .. '-vf "split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" '
    .. '"%s" 2>/dev/null',
    state.fps, framesPath, outputPath
  )

  local ok = os.execute(cmd)

  -- Cleanup frame files from save directory
  cleanFrames()

  if ok == 0 or ok == true then
    io.write("[gif] Saved: " .. outputPath .. " (" .. frameCount .. " frames)\n")
    io.flush()
    return { path = outputPath, frames = frameCount }
  else
    io.write("[gif] ERROR: ffmpeg failed. Is ffmpeg installed?\n")
    io.flush()
    return { error = "ffmpeg failed — is it installed?" }
  end
end

--- Check recording status.
function Gif.status()
  return {
    recording = state.recording,
    frames = state.frameCount,
    fps = state.fps,
    output = state.outputPath,
  }
end

-- ── RPC handler registry ──────────────────────────────────

function Gif.getHandlers()
  return {
    ["gif:start"] = function(args)
      Gif.start(args)
      return true
    end,
    ["gif:stop"] = function()
      return Gif.stop()
    end,
    ["gif:status"] = function()
      return Gif.status()
    end,
  }
end

return Gif
