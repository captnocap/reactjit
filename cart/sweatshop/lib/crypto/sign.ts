const React: any = require('react');
const { useEffect, useState } = React;

import { normalizeMaybeJson, stringifyError, SIGN_HOSTS, hostSupport, callCryptoHost, type SigningAlgorithm } from './support';

export type KeyPair = {
  publicKey: string;
  privateKey: string;
  algorithm: SigningAlgorithm;
};

export type SignedMessage = {
  message: string;
  signature: string;
  publicKey: string;
  algorithm: SigningAlgorithm;
};

export type SignState = {
  available: boolean;
  pending: boolean;
  banner: string;
  error: string;
  hostFns: string[];
  signed: SignedMessage | null;
};

export type VerifyState = {
  available: boolean;
  pending: boolean;
  banner: string;
  error: string;
  hostFns: string[];
  valid: boolean | null;
};

function emptySign(hostFns: string[], available: boolean): SignState {
  return { available, pending: false, banner: available ? '' : 'host crypto bindings pending', error: '', hostFns, signed: null };
}

function emptyVerify(hostFns: string[], available: boolean): VerifyState {
  return { available, pending: false, banner: available ? '' : 'host crypto bindings pending', error: '', hostFns, valid: null };
}

function normalizeKeyPair(raw: any, algorithm: SigningAlgorithm): KeyPair {
  const value = normalizeMaybeJson<any>(raw) || {};
  return {
    publicKey: typeof value.publicKey === 'string' ? value.publicKey : '',
    privateKey: typeof value.privateKey === 'string' ? value.privateKey : '',
    algorithm: value.algorithm || algorithm,
  };
}

function normalizeSigned(raw: any, fallback: SignedMessage): SignedMessage {
  const value = normalizeMaybeJson<any>(raw) || {};
  return {
    message: typeof value.message === 'string' ? value.message : fallback.message,
    signature: typeof value.signature === 'string' ? value.signature : '',
    publicKey: typeof value.publicKey === 'string' ? value.publicKey : fallback.publicKey,
    algorithm: value.algorithm || fallback.algorithm,
  };
}

export function generateSigningKeys(algorithm: SigningAlgorithm = 'ed25519'): Promise<KeyPair | null> {
  const support = hostSupport(SIGN_HOSTS[algorithm].generate);
  if (!support.available) return Promise.resolve(null);
  return Promise.resolve().then(() => callCryptoHost(SIGN_HOSTS[algorithm].generate, null, { algorithm }))
    .then((raw) => normalizeKeyPair(raw, algorithm))
    .catch(() => null);
}

export function useSign(privateKey: string, message: string, algorithm: SigningAlgorithm = 'ed25519'): SignState {
  const support = hostSupport(SIGN_HOSTS[algorithm].sign);
  const [state, setState] = useState<SignState>(() => emptySign(support.present, support.available));

  useEffect(() => {
    if (!support.available || !privateKey) {
      setState(emptySign(support.present, support.available));
      return;
    }
    let cancelled = false;
    setState({ available: true, pending: true, banner: '', error: '', hostFns: support.present, signed: null });
    Promise.resolve().then(() => callCryptoHost(SIGN_HOSTS[algorithm].sign, null, { privateKey, message, algorithm }))
      .then((raw) => {
        if (cancelled) return;
        setState({
          available: true,
          pending: false,
          banner: '',
          error: '',
          hostFns: support.present,
          signed: normalizeSigned(raw, { message, signature: '', publicKey: '', algorithm }),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, signed: null });
      });
    return () => { cancelled = true; };
  }, [privateKey, message, algorithm]);

  return state;
}

export function useVerify(message: string, signature: string, publicKey: string, algorithm: SigningAlgorithm = 'ed25519'): VerifyState {
  const support = hostSupport(SIGN_HOSTS[algorithm].verify);
  const [state, setState] = useState<VerifyState>(() => emptyVerify(support.present, support.available));

  useEffect(() => {
    if (!support.available || !message || !signature || !publicKey) {
      setState(emptyVerify(support.present, support.available));
      return;
    }
    let cancelled = false;
    setState({ available: true, pending: true, banner: '', error: '', hostFns: support.present, valid: null });
    Promise.resolve().then(() => callCryptoHost(SIGN_HOSTS[algorithm].verify, null, { message, signature, publicKey, algorithm }))
      .then((raw) => {
        if (cancelled) return;
        const value = normalizeMaybeJson<any>(raw) || {};
        setState({
          available: true,
          pending: false,
          banner: '',
          error: '',
          hostFns: support.present,
          valid: typeof value.valid === 'boolean' ? value.valid : !!value,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, valid: null });
      });
    return () => { cancelled = true; };
  }, [algorithm, message, publicKey, signature]);

  return state;
}
