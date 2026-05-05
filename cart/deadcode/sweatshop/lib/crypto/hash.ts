import { useEffect, useState } from 'react';
import { fromHex, toBase64, toHex } from './encoding';
import { HASH_HOSTS, hostSupport, callCryptoHost, normalizeMaybeJson, stringifyError, type HashAlgorithm } from './support';

export { type HashAlgorithm };

export type HashDigest = {
  hex: string;
  base64: string;
};

export type HashState = {
  algorithm: HashAlgorithm;
  input: string;
  available: boolean;
  pending: boolean;
  banner: string;
  error: string;
  hostFns: string[];
  digest: HashDigest | null;
};

function digestFromRaw(raw: any): HashDigest {
  const value = normalizeMaybeJson<any>(raw);
  if (!value) return { hex: '', base64: '' };
  if (value.hex || value.base64) {
    const hex = typeof value.hex === 'string' ? value.hex : '';
    const base64 = typeof value.base64 === 'string' ? value.base64 : (hex ? toBase64(fromHex(hex)) : '');
    return { hex, base64 };
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^[0-9a-f]+$/i.test(text) && text.length % 2 === 0) {
      return { hex: text.toLowerCase(), base64: toBase64(fromHex(text)) };
    }
    return { hex: text, base64: '' };
  }
  if (value instanceof Uint8Array) return { hex: toHex(value), base64: toBase64(value) };
  return { hex: String(value), base64: '' };
}

function makeState(algorithm: HashAlgorithm, input: string, supported: ReturnType<typeof hostSupport>): HashState {
  return {
    algorithm,
    input,
    available: supported.available,
    pending: false,
    banner: supported.available ? '' : 'host crypto bindings pending',
    error: '',
    hostFns: supported.present,
    digest: null,
  };
}

export function useHash(input: string, algorithm: HashAlgorithm): HashState {
  const support = hostSupport(HASH_HOSTS[algorithm]);
  const [state, setState] = useState<HashState>(() => makeState(algorithm, input, support));

  useEffect(() => {
    if (!support.available) {
      setState(makeState(algorithm, input, support));
      return;
    }
    let cancelled = false;
    setState({
      algorithm,
      input,
      available: true,
      pending: true,
      banner: '',
      error: '',
      hostFns: support.present,
      digest: null,
    });
    Promise.resolve().then(() => callCryptoHost(HASH_HOSTS[algorithm], null, { algorithm, input }))
      .then((raw) => {
        if (cancelled) return;
        setState({
          algorithm,
          input,
          available: true,
          pending: false,
          banner: '',
          error: '',
          hostFns: support.present,
          digest: digestFromRaw(raw),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          algorithm,
          input,
          available: true,
          pending: false,
          banner: '',
          error: stringifyError(err),
          hostFns: support.present,
          digest: null,
        });
      });
    return () => { cancelled = true; };
  }, [algorithm, input]);

  return state;
}
