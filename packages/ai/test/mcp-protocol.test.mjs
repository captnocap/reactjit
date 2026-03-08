import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MCP_CLIENT_INFO,
  MCP_PROTOCOL_VERSION,
  createInitializeRequest,
  createInitializedNotification,
  createNotification,
  createRequest,
  createToolCallRequest,
  createToolsListRequest,
  parseResponse,
} from '../src/mcp/protocol.ts';

describe('MCP protocol request builders', () => {
  it('creates incrementing JSON-RPC requests', () => {
    const first = createRequest('ping', { ok: true });
    const second = createRequest('pong');

    assert.equal(first.jsonrpc, '2.0');
    assert.equal(first.method, 'ping');
    assert.deepEqual(first.params, { ok: true });
    assert.equal(typeof first.id, 'number');
    assert.equal(second.id, first.id + 1);
  });

  it('creates notifications without ids', () => {
    assert.deepEqual(
      createNotification('notifications/ready', { scope: 'client' }),
      {
        jsonrpc: '2.0',
        method: 'notifications/ready',
        params: { scope: 'client' },
      },
    );
  });

  it('creates initialize, tools/list, tools/call, and initialized messages with MCP defaults', () => {
    const init = createInitializeRequest();
    const toolsList = createToolsListRequest();
    const toolCall = createToolCallRequest('lookup_weather', { city: 'SF' });
    const initialized = createInitializedNotification();

    assert.equal(init.method, 'initialize');
    assert.deepEqual(init.params, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: MCP_CLIENT_INFO,
    });

    assert.equal(toolsList.method, 'tools/list');
    assert.deepEqual(toolsList.params, {});

    assert.equal(toolCall.method, 'tools/call');
    assert.deepEqual(toolCall.params, {
      name: 'lookup_weather',
      arguments: { city: 'SF' },
    });

    assert.deepEqual(initialized, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    });
  });
});

describe('MCP protocol response parsing', () => {
  it('returns result payloads unchanged on success', () => {
    const result = { tools: [{ name: 'lookup_weather' }] };

    assert.equal(
      parseResponse({ jsonrpc: '2.0', id: 1, result }),
      result,
    );
  });

  it('throws formatted errors including code, message, and optional data', () => {
    assert.throws(
      () => parseResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      }),
      /MCP error -32601: Method not found/,
    );

    assert.throws(
      () => parseResponse({
        jsonrpc: '2.0',
        id: 2,
        error: { code: -32000, message: 'Server error', data: { detail: 'boom' } },
      }),
      /MCP error -32000: Server error — \{"detail":"boom"\}/,
    );
  });
});
