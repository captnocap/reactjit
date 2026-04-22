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

export function ptyOpen(cols: number, rows: number, shell?: string, cwd?: string): number {
  try {
    if (typeof host.__pty_open !== 'function') return -1;
    const out = host.__pty_open(cols, rows, shell || '', cwd || '');
    if (typeof out === 'number' && Number.isFinite(out)) return out;
    const value = Number(out);
    return Number.isFinite(value) ? value : -1;
  } catch {
    return -1;
  }
}

export function ptyRead(handle: number): string {
  try {
    if (typeof host.__pty_read !== 'function') return '';
    const out = host.__pty_read(handle);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

export function ptyWrite(handle: number, data: string): void {
  try {
    if (typeof host.__pty_write === 'function') host.__pty_write(handle, data);
  } catch {}
}

export function ptyAlive(handle: number): boolean {
  try {
    if (typeof host.__pty_alive !== 'function') return true;
    return !!host.__pty_alive(handle);
  } catch {
    return false;
  }
}

export function ptyClose(handle: number): void {
  try {
    if (typeof host.__pty_close === 'function') host.__pty_close(handle);
  } catch {}
}

export function ptyFocus(handle: number): void {
  try {
    if (typeof host.__pty_focus === 'function') host.__pty_focus(handle);
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
