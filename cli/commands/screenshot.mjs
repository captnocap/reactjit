import { existsSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLint } from './lint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

export async function screenshotCommand(args) {
  const cwd = process.cwd();
  const projectName = basename(cwd);

  // Parse flags
  let outputPath = resolve(cwd, 'screenshot.png');
  let node = null;
  let region = null;
  let padding = null;
  let listMode = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      if (args[i + 1]) { outputPath = resolve(cwd, args[i + 1]); i++; }
    } else if (args[i] === '--node' || args[i] === '-n') {
      if (args[i + 1]) { node = args[i + 1]; i++; }
    } else if (args[i] === '--region' || args[i] === '-r') {
      if (args[i + 1]) { region = args[i + 1]; i++; }
    } else if (args[i] === '--padding' || args[i] === '--pad' || args[i] === '-p') {
      if (args[i + 1]) { padding = args[i + 1]; i++; }
    } else if (args[i] === '--list' || args[i] === '-l') {
      listMode = true;
    }
  }

  console.log(`\n  reactjit screenshot\n`);

  // 1. Lint check
  console.log('  [1/3] Linting...');
  const { errors } = await runLint(cwd, { silent: false });
  if (errors > 0) {
    console.error(`\n  Screenshot blocked: ${errors} lint error${errors !== 1 ? 's' : ''} must be fixed first.\n`);
    process.exit(1);
  }

  // 2. Build bundle
  console.log('  [2/3] Bundling...');
  const entry = findEntry(cwd, 'src/main.tsx');
  execSync([
    'npx', 'esbuild',
    '--bundle',
    '--format=iife',
    '--global-name=ReactJIT',
    '--target=es2020',
    '--jsx=automatic',
    '--outfile=bundle.js',
    entry,
  ].join(' '), { cwd, stdio: 'inherit' });

  // 3. Launch Love2D in screenshot mode
  const target = node ? `node '${node}'` : region ? `region ${region}` : 'full page';
  console.log('  [3/3] Capturing screenshot...');
  console.log(`         Target: ${target}`);
  console.log(`         Output: ${outputPath}`);

  const env = {
    ...process.env,
    REACTJIT_SCREENSHOT: '1',
    REACTJIT_SCREENSHOT_OUTPUT: outputPath,
  };
  if (node) env.REACTJIT_SCREENSHOT_NODE = node;
  if (region) env.REACTJIT_SCREENSHOT_REGION = region;
  if (padding) env.REACTJIT_SCREENSHOT_PAD = padding;
  if (listMode) env.REACTJIT_SCREENSHOT_LIST = '1';

  // Detect xvfb-run for headless operation
  let useXvfb = false;
  try {
    execSync('which xvfb-run', { stdio: 'pipe' });
    useXvfb = true;
  } catch { /* not available */ }

  const loveCmd = useXvfb
    ? ['xvfb-run', '-a', 'love', '.']
    : ['love', '.'];

  return new Promise((resolveP) => {
    const proc = spawn(loveCmd[0], loveCmd.slice(1), {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let done = false;

    proc.on('error', (err) => {
      console.error(`\n  Failed to launch: ${loveCmd[0]}`);
      if (err.code === 'ENOENT') {
        console.error(useXvfb
          ? '  xvfb-run or love not found in PATH.'
          : '  Love2D not found. Install it: https://love2d.org');
      } else {
        console.error(`  ${err.message}`);
      }
      console.error('');
      process.exit(1);
    });

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // In list mode, stream node list to console
      if (listMode && chunk.includes('SCREENSHOT_NODES_')) {
        done = true;
      }
      if (listMode) process.stdout.write(chunk);
      // Check for success marker
      if (stdout.includes('SCREENSHOT_SAVED:')) {
        done = true;
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout: 15 seconds
    const timeout = setTimeout(() => {
      if (!done) {
        proc.kill('SIGTERM');
        console.error('\n  Screenshot timed out after 15 seconds.');
        console.error('  This usually means Love2D failed to initialize or render.\n');
        if (stderr) console.error('  stderr:', stderr.trim());
        process.exit(1);
      }
    }, 15000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (done || code === 0) {
        if (listMode) {
          resolveP();
        } else if (existsSync(outputPath)) {
          console.log(`\n  Done! Screenshot saved to ${outputPath}\n`);
          resolveP();
        } else {
          console.error('\n  Love2D exited but screenshot file was not created.');
          if (stderr) console.error('  stderr:', stderr.trim());
          process.exit(1);
        }
      } else {
        console.error(`\n  Love2D exited with code ${code}`);
        if (stderr) console.error('  stderr:', stderr.trim());
        process.exit(1);
      }
    });
  });
}

function findEntry(cwd, ...candidates) {
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) return p;
  }
  console.error(`No entry point found. Looked for: ${candidates.join(', ')}`);
  process.exit(1);
}
