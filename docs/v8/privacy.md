# V8 Privacy Pipeline

The V8 privacy pipeline is the opt-in host binding behind
`runtime/hooks/usePrivacy.ts`. It exposes cryptographic and privacy utilities to
cart code through `globalThis.__priv_*` host functions, with binary data encoded
as base64 across the JS/Zig boundary.

This document covers the runtime `usePrivacy()` pipeline end to end. The repo
also has an app-level `Privacy` data model under `cart/app/gallery/data`, used
for settings, policy snapshots, tool allowlists, and audit modeling. That data
model is related, but it does not automatically enforce the `usePrivacy()`
host functions.

## Source Map

| Layer | Files |
| --- | --- |
| Public JS hook | `runtime/hooks/usePrivacy.ts`, `runtime/hooks/index.ts` |
| Generic host caller | `runtime/ffi.ts` |
| V8 feature gate | `scripts/ship`, `scripts/ship-metafile-gate.js`, `sdk/dependency-registry.json`, `build.zig`, `v8_app.zig` |
| V8 binding | `framework/v8_bindings_privacy.zig` |
| Privacy implementation | `framework/privacy.zig` |
| Crypto helpers | `framework/crypto.zig` |
| libsodium FFI | `framework/sodium.zig` |
| Encrypted keyring | `framework/keyring.zig` |
| App policy data model | `cart/app/gallery/data/privacy.ts`, `cart/app/gallery/data/inference-request.ts`, `cart/app/settings/routes/privacy.tsx` |
| Historical references | `love2d/lua/privacy.lua`, `tsz/reference/lua/privacy.lua` |

## High-Level Flow

1. Cart code imports `usePrivacy()` from `runtime/hooks`.
2. The import causes `runtime/hooks/usePrivacy.ts` to appear in the esbuild
   metafile when it survives tree-shaking.
3. `scripts/ship-metafile-gate.js` reads the metafile and the dependency
   registry.
4. The `privacy` gate flips on when `runtime/hooks/usePrivacy.ts` is shipped.
5. `scripts/ship` passes `-Dhas-privacy=true` to `zig build`.
6. `build.zig` exposes `build_options.has_privacy` and links `libsodium`.
7. `v8_app.zig` imports `framework/v8_bindings_privacy.zig` when the flag is
   true; otherwise it imports a no-op stub.
8. `appInit()` iterates `INGREDIENTS` and calls `registerPrivacy({})`.
9. The privacy binding initializes libsodium and registers every `__priv_*`
   function on `globalThis`.
10. `usePrivacy()` calls those host functions through `callHost()`.
11. The binding decodes arguments, dispatches to `privacy.zig`, `crypto.zig`,
   `sodium.zig`, or `keyring.zig`, then returns strings, booleans, numbers, or
   JSON strings.
12. The hook decodes base64/JSON and returns typed JS values.

## Build Gate

The feature registry maps `privacy` to the hook:

```json
{
  "privacy": {
    "shipGate": "privacy",
    "triggers": [
      { "kind": "metafileInput", "input": "runtime/hooks/usePrivacy.ts" }
    ],
    "buildOptions": ["has-privacy"],
    "v8Bindings": ["privacy"],
    "nativeLibraries": ["libsodium"]
  }
}
```

`scripts/ship` consumes the positional gate output:

```sh
privacy useHost useConnection fs websocket telemetry zigcall sdk voice whisper pg embed
```

When `privacy` is `1`, the ship script adds:

```sh
-Dhas-privacy=true
```

and prints `privacy` plus `libsodium` in the build ingredient echo.

`build.zig` then links the native library:

```zig
const has_privacy = b.option(bool, "has-privacy", "Link libsodium + privacy bindings") orelse false;
options.addOption(bool, "has_privacy", has_privacy);
if (has_privacy) {
    exe.linkSystemLibrary("sodium");
}
```

`v8_app.zig` gates the import:

```zig
const v8_bindings_privacy = if (build_options.has_privacy)
    @import("framework/v8_bindings_privacy.zig")
else
    struct {
        pub fn registerPrivacy(_: anytype) void {}
    };
```

The ingredient table registers the binding under the `__priv_` prefix:

```zig
.{ .name = "privacy", .required = false, .grep_prefix = "__priv_", .reg_fn = "registerPrivacy", .mod = v8_bindings_privacy },
```

The comments in `v8_app.zig` still describe older grep-based gating in places.
The current production gate is metafile-driven through `scripts/ship` and
`scripts/ship-metafile-gate.js`.

## JS Hook Surface

`usePrivacy(opts)` returns a grouped API:

```ts
const p = usePrivacy();                    // default backend: "sodium"
const p2 = usePrivacy({ backend: "std" }); // default backend override
```

Backend selection is available on primitives that have both implementations:

```ts
p.hash.sha256(data, { backend: "std" });
p.hash.sha256(data, { backend: "sodium" });
```

The hook uses `callHost()`, not `callHostStrict()`. If the host function is not
registered or throws, the hook returns its fallback value: empty `Uint8Array`,
empty string, `false`, `0`, `null`, or `[]`, depending on the method.

## Bridge Encoding

Source: `runtime/hooks/usePrivacy.ts`, `framework/v8_bindings_privacy.zig`

The bridge conventions are:

| Data shape | Bridge encoding |
| --- | --- |
| bytes from JS to Zig | base64 string |
| bytes from Zig to JS | base64 string |
| compound values | JSON string |
| key IDs and hashes | hex string |
| booleans/numbers | V8 native boolean/number |
| errors | empty string, `false`, `0`, or JSON failure shape for some compound APIs |

The binding helpers are:

```zig
fn b64Encode(bytes: []const u8) ![]u8
fn b64Decode(s: []const u8) ![]u8
fn parseBackend(s: []const u8) privacy.Backend
```

The hook helpers are:

```ts
function b64encode(bytes: Uint8Array): string
function b64decode(s: string): Uint8Array
function asBytes(x: Uint8Array | string): Uint8Array
```

String inputs passed to `asBytes()` are byte-truncated character codes, not
UTF-8 encoded strings. For non-ASCII text, pass an explicit `Uint8Array`.

## Registered Host Functions

`registerPrivacy()` initializes libsodium and registers this surface:

| Group | Host functions |
| --- | --- |
| Primitives | `__priv_sha256`, `__priv_hmac_sha256`, `__priv_hkdf_sha256`, `__priv_xchacha_encrypt`, `__priv_xchacha_decrypt`, `__priv_random_bytes` |
| Integrity | `__priv_hash_file`, `__priv_hash_directory`, `__priv_verify_manifest` |
| Secure buffers | `__priv_secbuf_alloc`, `__priv_secbuf_read`, `__priv_secbuf_free`, `__priv_secbuf_protect` |
| File operations | `__priv_encrypt_file`, `__priv_decrypt_file`, `__priv_secure_delete` |
| Text steg/tokenization | `__priv_steg_embed`, `__priv_steg_extract`, `__priv_tokenize` |
| GPG | `__priv_gpg_encrypt`, `__priv_gpg_decrypt`, `__priv_gpg_sign`, `__priv_gpg_verify`, `__priv_gpg_list_keys`, `__priv_gpg_import`, `__priv_gpg_export` |
| Metadata | `__priv_meta_strip`, `__priv_meta_read` |
| Identity | `__priv_anonymous_id`, `__priv_pseudonym`, `__priv_isolated_credential` |
| Noise | `__priv_noise_initiate`, `__priv_noise_respond`, `__priv_noise_send`, `__priv_noise_receive`, `__priv_noise_close` |
| Keyring | `__priv_keyring_create`, `__priv_keyring_open`, `__priv_keyring_close`, `__priv_keyring_generate`, `__priv_keyring_list`, `__priv_keyring_get`, `__priv_keyring_rotate`, `__priv_keyring_revoke`, `__priv_keyring_export` |
| PII/sanitize | `__priv_pii_detect`, `__priv_pii_redact`, `__priv_sanitize_html` |
| Shamir | `__priv_shamir_split`, `__priv_shamir_combine` |
| Envelope | `__priv_envelope_encrypt`, `__priv_envelope_decrypt` |
| Image steg | `__priv_steg_image_embed`, `__priv_steg_image_extract` |
| Audit | `__priv_audit_create`, `__priv_audit_append`, `__priv_audit_verify`, `__priv_audit_entries` |
| Policy | `__priv_policy_set_retention`, `__priv_policy_record_consent`, `__priv_policy_check_consent`, `__priv_policy_revoke_consent`, `__priv_policy_erasure` |
| Utility | `__priv_check_algorithm`, `__priv_sanitize_filename`, `__priv_normalize_timestamp` |

## Backend Selection

`framework/privacy.zig` defines:

```zig
pub const Backend = enum { std, sodium };
```

The selectable operations are:

- SHA-256
- HMAC-SHA256
- HKDF-SHA256
- XChaCha20-Poly1305 encrypt/decrypt
- random bytes
- anonymous ID
- pseudonym

`std` routes to Zig standard-library crypto and `framework/crypto.zig`.
`sodium` routes to `framework/sodium.zig`.

Some operations are libsodium-only regardless of the hook backend:

- secure buffers
- keyring password KDF and key wrapping
- isolated Ed25519 credentials
- Ed25519/X25519 key generation through keyring

## Primitive Crypto API

Hook surface:

| JS API | Host function | Input | Output |
| --- | --- | --- | --- |
| `hash.sha256(data, opts?)` | `__priv_sha256` | backend, data bytes | 32 bytes |
| `hmac.sha256(key, message, opts?)` | `__priv_hmac_sha256` | backend, key bytes, message bytes | 32 bytes |
| `hkdf.derive(ikm, salt, info, length, opts?)` | `__priv_hkdf_sha256` | backend, byte inputs, output length | `length` bytes |
| `aead.xchachaEncrypt(plaintext, key, nonce, aad?, opts?)` | `__priv_xchacha_encrypt` | 32-byte key, 24-byte nonce | ciphertext plus 16-byte tag |
| `aead.xchachaDecrypt(ciphertext, key, nonce, aad?, opts?)` | `__priv_xchacha_decrypt` | ciphertext plus tag | plaintext or `null` |
| `random.bytes(n, opts?)` | `__priv_random_bytes` | `n`, max 1 MiB | random bytes |

The `std` XChaCha path returns `ciphertext || tag`. The sodium path returns the
same combined layout from `crypto_aead_xchacha20poly1305_ietf_encrypt`.

## Integrity API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `hash.file(path)` | SHA-256 hashes a file and returns hex. |
| `hash.directory(path, recursive?)` | Hashes files into a deterministic sorted manifest. |
| `hash.verify(manifest)` | Re-hashes manifest paths and reports missing/mismatched files. |

Manifest shape:

```ts
interface ManifestEntry { path: string; hash: string; }
interface Manifest { version: number; entries: ManifestEntry[]; }
interface VerifyResult { ok: boolean; missing: string[]; mismatched: string[]; }
```

`hashDirectory()` stores paths as `{dir_path}/{entry.path}`. Recursive mode uses
`std.fs.Dir.walk()` and sorts entries by path before JSON serialization.

## Secure Buffer API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `secureBuffer.alloc(hex)` | Allocates a libsodium secure buffer from hex bytes; returns numeric handle or `0`. |
| `secureBuffer.read(handle)` | Reads the secure buffer back as hex. |
| `secureBuffer.protect(handle, mode)` | Sets `readwrite`, `readonly`, or `noaccess`. |
| `secureBuffer.free(handle)` | Zeroes and releases the buffer. |

`SecureBuffer` uses `sodium_malloc`, guard pages, mlock, canary protection, and
`sodium_mprotect_*`. The binding stores buffers in a process-global registry:

```zig
const SecBufEntry = struct { id: u32, buf: privacy.SecureBuffer };
var g_secbufs: ?std.ArrayList(SecBufEntry) = null;
var g_secbuf_next_id: u32 = 1;
```

`read()` temporarily promotes protected buffers to readwrite to produce the hex
string, then restores the previous access mode.

## File Encryption and Deletion

Hook surface:

| JS API | Behavior |
| --- | --- |
| `encrypt.file(inputPath, outputPath, key)` | Encrypts a file with a 32-byte key. |
| `encrypt.decryptFile(inputPath, outputPath, key)` | Decrypts the file format written by `encrypt.file`. |
| `delete.secure(path, passes?)` | Overwrites, fsyncs, and deletes a file. |

Encrypted file format:

```text
magic "TSZE" | version 1 | nonce(24) | tag(16) | ciphertext
```

The implementation currently reads the whole input file with a 64 MiB cap. The
module comment says "streaming file encryption/decryption", but the current
implementation is whole-file.

`secureDelete()` overwrites with random data and `0xff` alternating passes, then
writes a final zero pass, fsyncs, and unlinks. This is best-effort; SSD
wear-leveling, journaling filesystems, snapshots, and backups can preserve old
data outside the file bytes being overwritten.

## Steganography and Tokenization

Hook surface:

| JS API | Behavior |
| --- | --- |
| `steg.embed(carrier, secret)` | Inserts secret bits after the first visible UTF-8 character using zero-width characters. |
| `steg.extract(encoded)` | Extracts zero-width-character bits back into bytes. |
| `stegImage.embed(rgba, data)` | Embeds data into raw RGBA using one LSB in each RGB channel. |
| `stegImage.extract(rgba)` | Extracts raw RGBA LSB payload. |
| `tokenize(value, salt)` | Returns `HMAC-SHA256(salt, value)` as hex. |

Text steganography uses:

- U+200B zero-width space for bit `0`
- U+200C zero-width non-joiner for bit `1`

Image steganography expects raw `W * H * 4` RGBA bytes. It does not load or
write PNG/JPEG files itself. The first 4 embedded bytes are a big-endian payload
length header.

## GPG and Metadata

Hook surface:

| JS API | Behavior |
| --- | --- |
| `gpg.encrypt(plaintext, recipient)` | Shells out to `gpg --encrypt`. |
| `gpg.decrypt(ciphertext)` | Shells out to `gpg --decrypt`. |
| `gpg.sign(message)` | Shells out to `gpg --clearsign`. |
| `gpg.verify(signedMessage)` | Shells out to `gpg --verify`. |
| `gpg.listKeys()` | Shells out to `gpg --list-keys --with-colons`. |
| `gpg.import(armoredKey)` | Shells out to `gpg --import`. |
| `gpg.export(keyId)` | Shells out to `gpg --armor --export`. |
| `meta.strip(path)` | Shells out to `exiftool -all= -overwrite_original`. |
| `meta.read(path)` | Shells out to `exiftool -json`. |

GPG operations write temporary files under `/tmp/tsz-gpg-*` and delete them
best-effort. They use the host user's default GPG home/configuration. Metadata
operations require `exiftool` on PATH.

## Identity API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `identity.anonymousId(domain, seed, opts?)` | Returns `HMAC-SHA256(domain, seed)`. |
| `identity.pseudonym(masterSecret, context, opts?)` | Returns `HKDF-SHA256(masterSecret, info=context, len=32)`. |
| `identity.isolatedCredential(domain)` | Generates a fresh Ed25519 keypair, random 16-byte key id, and returns all fields. |

`isolatedCredential()` returns the secret key to JS as base64-decoded bytes. It
zeros the Zig-side secret copy during `deinit()`, but JS now owns a copy in a
`Uint8Array`.

## Noise Session API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `noise.initiate(remotePublicKey)` | Creates an initiator session and returns `{ sessionId, message }`. |
| `noise.respond(staticPrivate, message)` | Creates a responder session and returns its `sessionId`. |
| `noise.send(sessionId, plaintext)` | Encrypts plaintext with the session send key. |
| `noise.receive(sessionId, ciphertext)` | Decrypts ciphertext and rejects replayed wire messages. |
| `noise.close(sessionId)` | Zeroes session keys and removes the registry entry. |

The handshake is modeled after Noise-NK:

- initiator generates an ephemeral X25519 keypair
- both sides compute X25519 DH
- HKDF derives send/receive keys
- `send()` returns `nonce(24) || tag(16) || ciphertext`
- `receive()` tracks SHA-256 hashes of received wire messages for replay
  detection

Sessions live in a process-global registry:

```zig
var g_noise_registry: ?std.ArrayList(NoiseRegistryEntry) = null;
var g_noise_next_id: u32 = 1;
```

## Keyring API

Source: `framework/keyring.zig`

Hook surface:

| JS API | Behavior |
| --- | --- |
| `keyring.create(path, masterPassword)` | Creates an encrypted keyring file and returns a handle. |
| `keyring.open(path, masterPassword)` | Opens an encrypted keyring file and returns a handle. |
| `keyring.close(handle)` | Zeroes password material and removes the handle. |
| `keyring.generate(handle, opts?)` | Generates `ed25519` or `x25519` key material. |
| `keyring.list(handle)` | Lists public key metadata. |
| `keyring.get(handle, keyId)` | Reads one public key metadata record. |
| `keyring.rotate(handle, keyId)` | Generates a replacement key and marks the old key as rotated. |
| `keyring.revoke(handle, keyId, reason)` | Marks a key revoked and saves. |
| `keyring.export(handle, keyId)` | Exports only the public key bytes. |

Keyring file format:

```text
"KRG1" | version 1 | file_salt(16) | file_nonce(24) | file_ciphertext+tag
```

The file ciphertext is JSON containing key entries. Each entry includes an
`encryptedPrivateKey` base64 blob:

```text
salt(16) | nonce(24) | ciphertext+tag
```

Both the whole file and each private key are wrapped with a KEK derived from the
master password using libsodium Argon2id:

- `opslimit = 3`
- `memlimit = 64 MiB`
- XChaCha20-Poly1305 for wrapping

Open keyrings live in a process-global handle registry:

```zig
const KeyringEntry = struct { id: u32, ring: keyring.Keyring };
var g_keyrings: ?std.ArrayList(KeyringEntry) = null;
var g_keyring_next_id: u32 = 1;
```

The keyring keeps a copy of the master password in process memory for the
handle lifetime so it can save, rotate, revoke, and wrap new private keys.
`close()` zeroes that copy. `unlockPrivate()` exists in `keyring.zig`, but it is
not exposed through `usePrivacy()`.

## PII and Sanitization

Hook surface:

| JS API | Behavior |
| --- | --- |
| `pii.detect(text)` | Returns `{ type, start, end }[]`. |
| `pii.redact(text)` | Redacts detected PII. |
| `sanitize.html(text)` | Escapes HTML-sensitive characters. |
| `filename.sanitize(name)` | Removes `../`, `./`, null bytes, control chars, and trims ASCII spaces. |
| `timestamp.normalize(ts)` | Removes fractional seconds from `...Z` ISO timestamps. |

PII detection is heuristic and currently limited to:

- email-like strings
- SSN pattern `###-##-####`
- credit-card-like patterns

It is not a general secret scanner.

## Shamir API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `shamir.split(secret, n, k)` | Splits bytes into `n` shares with threshold `k`. |
| `shamir.combine(shares)` | Combines shares back into the original bytes. |

`framework/privacy.zig` implements GF(256) Shamir sharing over each secret byte.
Share indexes are one-based. The binding serializes shares as JSON:

```ts
Array<{ index: number; data: string /* base64 */ }>
```

## Envelope API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `envelope.encrypt(data, kek)` | Generates a random DEK, encrypts data under DEK, wraps DEK under KEK. |
| `envelope.decrypt(envelope, kek)` | Unwraps DEK and decrypts data. |

Envelope shape:

```ts
interface Envelope {
  encryptedDEK: Uint8Array; // 32-byte encrypted DEK + 16-byte tag
  dekNonce: Uint8Array;     // 24 bytes
  ciphertext: Uint8Array;   // data ciphertext + 16-byte tag
  dataNonce: Uint8Array;    // 24 bytes
  algorithm: string;        // "xchacha20-poly1305"
}
```

The DEK is zeroed in Zig after encryption/decryption.

## Audit API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `audit.create(chainKeyHex)` | Initializes an in-memory HMAC hash chain. |
| `audit.append(event, data)` | Appends an event with JSON data and returns the entry. |
| `audit.verify()` | Recomputes the chain and returns validity. |
| `audit.entries(from?, to?)` | Returns in-memory audit entries. |

Audit entries include:

```ts
{
  index: number;
  timestamp: number;
  event: string;
  data: unknown;
  hash: string;
  prevHash: string;
}
```

The audit log is process-local and in-memory. It is not persisted by this module.
The chain key is a 32-byte hex string. Entry hashes are
`HMAC-SHA256(chain_key, prev_hash || serialized_entry)`.

## Policy and Consent API

Hook surface:

| JS API | Behavior |
| --- | --- |
| `policy.setRetention(category, opts)` | Stores retention options in memory. |
| `policy.recordConsent(userId, purpose, granted)` | Appends a consent record. |
| `policy.checkConsent(userId, purpose)` | Returns the latest matching grant state. |
| `policy.revokeConsent(userId, purpose?)` | Appends revocation records for one or all purposes. |
| `policy.rightToErasure(userId)` | Deletes in-memory consent records for the user. |

This is an in-memory helper, not a database-backed compliance system. It does
not scan localstore, keyrings, files, telemetry, terminal recordings, app
gallery rows, or other process state.

## Algorithm Checks

Hook surface:

| JS API | Behavior |
| --- | --- |
| `algorithm.check(name)` | Returns strength/deprecation metadata from a static table. |
| `algorithm.validateConfig(config)` | Pure JS config validator using `algorithm.check()`. |

Known classes:

| Strength | Examples |
| --- | --- |
| strong | `xchacha20-poly1305`, `chacha20-poly1305`, `aes-256-gcm`, `ed25519`, `x25519`, `sha256`, `sha512`, `blake2b`, `blake3`, `argon2id` |
| acceptable | `aes-128-gcm`, `sha384`, `scrypt`, `pbkdf2`, `blake2s` |
| weak | `sha1`, `md5`, `des`, `rc4`, `3des`, `rsa-1024` |
| broken | `md4`, `des-ecb`, `rc2`, `none` |

Unknown algorithms return `weak` with a recommendation to verify current
standards.

## App-Level Privacy Policy Data

Source: `cart/app/gallery/data/privacy.ts`,
`cart/app/gallery/data/inference-request.ts`,
`cart/app/settings/routes/privacy.tsx`

The app has a separate `Privacy` data shape:

```ts
type Privacy = {
  id: string;
  settingsId: string;
  label: string;
  proxy: { enabled: boolean; url?: string; authRef?: string; caCertPath?: string };
  tools: { mode: "allowlist" | "denylist"; allowed: string[]; denied: string[] };
  filesystem: {
    exposedPaths: string[];
    deniedPaths: string[];
    readOnlyPaths?: string[];
    maxFileSizeBytes?: number;
  };
  telemetry: {
    outboundLogging: boolean;
    secretRedaction: boolean;
    providerTelemetryOptOut: boolean;
    localOnly: boolean;
  };
  createdAt: string;
  updatedAt: string;
  summary?: string;
};
```

Inference requests snapshot a subset of that policy:

```ts
type PrivacySnapshot = {
  privacyId: string;
  proxyUsed: boolean;
  proxyUrl?: string;
  allowedTools: string[];
  exposedPaths: string[];
  outboundLogging: boolean;
  secretRedaction: boolean;
};
```

This policy model is currently app data. It documents and displays intended
boundaries for proxy routing, tools, filesystem exposure, telemetry, and
redaction. It is not automatically wired into `usePrivacy()` or globally
enforced by the V8 host binding.

Current settings route caveat: `cart/app/settings/routes/privacy.tsx` reads
fields named `privacy.filesystem.allow`, `privacy.tools.allow`, and
`privacy.network.proxy`, while the gallery data model uses `exposedPaths`,
`allowed`, and `proxy`. Treat that route as a scaffold until it is reconciled
with `cart/app/gallery/data/privacy.ts`.

## Failure and Fallback Semantics

Most JS methods degrade silently because `usePrivacy()` uses `callHost()`:

- missing host function returns the method fallback
- host exception returns the method fallback
- binding validation failure returns empty/false/zero
- JSON parse failure returns `null`, `[]`, or a default object

This is good for optional carts but bad for load-bearing security flows. If a
caller must fail closed, it should check `hasHost("__priv_sha256")` or wrap the
required host function with `callHostStrict()`.

## Current Caveats

- `usePrivacy()` import is the build trigger. Calling `__priv_*` directly
  without importing the hook can leave `has-privacy` disabled in shipped carts.
- Dev builds may include all bindings, while production carts only include
  source-selected bindings.
- The default backend is `sodium`, so privacy carts require `libsodium` at link
  and package time.
- `privacy.zig` still has an old header comment saying it uses no external C
  dependencies; current secure memory, keyring, and sodium backend require
  libsodium.
- File encryption/decryption is whole-file with a 64 MiB read cap, not streaming.
- Secure deletion is best-effort and cannot defeat SSD wear leveling,
  journaling, snapshots, or backups.
- Secure buffers, Noise sessions, keyrings, audit log, and policy records are
  process-global registries; callers must close/free what they allocate.
- Keyring handles keep the master password in process memory until closed.
- `identity.isolatedCredential()` returns secret key material to JS.
- GPG operations write plaintext/ciphertext temp files to `/tmp` and use the
  host user's GPG configuration.
- Metadata operations require `exiftool`.
- PII detection is limited to simple email, SSN, and credit-card patterns.
- Policy/consent and audit APIs are in-memory only.
- `rightToErasure()` only deletes the in-memory consent records managed by this
  module.
- Image steganography expects raw RGBA bytes and does no image codec work.
- App `Privacy` rows are modeling/snapshot data, not host-enforced policy.

## Minimal Debug Checklist

When `usePrivacy()` returns only empty values:

1. Confirm the cart imports `runtime/hooks/usePrivacy.ts` or `usePrivacy` from
   `runtime/hooks`.
2. Confirm the bundle metafile contains `runtime/hooks/usePrivacy.ts` with
   `bytesInOutput > 0`.
3. Confirm `scripts/ship` printed `privacy` in V8 bindings and `libsodium` in
   native feature libs.
4. Confirm Zig was built with `-Dhas-privacy=true`.
5. Confirm the shipped binary can load/link `libsodium`.
6. Confirm `globalThis.__priv_sha256` exists at runtime.
7. Confirm byte inputs are base64-safe and keys/nonces have exact required
   lengths.
8. For GPG or metadata calls, confirm `gpg` or `exiftool` exists on PATH.

