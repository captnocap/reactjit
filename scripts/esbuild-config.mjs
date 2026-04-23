// Shared esbuild config for cart bundling.
//
// Two entry points need the SAME esbuild configuration:
//   - scripts/internal/cart-bundle.mjs — one-shot builds (ship, dev startup).
//   - scripts/watch-and-push.mjs — watch-mode rebuilds (dev file saves).
//
// Previously each file carried its own copy of the config, and drift between
// them caused live bugs (e.g. the watcher kept jsxFactory: 'h' while the
// one-shot build moved to '__jsx', producing bundles that crashed on every
// save with "h is not defined"). Keeping a single source of truth here makes
// that class of bug unrepresentable.
//
// Factory is `__jsx`, not the short `h`: carts routinely write `const h = ...`
// (height, host, hours) inside JSX-returning functions; each such local would
// shadow a short factory identifier and crash at render as `hN is not a
// function`. `__jsx` is reserved-prefix-shaped and can't collide with anything
// a cart author writes.
//
// Classic JSX kept on purpose. `jsx: 'automatic'` would swap the runtime to
// `react/jsx-runtime` imports and defeat the direct-require workaround in
// runtime/jsx_shim.ts that sidesteps Hermes/JSRT's __toESM mishandling of the
// react default export.

import path from 'node:path';

/**
 * Build the shared esbuild options.
 *
 * @param {object} args
 * @param {string} args.rootDir        - Repo root (absolute).
 * @param {string} args.outfile        - Where to write the bundle (absolute).
 * @param {string} args.cartEntryAbs   - Absolute path to the cart's entry .tsx.
 *                                       This replaces `./current_app` so runtime/index.tsx
 *                                       can import the active cart without a shared file.
 * @param {object[]} [args.extraPlugins=[]] - Plugins to append to the shared pair.
 * @returns {import('esbuild').BuildOptions}
 */
export function cartEsbuildOptions({ rootDir, outfile, cartEntryAbs, extraPlugins = [] }) {
  const runtimeDir = path.join(rootDir, 'runtime');

  // Resolve `import App from './current_app'` in runtime/index.tsx directly to
  // the requested cart entry. Avoids the older racy fs.writeFile-a-shared-file
  // approach where two dev sessions would clobber each other's watcher.
  const cartEntryPlugin = {
    name: 'cart-entry',
    setup(b) {
      b.onResolve({ filter: /^\.\/current_app$/ }, () => ({ path: cartEntryAbs }));
    },
  };

  // framework/ambient.ts: every named export becomes a free-identifier candidate
  // esbuild injects on demand. A .tsx file referencing `Box`, `useState`, etc.
  // with no import gets the equivalent of a named import inserted at bundle time.
  //
  // framework/ambient_primitives.ts is split out to avoid a require cycle
  // (react/index.js body → init_ambient → init_primitives → require('react') →
  // partial {} → React3.memo undefined). Keep them as two separate injects.
  const ambientInject = path.join(rootDir, 'framework', 'ambient.ts');
  const ambientPrimitivesInject = path.join(rootDir, 'framework', 'ambient_primitives.ts');
  const jsxShimInject = path.join(runtimeDir, 'jsx_shim.ts');

  return {
    absWorkingDir: rootDir,
    entryPoints: [path.join(runtimeDir, 'index.tsx')],
    bundle: true,
    outfile,
    format: 'iife',
    inject: [jsxShimInject, ambientInject, ambientPrimitivesInject],
    jsxFactory: '__jsx',
    jsxFragment: 'Fragment',
    alias: { '@reactjit/core': './runtime/core_stub.ts' },
    external: ['path', 'typescript'],
    plugins: [cartEntryPlugin, ...extraPlugins],
  };
}
