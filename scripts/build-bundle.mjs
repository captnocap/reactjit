import path from 'node:path';
import { promises as fs } from 'node:fs';
import { build, context } from 'esbuild';

const rootDir = path.resolve(import.meta.dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime');

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
  console.error(`[build-bundle] entry must stay inside ${rootDir}`);
  process.exit(1);
}

try {
  const stat = await fs.stat(entryAbs);
  if (!stat.isFile()) {
    console.error(`[build-bundle] not a file: ${requestedEntry}`);
    process.exit(1);
  }
} catch {
  console.error(`[build-bundle] missing entry: ${requestedEntry}`);
  process.exit(1);
}

// Resolve `import App from './current_app'` in runtime/index.tsx directly to
// the requested cart entry. This replaces the older write-a-shared-file
// indirection (fs.writeFile runtime/current_app.tsx) that was racy when two
// dev sessions ran concurrently — each session's rewrite would clobber the
// other's active watcher.
const cartEntryPlugin = {
  name: 'cart-entry',
  setup(b) {
    b.onResolve({ filter: /^\.\/current_app$/ }, () => ({ path: entryAbs }));
  },
};

// Ambient primitives (Phase 1): every named export in framework/ambient.ts
// becomes a free-identifier candidate esbuild injects on demand. A .tsx file
// referencing `Box`, `Text`, `useState`, etc. without importing them gets the
// equivalent of a named import from framework/ambient.ts inserted at bundle
// time. Additive — existing imports keep working.
//
// Kept classic JSX (jsxFactory: 'h') on purpose. Flipping to jsx: 'automatic'
// would swap the runtime to `react/jsx-runtime` imports and defeat the
// direct-require workaround in runtime/jsx_shim.ts that avoids Hermes/JSRT's
// __toESM mishandling of the react default export.
const ambientInject = path.join(rootDir, 'framework', 'ambient.ts');
// Split: primitive re-exports live in ambient_primitives.ts so ambient.ts
// has zero dep on runtime/primitives. Merging them used to create a cycle
// (react/index.js body → init_ambient → init_primitives → require('react')
// → partial {} → React3.memo undefined at runtime).
const ambientPrimitivesInject = path.join(rootDir, 'framework', 'ambient_primitives.ts');
// Self-probe entry — exports __self_probe_main and registers it on
// globalThis so v8_app.zig can invoke it when the --self-probe argv
// flag lands. Inject pulls this in any time a cart references the
// __self_probe_main free identifier.
const selfProbeInject = path.join(rootDir, 'framework', 'autotest', 'self_probe.ts');

const esbuildOpts = {
  absWorkingDir: rootDir,
  entryPoints: [path.join(runtimeDir, 'index.tsx')],
  bundle: true,
  outfile: bundlePath,
  format: 'iife',
  inject: [path.join(runtimeDir, 'jsx_shim.ts'), ambientInject, ambientPrimitivesInject, selfProbeInject],
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  alias: { '@reactjit/core': './runtime/core_stub.ts' },
  external: ['path', 'typescript'],
  plugins: [cartEntryPlugin],
};

if (watch) {
  // Plugin that logs each rebuild so scripts/dev can show progress in the same terminal.
  const logPlugin = {
    name: 'dev-log',
    setup(b) {
      b.onEnd((result) => {
        const ts = new Date().toLocaleTimeString();
        if (result.errors.length > 0) {
          console.error(`[build-bundle ${ts}] rebuild FAILED (${result.errors.length} errors)`);
        } else {
          console.log(`[build-bundle ${ts}] rebuilt ${path.relative(rootDir, bundlePath)}`);
        }
      });
    },
  };
  const ctx = await context({ ...esbuildOpts, plugins: [...esbuildOpts.plugins, logPlugin] });
  await ctx.watch();
  console.log(`[build-bundle] watching ${path.relative(rootDir, entryAbs)} → ${path.relative(rootDir, bundlePath)} (ctrl-c to stop)`);
  // Keep the process alive; esbuild's watcher runs in the background.
  await new Promise(() => {});
} else {
  await build(esbuildOpts);
  console.log(`[build-bundle] app=${path.relative(rootDir, entryAbs)} bundle=${path.relative(rootDir, bundlePath)}`);
}
