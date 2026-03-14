#!/usr/bin/env luajit
--[[
  test.lua -- Standalone LLM inference test

  Usage:
    cd experiments/llm
    LD_LIBRARY_PATH=lib luajit test.lua

  Interactive mode: type messages, get responses.
  Type 'quit' or Ctrl+C to exit.
]]

local llm = require("llm")

if not llm.available then
  print("ERROR: llm not available (missing libllama.so?)")
  os.exit(1)
end

print("=== llm.lua test ===")
print("System: " .. llm.system_info())
print()

-- Load model
local MODEL_PATH = arg[1] or "/home/siah/.lmstudio/models/lmstudio-community/GLM-4.6V-Flash-GGUF/GLM-4.6V-Flash-Q4_K_M.gguf"

local model = llm.load(MODEL_PATH, {
  n_ctx = 2048,
  n_threads = 8,
})

print()
print("Chat template available: " .. tostring(model._chat_template ~= nil))
print()

-- ── Single-shot test ──
print("=== Single-shot generation test ===")
print()

local messages = {
  { role = "system", content = "You are a helpful assistant. Keep responses brief." },
  { role = "user",   content = "What is LuaJIT? Answer in 2 sentences." },
}

io.write("Assistant: ")
local response, n_tokens = model:chat(messages, function(token_text)
  io.write(token_text)
  io.flush()
end, {
  max_tokens = 256,
  temperature = 0.7,
})

print()
print(string.format("\n[generated %d tokens]", n_tokens))
print()

-- ── Interactive mode ──
print("=== Interactive mode (type 'quit' to exit) ===")
print()

local history = {
  { role = "system", content = "You are a helpful assistant. Keep responses concise." },
}

while true do
  io.write("You: ")
  io.flush()
  local input = io.read("*l")
  if not input or input == "quit" or input == "exit" then
    break
  end

  if input == "" then goto continue end

  table.insert(history, { role = "user", content = input })

  io.write("Assistant: ")
  io.flush()

  local resp = model:chat(history, function(token_text)
    io.write(token_text)
    io.flush()
  end, {
    max_tokens = 512,
    temperature = 0.7,
  })

  print()

  table.insert(history, { role = "assistant", content = resp })

  -- Trim history if it gets too long (keep system + last 10 turns)
  if #history > 21 then
    local trimmed = { history[1] }
    for i = #history - 10, #history do
      table.insert(trimmed, history[i])
    end
    history = trimmed
    print("[context trimmed to last 10 turns]")
  end

  ::continue::
end

print()
print("Cleaning up...")
model:free()
print("Done.")
