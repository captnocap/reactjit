import { useState, useRef, useCallback } from 'react';
import type { AchievementDef } from '../types';

export interface AchievementInstance {
  def: AchievementDef;
  unlocked: boolean;
  progress: number;
  unlockedAt: number | null;
}

export interface AchievementsState {
  /** All achievements with status */
  achievements: AchievementInstance[];
  /** Check if an achievement is unlocked */
  isUnlocked: (id: string) => boolean;
  /** Unlock an achievement directly */
  unlock: (id: string) => void;
  /** Set progress for an achievement (auto-unlocks at maxProgress) */
  setProgress: (id: string, progress: number) => void;
  /** Increment progress */
  incrementProgress: (id: string, amount?: number) => void;
  /** Check all achievements with conditions and unlock eligible ones */
  checkAll: () => string[];
  /** Get unlocked count */
  unlockedCount: number;
  /** Get total count */
  totalCount: number;
}

export function useAchievements(defs: AchievementDef[]): AchievementsState {
  const [, forceRender] = useState(0);
  const instancesRef = useRef<Map<string, AchievementInstance>>(new Map());

  // Initialize
  if (instancesRef.current.size === 0) {
    for (const def of defs) {
      instancesRef.current.set(def.id, {
        def,
        unlocked: false,
        progress: 0,
        unlockedAt: null,
      });
    }
  }

  const isUnlocked = useCallback((id: string): boolean => {
    return instancesRef.current.get(id)?.unlocked ?? false;
  }, []);

  const unlock = useCallback((id: string) => {
    const inst = instancesRef.current.get(id);
    if (inst && !inst.unlocked) {
      inst.unlocked = true;
      inst.unlockedAt = Date.now();
      inst.progress = inst.def.maxProgress ?? 1;
      forceRender(n => n + 1);
    }
  }, []);

  const setProgress = useCallback((id: string, progress: number) => {
    const inst = instancesRef.current.get(id);
    if (!inst || inst.unlocked) return;
    inst.progress = progress;
    if (inst.def.maxProgress !== undefined && progress >= inst.def.maxProgress) {
      inst.unlocked = true;
      inst.unlockedAt = Date.now();
    }
    forceRender(n => n + 1);
  }, []);

  const incrementProgress = useCallback((id: string, amount: number = 1) => {
    const inst = instancesRef.current.get(id);
    if (!inst || inst.unlocked) return;
    setProgress(id, inst.progress + amount);
  }, [setProgress]);

  const checkAll = useCallback((): string[] => {
    const newlyUnlocked: string[] = [];
    for (const inst of instancesRef.current.values()) {
      if (!inst.unlocked && inst.def.condition && inst.def.condition()) {
        inst.unlocked = true;
        inst.unlockedAt = Date.now();
        newlyUnlocked.push(inst.def.id);
      }
    }
    if (newlyUnlocked.length > 0) forceRender(n => n + 1);
    return newlyUnlocked;
  }, []);

  const all = Array.from(instancesRef.current.values());

  return {
    achievements: all,
    isUnlocked,
    unlock,
    setProgress,
    incrementProgress,
    checkAll,
    unlockedCount: all.filter(a => a.unlocked).length,
    totalCount: all.length,
  };
}
