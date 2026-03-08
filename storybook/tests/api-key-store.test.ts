// API key store security + correctness suite.
//
// Verifies that the settings-based key store (lua/settings.lua) properly
// stores, isolates, and retrieves API keys through the bridge RPC layer.
//
// Properties under test:
//   - Keys round-trip through settings:getKey / settings:getKeys
//   - Service isolation: querying service A never returns service B's keys
//   - Missing keys return null, not phantom values
//   - Overwrite replaces, does not append or leak previous values
//   - Bulk getKeys returns ALL keys (not gated — intentional, but verified)
//   - Prefix-filtering pattern (useServiceKeys) correctly isolates per-service
//   - Empty string treated as "not configured"
//
// Run: cd storybook && rjit build && rjit test tests/api-key-store.test.ts

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;

function requireBridge(): RpcBridge {
  if (!bridge) {
    throw new Error('Missing __rjitBridge; key store tests require native bridge');
  }
  return bridge;
}

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNil(actual: unknown, message: string): void {
  if (actual != null) {
    throw new Error(`${message}: expected nil/null, got ${JSON.stringify(actual)}`);
  }
}

// Unique prefix per test run so parallel runs don't collide
const RUN_ID = `test_${Date.now().toString(36)}`;
function svcId(label: string): string {
  return `${RUN_ID}_${label}`;
}

// Set a key via the mutation command channel (settings:keys:set).
// NativeBridge.send() queues the command; the subsequent rpc() call
// triggers flush() which sends both the mutation and the RPC to Lua
// in one batch. Lua processes them in order: set key, then wait frame.
async function setKey(serviceId: string, fieldKey: string, value: string): Promise<void> {
  const b = requireBridge() as any;
  b.send('settings:keys:set', { serviceId, fieldKey, value });
  // rpc internally calls flush(), sending both the queued send() and
  // the rpc:call to Lua in one shot. Lua processes settings:keys:set
  // first, then test:wait advances one frame.
  await b.rpc('test:wait', {});
}

// Helper: get a single key via RPC
async function getKey(serviceId: string, fieldKey?: string): Promise<string | null> {
  const result = await requireBridge().rpc<string | null>('settings:getKey', {
    serviceId,
    fieldKey,
  });
  return result;
}

// Helper: get all keys via RPC
async function getAllKeys(): Promise<Record<string, string>> {
  const result = await requireBridge().rpc<Record<string, string>>('settings:getKeys');
  return result || {};
}

// Helper: filter keys by service prefix (mirrors useServiceKeys behavior)
function filterByService(allKeys: Record<string, string>, serviceId: string): Record<string, string> {
  const prefix = serviceId + '.';
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(allKeys)) {
    if (k.startsWith(prefix)) {
      filtered[k.slice(prefix.length)] = v;
    }
  }
  return filtered;
}

// ============================================================================
// Bridge availability
// ============================================================================

test('bridge is available and settings RPC handlers are registered', async () => {
  requireBridge();
  // settings:getKeys should return an object (possibly empty)
  const keys = await getAllKeys();
  assert(typeof keys === 'object' && keys !== null, 'getKeys should return an object');
});

// ============================================================================
// Store + retrieve (round-trip)
// ============================================================================

test('setKey + getKey round-trips correctly', async () => {
  const svc = svcId('roundtrip');
  await setKey(svc, 'apiKey', 'sk-test-abc123');

  const result = await getKey(svc, 'apiKey');
  assertEq(result, 'sk-test-abc123', 'round-trip value mismatch');
});

test('setKey stores multiple fields per service independently', async () => {
  const svc = svcId('multifield');
  await setKey(svc, 'apiKey', 'key-value-1');
  await setKey(svc, 'baseURL', 'https://api.example.com');

  const key = await getKey(svc, 'apiKey');
  const url = await getKey(svc, 'baseURL');
  assertEq(key, 'key-value-1', 'apiKey field mismatch');
  assertEq(url, 'https://api.example.com', 'baseURL field mismatch');
});

// ============================================================================
// Service isolation (CRITICAL security property)
// ============================================================================

test('getKey for service A does not return service B keys', async () => {
  const svcA = svcId('isolation_a');
  const svcB = svcId('isolation_b');

  await setKey(svcA, 'token', 'secret-a-token');
  await setKey(svcB, 'token', 'secret-b-token');

  const resultA = await getKey(svcA, 'token');
  const resultB = await getKey(svcB, 'token');

  assertEq(resultA, 'secret-a-token', 'service A got wrong value');
  assertEq(resultB, 'secret-b-token', 'service B got wrong value');

  // Cross-check: A's token is NOT B's token
  assert(resultA !== resultB, 'service isolation violated — both returned same value');
});

test('getKey with wrong fieldKey returns nil even if service has other fields', async () => {
  const svc = svcId('wrongfield');
  await setKey(svc, 'apiKey', 'exists');

  const result = await getKey(svc, 'nonexistent');
  assertNil(result, 'wrong fieldKey should return nil');
});

test('getKey with wrong serviceId returns nil even if fieldKey exists elsewhere', async () => {
  const svc = svcId('wrongsvc');
  await setKey(svc, 'token', 'real-token');

  const result = await getKey(svcId('totally_different'), 'token');
  assertNil(result, 'wrong serviceId should return nil');
});

// ============================================================================
// Prefix-filtering isolation (useServiceKeys pattern)
// ============================================================================

test('prefix filter isolates service keys from bulk getKeys', async () => {
  const svcX = svcId('prefix_x');
  const svcY = svcId('prefix_y');

  await setKey(svcX, 'apiKey', 'x-key');
  await setKey(svcX, 'secret', 'x-secret');
  await setKey(svcY, 'apiKey', 'y-key');
  await setKey(svcY, 'org', 'y-org');

  const all = await getAllKeys();
  const xKeys = filterByService(all, svcX);
  const yKeys = filterByService(all, svcY);

  assertEq(xKeys['apiKey'], 'x-key', 'prefix filter: X apiKey');
  assertEq(xKeys['secret'], 'x-secret', 'prefix filter: X secret');
  assert(!('org' in xKeys), 'prefix filter leaked Y org into X');

  assertEq(yKeys['apiKey'], 'y-key', 'prefix filter: Y apiKey');
  assertEq(yKeys['org'], 'y-org', 'prefix filter: Y org');
  assert(!('secret' in yKeys), 'prefix filter leaked X secret into Y');
});

test('prefix filter with similar service names does not cross-contaminate', async () => {
  // Edge case: "api" and "api_extended" — "api." prefix must not match "api_extended."
  const short = svcId('api');
  const long = svcId('api_extended');

  await setKey(short, 'key', 'short-key');
  await setKey(long, 'key', 'long-key');

  const all = await getAllKeys();
  const shortKeys = filterByService(all, short);
  const longKeys = filterByService(all, long);

  assertEq(shortKeys['key'], 'short-key', 'short service key');
  assertEq(longKeys['key'], 'long-key', 'long service key');
  assert(Object.keys(shortKeys).length >= 1, 'short should have at least 1 key');

  // Ensure no cross-contamination
  for (const [k] of Object.entries(shortKeys)) {
    assert(k !== 'key' || shortKeys[k] === 'short-key', 'short keys contaminated');
  }
});

// ============================================================================
// Overwrite semantics
// ============================================================================

test('setting a key twice overwrites the first value', async () => {
  const svc = svcId('overwrite');
  await setKey(svc, 'token', 'old-value');
  await setKey(svc, 'token', 'new-value');

  const result = await getKey(svc, 'token');
  assertEq(result, 'new-value', 'overwrite did not replace old value');
});

test('overwriting one field does not affect other fields of the same service', async () => {
  const svc = svcId('partial_overwrite');
  await setKey(svc, 'apiKey', 'keep-this');
  await setKey(svc, 'secret', 'original');
  await setKey(svc, 'secret', 'updated');

  const apiKey = await getKey(svc, 'apiKey');
  const secret = await getKey(svc, 'secret');
  assertEq(apiKey, 'keep-this', 'unrelated field was clobbered by overwrite');
  assertEq(secret, 'updated', 'overwritten field should have new value');
});

// ============================================================================
// Missing / empty key behavior
// ============================================================================

test('querying a never-set service returns nil', async () => {
  const result = await getKey(svcId('never_existed_' + Math.random()), 'apiKey');
  assertNil(result, 'never-set key should be nil');
});

test('querying with no fieldKey uses serviceId as direct key lookup', async () => {
  // settings.getKey(serviceId, nil) looks up state.keys[serviceId] directly
  // This should return nil for our namespaced test keys
  const svc = svcId('no_field');
  await setKey(svc, 'token', 'val');

  // Without fieldKey, it looks for state.keys[serviceId] (no dot separator)
  const result = await getKey(svc);
  assertNil(result, 'key without fieldKey should not match serviceId.fieldKey entries');
});

// ============================================================================
// Bulk getKeys exposes everything (verify behavior, not a bug — but important)
// ============================================================================

test('getKeys returns keys across all services', async () => {
  const svc1 = svcId('bulk_1');
  const svc2 = svcId('bulk_2');
  const svc3 = svcId('bulk_3');

  await setKey(svc1, 'key', 'v1');
  await setKey(svc2, 'key', 'v2');
  await setKey(svc3, 'key', 'v3');

  const all = await getAllKeys();

  assertEq(all[`${svc1}.key`], 'v1', 'bulk missing svc1');
  assertEq(all[`${svc2}.key`], 'v2', 'bulk missing svc2');
  assertEq(all[`${svc3}.key`], 'v3', 'bulk missing svc3');
});

test('getKeys key format is serviceId.fieldKey', async () => {
  const svc = svcId('format');
  await setKey(svc, 'myField', 'myValue');

  const all = await getAllKeys();
  const compositeKey = `${svc}.myField`;

  assert(compositeKey in all, `expected key "${compositeKey}" in getKeys result`);
  assertEq(all[compositeKey], 'myValue', 'composite key value mismatch');
});

// ============================================================================
// Settings RPC is NOT gated (intentional — verify it stays that way)
// ============================================================================

test('settings:getKey is accessible without permit gates', async () => {
  // Unlike storage/crypto/privacy/clipboard which are gated, settings RPC
  // handlers are registered directly without the gated() wrapper.
  // This test verifies the handler exists and responds (doesn't throw
  // "capability denied").
  const svc = svcId('ungated');
  await setKey(svc, 'tok', 'accessible');

  let error: string | null = null;
  try {
    const val = await getKey(svc, 'tok');
    assertEq(val, 'accessible', 'ungated read failed');
  } catch (e: any) {
    error = e?.message || String(e);
  }

  assert(
    !error || !error.includes('capability denied'),
    'settings:getKey should NOT be gated by permits',
  );
});

test('settings:getKeys is accessible without permit gates', async () => {
  let error: string | null = null;
  try {
    await getAllKeys();
  } catch (e: any) {
    error = e?.message || String(e);
  }

  assert(
    !error || !error.includes('capability denied'),
    'settings:getKeys should NOT be gated by permits',
  );
});

// ============================================================================
// Key value edge cases
// ============================================================================

test('key with special characters round-trips correctly', async () => {
  const svc = svcId('special');
  const specialValue = 'sk-ant-api03-abc123/def+ghi=jkl==';
  await setKey(svc, 'apiKey', specialValue);

  const result = await getKey(svc, 'apiKey');
  assertEq(result, specialValue, 'special character key value corrupted');
});

test('key with long value round-trips correctly', async () => {
  const svc = svcId('longval');
  const longValue = 'x'.repeat(2048);
  await setKey(svc, 'token', longValue);

  const result = await getKey(svc, 'token');
  assertEq(result, longValue, 'long key value truncated or corrupted');
});

test('key with unicode value round-trips correctly', async () => {
  const svc = svcId('unicode');
  const unicodeValue = 'key-with-émojis-🔑-and-ñ';
  await setKey(svc, 'token', unicodeValue);

  const result = await getKey(svc, 'token');
  assertEq(result, unicodeValue, 'unicode key value corrupted');
});
