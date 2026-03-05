/**
 * LayoutStory — Flex layout, spacing, and sizing documentation.
 *
 * Everything about how space is divided: flex primitives, grid, responsive
 * breakpoints, and composed layout patterns from @reactjit/layouts.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, Image, TextEditor, CodeBlock, Pressable, ScrollView, Row, Col } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// layouts package
import {
  AppShell, HolyGrail, Centered, Stage, Mosaic, Pinboard, Curtain,
  Stack, Cluster, Sidebar, Shelf, Keystone, Frame, Ladder, Reel,
  TopNav, SideNav, BottomNav, CommandShell, Drawer, Bookshelf, Crumb,
} from '../../../packages/layouts/src';

// ── Syntax colors ────────────────────────────────────────

const SYN = {
  tag: '#f38ba8',
  component: '#89b4fa',
  prop: '#cba6f7',
  value: '#f9e2af',
};

// ── Helpers ──────────────────────────────────────────────

function styleTooltip(style: Record<string, any>): { content: string; layout: string; type: string } | undefined {
  const STRUCTURAL = new Set([
    'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'flexWrap',
    'alignItems', 'alignSelf', 'justifyContent', 'overflow',
    'position', 'zIndex', 'display',
  ]);
  const entries = Object.entries(style).filter(([k, v]) => !STRUCTURAL.has(k) && v !== undefined);
  if (entries.length === 0) return undefined;
  const content = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { content, layout: 'table', type: 'cursor' };
}

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

function Chip({ label, color, size = 36 }: { label: string; color: string; size?: number }) {
  return (
    <Box style={{
      width: size, height: size, backgroundColor: color,
      borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

function Bar({ label, width, color }: { label: string; width: number; color: string }) {
  return (
    <Box style={{
      width, height: 26, backgroundColor: color,
      borderRadius: 5, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

// ── Static data (hoisted — never recreated) ──────────────

const USAGE_CODE = `import { Box, Text, Row, Col } from '@reactjit/core';

// Auto-size to children
<Box style={{ gap: 8 }}>
  <Text>{'Header'}</Text>
  <Text>{'Body'}</Text>
</Box>

// Flex row — distribute space
<Box style={{ flexDirection: 'row', gap: 8 }}>
  <Text>{'Left'}</Text>
  <Box style={{ flexGrow: 1 }} />
  <Text>{'Right'}</Text>
</Box>

// 12-column grid
<Row gap={8} style={{ flexWrap: 'wrap' }}>
  <Col span={4}><Text>{'1/3'}</Text></Col>
  <Col span={4}><Text>{'1/3'}</Text></Col>
  <Col span={4}><Text>{'1/3'}</Text></Col>
</Row>

// Semantic spans
<Row gap={8}>
  <Col span="third"><Text>{'Sidebar'}</Text></Col>
  <Col span="two-thirds"><Text>{'Content'}</Text></Col>
</Row>`;

const STARTER_CODE = `<Box style={{
  gap: 12,
  padding: 16,
  backgroundColor: '#f3f4f6',
  borderRadius: 8,
}}>
  <Text>{'Container with children'}</Text>
  <Text style={{ fontSize: 12, color: '#666' }}>
    {'Edit to see live layout changes.'}
  </Text>
</Box>`;

// Props — [name, type, icon]
const PROPS: [string, string, string][] = [
  ['padding / px / py', 'number', 'move'],
  ['gap', 'number', 'minimize-2'],
  ['flexDirection', "'row' | 'column'", 'arrow-right'],
  ['justifyContent', "'start' | 'center' | 'end' | 'space-between'", 'align-horizontal-justify-center'],
  ['alignItems', "'start' | 'center' | 'end'", 'align-vertical-justify-center'],
  ['width / height', 'number | string', 'ruler'],
  ['flexGrow', 'number', 'maximize-2'],
  ['flexShrink', 'number', 'minimize-2'],
  ['aspectRatio', 'number', 'ratio'],
  ['flexWrap', "'wrap' | 'nowrap'", 'wrap-text'],
  ['span', "number | SemanticSpan", 'columns'],
  ['sm / md / lg / xl', 'SpanValue', 'smartphone'],
  ['responsive', 'boolean', 'monitor'],
];

const LAYOUTS_USAGE_CODE = `import {
  AppShell, HolyGrail, Centered, Stage,
  Stack, Cluster, Sidebar, Shelf, Frame,
  TopNav, SideNav, Drawer,
} from '@reactjit/layouts';

// Classic app skeleton
<AppShell
  header={<Header />}
  footer={<Footer />}
>
  <MainContent />
</AppShell>

// Sidebar + content inside a panel
<Sidebar sideWidth={200} gap={8}>
  <NavList />
  <Content />
</Sidebar>

// Wrapping tag group
<Cluster gap={6}>
  <Badge>{'React'}</Badge>
  <Badge>{'Lua'}</Badge>
  <Badge>{'OpenGL'}</Badge>
</Cluster>

// Sliding drawer overlay
<Drawer open={isOpen} drawerWidth={240}
  drawer={<Menu />}>
  <Page />
</Drawer>`;

// Layouts package — [component, category, description, key props]
const LAYOUT_COMPONENTS: [string, string, string, string][] = [
  ['AppShell', 'Page', 'header / body / footer', 'header, footer'],
  ['HolyGrail', 'Page', 'header / [left | main | right] / footer', 'header, footer, left, right, leftWidth, rightWidth'],
  ['Centered', 'Page', 'content pinned to center', 'maxWidth'],
  ['Stage', 'Page', 'dominant area + docked tray', 'tray, trayHeight'],
  ['Mosaic', 'Page', 'N equal columns', 'columns, gap'],
  ['Pinboard', 'Page', 'header + sidebar, no footer (VS Code)', 'header, sidebar, sidebarWidth, sidebarSide'],
  ['Curtain', 'Page', 'two full-height panels, weighted split', 'left, right, split, gap'],
  ['Stack', 'Container', 'vertical list with gap', 'gap'],
  ['Cluster', 'Container', 'wrapping horizontal group', 'gap, justify, align'],
  ['Sidebar', 'Container', 'fixed side + flexible content', 'side, sideWidth, gap'],
  ['Shelf', 'Container', 'single non-wrapping row', 'gap, align, justify'],
  ['Keystone', 'Container', 'hero child + supporting items below', 'heroRatio, gap'],
  ['Frame', 'Container', 'uniform inset, content centered', 'padding'],
  ['Ladder', 'Container', 'items alternate left / right', 'gap'],
  ['Reel', 'Container', 'horizontal scroll strip', 'itemWidth, gap'],
  ['TopNav', 'Nav', 'horizontal bar at top', 'nav'],
  ['SideNav', 'Nav', 'vertical rail beside content', 'nav, navWidth, side'],
  ['BottomNav', 'Nav', 'tab bar at floor', 'nav'],
  ['CommandShell', 'Nav', 'persistent command slot at top', 'command'],
  ['Drawer', 'Nav', 'side panel overlays content', 'drawer, drawerWidth, side, open'],
  ['Bookshelf', 'Nav', 'vertical tabs + content beside', 'tabs, tabsWidth, side'],
  ['Crumb', 'Nav', 'breadcrumb trail above content', 'trail'],
];

const LAYOUTS_BEHAVIOR_NOTES = [
  'All layout components are pure space allocation — no color, no style applied.',
  'Every layout accepts a style prop to override or extend the root container.',
  'Page layouts fill their parent (width: 100%, height: 100%) by default.',
  'Container layouts fill width but auto-size height from content.',
  'Drawer uses position: absolute — content behind is always full size.',
  'Keystone\'s heroRatio (0-1) controls how much vertical space the first child gets.',
  'Curtain\'s split (0-1) controls the left/right width ratio. Default 0.5.',
  'Reel wraps children in a horizontal ScrollView with fixed item widths.',
];

const BEHAVIOR_NOTES = [
  'Containers auto-size to fit their children by default.',
  'Use flexGrow: 1 to make an element absorb remaining space in its flex container.',
  'justifyContent controls distribution along the main axis (horizontal in row, vertical in column).',
  'alignItems controls positioning along the cross axis.',
  'Empty surfaces (no children, no explicit size) get 1/4 of parent size as fallback.',
  'flexShrink: 0 prevents an element from shrinking when space is constrained.',
  'Row + Col provide a 12-column grid. Col span={6} = half width. Gap is auto-subtracted from flex basis.',
  "Semantic spans: 'half', 'third', 'quarter', 'two-thirds', 'three-quarters' map to 6, 4, 3, 8, 9 columns.",
  'The responsive flag auto-sets sm=12, md=6, lg=4, xl=3. Override individual breakpoints as needed.',
];

// Palette (hoisted)
const P = {
  red: '#ef4444', orange: '#f97316', amber: '#eab308',
  green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
};

// ── Patterns tab palette & helpers ───────────────────────
const LP = {
  nav: '#4f46e5', header: '#0891b2', footer: '#be185d',
  sidebar: '#7c3aed', main: '#1d4ed8', left: '#7c3aed',
  right: '#059669', tray: '#dc2626', a: '#f97316',
  b: '#16a34a', c2: '#2563eb', d: '#9333ea',
  e: '#db2777', command: '#0f766e',
};

function Slab({ label, color, h, grow = false }: { label: string; color: string; h?: number; grow?: boolean }) {
  return (
    <Box style={{
      width: '100%', height: h, flexGrow: grow ? 1 : 0,
      backgroundColor: color, justifyContent: 'center', alignItems: 'center',
      minHeight: h ?? 24,
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function Block({ label, color, w, h, grow = false }: { label: string; color: string; w?: number | string; h?: number | string; grow?: boolean }) {
  return (
    <Box style={{
      width: w, height: h, flexGrow: grow ? 1 : 0,
      backgroundColor: color, justifyContent: 'center', alignItems: 'center',
      minWidth: 20, minHeight: 20,
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function PatternPreview({ children, title }: { children: React.ReactNode; title: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textSecondary, fontSize: 10 }}>{title}</Text>
      <Box style={{
        width: 300, height: 200, backgroundColor: c.surface,
        borderRadius: 6, overflow: 'hidden',
      }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Component ────────────────────────────────────────────

export function LayoutStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const processCode = useCallback((src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  useEffect(() => {
    if (playground && code && !UserComponent) {
      processCode(code);
    }
  }, [playground]);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    processCode(src);
  }, [processCode]);

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
        <Image src="box" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Layout'}
        </Text>

        <Box style={{
          flexDirection: 'row',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'{'}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'flexDirection'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{': '}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'row'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{' }'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Flex layout, spacing, sizing, and composed patterns.'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {playground ? (
          <>
            <Box style={{ flexGrow: 1, flexBasis: 0 }}>
              <TextEditor
                initialValue={code}
                onChange={handleCodeChange}
                onBlur={handleCodeChange}
                onSubmit={handleCodeChange}
                changeDelay={3}
                syntaxHighlight
                placeholder="Write JSX here..."
                style={{ flexGrow: 1, width: '100%' }}
                textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
              />
            </Box>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Preview ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 16 }}>

                {/* SPACING */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SPACING'}</Text>
                <Box style={{ gap: 8, width: '100%' }}>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 16, width: '100%', alignItems: 'center' }}>
                    <Box bg={P.blue} style={{ height: 28, width: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 5 }} tooltip={styleTooltip({ backgroundColor: P.blue, borderRadius: 5 })}>
                      <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'padding: 16'}</Text>
                    </Box>
                  </Box>
                  <Box style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
                    {(['A', 'B', 'C'] as const).map(label => <Chip key={label} label={label} color={P.orange} size={32} />)}
                  </Box>
                </Box>

                {/* FLEX DIRECTION */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FLEX DIRECTION'}</Text>
                <Box style={{ gap: 6, width: '100%' }}>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%' }}>
                    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <Chip label="A" color={P.red} size={28} />
                      <Chip label="B" color={P.orange} size={28} />
                      <Chip label="C" color={P.amber} size={28} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 7, marginTop: 4 }}>{'row'}</Text>
                  </Box>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%', alignItems: 'center' }}>
                    <Box style={{ flexDirection: 'column', gap: 4, width: '100%', alignItems: 'center' }}>
                      <Chip label="A" color={P.green} size={28} />
                      <Chip label="B" color={P.teal} size={28} />
                      <Chip label="C" color={P.cyan} size={28} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 7, marginTop: 4 }}>{'column'}</Text>
                  </Box>
                </Box>

                {/* JUSTIFY CONTENT */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'JUSTIFY CONTENT'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  {(['start', 'center', 'space-between'] as const).map(justify => (
                    <Box key={justify} style={{ gap: 2 }}>
                      <Box style={{
                        backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%',
                        flexDirection: 'row', justifyContent: justify,
                      }}>
                        <Chip label="A" color={P.blue} size={24} />
                        <Chip label="B" color={P.indigo} size={24} />
                      </Box>
                      <Text style={{ color: c.muted, fontSize: 7 }}>{justify}</Text>
                    </Box>
                  ))}
                </Box>

                {/* ALIGN ITEMS */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'ALIGN ITEMS'}</Text>
                <Box style={{ flexDirection: 'row', gap: 4, width: '100%', justifyContent: 'center' }}>
                  {(['start', 'center', 'end'] as const).map(align => (
                    <Box key={align} style={{
                      flexGrow: 1, height: 60, backgroundColor: c.surface,
                      borderRadius: 6, padding: 4, gap: 2, alignItems: align,
                    }}>
                      <Bar label="Short" width={36} color={P.violet} />
                      <Bar label="Long" width={52} color={P.blue} />
                      <Text style={{ color: c.muted, fontSize: 6, marginTop: 2 }}>{align}</Text>
                    </Box>
                  ))}
                </Box>

                {/* SIZING */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SIZING'}</Text>
                <Box style={{ gap: 6, width: '100%' }}>
                  <Box style={{ width: '100%', alignItems: 'center' }}>
                    <Box style={{ width: 140, height: 50, backgroundColor: P.blue, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ width: 140, height: 50, backgroundColor: P.blue, borderRadius: 6 })}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'fixed: 140x50'}</Text>
                    </Box>
                  </Box>
                  <Box style={{ width: '100%', flexDirection: 'row', gap: 4, height: 40, justifyContent: 'center' }}>
                    <Box style={{ width: 50, height: 40, backgroundColor: P.red, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'50'}</Text>
                    </Box>
                    <Box style={{ flexGrow: 1, backgroundColor: P.green, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ flexGrow: 1, backgroundColor: P.green, borderRadius: 4 })}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'grow'}</Text>
                    </Box>
                    <Box style={{ width: 50, height: 40, backgroundColor: P.orange, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'50'}</Text>
                    </Box>
                  </Box>
                </Box>

                {/* FLEX WRAP */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FLEX WRAP'}</Text>
                <Box style={{
                  flexDirection: 'row', flexWrap: 'wrap', gap: 4,
                  backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%',
                  justifyContent: 'center',
                }}>
                  {[P.red, P.orange, P.amber, P.green, P.teal, P.cyan, P.blue, P.indigo].map((color, i) => (
                    <Chip key={i} label={`${i + 1}`} color={color} size={28} />
                  ))}
                </Box>

                {/* FLEX SHRINK */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FLEX SHRINK'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  <Box style={{ width: 200, flexDirection: 'row', gap: 2, backgroundColor: c.surface, borderRadius: 6, padding: 4, justifyContent: 'center' }}>
                    <Box style={{ width: 80, height: 24, backgroundColor: P.blue, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'Default'}</Text>
                    </Box>
                    <Box style={{ width: 80, height: 24, backgroundColor: P.indigo, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'Shrinks'}</Text>
                    </Box>
                    <Box style={{ width: 80, height: 24, backgroundColor: P.violet, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'Shrinks'}</Text>
                    </Box>
                  </Box>
                  <Text style={{ color: c.muted, fontSize: 7 }}>{'Items shrink equally'}</Text>
                </Box>

                {/* ASPECT RATIO */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'ASPECT RATIO'}</Text>
                <Box style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
                  <Box style={{ width: 50, aspectRatio: 1, backgroundColor: P.violet, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ width: 50, aspectRatio: 1, backgroundColor: P.violet, borderRadius: 6 })}>
                    <Text style={{ color: '#fff', fontSize: 7 }}>{'1:1'}</Text>
                  </Box>
                  <Box style={{ width: 80, aspectRatio: 16 / 9, backgroundColor: P.blue, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ width: 80, aspectRatio: 16 / 9, backgroundColor: P.blue, borderRadius: 6 })}>
                    <Text style={{ color: '#fff', fontSize: 7 }}>{'16:9'}</Text>
                  </Box>
                  <Box style={{ height: 30, aspectRatio: 2, backgroundColor: P.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ height: 30, aspectRatio: 2, backgroundColor: P.green, borderRadius: 6 })}>
                    <Text style={{ color: '#fff', fontSize: 7 }}>{'2:1'}</Text>
                  </Box>
                </Box>

                {/* 12-COLUMN GRID */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'12-COLUMN GRID'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  {/* 4+4+4 = thirds */}
                  <Row gap={4} style={{ flexWrap: 'wrap', width: '100%' }}>
                    {[4, 4, 4].map((s, i) => (
                      <Col key={i} span={s} style={{ height: 28, backgroundColor: P.blue, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}
                        tooltip={{ content: `span: ${s}\nflexBasis: ${((s / 12) * 100).toFixed(1)}%`, layout: 'table', type: 'cursor' }}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{`${s}`}</Text>
                      </Col>
                    ))}
                  </Row>
                  {/* 6+6 = halves */}
                  <Row gap={4} style={{ flexWrap: 'wrap', width: '100%' }}>
                    {[6, 6].map((s, i) => (
                      <Col key={i} span={s} style={{ height: 28, backgroundColor: P.indigo, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}
                        tooltip={{ content: `span: ${s}\nflexBasis: 50%`, layout: 'table', type: 'cursor' }}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{`${s}`}</Text>
                      </Col>
                    ))}
                  </Row>
                  {/* 3+9 = sidebar + content */}
                  <Row gap={4} style={{ flexWrap: 'wrap', width: '100%' }}>
                    <Col span={3} style={{ height: 28, backgroundColor: P.teal, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}
                      tooltip={{ content: 'span: 3\nflexBasis: 25%', layout: 'table', type: 'cursor' }}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'3'}</Text>
                    </Col>
                    <Col span={9} style={{ height: 28, backgroundColor: P.cyan, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}
                      tooltip={{ content: 'span: 9\nflexBasis: 75%', layout: 'table', type: 'cursor' }}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'9'}</Text>
                    </Col>
                  </Row>
                </Box>

                {/* SEMANTIC SPANS */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SEMANTIC SPANS'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  {/* half + half */}
                  <Row gap={4} style={{ width: '100%' }}>
                    <Col span="half" style={{ height: 28, backgroundColor: P.violet, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'half'}</Text>
                    </Col>
                    <Col span="half" style={{ height: 28, backgroundColor: P.violet, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'half'}</Text>
                    </Col>
                  </Row>
                  {/* third + two-thirds */}
                  <Row gap={4} style={{ width: '100%' }}>
                    <Col span="third" style={{ height: 28, backgroundColor: P.orange, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'third'}</Text>
                    </Col>
                    <Col span="two-thirds" style={{ height: 28, backgroundColor: P.amber, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'two-thirds'}</Text>
                    </Col>
                  </Row>
                  {/* quarter + three-quarters */}
                  <Row gap={4} style={{ width: '100%' }}>
                    <Col span="quarter" style={{ height: 28, backgroundColor: P.red, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'quarter'}</Text>
                    </Col>
                    <Col span="three-quarters" style={{ height: 28, backgroundColor: P.green, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'three-quarters'}</Text>
                    </Col>
                  </Row>
                </Box>

                {/* RESPONSIVE BREAKPOINTS */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'RESPONSIVE BREAKPOINTS'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  {([
                    ['sm', '\u22650px', 1, P.red],
                    ['md', '\u2265640px', 2, P.orange],
                    ['lg', '\u22651024px', 3, P.blue],
                    ['xl', '\u22651440px', 4, P.green],
                  ] as const).map(([bp, thresh, cols, color]) => (
                    <Box key={bp} style={{ gap: 2 }}>
                      <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                        <Text style={{ color: c.muted, fontSize: 7, fontWeight: 'bold' }}>{bp}</Text>
                        <Text style={{ color: c.muted, fontSize: 6 }}>{thresh}</Text>
                      </Box>
                      <Box style={{ flexDirection: 'row', gap: 2, width: '100%' }}>
                        {Array.from({ length: cols }, (_, i) => (
                          <Box key={i} style={{
                            flexGrow: 1, height: 20, backgroundColor: color,
                            borderRadius: 3, justifyContent: 'center', alignItems: 'center',
                          }}>
                            <Text style={{ color: '#fff', fontSize: 6 }}>{`${12 / cols}`}</Text>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>

                {/* ── LAYOUT PATTERNS (@reactjit/layouts) ── */}

                <Box style={{ height: 1, backgroundColor: c.border, marginTop: 8 }} />

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'PAGE LAYOUTS'}</Text>
                <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <PatternPreview title="AppShell — header / body / footer">
                    <AppShell
                      header={<Slab label="Header" color={LP.header} h={28} />}
                      footer={<Slab label="Footer" color={LP.footer} h={24} />}
                    >
                      <Slab label="Content" color={LP.main} grow />
                    </AppShell>
                  </PatternPreview>

                  <PatternPreview title="HolyGrail — header / [left | main | right] / footer">
                    <HolyGrail
                      header={<Slab label="Header" color={LP.header} h={24} />}
                      footer={<Slab label="Footer" color={LP.footer} h={20} />}
                      left={<Block label="Left" color={LP.left} w={54} h="100%" />}
                      right={<Block label="Right" color={LP.right} w={48} h="100%" />}
                    >
                      <Block label="Main" color={LP.main} w="100%" h="100%" grow />
                    </HolyGrail>
                  </PatternPreview>

                  <PatternPreview title="Centered — content pinned to center">
                    <Centered maxWidth={200}>
                      <Slab label="Centered Content" color={LP.main} h={80} />
                    </Centered>
                  </PatternPreview>

                  <PatternPreview title="Stage — dominant area + docked tray">
                    <Stage tray={<Slab label="Tray" color={LP.tray} h={36} />}>
                      <Slab label="Stage" color={LP.main} grow />
                    </Stage>
                  </PatternPreview>

                  <PatternPreview title="Mosaic — N equal columns">
                    <Mosaic columns={3} gap={4}>
                      <Block label="A" color={LP.a} w="100%" h="100%" />
                      <Block label="B" color={LP.b} w="100%" h="100%" />
                      <Block label="C" color={LP.c2} w="100%" h="100%" />
                    </Mosaic>
                  </PatternPreview>

                  <PatternPreview title="Pinboard — header + sidebar, no footer">
                    <Pinboard
                      header={<Slab label="Header" color={LP.header} h={26} />}
                      sidebar={<Block label="Sidebar" color={LP.sidebar} w={52} h="100%" />}
                      sidebarWidth={52}
                    >
                      <Block label="Canvas" color={LP.main} w="100%" h="100%" />
                    </Pinboard>
                  </PatternPreview>

                  <PatternPreview title="Curtain — two full-height panels, weighted">
                    <Curtain
                      split={0.4}
                      left={<Block label="Left 40%" color={LP.left} w="100%" h="100%" />}
                      right={<Block label="Right 60%" color={LP.right} w="100%" h="100%" />}
                    />
                  </PatternPreview>
                </Box>

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'CONTAINER LAYOUTS'}</Text>
                <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <PatternPreview title="Stack — vertical list with gap">
                    <Frame padding={12}>
                      <Stack gap={6}>
                        <Slab label="Item 1" color={LP.a} h={36} />
                        <Slab label="Item 2" color={LP.b} h={36} />
                        <Slab label="Item 3" color={LP.c2} h={36} />
                      </Stack>
                    </Frame>
                  </PatternPreview>

                  <PatternPreview title="Cluster — wrapping horizontal group">
                    <Frame padding={12}>
                      <Cluster gap={6}>
                        {['React', 'TypeScript', 'Lua', 'SDL2', 'OpenGL', 'LuaJIT', 'QuickJS', 'esbuild'].map((tag, i) => (
                          <Block key={tag} label={tag} color={[LP.a, LP.b, LP.c2, LP.d, LP.e, LP.nav, LP.sidebar, LP.main][i % 8]} h={22} w={tag.length * 7 + 16} />
                        ))}
                      </Cluster>
                    </Frame>
                  </PatternPreview>

                  <PatternPreview title="Sidebar — fixed side + flexible content">
                    <Frame padding={12}>
                      <Sidebar sideWidth={70} gap={8}>
                        <Block label="Side" color={LP.sidebar} w={70} h={120} />
                        <Block label="Content" color={LP.main} w="100%" h={120} />
                      </Sidebar>
                    </Frame>
                  </PatternPreview>

                  <PatternPreview title="Shelf — single non-wrapping row">
                    <Frame padding={12}>
                      <Shelf gap={8} justify="space-between">
                        <Block label="File" color={LP.a} w={48} h={28} />
                        <Block label="Edit" color={LP.b} w={48} h={28} />
                        <Block label="View" color={LP.c2} w={48} h={28} />
                        <Block label="Help" color={LP.d} w={48} h={28} />
                      </Shelf>
                    </Frame>
                  </PatternPreview>

                  <PatternPreview title="Keystone — hero child + shared bottom">
                    <Keystone heroRatio={0.6} gap={6} style={{ padding: 10, height: 180 }}>
                      <Block label="Hero" color={LP.main} w="100%" h="100%" />
                      <Block label="A" color={LP.a} w="100%" h="100%" />
                      <Block label="B" color={LP.b} w="100%" h="100%" />
                      <Block label="C" color={LP.c2} w="100%" h="100%" />
                    </Keystone>
                  </PatternPreview>

                  <PatternPreview title="Frame — uniform inset, content centered">
                    <Frame padding={32}>
                      <Slab label="Content" color={LP.main} h={80} />
                    </Frame>
                  </PatternPreview>

                  <PatternPreview title="Ladder — items alternate left / right">
                    <Frame padding={12}>
                      <Ladder gap={6}>
                        <Block label="Step 1" color={LP.a} w={100} h={28} />
                        <Block label="Step 2" color={LP.b} w={100} h={28} />
                        <Block label="Step 3" color={LP.c2} w={100} h={28} />
                        <Block label="Step 4" color={LP.d} w={100} h={28} />
                      </Ladder>
                    </Frame>
                  </PatternPreview>

                  <PatternPreview title="Reel — horizontal scroll strip">
                    <Frame padding={12}>
                      <Reel itemWidth={80} gap={8} style={{ height: 60 }}>
                        {[LP.a, LP.b, LP.c2, LP.d, LP.e, LP.nav, LP.sidebar].map((color, i) => (
                          <Block key={i} label={`Card ${i + 1}`} color={color} w={80} h={60} />
                        ))}
                      </Reel>
                    </Frame>
                  </PatternPreview>
                </Box>

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'NAV LAYOUTS'}</Text>
                <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <PatternPreview title="TopNav — horizontal bar at top">
                    <TopNav nav={<Slab label="Nav Bar" color={LP.nav} h={32} />}>
                      <Slab label="Content" color={LP.main} grow />
                    </TopNav>
                  </PatternPreview>

                  <PatternPreview title="SideNav — vertical rail beside content">
                    <SideNav nav={<Block label="Nav" color={LP.nav} w={52} h="100%" />} navWidth={52}>
                      <Slab label="Content" color={LP.main} grow />
                    </SideNav>
                  </PatternPreview>

                  <PatternPreview title="BottomNav — tab bar at floor">
                    <BottomNav nav={<Slab label="Tab Bar" color={LP.nav} h={36} />}>
                      <Slab label="Content" color={LP.main} grow />
                    </BottomNav>
                  </PatternPreview>

                  <PatternPreview title="CommandShell — persistent command slot at top">
                    <CommandShell command={<Slab label="Command" color={LP.command} h={36} />}>
                      <Slab label="Content" color={LP.main} grow />
                    </CommandShell>
                  </PatternPreview>

                  <PatternPreview title="Drawer — side panel overlays content">
                    <Box style={{ width: '100%', height: '100%' }}>
                      <Drawer
                        open={drawerOpen}
                        drawerWidth={110}
                        drawer={<Block label="Drawer" color={LP.nav} w={110} h="100%" />}
                      >
                        <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                          <Slab label="Content behind drawer" color={LP.main} h={60} />
                          <Pressable
                            style={{ backgroundColor: LP.nav, padding: 8, borderRadius: 4 }}
                            onPress={() => setDrawerOpen((v: boolean) => !v)}
                          >
                            <Text style={{ color: '#fff', fontSize: 10 }}>
                              {drawerOpen ? 'Close Drawer' : 'Open Drawer'}
                            </Text>
                          </Pressable>
                        </Box>
                      </Drawer>
                    </Box>
                  </PatternPreview>

                  <PatternPreview title="Bookshelf — vertical tabs + content">
                    <Bookshelf tabs={<Block label="Tabs" color={LP.nav} w={48} h="100%" />} tabsWidth={48}>
                      <Slab label="Content" color={LP.main} grow />
                    </Bookshelf>
                  </PatternPreview>

                  <PatternPreview title="Crumb — breadcrumb trail above content">
                    <Crumb trail={<Slab label="Home / Section / Page" color={LP.command} h={26} />}>
                      <Slab label="Content" color={LP.main} grow />
                    </Crumb>
                  </PatternPreview>
                </Box>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* Overview */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Layout in ReactJIT uses Flex. Containers auto-size to their children by default. Use flexGrow to distribute space, gap for spacing between children, and justifyContent/alignItems to position them. The engine is pixel-perfect — if something looks wrong, check the component\'s explicit dimensions, not the layout math.'}
                </Text>

                <HorizontalDivider />

                {/* Usage */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'USAGE'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* Behavior */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </Text>
                <Box style={{ gap: 4 }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Props */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'LAYOUT PROPERTIES'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {PROPS.map(([name, type, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── @reactjit/layouts ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'@REACTJIT/LAYOUTS'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'22 composed layout components in three categories: page skeletons (full-viewport), container patterns (inner regions), and nav layouts (built-in navigation slots). All are pure space allocation — no color, no theming. Import from @reactjit/layouts.'}
                </Text>

                <HorizontalDivider />

                {/* Layouts Usage */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'LAYOUTS USAGE'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={LAYOUTS_USAGE_CODE} />

                <HorizontalDivider />

                {/* Layouts Behavior */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'LAYOUTS BEHAVIOR'}
                </Text>
                <Box style={{ gap: 4 }}>
                  {LAYOUTS_BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Component Reference */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'COMPONENT REFERENCE'}
                </Text>
                {(['Page', 'Container', 'Nav'] as const).map(category => (
                  <Box key={category} style={{ gap: 4, marginBottom: 6 }}>
                    <Text style={{ color: SYN.component, fontSize: 9, fontWeight: 'bold' }}>{category}</Text>
                    {LAYOUT_COMPONENTS.filter(([, cat]) => cat === category).map(([name, , desc, props]) => (
                      <Box key={name} style={{ gap: 1, paddingLeft: 8 }}>
                        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                          <Text style={{ color: SYN.tag, fontSize: 9 }}>{'<'}</Text>
                          <Text style={{ color: SYN.component, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                          <Text style={{ color: SYN.tag, fontSize: 9 }}>{' />'}</Text>
                          <Text style={{ color: c.muted, fontSize: 8 }}>{desc}</Text>
                        </Box>
                        <Text style={{ color: c.muted, fontSize: 8, paddingLeft: 12 }}>{props}</Text>
                      </Box>
                    ))}
                  </Box>
                ))}

              </Box>
            </ScrollView>
          </>
        )}
      </Box>

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
        <Image src="layout" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Layout'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
            onPress={() => setPlayground(p => !p)}
            style={(state) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 3,
              paddingBottom: 3,
              borderRadius: 4,
            })}
          >
            <Image
              src={playground ? 'book-open' : 'play'}
              style={{ width: 10, height: 10 }}
              tintColor={playground ? 'white' : c.text}
            />
            <Text style={{
              color: playground ? 'white' : c.text,
              fontSize: 9,
              fontWeight: 'bold',
            }}>
              {playground ? 'Exit Playground' : 'Playground'}
            </Text>
          </Pressable>

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
