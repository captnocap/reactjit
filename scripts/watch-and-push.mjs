#!/usr/bin/env node
// watch-and-push — run esbuild in watch mode, pushing each rebuild to the
// reactjit dev host over /tmp/reactjit.sock.
//
// Usage: node scripts/watch-and-push.mjs <cart-name> <cart-file> <out-path>

import { context } from 'esbuild';
import path from 'node:path';
import { spawn } from 'node:child_process';

const [cartName, cartFile, outPath] = process.argv.slice(2);
if (!cartName || !cartFile || !outPath) {
  console.error('[watch-and-push] usage: watch-and-push.mjs <cart-name> <cart-file> <out-path>');
  process.exit(1);
}

const rootDir = path.resolve(import.meta.dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime');
const entryAbs = path.resolve(rootDir, cartFile);
const outAbs = path.resolve(rootDir, outPath);
const pushScript = path.join(import.meta.dirname, 'push-bundle.mjs');

// Virtualize `./current_app` → this session's cart entry. Avoids writing to
// a shared runtime/current_app.tsx file that other dev sessions might race on.
const cartEntryPlugin = {
  name: 'cart-entry',
  setup(b) {
    b.onResolve({ filter: /^\.\/current_app$/ }, () => ({ path: entryAbs }));
  },
};

const pushPlugin = {
  name: 'push-on-rebuild',
  setup(b) {
    b.onEnd(async (result) => {
      const ts = new Date().toLocaleTimeString();
      if (result.errors.length > 0) {
        console.error(`[dev ${ts}] rebuild FAILED (${result.errors.length} errors)`);
        return;
      }
      console.log(`[dev ${ts}] rebuilt — pushing '${cartName}'`);
      const child = spawn('node', [pushScript, cartName, outAbs], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code !== 0) console.error(`[dev ${ts}] push exit ${code}`);
      });
    });
  },
};

const ctx = await context({
  absWorkingDir: rootDir,
  entryPoints: [path.join(runtimeDir, 'index.tsx')],
  bundle: true,
  outfile: outAbs,
  format: 'iife',
  inject: [path.join(runtimeDir, 'jsx_shim.ts')],
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  alias: { '@reactjit/core': './runtime/core_stub.ts' },
  plugins: [cartEntryPlugin, pushPlugin],
});

await ctx.watch();
console.log(`[dev] watching ${cartFile} — edits rebuild + push automatically (ctrl-c to stop)`);
await new Promise(() => {});
