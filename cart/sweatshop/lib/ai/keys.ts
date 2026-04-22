
import type { AIProviderType, APIKeyRecord } from './types';

// Per-provider API-key storage. Ported from the love2d reference — the
// reference hooks a `__storageAdapter` if one is registered, otherwise
// falls back to localStorage. We ship the localStorage path directly
// since sweatshop doesn't wire an adapter here.

const KEY_PREFIX = 'sweatshop:ai:keys:';
const INDEX_KEY = 'sweatshop:ai:keys:__index';

function readIndex(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) { return []; }
}

function writeIndex(ids: string[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(INDEX_KEY, JSON.stringify(ids)); } catch (_e) {}
}

export function loadAllKeys(): APIKeyRecord[] {
  if (typeof localStorage === 'undefined') return [];
  const ids = readIndex();
  const out: APIKeyRecord[] = [];
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + id);
      if (raw) out.push(JSON.parse(raw));
    } catch (_e) {}
  }
  return out;
}

export function saveKey(record: Omit<APIKeyRecord, 'id'> & { id?: string }): string {
  const id = record.id || (record.provider + '_' + Date.now().toString(36));
  const full: APIKeyRecord = { ...record, id } as APIKeyRecord;
  try {
    if (typeof localStorage === 'undefined') return id;
    localStorage.setItem(KEY_PREFIX + id, JSON.stringify(full));
    const ids = readIndex();
    if (!ids.includes(id)) writeIndex([...ids, id]);
  } catch (_e) {}
  return id;
}

export function deleteKeyById(id: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(KEY_PREFIX + id);
    writeIndex(readIndex().filter((x) => x !== id));
  } catch (_e) {}
}

export function getKeyForProvider(provider: AIProviderType): APIKeyRecord | undefined {
  return loadAllKeys().find((k) => k.provider === provider);
}

export function useAPIKeys() {
  const [keys, setKeys] = useState<APIKeyRecord[]>(() => loadAllKeys());
  const [loading, setLoading] = useState(false);

  useEffect(() => { setKeys(loadAllKeys()); }, []);

  const setKey = useCallback(async (record: Omit<APIKeyRecord, 'id'> & { id?: string }) => {
    const id = saveKey(record);
    setKeys(loadAllKeys());
    return id;
  }, []);

  const deleteKey = useCallback(async (id: string) => {
    deleteKeyById(id);
    setKeys(loadAllKeys());
  }, []);

  const getKey = useCallback((provider: AIProviderType) => keys.find((k) => k.provider === provider), [keys]);

  return { keys, setKey, deleteKey, getKey, loading };
}
