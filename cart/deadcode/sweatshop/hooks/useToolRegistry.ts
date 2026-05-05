import { callTool, listTools, registerTool, subscribeTools, getCallLog } from '../lib/mcp-server';

export function useToolRegistry() {
  const [tools, setTools] = useState(() => listTools());
  const [calls, setCalls] = useState(() => getCallLog());

  useEffect(() => {
    const refresh = () => {
      setTools(listTools());
      setCalls(getCallLog());
    };
    refresh();
    const off = subscribeTools(refresh);
    return off;
  }, []);

  return {
    tools,
    calls,
    registerTool,
    callTool,
  };
}
