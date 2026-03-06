import type { RetentionPolicy, ConsentRecord, ErasureReport, RetentionReport } from './types';

const retentionPolicies = new Map<string, RetentionPolicy>();
const consentRecords: ConsentRecord[] = [];
const dataStore = new Map<string, { category: string; created: number; data: any }[]>();

export async function setRetention(policy: RetentionPolicy): Promise<void> {
  retentionPolicies.set(policy.category, policy);
}

export async function recordConsent(userId: string, purpose: string, granted: boolean): Promise<void> {
  consentRecords.push({ userId, purpose, granted, timestamp: Date.now() });
}

export async function checkConsent(userId: string, purpose: string): Promise<boolean> {
  for (let i = consentRecords.length - 1; i >= 0; i--) {
    const r = consentRecords[i];
    if (r.userId === userId && r.purpose === purpose) return r.granted;
  }
  return false;
}

export async function revokeConsent(userId: string, purpose?: string): Promise<void> {
  if (purpose) {
    consentRecords.push({ userId, purpose, granted: false, timestamp: Date.now() });
  } else {
    const purposes = new Set<string>();
    for (const r of consentRecords) {
      if (r.userId === userId) purposes.add(r.purpose);
    }
    const now = Date.now();
    for (const p of purposes) {
      consentRecords.push({ userId, purpose: p, granted: false, timestamp: now });
    }
  }
}

export async function rightToErasure(userId: string): Promise<ErasureReport> {
  const categories: string[] = [];
  let recordsFound = 0;
  let recordsDeleted = 0;

  for (const [category, entries] of dataStore) {
    const before = entries.length;
    const remaining = entries.filter(e => {
      if (e.category === category) {
        return false;
      }
      return true;
    });
    const userEntries = before - remaining.length;
    if (userEntries > 0) {
      recordsFound += userEntries;
      recordsDeleted += userEntries;
      categories.push(category);
      dataStore.set(category, remaining);
    }
  }

  let i = consentRecords.length;
  while (i--) {
    if (consentRecords[i].userId === userId) {
      recordsFound++;
      recordsDeleted++;
      consentRecords.splice(i, 1);
    }
  }

  return { userId, recordsFound, recordsDeleted, categories };
}

export async function enforceRetention(): Promise<RetentionReport> {
  const now = Date.now();
  const report: RetentionReport = { expired: 0, deleted: 0, anonymized: 0, archived: 0, errors: [] };

  for (const [category, entries] of dataStore) {
    const policy = retentionPolicies.get(category);
    if (!policy) continue;

    const remaining: typeof entries = [];
    for (const entry of entries) {
      const age = now - entry.created;
      if (age > policy.ttlMs) {
        report.expired++;
        switch (policy.onExpiry) {
          case 'delete':
            report.deleted++;
            break;
          case 'anonymize':
            entry.data = null;
            report.anonymized++;
            remaining.push(entry);
            break;
          case 'archive':
            report.archived++;
            remaining.push(entry);
            break;
        }
      } else {
        remaining.push(entry);
      }
    }
    dataStore.set(category, remaining);
  }

  return report;
}
