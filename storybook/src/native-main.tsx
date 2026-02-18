/**
 * Native storybook entry point.
 *
 * Bundled as IIFE, evaluated by QuickJS inside Love2D.
 * Renders a story browser + selected story using the native
 * react-reconciler → Lua tree/layout/painter pipeline.
 *
 * Navigation: click story names, or use Up/Down + Enter keys.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { NativeBridge } from '../../packages/native/src/NativeBridge';
import { createRoot } from '../../packages/native/src/NativeRenderer';
import { BridgeProvider, RendererProvider } from '../../packages/shared/src/context';
import { Box, Text, Pressable, ScrollView, ScaleProvider } from '../../packages/shared/src';
import type { ScrollEvent } from '../../packages/shared/src/types';
import { ThemeProvider, useTheme, useThemeColors, themeNames } from '../../packages/theme/src';
import { stories, type StoryDef } from './stories';
import { DocsViewer } from './docs/DocsViewer';
import { PlaygroundPanel } from './playground/PlaygroundPanel';
import contentData from './generated/content.json';

// ── HMR state sync ───────────────────────────────────────

let currentActiveIdx = 0;
let currentMode: 'stories' | 'docs' | 'playground' = 'stories';
let currentViewMode: 'pages' | 'scroll' = 'pages';

// Expose state getter for HMR — Lua calls this before teardown
(globalThis as any).__getDevState = () => ({
  activeIdx: currentActiveIdx,
  mode: currentMode,
  viewMode: currentViewMode,
  playgroundCode: (globalThis as any).__currentPlaygroundCode,
});

// ── Story browser (sidebar + viewer) ─────────────────────

function groupByCategory(list: StoryDef[]): Map<string, StoryDef[]> {
  const map = new Map<string, StoryDef[]>();
  for (const s of list) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category)!.push(s);
  }
  return map;
}

// ── Virtualization helpers ───────────────────────────────

const ESTIMATED_STORY_HEIGHT = 500;
const SECTION_HEADER_HEIGHT = 32;
const STORY_SEPARATOR_HEIGHT = 1;
const ITEM_HEIGHT = ESTIMATED_STORY_HEIGHT + SECTION_HEADER_HEIGHT + STORY_SEPARATOR_HEIGHT;
const OVERSCAN = 2;

/** Binary search: find the first index whose bottom edge is past scrollTop */
function findFirstVisible(count: number, scrollTop: number): number {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((mid + 1) * ITEM_HEIGHT <= scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// ── Story scroll view (all stories in one continuous scroll) ──

function StoryScrollContent({ stories: storyList, activeIdx, onActiveChange }: {
  stories: StoryDef[];
  activeIdx: number;
  onActiveChange: (idx: number) => void;
}) {
  const c = useThemeColors();
  const totalHeight = storyList.length * ITEM_HEIGHT;
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 5]);

  const handleScroll = useCallback((e: ScrollEvent) => {
    const scrollTop = e.scrollY;
    const viewportHeight = e.contentHeight;
    const scrollBottom = scrollTop + viewportHeight;
    const count = storyList.length;
    if (count === 0) return;

    const first = findFirstVisible(count, scrollTop);
    const last = Math.min(count - 1, Math.floor(scrollBottom / ITEM_HEIGHT));
    const start = Math.max(0, first - OVERSCAN);
    const end = Math.min(count - 1, last + OVERSCAN);
    setVisibleRange([start, end]);

    // Active story: topmost story that's at least partially visible
    const activeStoryIdx = Math.max(0, Math.min(first, count - 1));
    if (activeStoryIdx !== activeIdx) {
      onActiveChange(activeStoryIdx);
    }
  }, [storyList.length, activeIdx, onActiveChange]);

  const [start, end] = visibleRange;
  const topSpacerHeight = start * ITEM_HEIGHT;
  const bottomSpacerHeight = Math.max(0, totalHeight - (end + 1) * ITEM_HEIGHT);

  return (
    <ScrollView
      style={{ flexGrow: 1, backgroundColor: c.bg }}
      onScroll={handleScroll}
    >
      {/* Top spacer */}
      {topSpacerHeight > 0 && <Box style={{ height: topSpacerHeight }} />}

      {/* Visible stories */}
      {storyList.slice(start, end + 1).map((story, i) => {
        const StoryComp = story.component;
        return (
          <Box key={story.id} style={{ height: ITEM_HEIGHT }}>
            {/* Section header */}
            <Box style={{
              height: SECTION_HEADER_HEIGHT,
              paddingLeft: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: c.bgAlt,
            }}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>
                {story.title}
              </Text>
              <Text style={{ color: c.textDim, fontSize: 9 }}>
                {story.category}
              </Text>
            </Box>

            {/* Story content */}
            <ScaleProvider reference={{ width: 800, height: 600 }}>
              <Box style={{
                height: ESTIMATED_STORY_HEIGHT,
                overflow: 'hidden',
                backgroundColor: c.bg,
              }}>
                <StoryComp />
              </Box>
            </ScaleProvider>

            {/* Separator */}
            <Box style={{ height: STORY_SEPARATOR_HEIGHT, backgroundColor: c.border }} />
          </Box>
        );
      })}

      {/* Bottom spacer */}
      {bottomSpacerHeight > 0 && <Box style={{ height: bottomSpacerHeight }} />}
    </ScrollView>
  );
}

// ── Story browser (sidebar + viewer) ─────────────────────

function StorybookPanel() {
  const initialIdx = (globalThis as any).__devState?.activeIdx ?? 0;
  const initialViewMode = (globalThis as any).__devState?.viewMode ?? 'pages';
  const [activeIdx, setActiveIdx] = useState(initialIdx);
  const [viewMode, setViewMode] = useState<'pages' | 'scroll'>(initialViewMode);
  currentActiveIdx = activeIdx;
  currentViewMode = viewMode;
  const groups = groupByCategory(stories);
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
        {/* Header */}
        <Box style={{ paddingTop: 14, paddingLeft: 12, paddingRight: 12, paddingBottom: 5 }}>
          <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'bold' }}>iLoveReact</Text>
        </Box>
        <Box style={{ height: 1, backgroundColor: c.border }} />

        {/* View mode toggle */}
        <Box style={{
          flexDirection: 'row',
          padding: 4,
          gap: 2,
        }}>
          <Pressable
            onPress={() => setViewMode('pages')}
            style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: 3,
              backgroundColor: viewMode === 'pages' ? c.surface : 'transparent',
            }}
          >
            <Text style={{ color: viewMode === 'pages' ? c.text : c.textDim, fontSize: 9, fontWeight: 'bold' }}>
              Pages
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('scroll')}
            style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: 3,
              backgroundColor: viewMode === 'scroll' ? c.surface : 'transparent',
            }}
          >
            <Text style={{ color: viewMode === 'scroll' ? c.text : c.textDim, fontSize: 9, fontWeight: 'bold' }}>
              Scroll
            </Text>
          </Pressable>
        </Box>
        <Box style={{ height: 1, backgroundColor: c.border }} />

        {/* Story list */}
        {Array.from(groups.entries()).map(([category, list]) => (
          <Box key={category}>
            <Box style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 2 }}>
              <Text style={{ color: c.textDim, fontSize: 9 }}>{category.toUpperCase()}</Text>
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
        {viewMode === 'scroll' ? (
          <StoryScrollContent
            stories={stories}
            activeIdx={activeIdx}
            onActiveChange={setActiveIdx}
          />
        ) : (
          <>
            {/* Header bar */}
            <Box style={{
              padding: 8,
              paddingLeft: 12,
              borderWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>
                {active?.title}
              </Text>
              <Text style={{ color: c.textDim, fontSize: 9 }}>
                {active?.category}
              </Text>
            </Box>

            {/* Story content */}
            <ScaleProvider reference={{ width: 800, height: 600 }}>
              <Box style={{ flexGrow: 1, overflow: 'scroll', backgroundColor: c.bg }}>
                {StoryComp && <StoryComp key={active.id} />}
              </Box>
            </ScaleProvider>
          </>
        )}
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
        fontWeight: 'bold',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ThemeCycleButton() {
  const { themeId, setTheme } = useTheme();
  const c = useThemeColors();
  const cycleTheme = useCallback(() => {
    const idx = themeNames.indexOf(themeId);
    const next = themeNames[(idx + 1) % themeNames.length];
    setTheme(next);
  }, [themeId, setTheme]);

  // Truncate theme name to fit button
  const label = themeId.length > 14 ? themeId.slice(0, 12) + '..' : themeId;

  return (
    <Pressable
      onPress={cycleTheme}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: c.primary,
      }}
    >
      <Text style={{ color: c.primary, fontSize: 9 }}>{label}</Text>
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
        <ThemeCycleButton />
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
const root = createRoot();

// When __deferMount is true (set by Lua before eval), store the mount function
// globally so Lua can trigger it after JS_Eval returns. This avoids React's
// synchronous LegacyRoot render blocking the entire JS_Eval call.
(globalThis as any).__mount = () => {
  root.render(
    <BridgeProvider bridge={bridge}>
      <ThemeProvider>
        <RendererProvider mode="native">
          <Storybook />
        </RendererProvider>
      </ThemeProvider>
    </BridgeProvider>
  );
  console.log('[react-love] Native storybook mounted (' + stories.length + ' stories)');
};

if (!(globalThis as any).__deferMount) {
  (globalThis as any).__mount();
}
