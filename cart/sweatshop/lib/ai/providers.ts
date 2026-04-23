import type {
  AIConfig, Message, ToolDefinition, StreamDelta,
  ProviderRequest, ProviderModule, AIProviderType,
} from './types';
import { requestAsync } from '../../../../runtime/hooks/http';

// Unified provider adapters. OpenAI (chat/completions) + Anthropic
// (messages). Each exposes formatRequest / parseResponse /
// parseStreamChunk / formatToolResult so callers stay provider-agnostic.

// ── OpenAI ─────────────────────────────────────────────

const OPENAI_DEFAULT_BASE = 'https://api.openai.com';

function openaiMsg(m: Message): any {
  const out: any = { role: m.role, content: m.content };
  if (m.toolCalls && m.toolCalls.length) {
    out.tool_calls = m.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }));
  }
  if (m.toolCallId) out.tool_call_id = m.toolCallId;
  if (m.name) out.name = m.name;
  return out;
}

export const openai: ProviderModule = {
  formatRequest(messages, config, tools, stream): ProviderRequest {
    const baseURL = (config.baseURL || OPENAI_DEFAULT_BASE).replace(/\/$/, '');
    const body: any = { model: config.model, messages: messages.map(openaiMsg), stream: stream ?? true };
    if (config.temperature != null) body.temperature = config.temperature;
    if (config.maxTokens != null) body.max_tokens = config.maxTokens;
    if (tools && tools.length) body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    return {
      url: baseURL + '/v1/chat/completions', method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + (config.apiKey || '') },
      body: JSON.stringify(body),
    };
  },
  parseResponse(json): Message {
    const choice = json?.choices?.[0];
    if (!choice) return { role: 'assistant', content: json?.error?.message || '' };
    const msg = choice.message || {};
    const out: Message = { role: 'assistant', content: msg.content || '' };
    if (msg.tool_calls && msg.tool_calls.length) {
      out.toolCalls = msg.tool_calls.map((tc: any) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
    }
    return out;
  },
  parseStreamChunk(line): StreamDelta | null {
    if (line === '[DONE]') return { done: true };
    let j: any;
    try { j = JSON.parse(line); } catch { return null; }
    const choice = j?.choices?.[0];
    const delta = choice?.delta;
    if (!delta) return null;
    const result: StreamDelta = {};
    if (delta.content) result.content = delta.content;
    if (delta.tool_calls) {
      result.toolCalls = delta.tool_calls.map((tc: any) => ({ id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments }));
    }
    if (choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls') result.done = true;
    return result;
  },
  formatToolResult(callId, result): Message {
    return { role: 'tool', toolCallId: callId, content: typeof result === 'string' ? result : JSON.stringify(result) };
  },
};

// ── Anthropic ──────────────────────────────────────────

const ANTHROPIC_DEFAULT_BASE = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

function anthropicMsg(m: Message): any {
  // tool result — Anthropic wants a user message with a tool_result block
  if (m.role === 'tool') {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] };
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length) {
    const blocks: any[] = [];
    if (m.content) blocks.push({ type: 'text', text: typeof m.content === 'string' ? m.content : '' });
    for (const tc of m.toolCalls) {
      let input: any = {};
      try { input = tc.arguments ? JSON.parse(tc.arguments) : {}; } catch {}
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
    }
    return { role: 'assistant', content: blocks };
  }
  return { role: m.role === 'system' ? 'user' : m.role, content: m.content };
}

export const anthropic: ProviderModule = {
  formatRequest(messages, config, tools, stream): ProviderRequest {
    const baseURL = (config.baseURL || ANTHROPIC_DEFAULT_BASE).replace(/\/$/, '');
    const systemMsg = messages.find((m) => m.role === 'system');
    const rest = messages.filter((m) => m.role !== 'system').map(anthropicMsg);
    const body: any = {
      model: config.model,
      messages: rest,
      max_tokens: config.maxTokens ?? 4096,
      stream: stream ?? true,
    };
    if (systemMsg) body.system = typeof systemMsg.content === 'string' ? systemMsg.content : '';
    if (config.temperature != null) body.temperature = config.temperature;
    if (tools && tools.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    return {
      url: baseURL + '/v1/messages', method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(body),
    };
  },
  parseResponse(json): Message {
    if (json?.error) return { role: 'assistant', content: json.error.message || '' };
    const blocks: any[] = json?.content || [];
    let text = '';
    const toolCalls: any[] = [];
    for (const b of blocks) {
      if (b.type === 'text') text += b.text || '';
      else if (b.type === 'tool_use') {
        toolCalls.push({ id: b.id, name: b.name, arguments: JSON.stringify(b.input || {}) });
      }
    }
    const out: Message = { role: 'assistant', content: text };
    if (toolCalls.length) out.toolCalls = toolCalls;
    return out;
  },
  parseStreamChunk(line, eventType): StreamDelta | null {
    let j: any;
    try { j = JSON.parse(line); } catch { return null; }
    const et = eventType || j?.type;
    if (et === 'content_block_delta') {
      const d = j.delta || {};
      if (d.type === 'text_delta') return { content: d.text };
      if (d.type === 'input_json_delta') {
        return { toolCalls: [{ arguments: d.partial_json || '' }] };
      }
    }
    if (et === 'content_block_start') {
      const b = j.content_block || {};
      if (b.type === 'tool_use') {
        return { toolCalls: [{ id: b.id, name: b.name, arguments: '' }] };
      }
    }
    if (et === 'message_stop') return { done: true };
    return null;
  },
  formatToolResult(callId, result): Message {
    return { role: 'tool', toolCallId: callId, content: typeof result === 'string' ? result : JSON.stringify(result) };
  },
};

// ── Unified lookup ─────────────────────────────────────

export function getProvider(type: AIProviderType): ProviderModule {
  if (type === 'anthropic') return anthropic;
  return openai; // 'openai' and 'custom' both use OpenAI-compatible shape
}

// HTTP goes through the __http_request_async host fn (libcurl), not a Node
// fetch. `callProvider` is non-streaming — the host does not yet expose a
// streaming variant (see stream.ts for the blocker).
export async function callProvider(config: AIConfig, messages: Message[], tools?: ToolDefinition[]): Promise<Message> {
  const provider = getProvider(config.provider);
  const req = provider.formatRequest(messages, config, tools, false);
  const res = await requestAsync({ method: req.method as any, url: req.url, headers: req.headers, body: req.body });
  if (res.error) return { role: 'assistant', content: 'http error: ' + res.error };
  let json: any = {};
  try { json = JSON.parse(res.body || '{}'); } catch { json = { error: { message: res.body } }; }
  return provider.parseResponse(json);
}
