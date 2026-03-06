import type { AlgorithmAssessment, AlgorithmStrength, ValidationResult } from './types';

const STRONG_ALGORITHMS = ['xchacha20-poly1305', 'chacha20-poly1305', 'aes-256-gcm', 'ed25519', 'x25519', 'sha256', 'sha512', 'blake2b', 'blake3', 'argon2id'];
const ACCEPTABLE_ALGORITHMS = ['aes-128-gcm', 'sha384', 'scrypt', 'pbkdf2', 'blake2s'];
const WEAK_ALGORITHMS = ['sha1', 'md5', 'des', 'rc4', '3des', 'rsa-1024'];
const BROKEN_ALGORITHMS = ['md4', 'des-ecb', 'rc2', 'none'];

export const RECOMMENDED_DEFAULTS = {
  algorithm: 'xchacha20-poly1305' as const,
  kdf: 'argon2id' as const,
  hashAlgorithm: 'sha256' as const,
  keySize: 32,
  nonceSize: 24,
  saltSize: 16,
  argon2Ops: 2,
  argon2Mem: 67108864,
  scryptN: 131072,
  scryptR: 8,
  scryptP: 1,
  pbkdf2Iterations: 100000,
};

export function checkAlgorithmStrength(algorithm: string): AlgorithmAssessment {
  const lower = algorithm.toLowerCase();

  if (BROKEN_ALGORITHMS.includes(lower)) {
    return { algorithm, strength: 'broken', deprecated: true, recommendation: `${algorithm} is broken. Use ${RECOMMENDED_DEFAULTS.algorithm} instead.` };
  }
  if (WEAK_ALGORITHMS.includes(lower)) {
    return { algorithm, strength: 'weak', deprecated: true, recommendation: `${algorithm} is weak. Migrate to ${RECOMMENDED_DEFAULTS.algorithm}.` };
  }
  if (ACCEPTABLE_ALGORITHMS.includes(lower)) {
    return { algorithm, strength: 'acceptable', deprecated: false };
  }
  if (STRONG_ALGORITHMS.includes(lower)) {
    return { algorithm, strength: 'strong', deprecated: false };
  }

  return { algorithm, strength: 'weak', deprecated: false, recommendation: `Unknown algorithm "${algorithm}". Verify it meets current security standards.` };
}

export function validateConfig(config: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be a non-null object'], warnings: [] };
  }

  if (config.algorithm) {
    const assessment = checkAlgorithmStrength(config.algorithm);
    if (assessment.strength === 'broken') errors.push(`Algorithm "${config.algorithm}" is broken and must not be used.`);
    else if (assessment.strength === 'weak') warnings.push(`Algorithm "${config.algorithm}" is weak. Consider upgrading.`);
  }

  if (config.keySize !== undefined) {
    if (typeof config.keySize !== 'number' || config.keySize < 16) {
      errors.push(`Key size must be at least 16 bytes. Got ${config.keySize}.`);
    } else if (config.keySize < 32) {
      warnings.push(`Key size ${config.keySize} is below recommended 32 bytes.`);
    }
  }

  if (config.nonceSize !== undefined) {
    if (typeof config.nonceSize !== 'number' || config.nonceSize < 8) {
      errors.push(`Nonce size must be at least 8 bytes. Got ${config.nonceSize}.`);
    }
  }

  if (config.saltSize !== undefined) {
    if (typeof config.saltSize !== 'number' || config.saltSize < 8) {
      errors.push(`Salt size must be at least 8 bytes. Got ${config.saltSize}.`);
    } else if (config.saltSize < 16) {
      warnings.push(`Salt size ${config.saltSize} is below recommended 16 bytes.`);
    }
  }

  if (config.iterations !== undefined || config.pbkdf2Iterations !== undefined) {
    const iter = config.iterations ?? config.pbkdf2Iterations;
    if (typeof iter !== 'number' || iter < 10000) {
      errors.push(`Iterations must be at least 10000. Got ${iter}.`);
    } else if (iter < 100000) {
      warnings.push(`Iterations ${iter} is below recommended 100000.`);
    }
  }

  if (config.argon2Ops !== undefined) {
    if (typeof config.argon2Ops !== 'number' || config.argon2Ops < 1) {
      errors.push(`argon2Ops must be at least 1. Got ${config.argon2Ops}.`);
    }
  }

  if (config.argon2Mem !== undefined) {
    if (typeof config.argon2Mem !== 'number' || config.argon2Mem < 8192) {
      errors.push(`argon2Mem must be at least 8192 bytes. Got ${config.argon2Mem}.`);
    }
  }

  if (config.scryptN !== undefined) {
    if (typeof config.scryptN !== 'number' || config.scryptN < 1024) {
      errors.push(`scryptN must be at least 1024. Got ${config.scryptN}.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
