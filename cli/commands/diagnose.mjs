import { existsSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TARGETS } from '../targets.mjs';
import { getEsbuildAliases } from '../lib/aliases.mjs';
import { runLint } from './lint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

export async function diagnoseCommand(args) {
  const cwd = process.cwd();
  const projectName = basename(cwd);

  console.log(`\n  reactjit diagnose\n`);

  // 1. Lint check
  console.log('  [1/3] Linting...');
  const { errors } = await runLint(cwd, { silent: false });
  if (errors > 0) {
    console.error(`\n  Diagnose blocked: ${errors} lint error${errors !== 1 ? 's' : ''} must be fixed first.\n`);
    process.exit(1);
  }

  // 2. Build SDL2 bundle
  console.log('  [2/3] Bundling (sdl2)...');
  const target = TARGETS.sdl2;
  const entry = findEntry(cwd, ...target.entries.map(e => `src/${e}`));
  const outfile = join(cwd, target.output);
  const outdir = dirname(outfile);
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

  const aliasFlags = [];
  const aliases = getEsbuildAliases(cwd);
  for (const [from, to] of Object.entries(aliases)) {
    aliasFlags.push(`--alias:${from}=${to}`);
  }

  execSync([
    'npx', 'esbuild',
    '--bundle',
    `--format=${target.format}`,
    `--global-name=${target.globalName}`,
    '--target=es2020',
    '--jsx=automatic',
    `--outfile=${outfile}`,
    ...aliasFlags,
    entry,
  ].join(' '), { cwd, stdio: 'inherit' });

  // 3. Launch LuaJIT with diagnostic env var
  console.log('  [3/3] Running ghost node diagnostic...\n');

  const sdl2Main = findSdl2Main(cwd);
  if (!sdl2Main) {
    console.error('  No SDL2 entry point found (sdl2/main.lua or lua/sdl2_init.lua).');
    console.error('  Diagnose requires the SDL2 target.\n');
    process.exit(1);
  }

  const env = {
    ...process.env,
    ILOVEREACT_DIAGNOSE: '1',
  };

  // Detect xvfb-run for headless operation
  let useXvfb = false;
  try {
    execSync('which xvfb-run', { stdio: 'pipe' });
    useXvfb = true;
  } catch { /* not available */ }

  const cmd = useXvfb
    ? ['xvfb-run', '-a', 'luajit', sdl2Main]
    : ['luajit', sdl2Main];

  return new Promise((resolveP) => {
    const proc = spawn(cmd[0], cmd.slice(1), {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let diagLines = [];

    proc.on('error', (err) => {
      console.error(`  Failed to launch: ${cmd[0]}`);
      if (err.code === 'ENOENT') {
        console.error('  luajit not found in PATH. Install LuaJIT first.');
      } else {
        console.error(`  ${err.message}`);
      }
      console.error('');
      process.exit(1);
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout: 20 seconds
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      console.error('  Diagnostic timed out after 20 seconds.');
      console.error('  This usually means the SDL2 runtime failed to initialize.\n');
      if (stderr) console.error('  stderr:', stderr.trim());
      process.exit(1);
    }, 20000);

    proc.on('close', (code) => {
      clearTimeout(timeout);

      // Parse GHOST_DIAG lines from stdout
      const lines = stdout.split('\n');
      let inDiag = false;
      let summary = null;
      const ghostNodes = [];
      const infoNodes = [];

      for (const line of lines) {
        if (line === 'GHOST_DIAG:START') { inDiag = true; continue; }
        if (line === 'GHOST_DIAG:END') { inDiag = false; continue; }
        if (!inDiag) continue;

        if (line.startsWith('GHOST_DIAG:SUMMARY ')) {
          const parts = line.slice('GHOST_DIAG:SUMMARY '.length).split(' ');
          summary = {};
          for (const p of parts) {
            const [k, v] = p.split('=');
            summary[k] = parseInt(v, 10);
          }
        } else if (line.startsWith('GHOST_DIAG:NODE ')) {
          const entry = parseNodeLine(line.slice('GHOST_DIAG:NODE '.length));
          if (entry) {
            if (entry.status === 'non-visual-cap' || entry.status === 'own-surface') {
              infoNodes.push(entry);
            } else {
              ghostNodes.push(entry);
            }
          }
        }
      }

      if (!summary) {
        console.error('  No diagnostic output received from the runtime.');
        if (stderr) console.error('  stderr:', stderr.trim());
        console.error('');
        process.exit(1);
      }

      // Print formatted results
      printResults(summary, ghostNodes, infoNodes);
      resolveP();
    });
  });
}

function parseNodeLine(str) {
  const result = {};
  // Parse key=value pairs (values may not contain spaces)
  const regex = /(\w+)=([^\s]+)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    result[match[1]] = match[2];
  }
  return result.id ? result : null;
}

function printResults(summary, ghostNodes, infoNodes) {
  const { total, painted, ghost, info } = summary;

  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │          Ghost Node Diagnostic          │');
  console.log('  ├─────────────────────────────────────────┤');
  console.log(`  │  Total nodes:     ${String(total).padStart(6)}              │`);
  console.log(`  │  Painted:         ${String(painted).padStart(6)}              │`);
  console.log(`  │  Ghost (problem): ${String(ghost).padStart(6)}              │`);
  console.log(`  │  Info (expected):  ${String(info).padStart(6)}              │`);
  console.log('  └─────────────────────────────────────────┘');

  if (ghostNodes.length > 0) {
    console.log('\n  Ghost nodes (not painting):');
    console.log('  ' + '─'.repeat(90));
    console.log(`  ${'ID'.padEnd(8)} ${'Type'.padEnd(14)} ${'Status'.padEnd(16)} ${'Computed'.padEnd(20)} ${'Debug Name'.padEnd(20)} Parent`);
    console.log('  ' + '─'.repeat(90));
    for (const n of ghostNodes) {
      console.log(`  ${(n.id || '?').padEnd(8)} ${(n.type || '?').padEnd(14)} ${(n.status || '?').padEnd(16)} ${(n.computed || 'none').padEnd(20)} ${(n.debugName || '-').padEnd(20)} ${n.parent || 'none'}`);
    }
  } else {
    console.log('\n  No ghost nodes found. Every tree node is painting correctly.');
  }

  if (infoNodes.length > 0) {
    console.log('\n  Info (expected non-visual):');
    console.log('  ' + '─'.repeat(70));
    for (const n of infoNodes) {
      console.log(`  ${(n.id || '?').padEnd(8)} ${(n.type || '?').padEnd(14)} ${n.status}`);
    }
  }

  console.log('');
}

function findEntry(cwd, ...candidates) {
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) return p;
  }
  console.error(`No entry point found. Looked for: ${candidates.join(', ')}`);
  process.exit(1);
}

function findSdl2Main(cwd) {
  // Check common SDL2 entry points
  const candidates = [
    join('sdl2', 'main.lua'),
    join('lua', 'sdl2_init.lua'),
  ];
  for (const c of candidates) {
    if (existsSync(join(cwd, c))) return c;
  }
  return null;
}
