import { useAPI, useAPIMutation } from './base';
import { useServiceKey } from './useServiceKey';

export interface AnthropicConfig { apiKey?: string; baseURL?: string; }

export function useAnthropic(config?: AnthropicConfig) {
  const keys = useServiceKey('anthropic');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = config?.baseURL ?? keys.baseURL ?? 'https://api.anthropic.com';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (apiKey) headers['x-api-key'] = apiKey;

  const models = () => useAPI<any>(apiKey ? `${base}/v1/models` : null, { headers });
  const messages = () =>
    useAPIMutation<any>(`${base}/v1/messages`, { method: 'POST', headers });

  return { models, messages };
}
