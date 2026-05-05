// React surface for browser.ts — tracks probe state + in-flight command so
// the UI can disable the Go button while chromium is loading.


import { probeBrowser, goto, screenshot, extractText, type BrowserProbe, type GotoResult, type ScreenshotResult } from '../../../lib/automation/browser';

export interface BrowserAutomationApi {
  probe: BrowserProbe | null;
  probing: boolean;
  running: boolean;
  lastResult: { kind: 'goto' | 'screenshot' | 'extract'; note: string; ok: boolean } | null;
  refreshProbe: () => void;
  goto: (url: string) => Promise<GotoResult>;
  screenshot: (url: string, out: string) => Promise<ScreenshotResult>;
  extractText: (url: string, selector: string) => Promise<{ ok: boolean; texts: string[]; err?: string }>;
}

export function useBrowserAutomation(): BrowserAutomationApi {
  const [probe, setProbe] = useState<BrowserProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const refreshProbe = useCallback(() => {
    setProbing(true);
    probeBrowser().then((p) => { setProbe(p); setProbing(false); });
  }, []);

  useEffect(() => { refreshProbe(); }, [refreshProbe]);

  const wrapGoto = useCallback(async (url: string) => {
    setRunning(true);
    const r = await goto(url);
    setLastResult({ kind: 'goto', ok: r.ok, note: r.ok ? (r.html.length + ' bytes') : (r.err || ('exit ' + r.code)) });
    setRunning(false);
    return r;
  }, []);
  const wrapShot = useCallback(async (url: string, out: string) => {
    setRunning(true);
    const r = await screenshot(url, out);
    setLastResult({ kind: 'screenshot', ok: r.ok, note: r.ok ? ('saved ' + out) : (r.err || ('exit ' + r.code)) });
    setRunning(false);
    return r;
  }, []);
  const wrapExtract = useCallback(async (url: string, selector: string) => {
    setRunning(true);
    const r = await extractText(url, selector);
    setLastResult({ kind: 'extract', ok: r.ok, note: r.ok ? (r.texts.length + ' matches') : (r.err || 'extract failed') });
    setRunning(false);
    return r;
  }, []);

  return {
    probe, probing, running, lastResult, refreshProbe,
    goto: wrapGoto, screenshot: wrapShot, extractText: wrapExtract,
  };
}
