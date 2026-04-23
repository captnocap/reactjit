
import { MCPClient, websocketTransport, type MCPServerInfo, type MCPToolSchema } from '../../lib/ai/mcp';

// Connect to an MCP server by URL. Auto-initializes + lists tools.
// Caller can `callTool(name, args)` once connected.

export function useMCPServer(url: string | null) {
  const [info, setInfo] = useState<MCPServerInfo | null>(null);
  const [tools, setTools] = useState<MCPToolSchema[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<MCPClient | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setError(null);
    setConnected(false);
    let client: MCPClient;
    try {
      client = new MCPClient(websocketTransport(url));
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    clientRef.current = client;

    (async () => {
      try {
        const serverInfo = await client.initialize();
        if (cancelled) return;
        setInfo(serverInfo);
        const list = await client.listTools();
        if (cancelled) return;
        setTools(list);
        setConnected(true);
      } catch (e: any) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();

    return () => {
      cancelled = true;
      try { client.close(); } catch (_e) {}
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [url]);

  return {
    info,
    tools,
    connected,
    error,
    callTool: (name: string, args: any) => {
      const c = clientRef.current;
      if (!c) return Promise.reject(new Error('MCP client not connected'));
      return c.callTool(name, args);
    },
  };
}
