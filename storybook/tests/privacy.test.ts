// Privacy package test suite — tests both pure-TS functions and Lua FFI via RPC.
//
// Pure-TS functions (no bridge needed):
//   detectPII, redactPII, maskValue, redactLog
//   stegEmbedWhitespace, stegExtractWhitespace
//   checkAlgorithmStrength, validateConfig, RECOMMENDED_DEFAULTS
//   sanitizeFilename, normalizeTimestamp
//
// RPC functions (bridge must be set, which the storybook app does on startup):
//   shamirSplit, shamirCombine, hkdfDerive
//   secureAlloc, secureRead, secureFree, secureProtect
//   createEncryptedStore
//   appendAudit, verifyAudit, createAuditLog, auditEntries
//   hashFile
//   anonymousId, pseudonym
//   envelopeEncrypt, envelopeDecrypt
//   tokenize
//
// Run:  cd storybook && rjit build && rjit test tests/privacy.test.ts --timeout=60

import {
  detectPII,
  redactPII,
  maskValue,
  redactLog,
  stegEmbedWhitespace,
  stegExtractWhitespace,
  checkAlgorithmStrength,
  validateConfig,
  RECOMMENDED_DEFAULTS,
  sanitizeFilename,
  normalizeTimestamp,
} from '@reactjit/privacy';

// RPC-based functions
import { shamirSplit, shamirCombine } from '@reactjit/privacy';
import { hkdfDerive } from '@reactjit/privacy';
import { secureAlloc, secureRead, secureFree, secureProtect } from '@reactjit/privacy';
import { createEncryptedStore } from '@reactjit/privacy';
import { createAuditLog, appendAudit, verifyAudit, auditEntries } from '@reactjit/privacy';
import { hashFile } from '@reactjit/privacy';
import { anonymousId, pseudonym } from '@reactjit/privacy';
import { envelopeEncrypt, envelopeDecrypt } from '@reactjit/privacy';
import { tokenize } from '@reactjit/privacy';
import { setPrivacyBridge } from '@reactjit/privacy';

// Initialize the spec's own copy of the bridge from the global set by the storybook app.
// esbuild bundles the spec separately, creating a duplicate rpc.ts module with _bridge=null.
// This call initializes THIS copy so RPC-based tests can work.
const bridge = (globalThis as any).__rjitBridge;
if (bridge) {
  setPrivacyBridge(bridge);
}

// ============================================================================
// PII Detection & Redaction (pure TS)
// ============================================================================

test('detectPII finds email addresses', async () => {
  const matches = detectPII('Contact me at user@example.com for details');
  const emails = matches.filter(m => m.type === 'email');
  if (emails.length !== 1) throw new Error(`Expected 1 email, got ${emails.length}`);
  if (emails[0].value !== 'user@example.com') throw new Error(`Expected user@example.com, got ${emails[0].value}`);
});

test('detectPII finds phone numbers', async () => {
  const matches = detectPII('Call me at (555) 123-4567 or 555.987.6543');
  const phones = matches.filter(m => m.type === 'phone');
  if (phones.length < 2) throw new Error(`Expected 2+ phones, got ${phones.length}`);
});

test('detectPII finds SSNs', async () => {
  const matches = detectPII('SSN: 123-45-6789');
  const ssns = matches.filter(m => m.type === 'ssn');
  if (ssns.length !== 1) throw new Error(`Expected 1 SSN, got ${ssns.length}`);
});

test('detectPII finds IPv4 addresses', async () => {
  const matches = detectPII('Server at 192.168.1.100 is down');
  const ips = matches.filter(m => m.type === 'ipv4');
  if (ips.length !== 1) throw new Error(`Expected 1 IPv4, got ${ips.length}`);
  if (ips[0].value !== '192.168.1.100') throw new Error(`Expected 192.168.1.100, got ${ips[0].value}`);
});

test('detectPII finds credit card numbers', async () => {
  const matches = detectPII('Card: 4111 1111 1111 1111');
  const cards = matches.filter(m => m.type === 'creditCard');
  if (cards.length !== 1) throw new Error(`Expected 1 credit card, got ${cards.length}`);
});

test('detectPII returns empty array for clean text', async () => {
  const matches = detectPII('This is a normal sentence with no PII.');
  if (matches.length !== 0) throw new Error(`Expected 0 matches, got ${matches.length}`);
});

test('redactPII replaces all PII with [REDACTED]', async () => {
  const input = 'Email: user@example.com, SSN: 123-45-6789';
  const result = redactPII(input);
  if (result.includes('user@example.com')) throw new Error('Email not redacted');
  if (result.includes('123-45-6789')) throw new Error('SSN not redacted');
  if (!result.includes('[REDACTED]')) throw new Error('Missing [REDACTED] marker');
});

test('redactPII with custom replacement', async () => {
  const result = redactPII('Email: test@test.com', { replacement: '***' });
  if (!result.includes('***')) throw new Error('Custom replacement not applied');
  if (result.includes('test@test.com')) throw new Error('Email not replaced');
});

test('redactPII with mask option', async () => {
  const result = redactPII('Card: 4111111111111111', { types: ['creditCard'], mask: true });
  // Should show masked value like ****1111
  if (result.includes('4111111111111111')) throw new Error('Card not masked');
});

test('redactLog is an alias for redactPII with all types', async () => {
  const input = '[INFO] user@test.com accessed 192.168.1.1';
  const result = redactLog(input);
  if (result.includes('user@test.com')) throw new Error('Email not redacted in log');
  if (result.includes('192.168.1.1')) throw new Error('IP not redacted in log');
});

// ============================================================================
// Data Masking (pure TS)
// ============================================================================

test('maskValue shows last 4 chars by default', async () => {
  const result = maskValue('4111111111111111');
  if (!result.endsWith('1111')) throw new Error(`Expected to end with 1111, got: ${result}`);
  if (result.length !== 16) throw new Error(`Expected length 16, got ${result.length}`);
  if (!result.startsWith('****')) throw new Error(`Expected to start with ****, got: ${result}`);
});

test('maskValue with custom visible chars', async () => {
  const result = maskValue('secret_value', { visibleEnd: 2, maskChar: '#' });
  if (!result.endsWith('ue')) throw new Error(`Expected to end with ue, got: ${result}`);
  if (!result.includes('#')) throw new Error('Custom mask char not used');
});

test('maskValue with visible start', async () => {
  const result = maskValue('4111111111111111', { visibleStart: 4, visibleEnd: 4 });
  if (!result.startsWith('4111')) throw new Error(`Expected to start with 4111, got: ${result}`);
  if (!result.endsWith('1111')) throw new Error(`Expected to end with 1111, got: ${result}`);
});

// ============================================================================
// Whitespace Steganography (pure TS)
// ============================================================================

test('steg whitespace round-trip preserves secret', async () => {
  const carrier = 'Hello, this is a normal message.';
  const secret = 'hidden';
  const encoded = stegEmbedWhitespace(carrier, secret);
  const extracted = stegExtractWhitespace(encoded);
  if (extracted !== secret) throw new Error(`Expected "${secret}", got "${extracted}"`);
});

test('steg whitespace carrier retains visible text', async () => {
  const carrier = 'ABCDE';
  const encoded = stegEmbedWhitespace(carrier, 'hi');
  // Remove zero-width chars to get visible text
  const visible = encoded.replace(/[\u200B\u200C]/g, '');
  if (visible !== carrier) throw new Error(`Visible text changed: "${visible}" !== "${carrier}"`);
});

test('steg whitespace empty secret returns carrier unchanged', async () => {
  const carrier = 'Hello world';
  const encoded = stegEmbedWhitespace(carrier, '');
  const extracted = stegExtractWhitespace(encoded);
  if (extracted !== '') throw new Error(`Expected empty string, got "${extracted}"`);
});

// ============================================================================
// Algorithm Safety (pure TS)
// ============================================================================

test('checkAlgorithmStrength identifies strong algorithms', async () => {
  const result = checkAlgorithmStrength('xchacha20-poly1305');
  if (result.strength !== 'strong') throw new Error(`Expected strong, got ${result.strength}`);
  if (result.deprecated) throw new Error('Strong algorithm should not be deprecated');
});

test('checkAlgorithmStrength identifies weak algorithms', async () => {
  const result = checkAlgorithmStrength('md5');
  if (result.strength !== 'weak') throw new Error(`Expected weak, got ${result.strength}`);
  if (!result.deprecated) throw new Error('MD5 should be deprecated');
});

test('checkAlgorithmStrength identifies broken algorithms', async () => {
  const result = checkAlgorithmStrength('md4');
  if (result.strength !== 'broken') throw new Error(`Expected broken, got ${result.strength}`);
  if (!result.recommendation) throw new Error('Broken algorithm should have recommendation');
});

test('checkAlgorithmStrength classifies acceptable algorithms', async () => {
  const result = checkAlgorithmStrength('scrypt');
  if (result.strength !== 'acceptable') throw new Error(`Expected acceptable, got ${result.strength}`);
});

test('validateConfig accepts valid config', async () => {
  const result = validateConfig({
    algorithm: 'xchacha20-poly1305',
    keySize: 32,
    nonceSize: 24,
    saltSize: 16,
  });
  if (!result.valid) throw new Error(`Expected valid, got errors: ${result.errors.join(', ')}`);
});

test('validateConfig rejects broken algorithm', async () => {
  const result = validateConfig({ algorithm: 'md4' });
  if (result.valid) throw new Error('Should reject broken algorithm');
  if (result.errors.length === 0) throw new Error('Should have errors');
});

test('validateConfig rejects small key size', async () => {
  const result = validateConfig({ keySize: 8 });
  if (result.valid) throw new Error('Should reject key size < 16');
});

test('validateConfig warns on suboptimal params', async () => {
  const result = validateConfig({ keySize: 16, saltSize: 8 });
  if (result.warnings.length === 0) throw new Error('Should warn on below-recommended params');
});

test('RECOMMENDED_DEFAULTS has sane values', async () => {
  if (RECOMMENDED_DEFAULTS.algorithm !== 'xchacha20-poly1305') throw new Error('Wrong default algorithm');
  if (RECOMMENDED_DEFAULTS.kdf !== 'argon2id') throw new Error('Wrong default KDF');
  if (RECOMMENDED_DEFAULTS.keySize !== 32) throw new Error('Wrong default key size');
});

// ============================================================================
// Filename Sanitization (pure TS)
// ============================================================================

test('sanitizeFilename strips path traversal', async () => {
  const result = sanitizeFilename('../../../etc/passwd');
  if (result.includes('../')) throw new Error(`Path traversal not stripped: ${result}`);
});

test('sanitizeFilename strips null bytes', async () => {
  const result = sanitizeFilename('file\0name.txt');
  if (result.includes('\0')) throw new Error('Null byte not stripped');
  if (result !== 'filename.txt') throw new Error(`Expected "filename.txt", got "${result}"`);
});

test('sanitizeFilename strips control characters', async () => {
  const result = sanitizeFilename('file\x01\x02name.txt');
  if (result !== 'filename.txt') throw new Error(`Expected "filename.txt", got "${result}"`);
});

test('sanitizeFilename preserves normal filenames', async () => {
  const result = sanitizeFilename('my-document_v2.pdf');
  if (result !== 'my-document_v2.pdf') throw new Error(`Changed clean filename: ${result}`);
});

// ============================================================================
// Timestamp Normalization (pure TS)
// ============================================================================

test('normalizeTimestamp removes milliseconds', async () => {
  const result = normalizeTimestamp('2024-01-15T10:30:45.123Z');
  if (result !== '2024-01-15T10:30:45Z') throw new Error(`Expected no ms, got: ${result}`);
});

test('normalizeTimestamp handles Date objects', async () => {
  const d = new Date('2024-06-15T12:00:00Z');
  const result = normalizeTimestamp(d);
  if (!result.endsWith('Z')) throw new Error(`Expected UTC, got: ${result}`);
  if (result.includes('.')) throw new Error(`Should not have ms: ${result}`);
});

// ============================================================================
// Shamir's Secret Sharing (RPC — Lua FFI)
// ============================================================================

test('shamir split/combine round-trip', async () => {
  const secret = 'deadbeefcafebabe';
  const shares = await shamirSplit(secret, 5, 3);

  if (shares.length !== 5) throw new Error(`Expected 5 shares, got ${shares.length}`);

  // Combine with first 3 shares
  const recovered = await shamirCombine(shares.slice(0, 3));
  if (recovered !== secret) throw new Error(`Expected "${secret}", got "${recovered}"`);
});

test('shamir combine with different share subsets', async () => {
  const secret = 'aabbccdd11223344';
  const shares = await shamirSplit(secret, 5, 3);

  // Combine with shares [0, 2, 4]
  const subset = [shares[0], shares[2], shares[4]];
  const recovered = await shamirCombine(subset);
  if (recovered !== secret) throw new Error(`Subset [0,2,4] failed: got "${recovered}"`);

  // Combine with shares [1, 3, 4]
  const subset2 = [shares[1], shares[3], shares[4]];
  const recovered2 = await shamirCombine(subset2);
  if (recovered2 !== secret) throw new Error(`Subset [1,3,4] failed: got "${recovered2}"`);
});

test('shamir shares have correct structure', async () => {
  const shares = await shamirSplit('ff00ff00', 3, 2);
  for (const share of shares) {
    if (typeof share.index !== 'number') throw new Error(`Share index should be number, got ${typeof share.index}`);
    if (typeof share.hex !== 'string') throw new Error(`Share hex should be string, got ${typeof share.hex}`);
    if (share.hex.length !== 8) throw new Error(`Share hex length should be 8, got ${share.hex.length}`);
  }
});

// ============================================================================
// HKDF Key Derivation (RPC — Lua FFI)
// ============================================================================

test('hkdf derives a 32-byte key by default', async () => {
  const key = await hkdfDerive('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
  if (typeof key !== 'string') throw new Error(`Expected string, got ${typeof key}`);
  if (key.length !== 64) throw new Error(`Expected 64 hex chars (32 bytes), got ${key.length}`);
});

test('hkdf with salt and info produces different keys', async () => {
  const ikm = 'aabbccdd';
  const key1 = await hkdfDerive(ikm, { info: '01' });
  const key2 = await hkdfDerive(ikm, { info: '02' });
  if (key1 === key2) throw new Error('Different info should produce different keys');
});

test('hkdf respects custom output length', async () => {
  const key = await hkdfDerive('aabbccdd', { length: 16 });
  if (key.length !== 32) throw new Error(`Expected 32 hex chars (16 bytes), got ${key.length}`);
});

test('hkdf is deterministic', async () => {
  const key1 = await hkdfDerive('aabb', { salt: 'ccdd', info: 'eeff' });
  const key2 = await hkdfDerive('aabb', { salt: 'ccdd', info: 'eeff' });
  if (key1 !== key2) throw new Error('Same inputs should produce same output');
});

// ============================================================================
// Secure Memory (RPC — Lua FFI, libsodium)
// ============================================================================

test('secure memory alloc/read/free round-trip', async () => {
  const data = 'deadbeef12345678';
  const handle = await secureAlloc(data);
  if (typeof handle !== 'number') throw new Error(`Expected number handle, got ${typeof handle}`);

  const readBack = await secureRead(handle);
  if (readBack !== data) throw new Error(`Expected "${data}", got "${readBack}"`);

  await secureFree(handle);
});

test('secure memory protect modes', async () => {
  const handle = await secureAlloc('aabbccdd');

  // Set to readonly
  await secureProtect(handle, 'readonly');

  // Set back to readwrite so we can read
  await secureProtect(handle, 'readwrite');
  const data = await secureRead(handle);
  if (data !== 'aabbccdd') throw new Error(`Data corrupted after protect cycle: ${data}`);

  await secureFree(handle);
});

test('secure memory handles are unique', async () => {
  const h1 = await secureAlloc('aaaa');
  const h2 = await secureAlloc('bbbb');
  if (h1 === h2) throw new Error('Handles should be unique');

  const d1 = await secureRead(h1);
  const d2 = await secureRead(h2);
  if (d1 !== 'aaaa') throw new Error(`Handle 1 data wrong: ${d1}`);
  if (d2 !== 'bbbb') throw new Error(`Handle 2 data wrong: ${d2}`);

  await secureFree(h1);
  await secureFree(h2);
});

// ============================================================================
// Encrypted Store (RPC)
// ============================================================================

test('encrypted store set/get round-trip', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store', password: 'testpass123' });

  await store.set('greeting', 'hello world');
  const val = await store.get('greeting');
  if (val !== 'hello world') throw new Error(`Expected "hello world", got "${val}"`);

  await store.close();
});

test('encrypted store returns null for missing keys', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store2', password: 'pass' });

  const val = await store.get('nonexistent');
  if (val !== null) throw new Error(`Expected null, got ${val}`);

  await store.close();
});

test('encrypted store delete removes keys', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store3', password: 'pass' });

  await store.set('key1', 'value1');
  await store.delete('key1');
  const val = await store.get('key1');
  if (val !== null) throw new Error(`Expected null after delete, got ${val}`);

  await store.close();
});

test('encrypted store list returns all keys', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store4', password: 'pass' });

  await store.set('alpha', 1);
  await store.set('beta', 2);
  await store.set('gamma', 3);

  const keys = await store.list();
  if (keys.length !== 3) throw new Error(`Expected 3 keys, got ${keys.length}`);
  if (!keys.includes('alpha')) throw new Error('Missing key alpha');
  if (!keys.includes('beta')) throw new Error('Missing key beta');
  if (!keys.includes('gamma')) throw new Error('Missing key gamma');

  await store.close();
});

test('encrypted store handles complex values', async () => {
  const store = await createEncryptedStore({ path: '/tmp/test-store5', password: 'pass' });

  const obj = { name: 'test', items: [1, 2, 3], nested: { a: true } };
  await store.set('complex', obj);
  const val = await store.get('complex');

  if (!val || (val as any).name !== 'test') throw new Error('Object not preserved');
  if (!Array.isArray((val as any).items)) throw new Error('Array not preserved');
  if ((val as any).nested.a !== true) throw new Error('Nested object not preserved');

  await store.close();
});

// ============================================================================
// Audit Log (RPC for HMAC)
// ============================================================================

test('audit log append and verify', async () => {
  createAuditLog('test-chain-key-hex-0123456789abcdef');

  const e1 = await appendAudit('user.login', { userId: 'alice' });
  if (e1.index !== 0) throw new Error(`Expected index 0, got ${e1.index}`);
  if (e1.event !== 'user.login') throw new Error(`Expected event user.login, got ${e1.event}`);
  if (!e1.hash) throw new Error('Entry should have a hash');
  if (e1.prevHash !== '0') throw new Error(`First entry prevHash should be "0", got ${e1.prevHash}`);

  const e2 = await appendAudit('file.access', { path: '/secret.txt' });
  if (e2.index !== 1) throw new Error(`Expected index 1, got ${e2.index}`);
  if (e2.prevHash !== e1.hash) throw new Error('Chain link broken: e2.prevHash !== e1.hash');

  const verification = await verifyAudit();
  if (!verification.valid) throw new Error(`Chain verification failed at entry ${verification.brokenAt}`);
  if (verification.entries !== 2) throw new Error(`Expected 2 entries, got ${verification.entries}`);
});

test('audit entries retrieval with range', async () => {
  createAuditLog('another-chain-key-fedcba9876543210');

  await appendAudit('event1');
  await appendAudit('event2');
  await appendAudit('event3');
  await appendAudit('event4');

  const all = await auditEntries();
  if (all.length !== 4) throw new Error(`Expected 4 entries, got ${all.length}`);

  const slice = await auditEntries({ from: 1, to: 3 });
  if (slice.length !== 2) throw new Error(`Expected 2 entries in slice, got ${slice.length}`);
  if (slice[0].event !== 'event2') throw new Error(`Expected event2, got ${slice[0].event}`);
});

// ============================================================================
// Envelope Encryption (RPC — Lua FFI)
// ============================================================================

test('envelope encrypt/decrypt round-trip', async () => {
  // 32-byte KEK in hex
  const kek = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';
  const plaintext = 'deadbeefcafebabe';

  const envelope = await envelopeEncrypt(plaintext, kek);
  if (!envelope.encryptedDEK) throw new Error('Missing encryptedDEK');
  if (!envelope.ciphertext) throw new Error('Missing ciphertext');
  if (!envelope.dekNonce) throw new Error('Missing dekNonce');
  if (!envelope.dataNonce) throw new Error('Missing dataNonce');

  const recovered = await envelopeDecrypt(envelope, kek);
  if (recovered !== plaintext) throw new Error(`Expected "${plaintext}", got "${recovered}"`);
});

// ============================================================================
// Identity & Anonymity (RPC — Lua FFI)
// ============================================================================

test('anonymousId is deterministic with same seed', async () => {
  const id1 = await anonymousId('test-domain', 'fixed-seed');
  const id2 = await anonymousId('test-domain', 'fixed-seed');
  if (id1 !== id2) throw new Error('Same domain+seed should produce same ID');
});

test('anonymousId differs across domains', async () => {
  const seed = 'same-seed-value';
  const id1 = await anonymousId('domain-a', seed);
  const id2 = await anonymousId('domain-b', seed);
  if (id1 === id2) throw new Error('Different domains should produce different IDs');
});

test('pseudonym derives context-specific identifiers', async () => {
  const master = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';
  const p1 = await pseudonym(master, 'email');
  const p2 = await pseudonym(master, 'username');
  if (p1 === p2) throw new Error('Different contexts should produce different pseudonyms');

  // Deterministic
  const p1b = await pseudonym(master, 'email');
  if (p1 !== p1b) throw new Error('Same context should produce same pseudonym');
});

// ============================================================================
// Tokenize (RPC — HMAC)
// ============================================================================

test('tokenize produces deterministic pseudonym', async () => {
  const t1 = await tokenize('user@example.com', 'salt123');
  const t2 = await tokenize('user@example.com', 'salt123');
  if (t1 !== t2) throw new Error('Same input+salt should produce same token');

  const t3 = await tokenize('user@example.com', 'different-salt');
  if (t1 === t3) throw new Error('Different salt should produce different token');
});

// ============================================================================
// File Integrity (RPC — Lua reads files)
// ============================================================================

test('hashFile produces a hash for a known file', async () => {
  const hash = await hashFile('/etc/hostname');
  if (typeof hash !== 'string') throw new Error(`Expected string, got ${typeof hash}`);
  if (hash.length === 0) throw new Error('Hash should not be empty');
  // SHA-256 hex is 64 chars
  if (hash.length < 32) throw new Error(`Hash too short: ${hash.length} chars`);
});

test('hashFile is deterministic', async () => {
  const h1 = await hashFile('/etc/hostname', 'sha256');
  const h2 = await hashFile('/etc/hostname', 'sha256');
  if (h1 !== h2) throw new Error('Same file should produce same hash');
});

// ============================================================================
// Screenshot for visual verification
// ============================================================================

test('capture test completion screenshot', async () => {
  await page.screenshot('/tmp/privacy-test.png');
});
