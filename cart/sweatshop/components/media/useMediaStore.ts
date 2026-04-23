
const host: any = globalThis as any;

export type MediaKind = 'image' | 'video';
export type MediaBgToken =
  | 'appBg'
  | 'panelBg'
  | 'panelRaised'
  | 'panelAlt'
  | 'panelHover'
  | 'grayChip'
  | 'grayDeep'
  | 'blueDeep'
  | 'greenDeep'
  | 'yellowDeep'
  | 'orangeDeep'
  | 'redDeep'
  | 'purpleDeep';
export type MediaRadiusKey = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'pill';

export type MediaCrop = { x: number; y: number; w: number; h: number };
export type MediaVideoState = { playing: boolean; time: number; duration: number; volume: number; loop: boolean; rate: number };
export type MediaItem = {
  id: string;
  kind: MediaKind;
  title: string;
  source: string;
  bgToken: MediaBgToken;
  radiusKey: MediaRadiusKey;
  shadow: boolean;
  aspectLock: boolean;
  rotation: number;
  width: number;
  height: number;
  crop: MediaCrop;
  video: MediaVideoState;
};

const STORE_KEY = 'sweatshop.media.items';
const SELECTED_KEY = 'sweatshop.media.selected';

function storeGet(key: string): string | null {
  try {
    if (typeof host.__store_get !== 'function') return null;
    const raw = host.__store_get(key);
    return raw == null ? null : String(raw);
  } catch {
    return null;
  }
}

function storeSet(key: string, value: string): void {
  try {
    if (typeof host.__store_set === 'function') host.__store_set(key, value);
  } catch {}
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function makeId(kind: MediaKind): string {
  return kind + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export function createMediaItem(kind: MediaKind, source: string, title?: string): MediaItem {
  return {
    id: makeId(kind),
    kind,
    title: title || (kind === 'image' ? 'Image' : 'Video'),
    source,
    bgToken: 'panelBg',
    radiusKey: 'md',
    shadow: true,
    aspectLock: true,
    rotation: 0,
    width: kind === 'image' ? 380 : 420,
    height: kind === 'image' ? 260 : 240,
    crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    video: { playing: false, time: 0, duration: 120, volume: 0.8, loop: false, rate: 1 },
  };
}

function loadItems(): MediaItem[] {
  try {
    const raw = storeGet(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => ({
      ...createMediaItem(item?.kind === 'video' ? 'video' : 'image', String(item?.source || ''), String(item?.title || '')),
      ...item,
      width: clamp(Number(item?.width ?? 0), 160, 1200),
      height: clamp(Number(item?.height ?? 0), 120, 900),
      rotation: clamp(Number(item?.rotation ?? 0), -180, 180),
      crop: {
        x: clamp(Number(item?.crop?.x ?? 0.1), 0, 1),
        y: clamp(Number(item?.crop?.y ?? 0.1), 0, 1),
        w: clamp(Number(item?.crop?.w ?? 0.8), 0.05, 1),
        h: clamp(Number(item?.crop?.h ?? 0.8), 0.05, 1),
      },
      video: {
        playing: !!item?.video?.playing,
        time: clamp(Number(item?.video?.time ?? 0), 0, 1e6),
        duration: clamp(Number(item?.video?.duration ?? 120), 1, 1e6),
        volume: clamp(Number(item?.video?.volume ?? 0.8), 0, 1),
        loop: !!item?.video?.loop,
        rate: clamp(Number(item?.video?.rate ?? 1), 0.25, 4),
      },
    }));
  } catch {
    return [];
  }
}

export function useMediaStore() {
  const [items, setItems] = useState<MediaItem[]>(() => loadItems());
  const [selectedId, setSelectedId] = useState<string>(() => String(storeGet(SELECTED_KEY) || ''));

  useEffect(() => {
    storeSet(STORE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    storeSet(SELECTED_KEY, selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (items.length === 0) {
      if (selectedId) setSelectedId('');
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const addMedia = useCallback((kind: MediaKind, source: string, title?: string) => {
    const next = createMediaItem(kind, source, title);
    setItems((prev) => [...prev, next]);
    setSelectedId(next.id);
    return next;
  }, []);

  const updateMedia = useCallback((id: string, patch: Partial<MediaItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch, crop: patch.crop ? { ...item.crop, ...patch.crop } : item.crop, video: patch.video ? { ...item.video, ...patch.video } : item.video } : item));
  }, []);

  const removeMedia = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((current) => current === id ? '' : current);
  }, []);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  return {
    items,
    selectedId,
    selected,
    setSelectedId,
    addMedia,
    updateMedia,
    removeMedia,
  };
}
