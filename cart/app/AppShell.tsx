// AppShell — three-mode shell that wraps the cart/app body once onboarding
// completes. Lives above the router; replaces the current Chrome + body +
// bottom-strip layout with a single transitioning surface.
//
// Modes:
//   home     — input in the top chrome, grid menu (MenuGridSquareContent)
//              centered in the body
//   chat     — chat panel becomes the focal centre; the grid collapses into
//              a side-nav (left, top); chat-history list sits beneath it
//   activity — chat panel + input dock to the bottom-left sidebar; side-nav
//              stays above it on the left; the activity host fills the
//              main view to the right
//
// Triggers:
//   home → chat       — user submits a non-routing message in the InputStrip
//   home → activity   — user clicks a grid item that maps to an activity
//   chat → activity   — user clicks a side-nav item
//   * → home          — Home button in chrome
//
// Animations follow cart/app/app.md "Animation principles":
//   - InputStrip / chat panel position: TWEEN (already in view, just moving)
//   - Side-nav, chat-history, activity host: SPRING in / smooth out (new)
//   - Slot-stable text scan in side-nav rows when the grid → side-nav swap
//     happens (NOT WIRED YET — first cut just cross-fades the two layouts)
//
// Design call-outs:
//   - Single InputStrip instance throughout — its container's absolute
//     position tweens between the three locations. Draft text, focus,
//     scroll position all carry through.
//   - Mode state lives here (ref + setState) so the shell owns transitions;
//     no router involvement (routes still work for /about under home mode).
//   - Stage is fixed-canvas (cart.json says 1280×860). Once we need
//     responsiveness, swap the constants for measured rects.

import { useEffect, useRef, useState } from 'react';
import { Box, Pressable, Text, ScrollView } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { Home, Maximize, Minimize, X } from '@reactjit/runtime/icons/icons';
import { callHost } from '@reactjit/runtime/ffi';
import { EASINGS } from '@reactjit/runtime/easing';
import { useGalleryTheme } from './gallery/gallery-theme';
import { MenuGridSquareContent } from './gallery/components/menu-grid-square/MenuGridSquare';
import type { MenuEntry } from './gallery/data/menu-entry';
import { InputStrip } from './InputStrip';
import { useOnboarding } from './onboarding/state.tsx';

// ─────────────────────────────────────────────────────────────────────
// Layout constants — fixed-canvas to match cart.json (1280×860)
// ─────────────────────────────────────────────────────────────────────

const STAGE_W = 1280;
const STAGE_H = 860;
// Slim title bar (brand + window controls). Input lives BELOW it, taking
// the next ~200px in home mode — the "input in the window chrome" zone.
const TITLE_H = 36;
const INPUT_STRIP_H = 220;
// Total top zone in home mode = title bar + input + a small gap. Body
// (grid menu) starts here.
const TOP_ZONE_H = TITLE_H + INPUT_STRIP_H + 8;
// Sidebar geometry for chat / activity modes.
const SIDEBAR_W = 320;
const SIDENAV_TOP_H = 360;
const PAD = 16;
const TRANSITION_MS = 700;

// ─────────────────────────────────────────────────────────────────────
// Easings + clock
// ─────────────────────────────────────────────────────────────────────

const easeTween  = (p: number) => (EASINGS as any).easeInOutCubic(p);
const easeSpring = (p: number) => (EASINGS as any).easeOutBack(p);
const easeOutCub = (p: number) => (EASINGS as any).easeOutCubic(p);

const nowMs = () => {
  const g: any = globalThis;
  return g?.performance?.now ? g.performance.now() : Date.now();
};

// ─────────────────────────────────────────────────────────────────────
// Shell mode + phase timeline
// ─────────────────────────────────────────────────────────────────────

type ShellMode = 'home' | 'chat' | 'activity';

// Each mode is a phase value 0=home, 1=chat, 2=activity. Position-wise
// the modes sit on a 1D continuum: home is "spread out", chat is "focal +
// some sidebar", activity is "small chat + sidebar + activity host".
// Transitions interpolate between any two phases.
function modePhase(mode: ShellMode): number {
  if (mode === 'home') return 0;
  if (mode === 'chat') return 1;
  return 2;
}

type TimelineState = { from: number; to: number; start: number };

function useShellTimeline(mode: ShellMode) {
  const target = modePhase(mode);
  const stateRef = useRef<TimelineState>({ from: target, to: target, start: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    const prev = stateRef.current;
    const elapsed = prev.start === 0 ? TRANSITION_MS : nowMs() - prev.start;
    const p = Math.min(1, elapsed / TRANSITION_MS);
    const currentPhase = prev.from + (prev.to - prev.from) * easeTween(p);
    stateRef.current = { from: currentPhase, to: target, start: nowMs() };

    const g: any = globalThis;
    const sched = g.requestAnimationFrame ? g.requestAnimationFrame.bind(g) : (fn: any) => setTimeout(fn, 16);
    const cancel = g.cancelAnimationFrame ? g.cancelAnimationFrame.bind(g) : clearTimeout;
    let raf: any;
    const tick = () => {
      force((n) => (n + 1) | 0);
      const e = nowMs() - stateRef.current.start;
      if (e < TRANSITION_MS) raf = sched(tick);
    };
    raf = sched(tick);
    return () => cancel(raf);
  }, [mode]);

  const s = stateRef.current;
  const elapsed = s.start === 0 ? TRANSITION_MS : nowMs() - s.start;
  const rawP = Math.min(1, elapsed / TRANSITION_MS);
  const phase = s.from + (s.to - s.from) * easeTween(rawP);
  return { phase, fromPhase: s.from, toPhase: s.to };
}

// ─────────────────────────────────────────────────────────────────────
// Per-mode rectangles — interpolated by phase
// ─────────────────────────────────────────────────────────────────────

type Rect = { left: number; top: number; width: number; height: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  left: lerp(a.left, b.left, t),
  top: lerp(a.top, b.top, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
});

// Input strip lives in the chrome top-zone in home mode (full width below
// the title bar); bottom of the focal chat panel in chat mode; bottom of
// the docked sidebar chat panel in activity mode. Keep the same React
// instance; just tween the rect.
const INPUT_HOME: Rect = {
  left: PAD * 2, top: TITLE_H + 4, width: STAGE_W - PAD * 4, height: INPUT_STRIP_H,
};
const INPUT_CHAT: Rect = {
  left: SIDEBAR_W + PAD * 2, top: STAGE_H - INPUT_STRIP_H - PAD,
  width: STAGE_W - SIDEBAR_W - PAD * 3, height: INPUT_STRIP_H,
};
const INPUT_ACTIVITY: Rect = {
  left: PAD, top: STAGE_H - INPUT_STRIP_H - PAD,
  width: SIDEBAR_W, height: INPUT_STRIP_H,
};

// Chat messages area — invisible in home mode (height 0), focal in chat
// (above the input), compact in activity (above the docked input).
const CHAT_MSGS_HOME: Rect = {
  left: STAGE_W / 2, top: TOP_ZONE_H, width: 0, height: 0,
};
const CHAT_MSGS_CHAT: Rect = {
  left: SIDEBAR_W + PAD * 2, top: TITLE_H + PAD,
  width: STAGE_W - SIDEBAR_W - PAD * 3,
  height: STAGE_H - TITLE_H - INPUT_STRIP_H - PAD * 3,
};
const CHAT_MSGS_ACTIVITY: Rect = {
  left: PAD, top: TITLE_H + SIDENAV_TOP_H + PAD * 2,
  width: SIDEBAR_W,
  height: STAGE_H - TITLE_H - SIDENAV_TOP_H - INPUT_STRIP_H - PAD * 4,
};

// Grid lives in the body in home mode (centered below the input zone);
// collapses into the top of the left sidebar in chat / activity modes.
const GRID_HOME: Rect = {
  left: (STAGE_W - 720) / 2, top: TOP_ZONE_H + 16, width: 720, height: 360,
};
const GRID_SIDENAV: Rect = {
  left: PAD, top: TITLE_H + PAD, width: SIDEBAR_W, height: SIDENAV_TOP_H,
};

// Chat history list — only present in chat mode (between side-nav and
// chat panel on the left). In activity mode the chat panel itself takes
// this slot, so chat history fades out.
const CHAT_HIST_OFF: Rect = { left: 0, top: STAGE_H, width: 0, height: 0 };
const CHAT_HIST_ON: Rect = {
  left: PAD, top: TITLE_H + SIDENAV_TOP_H + PAD * 2,
  width: SIDEBAR_W,
  height: STAGE_H - TITLE_H - SIDENAV_TOP_H - PAD * 3,
};

// Activity host — only present in activity mode.
const ACTIVITY_OFF: Rect = { left: STAGE_W, top: TITLE_H, width: 0, height: 0 };
const ACTIVITY_ON: Rect = {
  left: SIDEBAR_W + PAD * 2, top: TITLE_H + PAD,
  width: STAGE_W - SIDEBAR_W - PAD * 3,
  height: STAGE_H - TITLE_H - PAD * 2,
};

// Interpolate a rect across the 0/1/2 phase continuum. `phase` is a real
// number in [0, 2]; we pick the bracketing pair and lerp.
function rectAt(home: Rect, chat: Rect, activity: Rect, phase: number): Rect {
  if (phase <= 1) return lerpRect(home, chat, phase);
  return lerpRect(chat, activity, phase - 1);
}

// ─────────────────────────────────────────────────────────────────────
// Shell items — the apps this shell knows how to launch.
// ─────────────────────────────────────────────────────────────────────

const APPS: MenuEntry[] = [
  { id: 'sweatshop', key: '1', label: 'Sweatshop', hint: 'Canvas, sequencer, cockpit', glyph: 'S', status: 'live' },
  { id: 'gallery',   key: '2', label: 'Gallery',   hint: 'Typed component stories',    glyph: 'G', status: 'idle' },
  { id: 'chatbot',   key: '3', label: 'Chatbot',   hint: 'Plain chat surface',         glyph: 'C', status: 'idle' },
  { id: 'recipes',   key: '4', label: 'Recipes',   hint: 'Patterns and builds',        glyph: 'R', status: 'idle' },
  { id: 'docs',      key: '5', label: 'Docs',      hint: 'Substrate notes',            glyph: 'D', status: 'idle' },
  { id: 'about',     key: '6', label: 'About',     hint: 'Shell notes',                glyph: 'A', status: 'mute' },
];

// ─────────────────────────────────────────────────────────────────────
// Mock chat — placeholder until the supervisor session lands
// ─────────────────────────────────────────────────────────────────────

type ChatMsg = { id: number; who: 'user' | 'assistant'; text: string };
let __msgIdCounter = 1;

function mockReply(userText: string): string {
  const trimmed = userText.trim();
  if (/^@/.test(trimmed)) return `Routing intent detected: ${trimmed}. (router not wired yet)`;
  return `(mock reply) Heard you on "${trimmed.slice(0, 80)}". The supervisor session will land here.`;
}

// ─────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────

function ThemeSwatch() {
  const galleryTheme = useGalleryTheme();
  const cycle = () => {
    const opts = galleryTheme.options;
    if (opts.length <= 1) return;
    const idx = opts.findIndex((o) => o.id === galleryTheme.activeThemeId);
    const next = opts[((idx >= 0 ? idx : 0) + 1) % opts.length];
    if (next) galleryTheme.setTheme(next.id);
  };
  return (
    <Pressable onPress={cycle}>
      <S.AppBrandSwatch />
    </Pressable>
  );
}

function ChromeBar({ mode, onHome }: { mode: ShellMode; onHome: () => void }) {
  return (
    <S.AppChrome windowDrag={true}>
      <S.AppChromeBrandRow>
        <ThemeSwatch />
        <S.AppBrandTitle>App</S.AppBrandTitle>
        {mode !== 'home' ? (
          <Pressable onPress={onHome} style={{ marginLeft: 12 }}>
            <Box style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: 6,
              borderWidth: 1, borderColor: 'theme:rule',
            }}>
              <S.AppNavIcon icon={Home} />
              <Text style={{ fontSize: 12, color: 'theme:inkDim' }}>Home</Text>
            </Box>
          </Pressable>
        ) : null}
      </S.AppChromeBrandRow>

      {/* Right cluster — window controls only. The InputStrip lives in
          its own absolutely-positioned container on top of the chrome
          (positioned over this row in home mode). */}
      <S.AppChromeRightCluster>
        <S.AppWindowBtn onPress={() => callHost<void>('__window_minimize', undefined as any)}>
          <S.AppWindowBtnIcon icon={Minimize} />
        </S.AppWindowBtn>
        <S.AppWindowBtn onPress={() => callHost<void>('__window_maximize', undefined as any)}>
          <S.AppWindowBtnIcon icon={Maximize} />
        </S.AppWindowBtn>
        <S.AppWindowBtn onPress={() => callHost<void>('__window_close', undefined as any)}>
          <S.AppWindowBtnIconClose icon={X} />
        </S.AppWindowBtn>
      </S.AppChromeRightCluster>
    </S.AppChrome>
  );
}

function GridSurface({
  rect, phase, onItemPress,
}: { rect: Rect; phase: number; onItemPress: (id: string) => void }) {
  // In home mode (phase 0): full grid via MenuGridSquareContent.
  // In chat / activity (phase ≥ 1): vertical side-nav list of the same items.
  // Cross-fade between the two layouts at phase ~0.5.
  const homeOpacity = phase < 0.5 ? 1 - phase * 2 : 0;
  const navOpacity = phase >= 0.5 ? Math.min(1, (phase - 0.5) * 2) : 0;

  return (
    <Box style={{
      position: 'absolute',
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      overflow: 'hidden',
    }}>
      {homeOpacity > 0.01 ? (
        <Box style={{
          position: 'absolute', left: 0, top: 0, width: rect.width, height: rect.height,
          opacity: homeOpacity, alignItems: 'center', justifyContent: 'center',
        }}>
          <MenuGridSquareContent rows={APPS} />
        </Box>
      ) : null}
      {navOpacity > 0.01 ? (
        <Box style={{
          position: 'absolute', left: 0, top: 0, width: rect.width, height: rect.height,
          opacity: navOpacity,
          backgroundColor: 'theme:bg1',
          borderWidth: 1, borderColor: 'theme:rule',
          borderRadius: 12,
          padding: 12,
          gap: 6,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: 700, color: 'theme:inkDim',
            letterSpacing: 1, paddingLeft: 8, marginBottom: 4,
          }}>APPS</Text>
          {APPS.map((app) => (
            <Pressable key={app.id} onPress={() => onItemPress(app.id)}>
              <Box style={{
                flexDirection: 'row', alignItems: 'center',
                paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                borderRadius: 8, gap: 12,
              }}>
                <Text style={{
                  fontSize: 14, fontWeight: 700, color: 'theme:accent',
                  width: 20, textAlign: 'center',
                }}>{app.glyph}</Text>
                <Text style={{ fontSize: 13, color: 'theme:ink' }}>{app.label}</Text>
                <Box style={{ flexGrow: 1 }} />
                <Text style={{ fontSize: 11, color: 'theme:inkDim' }}>{app.key}</Text>
              </Box>
            </Pressable>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function ChatMessages(props: { rect: Rect; opacity: number; messages: ChatMsg[] }) {
  const { rect, opacity } = props;
  // Defensive: in some hot-reload paths the props arrive before the parent
  // state initializer has resolved, so guard against non-array messages.
  const messages: ChatMsg[] = Array.isArray(props.messages) ? props.messages : [];
  if (opacity < 0.01 || rect.width < 1 || rect.height < 1) return null;
  return (
    <Box style={{
      position: 'absolute',
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      opacity,
      backgroundColor: 'theme:bg1',
      borderWidth: 1, borderColor: 'theme:rule',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <ScrollView style={{ width: '100%', height: '100%' }}>
        <Box style={{ padding: 14, gap: 8 }}>
          {messages.length === 0 ? (
            <Text style={{ fontSize: 12, color: 'theme:inkDim', fontStyle: 'italic' }}>
              No messages yet — type below to start.
            </Text>
          ) : null}
          {messages.map((m) => {
            const isUser = m.who === 'user';
            return (
              <Box key={m.id} style={{
                flexDirection: 'row',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                paddingTop: 4, paddingBottom: 4,
              }}>
                <Box style={{
                  maxWidth: '82%',
                  paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  borderRadius: 10,
                  backgroundColor: isUser ? 'theme:accent' : 'theme:bg2',
                  borderWidth: 1,
                  borderColor: isUser ? 'theme:accent' : 'theme:rule',
                }}>
                  <Text style={{ fontSize: 13, color: 'theme:ink' }}>{m.text}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </ScrollView>
    </Box>
  );
}

function ChatHistories({ rect, opacity }: { rect: Rect; opacity: number }) {
  if (opacity < 0.01 || rect.width < 1 || rect.height < 1) return null;
  // Placeholder histories — supervisor session integration plugs in here.
  const histories = [
    { id: 'h1', label: 'embed pipeline review', when: '2m ago' },
    { id: 'h2', label: 'css token cleanup',     when: '1h ago' },
    { id: 'h3', label: 'router model spec',     when: 'Yesterday' },
    { id: 'h4', label: 'tour overlay sketch',   when: 'Yesterday' },
  ];
  return (
    <Box style={{
      position: 'absolute',
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      opacity,
      backgroundColor: 'theme:bg1',
      borderWidth: 1, borderColor: 'theme:rule',
      borderRadius: 12,
      padding: 12,
      gap: 4,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: 700, color: 'theme:inkDim',
        letterSpacing: 1, paddingLeft: 8, marginBottom: 6,
      }}>HISTORY</Text>
      {histories.map((h) => (
        <Pressable key={h.id} onPress={() => {}}>
          <Box style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8,
            borderRadius: 6,
          }}>
            <Text style={{ fontSize: 13, color: 'theme:ink' }}>{h.label}</Text>
            <Text style={{ fontSize: 11, color: 'theme:inkDim' }}>{h.when}</Text>
          </Box>
        </Pressable>
      ))}
    </Box>
  );
}

function ActivityHost({ rect, opacity, scale, activityId }: { rect: Rect; opacity: number; scale: number; activityId: string | null }) {
  if (opacity < 0.01 || rect.width < 1 || rect.height < 1) return null;
  const app = APPS.find((a) => a.id === activityId);
  return (
    <Box style={{
      position: 'absolute',
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      opacity,
      transform: [{ scale }],
    }}>
      <Box style={{
        width: '100%', height: '100%',
        backgroundColor: 'theme:bg2',
        borderWidth: 1, borderColor: 'theme:rule',
        borderRadius: 12,
        overflow: 'hidden',
        flexDirection: 'column',
      }}>
        <Box style={{
          flexDirection: 'row', alignItems: 'center',
          height: 36, paddingLeft: 14, paddingRight: 14,
          borderBottomWidth: 1, borderBottomColor: 'theme:rule',
          backgroundColor: 'theme:bg1',
        }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: 'theme:ink' }}>
            {app ? `Activity — ${app.label}` : 'Activity'}
          </Text>
        </Box>
        <Box style={{ flexGrow: 1, padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 700, color: 'theme:ink' }}>
            {app ? app.label : 'Unknown activity'}
          </Text>
          <Text style={{ fontSize: 13, color: 'theme:inkDim', maxWidth: 480 }}>
            {app ? app.hint : '—'}
          </Text>
          <Text style={{ fontSize: 11, color: 'theme:inkDim', marginTop: 12 }}>
            (Placeholder — real activities mount here once the activity registry lands.)
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────────────────────────────────

export function AppShell() {
  const [mode, setMode] = useState<ShellMode>('home');
  const [activityId, setActivityId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const { phase, fromPhase, toPhase } = useShellTimeline(mode);

  // Resolve animated rects from the live phase value
  const inputRect = rectAt(INPUT_HOME, INPUT_CHAT, INPUT_ACTIVITY, phase);
  const chatRect  = rectAt(CHAT_MSGS_HOME, CHAT_MSGS_CHAT, CHAT_MSGS_ACTIVITY, phase);
  const gridRect  = rectAt(GRID_HOME, GRID_SIDENAV, GRID_SIDENAV, phase);
  // Chat history visible only in chat mode (phase ≈ 1). Fades in from 0→1
  // and back out toward activity (phase 1→2).
  const chatHistOn = Math.max(0, 1 - Math.abs(phase - 1));
  const chatHistRect = lerpRect(CHAT_HIST_OFF, CHAT_HIST_ON, chatHistOn);
  // Activity host present at phase ≥ 1, peaks at 2. Spring on entry,
  // smooth on exit.
  const activityT = Math.max(0, Math.min(1, phase - 1));
  const isEnteringActivity = toPhase >= fromPhase;
  const activityOpacity = activityT;
  const activityScale = 0.94 + 0.06 * (isEnteringActivity ? easeSpring(activityT) : easeTween(activityT));
  const activityRect = lerpRect(ACTIVITY_OFF, ACTIVITY_ON, activityT);

  // Submit handler — wired to InputStrip via the IFTTT bus + an effect
  // bound to input submissions. For now we hook the submission by
  // wrapping the bus listener: routing tokens (@) still navigate; plain
  // text triggers chat mode + appends a mock message.
  const submitMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('@')) {
      // Routing intent — leave to the existing bus pipeline; don't enter chat
      return;
    }
    const userMsg: ChatMsg = { id: __msgIdCounter++, who: 'user', text: trimmed };
    const replyMsg: ChatMsg = { id: __msgIdCounter++, who: 'assistant', text: mockReply(trimmed) };
    setMessages((prev) => [...prev, userMsg, replyMsg]);
    if (mode === 'home') setMode('chat');
  };

  // Listen to a new bus event the InputStrip will emit on submit.
  // (InputStrip already calls busEmit; we listen here.)
  useShellSubmit(submitMessage);

  const goHome = () => {
    setMode('home');
    setActivityId(null);
  };
  const openActivity = (id: string) => {
    setActivityId(id);
    setMode('activity');
  };

  return (
    <Box style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'theme:bg' }}>
      {/* Stage container — fixed-canvas to match the cart window */}
      <Box style={{
        width: STAGE_W, height: STAGE_H,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Chrome — slim title bar at the very top */}
        <Box style={{
          position: 'absolute', left: 0, top: 0,
          width: STAGE_W, height: TITLE_H,
        }}>
          <ChromeBar mode={mode} onHome={goHome} />
        </Box>

        {/* Activity host */}
        <ActivityHost
          rect={activityRect}
          opacity={activityOpacity}
          scale={activityScale}
          activityId={activityId}
        />

        {/* Chat histories */}
        <ChatHistories rect={chatHistRect} opacity={chatHistOn} />

        {/* Grid / side-nav */}
        <GridSurface rect={gridRect} phase={phase} onItemPress={openActivity} />

        {/* Chat messages area */}
        <ChatMessages
          rect={chatRect}
          opacity={Math.min(1, phase)}
          messages={Array.isArray(messages) ? messages : []}
        />

        {/* InputStrip — single instance, always mounted, position tweens */}
        <Box style={{
          position: 'absolute',
          left: inputRect.left, top: inputRect.top,
          width: inputRect.width, height: inputRect.height,
        }}>
          <InputStrip />
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bus listener for InputStrip submissions. The InputStrip already emits
// `app:navigate` for @-tokens; we add a sibling event `app:submit` for
// non-routing text. (Wired in InputStrip.tsx.)
// ─────────────────────────────────────────────────────────────────────

function useShellSubmit(handler: (text: string) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const g: any = globalThis;
    const bus = g.__app_shell_submit_bus__ ?? (g.__app_shell_submit_bus__ = { handlers: new Set() });
    const fn = (text: string) => handlerRef.current(text);
    bus.handlers.add(fn);
    return () => { bus.handlers.delete(fn); };
  }, []);
}

// Helper used by InputStrip to publish submitted text to the shell.
export function shellPublishSubmit(text: string) {
  const g: any = globalThis;
  const bus = g.__app_shell_submit_bus__;
  if (!bus) return;
  for (const fn of bus.handlers) fn(text);
}
