/**
 * Crypto — libsodium + OpenSSL + BLAKE3 via Lua FFI.
 *
 * Hashing, encryption, signing, key exchange, tokens — all crypto runs in C.
 * Zero JS overhead. React declares intent, Lua executes native crypto.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, classifiers as S, useMount} from '../../../packages/core/src';
import { useCrypto } from '../../../packages/crypto/src';
import { useThemeColors } from '../../../packages/theme/src';
import {Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';

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


// ── Live Demo: Hash Functions ────────────────────────────

function HashDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const input = 'hello world';

  const [hashes, setHashes] = useState<{ label: string; hex: string; color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useMount(() => {
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
  });

  return (
    <S.StackG6W100>
      <Box style={{ gap: 2 }}>
        <S.StoryCap>Input:</S.StoryCap>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: C.blue }}>{`"${input}"`}</Text>
        </Box>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      {hashes.map(h => (
        <S.RowG6 key={h.label} style={{ alignItems: 'start' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: h.color, marginTop: 3, flexShrink: 0 }} />
          <Box style={{ gap: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 9, color: h.color }}>{h.label}</Text>
            <S.StoryTiny>{`${h.hex.slice(0, 48)}${h.hex.length > 48 ? '...' : ''}`}</S.StoryTiny>
          </Box>
        </S.RowG6>
      ))}
    </S.StackG6W100>
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

  useMount(() => {
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
  });

  return (
    <S.StackG6W100>
      <S.StoryCap>
        {`${algo || 'XChaCha20-Poly1305'} + ${kdf || 'Argon2id'} KDF`}
      </S.StoryCap>

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
          <S.StoryTiny>{encrypted}</S.StoryTiny>
        </Box>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: C.green }}>Decrypted:</Text>
        <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 10, color: C.green }}>{decrypted}</Text>
        </Box>
      </Box>

      <S.RowCenterG6>
        <Box style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: decrypted === plaintext ? C.green : C.red,
        }} />
        <Text style={{ fontSize: 10, color: decrypted === plaintext ? C.green : C.red }}>
          {decrypted === plaintext ? 'Round-trip OK' : decrypted ? 'Mismatch' : 'Computing...'}
        </Text>
      </S.RowCenterG6>
    </S.StackG6W100>
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

  useMount(() => {
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
  });

  return (
    <S.StackG6W100>
      <Box style={{ gap: 2 }}>
        <S.StoryCap>Message:</S.StoryCap>
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
              <S.StoryTiny>{result.pubKey}</S.StoryTiny>
            </Box>
          </Box>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: C.yellow }}>Signature:</Text>
            <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
              <S.StoryTiny>{`${result.signature.slice(0, 48)}...`}</S.StoryTiny>
            </Box>
          </Box>

          <S.RowCenterG6>
            <Box style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.valid ? C.green : C.red,
            }} />
            <Text style={{ fontSize: 10, color: result.valid ? C.green : C.red }}>
              {result.valid ? 'Signature valid' : 'Signature INVALID'}
            </Text>
          </S.RowCenterG6>
        </>
      )}
    </S.StackG6W100>
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

  const regenerate = () => {
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
  };

  useMount(() => { regenerate(); });

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.StoryCap>X25519 key exchange</S.StoryCap>
        <Pressable onPress={regenerate}>
          <Box style={{ backgroundColor: C.teal, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Regenerate</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      {result && (
        <>
          <S.RowG12>
            <S.Half style={{ gap: 2 }}>
              <Text style={{ fontSize: 9, color: C.blue }}>Alice pubkey:</Text>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
                <S.DimMicro>{`${result.alicePub.slice(0, 24)}...`}</S.DimMicro>
              </Box>
            </S.Half>
            <S.Half style={{ gap: 2 }}>
              <Text style={{ fontSize: 9, color: C.peach }}>Bob pubkey:</Text>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
                <S.DimMicro>{`${result.bobPub.slice(0, 24)}...`}</S.DimMicro>
              </Box>
            </S.Half>
          </S.RowG12>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: C.green }}>Shared secret:</Text>
            <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 6 }}>
              <S.StoryTiny>{result.sharedA}</S.StoryTiny>
            </Box>
          </Box>

          <S.RowCenterG6>
            <Box style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.match ? C.green : C.red,
            }} />
            <Text style={{ fontSize: 10, color: result.match ? C.green : C.red }}>
              {result.match ? 'Shared secrets match' : 'Shared secrets MISMATCH'}
            </Text>
          </S.RowCenterG6>
        </>
      )}
    </S.StackG6W100>
  );
}

// ── Live Demo: Token Generation ──────────────────────────

function TokenDemo() {
  const c = useThemeColors();
  const crypto = useCrypto();
  const [tokens, setTokens] = useState<{ hex: string; id: string; b64: string }>({ hex: '', id: '', b64: '' });
  const [error, setError] = useState<string | null>(null);

  const regenerate = () => {
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
  };

  useMount(() => { regenerate(); });

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.StoryCap>libsodium randombytes_buf</S.StoryCap>
        <Pressable onPress={regenerate}>
          <Box style={{ backgroundColor: C.yellow, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Regenerate</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      {error && (
        <Text style={{ fontSize: 10, color: C.red }}>{`Error: ${error}`}</Text>
      )}

      <S.RowG6 style={{ alignItems: 'start' }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow, marginTop: 3, flexShrink: 0 }} />
        <Box style={{ gap: 1, flexShrink: 1 }}>
          <Text style={{ fontSize: 9, color: C.yellow }}>randomToken(16) — hex</Text>
          <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
            <S.StoryCap>{tokens.hex}</S.StoryCap>
          </Box>
        </Box>
      </S.RowG6>

      <S.RowG6 style={{ alignItems: 'start' }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginTop: 3, flexShrink: 0 }} />
        <Box style={{ gap: 1, flexShrink: 1 }}>
          <Text style={{ fontSize: 9, color: C.green }}>randomId(24) — alphanumeric</Text>
          <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
            <S.StoryCap>{tokens.id}</S.StoryCap>
          </Box>
        </Box>
      </S.RowG6>

      <S.RowG6 style={{ alignItems: 'start' }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.mauve, marginTop: 3, flexShrink: 0 }} />
        <Box style={{ gap: 1, flexShrink: 1 }}>
          <Text style={{ fontSize: 9, color: C.mauve }}>randomBase64(18) — base64</Text>
          <Box style={{ backgroundColor: c.surface1, borderRadius: 4, padding: 4 }}>
            <S.StoryCap>{tokens.b64}</S.StoryCap>
          </Box>
        </Box>
      </S.RowG6>
    </S.StackG6W100>
  );
}

// ── Algorithm Catalog ────────────────────────────────────

function AlgorithmCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {ALGORITHMS.map(a => (
        <S.RowCenterG8 key={a.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: a.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 130, flexShrink: 0 }}>{a.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{a.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── CryptoStory ──────────────────────────────────────────

export function CryptoStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="shield" tintColor={C.accent} />
        <S.StoryTitle>
          {'Crypto'}
        </S.StoryTitle>
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
        <S.StoryMuted>
          {'No rug pulls here'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
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
          <S.StoryHeadline>
            {'Production cryptography in one hook call.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'useCrypto() wraps libsodium, OpenSSL, and BLAKE3 into a single React hook. Every operation runs in C via Lua FFI — SHA-256, XChaCha20-Poly1305, Ed25519, X25519, Argon2id, BLAKE3. React declares what to hash, encrypt, or sign. Lua executes it at native speed.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'One hook, all crypto. useCrypto() returns every function — hashing, encryption, signing, key exchange, tokens. Encoding helpers are separate pure-JS imports with no bridge dependency.'}
            </S.StoryBody>
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
            <S.StoryBody>
              {'Five hash algorithms, one interface. SHA-256/512 via libsodium, BLAKE2b via libsodium, BLAKE3 via libblake3, HMAC via libsodium. Every result returns { hex, base64 }.'}
            </S.StoryBody>
            <S.StoryCap>
              {'All hashing is async — the call crosses the bridge to Lua, which calls into C, then returns the digest. No JS crypto at all.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={HASH_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text + code | demo — ENCRYPTION ── */}
        <Band>
          <Half>
            <SectionLabel icon="lock">{'PASSWORD ENCRYPTION'}</SectionLabel>
            <S.StoryBody>
              {'Password-based encryption with XChaCha20-Poly1305 (AEAD) and Argon2id key derivation. One line to encrypt, one line to decrypt. Salt, nonce, and KDF params are generated automatically.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Supports AES-256-GCM (if hardware AES-NI is available), scrypt, and PBKDF2 via options. Defaults are chosen for security, not compatibility.'}
            </S.StoryCap>
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
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All crypto runs in C via Lua FFI. React never touches a byte of plaintext, ciphertext, or key material — it only sees the results. Zero JS crypto overhead.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 4: demo | text + code — SIGNING ── */}
        <Band>
          <Half>
            <SignDemo />
          </Half>
          <Half>
            <SectionLabel icon="key">{'ED25519 SIGNING'}</SectionLabel>
            <S.StoryBody>
              {'Generate a keypair, sign a message, verify the signature. Ed25519 via libsodium — 64-byte signatures, 32-byte keys. Fast, deterministic, and safe.'}
            </S.StoryBody>
            <S.StoryCap>
              {'verifyDetached() is also available for cases where the signature is separate from the message.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={SIGN_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: text + code | demo — DIFFIE-HELLMAN ── */}
        <Band>
          <Half>
            <SectionLabel icon="git-merge">{'X25519 KEY EXCHANGE'}</SectionLabel>
            <S.StoryBody>
              {'Elliptic-curve Diffie-Hellman key agreement. Alice and Bob each generate an X25519 keypair, exchange public keys, and derive the same shared secret independently.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Use the shared secret as input to a symmetric cipher (XChaCha20) or KDF. The shared secret never travels over the wire.'}
            </S.StoryCap>
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
            <S.StoryBody>
              {'Cryptographically secure random tokens in three formats. Hex for database IDs, alphanumeric for URL-safe slugs, base64 for compact binary encoding.'}
            </S.StoryBody>
            <S.StoryCap>
              {'All backed by libsodium\'s randombytes_buf — the same CSPRNG that powers the encryption and signing primitives.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={TOKEN_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: text | code — ENCODING ── */}
        <Band>
          <Half>
            <SectionLabel icon="code">{'ENCODING HELPERS'}</SectionLabel>
            <S.StoryBody>
              {'Pure JavaScript format conversions — no bridge, no Lua, no latency. Convert between Uint8Array, hex strings, and base64. Available as standalone imports.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={ENCODING_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 8: algorithm catalog (full width) ── */}
        <S.StoryFullBand>
          <SectionLabel icon="list">{'ALGORITHM CATALOG'}</SectionLabel>
          <S.StoryCap>{'Everything useCrypto() exposes:'}</S.StoryCap>
          <AlgorithmCatalog />
        </S.StoryFullBand>

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
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'One hook. One await. No key management ceremony, no algorithm negotiation, no IV bookkeeping. The defaults are secure (Argon2id + XChaCha20-Poly1305). Override only when you know why.'}
          </S.StoryBody>
        </Box>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="shield" />
        <S.StoryBreadcrumbActive>{'Crypto'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
