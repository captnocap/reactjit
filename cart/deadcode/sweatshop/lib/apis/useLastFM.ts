import { useAPI, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface LastFMConfig { apiKey?: string; }

export function useLastFM(config?: LastFMConfig) {
  const keys = useServiceKey('lastfm');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = 'https://ws.audioscrobbler.com/2.0/';

  const recentTracks = (user: string, limit?: number) =>
    useAPI<any>(apiKey && user ? `${base}?${qs({ method: 'user.getrecenttracks', user, api_key: apiKey, limit: limit ?? 10, format: 'json' })}` : null);
  const topAlbums = (user: string, period?: string) =>
    useAPI<any>(apiKey && user ? `${base}?${qs({ method: 'user.gettopalbums', user, api_key: apiKey, period: period ?? '7day', format: 'json' })}` : null);
  const trackInfo = (track: string, artist: string) =>
    useAPI<any>(apiKey && track && artist ? `${base}?${qs({ method: 'track.getInfo', track, artist, api_key: apiKey, format: 'json' })}` : null);

  return { recentTracks, topAlbums, trackInfo };
}
