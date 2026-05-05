// The user's local ROM library. Stores metadata — NOT ROM bytes — under
// sweatshop:emu:roms:* keys. Bytes live on disk at `path` and are
// re-read by useEmulator.loadROM when the user hits Play. Keeping bytes
// out of localStorage avoids bloating the store (NES ROMs run 16KB→1MB)
// and means external edits to the ROM file are picked up on next play.

export type RomEntry = {
  id: string;               // stable synthetic id; not the crc
  path: string;             // absolute filesystem path
  displayName: string;
  crc32: string;
  format: 'iNES' | 'NES2.0';
  mapperId: number;
  prgSize: number;
  chrSize: number;
  hasBattery: boolean;
  importedAt: number;
  lastPlayedAt: number | null;
  playCountSec: number;     // accumulated playtime, seconds
  launchCount: number;      // how many times launched
  favorite: boolean;
  region?: string;
  year?: number;
};

const INDEX_KEY = 'sweatshop:emu:roms:__index';
const ENTRY_PREFIX = 'sweatshop:emu:roms:';

function hostStore() {
  const h: any = globalThis as any;
  if (typeof h.__store_get === 'function' && typeof h.__store_set === 'function') {
    return {
      get(k: string): string | null { try { const v = h.__store_get(k); return v == null ? null : String(v); } catch { return null; } },
      set(k: string, v: string): void { try { h.__store_set(k, v); } catch {} },
      del(k: string): void { try { if (typeof h.__store_del === 'function') h.__store_del(k); else h.__store_set(k, ''); } catch {} },
    };
  }
  if (typeof localStorage !== 'undefined') {
    return {
      get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
      set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
      del(k: string) { try { localStorage.removeItem(k); } catch {} },
    };
  }
  return { get: (_: string) => null, set: (_: string, __: string) => {}, del: (_: string) => {} };
}

function readIndex(): string[] {
  const s = hostStore().get(INDEX_KEY);
  if (!s) return [];
  try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch { return []; }
}
function writeIndex(ids: string[]): void { hostStore().set(INDEX_KEY, JSON.stringify(ids)); }

export function loadAllRoms(): RomEntry[] {
  const store = hostStore();
  const out: RomEntry[] = [];
  for (const id of readIndex()) {
    const s = store.get(ENTRY_PREFIX + id);
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch {}
  }
  return out;
}

export function saveRom(entry: RomEntry): void {
  const store = hostStore();
  store.set(ENTRY_PREFIX + entry.id, JSON.stringify(entry));
  const idx = readIndex();
  if (!idx.includes(entry.id)) writeIndex([...idx, entry.id]);
}

export function deleteRom(id: string): void {
  const store = hostStore();
  store.del(ENTRY_PREFIX + id);
  writeIndex(readIndex().filter((x) => x !== id));
}

export function findRomByCrc(crc: string): RomEntry | null {
  for (const e of loadAllRoms()) if (e.crc32 === crc) return e;
  return null;
}

const listeners = new Set<() => void>();
export function subscribeRoms(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { for (const fn of listeners) fn(); }

export function useRomLibrary(): {
  roms: RomEntry[];
  upsert: (entry: RomEntry) => void;
  remove: (id: string) => void;
  toggleFavorite: (id: string) => void;
  recordLaunch: (id: string) => void;
  recordPlayed: (id: string, seconds: number) => void;
} {
  const [roms, setRoms] = useState<RomEntry[]>(() => loadAllRoms());

  useEffect(() => {
    const fn = () => setRoms(loadAllRoms());
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const upsert = useCallback((entry: RomEntry) => {
    saveRom(entry);
    notify();
  }, []);

  const remove = useCallback((id: string) => {
    deleteRom(id);
    notify();
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const all = loadAllRoms();
    const e = all.find((r) => r.id === id);
    if (!e) return;
    saveRom({ ...e, favorite: !e.favorite });
    notify();
  }, []);

  const recordLaunch = useCallback((id: string) => {
    const all = loadAllRoms();
    const e = all.find((r) => r.id === id);
    if (!e) return;
    saveRom({ ...e, lastPlayedAt: Date.now(), launchCount: e.launchCount + 1 });
    notify();
  }, []);

  const recordPlayed = useCallback((id: string, seconds: number) => {
    const all = loadAllRoms();
    const e = all.find((r) => r.id === id);
    if (!e) return;
    saveRom({ ...e, playCountSec: e.playCountSec + Math.max(0, Math.floor(seconds)) });
    notify();
  }, []);

  return { roms, upsert, remove, toggleFavorite, recordLaunch, recordPlayed };
}
