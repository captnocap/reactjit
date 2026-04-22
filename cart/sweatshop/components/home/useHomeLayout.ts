
export type TileType =
  | 'recent'
  | 'scratch'
  | 'launch'
  | 'theme'
  | 'shader'
  | 'clock'
  | 'weatherless'
  | 'stats';

export interface HomeTileDef {
  id: string;
  type: TileType;
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_TILES: HomeTileDef[] = [
  { id: 't-clock', type: 'clock', x: 20, y: 20, w: 220, h: 140 },
  { id: 't-theme', type: 'theme', x: 260, y: 20, w: 180, h: 140 },
  { id: 't-recent', type: 'recent', x: 460, y: 20, w: 280, h: 240 },
  { id: 't-stats', type: 'stats', x: 20, y: 180, w: 220, h: 140 },
  { id: 't-launch', type: 'launch', x: 260, y: 180, w: 180, h: 200 },
  { id: 't-shader', type: 'shader', x: 20, y: 340, w: 300, h: 200 },
  { id: 't-weatherless', type: 'weatherless', x: 340, y: 400, w: 200, h: 140 },
  { id: 't-scratch', type: 'scratch', x: 760, y: 20, w: 280, h: 240 },
];

const STORAGE_KEY = 'sweatshop_home_layout_v1';

function loadLayout(): HomeTileDef[] {
  try {
    const raw = (globalThis as any).__localstore_get?.(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_TILES));
}

function saveLayout(tiles: HomeTileDef[]) {
  try {
    (globalThis as any).__localstore_set?.(STORAGE_KEY, JSON.stringify(tiles));
  } catch {}
}

export function useHomeLayout() {
  const [tiles, setTiles] = useState<HomeTileDef[]>(loadLayout);

  const updateTile = useCallback((id: string, patch: Partial<HomeTileDef>) => {
    setTiles((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      saveLayout(next);
      return next;
    });
  }, []);

  const removeTile = useCallback((id: string) => {
    setTiles((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveLayout(next);
      return next;
    });
  }, []);

  const addTile = useCallback((type: TileType) => {
    setTiles((prev) => {
      const id = 't-' + type + '-' + Math.random().toString(36).slice(2, 7);
      // Find a free spot by simple grid scan
      const cols = 4;
      const baseW = 200;
      const baseH = 160;
      const gap = 20;
      let x = 20;
      let y = 20;
      let placed = false;
      for (let row = 0; row < 10 && !placed; row++) {
        for (let col = 0; col < cols && !placed; col++) {
          const cx = 20 + col * (baseW + gap);
          const cy = 20 + row * (baseH + gap);
          const overlap = prev.some((t) => !(cx + baseW < t.x || cx > t.x + t.w || cy + baseH < t.y || cy > t.y + t.h));
          if (!overlap) {
            x = cx;
            y = cy;
            placed = true;
          }
        }
      }
      const next = [...prev, { id, type, x, y, w: baseW, h: baseH }];
      saveLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_TILES));
    setTiles(fresh);
    saveLayout(fresh);
  }, []);

  return { tiles, updateTile, removeTile, addTile, resetLayout };
}
