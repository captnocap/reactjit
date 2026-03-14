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
 *   kind       – 'love' | 'web' (determines dist strategy)
 */

export const TARGETS = {
  love: {
    format: 'iife',
    globalName: 'ReactJIT',
    external: ['react-dom', 'child_process', 'node:sqlite'],
    entries: ['main-love.tsx', 'main.tsx'],
    output: 'love/bundle.js',
    kind: 'love',
  },
  web: {
    format: 'iife',
    globalName: 'ReactJIT',
    external: ['child_process'],
    entries: ['main-wasm.tsx', 'main-web.tsx'],
    output: 'web/bundle.js',
    kind: 'web',
  },
};

export const TARGET_NAMES = Object.keys(TARGETS);

// ── Cross-compilation platform registry ────────────────────────────────
// Maps user-facing CLI names to platform metadata.
// Used by `reactjit build linux`, `reactjit build macos`, etc.

export const PLATFORMS = {
  'linux-x64':   { os: 'linux',   arch: 'x64',   ext: '.so',    exeExt: '' },
  'linux-arm64': { os: 'linux',   arch: 'arm64', ext: '.so',    exeExt: '' },
  'windows-x64': { os: 'windows', arch: 'x64',   ext: '.dll',   exeExt: '.exe' },
  'macos-x64':   { os: 'macos',   arch: 'x64',   ext: '.dylib', exeExt: '' },
  'macos-arm64': { os: 'macos',   arch: 'arm64', ext: '.dylib', exeExt: '' },
};

export const PLATFORM_NAMES = Object.keys(PLATFORMS);

// ── Friendly build aliases ───────────────────────────────────────────────
// Maps short names (rjit build linux) to dist:love + platform combos.

export const BUILD_ALIASES = {
  'linux':      { target: 'love', platform: 'linux-x64',   dist: true },
  'macos':      { target: 'love', platform: 'macos-x64',   dist: true },
  'macmseries': { target: 'love', platform: 'macos-arm64',  dist: true },
  'windows':    { target: 'love', platform: 'windows-x64',  dist: true },
  'web':        { target: 'web',  platform: null,            dist: true },
};

/** Detect the host platform as a PLATFORMS key. */
export function detectHostPlatform() {
  const { platform, arch } = process;
  if (platform === 'linux'  && arch === 'x64')   return 'linux-x64';
  if (platform === 'linux'  && arch === 'arm64') return 'linux-arm64';
  if (platform === 'win32'  && arch === 'x64')   return 'windows-x64';
  if (platform === 'darwin' && arch === 'x64')   return 'macos-x64';
  if (platform === 'darwin' && arch === 'arm64') return 'macos-arm64';
  return null; // unsupported host
}

/**
 * Build the esbuild CLI args array for a given target config.
 * Does NOT include entry point or --outfile (caller adds those).
 *
 * @param {object} target - Target config from TARGETS registry
 * @param {object} [opts] - Optional flags
 * @param {boolean} [opts.dev] - Use JSX dev runtime (populates _debugSource on fibers)
 */
export function esbuildArgs(target, opts) {
  const isDev = opts && opts.dev;
  const args = [
    '--bundle',
    `--format=${target.format}`,
    '--target=es2020',
    '--jsx=automatic',
    ...(isDev ? ['--jsx-dev'] : []),
  ];
  if (target.globalName) args.push(`--global-name=${target.globalName}`);
  if (target.platform) args.push(`--platform=${target.platform}`);
  if (target.external) {
    for (const ext of target.external) args.push(`--external:${ext}`);
  }
  return args;
}
