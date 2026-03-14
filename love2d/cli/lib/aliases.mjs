/**
 * aliases.mjs — Shared esbuild alias resolution for @reactjit/* imports
 *
 * Auto-detects which packages exist in reactjit/ and generates --alias flags.
 * Used by both build.mjs and dev.mjs to keep alias logic DRY.
 *
 * Monorepo awareness: When building inside the monorepo (e.g. storybook/),
 * aliases resolve to the source-of-truth packages/ instead of local copies.
 * This prevents duplicate module instances when source files also use relative
 * imports to packages/ (the classic dual-context bug).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const ALIAS_MAP = {
  core: '@reactjit/core',
  renderer: '@reactjit/renderer',
  router: '@reactjit/router',
  storage: '@reactjit/storage',
  audio: '@reactjit/audio',
  server: '@reactjit/server',
  ai: '@reactjit/ai',
  geo: '@reactjit/geo',
  theme: '@reactjit/theme',
  '3d': '@reactjit/3d',
  controls: '@reactjit/controls',
  media: '@reactjit/media',
  crypto: '@reactjit/crypto',
  rss: '@reactjit/rss',
  webhooks: '@reactjit/webhooks',
  apis: '@reactjit/apis',
  icons: '@reactjit/icons',
  layouts: '@reactjit/layouts',
  presentation: '@reactjit/presentation',
  terminal: '@reactjit/terminal',
  math: '@reactjit/math',
  convert: '@reactjit/convert',
  time: '@reactjit/time',
  privacy: '@reactjit/privacy',
  wireguard: '@reactjit/wireguard',
  data: '@reactjit/data',
  gradio: '@reactjit/gradio',
  networking: '@reactjit/networking',
};

/**
 * Generate esbuild --alias flags for packages that exist in reactjit/
 * @param {string} cwd - Project root directory
 * @returns {string[]} Array of --alias:@reactjit/pkg=<path>/src flags
 */
/**
 * Walk up from cwd to find the monorepo root (has packages/ directory).
 * Returns the relative path prefix (e.g. '../' or '../../') or null.
 */
function findMonorepoPrefix(cwd) {
  const prefixes = ['..', '../..', '../../..'];
  for (const prefix of prefixes) {
    const candidate = join(cwd, prefix, 'packages', 'core', 'src');
    if (existsSync(candidate)) return prefix;
  }
  return null;
}

export function getEsbuildAliases(cwd) {
  const flags = [];
  const monorepoPrefix = findMonorepoPrefix(cwd);

  // In a monorepo, pin react to the root node_modules so all packages
  // (including @reactjit/* resolved from packages/) share one React instance.
  // Without this, local node_modules/react and root node_modules/react both
  // get bundled, causing "Invalid hook call" crashes.
  if (monorepoPrefix) {
    const rootReact = join(cwd, monorepoPrefix, 'node_modules', 'react');
    if (existsSync(rootReact)) {
      flags.push(`--alias:react=${monorepoPrefix}/node_modules/react`);
    }
  }

  for (const [dir, alias] of Object.entries(ALIAS_MAP)) {
    // In a monorepo, prefer the source-of-truth packages/ over local copies.
    // This prevents duplicate module instances when source files also use
    // relative imports to packages/ (e.g. ../../packages/core/src).
    if (monorepoPrefix) {
      const monorepoSrc = join(cwd, monorepoPrefix, 'packages', dir, 'src');
      if (existsSync(monorepoSrc)) {
        flags.push(`--alias:${alias}=${monorepoPrefix}/packages/${dir}/src`);
        continue;
      }
    }

    // Standalone project: use the local copy synced by `reactjit update`
    const pkg = join(cwd, 'reactjit', dir, 'src');
    if (existsSync(pkg)) {
      flags.push(`--alias:${alias}=./reactjit/${dir}/src`);
    }
  }
  return flags;
}
