/**
 * Steam Web API hooks.
 * Auth: API key as query param. https://steamcommunity.com/dev/apikey
 */

import { useAPI, qs, type APIResult } from './base';

const BASE = 'https://api.steampowered.com';
const STORE = 'https://store.steampowered.com/api';

// ── Types ───────────────────────────────────────────────

export interface SteamPlayer {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  personastate: number;
  communityvisibilitystate: number;
  lastlogoff?: number;
  timecreated?: number;
  loccountrycode?: string;
  locstatecode?: string;
  gameextrainfo?: string;
  gameid?: string;
}

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url: string;
  has_community_visible_stats: boolean;
  rtime_last_played: number;
}

export interface SteamRecentGame {
  appid: number;
  name: string;
  playtime_2weeks: number;
  playtime_forever: number;
  img_icon_url: string;
}

export interface SteamFriend {
  steamid: string;
  relationship: string;
  friend_since: number;
}

export interface SteamAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
  name?: string;
  description?: string;
}

export interface SteamAppDetails {
  name: string;
  steam_appid: number;
  is_free: boolean;
  short_description: string;
  header_image: string;
  developers: string[];
  publishers: string[];
  price_overview?: { final_formatted: string; discount_percent: number };
  metacritic?: { score: number; url: string };
  categories: Array<{ description: string }>;
  genres: Array<{ description: string }>;
  release_date: { coming_soon: boolean; date: string };
}

// ── Hooks ───────────────────────────────────────────────

export function useSteamUser(
  apiKey: string | null,
  steamId: string | null,
): APIResult<{ response: { players: SteamPlayer[] } }> {
  return useAPI(
    apiKey && steamId
      ? `${BASE}/ISteamUser/GetPlayerSummaries/v0002/${qs({ key: apiKey, steamids: steamId })}`
      : null,
  );
}

export function useSteamOwnedGames(
  apiKey: string | null,
  steamId: string | null,
  opts?: { includeAppInfo?: boolean },
): APIResult<{ response: { game_count: number; games: SteamOwnedGame[] } }> {
  return useAPI(
    apiKey && steamId
      ? `${BASE}/IPlayerService/GetOwnedGames/v0001/${qs({
          key: apiKey,
          steamid: steamId,
          include_appinfo: opts?.includeAppInfo ?? true,
          include_played_free_games: true,
          format: 'json',
        })}`
      : null,
  );
}

export function useSteamRecentGames(
  apiKey: string | null,
  steamId: string | null,
  opts?: { count?: number },
): APIResult<{ response: { total_count: number; games: SteamRecentGame[] } }> {
  return useAPI(
    apiKey && steamId
      ? `${BASE}/IPlayerService/GetRecentlyPlayedGames/v0001/${qs({
          key: apiKey,
          steamid: steamId,
          count: opts?.count ?? 10,
          format: 'json',
        })}`
      : null,
  );
}

export function useSteamFriends(
  apiKey: string | null,
  steamId: string | null,
): APIResult<{ friendslist: { friends: SteamFriend[] } }> {
  return useAPI(
    apiKey && steamId
      ? `${BASE}/ISteamUser/GetFriendList/v0001/${qs({ key: apiKey, steamid: steamId, relationship: 'friend' })}`
      : null,
  );
}

export function useSteamAchievements(
  apiKey: string | null,
  steamId: string | null,
  appId: number | null,
): APIResult<{ playerstats: { achievements: SteamAchievement[] } }> {
  return useAPI(
    apiKey && steamId && appId
      ? `${BASE}/ISteamUserStats/GetPlayerAchievements/v0001/${qs({ key: apiKey, steamid: steamId, appid: appId })}`
      : null,
  );
}

export function useSteamAppDetails(
  appId: number | null,
): APIResult<Record<string, { success: boolean; data: SteamAppDetails }>> {
  return useAPI(
    appId ? `${STORE}/appdetails${qs({ appids: appId })}` : null,
  );
}

/** Construct a Steam game icon URL */
export function steamGameIcon(appId: number, iconHash: string): string {
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${iconHash}.jpg`;
}

/** Construct a Steam game header image URL */
export function steamHeaderImage(appId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}
