/**
 * Crypto — libsodium + OpenSSL + BLAKE3 via Lua FFI.
 *
 * Hashing, encryption, signing, key exchange, tokens — all crypto runs in C.
 * Zero JS overhead. React declares intent, Lua executes native crypto.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, classifiers as C } from '../../../packages/core/src';
import { useCrypto } from '../../../packages/crypto/src';
import { useThemeColors } from '../../../packages/theme/src';
import { SB } from './_shared/storybook.cls';

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
  { label: 'SHA-256/512', desc: 'NIST standard hashes (libsodium)', color: SB.blue },
  { label: 'BLAKE2b/2s', desc: 'Modern hash (libsodium + OpenSSL)', color: SB.teal },
  { label: 'BLAKE3', desc: 'Fastest modern hash (libblake3)', color: SB.yellow },
  { label: 'HMAC-SHA256/512', desc: 'Message authentication (libsodium)', color: SB.mauve },
  { label: 'XChaCha20-Poly1305', desc: 'Default AEAD cipher (libsodium)', color: SB.pink },
  { label: 'AES-256-GCM', desc: 'AEAD cipher, requires AES-NI (libsodium)', color: SB.peach },
  { label: 'Argon2id', desc: 'Default password KDF (libsodium)', color: SB.red },
  { label: 'scrypt', desc: 'Password KDF, compat mode (libsodium)', color: SB.green },
  { label: 'Ed25519', desc: 'Digital signatures (libsodium)', color: SB.blue },
  { label: 'X25519', desc: 'Diffie-Hellman key exchange (libsodium)', color: SB.teal },
  { label: 'randomToken/Id', desc: 'CSPRNG tokens (libsodium)', color: SB.yellow },
  { label: 'toHex/toBase64', desc: 'Pure JS encoding — no bridge needed', color: SB.mauve },
];

// ── Live Demo: Hash Functions ────────────────────────────

function HashDemo() {
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
        { label: 'SHA-256', hex: s256.hex, color: SB.blue },
        { label: 'SHA-512', hex: s512.hex, color: SB.teal },
        { label: 'BLAKE2b', hex: b2b.hex, color: SB.mauve },
        { label: 'BLAKE3', hex: b3.hex, color: SB.yellow },
        { label: 'HMAC-SHA256', hex: mac.hex, color: SB.pink },
      ]);
      setError(null);
    }).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ gap: 2 }}>
        <C.StoryCap>{'Input:'}</C.StoryCap>
        <C.StoryInputWell>
          <Text style={{ fontSize: 10, color: SB.blue }}>{`"${input}"`}</Text>
        </C.StoryInputWell>
      </Box>

      {error && <C.StoryError>{`Error: ${error}`}</C.StoryError>}

      {hashes.map(h => (
        <C.StoryKV key={h.label}>
          <C.StoryDot style={{ backgroundColor: h.color, marginTop: 3 }} />
          <Box style={{ gap: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 9, color: h.color }}>{h.label}</Text>
            <C.StoryTiny>{`${h.hex.slice(0, 48)}${h.hex.length > 48 ? '...' : ''}`}</C.StoryTiny>
          </Box>
        </C.StoryKV>
      ))}
    </Box>
  );
}

// ── Live Demo: Password Encryption ───────────────────────

function EncryptDemo() {
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
      <C.StoryCap>
        {`${algo || 'XChaCha20-Poly1305'} + ${kdf || 'Argon2id'} KDF`}
      </C.StoryCap>

      {error && <C.StoryError>{`Error: ${error}`}</C.StoryError>}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: SB.green }}>{'Plaintext:'}</Text>
        <C.StoryInputWell>
          <Text style={{ fontSize: 10, color: SB.blue }}>{plaintext}</Text>
        </C.StoryInputWell>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: SB.yellow }}>{'Ciphertext:'}</Text>
        <C.StoryInputWell>
          <C.StoryTiny>{encrypted}</C.StoryTiny>
        </C.StoryInputWell>
      </Box>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 9, color: SB.green }}>{'Decrypted:'}</Text>
        <C.StoryInputWell>
          <Text style={{ fontSize: 10, color: SB.green }}>{decrypted}</Text>
        </C.StoryInputWell>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <C.StoryDot style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: decrypted === plaintext ? SB.green : SB.red,
        }} />
        <Text style={{ fontSize: 10, color: decrypted === plaintext ? SB.green : SB.red }}>
          {decrypted === plaintext ? 'Round-trip OK' : decrypted ? 'Mismatch' : 'Computing...'}
        </Text>
      </Box>
    </Box>
  );
}

// ── Live Demo: Ed25519 Signing ───────────────────────────

function SignDemo() {
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
        <C.StoryCap>{'Message:'}</C.StoryCap>
        <C.StoryInputWell>
          <Text style={{ fontSize: 10, color: SB.blue }}>{'"ReactJIT is awesome"'}</Text>
        </C.StoryInputWell>
      </Box>

      {error && <C.StoryError>{`Error: ${error}`}</C.StoryError>}

      {result && (
        <>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: SB.mauve }}>{'Public Key:'}</Text>
            <C.StoryInputWell>
              <C.StoryTiny>{result.pubKey}</C.StoryTiny>
            </C.StoryInputWell>
          </Box>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: SB.yellow }}>{'Signature:'}</Text>
            <C.StoryInputWell>
              <C.StoryTiny>{`${result.signature.slice(0, 48)}...`}</C.StoryTiny>
            </C.StoryInputWell>
          </Box>

          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <C.StoryDot style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.valid ? SB.green : SB.red,
            }} />
            <Text style={{ fontSize: 10, color: result.valid ? SB.green : SB.red }}>
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
        <C.StoryCap>{'X25519 key exchange'}</C.StoryCap>
        <Pressable onPress={regenerate}>
          <C.StoryBtnSm style={{ backgroundColor: SB.teal }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{'Regenerate'}</Text>
          </C.StoryBtnSm>
        </Pressable>
      </Box>

      {error && <C.StoryError>{`Error: ${error}`}</C.StoryError>}

      {result && (
        <>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              <Text style={{ fontSize: 9, color: SB.blue }}>{'Alice pubkey:'}</Text>
              <C.StoryInputWell style={{ padding: 4 }}>
                <Text style={{ fontSize: 7, color: c.textDim }}>{`${result.alicePub.slice(0, 24)}...`}</Text>
              </C.StoryInputWell>
            </Box>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              <Text style={{ fontSize: 9, color: SB.peach }}>{'Bob pubkey:'}</Text>
              <C.StoryInputWell style={{ padding: 4 }}>
                <Text style={{ fontSize: 7, color: c.textDim }}>{`${result.bobPub.slice(0, 24)}...`}</Text>
              </C.StoryInputWell>
            </Box>
          </Box>

          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: SB.green }}>{'Shared secret:'}</Text>
            <C.StoryInputWell>
              <C.StoryTiny>{result.sharedA}</C.StoryTiny>
            </C.StoryInputWell>
          </Box>

          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <C.StoryDot style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: result.match ? SB.green : SB.red,
            }} />
            <Text style={{ fontSize: 10, color: result.match ? SB.green : SB.red }}>
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

  const items = [
    { label: 'randomToken(16) — hex', value: tokens.hex, color: SB.yellow },
    { label: 'randomId(24) — alphanumeric', value: tokens.id, color: SB.green },
    { label: 'randomBase64(18) — base64', value: tokens.b64, color: SB.mauve },
  ];

  return (
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <C.StoryCap>{'libsodium randombytes_buf'}</C.StoryCap>
        <Pressable onPress={regenerate}>
          <C.StoryBtnSm style={{ backgroundColor: SB.yellow }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{'Regenerate'}</Text>
          </C.StoryBtnSm>
        </Pressable>
      </Box>

      {error && <C.StoryError>{`Error: ${error}`}</C.StoryError>}

      {items.map(item => (
        <C.StoryKV key={item.label}>
          <C.StoryDot style={{ backgroundColor: item.color, marginTop: 3 }} />
          <Box style={{ gap: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 9, color: item.color }}>{item.label}</Text>
            <C.StoryInputWell style={{ padding: 4 }}>
              <C.StoryCap>{item.value}</C.StoryCap>
            </C.StoryInputWell>
          </Box>
        </C.StoryKV>
      ))}
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
          <C.StoryDot style={{ backgroundColor: a.color }} />
          <Text style={{ fontSize: 9, color: c.text, width: 130, flexShrink: 0 }}>{a.label}</Text>
          <C.StoryCap>{a.desc}</C.StoryCap>
        </Box>
      ))}
    </Box>
  );
}

// ── Section Label helper ─────────────────────────────────

function SLabel({ icon, children }: { icon: string; children: string }) {
  return (
    <C.StorySectionLabel>
      <C.StorySectionIcon src={icon} tintColor={SB.accent} />
      <C.StoryLabelText>{children}</C.StoryLabelText>
    </C.StorySectionLabel>
  );
}

// ── CryptoStory ──────────────────────────────────────────

export function CryptoStory() {
  return (
    <C.StoryRoot>

      {/* ── Header ── */}
      <C.StoryHeader>
        <C.StoryHeaderIcon src="shield" tintColor={SB.accent} />
        <C.StoryTitle>{'Crypto'}</C.StoryTitle>
        <C.StoryBadge>
          <C.StoryBadgeText>{'@reactjit/crypto'}</C.StoryBadgeText>
        </C.StoryBadge>
        <C.StorySpacer />
        <C.StoryMuted>{'No rug pulls here'}</C.StoryMuted>
      </C.StoryHeader>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <C.StoryHero style={{ borderColor: SB.accent }}>
          <C.StoryHeadline>{'Production cryptography in one hook call.'}</C.StoryHeadline>
          <C.StoryMuted>
            {'useCrypto() wraps libsodium, OpenSSL, and BLAKE3 into a single React hook. Every operation runs in C via Lua FFI — SHA-256, XChaCha20-Poly1305, Ed25519, X25519, Argon2id, BLAKE3. React declares what to hash, encrypt, or sign. Lua executes it at native speed.'}
          </C.StoryMuted>
        </C.StoryHero>

        <C.StoryDivider />

        {/* ── Band 1: INSTALL ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <SLabel icon="download">{'INSTALL'}</SLabel>
            <C.StoryBody>
              {'One hook, all crypto. useCrypto() returns every function — hashing, encryption, signing, key exchange, tokens. Encoding helpers are separate pure-JS imports with no bridge dependency.'}
            </C.StoryBody>
          </C.StoryHalf>
          <C.StoryHalf>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Band 2: HASH FUNCTIONS ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <HashDemo />
          </C.StoryHalf>
          <C.StoryHalf>
            <SLabel icon="hash">{'HASH FUNCTIONS'}</SLabel>
            <C.StoryBody>
              {'Five hash algorithms, one interface. SHA-256/512 via libsodium, BLAKE2b via libsodium, BLAKE3 via libblake3, HMAC via libsodium. Every result returns { hex, base64 }.'}
            </C.StoryBody>
            <C.StoryCap>
              {'All hashing is async — the call crosses the bridge to Lua, which calls into C, then returns the digest. No JS crypto at all.'}
            </C.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={HASH_CODE} />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Band 3: PASSWORD ENCRYPTION ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <SLabel icon="lock">{'PASSWORD ENCRYPTION'}</SLabel>
            <C.StoryBody>
              {'Password-based encryption with XChaCha20-Poly1305 (AEAD) and Argon2id key derivation. One line to encrypt, one line to decrypt. Salt, nonce, and KDF params are generated automatically.'}
            </C.StoryBody>
            <C.StoryCap>
              {'Supports AES-256-GCM (if hardware AES-NI is available), scrypt, and PBKDF2 via options. Defaults are chosen for security, not compatibility.'}
            </C.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={ENCRYPT_CODE} />
          </C.StoryHalf>
          <C.StoryHalf>
            <EncryptDemo />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Callout: zero JS ── */}
        <C.StoryCallout>
          <C.StoryInfoIcon src="info" tintColor={SB.calloutBorder} />
          <C.StoryBody>
            {'All crypto runs in C via Lua FFI. React never touches a byte of plaintext, ciphertext, or key material — it only sees the results. Zero JS crypto overhead.'}
          </C.StoryBody>
        </C.StoryCallout>

        <C.StoryDivider />

        {/* ── Band 4: ED25519 SIGNING ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <SignDemo />
          </C.StoryHalf>
          <C.StoryHalf>
            <SLabel icon="key">{'ED25519 SIGNING'}</SLabel>
            <C.StoryBody>
              {'Generate a keypair, sign a message, verify the signature. Ed25519 via libsodium — 64-byte signatures, 32-byte keys. Fast, deterministic, and safe.'}
            </C.StoryBody>
            <C.StoryCap>
              {'verifyDetached() is also available for cases where the signature is separate from the message.'}
            </C.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={SIGN_CODE} />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Band 5: X25519 KEY EXCHANGE ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <SLabel icon="git-merge">{'X25519 KEY EXCHANGE'}</SLabel>
            <C.StoryBody>
              {'Elliptic-curve Diffie-Hellman key agreement. Alice and Bob each generate an X25519 keypair, exchange public keys, and derive the same shared secret independently.'}
            </C.StoryBody>
            <C.StoryCap>
              {'Use the shared secret as input to a symmetric cipher (XChaCha20) or KDF. The shared secret never travels over the wire.'}
            </C.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={DH_CODE} />
          </C.StoryHalf>
          <C.StoryHalf>
            <DHDemo />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Band 6: TOKEN GENERATION ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <TokenDemo />
          </C.StoryHalf>
          <C.StoryHalf>
            <SLabel icon="fingerprint">{'TOKEN GENERATION'}</SLabel>
            <C.StoryBody>
              {'Cryptographically secure random tokens in three formats. Hex for database IDs, alphanumeric for URL-safe slugs, base64 for compact binary encoding.'}
            </C.StoryBody>
            <C.StoryCap>
              {'All backed by libsodium\'s randombytes_buf — the same CSPRNG that powers the encryption and signing primitives.'}
            </C.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={TOKEN_CODE} />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Band 7: ENCODING HELPERS ── */}
        <C.StoryBand>
          <C.StoryHalf>
            <SLabel icon="code">{'ENCODING HELPERS'}</SLabel>
            <C.StoryBody>
              {'Pure JavaScript format conversions — no bridge, no Lua, no latency. Convert between Uint8Array, hex strings, and base64. Available as standalone imports.'}
            </C.StoryBody>
          </C.StoryHalf>
          <C.StoryHalf>
            <CodeBlock language="tsx" fontSize={9} code={ENCODING_CODE} />
          </C.StoryHalf>
        </C.StoryBand>

        <C.StoryDivider />

        {/* ── Band 8: ALGORITHM CATALOG ── */}
        <C.StoryFullBand>
          <SLabel icon="list">{'ALGORITHM CATALOG'}</SLabel>
          <C.StoryCap>{'Everything useCrypto() exposes:'}</C.StoryCap>
          <AlgorithmCatalog />
        </C.StoryFullBand>

        <C.StoryDivider />

        {/* ── Callout: one-liner philosophy ── */}
        <C.StoryCallout>
          <C.StoryInfoIcon src="info" tintColor={SB.calloutBorder} />
          <C.StoryBody>
            {'One hook. One await. No key management ceremony, no algorithm negotiation, no IV bookkeeping. The defaults are secure (Argon2id + XChaCha20-Poly1305). Override only when you know why.'}
          </C.StoryBody>
        </C.StoryCallout>

      </ScrollView>

      {/* ── Footer ── */}
      <C.StoryFooter>
        <C.StoryFooterIcon src="folder" tintColor="theme:textDim" />
        <C.StoryBreadcrumb>{'Packages'}</C.StoryBreadcrumb>
        <C.StoryBreadcrumb>{'/'}</C.StoryBreadcrumb>
        <C.StoryFooterIcon src="shield" tintColor="theme:text" />
        <C.StoryBreadcrumbActive>{'Crypto'}</C.StoryBreadcrumbActive>
        <C.StorySpacer />
        <C.StoryBreadcrumb>{'v0.1.0'}</C.StoryBreadcrumb>
      </C.StoryFooter>

    </C.StoryRoot>
  );
}
