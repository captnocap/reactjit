import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { getEsbuildAliases } from '../lib/aliases.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT   = join(__dirname, '..');
const TEST_SHIM  = join(CLI_ROOT, 'lib', 'test-shim.js');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;

// ── entry point ───────────────────────────────────────────────────────────────
export async function testCommand(args) {
  const cwd = process.cwd();

  // Find spec file (first non-flag arg)
  const specArg = args.find(a => !a.startsWith('-'));
  if (!specArg) {
    console.error(`\n  Usage: rjit test <spec-file.ts>\n`);
    process.exit(1);
  }

  const specFile = resolve(cwd, specArg);
  if (!existsSync(specFile)) {
    console.error(`\n  Spec file not found: ${specFile}\n`);
    process.exit(1);
  }

  // Determine Love2D launch directory (some projects use love/ subdir)
  const loveDir  = existsSync(join(cwd, 'love', 'main.lua')) ? 'love' : '.';
  const bundlePath = join(cwd, loveDir, 'bundle.js');
  if (!existsSync(bundlePath)) {
    console.error(`\n  App bundle not found: ${bundlePath}`);
    console.error(`  Run ${cyan('rjit build')} first.\n`);
    process.exit(1);
  }

  const label = `${bold('rjit test')} ${dim(basename(specFile))}`;
  console.log(`\n  ${label}\n`);

  // ── 1. Bundle spec ──────────────────────────────────────────────────────────
  const tmpDir = join(tmpdir(), `rjit-test-${randomBytes(4).toString('hex')}`);
  mkdirSync(tmpDir, { recursive: true });
  const specBundle = join(tmpDir, 'spec.js');

  process.stdout.write(`  ${dim('[1/2]')} Bundling spec...`);
  try {
    execSync(
      [
        'npx', 'esbuild',
        '--bundle',
        '--format=iife',
        '--target=es2020',
        '--jsx=automatic',
        '--external:child_process',
        `--outfile=${specBundle}`,
        ...getEsbuildAliases(cwd),
        specFile,
      ].join(' '),
      { cwd, stdio: 'pipe' }
    );
    process.stdout.write(` ${green('ok')}\n`);
  } catch (e) {
    process.stdout.write(` ${red('failed')}\n\n`);
    const msg = (e.stderr || e.stdout || e.message || '').toString().trim();
    if (msg) console.error('  ' + msg.replace(/\n/g, '\n  '));
    process.exit(1);
  }

  // ── 2. Launch Love2D in test mode ───────────────────────────────────────────
  console.log(`  ${dim('[2/2]')} Running tests...\n`);

  const env = {
    ...process.env,
    RJIT_TEST:      '1',
    RJIT_TEST_SHIM: TEST_SHIM,
    RJIT_TEST_SPEC: specBundle,
  };

  // Prefer xvfb-run for headless CI environments
  let useXvfb = false;
  try { execSync('which xvfb-run', { stdio: 'pipe' }); useXvfb = true; } catch {}
  const loveCmd = useXvfb
    ? ['xvfb-run', '-a', 'love', loveDir]
    : ['love', loveDir];

  const timeout = parseInt(args.find(a => a.startsWith('--timeout='))?.slice(10) || '30', 10);

  return new Promise((done) => {
    const proc = spawn(loveCmd[0], loveCmd.slice(1), {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const passedTests = [];
    const failedTests = [];
    let finished = false;

    proc.on('error', (err) => {
      console.error(`\n  Failed to launch Love2D: ${err.message}\n`);
      process.exit(1);
    });

    proc.stdout.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        if (line.startsWith('TEST_PASS: ')) {
          const name = line.slice('TEST_PASS: '.length).trim();
          passedTests.push(name);
          console.log(`  ${green('✓')} ${name}`);
        } else if (line.startsWith('TEST_FAIL: ')) {
          const rest  = line.slice('TEST_FAIL: '.length).trim();
          const colon = rest.indexOf(': ');
          const name  = colon >= 0 ? rest.slice(0, colon) : rest;
          const error = colon >= 0 ? rest.slice(colon + 2) : '';
          failedTests.push({ name, error });
          console.log(`  ${red('✗')} ${name}`);
          if (error) console.log(`    ${dim(error)}`);
        } else if (line.startsWith('TEST_ERROR: ')) {
          console.error(`\n  ${red('Error')}: ${line.slice('TEST_ERROR: '.length).trim()}\n`);
        } else if (line.startsWith('TEST_DONE:')) {
          finished = true;
        }
      }
    });

    // Passthrough stderr only in verbose mode
    if (args.includes('--verbose') || args.includes('-v')) {
      proc.stderr.on('data', (d) => process.stderr.write(d));
    }

    const timer = setTimeout(() => {
      if (!finished) {
        proc.kill('SIGTERM');
        console.error(`\n  ${red('Tests timed out')} after ${timeout}s\n`);
        process.exit(1);
      }
    }, timeout * 1000);

    proc.on('close', () => {
      clearTimeout(timer);
      const total = passedTests.length + failedTests.length;
      console.log('');
      if (failedTests.length === 0) {
        console.log(`  ${green(bold(passedTests.length + ' passed'))} ${dim('(' + total + ' tests)')}\n`);
      } else {
        console.log(
          `  ${green(passedTests.length + ' passed')}  ` +
          `${red(bold(failedTests.length + ' failed'))} ` +
          `${dim('(' + total + ' tests)')}\n`
        );
      }
      process.exit(failedTests.length > 0 ? 1 : 0);
    });
  });
}
