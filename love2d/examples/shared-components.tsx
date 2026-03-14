/**
 * Shared demo components that work in BOTH web and native renderers.
 *
 * Import these from either examples/web-overlay or examples/native-hud
 * and they render identically — DOM overlays in web mode, Love2D draw
 * commands in native mode.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useLoveState, useLoveEvent, useLoveSend } from '../packages/shared/src';

// ── Health Bar ────────────────────────────────────────────

function healthColor(pct: number): string {
  if (pct > 0.6) return '#22c55e';
  if (pct > 0.3) return '#eab308';
  return '#ef4444';
}

export function HealthBar({ label = 'HP' }: { label?: string }) {
  const [health] = useLoveState('player.health', 100);
  const pct = Math.max(0, Math.min(100, health)) / 100;

  return (
    <Box style={{
      width: 200,
      height: 28,
      backgroundColor: [0.15, 0.15, 0.2, 0.8],
      borderRadius: 6,
      borderWidth: 1,
      borderColor: [0.3, 0.3, 0.4, 1],
      overflow: 'hidden',
    }}>
      <Box style={{
        width: `${pct * 100}%`,
        height: '100%',
        backgroundColor: healthColor(pct),
        borderRadius: 4,
      }} />
      <Box style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          color: '#ffffff',
          fontSize: 13,
          textAlign: 'center',
        }}>
          {label}: {health}
        </Text>
      </Box>
    </Box>
  );
}

// ── Score Display ─────────────────────────────────────────

export function ScoreDisplay() {
  const [score] = useLoveState('game.score', 0);

  return (
    <Box style={{
      padding: 8,
      paddingLeft: 16,
      paddingRight: 16,
      backgroundColor: [0.1, 0.1, 0.15, 0.8],
      borderRadius: 8,
    }}>
      <Text style={{ color: '#fbbf24', fontSize: 18 }}>
        Score: {score}
      </Text>
    </Box>
  );
}

// ── FPS Counter ───────────────────────────────────────────

export function FPSCounter() {
  const [fps] = useLoveState('debug.fps', 0);

  return (
    <Text style={{
      color: [0.5, 0.5, 0.5, 0.8],
      fontSize: 11,
    }}>
      {fps} FPS
    </Text>
  );
}

// ── Inventory Slot ────────────────────────────────────────

interface InventorySlotProps {
  index: number;
  item?: { name: string; count: number };
  selected?: boolean;
}

export function InventorySlot({ index, item, selected }: InventorySlotProps) {
  const [hovered, setHovered] = useState(false);
  const send = useLoveSend();

  return (
    <Box
      style={{
        width: 48,
        height: 48,
        backgroundColor: selected
          ? [0.25, 0.4, 0.7, 0.9]
          : hovered
            ? [0.2, 0.2, 0.3, 0.8]
            : [0.12, 0.12, 0.18, 0.7],
        borderRadius: 6,
        borderWidth: selected ? 2 : 1,
        borderColor: selected
          ? [0.4, 0.6, 1, 1]
          : [0.3, 0.3, 0.35, 0.5],
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={() => send('inventory:select', { slot: index })}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {item ? (
        <>
          <Text style={{ color: '#ffffff', fontSize: 12 }}>{item.name}</Text>
          {item.count > 1 && (
            <Text style={{ color: '#9ca3af', fontSize: 10 }}>
              x{item.count}
            </Text>
          )}
        </>
      ) : (
        <Text style={{ color: [0.3, 0.3, 0.35, 0.5], fontSize: 10 }}>
          {index + 1}
        </Text>
      )}
    </Box>
  );
}

// ── Inventory Bar ─────────────────────────────────────────

export function InventoryBar() {
  const [selectedSlot] = useLoveState('inventory.selected', 0);
  const [items] = useLoveState<Array<{ name: string; count: number } | null>>(
    'inventory.items',
    [null, null, null, null, null, null, null, null]
  );

  return (
    <Box style={{
      flexDirection: 'row',
      gap: 4,
      padding: 6,
      backgroundColor: [0.08, 0.08, 0.12, 0.7],
      borderRadius: 8,
    }}>
      {items.map((item, i) => (
        <InventorySlot
          key={i}
          index={i}
          item={item || undefined}
          selected={i === selectedSlot}
        />
      ))}
    </Box>
  );
}

// ── HUD (combines everything) ─────────────────────────────

export function HUD() {
  return (
    <Box style={{
      width: '100%',
      height: '100%',
      padding: 16,
      justifyContent: 'space-between',
    }}>
      {/* Top bar */}
      <Box style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'start',
      }}>
        <Box style={{ gap: 8 }}>
          <HealthBar label="HP" />
          <HealthBar label="MP" />
        </Box>
        <Box style={{ alignItems: 'end', gap: 4 }}>
          <ScoreDisplay />
          <FPSCounter />
        </Box>
      </Box>

      {/* Bottom bar */}
      <Box style={{
        alignItems: 'center',
      }}>
        <InventoryBar />
      </Box>
    </Box>
  );
}
