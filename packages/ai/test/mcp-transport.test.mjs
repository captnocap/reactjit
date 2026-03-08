import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SSETransport,
  StreamableHttpTransport,
  createTransport,
} from '../src/mcp/transport.ts';

function makeHeaders(contentType) {
  return {
    get(name) {
      return name.toLowerCase() === 'content-type' ? contentType : null;
    },
  };
}

function makeJsonResponse(body, contentType = 'application/json') {
  return {
    ok: true,
    status: 200,
    headers: makeHeaders(contentType),
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function makeTextResponse(text, contentType = 'text/event-stream') {
  return {
    ok: true,
    status: 200,
    headers: makeHeaders(contentType),
    async json() {
      return JSON.parse(text);
    },
    async text() {
      return text;
    },
  };
}

describe('MCP streamable HTTP transport', () => {
  it('sends JSON-RPC requests and parses JSON responses', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url, init) => {
      calls.push([url, init]);
      return makeJsonResponse({ jsonrpc: '2.0', id: 7, result: { ok: true } });
    };

    try {
      const transport = new StreamableHttpTransport({
        url: 'https://mcp.example/rpc',
        headers: { Authorization: 'Bearer token' },
      });

      const result = await transport.send({ jsonrpc: '2.0', id: 7, method: 'ping', params: {} });

      assert.deepEqual(result, { jsonrpc: '2.0', id: 7, result: { ok: true } });
      assert.equal(calls[0][0], 'https://mcp.example/rpc');
      assert.equal(calls[0][1].method, 'POST');
      assert.equal(calls[0][1].headers.Authorization, 'Bearer token');
      assert.equal(calls[0][1].headers.Accept, 'application/json, text/event-stream');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('parses SSE responses and rejects HTTP failures', async () => {
    const originalFetch = globalThis.fetch;
    let mode = 'sse';

    globalThis.fetch = async () => {
      if (mode === 'sse') {
        return makeTextResponse('data: {"jsonrpc":"2.0","id":4,"result":{"tool":"ok"}}\n\ndata: [DONE]\n');
      }
      return {
        ok: false,
        status: 500,
        headers: makeHeaders('text/plain'),
        async text() {
          return 'server exploded';
        },
        async json() {
          return {};
        },
      };
    };

    try {
      const transport = new StreamableHttpTransport({ url: 'https://mcp.example/rpc' });
      const result = await transport.send({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
      assert.deepEqual(result, { jsonrpc: '2.0', id: 4, result: { tool: 'ok' } });

      mode = 'error';
      await assert.rejects(
        () => transport.send({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }),
        /MCP HTTP 500: server exploded/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('MCP SSE transport', () => {
  it('captures a session URL from SSE responses and reuses it for later requests and notifications', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url, init) => {
      calls.push([url, init]);
      if (calls.length === 1) {
        return makeTextResponse('data: {"jsonrpc":"2.0","id":1,"result":{"ready":true},"_sessionUrl":"https://mcp.example/session/abc"}\n');
      }
      return makeJsonResponse({ jsonrpc: '2.0', id: 2, result: { ok: true } });
    };

    try {
      const transport = new SSETransport({ url: 'https://mcp.example/connect' });

      const first = await transport.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
      assert.deepEqual(first, {
        jsonrpc: '2.0',
        id: 1,
        result: { ready: true },
        _sessionUrl: 'https://mcp.example/session/abc',
      });

      const second = await transport.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      transport.notify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

      assert.deepEqual(second, { jsonrpc: '2.0', id: 2, result: { ok: true } });
      assert.equal(calls[0][0], 'https://mcp.example/connect');
      assert.equal(calls[1][0], 'https://mcp.example/session/abc');
      assert.equal(calls[2][0], 'https://mcp.example/session/abc');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when an SSE response never yields a matching result and clears session state on close', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url, init) => {
      calls.push([url, init]);
      return makeTextResponse('data: {"jsonrpc":"2.0","id":999,"result":{"wrong":true}}\n');
    };

    try {
      const transport = new SSETransport({ url: 'https://mcp.example/connect' });

      await assert.rejects(
        () => transport.send({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
        /MCP SSE response did not contain a matching result/,
      );

      transport.close();
      transport.notify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

      assert.equal(calls[1][0], 'https://mcp.example/connect');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('MCP transport factory', () => {
  it('validates required config and creates the expected transport types', () => {
    assert.throws(() => createTransport({ transport: 'stdio' }), /stdio transport requires "command"/);
    assert.throws(() => createTransport({ transport: 'streamable-http' }), /streamable-http transport requires "url"/);
    assert.throws(() => createTransport({ transport: 'sse' }), /sse transport requires "url"/);
    assert.throws(() => createTransport({ transport: 'wat' }), /Unknown MCP transport: wat/);

    assert.ok(createTransport({ transport: 'streamable-http', url: 'https://mcp.example' }) instanceof StreamableHttpTransport);
    assert.ok(createTransport({ transport: 'sse', url: 'https://mcp.example' }) instanceof SSETransport);
  });
});
