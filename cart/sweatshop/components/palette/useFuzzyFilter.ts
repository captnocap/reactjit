import { PaletteCommand, PaletteSettings, GroupedCategory } from './types';

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

export function fuzzyScore(query: string, text: string, mode: 'strict' | 'loose'): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (!t) return 0;

  if (t === q) return 10000;
  if (t.startsWith(q)) return 1000 + q.length * 10;

  const words = t.split(/[\s\/\-_\\.]+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q)) {
      return 800 + q.length * 10 - i * 20;
    }
  }

  const subIdx = t.indexOf(q);
  if (subIdx >= 0) {
    return 600 - subIdx * 2;
  }

  if (mode === 'strict') return 0;

  let qi = 0;
  let ti = 0;
  let gaps = 0;
  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) {
      qi++;
    } else {
      gaps++;
    }
    ti++;
  }
  if (qi === q.length) {
    return Math.max(10, 400 - gaps * 10 - (ti - qi) * 2);
  }

  return 0;
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
