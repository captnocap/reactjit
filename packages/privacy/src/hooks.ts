import { useMemo } from 'react';
import type { PrivacyAPI } from './types';
import * as gpg from './gpg';
import * as fileEncrypt from './file-encrypt';
import * as integrity from './integrity';
import * as keyring from './keyring';
import * as shamir from './shamir';
import * as hkdf from './hkdf';
import * as secureMem from './secure-memory';
import * as sanitize from './sanitize';
import * as secDelete from './secure-delete';
import * as identity from './identity';
import * as tor from './tor';
import * as noise from './noise';
import * as steg from './steganography';
import * as secStore from './secure-store';
import * as metadata from './metadata';
import * as policy from './policy';
import * as audit from './audit';
import * as safety from './safety';

export function usePrivacy(): PrivacyAPI {
  return useMemo<PrivacyAPI>(() => ({
    gpg: {
      encrypt: gpg.gpgEncrypt,
      decrypt: gpg.gpgDecrypt,
      sign: gpg.gpgSign,
      verify: gpg.gpgVerify,
      listKeys: gpg.gpgListKeys,
      importKey: gpg.gpgImportKey,
      exportKey: gpg.gpgExportKey,
    },
    file: {
      encrypt: fileEncrypt.encryptFile,
      decrypt: fileEncrypt.decryptFile,
      secureDelete: secDelete.secureDelete,
    },
    envelope: {
      encrypt: fileEncrypt.envelopeEncrypt,
      decrypt: fileEncrypt.envelopeDecrypt,
    },
    integrity: {
      hashFile: integrity.hashFile,
      hashDirectory: integrity.hashDirectory,
      verifyManifest: integrity.verifyManifest,
    },
    keyring: {
      create: keyring.createKeyring,
      open: keyring.openKeyring,
      close: keyring.closeKeyring,
      generateKey: keyring.generateKey,
      listKeys: keyring.listKeys,
      getKey: keyring.getKey,
      rotateKey: keyring.rotateKey,
      revokeKey: keyring.revokeKey,
      exportPublic: keyring.exportPublic,
    },
    shamir: {
      split: shamir.shamirSplit,
      combine: shamir.shamirCombine,
    },
    hkdf: {
      derive: hkdf.hkdfDerive,
    },
    secureMem: {
      alloc: secureMem.secureAlloc,
      read: secureMem.secureRead,
      free: secureMem.secureFree,
      protect: secureMem.secureProtect,
    },
    sanitize: {
      detectPII: sanitize.detectPII,
      redactPII: sanitize.redactPII,
      maskValue: sanitize.maskValue,
      redactLog: sanitize.redactLog,
      tokenize: sanitize.tokenize,
    },
    identity: {
      anonymousId: identity.anonymousId,
      pseudonym: identity.pseudonym,
      isolatedCredential: identity.isolatedCredential,
    },
    tor: {
      status: tor.torStatus,
    },
    noise: {
      initiate: noise.noiseInitiate,
      respond: noise.noiseRespond,
      send: noise.noiseSend,
      receive: noise.noiseReceive,
      close: noise.noiseClose,
    },
    steg: {
      embedImage: steg.stegEmbedImage,
      extractImage: steg.stegExtractImage,
      embedWhitespace: steg.stegEmbedWhitespace,
      extractWhitespace: steg.stegExtractWhitespace,
    },
    store: {
      create: secStore.createEncryptedStore,
    },
    metadata: {
      strip: metadata.stripMetadata,
      read: metadata.readMetadata,
      sanitizeFilename: metadata.sanitizeFilename,
      normalizeTimestamp: metadata.normalizeTimestamp,
    },
    policy: {
      setRetention: policy.setRetention,
      recordConsent: policy.recordConsent,
      checkConsent: policy.checkConsent,
      revokeConsent: policy.revokeConsent,
      rightToErasure: policy.rightToErasure,
      enforceRetention: policy.enforceRetention,
    },
    audit: {
      append: audit.appendAudit,
      verify: audit.verifyAudit,
      entries: audit.auditEntries,
    },
    safety: {
      validateConfig: safety.validateConfig,
      checkAlgorithmStrength: safety.checkAlgorithmStrength,
    },
  }), []);
}
