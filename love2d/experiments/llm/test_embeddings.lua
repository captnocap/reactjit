#!/usr/bin/env luajit
--[[
  test_embeddings.lua -- Test embedding model + memory integration

  Usage:
    cd experiments/llm
    LD_LIBRARY_PATH=lib luajit test_embeddings.lua
]]

local llm = require("llm")
local Memory = require("memory")

if not llm.available then
  print("ERROR: llm not available (missing libllama.so?)")
  os.exit(1)
end

if not Memory.available then
  print("ERROR: Memory module not available (missing libsqlite3?)")
  os.exit(1)
end

print("=== Embedding Model Test ===")
print()

-- ── Load embedding model ──
local EMBED_MODEL = arg[1] or "models/all-MiniLM-L6-v2-f16.gguf"

print("Loading embedding model: " .. EMBED_MODEL)
local embedder = llm.load(EMBED_MODEL, {
  embeddings = true,
  n_ctx = 512,
  n_threads = 4,
})

print()
print("Chat template: " .. tostring(embedder._chat_template ~= nil))
print("Embedding dimensions: " .. embedder._n_embd)
print()

-- ── Test single embedding ──
print("--- Single embedding test ---")

local emb1, dim = embedder:embed("The quick brown fox jumps over the lazy dog")
print("Embedded 'quick brown fox': " .. dim .. " dimensions")
print("First 5 values: " .. string.format("%.4f %.4f %.4f %.4f %.4f", emb1[1], emb1[2], emb1[3], emb1[4], emb1[5]))

-- Verify normalization
local norm = 0
for i = 1, dim do norm = norm + emb1[i] * emb1[i] end
norm = math.sqrt(norm)
print("L2 norm: " .. string.format("%.6f", norm) .. " (should be ~1.0)")
assert(math.abs(norm - 1.0) < 0.01, "Embedding should be L2-normalized")
print("[OK] Single embedding working")

-- ── Test semantic similarity ──
print()
print("--- Semantic similarity test ---")

local texts = {
  "The cat sat on the mat",
  "A feline rested on the rug",        -- semantically similar to #1
  "LuaJIT FFI bindings for llama.cpp",  -- completely different topic
  "The dog slept on the carpet",        -- similar to #1 (animal on surface)
  "Machine learning model inference",   -- different topic
}

local embeddings = {}
for i, text in ipairs(texts) do
  embeddings[i] = embedder:embed(text)
  print("  Embedded: " .. text:sub(1, 50))
end

-- Compute pairwise similarities
print()
print("Similarity matrix:")
print(string.format("  %-40s  %s", "", "1      2      3      4      5"))
for i = 1, #texts do
  local row = string.format("  %-40s", texts[i]:sub(1, 40))
  for j = 1, #texts do
    local sim = Memory.cosine_similarity(embeddings[i], embeddings[j])
    row = row .. string.format("  %.3f", sim)
  end
  print(row)
end

-- Verify: "cat on mat" should be more similar to "feline on rug" than to "LuaJIT FFI"
local sim_cat_feline = Memory.cosine_similarity(embeddings[1], embeddings[2])
local sim_cat_luajit = Memory.cosine_similarity(embeddings[1], embeddings[3])
print()
print("cat/feline similarity: " .. string.format("%.4f", sim_cat_feline))
print("cat/luajit similarity: " .. string.format("%.4f", sim_cat_luajit))
assert(sim_cat_feline > sim_cat_luajit, "Semantically similar texts should have higher similarity")
print("[OK] Semantic similarity makes sense")

-- ── Integration with Memory system ──
print()
print("--- Memory integration test ---")

local mem = Memory.open(":memory:")

-- Create an embed callback for the write pipeline
local function embed_fn(content)
  local emb, dim = embedder:embed(content)
  return { embedding = emb, model = "all-MiniLM-L6-v2-f16", dimensions = dim }
end

-- Process messages with embeddings
local messages = {
  { id = "msg1", content = "I'm building a local AI system with LuaJIT FFI bindings" },
  { id = "msg2", content = "The cat sat on the mat and purred contentedly" },
  { id = "msg3", content = "Error in the struct layout caused a segfault crash" },
  { id = "msg4", content = "The model generates tokens using a sampler chain" },
  { id = "msg5", content = "My kitten loves sleeping on soft blankets" },
}

for _, msg in ipairs(messages) do
  local result = mem:process_message("chat1", msg.id, msg.content, {
    embed = embed_fn,
  })
  print("  Processed: " .. msg.content:sub(1, 50) .. " [vectors=" .. tostring(result.l3_vector.success) .. "]")
end

-- Now search with a query embedding
print()
print("Vector search for 'a cat sleeping on a surface':")
local query_emb = embedder:embed("a cat sleeping on a surface")
local results = mem:l3_vector_search("chat1", query_emb, 5)
for i, r in ipairs(results) do
  print(string.format("  %d. score=%.4f msg=%s", i, r.score, r.entry.message_id))
end

-- The cat/kitten messages should rank higher than the tech messages
assert(#results > 0, "Should have vector search results")
local top_msg = results[1].entry.message_id
assert(top_msg == "msg2" or top_msg == "msg5",
  "Top result should be cat/kitten message, got " .. top_msg)
print("[OK] Vector search returns semantically relevant results")

-- Test ensemble retrieval with embeddings
print()
print("Ensemble retrieval for 'FFI struct error crash':")
local query_text = "FFI struct error crash"
local query_emb2 = embedder:embed(query_text)
local retrieved = mem:retrieve({
  chat_id = "chat1",
  query = query_text,
  query_embedding = query_emb2,
  top_k = 5,
})

for i, r in ipairs(retrieved) do
  print(string.format("  %d. [%s] score=%.4f %s", i, r.layer, r.score, r.content:sub(1, 60)))
end
assert(#retrieved > 0, "Should have retrieval results")
print("[OK] Ensemble retrieval with vectors working")

-- Stats
print()
local stats = mem:stats("chat1")
print("Memory stats: vectors=" .. stats.l3.vectors .. " lexical=" .. stats.l3.lexical_entries)
assert(stats.l3.vectors == 5, "Should have 5 vector embeddings")

-- Cleanup
mem:close()
embedder:free()

print()
print("=== ALL EMBEDDING TESTS PASSED ===")
