// scripts/internal/cart-bundle.mjs — NOT a user-facing entry point.
//
// Lives under scripts/internal/ so agents scanning `scripts/` for something
// called "build-…" don't mistake it for the build command. The actual user
// entry points are `scripts/dev` and `scripts/ship`; both set
// BUNDLE_FROM_HARNESS=1 and invoke this file. Running it by hand is refused —
// the dev watcher owns .cache/bundle-*.js and concurrent stamps race.

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { build, context } from 'esbuild';
import { cartEsbuildOptions } from '../esbuild-config.mjs';

const rootDir = path.resolve(import.meta.dirname, '..', '..');

// ── Harness-only invocation gate ────────────────────────────────────────
// Agent/user shelling out directly races with the dev watcher, clobbers the
// current bundle with stale-config output, and triggers "h is not defined" /
// "wrong bundle loaded" ghosts that waste hours to debug.
//
// No override flag on purpose. If you truly need a one-shot build outside the
// harness, add the flag back temporarily — don't carry it as an opt-out.
if (process.env.BUNDLE_FROM_HARNESS !== '1') {
  console.error('[cart-bundle] REFUSING to run — this is an internal script, not an entry point.');
  console.error('[cart-bundle]');
  console.error('[cart-bundle] Use one of the user-facing entry points instead:');
  console.error('[cart-bundle]   ./scripts/dev <cart-name>   # dev host + watcher');
  console.error('[cart-bundle]   ./scripts/ship <cart-name>  # production binary');
  console.error('[cart-bundle]');
  console.error('[cart-bundle] Running `node scripts/internal/cart-bundle.mjs ...` manually races with');
  console.error('[cart-bundle] the dev watcher, overwrites the cart bundle on disk with a');
  console.error('[cart-bundle] potentially stale-config build, and produces "which bundle is');
  console.error('[cart-bundle] loaded?" bugs that take a long time to chase.');
  process.exit(1);
}

// --watch (or -w) turns on esbuild's watch mode; --out <path> overrides the
// default bundle.js output (useful when dev mode writes per-cart bundles that
// get pushed over IPC instead of read from disk).
const args = process.argv.slice(2);
const watch = args.includes('--watch') || args.includes('-w');
const outIdx = args.findIndex((a) => a === '--out' || a === '-o');
const outArg = outIdx >= 0 ? args[outIdx + 1] : null;
// When --out is absent, outIdx is -1 so outIdx + 1 is 0 — which would match the
// very first positional and silently swallow it. Guard with a sentinel so the
// filter only skips the --out value when --out is actually present.
const outValueIdx = outIdx >= 0 ? outIdx + 1 : -1;
const positional = args.filter((a, i) => !a.startsWith('-') && i !== outValueIdx);
const requestedEntry = positional[0] || 'cart/d152.tsx';
const entryAbs = path.resolve(rootDir, requestedEntry);
const bundlePath = outArg ? path.resolve(rootDir, outArg) : path.join(rootDir, 'bundle.js');

if (!entryAbs.startsWith(rootDir + path.sep)) {
  console.error(`[cart-bundle] entry must stay inside ${rootDir}`);
  process.exit(1);
}

try {
  const stat = await fs.stat(entryAbs);
  if (!stat.isFile()) {
    console.error(`[cart-bundle] not a file: ${requestedEntry}`);
    process.exit(1);
  }
} catch {
  console.error(`[cart-bundle] missing entry: ${requestedEntry}`);
  process.exit(1);
}

const esbuildOpts = cartEsbuildOptions({
  rootDir,
  outfile: bundlePath,
  cartEntryAbs: entryAbs,
});

if (watch) {
  // Plugin that logs each rebuild so scripts/dev can show progress in the same terminal.
  const logPlugin = {
    name: 'dev-log',
    setup(b) {
      b.onEnd((result) => {
        const ts = new Date().toLocaleTimeString();
        if (result.errors.length > 0) {
          console.error(`[cart-bundle ${ts}] rebuild FAILED (${result.errors.length} errors)`);
        } else {
          console.log(`[cart-bundle ${ts}] rebuilt ${path.relative(rootDir, bundlePath)}`);
        }
      });
    },
  };
  const ctx = await context({ ...esbuildOpts, plugins: [...esbuildOpts.plugins, logPlugin] });
  await ctx.watch();
  console.log(`[cart-bundle] watching ${path.relative(rootDir, entryAbs)} → ${path.relative(rootDir, bundlePath)} (ctrl-c to stop)`);
  // Keep the process alive; esbuild's watcher runs in the background.
  await new Promise(() => {});
} else {
  await build(esbuildOpts);
  console.log(`[cart-bundle] app=${path.relative(rootDir, entryAbs)} bundle=${path.relative(rootDir, bundlePath)}`);
}
