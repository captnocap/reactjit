import { PaletteCommand, PaletteSettings, GroupedCategory } from './types';
import { fuzzyScore } from '@reactjit/runtime/hooks/useFuzzySearch';
export { fuzzyScore, fuzzySearch, scoreFuzzyItem, useFuzzySearch } from '@reactjit/runtime/hooks/useFuzzySearch';
export type {
  FuzzyMode,
  FuzzySearchCandidate,
  FuzzySearchOptions,
  FuzzySearchResult,
} from '@reactjit/runtime/hooks/useFuzzySearch';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;

const DEFAULT_SETTINGS: PaletteSettings = {
  fuzzyMode: 'loose',
  maxResults: 60,
  previewEnabled: true,
};

export function loadPaletteSettings(): PaletteSettings {
  try {
    const raw = storeGet('sweatshop.palette.settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function scoreCommand(query: string, cmd: PaletteCommand, mode: 'strict' | 'loose'): number {
  const labelScore = fuzzyScore(query, cmd.label, mode);
  const catScore = cmd.category ? fuzzyScore(query, cmd.category, mode) : 0;
  return Math.max(labelScore, catScore * 0.6);
}

export function groupByCategory(cmds: PaletteCommand[]): GroupedCategory[] {
  const map = new Map<string, PaletteCommand[]>();
  for (const cmd of cmds) {
    const cat = cmd.category || 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(cmd);
  }

  const order = [
    'Recent', 'History', 'Navigation', 'File', 'Edit', 'View', 'Help',
    'Settings', 'Theme', 'Workspace', 'Agent', 'Plugins', 'Custom',
    'Go to File', 'Files', 'Shell', 'Other',
  ];

  const result: GroupedCategory[] = [];
  for (const cat of order) {
    if (map.has(cat)) {
      result.push({ category: cat, items: map.get(cat)! });
      map.delete(cat);
    }
  }
  for (const [cat, items] of map) {
    result.push({ category: cat, items });
  }
  return result;
}

export function filterAndSort(
  query: string,
  commands: PaletteCommand[],
  mode: 'strict' | 'loose',
  maxResults: number
): PaletteCommand[] {
  const q = query.trim();
  if (!q) return commands;

  const scored = commands
    .map((cmd) => ({ cmd, score: scoreCommand(q, cmd, mode) }))
    .filter((item) => item.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.cmd).slice(0, maxResults);
}
