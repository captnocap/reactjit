import { useEffect, useMemo, useState } from 'react';

const host: any = globalThis as any;
const STORE_KEY = 'sweatshop.game-servers.favorites';

export type ServerFavorite = {
  gameId: string;
  address: string;
  name?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  ping?: number | null;
  tags?: string[];
  joinCommand?: string;
  secure?: boolean;
  passwordProtected?: boolean;
};

function loadFavorites(): ServerFavorite[] {
  try {
    const raw = typeof host.__store_get === 'function' ? host.__store_get(STORE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: ServerFavorite[]): void {
  try {
    if (typeof host.__store_set === 'function') host.__store_set(STORE_KEY, JSON.stringify(favorites));
  } catch {}
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<ServerFavorite[]>(() => loadFavorites());
  useEffect(() => { saveFavorites(favorites); }, [favorites]);

  const api = useMemo(() => {
    function pin(server: ServerFavorite) {
      setFavorites((prev) => {
        const next = prev.filter((item) => item.address !== server.address || item.gameId !== server.gameId);
        return [server, ...next].slice(0, 200);
      });
    }
    function unpin(gameId: string, address: string) {
      setFavorites((prev) => prev.filter((item) => item.gameId !== gameId || item.address !== address));
    }
    function toggle(server: ServerFavorite) {
      setFavorites((prev) => {
        const exists = prev.some((item) => item.gameId === server.gameId && item.address === server.address);
        if (exists) return prev.filter((item) => item.gameId !== server.gameId || item.address !== server.address);
        return [server, ...prev].slice(0, 200);
      });
    }
    function byGame(gameId: string) {
      return favorites.filter((item) => item.gameId === gameId);
    }
    return { favorites, byGame, pin, unpin, toggle };
  }, [favorites]);

  return api;
}

