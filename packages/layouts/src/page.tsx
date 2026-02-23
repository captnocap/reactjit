/**
 * Page Layouts
 *
 * Full-viewport structural skeletons. Drop your content in.
 * No color, no style — pure space allocation.
 *
 * Industry standards:
 *   AppShell      — header / body / footer (the classic)
 *   Holy Grail    — header / [left | main | right] / footer
 *   Centered      — content pinned to center of screen
 *
 * Unique approaches:
 *   Stage         — one primary area, a docked tray at the bottom
 *   Mosaic        — grid of equal cells, any count
 *   Pinboard      — fixed header + fixed sidebar + scrollable main
 *   Curtain       — two full-height columns, equal share by default
 */

import React from 'react';
import { Box } from '@reactjit/core';
import type { Style } from '@reactjit/core';

// ── Shared ──────────────────────────────────────────────────────────

type Children = { children?: React.ReactNode };
type OptStyle = { style?: Style };

const fill: Style = { width: '100%', height: '100%' };
const col: Style  = { ...fill, flexDirection: 'column' };
const row: Style  = { width: '100%', flexDirection: 'row' };

// ── AppShell ────────────────────────────────────────────────────────
// header — body — footer stacked vertically.
// Body grows to fill remaining space.

export interface AppShellProps extends OptStyle {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppShell({ header, footer, children, style }: AppShellProps) {
  return (
    <Box style={{ ...col, ...style }}>
      {header && <Box>{header}</Box>}
      <Box style={{ flexGrow: 1, width: '100%' }}>{children}</Box>
      {footer && <Box>{footer}</Box>}
    </Box>
  );
}

// ── HolyGrail ───────────────────────────────────────────────────────
// Classic: header / [left sidebar | main | right sidebar] / footer
// Sidebar widths are optional explicit numbers; main always flexGrow: 1.

export interface HolyGrailProps extends OptStyle {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  left?: React.ReactNode;
  leftWidth?: number;
  right?: React.ReactNode;
  rightWidth?: number;
  children?: React.ReactNode;
}

export function HolyGrail({
  header, footer, left, leftWidth, right, rightWidth, children, style,
}: HolyGrailProps) {
  return (
    <Box style={{ ...col, ...style }}>
      {header && <Box style={{ width: '100%' }}>{header}</Box>}
      <Box style={{ ...row, flexGrow: 1, alignItems: 'stretch' }}>
        {left  && <Box style={{ width: leftWidth,  height: '100%' }}>{left}</Box>}
        <Box style={{ flexGrow: 1, height: '100%' }}>{children}</Box>
        {right && <Box style={{ width: rightWidth, height: '100%' }}>{right}</Box>}
      </Box>
      {footer && <Box style={{ width: '100%' }}>{footer}</Box>}
    </Box>
  );
}

// ── Centered ────────────────────────────────────────────────────────
// Content centered in the viewport. Optional max width cap.

export interface CenteredProps extends OptStyle {
  maxWidth?: number;
  children?: React.ReactNode;
}

export function Centered({ maxWidth, children, style }: CenteredProps) {
  return (
    <Box style={{ ...col, justifyContent: 'center', alignItems: 'center', ...style }}>
      <Box style={{ flexGrow: 1, width: maxWidth ?? '100%', maxWidth }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Stage ───────────────────────────────────────────────────────────
// One dominant area fills all available space.
// A tray (bottom panel) is docked at the floor — great for player UIs,
// dashboards with a command bar, or media apps.

export interface StageProps extends OptStyle {
  tray?: React.ReactNode;
  trayHeight?: number;
  children?: React.ReactNode;
}

export function Stage({ tray, trayHeight, children, style }: StageProps) {
  return (
    <Box style={{ ...col, ...style }}>
      <Box style={{ flexGrow: 1, width: '100%' }}>{children}</Box>
      {tray && (
        <Box style={{ width: '100%', height: trayHeight }}>{tray}</Box>
      )}
    </Box>
  );
}

// ── Mosaic ──────────────────────────────────────────────────────────
// Divides the screen into N equally-sized cells in a row.
// Each child gets one cell. Useful for split-screen comparisons,
// multi-panel monitors, or tiled workspaces.

export interface MosaicProps extends OptStyle {
  columns?: number;
  gap?: number;
  children?: React.ReactNode;
}

export function Mosaic({ columns = 2, gap = 0, children, style }: MosaicProps) {
  const items = React.Children.toArray(children);
  const cols = columns || items.length || 1;

  return (
    <Box style={{ ...row, gap, ...style }}>
      {items.map((child, i) => (
        <Box key={i} style={{ flexGrow: 1, height: '100%', flexBasis: `${100 / cols}%` }}>
          {child}
        </Box>
      ))}
    </Box>
  );
}

// ── Pinboard ────────────────────────────────────────────────────────
// Fixed header + fixed sidebar + the rest is yours.
// Unlike HolyGrail, Pinboard has NO footer and the header/sidebar
// never leave — think VS Code or Figma.

export interface PinboardProps extends OptStyle {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarWidth?: number;
  sidebarSide?: 'left' | 'right';
  children?: React.ReactNode;
}

export function Pinboard({
  header, sidebar, sidebarWidth, sidebarSide = 'left', children, style,
}: PinboardProps) {
  const sidebarBox = sidebar && (
    <Box style={{ width: sidebarWidth, height: '100%' }}>{sidebar}</Box>
  );

  return (
    <Box style={{ ...col, ...style }}>
      {header && <Box style={{ width: '100%' }}>{header}</Box>}
      <Box style={{ ...row, flexGrow: 1, alignItems: 'stretch' }}>
        {sidebarSide === 'left'  && sidebarBox}
        <Box style={{ flexGrow: 1, height: '100%' }}>{children}</Box>
        {sidebarSide === 'right' && sidebarBox}
      </Box>
    </Box>
  );
}

// ── Curtain ─────────────────────────────────────────────────────────
// Two full-height panels side by side.
// Default: equal split. Pass `split` (0–1) to weight one side.
// Named after theatre curtains — two halves that open to reveal content.

export interface CurtainProps extends OptStyle {
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** 0–1 fraction of width given to the left panel. Default 0.5 */
  split?: number;
  gap?: number;
}

export function Curtain({ left, right, split = 0.5, gap = 0, style }: CurtainProps) {
  const lw = `${split * 100}%`;
  const rw = `${(1 - split) * 100}%`;
  return (
    <Box style={{ ...row, ...fill, gap, ...style }}>
      <Box style={{ width: lw, height: '100%' }}>{left}</Box>
      <Box style={{ width: rw, height: '100%' }}>{right}</Box>
    </Box>
  );
}
