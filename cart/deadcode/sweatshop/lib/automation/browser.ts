// Browser automation backed by headless Chromium. Real command invocations
// via execAsync; no mocked network. Uses the simplest CLI surface Chromium
// gives us: --dump-dom for extraction, --screenshot for captures, --evaluate
// via chrome --remote-debugging-port (not universally available — we probe).
//
// Probe order: chromium-browser → chromium → google-chrome → google-chrome-stable.

import { run, runWithTimeout, whichAsync, shellQuote, type ExecProbe } from './exec';

export interface BrowserProbe { binary: string | null; probe: ExecProbe; installHint: string; }
export interface GotoResult { ok: boolean; html: string; code: number; err?: string; }
export interface ScreenshotResult { ok: boolean; path: string; code: number; err?: string; }

const CANDIDATES = ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable'];

export async function probeBrowser(): Promise<BrowserProbe> {
  for (const bin of CANDIDATES) {
    const p = await whichAsync(bin);
    if (p.present) return { binary: bin, probe: p, installHint: '' };
  }
  return {
    binary: null,
    probe: { present: false, path: '' },
    installHint: 'Install one of: chromium-browser · chromium · google-chrome. On Debian/Ubuntu: sudo apt install chromium-browser',
  };
}

// Load a URL and return its serialized DOM. chromium --dump-dom does a full
// load (including JS execution) and writes the resulting HTML to stdout.
export async function goto(url: string, timeoutSec: number = 20): Promise<GotoResult> {
  const probe = await probeBrowser();
  if (!probe.binary) return { ok: false, html: '', code: -1, err: probe.installHint };
  const cmd = probe.binary
    + ' --headless=new --disable-gpu --no-sandbox --hide-scrollbars --virtual-time-budget=8000'
    + ' --dump-dom ' + shellQuote(url);
  const res = await runWithTimeout(cmd, timeoutSec);
  return { ok: res.code === 0, html: res.stdout || '', code: res.code };
}

export async function screenshot(url: string, outPath: string, timeoutSec: number = 20): Promise<ScreenshotResult> {
  const probe = await probeBrowser();
  if (!probe.binary) return { ok: false, path: outPath, code: -1, err: probe.installHint };
  const cmd = probe.binary
    + ' --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1280,800 --virtual-time-budget=8000'
    + ' --screenshot=' + shellQuote(outPath) + ' ' + shellQuote(url);
  const res = await runWithTimeout(cmd, timeoutSec);
  return { ok: res.code === 0, path: outPath, code: res.code };
}

// Simple selector-based text extraction via chromium's script surface.
// Uses --virtual-time-budget + inline JS dumped through --dump-dom can't do
// selectors alone, so we feed it a data:URL bootstrap that fetches the target
// and queries the selector. This works for simple pages; JS-heavy SPAs may
// need a real DevTools session (see the banner in the panel).
export async function extractText(url: string, selector: string, timeoutSec: number = 20): Promise<{ ok: boolean; texts: string[]; err?: string }> {
  const dom = await goto(url, timeoutSec);
  if (!dom.ok) return { ok: false, texts: [], err: dom.err || ('chromium exit ' + dom.code) };
  // Parse the DOM string with a tiny regex-free heuristic: unsafe for XSS, fine
  // for extracting text nodes under a tag selector like 'h1' or '.foo'. For
  // attribute or deep selectors the correct answer is DevTools — banner warns.
  const texts = crudeSelect(dom.html, selector);
  return { ok: true, texts };
}

// The selector grammar we support here is intentionally narrow:
//   'tag'       → all occurrences of <tag>
//   '#id'       → element with id attr
//   '.class'    → elements with class substring match
// Anything more specific returns [] and the UI surfaces the gap.
export function crudeSelect(html: string, selector: string): string[] {
  const s = selector.trim();
  if (!s) return [];
  if (s[0] === '#') return pickById(html, s.slice(1));
  if (s[0] === '.') return pickByClass(html, s.slice(1));
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(s)) return pickByTag(html, s.toLowerCase());
  return [];
}

function stripTags(s: string): string { return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }

function pickByTag(html: string, tag: string): string[] {
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(stripTags(m[1]));
  return out.filter((x) => x.length > 0);
}
function pickById(html: string, id: string): string[] {
  const re = new RegExp('<([a-z0-9]+)[^>]*\\bid=["\']?' + id + '["\']?[^>]*>([\\s\\S]*?)<\\/\\1>', 'i');
  const m = re.exec(html);
  return m ? [stripTags(m[2])] : [];
}
function pickByClass(html: string, cls: string): string[] {
  const re = new RegExp('<([a-z0-9]+)[^>]*\\bclass=["\'][^"\']*\\b' + cls + '\\b[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/\\1>', 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(stripTags(m[2]));
  return out.filter((x) => x.length > 0);
}

// Click/type by selector need a DevTools protocol session. We report
// "unsupported without chromium devtools" rather than faking it.
export async function clickBySelector(_url: string, _selector: string): Promise<{ ok: false; err: string }> {
  return { ok: false, err: 'click-by-selector requires a DevTools session (not wired). Use recorder+adb for tap-by-coords, or install playwright and extend browser.ts.' };
}
export async function typeIntoSelector(_url: string, _selector: string, _text: string): Promise<{ ok: false; err: string }> {
  return { ok: false, err: 'type-into-selector requires a DevTools session (not wired).' };
}
