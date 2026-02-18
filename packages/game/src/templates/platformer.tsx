import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text } from '@ilovereact/core';
import { useGameLoop } from '../core/useGameLoop';
import { useInput } from '../core/useInput';
import { useCamera } from '../core/useCamera';
import { useTilemap } from '../world/useTilemap';
import { usePlatformer } from '../physics/usePlatformer';
import { useEntityPool } from '../entity/useEntityPool';
import { useCollision } from '../physics/useCollision';
import { EntitySprite } from '../components/EntitySprite';
import { StatusBar } from '../components/StatusBar';
import type { EntityState } from '../types';

// Level layout: 0=empty, 1=floor, 2=wall
const LEVEL: number[][] = [
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,2],
  [2,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,2],
  [2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
];

const TILE_SIZE = 16;
const COIN_POSITIONS = [
  { x: 7 * TILE_SIZE, y: 7 * TILE_SIZE },
  { x: 14 * TILE_SIZE, y: 8 * TILE_SIZE },
  { x: 23 * TILE_SIZE, y: 9 * TILE_SIZE },
  { x: 4 * TILE_SIZE, y: 10 * TILE_SIZE },
  { x: 18 * TILE_SIZE, y: 12 * TILE_SIZE },
  { x: 28 * TILE_SIZE, y: 11 * TILE_SIZE },
  { x: 11 * TILE_SIZE, y: 11 * TILE_SIZE },
  { x: 19 * TILE_SIZE, y: 7 * TILE_SIZE },
];

export function PlatformerTemplate() {
  const loop = useGameLoop({ fixedStep: 1 / 60 });
  const input = useInput({
    actions: {
      moveLeft: { keys: ['arrowleft', 'a'] },
      moveRight: { keys: ['arrowright', 'd'] },
      jump: { keys: [' ', 'w', 'arrowup'] },
    },
  });

  const tilemap = useTilemap({
    width: 30, height: 15, tileSize: TILE_SIZE,
    layers: { ground: LEVEL },
    tileTypes: {
      0: { name: 'empty', solid: false, color: null },
      1: { name: 'floor', solid: false, color: '#45475a' },
      2: { name: 'wall', solid: true, color: '#585b70' },
    },
  });

  // Player entity state
  const [playerState, setPlayerState] = useState({
    x: 3 * TILE_SIZE, y: 12 * TILE_SIZE,
    vx: 0, vy: 0, width: 12, height: 14,
  });
  const playerRef = useRef(playerState);
  playerRef.current = playerState;

  const platformer = usePlatformer(
    playerRef.current as EntityState,
    tilemap.solids,
    { gravity: 600, jumpForce: 280, moveSpeed: 120, maxFallSpeed: 350, coyoteTime: 0.08, jumpBuffer: 0.08 },
  );

  // Coins
  const [coins, setCoins] = useState(() =>
    COIN_POSITIONS.map((pos, i) => ({ ...pos, collected: false, id: i }))
  );
  const [score, setScore] = useState(0);

  // Game loop
  useEffect(() => {
    const id = setInterval(() => {
      if (loop.paused) return;
      const dt = 1 / 60;
      const p = { ...playerRef.current } as EntityState;
      p.alive = true;
      p.id = 1;

      platformer.update(dt, {
        left: input.held('moveLeft'),
        right: input.held('moveRight'),
        jump: input.pressed('jump'),
      });

      // Check coin collection
      setCoins(prev => {
        let changed = false;
        const next = prev.map(coin => {
          if (coin.collected) return coin;
          const dx = Math.abs((p.x + p.width / 2) - (coin.x + 6));
          const dy = Math.abs((p.y + p.height / 2) - (coin.y + 6));
          if (dx < 14 && dy < 14) {
            changed = true;
            setScore(s => s + 10);
            return { ...coin, collected: true };
          }
          return coin;
        });
        return changed ? next : prev;
      });

      setPlayerState({ ...p });
    }, 16);
    return () => clearInterval(id);
  }, [loop.paused, platformer, input]);

  const allCollected = coins.every(c => c.collected);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#1e1e2e' }}>
      {/* HUD */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, width: '100%' }}>
        <Text style={{ fontSize: 14, color: '#cdd6f4', fontWeight: 'bold' }}>Platformer</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 12, color: '#f9e2af' }}>{`Score: ${score}`}</Text>
          <Text style={{ fontSize: 12, color: '#a6e3a1' }}>
            {`Coins: ${coins.filter(c => c.collected).length}/${coins.length}`}
          </Text>
        </Box>
      </Box>

      {/* Game world */}
      <Box style={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Tiles */}
        {LEVEL.map((row, gy) =>
          row.map((tile, gx) => {
            if (tile === 0) return null;
            const color = tile === 2 ? '#585b70' : '#45475a';
            return (
              <Box
                key={`${gx},${gy}`}
                style={{
                  position: 'absolute',
                  left: gx * TILE_SIZE,
                  top: gy * TILE_SIZE,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  backgroundColor: color,
                }}
              />
            );
          }),
        )}

        {/* Coins */}
        {coins.map(coin =>
          coin.collected ? null : (
            <Box
              key={`coin-${coin.id}`}
              style={{
                position: 'absolute',
                left: coin.x + 3,
                top: coin.y + 3,
                width: 10,
                height: 10,
                backgroundColor: '#f9e2af',
                borderRadius: 5,
              }}
            />
          ),
        )}

        {/* Player */}
        <Box
          style={{
            position: 'absolute',
            left: playerState.x,
            top: playerState.y,
            width: playerState.width,
            height: playerState.height,
            backgroundColor: '#89b4fa',
            borderRadius: 2,
          }}
        />

        {/* Win message */}
        {allCollected && (
          <Box
            style={{
              position: 'absolute',
              left: 100,
              top: 80,
              backgroundColor: '#1e1e2e',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 12,
              paddingBottom: 12,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: '#a6e3a1',
            }}
          >
            <Text style={{ fontSize: 16, color: '#a6e3a1', fontWeight: 'bold' }}>All coins collected!</Text>
          </Box>
        )}
      </Box>

      {/* Controls hint */}
      <Box style={{ padding: 6, flexDirection: 'row', gap: 16 }}>
        <Text style={{ fontSize: 10, color: '#6c7086' }}>Arrow keys / WASD to move</Text>
        <Text style={{ fontSize: 10, color: '#6c7086' }}>Space / W / Up to jump</Text>
        <Text style={{ fontSize: 10, color: '#6c7086' }}>{`FPS: ${loop.fps}`}</Text>
      </Box>
    </Box>
  );
}
