import { rpc } from './rpc';
import type { AuditEntry, AuditVerifyResult } from './types';

let entries: AuditEntry[] = [];
let chainKeyHex = '';
let initialized = false;

async function hmac(key: string, message: string): Promise<string> {
  const r = await rpc<{ hex: string }>('crypto:hmac', { algorithm: 'sha256', key, message });
  return r.hex;
}

export function initAuditLog(key: string): void {
  chainKeyHex = key;
  entries = [];
  initialized = true;
}

export const createAuditLog = initAuditLog;

export async function appendAudit(event: string, data?: any): Promise<AuditEntry> {
  if (!initialized) throw new Error('Audit log not initialized. Call createAuditLog(key) first.');

  const index = entries.length;
  const prevHash = index > 0 ? entries[index - 1].hash : '0';
  const timestamp = Date.now();

  const entry: Omit<AuditEntry, 'hash'> = { index, timestamp, event, data, prevHash };
  const hash = await hmac(chainKeyHex, prevHash + JSON.stringify(entry));

  const full: AuditEntry = { ...entry, hash };
  entries.push(full);
  return full;
}

export async function verifyAudit(): Promise<AuditVerifyResult> {
  if (entries.length === 0) return { valid: true, entries: 0 };

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const expectedPrev = i > 0 ? entries[i - 1].hash : '0';
    if (e.prevHash !== expectedPrev) return { valid: false, entries: entries.length, brokenAt: i };

    const stripped: Omit<AuditEntry, 'hash'> = {
      index: e.index,
      timestamp: e.timestamp,
      event: e.event,
      data: e.data,
      prevHash: e.prevHash,
    };
    const computed = await hmac(chainKeyHex, e.prevHash + JSON.stringify(stripped));
    if (computed !== e.hash) return { valid: false, entries: entries.length, brokenAt: i };
  }

  return { valid: true, entries: entries.length };
}

export async function auditEntries(opts?: { from?: number; to?: number }): Promise<AuditEntry[]> {
  const from = opts?.from ?? 0;
  const to = opts?.to ?? entries.length;
  return entries.slice(from, to);
}
