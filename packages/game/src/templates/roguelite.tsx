import React, { useState } from 'react';
import { Box, Text } from '@ilovereact/core';
import { HealthBar } from '../components/HealthBar';
import { Game } from '../GameCanvas';

interface RogueliteState {
  floor: number;
  score: number;
  hp: number;
  maxHp: number;
  gameOver: boolean;
  enemiesAlive: number;
  inventory: Array<{ name: string; quantity: number }>;
  messages: string[];
}

type ListLike<T> = T[] | Record<string, T> | null | undefined;

function normalizeList<T>(value: ListLike<T>): T[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  const keys = Object.keys(value);
  if (keys.length === 0) return [];

  const sortedKeys = keys
    .slice()
    .sort((a, b) => {
      const ai = Number(a);
      const bi = Number(b);
      const aIsInt = Number.isInteger(ai) && String(ai) === a;
      const bIsInt = Number.isInteger(bi) && String(bi) === b;
      if (aIsInt && bIsInt) return ai - bi;
      if (aIsInt) return -1;
      if (bIsInt) return 1;
      return a.localeCompare(b);
    });

  const record = value as Record<string, T>;
  return sortedKeys.map((key) => record[key]);
}

const INITIAL_STATE: RogueliteState = {
  floor: 1,
  score: 0,
  hp: 50,
  maxHp: 50,
  gameOver: false,
  enemiesAlive: 0,
  inventory: [],
  messages: [],
};

export function RogueliteTemplate() {
  const [state, setState] = useState<RogueliteState>(INITIAL_STATE);
  const recentMessages = normalizeList<string>(state.messages).slice(-3);
  const inventoryItems = normalizeList<{ name: string; quantity: number }>(state.inventory);

  return (
    <Game
      module="roguelite"
      instanceKey="roguelite-template"
      mode="react"
      config={{ moveCooldown: 0.12, viewRadius: 4, enemySenseRange: 8 }}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      on={{ state: (s: RogueliteState) => setState(s) }}
    >
      <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', padding: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, color: '#cdd6f4', fontWeight: 'bold' }}>Roguelite (Lua Runtime)</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 11, color: '#f9e2af' }}>{`Floor ${state.floor}`}</Text>
          <Text style={{ fontSize: 11, color: '#a6e3a1' }}>{`Score: ${state.score}`}</Text>
        </Box>
      </Box>

      <Box style={{ position: 'absolute', right: 8, top: 34, width: 140, gap: 8, backgroundColor: 'rgba(17,17,27,0.85)', borderWidth: 1, borderColor: '#313244', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: '#a6adc8' }}>HP</Text>
        <HealthBar hp={state.hp} maxHp={state.maxHp} width={120} height={8} />
        <Text style={{ fontSize: 9, color: '#6c7086' }}>{`${state.hp}/${state.maxHp}`}</Text>
        <Text style={{ fontSize: 10, color: '#a6adc8', marginTop: 4 }}>{`Enemies: ${state.enemiesAlive}`}</Text>
        <Box style={{ gap: 2, marginTop: 4 }}>
          <Text style={{ fontSize: 10, color: '#a6adc8', fontWeight: 'bold' }}>Items</Text>
          {inventoryItems.length === 0 && (
            <Text style={{ fontSize: 9, color: '#6c7086' }}>Empty</Text>
          )}
          {inventoryItems.map((it) => (
            <Text key={it.name} style={{ fontSize: 9, color: '#cdd6f4' }}>
              {`${it.name} x${it.quantity}`}
            </Text>
          ))}
        </Box>
      </Box>

      <Box style={{ position: 'absolute', left: 8, bottom: 8, width: 260, gap: 1 }}>
        {recentMessages.map((msg, i) => (
          <Text key={`${i}-${msg}`} style={{ fontSize: 9, color: i === recentMessages.length - 1 ? '#cdd6f4' : '#6c7086' }}>
            {msg}
          </Text>
        ))}
      </Box>

      <Box style={{ position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 16 }}>
        <Text style={{ fontSize: 9, color: '#6c7086' }}>Arrow keys / WASD to move</Text>
        <Text style={{ fontSize: 9, color: '#6c7086' }}>Bump into enemies to attack</Text>
      </Box>

      {state.gameOver && (
        <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' }}>
          <Box style={{ backgroundColor: '#1e1e2e', paddingLeft: 22, paddingRight: 22, paddingTop: 18, paddingBottom: 18, borderRadius: 10, borderWidth: 2, borderColor: '#f38ba8', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, color: '#f38ba8', fontWeight: 'bold' }}>Game Over</Text>
            <Text style={{ fontSize: 12, color: '#cdd6f4' }}>{`Final Score: ${state.score}`}</Text>
            <Text style={{ fontSize: 12, color: '#cdd6f4' }}>{`Reached Floor ${state.floor}`}</Text>
          </Box>
        </Box>
      )}
    </Game>
  );
}
