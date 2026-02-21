import React, { useState, useCallback } from 'react';
import { Box, Text, useBridge } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Game } from '../../../packages/game/src';

interface GameState {
  screen: string;
  round: number;
  timer: number;
  points: number;
  asteroids: number;
  roundStats?: { round: number; destroyed: number; points: number };
  shopData?: {
    points: number;
    nextRound: number;
    upgrades: Array<{
      name: string;
      label: string;
      level: number;
      cost: number | null;
      maxed: boolean;
      canAfford: boolean;
      preview: string;
    }>;
  };
}

function HUDOverlay({ state }: { state: GameState }) {
  const timerLow = state.timer <= 5;
  return (
    <>
      <Box style={{ position: 'absolute', top: 8, left: 12 }}>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{`Round ${state.round}`}</Text>
      </Box>
      <Box style={{ position: 'absolute', top: 8, left: 0, width: '100%', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: timerLow ? '#ff3333' : 'rgba(255,255,255,0.8)' }}>
          {state.timer.toFixed(1)}
        </Text>
        <Text style={{ fontSize: 11, color: 'rgba(153,153,153,0.6)' }}>
          {`Asteroids: ${state.asteroids}`}
        </Text>
      </Box>
      <Box style={{ position: 'absolute', top: 8, right: 12 }}>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
          {`Points: ${Math.floor(state.points)}`}
        </Text>
      </Box>
    </>
  );
}

function TitleOverlay() {
  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 36, color: '#9933ff', fontWeight: 'bold' }}>BLACKHOLE</Text>
      <Text style={{ fontSize: 14, color: 'rgba(153,153,153,0.6)', marginTop: 16 }}>Click to begin</Text>
    </Box>
  );
}

function RoundOverOverlay({ state }: { state: GameState }) {
  const stats = state.roundStats;
  if (!stats) return null;
  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, color: '#9933ff', fontWeight: 'bold' }}>
        {`Round ${stats.round} Complete`}
      </Text>
      <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 12 }}>
        {`Asteroids Destroyed: ${stats.destroyed}`}
      </Text>
      <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
        {`Points Earned: ${Math.floor(stats.points)}`}
      </Text>
      <Text style={{ fontSize: 11, color: 'rgba(128,128,128,0.6)', marginTop: 16 }}>Click to skip</Text>
    </Box>
  );
}

function ShopOverlay({ state, onBuy }: { state: GameState; onBuy: (name: string) => void }) {
  const c = useThemeColors();
  const shop = state.shopData;
  if (!shop) return null;

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', padding: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 20, color: '#9933ff', fontWeight: 'bold' }}>UPGRADES</Text>
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
        {`Points: ${Math.floor(shop.points)}`}
      </Text>
      <Text style={{ fontSize: 10, color: 'rgba(153,153,153,0.7)', marginTop: 2 }}>
        {`Preparing Round ${shop.nextRound}`}
      </Text>

      <Box style={{ gap: 3, marginTop: 8, width: '90%' }}>
        {shop.upgrades.map((u) => (
          <Box
            key={u.name}
            onClick={() => {
              console.log('[shop-click] u=' + u.name + ' canAfford=' + u.canAfford + ' maxed=' + u.maxed);
              if (u.canAfford && !u.maxed) onBuy(u.name);
            }}
            hoverStyle={{
              backgroundColor: u.canAfford ? 'rgba(77,38,128,0.5)' : 'rgba(51,26,77,0.4)',
              borderColor: 'rgba(153,77,255,0.4)',
            }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(26,13,40,0.5)',
              borderWidth: 1,
              borderColor: 'rgba(77,38,128,0.3)',
              borderRadius: 4,
              padding: 5,
              paddingLeft: 10,
              paddingRight: 10,
              width: '100%',
            }}
          >
            <Box style={{ gap: 1 }}>
              <Text style={{
                fontSize: 11,
                color: u.canAfford ? 'rgba(255,255,255,1)' : 'rgba(128,128,128,0.5)',
                fontWeight: 'bold',
              }}>
                {`${u.label}  Lv ${u.level}`}
              </Text>
              <Text style={{ fontSize: 9, color: 'rgba(179,179,179,0.7)' }}>{u.preview}</Text>
            </Box>
            <Text style={{
              fontSize: 12,
              color: u.maxed ? 'rgba(128,128,128,0.4)' : u.canAfford ? '#4de650' : 'rgba(153,77,77,0.6)',
              fontWeight: 'bold',
            }}>
              {u.maxed ? 'MAX' : u.cost != null ? String(u.cost) : ''}
            </Text>
          </Box>
        ))}
      </Box>

      <Text style={{ fontSize: 9, color: 'rgba(128,128,128,0.5)', marginTop: 8 }}>
        Click card to buy | Space to start round
      </Text>
    </Box>
  );
}

export function BlackholeStory() {
  const bridge = useBridge();
  const [gameState, setGameState] = useState<GameState>({
    screen: 'title', round: 0, timer: 0, points: 0, asteroids: 0,
  });

  const sendCommand = useCallback((command: string, args?: any) => {
    console.log('[sendCommand] ' + command + ' args=' + JSON.stringify(args));
    bridge.rpc('game:command', { module: 'blackhole', command, args });
  }, [bridge]);

  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: '100%', gap: 2 }}>
      {/* LEFT: Original game with love.graphics.print UI */}
      <Box style={{ flexGrow: 1, gap: 0 }}>
        <Box style={{ padding: 4, paddingLeft: 8, backgroundColor: '#1a1a2e' }}>
          <Text style={{ fontSize: 9, color: '#555' }}>Before (love.graphics)</Text>
        </Box>
        <Game module="blackhole" mode="original" style={{ flexGrow: 1 }} />
      </Box>

      {/* RIGHT: Same game, React UI overlay */}
      <Box style={{ flexGrow: 1, gap: 0 }}>
        <Box style={{ padding: 4, paddingLeft: 8, backgroundColor: '#1a1a2e' }}>
          <Text style={{ fontSize: 9, color: '#555' }}>After (ReactJIT)</Text>
        </Box>
        <Game
          module="blackhole"
          mode="react"
          style={{ flexGrow: 1 }}
          on={{ state: (data: GameState) => setGameState(data) }}
        >
          {gameState.screen === 'title' && <TitleOverlay />}
          {gameState.screen === 'playing' && <HUDOverlay state={gameState} />}
          {gameState.screen === 'roundover' && <RoundOverOverlay state={gameState} />}
          {gameState.screen === 'shop' && <ShopOverlay state={gameState} onBuy={(name) => sendCommand('buy', { upgrade: name })} />}
        </Game>
      </Box>
    </Box>
  );
}
