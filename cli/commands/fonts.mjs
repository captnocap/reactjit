import { existsSync, readFileSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

/**
 * Resolve the font manifest.
 * Checks: project fonts/ → cli/runtime/fonts/ → monorepo root fonts/
 */
function loadManifest(cwd) {
  const candidates = [
    join(cwd, 'fonts', 'manifest.json'),
    join(CLI_ROOT, 'runtime', 'fonts', 'manifest.json'),
  ];

  // Monorepo root: two levels up from cli/commands/
  const monorepoFonts = join(__dirname, '..', '..', 'fonts', 'manifest.json');
  if (existsSync(monorepoFonts)) candidates.push(monorepoFonts);

  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'));
    }
  }
  return null;
}

/**
 * Find the source directory for a font pack.
 * Priority: monorepo root → cli/runtime
 */
function findPackSource(packName) {
  // Monorepo root fonts/ (local dev)
  const monorepo = join(__dirname, '..', '..', 'fonts', packName);
  if (existsSync(monorepo) && statSync(monorepo).isDirectory()) return monorepo;

  // CLI runtime (installed CLI)
  const runtime = join(CLI_ROOT, 'runtime', 'fonts', packName);
  if (existsSync(runtime) && statSync(runtime).isDirectory()) return runtime;

  return null;
}

/**
 * Get installed packs in the project's fonts/ directory.
 */
function getInstalledPacks(cwd) {
  const fontsDir = join(cwd, 'fonts');
  if (!existsSync(fontsDir)) return new Set();

  const entries = readdirSync(fontsDir);
  const packs = new Set();
  for (const e of entries) {
    const full = join(fontsDir, e);
    if (statSync(full).isDirectory()) packs.add(e);
  }
  return packs;
}

/**
 * Get size of a directory in human-readable form.
 */
function dirSize(dir) {
  let total = 0;
  function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else total += s.size;
    }
  }
  try { walk(dir); } catch { return '?'; }
  if (total > 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)}MB`;
  if (total > 1024) return `${(total / 1024).toFixed(0)}KB`;
  return `${total}B`;
}

// ── Subcommands ─────────────────────────────────────────

function listPacks(cwd) {
  const manifest = loadManifest(cwd);
  if (!manifest || !manifest.packs) {
    console.error('  No font manifest found.');
    exit(1);
  }

  const installed = getInstalledPacks(cwd);
  console.log('\n  Font packs:\n');

  for (const [name, info] of Object.entries(manifest.packs)) {
    const isInstalled = installed.has(name);
    const marker = isInstalled ? '\x1b[32m installed\x1b[0m' : '\x1b[2mnot installed\x1b[0m';
    const sizeTag = info.heavy ? `\x1b[33m${info.size}\x1b[0m` : info.size;
    const defaultTag = info.default ? ' (default)' : '';
    console.log(`    ${name.padEnd(14)} ${sizeTag.padEnd(20)} ${marker}${defaultTag}`);
    console.log(`    ${''.padEnd(14)} \x1b[2m${info.label}\x1b[0m`);
  }
  console.log();
}

function addPack(cwd, packName) {
  const manifest = loadManifest(cwd);
  if (!manifest || !manifest.packs || !manifest.packs[packName]) {
    console.error(`  Unknown font pack: "${packName}"`);
    if (manifest && manifest.packs) {
      console.error(`  Available: ${Object.keys(manifest.packs).join(', ')}`);
    }
    exit(1);
  }

  const destDir = join(cwd, 'fonts', packName);
  if (existsSync(destDir)) {
    console.log(`  Font pack "${packName}" is already installed.`);
    return;
  }

  const source = findPackSource(packName);
  if (!source) {
    console.error(`  Font pack "${packName}" not found locally.`);
    console.error(`  In the monorepo, ensure fonts/${packName}/ exists.`);
    console.error(`  For published CLI, font downloads will be supported in a future release.`);
    exit(1);
  }

  cpSync(source, destDir, { recursive: true });

  // Also copy into love/ subdirectory if it exists
  const loveDir = join(cwd, 'love');
  if (existsSync(loveDir) && existsSync(join(loveDir, 'main.lua'))) {
    cpSync(source, join(loveDir, 'fonts', packName), { recursive: true });
  }

  const size = dirSize(destDir);
  console.log(`  Added font pack "${packName}" (${size})`);
}

function removePack(cwd, packName) {
  if (packName === 'base') {
    console.error('  Cannot remove "base" — it is the default font pack.');
    exit(1);
  }

  const destDir = join(cwd, 'fonts', packName);
  if (!existsSync(destDir)) {
    console.log(`  Font pack "${packName}" is not installed.`);
    return;
  }

  rmSync(destDir, { recursive: true, force: true });

  // Also remove from love/ subdirectory if it exists
  const loveFonts = join(cwd, 'love', 'fonts', packName);
  if (existsSync(loveFonts)) {
    rmSync(loveFonts, { recursive: true, force: true });
  }

  console.log(`  Removed font pack "${packName}"`);
}

// ── Entry point ─────────────────────────────────────────

export async function fontsCommand(args) {
  const cwd = process.cwd();
  const sub = args[0];

  switch (sub) {
    case 'list':
    case undefined:
      listPacks(cwd);
      break;
    case 'add':
      if (!args[1]) { console.error('  Usage: reactjit fonts add <pack>'); exit(1); }
      addPack(cwd, args[1]);
      break;
    case 'remove':
    case 'rm':
      if (!args[1]) { console.error('  Usage: reactjit fonts remove <pack>'); exit(1); }
      removePack(cwd, args[1]);
      break;
    default:
      console.error(`  Unknown fonts subcommand: "${sub}"`);
      console.log('  Usage: reactjit fonts [list|add|remove] [pack]');
      exit(1);
  }
}
