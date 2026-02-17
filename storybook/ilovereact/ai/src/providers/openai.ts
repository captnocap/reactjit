/**
 * OpenAI-compatible provider.
 *
 * Works with: OpenAI, Ollama, LM Studio, Groq, Together AI, vLLM,
 * and any other API that implements the OpenAI chat completions format.
 */

import type {
  AIConfig, Message, ToolDefinition, ToolCall,
  StreamDelta, ProviderRequest, ProviderModule,
} from '../types';

const DEFAULT_BASE_URL = 'https://api.openai.com';

function messageToOpenAI(msg: Message): any {
  const out: any = { role: msg.role, content: msg.content };

  if (msg.toolCalls && msg.toolCalls.length > 0) {
    out.tool_calls = msg.toolCalls.map(tc => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }

  if (msg.toolCallId) {
    out.tool_call_id = msg.toolCallId;
  }

  if (msg.name) {
    out.name = msg.name;
  }

  return out;
}

function toolToOpenAI(tool: ToolDefinition): any {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export const openai: ProviderModule = {
  formatRequest(
    messages: Message[],
    config: AIConfig,
    tools?: ToolDefinition[],
    stream?: boolean,
  ): ProviderRequest {
    const baseURL = (config.baseURL || DEFAULT_BASE_URL).replace(/\/$/, '');
    const url = `${baseURL}/v1/chat/completions`;

    const body: any = {
      model: config.model,
      messages: messages.map(messageToOpenAI),
      stream: stream ?? true,
    };

    if (config.temperature != null) body.temperature = config.temperature;
    if (config.maxTokens != null) body.max_tokens = config.maxTokens;

    if (tools && tools.length > 0) {
      body.tools = tools.map(toolToOpenAI);
    }

    // For streaming, request SSE with incremental tool call deltas
    if (stream) {
      body.stream_options = { include_usage: false };
    }

    return {
      url,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${config.apiKey || ''}`,
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(json: any): Message {
    const choice = json.choices?.[0];
    if (!choice) {
      return { role: 'assistant', content: json.error?.message || '' };
    }

    const msg = choice.message;
    const result: Message = {
      role: 'assistant',
      content: msg.content || '',
    };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      result.toolCalls = msg.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }

    return result;
  },

  parseStreamChunk(line: string): StreamDelta | null {
    if (line === '[DONE]') {
      return { done: true };
    }

    let json: any;
    try { json = JSON.parse(line); }
    catch { return null; }

    const choice = json.choices?.[0];
    if (!choice) return null;

    const delta = choice.delta;
    if (!delta) return null;

    const result: StreamDelta = {};

    if (delta.content) {
      result.content = delta.content;
    }

    if (delta.tool_calls) {
      result.toolCalls = delta.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: tc.function?.arguments,
      }));
    }

    if (choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls') {
      result.done = true;
    }

    return result;
  },

  formatToolResult(callId: string, result: any): Message {
    return {
      role: 'tool',
      toolCallId: callId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    };
  },
};
