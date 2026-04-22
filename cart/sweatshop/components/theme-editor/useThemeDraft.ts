
import { getCustomOverrides, setCustomOverrides, applyTheme, getActiveThemeName } from '../../theme';
import { THEMES, type CustomThemeOverrides, type ThemePalette, type ThemeTokens } from '../../themes';

// A draft is the in-flight edit. `applied` controls whether every keystroke
// pushes through setCustomOverrides() for live preview. `save` commits the
// draft and switches the active theme to 'custom' if it isn't already.
export type UseThemeDraft = {
  draft: CustomThemeOverrides;
  setBase: (name: string) => void;
  setColor: (key: keyof ThemePalette, value: string) => void;
  setToken: (key: keyof ThemeTokens, value: any) => void;
  resetKey: (kind: 'palette' | 'tokens', key: string) => void;
  revert: () => void;
  save: () => void;
  live: boolean;
  setLive: (v: boolean) => void;
};

function clone(overrides: CustomThemeOverrides): CustomThemeOverrides {
  return {
    base: overrides.base,
    palette: { ...(overrides.palette || {}) },
    tokens: { ...(overrides.tokens || {}) },
  };
}

export function useThemeDraft(): UseThemeDraft {
  const [draft, setDraft] = useState<CustomThemeOverrides>(() => clone(getCustomOverrides()));
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (live) setCustomOverrides(draft);
  }, [draft, live]);

  const setBase = useCallback((name: string) => {
    if (!THEMES[name] || name === 'custom') return;
    setDraft((prev: CustomThemeOverrides) => ({ ...clone(prev), base: name }));
  }, []);

  const setColor = useCallback((key: keyof ThemePalette, value: string) => {
    setDraft((prev: CustomThemeOverrides) => {
      const next = clone(prev);
      next.palette = { ...(next.palette || {}), [key]: value };
      return next;
    });
  }, []);

  const setToken = useCallback((key: keyof ThemeTokens, value: any) => {
    setDraft((prev: CustomThemeOverrides) => {
      const next = clone(prev);
      next.tokens = { ...(next.tokens || {}), [key]: value };
      return next;
    });
  }, []);

  const resetKey = useCallback((kind: 'palette' | 'tokens', key: string) => {
    setDraft((prev: CustomThemeOverrides) => {
      const next = clone(prev);
      const bucket: any = kind === 'palette' ? next.palette : next.tokens;
      if (bucket) delete bucket[key];
      return next;
    });
  }, []);

  const revert = useCallback(() => {
    setDraft(clone(getCustomOverrides()));
  }, []);

  const save = useCallback(() => {
    setCustomOverrides(draft);
    if (getActiveThemeName() !== 'custom') applyTheme('custom');
  }, [draft]);

  return { draft, setBase, setColor, setToken, resetKey, revert, save, live, setLive };
}

// Named-preset storage under `sweatshop:themes:custom:*`.
const PRESET_PREFIX = 'sweatshop:themes:custom:';
const PRESET_INDEX_KEY = PRESET_PREFIX + '__index';

export function listPresets(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PRESET_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) { return []; }
}

function writeIndex(names: string[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PRESET_INDEX_KEY, JSON.stringify(names));
  } catch (_e) {}
}

export function loadPreset(name: string): CustomThemeOverrides | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(PRESET_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}

export function savePreset(name: string, overrides: CustomThemeOverrides): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(overrides));
    const names = listPresets();
    if (!names.includes(name)) writeIndex([...names, name]);
  } catch (_e) {}
}

export function deletePreset(name: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(PRESET_PREFIX + name);
    writeIndex(listPresets().filter((n) => n !== name));
  } catch (_e) {}
}

export function renamePreset(oldName: string, newName: string): void {
  const data = loadPreset(oldName);
  if (!data) return;
  deletePreset(oldName);
  savePreset(newName, data);
}

export function duplicatePreset(name: string, copyName: string): void {
  const data = loadPreset(name);
  if (data) savePreset(copyName, data);
}
