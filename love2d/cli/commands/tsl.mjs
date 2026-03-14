/**
 * tsl.mjs — CLI command for the TSL (TypeScript-to-Lua) transpiler
 *
 * Usage:
 *   reactjit tsl <file.tsl>              Transpile and print to stdout
 *   reactjit tsl <file.tsl> -o out.lua   Transpile and write to file
 *   reactjit tsl src/                    Transpile all .tsl files in directory
 *   reactjit tsl --test                  Run test suite (cli/test/tsl/)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename, extname, resolve } from 'node:path';
import { transpile, TSLError } from '../lib/tsl.mjs';

const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const red    = color('31');
const green  = color('32');
const yellow = color('33');
const cyan   = color('36');
const dim    = color('2');
const bold   = color('1');

/**
 * Find all .tsl files recursively in a directory.
 */
function findTslFiles(dir) {
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsl')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

/**
 * Transpile a single .tsl file. Returns { ok, input, output, error }.
 */
function transpileFile(filePath) {
  const source = readFileSync(filePath, 'utf-8');
  try {
    const lua = transpile(source, filePath);
    return { ok: true, input: filePath, output: lua, error: null };
  } catch (err) {
    return { ok: false, input: filePath, output: null, error: err.message };
  }
}

/**
 * Run the test suite in cli/test/tsl/.
 */
function runTests(testDir) {
  if (!existsSync(testDir)) {
    console.error(red(`  Test directory not found: ${testDir}`));
    process.exit(1);
  }

  const tslFiles = readdirSync(testDir).filter(f => f.endsWith('.tsl'));
  if (tslFiles.length === 0) {
    console.log(yellow('  No .tsl test files found.'));
    return;
  }

  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (const tslFile of tslFiles) {
    const base = tslFile.replace(/\.tsl$/, '');
    const inputPath = join(testDir, tslFile);
    const expectedPath = join(testDir, `${base}.expected.lua`);

    // Error test: no expected file means we expect a transpile error
    const expectError = tslFile.startsWith('error-') || !existsSync(expectedPath);

    const result = transpileFile(inputPath);

    if (expectError) {
      if (!result.ok) {
        console.log(`  ${green('PASS')} ${dim(tslFile)} ${dim('(expected error)')}`);
        passed++;
      } else {
        console.log(`  ${red('FAIL')} ${tslFile} — expected error but transpiled successfully`);
        failed++;
      }
      continue;
    }

    if (!result.ok) {
      console.log(`  ${red('ERR ')} ${tslFile} — ${result.error}`);
      errors++;
      continue;
    }

    const expected = readFileSync(expectedPath, 'utf-8');
    const actual = result.output;

    if (normalize(actual) === normalize(expected)) {
      console.log(`  ${green('PASS')} ${dim(tslFile)}`);
      passed++;
    } else {
      console.log(`  ${red('FAIL')} ${tslFile}`);
      // Show diff
      const expectedLines = expected.trimEnd().split('\n');
      const actualLines = actual.trimEnd().split('\n');
      const maxLines = Math.max(expectedLines.length, actualLines.length);
      for (let i = 0; i < maxLines; i++) {
        const exp = expectedLines[i] ?? '';
        const act = actualLines[i] ?? '';
        if (exp !== act) {
          console.log(`    ${dim(`L${i + 1}:`)} ${red(`- ${exp}`)}`);
          console.log(`    ${dim(`   `)} ${green(`+ ${act}`)}`);
        }
      }
      failed++;
    }
  }

  console.log('');
  console.log(`  ${bold(`${passed} passed`)}, ${failed ? red(`${failed} failed`) : `${failed} failed`}, ${errors ? red(`${errors} errors`) : `${errors} errors`}`);

  if (failed > 0 || errors > 0) process.exit(1);
}

function normalize(str) {
  return str.replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
}

export async function tslCommand(args) {
  // --test flag
  if (args.includes('--test')) {
    const cliDir = dirname(new URL(import.meta.url).pathname);
    const testDir = resolve(cliDir, '..', 'test', 'tsl');
    console.log(`\n  ${bold('TSL test suite')}\n`);
    runTests(testDir);
    return;
  }

  if (args.length === 0) {
    console.log(`
  Usage:
    reactjit tsl <file.tsl>              Transpile to stdout
    reactjit tsl <file.tsl> -o out.lua   Write to file
    reactjit tsl src/                    Transpile all .tsl in directory
    reactjit tsl --test                  Run test suite
`);
    return;
  }

  // Parse -o flag
  const oIndex = args.indexOf('-o');
  let outputPath = null;
  const inputArgs = [...args];
  if (oIndex !== -1) {
    outputPath = args[oIndex + 1];
    inputArgs.splice(oIndex, 2);
  }

  const target = inputArgs[0];
  if (!target) {
    console.error(red('  No input file specified.'));
    process.exit(1);
  }

  const resolved = resolve(target);

  // Directory mode
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    const files = findTslFiles(resolved);
    if (files.length === 0) {
      console.log(yellow('  No .tsl files found.'));
      return;
    }
    console.log(`  Transpiling ${files.length} .tsl file(s)...\n`);
    let ok = 0;
    let fail = 0;
    for (const f of files) {
      const result = transpileFile(f);
      if (result.ok) {
        const outPath = f.replace(/\.tsl$/, '.lua');
        writeFileSync(outPath, result.output);
        console.log(`  ${green('OK')} ${dim(relative(process.cwd(), f))} → ${dim(relative(process.cwd(), outPath))}`);
        ok++;
      } else {
        console.log(`  ${red('ERR')} ${relative(process.cwd(), f)} — ${result.error}`);
        fail++;
      }
    }
    console.log(`\n  ${ok} succeeded, ${fail} failed`);
    if (fail > 0) process.exit(1);
    return;
  }

  // Single file mode
  if (!existsSync(resolved)) {
    console.error(red(`  File not found: ${target}`));
    process.exit(1);
  }

  const result = transpileFile(resolved);
  if (!result.ok) {
    console.error(red(`  Error: ${result.error}`));
    process.exit(1);
  }

  if (outputPath) {
    writeFileSync(resolve(outputPath), result.output);
    console.log(`  ${green('OK')} ${dim(relative(process.cwd(), resolved))} → ${dim(outputPath)}`);
  } else {
    process.stdout.write(result.output);
  }
}
