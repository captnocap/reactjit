import { existsSync, mkdirSync, statSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { TARGETS, esbuildArgs } from '../targets.mjs';
import { getEsbuildAliases } from '../lib/aliases.mjs';
import { transpile } from '../lib/tsl.mjs';
import {
  bold, dim, cyan, green, yellow, red, magenta,
  boldCyan, boldGreen, boldRed, boldYellow, boldMagenta,
  banner, log, ok, warn, fail, info, elapsed,
} from '../lib/log.mjs';

/** Wait for outfile to exist and have a stable size. */
function waitForFile(filepath, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let lastSize = -1;
    const check = () => {
      if (Date.now() - start > timeout) { resolve(); return; }
      try {
        const size = statSync(filepath).size;
        if (size > 0 && size === lastSize) { resolve(); return; }
        lastSize = size;
      } catch {}
      setTimeout(check, 30);
    };
    check();
  });
}

function parseOverlayArgs(args) {
  const opts = { hotkey: 'f6', opacity: '0.9', mode: 'passthrough', attach: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hotkey' && args[i + 1]) { opts.hotkey = args[++i]; }
    else if (args[i] === '--opacity' && args[i + 1]) { opts.opacity = args[++i]; }
    else if (args[i] === '--mode' && args[i + 1]) { opts.mode = args[++i]; }
    else if (args[i] === '--attach') {
      // Everything after --attach is the game command
      opts.attach = args.slice(i + 1).join(' ');
      break;
    }
  }
  return opts;
}

/** Find the overlay hook .so — checks zig-out first, then cli/runtime/lib */
function findOverlayHook() {
  const candidates = [
    join(process.cwd(), 'zig-out', 'lib', 'liboverlay_hook.so'),
    join(dirname(new URL(import.meta.url).pathname), '..', 'runtime', 'lib', 'liboverlay_hook.so'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function overlayCommand(args) {
  const cwd = process.cwd();
  const opts = parseOverlayArgs(args);

  // --attach mode: fullscreen overlay via LD_PRELOAD + shared memory
  if (opts.attach) {
    return attachOverlay(cwd, opts);
  }

  // Default: transparent window overlay
  return windowOverlay(cwd, opts);
}

/** Transparent window overlay (Phase 1) — borderless, always-on-top, X11 passthrough */
async function windowOverlay(cwd, opts) {
  const target = TARGETS['love'];

  const entryCandidates = target.entries.map(e => join(cwd, 'src', e));
  const entry = entryCandidates.find(p => existsSync(p));

  if (!entry) {
    const names = target.entries.map(e => cyan(`src/${e}`)).join(dim(', '));
    fail(`No entry point found. Looked for: ${names}`);
    console.error(`  Are you in a ReactJIT project directory?`);
    process.exit(1);
  }

  const outfile = join(cwd, target.output);
  const outdir = dirname(outfile);
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

  // TSL pre-build
  const tslResult = transpileTslInSrc(cwd);
  if (tslResult.errors > 0) {
    fail(`${tslResult.errors} TSL error(s) — fix before continuing.`);
    process.exit(1);
  }
  if (tslResult.transpiled > 0) {
    ok(`TSL: ${bold(String(tslResult.transpiled))} file(s) transpiled to ${cyan('lua/')}`);
  }

  // Banner
  banner('overlay', [
    `Mode: ${boldCyan(opts.mode)}`,
    `Hotkey: ${boldGreen(opts.hotkey.toUpperCase())} ${dim('(cycle: passthrough → interactive → hidden)')}`,
    `Opacity: ${bold(opts.opacity)}`,
  ].join('  '));

  let runtimeProcess = null;
  let isShuttingDown = false;
  let runtimeHasLaunched = false;
  let buildCount = 0;
  let buildStart = Date.now();

  const loveDir = existsSync(join(cwd, 'love', 'main.lua')) ? 'love' : '.';

  const overlayEnv = {
    ...process.env,
    REACTJIT_OVERLAY: '1',
    REACTJIT_OVERLAY_HOTKEY: opts.hotkey,
    REACTJIT_OVERLAY_OPACITY: opts.opacity,
    REACTJIT_OVERLAY_MODE: opts.mode,
  };

  const launchRuntime = () => {
    if (runtimeHasLaunched || isShuttingDown) return;
    runtimeHasLaunched = true;

    log(magenta('>>'), `Launching ${boldCyan('Love2D')} in ${boldMagenta('overlay')} mode...`);
    runtimeProcess = spawn('love', [loveDir], { cwd, env: overlayEnv, stdio: 'inherit' });

    runtimeProcess.on('exit', (code) => {
      runtimeProcess = null;
      if (!isShuttingDown && code !== null && code !== 0) {
        fail(`Runtime exited with code ${boldRed(String(code))}`);
      }
    });
  };

  // esbuild output handler
  const onEsbuildOutput = (data) => {
    const output = data.toString();
    if (output.includes('build finished')) {
      buildCount++;
      const dt = elapsed(buildStart);
      if (buildCount === 1) {
        ok(`Initial build complete ${dt}`);
      } else {
        ok(`Rebuild ${dim('#' + buildCount)} complete ${dt}`);
      }
      buildStart = Date.now();
      waitForFile(outfile).then(launchRuntime);
    } else if (output.includes('[ERROR]') || output.includes('error:')) {
      process.stderr.write(`  ${red(output)}`);
    } else if (output.includes('[WARNING]') || output.includes('warning:')) {
      process.stderr.write(`  ${yellow(output)}`);
    }
  };

  // Spawn esbuild
  info(`Starting ${bold('esbuild')} watch... ${dim(`→ ${target.output}`)}`);
  buildStart = Date.now();

  const esbuild = spawn('npx', [
    'esbuild',
    ...esbuildArgs(target, { dev: true }),
    `--outfile=${outfile}`,
    '--watch',
    ...getEsbuildAliases(cwd),
    entry,
  ], { cwd, stdio: 'pipe' });

  esbuild.stdout.on('data', onEsbuildOutput);
  esbuild.stderr.on('data', onEsbuildOutput);

  // Cleanup
  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('');
    log(dim('Shutting down overlay...'));
    if (runtimeProcess) { runtimeProcess.kill(); runtimeProcess = null; }
    esbuild.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await new Promise((resolve) => { esbuild.on('exit', resolve); });
}

/** Fullscreen overlay (Phase 2) — LD_PRELOAD + shared memory */
async function attachOverlay(cwd, opts) {
  const target = TARGETS['love'];

  const entryCandidates = target.entries.map(e => join(cwd, 'src', e));
  const entry = entryCandidates.find(p => existsSync(p));

  if (!entry) {
    const names = target.entries.map(e => cyan(`src/${e}`)).join(dim(', '));
    fail(`No entry point found. Looked for: ${names}`);
    console.error(`  Are you in a ReactJIT project directory?`);
    process.exit(1);
  }

  if (!opts.attach) {
    fail('--attach requires a game command (e.g. --attach ./my-game)');
    process.exit(1);
  }

  // Find the overlay hook .so
  const hookPath = findOverlayHook();
  if (!hookPath) {
    fail('liboverlay_hook.so not found.');
    console.error(`  Build it with: ${cyan('zig build overlay-hook')}`);
    console.error(`  Or run: ${cyan('make cli-setup')} to bundle it.`);
    process.exit(1);
  }

  const outfile = join(cwd, target.output);
  const outdir = dirname(outfile);
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

  // TSL pre-build
  const tslResult = transpileTslInSrc(cwd);
  if (tslResult.errors > 0) {
    fail(`${tslResult.errors} TSL error(s) — fix before continuing.`);
    process.exit(1);
  }
  if (tslResult.transpiled > 0) {
    ok(`TSL: ${bold(String(tslResult.transpiled))} file(s) transpiled to ${cyan('lua/')}`);
  }

  // Banner
  banner('overlay --attach', [
    `Game: ${boldCyan(opts.attach)}`,
    `Hook: ${dim(hookPath)}`,
    `Hotkey: ${boldGreen(opts.hotkey.toUpperCase())}`,
  ].join('  '));

  // Step 1: Build the bundle (one-shot, no watch needed for attach mode)
  info(`Building bundle... ${dim(`→ ${target.output}`)}`);

  const esbuild = spawn('npx', [
    'esbuild',
    ...esbuildArgs(target, { dev: true }),
    `--outfile=${outfile}`,
    ...getEsbuildAliases(cwd),
    entry,
  ], { cwd, stdio: 'pipe' });

  let buildOutput = '';
  esbuild.stdout.on('data', d => { buildOutput += d.toString(); });
  esbuild.stderr.on('data', d => { buildOutput += d.toString(); });

  await new Promise((resolve) => { esbuild.on('exit', resolve); });

  if (buildOutput.includes('[ERROR]') || buildOutput.includes('error:')) {
    fail('Build failed:');
    process.stderr.write(red(buildOutput));
    process.exit(1);
  }
  ok('Bundle built');

  // Step 2: Launch Love2D in shm mode, wait for RJIT_SHM_READY
  const loveDir = existsSync(join(cwd, 'love', 'main.lua')) ? 'love' : '.';

  const overlayEnv = {
    ...process.env,
    REACTJIT_OVERLAY: '1',
    REACTJIT_OVERLAY_SHM: '1',
    REACTJIT_OVERLAY_HOTKEY: opts.hotkey,
    REACTJIT_OVERLAY_OPACITY: opts.opacity,
    REACTJIT_OVERLAY_MODE: opts.mode,
  };

  info(`Launching ${boldCyan('Love2D')} in ${boldMagenta('shm')} overlay mode...`);

  let runtimeProcess = null;
  let gameProcess = null;
  let isShuttingDown = false;

  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('');
    log(dim('Shutting down overlay + game...'));
    if (gameProcess) { gameProcess.kill(); gameProcess = null; }
    if (runtimeProcess) { runtimeProcess.kill(); runtimeProcess = null; }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  runtimeProcess = spawn('love', [loveDir], {
    cwd,
    env: overlayEnv,
    stdio: ['inherit', 'pipe', 'inherit'],
  });

  runtimeProcess.on('exit', (code) => {
    runtimeProcess = null;
    if (!isShuttingDown) {
      if (code !== null && code !== 0) {
        fail(`Love2D exited with code ${boldRed(String(code))}`);
      }
      cleanup();
    }
  });

  // Wait for RJIT_SHM_READY:<name> on stdout
  const shmName = await new Promise((resolve, reject) => {
    let buf = '';
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for shm segment (10s)'));
    }, 10000);

    runtimeProcess.stdout.on('data', (data) => {
      const str = data.toString();
      // Pass through to console
      process.stdout.write(str);
      buf += str;
      const match = buf.match(/RJIT_SHM_READY:(\S+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
  }).catch((err) => {
    fail(err.message);
    cleanup();
    process.exit(1);
  });

  ok(`Shared memory ready: ${boldCyan(shmName)}`);

  // Step 3: Launch the game with LD_PRELOAD
  info(`Launching game: ${boldCyan(opts.attach)}`);

  const gameEnv = {
    ...process.env,
    LD_PRELOAD: hookPath,
    RJIT_OVERLAY_SHM: shmName,
  };

  // Split the game command for spawn
  const gameParts = opts.attach.split(/\s+/);
  const gameCmd = gameParts[0];
  const gameArgs = gameParts.slice(1);

  gameProcess = spawn(gameCmd, gameArgs, {
    cwd,
    env: gameEnv,
    stdio: 'inherit',
  });

  gameProcess.on('exit', (code) => {
    gameProcess = null;
    if (!isShuttingDown) {
      if (code !== null && code !== 0) {
        warn(`Game exited with code ${boldYellow(String(code))}`);
      } else {
        ok('Game exited normally');
      }
      cleanup();
    }
  });

  // Keep alive until one of the processes exits
  await new Promise(() => {});
}

// ── TSL helpers (shared with dev.mjs) ──────────────────────────────────────

function findTslFiles(dir) {
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsl')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function transpileTslInSrc(cwd) {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) return { transpiled: 0, errors: 0 };
  const files = findTslFiles(srcDir);
  let transpiled = 0, errors = 0;
  for (const f of files) {
    const rel = f.slice(srcDir.length + 1);
    const outPath = join(cwd, 'lua', rel.replace(/\.tsl$/, '.lua'));
    try {
      const lua = transpile(readFileSync(f, 'utf-8'), f);
      const outDir = dirname(outPath);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(outPath, lua);
      transpiled++;
    } catch (err) {
      fail(`TSL error in ${cyan(rel)}: ${err.message}`);
      errors++;
    }
  }
  return { transpiled, errors };
}
