/**
 * Nav Layouts
 *
 * Layouts that have a built-in navigation region.
 * The layout owns the nav slot; you supply the items and the content.
 * No color, no style — pure space allocation + navigation structure.
 *
 * Industry standards:
 *   TopNav        — horizontal nav bar above content (websites, dashboards)
 *   SideNav       — vertical nav rail beside content (apps, admin panels)
 *   BottomNav     — tab bar below content (mobile apps)
 *
 * Unique approaches:
 *   CommandShell  — content area + a keyboard-accessible command slot at top
 *   Drawer        — sliding panel overlay, content behind stays visible
 *   Bookshelf     — vertical tabs on the far edge, wide content beside them
 *   Crumb         — breadcrumb trail above content, history lives in the layout
 */

import React from 'react';
import { Box } from '@reactjit/core';
import type { Style } from '@reactjit/core';

type OptStyle = { style?: Style };

const fill: Style  = { width: '100%', height: '100%' };
const col: Style   = { ...fill, flexDirection: 'column' };
const row: Style   = { width: '100%', flexDirection: 'row' };

// ── TopNav ───────────────────────────────────────────────────────────
// Horizontal navigation bar anchored at the top.
// Content fills the remaining vertical space.

export interface TopNavProps extends OptStyle {
  nav: React.ReactNode;
  children?: React.ReactNode;
}

export function TopNav({ nav, children, style }: TopNavProps) {
  return (
    <Box style={{ ...col, ...style }}>
      <Box style={{ width: '100%' }}>{nav}</Box>
      <Box style={{ flexGrow: 1, width: '100%' }}>{children}</Box>
    </Box>
  );
}

// ── SideNav ──────────────────────────────────────────────────────────
// Vertical navigation rail on the left or right.
// Content fills the remaining horizontal space.

export interface SideNavProps extends OptStyle {
  nav: React.ReactNode;
  navWidth?: number;
  side?: 'left' | 'right';
  children?: React.ReactNode;
}

export function SideNav({ nav, navWidth, side = 'left', children, style }: SideNavProps) {
  const navBox = <Box style={{ width: navWidth, height: '100%' }}>{nav}</Box>;
  const contentBox = <Box style={{ flexGrow: 1, height: '100%' }}>{children}</Box>;

  return (
    <Box style={{ ...row, ...fill, alignItems: 'stretch', ...style }}>
      {side === 'left'  ? <>{navBox}{contentBox}</> : <>{contentBox}{navBox}</>}
    </Box>
  );
}

// ── BottomNav ────────────────────────────────────────────────────────
// Tab bar docked at the bottom. Content is above.
// The mobile app standard.

export interface BottomNavProps extends OptStyle {
  nav: React.ReactNode;
  children?: React.ReactNode;
}

export function BottomNav({ nav, children, style }: BottomNavProps) {
  return (
    <Box style={{ ...col, ...style }}>
      <Box style={{ flexGrow: 1, width: '100%' }}>{children}</Box>
      <Box style={{ width: '100%' }}>{nav}</Box>
    </Box>
  );
}

// ── CommandShell ──────────────────────────────────────────────────────
// A command/search slot at the very top, then full content below.
// The shell owns the command bar region; you control what goes in it.
// Think: Spotlight, Raycast, VS Code command palette as a persistent strip.

export interface CommandShellProps extends OptStyle {
  command: React.ReactNode;
  children?: React.ReactNode;
}

export function CommandShell({ command, children, style }: CommandShellProps) {
  return (
    <Box style={{ ...col, ...style }}>
      <Box style={{ width: '100%' }}>{command}</Box>
      <Box style={{ flexGrow: 1, width: '100%' }}>{children}</Box>
    </Box>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────
// A side panel that overlays the content area.
// When open, the drawer sits on top of content without collapsing it.
// Position is absolute; content below is always full size.
// Pass `open` to control visibility. The layout allocates the space
// structurally — you control open/close state.

export interface DrawerProps extends OptStyle {
  drawer: React.ReactNode;
  drawerWidth?: number;
  side?: 'left' | 'right';
  open?: boolean;
  children?: React.ReactNode;
}

export function Drawer({ drawer, drawerWidth = 240, side = 'left', open = false, children, style }: DrawerProps) {
  return (
    <Box style={{ ...fill, position: 'relative', ...style }}>
      <Box style={fill}>{children}</Box>
      {open && (
        <Box style={{
          position: 'absolute',
          top: 0,
          [side]: 0,
          width: drawerWidth,
          height: '100%',
        }}>
          {drawer}
        </Box>
      )}
    </Box>
  );
}

// ── Bookshelf ─────────────────────────────────────────────────────────
// Vertical tabs pinned to one edge, content beside them.
// Unlike SideNav, the tabs ARE the navigation — each tab is a section
// title and you slot corresponding content alongside.
// Named after a bookshelf: spines on the side, pages open beside them.

export interface BookshelfProps extends OptStyle {
  tabs: React.ReactNode;
  tabsWidth?: number;
  side?: 'left' | 'right';
  children?: React.ReactNode;
}

export function Bookshelf({ tabs, tabsWidth, side = 'left', children, style }: BookshelfProps) {
  const tabBox = (
    <Box style={{ width: tabsWidth, height: '100%', flexDirection: 'column' }}>
      {tabs}
    </Box>
  );
  const contentBox = <Box style={{ flexGrow: 1, height: '100%' }}>{children}</Box>;

  return (
    <Box style={{ ...row, ...fill, alignItems: 'stretch', ...style }}>
      {side === 'left' ? <>{tabBox}{contentBox}</> : <>{contentBox}{tabBox}</>}
    </Box>
  );
}

// ── Crumb ─────────────────────────────────────────────────────────────
// Breadcrumb trail anchored above the content.
// The layout owns the trail region; pass it `trail` with your
// breadcrumb component. Content is below.
// Encourages treating navigation history as a layout concern.

export interface CrumbProps extends OptStyle {
  trail: React.ReactNode;
  children?: React.ReactNode;
}

export function Crumb({ trail, children, style }: CrumbProps) {
  return (
    <Box style={{ ...col, ...style }}>
      <Box style={{ width: '100%' }}>{trail}</Box>
      <Box style={{ flexGrow: 1, width: '100%' }}>{children}</Box>
    </Box>
  );
}
