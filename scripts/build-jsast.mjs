#!/usr/bin/env node
/*
 * build-jsast — parse a JS file with acorn and emit its AST as a Lua chunk
 * that returns one JSON string constant. JSRT loads the blob, decodes it once
 * at boot, and then walks the resulting table directly — no JS-to-Lua
 * translation ever happens.
 *
 * Usage:
 *   node scripts/build-jsast.mjs <input.js> <output.lua>
 */
import { parse } from 'acorn';
import fs from 'fs';

// Source-location fields we drop from the emitted AST — they're noise for the
// evaluator and would bloat the Lua file. Also drop `raw` on Literals (we only
// use `value`).
const SKIP_KEYS = new Set(['start', 'end', 'loc', 'range', 'raw']);

const LUA_KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while',
]);

function luaString(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
}

function normalizeAst(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'bigint') {
    throw new Error('BigInt literal not supported in JSRT');
  }
  if (value instanceof RegExp) {
    return { __regex: true, source: value.source, flags: value.flags };
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAst(item));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      if (!SKIP_KEYS.has(key)) {
        out[key] = normalizeAst(value[key]);
      }
    }
    return out;
  }
  throw new Error('Unhandled value type: ' + typeof value);
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/build-jsast.mjs <input.js> <output.lua>');
  process.exit(1);
}

const source = fs.readFileSync(inputPath, 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const json = JSON.stringify(normalizeAst(ast));
const lua = '-- AUTO-GENERATED from ' + inputPath + '. Do not edit.\n' +
            '-- Regenerate: node scripts/build-jsast.mjs ' + inputPath + ' ' + outputPath + '\n' +
            'return ' + luaString(json) + '\n';
fs.writeFileSync(outputPath, lua);
