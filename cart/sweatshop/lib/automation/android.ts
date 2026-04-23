// Android automation via adb. Every function shells out to a real `adb` call.
// If adb is not on PATH, probeAdb() returns an install hint that the UI
// surfaces as a banner — no silent no-ops.

import { run, whichAsync, shellQuote } from './exec';

export interface AdbProbe { present: boolean; path: string; version: string; installHint: string; }
export interface AdbDevice { serial: string; state: 'device' | 'offline' | 'unauthorized' | 'unknown'; model?: string; product?: string; }

export async function probeAdb(): Promise<AdbProbe> {
  const p = await whichAsync('adb');
  if (!p.present) {
    return {
      present: false, path: '', version: '',
      installHint: 'Install adb: sudo apt install android-tools-adb (Debian/Ubuntu) or brew install android-platform-tools (macOS)',
    };
  }
  const v = await run('adb --version');
  return { present: true, path: p.path, version: (v.stdout || '').split('\n')[0] || '', installHint: '' };
}

export async function devices(): Promise<AdbDevice[]> {
  const res = await run('adb devices -l');
  if (res.code !== 0) return [];
  const out: AdbDevice[] = [];
  const lines = (res.stdout || '').split('\n').slice(1);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const serial = parts[0];
    const state = (parts[1] || 'unknown') as AdbDevice['state'];
    const d: AdbDevice = { serial, state };
    for (const kv of parts.slice(2)) {
      const [k, v] = kv.split(':');
      if (k === 'model')   d.model = v;
      if (k === 'product') d.product = v;
    }
    out.push(d);
  }
  return out;
}

function serialArg(serial: string | null | undefined): string {
  return serial ? '-s ' + shellQuote(serial) + ' ' : '';
}

export async function tap(serial: string | null, x: number, y: number): Promise<boolean> {
  const res = await run('adb ' + serialArg(serial) + 'shell input tap ' + Math.round(x) + ' ' + Math.round(y));
  return res.code === 0;
}

export async function swipe(serial: string | null, x1: number, y1: number, x2: number, y2: number, durationMs: number = 300): Promise<boolean> {
  const res = await run('adb ' + serialArg(serial) + 'shell input swipe ' + Math.round(x1) + ' ' + Math.round(y1) + ' ' + Math.round(x2) + ' ' + Math.round(y2) + ' ' + Math.round(durationMs));
  return res.code === 0;
}

export async function typeText(serial: string | null, text: string): Promise<boolean> {
  // `adb shell input text` replaces spaces with %s
  const encoded = text.replace(/ /g, '%s');
  const res = await run('adb ' + serialArg(serial) + 'shell input text ' + shellQuote(encoded));
  return res.code === 0;
}

export async function keyevent(serial: string | null, keycode: number | string): Promise<boolean> {
  const res = await run('adb ' + serialArg(serial) + 'shell input keyevent ' + String(keycode));
  return res.code === 0;
}

export async function launchApp(serial: string | null, packageName: string): Promise<boolean> {
  const res = await run('adb ' + serialArg(serial) + 'shell monkey -p ' + shellQuote(packageName) + ' -c android.intent.category.LAUNCHER 1');
  return res.code === 0;
}

export async function installApk(serial: string | null, apkPath: string, replace: boolean = true): Promise<{ ok: boolean; stdout: string }> {
  const flags = replace ? '-r ' : '';
  const res = await run('adb ' + serialArg(serial) + 'install ' + flags + shellQuote(apkPath));
  return { ok: res.code === 0, stdout: res.stdout || '' };
}

export interface ScreencapResult { ok: boolean; path: string; bytes: number; err?: string; }

export async function screencap(serial: string | null, outPath: string): Promise<ScreencapResult> {
  const res = await run('adb ' + serialArg(serial) + 'exec-out screencap -p > ' + shellQuote(outPath));
  if (res.code !== 0) return { ok: false, path: outPath, bytes: 0, err: 'screencap exit ' + res.code };
  const stat = await run('stat -c %s ' + shellQuote(outPath));
  const bytes = stat.code === 0 ? parseInt((stat.stdout || '0').trim(), 10) || 0 : 0;
  return { ok: bytes > 0, path: outPath, bytes };
}

export async function listPackages(serial: string | null): Promise<string[]> {
  const res = await run('adb ' + serialArg(serial) + 'shell pm list packages -3');
  if (res.code !== 0) return [];
  return (res.stdout || '').split('\n').map((l) => l.replace(/^package:/, '').trim()).filter(Boolean);
}

export async function currentActivity(serial: string | null): Promise<string> {
  const res = await run('adb ' + serialArg(serial) + 'shell dumpsys activity activities | grep -E "mResumedActivity|ResumedActivity" | head -1');
  return (res.stdout || '').trim();
}
