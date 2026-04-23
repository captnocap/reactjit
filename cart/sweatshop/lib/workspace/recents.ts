declare const globalThis: any;

const KEY = 'sweatshop.recents';
const CAP = 10;
const FILE_NAME = 'sweatshop-recents.json';

function host(): any {
  return globalThis as any;
}

function log(message: string): void {
  try {
    const h = host();
    if (typeof h.__hostLog === 'function') h.__hostLog(0, '[recents] ' + message);
    else if (typeof console !== 'undefined' && console.log) console.log('[recents] ' + message);
  } catch (_e) {}
}

function recentsFilePath(): string {
  const h = host();
  const xdg = typeof h.__env_get === 'function' ? h.__env_get('XDG_DATA_HOME') : '';
  if (typeof xdg === 'string' && xdg.length > 0) return xdg.replace(/\/+$/, '') + '/reactjit/' + FILE_NAME;
  const home = typeof h.__env_get === 'function' ? h.__env_get('HOME') : '';
  if (typeof home === 'string' && home.length > 0) return home.replace(/\/+$/, '') + '/.local/share/reactjit/' + FILE_NAME;
  return '/tmp/' + FILE_NAME;
}

function clean(paths: any): string[] {
  if (!Array.isArray(paths)) return [];
  const out: string[] = [];
  for (const path of paths) {
    if (typeof path !== 'string') continue;
    const trimmed = path.trim();
    if (!trimmed || out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= CAP) break;
  }
  return out;
}

function parse(raw: any): string[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    return clean(JSON.parse(raw));
  } catch (_e) {
    return [];
  }
}

function loadFileRecents(): string[] {
  const h = host();
  if (typeof h.__fs_readfile !== 'function') return [];
  try {
    return parse(h.__fs_readfile(recentsFilePath()));
  } catch (_e) {
    return [];
  }
}

function loadStoreRecents(): string[] {
  const h = host();
  const get = h.__store_get;
  if (typeof get !== 'function') return [];
  try {
    return parse(get(KEY));
  } catch (_e) {
    return [];
  }
}

export function loadRecents(): string[] {
  const fromFile = loadFileRecents();
  if (fromFile.length > 0) {
    log('load file count=' + fromFile.length + ' first=' + fromFile[0]);
    return fromFile;
  }
  const fromStore = loadStoreRecents();
  if (fromStore.length > 0) saveRecents(fromStore);
  log('load store count=' + fromStore.length + (fromStore[0] ? ' first=' + fromStore[0] : ''));
  return fromStore;
}

export function saveRecents(paths: string[]): void {
  const h = host();
  const cleaned = clean(paths);
  const raw = JSON.stringify(cleaned);
  const filePath = recentsFilePath();
  log('save requested count=' + cleaned.length + (cleaned[0] ? ' first=' + cleaned[0] : '') + ' file=' + filePath);
  if (typeof h.__fs_writefile === 'function') {
    try {
      const rc = h.__fs_writefile(filePath, raw);
      log('file write rc=' + String(rc) + ' bytes=' + raw.length);
    } catch (e) {
      log('file write threw ' + String(e));
    }
  } else {
    log('file write skipped missing __fs_writefile');
  }
  const set = h.__store_set;
  if (typeof set !== 'function') {
    log('store write skipped missing __store_set');
    return;
  }
  try {
    set(KEY, raw);
    log('store write queued key=' + KEY);
  } catch (e) {
    log('store write threw ' + String(e));
  }
}

export function addRecent(path: string): string[] {
  const trimmed = (path || '').trim();
  log('add path="' + String(path) + '" trimmed="' + trimmed + '"');
  if (!trimmed) return loadRecents();
  const existing = loadRecents();
  const deduped = existing.filter((p) => p !== trimmed);
  const next = [trimmed, ...deduped].slice(0, CAP);
  saveRecents(next);
  log('add done next=' + JSON.stringify(next));
  return next;
}
