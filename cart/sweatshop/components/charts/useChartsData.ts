
import { COLORS } from '../../theme';
import { exec } from '../../host';
import type { ChartInput } from './useChartData';

type WorkSummary = {
  workDir: string;
  branch: string;
  ahead: number;
  behind: number;
  dirty: number;
  staged: number;
  trackedFiles: number;
  paletteHits: number;
  buildSha: string;
  buildTime: string;
};

export type ChartsSnapshot = {
  summary: WorkSummary;
  commitsByDay: ChartInput;
  churnByDay: ChartInput;
  fileSizeHistory: ChartInput;
  extensionMix: ChartInput;
  commitLabels: string[];
  churnLabels: string[];
  fileSizeLabels: string[];
};

function q(value: string): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function trimLines(raw: string): string[] {
  return raw.split('\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);
}

function dayLabel(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDays(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) out.push(dayLabel(new Date(now.getTime() - i * 86400000)));
  return out;
}

function compactLabel(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function readStoreJson(key: string): any {
  try {
    const host: any = globalThis as any;
    const raw = typeof host.__store_get === 'function' ? host.__store_get(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hostString(key: string, fallback: string): string {
  try {
    const host: any = globalThis as any;
    const value = host[key];
    if (typeof value === 'string' && value) return value;
    if (typeof host.__env_get === 'function') {
      const env = host.__env_get(key);
      if (typeof env === 'string' && env) return env;
    }
  } catch {}
  return fallback;
}

function buildCommitSeries(workDir: string, days: string[]): number[] {
  const counts: Record<string, number> = {};
  const raw = exec(`cd ${q(workDir)} && git log --since="${days.length - 1} days ago" --date=short --pretty=format:@@%ad 2>/dev/null`);
  for (const line of trimLines(raw)) {
    if (!line.startsWith('@@')) continue;
    const day = line.slice(2).trim();
    counts[day] = (counts[day] || 0) + 1;
  }
  return days.map((day) => counts[day] || 0);
}

function buildChurnSeries(workDir: string, days: string[]): { additions: number[]; deletions: number[]; net: number[] } {
  const additions = days.map(() => 0);
  const deletions = days.map(() => 0);
  const index = new Map(days.map((day, i) => [day, i]));
  let current = '';
  const raw = exec(`cd ${q(workDir)} && git log --since="${days.length - 1} days ago" --date=short --pretty=format:@@%ad --numstat 2>/dev/null`);
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@@')) {
      current = trimmed.slice(2).trim();
      continue;
    }
    if (!current || !index.has(current)) continue;
    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;
    const add = parts[0] === '-' ? 0 : Number(parts[0]) || 0;
    const del = parts[1] === '-' ? 0 : Number(parts[1]) || 0;
    const idx = index.get(current)!;
    additions[idx] += add;
    deletions[idx] += del;
  }
  const net: number[] = [];
  let total = 0;
  for (let i = 0; i < days.length; i += 1) {
    total += additions[i] - deletions[i];
    net.push(total);
  }
  return { additions, deletions, net };
}

function buildFileHistory(workDir: string): { labels: string[]; series: ChartInput } {
  const raw = exec(`cd ${q(workDir)} && git log --name-only --date=short --pretty=format:"@@%H|%ad" -n 120 2>/dev/null`);
  const touches = new Map<string, Array<{ hash: string; date: string }>>();
  let current: { hash: string; date: string } | null = null;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@@')) {
      const parts = trimmed.slice(2).split('|');
      current = { hash: parts[0] || '', date: parts[1] || '' };
      continue;
    }
    if (!current) continue;
    if (trimmed.startsWith('.git/') || trimmed.startsWith('node_modules/') || trimmed.startsWith('zig-out/')) continue;
    const list = touches.get(trimmed) || [];
    if (!list.some((entry) => entry.hash === current!.hash)) list.push(current);
    touches.set(trimmed, list);
  }

  const files = Array.from(touches.entries())
    .map(([path, commits]) => ({ path, commits, score: commits.length }))
    .filter((item) => item.commits.length > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 3);

  const labels = files.map((item) => compactLabel(item.path));
  const colors = [COLORS.blue, COLORS.green, COLORS.orange];
  const series: ChartInput = files.map((item, index) => ({
    label: compactLabel(item.path),
    color: colors[index % colors.length],
    data: item.commits.slice(0, 6).map((commit) => {
      const sizeRaw = exec(`cd ${q(workDir)} && git show "${commit.hash}:${item.path}" 2>/dev/null | wc -c`);
      const size = Number(String(sizeRaw).trim()) || 0;
      return { label: commit.date || commit.hash.slice(0, 7), value: size, color: colors[index % colors.length] };
    }),
  }));

  return { labels, series };
}

function buildExtensionMix(workDir: string): ChartInput {
  const raw = exec(`cd ${q(workDir)} && git ls-files 2>/dev/null`);
  const counts: Record<string, number> = {};
  for (const line of trimLines(raw)) {
    const file = line.trim();
    if (!file) continue;
    const dot = file.lastIndexOf('.');
    const ext = dot >= 0 ? file.slice(dot + 1).toLowerCase() : '(none)';
    counts[ext] = (counts[ext] || 0) + 1;
  }
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = items.slice(0, 6);
  const rest = items.slice(6).reduce((sum, item) => sum + item[1], 0);
  const palette = [COLORS.blue, COLORS.green, COLORS.orange, COLORS.yellow, COLORS.purple, COLORS.red];
  const data = top.map(([ext, count], index) => ({
    label: ext,
    value: count,
    color: palette[index % palette.length],
  }));
  if (rest > 0) data.push({ label: 'other', value: rest, color: COLORS.textDim });
  return data;
}

function resolveWorkDir(workDir?: string): string {
  const value = typeof workDir === 'string' && workDir.trim() ? workDir.trim() : '';
  if (value) return value;
  const cwd = exec('pwd').trim();
  return cwd || '.';
}

function buildSummary(workDir: string): WorkSummary {
  const branchRaw = exec(`cd ${q(workDir)} && git branch --show-current 2>/dev/null`).trim();
  const branch = branchRaw || 'main';
  const dirty = exec(`cd ${q(workDir)} && git status --porcelain 2>/dev/null`).split('\n').filter((line) => line.trim().length > 0).length;
  const staged = exec(`cd ${q(workDir)} && git diff --cached --numstat 2>/dev/null`).split('\n').filter((line) => line.trim().length > 0).length;
  const aheadBehind = exec(`cd ${q(workDir)} && git rev-list --left-right --count "${branch}@{upstream}...${branch}" 2>/dev/null`).trim();
  const parts = aheadBehind.split(/\s+/);
  const behind = Number(parts[0]) || 0;
  const ahead = Number(parts[1]) || 0;
  const trackedFiles = trimLines(exec(`cd ${q(workDir)} && git ls-files 2>/dev/null`)).length;
  const paletteHistory = readStoreJson('sweatshop.palette.history');
  const paletteHits = Array.isArray(paletteHistory) ? paletteHistory.length : 0;
  return {
    workDir,
    branch,
    ahead,
    behind,
    dirty,
    staged,
    trackedFiles,
    paletteHits,
    buildSha: hostString('__app_build_sha', 'unknown'),
    buildTime: hostString('__app_build_time', 'unknown'),
  };
}

export function buildChartsSnapshot(workDir?: string): ChartsSnapshot {
  const resolved = resolveWorkDir(workDir);
  const days = buildDays(14);
  const commits = buildCommitSeries(resolved, days);
  const churn = buildChurnSeries(resolved, days);
  const files = buildFileHistory(resolved);
  return {
    summary: buildSummary(resolved),
    commitsByDay: [{ label: 'Commits', color: COLORS.blue, data: commits }],
    churnByDay: [
      { label: 'Adds', color: COLORS.green, data: churn.additions },
      { label: 'Deletes', color: COLORS.red, data: churn.deletions },
    ],
    fileSizeHistory: files.series,
    extensionMix: buildExtensionMix(resolved),
    commitLabels: days,
    churnLabels: days,
    fileSizeLabels: files.labels,
  };
}

export function useChartsData(workDir?: string, intervalMs = 30000): { snapshot: ChartsSnapshot; refresh: () => void } {
  const [tick, setTick] = useState(0);
  const snapshot = useMemo(() => buildChartsSnapshot(workDir), [workDir, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { snapshot, refresh: () => setTick((n) => n + 1) };
}
