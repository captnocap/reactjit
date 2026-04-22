// Gamify event recorder + state hook. Subscribes to panel focus/click events
// via a simple callback surface (record()), runs them through LevelCalc, and
// persists session state in localStorage so xp survives reloads.


import {
  computeLevelState,
  milestonesCrossed,
  panelUsage,
  xpForEvents,
  type GamifyEvent,
  type GamifyEventType,
  type LevelState,
} from './LevelCalc';

const STORE_KEY = 'sweatshop.cockpit.gamify.v1';
const MAX_EVENTS = 512;

interface StoredState {
  enabled: number;
  events: GamifyEvent[];
  xp: number;
  unlocks: { id: string; label: string; t: number }[];
}

function readStore(): StoredState | null {
  try {
    const g: any = globalThis as any;
    const raw = typeof g.__store_get === 'function'
      ? g.__store_get(STORE_KEY)
      : (typeof g.localStorage !== 'undefined' ? g.localStorage.getItem(STORE_KEY) : null);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function writeStore(s: StoredState) {
  try {
    const g: any = globalThis as any;
    const raw = JSON.stringify(s);
    if (typeof g.__store_set === 'function') g.__store_set(STORE_KEY, raw);
    else if (typeof g.localStorage !== 'undefined') g.localStorage.setItem(STORE_KEY, raw);
  } catch (_) {}
}

export interface Achievement { id: string; label: string; t: number; }

export interface GamifyApi {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  events: GamifyEvent[];
  level: LevelState;
  unlocks: Achievement[];
  usage: Record<string, number>;
  record: (type: GamifyEventType, meta?: { panelId?: string; workerId?: string }) => void;
  reset: () => void;
}

export function useGamifyEvents(defaultEnabled: boolean = true): GamifyApi {
  const initial = readStore();
  const [enabled, setEnabledState] = useState<boolean>(initial ? initial.enabled === 1 : defaultEnabled);
  const [events, setEvents] = useState<GamifyEvent[]>(initial ? initial.events : []);
  const [xp, setXp] = useState<number>(initial ? initial.xp : 0);
  const [unlocks, setUnlocks] = useState<Achievement[]>(initial ? initial.unlocks : []);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const persist = useCallback((next: Partial<StoredState>) => {
    const snap: StoredState = {
      enabled: (next.enabled ?? (enabled ? 1 : 0)) as number,
      events: next.events ?? events,
      xp: next.xp ?? xp,
      unlocks: next.unlocks ?? unlocks,
    };
    writeStore(snap);
  }, [enabled, events, xp, unlocks]);

  const record = useCallback((type: GamifyEventType, meta?: { panelId?: string; workerId?: string }) => {
    if (!enabledRef.current) return;
    const e: GamifyEvent = { type, t: Date.now(), panelId: meta?.panelId, workerId: meta?.workerId };
    setEvents((prev: GamifyEvent[]) => {
      const next = prev.concat([e]);
      if (next.length > MAX_EVENTS) next.splice(0, next.length - MAX_EVENTS);
      return next;
    });
    setXp((prev: number) => {
      const add = xpForEvents([e]);
      const nextXp = prev + add;
      const crossed = milestonesCrossed(prev, nextXp);
      if (crossed.length > 0) {
        setUnlocks((prevU: Achievement[]) => {
          const t = Date.now();
          const seen: Record<string, boolean> = {};
          prevU.forEach((u) => { seen[u.id] = true; });
          const additions = crossed.filter((c) => !seen[c.id]).map((c) => ({ id: c.id, label: c.label, t }));
          return prevU.concat(additions);
        });
      }
      return nextXp;
    });
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setXp(0);
    setUnlocks([]);
  }, []);

  useEffect(() => {
    persist({ enabled: enabled ? 1 : 0, events, xp, unlocks });
  }, [enabled, events, xp, unlocks, persist]);

  const level = computeLevelState(xp);
  const usage = panelUsage(events);

  return { enabled, setEnabled, events, level, unlocks, usage, record, reset };
}
