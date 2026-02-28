/**
 * Token estimation for MCP tool definitions.
 *
 * When tools are passed to an LLM, their definitions (name, description, schema)
 * are serialized into the system prompt and consume context window space.
 * This module estimates that cost so developers can see upfront how much
 * working memory each tool will use.
 *
 * Algorithm: JSON-serialize the tool definition, count characters, divide by 4
 * (average chars-per-token for structured JSON), add per-tool framing overhead.
 */

import type { MCPTool } from './protocol';

const CHARS_PER_TOKEN = 4;
const PER_TOOL_OVERHEAD = 20; // framing tokens (function call envelope, separators)

/**
 * Estimate token count for a single tool definition.
 */
export function estimateToolTokens(tool: MCPTool): number {
  const json = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  });
  return Math.ceil(json.length / CHARS_PER_TOKEN) + PER_TOOL_OVERHEAD;
}

/**
 * Estimate total token budget for a list of tools.
 * Returns total count and a human-readable note showing context window percentage.
 */
export function estimateToolBudget(tools: MCPTool[]): { total: number; note: string } {
  const total = tools.reduce((sum, t) => sum + estimateToolTokens(t), 0);
  const pct128k = ((total / 128000) * 100).toFixed(1);
  return {
    total,
    note: `~${pct128k}% of 128K context`,
  };
}
