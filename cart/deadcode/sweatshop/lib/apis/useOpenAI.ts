import { useAPI, useAPIMutation, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface OpenAIConfig { apiKey?: string; baseURL?: string; }

export function useOpenAI(config?: OpenAIConfig) {
  const keys = useServiceKey('openai');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = config?.baseURL ?? keys.baseURL ?? 'https://api.openai.com';
  const headers = apiKey
    ? { ...bearer(apiKey), 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const models = () => useAPI<any>(apiKey ? `${base}/v1/models` : null, { headers });
  const chat = () =>
    useAPIMutation<any>(`${base}/v1/chat/completions`, { method: 'POST', headers });
  const embeddings = () =>
    useAPIMutation<any>(`${base}/v1/embeddings`, { method: 'POST', headers });

  return { models, chat, embeddings };
}
