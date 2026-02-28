/**
 * SSE (Server-Sent Events) parser and streaming utilities.
 *
 * Handles partial chunks across frames, extracts data: fields,
 * and supports both OpenAI and Anthropic SSE formats.
 */

import type { SSEEvent } from './types';

// ── SSE Parser ──────────────────────────────────────────

export class SSEParser {
  private buffer = '';

  /** Feed a raw text chunk from the network. Returns parsed SSE events. */
  feed(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    const events: SSEEvent[] = [];

    // SSE events are separated by double newlines
    let boundary = this.buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);

      const event = this.parseBlock(block);
      if (event) events.push(event);

      boundary = this.buffer.indexOf('\n\n');
    }

    // Also handle \r\n\r\n (some servers use CRLF)
    boundary = this.buffer.indexOf('\r\n\r\n');
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 4);

      const event = this.parseBlock(block);
      if (event) events.push(event);

      boundary = this.buffer.indexOf('\r\n\r\n');
    }

    return events;
  }

  /** Reset parser state */
  reset() {
    this.buffer = '';
  }

  private parseBlock(block: string): SSEEvent | null {
    const lines = block.split(/\r?\n/);
    let eventType: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) continue; // comment
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      } else if (line.startsWith('data: ')) {
        dataLines.push(line.slice(6));
      }
    }

    if (dataLines.length === 0) return null;

    return {
      event: eventType,
      data: dataLines.join('\n'),
    };
  }
}

// ── fetchStream wrapper ─────────────────────────────────

declare global {
  function fetchStream(
    url: string,
    init: any,
    onChunk: (data: string) => void,
    onDone: (status: number, headers: any) => void,
    onError: (error: string) => void,
  ): number;
}

export interface StreamHandle {
  id: number;
}

/**
 * Start a streaming HTTP request. Calls onChunk for each raw text chunk
 * from the server. Returns a handle that can be used to identify the stream.
 *
 * Works across all targets — in Love2D it uses the fetchStream polyfill
 * which routes through Lua's love.thread + LuaSocket streaming workers.
 */
export function startStream(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    proxy?: string;
  },
  onChunk: (data: string) => void,
  onDone: (status: number, headers: any) => void,
  onError: (error: string) => void,
): StreamHandle {
  const id = fetchStream(url, init, onChunk, onDone, onError);
  return { id };
}
