/**
 * Plex, Jellyfin, and Emby media server hooks.
 * Plex: X-Plex-Token header. Jellyfin/Emby: API key header.
 */

import { useAPI, qs, type APIResult } from './base';

// ── Plex Types ──────────────────────────────────────────

export interface PlexMediaItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  thumb?: string;
  art?: string;
  summary?: string;
  duration?: number;
  addedAt: number;
  updatedAt: number;
  viewCount?: number;
  lastViewedAt?: number;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  agent: string;
  scanner: string;
}

export interface PlexSession {
  sessionKey: string;
  title: string;
  type: string;
  thumb?: string;
  User: { title: string };
  Player: { title: string; state: string; platform: string };
  viewOffset: number;
  duration: number;
}

// ── Plex Hooks ──────────────────────────────────────────

function plexHeaders(token: string): Record<string, string> {
  return { 'X-Plex-Token': token, Accept: 'application/json' };
}

export function usePlexLibraries(
  baseUrl: string | null,
  token: string | null,
): APIResult<{ MediaContainer: { Directory: PlexLibrary[] } }> {
  return useAPI(
    baseUrl && token ? `${baseUrl}/library/sections` : null,
    { headers: plexHeaders(token!) },
  );
}

export function usePlexLibrary(
  baseUrl: string | null,
  token: string | null,
  sectionId: string | null,
): APIResult<{ MediaContainer: { Metadata: PlexMediaItem[] } }> {
  return useAPI(
    baseUrl && token && sectionId ? `${baseUrl}/library/sections/${sectionId}/all` : null,
    { headers: plexHeaders(token!) },
  );
}

export function usePlexRecentlyAdded(
  baseUrl: string | null,
  token: string | null,
  opts?: { limit?: number },
): APIResult<{ MediaContainer: { Metadata: PlexMediaItem[] } }> {
  return useAPI(
    baseUrl && token
      ? `${baseUrl}/library/recentlyAdded${qs({ 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': opts?.limit ?? 20 })}`
      : null,
    { headers: plexHeaders(token!) },
  );
}

export function usePlexSessions(
  baseUrl: string | null,
  token: string | null,
  opts?: { interval?: number },
): APIResult<{ MediaContainer: { Metadata?: PlexSession[] } }> {
  return useAPI(
    baseUrl && token ? `${baseUrl}/status/sessions` : null,
    { headers: plexHeaders(token!), interval: opts?.interval ?? 10000 },
  );
}

// ── Jellyfin/Emby Types ────────────────────────────────

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  ProductionYear?: number;
  ImageTags?: Record<string, string>;
  RunTimeTicks?: number;
  CommunityRating?: number;
  DateCreated?: string;
}

export interface JellyfinSession {
  Id: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  NowPlayingItem?: JellyfinItem;
  PlayState?: { PositionTicks: number; IsPaused: boolean };
}

export interface JellyfinLibrary {
  Id: string;
  Name: string;
  CollectionType: string;
  ImageTags?: Record<string, string>;
}

// ── Jellyfin Hooks ──────────────────────────────────────

function jellyfinHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `MediaBrowser Token="${apiKey}"` };
}

export function useJellyfinLibraries(
  baseUrl: string | null,
  apiKey: string | null,
): APIResult<{ Items: JellyfinLibrary[] }> {
  return useAPI(
    baseUrl && apiKey ? `${baseUrl}/Library/VirtualFolders` : null,
    { headers: jellyfinHeaders(apiKey!) },
  );
}

export function useJellyfinItems(
  baseUrl: string | null,
  apiKey: string | null,
  opts?: { parentId?: string; type?: string; limit?: number; sortBy?: string },
): APIResult<{ Items: JellyfinItem[]; TotalRecordCount: number }> {
  return useAPI(
    baseUrl && apiKey
      ? `${baseUrl}/Items${qs({
          ParentId: opts?.parentId,
          IncludeItemTypes: opts?.type,
          Limit: opts?.limit ?? 20,
          SortBy: opts?.sortBy ?? 'DateCreated',
          SortOrder: 'Descending',
          Recursive: true,
        })}`
      : null,
    { headers: jellyfinHeaders(apiKey!) },
  );
}

export function useJellyfinSessions(
  baseUrl: string | null,
  apiKey: string | null,
  opts?: { interval?: number },
): APIResult<JellyfinSession[]> {
  return useAPI(
    baseUrl && apiKey ? `${baseUrl}/Sessions` : null,
    { headers: jellyfinHeaders(apiKey!), interval: opts?.interval ?? 10000 },
  );
}

export function useJellyfinLatest(
  baseUrl: string | null,
  apiKey: string | null,
  userId: string | null,
  opts?: { limit?: number },
): APIResult<JellyfinItem[]> {
  return useAPI(
    baseUrl && apiKey && userId
      ? `${baseUrl}/Users/${userId}/Items/Latest${qs({ Limit: opts?.limit ?? 20 })}`
      : null,
    { headers: jellyfinHeaders(apiKey!) },
  );
}

/** Build a Jellyfin image URL */
export function jellyfinImage(baseUrl: string, itemId: string, tag: string, type: string = 'Primary', maxWidth: number = 400): string {
  return `${baseUrl}/Items/${itemId}/Images/${type}?tag=${tag}&maxWidth=${maxWidth}`;
}
