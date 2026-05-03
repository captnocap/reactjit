// input_lab — Chat → Sidebar transition demo.
//
// Two phases:
//   focal     — centered chat panel (mock convo + persistent <InputStrip>),
//               nothing else on screen
//   activity  — chat panel docks to the bottom-left as a sidebar; an app-side
//               menu appears above it; the actual app window fills the rest
//
// Transitions follow cart/app/app.md "Animation principles":
//   - chat panel: TWEEN (already in view, just moving + resizing)
//   - side menu : SPRING in/out (new element entering/leaving view)
//   - app window: SPRING in/out (new element entering/leaving view)
//
// Click "Start activity" / "Back to chat" (top-right) to swap. Mid-transition
// clicks are handled — the chat snapshots its current visual position so it
// reverses cleanly without snapping back to the previous target.

import '../../../component-gallery/components.cls';
import { useEffect, useRef, useState } from 'react';
import { Box, Pressable, Text } from '@reactjit/runtime/primitives';
import { Router } from '@reactjit/runtime/router';
import { installBrowserShims } from '@reactjit/runtime/hooks';
import { TooltipRoot } from '@reactjit/runtime/tooltip/Tooltip';
import { applyGalleryTheme, getActiveGalleryThemeId } from '../../../component-gallery/gallery-theme';
import { EASINGS } from '@reactjit/runtime/easing';
import { InputStrip } from '../../InputStrip';

applyGalleryTheme(getActiveGalleryThemeId());
installBrowserShims();

// ─────────────────────────────────────────────────────────────────────
// Layout constants — fixed-canvas lab, picks the *feel* not responsiveness
// ─────────────────────────────────────────────────────────────────────

const STAGE_W = 1280;
const STAGE_H = 860;
const DURATION_MS = 700;

const SIDEBAR_W = 360;
const MENU_H    = 220;

type Phase = 'focal' | 'activity';
type Rect  = { left: number; top: number; width: number; height: number };

const CHAT_FOCAL:  Rect = { left: (STAGE_W - 640) / 2, top: 80, width: 640, height: 700 };
const CHAT_DOCKED: Rect = { left: 16, top: MENU_H + 16, width: SIDEBAR_W, height: STAGE_H - MENU_H - 32 };
const MENU_RECT:   Rect = { left: 16, top: 16, width: SIDEBAR_W, height: MENU_H - 16 };
const APP_RECT:    Rect = { left: SIDEBAR_W + 32, top: 16, width: STAGE_W - SIDEBAR_W - 48, height: STAGE_H - 32 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  left:   lerp(a.left,   b.left,   t),
  top:    lerp(a.top,    b.top,    t),
  width:  lerp(a.width,  b.width,  t),
  height: lerp(a.height, b.height, t),
});

const easeTween  = (p: number) => (EASINGS as any).easeInOutCubic(p);
const easeSpring = (p: number) => (EASINGS as any).easeOutBack(p);

const nowMs = () => {
  const g: any = globalThis;
  return g?.performance?.now ? g.performance.now() : Date.now();
};

// ─────────────────────────────────────────────────────────────────────
// Phase timeline — single eased progress 0=focal, 1=activity. Snapshots
// the *currently visible* progress on phase change so reversals are
// continuous rather than snapping back to the previous start.
// ─────────────────────────────────────────────────────────────────────

function usePhaseTimeline(phase: Phase) {
  const targetPhase = phase === 'activity' ? 1 : 0;
  const stateRef = useRef({ from: targetPhase, to: targetPhase, start: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    const prev = stateRef.current;
    const elapsed = prev.start === 0 ? DURATION_MS : nowMs() - prev.start;
    const p = Math.min(1, elapsed / DURATION_MS);
    const currentPhase = prev.from + (prev.to - prev.from) * easeTween(p);
    stateRef.current = { from: currentPhase, to: targetPhase, start: nowMs() };

    const g: any = globalThis;
    const sched = g.requestAnimationFrame ? g.requestAnimationFrame.bind(g) : (fn: any) => setTimeout(fn, 16);
    const cancel = g.cancelAnimationFrame ? g.cancelAnimationFrame.bind(g) : clearTimeout;
    let raf: any;
    const tick = () => {
      force((n) => (n + 1) | 0);
      const e = nowMs() - stateRef.current.start;
      if (e < DURATION_MS) raf = sched(tick);
    };
    raf = sched(tick);
    return () => cancel(raf);
  }, [phase]);

  const s = stateRef.current;
  const elapsed = s.start === 0 ? DURATION_MS : nowMs() - s.start;
  const rawP = Math.min(1, elapsed / DURATION_MS);
  const t = s.from + (s.to - s.from) * easeTween(rawP);
  return { t, fromPhase: s.from, toPhase: s.to };
}

// ─────────────────────────────────────────────────────────────────────
// Mock chat content
// ─────────────────────────────────────────────────────────────────────

const MOCK = [
  { who: 'user',      text: 'Help me set up a small build pipeline for the embed worker.' },
  { who: 'assistant', text: 'Sure — start by mapping the current ingest flow. What does the worker pool look like today?' },
  { who: 'user',      text: 'N zig threads, one shared model. JobQueue feeds them.' },
  { who: 'assistant', text: 'Good. Are we batching commits to pgvector or one row per chunk?' },
  { who: 'user',      text: 'One per chunk. Should we batch?' },
  { who: 'assistant', text: 'Yes — bundle into ~64-row inserts. Open the activity view and we can wire it.' },
];

function ChatBubble({ who, text }: { who: string; text: string }) {
  const isUser = who === 'user';
  return (
    <Box style={{
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
        <Text style={{ fontSize: 13, color: 'theme:ink' }}>{text}</Text>
      </Box>
    </Box>
  );
}

function ChatPanel() {
  return (
    <Box style={{
      width: '100%', height: '100%',
      flexDirection: 'column',
      backgroundColor: 'theme:bg1',
      borderWidth: 1, borderColor: 'theme:rule',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <Box style={{
        flexGrow: 1, flexBasis: 0,
        paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12,
        gap: 4,
      }}>
        {MOCK.map((m, i) => <ChatBubble key={i} who={m.who} text={m.text} />)}
      </Box>
      <Box style={{ borderTopWidth: 1, borderTopColor: 'theme:rule' }}>
        <InputStrip />
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Side menu — springs in
// ─────────────────────────────────────────────────────────────────────

const MENU_ITEMS = ['Home', 'Files', 'Memory', 'Settings'];

function SideMenu({ opacity, scale }: { opacity: number; scale: number }) {
  return (
    <Box style={{
      width: '100%', height: '100%',
      backgroundColor: 'theme:bg1',
      borderWidth: 1, borderColor: 'theme:rule',
      borderRadius: 12,
      paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 14,
      opacity,
      transform: [{ scale }],
    }}>
      <Text style={{
        fontSize: 11, fontWeight: 700, color: 'theme:inkDim',
        letterSpacing: 1, marginBottom: 10, paddingLeft: 8,
      }}>MENU</Text>
      {MENU_ITEMS.map((item) => (
        <Pressable key={item} onPress={() => {}}>
          <Box style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8,
            borderRadius: 6,
          }}>
            <Text style={{ fontSize: 13, color: 'theme:ink' }}>{item}</Text>
          </Box>
        </Pressable>
      ))}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// App window — springs in
// ─────────────────────────────────────────────────────────────────────

function AppWindow({ opacity, scale }: { opacity: number; scale: number }) {
  return (
    <Box style={{
      width: '100%', height: '100%',
      backgroundColor: 'theme:bg2',
      borderWidth: 1, borderColor: 'theme:rule',
      borderRadius: 12,
      opacity,
      transform: [{ scale }],
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
          Activity — embed pipeline
        </Text>
      </Box>
      <Box style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 24, paddingBottom: 24, gap: 12 }}>
        <Text style={{ fontSize: 14, color: 'theme:ink' }}>Worker pool: 4 threads</Text>
        <Text style={{ fontSize: 14, color: 'theme:ink' }}>Queue depth: 1,283 files</Text>
        <Text style={{ fontSize: 14, color: 'theme:ink' }}>Throughput: 64 chunks/s</Text>
        <Box style={{
          height: 240, marginTop: 12,
          backgroundColor: 'theme:bg1',
          borderWidth: 1, borderColor: 'theme:rule',
          borderRadius: 8,
        }} />
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stage
// ─────────────────────────────────────────────────────────────────────

function Stage() {
  const [phase, setPhase] = useState<Phase>('focal');
  const { t, fromPhase, toPhase } = usePhaseTimeline(phase);

  // Chat: tween between focal and docked rects. `t` is the eased phase 0..1.
  const chatRect = lerpRect(CHAT_FOCAL, CHAT_DOCKED, t);

  // Menu + AppWindow: opacity tracks `t` directly (smooth ramp tied to chat
  // motion), scale springs on entry / smooth-shrinks on exit. Direction is
  // taken from this transition's from→to so reversals don't pop.
  const isEntering = toPhase >= fromPhase;
  const scale = 0.94 + 0.06 * (isEntering ? easeSpring(t) : easeTween(t));

  return (
    <Box style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'theme:bg' }}>
      {/* Phase toggle — fixed top-right so it never sits under the menu */}
      <Box style={{ position: 'absolute', right: 16, top: 16, zIndex: 10 }}>
        <Pressable
          onPress={() => setPhase(phase === 'focal' ? 'activity' : 'focal')}
          style={{
            paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
            borderRadius: 8,
            backgroundColor: 'theme:accent',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: 700, color: 'theme:ink' }}>
            {phase === 'focal' ? 'Start activity' : 'Back to chat'}
          </Text>
        </Pressable>
      </Box>

      {/* App window (springs in) — render only when there's something to see */}
      {t > 0.01 ? (
        <Box style={{
          position: 'absolute',
          left: APP_RECT.left, top: APP_RECT.top,
          width: APP_RECT.width, height: APP_RECT.height,
        }}>
          <AppWindow opacity={t} scale={scale} />
        </Box>
      ) : null}

      {/* Side menu (springs in) */}
      {t > 0.01 ? (
        <Box style={{
          position: 'absolute',
          left: MENU_RECT.left, top: MENU_RECT.top,
          width: MENU_RECT.width, height: MENU_RECT.height,
        }}>
          <SideMenu opacity={t} scale={scale} />
        </Box>
      ) : null}

      {/* Chat panel (tweens) — always rendered, owns the persistent InputStrip */}
      <Box style={{
        position: 'absolute',
        left: chatRect.left, top: chatRect.top,
        width: chatRect.width, height: chatRect.height,
      }}>
        <ChatPanel />
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <TooltipRoot>
      <Router initialPath="/">
        <Stage />
      </Router>
    </TooltipRoot>
  );
}
