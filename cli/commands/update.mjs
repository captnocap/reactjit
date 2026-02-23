import { existsSync, cpSync, rmSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

/** Returns true if `p` exists and is a symlink. */
function isSymlink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

/**
 * Sync a runtime directory into the project, unless the destination is a
 * symlink (meaning the project reads from source-of-truth directly).
 */
function syncDir(src, dest, label) {
  if (isSymlink(dest)) {
    console.log(`  Skipped ${label} (symlink — reading from source directly)`);
    return;
  }
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true });
  }
  cpSync(src, dest, { recursive: true });
  console.log(`  Updated ${label}`);
}

export async function updateCommand(args) {
  const cwd = process.cwd();

  // Block running from the storybook directory — it reads from source via symlinks
  const isStorybook = existsSync(join(cwd, '..', 'packages', 'core')) &&
    existsSync(join(cwd, '..', 'lua')) &&
    existsSync(join(cwd, 'love'));
  if (isStorybook) {
    console.error('  ERROR: Cannot run `reactjit update` from the storybook directory.');
    console.error('  The storybook reads from source-of-truth via symlinks.');
    console.error('  Running update here would replace symlinks with stale copies.');
    process.exit(1);
  }

  // Sanity check: are we inside an ReactJIT project?
  const hasMain = existsSync(join(cwd, 'main.lua')) || existsSync(join(cwd, 'src'));
  if (!hasMain) {
    console.error('  This does not look like an ReactJIT project.');
    console.error('  Run this command from inside a project created with `reactjit init`.');
    process.exit(1);
  }

  const runtimeLua = join(CLI_ROOT, 'runtime', 'lua');
  const runtimeLib = join(CLI_ROOT, 'runtime', 'lib');
  const runtimePkgs = join(CLI_ROOT, 'runtime', 'reactjit');

  if (!existsSync(runtimeLua) || !existsSync(runtimePkgs)) {
    console.error('  CLI runtime not found. Run `make cli-setup` first.');
    process.exit(1);
  }

  console.log('\n  Updating ReactJIT runtime...\n');

  // Update lua/
  syncDir(runtimeLua, join(cwd, 'lua'), 'lua/');

  // Update lib/
  if (existsSync(runtimeLib)) {
    syncDir(runtimeLib, join(cwd, 'lib'), 'lib/');
  }

  // Update bin/ (tor binary)
  const runtimeBin = join(CLI_ROOT, 'runtime', 'bin');
  if (existsSync(runtimeBin)) {
    syncDir(runtimeBin, join(cwd, 'bin'), 'bin/');
  }

  // Update reactjit/ (shared + native packages)
  if (existsSync(runtimePkgs)) {
    syncDir(runtimePkgs, join(cwd, 'reactjit'), 'reactjit/');
  }

  // Update fonts/ (font packs)
  const runtimeFonts = join(CLI_ROOT, 'runtime', 'fonts');
  if (existsSync(runtimeFonts)) {
    syncDir(runtimeFonts, join(cwd, 'fonts'), 'fonts/');

    // Also copy into love/ subdirectory if it exists (Love2D filesystem root)
    const loveDir = join(cwd, 'love');
    if (existsSync(loveDir) && existsSync(join(loveDir, 'main.lua'))) {
      syncDir(runtimeFonts, join(loveDir, 'fonts'), 'love/fonts/');
    }
  }

  // Update data/ (dictionary, etc.)
  const runtimeData = join(CLI_ROOT, 'runtime', 'data');
  if (existsSync(runtimeData)) {
    syncDir(runtimeData, join(cwd, 'data'), 'data/');

    // Also copy into love/ subdirectory if it exists
    const loveDir = join(cwd, 'love');
    if (existsSync(loveDir) && existsSync(join(loveDir, 'main.lua'))) {
      syncDir(runtimeData, join(loveDir, 'data'), 'love/data/');
    }
  }

  console.log('\n  Done! Runtime files are up to date.\n');
}
