// Opt-in autosave. Call useSnapshotAutosave({ enabled, intervalMs, maxRetained,
// include }) inside any long-lived component and it will fire a snapshot every
// intervalMs, trimming auto-snapshots to at most maxRetained.
//
// The interval is coarse on purpose: capture() walks every registered slice
// and stringifies for the store, so sub-minute cadences are discouraged.


import { useSnapshots } from './useSnapshots';

export interface AutosaveOptions {
  enabled: boolean;
  intervalMs: number;
  maxRetained: number;
  include?: (sliceId: string) => boolean;
  nameTemplate?: (t: number) => string;
  onError?: (err: any) => void;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const MIN_INTERVAL_MS = 30 * 1000;           // 30 seconds — don't thrash the store
const DEFAULT_MAX_RETAINED = 10;

function defaultName(t: number): string {
  const d = new Date(t);
  const p = (n: number) => n < 10 ? '0' + n : String(n);
  return 'autosave · ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export function useSnapshotAutosave(opts: AutosaveOptions): { lastAt: number | null } {
  const { enabled } = opts;
  const intervalMs = Math.max(MIN_INTERVAL_MS, opts.intervalMs ?? DEFAULT_INTERVAL_MS);
  const maxRetained = Math.max(1, opts.maxRetained ?? DEFAULT_MAX_RETAINED);
  const snapshots = useSnapshots();
  const lastAtRef = useRef<number | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!enabled) return;
    const fire = () => {
      try {
        const now = Date.now();
        const name = (optsRef.current.nameTemplate || defaultName)(now);
        snapshots.create({ name, auto: true, include: optsRef.current.include });
        snapshots.trim(maxRetained, true);
        lastAtRef.current = now;
      } catch (err) {
        if (optsRef.current.onError) optsRef.current.onError(err);
      }
    };
    const id = setInterval(fire, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, maxRetained, snapshots]);

  return { lastAt: lastAtRef.current };
}

// Non-React escape hatch: callable version that just needs a snapshots API.
// Useful if a host subsystem wants to schedule its own cadence.
export interface AutosaveController { stop: () => void; }

export function startAutosave(
  snapshots: ReturnType<typeof useSnapshots>,
  opts: AutosaveOptions,
): AutosaveController {
  if (!opts.enabled) return { stop: () => {} };
  const intervalMs = Math.max(MIN_INTERVAL_MS, opts.intervalMs ?? DEFAULT_INTERVAL_MS);
  const maxRetained = Math.max(1, opts.maxRetained ?? DEFAULT_MAX_RETAINED);
  const id = setInterval(() => {
    try {
      const now = Date.now();
      const name = (opts.nameTemplate || defaultName)(now);
      snapshots.create({ name, auto: true, include: opts.include });
      snapshots.trim(maxRetained, true);
    } catch (err) {
      if (opts.onError) opts.onError(err);
    }
  }, intervalMs);
  return { stop: () => clearInterval(id) };
}

export const AUTOSAVE_DEFAULTS = {
  enabled: false,
  intervalMs: DEFAULT_INTERVAL_MS,
  maxRetained: DEFAULT_MAX_RETAINED,
  minIntervalMs: MIN_INTERVAL_MS,
};
