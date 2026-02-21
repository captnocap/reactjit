import React from 'react';
import { Box, Text } from '@reactjit/core';
import type { InventoryState } from '../systems/useInventory';

export interface InventoryGridProps {
  inventory: InventoryState;
  columns?: number;
  slotSize?: number;
  onSlotClick?: (slotIndex: number) => void;
}

export function InventoryGrid({
  inventory,
  columns = 5,
  slotSize = 36,
  onSlotClick,
}: InventoryGridProps) {
  const rows: React.ReactNode[] = [];

  for (let i = 0; i < inventory.slots.length; i += columns) {
    const rowSlots: React.ReactNode[] = [];
    for (let j = 0; j < columns && i + j < inventory.slots.length; j++) {
      const idx = i + j;
      const slot = inventory.slots[idx];
      const hasItem = slot.item !== null;

      rowSlots.push(
        React.createElement(
          Box,
          {
            key: idx,
            onClick: onSlotClick ? () => onSlotClick(idx) : undefined,
            style: {
              width: slotSize,
              height: slotSize,
              backgroundColor: hasItem ? '#334155' : '#1e293b',
              borderWidth: 1,
              borderColor: hasItem ? '#64748b' : '#334155',
              borderRadius: 4,
              justifyContent: 'center',
              alignItems: 'center',
            },
          },
          hasItem
            ? React.createElement(
                Box,
                { style: { alignItems: 'center' } },
                React.createElement(Text, {
                  style: { fontSize: 10, color: '#e2e8f0' },
                }, slot.item!.name.slice(0, 4)),
                slot.item!.quantity > 1
                  ? React.createElement(Text, {
                      style: { fontSize: 8, color: '#94a3b8' },
                    }, `x${slot.item!.quantity}`)
                  : null,
              )
            : null,
        ),
      );
    }

    rows.push(
      React.createElement(Box, {
        key: `row-${i}`,
        style: { flexDirection: 'row', gap: 2 },
      }, ...rowSlots),
    );
  }

  return React.createElement(
    Box,
    { style: { gap: 2, padding: 4, backgroundColor: '#0f172a', borderRadius: 6 } },
    ...rows,
  );
}
