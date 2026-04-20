const host: any = globalThis as any;

export function exec(cmd: string): string {
  try {
    if (typeof host.__exec !== 'function') return '';
    const out = host.__exec(cmd);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

export function readFile(path: string): string {
  try {
    if (typeof host.__fs_readfile !== 'function') return '';
    const out = host.__fs_readfile(path);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

export function writeFile(path: string, content: string): boolean {
  try {
    if (typeof host.__fs_writefile !== 'function') return false;
    return host.__fs_writefile(path, content) === 0;
  } catch {
    return false;
  }
}

export function telSystem(): { window_w?: number; window_h?: number } | null {
  try {
    if (typeof host.__tel_system !== 'function') return null;
    return host.__tel_system() || null;
  } catch {
    return null;
  }
}

export function ptyOpen(cols: number, rows: number): void {
  try {
    if (typeof host.__pty_open === 'function') host.__pty_open(cols, rows);
  } catch {}
}

export function closeWindow(): void {
  try {
    if (typeof host.__windowClose === 'function') host.__windowClose();
  } catch {}
}

export function minimizeWindow(): void {
  try {
    if (typeof host.__windowMinimize === 'function') host.__windowMinimize();
  } catch {}
}

export function maximizeWindow(): void {
  try {
    if (typeof host.__windowMaximize === 'function') host.__windowMaximize();
  } catch {}
}
