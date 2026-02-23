/**
 * LayoutsStory — @reactjit/layouts
 *
 * Demonstrates all layout primitives in three categories:
 *   - Page layouts (full-viewport skeletons)
 *   - Container layouts (inner arrangement)
 *   - Nav layouts (built-in navigation regions)
 *
 * Each demo is 300×220 so the structure is clearly visible at a glance.
 */

import React, { useState } from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// layouts package
import {
  AppShell, HolyGrail, Centered, Stage, Mosaic, Pinboard, Curtain,
  Stack, Cluster, Sidebar, Shelf, Keystone, Frame, Ladder, Reel,
  TopNav, SideNav, BottomNav, CommandShell, Drawer, Bookshelf, Crumb,
} from '../../../packages/layouts/src';

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  nav:     '#4f46e5',
  header:  '#0891b2',
  footer:  '#be185d',
  sidebar: '#7c3aed',
  main:    '#1d4ed8',
  left:    '#7c3aed',
  right:   '#059669',
  tray:    '#dc2626',
  a:       '#f97316',
  b:       '#16a34a',
  c2:      '#2563eb',
  d:       '#9333ea',
  e:       '#db2777',
  command: '#0f766e',
};

// ── Shared helpers ───────────────────────────────────────────────────

function Slab({
  label, color, h, grow = false,
}: { label: string; color: string; h?: number; grow?: boolean }) {
  return (
    <Box style={{
      width: '100%',
      height: h,
      flexGrow: grow ? 1 : 0,
      backgroundColor: color,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: h ?? 24,
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function Block({
  label, color, w, h, grow = false,
}: { label: string; color: string; w?: number | string; h?: number | string; grow?: boolean }) {
  return (
    <Box style={{
      width: w,
      height: h,
      flexGrow: grow ? 1 : 0,
      backgroundColor: color,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 20,
      minHeight: 20,
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function Preview({ children, title }: { children: React.ReactNode; title: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textSecondary, fontSize: 10 }}>{title}</Text>
      <Box style={{
        width: 300,
        height: 200,
        backgroundColor: c.surface,
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Story ────────────────────────────────────────────────────────────

export function LayoutsStory() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <StoryPage>

      {/* ── PAGE LAYOUTS ──────────────────────────────────────── */}

      <StorySection index={1} title="Page: AppShell">
        <Preview title="header / body / footer">
          <AppShell
            header={<Slab label="Header" color={P.header} h={28} />}
            footer={<Slab label="Footer" color={P.footer} h={24} />}
          >
            <Slab label="Content" color={P.main} grow />
          </AppShell>
        </Preview>
      </StorySection>

      <StorySection index={2} title="Page: HolyGrail">
        <Preview title="header / [left | main | right] / footer">
          <HolyGrail
            header={<Slab label="Header" color={P.header} h={24} />}
            footer={<Slab label="Footer" color={P.footer} h={20} />}
            left={<Block label="Left" color={P.left} w={54} h="100%" />}
            right={<Block label="Right" color={P.right} w={48} h="100%" />}
          >
            <Block label="Main" color={P.main} w="100%" h="100%" grow />
          </HolyGrail>
        </Preview>
      </StorySection>

      <StorySection index={3} title="Page: Centered">
        <Preview title="content pinned to center, optional max-width">
          <Centered maxWidth={200}>
            <Slab label="Centered Content" color={P.main} h={80} />
          </Centered>
        </Preview>
      </StorySection>

      <StorySection index={4} title="Page: Stage">
        <Preview title="dominant area + docked tray at floor">
          <Stage tray={<Slab label="Tray" color={P.tray} h={36} />}>
            <Slab label="Stage" color={P.main} grow />
          </Stage>
        </Preview>
      </StorySection>

      <StorySection index={5} title="Page: Mosaic">
        <Preview title="N equal columns — pass columns prop">
          <Mosaic columns={3} gap={4}>
            <Block label="A" color={P.a} w="100%" h="100%" />
            <Block label="B" color={P.b} w="100%" h="100%" />
            <Block label="C" color={P.c2} w="100%" h="100%" />
          </Mosaic>
        </Preview>
      </StorySection>

      <StorySection index={6} title="Page: Pinboard">
        <Preview title="fixed header + fixed sidebar, no footer (VS Code style)">
          <Pinboard
            header={<Slab label="Header" color={P.header} h={26} />}
            sidebar={<Block label="Sidebar" color={P.sidebar} w={52} h="100%" />}
            sidebarWidth={52}
          >
            <Block label="Canvas" color={P.main} w="100%" h="100%" />
          </Pinboard>
        </Preview>
      </StorySection>

      <StorySection index={7} title="Page: Curtain">
        <Preview title="two full-height panels, weighted split">
          <Curtain
            split={0.4}
            left={<Block label="Left 40%" color={P.left} w="100%" h="100%" />}
            right={<Block label="Right 60%" color={P.right} w="100%" h="100%" />}
          />
        </Preview>
      </StorySection>

      {/* ── CONTAINER LAYOUTS ─────────────────────────────────── */}

      <StorySection index={8} title="Container: Stack">
        <Preview title="vertical list with gap">
          <Frame padding={12}>
            <Stack gap={6}>
              <Slab label="Item 1" color={P.a} h={36} />
              <Slab label="Item 2" color={P.b} h={36} />
              <Slab label="Item 3" color={P.c2} h={36} />
            </Stack>
          </Frame>
        </Preview>
      </StorySection>

      <StorySection index={9} title="Container: Cluster">
        <Preview title="wrapping horizontal group (badges, tags)">
          <Frame padding={12}>
            <Cluster gap={6}>
              {['React', 'TypeScript', 'Lua', 'SDL2', 'OpenGL', 'LuaJIT', 'QuickJS', 'esbuild'].map((tag, i) => (
                <Block key={tag} label={tag} color={[P.a, P.b, P.c2, P.d, P.e, P.nav, P.sidebar, P.main][i % 8]} h={22} w={tag.length * 7 + 16} />
              ))}
            </Cluster>
          </Frame>
        </Preview>
      </StorySection>

      <StorySection index={10} title="Container: Sidebar">
        <Preview title="fixed sidebar beside flexible content">
          <Frame padding={12}>
            <Sidebar sideWidth={70} gap={8}>
              <Block label="Side" color={P.sidebar} w={70} h={120} />
              <Block label="Content" color={P.main} w="100%" h={120} />
            </Sidebar>
          </Frame>
        </Preview>
      </StorySection>

      <StorySection index={11} title="Container: Shelf">
        <Preview title="single non-wrapping row, good for toolbars">
          <Frame padding={12}>
            <Shelf gap={8} justify="space-between">
              <Block label="File" color={P.a} w={48} h={28} />
              <Block label="Edit" color={P.b} w={48} h={28} />
              <Block label="View" color={P.c2} w={48} h={28} />
              <Block label="Help" color={P.d} w={48} h={28} />
            </Shelf>
          </Frame>
        </Preview>
      </StorySection>

      <StorySection index={12} title="Container: Keystone">
        <Preview title="hero child takes top share, rest share the bottom">
          <Keystone heroRatio={0.6} gap={6} style={{ padding: 10, height: 180 }}>
            <Block label="Hero" color={P.main} w="100%" h="100%" />
            <Block label="A" color={P.a} w="100%" h="100%" />
            <Block label="B" color={P.b} w="100%" h="100%" />
            <Block label="C" color={P.c2} w="100%" h="100%" />
          </Keystone>
        </Preview>
      </StorySection>

      <StorySection index={13} title="Container: Frame">
        <Preview title="uniform inset, content centered inside">
          <Frame padding={32}>
            <Slab label="Content" color={P.main} h={80} />
          </Frame>
        </Preview>
      </StorySection>

      <StorySection index={14} title="Container: Ladder">
        <Preview title="items alternate left / right (timeline pattern)">
          <Frame padding={12}>
            <Ladder gap={6}>
              <Block label="Step 1" color={P.a} w={100} h={28} />
              <Block label="Step 2" color={P.b} w={100} h={28} />
              <Block label="Step 3" color={P.c2} w={100} h={28} />
              <Block label="Step 4" color={P.d} w={100} h={28} />
            </Ladder>
          </Frame>
        </Preview>
      </StorySection>

      <StorySection index={15} title="Container: Reel">
        <Preview title="horizontal scroll strip with fixed item widths">
          <Frame padding={12}>
            <Reel itemWidth={80} gap={8} style={{ height: 60 }}>
              {[P.a, P.b, P.c2, P.d, P.e, P.nav, P.sidebar].map((color, i) => (
                <Block key={i} label={`Card ${i + 1}`} color={color} w={80} h={60} />
              ))}
            </Reel>
          </Frame>
        </Preview>
      </StorySection>

      {/* ── NAV LAYOUTS ───────────────────────────────────────── */}

      <StorySection index={16} title="Nav: TopNav">
        <Preview title="horizontal nav bar at top, content below">
          <TopNav nav={<Slab label="Nav Bar" color={P.nav} h={32} />}>
            <Slab label="Content" color={P.main} grow />
          </TopNav>
        </Preview>
      </StorySection>

      <StorySection index={17} title="Nav: SideNav">
        <Preview title="vertical nav rail beside content">
          <SideNav nav={<Block label="Nav" color={P.nav} w={52} h="100%" />} navWidth={52}>
            <Slab label="Content" color={P.main} grow />
          </SideNav>
        </Preview>
      </StorySection>

      <StorySection index={18} title="Nav: BottomNav">
        <Preview title="tab bar docked at floor (mobile pattern)">
          <BottomNav nav={<Slab label="Tab Bar" color={P.nav} h={36} />}>
            <Slab label="Content" color={P.main} grow />
          </BottomNav>
        </Preview>
      </StorySection>

      <StorySection index={19} title="Nav: CommandShell">
        <Preview title="persistent command slot at top (Spotlight / Raycast style)">
          <CommandShell command={<Slab label="Command" color={P.command} h={36} />}>
            <Slab label="Content" color={P.main} grow />
          </CommandShell>
        </Preview>
      </StorySection>

      <StorySection index={20} title="Nav: Drawer">
        <Preview title="side panel overlays content — open prop controls visibility">
          <Box style={{ width: '100%', height: '100%' }}>
            <Drawer
              open={drawerOpen}
              drawerWidth={110}
              drawer={<Block label="Drawer" color={P.nav} w={110} h="100%" />}
            >
              <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                <Slab label="Content behind drawer" color={P.main} h={60} />
                <Box
                  style={{ backgroundColor: P.nav, padding: 8, borderRadius: 4 }}
                  onPress={() => setDrawerOpen(v => !v)}
                >
                  <Text style={{ color: '#fff', fontSize: 10 }}>
                    {drawerOpen ? 'Close Drawer' : 'Open Drawer'}
                  </Text>
                </Box>
              </Box>
            </Drawer>
          </Box>
        </Preview>
      </StorySection>

      <StorySection index={21} title="Nav: Bookshelf">
        <Preview title="vertical tabs on edge, content beside — spines + pages">
          <Bookshelf tabs={<Block label="Tabs" color={P.nav} w={48} h="100%" />} tabsWidth={48}>
            <Slab label="Content" color={P.main} grow />
          </Bookshelf>
        </Preview>
      </StorySection>

      <StorySection index={22} title="Nav: Crumb">
        <Preview title="breadcrumb trail anchored above content">
          <Crumb trail={<Slab label="Home / Section / Page" color={P.command} h={26} />}>
            <Slab label="Content" color={P.main} grow />
          </Crumb>
        </Preview>
      </StorySection>

    </StoryPage>
  );
}
