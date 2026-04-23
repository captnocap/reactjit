#!/usr/bin/env node
// watch-and-push — run esbuild in watch mode, pushing each rebuild to the
// reactjit dev host over /tmp/reactjit.sock.
//
// Usage: node scripts/watch-and-push.mjs <cart-name> <cart-file> <out-path>
//
// The esbuild config comes from scripts/esbuild-config.mjs — same module
// scripts/internal/cart-bundle.mjs uses — so the startup bundle and every
// watcher-pushed rebuild share identical options. Previously each script
// carried its own copy; drift between them caused live bugs (factory name
// mismatches, missing injects, etc.). This file only adds the push-on-rebuild
// plugin on top.

import { context } from 'esbuild';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { cartEsbuildOptions } from './esbuild-config.mjs';

const [cartName, cartFile, outPath] = process.argv.slice(2);
if (!cartName || !cartFile || !outPath) {
  console.error('[watch-and-push] usage: watch-and-push.mjs <cart-name> <cart-file> <out-path>');
  process.exit(1);
}

const rootDir = path.resolve(import.meta.dirname, '..');
const entryAbs = path.resolve(rootDir, cartFile);
const outAbs = path.resolve(rootDir, outPath);
const pushScript = path.join(import.meta.dirname, 'push-bundle.mjs');

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

const ctx = await context(cartEsbuildOptions({
  rootDir,
  outfile: outAbs,
  cartEntryAbs: entryAbs,
  extraPlugins: [pushPlugin],
}));

await ctx.watch();
console.log(`[dev] watching ${cartFile} — edits rebuild + push automatically (ctrl-c to stop)`);
await new Promise(() => {});
