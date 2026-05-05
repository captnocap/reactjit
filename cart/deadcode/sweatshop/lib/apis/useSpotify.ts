import { useAPI, useAPIMutation, bearer, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface SpotifyConfig { token?: string; }

export function useSpotify(config?: SpotifyConfig) {
  const keys = useServiceKey('spotify');
  const token = config?.token ?? keys.token;
  const headers = token ? bearer(token) : {};
  const base = 'https://api.spotify.com/v1';

  const currentPlayback = () => useAPI<any>(token ? `${base}/me/player` : null, { headers });
  const search = (q: string, type: string = 'track', limit: number = 10) =>
    useAPI<any>(token && q ? `${base}/search?${qs({ q, type, limit })}` : null, { headers });
  const playlist = (id: string) =>
    useAPI<any>(token && id ? `${base}/playlists/${id}` : null, { headers });
  const play = () => useAPIMutation<any>(`${base}/me/player/play`, { method: 'PUT', headers });
  const pause = () => useAPIMutation<any>(`${base}/me/player/pause`, { method: 'PUT', headers });

  return { currentPlayback, search, playlist, play, pause };
}
