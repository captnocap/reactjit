
import { getRegisteredPanels } from '../../panel-registry';

// Tracks panels the user has popped out into their own OS window. Uses
// `__openWindow(title, width, height)` to spawn the window at the
// framework level.
//
// HOST-FN GAP (tracked, not worked around):
//   __openWindow currently takes (title, w, h) only. The framework does
//   not yet accept a panel id / arg payload, does not spin up a second
//   React tree inside the new window, and exposes no IPC primitive for
//   state sync. Until those land:
//     - openPanel() spawns an empty window and records the intent locally.
//     - closePanel() / focusPanel() are TODO — we cannot address an
//       already-opened OS window by id from here.
//   Fix tracked separately (host-side). React half ships now so the
//   tear-off UX can be wired ahead of the host extension.

export type OpenWindowOpts = {
  width?: number;
  height?: number;
  title?: string;
};

export type OpenWindowRecord = {
  id: string;           // synthetic record id
  panelId: string;
  title: string;
  width: number;
  height: number;
  openedAt: number;
};

const LOCAL_KEY = 'sweatshop:multi-window:intents';

function readIntents(): OpenWindowRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) { return []; }
}

function writeIntents(records: OpenWindowRecord[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
  } catch (_e) {}
}

const listeners = new Set<() => void>();
function notify() { for (const fn of listeners) fn(); }

function callOpenWindow(title: string, width: number, height: number): boolean {
  const host: any = globalThis as any;
  if (typeof host.__openWindow !== 'function') return false;
  try {
    host.__openWindow(title, width, height);
    return true;
  } catch (_e) { return false; }
}

function titleForPanel(panelId: string, override?: string): string {
  if (override) return override;
  const panel = getRegisteredPanels().find((p) => p.id === panelId);
  return panel ? panel.title : panelId;
}

export function useMultiWindow(): {
  openWindows: OpenWindowRecord[];
  openPanel: (panelId: string, opts?: OpenWindowOpts) => OpenWindowRecord | null;
  closePanel: (recordId: string) => void;
  focusPanel: (recordId: string) => void;
  closeAll: () => void;
  hostSupported: boolean;
} {
  const [records, setRecords] = useState<OpenWindowRecord[]>(() => readIntents());

  useEffect(() => {
    const fn = () => setRecords(readIntents());
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const openPanel = useCallback((panelId: string, opts?: OpenWindowOpts): OpenWindowRecord | null => {
    const title = titleForPanel(panelId, opts?.title);
    const width = opts?.width ?? 720;
    const height = opts?.height ?? 520;
    if (!callOpenWindow(title, width, height)) return null;
    const record: OpenWindowRecord = {
      id: panelId + '@' + Date.now().toString(36),
      panelId,
      title,
      width,
      height,
      openedAt: Date.now(),
    };
    const next = [...readIntents(), record];
    writeIntents(next);
    notify();
    return record;
  }, []);

  const closePanel = useCallback((recordId: string) => {
    // TODO(host-fn): no primitive to close a specific OS window by id.
    // Drop the local record so the list stays honest; the OS window
    // survives until the user closes it via the window chrome.
    const next = readIntents().filter((r) => r.id !== recordId);
    writeIntents(next);
    notify();
  }, []);

  const focusPanel = useCallback((_recordId: string) => {
    // TODO(host-fn): no primitive to focus an already-opened window.
    // Intentional no-op until host extension lands.
  }, []);

  const closeAll = useCallback(() => {
    writeIntents([]);
    notify();
  }, []);

  const host: any = globalThis as any;
  return {
    openWindows: records,
    openPanel,
    closePanel,
    focusPanel,
    closeAll,
    hostSupported: typeof host.__openWindow === 'function',
  };
}
