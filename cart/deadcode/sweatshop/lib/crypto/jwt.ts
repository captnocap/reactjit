import { useEffect, useState } from 'react';
import { bytesToUtf8, fromBase64Url, toBase64Url, utf8ToBytes } from './encoding';
import { JWT_HOSTS, callCryptoHost, hostSupport, normalizeMaybeJson, stringifyError } from './support';

export type JwtHeader = Record<string, any>;
export type JwtPayload = Record<string, any>;

export type JwtState = {
  available: boolean;
  pending: boolean;
  banner: string;
  error: string;
  hostFns: string[];
  token: string;
  verified: boolean | null;
  header: JwtHeader | null;
  payload: JwtPayload | null;
};

function emptyState(hostFns: string[], available: boolean): JwtState {
  return { available, pending: false, banner: available ? '' : 'host crypto bindings pending', error: '', hostFns, token: '', verified: null, header: null, payload: null };
}

function parseJsonObject(text: string): { value: Record<string, any> | null; error: string } {
  const raw = String(text || '').trim();
  if (!raw) return { value: null, error: '' };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { value: null, error: 'Expected a JSON object' };
    return { value: parsed, error: '' };
  } catch (err) {
    return { value: null, error: stringifyError(err) };
  }
}

function normalizeToken(raw: any): string {
  const value = normalizeMaybeJson<any>(raw);
  if (typeof value === 'string') return value;
  if (value && typeof value.token === 'string') return value.token;
  return value == null ? '' : String(value);
}

function decodeSegment(segment: string): Record<string, any> | null {
  try {
    const raw = bytesToUtf8(fromBase64Url(segment));
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function signJWT(header: JwtHeader, payload: JwtPayload, secret: string, keyId: string = ''): Promise<string | null> {
  const support = hostSupport(JWT_HOSTS.sign);
  if (!support.available) return Promise.resolve(null);
  return Promise.resolve().then(() => callCryptoHost(JWT_HOSTS.sign, null, { header, payload, secret, keyId }))
    .then((raw) => normalizeToken(raw))
    .catch(() => null);
}

export function verifyJWT(token: string, secret: string, keyId: string = ''): Promise<boolean | null> {
  const support = hostSupport(JWT_HOSTS.verify);
  if (!support.available) return Promise.resolve(null);
  return Promise.resolve().then(() => callCryptoHost(JWT_HOSTS.verify, null, { token, secret, keyId }))
    .then((raw) => {
      const value = normalizeMaybeJson<any>(raw);
      if (typeof value === 'boolean') return value;
      if (value && typeof value.valid === 'boolean') return value.valid;
      return !!value;
    })
    .catch(() => null);
}

export function useJWT(headerText: string, payloadText: string, secret: string, keyId: string = ''): JwtState {
  const header = parseJsonObject(headerText);
  const payload = parseJsonObject(payloadText);
  const support = hostSupport([...JWT_HOSTS.sign, ...JWT_HOSTS.verify]);
  const [state, setState] = useState<JwtState>(() => emptyState(support.present, support.available));

  useEffect(() => {
    if (!support.available || !secret || header.error || payload.error || !header.value || !payload.value) {
      setState({
        available: support.available,
        pending: false,
        banner: support.available ? '' : 'host crypto bindings pending',
        error: header.error || payload.error || '',
        hostFns: support.present,
        token: '',
        verified: null,
        header: header.value,
        payload: payload.value,
      });
      return;
    }
    let cancelled = false;
    setState({ available: true, pending: true, banner: '', error: '', hostFns: support.present, token: '', verified: null, header: header.value, payload: payload.value });
    Promise.resolve().then(() => callCryptoHost(JWT_HOSTS.sign, null, { header: header.value, payload: payload.value, secret, keyId }))
      .then((raw) => {
        if (cancelled) return;
        const token = normalizeToken(raw);
        if (!token) {
          setState({ available: true, pending: false, banner: '', error: 'JWT signing returned no token', hostFns: support.present, token: '', verified: null, header: header.value, payload: payload.value });
          return;
        }
        Promise.resolve().then(() => callCryptoHost(JWT_HOSTS.verify, null, { token, secret, keyId }))
          .then((verifyRaw) => {
            if (cancelled) return;
            const verifyValue = normalizeMaybeJson<any>(verifyRaw);
            const verified = typeof verifyValue === 'boolean' ? verifyValue : !!(verifyValue && typeof verifyValue.valid === 'boolean' ? verifyValue.valid : verifyValue);
            setState({ available: true, pending: false, banner: '', error: '', hostFns: support.present, token, verified, header: header.value, payload: payload.value });
          })
          .catch((err) => {
            if (cancelled) return;
            setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, token, verified: null, header: header.value, payload: payload.value });
          });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ available: true, pending: false, banner: '', error: stringifyError(err), hostFns: support.present, token: '', verified: null, header: header.value, payload: payload.value });
      });
    return () => { cancelled = true; };
  }, [headerText, payloadText, secret, keyId]);

  return state;
}

export function decodeJwtToken(token: string): { header: Record<string, any> | null; payload: Record<string, any> | null } {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length < 2) return { header: null, payload: null };
  return {
    header: decodeSegment(parts[0]),
    payload: decodeSegment(parts[1]),
  };
}

export { utf8ToBytes, toBase64Url };
