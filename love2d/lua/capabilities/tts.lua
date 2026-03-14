--[[
  capabilities/tts.lua — Declarative text-to-speech via Kokoro TTS

  React usage:
    <TTS text="Hello world" />
    <TTS text="Build complete" voice="af_heart" speed={1.2} onComplete={() => next()} />
    <TTS text={announcement} voice="am_adam" playing={announce} />

  Pipeline:
    1. Write text to temp file
    2. Spawn `kokoro-tts` as background process → produces .wav
    3. Monitor PID for completion
    4. Play resulting wav via love.audio
    5. Fire onComplete when playback finishes

  Props:
    text     string   Text to speak
    voice    string   Voice name (default: af_heart). See kokoro-tts --help-voices
    speed    number   Speech rate 0.5-2.0 (default: 1.0)
    playing  boolean  Speak when true (default: true)
    volume   number   Playback volume 0-1 (default: 1.0)
    lang     string   Language code (default: en-us)

  Events:
    onStart     {}                Fires when TTS generation begins
    onGenerated { file, duration } Fires when wav file is ready (before playback)
    onComplete  {}                Fires when playback finishes
    onError     { message }       Fires on generation or playback failure
]]

local Capabilities = require("lua.capabilities")
local processRegistry = require("lua.process_registry")

-- Resolve model paths
local MODEL_DIR = os.getenv("HOME") .. "/.local/share/kokoro-tts"
local MODEL_PATH = MODEL_DIR .. "/kokoro-v1.0.onnx"
local VOICES_PATH = MODEL_DIR .. "/voices-v1.0.bin"

-- Temp dir for wav files
local TMP_DIR = os.getenv("TMPDIR") or os.getenv("TEMP") or "/tmp"

-- Counter for unique temp files
local nextId = 1

--- Check if a PID is still running.
local function isRunning(pid)
  if not pid then return false end
  local h = io.popen("ps -p " .. pid .. " -o pid= 2>/dev/null")
  if not h then return false end
  local out = h:read("*a") or ""
  h:close()
  return out:match("%d+") ~= nil
end

--- Shell-escape a string for safe embedding in a command.
local function shellEscape(s)
  return "'" .. s:gsub("'", "'\\''") .. "'"
end

Capabilities.register("TTS", {
  visual = false,

  schema = {
    text    = { type = "string", default = "",       desc = "Text to speak" },
    voice   = { type = "string", default = "af_heart", desc = "Voice name (kokoro-tts voice)" },
    speed   = { type = "number", min = 0.5, max = 2.0, default = 1.0, desc = "Speech rate" },
    playing = { type = "bool",   default = true,     desc = "Speak when true" },
    volume  = { type = "number", min = 0, max = 1,   default = 1.0, desc = "Playback volume" },
    lang    = { type = "string", default = "en-us",  desc = "Language code" },
  },

  events = { "onStart", "onGenerated", "onComplete", "onError" },

  create = function(nodeId, props)
    local id = nextId
    nextId = nextId + 1

    local state = {
      id = id,
      pid = nil,           -- kokoro-tts process PID
      textFile = nil,      -- temp input file
      wavFile = nil,       -- temp output file
      source = nil,        -- love.audio.Source for playback
      phase = "idle",      -- idle | generating | playing | done
      text = nil,          -- text we're currently generating for
      settled = false,     -- prevent double events
    }

    if props.playing ~= false and props.text and props.text ~= "" then
      state.text = props.text
      state.phase = "pending" -- will start in first tick
    end

    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Text changed while playing: stop and regenerate
    if props.text ~= state.text and props.playing ~= false then
      -- Kill any running process
      if state.pid and isRunning(state.pid) then
        os.execute("kill " .. state.pid .. " 2>/dev/null")
        processRegistry.unregister(state.pid)
        state.pid = nil
      end
      -- Stop any playing audio
      if state.source then
        state.source:stop()
        state.source:release()
        state.source = nil
      end
      -- Queue new generation
      if props.text and props.text ~= "" then
        state.text = props.text
        state.phase = "pending"
        state.settled = false
      else
        state.text = nil
        state.phase = "idle"
      end
    end

    -- Volume change during playback
    if state.source and props.volume then
      state.source:setVolume(props.volume)
    end

    -- Playing toggled off: stop everything
    if props.playing == false and state.phase ~= "idle" then
      if state.pid and isRunning(state.pid) then
        os.execute("kill " .. state.pid .. " 2>/dev/null")
        processRegistry.unregister(state.pid)
        state.pid = nil
      end
      if state.source then
        state.source:stop()
        state.source:release()
        state.source = nil
      end
      state.phase = "idle"
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    -- ── Phase: pending → start generation ──
    if state.phase == "pending" then
      -- Verify model files exist
      local f = io.open(MODEL_PATH, "r")
      if not f then
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onError",
            message = "kokoro-tts model not found at " .. MODEL_PATH,
          },
        })
        state.phase = "idle"
        return
      end
      f:close()

      -- Write text to temp file
      local textFile = TMP_DIR .. "/rjit_tts_" .. state.id .. ".txt"
      local wavFile  = TMP_DIR .. "/rjit_tts_" .. state.id .. ".wav"
      local tf = io.open(textFile, "w")
      if not tf then
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError", message = "Failed to write temp file" },
        })
        state.phase = "idle"
        return
      end
      tf:write(state.text)
      tf:close()

      state.textFile = textFile
      state.wavFile  = wavFile

      -- Build command
      local voice = props.voice or "af_heart"
      local speed = tostring(props.speed or 1.0)
      local lang  = props.lang or "en-us"

      local cmd = string.format(
        "kokoro-tts %s %s --voice %s --speed %s --lang %s --model %s --voices %s 2>/dev/null & echo $!",
        shellEscape(textFile),
        shellEscape(wavFile),
        shellEscape(voice),
        speed,
        shellEscape(lang),
        shellEscape(MODEL_PATH),
        shellEscape(VOICES_PATH)
      )

      io.write("[tts] spawning: kokoro-tts for " .. #state.text .. " chars\n")
      io.flush()

      local pidHandle = io.popen(cmd)
      if pidHandle then
        local pid = pidHandle:read("*l")
        pidHandle:close()
        if pid and pid:match("%d+") then
          state.pid = pid
          processRegistry.register(pid)
          state.phase = "generating"

          pushEvent({
            type = "capability",
            payload = { targetId = nodeId, handler = "onStart" },
          })
        else
          pushEvent({
            type = "capability",
            payload = { targetId = nodeId, handler = "onError", message = "Failed to spawn kokoro-tts" },
          })
          state.phase = "idle"
        end
      else
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError", message = "io.popen failed" },
        })
        state.phase = "idle"
      end
      return
    end

    -- ── Phase: generating → check if kokoro-tts finished ──
    if state.phase == "generating" then
      if state.pid and not isRunning(state.pid) then
        processRegistry.unregister(state.pid)
        state.pid = nil

        -- Check if wav was produced
        local f = io.open(state.wavFile, "r")
        if f then
          local size = f:seek("end")
          f:close()

          if size and size > 44 then -- WAV header is 44 bytes
            io.write("[tts] generated " .. state.wavFile .. " (" .. size .. " bytes)\n")
            io.flush()

            pushEvent({
              type = "capability",
              payload = { targetId = nodeId, handler = "onGenerated", file = state.wavFile },
            })

            -- Load and play via love.audio
            local ok, src = pcall(love.audio.newSource, state.wavFile, "static")
            if ok and src then
              state.source = src
              src:setVolume(props.volume or 1.0)
              src:play()
              state.phase = "playing"
            else
              pushEvent({
                type = "capability",
                payload = { targetId = nodeId, handler = "onError", message = "Failed to load wav: " .. tostring(src) },
              })
              state.phase = "idle"
            end
          else
            pushEvent({
              type = "capability",
              payload = { targetId = nodeId, handler = "onError", message = "kokoro-tts produced empty wav" },
            })
            state.phase = "idle"
          end
        else
          pushEvent({
            type = "capability",
            payload = { targetId = nodeId, handler = "onError", message = "kokoro-tts produced no output file" },
          })
          state.phase = "idle"
        end
      end
      return
    end

    -- ── Phase: playing → monitor love.audio playback ──
    if state.phase == "playing" then
      if state.source and not state.source:isPlaying() then
        if not state.settled then
          state.settled = true
          pushEvent({
            type = "capability",
            payload = { targetId = nodeId, handler = "onComplete" },
          })
        end
        -- Clean up
        state.source:stop()
        state.source:release()
        state.source = nil
        state.phase = "done"

        -- Remove temp files
        os.remove(state.textFile)
        os.remove(state.wavFile)
      end
    end
  end,

  destroy = function(nodeId, state)
    -- Kill generation process
    if state.pid and isRunning(state.pid) then
      os.execute("kill " .. state.pid .. " 2>/dev/null")
      processRegistry.unregister(state.pid)
    end

    -- Stop audio
    if state.source then
      state.source:stop()
      state.source:release()
    end

    -- Clean temp files
    if state.textFile then os.remove(state.textFile) end
    if state.wavFile then os.remove(state.wavFile) end
  end,
})
