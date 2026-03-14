/**
 * Last.fm API hooks.
 * Auth: API key as query param. Get one at https://www.last.fm/api/account/create
 */

import { useAPI, qs, type APIResult } from './base';

const BASE = 'https://ws.audioscrobbler.com/2.0/';

// ── Types ───────────────────────────────────────────────

export interface LastFMImage {
  '#text': string;
  size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
}

export interface LastFMArtist {
  name: string;
  mbid?: string;
  url: string;
  image?: LastFMImage[];
  playcount?: string;
}

export interface LastFMTrack {
  name: string;
  artist: LastFMArtist | { '#text': string };
  album?: { '#text': string };
  image?: LastFMImage[];
  url: string;
  date?: { uts: string; '#text': string };
  '@attr'?: { nowplaying: string };
  playcount?: string;
}

export interface LastFMAlbum {
  name: string;
  artist: LastFMArtist | { name: string };
  image?: LastFMImage[];
  playcount?: string;
  url: string;
}

export interface LastFMUser {
  name: string;
  realname: string;
  image: LastFMImage[];
  playcount: string;
  registered: { unixtime: string };
  url: string;
  country: string;
}

// ── Hooks ───────────────────────────────────────────────

function lfm(apiKey: string, method: string, params?: Record<string, any>): string {
  return `${BASE}${qs({ method, api_key: apiKey, format: 'json', ...params })}`;
}

export function useLastFMRecentTracks(
  apiKey: string | null,
  user: string | null,
  opts?: { limit?: number; interval?: number },
): APIResult<{ recenttracks: { track: LastFMTrack[] } }> {
  return useAPI(
    apiKey && user ? lfm(apiKey, 'user.getrecenttracks', { user, limit: opts?.limit ?? 20 }) : null,
    { interval: opts?.interval },
  );
}

export function useLastFMNowPlaying(
  apiKey: string | null,
  user: string | null,
  opts?: { interval?: number },
): APIResult<{ recenttracks: { track: LastFMTrack[] } }> {
  return useAPI(
    apiKey && user ? lfm(apiKey, 'user.getrecenttracks', { user, limit: 1 }) : null,
    { interval: opts?.interval ?? 10000 },
  );
}

export function useLastFMTopArtists(
  apiKey: string | null,
  user: string | null,
  opts?: { period?: 'overall' | '7day' | '1month' | '3month' | '6month' | '12month'; limit?: number },
): APIResult<{ topartists: { artist: LastFMArtist[] } }> {
  return useAPI(
    apiKey && user ? lfm(apiKey, 'user.gettopartists', { user, period: opts?.period, limit: opts?.limit ?? 10 }) : null,
  );
}

export function useLastFMTopTracks(
  apiKey: string | null,
  user: string | null,
  opts?: { period?: 'overall' | '7day' | '1month' | '3month' | '6month' | '12month'; limit?: number },
): APIResult<{ toptracks: { track: LastFMTrack[] } }> {
  return useAPI(
    apiKey && user ? lfm(apiKey, 'user.gettoptracks', { user, period: opts?.period, limit: opts?.limit ?? 10 }) : null,
  );
}

export function useLastFMTopAlbums(
  apiKey: string | null,
  user: string | null,
  opts?: { period?: 'overall' | '7day' | '1month' | '3month' | '6month' | '12month'; limit?: number },
): APIResult<{ topalbums: { album: LastFMAlbum[] } }> {
  return useAPI(
    apiKey && user ? lfm(apiKey, 'user.gettopalbums', { user, period: opts?.period, limit: opts?.limit ?? 10 }) : null,
  );
}

export function useLastFMUser(
  apiKey: string | null,
  user: string | null,
): APIResult<{ user: LastFMUser }> {
  return useAPI(
    apiKey && user ? lfm(apiKey, 'user.getinfo', { user }) : null,
  );
}

/** Extract the best image URL from a Last.fm image array */
export function lastfmImage(images: LastFMImage[] | undefined, preferSize: string = 'extralarge'): string | null {
  if (!images?.length) return null;
  const preferred = images.find(i => i.size === preferSize);
  return (preferred || images[images.length - 1])?.['#text'] || null;
}
