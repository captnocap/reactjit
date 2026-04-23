declare const globalThis: any;

export type PathCheck = { ok: boolean; reason?: string };

export function isAbsolutePath(p: string): boolean {
  return p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
}

export function checkIsDirectory(path: string): PathCheck {
  if (!path) return { ok: false, reason: 'Path is empty.' };
  if (!isAbsolutePath(path)) return { ok: false, reason: 'Path must be absolute.' };
  const statFn = globalThis.__fs_stat_json;
  if (typeof statFn !== 'function') return { ok: false, reason: '__fs_stat_json binding unavailable.' };
  const raw = statFn(path);
  if (!raw) return { ok: false, reason: 'Path does not exist: ' + path };
  try {
    const info = JSON.parse(raw);
    if (!info.isDir) return { ok: false, reason: 'Path exists but is not a directory: ' + path };
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: 'Failed to parse stat JSON for: ' + path };
  }
}

export function mkdirP(path: string): PathCheck {
  if (!path) return { ok: false, reason: 'Path is empty.' };
  if (!isAbsolutePath(path)) return { ok: false, reason: 'Path must be absolute.' };
  const mk = globalThis.__fs_mkdir;
  if (typeof mk !== 'function') return { ok: false, reason: '__fs_mkdir binding unavailable.' };
  const ok = !!mk(path);
  if (!ok) return { ok: false, reason: 'Failed to create: ' + path };
  return checkIsDirectory(path);
}
