import { useAPI, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface TMDBConfig { apiKey?: string; }

export function useTMDB(config?: TMDBConfig) {
  const keys = useServiceKey('tmdb');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = 'https://api.themoviedb.org/3';

  const movie = (id: number) => useAPI<any>(apiKey && id ? `${base}/movie/${id}?api_key=${apiKey}` : null);
  const searchMovies = (q: string, page?: number) =>
    useAPI<any>(apiKey && q ? `${base}/search/movie?api_key=${apiKey}&${qs({ query: q, page: page ?? 1 })}` : null);
  const trending = (type: 'day'|'week' = 'week', media: 'movie'|'tv'|'all' = 'movie') =>
    useAPI<any>(apiKey ? `${base}/trending/${media}/${type}?api_key=${apiKey}` : null);
  const tv = (id: number) => useAPI<any>(apiKey && id ? `${base}/tv/${id}?api_key=${apiKey}` : null);

  return { movie, searchMovies, trending, tv };
}
