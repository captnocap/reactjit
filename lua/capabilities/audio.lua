--[[
  capabilities/audio.lua — Declarative audio playback

  React usage:
    <Audio src="beat.mp3" playing loop volume={0.8} />
    <Audio src="ambient.ogg" playing volume={0.3} onEnded={() => next()} />

  This wraps love.audio for simple file playback.
  For modular synthesis (oscillators, filters, graphs), use the audio engine directly.

  Props:
    src      string   Audio file path (relative to Love2D filesystem)
    playing  boolean  Play/pause (default: false)
    volume   number   Volume 0-1 (default: 1)
    loop     boolean  Loop playback (default: false)
    pitch    number   Playback speed/pitch 0.5-2 (default: 1)

  Events:
    onProgress  { position, duration }  Fires ~10x/sec while playing
    onEnded     {}                      Fires when playback finishes (non-looping)
    onError     { message }             Fires if source fails to load
]]

local Capabilities = require("lua.capabilities")

-- State per instance: { source, src, ended, progressThrottle }

Capabilities.register("Audio", {
  visual = false,

  schema = {
    src     = { type = "string", desc = "Audio file path (relative to Love2D filesystem)" },
    playing = { type = "bool",   default = false, desc = "Play or pause" },
    volume  = { type = "number", min = 0, max = 1, default = 1, desc = "Volume level" },
    loop    = { type = "bool",   default = false, desc = "Loop playback" },
    pitch   = { type = "number", min = 0.5, max = 2, default = 1, desc = "Playback speed / pitch" },
  },

  events = { "onProgress", "onEnded", "onError" },

  create = function(nodeId, props)
    local state = {
      source = nil,
      src = nil,
      ended = false,
      progressThrottle = 0,
    }

    if props.src then
      local ok, src = pcall(love.audio.newSource, props.src, "stream")
      if ok and src then
        state.source = src
        state.src = props.src
        src:setLooping(props.loop == true)
        src:setVolume(props.volume or 1)
        if props.pitch then
          pcall(function() src:setPitch(props.pitch) end)
        end
        if props.playing then
          src:play()
        end
      else
        io.write("[capability:Audio] Failed to load: " .. tostring(props.src) .. " — " .. tostring(src) .. "\n")
        io.flush()
        state._loadError = tostring(src)
      end
    end

    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Source changed: reload
    if props.src ~= state.src then
      if state.source then
        state.source:stop()
        state.source:release()
        state.source = nil
      end
      state.src = props.src
      state.ended = false

      if props.src then
        local ok, src = pcall(love.audio.newSource, props.src, "stream")
        if ok and src then
          state.source = src
          src:setLooping(props.loop == true)
          src:setVolume(props.volume or 1)
          if props.pitch then
            pcall(function() src:setPitch(props.pitch) end)
          end
          if props.playing then
            src:play()
          end
          state._loadError = nil
        else
          state._loadError = tostring(src)
        end
      end
      return
    end

    if not state.source then return end

    -- Volume
    if props.volume ~= nil then
      state.source:setVolume(props.volume)
    end

    -- Loop
    if props.loop ~= nil then
      state.source:setLooping(props.loop == true)
    end

    -- Pitch
    if props.pitch ~= nil then
      pcall(function() state.source:setPitch(props.pitch) end)
    end

    -- Play/pause
    if props.playing and not state.source:isPlaying() then
      state.source:play()
      state.ended = false
    elseif not props.playing and state.source:isPlaying() then
      state.source:pause()
    end
  end,

  destroy = function(nodeId, state)
    if state.source then
      state.source:stop()
      state.source:release()
      state.source = nil
    end
  end,

  tick = function(nodeId, state, dt, pushEvent)
    if not pushEvent then return end

    -- Report load errors once
    if state._loadError then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = state._loadError },
      })
      state._loadError = nil
    end

    if not state.source then return end

    -- Progress updates (~10fps)
    state.progressThrottle = (state.progressThrottle or 0) + dt
    if state.progressThrottle >= 0.1 and state.source:isPlaying() then
      state.progressThrottle = 0
      local ok, pos = pcall(function() return state.source:tell() end)
      local ok2, dur = pcall(function() return state.source:getDuration() end)
      if ok and ok2 then
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onProgress", position = pos, duration = dur },
        })
      end
    end

    -- Ended detection (non-looping)
    if not state.ended and not state.source:isPlaying() and not state.source:isLooping() then
      local ok, pos = pcall(function() return state.source:tell() end)
      local ok2, dur = pcall(function() return state.source:getDuration() end)
      if ok and ok2 and dur > 0 and pos >= dur - 0.05 then
        state.ended = true
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onEnded" },
        })
      end
    end
  end,
})
