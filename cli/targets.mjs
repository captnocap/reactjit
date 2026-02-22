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

// ── Cross-compilation platform registry ────────────────────────────────
// Maps user-facing CLI names to zig triples and platform metadata.
// Used by `reactjit build dist:sdl2 --target <name>`.

export const PLATFORMS = {
  'linux-x64':   { zigTriple: 'x86_64-linux-gnu',   os: 'linux',   arch: 'x64',   ext: '.so',    exeExt: '',     luajitBin: 'luajit' },
  'linux-arm64': { zigTriple: 'aarch64-linux-gnu',   os: 'linux',   arch: 'arm64', ext: '.so',    exeExt: '',     luajitBin: 'luajit' },
  'windows-x64': { zigTriple: 'x86_64-windows-gnu',  os: 'windows', arch: 'x64',   ext: '.dll',   exeExt: '.exe', luajitBin: 'luajit.exe' },
  'macos-x64':   { zigTriple: 'x86_64-macos',        os: 'macos',   arch: 'x64',   ext: '.dylib', exeExt: '',     luajitBin: 'luajit' },
  'macos-arm64': { zigTriple: 'aarch64-macos',        os: 'macos',   arch: 'arm64', ext: '.dylib', exeExt: '',     luajitBin: 'luajit' },
};

export const PLATFORM_NAMES = Object.keys(PLATFORMS);

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
