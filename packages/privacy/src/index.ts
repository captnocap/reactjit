import { useMemo } from 'react';
import { rpc } from './rpc';
import type {
  PrivacyAPI, GPGKey, KeyEntry, ShamirShare, PIIMatch,
  FileMetadata, HKDFOptions, EnvelopeEncrypted, NoiseHandshake,
  SecureHandle, ProtectMode, KeyGenOptions, PIIType, RedactOptions,
} from './types';

export type { PrivacyAPI } from './types';
export { setPrivacyBridge } from './rpc';

export const usePrivacy = (): PrivacyAPI => useMemo((): PrivacyAPI => ({
  gpg: {
    encrypt:   (t, k)        => rpc<{ciphertext:string}>('privacy:gpg:encrypt', {plaintext:t, recipientKeyId:k}).then((r:any) => r.ciphertext),
    decrypt:   (c)           => rpc<{plaintext:string}>('privacy:gpg:decrypt', {ciphertext:c}).then((r:any) => r.plaintext),
    sign:      (m, k)        => rpc<{signed:string}>('privacy:gpg:sign', {message:m, keyId:k}).then((r:any) => r.signed),
    verify:    (s)           => rpc('privacy:gpg:verify', {signed:s}),
    listKeys:  ()            => rpc<{keys:GPGKey[]}>('privacy:gpg:listKeys').then((r:any) => r.keys),
    importKey: (k)           => rpc('privacy:gpg:importKey', {armoredKey:k}),
    exportKey: (k)           => rpc<{key:string}>('privacy:gpg:exportKey', {keyId:k}).then((r:any) => r.key),
  },
  file: {
    encrypt:      (p, o, pw, opts) => rpc('privacy:file:encrypt', {path:p, outputPath:o, password:pw, algorithm:opts?.algorithm}),
    decrypt:      (p, o, pw)       => rpc('privacy:file:decrypt', {path:p, outputPath:o, password:pw}),
    secureDelete: (p, passes)      => rpc('privacy:file:secureDelete', {path:p, passes}),
  },
  envelope: {
    encrypt: (d, k) => rpc('privacy:envelope:encrypt', {data:d, kek:k}),
    decrypt: (e, k) => rpc<{data:string}>('privacy:envelope:decrypt', {envelope:e, kek:k}).then((r:any) => r.data),
  },
  integrity: {
    hashFile:       (p, alg)  => rpc<{hash:string}>('privacy:integrity:hashFile', {path:p, algorithm:alg}).then((r:any) => r.hash),
    hashDirectory:  (p, opts) => rpc<{manifest:Record<string,string>}>('privacy:integrity:hashDirectory', {path:p, ...opts}).then((r:any) => r.manifest),
    verifyManifest: (p, m)    => rpc('privacy:integrity:verifyManifest', {path:p, manifest:m}),
  },
  keyring: {
    create:       (p, pw)       => rpc<{handle:string}>('privacy:keyring:create', {path:p, masterPassword:pw}).then((r:any) => r.handle),
    open:         (p, pw)       => rpc<{handle:string}>('privacy:keyring:open', {path:p, masterPassword:pw}).then((r:any) => r.handle),
    close:        (h)           => rpc('privacy:keyring:close', {handle:h}),
    generateKey:  (h, opts)     => rpc<{key:KeyEntry}>('privacy:keyring:generateKey', {handle:h, opts}).then((r:any) => r.key),
    listKeys:     (h)           => rpc<{keys:KeyEntry[]}>('privacy:keyring:listKeys', {handle:h}).then((r:any) => r.keys),
    getKey:       (h, id)       => rpc<{key:KeyEntry|null}>('privacy:keyring:getKey', {handle:h, keyId:id}).then((r:any) => r.key),
    rotateKey:    (h, id, why)  => rpc<{key:KeyEntry}>('privacy:keyring:rotateKey', {handle:h, keyId:id, reason:why}).then((r:any) => r.key),
    revokeKey:    (h, id, why)  => rpc('privacy:keyring:revokeKey', {handle:h, keyId:id, reason:why}),
    exportPublic: (h, id)       => rpc<{publicKey:string}>('privacy:keyring:exportPublic', {handle:h, keyId:id}).then((r:any) => r.publicKey),
  },
  shamir: {
    split:   (s, n, k)  => rpc<{shares:ShamirShare[]}>('privacy:shamir:split', {secret:s, n, k}).then((r:any) => r.shares),
    combine: (shares)   => rpc<{secret:string}>('privacy:shamir:combine', {shares}).then((r:any) => r.secret),
  },
  hkdf: {
    derive: (ikm, opts) => rpc<{key:string}>('privacy:hkdf:derive', {ikm, ...(opts as HKDFOptions)}).then((r:any) => r.key),
  },
  secureMem: {
    alloc:   (d)    => rpc<{handle:number}>('privacy:secmem:alloc', {dataHex:d}).then((r:any) => r.handle),
    read:    (h)    => rpc<{hex:string}>('privacy:secmem:read', {handle:h}).then((r:any) => r.hex),
    free:    (h)    => rpc('privacy:secmem:free', {handle:h}),
    protect: (h, m) => rpc('privacy:secmem:protect', {handle:h, mode:m}),
  },
  sanitize: {
    detectPII: (t)       => rpc<PIIMatch[]>('privacy:sanitize:detectPII', {text:t}),
    redactPII: (t, opts) => rpc<string>('privacy:sanitize:redactPII', {text:t, ...opts}),
    maskValue: (v, opts) => rpc<string>('privacy:sanitize:maskValue', {value:v, ...opts}),
    redactLog: (l)       => rpc<string>('privacy:sanitize:redactLog', {logLine:l}),
    tokenize:  (v, s)    => rpc<{hex:string}>('privacy:sanitize:tokenize', {value:v, salt:s}).then((r:any) => r.hex),
  },
  identity: {
    anonymousId:        (d, seed) => rpc<{id:string}>('privacy:identity:anonymousId', {domain:d, seed}).then((r:any) => r.id),
    pseudonym:          (m, c)    => rpc<{pseudonym:string}>('privacy:identity:pseudonym', {masterSecret:m, context:c}).then((r:any) => r.pseudonym),
    isolatedCredential: (d)       => rpc('privacy:identity:isolatedCredential', {domain:d}),
  },
  tor: {
    status: () => rpc('tor:status'),
  },
  noise: {
    initiate: (k)      => rpc('privacy:noise:initiate', {remotePublicKey:k}),
    respond:  (k, m)   => rpc('privacy:noise:respond', {staticPrivateKey:k, handshakeMessage:m}),
    send:     (id, t)  => rpc<{ciphertext:string}>('privacy:noise:send', {sessionId:id, plaintext:t}).then((r:any) => r.ciphertext),
    receive:  (id, c)  => rpc<{plaintext:string}>('privacy:noise:receive', {sessionId:id, ciphertext:c}).then((r:any) => r.plaintext),
    close:    (id)     => rpc('privacy:noise:close', {sessionId:id}),
  },
  steg: {
    embedImage:       (ip, d, op) => rpc('privacy:steg:embedImage', {imagePath:ip, data:d, outputPath:op}),
    extractImage:     (ip)        => rpc<{data:string}>('privacy:steg:extractImage', {imagePath:ip}).then((r:any) => r.data),
    embedWhitespace:  (c, s)      => rpc<string>('privacy:steg:embedWhitespace', {carrier:c, secret:s}),
    extractWhitespace:(t)         => rpc<string>('privacy:steg:extractWhitespace', {text:t}),
  },
  store: {
    create: (opts) => rpc('privacy:store:create', opts),
  },
  metadata: {
    strip:              (p, o) => rpc('privacy:meta:strip', {path:p, outputPath:o}),
    read:               (p)    => rpc<{metadata:FileMetadata}>('privacy:meta:read', {path:p}).then((r:any) => r.metadata),
    sanitizeFilename:   (n)    => rpc<string>('privacy:meta:sanitizeFilename', {name:n}),
    normalizeTimestamp: (d)    => rpc<string>('privacy:meta:normalizeTimestamp', {date: typeof d === 'string' ? d : (d as Date).toISOString()}),
  },
  policy: {
    setRetention:     (p)       => rpc('privacy:policy:setRetention', {policy:p}),
    recordConsent:    (u, p, g) => rpc('privacy:policy:recordConsent', {userId:u, purpose:p, granted:g}),
    checkConsent:     (u, p)    => rpc<{granted:boolean}>('privacy:policy:checkConsent', {userId:u, purpose:p}).then((r:any) => r.granted),
    revokeConsent:    (u, p)    => rpc('privacy:policy:revokeConsent', {userId:u, purpose:p}),
    rightToErasure:   (u)       => rpc('privacy:policy:rightToErasure', {userId:u}),
    enforceRetention: ()        => rpc('privacy:policy:enforceRetention'),
  },
  audit: {
    create:  (key)   => rpc('privacy:audit:create', {key}),
    append:  (e, d)  => rpc('privacy:audit:append', {event:e, data:d}),
    verify:  ()      => rpc('privacy:audit:verify'),
    entries: (opts)  => rpc('privacy:audit:entries', opts),
  },
  safety: {
    validateConfig:        (c) => rpc('privacy:safety:validateConfig', {config:c}),
    checkAlgorithmStrength:(a) => rpc('privacy:safety:checkAlgorithmStrength', {algorithm:a}),
  },
}), []);

// ── Direct function exports (usable outside React components) ─────────────────

export const hkdfDerive = (ikm: string, opts?: HKDFOptions): Promise<string> =>
  rpc<{ key: string }>('privacy:hkdf:derive', { ikm, ...(opts ?? {}) }).then(r => r.key);

export const shamirSplit = (secret: string, n: number, k: number): Promise<ShamirShare[]> =>
  rpc<{ shares: ShamirShare[] }>('privacy:shamir:split', { secret, n, k }).then(r => r.shares);

export const shamirCombine = (shares: ShamirShare[]): Promise<string> =>
  rpc<{ secret: string }>('privacy:shamir:combine', { shares }).then(r => r.secret);

export const envelopeEncrypt = (data: string, kek: string): Promise<EnvelopeEncrypted> =>
  rpc<EnvelopeEncrypted>('privacy:envelope:encrypt', { data, kek });

export const envelopeDecrypt = (envelope: EnvelopeEncrypted, kek: string): Promise<string> =>
  rpc<{ data: string }>('privacy:envelope:decrypt', { envelope, kek }).then(r => r.data);

export const noiseInitiate = (remotePublicKey: string): Promise<NoiseHandshake> =>
  rpc<NoiseHandshake>('privacy:noise:initiate', { remotePublicKey });

export const noiseRespond = (staticPrivateKey: string, handshakeMessage: string): Promise<NoiseHandshake> =>
  rpc<NoiseHandshake>('privacy:noise:respond', { staticPrivateKey, handshakeMessage });

export const noiseSend = (sessionId: string, plaintext: string): Promise<string> =>
  rpc<{ ciphertext: string }>('privacy:noise:send', { sessionId, plaintext }).then(r => r.ciphertext);

export const noiseReceive = (sessionId: string, ciphertext: string): Promise<string> =>
  rpc<{ plaintext: string }>('privacy:noise:receive', { sessionId, ciphertext }).then(r => r.plaintext);

export const noiseClose = (sessionId: string): Promise<void> =>
  rpc('privacy:noise:close', { sessionId });

export const secureAlloc = (dataHex: string): Promise<SecureHandle> =>
  rpc<{ handle: number }>('privacy:secmem:alloc', { dataHex }).then(r => r.handle);

export const secureRead = (handle: SecureHandle): Promise<string> =>
  rpc<{ hex: string }>('privacy:secmem:read', { handle }).then(r => r.hex);

export const secureFree = (handle: SecureHandle): Promise<void> =>
  rpc('privacy:secmem:free', { handle });

export const secureProtect = (handle: SecureHandle, mode: ProtectMode): Promise<void> =>
  rpc('privacy:secmem:protect', { handle, mode });

export const tokenize = (value: string, salt: string): Promise<string> =>
  rpc<{ hex: string }>('privacy:sanitize:tokenize', { value, salt }).then(r => r.hex);

export const createKeyring = (path: string, masterPassword: string): Promise<string> =>
  rpc<{ handle: string }>('privacy:keyring:create', { path, masterPassword }).then(r => r.handle);

export const openKeyring = (path: string, masterPassword: string): Promise<string> =>
  rpc<{ handle: string }>('privacy:keyring:open', { path, masterPassword }).then(r => r.handle);

export const closeKeyring = (handle: string): Promise<void> =>
  rpc('privacy:keyring:close', { handle });

export const generateKey = (handle: string, opts: KeyGenOptions): Promise<KeyEntry> =>
  rpc<{ key: KeyEntry }>('privacy:keyring:generateKey', { handle, opts }).then(r => r.key);

export const listKeys = (handle: string): Promise<KeyEntry[]> =>
  rpc<{ keys: KeyEntry[] }>('privacy:keyring:listKeys', { handle }).then(r => r.keys);

export const secureDelete = (path: string, passes?: number): Promise<void> =>
  rpc('privacy:file:secureDelete', { path, passes });

// ── Pure-TS synchronous helpers ───────────────────────────────────────────────

export function stegEmbedWhitespace(carrier: string, secret: string): string {
  if (carrier.length < 2) return carrier;
  let bits = '';
  for (let i = 0; i < secret.length; i++) {
    const c = secret.charCodeAt(i);
    for (let b = 7; b >= 0; b--) bits += (c >> b) & 1 ? '\u200C' : '\u200B';
  }
  return carrier[0] + bits + carrier.slice(1);
}

const PII_PATTERNS: Array<{ type: PIIType; re: RegExp }> = [
  { type: 'email',      re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: 'ssn',        re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'creditCard', re: /\b(?:\d{4}[- ]){3}\d{4}\b/g },
  { type: 'phone',      re: /\b(?:\+?\d[\d\s\-().]{7,})\d\b/g },
  { type: 'ipv4',       re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  for (const { type, re } of PII_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export function redactPII(text: string, opts?: RedactOptions): string {
  const replacement = opts?.replacement ?? '[REDACTED]';
  const matches = detectPII(text).filter(m => !opts?.types || opts.types.includes(m.type));
  let result = '';
  let last = 0;
  for (const m of matches) {
    if (m.start >= last) {
      result += text.slice(last, m.start) + replacement;
      last = m.end;
    }
  }
  return result + text.slice(last);
}
