/**
 * WASM storybook entry point.
 *
 * Bundled as IIFE, runs in the browser. Love2D renders via WASM,
 * React communicates via Module.FS bridge (bridge_fs.lua <-> bridge.js).
 */

import React, { useState, useRef } from 'react';
import { createWasmApp } from '../../packages/renderer/src/WasmApp';
import { BridgeProvider, useBridge, classifiers as S} from '../../packages/core/src/context';
import { Box, Text, Pressable, ScaleProvider, PortalHost, useHotkey, useBreakpoint } from '../../packages/core/src';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setActiveIdx = (v: number | ((i: number) => number)) => {
    _setActiveIdx(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { window.history.replaceState(null, '', '#' + stories[next]?.id); } catch {}
      return next;
    });
  };
  const groups = groupBySection(stories);
  const active = stories[activeIdx];
  const StoryComp = active?.component;
  const c = useThemeColors();
  const bp = useBreakpoint();
  const compact = bp === 'sm';

  const handleKeyDown = (e: any) => {
    const key = e.key || e.scancode;
    if (key === 'down' || key === 'j') {
      setActiveIdx(i => Math.min(i + 1, stories.length - 1));
    } else if (key === 'up' || key === 'k') {
      setActiveIdx(i => Math.max(i - 1, 0));
    }
  };

  const sidebarContent = (
    <>
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
                onPress={() => { setActiveIdx(idx); if (compact) setSidebarOpen(false); }}
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
        <Box style={{
          width: 180,
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
      <Box style={{ flexGrow: 1, backgroundColor: c.bg, overflow: 'hidden' }}>
        {!compact && (
          <Box style={{
            padding: 8,
            paddingLeft: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>
              {active?.title}
            </Text>
            <S.StoryCap>
              {active?.section}
            </S.StoryCap>
          </Box>
        )}

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
      <Text style={{ color: active ? c.text : c.textSecondary, fontSize: 10, fontWeight: 'normal' }}>
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
