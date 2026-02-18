import { useCallback, useRef } from 'react';
import type { LootEntry, LootDrop, LootTableDef } from '../types';

export interface LootConfig {
  tables: Record<string, LootEntry[] | LootTableDef>;
}

export interface LootState {
  /** Roll a loot table and get drops */
  roll: (tableName: string) => LootDrop[];
}

export function useLoot(config: LootConfig): LootState {
  const tablesRef = useRef(config.tables);

  const rollTable = useCallback((entries: LootEntry[]): LootDrop | null => {
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        let quantity: number;
        if (Array.isArray(entry.quantity)) {
          quantity = entry.quantity[0] + Math.floor(Math.random() * (entry.quantity[1] - entry.quantity[0] + 1));
        } else {
          quantity = entry.quantity ?? 1;
        }
        return { item: entry.item, quantity, rarity: entry.rarity };
      }
    }

    return null;
  }, []);

  const roll = useCallback((tableName: string): LootDrop[] => {
    const table = tablesRef.current[tableName];
    if (!table) return [];

    // Simple array of entries
    if (Array.isArray(table)) {
      const drop = rollTable(table);
      return drop ? [drop] : [];
    }

    // Composite table with guaranteed drops and multiple rolls
    const drops: LootDrop[] = [];

    // Guaranteed drops
    if (table.guaranteed) {
      drops.push(...table.guaranteed);
    }

    // Roll from referenced table
    const rolls = table.rolls ?? 1;
    const sourceTableName = table.table;
    if (sourceTableName) {
      const sourceTable = tablesRef.current[sourceTableName];
      if (Array.isArray(sourceTable)) {
        for (let i = 0; i < rolls; i++) {
          const drop = rollTable(sourceTable);
          if (drop) drops.push(drop);
        }
      }
    }

    return drops;
  }, [rollTable]);

  return { roll };
}
