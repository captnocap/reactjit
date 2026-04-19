import path from 'node:path';
import { promises as fs } from 'node:fs';
import { build } from 'esbuild';

const rootDir = path.resolve(import.meta.dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime');
const bundlePath = path.join(rootDir, 'bundle.js');

const requestedEntry = process.argv[2] || 'cart/d152.tsx';
const entryAbs = path.resolve(rootDir, requestedEntry);

if (!entryAbs.startsWith(rootDir + path.sep)) {
  console.error(`[build-bundle] entry must stay inside ${rootDir}`);
  process.exit(1);
}

try {
  const stat = await fs.stat(entryAbs);
  if (!stat.isFile()) {
    console.error(`[build-bundle] not a file: ${requestedEntry}`);
    process.exit(1);
  }
} catch {
  console.error(`[build-bundle] missing entry: ${requestedEntry}`);
  process.exit(1);
}

const runtimeAppPath = path.join(runtimeDir, 'current_app.tsx');
let relativeImport = path.relative(runtimeDir, entryAbs).replaceAll(path.sep, '/');
if (!relativeImport.startsWith('.')) relativeImport = `./${relativeImport}`;
relativeImport = relativeImport.replace(/\.(tsx?|jsx?)$/, '');

await fs.writeFile(runtimeAppPath, `export { default } from '${relativeImport}';\n`);

await build({
  absWorkingDir: rootDir,
  entryPoints: [path.join(runtimeDir, 'index.tsx')],
  bundle: true,
  outfile: bundlePath,
  format: 'iife',
  inject: [path.join(runtimeDir, 'jsx_shim.ts')],
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  alias: { '@reactjit/core': './runtime/core_stub.ts' },
});

console.log(`[build-bundle] app=${path.relative(rootDir, entryAbs)} bundle=${path.relative(rootDir, bundlePath)}`);
