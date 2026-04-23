export type SegmentPosition = 'left' | 'center' | 'right';

export interface SegmentDef {
  id: string;
  label: string;
  defaultPosition: SegmentPosition;
  defaultVisible: boolean;
  priority?: number;
  component: any;
}

export interface UserSegmentState {
  visible?: boolean;
  position?: SegmentPosition;
  order?: number;
}

const REGISTRY = new Map<string, SegmentDef>();
const LISTENERS = new Set<() => void>();
const USER_KEY = 'sweatshop.statusbar.segments';

function hostStoreGet(key: string): string | null {
  try {
    const h = globalThis as any;
    if (typeof h.__store_get === 'function') return h.__store_get(key);
  } catch {}
  return null;
}

function hostStoreSet(key: string, value: string): void {
  try {
    const h = globalThis as any;
    if (typeof h.__store_set === 'function') h.__store_set(key, value);
  } catch {}
}

function loadUserState(): Record<string, UserSegmentState> {
  const raw = hostStoreGet(USER_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveUserState(state: Record<string, UserSegmentState>) {
  hostStoreSet(USER_KEY, JSON.stringify(state));
  LISTENERS.forEach((fn) => fn());
}

export function registerSegment(def: SegmentDef): void {
  if (REGISTRY.has(def.id)) return;
  REGISTRY.set(def.id, def);
  LISTENERS.forEach((fn) => fn());
}

export function getRegisteredSegments(): SegmentDef[] {
  return Array.from(REGISTRY.values()).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

export function getSegmentDisplayState(id: string) {
  const config = REGISTRY.get(id);
  const user = loadUserState()[id] || {};
  return {
    visible: user.visible !== undefined ? user.visible : config?.defaultVisible ?? true,
    position: user.position || config?.defaultPosition || 'left',
    order: user.order !== undefined ? user.order : config?.priority ?? 0,
  };
}

export function setSegmentVisibility(id: string, visible: boolean) {
  const next = { ...loadUserState() };
  next[id] = { ...next[id], visible };
  saveUserState(next);
}

export function setSegmentPosition(id: string, position: SegmentPosition) {
  const next = { ...loadUserState() };
  next[id] = { ...next[id], position };
  saveUserState(next);
}

export function setSegmentOrder(id: string, order: number) {
  const next = { ...loadUserState() };
  next[id] = { ...next[id], order };
  saveUserState(next);
}

export function resetSegmentOverrides() {
  hostStoreSet(USER_KEY, '{}');
  LISTENERS.forEach((fn) => fn());
}

export function useStatusRegistry(): SegmentDef[] {
  const [segments, setSegments] = useState<SegmentDef[]>(getRegisteredSegments);

  useEffect(() => {
    const tick = () => setSegments(getRegisteredSegments());
    LISTENERS.add(tick);
    return () => { LISTENERS.delete(tick); };
  }, []);

  return segments;
}
