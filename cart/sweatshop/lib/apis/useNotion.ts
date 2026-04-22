import { useAPI, useAPIMutation, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface NotionConfig { token?: string; }

export function useNotion(config?: NotionConfig) {
  const keys = useServiceKey('notion');
  const token = config?.token ?? keys.token;
  const headers = token ? { ...bearer(token), 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' } : {};
  const base = 'https://api.notion.com/v1';

  const databases = () => useAPI<any>(token ? `${base}/databases` : null, { headers });
  const database = (id: string) =>
    useAPI<any>(token && id ? `${base}/databases/${id}` : null, { headers });
  const queryDatabase = (id: string) =>
    useAPIMutation<any>(`${base}/databases/${id}/query`, { method: 'POST', headers });
  const pages = () => useAPI<any>(token ? `${base}/pages` : null, { headers });

  return { databases, database, queryDatabase, pages };
}
