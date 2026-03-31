import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const smithRoot = path.dirname(fileURLToPath(import.meta.url));
const compilerRoot = path.resolve(smithRoot, '..');
const tszRoot = path.resolve(compilerRoot, '..');
const repoRoot = path.resolve(tszRoot, '..');

const manifestPath = path.resolve(smithRoot, 'LOAD_ORDER.txt');
const bundlePath = path.resolve(smithRoot, 'dist', 'smith.bundle.js');

const activeFiles = new Set([
  'tsz/compiler/smith/LOAD_ORDER.txt',
  'tsz/compiler/smith/build_bundle.mjs',
  'tsz/compiler/smith/sync_scan.mjs',
  'tsz/compiler/smith/rules.js',
  'tsz/compiler/smith/logs.js',
  'tsz/compiler/smith/core.js',
  'tsz/compiler/smith/index.js',
  'tsz/compiler/smith/parse.js',
  'tsz/compiler/smith/parse_map.js',
  'tsz/compiler/smith/attrs.js',
  'tsz/compiler/smith/preflight.js',
  'tsz/compiler/smith/emit.js',
  'tsz/compiler/smith/emit_split.js',
  'tsz/compiler/smith/page.js',
  'tsz/compiler/smith/mod.js',
  'tsz/compiler/smith/soup_smith.js',
  'tsz/compiler/forge.zig',
  'tsz/build.zig',
]);

const activeDirs = [
  'tsz/compiler/smith/collect/',
  'tsz/compiler/smith/lanes/',
  'tsz/compiler/smith/parse/',
  'tsz/compiler/smith/preflight/',
  'tsz/compiler/smith/emit/',
];

const frozenDirs = [
  'tsz/compiler/smith/refactor/',
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

function isFrozenPath(relPath) {
  return frozenDirs.some((prefix) => relPath.startsWith(prefix));
}

const manifestText = await readFile(manifestPath, 'utf8');
const manifestEntries = parseManifest(manifestText);
const manifestSet = new Set(manifestEntries);
const frozenManifestEntries = manifestEntries.filter((entry) => entry.startsWith('smith/refactor/'));

const statusEntries = parseStatus(runGit(['status', '--short', '--', 'tsz/compiler/smith', 'tsz/compiler/forge.zig', 'tsz/build.zig']));
const dirtyActive = statusEntries.filter((entry) => isActivePath(entry.path));
const dirtyFrozen = statusEntries.filter((entry) => isFrozenPath(entry.path));
const dirtyOther = statusEntries.filter((entry) => !isActivePath(entry.path) && !isFrozenPath(entry.path));

const manifestMissing = [];
for (const relPath of manifestEntries) {
  try {
    await stat(path.resolve(compilerRoot, relPath));
  } catch {
    manifestMissing.push(relPath);
  }
}

const smithJsFiles = await walkJsFiles(smithRoot);
const authoredJs = smithJsFiles
  .map((absPath) => relFromCompiler(absPath))
  .filter((relPath) => relPath !== 'smith/dist/smith.bundle.js')
  .filter((relPath) => !relPath.startsWith('smith/refactor/'));
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
printGroup('Manifest entries still pointing at frozen refactor snapshot', frozenManifestEntries, (entry) => entry);
printGroup('Bundle stale against', staleBundleSources, (entry) => entry);

console.log('');
printGroup('Dirty active Smith files', dirtyActive, (entry) => entry.code + ' ' + entry.path);
printGroup('Dirty frozen reference files', dirtyFrozen, (entry) => entry.code + ' ' + entry.path);
printGroup('Other dirty compiler files', dirtyOther, (entry) => entry.code + ' ' + entry.path);

if (manifestMissing.length > 0 || missingFromManifest.length > 0 || frozenManifestEntries.length > 0) {
  process.exitCode = 1;
}
