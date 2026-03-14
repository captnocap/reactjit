import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SSEParser, startStream } from '../src/stream.ts';

describe('SSEParser protocol semantics', () => {
  it('buffers incomplete chunks until a full event boundary arrives', () => {
    const parser = new SSEParser();

    assert.deepEqual(parser.feed('data: hel'), []);
    assert.deepEqual(parser.feed('lo\n\n'), [
      { event: undefined, data: 'hello' },
    ]);
  });

  it('assembles multiline data fields and ignores comment-only blocks', () => {
    const parser = new SSEParser();

    assert.deepEqual(
      parser.feed(': keep-alive\n\nevent: message\ndata: first\ndata: second\n\n'),
      [{ event: 'message', data: 'first\nsecond' }],
    );
  });

  it('ignores event-only blocks without data fields', () => {
    const parser = new SSEParser();

    assert.deepEqual(parser.feed('event: ping\n\n'), []);
  });

  it('supports CRLF-delimited events', () => {
    const parser = new SSEParser();

    assert.deepEqual(
      parser.feed('event: message\r\ndata: first\r\n\r\ndata: second\r\n\r\n'),
      [
        { event: 'message', data: 'first' },
        { event: undefined, data: 'second' },
      ],
    );
  });

  it('preserves payload spaces beyond the single optional separator after data colon', () => {
    const parser = new SSEParser();

    assert.deepEqual(parser.feed('data:  indented\n\n'), [
      { event: undefined, data: ' indented' },
    ]);
  });

  it('preserves explicitly empty data payloads', () => {
    const parser = new SSEParser();

    assert.deepEqual(parser.feed('data:\n\n'), [
      { event: undefined, data: '' },
    ]);
  });

  it('does not merge consecutive events when CRLF and LF boundaries are mixed', () => {
    const parser = new SSEParser();

    assert.deepEqual(parser.feed('data: first\r\n\r\ndata: second\n\n'), [
      { event: undefined, data: 'first' },
      { event: undefined, data: 'second' },
    ]);
  });

  it('reset drops buffered partial state', () => {
    const parser = new SSEParser();

    assert.deepEqual(parser.feed('data: stale'), []);
    parser.reset();
    assert.deepEqual(parser.feed('data: fresh\n\n'), [
      { event: undefined, data: 'fresh' },
    ]);
  });
});

describe('startStream bridge contract', () => {
  it('passes through request arguments and returns the native stream id', () => {
    const original = globalThis.fetchStream;
    const captured = {};
    const onChunk = () => {};
    const onDone = () => {};
    const onError = () => {};

    globalThis.fetchStream = (url, init, chunk, done, error) => {
      captured.url = url;
      captured.init = init;
      captured.chunk = chunk;
      captured.done = done;
      captured.error = error;
      return 17;
    };

    try {
      const handle = startStream(
        'https://api.example.com/stream',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer token' },
          body: '{"stream":true}',
          proxy: 'socks5://127.0.0.1:9050',
        },
        onChunk,
        onDone,
        onError,
      );

      assert.deepEqual(handle, { id: 17 });
      assert.deepEqual(captured, {
        url: 'https://api.example.com/stream',
        init: {
          method: 'POST',
          headers: { Authorization: 'Bearer token' },
          body: '{"stream":true}',
          proxy: 'socks5://127.0.0.1:9050',
        },
        chunk: onChunk,
        done: onDone,
        error: onError,
      });
    } finally {
      if (original === undefined) {
        delete globalThis.fetchStream;
      } else {
        globalThis.fetchStream = original;
      }
    }
  });
});
