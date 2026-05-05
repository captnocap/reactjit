const host: any = globalThis as any;

export type HostSupport = {
  available: boolean;
  present: string[];
  missing: string[];
  banner: string;
};

export type HashAlgorithm = 'sha256' | 'sha512' | 'blake3' | 'md5';
export type EncryptAlgorithm = 'aes-256-gcm' | 'chacha20-poly1305';
export type KdfAlgorithm = 'pbkdf2' | 'argon2id' | 'scrypt';
export type SigningAlgorithm = 'ed25519' | 'rsa-pss';

export const HASH_HOSTS: Record<HashAlgorithm, string[]> = {
  sha256: ['__crypto_hash_sha256', '__crypto_sha256', '__crypto_digest_sha256'],
  sha512: ['__crypto_hash_sha512', '__crypto_sha512', '__crypto_digest_sha512'],
  blake3: ['__crypto_hash_blake3', '__crypto_blake3'],
  md5: ['__crypto_hash_md5', '__crypto_md5', '__crypto_digest_md5'],
};

export const ENCRYPT_HOSTS: Record<EncryptAlgorithm, string[]> = {
  'aes-256-gcm': ['__crypto_encrypt_aes256gcm', '__crypto_encrypt_aes_256_gcm', '__crypto_aes256gcm_encrypt'],
  'chacha20-poly1305': ['__crypto_encrypt_chacha20poly1305', '__crypto_encrypt_chacha20_poly1305', '__crypto_chacha20poly1305_encrypt'],
};

export const DECRYPT_HOSTS: Record<EncryptAlgorithm, string[]> = {
  'aes-256-gcm': ['__crypto_decrypt_aes256gcm', '__crypto_decrypt_aes_256_gcm', '__crypto_aes256gcm_decrypt'],
  'chacha20-poly1305': ['__crypto_decrypt_chacha20poly1305', '__crypto_decrypt_chacha20_poly1305', '__crypto_chacha20poly1305_decrypt'],
};

export const SIGN_HOSTS: Record<SigningAlgorithm, { generate: string[]; sign: string[]; verify: string[] }> = {
  ed25519: {
    generate: ['__crypto_sign_ed25519_generate', '__crypto_generate_ed25519', '__crypto_ed25519_generate'],
    sign: ['__crypto_sign_ed25519', '__crypto_ed25519_sign'],
    verify: ['__crypto_verify_ed25519', '__crypto_ed25519_verify'],
  },
  'rsa-pss': {
    generate: ['__crypto_sign_rsapss_generate', '__crypto_generate_rsapss', '__crypto_rsapss_generate'],
    sign: ['__crypto_sign_rsapss', '__crypto_rsapss_sign'],
    verify: ['__crypto_verify_rsapss', '__crypto_rsapss_verify'],
  },
};

export const KDF_HOSTS: Record<KdfAlgorithm, string[]> = {
  pbkdf2: ['__crypto_kdf_pbkdf2', '__crypto_pbkdf2'],
  argon2id: ['__crypto_kdf_argon2id', '__crypto_argon2id'],
  scrypt: ['__crypto_kdf_scrypt', '__crypto_scrypt'],
};

export const JWT_HOSTS = {
  sign: ['__crypto_jwt_sign', '__crypto_sign_jwt'],
  verify: ['__crypto_jwt_verify', '__crypto_verify_jwt'],
};

export function listCryptoHostFunctions(): string[] {
  const names: string[] = [];
  for (const key of Object.keys(host)) {
    if (!key.startsWith('__crypto_')) continue;
    if (typeof host[key] !== 'function') continue;
    names.push(key);
  }
  names.sort();
  return names;
}

export function hasCryptoHostFunction(name: string): boolean {
  return typeof host[name] === 'function';
}

export function pickHostFunction(candidates: string[]): string | null {
  for (const name of candidates) {
    if (hasCryptoHostFunction(name)) return name;
  }
  return null;
}

export function hostSupport(candidates: string[]): HostSupport {
  const present: string[] = [];
  const missing: string[] = [];
  for (const name of candidates) {
    if (hasCryptoHostFunction(name)) present.push(name);
    else missing.push(name);
  }
  return {
    available: present.length > 0,
    present,
    missing,
    banner: present.length > 0 ? 'host crypto bindings partial' : 'host crypto bindings pending',
  };
}

export function callCryptoHost<T>(candidates: string[], fallback: T, payload: any): T {
  const name = pickHostFunction(candidates);
  if (!name) return fallback;
  return host[name](payload) as T;
}

export function normalizeMaybeJson<T>(value: any): T {
  if (value == null) return value as T;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return value as T;
  const raw = value.trim();
  if (!raw) return value as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return value as T;
  }
}

export function stringifyError(err: any): string {
  if (!err) return 'Unknown crypto error';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
