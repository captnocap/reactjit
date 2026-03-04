// ── Types ──
export type {
  SecureHandle,
  ProtectMode,
  HKDFOptions,
  ShamirShare,
  FileEncryptOptions,
  EnvelopeEncrypted,
  HashAlgorithm,
  IntegrityReport,
  GPGKey,
  GPGVerifyResult,
  KeyringHandle,
  KeyGenOptions,
  KeyEntry,
  IsolatedCredential,
  PIIType,
  PIIMatch,
  RedactOptions,
  MaskOptions,
  FileMetadata,
  NoiseSessionId,
  NoiseHandshake,
  StegResult,
  EncryptedStoreOptions,
  EncryptedStore,
  RetentionPolicy,
  ConsentRecord,
  ErasureReport,
  RetentionReport,
  AuditEntry,
  AuditVerifyResult,
  AlgorithmStrength,
  AlgorithmAssessment,
  ValidationResult,
  TorStatus,
  PrivacyAPI,
} from './types';

// ── Bridge ──
export { setPrivacyBridge } from './rpc';

// ── Master Hook ──
export { usePrivacy } from './hooks';

// ── Individual Modules ──
export { gpgEncrypt, gpgDecrypt, gpgSign, gpgVerify, gpgListKeys, gpgImportKey, gpgExportKey } from './gpg';
export { encryptFile, decryptFile, envelopeEncrypt, envelopeDecrypt } from './file-encrypt';
export { hashFile, hashDirectory, verifyManifest } from './integrity';
export { createKeyring, openKeyring, closeKeyring, generateKey, listKeys, getKey, rotateKey, revokeKey, exportPublic } from './keyring';
export { shamirSplit, shamirCombine } from './shamir';
export { hkdfDerive } from './hkdf';
export { secureAlloc, secureRead, secureFree, secureProtect } from './secure-memory';
export { detectPII, redactPII, maskValue, redactLog, tokenize } from './sanitize';
export { secureDelete } from './secure-delete';
export { anonymousId, pseudonym, isolatedCredential } from './identity';
export { torStatus } from './tor';
export { noiseInitiate, noiseRespond, noiseSend, noiseReceive, noiseClose } from './noise';
export { stegEmbedImage, stegExtractImage, stegEmbedWhitespace, stegExtractWhitespace } from './steganography';
export { createEncryptedStore } from './secure-store';
export { stripMetadata, readMetadata, sanitizeFilename, normalizeTimestamp } from './metadata';
export { setRetention, recordConsent, checkConsent, revokeConsent, rightToErasure, enforceRetention } from './policy';
export { createAuditLog, appendAudit, verifyAudit, auditEntries } from './audit';
export { validateConfig, checkAlgorithmStrength, RECOMMENDED_DEFAULTS } from './safety';
