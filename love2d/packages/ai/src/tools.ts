/**
 * Tool execution engine for the agentic loop.
 *
 * Handles: executing tool calls, formatting results,
 * and deciding whether to continue the loop.
 */

import type { ToolDefinition, ToolCall, Message, ProviderModule } from './types';

export interface ToolExecutionResult {
  callId: string;
  name: string;
  result: any;
  error?: string;
}

/**
 * Execute an array of tool calls against their definitions.
 * Runs all calls concurrently.
 */
export async function executeToolCalls(
  calls: ToolCall[],
  toolDefs: ToolDefinition[],
): Promise<ToolExecutionResult[]> {
  const results = await Promise.all(
    calls.map(async (call) => {
      const def = toolDefs.find(t => t.name === call.name);
      if (!def) {
        return {
          callId: call.id,
          name: call.name,
          result: null,
          error: `Unknown tool: ${call.name}`,
        };
      }

      try {
        let args: any;
        try { args = JSON.parse(call.arguments); }
        catch { args = {}; }

        const result = await def.execute(args);
        return { callId: call.id, name: call.name, result };
      } catch (err: any) {
        return {
          callId: call.id,
          name: call.name,
          result: null,
          error: err.message || String(err),
        };
      }
    })
  );

  return results;
}

/**
 * Format tool execution results as messages for the next LLM round.
 */
export function formatToolResults(
  provider: ProviderModule,
  results: ToolExecutionResult[],
): Message[] {
  return results.map(r => {
    const content = r.error
      ? `Error: ${r.error}`
      : r.result;
    return provider.formatToolResult(r.callId, content);
  });
}

/**
 * Check if the model response requires another round of tool execution.
 */
export function shouldContinueLoop(
  assistantMessage: Message,
  round: number,
  maxRounds: number,
): boolean {
  if (round >= maxRounds) return false;
  if (!assistantMessage.toolCalls || assistantMessage.toolCalls.length === 0) return false;
  return true;
}
