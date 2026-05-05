import { disconnectClient, getServerState, probeServerCapabilities, startServer, stopServer, subscribeServer, serverSnapshot } from '../lib/mcp-server';

export function useMcpServer() {
  const [state, setState] = useState(() => getServerState());
  const [capabilities, setCapabilities] = useState(() => probeServerCapabilities());
  const [snapshot, setSnapshot] = useState(() => serverSnapshot());

  useEffect(() => {
    const refresh = () => {
      setState(getServerState());
      setCapabilities(probeServerCapabilities());
      setSnapshot(serverSnapshot());
    };
    refresh();
    const off = subscribeServer(refresh);
    return off;
  }, []);

  return {
    state,
    capabilities,
    snapshot,
    startServer,
    stopServer,
    disconnectClient,
  };
}
