import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { anthropic } from '../src/providers/anthropic.ts';
import { openai } from '../src/providers/openai.ts';

const TOOL = {
  name: 'lookup_weather',
  description: 'Look up current weather',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string' },
    },
    required: ['city'],
  },
  async execute() {
    return { ok: true };
  },
};

describe('OpenAI provider contract', () => {
  it('formats chat completion requests with normalized base URL, tools, and stream options', () => {
    const req = openai.formatRequest(
      [
        { role: 'system', content: 'Be concise.' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }],
        },
        { role: 'tool', toolCallId: 'call_1', content: '{"temp":18}', name: 'lookup_weather' },
      ],
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseURL: 'https://api.example.test/',
        temperature: 0.2,
        maxTokens: 64,
      },
      [TOOL],
      true,
    );

    const body = JSON.parse(req.body);

    assert.equal(req.url, 'https://api.example.test/v1/chat/completions');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.authorization, 'Bearer sk-test');
    assert.equal(body.model, 'gpt-4o-mini');
    assert.equal(body.stream, true);
    assert.deepEqual(body.stream_options, { include_usage: false });
    assert.equal(body.temperature, 0.2);
    assert.equal(body.max_tokens, 64);
    assert.deepEqual(body.tools, [{
      type: 'function',
      function: {
        name: 'lookup_weather',
        description: 'Look up current weather',
        parameters: TOOL.parameters,
      },
    }]);
    assert.deepEqual(body.messages[1].tool_calls, [{
      id: 'call_1',
      type: 'function',
      function: { name: 'lookup_weather', arguments: '{"city":"SF"}' },
    }]);
    assert.equal(body.messages[2].tool_call_id, 'call_1');
  });

  it('falls back to API error messages when choices are missing', () => {
    assert.deepEqual(
      openai.parseResponse({ error: { message: 'bad api key' } }),
      { role: 'assistant', content: 'bad api key' },
    );

    assert.deepEqual(
      openai.parseResponse({}),
      { role: 'assistant', content: '' },
    );
  });

  it('parses normal responses, streaming deltas, and tool results', () => {
    assert.deepEqual(
      openai.parseResponse({
        choices: [{
          message: {
            content: 'Hello',
            tool_calls: [{
              id: 'call_1',
              function: { name: 'lookup_weather', arguments: '{"city":"SF"}' },
            }],
          },
        }],
      }),
      {
        role: 'assistant',
        content: 'Hello',
        toolCalls: [{ id: 'call_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }],
      },
    );

    assert.deepEqual(
      openai.parseStreamChunk('{"choices":[{"delta":{"content":"Hi"}}]}'),
      { content: 'Hi' },
    );

    assert.deepEqual(
      openai.parseStreamChunk('{"choices":[{"delta":{"tool_calls":[{"id":"call_1","function":{"name":"lookup_weather","arguments":"{\\"city\\":\\"SF\\"}"}}]},"finish_reason":"tool_calls"}]}'),
      {
        toolCalls: [{ id: 'call_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }],
        done: true,
      },
    );

    assert.deepEqual(openai.parseStreamChunk('[DONE]'), { done: true });
    assert.equal(openai.parseStreamChunk('{not-json}'), null);

    assert.deepEqual(openai.formatToolResult('call_1', { temp: 18 }), {
      role: 'tool',
      toolCallId: 'call_1',
      content: '{"temp":18}',
    });
  });

  it('marks stop chunks done even without content and preserves string tool results', () => {
    assert.deepEqual(
      openai.parseStreamChunk('{"choices":[{"delta":{},"finish_reason":"stop"}]}'),
      { done: true },
    );

    assert.deepEqual(openai.formatToolResult('call_2', 'plain text'), {
      role: 'tool',
      toolCallId: 'call_2',
      content: 'plain text',
    });
  });
});

describe('Anthropic provider contract', () => {
  it('formats requests with top-level system prompt, tool use blocks, and tool results', () => {
    const req = anthropic.formatRequest(
      [
        { role: 'system', content: 'system from message' },
        { role: 'user', content: 'What is the weather?' },
        {
          role: 'assistant',
          content: 'Checking.',
          toolCalls: [{ id: 'tool_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }],
        },
        { role: 'tool', toolCallId: 'tool_1', content: { temp: 18 } },
      ],
      {
        provider: 'anthropic',
        model: 'claude-sonnet',
        apiKey: 'anthropic-key',
        baseURL: 'https://anthropic.example/',
        systemPrompt: 'config wins',
        temperature: 0.4,
      },
      [TOOL],
      true,
    );

    const body = JSON.parse(req.body);

    assert.equal(req.url, 'https://anthropic.example/v1/messages');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers['x-api-key'], 'anthropic-key');
    assert.equal(req.headers['anthropic-version'], '2023-06-01');
    assert.equal(body.system, 'config wins');
    assert.equal(body.stream, true);
    assert.equal(body.max_tokens, 4096);
    assert.equal(body.temperature, 0.4);
    assert.deepEqual(body.tools, [{
      name: 'lookup_weather',
      description: 'Look up current weather',
      input_schema: TOOL.parameters,
    }]);
    assert.deepEqual(body.messages[1], {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Checking.' },
        { type: 'tool_use', id: 'tool_1', name: 'lookup_weather', input: { city: 'SF' } },
      ],
    });
    assert.deepEqual(body.messages[2], {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: 'tool_1',
        content: '{"temp":18}',
      }],
    });
  });

  it('joins system messages from input when config.systemPrompt is absent and supports tool-only assistant content', () => {
    const req = anthropic.formatRequest(
      [
        { role: 'system', content: 'first system line' },
        { role: 'system', content: 'second system line' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tool_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }],
        },
      ],
      {
        provider: 'anthropic',
        model: 'claude-sonnet',
        apiKey: 'anthropic-key',
      },
      [TOOL],
      false,
    );

    const body = JSON.parse(req.body);

    assert.equal(body.system, 'first system line\nsecond system line');
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [{
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'tool_1', name: 'lookup_weather', input: { city: 'SF' } },
      ],
    }]);
  });

  it('parses response blocks into assistant content and tool calls', () => {
    assert.deepEqual(
      anthropic.parseResponse({
        content: [
          { type: 'text', text: 'Let me check.' },
          { type: 'tool_use', id: 'tool_1', name: 'lookup_weather', input: { city: 'SF' } },
          { type: 'text', text: 'Done.' },
        ],
      }),
      {
        role: 'assistant',
        content: 'Let me check.Done.',
        toolCalls: [{ id: 'tool_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }],
      },
    );
  });

  it('parses API errors, end-turn stream deltas, invalid chunks, and object tool results', () => {
    assert.deepEqual(
      anthropic.parseResponse({ error: { message: 'quota exceeded' } }),
      { role: 'assistant', content: 'quota exceeded' },
    );

    assert.deepEqual(
      anthropic.parseStreamChunk('{"delta":{"stop_reason":"end_turn"}}', 'message_delta'),
      { done: true },
    );
    assert.equal(anthropic.parseStreamChunk('{not-json}', 'message_delta'), null);

    assert.deepEqual(anthropic.formatToolResult('tool_2', { ok: true }), {
      role: 'tool',
      toolCallId: 'tool_2',
      content: '{"ok":true}',
    });
  });

  it('parses streaming text and tool use events and resets state between messages', () => {
    assert.equal(anthropic.parseStreamChunk('{"type":"message_start"}', 'message_start'), null);
    assert.deepEqual(
      anthropic.parseStreamChunk('{"delta":{"type":"text_delta","text":"Hel"}}', 'content_block_delta'),
      { content: 'Hel' },
    );

    assert.equal(
      anthropic.parseStreamChunk('{"index":0,"content_block":{"type":"tool_use","id":"tool_1","name":"lookup_weather"}}', 'content_block_start'),
      null,
    );
    assert.equal(
      anthropic.parseStreamChunk('{"index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"city\\":\\"SF\\"}"}}', 'content_block_delta'),
      null,
    );
    assert.deepEqual(
      anthropic.parseStreamChunk('{"index":0}', 'content_block_stop'),
      { toolCalls: [{ id: 'tool_1', name: 'lookup_weather', arguments: '{"city":"SF"}' }] },
    );
    assert.deepEqual(
      anthropic.parseStreamChunk('{"delta":{"stop_reason":"tool_use"}}', 'message_delta'),
      { done: true },
    );

    assert.equal(anthropic.parseStreamChunk('{"type":"message_start"}', 'message_start'), null);
    assert.equal(anthropic.parseStreamChunk('{"index":0}', 'content_block_stop'), null);
    assert.deepEqual(anthropic.parseStreamChunk('{"type":"message_stop"}', 'message_stop'), { done: true });
  });

  it('formats tool results as tool messages', () => {
    assert.deepEqual(anthropic.formatToolResult('tool_1', 'ok'), {
      role: 'tool',
      toolCallId: 'tool_1',
      content: 'ok',
    });
  });
});
