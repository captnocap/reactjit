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
  native: '@reactjit/native',
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
};

/**
 * Generate esbuild --alias flags for packages that exist in reactjit/
 * @param {string} cwd - Project root directory
 * @returns {string[]} Array of --alias:@reactjit/pkg=<path>/src flags
 */
export function getEsbuildAliases(cwd) {
  const flags = [];
  for (const [dir, alias] of Object.entries(ALIAS_MAP)) {
    // In a monorepo, prefer the source-of-truth packages/ over local copies.
    // This prevents duplicate module instances when source files also use
    // relative imports to packages/ (e.g. ../../packages/core/src).
    const monorepoSrc = join(cwd, '..', 'packages', dir, 'src');
    if (existsSync(monorepoSrc)) {
      flags.push(`--alias:${alias}=../packages/${dir}/src`);
      continue;
    }

    // Standalone project: use the local copy synced by `reactjit update`
    const pkg = join(cwd, 'reactjit', dir, 'src');
    if (existsSync(pkg)) {
      flags.push(`--alias:${alias}=./reactjit/${dir}/src`);
    }
  }
  return flags;
}
