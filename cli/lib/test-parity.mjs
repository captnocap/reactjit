import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const PACKAGE_TEST_PARITY = {
  nodeOnly: {
    'packages/ai/test/mcp-protocol.test.mjs': 'Pure JS protocol semantics with no Lua implementation.',
    'packages/ai/test/mcp-transport.test.mjs': 'Pure JS transport behavior with no Lua implementation.',
    'packages/ai/test/providers.test.mjs': 'Pure JS provider request/response formatting with no Lua implementation.',
    'packages/ai/test/stream.test.mjs': 'Pure JS stream parser behavior with no Lua implementation.',
    'packages/ai/test/tools.test.mjs': 'Pure JS tool orchestration with no Lua implementation.',
    'packages/3d/test/camera.test.mjs': 'Pure JS camera normalization math and preset mapping with no direct Lua-owned counterpart.',
    'packages/core/test/tw-roundtrip.test.mjs': 'Shared Tailwind conversion helpers; no Lua-owned counterpart.',
    'packages/data/test/interaction.test.mjs': 'Pure TS keyboard navigation and key normalization for spreadsheet UI interaction; no Lua-owned counterpart.',
    'packages/data/test/layout.test.mjs': 'Pure TS viewport-fit column layout math for the spreadsheet UI; no Lua-owned counterpart.',
    'packages/presentation/test/document.test.mjs': 'Pure JS document schema and patch application helpers shared by the future editor/player layers; no Lua-owned counterpart yet.',
    'packages/router/test/router.test.mjs': 'Pure JS routing state machine with no Lua implementation.',
    'packages/storage/test/format.test.mjs': 'Pure JS format parsing/serialization with no Lua implementation.',
    'packages/storage/test/migrations.test.mjs': 'Pure JS migration utilities with no Lua implementation.',
    'packages/storage/test/query.test.mjs': 'Pure JS query helpers with no Lua implementation.',
    'packages/time/test/timezone.test.mjs': 'Pure JS timezone/date formatting helpers with no Lua implementation.',
    'packages/time/test/utils.test.mjs': 'Pure JS time utilities with no Lua implementation.',
  },
  luaBacked: {
    'packages/chemistry/test/elements.test.mjs': {
      lua: ['packages/chemistry/test/elements-harness.lua'],
      reason: 'Element dataset and lookup semantics must stay aligned with lua/capabilities/chemistry.lua.',
    },
    'packages/data/test/address-utils.test.mjs': {
      lua: ['packages/data/test/address-harness.lua'],
      reason: 'Spreadsheet address helpers must stay aligned with lua/capabilities/data.lua address behavior.',
    },
  },
};

function toRepoPath(repoRoot, file) {
  const rel = file.startsWith(repoRoot)
    ? file.slice(repoRoot.length + 1)
    : file;
  return rel.replace(/\\/g, '/');
}

export function isPackageNodeTest(repoRoot, file) {
  const rel = toRepoPath(repoRoot, file);
  return rel.startsWith('packages/') && rel.includes('/test/') &&
    (rel.endsWith('.test.mjs') || rel.endsWith('.test.js'));
}

export function getPackageNodeTestPolicy(repoRoot, file) {
  const rel = toRepoPath(repoRoot, file);
  if (PACKAGE_TEST_PARITY.luaBacked[rel]) {
    return { kind: 'luaBacked', path: rel, ...PACKAGE_TEST_PARITY.luaBacked[rel] };
  }
  if (PACKAGE_TEST_PARITY.nodeOnly[rel]) {
    return { kind: 'nodeOnly', path: rel, reason: PACKAGE_TEST_PARITY.nodeOnly[rel] };
  }
  return null;
}

export function checkPackageTestParity({ repoRoot, nodeTests, luaTests }) {
  const failures = [];
  const packageNodeTests = nodeTests
    .map((file) => toRepoPath(repoRoot, file))
    .filter((file) => file.startsWith('packages/') && file.includes('/test/'));

  const nodeOnlyEntries = Object.entries(PACKAGE_TEST_PARITY.nodeOnly);
  const luaBackedEntries = Object.entries(PACKAGE_TEST_PARITY.luaBacked);
  const classified = new Set([
    ...nodeOnlyEntries.map(([file]) => file),
    ...luaBackedEntries.map(([file]) => file),
  ]);
  const discoveredLua = new Set(luaTests.map((file) => toRepoPath(repoRoot, file)));

  for (const file of packageNodeTests) {
    const inNodeOnly = Object.prototype.hasOwnProperty.call(PACKAGE_TEST_PARITY.nodeOnly, file);
    const inLuaBacked = Object.prototype.hasOwnProperty.call(PACKAGE_TEST_PARITY.luaBacked, file);
    if (!inNodeOnly && !inLuaBacked) {
      failures.push(
        `Unclassified package node test: ${file}\n` +
        '  Add it to cli/lib/test-parity.mjs as either nodeOnly or luaBacked.'
      );
    }
    if (inNodeOnly && inLuaBacked) {
      failures.push(`Package node test is classified twice: ${file}`);
    }
  }

  for (const file of classified) {
    if (!existsSync(resolve(repoRoot, file))) {
      failures.push(`Parity manifest references missing node test: ${file}`);
    }
  }

  for (const [file, reason] of nodeOnlyEntries) {
    if (!reason || typeof reason !== 'string') {
      failures.push(`Node-only test is missing a rationale: ${file}`);
    }
  }

  for (const [file, config] of luaBackedEntries) {
    if (!config.reason || typeof config.reason !== 'string') {
      failures.push(`Lua-backed test is missing a rationale: ${file}`);
    }
    if (!Array.isArray(config.lua) || config.lua.length === 0) {
      failures.push(`Lua-backed test is missing counterpart files: ${file}`);
      continue;
    }
    for (const luaFile of config.lua) {
      if (!existsSync(resolve(repoRoot, luaFile))) {
        failures.push(`Lua-backed test references missing Lua harness: ${luaFile}`);
        continue;
      }
      if (!discoveredLua.has(luaFile)) {
        failures.push(
          `Lua-backed test counterpart is not discoverable: ${luaFile}\n` +
          '  Place Lua harnesses under packages/*/test/ so rjit test can run them.'
        );
      }
    }
  }

  return failures;
}
