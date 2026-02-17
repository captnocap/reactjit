/**
 * Anthropic Messages API provider.
 *
 * Supports Claude models via the Anthropic API.
 * Uses x-api-key auth and anthropic-version header.
 */

import type {
  AIConfig, Message, ToolDefinition, ToolCall,
  StreamDelta, ProviderRequest, ProviderModule,
} from '../types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

function messageToAnthropic(msg: Message): any {
  if (msg.role === 'system') return null; // system goes in top-level field

  if (msg.role === 'tool') {
    return {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: msg.toolCallId,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }],
    };
  }

  const out: any = { role: msg.role };

  if (msg.toolCalls && msg.toolCalls.length > 0 && msg.role === 'assistant') {
    // Assistant message with tool use
    const content: any[] = [];
    if (msg.content && typeof msg.content === 'string' && msg.content.length > 0) {
      content.push({ type: 'text', text: msg.content });
    }
    for (const tc of msg.toolCalls) {
      let args: any;
      try { args = JSON.parse(tc.arguments); }
      catch { args = {}; }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: args,
      });
    }
    out.content = content;
  } else {
    out.content = typeof msg.content === 'string' ? msg.content : msg.content;
  }

  return out;
}

function toolToAnthropic(tool: ToolDefinition): any {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

// Track partial tool calls during streaming
let _streamToolCalls: Record<string, { id: string; name: string; arguments: string }> = {};

export const anthropic: ProviderModule = {
  formatRequest(
    messages: Message[],
    config: AIConfig,
    tools?: ToolDefinition[],
    stream?: boolean,
  ): ProviderRequest {
    const baseURL = (config.baseURL || DEFAULT_BASE_URL).replace(/\/$/, '');
    const url = `${baseURL}/v1/messages`;

    // Extract system message
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const systemPrompt = config.systemPrompt
      || systemMessages.map(m => typeof m.content === 'string' ? m.content : '').join('\n')
      || undefined;

    const body: any = {
      model: config.model,
      messages: nonSystemMessages.map(messageToAnthropic).filter(Boolean),
      stream: stream ?? true,
      max_tokens: config.maxTokens || 4096,
    };

    if (systemPrompt) body.system = systemPrompt;
    if (config.temperature != null) body.temperature = config.temperature;

    if (tools && tools.length > 0) {
      body.tools = tools.map(toolToAnthropic);
    }

    return {
      url,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(json: any): Message {
    if (json.error) {
      return { role: 'assistant', content: json.error.message || 'API error' };
    }

    const result: Message = { role: 'assistant', content: '' };
    const toolCalls: ToolCall[] = [];

    for (const block of json.content || []) {
      if (block.type === 'text') {
        result.content = (result.content as string) + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    if (toolCalls.length > 0) {
      result.toolCalls = toolCalls;
    }

    return result;
  },

  parseStreamChunk(line: string, eventType?: string): StreamDelta | null {
    let json: any;
    try { json = JSON.parse(line); }
    catch { return null; }

    const type = eventType || json.type;

    switch (type) {
      case 'message_start':
        // Reset streaming state
        _streamToolCalls = {};
        return null;

      case 'content_block_start': {
        const block = json.content_block;
        if (block?.type === 'tool_use') {
          _streamToolCalls[json.index] = {
            id: block.id,
            name: block.name,
            arguments: '',
          };
        }
        return null;
      }

      case 'content_block_delta': {
        const delta = json.delta;
        if (delta?.type === 'text_delta') {
          return { content: delta.text };
        }
        if (delta?.type === 'input_json_delta') {
          const tc = _streamToolCalls[json.index];
          if (tc) {
            tc.arguments += delta.partial_json;
          }
          return null;
        }
        return null;
      }

      case 'content_block_stop': {
        const tc = _streamToolCalls[json.index];
        if (tc) {
          return {
            toolCalls: [{
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            }],
          };
        }
        return null;
      }

      case 'message_delta': {
        if (json.delta?.stop_reason === 'end_turn' || json.delta?.stop_reason === 'tool_use') {
          return { done: true };
        }
        return null;
      }

      case 'message_stop':
        return { done: true };

      default:
        return null;
    }
  },

  formatToolResult(callId: string, result: any): Message {
    return {
      role: 'tool',
      toolCallId: callId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    };
  },
};
