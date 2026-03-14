/**
 * Container Layouts
 *
 * Inner-region arrangement for sections, cards, and panels.
 * No color, no style — pure space allocation.
 *
 * Industry standards:
 *   Stack         — vertical list of items with consistent gap
 *   Cluster       — horizontal wrapping group (badges, chips, tags)
 *   Sidebar       — [sidebar | content] row inside a container
 *
 * Unique approaches:
 *   Shelf         — a row that clips to one line, no wrap
 *   Keystone      — one hero item + supporting items below
 *   Frame         — equal padding on all sides, content centered
 *   Ladder        — items alternate left/right (step pattern)
 *   Reel          — horizontal scroll strip with fixed item sizes
 */

import React from 'react';
import { Box, ScrollView } from '@reactjit/core';
import type { Style } from '@reactjit/core';

type OptStyle = { style?: Style };

// ── Stack ────────────────────────────────────────────────────────────
// Vertical list of items with a uniform gap.
// The most common inner-container pattern.

export interface StackProps extends OptStyle {
  gap?: number;
  children?: React.ReactNode;
}

export function Stack({ gap = 0, children, style }: StackProps) {
  return (
    <Box style={{ flexDirection: 'column', width: '100%', gap, ...style }}>
      {children}
    </Box>
  );
}

// ── Cluster ──────────────────────────────────────────────────────────
// Horizontal wrapping group. Items sit in a row and wrap to the next
// line when they run out of space. Classic for tag/badge groups.

export interface ClusterProps extends OptStyle {
  gap?: number;
  justify?: Style['justifyContent'];
  align?: Style['alignItems'];
  children?: React.ReactNode;
}

export function Cluster({
  gap = 0, justify = 'start', align = 'center', children, style,
}: ClusterProps) {
  return (
    <Box style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap,
      justifyContent: justify,
      alignItems: align,
      width: '100%',
      ...style,
    }}>
      {children}
    </Box>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────
// A fixed-width sidebar beside a flexible content area, within a container.
// Use HolyGrail/Pinboard for page-level variants.

export interface SidebarProps extends OptStyle {
  side?: 'left' | 'right';
  sideWidth?: number;
  gap?: number;
  children?: [React.ReactNode, React.ReactNode];
}

export function Sidebar({ side = 'left', sideWidth, gap = 0, children, style }: SidebarProps) {
  const [a, b] = React.Children.toArray(children ?? []);
  const sideBox  = <Box style={{ width: sideWidth }}>{a}</Box>;
  const mainBox  = <Box style={{ flexGrow: 1 }}>{b}</Box>;

  return (
    <Box style={{ flexDirection: 'row', width: '100%', gap, alignItems: 'stretch', ...style }}>
      {side === 'left'  ? <>{sideBox}{mainBox}</> : <>{mainBox}{sideBox}</>}
    </Box>
  );
}

// ── Shelf ────────────────────────────────────────────────────────────
// A single horizontal row that never wraps. Items are evenly spaced.
// Good for toolbars, icon rows, stat ribbons.

export interface ShelfProps extends OptStyle {
  gap?: number;
  align?: Style['alignItems'];
  justify?: Style['justifyContent'];
  children?: React.ReactNode;
}

export function Shelf({ gap = 0, align = 'center', justify = 'start', children, style }: ShelfProps) {
  return (
    <Box style={{
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: align,
      justifyContent: justify,
      width: '100%',
      gap,
      ...style,
    }}>
      {children}
    </Box>
  );
}

// ── Keystone ─────────────────────────────────────────────────────────
// First child is the hero — it gets the majority of vertical space.
// Remaining children share the bottom area equally.
// Named after the central wedge of an arch that holds everything up.

export interface KeystoneProps extends OptStyle {
  /** 0–1 fraction of height given to the first (hero) child. Default 0.65 */
  heroRatio?: number;
  gap?: number;
  children?: React.ReactNode;
}

export function Keystone({ heroRatio = 0.65, gap = 0, children, style }: KeystoneProps) {
  const items = React.Children.toArray(children);
  const [hero, ...rest] = items;

  return (
    <Box style={{ flexDirection: 'column', width: '100%', height: '100%', gap, ...style }}>
      <Box style={{ width: '100%', flexBasis: `${heroRatio * 100}%`, flexShrink: 0 }}>
        {hero}
      </Box>
      {rest.length > 0 && (
        <Box style={{ flexGrow: 1, flexDirection: 'row', gap, width: '100%' }}>
          {rest.map((child, i) => (
            <Box key={i} style={{ flexGrow: 1 }}>{child}</Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Frame ────────────────────────────────────────────────────────────
// Uniform inset on all sides. Content is centered inside.
// Use it to give breathing room to any content block.

export interface FrameProps extends OptStyle {
  padding?: number;
  children?: React.ReactNode;
}

export function Frame({ padding = 16, children, style }: FrameProps) {
  return (
    <Box style={{ padding, width: '100%', ...style }}>
      {children}
    </Box>
  );
}

// ── Ladder ───────────────────────────────────────────────────────────
// Items alternate alignment left / right on each row.
// First child: left-aligned. Second: right-aligned. Third: left. Etc.
// Classic "timeline" or "zigzag feature list" pattern.

export interface LadderProps extends OptStyle {
  gap?: number;
  children?: React.ReactNode;
}

export function Ladder({ gap = 0, children, style }: LadderProps) {
  const items = React.Children.toArray(children);
  return (
    <Box style={{ flexDirection: 'column', width: '100%', gap, ...style }}>
      {items.map((child, i) => (
        <Box key={i} style={{
          flexDirection: 'row',
          width: '100%',
          justifyContent: i % 2 === 0 ? 'start' : 'end',
        }}>
          {child}
        </Box>
      ))}
    </Box>
  );
}

// ── Reel ─────────────────────────────────────────────────────────────
// A horizontal scrolling strip. All items share the same fixed width.
// Use for media carousels, card rows, horizontal feeds.

export interface ReelProps extends OptStyle {
  itemWidth?: number;
  gap?: number;
  children?: React.ReactNode;
}

export function Reel({ itemWidth, gap = 0, children, style }: ReelProps) {
  const items = React.Children.toArray(children);
  return (
    <ScrollView style={{ width: '100%', ...style }} horizontal>
      <Box style={{ flexDirection: 'row', gap }}>
        {items.map((child, i) => (
          <Box key={i} style={{ width: itemWidth, flexShrink: 0 }}>
            {child}
          </Box>
        ))}
      </Box>
    </ScrollView>
  );
}
