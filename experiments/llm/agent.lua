--[[
  agent.lua -- LLM Agent with RAG, tools, and memory

  Orchestration layer between raw inference (llm.lua) and the outside world.
  Handles:
    - Conversation history management
    - RAG: retrieves relevant memories and injects into context
    - Tool dispatch: model can call registered tools, results fed back
    - System prompt assembly: personality + knowledge + tool schemas
    - Context window budgeting: keeps prompt within model limits

  Usage:
    local Agent = require("agent")
    local agent = Agent.new({
      chat_model   = llm.load("chat.gguf", { n_ctx = 4096, n_threads = 8 }),
      embed_model  = llm.load("embed.gguf", { embeddings = true }),
      memory       = Memory.open("brain.db"),
      personality  = "You are a helpful local AI assistant.",
    })

    agent:register_tool("search", {
      description = "Search the web for information",
      params = { query = "string" },
      execute = function(args) return web_search(args.query) end,
    })

    local response = agent:chat("What is LuaJIT?", function(token)
      io.write(token)  -- streaming
    end)

  Requires: llm.lua, memory.lua
]]

-- ============================================================================
-- Module
-- ============================================================================

local Agent = {}
Agent.__index = Agent

-- ============================================================================
-- ID generation
-- ============================================================================

local random = math.random
math.randomseed(os.time() + os.clock() * 1000 + 1)

local function new_id(prefix)
  local hex = ""
  for _ = 1, 12 do
    hex = hex .. string.format("%02x", random(0, 255))
  end
  return (prefix or "") .. hex
end

-- ============================================================================
-- JSON helpers (minimal, no external deps)
-- ============================================================================

-- Simple JSON encoder for tool call arguments and results
local function json_encode(val)
  local t = type(val)
  if val == nil then return "null" end
  if t == "boolean" then return val and "true" or "false" end
  if t == "number" then return tostring(val) end
  if t == "string" then
    return '"' .. val:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r'):gsub('\t', '\\t') .. '"'
  end
  if t == "table" then
    -- Check if array
    if #val > 0 or next(val) == nil then
      local parts = {}
      for i, v in ipairs(val) do
        parts[i] = json_encode(v)
      end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      local parts = {}
      for k, v in pairs(val) do
        parts[#parts + 1] = json_encode(tostring(k)) .. ":" .. json_encode(v)
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  end
  return '"' .. tostring(val) .. '"'
end

-- Recursive descent JSON decoder for tool call parsing.
-- Handles: strings, numbers, booleans, null, objects, arrays.
local json_decode
do
  local function skip_ws(s, pos)
    return s:match("^%s*()", pos)
  end

  local function decode_string(s, pos)
    assert(s:sub(pos, pos) == '"', "expected '\"' at " .. pos)
    local i = pos + 1
    local parts = {}
    while i <= #s do
      local c = s:sub(i, i)
      if c == '"' then
        return table.concat(parts), i + 1
      elseif c == '\\' then
        local nc = s:sub(i + 1, i + 1)
        if nc == 'n' then parts[#parts + 1] = '\n'
        elseif nc == 'r' then parts[#parts + 1] = '\r'
        elseif nc == 't' then parts[#parts + 1] = '\t'
        elseif nc == '"' then parts[#parts + 1] = '"'
        elseif nc == '\\' then parts[#parts + 1] = '\\'
        elseif nc == '/' then parts[#parts + 1] = '/'
        elseif nc == 'u' then
          -- \uXXXX — decode to byte (ASCII range only for now)
          local hex = s:sub(i + 2, i + 5)
          local cp = tonumber(hex, 16) or 0
          if cp < 128 then
            parts[#parts + 1] = string.char(cp)
          else
            parts[#parts + 1] = "?" -- non-ASCII placeholder
          end
          i = i + 6
          goto continue
        else
          parts[#parts + 1] = nc
        end
        i = i + 2
      else
        parts[#parts + 1] = c
        i = i + 1
      end
      ::continue::
    end
    error("unterminated string at " .. pos)
  end

  local function decode_value(s, pos)
    pos = skip_ws(s, pos)
    local c = s:sub(pos, pos)

    -- string
    if c == '"' then
      return decode_string(s, pos)
    end

    -- object
    if c == '{' then
      local obj = {}
      pos = skip_ws(s, pos + 1)
      if s:sub(pos, pos) == '}' then return obj, pos + 1 end
      while true do
        pos = skip_ws(s, pos)
        local key
        key, pos = decode_string(s, pos)
        pos = skip_ws(s, pos)
        assert(s:sub(pos, pos) == ':', "expected ':' at " .. pos)
        pos = pos + 1
        local val
        val, pos = decode_value(s, pos)
        obj[key] = val
        pos = skip_ws(s, pos)
        local sep = s:sub(pos, pos)
        if sep == '}' then return obj, pos + 1 end
        assert(sep == ',', "expected ',' or '}' at " .. pos)
        pos = pos + 1
      end
    end

    -- array
    if c == '[' then
      local arr = {}
      pos = skip_ws(s, pos + 1)
      if s:sub(pos, pos) == ']' then return arr, pos + 1 end
      while true do
        local val
        val, pos = decode_value(s, pos)
        arr[#arr + 1] = val
        pos = skip_ws(s, pos)
        local sep = s:sub(pos, pos)
        if sep == ']' then return arr, pos + 1 end
        assert(sep == ',', "expected ',' or ']' at " .. pos)
        pos = pos + 1
      end
    end

    -- null
    if s:sub(pos, pos + 3) == "null" then return nil, pos + 4 end

    -- true
    if s:sub(pos, pos + 3) == "true" then return true, pos + 4 end

    -- false
    if s:sub(pos, pos + 4) == "false" then return false, pos + 5 end

    -- number
    local num_str = s:match("^%-?%d+%.?%d*[eE]?[%+%-]?%d*", pos)
    if num_str then
      return tonumber(num_str), pos + #num_str
    end

    error("unexpected character at " .. pos .. ": " .. c)
  end

  json_decode = function(str)
    if not str or str == "" then return nil end
    local val, _ = decode_value(str, 1)
    return val
  end
end

-- ============================================================================
-- Constructor
-- ============================================================================

--- Create a new agent.
---
--- Options:
---   chat_model    Model   (required) — llm.lua model in generative mode
---   embed_model   Model   (optional) — llm.lua model in embedding mode
---   memory        Store   (optional) — memory.lua store
---   personality   string  (optional) — base system prompt / personality
---   knowledge     string  (optional) — static knowledge to always include
---   chat_id       string  (optional) — conversation ID (default: auto-generated)
---   max_history   number  (optional) — max conversation turns to keep (default: 20)
---   max_tokens    number  (optional) — max tokens per response (default: 1024)
---   temperature   number  (optional) — sampling temperature (default: 0.7)
---   memory_top_k  number  (optional) — how many memories to retrieve (default: 5)
---   tool_rounds   number  (optional) — max tool call rounds per turn (default: 3)
function Agent.new(opts)
  assert(opts.chat_model, "agent requires a chat_model")

  local self = setmetatable({
    -- Models
    _chat    = opts.chat_model,
    _embed   = opts.embed_model,
    _memory  = opts.memory,

    -- Identity
    _personality = opts.personality or "You are a helpful AI assistant.",
    _knowledge   = opts.knowledge or "",
    _chat_id     = opts.chat_id or new_id("chat_"),

    -- Conversation state
    _history     = {},    -- array of {role, content}
    _max_history = opts.max_history or 20,

    -- Generation params
    _max_tokens  = opts.max_tokens or 1024,
    _temperature = opts.temperature or 0.7,

    -- RAG params
    _memory_top_k = opts.memory_top_k or 5,

    -- Tool system
    _tools       = {},    -- name -> {description, params, execute}
    _tool_rounds = opts.tool_rounds or 3,

    -- Stats
    _turn_count   = 0,
    _total_tokens = 0,
  }, Agent)

  return self
end

-- ============================================================================
-- Tool registration
-- ============================================================================

--- Register a tool the model can call.
---
---   agent:register_tool("search", {
---     description = "Search the web for current information",
---     params = {
---       { name = "query", type = "string", description = "Search query" },
---     },
---     execute = function(args) return "search results..." end,
---   })
function Agent:register_tool(name, tool)
  assert(tool.description, "tool needs a description")
  assert(tool.execute, "tool needs an execute function")
  self._tools[name] = tool
end

--- Unregister a tool.
function Agent:unregister_tool(name)
  self._tools[name] = nil
end

-- ============================================================================
-- System prompt assembly
-- ============================================================================

--- Build the tool description block for the system prompt.
local function build_tool_prompt(tools)
  if not next(tools) then return "" end

  local lines = {
    "",
    "## Available Tools",
    "",
    "You can call tools by writing a tool_call block. Use exactly this format:",
    "",
    "<tool_call>",
    '{"name": "tool_name", "args": {"param": "value"}}',
    "</tool_call>",
    "",
    "You may call multiple tools in a single response. Wait for results before continuing.",
    "Available tools:",
    "",
  }

  for name, tool in pairs(tools) do
    lines[#lines + 1] = "### " .. name
    lines[#lines + 1] = tool.description

    if tool.params and #tool.params > 0 then
      lines[#lines + 1] = "Parameters:"
      for _, p in ipairs(tool.params) do
        local req = p.required ~= false and " (required)" or " (optional)"
        lines[#lines + 1] = string.format("  - %s (%s)%s: %s",
          p.name, p.type or "string", req, p.description or "")
      end
    end

    lines[#lines + 1] = ""
  end

  return table.concat(lines, "\n")
end

--- Build the memory context block from retrieved memories.
local function build_memory_context(memories)
  if not memories or #memories == 0 then return "" end

  local lines = {
    "",
    "## Relevant Context (from memory)",
    "",
  }

  for i, mem in ipairs(memories) do
    local meta = ""
    if mem.metadata then
      if mem.metadata.affect_category then
        meta = meta .. " [mood:" .. mem.metadata.affect_category .. "]"
      end
      if mem.metadata.salience_score and mem.metadata.salience_score > 0.7 then
        meta = meta .. " [important]"
      end
    end
    lines[#lines + 1] = string.format("[%d] %s%s", i, mem.content, meta)
  end

  lines[#lines + 1] = ""
  return table.concat(lines, "\n")
end

--- Assemble the full system prompt.
function Agent:_build_system_prompt(memories)
  local parts = {}

  -- Core personality
  parts[#parts + 1] = self._personality

  -- Static knowledge
  if self._knowledge ~= "" then
    parts[#parts + 1] = "\n## Knowledge\n\n" .. self._knowledge
  end

  -- Retrieved memories
  local mem_ctx = build_memory_context(memories)
  if mem_ctx ~= "" then
    parts[#parts + 1] = mem_ctx
  end

  -- Tool descriptions
  local tool_prompt = build_tool_prompt(self._tools)
  if tool_prompt ~= "" then
    parts[#parts + 1] = tool_prompt
  end

  return table.concat(parts, "\n")
end

-- ============================================================================
-- Tool call parsing and execution
-- ============================================================================

--- Strip <think>...</think> blocks from model output.
local function strip_think_tags(text)
  -- Remove closed <think>...</think> blocks
  text = text:gsub("<think>.-</think>", "")
  -- Remove unclosed <think> block at end of text
  text = text:gsub("<think>.*$", "")
  return text:match("^%s*(.-)%s*$") or ""
end

--- Parse tool calls from model output.
--- Returns the cleaned text (without tool_call/think blocks) and an array of calls.
local function parse_tool_calls(text)
  local calls = {}
  local clean = text

  -- Find all <tool_call>...</tool_call> blocks (properly closed)
  for block in text:gmatch("<tool_call>(.-)</tool_call>") do
    local trimmed = block:match("^%s*(.-)%s*$")
    local ok, call = pcall(json_decode, trimmed)
    if ok and call and call.name then
      calls[#calls + 1] = {
        id = new_id("tc_"),
        name = call.name,
        args = call.args or {},
      }
    end
  end

  -- Handle unclosed <tool_call> at end of output (common with smaller models)
  if #calls == 0 then
    local unclosed = text:match("<tool_call>(.-)$")
    if unclosed then
      local trimmed = unclosed:match("^%s*(.-)%s*$")
      local ok, call = pcall(json_decode, trimmed)
      if ok and call and call.name then
        calls[#calls + 1] = {
          id = new_id("tc_"),
          name = call.name,
          args = call.args or {},
        }
      end
    end
  end

  -- Remove tool_call blocks from output
  clean = clean:gsub("<tool_call>.-</tool_call>", "")
  clean = clean:gsub("<tool_call>.*$", "") -- unclosed

  -- Strip thinking blocks
  clean = strip_think_tags(clean)

  return clean, calls
end

--- Execute a single tool call.
function Agent:_execute_tool(call)
  local tool = self._tools[call.name]
  if not tool then
    return {
      tool_call_id = call.id,
      name = call.name,
      error = "Unknown tool: " .. call.name,
    }
  end

  local ok, result = pcall(tool.execute, call.args)
  if ok then
    return {
      tool_call_id = call.id,
      name = call.name,
      result = type(result) == "string" and result or json_encode(result),
    }
  else
    return {
      tool_call_id = call.id,
      name = call.name,
      error = tostring(result),
    }
  end
end

--- Format tool results into a message the model can understand.
local function format_tool_results(results)
  local parts = {}
  for _, r in ipairs(results) do
    if r.error then
      parts[#parts + 1] = string.format("[Tool %s ERROR]: %s", r.name, r.error)
    else
      parts[#parts + 1] = string.format("[Tool %s result]: %s", r.name, r.result)
    end
  end
  return table.concat(parts, "\n\n")
end

-- ============================================================================
-- Memory operations
-- ============================================================================

--- Retrieve relevant memories for a query.
function Agent:_retrieve_memories(query_text)
  if not self._memory then return {} end

  local query = {
    chat_id = self._chat_id,
    query = query_text,
    top_k = self._memory_top_k,
  }

  -- Add vector search if we have an embedding model
  if self._embed then
    local ok, emb = pcall(self._embed.embed, self._embed, query_text)
    if ok then
      query.query_embedding = emb
    end
  end

  local ok, results = pcall(self._memory.retrieve, self._memory, query)
  if ok then return results end
  return {}
end

--- Store a message in memory.
function Agent:_memorize(message_id, content, role)
  if not self._memory then return end

  local opts = {}

  -- Use embedding model for vector storage
  if self._embed then
    opts.embed = function(text)
      local emb, dim = self._embed:embed(text)
      return { embedding = emb, model = "all-MiniLM-L6-v2", dimensions = dim }
    end
  end

  -- Use the chat model itself for affect classification (lightweight prompt)
  -- Only for user messages to avoid self-referential classification
  if role == "user" then
    opts.llm_classify = function(text)
      return self:_classify_affect(text)
    end
  end

  pcall(self._memory.process_message, self._memory, self._chat_id, message_id, content, opts)
end

--- Use the chat model to classify affect (lightweight, cached).
function Agent:_classify_affect(text)
  local prompt = string.format(
    [[Classify the emotional tone of this message into exactly one category and intensity.
Categories: FRUSTRATED, CONFUSED, CURIOUS, SATISFIED, URGENT, REFLECTIVE
Respond with ONLY a single line in this format: CATEGORY 0.X reasoning

Message: "%s"

Classification:]], text:sub(1, 200))

  local response = self._chat:generate(prompt, nil, {
    max_tokens = 50,
    temperature = 0.1,
  })

  -- Parse "CATEGORY 0.X reasoning"
  local category, intensity, reasoning = response:match("(%u+)%s+(%d%.%d+)%s*(.*)")
  if category and intensity then
    local valid = {
      FRUSTRATED=1, CONFUSED=1, CURIOUS=1, SATISFIED=1, URGENT=1, REFLECTIVE=1
    }
    if valid[category] then
      return {
        category = category,
        intensity = tonumber(intensity),
        reasoning = reasoning ~= "" and reasoning or nil,
      }
    end
  end

  return nil
end

-- ============================================================================
-- History management
-- ============================================================================

--- Trim history to stay within limits.
function Agent:_trim_history()
  local max = self._max_history * 2  -- pairs of user + assistant
  if #self._history > max then
    local trimmed = {}
    local start = #self._history - max + 1
    for i = start, #self._history do
      trimmed[#trimmed + 1] = self._history[i]
    end
    self._history = trimmed
  end
end

--- Get the full message array for the model (system + history + new message).
function Agent:_build_messages(system_prompt)
  local messages = {}

  -- System prompt
  messages[#messages + 1] = { role = "system", content = system_prompt }

  -- Conversation history
  for _, msg in ipairs(self._history) do
    messages[#messages + 1] = msg
  end

  return messages
end

-- ============================================================================
-- Main chat loop
-- ============================================================================

--- Send a message and get a response.
--- Handles RAG retrieval, tool dispatch loop, and memory storage.
---
--- @param user_message string   The user's message
--- @param stream_cb    function Optional streaming callback(token_text)
--- @param opts         table    Optional overrides {max_tokens, temperature, ...}
--- @return string  The assistant's final response
--- @return table   Metadata {tool_calls, memories_used, tokens_generated}
function Agent:chat(user_message, stream_cb, opts)
  opts = opts or {}
  self._turn_count = self._turn_count + 1

  local user_msg_id = new_id("msg_")
  local asst_msg_id = new_id("msg_")

  -- Step 1: Retrieve relevant memories
  local memories = self:_retrieve_memories(user_message)

  -- Step 2: Store user message in memory
  self:_memorize(user_msg_id, user_message, "user")

  -- Step 3: Build system prompt with memories
  local system_prompt = self:_build_system_prompt(memories)

  -- Step 4: Add user message to history
  self._history[#self._history + 1] = { role = "user", content = user_message }
  self:_trim_history()

  -- Step 5: Generation + tool dispatch loop
  local all_tool_calls = {}
  local final_response = ""
  local total_tokens = 0

  for round = 1, self._tool_rounds + 1 do
    -- Build messages
    local messages = self:_build_messages(system_prompt)

    -- Generate
    local collected = {}
    local response, n_tokens = self._chat:chat(messages, function(token)
      collected[#collected + 1] = token
      -- Only stream to user on the final round (or if no tool calls)
      if stream_cb and round == 1 then
        stream_cb(token)
      end
    end, {
      max_tokens = opts.max_tokens or self._max_tokens,
      temperature = opts.temperature or self._temperature,
    })

    total_tokens = total_tokens + n_tokens

    -- Parse tool calls
    local clean_text, tool_calls = parse_tool_calls(response)

    if #tool_calls == 0 then
      -- No tool calls — we're done
      -- If this wasn't round 1 and we were streaming, stream the final response now
      if stream_cb and round > 1 then
        for _, token in ipairs(collected) do
          stream_cb(token)
        end
      end
      final_response = clean_text ~= "" and clean_text or response
      break
    end

    -- Execute tool calls
    local results = {}
    for _, call in ipairs(tool_calls) do
      all_tool_calls[#all_tool_calls + 1] = call
      results[#results + 1] = self:_execute_tool(call)
    end

    -- Add assistant response (with tool calls) and tool results to history
    self._history[#self._history + 1] = { role = "assistant", content = response }
    self._history[#self._history + 1] = { role = "user", content = format_tool_results(results) }

    -- If we've hit the limit, break
    if round > self._tool_rounds then
      final_response = clean_text ~= "" and clean_text or response
      break
    end
  end

  -- Step 6: Store assistant response in history and memory
  -- Replace any intermediate tool messages with the final response
  -- Find and remove tool-round messages, keep final
  local clean_history = {}
  for _, msg in ipairs(self._history) do
    clean_history[#clean_history + 1] = msg
  end

  -- Add final response
  self._history[#self._history + 1] = { role = "assistant", content = final_response }
  self:_trim_history()

  -- Memorize assistant response
  self:_memorize(asst_msg_id, final_response, "assistant")

  -- Apply memory decay (every 5 turns)
  if self._memory and self._turn_count % 5 == 0 then
    pcall(self._memory.l2_decay, self._memory, self._chat_id)
    pcall(self._memory.l5_decay_edges, self._memory)
  end

  self._total_tokens = self._total_tokens + total_tokens

  return final_response, {
    tool_calls = all_tool_calls,
    memories_used = #memories,
    tokens_generated = total_tokens,
    turn = self._turn_count,
    message_id = asst_msg_id,
  }
end

-- ============================================================================
-- Convenience methods
-- ============================================================================

--- Get conversation history.
function Agent:get_history()
  return self._history
end

--- Clear conversation history (keeps memory intact).
function Agent:clear_history()
  self._history = {}
end

--- Get agent stats.
function Agent:stats()
  local mem_stats = nil
  if self._memory then
    local ok, s = pcall(self._memory.stats, self._memory, self._chat_id)
    if ok then mem_stats = s end
  end

  return {
    chat_id = self._chat_id,
    turn_count = self._turn_count,
    total_tokens = self._total_tokens,
    history_length = #self._history,
    tools_registered = (function()
      local n = 0; for _ in pairs(self._tools) do n = n + 1 end; return n
    end)(),
    memory = mem_stats,
  }
end

--- Pin a message in memory (marks it as permanently important).
function Agent:pin(message_id, content)
  if self._memory then
    self._memory:l4_pin(self._chat_id, message_id, content)
  end
end

--- Search memories directly.
function Agent:search_memory(query, top_k)
  return self:_retrieve_memories(query)
end

--- Update personality.
function Agent:set_personality(text)
  self._personality = text
end

--- Update knowledge base.
function Agent:set_knowledge(text)
  self._knowledge = text
end

--- Cleanup.
function Agent:close()
  -- Don't free models — caller owns them
  -- Don't close memory — caller owns it
  self._history = {}
end

-- ============================================================================
-- Expose utilities
-- ============================================================================

Agent.json_encode = json_encode
Agent.json_decode = json_decode
Agent.parse_tool_calls = parse_tool_calls
Agent.strip_think_tags = strip_think_tags

return Agent
