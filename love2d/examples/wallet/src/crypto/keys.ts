import { generateMnemonic as genMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { getPublicKey } from '@noble/secp256k1';

// BIP-44 path for Ethereum: m/44'/60'/0'/0/{index}
const ETH_PATH = "m/44'/60'/0'/0";

export function generateMnemonic(): string {
  return genMnemonic(wordlist, 128); // 12 words
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

export function mnemonicToSeed(mnemonic: string, passphrase?: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic, passphrase);
}

export interface Account {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
  index: number;
}

export function deriveAccount(seed: Uint8Array, index: number = 0): Account {
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive(`${ETH_PATH}/${index}`);

  if (!child.privateKey) throw new Error('Failed to derive private key');

  const privateKey = child.privateKey;
  const publicKey = getPublicKey(privateKey, false); // uncompressed
  const address = publicKeyToAddress(publicKey);

  return { privateKey, publicKey, address, index };
}

export function publicKeyToAddress(publicKey: Uint8Array): string {
  // Strip the 0x04 prefix (uncompressed key indicator)
  const keyBody = publicKey.slice(1);
  const hash = keccak_256(keyBody);
  // Address is last 20 bytes of keccak256 hash
  const addressBytes = hash.slice(12);
  return toChecksumAddress(bytesToHex(addressBytes));
}

// EIP-55 checksum address
function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));
  let result = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      result += addr[i].toUpperCase();
    } else {
      result += addr[i];
    }
  }
  return result;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
