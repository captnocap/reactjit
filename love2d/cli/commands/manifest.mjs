import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ── Color helpers ────────────────────────────────────────

const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const bold   = color('1');
const dim    = color('2');
const cyan   = color('36');
const green  = color('32');
const yellow = color('33');

// ── Defaults ─────────────────────────────────────────────

const DEFAULT_CAPABILITIES = {
  network: false,
  filesystem: false,
  clipboard: false,
  storage: false,
  ipc: false,
  gpu: true,
  process: false,
  sysmon: false,
  browse: false,
};

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.lua', '.json', '.css',
]);

// ── Helpers ──────────────────────────────────────────────

/** Compute SHA-256 hash of a file. */
function hashFile(filePath) {
  const contents = readFileSync(filePath);
  return 'sha256:' + createHash('sha256').update(contents).digest('hex');
}

/** Get current git commit hash (short). */
function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/** Recursively scan a directory for source files. */
function scanSources(dir, basedir) {
  const results = [];
  if (!existsSync(dir)) return results;

  let entries;
  try { entries = readdirSync(dir); } catch { return results; }

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dir, entry);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      results.push(...scanSources(fullPath, basedir));
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      results.push({
        file: relative(basedir, fullPath),
        hash: hashFile(fullPath),
      });
    }
  }
  return results;
}

// ── Command ──────────────────────────────────────────────

/**
 * reactjit manifest — Generate or update manifest.json
 *
 * If manifest.json exists, preserves the capabilities block and updates
 * sources + build metadata.  If it doesn't exist, creates a new one
 * with default-deny capabilities for the user to configure.
 */
export async function manifestCommand(args) {
  const cwd = process.cwd();
  const manifestPath = join(cwd, 'manifest.json');
  const hasExisting = existsSync(manifestPath);

  console.log(bold('\n  reactjit manifest\n'));

  // Load existing manifest or start fresh
  let manifest = {};
  if (hasExisting) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      console.log(dim('  Found existing manifest.json — preserving capabilities'));
    } catch (e) {
      console.error(`  ${yellow('Warning:')} Could not parse existing manifest.json: ${e.message}`);
      console.error('  Starting fresh.\n');
      manifest = {};
    }
  }

  // Name: from manifest, or package.json, or directory name
  if (!manifest.name) {
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        manifest.name = pkg.name || '';
      } catch { /* ignore */ }
    }
    if (!manifest.name) {
      manifest.name = cwd.split('/').pop() || 'unknown';
    }
  }

  // Version
  if (!manifest.version) {
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        manifest.version = pkg.version || '0.1.0';
      } catch { /* ignore */ }
    }
    if (!manifest.version) {
      manifest.version = '0.1.0';
    }
  }

  // Capabilities: preserve existing, or generate defaults
  if (!manifest.capabilities) {
    manifest.capabilities = { ...DEFAULT_CAPABILITIES };
    console.log(dim('  Generated default-deny capabilities — edit to declare what your cart needs'));
  } else {
    console.log(dim('  Preserved existing capabilities block'));
  }

  // Sources: always regenerate
  const srcDir = join(cwd, 'src');
  if (existsSync(srcDir)) {
    console.log(dim('  Scanning src/ for source files...'));
    manifest.sources = scanSources(srcDir, cwd);
    console.log(dim(`  Found ${manifest.sources.length} source files`));
  } else {
    manifest.sources = [];
    console.log(dim('  No src/ directory found — sources list empty'));
  }

  // Build metadata
  const commit = getGitCommit();
  manifest.build = {
    commit: commit || null,
    timestamp: new Date().toISOString(),
    toolchain: 'reactjit',
  };

  // Bundle hash (if bundle.js exists)
  const bundlePaths = [
    join(cwd, 'love', 'bundle.js'),
    join(cwd, 'bundle.js'),
  ];
  for (const bp of bundlePaths) {
    if (existsSync(bp)) {
      manifest.build.bundleHash = hashFile(bp);
      break;
    }
  }

  // Signature placeholder
  if (!manifest.signature) {
    manifest.signature = null;
  }

  // Write
  const json = JSON.stringify(manifest, null, 2) + '\n';
  writeFileSync(manifestPath, json);

  console.log(green(`\n  ✓ Wrote ${relative(cwd, manifestPath)}`));
  console.log();

  // Summary
  console.log(bold('  Capabilities:'));
  for (const [key, value] of Object.entries(manifest.capabilities)) {
    const status = value === false ? dim('✗ denied')
      : value === true ? green('✓ granted')
      : cyan(`✓ ${JSON.stringify(value)}`);
    console.log(`    ${key.padEnd(12)} ${status}`);
  }
  console.log();

  if (!hasExisting) {
    console.log(yellow('  Next steps:'));
    console.log(dim('    1. Edit manifest.json to declare the capabilities your cart needs'));
    console.log(dim('    2. Run `reactjit build` — manifest will be embedded automatically'));
    console.log();
  }
}
