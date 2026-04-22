
export type ToastLevel = 'info' | 'success' | 'warn' | 'error';
export type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ToastFilterLevel = ToastLevel | 'all';

export type ToastAction = {
  label: string;
  onPress: () => void;
  tone?: string;
};

export type ToastInput = {
  title?: string;
  level?: ToastLevel;
  duration?: number;
  actions?: ToastAction[];
};

export type ToastItem = {
  id: string;
  title: string;
  body: string;
  level: ToastLevel;
  duration: number;
  actions: ToastAction[];
  createdAt: number;
};

export type ToastSettings = {
  position: ToastPosition;
  maxVisible: number;
  autoDismissMs: number;
  levelFilter: ToastFilterLevel;
};

export type ToastSnapshot = {
  toasts: ToastItem[];
  history: ToastItem[];
  settings: ToastSettings;
};

export type ToastApi = ToastSnapshot & {
  toast: (message: string, input?: ToastInput) => string;
  dismiss: (id: string) => void;
  clearHistory: () => void;
  setSettings: (patch: Partial<ToastSettings>) => void;
};

const DEFAULT_SETTINGS: ToastSettings = {
  position: 'bottom-right',
  maxVisible: 4,
  autoDismissMs: 4500,
  levelFilter: 'all',
};

const listeners = new Set<() => void>();
const timers = new Map<string, any>();
const historyLimit = 80;
let seq = 0;

let state: ToastSnapshot = {
  toasts: [],
  history: [],
  settings: DEFAULT_SETTINGS,
};

export const ToastContext = createContext<ToastApi>({
  ...state,
  toast,
  dismiss,
  clearHistory,
  setSettings,
});

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener failures; toast delivery should stay resilient
    }
  });
}

function normalizeLevel(level?: ToastLevel): ToastLevel {
  return level === 'success' || level === 'warn' || level === 'error' ? level : 'info';
}

function nextId(): string {
  seq += 1;
  return 'toast-' + String(seq);
}

function recordHistory(item: ToastItem) {
  state = {
    ...state,
    history: [item, ...state.history.filter((entry) => entry.id !== item.id)].slice(0, historyLimit),
  };
}

export function toast(message: string, input: ToastInput = {}): string {
  const item: ToastItem = {
    id: nextId(),
    title: input.title || normalizeLevel(input.level) + ' update',
    body: message,
    level: normalizeLevel(input.level),
    duration: typeof input.duration === 'number' ? input.duration : state.settings.autoDismissMs,
    actions: Array.isArray(input.actions) ? input.actions.slice(0, 4) : [],
    createdAt: Date.now(),
  };
  state = { ...state, toasts: [...state.toasts, item] };
  recordHistory(item);
  emit();

  if (item.duration > 0) {
    if (timers.has(item.id)) clearTimeout(timers.get(item.id));
    timers.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
  }

  return item.id;
}

export function dismiss(id: string) {
  if (!id) return;
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
  const next = state.toasts.filter((item) => item.id !== id);
  if (next.length === state.toasts.length) return;
  state = { ...state, toasts: next };
  emit();
}

export function clearHistory() {
  state = { ...state, history: [] };
  emit();
}

export function setSettings(patch: Partial<ToastSettings>) {
  state = { ...state, settings: { ...state.settings, ...patch } };
  emit();
}

export function subscribeToastStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastSnapshot(): ToastSnapshot {
  return {
    toasts: state.toasts.slice(),
    history: state.history.slice(),
    settings: { ...state.settings },
  };
}

export function useToastStore(): ToastApi {
  const [snapshot, setSnapshot] = useState(getToastSnapshot());

  useEffect(() => subscribeToastStore(() => setSnapshot(getToastSnapshot())), []);

  return useMemo(() => ({
    ...snapshot,
    toast,
    dismiss,
    clearHistory,
    setSettings,
  }), [snapshot]);
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
