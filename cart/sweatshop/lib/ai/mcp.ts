// Minimal MCP client — Model Context Protocol.
//
// The reference implementation ships three transports (stdio, sse, ws).
// We port the protocol layer + a transport abstraction; stdio requires
// a host-side process spawn that sweatshop doesn't expose yet. WebSocket
// transport works today against local/remote MCP servers.

export type MCPToolSchema = {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
};

export type MCPServerInfo = {
  name: string;
  version?: string;
  capabilities?: Record<string, any>;
};

export type MCPTransport = {
  send: (msg: any) => Promise<void>;
  onMessage: (fn: (msg: any) => void) => void;
  close: () => void;
};

type Pending = { resolve: (v: any) => void; reject: (e: any) => void };

export class MCPClient {
  private transport: MCPTransport;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private notifyListeners = new Set<(msg: any) => void>();
  public info: MCPServerInfo | null = null;
  public tools: MCPToolSchema[] = [];

  constructor(transport: MCPTransport) {
    this.transport = transport;
    transport.onMessage((msg) => this.handle(msg));
  }

  private handle(msg: any) {
    if (msg && typeof msg === 'object' && 'id' in msg) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message || 'MCP error'));
        else pending.resolve(msg.result);
      }
    } else {
      for (const fn of this.notifyListeners) fn(msg);
    }
  }

  private request<T = any>(method: string, params?: any): Promise<T> {
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0', id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.transport.send(msg).catch(reject);
    });
  }

  async initialize(clientName = 'sweatshop', clientVersion = '0.1.0'): Promise<MCPServerInfo> {
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: clientName, version: clientVersion },
      capabilities: {},
    });
    this.info = {
      name: result?.serverInfo?.name || 'unknown',
      version: result?.serverInfo?.version,
      capabilities: result?.capabilities || {},
    };
    // Per spec, follow-up with notifications/initialized.
    await this.transport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return this.info;
  }

  async listTools(): Promise<MCPToolSchema[]> {
    const result = await this.request('tools/list');
    this.tools = (result?.tools || []) as MCPToolSchema[];
    return this.tools;
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
  }

  onNotification(fn: (msg: any) => void): () => void {
    this.notifyListeners.add(fn);
    return () => { this.notifyListeners.delete(fn); };
  }

  close(): void {
    this.transport.close();
  }
}

// True when the cart host exposes a WebSocket global (registered via
// v8_bindings_websocket.zig + runtime/hooks/websocket.ts shim).
export function websocketSupported(): boolean {
  return typeof (globalThis as any).WebSocket === 'function';
}

// WebSocket transport. Works over ws:// when the host has registered
// __ws_open/__ws_send/__ws_close and the JS shim is installed.
export function websocketTransport(url: string): MCPTransport {
  if (!websocketSupported()) {
    throw new Error('MCP websocket transport requires a host WebSocket binding — not registered in the current build');
  }
  const ws: any = new (globalThis as any).WebSocket(url);
  const listeners = new Set<(msg: any) => void>();
  const openPromise = new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e: any) => reject(e);
  });
  ws.onmessage = (ev: any) => {
    try {
      const parsed = JSON.parse(String(ev.data));
      for (const fn of listeners) fn(parsed);
    } catch (_e) {}
  };
  return {
    send: async (msg: any) => {
      await openPromise;
      ws.send(JSON.stringify(msg));
    },
    onMessage: (fn) => { listeners.add(fn); },
    close: () => { try { ws.close(); } catch (_e) {} },
  };
}

// Stdio transport — TODO: needs a host fn like __spawn(cmd, args) that
// exposes write/onStdout/onExit channels. Sweatshop has __exec for
// one-shot calls but not the streaming bidirectional variant MCP needs.
export function stdioTransport(_cmd: string, _args: string[]): MCPTransport {
  throw new Error('stdio transport needs host __spawn bidirectional streaming — not shipped yet');
}
