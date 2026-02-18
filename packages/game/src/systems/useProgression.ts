import { useState, useRef, useCallback } from 'react';
import type { ProgressionConfig } from '../types';

export interface ProgressionState {
  /** Current level */
  level: number;
  /** Current XP within this level */
  xp: number;
  /** Total XP earned */
  totalXp: number;
  /** XP needed for next level */
  xpToNext: number;
  /** Progress 0-1 toward next level */
  progress: number;
  /** Add XP (may trigger multiple level-ups) */
  addXP: (amount: number) => void;
  /** Get computed stats at a given level */
  statsAt: (level: number) => Record<string, number>;
  /** Current level stats */
  currentStats: Record<string, number>;
  /** Is at max level? */
  maxed: boolean;
  /** Reset to level 1 */
  reset: () => void;
}

export function useProgression(config: ProgressionConfig): ProgressionState {
  const { xpCurve, maxLevel = 50, statGrowth = {}, onLevelUp } = config;

  const [, forceRender] = useState(0);
  const levelRef = useRef(1);
  const xpRef = useRef(0);
  const totalXpRef = useRef(0);

  const getXpToNext = useCallback((level: number) => {
    if (level >= maxLevel) return Infinity;
    return xpCurve(level);
  }, [xpCurve, maxLevel]);

  const addXP = useCallback((amount: number) => {
    if (levelRef.current >= maxLevel) return;

    xpRef.current += amount;
    totalXpRef.current += amount;

    // Process level-ups
    while (levelRef.current < maxLevel) {
      const needed = xpCurve(levelRef.current);
      if (xpRef.current >= needed) {
        xpRef.current -= needed;
        levelRef.current++;
        onLevelUp?.(levelRef.current);
      } else {
        break;
      }
    }

    if (levelRef.current >= maxLevel) {
      xpRef.current = 0;
    }

    forceRender(n => n + 1);
  }, [xpCurve, maxLevel, onLevelUp]);

  const statsAt = useCallback((level: number): Record<string, number> => {
    const stats: Record<string, number> = {};
    for (const [stat, growFn] of Object.entries(statGrowth)) {
      stats[stat] = Math.floor(growFn(level));
    }
    return stats;
  }, [statGrowth]);

  const reset = useCallback(() => {
    levelRef.current = 1;
    xpRef.current = 0;
    totalXpRef.current = 0;
    forceRender(n => n + 1);
  }, []);

  const xpToNext = getXpToNext(levelRef.current);

  return {
    level: levelRef.current,
    xp: xpRef.current,
    totalXp: totalXpRef.current,
    xpToNext,
    progress: xpToNext === Infinity ? 1 : xpRef.current / xpToNext,
    addXP,
    statsAt,
    currentStats: statsAt(levelRef.current),
    maxed: levelRef.current >= maxLevel,
    reset,
  };
}
