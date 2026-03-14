/**
 * Native storybook entry point.
 *
 * Bundled as IIFE, evaluated by QuickJS inside Love2D.
 * Renders a story browser + selected story using the native
 * react-reconciler → Lua tree/layout/painter pipeline.
 *
 * Navigation: click story names, or use Up/Down + Enter keys.
 */

import React, { useState, useRef, type ErrorInfo } from 'react';
import { NativeBridge } from '../../packages/renderer/src/NativeBridge';
import { createRoot } from '../../packages/renderer/src/NativeRenderer';
import { setCryptoBridge } from '../../packages/crypto/src/rpc';
import { setPrivacyBridge } from '../../packages/privacy/src/rpc';
import { BridgeProvider, useBridge } from '../../packages/core/src/context';
import { classifiers as S } from '../../packages/core/src';
import '../../packages/icons/src'; // register icons so <Image src="icon-name" /> works
import './stories/_shared/storybook.cls'; // register storybook classifiers
// State preservation disabled — it patches React.useState globally which
// breaks HMR reload (microtask flood causes TypeError in fresh QuickJS context).
// Use useHotState() explicitly for state that should survive hot reload.
// import {
//   enableStatePreservation,
//   disableStatePreservation,
//   setPreservationBridge,
// } from '../../packages/core/src/preserveState';
import { Box, Text, Pressable, ScaleProvider, PortalHost, useHotkey, useBreakpoint, useScaleInfo, useMount, type ScaleCurve } from '../../packages/core/src';
import { ThemeProvider, useThemeColors, ThemeSwitcher } from '../../packages/theme/src';
import { stories, type StoryDef, type StorySection } from './stories';
import { DocsViewer } from './docs/DocsViewer';
import { PlaygroundPanel } from './playground/PlaygroundPanel';
import contentData from './generated/content.json';

// ── HMR state sync ───────────────────────────────────────

let currentActiveIdx = 0;
let currentMode: 'stories' | 'docs' | 'playground' = 'stories';

// Expose state getter for HMR — Lua calls this before teardown
(globalThis as any).__getDevState = () => ({
  activeIdx: currentActiveIdx,
  mode: currentMode,
  playgroundCode: (globalThis as any).__currentPlaygroundCode,
});

// ── Story browser (sidebar + viewer) ─────────────────────

const SECTION_ORDER: StorySection[] = ['Core', 'Packages', 'Demos', 'Bad Habits', 'Stress Test', 'Dev', 'Layouts'];

function groupBySection(list: StoryDef[]): Map<StorySection, StoryDef[]> {
  const map = new Map<StorySection, StoryDef[]>();
  for (const section of SECTION_ORDER) map.set(section, []);
  for (const s of list) {
    const section = (s.section ?? 'Packages') as StorySection;
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(s);
  }
  return map;
}

// ── Error boundary for story content ──────────────────────

interface EBProps {
  children: React.ReactNode;
  resetKey: any;
}
interface EBState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

class StoryErrorBoundary extends React.Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '', errorStack: '' };
  }
  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || '',
    };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.log('[ErrorBoundary] ' + error.message);
    if (info.componentStack) console.log('[ErrorBoundary] Component stack:' + info.componentStack);
  }
  componentDidUpdate(prev: EBProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '', errorStack: '' });
    }
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <StoryErrorScreen message={this.state.errorMessage} stack={this.state.errorStack} />;
  }
}

function StoryErrorScreen({ message, stack }: { message: string; stack: string }) {
  const c = useThemeColors();
  // Extract just the useful part of the stack (first 8 lines)
  const shortStack = stack
    .split('\n')
    .slice(0, 8)
    .join('\n');

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: c.bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    }}>
      <Box style={{
        backgroundColor: c.bgElevated,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ef4444',
        padding: 24,
        gap: 12,
        maxWidth: 600,
        width: '80%',
      }}>
        {/* Header */}
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Box style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: '#ef444422',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: 'bold' }}>{'!'}</Text>
          </Box>
          <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: 'bold' }}>
            {'Story Crashed'}
          </Text>
        </Box>

        {/* Error message */}
        <Box style={{
          backgroundColor: '#ef444411',
          borderRadius: 6,
          padding: 12,
          borderLeftWidth: 3,
          borderColor: '#ef4444',
        }}>
          <Text style={{ color: c.text, fontSize: 11, fontFamily: 'monospace' }}>
            {message}
          </Text>
        </Box>

        {/* Stack trace */}
        {shortStack.length > 0 && (
          <Box style={{ gap: 4 }}>
            <S.StoryCap>{'Stack trace'}</S.StoryCap>
            <Box style={{
              backgroundColor: c.bg,
              borderRadius: 6,
              padding: 10,
            }}>
              <Text style={{ color: c.textDim, fontSize: 8, fontFamily: 'monospace' }}>
                {shortStack}
              </Text>
            </Box>
          </Box>
        )}

        {/* Hint */}
        <S.StoryCap>
          {'Select a different story from the sidebar to recover.'}
        </S.StoryCap>
      </Box>
    </Box>
  );
}

function ScaleInfoBadge() {
  const c = useThemeColors();
  const info = useScaleInfo();
  return (
    <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 8 }}>
      <Box style={{
        backgroundColor: c.surface,
        borderRadius: 4,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
      }}>
        <Text style={{ color: c.textDim, fontSize: 8 }}>
          {`${info.curve} | raw ${info.rawScale.toFixed(2)}x | applied ${info.scale.toFixed(2)}x`}
        </Text>
      </Box>
    </Box>
  );
}

function StorybookPanel() {
  const initialIdx = (globalThis as any).__devState?.activeIdx ?? 0;
  const [activeIdx, setActiveIdx] = useState(initialIdx);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scaleCurve, setScaleCurve] = useState<ScaleCurve>('sqrt');
  currentActiveIdx = activeIdx; // sync for __getDevState

  // Expose programmatic navigation for tests (rjit test)
  (globalThis as any).__navigateToStory = (id: string): boolean => {
    const idx = stories.findIndex(s => s.id === id);
    if (idx < 0) return false;
    navigateToStory(idx);
    return true;
  };
  const groups = groupBySection(stories);
  const active = stories[activeIdx];
  const StoryComp = active?.component;
  const c = useThemeColors();
  const bp = useBreakpoint();
  const compact = bp === 'sm';
  const sidebarW = bp === 'md' ? 140 : 180;

  const handleKeyDown = (e: any) => {
    const key = e.key || e.scancode;
    if (key === 'down' || key === 'j') {
      setActiveIdx(i => Math.min(i + 1, stories.length - 1));
    } else if (key === 'up' || key === 'k') {
      setActiveIdx(i => Math.max(i - 1, 0));
    }
  };

  // ── Record route changes in the event trail for crash diagnostics ──
  const bridge = useBridge();
  const navigateToStory = (idx: number) => {
    setActiveIdx(idx);
    const story = stories[idx];
    if (story) bridge.rpc('trail:navigate', { route: story.title });
  };
  // Record the initial route on mount
  useMount(() => {
    if (active) bridge.rpc('trail:navigate', { route: active.title });
  });

  // ── Ghost node diagnostic crawl (Ctrl+Shift+D) ──
  const crawlingRef = useRef(false);

  // rjit-ignore-next-line
  useHotkey('ctrl+shift+d', async () => {
    if (crawlingRef.current) return;
    crawlingRef.current = true;

    const originalIdx = activeIdx;
    const SETTLE_MS = 500;
    const allResults: Array<{ story: string; id: string; total: number; painted: number; ghost: number; ghosts: any[] }> = [];

    console.log('\n[diagnose] Starting ghost node crawl across ' + stories.length + ' stories...\n');

    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      setActiveIdx(i);

      // Wait for React re-render + Lua layout to settle
      await new Promise(r => setTimeout(r, SETTLE_MS));

      try {
        const result = await bridge.rpc<any>('diagnose:run', undefined, 5000);
        if (result && !result.error) {
          const ghostNodes = (result.nodes || []).filter((n: any) => n.status !== 'non-visual-cap' && n.status !== 'own-surface');
          allResults.push({
            story: story.title,
            id: story.id,
            total: result.total,
            painted: result.painted,
            ghost: result.ghost,
            ghosts: ghostNodes,
          });

          if (ghostNodes.length > 0) {
            console.log('[diagnose] ' + story.title + ': ' + ghostNodes.length + ' ghost node(s)');
            for (const g of ghostNodes) {
              console.log('  - id=' + g.id + ' type=' + (g.type || '?') + ' status=' + g.status + ' debugName=' + (g.debugName || '-'));
            }
          }
        } else {
          console.log('[diagnose] ' + story.title + ': ERROR - ' + (result?.error || 'unknown'));
        }
      } catch (err: any) {
        console.log('[diagnose] ' + story.title + ': RPC failed - ' + (err?.message || err));
      }
    }

    // Print summary
    const storiesWithGhosts = allResults.filter(r => r.ghost > 0);
    const totalGhosts = allResults.reduce((sum, r) => sum + r.ghost, 0);

    console.log('\n[diagnose] ═══════════════════════════════════════');
    console.log('[diagnose]  Ghost Node Crawl Complete');
    console.log('[diagnose] ═══════════════════════════════════════');
    console.log('[diagnose]  Stories scanned:     ' + stories.length);
    console.log('[diagnose]  Stories with ghosts: ' + storiesWithGhosts.length);
    console.log('[diagnose]  Total ghost nodes:   ' + totalGhosts);

    if (storiesWithGhosts.length > 0) {
      console.log('[diagnose] ───────────────────────────────────────');
      for (const r of storiesWithGhosts) {
        console.log('[diagnose]  ' + r.story + ' (' + r.ghost + ' ghosts, ' + r.total + ' total)');
        for (const g of r.ghosts) {
          console.log('[diagnose]    ' + g.id + ' ' + (g.type || '?') + ' [' + g.status + '] ' + (g.debugName || ''));
        }
      }
    } else {
      console.log('[diagnose]  No ghost nodes found in any story.');
    }
    console.log('[diagnose] ═══════════════════════════════════════\n');

    // Restore original story
    setActiveIdx(originalIdx);
    crawlingRef.current = false;
  });

  const sidebarContent = (
    <>
      {/* Header */}
      <Box style={{ paddingTop: 10, paddingLeft: 10, paddingRight: 10, paddingBottom: 8 }}>
        <Box style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingTop: 6,
          paddingBottom: 6,
          paddingLeft: 8,
          paddingRight: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
        }}>
          <Box style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: c.primary }} />
          <Box>
            <Text style={{ color: c.text, fontSize: 11, letterSpacing: 0.6 }}>ReactJIT</Text>
            <Text style={{ color: c.textDim, fontSize: 8, letterSpacing: 1.1 }}>STORYBOOK</Text>
          </Box>
        </Box>
      </Box>
      <Box style={{ height: 1, backgroundColor: c.border }} />

      {/* Story list */}
      {Array.from(groups.entries()).map(([section, list]) => (
        <Box key={section}>
          <Box style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 2 }}>
            <S.StoryCap>{String(section || '').toUpperCase()}</S.StoryCap>
          </Box>
          {list.map(s => {
            const idx = stories.indexOf(s);
            const isActive = idx === activeIdx;
            return (
              <Pressable
                key={s.id}
                onPress={() => { navigateToStory(idx); if (compact) setSidebarOpen(false); }}
                style={{
                  paddingLeft: 16,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  backgroundColor: isActive ? c.surface : 'transparent',
                }}
              >
                <Text style={{
                  color: isActive ? c.text : c.textSecondary,
                  fontSize: 11,
                }}>
                  {s.title}
                </Text>
              </Pressable>
            );
          })}
        </Box>
      ))}

      {/* Scale curve switcher */}
      <Box style={{ height: 1, backgroundColor: c.border, marginTop: 8 }} />
      <Box style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 2 }}>
        <S.StoryCap>{'SCALE CURVE'}</S.StoryCap>
      </Box>
      {(['linear', 'sqrt', 'capped'] as ScaleCurve[]).map(cv => (
        <Pressable
          key={cv}
          onPress={() => setScaleCurve(cv)}
          style={{
            paddingLeft: 16,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            backgroundColor: cv === scaleCurve ? c.surface : 'transparent',
          }}
        >
          <Text style={{
            color: cv === scaleCurve ? c.text : c.textSecondary,
            fontSize: 11,
          }}>
            {cv === 'linear' ? 'Linear (original)' : cv === 'sqrt' ? 'Square root' : 'Capped (1.8x)'}
          </Text>
        </Pressable>
      ))}
      <ScaleInfoBadge />
    </>
  );

  return (
    <Box style={{ flexDirection: compact ? 'column' : 'row', width: '100%', height: '100%' }} onKeyDown={handleKeyDown}>
      {/* Compact: story picker bar + overlay sidebar */}
      {compact && (
        <Box style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.bgAlt,
          borderBottomWidth: 1,
          borderColor: c.border,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          gap: 8,
        }}>
          <Pressable
            onPress={() => setSidebarOpen(!sidebarOpen)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 4,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontSize: 11 }}>{sidebarOpen ? '\u2715' : '\u2630'}</Text>
          </Pressable>
          <Text style={{ color: c.text, fontSize: 11, flexGrow: 1 }} numberOfLines={1}>
            {active?.title ?? ''}
          </Text>
        </Box>
      )}

      {/* Sidebar: inline on desktop, overlay on compact */}
      {compact ? (
        sidebarOpen && (
          <Box style={{
            position: 'absolute',
            top: 30,
            left: 0,
            width: '80%',
            height: '100%',
            backgroundColor: c.bgAlt,
            borderWidth: 1,
            borderColor: c.border,
            zIndex: 100,
            overflow: 'scroll',
          }}>
            {sidebarContent}
          </Box>
        )
      ) : (
        <Box focusGroup style={{
          width: sidebarW,
          backgroundColor: c.bgAlt,
          borderWidth: 1,
          borderColor: c.border,
          padding: 0,
          overflow: 'scroll',
        }}>
          {sidebarContent}
        </Box>
      )}

      {/* Content */}
      <Box focusGroup focusable style={{ flexGrow: 1, backgroundColor: c.bg, overflow: 'scroll' }}>
        <ScaleProvider reference={{ width: 800, height: 600 }} curve={scaleCurve} insetWidth={compact ? 0 : sidebarW}>
          {StoryComp && <StoryComp key={active.id} />}
        </ScaleProvider>
      </Box>
    </Box>
  );
}

// ── Top-level mode switcher ──────────────────────────────

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 4,
        backgroundColor: active ? c.surface : 'transparent',
      }}
    >
      <Text style={{
        color: active ? c.text : c.textSecondary,
        fontSize: 10,
        fontWeight: 'normal',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

type Mode = 'stories' | 'docs' | 'playground';

function Storybook() {
  const initialMode = (globalThis as any).__devState?.mode ?? 'stories';
  const [mode, setMode] = useState<Mode>(initialMode);
  currentMode = mode;
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      {/* Mode toggle bar */}
      <Box focusGroup style={{
        flexDirection: 'row',
        backgroundColor: c.bgAlt,
        borderWidth: 1,
        borderColor: c.border,
        padding: 4,
        gap: 2,
        alignItems: 'center',
        width: '100%',
      }}>
        <TabButton label="Stories" active={mode === 'stories'} onPress={() => setMode('stories')} />
        <TabButton label="Docs" active={mode === 'docs'} onPress={() => setMode('docs')} />
        <TabButton label="Playground" active={mode === 'playground'} onPress={() => setMode('playground')} />
        <Box style={{ flexGrow: 1 }} />
        <ThemeSwitcher />
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, width: '100%' }}>
        {mode === 'stories' && <StorybookPanel />}
        {mode === 'docs' && <DocsViewer content={contentData as any} />}
        {mode === 'playground' && <PlaygroundPanel />}
      </Box>
    </Box>
  );
}

// ── Bootstrap ─────────────────────────────────────────────

const bridge = new NativeBridge();
(globalThis as any).__rjitBridge = bridge;
setCryptoBridge(bridge);
setPrivacyBridge(bridge);
const root = createRoot();

// When __deferMount is true (set by Lua before eval), store the mount function
// globally so Lua can trigger it after JS_Eval returns. This avoids React's
// synchronous LegacyRoot render blocking the entire JS_Eval call.
(globalThis as any).__mount = () => {
  root.render(
    <BridgeProvider bridge={bridge}>
      <ThemeProvider>
        <PortalHost>
          <Storybook />
        </PortalHost>
      </ThemeProvider>
    </BridgeProvider>
  );
  console.log('[reactjit] Native storybook mounted (' + stories.length + ' stories)');
};

if (!(globalThis as any).__deferMount) {
  (globalThis as any).__mount();
}
