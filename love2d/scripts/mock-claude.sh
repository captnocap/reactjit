#!/bin/bash
# mock-claude.sh — Simulates Claude Code's stream-json protocol for testing
#
# Reads JSON from stdin, emits realistic stream_event responses with delays.
# Use this during development since real `claude` can't run inside a Claude Code session.
#
# Usage: Set executable="./scripts/mock-claude.sh" in your ClaudeCode component props.

set -e

# Emit system init
echo '{"type":"system","session_id":"mock-session-001","model":"claude-sonnet-4-20250514","version":"2.1.50"}'

# Read user messages from stdin (line-delimited JSON)
while IFS= read -r line; do
  # Parse the user message (basic extraction)
  user_msg=$(echo "$line" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')

  if [ -z "$user_msg" ]; then
    continue
  fi

  # Simulate thinking delay
  sleep 0.3

  # Emit message_start
  echo '{"type":"stream_event","event":{"type":"message_start","message":{"id":"msg_mock_001","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-20250514"}}}'

  # Emit content_block_start (text)
  echo '{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}}'

  # Stream response tokens
  response="I received your message. You said: \"${user_msg}\". This is a mock response for testing the Claude Code GUI. The real Claude would analyze your code, suggest edits, and use tools like Read, Edit, and Bash to help you."

  # Split into words and stream them
  for word in $response; do
    echo "{\"type\":\"stream_event\",\"event\":{\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"${word} \"}}}"
    sleep 0.05
  done

  # Emit content_block_stop
  echo '{"type":"stream_event","event":{"type":"content_block_stop","index":0}}'

  # Simulate a tool use
  sleep 0.2
  echo '{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_mock_001","name":"Read","input":{}}}}'
  echo '{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"file_path\": \"/home/siah/creative/reactjit/README.md\"}"}}}'
  echo '{"type":"stream_event","event":{"type":"content_block_stop","index":1}}'

  # Another text block after tool
  sleep 0.2
  echo '{"type":"stream_event","event":{"type":"content_block_start","index":2,"content_block":{"type":"text","text":""}}}'
  echo '{"type":"stream_event","event":{"type":"content_block_delta","index":2,"delta":{"type":"text_delta","text":"I found the file. Everything looks good!"}}}'
  echo '{"type":"stream_event","event":{"type":"content_block_stop","index":2}}'

  # Emit message_delta (end_turn)
  echo '{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":42}}}'

  # Emit message_stop
  echo '{"type":"stream_event","event":{"type":"message_stop"}}'

  # Emit result
  echo '{"type":"result","result":"Mock response complete","session_id":"mock-session-001","is_error":false}'

done
