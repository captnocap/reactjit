import { useAPI, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface PolyPizzaConfig { apiKey?: string; }

export function usePolyPizza(config?: PolyPizzaConfig) {
  const keys = useServiceKey('polypizza');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const headers = apiKey ? bearer(apiKey) : {};
  const base = 'https://poly.pizza/api/v1.1';

  const search = (q: string) =>
    useAPI<any[]>(apiKey && q ? `${base}/search?q=${encodeURIComponent(q)}` : null, { headers });
  const model = (id: string) =>
    useAPI<any>(apiKey && id ? `${base}/model/${id}` : null, { headers });
  const category = (cat: string) =>
    useAPI<any[]>(apiKey && cat ? `${base}/category/${encodeURIComponent(cat)}` : null, { headers });

  return { search, model, category };
}
