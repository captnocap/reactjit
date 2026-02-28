import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { TARGETS, TARGET_NAMES, esbuildArgs } from '../targets.mjs';
import { getEsbuildAliases } from '../lib/aliases.mjs';
import { transpile } from '../lib/tsl.mjs';
import {
  bold, dim, cyan, green, yellow, red, magenta,
  boldCyan, boldGreen, boldRed, boldYellow, boldMagenta,
  banner, log, ok, warn, fail, info, elapsed,
} from '../lib/log.mjs';

export async function devCommand(args) {
  const cwd = process.cwd();
  const targetName = args.filter(a => !a.startsWith('--'))[0] || 'love';

  if (!TARGETS[targetName]) {
    fail(`Unknown target: ${bold(targetName)}`);
    console.error(`  Available targets: ${TARGET_NAMES.map(t => cyan(t)).join(dim(', '))}`);
    process.exit(1);
  }

  const target = TARGETS[targetName];
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

  // ── TSL pre-build ───────────────────────────────────────
  if (targetName === 'love') {
    const tslResult = transpileTslInSrc(cwd);
    if (tslResult.errors > 0) {
      fail(`${tslResult.errors} TSL error(s) — fix before continuing.`);
      process.exit(1);
    }
    if (tslResult.transpiled > 0) {
      ok(`TSL: ${bold(String(tslResult.transpiled))} file(s) transpiled to ${cyan('lua/')}`);
    }
    watchTslFiles(cwd);
  }

  // ── Startup banner ──────────────────────────────────────

  const targetLabel = {
    love: `${bold('Love2D')} ${dim('— HMR reloads in-place on rebuild')}`,
    web: `${bold('Web')}  ${dim('— serve dist/ with any HTTP server')}`,
  }[targetName] || bold(targetName);

  banner(`dev ${boldCyan(targetName)}`, `Watching for changes...  ${targetLabel}`);

  let runtimeProcess = null;
  let isShuttingDown = false;
  let runtimeHasLaunched = false;
  let buildCount = 0;
  let buildStart = Date.now();

  // Determine Love2D directory (some projects use love/ subdirectory)
  const loveDir = existsSync(join(cwd, 'love', 'main.lua')) ? 'love' : '.';

  const launchRuntime = () => {
    if (runtimeHasLaunched || isShuttingDown) return;
    runtimeHasLaunched = true;

    if (targetName === 'love') {
      log(magenta('>>'), `Launching ${boldCyan('Love2D')}...`);
      runtimeProcess = spawn('love', [loveDir], { cwd, stdio: 'inherit' });
    } else {
      return;
    }

    runtimeProcess.on('exit', (code) => {
      runtimeProcess = null;
      if (!isShuttingDown && code !== null && code !== 0) {
        fail(`Runtime exited with code ${boldRed(String(code))}`);
      }
    });
  };

  // ── esbuild output handler ─────────────────────────────
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

      if (targetName === 'love') {
        launchRuntime();
      }
    } else if (output.includes('[ERROR]') || output.includes('error:')) {
      // Let esbuild errors through with red highlighting
      process.stderr.write(`  ${red(output)}`);
      return;
    } else if (output.includes('[WARNING]') || output.includes('warning:')) {
      process.stderr.write(`  ${yellow(output)}`);
      return;
    }
  };

  // ── Spawn esbuild ──────────────────────────────────────
  info(`Starting ${bold('esbuild')} watch... ${dim(`→ ${target.output}`)}`);
  buildStart = Date.now();

  const esbuild = spawn('npx', [
    'esbuild',
    ...esbuildArgs(target),
    `--outfile=${outfile}`,
    '--watch',
    ...getEsbuildAliases(cwd),
    entry,
  ], { cwd, stdio: 'pipe' });

  esbuild.stdout.on('data', (data) => {
    onEsbuildOutput(data);
  });

  esbuild.stderr.on('data', (data) => {
    onEsbuildOutput(data);
  });

  // ── Cleanup ────────────────────────────────────────────
  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('');
    log(dim('Shutting down...'));

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

// ── TSL helpers ───────────────────────────────────────────

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

function watchTslFiles(cwd) {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) return;
  try {
    watch(srcDir, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.tsl')) return;
      const fullPath = join(srcDir, filename);
      if (!existsSync(fullPath)) return;
      const outPath = join(cwd, 'lua', filename.replace(/\.tsl$/, '.lua'));
      try {
        const lua = transpile(readFileSync(fullPath, 'utf-8'), fullPath);
        const outDir = dirname(outPath);
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        writeFileSync(outPath, lua);
        ok(`TSL: ${cyan(filename)} → ${cyan('lua/' + filename.replace(/\.tsl$/, '.lua'))}`);
      } catch (err) {
        fail(`TSL error in ${cyan(filename)}: ${err.message}`);
      }
    });
  } catch {
    // fs.watch recursive not supported on all platforms — fall back to initial transpile only
  }
}
