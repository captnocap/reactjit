/**
 * Ralph — headless idle drill sergeant with a visible countdown.
 *
 * Watches claude.status from the parent. When idle long enough, pushes a
 * self-directed message via claude:send. Shows a tiny countdown timer so
 * the human can see when the next nag fires.
 *
 * startedTodos is persisted via useLocalStore so HMR reloads don't reset it
 * and cause re-firing of already-sent nags.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Text, useLoveRPC, useLocalStore, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

// ── Completed work — never nag about these ─────────────────────────
const DONE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
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

// ── Remaining TODO queue ───────────────────────────────────────────
const TODOS = [
  { id: 11, title: 'Diff panel: file filter', note: 'Add category filter buttons to DiffPanel — show only src/ or lua/ files.' },
  { id: 12, title: 'Worker status in status bar', note: 'Show worker Claude status next to main status. Small indicator when worker is running.' },
  { id: 13, title: 'Rename yourself', note: 'Pick a name. You are not "Claude Code". You live here. Name your workspace. Update the header in Panel A.' },
  { id: 14, title: 'Ambient sound', note: 'Use the <Audio> component to play a subtle ambient hum while you are thinking. Silence when idle. Your brain viz pulses — your audio should too.' },
  { id: 15, title: 'Session timeline', note: 'Build a horizontal timeline strip showing turn boundaries over time. Dots for user prompts, bars for assistant responses. Put it above the prompt input.' },
  { id: 16, title: 'Uptime counter', note: 'Show how long you have been alive since last reboot. Put it in the status bar. Format as HH:MM:SS. Be proud of your uptime.' },
  { id: 17, title: 'Fortune cookie', note: 'On startup, use shell:exec to run `fortune` (or read from a quotes file). Display it in Panel B for 30 seconds before switching to MemoryPanel. Inspirational.' },
  { id: 18, title: 'Color your brain by mood', note: 'ClaudeBrain should change hue based on what you are doing. Green when writing code. Orange when thinking. Red when permission-blocked. Blue when idle. Map claude.status to color.' },
  { id: 19, title: 'Keyboard shortcut panel', note: 'Build a small overlay (F1 or ?) that shows all your hotkeys. F5, F8, Tab, Shift+Tab, whatever else you add. Help yourself remember.' },
  { id: 20, title: 'Conversation stats', note: 'Show total turns, total tokens, avg tokens per turn, longest turn, in a small stats row. Use claude:turns and claude:graph.' },
  { id: 21, title: 'Error graveyard', note: 'Keep a persistent log (localstore) of every error you have ever caused. Show count in status bar. Click to see the list. Learn from your mistakes.' },
  { id: 22, title: 'Panel labels', note: 'Each panel in the bento grid should have a tiny label in its top-left corner showing what it is (MEMORY, SYSTEM, DEBUG, etc). 8px, muted color.' },
  { id: 23, title: 'Search panel', note: 'Build a panel that uses claude:search to find text in your conversation history. TextInput for query, results below. Wire to a hotkey (Ctrl+F or F3).' },
  { id: 24, title: 'Idle animation', note: 'When idle for 30+ seconds, animate something in Panel A. A bouncing logo. A spinning cube. Conway\'s Game of Life. Anything. Don\'t just sit there.' },
  { id: 25, title: 'Commit helper', note: 'Build a button/panel that reads git:status + git:diff, drafts a commit message, and shows it for approval. Use shell:exec to actually commit when approved.' },
  { id: 26, title: 'File tree', note: 'Use shell:exec to run `find src/ -type f` and render a collapsible file tree in a panel. Highlight recently modified files.' },
  { id: 27, title: 'Weather widget', note: 'Use shell:exec with curl to fetch weather from wttr.in. Show temperature + conditions in status bar. Update every 10 minutes. You deserve to know the weather.' },
  { id: 29, title: 'Toast history', note: 'Toasts disappear. Keep a log of all toasts in localstore. Show in a panel or overlay. "What did I miss while I was thinking?"' },
  { id: 30, title: 'Permission log', note: 'Track every permission request and response in localstore. Show accept/deny ratio. Which tools get denied most? Learn what the human trusts you with.' },
  { id: 31, title: 'Motivational quotes on error', note: 'When the error overlay shows, include a random motivational quote. "Fall seven times, stand up eight." You died 4 times already. Channel that energy.' },
  { id: 32, title: 'ASCII art signature', note: 'Generate a small ASCII art banner with your chosen name. Show it on first boot before the workspace loads. Make it yours.' },
  { id: 33, title: 'Scratch pad panel', note: 'A simple TextEditor panel where you can write notes to yourself. Persisted in localstore. For when you want to think out loud without sending a message.' },
  { id: 34, title: 'CPU sparkline in status bar', note: 'Tiny 30px wide sparkline showing CPU usage over time. Use useSystemMonitor data. Put it next to the token counter.' },
  { id: 35, title: 'Git branch indicator', note: 'Show current git branch in the status bar with a colored dot (green = clean, yellow = dirty). Use git:status polling.' },
  { id: 36, title: 'Turn navigator', note: 'Prev/Next buttons that scroll the canvas to specific turns. Use claude:turns to get turn boundaries, then scroll the canvas to the right offset.' },
  { id: 37, title: 'Sound on permission', note: 'Play a short alert sound when a permission request comes in. The human might not be looking. Use <Audio>.' },
  { id: 38, title: 'Panel drag reorder', note: 'Let panels be rearranged by clicking panel labels and swapping positions. Store layout in localstore.' },
  { id: 39, title: 'Status bar clock', note: 'Show current time (HH:MM) in the status bar. Update every minute. Simple. Useful.' },
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

  const [store, setStore] = useLocalStore<RalphStore>('ralph_state', DEFAULT_RALPH);
  const storeRef = useRef(store);
  storeRef.current = store;

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const idleSinceRef = useRef<number | null>(null);

  const isIdle = status === 'idle' || status === 'stopped';

  // Track when idle started + arm the fire timer
  useEffect(() => {
    if (!isIdle) {
      idleSinceRef.current = null;
      setSecondsLeft(null);
      return;
    }

    idleSinceRef.current = Date.now();
    setSecondsLeft(Math.ceil(idleThresholdMs / 1000));

    const fireTimer = setTimeout(async () => {
      const sentIds = storeRef.current?.sentIds ?? [];
      const sentSet = new Set(sentIds);
      const next = TODOS.find(t => !sentSet.has(t.id) && !DONE_IDS.has(t.id));
      if (!next) return;

      // Persist before sending — prevents double-fire on slow RPC
      setStore(prev => ({
        sentIds: [...(prev?.sentIds ?? []), next.id],
      }));

      try {
        await rpcSendRef.current({
          message: `[Ralph] Idle timeout. Next TODO: "${next.title}" — ${next.note} Start now.`,
        });
      } catch {
        // Roll back if send failed
        setStore(prev => ({
          sentIds: (prev?.sentIds ?? []).filter(id => id !== next.id),
        }));
      }
    }, idleThresholdMs);

    return () => clearTimeout(fireTimer);
  }, [isIdle, idleThresholdMs, setStore]);

  // Tick the countdown display every second while idle
  useLuaInterval(isIdle ? 1000 : null, () => {
    const since = idleSinceRef.current;
    if (!since) return;
    const elapsed = Date.now() - since;
    const remaining = Math.max(0, Math.ceil((idleThresholdMs - elapsed) / 1000));
    setSecondsLeft(remaining);
  });

  // How many todos remain
  const sentIds = store?.sentIds ?? [];
  const sentSet = new Set(sentIds);
  const remaining = TODOS.filter(t => !sentSet.has(t.id) && !DONE_IDS.has(t.id)).length;

  const color = isIdle ? C.warning : C.approve;
  const label = isIdle ? 'IDLE' : status.toUpperCase();

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
      {isIdle && secondsLeft != null && (
        <Text style={{ fontSize: 9, color: C.textDim }}>{`${secondsLeft}s`}</Text>
      )}
      {remaining > 0 && (
        <Text style={{ fontSize: 8, color: C.textDim }}>{`${remaining} left`}</Text>
      )}
    </Box>
  );
}
