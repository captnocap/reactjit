import { useState, useRef, useCallback } from 'react';
import type { DialogueConfig, DialogueNode, DialogueChoice } from '../types';

export interface DialogueState {
  /** Whether dialogue is active */
  isActive: boolean;
  /** Current dialogue node */
  currentNode: DialogueNode | null;
  /** Current node ID */
  currentNodeId: string | null;
  /** Available choices (filtered by conditions) */
  availableChoices: DialogueChoice[];
  /** Start dialogue at a node */
  start: (nodeId: string) => void;
  /** Advance to next node (for linear dialogue) */
  advance: () => void;
  /** Choose a dialogue option by index */
  choose: (choiceIndex: number) => void;
  /** End dialogue */
  end: () => void;
}

export function useDialogue(config: DialogueConfig): DialogueState {
  const { nodes } = config;

  const [, forceRender] = useState(0);
  const activeRef = useRef(false);
  const currentIdRef = useRef<string | null>(null);

  const getCurrentNode = useCallback((): DialogueNode | null => {
    if (!currentIdRef.current) return null;
    return nodes[currentIdRef.current] ?? null;
  }, [nodes]);

  const getAvailableChoices = useCallback((): DialogueChoice[] => {
    const node = getCurrentNode();
    if (!node?.choices) return [];
    return node.choices.filter(c => !c.condition || c.condition());
  }, [getCurrentNode]);

  const goToNode = useCallback((nodeId: string | null | undefined) => {
    if (!nodeId || !nodes[nodeId]) {
      activeRef.current = false;
      currentIdRef.current = null;
    } else {
      currentIdRef.current = nodeId;
      const node = nodes[nodeId];
      node.onEnter?.();
    }
    forceRender(n => n + 1);
  }, [nodes]);

  const start = useCallback((nodeId: string) => {
    activeRef.current = true;
    goToNode(nodeId);
  }, [goToNode]);

  const advance = useCallback(() => {
    const node = getCurrentNode();
    if (!node) return;

    if (node.next !== undefined) {
      if (node.next === null) {
        activeRef.current = false;
        currentIdRef.current = null;
        forceRender(n => n + 1);
      } else {
        goToNode(node.next);
      }
    }
  }, [getCurrentNode, goToNode]);

  const choose = useCallback((choiceIndex: number) => {
    const choices = getAvailableChoices();
    const choice = choices[choiceIndex];
    if (choice) {
      goToNode(choice.next);
    }
  }, [getAvailableChoices, goToNode]);

  const end = useCallback(() => {
    activeRef.current = false;
    currentIdRef.current = null;
    forceRender(n => n + 1);
  }, []);

  return {
    isActive: activeRef.current,
    currentNode: getCurrentNode(),
    currentNodeId: currentIdRef.current,
    availableChoices: getAvailableChoices(),
    start,
    advance,
    choose,
    end,
  };
}
