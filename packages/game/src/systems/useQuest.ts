import { useState, useRef, useCallback } from 'react';
import type { QuestDef, QuestObjective } from '../types';

export type QuestStatus = 'inactive' | 'active' | 'completed' | 'failed';

export interface QuestInstance {
  def: QuestDef;
  status: QuestStatus;
  objectives: QuestObjective[];
}

export interface QuestState {
  /** All quests */
  quests: QuestInstance[];
  /** Active quests */
  active: QuestInstance[];
  /** Completed quests */
  completed: QuestInstance[];
  /** Start a quest */
  start: (questId: string) => void;
  /** Update quest objective progress */
  updateObjective: (questId: string, objectiveIndex: number, progress: number) => void;
  /** Increment quest objective by amount */
  incrementObjective: (questId: string, objectiveIndex: number, amount?: number) => void;
  /** Check if a quest is complete (all objectives met) */
  isComplete: (questId: string) => boolean;
  /** Complete a quest (mark as done) */
  complete: (questId: string) => void;
  /** Fail a quest */
  fail: (questId: string) => void;
  /** Get a quest by ID */
  getQuest: (questId: string) => QuestInstance | undefined;
}

export function useQuest(questDefs: QuestDef[]): QuestState {
  const [, forceRender] = useState(0);
  const questsRef = useRef<Map<string, QuestInstance>>(new Map());

  // Initialize quest instances
  if (questsRef.current.size === 0) {
    for (const def of questDefs) {
      questsRef.current.set(def.id, {
        def,
        status: 'inactive',
        objectives: def.objectives.map(o => ({ ...o })),
      });
    }
  }

  const start = useCallback((questId: string) => {
    const quest = questsRef.current.get(questId);
    if (quest && quest.status === 'inactive') {
      quest.status = 'active';
      forceRender(n => n + 1);
    }
  }, []);

  const updateObjective = useCallback((questId: string, objectiveIndex: number, progress: number) => {
    const quest = questsRef.current.get(questId);
    if (quest && quest.status === 'active' && quest.objectives[objectiveIndex]) {
      quest.objectives[objectiveIndex].current = Math.min(
        progress,
        quest.objectives[objectiveIndex].target,
      );
      forceRender(n => n + 1);
    }
  }, []);

  const incrementObjective = useCallback((questId: string, objectiveIndex: number, amount: number = 1) => {
    const quest = questsRef.current.get(questId);
    if (quest && quest.status === 'active' && quest.objectives[objectiveIndex]) {
      const obj = quest.objectives[objectiveIndex];
      obj.current = Math.min(obj.current + amount, obj.target);
      forceRender(n => n + 1);
    }
  }, []);

  const isComplete = useCallback((questId: string): boolean => {
    const quest = questsRef.current.get(questId);
    if (!quest) return false;
    return quest.objectives.every(o => o.current >= o.target);
  }, []);

  const complete = useCallback((questId: string) => {
    const quest = questsRef.current.get(questId);
    if (quest && quest.status === 'active') {
      quest.status = 'completed';
      forceRender(n => n + 1);
    }
  }, []);

  const fail = useCallback((questId: string) => {
    const quest = questsRef.current.get(questId);
    if (quest && quest.status === 'active') {
      quest.status = 'failed';
      forceRender(n => n + 1);
    }
  }, []);

  const getQuest = useCallback((questId: string) => questsRef.current.get(questId), []);

  const allQuests = Array.from(questsRef.current.values());

  return {
    quests: allQuests,
    active: allQuests.filter(q => q.status === 'active'),
    completed: allQuests.filter(q => q.status === 'completed'),
    start,
    updateObjective,
    incrementObjective,
    isComplete,
    complete,
    fail,
    getQuest,
  };
}
