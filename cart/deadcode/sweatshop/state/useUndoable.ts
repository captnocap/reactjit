
import { push, undo as stackUndo, redo as stackRedo, subscribe, getUndoDepth, getRedoDepth } from './undoStack';

// Drop-in replacement for useState that records an undoable action each
// time the setter is called. Pair a category + name so it lands in the
// right bucket of history. Optional groupKey coalesces rapid bursts
// (slider drags, typing into a numeric field).
//
// Integrator example:
//   const [theme, setTheme] = useUndoable('theme', 'soft', {
//     category: 'theme',
//     name: (t) => 'Set theme: ' + t,
//   });
//
// Scope reminder: do NOT use this for editor text content. Editors have
// their own per-buffer history.

export type UseUndoableOpts<T> = {
  category: string;
  name: string | ((next: T, prev: T) => string);
  source?: string;            // originating panel id, threaded into history UI
  groupKey?: string | ((next: T, prev: T) => string | undefined);
  // When false, the setter skips recording. Useful for programmatic
  // restores inside your own undo handlers (unlikely — push already
  // wraps closures, this is the escape hatch).
  record?: boolean;
};

let _tick = 0;
function freshId(prefix: string): string {
  _tick = (_tick + 1) | 0;
  return prefix + ':' + Date.now().toString(36) + ':' + _tick.toString(36);
}

function resolve<T, R>(v: R | ((next: T, prev: T) => R), next: T, prev: T): R {
  return typeof v === 'function' ? (v as any)(next, prev) : v;
}

export function useUndoable<T>(key: string, initial: T, opts: UseUndoableOpts<T>): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const valueRef = useRef<T>(value);
  valueRef.current = value;

  const setter = useCallback((next: T | ((prev: T) => T)) => {
    const prev = valueRef.current;
    const resolved = typeof next === 'function' ? (next as any)(prev) : next;
    if (resolved === prev) return;

    const record = opts.record !== false;
    setValue(resolved);

    if (!record) return;

    const name = resolve<T, string>(opts.name, resolved, prev);
    const groupKey = opts.groupKey ? resolve<T, string | undefined>(opts.groupKey, resolved, prev) : undefined;

    push({
      id: freshId(key),
      name,
      category: opts.category,
      source: opts.source,
      at: Date.now(),
      snapshotBefore: prev,
      snapshotAfter: resolved,
      groupKey,
      do: () => setValue(resolved),
      undo: () => setValue(prev),
    });
  }, [key, opts.category, opts.name, opts.source, opts.groupKey, opts.record]);

  return [value, setter];
}

// Subscribe-aware hook for UI that wants to re-render on every stack
// change (status segments, history panels).
export function useUndoStats(): { undoDepth: number; redoDepth: number; undo: () => void; redo: () => void } {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((x: number) => (x + 1) | 0);
    return subscribe(fn);
  }, []);
  return {
    undoDepth: getUndoDepth(),
    redoDepth: getRedoDepth(),
    undo: () => { stackUndo(); },
    redo: () => { stackRedo(); },
  };
}
