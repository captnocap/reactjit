import { scrypt } from '@noble/hashes/scrypt.js';
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/hashes/utils.js';

export interface EncryptedKeystore {
  version: 1;
  salt: string;      // hex
  iv: string;        // hex
  ciphertext: string; // hex
}

const SCRYPT_N = 8192;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export function encryptKeystore(mnemonic: string, password: string): EncryptedKeystore {
  const salt = randomBytes(32);
  const iv = randomBytes(12); // AES-GCM nonce

  const key = scrypt(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: KEY_LEN });

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(mnemonic);

  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(plaintext);

  return {
    version: 1,
    salt: toHex(salt),
    iv: toHex(iv),
    ciphertext: toHex(ciphertext),
  };
}

export function decryptKeystore(store: EncryptedKeystore, password: string): string {
  const salt = fromHex(store.salt);
  const iv = fromHex(store.iv);
  const ciphertext = fromHex(store.ciphertext);

  const key = scrypt(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: KEY_LEN });

  const cipher = gcm(key, iv);
  const plaintext = cipher.decrypt(ciphertext);

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
