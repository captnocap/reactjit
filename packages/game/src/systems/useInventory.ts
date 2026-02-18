import { useState, useRef, useCallback } from 'react';
import type { InventoryConfig, InventoryItem, InventorySlot } from '../types';

export interface InventoryState {
  /** All slots */
  slots: InventorySlot[];
  /** Add an item (stacks if possible, finds empty slot otherwise) */
  add: (item: Omit<InventoryItem, 'quantity'> & { quantity?: number }) => boolean;
  /** Remove quantity of an item by ID */
  remove: (itemId: string, quantity?: number) => boolean;
  /** Move item from one slot to another */
  move: (fromIndex: number, toIndex: number) => void;
  /** Swap two slots */
  swap: (indexA: number, indexB: number) => void;
  /** Find an item by ID */
  find: (itemId: string) => InventoryItem | null;
  /** Check if inventory contains an item */
  has: (itemId: string, quantity?: number) => boolean;
  /** Count total quantity of an item across all slots */
  count: (itemId: string) => number;
  /** Total weight of all items */
  weight: number;
  /** Number of occupied slots */
  usedSlots: number;
  /** Clear all items */
  clear: () => void;
}

export function useInventory(config: InventoryConfig): InventoryState {
  const { slots: slotCount, maxStack = 64, maxWeight } = config;

  const [, forceRender] = useState(0);
  const slotsRef = useRef<InventorySlot[]>([]);

  // Initialize slots
  if (slotsRef.current.length === 0) {
    for (let i = 0; i < slotCount; i++) {
      slotsRef.current.push({ item: null, index: i });
    }
  }

  const add = useCallback((itemInput: Omit<InventoryItem, 'quantity'> & { quantity?: number }): boolean => {
    const quantity = itemInput.quantity ?? 1;
    const itemMaxStack = itemInput.maxStack ?? maxStack;
    let remaining = quantity;

    // First try to stack with existing items
    for (const slot of slotsRef.current) {
      if (remaining <= 0) break;
      if (slot.item && slot.item.id === itemInput.id && slot.item.quantity < itemMaxStack) {
        const canAdd = Math.min(remaining, itemMaxStack - slot.item.quantity);
        slot.item.quantity += canAdd;
        remaining -= canAdd;
      }
    }

    // Then fill empty slots
    for (const slot of slotsRef.current) {
      if (remaining <= 0) break;
      if (!slot.item) {
        const toAdd = Math.min(remaining, itemMaxStack);
        slot.item = { ...itemInput, quantity: toAdd } as InventoryItem;
        remaining -= toAdd;
      }
    }

    // Check weight limit
    if (maxWeight !== undefined) {
      const totalWeight = slotsRef.current.reduce(
        (sum, s) => sum + (s.item ? (s.item.weight ?? 0) * s.item.quantity : 0), 0,
      );
      if (totalWeight > maxWeight) {
        // TODO: could roll back, but for simplicity just warn
      }
    }

    forceRender(n => n + 1);
    return remaining <= 0;
  }, [maxStack, maxWeight]);

  const remove = useCallback((itemId: string, quantity: number = 1): boolean => {
    let remaining = quantity;
    const total = slotsRef.current.reduce(
      (sum, s) => sum + (s.item?.id === itemId ? s.item.quantity : 0), 0,
    );
    if (total < quantity) return false;

    // Remove from slots (back to front to prefer emptying later slots)
    for (let i = slotsRef.current.length - 1; i >= 0; i--) {
      if (remaining <= 0) break;
      const slot = slotsRef.current[i];
      if (slot.item?.id === itemId) {
        const toRemove = Math.min(remaining, slot.item.quantity);
        slot.item.quantity -= toRemove;
        remaining -= toRemove;
        if (slot.item.quantity <= 0) slot.item = null;
      }
    }

    forceRender(n => n + 1);
    return true;
  }, []);

  const move = useCallback((fromIndex: number, toIndex: number) => {
    const from = slotsRef.current[fromIndex];
    const to = slotsRef.current[toIndex];
    if (!from || !to || !from.item) return;

    // If same item type, try to stack
    if (to.item && to.item.id === from.item.id) {
      const itemMaxStack = from.item.maxStack ?? maxStack;
      const canAdd = Math.min(from.item.quantity, itemMaxStack - to.item.quantity);
      to.item.quantity += canAdd;
      from.item.quantity -= canAdd;
      if (from.item.quantity <= 0) from.item = null;
    } else {
      // Swap
      const temp = from.item;
      from.item = to.item;
      to.item = temp;
    }
    forceRender(n => n + 1);
  }, [maxStack]);

  const swap = useCallback((indexA: number, indexB: number) => {
    const a = slotsRef.current[indexA];
    const b = slotsRef.current[indexB];
    if (!a || !b) return;
    const temp = a.item;
    a.item = b.item;
    b.item = temp;
    forceRender(n => n + 1);
  }, []);

  const find = useCallback((itemId: string): InventoryItem | null => {
    for (const slot of slotsRef.current) {
      if (slot.item?.id === itemId) return slot.item;
    }
    return null;
  }, []);

  const has = useCallback((itemId: string, quantity: number = 1): boolean => {
    const total = slotsRef.current.reduce(
      (sum, s) => sum + (s.item?.id === itemId ? s.item.quantity : 0), 0,
    );
    return total >= quantity;
  }, []);

  const countFn = useCallback((itemId: string): number => {
    return slotsRef.current.reduce(
      (sum, s) => sum + (s.item?.id === itemId ? s.item.quantity : 0), 0,
    );
  }, []);

  const clear = useCallback(() => {
    for (const slot of slotsRef.current) slot.item = null;
    forceRender(n => n + 1);
  }, []);

  const totalWeight = slotsRef.current.reduce(
    (sum, s) => sum + (s.item ? (s.item.weight ?? 0) * s.item.quantity : 0), 0,
  );

  const usedSlots = slotsRef.current.filter(s => s.item !== null).length;

  return {
    slots: slotsRef.current,
    add,
    remove,
    move,
    swap,
    find,
    has,
    count: countFn,
    weight: totalWeight,
    usedSlots,
    clear,
  };
}
