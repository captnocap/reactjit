
export type KeybindPresetName = 'default' | 'vim' | 'vscode' | 'emacs' | 'custom';

export type KeybindingSpec = {
  id: string;
  label: string;
  description: string;
  category: string;
  defaultChord: string;
};

export type KeybindingMap = Record<string, string>;

export const KEYBINDING_COMMANDS: KeybindingSpec[] = [
  { id: 'nav.settings', label: 'Open Settings', description: 'Jump to the settings surface.', category: 'Navigation', defaultChord: 'Ctrl+,' },
  { id: 'nav.commandPalette', label: 'Open Command Palette', description: 'Search and run commands.', category: 'Navigation', defaultChord: 'Ctrl+K' },
  { id: 'nav.projects', label: 'Open Projects', description: 'Open the workspace / project browser.', category: 'Navigation', defaultChord: 'Ctrl+P' },
  { id: 'surface.search', label: 'Toggle Search', description: 'Show or hide the search surface.', category: 'Surface', defaultChord: 'Ctrl+Shift+F' },
  { id: 'surface.terminal', label: 'Toggle Terminal', description: 'Open the terminal dock.', category: 'Surface', defaultChord: 'Ctrl+`' },
  { id: 'surface.chat', label: 'Toggle Chat', description: 'Open the chat surface.', category: 'Surface', defaultChord: 'Ctrl+L' },
  { id: 'surface.hot', label: 'Toggle Hot Panel', description: 'Open the hot panel.', category: 'Surface', defaultChord: 'Ctrl+H' },
  { id: 'file.new', label: 'New File', description: 'Create a new file in the workspace.', category: 'File', defaultChord: 'Ctrl+N' },
  { id: 'file.save', label: 'Save Current File', description: 'Save the focused file or document.', category: 'File', defaultChord: 'Ctrl+S' },
  { id: 'workspace.refresh', label: 'Refresh Workspace', description: 'Reload the workspace state.', category: 'Workspace', defaultChord: 'Ctrl+Shift+R' },
  { id: 'workspace.index', label: 'Index Project', description: 'Rebuild the workspace index.', category: 'Workspace', defaultChord: 'Ctrl+Shift+I' },
  { id: 'agent.new', label: 'New Conversation', description: 'Start a fresh agent conversation.', category: 'Agent', defaultChord: 'Ctrl+Shift+N' },
  { id: 'agent.send', label: 'Send Message', description: 'Send the current chat message.', category: 'Agent', defaultChord: 'Ctrl+Enter' },
  { id: 'agent.cycleModel', label: 'Cycle Model', description: 'Switch the active model.', category: 'Agent', defaultChord: 'Ctrl+/' },
  { id: 'agent.stop', label: 'Stop Agent', description: 'Stop the active agent turn.', category: 'Agent', defaultChord: 'Ctrl+.' },
];

const STORAGE_PREFIX = 'sweatshop.settings.keybindings.';

const BASE_BINDINGS: KeybindingMap = KEYBINDING_COMMANDS.reduce((acc, spec) => {
  acc[spec.id] = spec.defaultChord;
  return acc;
}, {} as KeybindingMap);

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

function hostStoreDel(key: string): void {
  try {
    const h = globalThis as any;
    if (typeof h.__store_del === 'function') h.__store_del(key);
  } catch {}
}

function cloneBindings(bindings: KeybindingMap): KeybindingMap {
  return { ...bindings };
}

function loadStoredState(): { preset: KeybindPresetName; bindings: KeybindingMap } {
  const bindings: KeybindingMap = {};
  for (const spec of KEYBINDING_COMMANDS) {
    const raw = hostStoreGet(STORAGE_PREFIX + spec.id);
    if (raw === null || raw === undefined || raw === '') continue;
    bindings[spec.id] = normalizeChord(raw);
  }
  return { preset: detectPreset(bindings), bindings };
}

function saveStoredState(state: { preset: KeybindPresetName; bindings: KeybindingMap }): void {
  try {
    for (const spec of KEYBINDING_COMMANDS) {
      const value = state.bindings[spec.id];
      if (!value) hostStoreDel(STORAGE_PREFIX + spec.id);
      else if (value === spec.defaultChord) hostStoreDel(STORAGE_PREFIX + spec.id);
      else hostStoreSet(STORAGE_PREFIX + spec.id, value);
    }
  } catch {}
}

function buildPresetBindings(overrides: KeybindingMap): KeybindingMap {
  return cloneBindings(overrides);
}

export const PRESET_OVERRIDES: Record<Exclude<KeybindPresetName, 'custom'>, KeybindingMap> = {
  default: buildPresetBindings({}),
  vim: buildPresetBindings({
    'nav.commandPalette': 'Ctrl+P',
    'nav.projects': 'Ctrl+O',
    'surface.search': 'Ctrl+F',
    'surface.terminal': 'Ctrl+T',
    'surface.chat': 'Ctrl+G',
    'surface.hot': 'Ctrl+H',
    'file.new': 'Ctrl+N',
    'file.save': 'Ctrl+S',
    'workspace.refresh': 'Ctrl+R',
    'workspace.index': 'Ctrl+I',
    'agent.new': 'Ctrl+Shift+N',
    'agent.send': 'Ctrl+Enter',
    'agent.cycleModel': 'Ctrl+/',
    'agent.stop': 'Ctrl+.',
  }),
  vscode: buildPresetBindings({
    'nav.commandPalette': 'Ctrl+Shift+P',
    'nav.projects': 'Ctrl+P',
    'surface.search': 'Ctrl+Shift+F',
    'surface.terminal': 'Ctrl+`',
    'surface.chat': 'Ctrl+L',
    'surface.hot': 'Ctrl+H',
    'file.new': 'Ctrl+N',
    'file.save': 'Ctrl+S',
    'workspace.refresh': 'Ctrl+R',
    'workspace.index': 'Ctrl+Shift+I',
    'agent.new': 'Ctrl+Shift+N',
    'agent.send': 'Ctrl+Enter',
    'agent.cycleModel': 'Ctrl+/',
    'agent.stop': 'Ctrl+.',
  }),
  emacs: buildPresetBindings({
    'nav.settings': 'Ctrl+,',
    'nav.commandPalette': 'Ctrl+X',
    'nav.projects': 'Ctrl+P',
    'surface.search': 'Ctrl+S',
    'surface.terminal': 'Ctrl+T',
    'surface.chat': 'Ctrl+C',
    'surface.hot': 'Ctrl+H',
    'file.new': 'Ctrl+X',
    'file.save': 'Ctrl+X',
    'workspace.refresh': 'Ctrl+L',
    'workspace.index': 'Ctrl+I',
    'agent.new': 'Ctrl+N',
    'agent.send': 'Ctrl+Enter',
    'agent.cycleModel': 'Ctrl+Y',
    'agent.stop': 'Ctrl+G',
  }),
};

export const KEYBINDING_PRESETS = {
  default: { name: 'Default', description: 'Stock shortcuts with no overrides.' },
  vim: { name: 'Vim-inspired', description: 'A tighter, movement-friendly layout.' },
  vscode: { name: 'VSCode', description: 'Common editor shortcuts and palette chords.' },
  emacs: { name: 'Emacs', description: 'Emacs-flavored single-chord mappings.' },
} as const;

function specialKeyName(key: string): string {
  const lower = key.toLowerCase();
  if (key === ' ') return 'Space';
  if (lower === 'escape') return 'Escape';
  if (lower === 'enter') return 'Enter';
  if (lower === 'tab') return 'Tab';
  if (lower === 'backspace') return 'Backspace';
  if (lower === 'delete') return 'Delete';
  if (lower === 'arrowup') return 'Up';
  if (lower === 'arrowdown') return 'Down';
  if (lower === 'arrowleft') return 'Left';
  if (lower === 'arrowright') return 'Right';
  if (lower === 'pageup') return 'PageUp';
  if (lower === 'pagedown') return 'PageDown';
  if (lower === 'home') return 'Home';
  if (lower === 'end') return 'End';
  if (lower === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function normalizeToken(token: string): string {
  const lower = token.trim().toLowerCase();
  if (!lower) return '';
  if (lower === 'control' || lower === 'ctrl') return 'Ctrl';
  if (lower === 'shift') return 'Shift';
  if (lower === 'alt' || lower === 'option') return 'Alt';
  if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') return 'Meta';
  return specialKeyName(token.trim());
}

export function normalizeChord(chord: string): string {
  const raw = String(chord || '').trim();
  if (!raw) return '';
  return raw.split('+').map(normalizeToken).filter(Boolean).join('+');
}

export function splitChord(chord: string): string[] {
  return normalizeChord(chord).split('+').filter(Boolean);
}

export function chordFromEvent(event: any): string {
  if (!event) return '';
  const key = typeof event.key === 'string' ? event.key : '';
  if (!key) return '';
  const lower = key.toLowerCase();
  if (lower === 'control' || lower === 'shift' || lower === 'alt' || lower === 'meta') return '';
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(normalizeToken(key));
  return parts.join('+');
}

export function getResolvedBindings(bindings: KeybindingMap): KeybindingMap {
  const resolved: KeybindingMap = {};
  for (const spec of KEYBINDING_COMMANDS) {
    const value = Object.prototype.hasOwnProperty.call(bindings, spec.id) ? bindings[spec.id] : undefined;
    resolved[spec.id] = value === undefined ? spec.defaultChord : normalizeChord(value);
  }
  return resolved;
}

export function detectPreset(bindings: KeybindingMap): KeybindPresetName {
  const resolved = getResolvedBindings(bindings);
  for (const name of ['default', 'vim', 'vscode', 'emacs'] as const) {
    const expected = getResolvedBindings(PRESET_OVERRIDES[name]);
    let same = true;
    for (const spec of KEYBINDING_COMMANDS) {
      if (resolved[spec.id] !== expected[spec.id]) {
        same = false;
        break;
      }
    }
    if (same) return name;
  }
  return 'custom';
}

export function findConflicts(bindings: KeybindingMap): Record<string, string[]> {
  const resolved = getResolvedBindings(bindings);
  const map: Record<string, string[]> = {};
  for (const spec of KEYBINDING_COMMANDS) {
    const chord = resolved[spec.id];
    if (!chord) continue;
    if (!map[chord]) map[chord] = [];
    map[chord].push(spec.id);
  }
  return map;
}

export function useKeybindStore() {
  const [state, setState] = useState(() => loadStoredState());

  useEffect(() => {
    saveStoredState(state);
  }, [state]);

  const resolved = useMemo(() => getResolvedBindings(state.bindings), [state.bindings]);
  const conflictMap = useMemo(() => findConflicts(state.bindings), [state.bindings]);
  const activePreset = useMemo(() => detectPreset(state.bindings), [state.bindings]);

  function updateBinding(id: string, chord: string) {
    const normalized = normalizeChord(chord);
    setState((prev) => {
      const next = { ...prev.bindings };
      const spec = KEYBINDING_COMMANDS.find((item) => item.id === id);
      const defaultChord = spec ? spec.defaultChord : '';
      if (!normalized || normalized === defaultChord) {
        delete next[id];
      } else {
        next[id] = normalized;
      }
      return { preset: 'custom', bindings: next };
    });
  }

  function resetBinding(id: string) {
    setState((prev) => {
      const next = { ...prev.bindings };
      delete next[id];
      return { preset: 'custom', bindings: next };
    });
  }

  function applyPreset(name: Exclude<KeybindPresetName, 'custom'>) {
    setState({ preset: name, bindings: cloneBindings(PRESET_OVERRIDES[name]) });
  }

  function resetAll() {
    applyPreset('default');
  }

  return {
    commands: KEYBINDING_COMMANDS,
    activePreset,
    bindings: resolved,
    overrides: state.bindings,
    conflictMap,
    updateBinding,
    resetBinding,
    applyPreset,
    resetAll,
  };
}
