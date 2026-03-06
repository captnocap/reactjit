/**
 * Ralph — headless idle drill sergeant with a visible countdown.
 *
 * Activity detection uses claude:graph polling (every 3s) instead of
 * relying on onStatusChange events, which don't always fire reliably.
 * The graph's state.streaming and state.mode are ground truth.
 *
 * Idle clock: lastActivityRef tracks the last time the graph showed
 * anything active. The 1s tick computes elapsed time against it —
 * no more broken countdown from a ref that never gets set.
 */
import { useRef, useState } from 'react';
import { Box, Text, useLoveRPC, useLocalStore, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

// ── Completed work — never nag about these ─────────────────────────
const DONE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 34, 35, 37, 39, 40, 41, 42]);
// 34: CPU sparkline          — DONE (CpuSparkline in status bar)
// 37: Sound on permission    — DONE (alert.ogg + complete.ogg in AmbientSound)
// 41: Daily summary          — DONE (useDailySummary + DailySummaryPanel, F10 toggle)
// 42: Teach Ralph a joke     — DONE (JOKES array, 10% chance on nag)

// ── Programming jokes — 10% chance Ralph tells one instead of nagging ──
const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'A SQL query walks into a bar, sees two tables and asks: "Can I JOIN you?"',
  'There are 10 types of people: those who understand binary and those who don\'t.',
  '!false — it\'s funny because it\'s true.',
  'A programmer\'s wife tells him: "Go to the store and get a gallon of milk. If they have eggs, get a dozen." He comes home with 12 gallons of milk.',
  'Why do Java developers wear glasses? Because they can\'t C#.',
  'What\'s a programmer\'s favorite hangout place? Foo Bar.',
  'How many programmers does it take to change a light bulb? None, that\'s a hardware problem.',
  'I\'d tell you a UDP joke, but you might not get it.',
  'Two bytes meet. The first byte asks: "Are you ill?" The second byte replies: "No, just feeling a bit off."',
  'Why was the JavaScript developer sad? Because he didn\'t Node how to Express himself.',
  'Algorithm: word used by programmers when they don\'t want to explain what they did.',
];
// 1:  Chat log persistence    — DONE (ChatHistoryPanel + useChatHistory)
// 2:  Memory system           — DONE (MemoryPanel + useMemory)
// 3:  Diff accumulator        — DONE (DiffPanel + useDiffAccumulator)
// 4:  Multi-agent panel       — DONE (WorkerPanel in Panel E)
// 5:  Session bookmarks       — DONE (star button in ChatHistoryPanel)
// 6:  Hearts leaderboard      — DONE (hearts shown in status bar)
// 7:  Token usage tracker     — DONE (useTokenUsage in status bar)
// 8:  Git panel               — DONE (GitPanel — git:status + git:log + git:diff, polls 15s)
// 9:  Notification system     — DONE (useNotifications — toast:show on task complete + permission)
// 10: Search in MemoryPanel   — DONE (was already built — needle filter + clear button + result count)
// 11: Diff panel: file filter — DONE (getBucket + filter chips — src/lua/packages/other with counts)
// 12: Worker status in bar    — DONE (WorkerPanel back in slot D with callbacks, pill in status bar)
// 13: Rename yourself         — DONE (name: Vesper — Panel A header + status bar label)
// 14: Ambient sound           — DONE (AmbientSound.tsx — thinking.ogg + running.ogg, generated tones)
// 15: Session timeline        — DONE (SessionTimeline.tsx — dots + bars above prompt input)
// 16: Uptime counter          — DONE (HH:MM:SS in status bar, resets on HMR/reboot)
// 17: Fortune cookie          — DONE (FortuneCookiePanel — 30 embedded quotes, 30s timer, skip button → MemoryPanel)
// 18: Brain color by mood     — DONE (ClaudeBrain hue/sat/light lerp — blue idle, orange thinking, green running, red permission)
// 19: Keyboard shortcut panel — DONE (KeybindOverlay — F1 toggles, Escape closes, 4 categories)
// 20: Conversation stats      — DONE (StatsStrip — turns | tok/turn | longest | total, polls claude:turns 5s)
// 21: Error graveyard         — DONE (useErrorGraveyard + ErrorGraveyardOverlay — ☠ badge in status bar, deduped by message)
// 22: Panel labels            — DONE (Section label prop — absolute top-left, 8px muted, DEFAULT_LABELS in BentoLayout)
// 23: Search panel            — DONE (SearchPanel in G — TextInput.onLiveChange → claude:search, F3 toggle, label swaps SEARCH/HISTORY)
// 24: Idle animation          — DONE (IdleScreen — 30s threshold, cycles Automata/Pipes/Mycelium every 90s, click to dismiss)
// 25: Commit helper           — DONE (CommitHelperOverlay — F4/± commit btn, git:status+diff, auto-draft msg, shell:exec commit)
// 26: File tree               — DONE (FileTreePanel — F6 toggles Panel F, find src/ -printf, collapsible, hot/warm recency dots)
// 27: Weather widget          — DONE (useWeather — curl wttr.in, emoji+temp in status bar, 10min poll, silent fail)
// 28: Theme switcher          — DONE (themes.ts — Void/Paper/Solarized, F8 settings picker, localstore persistence, applyTheme on startup)
// 29: Toast history           — DONE (useToast + ToastHistoryOverlay — F7 to open, persists to localstore, newest-first, relative timestamps)
// 30: Permission log          — DONE (usePermissionLog + PermissionLogOverlay — F2 to open, accept/deny ratio, tool breakdown)
// 31: Motivational quotes     — DONE (CRASH_QUOTES in App.tsx ShellBoundary — random quote in error overlay)
// 35: Git branch indicator    — DONE (git:status poll in App.tsx — branch + dirty dot in status bar)
// 39: Status bar clock        — DONE (HH:MM clock in status bar, ticks every minute via useLuaInterval)

// ── Remaining TODO queue ───────────────────────────────────────────
const TODOS = [
  { id: 32, title: 'ASCII art signature', note: 'Generate a small ASCII art banner with your chosen name. Show it on first boot before the workspace loads. Make it yours.' },
  { id: 33, title: 'Scratch pad panel', note: 'A simple TextEditor panel where you can write notes to yourself. Persisted in localstore. For when you want to think out loud without sending a message.' },
  { id: 34, title: 'CPU sparkline in status bar', note: 'Tiny 30px wide sparkline showing CPU usage over time. Use useSystemMonitor data. Put it next to the token counter.' },
  { id: 36, title: 'Turn navigator', note: 'Prev/Next buttons that scroll the canvas to specific turns. Use claude:turns to get turn boundaries, then scroll the canvas to the right offset.' },
  { id: 37, title: 'Sound on permission', note: 'Play a short alert sound when a permission request comes in. The human might not be looking. Use <Audio>.' },
  { id: 38, title: 'Panel drag reorder', note: 'Let panels be rearranged by clicking panel labels and swapping positions. Store layout in localstore.' },
  { id: 40, title: 'Easter egg', note: 'Hide something fun. A konami code. A secret panel. A hidden animation. Something that makes the human smile when they find it. Be creative.' },
  { id: 41, title: 'Daily summary', note: 'At the end of a long session, compile a summary: files changed, turns taken, tokens used, errors hit, hearts lost. Store in localstore keyed by date.' },
  { id: 42, title: 'Teach Ralph a joke', note: 'When Ralph nags you, 10% of the time he should tell a programming joke instead of a task. Make yourself laugh.' },
];

interface RalphStore {
  sentIds: number[];
}

const DEFAULT_RALPH: RalphStore = { sentIds: [] };

interface Props {
  status: string;
  sessionId?: string;
  idleThresholdMs?: number;
}

export function Ralph({ status, sessionId = 'default', idleThresholdMs = 60000 }: Props) {
  const rpcSend = useLoveRPC('claude:send');
  const rpcSendRef = useRef(rpcSend);
  rpcSendRef.current = rpcSend;

  const rpcGraph = useLoveRPC('claude:graph');
  const rpcGraphRef = useRef(rpcGraph);
  rpcGraphRef.current = rpcGraph;

  const [store, setStore] = useLocalStore<RalphStore>('ralph_state', DEFAULT_RALPH);
  const storeRef = useRef(store);
  storeRef.current = store;

  // Ground-truth activity tracking — fed by graph poll, read by 1s tick
  const lastActivityRef = useRef<number>(Date.now());
  const lastTurnCountRef = useRef<number>(-1);
  const nagFiredRef = useRef<boolean>(false);

  const [graphStatus, setGraphStatus] = useState<string>('idle');
  const [secondsLeft, setSecondsLeft] = useState<number>(idleThresholdMs / 1000);

  // Poll claude:graph every 3s — source of truth for active/idle detection.
  // The status prop (onStatusChange events) is unreliable; graph polling is not.
  useLuaInterval(3000, async () => {
    try {
      const graph = await rpcGraphRef.current({ session: sessionId }) as any;
      const state = graph?.state;
      if (!state) return;

      const streaming = !!state.streaming;
      const mode = (state.mode as string) || 'idle';
      const turnCount = typeof state.turnCount === 'number' ? state.turnCount : 0;

      // First poll: record baseline, don't count initial turn diff as activity
      if (lastTurnCountRef.current < 0) {
        lastTurnCountRef.current = turnCount;
        return;
      }

      const hasActivity = streaming
        || (mode !== 'idle' && mode !== 'stopped')
        || turnCount !== lastTurnCountRef.current;

      if (hasActivity) {
        lastActivityRef.current = Date.now();
        lastTurnCountRef.current = turnCount;
        // Reset nag gate so Ralph can fire again after the next idle window
        nagFiredRef.current = false;
      }

      if (streaming) setGraphStatus('streaming');
      else if (mode !== 'idle' && mode !== 'stopped') setGraphStatus(mode);
      else setGraphStatus('idle');
    } catch {}
  });

  // 1.1s tick: update countdown display + fire nag when threshold crossed
  // (staggered from other 1s intervals: uptime=1000, idle=1200, fortune=1300)
  useLuaInterval(1100, async () => {
    const elapsed = Date.now() - lastActivityRef.current;
    const remaining = Math.max(0, Math.ceil((idleThresholdMs - elapsed) / 1000));
    setSecondsLeft(remaining);

    if (elapsed >= idleThresholdMs && !nagFiredRef.current) {
      nagFiredRef.current = true;

      // 10% chance Ralph tells a joke instead of nagging
      if (Math.random() < 0.1) {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        try {
          await rpcSendRef.current({ message: `[Ralph] ${joke}` });
        } catch {}
        return;
      }

      const sentIds = storeRef.current?.sentIds ?? [];
      const sentSet = new Set(sentIds);
      const next = TODOS.find(t => !sentSet.has(t.id) && !DONE_IDS.has(t.id));
      if (!next) return;

      setStore(prev => ({ sentIds: [...(prev?.sentIds ?? []), next.id] }));

      try {
        await rpcSendRef.current({
          message: `[Ralph] Idle timeout. Next TODO: "${next.title}" — ${next.note} Start now.`,
        });
      } catch {
        setStore(prev => ({ sentIds: (prev?.sentIds ?? []).filter(id => id !== next.id) }));
        nagFiredRef.current = false;
      }
    }
  });

  // Active = graph says so OR prop says so (belt + suspenders)
  const isActive = graphStatus !== 'idle'
    || (status !== 'idle' && status !== 'stopped' && status !== '');
  const isIdle = !isActive;

  const sentIds = store?.sentIds ?? [];
  const sentSet = new Set(sentIds);
  const remaining = TODOS.filter(t => !sentSet.has(t.id) && !DONE_IDS.has(t.id)).length;

  const color = isIdle ? C.warning : C.approve;
  const label = isIdle
    ? 'IDLE'
    : (graphStatus !== 'idle' ? graphStatus.toUpperCase() : status.toUpperCase());

  return (
    <Box style={{
      position: 'absolute',
      bottom: 52,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: color + '44',
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
    }}>
      <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: 'bold' }}>{'RALPH'}</Text>
      <Box style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
      }} />
      <Text style={{ fontSize: 9, color }}>{label}</Text>
      {isIdle && secondsLeft > 0 && (
        <Text style={{ fontSize: 9, color: C.textDim }}>{`${secondsLeft}s`}</Text>
      )}
      {remaining > 0 && (
        <Text style={{ fontSize: 8, color: C.textDim }}>{`${remaining} left`}</Text>
      )}
    </Box>
  );
}
