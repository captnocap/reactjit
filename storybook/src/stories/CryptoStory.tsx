/**
 * Crypto — libsodium + OpenSSL + BLAKE3 via Lua FFI.
 *
 * Hashing, encryption, signing, key exchange, tokens — all crypto runs in C.
 * Zero JS overhead. React declares intent, Lua executes native crypto.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable } from '../../../packages/core/src';
import { useCrypto } from '../../../packages/crypto/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useCrypto } from '@reactjit/crypto'
import { toHex, fromHex, toBase64, fromBase64 }
  from '@reactjit/crypto'`;

const HASH_CODE = `const crypto = useCrypto()
const h = await crypto.sha256('hello world')
// h.hex, h.base64

const b3 = await crypto.hash_blake3('hello')
const mac = await crypto.hmacSHA256('key', 'msg')`;

const ENCRYPT_CODE = `const sealed = await crypto.encrypt(
  'secret message', 'password'
)
// sealed.algorithm = 'xchacha20-poly1305'
// sealed.kdf = 'argon2id'

const plain = await crypto.decrypt(sealed, 'password')`;

const SIGN_CODE = `const keys = await crypto.generateSigningKeys()
const signed = await crypto.sign(
  keys.privateKey, 'message'
)
const valid = await crypto.verify(signed) // true`;

const DH_CODE = `const alice = await crypto.generateDHKeys()
const bob = await crypto.generateDHKeys()

const sharedA = await crypto.diffieHellman(
  alice.privateKey, bob.publicKey
)
const sharedB = await crypto.diffieHellman(
  bob.privateKey, alice.publicKey
)
// sharedA === sharedB`;

const TOKEN_CODE = `const hex = await crypto.randomToken(32)
const id = await crypto.randomId(16)
const b64 = await crypto.randomBase64(24)`;

const ENCODING_CODE = `import { toHex, fromHex, toBase64, fromBase64 }
  from '@reactjit/crypto'

const hex = toHex(bytes)       // Uint8Array → hex
const bytes = fromHex(hex)     // hex → Uint8Array
const b64 = toBase64(bytes)    // Uint8Array → base64
const raw = fromBase64(b64)    // base64 → Uint8Array`;

// ── Hoisted data arrays ─────────────────────────────────

const ALGORITHMS = [
  { label: 'SHA-256/512', desc: 'NIST standard hashes (libsodium)', color: C.blue },
  { label: 'BLAKE2b/2s', desc: 'Modern hash (libsodium + OpenSSL)', color: C.teal },
  { label: 'BLAKE3', desc: 'Fastest modern hash (libblake3)', color: C.yellow },
  { label: 'HMAC-SHA256/512', desc: 'Message authentication (libsodium)', color: C.mauve },
  { label: 'XChaCha20-Poly1305', desc: 'Default AEAD cipher (libsodium)', color: C.pink },
  { label: 'AES-256-GCM', desc: 'AEAD cipher, requires AES-NI (libsodium)', color: C.peach },
  { label: 'Argon2id', desc: 'Default password KDF (libsodium)', color: C.red },
  { label: 'scrypt', desc: 'Password KDF, compat mode (libsodium)', color: C.green },
  { label: 'Ed25519', desc: 'Digital signatures (libsodium)', color: C.blue },
  { label: 'X25519', desc: 'Diffie-Hellman key exchange (libsodium)', color: C.teal },
  { label: 'randomToken/Id', desc: 'CSPRNG tokens (libsodium)', color: C.yellow },
  { label: 'toHex/toBase64', desc: 'Pure JS encoding — no bridge needed', color: C.mauve },
];

import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Live Demo: Hash Functions ────────────────────────────

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
        { label: 'SHA-256', hex: s256.hex, color: C.blue },
        { label: 'SHA-512', hex: s512.hex, color: C.teal },
        { label: 'BLAKE2b', hex: b2b.hex, color: C.mauve },
        { label: 'BLAKE3', hex: b3.hex, color: C.yellow },
        { label: 'HMAC-SHA256', hex: mac.hex, color: C.pink },
      ]);
      setError(null);
    }).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: c.muted }}>Input:</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: C.blue }}>{`"${input}"`}</Text>
        </Box>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      {hashes.map(h => (
        <Box key={h.label} style={{ flexDirection: 'row', gap: 6, alignItems: 'start' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: h.color, marginTop: 3, flexShrink: 0 }} />
          <Box style={{ gap: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 9, color: h.color }}>{h.label}</Text>
            <Text style={{ fontSize: 8, color: c.muted }}>{`${h.hex.slice(0, 48)}${h.hex.length > 48 ? '...' : ''}`}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Live Demo: Password Encryption ───────────────────────

function EncryptDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const plaintext = 'Top secret message!';
  const password = 'strong-password-123';

  const [encrypted, setEncrypted] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [algo, setAlgo] = useState('');
  const [kdf, setKdf] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const enc = await crypto.encrypt(plaintext, password);
        const dec = await crypto.decrypt(enc, password);
        setEncrypted(enc.ciphertext.slice(0, 40) + '...');
        setDecrypted(dec);
        setAlgo(enc.algorithm);
        setKdf(enc.kdf);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>
        {`${algo || 'XChaCha20-Poly1305'} + ${kdf || 'Argon2id'} KDF`}
      </Text>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.green }}>Plaintext:</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: C.blue }}>{plaintext}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.yellow }}>Ciphertext:</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 8, color: c.muted }}>{encrypted}</Text>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.green }}>Decrypted:</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: C.green }}>{decrypted}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: decrypted === plaintext ? C.green : C.red,
        }} />
        <Text style={{ fontSize: 10, color: decrypted === plaintext ? C.green : C.red }}>
          {decrypted === plaintext ? 'Round-trip OK' : decrypted ? 'Mismatch' : 'Computing...'}
        </Text>
      </Box>
    </Box>
  );
}

// ── Live Demo: Ed25519 Signing ───────────────────────────

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
        const signed = await crypto.sign(keys.privateKey, 'ReactJIT is awesome');
        const valid = await crypto.verify(signed);
        setResult({ pubKey: keys.publicKey, signature: signed.signature, valid });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: c.muted }}>Message:</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: C.blue }}>{'"ReactJIT is awesome"'}</Text>
        </Box>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      {result && (
        <>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: C.mauve }}>Public Key:</Text>
            <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
              <Text style={{ fontSize: 8, color: c.muted }}>{result.pubKey}</Text>
            </Box>
          </Box>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: C.yellow }}>Signature:</Text>
            <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
              <Text style={{ fontSize: 8, color: c.muted }}>{`${result.signature.slice(0, 48)}...`}</Text>
            </Box>
          </Box>

          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.valid ? C.green : C.red,
            }} />
            <Text style={{ fontSize: 10, color: result.valid ? C.green : C.red }}>
              {result.valid ? 'Signature valid' : 'Signature INVALID'}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Live Demo: Diffie-Hellman Key Exchange ───────────────

function DHDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const [result, setResult] = useState<{
    alicePub: string;
    bobPub: string;
    sharedA: string;
    sharedB: string;
    match: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(() => {
    (async () => {
      try {
        const alice = await crypto.generateDHKeys();
        const bob = await crypto.generateDHKeys();
        const sharedA = await crypto.diffieHellman(alice.privateKey, bob.publicKey);
        const sharedB = await crypto.diffieHellman(bob.privateKey, alice.publicKey);
        setResult({
          alicePub: alice.publicKey,
          bobPub: bob.publicKey,
          sharedA,
          sharedB,
          match: sharedA === sharedB,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [crypto]);

  useEffect(() => { regenerate(); }, []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: c.muted }}>X25519 key exchange</Text>
        <Pressable onPress={regenerate}>
          <Box style={{ backgroundColor: C.teal, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Regenerate</Text>
          </Box>
        </Pressable>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      {result && (
        <>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              <Text style={{ fontSize: 9, color: C.blue }}>Alice pubkey:</Text>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
                <Text style={{ fontSize: 7, color: c.muted }}>{`${result.alicePub.slice(0, 24)}...`}</Text>
              </Box>
            </Box>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              <Text style={{ fontSize: 9, color: C.peach }}>Bob pubkey:</Text>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
                <Text style={{ fontSize: 7, color: c.muted }}>{`${result.bobPub.slice(0, 24)}...`}</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: C.green }}>Shared secret:</Text>
            <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
              <Text style={{ fontSize: 8, color: c.muted }}>{result.sharedA}</Text>
            </Box>
          </Box>

          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.match ? C.green : C.red,
            }} />
            <Text style={{ fontSize: 10, color: result.match ? C.green : C.red }}>
              {result.match ? 'Shared secrets match' : 'Shared secrets MISMATCH'}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Live Demo: Token Generation ──────────────────────────

function TokenDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const [tokens, setTokens] = useState<{ hex: string; id: string; b64: string }>({ hex: '', id: '', b64: '' });
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(() => {
    Promise.all([
      crypto.randomToken(16),
      crypto.randomId(24),
      crypto.randomBase64(18),
    ]).then(([hex, id, b64]) => {
      setTokens({ hex, id, b64 });
      setError(null);
    }).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [crypto]);

  useEffect(() => { regenerate(); }, []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: c.muted }}>libsodium randombytes_buf</Text>
        <Pressable onPress={regenerate}>
          <Box style={{ backgroundColor: C.yellow, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Regenerate</Text>
          </Box>
        </Pressable>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'start' }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow, marginTop: 3, flexShrink: 0 }} />
        <Box style={{ gap: 1, flexShrink: 1 }}>
          <Text style={{ fontSize: 9, color: C.yellow }}>randomToken(16) — hex</Text>
          <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{tokens.hex}</Text>
          </Box>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'start' }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginTop: 3, flexShrink: 0 }} />
        <Box style={{ gap: 1, flexShrink: 1 }}>
          <Text style={{ fontSize: 9, color: C.green }}>randomId(24) — alphanumeric</Text>
          <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{tokens.id}</Text>
          </Box>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'start' }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.mauve, marginTop: 3, flexShrink: 0 }} />
        <Box style={{ gap: 1, flexShrink: 1 }}>
          <Text style={{ fontSize: 9, color: C.mauve }}>randomBase64(18) — base64</Text>
          <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{tokens.b64}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Algorithm Catalog ────────────────────────────────────

function AlgorithmCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {ALGORITHMS.map(a => (
        <Box key={a.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: a.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 130, flexShrink: 0 }}>{a.label}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{a.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── CryptoStory ──────────────────────────────────────────

export function CryptoStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="shield" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Crypto'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/crypto'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'No rug pulls here'}
        </Text>
      </Box>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Production cryptography in one hook call.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'useCrypto() wraps libsodium, OpenSSL, and BLAKE3 into a single React hook. Every operation runs in C via Lua FFI — SHA-256, XChaCha20-Poly1305, Ed25519, X25519, Argon2id, BLAKE3. React declares what to hash, encrypt, or sign. Lua executes it at native speed.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'One hook, all crypto. useCrypto() returns every function — hashing, encryption, signing, key exchange, tokens. Encoding helpers are separate pure-JS imports with no bridge dependency.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 2: demo | text + code — HASH FUNCTIONS ── */}
        <Band>
          <Half>
            <HashDemo />
          </Half>
          <Half>
            <SectionLabel icon="hash">{'HASH FUNCTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Five hash algorithms, one interface. SHA-256/512 via libsodium, BLAKE2b via libsodium, BLAKE3 via libblake3, HMAC via libsodium. Every result returns { hex, base64 }.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'All hashing is async — the call crosses the bridge to Lua, which calls into C, then returns the digest. No JS crypto at all.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={HASH_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text + code | demo — ENCRYPTION ── */}
        <Band>
          <Half>
            <SectionLabel icon="lock">{'PASSWORD ENCRYPTION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Password-based encryption with XChaCha20-Poly1305 (AEAD) and Argon2id key derivation. One line to encrypt, one line to decrypt. Salt, nonce, and KDF params are generated automatically.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Supports AES-256-GCM (if hardware AES-NI is available), scrypt, and PBKDF2 via options. Defaults are chosen for security, not compatibility.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={ENCRYPT_CODE} />
          </Half>
          <Half>
            <EncryptDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: zero JS ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All crypto runs in C via Lua FFI. React never touches a byte of plaintext, ciphertext, or key material — it only sees the results. Zero JS crypto overhead.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 4: demo | text + code — SIGNING ── */}
        <Band>
          <Half>
            <SignDemo />
          </Half>
          <Half>
            <SectionLabel icon="key">{'ED25519 SIGNING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Generate a keypair, sign a message, verify the signature. Ed25519 via libsodium — 64-byte signatures, 32-byte keys. Fast, deterministic, and safe.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'verifyDetached() is also available for cases where the signature is separate from the message.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SIGN_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: text + code | demo — DIFFIE-HELLMAN ── */}
        <Band>
          <Half>
            <SectionLabel icon="git-merge">{'X25519 KEY EXCHANGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Elliptic-curve Diffie-Hellman key agreement. Alice and Bob each generate an X25519 keypair, exchange public keys, and derive the same shared secret independently.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Use the shared secret as input to a symmetric cipher (XChaCha20) or KDF. The shared secret never travels over the wire.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={DH_CODE} />
          </Half>
          <Half>
            <DHDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: demo | text + code — TOKENS ── */}
        <Band>
          <Half>
            <TokenDemo />
          </Half>
          <Half>
            <SectionLabel icon="fingerprint">{'TOKEN GENERATION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Cryptographically secure random tokens in three formats. Hex for database IDs, alphanumeric for URL-safe slugs, base64 for compact binary encoding.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'All backed by libsodium\'s randombytes_buf — the same CSPRNG that powers the encryption and signing primitives.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={TOKEN_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: text | code — ENCODING ── */}
        <Band>
          <Half>
            <SectionLabel icon="code">{'ENCODING HELPERS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Pure JavaScript format conversions — no bridge, no Lua, no latency. Convert between Uint8Array, hex strings, and base64. Available as standalone imports.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={ENCODING_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 8: algorithm catalog (full width) ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="list">{'ALGORITHM CATALOG'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Everything useCrypto() exposes:'}</Text>
          <AlgorithmCatalog />
        </Box>

        <Divider />

        {/* ── Callout: one-liner philosophy ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'One hook. One await. No key management ceremony, no algorithm negotiation, no IV bookkeeping. The defaults are secure (Argon2id + XChaCha20-Poly1305). Override only when you know why.'}
          </Text>
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="shield" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Crypto'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
