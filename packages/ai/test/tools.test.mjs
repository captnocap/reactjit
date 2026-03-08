import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { executeToolCalls, formatToolResults, shouldContinueLoop } from '../src/tools.ts';

describe('AI tool execution contract', () => {
  it('executes known tools, decodes JSON args, and preserves call order', async () => {
    const seen = [];
    const results = await executeToolCalls(
      [
        { id: 'call_1', name: 'slow_tool', arguments: '{"value":2}' },
        { id: 'call_2', name: 'fast_tool', arguments: '{"value":3}' },
      ],
      [
        {
          name: 'slow_tool',
          description: 'slow',
          parameters: {},
          async execute(args) {
            seen.push(['slow:start', args.value]);
            await new Promise((resolve) => setTimeout(resolve, 20));
            seen.push(['slow:end', args.value]);
            return args.value * 2;
          },
        },
        {
          name: 'fast_tool',
          description: 'fast',
          parameters: {},
          async execute(args) {
            seen.push(['fast', args.value]);
            return args.value * 3;
          },
        },
      ],
    );

    assert.deepEqual(results, [
      { callId: 'call_1', name: 'slow_tool', result: 4 },
      { callId: 'call_2', name: 'fast_tool', result: 9 },
    ]);
    assert.deepEqual(seen, [
      ['slow:start', 2],
      ['fast', 3],
      ['slow:end', 2],
    ]);
  });

  it('normalizes invalid JSON args to an empty object', async () => {
    const results = await executeToolCalls(
      [{ id: 'call_1', name: 'echo', arguments: '{bad-json' }],
      [{
        name: 'echo',
        description: 'echo',
        parameters: {},
        async execute(args) {
          return Object.keys(args);
        },
      }],
    );

    assert.deepEqual(results, [
      { callId: 'call_1', name: 'echo', result: [] },
    ]);
  });

  it('reports unknown tools and thrown tool errors without rejecting the whole batch', async () => {
    const results = await executeToolCalls(
      [
        { id: 'call_1', name: 'missing_tool', arguments: '{}' },
        { id: 'call_2', name: 'explode', arguments: '{}' },
      ],
      [{
        name: 'explode',
        description: 'explode',
        parameters: {},
        async execute() {
          throw new Error('boom');
        },
      }],
    );

    assert.deepEqual(results, [
      {
        callId: 'call_1',
        name: 'missing_tool',
        result: null,
        error: 'Unknown tool: missing_tool',
      },
      {
        callId: 'call_2',
        name: 'explode',
        result: null,
        error: 'boom',
      },
    ]);
  });

  it('normalizes non-Error thrown values into strings', async () => {
    const results = await executeToolCalls(
      [{ id: 'call_1', name: 'explode', arguments: '{}' }],
      [{
        name: 'explode',
        description: 'explode',
        parameters: {},
        async execute() {
          throw 'plain boom';
        },
      }],
    );

    assert.deepEqual(results, [
      {
        callId: 'call_1',
        name: 'explode',
        result: null,
        error: 'plain boom',
      },
    ]);
  });
});

describe('AI tool result formatting contract', () => {
  it('formats successful and failed tool results through the provider', () => {
    const calls = [];
    const provider = {
      formatToolResult(callId, result) {
        calls.push([callId, result]);
        return { role: 'tool', toolCallId: callId, content: String(result) };
      },
    };

    const messages = formatToolResults(provider, [
      { callId: 'call_1', name: 'ok', result: { done: true } },
      { callId: 'call_2', name: 'bad', result: null, error: 'network down' },
    ]);

    assert.deepEqual(calls, [
      ['call_1', { done: true }],
      ['call_2', 'Error: network down'],
    ]);
    assert.deepEqual(messages, [
      { role: 'tool', toolCallId: 'call_1', content: '[object Object]' },
      { role: 'tool', toolCallId: 'call_2', content: 'Error: network down' },
    ]);
  });

  it('passes successful string results through unchanged', () => {
    const calls = [];
    const provider = {
      formatToolResult(callId, result) {
        calls.push([callId, result]);
        return { role: 'tool', toolCallId: callId, content: result };
      },
    };

    const messages = formatToolResults(provider, [
      { callId: 'call_1', name: 'echo', result: 'done' },
    ]);

    assert.deepEqual(calls, [
      ['call_1', 'done'],
    ]);
    assert.deepEqual(messages, [
      { role: 'tool', toolCallId: 'call_1', content: 'done' },
    ]);
  });
});

describe('AI loop continuation contract', () => {
  it('continues only when tool calls are present and rounds remain', () => {
    assert.equal(
      shouldContinueLoop({ role: 'assistant', content: '', toolCalls: [{ id: '1', name: 'x', arguments: '{}' }] }, 1, 3),
      true,
    );
    assert.equal(
      shouldContinueLoop({ role: 'assistant', content: '', toolCalls: [] }, 1, 3),
      false,
    );
    assert.equal(
      shouldContinueLoop({ role: 'assistant', content: '' }, 1, 3),
      false,
    );
    assert.equal(
      shouldContinueLoop({ role: 'assistant', content: '', toolCalls: [{ id: '1', name: 'x', arguments: '{}' }] }, 3, 3),
      false,
    );
  });
});
