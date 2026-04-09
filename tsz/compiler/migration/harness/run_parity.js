#!/usr/bin/env node

/**
 * run_parity.js
 *
 * Parity harness: compiles a cart via forge, captures the generated .zig output,
 * hashes it, and writes a schema-shaped parity result.
 *
 * Legacy path: invokes forge build, concatenates all generated .zig files.
 * Atom path: pending — requires Smith-internal intercept wired in parity sections.
 *
 * Usage: node run_parity.js <cart_path> <output_file>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── Step 93-94: Argument parsing ──

const cartPath = process.argv[2];
const outputFile = process.argv[3];

if (!cartPath || !outputFile) {
  console.error('Usage: node run_parity.js <cart_path> <output_file>');
  process.exit(1);
}

if (!fs.existsSync(cartPath)) {
  console.error('Cart not found: ' + cartPath);
  process.exit(1);
}

// Derive cart name from path
const basename = path.basename(cartPath, '.tsz');
const genDir = '/tmp/tsz-gen/generated_' + basename;

// ── Step 97: String hashing ──

function hashString(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// ── Step 95: Invoke legacy emitOutput() flow via forge ──

function runLegacyEmit(cart) {
  try {
    const forgeCmd = './zig-out/bin/forge build --parity ' + cart;
    const forgeOut = execSync(forgeCmd, {
      cwd: path.resolve(__dirname, '../../..'),
      timeout: 30000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Collect all generated .zig files, sorted by name for deterministic order
    if (!fs.existsSync(genDir)) {
      return { output: null, error: 'generated dir not found: ' + genDir, stderr: forgeOut };
    }

    const zigFiles = fs.readdirSync(genDir)
      .filter(f => f.endsWith('.zig'))
      .sort();

    if (zigFiles.length === 0) {
      return { output: null, error: 'no .zig files in ' + genDir };
    }

    // Concatenate all .zig files in sorted order
    let combined = '';
    for (const zf of zigFiles) {
      combined += '// ── ' + zf + ' ──\n';
      combined += fs.readFileSync(path.join(genDir, zf), 'utf8');
      combined += '\n';
    }

    return { output: combined, error: null, files: zigFiles };
  } catch (err) {
    return { output: null, error: err.message };
  }
}

// ── Step 96: Atom path — reads output from parity_intercept.js via forge --parity ──

function runAtomEmit(cart) {
  // forge --parity runs both emitOutput() and runEmitAtoms() inside QuickJS.
  // The atom output is written to /tmp/tsz-gen/parity_atom_output.zig by forge.
  const atomFile = '/tmp/tsz-gen/parity_atom_output.zig';
  try {
    if (!fs.existsSync(atomFile)) {
      return { output: null, error: 'atom output file not found: ' + atomFile };
    }
    const atomOutput = fs.readFileSync(atomFile, 'utf8');
    if (atomOutput.startsWith('__PARITY_ERROR__')) {
      return { output: null, error: atomOutput };
    }
    return { output: atomOutput, error: null };
  } catch (err) {
    return { output: null, error: err.message };
  }
}

// ── Step 100: Split-output detection ──

function detectSplitOutput(genDir) {
  if (!fs.existsSync(genDir)) return false;
  const zigFiles = fs.readdirSync(genDir).filter(f => f.endsWith('.zig'));
  return zigFiles.length > 1;
}

// ── Step 101: Backend tag capture ──

function captureBackendTags(output) {
  if (!output) return [];
  const tags = [];
  if (output.indexOf('evalLuaMapData') >= 0) tags.push('lua_map');
  if (output.indexOf('rebuild_map') >= 0 || output.indexOf('rebuildMap') >= 0) tags.push('zig_map');
  if (output.indexOf('nested_map') >= 0 || output.indexOf('nestedMap') >= 0) tags.push('nested_map');
  if (output.indexOf('inline_map') >= 0 || output.indexOf('inlineMap') >= 0) tags.push('inline_map');
  if (output.indexOf('dynText') >= 0 || output.indexOf('dyn_text') >= 0) tags.push('dyn_text');
  if (output.indexOf('on_press') >= 0 || output.indexOf('onPress') >= 0) tags.push('handlers');
  if (output.indexOf('onRender') >= 0 || output.indexOf('effect') >= 0) tags.push('effects');
  if (output.indexOf('__variant') >= 0) tags.push('variants');
  return tags;
}

// ── Step 99: First-diff-hunk capture ──

function firstDiffHunk(a, b) {
  if (!a || !b) return null;
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const len = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < len; i++) {
    if (linesA[i] !== linesB[i]) {
      const start = Math.max(0, i - 2);
      const end = Math.min(len, i + 3);
      let hunk = '--- legacy line ' + (i + 1) + ' ---\n';
      for (let j = start; j < end && j < linesA.length; j++) {
        hunk += (j === i ? '> ' : '  ') + linesA[j] + '\n';
      }
      hunk += '+++ atom line ' + (i + 1) + ' +++\n';
      for (let j = start; j < end && j < linesB.length; j++) {
        hunk += (j === i ? '> ' : '  ') + linesB[j] + '\n';
      }
      return hunk;
    }
  }
  return null;
}

// ── Step 102: Predicted atom capture ──

function capturePredictedAtoms(cart) {
  // Route plan is available if forge was run with --dbg-compiler.
  // For now, return empty until route plan integration.
  return [];
}

// ── Step 114: Lane detection ──

function detectLane(cart) {
  if (cart.indexOf('/chad/') >= 0) return 'chad';
  if (cart.indexOf('/mixed/') >= 0) return 'mixed';
  if (cart.indexOf('/soup/') >= 0) return 'soup';
  if (cart.indexOf('/parity/') >= 0) return 'parity';
  return 'other';
}

// ── Main ──

const legacy = runLegacyEmit(cartPath);
const atoms = runAtomEmit(cartPath);

// ── Step 97: Hash both outputs ──

const legacyHash = legacy.output ? hashString(legacy.output) : 'error';
const atomHash = atoms.output ? hashString(atoms.output) : 'pending';

// ── Step 98: Exact diff status ──

let diffStatus;
if (!legacy.output) {
  diffStatus = 'ERROR';
} else if (!atoms.output) {
  diffStatus = 'PENDING';
} else if (legacyHash === atomHash) {
  diffStatus = 'MATCH';
} else {
  diffStatus = 'DIFF';
}

// ── Step 103: Schema-shaped JSON writing ──

const result = {
  cart_path: cartPath,
  lane: detectLane(cartPath),
  legacy_hash: legacyHash,
  atom_hash: atomHash,
  diff_status: diffStatus,
  first_diff_hunk: (diffStatus === 'DIFF') ? firstDiffHunk(legacy.output, atoms.output) : null,
  split_output: detectSplitOutput(genDir),
  backend_tags: captureBackendTags(legacy.output),
  predicted_atoms: capturePredictedAtoms(cartPath),
  verification_time: new Date().toISOString(),
  legacy_error: legacy.error || null,
  atom_error: atoms.error || null,
  legacy_files: legacy.files || null,
};

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
console.log('Parity result: ' + diffStatus + ' -> ' + outputFile);
if (legacy.output) {
  console.log('  legacy: ' + legacyHash.slice(0, 12) + '... (' + legacy.files.length + ' .zig files)');
  console.log('  tags: ' + result.backend_tags.join(', '));
}
if (legacy.error) {
  console.log('  legacy error: ' + legacy.error);
}
