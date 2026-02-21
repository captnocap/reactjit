import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { useCrypto } from '../../../packages/crypto/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Hash Demo ──────────────────────────────────────────

function HashDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const input = 'hello world';

  const [hashes, setHashes] = useState<{ label: string; hex: string; color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      crypto.sha256(input),
      crypto.sha512(input),
      crypto.hash_blake2b(input),
      crypto.hash_blake3(input),
      crypto.hmacSHA256('secret-key', input),
    ]).then(([s256, s512, b2b, b3, mac]) => {
      setHashes([
        { label: 'SHA-256', hex: s256.hex, color: c.info },
        { label: 'SHA-512', hex: s512.hex, color: c.success },
        { label: 'BLAKE2b', hex: b2b.hex, color: c.accent },
        { label: 'BLAKE3', hex: b3.hex, color: c.warning },
        { label: 'HMAC-SHA256', hex: mac.hex, color: '#ec4899' },
      ]);
      setError(null);
    }).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 6, borderWidth: 1, borderColor: c.border }}>
        <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>Hash Functions</Text>
        <Text style={{ fontSize: 9, color: c.textDim }}>libsodium + libcrypto + libblake3 via Lua FFI</Text>

        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>Input:</Text>
          <Box style={{ backgroundColor: c.bg, padding: 6, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: c.info }}>{`"${input}"`}</Text>
          </Box>
        </Box>

        {error && (
          <Text style={{ fontSize: 10, color: c.error }}>{`Hash error: ${error}`}</Text>
        )}

        {hashes.map(h => (
          <Box key={h.label} style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: h.color, fontWeight: '700' }}>{`${h.label}:`}</Text>
            <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: c.textSecondary }}>{`${h.hex.slice(0, 64)}${h.hex.length > 64 ? '...' : ''}`}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Token Demo ─────────────────────────────────────────

function TokenDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const [tokens, setTokens] = useState<{ hex: string; id: string }>({ hex: '', id: '' });
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(() => {
    Promise.all([
      crypto.randomToken(16),
      crypto.randomId(24),
    ]).then(([hex, id]) => {
      setTokens({ hex, id });
      setError(null);
    }).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [crypto]);

  useEffect(() => {
    regenerate();
  }, []);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: c.text, fontWeight: '700', flexGrow: 1 }}>Token Generation</Text>
        <Pressable onPress={regenerate}>
          <Box style={{ backgroundColor: c.info, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: '700' }}>Regenerate</Text>
          </Box>
        </Pressable>
      </Box>
      <Text style={{ fontSize: 9, color: c.textDim }}>libsodium randombytes_buf via Lua FFI</Text>

      {error && (
        <Text style={{ fontSize: 10, color: c.error }}>
          {`Token generation failed: ${error}`}
        </Text>
      )}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.warning, fontWeight: '700' }}>randomToken(16) -- hex:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{tokens.hex}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.success, fontWeight: '700' }}>randomId(24) -- alphanumeric:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{tokens.id}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Signing Demo ───────────────────────────────────────

function SignDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const [result, setResult] = useState<{
    pubKey: string;
    signature: string;
    valid: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const keys = await crypto.generateSigningKeys();
        const signed = await crypto.sign(keys.privateKey, 'iLoveReact is awesome');
        const valid = await crypto.verify(signed);
        setResult({
          pubKey: keys.publicKey,
          signature: signed.signature,
          valid,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResult(null);
      }
    })();
  }, []);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>Ed25519 Signing</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>libsodium crypto_sign via Lua FFI</Text>

      {error && (
        <Text style={{ fontSize: 10, color: c.error }}>
          {`Signing failed: ${error}`}
        </Text>
      )}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>Message:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.info }}>{'"iLoveReact is awesome"'}</Text>
        </Box>
      </Box>

      {result && (
        <>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: c.accent, fontWeight: '700' }}>Public Key:</Text>
            <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: c.textSecondary }}>{result.pubKey}</Text>
            </Box>
          </Box>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: c.warning, fontWeight: '700' }}>Signature:</Text>
            <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: c.textSecondary }}>{`${result.signature.slice(0, 64)}...`}</Text>
            </Box>
          </Box>

          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.valid ? c.success : c.error,
            }} />
            <Text style={{ fontSize: 11, color: result.valid ? c.success : c.error, fontWeight: '700' }}>
              {result.valid ? 'Signature valid' : 'Signature INVALID'}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Encryption Demo ────────────────────────────────────

function EncryptDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const plaintext = 'Top secret message!';
  const password = 'strong-password-123';

  const [encrypted, setEncrypted] = useState<string>('');
  const [decrypted, setDecrypted] = useState<string>('');
  const [algo, setAlgo] = useState<string>('');
  const [kdf, setKdf] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const enc = await crypto.encrypt(plaintext, password);
        const dec = await crypto.decrypt(enc, password);
        setEncrypted(enc.ciphertext.slice(0, 44) + '...');
        setDecrypted(dec);
        setAlgo(enc.algorithm);
        setKdf(enc.kdf);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setEncrypted('');
        setDecrypted('');
        setAlgo('');
        setKdf('');
      }
    })();
  }, []);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>Password Encryption</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>{`${algo || 'XChaCha20-Poly1305'} + ${kdf || 'Argon2id'} KDF via libsodium FFI`}</Text>

      {error && (
        <Text style={{ fontSize: 10, color: c.error }}>
          {`Encryption failed: ${error}`}
        </Text>
      )}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.success, fontWeight: '700' }}>Plaintext:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.info }}>{plaintext}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.warning, fontWeight: '700' }}>{`Encrypted (${algo || '...'} + ${kdf || '...'}):`}</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 9, color: c.textSecondary }}>{encrypted}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.success, fontWeight: '700' }}>Decrypted:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.success }}>{decrypted}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: decrypted === plaintext ? c.success : c.error,
        }} />
        <Text style={{ fontSize: 11, color: decrypted === plaintext ? c.success : c.error, fontWeight: '700' }}>
          {decrypted === plaintext ? 'Round-trip OK' : decrypted ? 'Decryption failed' : 'Computing...'}
        </Text>
      </Box>
    </Box>
  );
}

// ── Feature Catalog ────────────────────────────────────

function FeatureList() {
  const c = useThemeColors();
  const features = [
    { label: 'SHA-256/512', desc: 'libsodium -- NIST standard hash functions', color: c.info },
    { label: 'BLAKE2b/2s', desc: 'libsodium + OpenSSL -- modern hash functions', color: c.success },
    { label: 'BLAKE3', desc: 'libblake3 -- fastest modern hash', color: c.warning },
    { label: 'HMAC', desc: 'libsodium -- SHA-256 and SHA-512 HMAC', color: c.accent },
    { label: 'XChaCha20', desc: 'libsodium -- Poly1305 AEAD (default)', color: '#ec4899' },
    { label: 'AES-256-GCM', desc: 'libsodium -- AEAD (requires AES-NI)', color: '#14b8a6' },
    { label: 'Argon2id', desc: 'libsodium -- password KDF (default)', color: c.error },
    { label: 'scrypt', desc: 'libsodium -- password KDF (compat)', color: '#a78bfa' },
    { label: 'PBKDF2', desc: 'OpenSSL -- password KDF (legacy)', color: c.textDim },
    { label: 'Ed25519', desc: 'libsodium -- digital signatures', color: c.info },
    { label: 'X25519', desc: 'libsodium -- Diffie-Hellman key exchange', color: c.success },
    { label: 'Tokens', desc: 'libsodium -- randomToken, randomId, randomBase64', color: c.textSecondary },
  ];

  return (
    <Box style={{ gap: 4 }}>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: '700', width: 100 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Code Examples ──────────────────────────────────────

function CryptoCodeBlock({ label, code, color }: { label: string; code: string[]; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 10, gap: 3, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{label}</Text>
      {code.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: color || c.success }}>{line}</Text>
      ))}
    </Box>
  );
}

function UsageExamples() {
  return (
    <Box style={{ gap: 8 }}>
      <CryptoCodeBlock
        label="// Hashing -- async, runs in C via Lua FFI"
        code={[
          "import { useCrypto } from '@ilovereact/crypto';",
          "",
          "const crypto = useCrypto();",
          "const h = await crypto.sha256('hello');",
          "const b = await crypto.hash_blake3('hello');",
          "const m = await crypto.hmacSHA256('key', 'msg');",
        ]}
      />

      <CryptoCodeBlock
        label="// Password encryption (Argon2id + XChaCha20)"
        code={[
          "const sealed = await crypto.encrypt('secret', 'password');",
          "const plain = await crypto.decrypt(sealed, 'password');",
        ]}
      />

      <CryptoCodeBlock
        label="// Digital signatures (Ed25519)"
        code={[
          "const keys = await crypto.generateSigningKeys();",
          "const signed = await crypto.sign(keys.privateKey, 'msg');",
          "const valid = await crypto.verify(signed); // true",
        ]}
      />

      <CryptoCodeBlock
        label="// Diffie-Hellman key exchange (X25519)"
        code={[
          "const alice = await crypto.generateDHKeys();",
          "const bob = await crypto.generateDHKeys();",
          "const sharedA = await crypto.diffieHellman(",
          "  alice.privateKey, bob.publicKey);",
          "// sharedA === sharedB",
        ]}
      />

      <CryptoCodeBlock
        label="// Tokens"
        code={[
          "const token = await crypto.randomToken(32);",
          "const id = await crypto.randomId(16);",
        ]}
      />
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────

export function CryptoStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<'hashes' | 'encrypt' | 'sign' | 'tokens' | 'code' | 'features'>('hashes');

  const tabs = [
    { key: 'hashes' as const, label: 'Hashes' },
    { key: 'encrypt' as const, label: 'Encrypt' },
    { key: 'sign' as const, label: 'Sign' },
    { key: 'tokens' as const, label: 'Tokens' },
    { key: 'code' as const, label: 'Usage' },
    { key: 'features' as const, label: 'All' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: '700' }}>@ilovereact/crypto</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>libsodium + OpenSSL + BLAKE3 -- all crypto runs in C via Lua FFI. Zero JS overhead.</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)}>
            <Box style={{
              backgroundColor: tab === t.key ? c.info : c.bgElevated,
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 10, color: tab === t.key ? '#000' : c.textSecondary, fontWeight: '700' }}>
                {t.label}
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 12, paddingRight: 4 }}>
          {tab === 'hashes' && <HashDemo />}
          {tab === 'encrypt' && <EncryptDemo />}
          {tab === 'sign' && <SignDemo />}
          {tab === 'tokens' && <TokenDemo />}
          {tab === 'code' && <UsageExamples />}
          {tab === 'features' && <FeatureList />}
        </Box>
      </ScrollView>
    </Box>
  );
}
