/**
 * WASM storybook entry point.
 *
 * Bundled as IIFE, runs in the browser. Love2D renders via WASM,
 * React communicates via Module.FS bridge (bridge_fs.lua <-> bridge.js).
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWasmApp } from '../../packages/native/src/WasmApp';
import { BridgeProvider, RendererProvider, useBridge } from '../../packages/core/src/context';
import { Box, Text, Pressable, ScaleProvider, PortalHost, useHotkey } from '../../packages/core/src';
import { ThemeProvider, useThemeColors, ThemeSwitcher } from '../../packages/theme/src';
import { stories, type StoryDef, type StorySection } from './stories';

// ── Story browser (sidebar + viewer) ─────────────────────

const SECTION_ORDER: StorySection[] = ['Core', 'Packages', 'Demos', 'Stress Test', 'Dev'];

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

function getInitialStoryIdx(): number {
  try {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const idx = stories.findIndex(s => s.id === hash);
      if (idx >= 0) return idx;
    }
  } catch { /* not in browser */ }
  return 0;
}

function StorybookPanel() {
  const [activeIdx, _setActiveIdx] = useState(getInitialStoryIdx);
  const setActiveIdx = useCallback((v: number | ((i: number) => number)) => {
    _setActiveIdx(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { window.history.replaceState(null, '', '#' + stories[next]?.id); } catch {}
      return next;
    });
  }, []);
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
        <Box style={{ paddingTop: 14, paddingLeft: 12, paddingRight: 12, paddingBottom: 5 }}>
          <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'bold' }}>ReactJIT</Text>
        </Box>
        <Box style={{ height: 1, backgroundColor: c.border }} />

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
      <Box style={{ flexGrow: 1, backgroundColor: c.bg, overflow: 'hidden' }}>
        <Box style={{
          padding: 8,
          paddingLeft: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>
            {active?.title}
          </Text>
          <Text style={{ color: c.textDim, fontSize: 9 }}>
            {active?.section}
          </Text>
        </Box>

        <ScaleProvider reference={{ width: 800, height: 600 }}>
          <Box style={{ flexGrow: 1, overflow: 'scroll', backgroundColor: c.bg }}>
            {StoryComp && <StoryComp key={active.id} />}
          </Box>
        </ScaleProvider>
      </Box>
    </Box>
  );
}

// ── Tab bar ──────────────────────────────────────────────

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
        borderRadius: 4,
        backgroundColor: active ? c.surface : 'transparent',
      }}
    >
      <Text style={{ color: active ? c.text : c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Storybook() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', height: '100%' }}>
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
        <TabButton label="Stories" active={true} onPress={() => {}} />
        <Box style={{ flexGrow: 1 }} />
        <ThemeSwitcher />
      </Box>
      <Box style={{ flexGrow: 1, width: '100%' }}>
        <StorybookPanel />
      </Box>
    </Box>
  );
}

// ── Bootstrap ─────────────────────────────────────────────

const app = createWasmApp();
app.render(
  <ThemeProvider>
    <PortalHost>
      <Storybook />
    </PortalHost>
  </ThemeProvider>
);
