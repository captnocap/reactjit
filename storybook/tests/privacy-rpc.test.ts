// Privacy RPC tests — all bridge-based operations
import {
  setPrivacyBridge,
  shamirSplit, shamirCombine,
  hkdfDerive,
  secureAlloc, secureRead, secureFree, secureProtect,
  anonymousId, pseudonym,
  tokenize,
  hashFile,
  envelopeEncrypt, envelopeDecrypt,
  createEncryptedStore,
  createAuditLog, appendAudit, verifyAudit, auditEntries,
} from '@reactjit/privacy';

const bridge = (globalThis as any).__rjitBridge;
if (bridge) setPrivacyBridge(bridge);

// ── Shamir ──

test('shamir split/combine', async () => {
  const secret = 'deadbeefcafebabe';
  const shares = await shamirSplit(secret, 5, 3);
  if (shares.length !== 5) throw new Error(`Expected 5 shares, got ${shares.length}`);
  const recovered = await shamirCombine(shares.slice(0, 3));
  if (recovered !== secret) throw new Error(`Expected "${secret}", got "${recovered}"`);
});

test('shamir different subsets', async () => {
  const secret = 'aabbccdd11223344';
  const shares = await shamirSplit(secret, 5, 3);
  const r1 = await shamirCombine([shares[0], shares[2], shares[4]]);
  if (r1 !== secret) throw new Error(`Subset [0,2,4] failed: "${r1}"`);
});

test('shamir share structure', async () => {
  const shares = await shamirSplit('ff00ff00', 3, 2);
  for (const share of shares) {
    if (typeof share.index !== 'number') throw new Error(`Share index should be number`);
    if (typeof share.hex !== 'string') throw new Error(`Share hex should be string`);
  }
});

// ── HKDF ──

test('hkdf derives 32-byte key', async () => {
  const key = await hkdfDerive('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
  if (key.length !== 64) throw new Error(`Expected 64 hex chars, got ${key.length}`);
});

test('hkdf different info', async () => {
  const k1 = await hkdfDerive('aabbccdd', { info: '01' });
  const k2 = await hkdfDerive('aabbccdd', { info: '02' });
  if (k1 === k2) throw new Error('Same keys');
});

test('hkdf custom length', async () => {
  const key = await hkdfDerive('aabbccdd', { length: 16 });
  if (key.length !== 32) throw new Error(`Expected 32 hex chars (16 bytes), got ${key.length}`);
});

test('hkdf deterministic', async () => {
  const k1 = await hkdfDerive('aabb', { salt: 'ccdd', info: 'eeff' });
  const k2 = await hkdfDerive('aabb', { salt: 'ccdd', info: 'eeff' });
  if (k1 !== k2) throw new Error('Not deterministic');
});

// ── Secure Memory ──

test('secmem alloc/read/free', async () => {
  const data = 'deadbeef12345678';
  const handle = await secureAlloc(data);
  if (typeof handle !== 'number') throw new Error(`Expected number, got ${typeof handle}`);
  const readBack = await secureRead(handle);
  if (readBack !== data) throw new Error(`Expected "${data}", got "${readBack}"`);
  await secureFree(handle);
});

test('secmem protect modes', async () => {
  const handle = await secureAlloc('aabbccdd');
  await secureProtect(handle, 'readonly');
  await secureProtect(handle, 'readwrite');
  const data = await secureRead(handle);
  if (data !== 'aabbccdd') throw new Error(`Data corrupted: ${data}`);
  await secureFree(handle);
});

test('secmem unique handles', async () => {
  const h1 = await secureAlloc('aaaa');
  const h2 = await secureAlloc('bbbb');
  if (h1 === h2) throw new Error('Handles should be unique');
  if (await secureRead(h1) !== 'aaaa') throw new Error('Handle 1 wrong');
  if (await secureRead(h2) !== 'bbbb') throw new Error('Handle 2 wrong');
  await secureFree(h1);
  await secureFree(h2);
});

// ── Identity ──

test('anonymousId deterministic', async () => {
  const id1 = await anonymousId('domain', 'seed');
  const id2 = await anonymousId('domain', 'seed');
  if (id1 !== id2) throw new Error('Not deterministic');
});

test('anonymousId differs across domains', async () => {
  const id1 = await anonymousId('a', 'seed');
  const id2 = await anonymousId('b', 'seed');
  if (id1 === id2) throw new Error('Same across domains');
});

test('pseudonym context-specific', async () => {
  const master = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';
  const p1 = await pseudonym(master, 'email');
  const p2 = await pseudonym(master, 'username');
  if (p1 === p2) throw new Error('Same across contexts');
  const p1b = await pseudonym(master, 'email');
  if (p1 !== p1b) throw new Error('Not deterministic');
});

// ── Tokenize ──

test('tokenize deterministic', async () => {
  const t1 = await tokenize('user@example.com', 'salt123');
  const t2 = await tokenize('user@example.com', 'salt123');
  if (t1 !== t2) throw new Error('Not deterministic');
  const t3 = await tokenize('user@example.com', 'different-salt');
  if (t1 === t3) throw new Error('Same with different salt');
});

// ── File integrity ──

test('hashFile produces hash', async () => {
  const hash = await hashFile('/etc/hostname');
  if (typeof hash !== 'string') throw new Error(`Expected string, got ${typeof hash}`);
  if (hash.length < 32) throw new Error(`Hash too short: ${hash.length}`);
});

test('hashFile deterministic', async () => {
  const h1 = await hashFile('/etc/hostname', 'sha256');
  const h2 = await hashFile('/etc/hostname', 'sha256');
  if (h1 !== h2) throw new Error('Not deterministic');
});

// ── Envelope Encryption ──

test('envelope encrypt/decrypt round-trip', async () => {
  const kek = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';
  const plaintext = 'deadbeefcafebabe';
  const envelope = await envelopeEncrypt(plaintext, kek);
  if (!envelope.encryptedDEK) throw new Error('Missing encryptedDEK');
  if (!envelope.ciphertext) throw new Error('Missing ciphertext');
  const recovered = await envelopeDecrypt(envelope, kek);
  if (recovered !== plaintext) throw new Error(`Expected "${plaintext}", got "${recovered}"`);
});

// ── Encrypted Store ──

test('encrypted store set/get', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store', password: 'testpass123' });
  await store.set('greeting', 'hello world');
  const val = await store.get('greeting');
  if (val !== 'hello world') throw new Error(`Expected "hello world", got "${val}"`);
  await store.close();
});

test('encrypted store null for missing', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store2', password: 'pass' });
  const val = await store.get('nonexistent');
  if (val !== null) throw new Error(`Expected null, got ${val}`);
  await store.close();
});

test('encrypted store delete', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store3', password: 'pass' });
  await store.set('key1', 'value1');
  await store.delete('key1');
  const val = await store.get('key1');
  if (val !== null) throw new Error(`Expected null after delete, got ${val}`);
  await store.close();
});

test('encrypted store list keys', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store4', password: 'pass' });
  await store.set('alpha', 1);
  await store.set('beta', 2);
  const keys = await store.list();
  if (keys.length !== 2) throw new Error(`Expected 2 keys, got ${keys.length}`);
  await store.close();
});

// ── Audit Log ──

test('audit log append and verify', async () => {
  createAuditLog('test-chain-key-hex-0123456789abcdef');
  const e1 = await appendAudit('user.login', { userId: 'alice' });
  if (e1.index !== 0) throw new Error(`Expected index 0, got ${e1.index}`);
  if (e1.prevHash !== '0') throw new Error(`First prevHash should be "0"`);
  const e2 = await appendAudit('file.access', { path: '/secret.txt' });
  if (e2.prevHash !== e1.hash) throw new Error('Chain broken');
  const v = await verifyAudit();
  if (!v.valid) throw new Error('Verification failed');
  if (v.entries !== 2) throw new Error(`Expected 2 entries, got ${v.entries}`);
});

test('audit entries range', async () => {
  createAuditLog('another-chain-key-fedcba9876543210');
  await appendAudit('event1');
  await appendAudit('event2');
  await appendAudit('event3');
  const all = await auditEntries();
  if (all.length !== 3) throw new Error(`Expected 3, got ${all.length}`);
  const slice = await auditEntries({ from: 1, to: 2 });
  if (slice.length !== 1) throw new Error(`Expected 1, got ${slice.length}`);
});
