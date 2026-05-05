// Automation script format — shared by browser + android tabs. Each step is
// a discriminated union of real actions; the runner walks steps one-by-one,
// calling into browser.ts / android.ts. Saved to __store_* as JSON.

import * as browser from './browser';
import * as android from './android';

export type ScriptStep =
  | { kind: 'browser.goto';        url: string }
  | { kind: 'browser.screenshot';  url: string; outPath: string }
  | { kind: 'browser.extractText'; url: string; selector: string }
  | { kind: 'android.tap';         serial: string | null; x: number; y: number }
  | { kind: 'android.swipe';       serial: string | null; x1: number; y1: number; x2: number; y2: number; durationMs?: number }
  | { kind: 'android.type';        serial: string | null; text: string }
  | { kind: 'android.keyevent';    serial: string | null; keycode: number | string }
  | { kind: 'android.launch';      serial: string | null; packageName: string }
  | { kind: 'android.screencap';   serial: string | null; outPath: string }
  | { kind: 'wait';                ms: number };

export type AutomationKind = 'browser' | 'android' | 'mixed';

export interface Script {
  id: string;
  name: string;
  kind: AutomationKind;
  steps: ScriptStep[];
  createdAt: number;
  updatedAt: number;
}

const STORE_KEY = 'sweatshop.automation.scripts.v1';

export function listScripts(): Script[] {
  try {
    const g: any = globalThis as any;
    const raw = typeof g.__store_get === 'function' ? g.__store_get(STORE_KEY)
      : (typeof g.localStorage !== 'undefined' ? g.localStorage.getItem(STORE_KEY) : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}

export function saveScripts(scripts: Script[]): void {
  try {
    const g: any = globalThis as any;
    const raw = JSON.stringify(scripts);
    if (typeof g.__store_set === 'function') g.__store_set(STORE_KEY, raw);
    else if (typeof g.localStorage !== 'undefined') g.localStorage.setItem(STORE_KEY, raw);
  } catch (_) {}
}

export function newScript(name: string, kind: AutomationKind): Script {
  const t = Date.now();
  return { id: 'script_' + t + '_' + Math.floor(Math.random() * 1e6), name, kind, steps: [], createdAt: t, updatedAt: t };
}

export function summarizeStep(s: ScriptStep): string {
  switch (s.kind) {
    case 'browser.goto':        return 'goto ' + s.url;
    case 'browser.screenshot':  return 'screenshot ' + s.url + ' → ' + s.outPath;
    case 'browser.extractText': return 'extract ' + s.selector + ' from ' + s.url;
    case 'android.tap':         return 'tap ' + s.x + ',' + s.y;
    case 'android.swipe':       return 'swipe ' + s.x1 + ',' + s.y1 + ' → ' + s.x2 + ',' + s.y2;
    case 'android.type':        return 'type "' + s.text + '"';
    case 'android.keyevent':    return 'keyevent ' + s.keycode;
    case 'android.launch':      return 'launch ' + s.packageName;
    case 'android.screencap':   return 'screencap → ' + s.outPath;
    case 'wait':                return 'wait ' + s.ms + 'ms';
  }
}

export interface StepResult { ok: boolean; note: string; }

export async function runStep(s: ScriptStep): Promise<StepResult> {
  switch (s.kind) {
    case 'browser.goto': {
      const r = await browser.goto(s.url);
      return { ok: r.ok, note: r.ok ? (r.html.length + ' bytes') : (r.err || ('exit ' + r.code)) };
    }
    case 'browser.screenshot': {
      const r = await browser.screenshot(s.url, s.outPath);
      return { ok: r.ok, note: r.ok ? 'saved ' + s.outPath : (r.err || ('exit ' + r.code)) };
    }
    case 'browser.extractText': {
      const r = await browser.extractText(s.url, s.selector);
      return { ok: r.ok, note: r.ok ? r.texts.length + ' matches' : (r.err || 'extract failed') };
    }
    case 'android.tap':       return { ok: await android.tap(s.serial, s.x, s.y), note: 'tap ' + s.x + ',' + s.y };
    case 'android.swipe':     return { ok: await android.swipe(s.serial, s.x1, s.y1, s.x2, s.y2, s.durationMs ?? 300), note: 'swipe' };
    case 'android.type':      return { ok: await android.typeText(s.serial, s.text), note: 'typed ' + s.text.length + ' chars' };
    case 'android.keyevent':  return { ok: await android.keyevent(s.serial, s.keycode), note: 'keyevent ' + s.keycode };
    case 'android.launch':    return { ok: await android.launchApp(s.serial, s.packageName), note: 'launch ' + s.packageName };
    case 'android.screencap': {
      const r = await android.screencap(s.serial, s.outPath);
      return { ok: r.ok, note: r.ok ? (r.bytes + 'B → ' + r.path) : (r.err || 'screencap failed') };
    }
    case 'wait': {
      await new Promise((res) => setTimeout(res, Math.max(0, s.ms)));
      return { ok: true, note: 'waited ' + s.ms + 'ms' };
    }
  }
}
