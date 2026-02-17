/**
 * Spotify Web API hooks.
 * Auth: Bearer token (OAuth2). Get one at https://developer.spotify.com
 */

import { useAPI, useAPIMutation, bearer, qs, type APIResult } from './base';

const BASE = 'https://api.spotify.com/v1';

// ── Types ───────────────────────────────────────────────

export interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  preview_url: string | null;
  explicit: boolean;
  uri: string;
}

export interface SpotifyNowPlaying {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  currently_playing_type: string;
}

export interface SpotifyPaginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string };
}

export interface SpotifyTopItem<T> {
  items: T[];
  total: number;
}

// ── Hooks ───────────────────────────────────────────────

export function useSpotifyNowPlaying(
  token: string | null,
  opts?: { interval?: number },
): APIResult<SpotifyNowPlaying> {
  return useAPI<SpotifyNowPlaying>(
    token ? `${BASE}/me/player/currently-playing` : null,
    { headers: bearer(token!), interval: opts?.interval ?? 5000 },
  );
}

export function useSpotifyTopTracks(
  token: string | null,
  opts?: { timeRange?: 'short_term' | 'medium_term' | 'long_term'; limit?: number },
): APIResult<SpotifyTopItem<SpotifyTrack>> {
  return useAPI(
    token ? `${BASE}/me/top/tracks${qs({ time_range: opts?.timeRange, limit: opts?.limit })}` : null,
    { headers: bearer(token!) },
  );
}

export function useSpotifyTopArtists(
  token: string | null,
  opts?: { timeRange?: 'short_term' | 'medium_term' | 'long_term'; limit?: number },
): APIResult<SpotifyTopItem<SpotifyArtist>> {
  return useAPI(
    token ? `${BASE}/me/top/artists${qs({ time_range: opts?.timeRange, limit: opts?.limit })}` : null,
    { headers: bearer(token!) },
  );
}

export function useSpotifyRecentTracks(
  token: string | null,
  opts?: { limit?: number },
): APIResult<{ items: Array<{ track: SpotifyTrack; played_at: string }> }> {
  return useAPI(
    token ? `${BASE}/me/player/recently-played${qs({ limit: opts?.limit ?? 20 })}` : null,
    { headers: bearer(token!) },
  );
}

export function useSpotifyPlaylists(
  token: string | null,
  opts?: { limit?: number },
): APIResult<SpotifyPaginated<SpotifyPlaylist>> {
  return useAPI(
    token ? `${BASE}/me/playlists${qs({ limit: opts?.limit ?? 50 })}` : null,
    { headers: bearer(token!) },
  );
}

export function useSpotifySearch(
  token: string | null,
  query: string | null,
  opts?: { type?: string; limit?: number },
): APIResult<{ tracks?: SpotifyPaginated<SpotifyTrack>; artists?: SpotifyPaginated<SpotifyArtist> }> {
  const type = opts?.type ?? 'track,artist';
  return useAPI(
    token && query ? `${BASE}/search${qs({ q: query, type, limit: opts?.limit ?? 20 })}` : null,
    { headers: bearer(token!) },
  );
}

export function useSpotifyPlayback(token: string | null) {
  const { execute, loading, error } = useAPIMutation(token ? bearer(token) : undefined);
  return {
    play: () => execute(`${BASE}/me/player/play`, { method: 'PUT' }),
    pause: () => execute(`${BASE}/me/player/pause`, { method: 'PUT' }),
    next: () => execute(`${BASE}/me/player/next`),
    previous: () => execute(`${BASE}/me/player/previous`),
    loading,
    error,
  };
}
