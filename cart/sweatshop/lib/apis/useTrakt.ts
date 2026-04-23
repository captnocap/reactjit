import { useAPI, useAPIMutation, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface TraktConfig { clientId?: string; token?: string; }

export function useTrakt(config?: TraktConfig) {
  const keys = useServiceKey('trakt');
  const clientId = config?.clientId ?? keys.clientId;
  const token = config?.token ?? keys.token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': clientId || '' };
  if (token) Object.assign(headers, bearer(token));

  const trendingMovies = () => useAPI<any[]>(clientId ? 'https://api.trakt.tv/movies/trending' : null, { headers });
  const trendingShows = () => useAPI<any[]>(clientId ? 'https://api.trakt.tv/shows/trending' : null, { headers });
  const history = () => useAPI<any[]>(token ? 'https://api.trakt.tv/sync/history' : null, { headers });
  const scrobble = (type: 'movie'|'episode') =>
    useAPIMutation<any>('https://api.trakt.tv/scrobble/start', { method: 'POST', headers });

  return { trendingMovies, trendingShows, history, scrobble };
}
