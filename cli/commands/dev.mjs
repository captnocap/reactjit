import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { TARGETS, TARGET_NAMES, esbuildArgs } from '../targets.mjs';
import { getEsbuildAliases } from '../lib/aliases.mjs';

export async function devCommand(args) {
  const cwd = process.cwd();
  const targetName = args.filter(a => !a.startsWith('--'))[0] || 'sdl2';

  if (!TARGETS[targetName]) {
    console.error(`Unknown target: ${targetName}`);
    console.error(`Available targets: ${TARGET_NAMES.join(', ')}`);
    process.exit(1);
  }

  const target = TARGETS[targetName];
  const entryCandidates = target.entries.map(e => join(cwd, 'src', e));
  const entry = entryCandidates.find(p => existsSync(p));

  if (!entry) {
    const names = target.entries.map(e => `src/${e}`).join(', ');
    console.error(`No entry point found. Looked for: ${names}`);
    console.error('Are you in an ReactJIT project directory?');
    process.exit(1);
  }

  const outfile = join(cwd, target.output);
  const outdir = dirname(outfile);
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

  const hints = {
    love: 'Love2D will launch once. HMR reloads in-place on rebuild.',
    terminal: 'The terminal app will auto-reload on save.',
    web: 'Serve dist/ with any HTTP server to see your app.',
    sdl2: 'Bundle → sdl2/bundle.js. Run: luajit sdl2/main.lua (or luajit storybook/sdl2/main.lua from repo root).',
  };
  const hint = hints[targetName] || `Output: ${target.output}`;

  console.log(`
  ReactJIT dev mode [${targetName}]
  Watching for changes...
  ${hint}
`);

  let runtimeProcess = null;
  let isShuttingDown = false;
  let runtimeHasLaunched = false;

  // Determine Love2D directory (some projects use love/ subdirectory)
  const loveDir = existsSync(join(cwd, 'love', 'main.lua')) ? 'love' : '.';

  // Determine SDL2 entry point
  const sdl2Main = existsSync(join(cwd, 'sdl2', 'main.lua')) ? join('sdl2', 'main.lua') : null;

  const launchRuntime = () => {
    if (runtimeHasLaunched || isShuttingDown) return;
    runtimeHasLaunched = true;

    if (targetName === 'love') {
      console.log('[rjit] Launching Love2D...');
      runtimeProcess = spawn('love', [loveDir], { cwd, stdio: 'inherit' });
    } else if (targetName === 'sdl2' && sdl2Main) {
      console.log('[rjit] Launching SDL2 (luajit)...');
      runtimeProcess = spawn('luajit', [sdl2Main], { cwd, stdio: 'inherit' });
    } else {
      return;
    }

    runtimeProcess.on('exit', (code) => {
      runtimeProcess = null;
      if (!isShuttingDown && code !== null && code !== 0) {
        console.error(`\nRuntime exited with code ${code}`);
      }
    });
  };

  // Detect build completion from esbuild output (watch messages go to stderr)
  const onEsbuildOutput = (data) => {
    const output = data.toString();
    if ((targetName === 'love' || targetName === 'sdl2') && output.includes('build finished')) {
      console.log('[rjit] Build complete.');
      // Launch runtime only on the first build — Lua HMR handles subsequent reloads
      launchRuntime();
    }
  };

  // Spawn esbuild watch process
  const esbuild = spawn('npx', [
    'esbuild',
    ...esbuildArgs(target),
    `--outfile=${outfile}`,
    '--watch',
    ...getEsbuildAliases(cwd),
    entry,
  ], { cwd, stdio: 'pipe' });

  esbuild.stdout.on('data', (data) => {
    process.stdout.write(data);
    onEsbuildOutput(data);
  });

  esbuild.stderr.on('data', (data) => {
    process.stderr.write(data);
    onEsbuildOutput(data);
  });

  // Cleanup handler
  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (runtimeProcess) {
      runtimeProcess.kill();
      runtimeProcess = null;
    }

    esbuild.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for esbuild to exit
  await new Promise((resolve) => {
    esbuild.on('exit', resolve);
  });
}
