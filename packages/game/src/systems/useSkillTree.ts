import { useState, useRef, useCallback } from 'react';
import type { SkillTreeConfig, SkillNode, Vec2 } from '../types';

export interface SkillTreeState {
  /** Available skill points */
  remainingPoints: number;
  /** Total points allocated */
  allocatedPoints: number;
  /** Check if a skill is unlocked */
  isUnlocked: (skillId: string) => boolean;
  /** Check if a skill can be unlocked (has points, prerequisites met) */
  canUnlock: (skillId: string) => boolean;
  /** Unlock a skill (costs points) */
  unlock: (skillId: string) => boolean;
  /** Add skill points */
  addPoints: (amount: number) => void;
  /** Reset all unlocks, refund points */
  reset: () => void;
  /** All nodes with their status */
  nodes: Record<string, SkillNode & { unlocked: boolean; available: boolean }>;
  /** Layout positions */
  layout: Record<string, Vec2>;
}

export function useSkillTree(config: SkillTreeConfig): SkillTreeState {
  const { points: initialPoints, nodes: nodeDefs, layout = {} } = config;

  const [, forceRender] = useState(0);
  const pointsRef = useRef(initialPoints);
  const unlockedRef = useRef<Set<string>>(new Set());

  const isUnlocked = useCallback((skillId: string) => {
    return unlockedRef.current.has(skillId);
  }, []);

  const canUnlock = useCallback((skillId: string): boolean => {
    if (unlockedRef.current.has(skillId)) return false;
    const node = nodeDefs[skillId];
    if (!node) return false;
    if (pointsRef.current < node.cost) return false;
    if (node.requires) {
      for (const req of node.requires) {
        if (!unlockedRef.current.has(req)) return false;
      }
    }
    return true;
  }, [nodeDefs]);

  const unlock = useCallback((skillId: string): boolean => {
    if (!canUnlock(skillId)) return false;
    const node = nodeDefs[skillId];
    pointsRef.current -= node.cost;
    unlockedRef.current.add(skillId);
    forceRender(n => n + 1);
    return true;
  }, [nodeDefs, canUnlock]);

  const addPoints = useCallback((amount: number) => {
    pointsRef.current += amount;
    forceRender(n => n + 1);
  }, []);

  const reset = useCallback(() => {
    // Refund all points
    let refund = 0;
    for (const id of unlockedRef.current) {
      refund += nodeDefs[id]?.cost ?? 0;
    }
    pointsRef.current += refund;
    unlockedRef.current.clear();
    forceRender(n => n + 1);
  }, [nodeDefs]);

  // Build enhanced node map
  const enhancedNodes: Record<string, SkillNode & { unlocked: boolean; available: boolean }> = {};
  for (const [id, node] of Object.entries(nodeDefs)) {
    const unlocked = unlockedRef.current.has(id);
    let available = false;
    if (!unlocked && pointsRef.current >= node.cost) {
      available = !node.requires || node.requires.every(r => unlockedRef.current.has(r));
    }
    enhancedNodes[id] = { ...node, unlocked, available };
  }

  const allocatedPoints = Array.from(unlockedRef.current).reduce(
    (sum, id) => sum + (nodeDefs[id]?.cost ?? 0), 0,
  );

  return {
    remainingPoints: pointsRef.current,
    allocatedPoints,
    isUnlocked,
    canUnlock,
    unlock,
    addPoints,
    reset,
    nodes: enhancedNodes,
    layout,
  };
}
