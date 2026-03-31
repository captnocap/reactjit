import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const compilerRoot = path.resolve(here, '..', '..');
const tszRoot = path.resolve(compilerRoot, '..');
const repoRoot = path.resolve(tszRoot, '..');

const manifestPath = path.resolve(here, 'LOAD_ORDER.txt');
const bundlePath = path.resolve(compilerRoot, 'smith', 'dist', 'smith.bundle.js');

const activeLegacy = new Set([
  'tsz/compiler/smith/index.js',
  'tsz/compiler/smith/parse.js',
  'tsz/compiler/smith/parse_map.js',
  'tsz/compiler/smith/attrs.js',
  'tsz/compiler/smith/preflight.js',
  'tsz/compiler/smith/emit.js',
  'tsz/compiler/forge.zig',
  'tsz/build.zig',
]);

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

const manifestText = await readFile(manifestPath, 'utf8');
const manifestEntries = parseManifest(manifestText);
const manifestSet = new Set(manifestEntries);

const statusEntries = parseStatus(runGit(['status', '--short', '--', 'tsz/compiler/smith', 'tsz/compiler/forge.zig', 'tsz/build.zig']));
const dirtyLegacy = statusEntries.filter((entry) => activeLegacy.has(entry.path));
const dirtyRefactor = statusEntries.filter((entry) => entry.path.startsWith('tsz/compiler/smith/refactor/'));
const dirtyOther = statusEntries.filter((entry) => !activeLegacy.has(entry.path) && !entry.path.startsWith('tsz/compiler/smith/refactor/'));

const manifestMissing = [];
for (const relPath of manifestEntries) {
  try {
    await stat(path.resolve(compilerRoot, relPath));
  } catch {
    manifestMissing.push(relPath);
  }
}

const smithJsFiles = await walkJsFiles(path.resolve(compilerRoot, 'smith'));
const authoredJs = smithJsFiles
  .map((absPath) => relFromCompiler(absPath))
  .filter((relPath) => relPath !== 'smith/dist/smith.bundle.js');
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
printGroup('Bundle stale against', staleBundleSources, (entry) => entry);

console.log('');
printGroup('Dirty active legacy files', dirtyLegacy, (entry) => entry.code + ' ' + entry.path);
printGroup('Dirty refactor files', dirtyRefactor, (entry) => entry.code + ' ' + entry.path);
printGroup('Other dirty compiler files', dirtyOther, (entry) => entry.code + ' ' + entry.path);

if (manifestMissing.length > 0 || missingFromManifest.length > 0) {
  process.exitCode = 1;
}
