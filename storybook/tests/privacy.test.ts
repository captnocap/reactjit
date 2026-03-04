// Privacy correctness suite.
//
// Goal: catch real cryptographic/protocol bugs via known-answer vectors,
// invariants, and negative cases. Round-trip checks are secondary.
//
// Run: cd storybook && rjit test tests/privacy.test.ts --timeout=60

import {
  setPrivacyBridge,
  hkdfDerive,
  shamirSplit,
  shamirCombine,
  envelopeEncrypt,
  envelopeDecrypt,
  noiseInitiate,
  noiseRespond,
  noiseSend,
  noiseReceive,
  noiseClose,
  secureAlloc,
  secureRead,
  secureFree,
  secureProtect,
  tokenize,
  createKeyring,
  openKeyring,
  closeKeyring,
  generateKey,
  listKeys,
  secureDelete,
  stegEmbedWhitespace,
  detectPII,
  redactPII,
} from '@reactjit/privacy';

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;
if (bridge) setPrivacyBridge(bridge);

function requireBridge(): RpcBridge {
  if (!bridge) {
    throw new Error('Missing __rjitBridge; privacy RPC tests require native bridge setup');
  }
  return bridge;
}

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertNeq<T>(actual: T, unexpected: T, message: string): void {
  if (actual === unexpected) {
    throw new Error(`${message}: both were ${String(actual)}`);
  }
}

async function expectReject(fn: () => Promise<unknown>, context: string): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(`Expected rejection: ${context}`);
  }
}

function flipHexDigit(hex: string): string {
  if (!hex || hex.length < 1) throw new Error('cannot flip empty hex');
  const d = parseInt(hex[0], 16);
  if (Number.isNaN(d)) throw new Error(`invalid hex: ${hex}`);
  const flipped = ((d ^ 0x1) & 0xf).toString(16);
  return flipped + hex.slice(1);
}

function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];

  function rec(start: number): void {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]);
      rec(i + 1);
      cur.pop();
    }
  }

  rec(0);
  return out;
}

function randomTmpPath(label: string): string {
  const suffix = Math.floor(Math.random() * 1e9).toString(16);
  return `/tmp/rjit-privacy-${label}-${Date.now()}-${suffix}`;
}

async function generateDHKeys(): Promise<{ publicKey: string; privateKey: string }> {
  return requireBridge().rpc('crypto:generateDHKeys');
}

function extractZwsBits(text: string): string {
  let bits = '';
  for (const ch of text) {
    if (ch === '\u200B') bits += '0';
    if (ch === '\u200C') bits += '1';
  }
  return bits;
}

function bitsToAscii(bits: string): string {
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return String.fromCharCode(...bytes);
}

// ============================================================================
// Bridge + basic deterministic helpers
// ============================================================================

test('privacy bridge is available', async () => {
  requireBridge();
});

test('tokenize matches HMAC-SHA256 known vector', async () => {
  const token = await tokenize('The quick brown fox jumps over the lazy dog', 'key');
  assertEq(
    token,
    'f7bc83f430538424b13298e6aa6fb143ef4d59a149461a6e295687f3f0a1b7b9',
    'tokenize known vector mismatch',
  );
});

// ============================================================================
// HKDF (RFC 5869 vectors)
// ============================================================================

test('hkdf RFC5869 test case 1', async () => {
  const okm = await hkdfDerive('0b'.repeat(22), {
    salt: '000102030405060708090a0b0c',
    info: 'f0f1f2f3f4f5f6f7f8f9',
    length: 42,
  });

  assertEq(
    okm,
    '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    'HKDF case 1 mismatch',
  );
});

test('hkdf RFC5869 test case 2', async () => {
  const okm = await hkdfDerive(
    '000102030405060708090a0b0c0d0e0f' +
    '101112131415161718191a1b1c1d1e1f' +
    '202122232425262728292a2b2c2d2e2f' +
    '303132333435363738393a3b3c3d3e3f' +
    '404142434445464748494a4b4c4d4e4f',
    {
      salt:
        '606162636465666768696a6b6c6d6e6f' +
        '707172737475767778797a7b7c7d7e7f' +
        '808182838485868788898a8b8c8d8e8f' +
        '909192939495969798999a9b9c9d9e9f' +
        'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf',
      info:
        'b0b1b2b3b4b5b6b7b8b9babbbcbdbebf' +
        'c0c1c2c3c4c5c6c7c8c9cacbcccdcecf' +
        'd0d1d2d3d4d5d6d7d8d9dadbdcdddedf' +
        'e0e1e2e3e4e5e6e7e8e9eaebecedeeef' +
        'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
      length: 82,
    },
  );

  assertEq(
    okm,
    'b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c' +
    '59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71' +
    'cc30c58179ec3e87c14c01d5c1f3434f1d87',
    'HKDF case 2 mismatch',
  );
});

test('hkdf RFC5869 test case 3 (empty salt/info)', async () => {
  const okm = await hkdfDerive('0b'.repeat(22), { length: 42 });
  assertEq(
    okm,
    '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8',
    'HKDF case 3 mismatch',
  );
});

test('hkdf rejects overlong output', async () => {
  await expectReject(() => hkdfDerive('aa', { length: 8161 }), 'HKDF output length > 255*HashLen');
});

// ============================================================================
// Shamir's Secret Sharing (vectors + invariants + adversarial cases)
// ============================================================================

test('shamir combine matches hardcoded external GF(256) vector', async () => {
  // Shares derived externally from f(x) = 0x42 + 0x17*x + 0x99*x^2 over GF(256)
  // with AES polynomial 0x11B.
  const shares = [
    { index: 1, hex: 'cc' },
    { index: 2, hex: '3e' },
    { index: 3, hex: 'b0' },
  ];
  const recovered = await shamirCombine(shares);
  assertEq(recovered, '42', 'Shamir combine vector mismatch');
});

test('shamir recovers from any threshold subset', async () => {
  const secret = '00112233445566778899aabbccddeeff';
  const n = 5;
  const k = 3;
  const shares = await shamirSplit(secret, n, k);

  assertEq(shares.length, n, 'wrong number of shares');

  const seen = new Set<number>();
  for (const s of shares) {
    assert(s.index >= 1 && s.index <= n, `bad share index ${s.index}`);
    assert(!seen.has(s.index), `duplicate share index ${s.index}`);
    seen.add(s.index);
    assertEq(s.hex.length, secret.length, 'share length mismatch');
  }

  for (const subset of combinations(shares, k)) {
    const recovered = await shamirCombine(subset);
    assertEq(recovered, secret, 'threshold subset failed to recover secret');
  }
});

test('shamir does not recover with fewer than threshold shares', async () => {
  const secret = 'deadbeefcafebabe11223344aabbccdd';
  const shares = await shamirSplit(secret, 5, 3);
  const partial = [shares[0], shares[3]];

  let recovered = '';
  try {
    recovered = await shamirCombine(partial);
  } catch {
    return; // rejection is acceptable and secure
  }

  assertNeq(recovered, secret, 'under-threshold shares recovered full secret');
});

test('shamir tampered share does not recover original secret', async () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const shares = await shamirSplit(secret, 5, 3);
  const subset = [shares[0], shares[1], shares[2]];

  const tampered = subset.map((s, i) => {
    if (i !== 0) return s;
    return { index: s.index, hex: flipHexDigit(s.hex) };
  });

  let recovered = '';
  try {
    recovered = await shamirCombine(tampered);
  } catch {
    return; // rejection is acceptable
  }

  assertNeq(recovered, secret, 'tampered share still recovered original secret');
});

// ============================================================================
// Envelope encryption (negative cases first)
// ============================================================================

test('envelope decrypt rejects wrong KEK', async () => {
  const kekA = '11'.repeat(32);
  const kekB = '22'.repeat(32);
  const plaintext = 'deadbeefcafebabefeedface';

  const env = await envelopeEncrypt(plaintext, kekA);
  await expectReject(() => envelopeDecrypt(env, kekB), 'decrypt with wrong KEK');
});

test('envelope decrypt rejects tampered ciphertext', async () => {
  const kek = 'ab'.repeat(32);
  const plaintext = '00112233445566778899aabbccddeeff';
  const env = await envelopeEncrypt(plaintext, kek);

  const tampered = { ...env, ciphertext: flipHexDigit(env.ciphertext) };
  await expectReject(() => envelopeDecrypt(tampered, kek), 'decrypt with tampered ciphertext');
});

test('envelope uses fresh randomness per encryption', async () => {
  const kek = 'ef'.repeat(32);
  const plaintext = '11223344556677889900aabbccddeeff';

  const env1 = await envelopeEncrypt(plaintext, kek);
  const env2 = await envelopeEncrypt(plaintext, kek);

  assertNeq(env1.encryptedDEK, env2.encryptedDEK, 'DEK envelope repeated across encryptions');
  assertNeq(env1.dekNonce, env2.dekNonce, 'DEK nonce repeated across encryptions');
  assertNeq(env1.ciphertext, env2.ciphertext, 'data ciphertext repeated across encryptions');
  assertNeq(env1.dataNonce, env2.dataNonce, 'data nonce repeated across encryptions');

  assertEq(await envelopeDecrypt(env1, kek), plaintext, 'env1 failed to decrypt');
  assertEq(await envelopeDecrypt(env2, kek), plaintext, 'env2 failed to decrypt');
});

test('envelope outputs expected field structure', async () => {
  const kek = 'cd'.repeat(32);
  const plaintext = 'a1b2c3d4';
  const env = await envelopeEncrypt(plaintext, kek);

  assertEq(env.algorithm, 'xchacha20-poly1305', 'unexpected envelope algorithm');
  assert(env.encryptedDEK.length > 0, 'encryptedDEK empty');
  assert(env.ciphertext.length > 0, 'ciphertext empty');
  assertEq(env.dekNonce.length, 48, 'dek nonce must be 24 bytes hex');
  assertEq(env.dataNonce.length, 48, 'data nonce must be 24 bytes hex');

  const recovered = await envelopeDecrypt(env, kek);
  assertEq(recovered, plaintext, 'valid KEK failed to decrypt envelope');
});

// ============================================================================
// Noise channel (cross-party + security negatives)
// ============================================================================

test('noise initiator/responder exchange decrypts both directions', async () => {
  const responderStatic = await generateDHKeys();

  const init = await noiseInitiate(responderStatic.publicKey);
  const resp = await noiseRespond(responderStatic.privateKey, init.message);

  const c1 = await noiseSend(init.sessionId, 'ping');
  const p1 = await noiseReceive(resp.sessionId, c1);
  assertEq(p1, 'ping', 'responder failed to decrypt initiator message');

  const c2 = await noiseSend(resp.sessionId, 'pong');
  const p2 = await noiseReceive(init.sessionId, c2);
  assertEq(p2, 'pong', 'initiator failed to decrypt responder message');

  await noiseClose(init.sessionId);
  await noiseClose(resp.sessionId);
});

test('noise wrong responder key cannot decrypt initiator message', async () => {
  const goodResponder = await generateDHKeys();
  const badResponder = await generateDHKeys();

  const init = await noiseInitiate(goodResponder.publicKey);
  const goodSession = await noiseRespond(goodResponder.privateKey, init.message);
  const badSession = await noiseRespond(badResponder.privateKey, init.message);

  const c = await noiseSend(init.sessionId, 'top-secret');

  await expectReject(
    () => noiseReceive(badSession.sessionId, c),
    'wrong private key should not decrypt',
  );

  const ok = await noiseReceive(goodSession.sessionId, c);
  assertEq(ok, 'top-secret', 'correct responder could not decrypt');

  await noiseClose(init.sessionId);
  await noiseClose(goodSession.sessionId);
  await noiseClose(badSession.sessionId);
});

test('noise rejects replayed packet on same session', async () => {
  const responder = await generateDHKeys();
  const init = await noiseInitiate(responder.publicKey);
  const resp = await noiseRespond(responder.privateKey, init.message);

  const c = await noiseSend(init.sessionId, 'nonce-check');
  const first = await noiseReceive(resp.sessionId, c);
  assertEq(first, 'nonce-check', 'first receive failed');

  await expectReject(() => noiseReceive(resp.sessionId, c), 'replay packet accepted');

  await noiseClose(init.sessionId);
  await noiseClose(resp.sessionId);
});

test('noise ciphertext differs across independent sessions', async () => {
  const responder = await generateDHKeys();

  const initA = await noiseInitiate(responder.publicKey);
  const respA = await noiseRespond(responder.privateKey, initA.message);

  const initB = await noiseInitiate(responder.publicKey);
  const respB = await noiseRespond(responder.privateKey, initB.message);

  const m = 'same plaintext';
  const cA = await noiseSend(initA.sessionId, m);
  const cB = await noiseSend(initB.sessionId, m);

  assertNeq(cA, cB, 'independent sessions produced identical ciphertext');

  await noiseClose(initA.sessionId);
  await noiseClose(respA.sessionId);
  await noiseClose(initB.sessionId);
  await noiseClose(respB.sessionId);
});

test('noise session close invalidates further send', async () => {
  const responder = await generateDHKeys();
  const init = await noiseInitiate(responder.publicKey);
  await noiseClose(init.sessionId);
  await expectReject(() => noiseSend(init.sessionId, 'after-close'), 'send after close');
});

// ============================================================================
// Keyring + secure delete
// ============================================================================

test('keyring open rejects wrong master password', async () => {
  const path = randomTmpPath('kr-wrong-pass');
  const handle = await createKeyring(path, 'correct-horse-battery-staple');
  await closeKeyring(handle);

  await expectReject(() => openKeyring(path, 'wrong-password'), 'opened keyring with wrong password');

  await secureDelete(path, 1);
});

test('keyring persists generated public keys across reopen', async () => {
  const path = randomTmpPath('kr-persist');
  const pw = 'unit-test-password';

  const h1 = await createKeyring(path, pw);
  const k = await generateKey(h1, { type: 'x25519', label: 'session-key' });
  assert(typeof k.id === 'string' && k.id.length > 0, 'generated key id missing');
  assert(typeof k.publicKey === 'string' && k.publicKey.length > 0, 'generated public key missing');

  await closeKeyring(h1);

  const h2 = await openKeyring(path, pw);
  const keys = await listKeys(h2);
  const same = keys.find(x => x.id === k.id);
  assert(!!same, 'reopened keyring missing generated key');
  assertEq(same!.publicKey, k.publicKey, 'persisted public key changed');

  await closeKeyring(h2);
  await secureDelete(path, 1);
});

// ============================================================================
// Secure memory safety behavior
// ============================================================================

test('secure memory handle is invalid after free', async () => {
  const h = await secureAlloc('deadbeef');
  await secureFree(h);
  await expectReject(() => secureRead(h), 'read after free');
});

test('secure memory rejects invalid protect mode', async () => {
  const h = await secureAlloc('aabbccdd');
  await expectReject(() => secureProtect(h, 'invalid' as any), 'invalid mprotect mode');
  await secureFree(h);
});

test('secure memory noaccess uses managed read-through semantics', async () => {
  const value = '0011223344556677';
  const h = await secureAlloc(value);
  await secureProtect(h, 'noaccess');
  const read = await secureRead(h);
  assertEq(read, value, 'secureRead failed after noaccess protect');
  await secureFree(h);
});

test('secure memory readwrite restoration preserves bytes', async () => {
  const value = '0011223344556677';
  const h = await secureAlloc(value);
  await secureProtect(h, 'noaccess');
  await secureProtect(h, 'readwrite');
  const read = await secureRead(h);
  assertEq(read, value, 'secure memory content changed across protect transitions');
  await secureFree(h);
});

// ============================================================================
// Whitespace steganography (manual extraction, not library round-trip)
// ============================================================================

test('whitespace steg embeds exact bitstream into zero-width chars', async () => {
  const carrier = 'ABCD';
  const secret = 'Hi'; // 0x48 0x69
  const encoded = stegEmbedWhitespace(carrier, secret);

  const visible = encoded.replace(/[\u200B\u200C]/g, '');
  assertEq(visible, carrier, 'carrier visible text changed');

  const bits = extractZwsBits(encoded);
  assert(bits.startsWith('0100100001101001'), 'embedded bits do not match ASCII payload');

  const decoded = bitsToAscii(bits).slice(0, secret.length);
  assertEq(decoded, secret, 'manual zero-width decode mismatch');
});

test('whitespace steg cannot embed into single-char carrier', async () => {
  const encoded = stegEmbedWhitespace('A', 'secret');
  assertEq(encoded, 'A', 'single-char carrier should be unchanged');
});

// ============================================================================
// Pure TS sanitization checks (deterministic expectations)
// ============================================================================

test('detectPII returns stable match boundaries for email + SSN', async () => {
  const input = 'mail alice@example.com ssn 123-45-6789';
  const matches = detectPII(input);

  const email = matches.find(m => m.type === 'email');
  const ssn = matches.find(m => m.type === 'ssn');

  assert(!!email, 'missing email match');
  assert(!!ssn, 'missing ssn match');
  assertEq(input.slice(email!.start, email!.end), 'alice@example.com', 'email boundary mismatch');
  assertEq(input.slice(ssn!.start, ssn!.end), '123-45-6789', 'ssn boundary mismatch');
});

test('redactPII removes raw PII values from output', async () => {
  const input = 'u=bob@example.com cc=4111 1111 1111 1111';
  const redacted = redactPII(input);
  assert(!redacted.includes('bob@example.com'), 'email leaked after redaction');
  assert(!redacted.includes('4111 1111 1111 1111'), 'credit card leaked after redaction');
});
