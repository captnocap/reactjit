// ── Secure Memory ──

export type SecureHandle = number;

export type ProtectMode = 'noaccess' | 'readonly' | 'readwrite';

// ── HKDF ──

export interface HKDFOptions {
  salt?: string;
  info?: string;
  length?: number;
}

// ── Shamir's Secret Sharing ──

export interface ShamirShare {
  index: number;
  hex: string;
}

// ── File Encryption ──

export interface FileEncryptOptions {
  algorithm?: 'xchacha20-poly1305' | 'aes-256-gcm';
  chunkSize?: number;
}

export interface EnvelopeEncrypted {
  encryptedDEK: string;
  dekNonce: string;
  ciphertext: string;
  dataNonce: string;
  algorithm: string;
}

// ── Integrity ──

export type HashAlgorithm = 'sha256' | 'sha512' | 'blake2b' | 'blake3';

export interface IntegrityReport {
  valid: boolean;
  verified: number;
  mismatched: string[];
  missing: string[];
  extra: string[];
}

// ── GPG ──

export interface GPGKey {
  keyId: string;
  fingerprint: string;
  uid: string;
  type: 'pub' | 'sec';
  algorithm: string;
  created: string;
  expires?: string;
  trust: string;
}

export interface GPGVerifyResult {
  valid: boolean;
  signer?: string;
  fingerprint?: string;
  timestamp?: string;
}

// ── Keyring ──

export type KeyringHandle = string;

export interface KeyGenOptions {
  type: 'ed25519' | 'x25519';
  label?: string;
  expiresIn?: number;
  metadata?: Record<string, string>;
}

export interface KeyEntry {
  id: string;
  type: 'ed25519' | 'x25519';
  publicKey: string;
  label?: string;
  created: number;
  expires?: number;
  revoked?: number;
  revokeReason?: string;
  rotatedTo?: string;
  metadata?: Record<string, string>;
}

// ── Identity ──

export interface IsolatedCredential {
  domain: string;
  publicKey: string;
  keyId: string;
}

// ── Sanitization ──

export type PIIType = 'email' | 'phone' | 'ssn' | 'ipv4' | 'ipv6' | 'creditCard';

export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
}

export interface RedactOptions {
  types?: PIIType[];
  replacement?: string;
  mask?: boolean;
}

export interface MaskOptions {
  visibleEnd?: number;
  visibleStart?: number;
  maskChar?: string;
}

// ── Metadata ──

export interface FileMetadata {
  [key: string]: string | number | boolean | null;
}

// ── Noise Protocol ──

export type NoiseSessionId = string;

export interface NoiseHandshake {
  sessionId: NoiseSessionId;
  message: string;
}

// ── Steganography ──

export interface StegResult {
  outputPath: string;
  bytesHidden: number;
  capacity: number;
}

// ── Secure Storage ──

export interface EncryptedStoreOptions {
  path: string;
  password: string;
  kdf?: 'argon2id' | 'scrypt';
}

export interface EncryptedStore<T = any> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  close(): Promise<void>;
}

// ── Policy ──

export interface RetentionPolicy {
  category: string;
  ttlMs: number;
  onExpiry: 'delete' | 'anonymize' | 'archive';
}

export interface ConsentRecord {
  userId: string;
  purpose: string;
  granted: boolean;
  timestamp: number;
  version?: string;
}

export interface ErasureReport {
  userId: string;
  recordsFound: number;
  recordsDeleted: number;
  categories: string[];
}

export interface RetentionReport {
  expired: number;
  deleted: number;
  anonymized: number;
  archived: number;
  errors: string[];
}

// ── Audit ──

export interface AuditEntry {
  index: number;
  timestamp: number;
  event: string;
  data?: any;
  hash: string;
  prevHash: string;
}

export interface AuditVerifyResult {
  valid: boolean;
  entries: number;
  brokenAt?: number;
}

// ── Safety ──

export type AlgorithmStrength = 'strong' | 'acceptable' | 'weak' | 'broken';

export interface AlgorithmAssessment {
  algorithm: string;
  strength: AlgorithmStrength;
  recommendation?: string;
  deprecated: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Tor ──

export interface TorStatus {
  running: boolean;
  hostname?: string;
  proxyPort?: number;
  localPort?: number;
}

// ── Master API ──

export interface PrivacyAPI {
  gpg: {
    encrypt(plaintext: string, recipientKeyId: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
    sign(message: string, keyId?: string): Promise<string>;
    verify(signed: string): Promise<GPGVerifyResult>;
    listKeys(): Promise<GPGKey[]>;
    importKey(armoredKey: string): Promise<{ imported: number }>;
    exportKey(keyId: string): Promise<string>;
  };
  file: {
    encrypt(path: string, outputPath: string, password: string, opts?: FileEncryptOptions): Promise<void>;
    decrypt(path: string, outputPath: string, password: string): Promise<void>;
    secureDelete(path: string, passes?: number): Promise<{ success: boolean; method: string }>;
  };
  envelope: {
    encrypt(data: string, kekHex: string): Promise<EnvelopeEncrypted>;
    decrypt(envelope: EnvelopeEncrypted, kekHex: string): Promise<string>;
  };
  integrity: {
    hashFile(path: string, algorithm?: HashAlgorithm): Promise<string>;
    hashDirectory(path: string, opts?: { algorithm?: HashAlgorithm; recursive?: boolean }): Promise<Record<string, string>>;
    verifyManifest(path: string, manifest: Record<string, string>): Promise<IntegrityReport>;
  };
  keyring: {
    create(path: string, masterPassword: string): Promise<KeyringHandle>;
    open(path: string, masterPassword: string): Promise<KeyringHandle>;
    close(handle: KeyringHandle): Promise<void>;
    generateKey(handle: KeyringHandle, opts: KeyGenOptions): Promise<KeyEntry>;
    listKeys(handle: KeyringHandle): Promise<KeyEntry[]>;
    getKey(handle: KeyringHandle, keyId: string): Promise<KeyEntry | null>;
    rotateKey(handle: KeyringHandle, keyId: string, reason?: string): Promise<KeyEntry>;
    revokeKey(handle: KeyringHandle, keyId: string, reason: string): Promise<void>;
    exportPublic(handle: KeyringHandle, keyId: string): Promise<string>;
  };
  shamir: {
    split(secretHex: string, totalShares: number, threshold: number): Promise<ShamirShare[]>;
    combine(shares: ShamirShare[]): Promise<string>;
  };
  hkdf: {
    derive(ikm: string, opts?: HKDFOptions): Promise<string>;
  };
  secureMem: {
    alloc(dataHex: string): Promise<SecureHandle>;
    read(handle: SecureHandle): Promise<string>;
    free(handle: SecureHandle): Promise<void>;
    protect(handle: SecureHandle, mode: ProtectMode): Promise<void>;
  };
  sanitize: {
    detectPII(text: string): Promise<PIIMatch[]>;
    redactPII(text: string, opts?: RedactOptions): Promise<string>;
    maskValue(value: string, opts?: MaskOptions): Promise<string>;
    redactLog(logLine: string): Promise<string>;
    tokenize(value: string, salt: string): Promise<string>;
  };
  identity: {
    anonymousId(domain: string, seed?: string): Promise<string>;
    pseudonym(masterSecret: string, context: string): Promise<string>;
    isolatedCredential(domain: string): Promise<IsolatedCredential>;
  };
  tor: {
    status(): Promise<TorStatus>;
  };
  noise: {
    initiate(remotePublicKey: string): Promise<NoiseHandshake>;
    respond(staticKeyId: string, handshakeMessage: string): Promise<NoiseHandshake>;
    send(sessionId: NoiseSessionId, plaintext: string): Promise<string>;
    receive(sessionId: NoiseSessionId, ciphertext: string): Promise<string>;
    close(sessionId: NoiseSessionId): Promise<void>;
  };
  steg: {
    embedImage(imagePath: string, data: string, outputPath: string): Promise<StegResult>;
    extractImage(imagePath: string): Promise<string>;
    embedWhitespace(carrier: string, secret: string): Promise<string>;
    extractWhitespace(text: string): Promise<string>;
  };
  store: {
    create<T>(opts: EncryptedStoreOptions): Promise<EncryptedStore<T>>;
  };
  metadata: {
    strip(path: string, outputPath?: string): Promise<void>;
    read(path: string): Promise<FileMetadata>;
    sanitizeFilename(name: string): Promise<string>;
    normalizeTimestamp(date: Date | string): Promise<string>;
  };
  policy: {
    setRetention(policy: RetentionPolicy): Promise<void>;
    recordConsent(userId: string, purpose: string, granted: boolean): Promise<void>;
    checkConsent(userId: string, purpose: string): Promise<boolean>;
    revokeConsent(userId: string, purpose?: string): Promise<void>;
    rightToErasure(userId: string): Promise<ErasureReport>;
    enforceRetention(): Promise<RetentionReport>;
  };
  audit: {
    create(key: string): Promise<void>;
    append(event: string, data?: any): Promise<AuditEntry>;
    verify(): Promise<AuditVerifyResult>;
    entries(opts?: { from?: number; to?: number }): Promise<AuditEntry[]>;
  };
  safety: {
    validateConfig(config: any): Promise<ValidationResult>;
    checkAlgorithmStrength(algorithm: string): Promise<AlgorithmAssessment>;
  };
}
