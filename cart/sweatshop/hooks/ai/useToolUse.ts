
import type { ToolDefinition } from '../../lib/ai/types';
import { registerTool, listTools, subscribeTools } from '../../lib/ai/tools';

// Mount a tool into the registry while a component is alive; unregister
// on unmount. Useful for panels that expose their domain-specific tools
// (file index, plan ops, git ops) to the AI without a global bootstrap.
//
//   useToolUse({
//     name: 'findFiles',
//     description: 'Search the workspace',
//     parameters: { type: 'object', properties: { q: { type: 'string' }}, required: ['q'] },
//     execute: async ({ q }) => await findInWorkspace(q),
//   });

export function useToolUse(tool: ToolDefinition): void {
  useEffect(() => {
    const off = registerTool(tool);
    return off;
  }, [tool.name, tool.description]);
}

// Reactive view of the full registry — for the playground tools panel.
export function useRegisteredTools(): ToolDefinition[] {
  const [tools, setTools] = useState<ToolDefinition[]>(() => listTools());
  useEffect(() => {
    const off = subscribeTools(() => setTools(listTools()));
    return off;
  }, []);
  return tools;
}
