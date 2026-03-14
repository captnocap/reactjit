import { getProvider } from '@reactjit/ai';
import type { Provider } from './types';

/**
 * Build OpenAI-compatible proxy routes for useServer.
 * This is a pure function — no React, no hooks, no memos.
 */
export function buildProxyRoutes(provider: Provider, model: string, temperature: number, maxTokens: number) {
  const baseURL = provider.baseURL || 'https://api.openai.com';
  const authHeaders = provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {};
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  return [
    {
      path: '/v1/models',
      method: 'GET' as const,
      handler: async () => {
        try {
          const res = await fetch(`${baseURL}/v1/models`, { headers: authHeaders } as any);
          return { status: res.ok ? 200 : (res.status as number), headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: await res.text() };
        } catch (err: any) {
          return { status: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: { message: `Upstream error: ${err.message}`, type: 'proxy_error' } }) };
        }
      },
    },
    {
      path: '/v1/chat/completions',
      method: 'POST' as const,
      handler: async (req: any) => {
        try {
          const p = getProvider(provider.type);
          const body = JSON.parse(req.body || '{}');
          const formatted = p.formatRequest(
            body.messages || [],
            { provider: provider.type, model: body.model || model, apiKey: provider.apiKey, baseURL: provider.baseURL, temperature: body.temperature ?? temperature, maxTokens: body.max_tokens ?? maxTokens },
            undefined,
            body.stream || false,
          );
          const res = await fetch(formatted.url, { method: formatted.method, headers: formatted.headers, body: formatted.body } as any);
          return { status: res.ok ? 200 : (res.status as number), headers: { 'Content-Type': body.stream ? 'text/event-stream' : 'application/json', ...corsHeaders }, body: await res.text() };
        } catch (err: any) {
          return { status: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: { message: `Proxy error: ${err.message}`, type: 'proxy_error' } }) };
        }
      },
    },
    {
      path: '/v1/completions',
      method: 'POST' as const,
      handler: async (req: any) => {
        try {
          const res = await fetch(`${baseURL}/v1/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: req.body,
          } as any);
          return { status: res.ok ? 200 : (res.status as number), headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: await res.text() };
        } catch (err: any) {
          return { status: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }) };
        }
      },
    },
    {
      path: '/v1/*',
      method: 'OPTIONS' as const,
      handler: async () => ({
        status: 204,
        headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
        body: '',
      }),
    },
  ];
}
