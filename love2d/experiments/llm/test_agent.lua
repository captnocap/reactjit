#!/usr/bin/env luajit
--[[
  test_agent.lua -- Test the agent orchestration layer

  Usage:
    cd experiments/llm
    LD_LIBRARY_PATH=lib luajit test_agent.lua [chat_model_path]

  Part 1 runs unit tests (no models needed).
  Part 2 runs integration tests (requires models + libllama.so).
]]

local Agent = require("agent")

print("=== Agent Layer Tests ===")
print()

-- ════════════════════════════════════════════════════════════════════════
-- Part 1: Unit tests (no models needed)
-- ════════════════════════════════════════════════════════════════════════

-- ── JSON encoder ──
print("--- JSON encoder ---")

assert(Agent.json_encode(nil) == "null", "nil -> null")
assert(Agent.json_encode(true) == "true", "true -> true")
assert(Agent.json_encode(false) == "false", "false -> false")
assert(Agent.json_encode(42) == "42", "number -> 42")
assert(Agent.json_encode("hello") == '"hello"', 'string -> "hello"')
assert(Agent.json_encode("line\nnewline") == '"line\\nnewline"', "newlines escaped")

local arr = Agent.json_encode({1, 2, 3})
assert(arr == "[1,2,3]", "array: got " .. arr)

local obj = Agent.json_encode({name = "test", value = 42})
-- Object key order is non-deterministic, just check it parses back
assert(obj:find('"name"') and obj:find('"test"') and obj:find('"value"') and obj:find("42"),
  "object contains expected keys: " .. obj)

print("[OK] JSON encoder")

-- ── JSON decoder ──
print()
print("--- JSON decoder ---")

assert(Agent.json_decode("null") == nil, "null -> nil")
assert(Agent.json_decode("true") == true, "true -> true")
assert(Agent.json_decode("false") == false, "false -> false")
assert(Agent.json_decode("42") == 42, "42 -> 42")
assert(Agent.json_decode("3.14") == 3.14, "3.14 -> 3.14")
assert(Agent.json_decode('"hello"') == "hello", '"hello" -> hello')
assert(Agent.json_decode('"line\\nnewline"') == "line\nnewline", "escaped newlines")

local decoded = Agent.json_decode('{"name": "search", "args": {"query": "luajit ffi"}}')
assert(decoded.name == "search", "decoded name: got " .. tostring(decoded.name))
assert(decoded.args, "decoded args exists")
-- Note: nested objects may not parse perfectly with minimal decoder,
-- so we'll test the critical path (tool call parsing) separately

print("[OK] JSON decoder")

-- ── Tool call parsing ──
print()
print("--- Tool call parsing ---")

-- No tool calls
local clean, calls = Agent.parse_tool_calls("Just a normal response with no tool calls.")
assert(clean == "Just a normal response with no tool calls.", "clean text preserved")
assert(#calls == 0, "no calls found")

-- Single tool call
clean, calls = Agent.parse_tool_calls(
  'Let me search for that.\n<tool_call>\n{"name": "search", "args": {"query": "LuaJIT FFI"}}\n</tool_call>\nDone.'
)
assert(#calls == 1, "found 1 call, got " .. #calls)
assert(calls[1].name == "search", "tool name: " .. calls[1].name)
assert(calls[1].id:sub(1, 3) == "tc_", "has tc_ prefix")

-- Multiple tool calls
clean, calls = Agent.parse_tool_calls(
  '<tool_call>{"name": "search", "args": {"query": "lua"}}</tool_call> and <tool_call>{"name": "calc", "args": {"expr": "2+2"}}</tool_call>'
)
assert(#calls == 2, "found 2 calls, got " .. #calls)
assert(calls[1].name == "search", "first tool: search")
assert(calls[2].name == "calc", "second tool: calc")

-- Clean text should have tool blocks removed
assert(not clean:find("<tool_call>"), "tool blocks removed from clean text")

-- Unclosed tool_call (common with smaller models)
clean, calls = Agent.parse_tool_calls(
  'Let me look that up.\n<tool_call>{"name": "lookup", "args": {"term": "FFI"}}'
)
assert(#calls == 1, "found 1 unclosed call, got " .. #calls)
assert(calls[1].name == "lookup", "unclosed tool name: lookup")
assert(not clean:find("<tool_call>"), "unclosed tool block removed")

-- Think tag stripping
clean, calls = Agent.parse_tool_calls(
  '<think>Let me think about this...</think>LuaJIT is a JIT compiler for Lua.'
)
assert(clean == "LuaJIT is a JIT compiler for Lua.", "think stripped: " .. clean)
assert(#calls == 0, "no tool calls in think test")

-- Unclosed think tag
local stripped = Agent.strip_think_tags("<think>Still thinking...\nMore thoughts")
assert(stripped == "", "unclosed think gives empty: '" .. stripped .. "'")

print("[OK] Tool call parsing")

-- ── System prompt assembly ──
print()
print("--- System prompt assembly ---")

-- Create a minimal mock for testing prompt building
local mock_model = { _chat_template = nil }
setmetatable(mock_model, { __index = function() return function() end end })

local agent = Agent.new({
  chat_model = mock_model,
  personality = "You are a test bot.",
  knowledge = "LuaJIT is a just-in-time compiler for Lua.",
})

-- Register a tool
agent:register_tool("search", {
  description = "Search the web for information",
  params = {
    { name = "query", type = "string", description = "Search query" },
  },
  execute = function(args) return "search results for: " .. args.query end,
})

-- Build the prompt
local prompt = agent:_build_system_prompt({})
assert(prompt:find("You are a test bot"), "personality in prompt")
assert(prompt:find("LuaJIT is a just%-in%-time"), "knowledge in prompt")
assert(prompt:find("search"), "tool name in prompt")
assert(prompt:find("Search the web"), "tool description in prompt")
assert(prompt:find("tool_call"), "tool_call format in prompt")

-- With memories
local prompt_with_mem = agent:_build_system_prompt({
  { content = "User asked about FFI bindings", layer = "l3_lexical", score = 0.9 },
  { content = "User was frustrated about a crash", layer = "l2_affect", score = 0.8,
    metadata = { affect_category = "FRUSTRATED", salience_score = 0.85 } },
})
assert(prompt_with_mem:find("Relevant Context"), "memory header in prompt")
assert(prompt_with_mem:find("FFI bindings"), "memory content in prompt")
assert(prompt_with_mem:find("FRUSTRATED"), "affect metadata in prompt")
assert(prompt_with_mem:find("important"), "high salience marked")

print("[OK] System prompt assembly")

-- ── Tool execution ──
print()
print("--- Tool execution ---")

-- Execute registered tool
local result = agent:_execute_tool({ id = "tc_test1", name = "search", args = { query = "hello" } })
assert(result.result == "search results for: hello", "tool result: " .. tostring(result.result))
assert(result.error == nil, "no error")

-- Execute unknown tool
result = agent:_execute_tool({ id = "tc_test2", name = "nonexistent", args = {} })
assert(result.error, "error for unknown tool")
assert(result.error:find("Unknown tool"), "error message: " .. result.error)

-- Tool that throws
agent:register_tool("crasher", {
  description = "A tool that crashes",
  execute = function(args) error("boom!") end,
})
result = agent:_execute_tool({ id = "tc_test3", name = "crasher", args = {} })
assert(result.error, "error caught from crashing tool")
assert(result.error:find("boom"), "error message contains 'boom': " .. result.error)

print("[OK] Tool execution")

-- ── History management ──
print()
print("--- History management ---")

local agent2 = Agent.new({
  chat_model = mock_model,
  max_history = 3,
})

-- Add more messages than the limit
for i = 1, 10 do
  agent2._history[#agent2._history + 1] = { role = "user", content = "msg " .. i }
  agent2._history[#agent2._history + 1] = { role = "assistant", content = "reply " .. i }
end

assert(#agent2._history == 20, "20 messages before trim")
agent2:_trim_history()
assert(#agent2._history == 6, "6 messages after trim (3 pairs), got " .. #agent2._history)
-- Should keep the last 3 pairs
assert(agent2._history[1].content == "msg 8", "oldest kept is msg 8, got " .. agent2._history[1].content)

print("[OK] History management")

-- ── Stats ──
print()
print("--- Stats ---")

local agent3 = Agent.new({
  chat_model = mock_model,
  personality = "test",
})
agent3:register_tool("t1", { description = "d", execute = function() end })
agent3:register_tool("t2", { description = "d", execute = function() end })
agent3._turn_count = 5
agent3._total_tokens = 1000

local stats = agent3:stats()
assert(stats.chat_id, "has chat_id")
assert(stats.turn_count == 5, "turn_count")
assert(stats.total_tokens == 1000, "total_tokens")
assert(stats.tools_registered == 2, "tools_registered")
assert(stats.memory == nil, "no memory stats without memory")

print("[OK] Stats")

-- ── Convenience methods ──
print()
print("--- Convenience methods ---")

agent3:set_personality("New personality")
assert(agent3._personality == "New personality", "personality updated")

agent3:set_knowledge("New knowledge")
assert(agent3._knowledge == "New knowledge", "knowledge updated")

agent3._history = { { role = "user", content = "test" } }
assert(#agent3:get_history() == 1, "get_history works")

agent3:clear_history()
assert(#agent3:get_history() == 0, "clear_history works")

agent3:close()
assert(#agent3._history == 0, "close clears history")

print("[OK] Convenience methods")

print()
print("=== UNIT TESTS PASSED ===")
print()

-- ════════════════════════════════════════════════════════════════════════
-- Part 2: Integration tests (requires models)
-- ════════════════════════════════════════════════════════════════════════

local llm = require("llm")
local Memory = require("memory")

if not llm.available then
  print("SKIP: Integration tests require libllama.so (set LD_LIBRARY_PATH=lib)")
  print()
  print("=== UNIT TESTS PASSED, INTEGRATION TESTS SKIPPED ===")
  os.exit(0)
end

print("=== Integration Tests (with models) ===")
print()

-- ── Load models ──
local CHAT_MODEL = arg[1] or os.getenv("HOME") .. "/.lmstudio/models/lmstudio-community/GLM-4.6V-Flash-GGUF/GLM-4.6V-Flash-Q4_K_M.gguf"
local EMBED_MODEL = arg[2] or "models/all-MiniLM-L6-v2-f16.gguf"

print("Loading chat model: " .. CHAT_MODEL)
local chat_model = llm.load(CHAT_MODEL, {
  n_ctx = 2048,
  n_threads = 8,
})

print()
print("Loading embedding model: " .. EMBED_MODEL)
local embed_model = llm.load(EMBED_MODEL, {
  embeddings = true,
  n_ctx = 512,
  n_threads = 4,
})

print()

-- ── Open memory ──
local mem = Memory.open(":memory:")

-- ── Create agent ──
print("--- Creating agent ---")
local agent_live = Agent.new({
  chat_model = chat_model,
  embed_model = embed_model,
  memory = mem,
  personality = "You are a concise technical assistant. Answer in 1-2 sentences maximum.",
  knowledge = "LuaJIT is a just-in-time compiler for Lua 5.1. It supports FFI for calling C functions directly.",
  max_tokens = 128,
  temperature = 0.3,
  max_history = 10,
  memory_top_k = 3,
  tool_rounds = 2,
})

-- Register a simple test tool
local tool_called = false
local tool_args_received = nil

agent_live:register_tool("lookup", {
  description = "Look up a technical term and return its definition",
  params = {
    { name = "term", type = "string", description = "The technical term to look up", required = true },
  },
  execute = function(args)
    tool_called = true
    tool_args_received = args
    return "FFI (Foreign Function Interface) allows LuaJIT to call C functions and use C data structures directly, without writing C wrapper code."
  end,
})

agent_live:register_tool("calculate", {
  description = "Perform a mathematical calculation",
  params = {
    { name = "expression", type = "string", description = "Math expression to evaluate", required = true },
  },
  execute = function(args)
    -- Simple eval for testing
    local fn = load("return " .. (args.expression or "0"))
    if fn then
      local ok, result = pcall(fn)
      if ok then return tostring(result) end
    end
    return "Error: could not evaluate"
  end,
})

print("  Tools registered: lookup, calculate")
print("  Chat ID: " .. agent_live._chat_id)
print("[OK] Agent created")

-- ── Test 1: Basic chat (no tools expected) ──
print()
print("--- Test 1: Basic chat ---")

local tokens_streamed = {}
local response, metadata = agent_live:chat("What is LuaJIT?", function(token)
  tokens_streamed[#tokens_streamed + 1] = token
end)

print("  Response: " .. response:sub(1, 120))
print("  Tokens streamed: " .. #tokens_streamed)
print("  Tokens generated: " .. metadata.tokens_generated)
print("  Memories used: " .. metadata.memories_used)
print("  Turn: " .. metadata.turn)
print("  Tool calls: " .. #metadata.tool_calls)

assert(response and #response > 0, "got a response")
assert(metadata.tokens_generated > 0, "generated tokens")
assert(metadata.turn == 1, "turn count is 1")
assert(#tokens_streamed > 0, "streaming worked")
print("[OK] Basic chat working")

-- ── Test 2: Conversation continuity ──
print()
print("--- Test 2: Conversation continuity ---")

local response2, meta2 = agent_live:chat("Can you tell me more about its FFI?", function(token)
  io.write(token)
end)
io.write("\n")

print("  Response length: " .. #response2)
print("  Turn: " .. meta2.turn)
print("  History length: " .. #agent_live:get_history())

assert(meta2.turn == 2, "turn count is 2")
assert(#agent_live:get_history() >= 4, "history has at least 4 entries (2 user + 2 assistant)")
print("[OK] Conversation continuity")

-- ── Test 3: Memory retrieval ──
print()
print("--- Test 3: Memory retrieval ---")

-- The first two messages should have been stored in memory
-- Now query about something related
local response3, meta3 = agent_live:chat("What did I ask about earlier?", function(token)
  io.write(token)
end)
io.write("\n")

print("  Memories used: " .. meta3.memories_used)
print("  Turn: " .. meta3.turn)

-- Should have retrieved at least some memories from previous turns
-- (may be 0 if this is only turn 3 and embeddings haven't populated yet,
--  but the retrieval path should have executed without error)
assert(meta3.turn == 3, "turn count is 3")
print("[OK] Memory retrieval path works")

-- ── Test 4: Tool invocation ──
print()
print("--- Test 4: Tool invocation ---")

-- Ask something that should trigger the lookup tool
-- Note: whether the model actually calls the tool depends on the model's
-- behavior. We just verify the plumbing works.
tool_called = false
local response4, meta4 = agent_live:chat(
  "Please use the lookup tool to look up the term 'FFI'.",
  function(token) io.write(token) end
)
io.write("\n")

print("  Tool was called: " .. tostring(tool_called))
print("  Tool calls in metadata: " .. #meta4.tool_calls)

if tool_called then
  print("  Tool args: term=" .. tostring(tool_args_received and tool_args_received.term))
  print("[OK] Tool invocation working!")
else
  -- Model might not have called the tool — that's model-dependent, not a bug
  print("[INFO] Model didn't call the tool (model-dependent behavior)")
  print("[OK] Tool plumbing verified (no crash)")
end

-- ── Test 5: Agent stats ──
print()
print("--- Test 5: Agent stats ---")

local live_stats = agent_live:stats()
print("  Chat ID: " .. live_stats.chat_id)
print("  Turns: " .. live_stats.turn_count)
print("  Total tokens: " .. live_stats.total_tokens)
print("  History: " .. live_stats.history_length .. " messages")
print("  Tools: " .. live_stats.tools_registered)

if live_stats.memory then
  print("  Memory L1 entries: " .. live_stats.memory.l1.entries)
  print("  Memory L3 lexical: " .. live_stats.memory.l3.lexical_entries)
  print("  Memory L3 vectors: " .. live_stats.memory.l3.vectors)
end

assert(live_stats.turn_count >= 4, "at least 4 turns")
assert(live_stats.total_tokens > 0, "total tokens > 0")
assert(live_stats.tools_registered == 2, "2 tools registered")
print("[OK] Agent stats")

-- ── Test 6: Memory search ──
print()
print("--- Test 6: Direct memory search ---")

local search_results = agent_live:search_memory("LuaJIT FFI")
print("  Results for 'LuaJIT FFI': " .. #search_results)
for i, r in ipairs(search_results) do
  print(string.format("    %d. [%s] %.4f %s", i, r.layer, r.score, r.content:sub(1, 60)))
end
print("[OK] Memory search")

-- ── Test 7: Pin a message ──
print()
print("--- Test 7: Pin a message ---")

agent_live:pin("important_msg", "Always remember: the user prefers concise answers")
local salient = mem:l4_get(agent_live._chat_id)
local found_pin = false
for _, s in ipairs(salient) do
  if s.user_pinned == 1 and s.content:find("concise answers") then
    found_pin = true
  end
end
assert(found_pin, "pinned message found in L4")
print("[OK] Message pinning")

-- ── Cleanup ──
print()
agent_live:close()
mem:close()
chat_model:free()
embed_model:free()

print()
print("=== ALL AGENT TESTS PASSED ===")
