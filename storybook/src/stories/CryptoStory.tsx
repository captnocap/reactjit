import React, { useState, useEffect } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import {
  sha256,
  sha512,
  hash_blake2b,
  hash_blake3,
  hmacSHA256,
  randomToken,
  randomId,
  encrypt,
  decrypt,
  generateSigningKeys,
  sign,
  verify,
  toHex,
  fromHex,
  toBase64,
} from '../../../packages/crypto/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Hash Demo ──────────────────────────────────────────

function HashDemo() {
  const c = useThemeColors();
  const input = 'hello world';
  const s256 = sha256(input);
  const s512 = sha512(input);
  const b2b = hash_blake2b(input);
  const b3 = hash_blake3(input);
  const mac = hmacSHA256('secret-key', input);

  const hashes = [
    { label: 'SHA-256', hex: s256.hex, color: c.info },
    { label: 'SHA-512', hex: s512.hex, color: c.success },
    { label: 'BLAKE2b', hex: b2b.hex, color: c.accent },
    { label: 'BLAKE3', hex: b3.hex, color: c.warning },
    { label: 'HMAC-SHA256', hex: mac.hex, color: '#ec4899' },
  ];

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 6, borderWidth: 1, borderColor: c.border }}>
        <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>Hash Functions</Text>
        <Text style={{ fontSize: 9, color: c.textDim }}>All via @noble/hashes — audited implementations</Text>

        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>Input:</Text>
          <Box style={{ backgroundColor: c.bg, padding: 6, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: c.info }}>{`"${input}"`}</Text>
          </Box>
        </Box>

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
  const [tokens, setTokens] = useState<{ hex: string; id: string }>({ hex: '', id: '' });
  const [error, setError] = useState<string | null>(null);

  const regenerate = () => {
    try {
      setTokens({
        hex: randomToken(16),
        id: randomId(24),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

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
      <Text style={{ fontSize: 9, color: c.textDim }}>Cryptographically random via @noble/hashes randomBytes</Text>

      {error && (
        <Text style={{ fontSize: 10, color: c.error }}>
          {`Token generation failed: ${error}`}
        </Text>
      )}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.warning, fontWeight: '700' }}>randomToken(16) — hex:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{tokens.hex}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.success, fontWeight: '700' }}>randomId(24) — alphanumeric:</Text>
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
  const [result, setResult] = useState<{
    pubKey: string;
    signature: string;
    valid: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const keys = generateSigningKeys();
      const signed = sign(keys.privateKey, 'iLoveReact is awesome');
      const valid = verify(signed);
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
  }, []);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>Ed25519 Signing</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>@noble/curves — generate keys, sign messages, verify signatures</Text>

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

const DEMO_SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 1 } as const;

function EncryptDemo() {
  const c = useThemeColors();
  const plaintext = 'Top secret message!';
  const password = 'strong-password-123';

  const [encrypted, setEncrypted] = useState<string>('');
  const [decrypted, setDecrypted] = useState<string>('');
  const [algo, setAlgo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Keep demo scrypt params under the native runtime's 64MB JS heap cap.
      const enc = encrypt(plaintext, password, { kdfParams: DEMO_SCRYPT_PARAMS });
      const dec = decrypt(enc, password);
      setEncrypted(enc.ciphertext.slice(0, 44) + '...');
      setDecrypted(dec);
      setAlgo(enc.algorithm);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEncrypted('');
      setDecrypted('');
      setAlgo('');
    }
  }, []);

  return (
    <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ fontSize: 13, color: c.text, fontWeight: '700' }}>Password Encryption</Text>
      <Text style={{ fontSize: 9, color: c.textDim }}>AES-256-GCM + scrypt KDF via @noble/ciphers + @noble/hashes</Text>

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
        <Text style={{ fontSize: 10, color: c.warning, fontWeight: '700' }}>{`Encrypted (${algo}):`}</Text>
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
          {decrypted === plaintext ? 'Round-trip OK' : 'Decryption failed'}
        </Text>
      </Box>
    </Box>
  );
}

// ── Feature Catalog ────────────────────────────────────

function FeatureList() {
  const c = useThemeColors();
  const features = [
    { label: 'SHA-256/512', desc: '@noble/hashes — NIST standard hash functions', color: c.info },
    { label: 'BLAKE2b/2s/3', desc: '@noble/hashes — modern fast hash functions', color: c.success },
    { label: 'HMAC', desc: '@noble/hashes — SHA-256 and SHA-512 HMAC', color: c.warning },
    { label: 'AES-256-GCM', desc: '@noble/ciphers — authenticated encryption', color: c.accent },
    { label: 'ChaCha20', desc: '@noble/ciphers — Poly1305 + XChaCha20 variants', color: '#ec4899' },
    { label: 'scrypt KDF', desc: '@noble/hashes — password-based key derivation', color: '#14b8a6' },
    { label: 'Ed25519', desc: '@noble/curves — digital signatures', color: c.error },
    { label: 'X25519', desc: '@noble/curves — Diffie-Hellman key exchange', color: '#a78bfa' },
    { label: 'Tokens', desc: 'randomToken, randomId, randomBase64', color: c.textDim },
    { label: 'Encoding', desc: 'Hex + Base64 encode/decode', color: c.textSecondary },
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
        label="// Hashing — one-liners"
        code={[
          "import { sha256, hash_blake3, hmacSHA256 } from '@ilovereact/crypto';",
          "",
          "sha256('hello').hex           // 'b94d27b9...'",
          "hash_blake3('hello').base64   // 'ea8f163d...'",
          "hmacSHA256('key', 'msg').hex  // 'signing...'",
        ]}
      />

      <CryptoCodeBlock
        label="// Password encryption"
        code={[
          "import { encrypt, decrypt } from '@ilovereact/crypto';",
          "",
          "const sealed = encrypt('secret data', 'my-password');",
          "const plain = decrypt(sealed, 'my-password');",
        ]}
      />

      <CryptoCodeBlock
        label="// Digital signatures (Ed25519)"
        code={[
          "import { generateSigningKeys, sign, verify } from '@ilovereact/crypto';",
          "",
          "const keys = generateSigningKeys();",
          "const signed = sign(keys.privateKey, 'important message');",
          "verify(signed); // true",
        ]}
      />

      <CryptoCodeBlock
        label="// Diffie-Hellman key exchange (X25519)"
        code={[
          "import { generateDHKeys, diffieHellman } from '@ilovereact/crypto';",
          "",
          "const alice = generateDHKeys();",
          "const bob = generateDHKeys();",
          "const sharedA = diffieHellman(alice.privateKey, bob.publicKey);",
          "const sharedB = diffieHellman(bob.privateKey, alice.publicKey);",
          "// sharedA === sharedB",
        ]}
      />

      <CryptoCodeBlock
        label="// Tokens"
        code={[
          "import { randomToken, randomId } from '@ilovereact/crypto';",
          "",
          "randomToken(32)  // 64 hex chars",
          "randomId(16)     // 16 alphanumeric chars",
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
        <Text style={{ fontSize: 11, color: c.textDim }}>Hashing, encryption, signatures, tokens — all via @noble audited libraries.</Text>
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
