import { useEffect, useState } from 'react';
import { KDF_HOSTS, callCryptoHost, hostSupport, normalizeMaybeJson, stringifyError, type KdfAlgorithm } from './support';

export type KDFParams = Record<string, number | string | undefined>;

export type KDFState = {
  available: boolean;
  pending: boolean;
  banner: string;
  error: string;
  hostFns: string[];
  derivedKey: string;
};

function emptyState(hostFns: string[], available: boolean): KDFState {
  return { available, pending: false, banner: available ? '' : 'host crypto bindings pending', error: '', hostFns, derivedKey: '' };
}

function normalizeDerived(raw: any): string {
  const value = normalizeMaybeJson<any>(raw);
  if (typeof value === 'string') return value;
  if (value && typeof value.derivedKey === 'string') return value.derivedKey;
  if (value && typeof value.hex === 'string') return value.hex;
  return value == null ? '' : String(value);
}

export function useKDF(password: string, salt: string, algorithm: KdfAlgorithm, params: KDFParams = {}, length = 32): KDFState {
  const support = hostSupport(KDF_HOSTS[algorithm]);
  const [state, setState] = useState<KDFState>(() => emptyState(support.present, support.available));

  useEffect(() => {
    if (!support.available) {
      setState(emptyState(support.present, support.available));
      return;
    }
    let cancelled = false;
    setState({ available: true, pending: true, banner: '', error: '', hostFns: support.present, derivedKey: '' });
    Promise.resolve().then(() => callCryptoHost(KDF_HOSTS[algorithm], null, { password, salt, algorithm, params, length }))
      .then((raw) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: '', hostFns: support.present, derivedKey: normalizeDerived(raw) });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, derivedKey: '' });
      });
    return () => { cancelled = true; };
  }, [algorithm, length, password, salt, JSON.stringify(params)]);

  return state;
}
