/**
 * Native storybook entry point.
 *
 * Bundled as IIFE, evaluated by QuickJS inside Love2D.
 * Renders a story browser + selected story using the native
 * react-reconciler → Lua tree/layout/painter pipeline.
 *
 * Navigation: click story names, or use Up/Down + Enter keys.
 */

import React, { useState, useCallback, useRef } from 'react';
import { NativeBridge } from '../../packages/renderer/src/NativeBridge';
import { createRoot } from '../../packages/renderer/src/NativeRenderer';
import { setCryptoBridge } from '../../packages/crypto/src/rpc';
import { BridgeProvider, useBridge } from '../../packages/core/src/context';
import { Box, Text, Pressable, ScaleProvider, PortalHost, useHotkey } from '../../packages/core/src';
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

function StorybookPanel() {
  const initialIdx = (globalThis as any).__devState?.activeIdx ?? 0;
  const [activeIdx, setActiveIdx] = useState(initialIdx);
  currentActiveIdx = activeIdx; // sync for __getDevState
  const groups = groupBySection(stories);
  const active = stories[activeIdx];
  const StoryComp = active?.component;
  const c = useThemeColors();

  const handleKeyDown = useCallback((e: any) => {
    const key = e.key || e.scancode;
    if (key === 'down' || key === 'j') {
      setActiveIdx(i => Math.min(i + 1, stories.length - 1));
    } else if (key === 'up' || key === 'k') {
      setActiveIdx(i => Math.max(i - 1, 0));
    }
  }, []);

  // ── Ghost node diagnostic crawl (Ctrl+Shift+D) ──
  const bridge = useBridge();
  const crawlingRef = useRef(false);

  useHotkey('ctrl+shift+d', useCallback(async () => {
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
  }, [activeIdx, bridge]));

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%' }} onKeyDown={handleKeyDown}>
      {/* Sidebar */}
      <Box style={{
        width: 180,
        backgroundColor: c.bgAlt,
        borderWidth: 1,
        borderColor: c.border,
        padding: 0,
        overflow: 'scroll',
      }}>
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
              <Text style={{ color: c.textDim, fontSize: 9 }}>{String(section || '').toUpperCase()}</Text>
            </Box>
            {list.map(s => {
              const idx = stories.indexOf(s);
              const isActive = idx === activeIdx;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setActiveIdx(idx)}
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
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, backgroundColor: c.bg, overflow: 'scroll' }}>
        <ScaleProvider reference={{ width: 800, height: 600 }}>
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
      <Box style={{
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
setCryptoBridge(bridge);
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
