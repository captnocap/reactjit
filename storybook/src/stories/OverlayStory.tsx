/**
 * Overlay — Package documentation page (Layout2 zigzag narrative).
 *
 * Game overlay system: transparent always-on-top windows with X11 input
 * passthrough, or shared memory compositing for true fullscreen games.
 * useOverlay() hook for React-side control. Two transport modes, three
 * visibility modes, one hotkey to cycle them.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock } from '../../../packages/core/src';
import { useOverlay } from '../../../packages/core/src/overlay';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#a78bfa',
  accentDim: 'rgba(167, 139, 250, 0.12)',
  callout: 'rgba(167, 139, 250, 0.06)',
  calloutBorder: 'rgba(167, 139, 250, 0.30)',
  window: '#4fc3f7',
  shm: '#ef5350',
  interactive: '#ec4899',
  passthrough: '#66bb6a',
  hidden: '#7f8c8d',
  hook: '#ffa726',
  cli: '#26c6da',
  x11: '#ab47bc',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useOverlay } from '@reactjit/core'
import type { OverlayState, OverlayMode } from '@reactjit/core'`;

const HOOK_CODE = `const overlay = useOverlay()

// Read state
overlay.enabled    // boolean — overlay is active
overlay.mode       // 'interactive' | 'passthrough' | 'hidden'
overlay.opacity    // 0..1
overlay.hotkey     // default 'f6'
overlay.hasX11     // XFixes available for input passthrough

// Control
overlay.setMode('interactive')
overlay.setOpacity(0.7)
overlay.toggle()   // cycle: passthrough → interactive → hidden`;

const WINDOW_CODE = `# Transparent window overlay (default)
rjit overlay

# Custom hotkey and opacity
rjit overlay --hotkey f5 --opacity 0.8

# Start in interactive mode
rjit overlay --mode interactive`;

const ATTACH_CODE = `# Fullscreen overlay via LD_PRELOAD + shared memory
rjit overlay --attach ./my-game

# With options
rjit overlay --hotkey f5 --opacity 0.8 --attach ./my-game

# How it works:
# 1. Builds your ReactJIT app
# 2. Launches Love2D in shm mode (renders to FBO → POSIX shm)
# 3. Launches your game with LD_PRELOAD=liboverlay_hook.so
# 4. The hook intercepts glXSwapBuffers and composites the overlay`;

const MODES_CODE = `// React: respond to mode changes
const overlay = useOverlay()

if (overlay.mode === 'interactive') {
  // Overlay captures input — show full UI
  return <FullDashboard />
}
if (overlay.mode === 'passthrough') {
  // Overlay visible but clicks fall through to game
  return <MinimalHUD />
}
// 'hidden' — overlay invisible, render nothing expensive`;

const HUD_CODE = `// Minimal game HUD overlay
function GameOverlay() {
  const overlay = useOverlay()

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      {/* Always-visible stats bar */}
      <Box style={{
        position: 'absolute', top: 8, right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 6, borderRadius: 4,
      }}>
        <Text style={{ color: '#fff', fontSize: 10 }}>
          {overlay.mode.toUpperCase()}
        </Text>
      </Box>

      {/* Full UI only in interactive mode */}
      {overlay.mode === 'interactive' && (
        <SettingsPanel />
      )}
    </Box>
  )
}`;

const SHM_PROTOCOL_CODE = `// Shared memory layout (matches overlay_hook.c)
// Offset 0:  uint32 magic     (0x524A4954 = "RJIT")
// Offset 4:  uint32 width
// Offset 8:  uint32 height
// Offset 12: uint32 frame_seq (incremented each frame)
// Offset 16: uint32 flags     (bit 0: visible, bit 1: interactive)
// Offset 20: 12 bytes padding (align to 32)
// Offset 32: width * height * 4 bytes RGBA pixel data`;

// ── Hoisted data arrays ─────────────────────────────────

const MODES = [
  { label: 'passthrough', desc: 'Visible, input falls through to game', color: C.passthrough },
  { label: 'interactive', desc: 'Visible, overlay captures all input', color: C.interactive },
  { label: 'hidden', desc: 'Invisible, zero render cost', color: C.hidden },
];

const TRANSPORTS = [
  { label: 'Transparent Window', desc: 'Borderless, always-on-top SDL2 window with X11 XFixes input passthrough. For borderless-windowed games.', color: C.window },
  { label: 'Shared Memory', desc: 'FBO → POSIX shm → LD_PRELOAD hook composites onto game framebuffer via glXSwapBuffers interception. For true fullscreen.', color: C.shm },
];

const FEATURES = [
  { label: 'useOverlay()', desc: 'React hook — read state, set mode, set opacity, toggle', color: C.hook },
  { label: 'rjit overlay', desc: 'CLI command — transparent window mode with esbuild watch + HMR', color: C.cli },
  { label: 'rjit overlay --attach', desc: 'CLI command — fullscreen shm mode with LD_PRELOAD hook', color: C.cli },
  { label: 'XFixes passthrough', desc: 'Empty X11 input region — clicks fall through the overlay window to the game', color: C.x11 },
  { label: 'SDL2 opacity', desc: 'Per-window opacity via SDL_SetWindowOpacity (0..1)', color: C.window },
  { label: 'Hotkey cycling', desc: 'F6 (default) cycles: passthrough → interactive → hidden', color: C.accent },
  { label: 'SHM protocol', desc: 'POSIX shared memory with RJIT magic header, frame counter, visibility flags', color: C.shm },
  { label: 'GL state save/restore', desc: 'The LD_PRELOAD hook saves/restores 17 GL variables before compositing', color: C.shm },
  { label: 'DebugOverlay', desc: 'Dev tool — wraps subtree with colored borders for layout debugging', color: C.hook },
  { label: 'DebugBox', desc: 'Drop-in Box replacement that shows debug borders inside DebugOverlay', color: C.hook },
];

// ── Live Demo: Overlay State ────────────────────────────

function OverlayStateDemo() {
  const c = useThemeColors();
  const overlay = useOverlay();

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>{'Live overlay:state RPC (polls every 500ms)'}</Text>

      <Box style={{ gap: 4 }}>
        <StateRow label="enabled" value={String(overlay.enabled)} color={overlay.enabled ? C.passthrough : C.hidden} />
        <StateRow label="mode" value={overlay.mode} color={overlay.mode === 'interactive' ? C.interactive : overlay.mode === 'passthrough' ? C.passthrough : C.hidden} />
        <StateRow label="opacity" value={overlay.opacity.toFixed(2)} color={C.hook} />
        <StateRow label="hotkey" value={overlay.hotkey} color={C.accent} />
        <StateRow label="hasX11" value={String(overlay.hasX11)} color={overlay.hasX11 ? C.x11 : C.hidden} />
      </Box>

      {overlay.enabled ? (
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.passthrough }} />
          <Text style={{ fontSize: 9, color: C.passthrough }}>{'Overlay active — use hook methods to control'}</Text>
        </Box>
      ) : (
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.hidden }} />
          <Text style={{ fontSize: 9, color: c.muted }}>{'Overlay not active (run rjit overlay to enable)'}</Text>
        </Box>
      )}
    </Box>
  );
}

function StateRow({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
      <Text style={{ fontSize: 10, color: c.text, width: 70, flexShrink: 0 }}>{label}</Text>
      <Box style={{ backgroundColor: c.surface, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
        <Text style={{ fontSize: 10, color }}>{value}</Text>
      </Box>
    </Box>
  );
}

// ── Mode Cycle Diagram ──────────────────────────────────

function ModeCycleDiagram() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6, alignItems: 'center', width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>{'F6 hotkey cycle'}</Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <ModeBox label="passthrough" color={C.passthrough} />
        <Text style={{ fontSize: 12, color: c.muted }}>{'>'}</Text>
        <ModeBox label="interactive" color={C.interactive} />
        <Text style={{ fontSize: 12, color: c.muted }}>{'>'}</Text>
        <ModeBox label="hidden" color={C.hidden} />
        <Text style={{ fontSize: 12, color: c.muted }}>{'>'}</Text>
        <Text style={{ fontSize: 8, color: c.textDim }}>{'(repeat)'}</Text>
      </Box>
    </Box>
  );
}

function ModeBox({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{
      backgroundColor: color + '22',
      borderWidth: 1,
      borderColor: color + '44',
      paddingLeft: 8, paddingRight: 8,
      paddingTop: 4, paddingBottom: 4,
      borderRadius: 4,
    }}>
      <Text style={{ fontSize: 9, color }}>{label}</Text>
    </Box>
  );
}

// ── Transport Diagram ───────────────────────────────────

function TransportDiagram() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 10, width: '100%' }}>
      {/* Window mode */}
      <Box style={{ gap: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.window }} />
          <Text style={{ fontSize: 10, color: C.window, fontWeight: 'normal' }}>{'Transparent Window'}</Text>
          <Text style={{ fontSize: 8, color: c.textDim }}>{'(default)'}</Text>
        </Box>
        <Box style={{
          backgroundColor: c.surface, borderRadius: 4, padding: 8, gap: 3,
          borderLeftWidth: 2, borderColor: C.window,
        }}>
          <Text style={{ fontSize: 9, color: c.text }}>{'SDL2 borderless + always-on-top'}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{'X11 XFixes empty region for input passthrough'}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{'Per-window opacity via SDL_SetWindowOpacity'}</Text>
        </Box>
      </Box>

      {/* SHM mode */}
      <Box style={{ gap: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.shm }} />
          <Text style={{ fontSize: 10, color: C.shm, fontWeight: 'normal' }}>{'Shared Memory'}</Text>
          <Text style={{ fontSize: 8, color: c.textDim }}>{'--attach'}</Text>
        </Box>
        <Box style={{
          backgroundColor: c.surface, borderRadius: 4, padding: 8, gap: 3,
          borderLeftWidth: 2, borderColor: C.shm,
        }}>
          <Text style={{ fontSize: 9, color: c.text }}>{'Love2D FBO render to POSIX shm'}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{'LD_PRELOAD hook intercepts glXSwapBuffers'}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{'Composites RGBA pixels onto game framebuffer'}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{'17-var GL state save/restore (battle-tested)'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 5, width: '100%' }}>
      {FEATURES.map(f => (
        <Box key={f.label} style={{ gap: 1 }}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
            <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{f.label}</Text>
          </Box>
          <Text style={{ fontSize: 9, color: c.textSecondary, paddingLeft: 11 }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Visual Preview Mockups ────────────────────────────────

/** Fake game background used by overlay previews */
function FakeGameScene({ label }: { label?: string }) {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }}>
      {/* Stars */}
      <Box style={{ position: 'absolute', top: 8, left: 12, width: 2, height: 2, borderRadius: 1, backgroundColor: '#ffffff66' }} />
      <Box style={{ position: 'absolute', top: 22, left: 45, width: 2, height: 2, borderRadius: 1, backgroundColor: '#ffffff44' }} />
      <Box style={{ position: 'absolute', top: 14, left: 80, width: 3, height: 3, borderRadius: 2, backgroundColor: '#ffffff55' }} />
      <Box style={{ position: 'absolute', top: 30, left: 120, width: 2, height: 2, borderRadius: 1, backgroundColor: '#ffffff33' }} />
      <Box style={{ position: 'absolute', top: 6, left: 160, width: 2, height: 2, borderRadius: 1, backgroundColor: '#ffffff55' }} />
      {/* Ground */}
      <Box style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 20, backgroundColor: '#16213e' }} />
      <Box style={{ position: 'absolute', bottom: 20, left: 0, width: '100%', height: 1, backgroundColor: '#0f3460' }} />
      {/* Player placeholder */}
      <Box style={{ position: 'absolute', bottom: 24, left: 40, width: 12, height: 18, backgroundColor: '#e94560', borderRadius: 2 }} />
      {/* Enemy placeholder */}
      <Box style={{ position: 'absolute', bottom: 24, left: 140, width: 14, height: 14, backgroundColor: '#533483', borderRadius: 2 }} />
      {/* Label */}
      {label && (
        <Box style={{ position: 'absolute', bottom: 4, right: 6 }}>
          <Text style={{ fontSize: 6, color: '#ffffff33' }}>{label}</Text>
        </Box>
      )}
    </Box>
  );
}

/** Passthrough mode: transparent HUD floating over game */
function PassthroughPreview() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', height: 120, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
      <FakeGameScene label="game.exe" />
      {/* Passthrough overlay — stats bar, top-right */}
      <Box style={{
        position: 'absolute', top: 6, right: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
        gap: 2,
      }}>
        <Text style={{ fontSize: 7, color: C.passthrough, fontWeight: 'bold' }}>{'PASSTHROUGH'}</Text>
        <Text style={{ fontSize: 6, color: '#ffffffcc' }}>{'FPS: 144  |  GPU: 62%'}</Text>
        <Text style={{ fontSize: 6, color: '#ffffffaa' }}>{'CPU: 34%  |  RAM: 4.2G'}</Text>
      </Box>
      {/* Passthrough indicator dot */}
      <Box style={{
        position: 'absolute', top: 6, left: 6,
        flexDirection: 'row', gap: 4, alignItems: 'center',
      }}>
        <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.passthrough }} />
        <Text style={{ fontSize: 6, color: '#ffffffaa' }}>{'F6 to toggle'}</Text>
      </Box>
    </Box>
  );
}

/** Interactive mode: full UI panel overlay captures input */
function InteractivePreview() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', height: 120, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
      <FakeGameScene label="game.exe" />
      {/* Semi-transparent backdrop */}
      <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.35)' }} />
      {/* Interactive overlay panel — centered */}
      <Box style={{
        position: 'absolute', top: 12, left: 20, right: 20, bottom: 12,
        backgroundColor: 'rgba(15,15,25,0.85)',
        borderRadius: 6, borderWidth: 1, borderColor: C.interactive + '44',
        padding: 8, gap: 4,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.interactive }} />
          <Text style={{ fontSize: 8, color: C.interactive, fontWeight: 'bold' }}>{'INTERACTIVE'}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ fontSize: 6, color: '#ffffff66' }}>{'F6 to cycle'}</Text>
        </Box>
        <Box style={{ height: 1, backgroundColor: '#ffffff11' }} />
        {/* Fake settings rows */}
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#ffffffcc', width: 50 }}>{'Opacity'}</Text>
          <Box style={{ flexGrow: 1, height: 4, backgroundColor: '#ffffff22', borderRadius: 2 }}>
            <Box style={{ width: '70%', height: 4, backgroundColor: C.accent, borderRadius: 2 }} />
          </Box>
          <Text style={{ fontSize: 6, color: '#ffffffaa' }}>{'0.70'}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#ffffffcc', width: 50 }}>{'Hotkey'}</Text>
          <Box style={{ backgroundColor: '#ffffff11', borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ fontSize: 7, color: C.accent }}>{'F6'}</Text>
          </Box>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#ffffffcc', width: 50 }}>{'Transport'}</Text>
          <Box style={{ backgroundColor: C.window + '22', borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ fontSize: 7, color: C.window }}>{'Window'}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** Hidden mode: game runs unobstructed */
function HiddenPreview() {
  return (
    <Box style={{ width: '100%', height: 120, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
      <FakeGameScene label="game.exe" />
      {/* Just a tiny indicator that overlay exists but is hidden */}
      <Box style={{
        position: 'absolute', bottom: 6, right: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2,
      }}>
        <Text style={{ fontSize: 6, color: C.hidden }}>{'overlay: hidden (F6)'}</Text>
      </Box>
    </Box>
  );
}

/** SHM compositing pipeline diagram */
function SHMPipelinePreview() {
  const c = useThemeColors();
  const row1 = [
    { label: 'Love2D', sub: 'FBO render', color: C.accent },
    { label: 'glReadPixels', sub: 'RGBA out', color: C.hook },
    { label: '/rjit-overlay', sub: 'POSIX shm', color: C.shm },
  ];
  const row2 = [
    { label: 'LD_PRELOAD', sub: 'hook.so', color: C.cli },
    { label: 'glXSwapBuffers', sub: 'composite', color: C.passthrough },
  ];
  const renderStage = (s: typeof row1[0]) => (
    <Box key={s.label} style={{
      flexGrow: 1, flexBasis: 0,
      backgroundColor: s.color + '18',
      borderWidth: 1, borderColor: s.color + '44',
      borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
      alignItems: 'center', gap: 2,
    }}>
      <Text style={{ fontSize: 8, color: s.color, fontWeight: 'bold' }}>{s.label}</Text>
      <Text style={{ fontSize: 7, color: c.muted }}>{s.sub}</Text>
    </Box>
  );
  const arrow = <Text style={{ fontSize: 10, color: c.muted, flexShrink: 0 }}>{'\u2192'}</Text>;
  return (
    <Box style={{ width: '100%', gap: 6 }}>
      <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold', letterSpacing: 1 }}>{'SHM COMPOSITING PIPELINE'}</Text>
      <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {renderStage(row1[0])}
        {arrow}
        {renderStage(row1[1])}
        {arrow}
        {renderStage(row1[2])}
      </Box>
      <Box style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: c.muted }}>{'\u2193'}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {renderStage(row2[0])}
        {arrow}
        {renderStage(row2[1])}
      </Box>
    </Box>
  );
}

/** Three mode states side by side */
function ModeTriplePreview() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 6 }}>
      <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold', letterSpacing: 1 }}>{'VISIBILITY MODES — LIVE PREVIEW'}</Text>
      <Box style={{ gap: 8 }}>
        <PassthroughPreview />
        <InteractivePreview />
        <HiddenPreview />
      </Box>
    </Box>
  );
}

// ── Helpers ──────────────────────────────────────────────

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

// ── OverlayStory ────────────────────────────────────────

export function OverlayStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="layers" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Overlay'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Now you see it, now you don\'t'}
        </Text>
      </Box>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Transparent window or shared memory compositing. One hotkey to toggle. React declares the HUD, Lua owns the transport.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'The overlay system turns any ReactJIT app into a game overlay. Two transport modes: a transparent always-on-top SDL2 window with X11 XFixes input passthrough (for borderless-windowed games), or a POSIX shared memory segment with an LD_PRELOAD hook that intercepts glXSwapBuffers to composite onto true fullscreen games. Three visibility modes — passthrough, interactive, hidden — cycled by a single hotkey.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── Install: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Already in the box'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useOverlay() is part of @reactjit/core — no extra package needed. The hook polls overlay:state RPC every 500ms and returns the current mode, opacity, hotkey, and control methods.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Hook: demo | text + code ── */}
        <Band>
          <Half>
            <OverlayStateDemo />
            <PassthroughPreview />
          </Half>
          <Half>
            <SectionLabel icon="code">{'useOverlay() HOOK'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'One hook to rule them all'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Returns current overlay state and control methods. Polls the Lua overlay module via RPC. When overlay mode is not active (no REACTJIT_OVERLAY env var), enabled is false and controls are no-ops.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={HOOK_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Modes: text + diagram | previews ── */}
        <Band>
          <Half>
            <SectionLabel icon="toggle-left">{'VISIBILITY MODES'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Three faces, one hotkey'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three modes, cycled by hotkey (default F6). The cycle is deterministic: passthrough, interactive, hidden, repeat. Each mode changes both visibility and input routing.'}
            </Text>
            <Box style={{ gap: 6 }}>
              {MODES.map(m => (
                <Box key={m.label} style={{ gap: 2 }}>
                  <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: m.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: 10, color: m.color, fontWeight: 'bold' }}>{m.label}</Text>
                  </Box>
                  <Text style={{ fontSize: 9, color: c.muted, paddingLeft: 11 }}>{m.desc}</Text>
                </Box>
              ))}
            </Box>
            <ModeCycleDiagram />
            <CodeBlock language="tsx" fontSize={9} code={MODES_CODE} />
          </Half>
          <Half>
            <ModeTriplePreview />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: X11 ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Input passthrough uses X11 XFixes to set an empty input region on the overlay window. When the region is empty, all mouse and keyboard events fall through to the window underneath. This is the same technique Steam and MangoHud use. Gracefully degrades on non-X11 systems (Wayland, macOS) — overlay still works, just without click-through.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Transports: diagram | text + code ── */}
        <Band>
          <Half>
            <TransportDiagram />
            <SHMPipelinePreview />
          </Half>
          <Half>
            <SectionLabel icon="layers">{'TRANSPORT MODES'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Window or wormhole'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Two ways to get your overlay onto the screen. Transparent window mode is the default — works for any borderless-windowed game with zero setup. Shared memory mode is for true fullscreen games where a separate window can\'t float on top.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The shm transport renders to a Love2D Canvas (FBO), reads pixels via glReadPixels, and writes them to a POSIX shared memory segment. The LD_PRELOAD hook in the game process reads that segment and composites it onto the game\'s framebuffer every frame.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Window mode CLI: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal">{'WINDOW MODE (CLI)'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Float like a butterfly'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The default mode. Launches your ReactJIT app as a borderless, always-on-top, transparent SDL2 window. esbuild watch + HMR included — edit your overlay code and see it update in real time over the game.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Uses SDL_SetWindowBordered(false), SDL_SetWindowAlwaysOnTop(true), and love.graphics.setBackgroundColor(0,0,0,0) for transparency.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="bash" fontSize={9} code={WINDOW_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Attach mode CLI: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="bash" fontSize={9} code={ATTACH_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="hard-drive">{'ATTACH MODE (CLI)'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Inject directly into the vein'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'For true fullscreen games. Builds your app, launches Love2D in shm mode, waits for the RJIT_SHM_READY signal, then launches your game with the LD_PRELOAD hook. The hook intercepts glXSwapBuffers and composites the overlay.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The GL state save/restore in overlay_hook.c saves 17 GL variables plus pixel store state before drawing. Direct C translation of the battle-tested pattern from lua/videos.lua.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── HUD pattern: text + preview | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="layout">{'HUD PATTERN'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'Heads up, heads down'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Build your overlay like any ReactJIT app. Check overlay.mode to decide what to render — minimal stats bar in passthrough, full settings panel in interactive, nothing expensive in hidden. The mode changes instantly on hotkey press.'}
            </Text>
            <InteractivePreview />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={HUD_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── SHM protocol: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={SHM_PROTOCOL_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="database">{'SHM PROTOCOL'}</SectionLabel>
            <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'32 bytes of trust'}</Text>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The shared memory segment has a 32-byte header followed by raw RGBA pixel data. The magic number 0x524A4954 ("RJIT") identifies valid segments. frame_seq increments each frame so the hook can detect stale data. Flags control visibility and input routing.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Segment name is /rjit-overlay-{pid}. Created by overlay_shm.lua via shm_open(), read by overlay_hook.c via the same name passed in RJIT_OVERLAY_SHM env var.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: architecture ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'React never touches SDL2, X11, or GL state. The Lua overlay module owns the window configuration and input routing. The C hook owns the framebuffer compositing. React just reads state via useOverlay() and declares the UI.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Feature catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="list">{'API SURFACE'}</SectionLabel>
          <Text style={{ color: C.accent, fontSize: 9, fontStyle: 'italic' }}>{'The whole arsenal'}</Text>
          <FeatureCatalog />
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="layers" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Overlay'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
