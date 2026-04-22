import { useAPI } from './base';
import { useServiceKey } from './useServiceKey';

export interface PlexConfig { baseUrl?: string; token?: string; }

export function usePlex(config?: PlexConfig) {
  const keys = useServiceKey('plex');
  const base = config?.baseUrl ?? keys.baseUrl ?? 'http://localhost:32400';
  const token = config?.token ?? keys.token;
  const headers = token ? { 'X-Plex-Token': token, Accept: 'application/json' } : {};

  const sections = () => useAPI<any>(token ? `${base}/library/sections` : null, { headers });
  const recent = (sectionId: number) =>
    useAPI<any>(token && sectionId ? `${base}/library/sections/${sectionId}/recentlyAdded` : null, { headers });
  const onDeck = () => useAPI<any>(token ? `${base}/library/onDeck` : null, { headers });
  const search = (q: string) =>
    useAPI<any>(token && q ? `${base}/search?query=${encodeURIComponent(q)}` : null, { headers });

  return { sections, recent, onDeck, search };
}
