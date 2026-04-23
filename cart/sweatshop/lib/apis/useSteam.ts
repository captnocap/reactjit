import { useAPI, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface SteamConfig { apiKey?: string; steamId?: string; }

export function useSteam(config?: SteamConfig) {
  const keys = useServiceKey('steam');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = 'https://api.steampowered.com';

  const playerSummary = (steamId?: string) => {
    const id = steamId ?? config?.steamId;
    return useAPI<any>(apiKey && id ? `${base}/ISteamUser/GetPlayerSummaries/v0002/?${qs({ key: apiKey, steamids: id })}` : null);
  };
  const ownedGames = (steamId?: string) => {
    const id = steamId ?? config?.steamId;
    return useAPI<any>(apiKey && id ? `${base}/IPlayerService/GetOwnedGames/v0001/?${qs({ key: apiKey, steamid: id, include_appinfo: 1 })}` : null);
  };
  const recentlyPlayed = (steamId?: string) => {
    const id = steamId ?? config?.steamId;
    return useAPI<any>(apiKey && id ? `${base}/IPlayerService/GetRecentlyPlayedGames/v0001/?${qs({ key: apiKey, steamid: id })}` : null);
  };

  return { playerSummary, ownedGames, recentlyPlayed };
}
