/**
 * Shell — Vesper's root layout.
 *
 * Structure:
 *   ┌─────────────────────────────────┐
 *   │ TopBar (title + health + status) │
 *   ├─────────────────────────────────┤
 *   │                                 │
 *   │         Content Area            │
 *   │        (flexGrow: 1)            │
 *   │                                 │
 *   ├─────────────────────────────────┤
 *   │ BottomNav (Chat|Term|Res|Sets)  │
 *   └─────────────────────────────────┘
 */

import React from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { BottomNav } from '@reactjit/layouts';
import { V } from '../theme';
import type { ViewId } from '../types';

// ── Nav Item ─────────────────────────────────────────────

const NAV_ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'chat',     label: 'Chat',     icon: '\u25C8' },  // ◈
  { id: 'compare',  label: 'Compare',  icon: '\u2261' },  // ≡
  { id: 'terminal', label: 'Terminal',  icon: '\u25B7' },  // ▷
  { id: 'research', label: 'Research',  icon: '\u25CB' },  // ○
  { id: 'settings', label: 'Settings',  icon: '\u2699' },  // ⚙
];

function NavTab({ item, active, onPress }: {
  item: typeof NAV_ITEMS[0];
  active: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={(state) => ({
        flexGrow: 1,
        flexBasis: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 6,
        paddingBottom: 6,
        gap: 2,
        backgroundColor: state.hovered
          ? 'rgba(255, 255, 255, 0.04)'
          : 'transparent',
      })}
    >
      <Text style={{
        fontSize: 16,
        color: active ? V.accent : c.textDim,
      }}>
        {item.icon}
      </Text>
      <Text style={{
        fontSize: 10,
        fontWeight: active ? '700' : '400',
        color: active ? V.accent : c.textDim,
      }}>
        {item.label}
      </Text>
    </Pressable>
  );
}

// ── Top Bar ──────────────────────────────────────────────

function TopBar({ providerName, healthy }: {
  providerName: string;
  healthy: boolean;
}) {
  const c = useThemeColors();
  return (
    <Box style={{
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: V.border,
      backgroundColor: V.bg,
    }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
        Vesper
      </Text>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Box style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          backgroundColor: healthy ? V.success : V.error,
        }} />
        <Text style={{ fontSize: 11, color: c.textSecondary }}>
          {providerName}
        </Text>
      </Box>
    </Box>
  );
}

// ── Shell ────────────────────────────────────────────────

export interface ShellProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  providerName: string;
  providerHealthy: boolean;
  children: React.ReactNode;
}

export function Shell({
  activeView,
  onNavigate,
  providerName,
  providerHealthy,
  children,
}: ShellProps) {
  const navBar = (
    <Box style={{
      width: '100%',
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: V.border,
      backgroundColor: V.bg,
    }}>
      {NAV_ITEMS.map(item => (
        <NavTab
          key={item.id}
          item={item}
          active={activeView === item.id}
          onPress={() => onNavigate(item.id)}
        />
      ))}
    </Box>
  );

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: V.bg }}>
      <TopBar providerName={providerName} healthy={providerHealthy} />
      <BottomNav nav={navBar}>
        {children}
      </BottomNav>
    </Box>
  );
}
