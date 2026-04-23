// Pure level/xp math. No React, no side effects — makes this trivial to unit test.

export type GamifyEventType =
  | 'focus'          // user focused a panel
  | 'click'          // UI click
  | 'commit'         // git commit landed
  | 'test_pass'      // test suite passed
  | 'task_complete'  // worker reported a task done
  | 'worker_spawn'   // new worker started
  | 'tool_call';     // any tool invocation

export interface GamifyEvent {
  type: GamifyEventType;
  t: number;
  panelId?: string;
  workerId?: string;
}

export const XP_WEIGHTS: Record<GamifyEventType, number> = {
  focus:         1,
  click:         2,
  tool_call:     4,
  worker_spawn: 20,
  task_complete: 40,
  test_pass:    35,
  commit:       60,
};

export interface LevelState {
  xp: number;
  level: number;
  xpWithinLevel: number;
  nextLevelXp: number;
  progress: number;
}

export function xpForEvents(events: GamifyEvent[]): number {
  let xp = 0;
  for (const e of events) xp += XP_WEIGHTS[e.type] ?? 0;
  return xp;
}

// Level curve: each level costs 1000 * level XP (slower to advance each tier).
// Level 1 → 1000, Level 2 → 2000, ... cumulative = 500 * n * (n + 1).
export function cumulativeXpForLevel(level: number): number {
  return 500 * level * (level + 1);
}

export function levelForXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  let lvl = 1;
  while (cumulativeXpForLevel(lvl) <= totalXp) lvl++;
  return lvl;
}

export function computeLevelState(totalXp: number): LevelState {
  const level = levelForXp(totalXp);
  const floor = cumulativeXpForLevel(level - 1);
  const ceil = cumulativeXpForLevel(level);
  const nextLevelXp = ceil - floor;
  const xpWithinLevel = Math.max(0, totalXp - floor);
  const progress = nextLevelXp <= 0 ? 0 : Math.min(1, xpWithinLevel / nextLevelXp);
  return { xp: totalXp, level, xpWithinLevel, nextLevelXp, progress };
}

// Panel usage frequency — counts per panelId from 'focus' + 'click' events.
export function panelUsage(events: GamifyEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (!e.panelId) continue;
    if (e.type !== 'focus' && e.type !== 'click') continue;
    out[e.panelId] = (out[e.panelId] || 0) + 1;
  }
  return out;
}

// Detects milestone crossings between two xp totals. Returns the list of
// achievements to unlock (by id) on this transition.
export const MILESTONES: { id: string; label: string; at: number }[] = [
  { id: 'first-blood',   label: 'First Blood · first xp earned',      at: 1 },
  { id: 'warming-up',    label: 'Warming Up · 250 xp',                 at: 250 },
  { id: 'in-the-zone',   label: 'In The Zone · 1k xp',                 at: 1000 },
  { id: 'supervisor-ii', label: 'Supervisor II · level 2 reached',     at: 3000 },
  { id: 'committer',     label: 'Committer · 10 commits landed',       at: 600 },
  { id: 'tool-master',   label: 'Tool Master · 25 tool calls',         at: 100 },
  { id: 'marathon',      label: 'Marathon · 5k xp in one session',     at: 5000 },
];

export function milestonesCrossed(prevXp: number, nextXp: number): { id: string; label: string }[] {
  const crossed: { id: string; label: string }[] = [];
  for (const m of MILESTONES) {
    if (prevXp < m.at && nextXp >= m.at) crossed.push({ id: m.id, label: m.label });
  }
  return crossed;
}
