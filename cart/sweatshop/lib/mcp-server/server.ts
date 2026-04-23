import { execAsync } from '../../../../runtime/hooks/process';
import { callTool, getCallLog, listTools } from './registry';
import { bridgePaths, bridgeSupported, capabilityBanner, initialServerState, probeTransportCapabilities } from './transport';
import type { McpClientRecord, McpServerState } from './types';

const host: any = globalThis as any;

const listeners = new Set<() => void>();
let state: McpServerState = initialServerState();
let bridgeLoop: any = null;
let bridgeBusy = false;
let bridgeLastToken = '';
let bridgePort: number | null = null;

function emit() {
  for (const fn of listeners) {
    try { fn(); } catch (_e) {}
  }
}

function fsRead(path: string): string {
  try {
    if (typeof host.__fs_readfile !== 'function') return '';
    const out = host.__fs_readfile(path);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

function fsWrite(path: string, content: string): boolean {
  try {
    if (typeof host.__fs_writefile !== 'function') return false;
    return host.__fs_writefile(path, content) === 0;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function bridgeScript(port: number, paths: ReturnType<typeof bridgePaths>): string {
  const req = JSON.stringify(paths.request);
  const res = JSON.stringify(paths.response);
  const log = JSON.stringify(paths.log);
  return `import http.server, json, os, sys, threading, time
from pathlib import Path

PORT = int(sys.argv[1])
REQ = Path(${req})
RES = Path(${res})
LOG = Path(${log})
LOCK = threading.Lock()

def write_json(path: Path, payload):
    tmp = path.with_suffix(path.suffix + '.tmp')
    path.parent.mkdir(parents=True, exist_ok=True)
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(payload, f)
    os.replace(tmp, path)

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_args):
        return

    def _reply(self, code: int, body: str, content_type: str = 'application/json; charset=utf-8'):
        data = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if data:
            self.wfile.write(data)

    def do_GET(self):
        if self.path in ('/', '/health', '/mcp/health'):
            self._reply(200, json.dumps({'ok': True, 'port': PORT, 'transport': 'bridge'}))
            return
        self._reply(404, json.dumps({'error': 'not found'}))

    def do_POST(self):
        if self.path not in ('/mcp', '/'):
            self._reply(404, json.dumps({'error': 'not found'}))
            return
        length = int(self.headers.get('Content-Length', '0') or '0')
        body = self.rfile.read(length).decode('utf-8', 'replace')
        token = str(time.time_ns())
        payload = {
            'token': token,
            'path': self.path,
            'body': body,
            'client': list(self.client_address),
            'headers': {k: v for k, v in self.headers.items()},
            'receivedAt': int(time.time() * 1000),
        }
        with LOCK:
            write_json(REQ, payload)
            start = time.time()
            while time.time() - start < 15:
                if RES.exists():
                    try:
                        with RES.open('r', encoding='utf-8') as f:
                            reply = json.load(f)
                    except Exception:
                        reply = None
                    if isinstance(reply, dict) and reply.get('token') == token:
                        try:
                            RES.unlink()
                        except Exception:
                            pass
                        status = int(reply.get('status', 200) or 200)
                        self._reply(status, str(reply.get('body', '') or ''))
                        return
                time.sleep(0.05)
        self._reply(504, json.dumps({'jsonrpc': '2.0', 'error': {'code': -32000, 'message': 'bridge timeout'}}))
        try:
            REQ.unlink()
        except Exception:
            pass

def main():
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as server:
        server.serve_forever()

if __name__ == '__main__':
    main()
`;
}

function upsertClient(client: McpClientRecord): void {
  const next = state.clients.slice();
  const existing = next.findIndex((item) => item.id === client.id);
  if (existing >= 0) next[existing] = { ...next[existing], ...client };
  else next.unshift(client);
  state = { ...state, clients: next.slice(0, 64) };
}

function decodeBridgeRequest(raw: string): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function handleRpcRequest(rpc: any): Promise<{ status: number; body: string }> {
  const id = rpc?.id;
  const method = String(rpc?.method || '');

  if (!method) {
    return { status: id == null ? 204 : 200, body: id == null ? '' : JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32600, message: 'invalid request' } }) };
  }

  if (method === 'notifications/initialized' && id == null) {
    return { status: 204, body: '' };
  }

  try {
    if (method === 'initialize') {
      const result = {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'sweatshop-mcp', version: '0.1.0' },
        capabilities: { tools: { listChanged: true, call: true } },
      };
      return { status: 200, body: JSON.stringify({ jsonrpc: '2.0', id, result }) };
    }

    if (method === 'tools/list') {
      const tools = listTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      return { status: 200, body: JSON.stringify({ jsonrpc: '2.0', id, result: { tools } }) };
    }

    if (method === 'tools/call') {
      const params = rpc?.params || {};
      const name = String(params.name || '');
      let args: any = params.arguments ?? {};
      if (typeof args === 'string') {
        try { args = args ? JSON.parse(args) : {}; } catch { args = {}; }
      }
      const result = await callTool(name, args);
      return { status: 200, body: JSON.stringify({ jsonrpc: '2.0', id, result }) };
    }

    if (method === 'tools/register') {
      return { status: 200, body: JSON.stringify({ jsonrpc: '2.0', id, result: { ok: true } }) };
    }

    return { status: 200, body: JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } }) };
  } catch (error: any) {
    const message = error?.message || String(error);
    return { status: 200, body: JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } }) };
  }
}

async function handleBridgeFile(path: string): Promise<void> {
  if (!path) return;
  const raw = fsRead(path);
  if (!raw) return;
  const packet = decodeBridgeRequest(raw);
  if (!packet || typeof packet.token !== 'string') return;
  if (packet.token === bridgeLastToken) return;

  bridgeLastToken = packet.token;
  const responsePath = bridgePaths(state.port || bridgePort || 0).response;

  try {
    const clientLabel = packet.headers?.['user-agent']
      ? String(packet.headers['user-agent'])
      : `client ${packet.client?.[0] || '127.0.0.1'}`;
    const clientId = `${clientLabel}#${packet.client?.[0] || '127.0.0.1'}`;
    upsertClient({
      id: clientId,
      label: clientLabel,
      connectedAt: state.clients.find((item) => item.id === clientId)?.connectedAt || packet.receivedAt || Date.now(),
      lastSeenAt: packet.receivedAt || Date.now(),
      transport: 'http',
      active: true,
    });

    const rpc = decodeBridgeRequest(packet.body);
    const response = await handleRpcRequest(rpc);
    fsWrite(responsePath, JSON.stringify({
      token: packet.token,
      status: response.status,
      body: response.body || '',
    }));
  } catch (error: any) {
    fsWrite(responsePath, JSON.stringify({
      token: packet.token,
      status: 500,
      body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: error?.message || String(error) } }),
    }));
    state = { ...state, lastError: error?.message || String(error) };
  } finally {
    fsWrite(path, '');
    emit();
  }
}

async function pumpBridge(): Promise<void> {
  if (bridgeBusy || !state.running || state.transport !== 'bridge') return;
  const paths = bridgePaths(state.port || bridgePort || 0);
  const raw = fsRead(paths.request);
  if (!raw) return;
  bridgeBusy = true;
  try {
    await handleBridgeFile(paths.request);
  } finally {
    bridgeBusy = false;
  }
}

function ensureBridgeLoop(): void {
  if (bridgeLoop) return;
  bridgeLoop = setInterval(() => {
    void pumpBridge();
  }, 120);
}

function stopBridgeLoop(): void {
  if (!bridgeLoop) return;
  clearInterval(bridgeLoop);
  bridgeLoop = null;
}

function launchBridge(port: number): void {
  const paths = bridgePaths(port);
  bridgePort = port;
  const script = bridgeScript(port, paths);
  if (!fsWrite(paths.script, script)) {
    bridgePort = null;
    bridgeLastToken = '';
    state = {
      ...state,
      running: false,
      transport: 'disabled',
      lastError: `Failed to write MCP bridge script at ${paths.script}`,
    };
    emit();
    return;
  }
  const cmd = `nohup python3 -u ${shellQuote(paths.script)} ${port} ${shellQuote(paths.request)} ${shellQuote(paths.response)} ${shellQuote(paths.pid)} > ${shellQuote(paths.log)} 2>&1 & echo $! > ${shellQuote(paths.pid)}`;
  void execAsync(cmd).catch(() => {});
}

function killBridge(port: number | null): void {
  if (!port) return;
  const paths = bridgePaths(port);
  const pid = Number((fsRead(paths.pid) || '').trim() || '0');
  if (pid > 0) {
    void execAsync(`kill ${pid} >/dev/null 2>&1 || true`).catch(() => {});
  }
}

export function subscribeServer(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getServerState(): McpServerState {
  return state;
}

export function probeServerCapabilities() {
  return probeTransportCapabilities();
}

export function startServer(port: number): McpServerState {
  if (state.running && state.port === port) return state;
  if (state.running) stopServer();

  const banner = capabilityBanner();
  if (!bridgeSupported() && banner) {
    state = {
      ...state,
      running: false,
      transport: 'disabled',
      port,
      url: null,
      startedAt: null,
      lastError: banner,
      capabilityBanner: banner,
      clients: [],
    };
    emit();
    return state;
  }

  state = {
    running: true,
    transport: bridgeSupported() ? 'bridge' : 'http',
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    startedAt: Date.now(),
    lastError: null,
    capabilityBanner: banner,
    clients: [],
  };
  bridgeLastToken = '';
  ensureBridgeLoop();
  if (bridgeSupported()) launchBridge(port);
  emit();
  return state;
}

export function stopServer(): McpServerState {
  killBridge(state.port);
  stopBridgeLoop();
  bridgeLastToken = '';
  bridgePort = null;
  state = {
    ...state,
    running: false,
    transport: state.capabilityBanner ? 'disabled' : 'stdio',
    url: null,
    startedAt: null,
    clients: state.clients.map((client) => ({ ...client, active: false })),
  };
  emit();
  return state;
}

export function disconnectClient(id: string): McpServerState {
  state = {
    ...state,
    clients: state.clients.filter((client) => client.id !== id),
  };
  emit();
  return state;
}

export async function handleToolCall(name: string, args: any): Promise<any> {
  return callTool(name, args);
}

export function serverSnapshot() {
  return {
    state,
    tools: listTools(),
    calls: getCallLog(),
    capabilities: probeTransportCapabilities(),
  };
}
