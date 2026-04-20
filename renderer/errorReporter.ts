export function reportError(e: unknown, ctx: string): void {
  // Route to console.error (which is polyfilled in runtime/index.tsx to emit
  // via __hostLog). Never call `globalThis.print` — it's a QuickJS shell builtin
  // that doesn't exist in our embedded VM, and throwing from inside reportError
  // turns every transport failure into a cascading React re-render storm.
  const g: any = globalThis as any;
  const err: any = e;
  const msg = err?.stack || err?.message || String(e);
  if (typeof g.console?.error === 'function') {
    g.console.error(`[err] ${ctx}: ${msg}`);
  } else if (typeof g.__hostLog === 'function') {
    try { g.__hostLog(2, `[err] ${ctx}: ${msg}`); } catch {}
  }
}
