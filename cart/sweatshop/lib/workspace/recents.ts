declare const globalThis: any;

const KEY = 'sweatshop.recents';
const CAP = 10;

export function loadRecents(): string[] {
  const get = globalThis.__store_get;
  if (typeof get !== 'function') return [];
  const raw = get(KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x: any) => typeof x === 'string' && x.length > 0);
  } catch (_e) {
    return [];
  }
}

export function saveRecents(paths: string[]): void {
  const set = globalThis.__store_set;
  if (typeof set !== 'function') return;
  try {
    set(KEY, JSON.stringify(paths.slice(0, CAP)));
  } catch (_e) {}
}

export function addRecent(path: string): string[] {
  const existing = loadRecents();
  const deduped = existing.filter((p) => p !== path);
  const next = [path, ...deduped].slice(0, CAP);
  saveRecents(next);
  return next;
}
