import { useState, useRef, useCallback } from 'react';
import type { CombatStats, DamageEvent, BuffDef, ActiveBuff } from '../types';

export interface CombatConfig {
  stats: CombatStats;
  damageTypes?: string[];
  resistances?: Record<string, number>;
}

export interface CombatState {
  /** Current stats (after modifiers) */
  stats: CombatStats;
  /** Base stats (unmodified) */
  baseStats: CombatStats;
  /** Is HP <= 0? */
  isDead: boolean;
  /** Active buffs */
  buffs: ActiveBuff[];
  /** Active debuffs */
  debuffs: ActiveBuff[];
  /** Take damage with type and source */
  takeDamage: (event: DamageEvent) => number;
  /** Heal HP */
  heal: (amount: number) => void;
  /** Restore MP */
  restoreMp: (amount: number) => void;
  /** Add a buff */
  addBuff: (buff: BuffDef) => void;
  /** Add a debuff */
  addDebuff: (debuff: BuffDef) => void;
  /** Remove a buff/debuff by ID */
  removeBuff: (id: string) => void;
  /** Update buffs/debuffs each frame */
  update: (dt: number) => void;
  /** Reset to full HP/MP, clear all buffs */
  fullRestore: () => void;
}

export function useCombat(config: CombatConfig): CombatState {
  const { stats: initialStats, resistances = {} } = config;

  const [, forceRender] = useState(0);
  const baseStatsRef = useRef<CombatStats>({ ...initialStats });
  const currentStatsRef = useRef<CombatStats>({ ...initialStats });
  const buffsRef = useRef<ActiveBuff[]>([]);
  const debuffsRef = useRef<ActiveBuff[]>([]);

  const computeStats = useCallback(() => {
    const base = baseStatsRef.current;
    const computed: CombatStats = { ...base };

    // Apply buff modifiers
    for (const buff of buffsRef.current) {
      if (buff.stat && buff.modifier !== undefined) {
        const val = computed[buff.stat];
        if (typeof val === 'number') {
          (computed as any)[buff.stat] = val * buff.modifier;
        }
      }
    }

    // Apply debuff modifiers
    for (const debuff of debuffsRef.current) {
      if (debuff.stat && debuff.modifier !== undefined) {
        const val = computed[debuff.stat];
        if (typeof val === 'number') {
          (computed as any)[debuff.stat] = val * debuff.modifier;
        }
      }
    }

    // Keep current HP/MP, clamp to max
    computed.hp = Math.min(currentStatsRef.current.hp, computed.maxHp);
    if (computed.maxMp !== undefined) {
      computed.mp = Math.min(currentStatsRef.current.mp ?? 0, computed.maxMp);
    }

    currentStatsRef.current = computed;
  }, []);

  const takeDamage = useCallback((event: DamageEvent): number => {
    let amount = event.amount;

    // Apply resistance
    if (event.type && resistances[event.type] !== undefined) {
      amount *= (1 - resistances[event.type]);
    }

    // Apply defense
    const defense = currentStatsRef.current.defense;
    amount = Math.max(1, amount - defense * 0.5);
    amount = Math.floor(amount);

    currentStatsRef.current.hp = Math.max(0, currentStatsRef.current.hp - amount);
    forceRender(n => n + 1);
    return amount;
  }, [resistances]);

  const heal = useCallback((amount: number) => {
    currentStatsRef.current.hp = Math.min(
      currentStatsRef.current.maxHp,
      currentStatsRef.current.hp + amount,
    );
    forceRender(n => n + 1);
  }, []);

  const restoreMp = useCallback((amount: number) => {
    if (currentStatsRef.current.maxMp !== undefined) {
      currentStatsRef.current.mp = Math.min(
        currentStatsRef.current.maxMp,
        (currentStatsRef.current.mp ?? 0) + amount,
      );
      forceRender(n => n + 1);
    }
  }, []);

  const addBuff = useCallback((buff: BuffDef) => {
    // Remove existing buff with same ID
    buffsRef.current = buffsRef.current.filter(b => b.id !== buff.id);
    buffsRef.current.push({ ...buff, remaining: buff.duration, tickTimer: 0 });
    computeStats();
    forceRender(n => n + 1);
  }, [computeStats]);

  const addDebuff = useCallback((debuff: BuffDef) => {
    debuffsRef.current = debuffsRef.current.filter(b => b.id !== debuff.id);
    debuffsRef.current.push({ ...debuff, remaining: debuff.duration, tickTimer: 0 });
    computeStats();
    forceRender(n => n + 1);
  }, [computeStats]);

  const removeBuff = useCallback((id: string) => {
    buffsRef.current = buffsRef.current.filter(b => b.id !== id);
    debuffsRef.current = debuffsRef.current.filter(b => b.id !== id);
    computeStats();
    forceRender(n => n + 1);
  }, [computeStats]);

  const update = useCallback((dt: number) => {
    let changed = false;

    const tickList = (list: ActiveBuff[], isDebuff: boolean) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.remaining -= dt;
        b.tickTimer += dt;

        // Tick damage/heal
        const interval = b.interval ?? 1;
        while (b.tickTimer >= interval) {
          b.tickTimer -= interval;
          if (b.tickDamage) {
            currentStatsRef.current.hp = Math.max(0, currentStatsRef.current.hp - b.tickDamage);
            changed = true;
          }
          if (b.tickHeal) {
            currentStatsRef.current.hp = Math.min(
              currentStatsRef.current.maxHp,
              currentStatsRef.current.hp + b.tickHeal,
            );
            changed = true;
          }
        }

        // Remove expired
        if (b.remaining <= 0) {
          list.splice(i, 1);
          changed = true;
        }
      }
    };

    tickList(buffsRef.current, false);
    tickList(debuffsRef.current, true);

    if (changed) {
      computeStats();
      forceRender(n => n + 1);
    }
  }, [computeStats]);

  const fullRestore = useCallback(() => {
    currentStatsRef.current.hp = baseStatsRef.current.maxHp;
    if (baseStatsRef.current.maxMp !== undefined) {
      currentStatsRef.current.mp = baseStatsRef.current.maxMp;
    }
    buffsRef.current = [];
    debuffsRef.current = [];
    computeStats();
    forceRender(n => n + 1);
  }, [computeStats]);

  return {
    stats: currentStatsRef.current,
    baseStats: baseStatsRef.current,
    isDead: currentStatsRef.current.hp <= 0,
    buffs: buffsRef.current,
    debuffs: debuffsRef.current,
    takeDamage,
    heal,
    restoreMp,
    addBuff,
    addDebuff,
    removeBuff,
    update,
    fullRestore,
  };
}
