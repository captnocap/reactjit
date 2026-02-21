/**
 * Target config registry — single source of truth for esbuild flags per target.
 *
 * Each target defines:
 *   format     – esbuild --format (iife | esm)
 *   platform   – esbuild --platform (omit for browser/universal)
 *   globalName – esbuild --global-name (IIFE targets only)
 *   external   – esbuild --external:X packages
 *   entries    – entry point candidates in priority order (resolved under src/)
 *   output     – dev build output path (relative to project root)
 *   kind       – 'sdl2' | 'love' (determines dist strategy)
 */

export const TARGETS = {
  sdl2: {
    format: 'iife',
    globalName: 'ReactJIT',
    external: ['react-dom', 'child_process'],
    entries: ['main-sdl2.tsx', 'main-love.tsx', 'native-main.tsx', 'main.tsx'],
    output: 'sdl2/bundle.js',
    kind: 'sdl2',
  },
  love: {
    format: 'iife',
    globalName: 'ReactJIT',
    external: ['react-dom', 'child_process'],
    entries: ['main-love.tsx', 'native-main.tsx', 'main.tsx'],
    output: 'love/bundle.js',
    kind: 'love',
  },
};

export const TARGET_NAMES = Object.keys(TARGETS);

/**
 * Build the esbuild CLI args array for a given target config.
 * Does NOT include entry point or --outfile (caller adds those).
 */
export function esbuildArgs(target) {
  const args = [
    '--bundle',
    `--format=${target.format}`,
    '--target=es2020',
    '--jsx=automatic',
  ];
  if (target.globalName) args.push(`--global-name=${target.globalName}`);
  if (target.platform) args.push(`--platform=${target.platform}`);
  if (target.external) {
    for (const ext of target.external) args.push(`--external:${ext}`);
  }
  return args;
}
