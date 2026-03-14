--[[
  capabilities/llm_agent.lua -- Local LLM agent with coroutine-based inference

  React usage:
    <LLMAgent
      chatModel="path/to/chat.gguf"
      embedModel="path/to/embed.gguf"
      personality="You are a concise AI assistant."
      temperature={0.7}
      topP={0.9}
      maxTokens={512}
      onToken={(e) => handleToken(e)}
      onThink={(e) => handleThink(e)}
      onStateChange={(e) => handleState(e)}
      onDone={(e) => handleDone(e)}
      onError={(e) => handleError(e)}
    />

  Non-blocking inference via Lua coroutines:
    - agent:chat() runs in a coroutine
    - Per-token callback yields, letting love.update render between tokens
    - Think blocks parsed from <think>...</think> tags and pushed separately
    - State changes (phase, amplitude, tokensPerSec) pushed for effect driving

  Requires: experiments/llm/{llm.lua, memory.lua, agent.lua} + libllama.so
  Gracefully degrades if unavailable.
]]

local Capabilities = require("lua.capabilities")

-- ── Try loading the LLM stack ──────────────────────────────────────────

-- Add experiments/llm/ to package.path so we can find llm.lua, memory.lua, agent.lua
local function findExperimentsDir()
  -- Try relative to lua/ (which is where this file lives at source)
  local info = debug.getinfo(1, "S")
  if info and info.source and info.source:sub(1, 1) == "@" then
    local dir = info.source:sub(2):match("(.+)/[^/]+/[^/]+$") -- up from capabilities/
    if dir then
      -- dir is lua/, go up one more to monorepo root
      local root = dir:match("(.+)/[^/]+$")
      if root then
        return root .. "/experiments/llm"
      end
    end
  end
  return nil
end

local experimentsDir = findExperimentsDir()
if experimentsDir then
  package.path = experimentsDir .. "/?.lua;" .. package.path
end

local llm_ok, llm = pcall(require, "llm")
local mem_ok, Memory = pcall(require, "memory")
local agent_ok, Agent = pcall(require, "agent")

local available = llm_ok and llm.available
  and mem_ok and Memory and Memory.available
  and agent_ok and Agent

-- (availability logged by capabilities.loadAll summary)

-- ── Think block parser ─────────────────────────────────────────────────

local function ThinkParser()
  local self = {
    buffer = "",
    inThink = false,
    thinkContent = "",
  }

  --- Feed new text. Returns { cleanText, thinkBlocks[] }
  function self.feed(text)
    local clean = {}
    local thinks = {}
    self.buffer = self.buffer .. text

    while #self.buffer > 0 do
      if self.inThink then
        -- Look for closing tag
        local closeStart, closeEnd = self.buffer:find("</think>")
        if closeStart then
          self.thinkContent = self.thinkContent .. self.buffer:sub(1, closeStart - 1)
          thinks[#thinks + 1] = self.thinkContent
          self.thinkContent = ""
          self.inThink = false
          self.buffer = self.buffer:sub(closeEnd + 1)
        else
          -- Accumulate think content, might get more
          self.thinkContent = self.thinkContent .. self.buffer
          self.buffer = ""
        end
      else
        -- Look for opening tag
        local openStart, openEnd = self.buffer:find("<think>")
        if openStart then
          -- Text before tag is clean
          if openStart > 1 then
            clean[#clean + 1] = self.buffer:sub(1, openStart - 1)
          end
          self.inThink = true
          self.buffer = self.buffer:sub(openEnd + 1)
        else
          -- Check if buffer might have partial "<think" at end
          local partial = self.buffer:find("<t?h?i?n?k?>?$")
          if partial and partial > 1 then
            clean[#clean + 1] = self.buffer:sub(1, partial - 1)
            self.buffer = self.buffer:sub(partial)
            break -- Wait for more input
          else
            clean[#clean + 1] = self.buffer
            self.buffer = ""
          end
        end
      end
    end

    return table.concat(clean), thinks
  end

  function self.reset()
    self.buffer = ""
    self.inThink = false
    self.thinkContent = ""
  end

  return self
end

-- ── Module-level instance tracking (for RPC handler access) ──────────
local _activeNodeId = nil
local _activeState = nil

-- Forward-declare inference launcher (defined after register)
local startInference

-- ── Capability registration ────────────────────────────────────────────

Capabilities.register("LLMAgent", {
  visual = false,

  schema = {
    chatModel    = { type = "string", desc = "Path to chat GGUF model" },
    embedModel   = { type = "string", desc = "Path to embedding GGUF model (optional)" },
    personality  = { type = "string", default = "You are a helpful AI assistant.", desc = "System prompt" },
    temperature  = { type = "number", min = 0, max = 2, default = 0.7 },
    topP         = { type = "number", min = 0, max = 1, default = 0.9 },
    maxTokens    = { type = "number", min = 1, max = 4096, default = 512 },
    memoryTopK   = { type = "number", min = 0, max = 20, default = 5 },
  },

  events = { "onToken", "onThink", "onStateChange", "onDone", "onError", "onReady" },

  create = function(nodeId, props)
    local state = {
      -- Models
      chatModel = nil,
      embedModel = nil,
      memory = nil,
      agent = nil,

      -- Inference coroutine
      coroutine = nil,
      generating = false,

      -- Streaming state
      thinkParser = ThinkParser(),
      fullResponse = "",
      tokenCount = 0,
      startTime = 0,

      -- Phase tracking
      phase = "loading", -- loading, idle, generating, error
      available = available,

      -- Config (updated from props)
      config = {
        temperature = props.temperature or 0.7,
        topP = props.topP or 0.9,
        maxTokens = props.maxTokens or 512,
      },
    }

    if not available then
      state.phase = "unavailable"
      return state
    end

    -- Load models in a pcall (they can take a few seconds)
    local function loadModels()
      if props.chatModel then
        io.write("[LLMAgent] Loading chat model: " .. props.chatModel .. "\n"); io.flush()
        state.chatModel = llm.load(props.chatModel, {
          n_ctx = 2048,
          n_threads = 8,
        })
      end

      if props.embedModel then
        io.write("[LLMAgent] Loading embed model: " .. props.embedModel .. "\n"); io.flush()
        state.embedModel = llm.load(props.embedModel, {
          embeddings = true,
          n_ctx = 512,
          n_threads = 4,
        })
      end

      -- Open memory database
      local dbPath = "agent_memory.db"
      state.memory = Memory.open(dbPath)

      -- Create agent
      if state.chatModel then
        state.agent = Agent.new({
          chat_model = state.chatModel,
          embed_model = state.embedModel,
          memory = state.memory,
          personality = props.personality or "You are a helpful AI assistant.",
          max_tokens = props.maxTokens or 512,
          temperature = props.temperature or 0.7,
          memory_top_k = props.memoryTopK or 5,
        })

        -- Register default tools
        state.agent:register_tool("calculate", {
          description = "Evaluate a mathematical expression",
          params = {
            { name = "expression", type = "string", description = "Math expression to evaluate" },
          },
          execute = function(args)
            local fn = load("return " .. (args.expression or "0"))
            if fn then
              local ok, result = pcall(fn)
              if ok then return tostring(result) end
            end
            return "Error: could not evaluate"
          end,
        })

        state.phase = "idle"
        io.write("[LLMAgent] Ready\n"); io.flush()
      else
        state.phase = "error"
      end
    end

    local ok, err = pcall(loadModels)
    if not ok then
      io.write("[LLMAgent] Failed to load: " .. tostring(err) .. "\n"); io.flush()
      state.phase = "error"
      state.loadError = tostring(err)
    end

    -- Track active instance for RPC access
    _activeNodeId = nodeId
    _activeState = state

    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Update config from props
    if props.temperature then state.config.temperature = props.temperature end
    if props.topP then state.config.topP = props.topP end
    if props.maxTokens then state.config.maxTokens = props.maxTokens end

    -- Update personality if agent exists
    if state.agent and props.personality and props.personality ~= prev.personality then
      state.agent:set_personality(props.personality)
    end
  end,

  destroy = function(nodeId, state)
    _activeNodeId = nil
    _activeState = nil
    if state.agent then state.agent:close() end
    if state.memory then pcall(state.memory.close, state.memory) end
    if state.chatModel then state.chatModel:free() end
    if state.embedModel then state.embedModel:free() end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    -- Report load errors once
    if state.loadError then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", error = state.loadError },
      })
      state.loadError = nil
    end

    -- Report ready once
    if state.phase == "idle" and not state._readySent then
      state._readySent = true
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onReady", available = true },
      })
    end

    -- Report unavailable once
    if state.phase == "unavailable" and not state._readySent then
      state._readySent = true
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onReady", available = false },
      })
    end

    -- Resume inference coroutine if active
    if state.coroutine and coroutine.status(state.coroutine) ~= "dead" then
      -- Resume: process one token per frame
      local ok, err = coroutine.resume(state.coroutine)
      if not ok then
        io.write("[LLMAgent] Coroutine error: " .. tostring(err) .. "\n"); io.flush()
        state.generating = false
        state.phase = "idle"
        state.coroutine = nil
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onError", error = tostring(err) },
        })
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId, handler = "onStateChange",
            phase = "idle", amplitude = 0, tokensPerSec = 0,
          },
        })
      end
    elseif state.coroutine and coroutine.status(state.coroutine) == "dead" then
      -- Inference finished
      state.coroutine = nil
      if state.generating then
        state.generating = false
        state.phase = "idle"

        local elapsed = os.clock() - state.startTime
        local tps = state.tokenCount > 0 and state.tokenCount / elapsed or 0

        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId, handler = "onDone",
            response = state.fullResponse,
            tokensGenerated = state.tokenCount,
            tokensPerSec = tps,
          },
        })
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId, handler = "onStateChange",
            phase = "idle", amplitude = 0, tokensPerSec = 0,
          },
        })
      end
    end

    -- Check for incoming chat messages via the pending queue
    if state._pendingMessage then
      local msg = state._pendingMessage
      state._pendingMessage = nil
      startInference(nodeId, state, msg, pushEvent)
    end
  end,
})

-- ── Inference coroutine launcher ───────────────────────────────────────

startInference = function(nodeId, state, userMessage, pushEvent)
  if not state.agent then return end
  if state.generating then return end

  state.generating = true
  state.phase = "generating"
  state.fullResponse = ""
  state.tokenCount = 0
  state.startTime = os.clock()
  state.thinkParser.reset()

  pushEvent({
    type = "capability",
    payload = {
      targetId = nodeId, handler = "onStateChange",
      phase = "generating", amplitude = 0.3, tokensPerSec = 0,
    },
  })

  state.coroutine = coroutine.create(function()
    local response, metadata = state.agent:chat(userMessage, function(token)
      state.tokenCount = state.tokenCount + 1

      -- Parse think blocks from streaming tokens
      local cleanText, thinkBlocks = state.thinkParser.feed(token)

      -- Push think blocks
      for _, thought in ipairs(thinkBlocks) do
        pushEvent({
          type = "capability",
          payload = { targetId = nodeId, handler = "onThink", thought = thought },
        })
      end

      -- Push clean token
      if cleanText and #cleanText > 0 then
        state.fullResponse = state.fullResponse .. cleanText
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId, handler = "onToken",
            token = cleanText, fullText = state.fullResponse,
          },
        })
      end

      -- Update state for effect driving
      local elapsed = os.clock() - state.startTime
      local tps = state.tokenCount / math.max(elapsed, 0.001)
      local amplitude = math.min(tps / 20, 1.0) -- normalize to 0-1

      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId, handler = "onStateChange",
          phase = "generating",
          amplitude = amplitude,
          tokensPerSec = tps,
          memoriesUsed = metadata and metadata.memories_used or 0,
        },
      })

      -- Yield to let love.update render a frame
      coroutine.yield()
    end, {
      max_tokens = state.config.maxTokens,
      temperature = state.config.temperature,
    })

    -- Flush any remaining think content
    local remaining, lastThinks = state.thinkParser.feed("")
    for _, thought in ipairs(lastThinks) do
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onThink", thought = thought },
      })
    end
    if remaining and #remaining > 0 then
      state.fullResponse = state.fullResponse .. remaining
    end
  end)
end

-- ── RPC handlers for imperative control ────────────────────────────────

local rpcHandlers = {}

rpcHandlers["agent:send"] = function(args)
  if not _activeState then
    return { error = "No LLMAgent instance active" }
  end
  if not _activeState.agent then
    return { error = "Agent not loaded" }
  end
  if _activeState.generating then
    return { error = "Already generating" }
  end
  _activeState._pendingMessage = args.message
  return { ok = true, status = "queued" }
end

rpcHandlers["agent:status"] = function()
  if not _activeState then
    return { available = available, phase = "no_instance" }
  end
  return {
    available = _activeState.available,
    phase = _activeState.phase,
    generating = _activeState.generating,
    stats = _activeState.agent and _activeState.agent:stats() or nil,
  }
end

rpcHandlers["agent:configure"] = function(args)
  if not _activeState then return { error = "No instance" } end
  if args.temperature then _activeState.config.temperature = args.temperature end
  if args.topP then _activeState.config.topP = args.topP end
  if args.maxTokens then _activeState.config.maxTokens = args.maxTokens end
  return { ok = true }
end

-- Extend Capabilities.getHandlers to include agent RPC methods
local originalGetHandlers = Capabilities.getHandlers
Capabilities.getHandlers = function()
  local handlers = originalGetHandlers()
  for method, handler in pairs(rpcHandlers) do
    handlers[method] = handler
  end
  return handlers
end

-- (registration logged by capabilities.loadAll summary)
