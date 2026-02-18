import React, { useState, useCallback } from 'react';
import { Box, Text } from '@ilovereact/core';
import { useCombat } from '../systems/useCombat';
import { useInventory } from '../systems/useInventory';
import { useProgression } from '../systems/useProgression';
import { useGameState } from '../core/useGameState';
import { HealthBar } from '../components/HealthBar';
import { StatusBar } from '../components/StatusBar';

interface Combatant {
  name: string;
  combat: ReturnType<typeof useCombat>;
  isPlayer: boolean;
  sprite: string;
}

type BattlePhase = 'menu' | 'play' | 'pause' | 'gameover';

export function TurnBasedTemplate() {
  const gameState = useGameState<BattlePhase>();
  const [battleLog, setBattleLog] = useState<string[]>(['A wild Slime appeared!']);
  const [turnIndex, setTurnIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [victory, setVictory] = useState(false);

  // Player party
  const warrior = useCombat({
    stats: { hp: 80, maxHp: 80, mp: 20, maxMp: 20, attack: 15, defense: 10, speed: 8 },
  });
  const mage = useCombat({
    stats: { hp: 45, maxHp: 45, mp: 50, maxMp: 50, attack: 8, defense: 4, speed: 12 },
  });
  const healer = useCombat({
    stats: { hp: 55, maxHp: 55, mp: 40, maxMp: 40, attack: 6, defense: 6, speed: 10 },
  });

  // Enemies
  const slime = useCombat({
    stats: { hp: 60, maxHp: 60, attack: 10, defense: 3, speed: 5 },
  });
  const goblin = useCombat({
    stats: { hp: 45, maxHp: 45, attack: 14, defense: 5, speed: 9 },
  });

  const inventory = useInventory({ slots: 10, maxStack: 10 });
  const progression = useProgression({
    xpCurve: (level) => Math.floor(50 * Math.pow(1.3, level - 1)),
    maxLevel: 20,
    onLevelUp: (lv) => log(`Party leveled up to ${lv}!`),
  });

  // Initialize inventory
  useState(() => {
    inventory.add({ id: 'potion', name: 'Potion', quantity: 3 });
    inventory.add({ id: 'ether', name: 'Ether', quantity: 2 });
  });

  const party = [
    { name: 'Warrior', combat: warrior, isPlayer: true, sprite: '#89b4fa' },
    { name: 'Mage', combat: mage, isPlayer: true, sprite: '#cba6f7' },
    { name: 'Healer', combat: healer, isPlayer: true, sprite: '#a6e3a1' },
  ];

  const enemyParty = [
    { name: 'Slime', combat: slime, isPlayer: false, sprite: '#a6e3a1' },
    { name: 'Goblin', combat: goblin, isPlayer: false, sprite: '#f9e2af' },
  ];

  // Turn order based on speed
  const allCombatants = [...party, ...enemyParty]
    .filter(c => !c.combat.isDead)
    .sort((a, b) => (b.combat.stats.speed ?? 0) - (a.combat.stats.speed ?? 0));

  const currentTurn = allCombatants[turnIndex % allCombatants.length];
  const isPlayerTurn = currentTurn?.isPlayer ?? false;

  const log = useCallback((msg: string) => {
    setBattleLog(prev => [...prev.slice(-6), msg]);
  }, []);

  const nextTurn = useCallback(() => {
    // Check win/lose
    const allEnemiesDead = enemyParty.every(e => e.combat.isDead);
    const allPlayersDead = party.every(p => p.combat.isDead);

    if (allEnemiesDead) {
      setVictory(true);
      progression.addXP(30);
      log('Victory! +30 XP');
      return;
    }
    if (allPlayersDead) {
      gameState.transitionTo('gameover');
      log('Party wiped...');
      return;
    }

    setTurnIndex(prev => {
      let next = prev + 1;
      // Skip dead combatants
      for (let i = 0; i < allCombatants.length; i++) {
        const c = allCombatants[next % allCombatants.length];
        if (!c.combat.isDead) break;
        next++;
      }
      return next;
    });
    setSelectedAction(null);
  }, [allCombatants, enemyParty, party, gameState, progression]);

  // Enemy AI
  const doEnemyTurn = useCallback(() => {
    if (!currentTurn || currentTurn.isPlayer || currentTurn.combat.isDead) return;

    const aliveTargets = party.filter(p => !p.combat.isDead);
    if (aliveTargets.length === 0) return;

    const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
    const dmg = currentTurn.combat.stats.attack;
    const actual = target.combat.takeDamage({ amount: dmg, type: 'physical' });
    log(`${currentTurn.name} attacks ${target.name} for ${actual} dmg`);

    setTimeout(() => nextTurn(), 600);
  }, [currentTurn, party, nextTurn]);

  // Auto-trigger enemy turns
  React.useEffect(() => {
    if (currentTurn && !currentTurn.isPlayer && !currentTurn.combat.isDead && !victory) {
      const id = setTimeout(doEnemyTurn, 800);
      return () => clearTimeout(id);
    }
  }, [turnIndex, currentTurn, doEnemyTurn, victory]);

  const doAttack = useCallback(() => {
    const aliveEnemies = enemyParty.filter(e => !e.combat.isDead);
    if (aliveEnemies.length === 0) return;
    const target = aliveEnemies[0];
    const dmg = currentTurn.combat.stats.attack;
    const actual = target.combat.takeDamage({ amount: dmg, type: 'physical' });
    log(`${currentTurn.name} attacks ${target.name} for ${actual} dmg`);
    nextTurn();
  }, [currentTurn, enemyParty, nextTurn]);

  const doDefend = useCallback(() => {
    currentTurn.combat.addBuff({ id: 'defend', stat: 'defense', modifier: 2, duration: 1 });
    log(`${currentTurn.name} defends! Defense doubled.`);
    nextTurn();
  }, [currentTurn, nextTurn]);

  const doHeal = useCallback(() => {
    if (!inventory.has('potion')) {
      log('No potions left!');
      return;
    }
    inventory.remove('potion', 1);
    // Heal lowest HP ally
    const aliveParty = party.filter(p => !p.combat.isDead);
    const lowest = aliveParty.reduce((a, b) =>
      a.combat.stats.hp / a.combat.stats.maxHp < b.combat.stats.hp / b.combat.stats.maxHp ? a : b
    );
    lowest.combat.heal(30);
    log(`${currentTurn.name} uses Potion on ${lowest.name}. +30 HP`);
    nextTurn();
  }, [currentTurn, inventory, party, nextTurn]);

  const doSkill = useCallback(() => {
    if ((currentTurn.combat.stats.mp ?? 0) < 10) {
      log('Not enough MP!');
      return;
    }
    // Spend MP, attack all enemies
    currentTurn.combat.restoreMp(-10);
    const aliveEnemies = enemyParty.filter(e => !e.combat.isDead);
    for (const e of aliveEnemies) {
      const dmg = currentTurn.combat.stats.attack * 1.5;
      const actual = e.combat.takeDamage({ amount: dmg, type: 'fire' });
      log(`${currentTurn.name} casts Fire! ${e.name} takes ${actual} dmg`);
    }
    nextTurn();
  }, [currentTurn, enemyParty, nextTurn]);

  const potionCount = inventory.count('potion');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#11111b', padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 16, color: '#cdd6f4', fontWeight: 'bold' }}>Turn-Based Battle</Text>

      {/* Battlefield */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-around', flexGrow: 1, width: '100%', alignItems: 'center' }}>
        {/* Party */}
        <Box style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#a6adc8', fontWeight: 'bold' }}>Party</Text>
          {party.map((member, i) => (
            <Box key={i} style={{
              gap: 4, alignItems: 'center',
              opacity: member.combat.isDead ? 0.3 : 1,
              borderWidth: currentTurn === member ? 2 : 0,
              borderColor: '#f9e2af',
              borderRadius: 8,
              padding: 8,
            }}>
              <Box style={{
                width: 32, height: 32, backgroundColor: member.sprite,
                borderRadius: 4,
              }} />
              <Text style={{ fontSize: 10, color: '#cdd6f4', fontWeight: 'bold' }}>{member.name}</Text>
              <HealthBar hp={member.combat.stats.hp} maxHp={member.combat.stats.maxHp} width={60} height={5} />
              {member.combat.stats.maxMp !== undefined && (
                <StatusBar
                  value={member.combat.stats.mp ?? 0}
                  max={member.combat.stats.maxMp}
                  width={60} height={4}
                  fillColor="#89b4fa"
                />
              )}
            </Box>
          ))}
        </Box>

        {/* VS */}
        <Text style={{ fontSize: 20, color: '#6c7086' }}>VS</Text>

        {/* Enemies */}
        <Box style={{ gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#a6adc8', fontWeight: 'bold' }}>Enemies</Text>
          {enemyParty.map((enemy, i) => (
            <Box key={i} style={{
              gap: 4, alignItems: 'center',
              opacity: enemy.combat.isDead ? 0.3 : 1,
              borderWidth: currentTurn === enemy ? 2 : 0,
              borderColor: '#f38ba8',
              borderRadius: 8,
              padding: 8,
            }}>
              <Box style={{
                width: 32, height: 32, backgroundColor: enemy.sprite,
                borderRadius: 16,
              }} />
              <Text style={{ fontSize: 10, color: '#cdd6f4', fontWeight: 'bold' }}>{enemy.name}</Text>
              <HealthBar hp={enemy.combat.stats.hp} maxHp={enemy.combat.stats.maxHp} width={60} height={5} />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Action menu */}
      {isPlayerTurn && !victory && (
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: '#f9e2af' }}>{`${currentTurn.name}'s turn`}</Text>
          <Box style={{ flexDirection: 'row', gap: 6 }}>
            {[
              { label: 'Attack', action: doAttack, color: '#f38ba8' },
              { label: 'Defend', action: doDefend, color: '#89b4fa' },
              { label: `Skill (10 MP)`, action: doSkill, color: '#cba6f7' },
              { label: `Potion (${potionCount})`, action: doHeal, color: '#a6e3a1' },
            ].map((btn, i) => (
              <Box
                key={i}
                onClick={btn.action}
                style={{
                  backgroundColor: '#1e1e2e',
                  borderWidth: 1,
                  borderColor: btn.color,
                  borderRadius: 6,
                  paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                }}
              >
                <Text style={{ fontSize: 11, color: btn.color }}>{btn.label}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Battle log */}
      <Box style={{ gap: 1, height: 60, backgroundColor: '#1e1e2e', borderRadius: 6, padding: 6 }}>
        {battleLog.slice(-4).map((msg, i) => (
          <Text key={i} style={{ fontSize: 9, color: i === battleLog.length - 1 ? '#cdd6f4' : '#585b70' }}>
            {msg}
          </Text>
        ))}
      </Box>

      {/* XP bar */}
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: '#6c7086' }}>{`Lv.${progression.level}`}</Text>
        <StatusBar value={progression.xp} max={progression.xpToNext} width={100} height={4} fillColor="#f9e2af" />
        <Text style={{ fontSize: 9, color: '#6c7086' }}>{`${progression.xp}/${progression.xpToNext} XP`}</Text>
      </Box>

      {/* Victory overlay */}
      {victory && (
        <Box style={{
          position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}>
          <Box style={{
            backgroundColor: '#1e1e2e', padding: 24, borderRadius: 12,
            borderWidth: 2, borderColor: '#a6e3a1', gap: 8, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 20, color: '#a6e3a1', fontWeight: 'bold' }}>Victory!</Text>
            <Text style={{ fontSize: 13, color: '#cdd6f4' }}>+30 XP</Text>
            <Text style={{ fontSize: 11, color: '#6c7086' }}>{`Level: ${progression.level}`}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
