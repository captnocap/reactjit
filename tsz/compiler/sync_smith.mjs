import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compilerRoot = path.dirname(fileURLToPath(import.meta.url));
const tszRoot = path.resolve(compilerRoot, '..');
const repoRoot = path.resolve(tszRoot, '..');

const manifestPath = path.resolve(compilerRoot, 'smith_LOAD_ORDER.txt');
const bundlePath = path.resolve(compilerRoot, 'dist', 'smith.bundle.js');

const activeFiles = new Set([
  'tsz/compiler/smith_LOAD_ORDER.txt',
  'tsz/compiler/build_smith_bundle.mjs',
  'tsz/compiler/sync_smith.mjs',
  'tsz/compiler/smith_rules.js',
  'tsz/compiler/smith_logs.js',
  'tsz/compiler/smith_core.js',
  'tsz/compiler/smith_index.js',
  'tsz/compiler/smith_parse.js',
  'tsz/compiler/smith_parse_map.js',
  'tsz/compiler/smith_attrs.js',
  'tsz/compiler/smith_preflight.js',
  'tsz/compiler/smith_emit.js',
  'tsz/compiler/smith_emit_split.js',
  'tsz/compiler/smith_page.js',
  'tsz/compiler/smith_mod.js',
  'tsz/compiler/smith_soup.js',
  'tsz/compiler/smith_DICTIONARY.md',
  'tsz/compiler/forge.zig',
  'tsz/build.zig',
  'tsz/CLAUDE.md',
]);

const activeDirs = [
  'tsz/compiler/smith_collect/',
  'tsz/compiler/smith_lanes/',
  'tsz/compiler/smith_parse/',
  'tsz/compiler/smith_preflight/',
  'tsz/compiler/smith_emit/',
];

function parseManifest(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function runGit(args) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  } catch (err) {
    if (err && typeof err.stdout === 'string' && err.stdout.length > 0) {
      return err.stdout;
    }
    throw err;
  }
}

function parseStatus(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.slice(3),
    }));
}

async function walkJsFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkJsFiles(abs);
      out.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.js')) continue;
    out.push(abs);
  }
  return out;
}

function relFromRepo(absPath) {
  return path.relative(repoRoot, absPath).replaceAll(path.sep, '/');
}

function relFromCompiler(absPath) {
  return path.relative(compilerRoot, absPath).replaceAll(path.sep, '/');
}

function isActivePath(relPath) {
  if (activeFiles.has(relPath)) return true;
  return activeDirs.some((prefix) => relPath.startsWith(prefix));
}

function isLegacyCompilerPath(relPath) {
  return relPath.startsWith('tsz/compiler/smith/');
}

function isSmithSource(relPath) {
  return relPath === 'smith_rules.js' ||
    relPath === 'smith_logs.js' ||
    relPath === 'smith_core.js' ||
    relPath === 'smith_index.js' ||
    relPath === 'smith_parse.js' ||
    relPath === 'smith_parse_map.js' ||
    relPath === 'smith_attrs.js' ||
    relPath === 'smith_preflight.js' ||
    relPath === 'smith_emit.js' ||
    relPath === 'smith_emit_split.js' ||
    relPath === 'smith_page.js' ||
    relPath === 'smith_mod.js' ||
    relPath === 'smith_soup.js' ||
    relPath.startsWith('smith_collect/') ||
    relPath.startsWith('smith_lanes/') ||
    relPath.startsWith('smith_parse/') ||
    relPath.startsWith('smith_preflight/') ||
    relPath.startsWith('smith_emit/');
}

const manifestText = await readFile(manifestPath, 'utf8');
const manifestEntries = parseManifest(manifestText);
const manifestSet = new Set(manifestEntries);
const legacyManifestEntries = manifestEntries.filter((entry) => entry.startsWith('smith/'));

const statusEntries = parseStatus(runGit(['status', '--short', '--', 'tsz/compiler', 'tsz/build.zig']));
const dirtyActive = statusEntries.filter((entry) => isActivePath(entry.path));
const dirtyLegacy = statusEntries.filter((entry) => isLegacyCompilerPath(entry.path));
const dirtyOther = statusEntries.filter((entry) => !isActivePath(entry.path) && !isLegacyCompilerPath(entry.path));

const manifestMissing = [];
for (const relPath of manifestEntries) {
  try {
    await stat(path.resolve(compilerRoot, relPath));
  } catch {
    manifestMissing.push(relPath);
  }
}

const smithJsFiles = await walkJsFiles(compilerRoot);
const authoredJs = smithJsFiles
  .map((absPath) => relFromCompiler(absPath))
  .filter((relPath) => relPath !== 'dist/smith.bundle.js')
  .filter((relPath) => isSmithSource(relPath));
const missingFromManifest = authoredJs.filter((relPath) => !manifestSet.has(relPath)).sort();

let bundleState = 'missing';
let staleBundleSources = [];
try {
  const bundleStat = await stat(bundlePath);
  bundleState = 'fresh';
  for (const relPath of manifestEntries) {
    const sourceStat = await stat(path.resolve(compilerRoot, relPath));
    if (sourceStat.mtimeMs > bundleStat.mtimeMs) {
      staleBundleSources.push(relPath);
    }
  }
  if (staleBundleSources.length > 0) bundleState = 'stale';
} catch {
  bundleState = 'missing';
}

function printGroup(title, entries, format) {
  console.log(title);
  if (entries.length === 0) {
    console.log('- none');
    return;
  }
  for (const entry of entries) console.log('- ' + format(entry));
}

console.log('Smith sync scan');
console.log('');
console.log('Manifest');
console.log('- entries: ' + manifestEntries.length);
console.log('- bundle: ' + relFromRepo(bundlePath) + ' [' + bundleState + ']');

printGroup('Missing manifest sources', manifestMissing, (entry) => entry);
printGroup('Authored JS missing from manifest', missingFromManifest, (entry) => entry);
printGroup('Manifest entries still pointing at legacy smith/ paths', legacyManifestEntries, (entry) => entry);
printGroup('Bundle stale against', staleBundleSources, (entry) => entry);

console.log('');
printGroup('Dirty active Smith files', dirtyActive, (entry) => entry.code + ' ' + entry.path);
printGroup('Dirty legacy smith/ files', dirtyLegacy, (entry) => entry.code + ' ' + entry.path);
printGroup('Other dirty compiler files', dirtyOther, (entry) => entry.code + ' ' + entry.path);

if (manifestMissing.length > 0 || missingFromManifest.length > 0 || legacyManifestEntries.length > 0) {
  process.exitCode = 1;
}
