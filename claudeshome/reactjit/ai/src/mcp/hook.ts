/**
 * useMCPServer — React hook for connecting to MCP servers.
 *
 * Connects to an MCP server, discovers tools, filters by permissions config,
 * and returns ToolDefinition[] ready to pass into useChat().
 *
 * @example
 * import mcpConfig from '../mcp.tools.json';
 *
 * const mcp = useMCPServer({
 *   name: 'filesystem',
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
 *   permissions: mcpConfig.filesystem,
 * });
 *
 * const chat = useChat({ tools: [...localTools, ...mcp.tools] });
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ToolDefinition } from '../types';
import type { MCPServerConfig, MCPServerResult, MCPTool } from './protocol';
import { MCPClient } from './client';

/**
 * Connect to an MCP server and expose its tools as ToolDefinitions.
 *
 * Tools are filtered by the permissions config — only tools with
 * `enabled: true` are included. Tools with `confirm: true` will
 * call `onConfirm` before executing.
 */
export function useMCPServer(config: MCPServerConfig): MCPServerResult {
  const [status, setStatus] = useState<MCPServerResult['status']>('connecting');
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [discoveredTools, setDiscoveredTools] = useState<MCPTool[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<MCPClient | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Connect and discover on mount
  useEffect(() => {
    let cancelled = false;
    const client = new MCPClient(config);
    clientRef.current = client;

    (async () => {
      try {
        setStatus('connecting');
        setError(null);

        await client.connect();
        if (cancelled) { client.close(); return; }

        const tools = await client.listTools();
        if (cancelled) { client.close(); return; }

        setAvailableTools(tools.map(t => t.name));
        setDiscoveredTools(tools);
        setStatus('ready');
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      client.close();
      clientRef.current = null;
    };
  // Re-connect only when connection params change, not permissions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.name, config.transport, config.command, config.url]);

  // Disconnect callback
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }
    setStatus('connecting'); // will re-connect on next render cycle if effect re-runs
  }, []);

  // Build ToolDefinition[] from discovered tools + permissions
  const tools = useMemo((): ToolDefinition[] => {
    if (status !== 'ready') return [];

    const perms = configRef.current.permissions;
    if (!perms) return []; // No permissions config = no tools exposed

    return discoveredTools
      .filter(t => {
        const perm = perms.tools[t.name];
        return perm && perm.enabled;
      })
      .map(t => {
        const perm = perms.tools[t.name];
        const client = clientRef.current;

        const execute = async (args: any): Promise<any> => {
          // Confirm gate
          if (perm.confirm && configRef.current.onConfirm) {
            const allowed = await configRef.current.onConfirm(t.name, args);
            if (!allowed) return { error: 'Tool call denied by user' };
          }

          if (!client || client.status !== 'ready') {
            throw new Error(`MCP server '${configRef.current.name}' is not connected`);
          }

          const result = await client.callTool(t.name, args);

          // Flatten MCP content array to a single string or structured result
          if (result.isError) {
            const text = result.content
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n');
            return { error: text || 'Tool call failed' };
          }

          const texts = result.content.filter(c => c.type === 'text').map(c => c.text);
          if (texts.length === 1) return texts[0];
          if (texts.length > 1) return texts.join('\n');

          // Return raw content for non-text types
          return result.content;
        };

        return {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
          execute,
        } satisfies ToolDefinition;
      });
  }, [status, discoveredTools]);

  return { status, tools, availableTools, error, disconnect };
}
