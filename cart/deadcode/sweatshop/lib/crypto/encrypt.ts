import { useEffect, useState } from 'react';
import { fromBase64, toBase64 } from './encoding';
import { ENCRYPT_HOSTS, DECRYPT_HOSTS, hostSupport, callCryptoHost, normalizeMaybeJson, stringifyError, type EncryptAlgorithm, type KdfAlgorithm } from './support';

export type EncryptOptions = {
  algorithm: EncryptAlgorithm;
  kdf: KdfAlgorithm;
  kdfParams: Record<string, any>;
};

export type EncryptedEnvelope = {
  algorithm: EncryptAlgorithm;
  ciphertext: string;
  nonce: string;
  salt: string;
  kdf: KdfAlgorithm;
  kdfParams: Record<string, any>;
};

export type CryptoOpState<T> = {
  available: boolean;
  pending: boolean;
  banner: string;
  error: string;
  hostFns: string[];
  result: T | null;
};

function emptyState<T>(available: boolean, hostFns: string[]): CryptoOpState<T> {
  return { available, pending: false, banner: available ? '' : 'host crypto bindings pending', error: '', hostFns, result: null };
}

function normalizeEnvelope(raw: any, fallback: EncryptOptions): EncryptedEnvelope {
  const value = normalizeMaybeJson<any>(raw) || {};
  return {
    algorithm: value.algorithm || fallback.algorithm,
    ciphertext: typeof value.ciphertext === 'string' ? value.ciphertext : '',
    nonce: typeof value.nonce === 'string' ? value.nonce : '',
    salt: typeof value.salt === 'string' ? value.salt : '',
    kdf: value.kdf || fallback.kdf,
    kdfParams: typeof value.kdfParams === 'object' && value.kdfParams ? value.kdfParams : fallback.kdfParams,
  };
}

export function useEncrypt(plaintext: string, password: string, options: EncryptOptions): CryptoOpState<EncryptedEnvelope> {
  const support = hostSupport(ENCRYPT_HOSTS[options.algorithm]);
  const [state, setState] = useState<CryptoOpState<EncryptedEnvelope>>(() => emptyState<EncryptedEnvelope>(support.available, support.present));

  useEffect(() => {
    if (!support.available) {
      setState(emptyState<EncryptedEnvelope>(false, support.present));
      return;
    }
    let cancelled = false;
    setState({ available: true, pending: true, banner: '', error: '', hostFns: support.present, result: null });
    Promise.resolve().then(() => callCryptoHost(ENCRYPT_HOSTS[options.algorithm], null, {
      plaintext,
      password,
      algorithm: options.algorithm,
      kdf: options.kdf,
      kdfParams: options.kdfParams,
    }))
      .then((raw) => {
        if (cancelled) return;
        setState({
          available: true,
          pending: false,
          banner: '',
          error: '',
          hostFns: support.present,
          result: normalizeEnvelope(raw, options),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, result: null });
      });
    return () => { cancelled = true; };
  }, [options.algorithm, options.kdf, JSON.stringify(options.kdfParams), plaintext, password]);

  return state;
}

export function useDecrypt(data: EncryptedEnvelope | null, password: string): CryptoOpState<string> {
  const algorithm = data?.algorithm || 'aes-256-gcm';
  const support = hostSupport(DECRYPT_HOSTS[algorithm]);
  const [state, setState] = useState<CryptoOpState<string>>(() => emptyState<string>(support.available, support.present));

  useEffect(() => {
    if (!data || !support.available) {
      setState(emptyState<string>(support.available, support.present));
      return;
    }
    let cancelled = false;
    setState({ available: true, pending: true, banner: '', error: '', hostFns: support.present, result: null });
    Promise.resolve().then(() => callCryptoHost(DECRYPT_HOSTS[algorithm], null, {
      data,
      password,
    }))
      .then((raw) => {
        if (cancelled) return;
        const value = normalizeMaybeJson<any>(raw) || {};
        setState({
          available: true,
          pending: false,
          banner: '',
          error: '',
          hostFns: support.present,
          result: typeof value.plaintext === 'string' ? value.plaintext : String(value),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, result: null });
      });
    return () => { cancelled = true; };
  }, [data ? JSON.stringify(data) : '', password, algorithm]);

  return state;
}
