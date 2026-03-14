/**
 * MCP Transport Layer — stdio, SSE, and streamable HTTP.
 *
 * Provides a unified send/close interface across all MCP transports.
 * The linter uses these in Node.js; the runtime hook uses HTTP transports
 * in any target and stdio only in Node.js environments.
 */

import type { JsonRpcRequest, JsonRpcResponse } from './protocol';

// ── Transport interface ──────────────────────────────────

export interface MCPTransport {
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>;
  /** Send a notification (no response expected) */
  notify(request: JsonRpcRequest): void;
  close(): void;
}

// ── Stdio Transport (Node.js only) ───────────────────────

export interface StdioTransportConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export class StdioTransport implements MCPTransport {
  private process: any = null;
  private buffer = '';
  private pending = new Map<number, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>();
  private config: StdioTransportConfig;

  constructor(config: StdioTransportConfig) {
    this.config = config;
  }

  private async spawn(): Promise<void> {
    // Dynamic import — only available in Node.js
    const { spawn } = await import('child_process');

    const env = { ...process.env, ...this.config.env };
    this.process = spawn(this.config.command, this.config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      this.drainBuffer();
    });

    this.process.stderr.on('data', (chunk: Buffer) => {
      // MCP servers may log to stderr — ignore but don't crash
    });

    this.process.on('error', (err: Error) => {
      for (const [, p] of this.pending) {
        p.reject(new Error(`MCP process error: ${err.message}`));
      }
      this.pending.clear();
    });

    this.process.on('exit', (code: number | null) => {
      for (const [, p] of this.pending) {
        p.reject(new Error(`MCP process exited with code ${code}`));
      }
      this.pending.clear();
    });
  }

  private drainBuffer(): void {
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed);
        if (json.id != null && this.pending.has(json.id)) {
          const p = this.pending.get(json.id)!;
          this.pending.delete(json.id);
          p.resolve(json as JsonRpcResponse);
        }
        // Notifications from server (no id) — ignored for now
      } catch {
        // Non-JSON line from server — ignore
      }
    }
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.process) await this.spawn();

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = this.config.timeout || 30000;

      const timer = setTimeout(() => {
        this.pending.delete(request.id!);
        reject(new Error(`MCP request timed out after ${timeout}ms: ${request.method}`));
      }, timeout);

      this.pending.set(request.id!, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });

      const line = JSON.stringify(request) + '\n';
      this.process.stdin.write(line);
    });
  }

  notify(request: JsonRpcRequest): void {
    if (!this.process) return;
    const line = JSON.stringify(request) + '\n';
    this.process.stdin.write(line);
  }

  close(): void {
    if (this.process) {
      try { this.process.stdin.end(); } catch {}
      try { this.process.kill(); } catch {}
      this.process = null;
    }
    for (const [, p] of this.pending) {
      p.reject(new Error('Transport closed'));
    }
    this.pending.clear();
  }
}

// ── Streamable HTTP Transport (all targets) ──────────────

export interface StreamableHttpTransportConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class StreamableHttpTransport implements MCPTransport {
  private config: StreamableHttpTransportConfig;

  constructor(config: StreamableHttpTransportConfig) {
    this.config = config;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const url = this.config.url;
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...this.config.headers,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      } as any);

      if (!res.ok) {
        throw new Error(`MCP HTTP ${res.status}: ${await res.text()}`);
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // SSE response — parse for the result event
        const text = await res.text();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              if (json.id === request.id) return json;
            } catch {}
          }
        }
        throw new Error('MCP SSE response did not contain a matching result');
      }

      // Regular JSON response
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  notify(request: JsonRpcRequest): void {
    // Fire-and-forget POST
    fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    } as any).catch(() => {});
  }

  close(): void {
    // HTTP is stateless — nothing to close
  }
}

// ── SSE Transport (legacy, all targets) ──────────────────

export class SSETransport implements MCPTransport {
  private config: StreamableHttpTransportConfig;
  private sessionUrl: string | null = null;

  constructor(config: StreamableHttpTransportConfig) {
    this.config = config;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    // For SSE transport, POST to the endpoint and expect JSON back
    // The SSE GET stream is for server→client notifications (not implemented yet)
    const url = this.sessionUrl || this.config.url;
    const timeout = this.config.timeout || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      } as any);

      if (!res.ok) {
        throw new Error(`MCP SSE HTTP ${res.status}: ${await res.text()}`);
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const text = await res.text();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              if (json.id === request.id) {
                // Check for session URL in endpoint event
                if (json._sessionUrl) this.sessionUrl = json._sessionUrl;
                return json;
              }
            } catch {}
          }
        }
        throw new Error('MCP SSE response did not contain a matching result');
      }

      const json = await res.json();
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  notify(request: JsonRpcRequest): void {
    const url = this.sessionUrl || this.config.url;
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    } as any).catch(() => {});
  }

  close(): void {
    this.sessionUrl = null;
  }
}

// ── Factory ──────────────────────────────────────────────

export function createTransport(config: {
  transport: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
}): MCPTransport {
  switch (config.transport) {
    case 'stdio':
      if (!config.command) throw new Error('stdio transport requires "command"');
      return new StdioTransport({
        command: config.command,
        args: config.args,
        env: config.env,
        timeout: config.timeout,
      });

    case 'streamable-http':
      if (!config.url) throw new Error('streamable-http transport requires "url"');
      return new StreamableHttpTransport({
        url: config.url,
        headers: config.headers,
        timeout: config.timeout,
      });

    case 'sse':
      if (!config.url) throw new Error('sse transport requires "url"');
      return new SSETransport({
        url: config.url,
        headers: config.headers,
        timeout: config.timeout,
      });

    default:
      throw new Error(`Unknown MCP transport: ${config.transport}`);
  }
}
