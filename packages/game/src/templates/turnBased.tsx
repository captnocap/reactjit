import React, { useCallback, useState } from 'react';
import { Box, Text, useBridge } from '@ilovereact/core';
import { HealthBar } from '../components/HealthBar';
import { StatusBar } from '../components/StatusBar';
import { Game } from '../GameCanvas';

interface CombatantView {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  alive: boolean;
  defending: boolean;
}

interface TurnBasedState {
  phase: 'play' | 'victory' | 'gameover';
  party: CombatantView[];
  enemies: CombatantView[];
  turnName?: string;
  isPlayerTurn: boolean;
  victory: boolean;
  gameOver: boolean;
  battleLog: string[];
  level: number;
  xp: number;
  xpToNext: number;
  potions: number;
}

type ListLike<T> = T[] | Record<string, T> | null | undefined;

function normalizeList<T>(value: ListLike<T>): T[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const keys = Object.keys(value);
  if (keys.length === 0) return [];
  return keys
    .slice()
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => (value as Record<string, T>)[k]);
}

const INITIAL_STATE: TurnBasedState = {
  phase: 'play',
  party: [],
  enemies: [],
  turnName: undefined,
  isPlayerTurn: false,
  victory: false,
  gameOver: false,
  battleLog: ['A wild Slime appeared!'],
  level: 1,
  xp: 0,
  xpToNext: 50,
  potions: 3,
};

export function TurnBasedTemplate() {
  const bridge = useBridge();
  const [state, setState] = useState<TurnBasedState>(INITIAL_STATE);

  const sendCommand = useCallback((command: string) => {
    bridge.rpc('game:command', {
      module: 'turnbased',
      instanceKey: 'turnbased-template',
      command,
    });
  }, [bridge]);

  const party = normalizeList<CombatantView>(state.party);
  const enemies = normalizeList<CombatantView>(state.enemies);
  const battleLog = normalizeList<string>(state.battleLog).slice(-4);

  return (
    <Game
      module="turnbased"
      instanceKey="turnbased-template"
      mode="react"
      style={{ width: '100%', height: '100%', position: 'relative' }}
      on={{ state: (s: TurnBasedState) => setState(s) }}
    >
      <Box style={{ width: '100%', height: '100%', backgroundColor: 'rgba(17,17,27,0.55)', padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 16, color: '#cdd6f4', fontWeight: 'bold' }}>Turn-Based Battle (Lua Runtime)</Text>

        <Box style={{ flexDirection: 'row', justifyContent: 'space-around', flexGrow: 1, width: '100%', alignItems: 'center' }}>
          <Box style={{ gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#a6adc8', fontWeight: 'bold' }}>Party</Text>
            {party.map((member) => (
              <Box key={member.id} style={{ gap: 4, alignItems: 'center', opacity: member.alive ? 1 : 0.3, borderWidth: state.turnName === member.name ? 2 : 0, borderColor: '#f9e2af', borderRadius: 8, padding: 8 }}>
                <Box style={{ width: 32, height: 32, backgroundColor: member.color, borderRadius: 4 }} />
                <Text style={{ fontSize: 10, color: '#cdd6f4', fontWeight: 'bold' }}>{member.name}</Text>
                <HealthBar hp={member.hp} maxHp={member.maxHp} width={60} height={5} />
                {member.maxMp != null && (
                  <StatusBar value={member.mp ?? 0} max={member.maxMp} width={60} height={4} fillColor="#89b4fa" />
                )}
              </Box>
            ))}
          </Box>

          <Text style={{ fontSize: 20, color: '#6c7086' }}>VS</Text>

          <Box style={{ gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: '#a6adc8', fontWeight: 'bold' }}>Enemies</Text>
            {enemies.map((enemy) => (
              <Box key={enemy.id} style={{ gap: 4, alignItems: 'center', opacity: enemy.alive ? 1 : 0.3, borderWidth: state.turnName === enemy.name ? 2 : 0, borderColor: '#f38ba8', borderRadius: 8, padding: 8 }}>
                <Box style={{ width: 32, height: 32, backgroundColor: enemy.color, borderRadius: 16 }} />
                <Text style={{ fontSize: 10, color: '#cdd6f4', fontWeight: 'bold' }}>{enemy.name}</Text>
                <HealthBar hp={enemy.hp} maxHp={enemy.maxHp} width={60} height={5} />
              </Box>
            ))}
          </Box>
        </Box>

        {state.isPlayerTurn && !state.victory && !state.gameOver && (
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 11, color: '#f9e2af' }}>{`${state.turnName ?? 'Party'}'s turn`}</Text>
            <Box style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: 'Attack', command: 'attack', color: '#f38ba8' },
                { label: 'Defend', command: 'defend', color: '#89b4fa' },
                { label: 'Skill (10 MP)', command: 'skill', color: '#cba6f7' },
                { label: `Potion (${state.potions})`, command: 'potion', color: '#a6e3a1' },
              ].map((btn) => (
                <Box key={btn.command} onClick={() => sendCommand(btn.command)} style={{ backgroundColor: '#1e1e2e', borderWidth: 1, borderColor: btn.color, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: btn.color }}>{btn.label}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Box style={{ gap: 1, height: 60, backgroundColor: '#1e1e2e', borderRadius: 6, padding: 6 }}>
          {battleLog.map((msg, i) => (
            <Text key={`${i}-${msg}`} style={{ fontSize: 9, color: i === battleLog.length - 1 ? '#cdd6f4' : '#585b70' }}>
              {msg}
            </Text>
          ))}
        </Box>

        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, color: '#6c7086' }}>{`Lv.${state.level}`}</Text>
          <StatusBar value={state.xp} max={state.xpToNext} width={100} height={4} fillColor="#f9e2af" />
          <Text style={{ fontSize: 9, color: '#6c7086' }}>{`${state.xp}/${state.xpToNext} XP`}</Text>
        </Box>
      </Box>

      {(state.victory || state.gameOver) && (
        <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Box style={{ backgroundColor: '#1e1e2e', padding: 24, borderRadius: 12, borderWidth: 2, borderColor: state.victory ? '#a6e3a1' : '#f38ba8', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, color: state.victory ? '#a6e3a1' : '#f38ba8', fontWeight: 'bold' }}>{state.victory ? 'Victory!' : 'Game Over'}</Text>
            <Text style={{ fontSize: 13, color: '#cdd6f4' }}>{state.victory ? '+30 XP' : 'Party wiped...'}</Text>
            <Box onClick={() => sendCommand('restart')} style={{ marginTop: 8, backgroundColor: '#11111b', borderWidth: 1, borderColor: '#89b4fa', borderRadius: 6, paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6 }}>
              <Text style={{ fontSize: 11, color: '#89b4fa' }}>Restart</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Game>
  );
}
