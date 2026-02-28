/** Encrypted data envelope */
export interface EncryptedData {
  /** Encryption algorithm used */
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305' | 'xchacha20-poly1305';
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded nonce/IV */
  nonce: string;
  /** Base64-encoded salt (for password-derived keys) */
  salt: string;
  /** KDF used */
  kdf: 'scrypt' | 'pbkdf2' | 'argon2id';
  /** KDF parameters */
  kdfParams: ScryptParams | Argon2idParams | Pbkdf2Params;
}

/** scrypt KDF parameters */
export interface ScryptParams {
  N?: number;
  r?: number;
  p?: number;
}

/** Argon2id KDF parameters */
export interface Argon2idParams {
  opslimit?: number;
  memlimit?: number;
}

/** PBKDF2 KDF parameters */
export interface Pbkdf2Params {
  iterations?: number;
}

/** Key pair for asymmetric operations */
export interface KeyPair {
  /** Hex-encoded public key */
  publicKey: string;
  /** Hex-encoded private key */
  privateKey: string;
  /** Curve used */
  curve: 'ed25519' | 'x25519';
}

/** Signed message */
export interface SignedMessage {
  /** Original message */
  message: string;
  /** Hex-encoded signature */
  signature: string;
  /** Hex-encoded public key of signer */
  publicKey: string;
  /** Signature algorithm */
  algorithm: 'ed25519';
}

/** Hash result */
export interface HashResult {
  /** Hex-encoded hash */
  hex: string;
  /** Base64-encoded hash */
  base64: string;
}

/** Options for password-based encryption */
export interface EncryptOptions {
  /** Encryption algorithm. Default: 'xchacha20-poly1305' */
  algorithm?: 'aes-256-gcm' | 'chacha20-poly1305' | 'xchacha20-poly1305';
  /** KDF to use. Default: 'argon2id' */
  kdf?: 'scrypt' | 'pbkdf2' | 'argon2id';
  /** KDF tuning params. */
  kdfParams?: ScryptParams | Argon2idParams | Pbkdf2Params;
}
