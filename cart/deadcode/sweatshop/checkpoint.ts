const host: any = globalThis as any;

export interface Checkpoint {
  id: string;
  turnIndex: number;
  timestamp: number;
  messageId: string;
  diff: CheckpointDiff[];
}

export interface CheckpointDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  patch: string;
  additions: number;
  deletions: number;
}

const STORE_KEY = 'sweatshop.checkpoints';

function execRaw(cmd: string): string {
  if (typeof host.__exec !== 'function') return '';
  try {
    const out = host.__exec(cmd);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

function trimLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
}

function generateId(): string {
  return 'cp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function storeGet(key: string): string | null {
  try {
    if (typeof host.__store_get === 'function') return host.__store_get(key);
  } catch {}
  return null;
}

function storeSet(key: string, value: string): void {
  try {
    if (typeof host.__store_set === 'function') host.__store_set(key, value);
  } catch {}
}

function storeDel(key: string): void {
  try {
    if (typeof host.__store_del === 'function') host.__store_del(key);
  } catch {}
}

function computeDiff(workDir: string): CheckpointDiff[] {
  try {
    const statRaw = execRaw(`cd "${workDir}" && git diff --numstat HEAD 2>/dev/null`);
    const statLines = trimLines(statRaw);
    const stats: Record<string, { additions: number; deletions: number }> = {};
    for (const line of statLines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const add = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
      const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
      const path = parts[2];
      stats[path] = { additions: add, deletions: del };
    }

    const patchRaw = execRaw(`cd "${workDir}" && git diff HEAD 2>/dev/null`);
    const diffs: CheckpointDiff[] = [];
    const chunks = patchRaw.split('diff --git a/');
    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const firstLineEnd = trimmed.indexOf('\n');
      const firstLine = firstLineEnd >= 0 ? trimmed.slice(0, firstLineEnd) : trimmed;
      const pathMatch = firstLine.match(/^(.*?)\s+b\//);
      const path = pathMatch ? pathMatch[1] : firstLine;
      if (!path) continue;

      let status: CheckpointDiff['status'] = 'modified';
      if (chunk.includes('new file mode')) status = 'added';
      else if (chunk.includes('deleted file mode')) status = 'deleted';

      const s = stats[path] || { additions: 0, deletions: 0 };
      diffs.push({
        path,
        status,
        additions: s.additions,
        deletions: s.deletions,
        patch: 'diff --git a/' + chunk,
      });
    }

    return diffs;
  } catch {
    return [];
  }
}

export function saveCheckpoint(turnIndex: number, messageId: string, workDir: string): Checkpoint {
  const checkpoint: Checkpoint = {
    id: generateId(),
    turnIndex,
    timestamp: Date.now(),
    messageId,
    diff: computeDiff(workDir),
  };

  const existing = loadCheckpoints();
  existing.push(checkpoint);
  storeSet(STORE_KEY, JSON.stringify(existing));
  return checkpoint;
}

export function loadCheckpoints(): Checkpoint[] {
  const raw = storeGet(STORE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function getCheckpointForMessage(messageId: string): Checkpoint | null {
  const checkpoints = loadCheckpoints();
  return checkpoints.find((cp) => cp.messageId === messageId) || null;
}

export function clearCheckpoints(): void {
  storeDel(STORE_KEY);
}
