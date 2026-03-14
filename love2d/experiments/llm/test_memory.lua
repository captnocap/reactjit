#!/usr/bin/env luajit
--[[
  test_memory.lua -- Standalone test for the M3A memory system

  Usage:
    cd experiments/llm
    luajit test_memory.lua
]]

local Memory = require("memory")

if not Memory.available then
  print("ERROR: Memory module not available (missing libsqlite3?)")
  os.exit(1)
end

print("=== M3A Memory System Test ===")
print()

-- Open in-memory database
local mem = Memory.open(":memory:")
print("[OK] Opened in-memory database")

-- ── L1: River ──
print()
print("--- L1: River (sliding window buffer) ---")

mem:l1_add("chat1", "msg1", "Hello, how are you?", 5)
mem:l1_add("chat1", "msg2", "I'm building a local AI system with LuaJIT and llama.cpp", 12)
mem:l1_add("chat1", "msg3", "The error in the FFI bindings was caused by a struct layout mismatch", 15)

local entries = mem:l1_get("chat1", 10)
print("  Entries: " .. #entries)
assert(#entries == 3, "Expected 3 L1 entries")

local tokens = mem:l1_token_count("chat1")
print("  Token count: " .. tokens)
assert(tokens == 32, "Expected 32 tokens")

local stats = mem:l1_stats("chat1")
print("  Stats: " .. stats.total_entries .. " entries, " .. stats.total_tokens .. " tokens")
print("[OK] L1 River working")

-- ── L2: Feeling ──
print()
print("--- L2: Feeling (affect index) ---")

mem:l2_add("chat1", "msg3", "FRUSTRATED", 0.8, "User encountered a struct layout bug")
mem:l2_add("chat1", "msg2", "CURIOUS", 0.6, "Building something new and exploratory")

local affects = mem:l2_get("chat1")
print("  Affect entries: " .. #affects)
assert(#affects == 2, "Expected 2 L2 entries")
print("  Top affect: " .. affects[1].affect_category .. " (" .. affects[1].intensity .. ")")

-- Test decay
local decayed = mem:l2_decay("chat1", 0.9)
print("  Decayed " .. decayed .. " entries")

local after_decay = mem:l2_get("chat1")
print("  Top after decay: intensity=" .. string.format("%.2f", after_decay[1].intensity)
  .. " decay=" .. string.format("%.2f", after_decay[1].decay_factor))
print("[OK] L2 Feeling working")

-- ── L3.1: Vectors ──
print()
print("--- L3.1: Vectors (embedding search) ---")

-- Fake embeddings for testing
local emb1 = {0.1, 0.2, 0.3, 0.4, 0.5}
local emb2 = {0.5, 0.4, 0.3, 0.2, 0.1}
local emb3 = {0.11, 0.21, 0.29, 0.41, 0.49}  -- similar to emb1

mem:l3_vector_add("chat1", "msg1", "Hello, how are you?", emb1, "test-model")
mem:l3_vector_add("chat1", "msg2", "I'm building an AI system", emb2, "test-model")
mem:l3_vector_add("chat1", "msg3", "The error was caused by a mismatch", emb3, "test-model")

-- Search with a query similar to emb1
local query_emb = {0.12, 0.19, 0.31, 0.39, 0.51}
local results = mem:l3_vector_search("chat1", query_emb, 3)
print("  Vector search results: " .. #results)
for i, r in ipairs(results) do
  print("    " .. i .. ". score=" .. string.format("%.4f", r.score) .. " msg=" .. r.entry.message_id)
end
assert(#results == 3, "Expected 3 vector results")
assert(results[1].entry.message_id == "msg1" or results[1].entry.message_id == "msg3",
  "Top result should be msg1 or msg3 (similar embeddings)")
print("[OK] L3.1 Vectors working")

-- ── L3.2: Lexical FTS ──
print()
print("--- L3.2: Lexical FTS5 ---")

mem:l3_lexical_add("chat1", "msg1", "Hello, how are you doing today?")
mem:l3_lexical_add("chat1", "msg2", "Building a local AI system with LuaJIT FFI bindings")
mem:l3_lexical_add("chat1", "msg3", "The FFI struct layout error broke the bindings")

local fts_results = mem:l3_lexical_search("chat1", "FFI bindings", 5)
print("  FTS results for 'FFI bindings': " .. #fts_results)
for i, r in ipairs(fts_results) do
  print("    " .. i .. ". score=" .. string.format("%.4f", r.score) .. " " .. r.content:sub(1, 50))
end
assert(#fts_results >= 1, "Expected at least 1 FTS result")
print("[OK] L3.2 Lexical FTS working")

-- ── L3.3: Entity Graph ──
print()
print("--- L3.3: Entity-Relation Graph ---")

local e1 = mem:l3_entity_add("TECHNOLOGY", "LuaJIT", "chat1")
local e2 = mem:l3_entity_add("TECHNOLOGY", "llama.cpp", "chat1")
local e3 = mem:l3_entity_add("CONCEPT", "FFI bindings", "chat1")

mem:l3_relation_add(e1.id, e3.id, "USES", "msg2", 0.9)
mem:l3_relation_add(e2.id, e3.id, "USES", "msg2", 0.9)
mem:l3_relation_add(e1.id, e2.id, "INTEGRATES_WITH", "msg2", 0.8)

local related = mem:l3_related_entities("LuaJIT", "chat1", 2)
print("  Related to LuaJIT (2 hops): " .. #related)
for _, r in ipairs(related) do
  print("    - " .. r.entity.entity_value .. " (distance " .. r.distance .. ")")
end
assert(#related >= 2, "Expected at least 2 related entities")
print("[OK] L3.3 Entity Graph working")

-- ── L4: Salience ──
print()
print("--- L4: Wound (salience markers) ---")

mem:l4_add("chat1", "msg3", "The FFI struct layout error broke the bindings", 0.85)
mem:l4_pin("chat1", "msg2", "Building a local AI system with LuaJIT FFI bindings")

local salient = mem:l4_get("chat1")
print("  Salient entries: " .. #salient)
for _, s in ipairs(salient) do
  local pinned = s.user_pinned == 1 and " [PINNED]" or ""
  print("    - score=" .. string.format("%.2f", s.salience_score) .. pinned .. " " .. s.content:sub(1, 50))
end
assert(#salient == 2, "Expected 2 salience entries")
print("[OK] L4 Salience working")

-- ── L5: Co-occurrence ──
print()
print("--- L5: Companion (co-occurrence graph) ---")

local n1 = mem:l5_node_add("CONCEPT", "luajit", "chat1")
local n2 = mem:l5_node_add("CONCEPT", "ffi", "chat1")
local n3 = mem:l5_node_add("CONCEPT", "llama", "chat1")

mem:l5_edge_add(n1.id, n2.id, 1.0)
mem:l5_edge_add(n1.id, n3.id, 1.0)
mem:l5_edge_add(n2.id, n3.id, 1.0)

-- Reinforce luajit<->ffi edge
mem:l5_edge_add(n1.id, n2.id, 1.0)

local cooccur = mem:l5_cooccurring(n1.id, 5)
print("  Co-occurring with 'luajit': " .. #cooccur)
for _, c in ipairs(cooccur) do
  print("    - " .. c.node_value .. " (weight=" .. string.format("%.3f", c.weight) .. ")")
end
assert(#cooccur == 2, "Expected 2 co-occurring nodes")
print("[OK] L5 Co-occurrence working")

-- ── Write Pipeline ──
print()
print("--- Write Pipeline ---")

local write_result = mem:process_message("chat2", "msg10",
  "I just discovered that the error in llama.cpp FFI bindings was caused by a struct layout mismatch. Fixed it!")

print("  L1: " .. tostring(write_result.l1.success))
print("  L2: " .. tostring(write_result.l2.success) .. " (skipped=" .. tostring(write_result.l2.skipped) .. ")")
print("  L3 lexical: " .. tostring(write_result.l3_lexical.success))
print("  L4: " .. tostring(write_result.l4.success) .. " (skipped=" .. tostring(write_result.l4.skipped) .. ")")
print("  L5: " .. tostring(write_result.l5.success)
  .. " (nodes=" .. tostring(write_result.l5.nodes) .. ", edges=" .. tostring(write_result.l5.edges) .. ")")
assert(write_result.l1.success, "L1 should succeed")
assert(write_result.l3_lexical.success, "L3 lexical should succeed")
print("[OK] Write pipeline working")

-- ── Ensemble Retrieval ──
print()
print("--- Ensemble Retrieval ---")

-- Add more data first
mem:process_message("chat2", "msg11", "The solution was to match the exact C struct layout in the FFI cdef")
mem:process_message("chat2", "msg12", "Now the model loads correctly and generates tokens")
mem:process_message("chat2", "msg13", "I learned that LuaJIT FFI requires exact struct alignment")

local retrieved = mem:retrieve({
  chat_id = "chat2",
  query = "FFI struct error",
  top_k = 5,
})

print("  Retrieved " .. #retrieved .. " memories:")
for i, r in ipairs(retrieved) do
  print(string.format("    %d. [%s] score=%.4f %s", i, r.layer, r.score, r.content:sub(1, 60)))
end
assert(#retrieved > 0, "Expected at least 1 retrieved memory")
print("[OK] Ensemble retrieval working")

-- ── Curation ──
print()
print("--- Curation API ---")

local affected = mem:mute_message("msg10")
print("  Muted msg10, affected layers: " .. table.concat(affected, ", "))

mem:boost_l3("msg11", 3.0)
print("  Boosted msg11 L3 encoding by 3x")
print("[OK] Curation working")

-- ── Statistics ──
print()
print("--- Statistics ---")

local stats2 = mem:stats("chat2")
print("  L1: " .. stats2.l1.entries .. " entries, " .. stats2.l1.total_tokens .. " tokens")
print("  L2: " .. stats2.l2.entries .. " entries")
print("  L3: vectors=" .. stats2.l3.vectors .. " lexical=" .. stats2.l3.lexical_entries
  .. " entities=" .. stats2.l3.entities .. " relations=" .. stats2.l3.relations)
print("  L4: " .. stats2.l4.entries .. " entries, " .. stats2.l4.pinned .. " pinned")
print("  L5: " .. stats2.l5.nodes .. " nodes, " .. stats2.l5.edges .. " edges")
print("[OK] Statistics working")

-- ── Utility functions ──
print()
print("--- Utility functions ---")

local salience = Memory.compute_salience("I found a critical error in the FFI bindings that crashed the system. I fixed it and learned that struct alignment matters. Here's the solution: https://example.com ```code```")
print("  Salience of rich message: " .. string.format("%.2f", salience))
assert(salience > 0.5, "Rich message with error+fix+learning+code+url should have high salience")

local concepts = Memory.extract_concepts("Building a LuaJIT FFI bridge to llama.cpp for local LLM inference")
print("  Concepts extracted: " .. #concepts .. " -> " .. table.concat(concepts, ", "))
assert(#concepts > 0, "Should extract at least 1 concept")

local sim = Memory.cosine_similarity({1,0,0}, {1,0,0})
print("  Cosine similarity [1,0,0].[1,0,0] = " .. string.format("%.4f", sim))
assert(math.abs(sim - 1.0) < 0.001, "Identical vectors should have similarity 1.0")

sim = Memory.cosine_similarity({1,0,0}, {0,1,0})
print("  Cosine similarity [1,0,0].[0,1,0] = " .. string.format("%.4f", sim))
assert(math.abs(sim) < 0.001, "Orthogonal vectors should have similarity 0.0")
print("[OK] Utilities working")

-- ── Config ──
print()
print("--- Configuration ---")

mem:set_config("l1_max_tokens", 4000)
local val = mem:get_config("l1_max_tokens")
print("  Set l1_max_tokens = 4000, read back = " .. tostring(val))

local all_config = mem:get_all_config()
local config_count = 0
for _ in pairs(all_config) do config_count = config_count + 1 end
print("  Full config keys: " .. config_count)
print("[OK] Configuration working")

-- Cleanup
mem:close()

print()
print("=== ALL TESTS PASSED ===")
