/**
 * Trakt.tv API hooks.
 * Auth: Client ID header + optional OAuth Bearer token.
 * Get credentials at https://trakt.tv/oauth/applications
 */

import { useAPI, bearer, qs, type APIResult } from './base';

const BASE = 'https://api.trakt.tv';

// ── Types ───────────────────────────────────────────────

export interface TraktMovie {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb?: string; tmdb?: number };
}

export interface TraktShow {
  title: string;
  year: number;
  ids: { trakt: number; slug: string; imdb?: string; tmdb?: number; tvdb?: number };
}

export interface TraktEpisode {
  season: number;
  number: number;
  title: string;
  ids: { trakt: number; tvdb?: number; imdb?: string; tmdb?: number };
}

export interface TraktWatching {
  expires_at: string;
  started_at: string;
  action: string;
  type: 'movie' | 'episode';
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
}

export interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: 'movie' | 'episode';
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
}

export interface TraktWatchlistItem {
  listed_at: string;
  type: 'movie' | 'show';
  movie?: TraktMovie;
  show?: TraktShow;
}

export interface TraktStats {
  movies: { plays: number; watched: number; minutes: number };
  shows: { watched: number; collected: number };
  episodes: { plays: number; watched: number; minutes: number };
}

// ── Hooks ───────────────────────────────────────────────

function traktHeaders(clientId: string, token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    'Content-Type': 'application/json',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function useTraktWatching(
  clientId: string | null,
  token: string | null,
  username: string = 'me',
  opts?: { interval?: number },
): APIResult<TraktWatching | null> {
  return useAPI(
    clientId && token ? `${BASE}/users/${username}/watching` : null,
    { headers: traktHeaders(clientId!, token), interval: opts?.interval ?? 30000 },
  );
}

export function useTraktHistory(
  clientId: string | null,
  token: string | null,
  opts?: { username?: string; type?: 'movies' | 'shows' | 'episodes'; limit?: number },
): APIResult<TraktHistoryItem[]> {
  const user = opts?.username ?? 'me';
  const typePath = opts?.type ? `/${opts.type}` : '';
  return useAPI(
    clientId && token
      ? `${BASE}/users/${user}/history${typePath}${qs({ limit: opts?.limit ?? 20 })}`
      : null,
    { headers: traktHeaders(clientId!, token) },
  );
}

export function useTraktWatchlist(
  clientId: string | null,
  token: string | null,
  opts?: { username?: string; type?: 'movies' | 'shows' },
): APIResult<TraktWatchlistItem[]> {
  const user = opts?.username ?? 'me';
  const typePath = opts?.type ? `/${opts.type}` : '';
  return useAPI(
    clientId && token ? `${BASE}/users/${user}/watchlist${typePath}` : null,
    { headers: traktHeaders(clientId!, token) },
  );
}

export function useTraktTrending(
  clientId: string | null,
  type: 'movies' | 'shows' = 'movies',
  opts?: { limit?: number },
): APIResult<Array<{ watchers: number; movie?: TraktMovie; show?: TraktShow }>> {
  return useAPI(
    clientId ? `${BASE}/${type}/trending${qs({ limit: opts?.limit ?? 10 })}` : null,
    { headers: traktHeaders(clientId!) },
  );
}

export function useTraktStats(
  clientId: string | null,
  token: string | null,
  username: string = 'me',
): APIResult<TraktStats> {
  return useAPI(
    clientId && token ? `${BASE}/users/${username}/stats` : null,
    { headers: traktHeaders(clientId!, token) },
  );
}
