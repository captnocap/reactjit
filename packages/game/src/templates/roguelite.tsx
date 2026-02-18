import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text } from '@ilovereact/core';
import { useGameLoop } from '../core/useGameLoop';
import { useInput } from '../core/useInput';
import { useTilemap } from '../world/useTilemap';
import { useProcGen } from '../world/useProcGen';
import { useFogOfWar } from '../world/useFogOfWar';
import { useEntityPool } from '../entity/useEntityPool';
import { useCombat } from '../systems/useCombat';
import { useInventory } from '../systems/useInventory';
import { useLoot } from '../systems/useLoot';
import { HealthBar } from '../components/HealthBar';
import type { EntityState } from '../types';

const MAP_W = 40;
const MAP_H = 30;
const TILE_SIZE = 14;
const VIEW_W = 20;
const VIEW_H = 15;
const MOVE_COOLDOWN = 0.12;

export function RogueliteTemplate() {
  const renderCount = React.useRef(0);
  renderCount.current++;
  if (renderCount.current % 10 === 0 || renderCount.current < 20) {
    console.log('[rl:render] #' + renderCount.current);
  }

  const loop = useGameLoop();
  const input = useInput({
    actions: {
      up: { keys: ['arrowup', 'w'] },
      down: { keys: ['arrowdown', 's'] },
      left: { keys: ['arrowleft', 'a'] },
      right: { keys: ['arrowright', 'd'] },
    },
  });

  const procGen = useProcGen();

  // Generate dungeon once
  const dungeonData = useMemo(() => {
    return procGen.bspDungeon({ width: MAP_W, height: MAP_H, minRoomSize: 4, maxRoomSize: 8, corridorWidth: 1 });
  }, []);

  const tilemap = useTilemap({
    width: MAP_W, height: MAP_H, tileSize: TILE_SIZE,
    layers: { ground: dungeonData.tiles },
    tileTypes: {
      0: { name: 'empty', solid: false, color: null },
      1: { name: 'floor', solid: false, color: '#313244' },
      2: { name: 'wall', solid: true, color: '#585b70' },
    },
  });

  const fog = useFogOfWar({ width: MAP_W, height: MAP_H });
  const enemies = useEntityPool({ poolSize: 20 });

  const combat = useCombat({
    stats: { hp: 50, maxHp: 50, attack: 8, defense: 3 },
  });

  const inventory = useInventory({ slots: 10, maxStack: 10 });

  const loot = useLoot({
    tables: {
      enemy: [
        { item: 'gold', weight: 60, quantity: [1, 5] },
        { item: 'potion', weight: 30, quantity: 1 },
        { item: 'gem', weight: 10, quantity: 1, rarity: 'rare' },
      ],
    },
  });

  // Player grid position
  const [playerGx, setPlayerGx] = useState(0);
  const [playerGy, setPlayerGy] = useState(0);
  const [floor, setFloor] = useState(1);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [messages, setMessages] = useState<string[]>(['Entered the dungeon...']);
  const moveTimerRef = useRef(0);

  // Stable ref so the game loop interval (empty deps) always reads current values
  const gsRef = useRef({
    loop, input, tilemap, enemies, combat, loot, inventory,
    playerGx, playerGy, gameOver,
  });
  gsRef.current = { loop, input, tilemap, enemies, combat, loot, inventory, playerGx, playerGy, gameOver };

  // Place player in first room
  useEffect(() => {
    if (dungeonData.rooms.length > 0) {
      const room = dungeonData.rooms[0];
      setPlayerGx(Math.floor(room.x + room.width / 2));
      setPlayerGy(Math.floor(room.y + room.height / 2));
    }

    // Spawn enemies in other rooms
    for (let i = 1; i < dungeonData.rooms.length; i++) {
      const room = dungeonData.rooms[i];
      const ex = Math.floor(room.x + room.width / 2);
      const ey = Math.floor(room.y + room.height / 2);
      enemies.spawn({
        x: ex, y: ey, width: 1, height: 1,
        hp: 15 + floor * 5,
        attack: 3 + floor * 2,
        type: i === dungeonData.rooms.length - 1 ? 'boss' : 'skeleton',
      });
    }
  }, [dungeonData, floor]);

  // Update fog
  useEffect(() => {
    fog.updateVisibility(playerGx, playerGy, 4);
  }, [playerGx, playerGy]);

  // Game loop — empty deps so the interval is created ONCE and never recreated.
  // All game state is read from gsRef.current which is updated every render.
  useEffect(() => {
    const id = setInterval(() => {
      const { loop, input, tilemap, enemies, combat, loot, inventory, playerGx, playerGy, gameOver } = gsRef.current;

      if (loop.paused || gameOver) return;
      moveTimerRef.current += 1 / 60;
      if (moveTimerRef.current < MOVE_COOLDOWN) return;

      let dx = 0, dy = 0;
      if (input.held('up')) dy = -1;
      else if (input.held('down')) dy = 1;
      else if (input.held('left')) dx = -1;
      else if (input.held('right')) dx = 1;
      else return;

      moveTimerRef.current = 0;
      const nx = playerGx + dx;
      const ny = playerGy + dy;

      if (tilemap.isSolid(nx, ny)) return;

      // Check enemy collision (bump attack)
      const enemyAtPos = enemies.all.find(e => e.x === nx && e.y === ny && e.alive);
      if (enemyAtPos) {
        const dmg = Math.max(1, combat.stats.attack - (enemyAtPos.attack as number ?? 0) * 0.3);
        enemyAtPos.hp = (enemyAtPos.hp as number) - dmg;
        setMessages(prev => [...prev.slice(-4), `Hit ${enemyAtPos.type} for ${Math.floor(dmg)} dmg`]);

        if ((enemyAtPos.hp as number) <= 0) {
          enemies.despawn(enemyAtPos);
          const drops = loot.roll('enemy');
          for (const drop of drops) {
            inventory.add({ id: drop.item, name: drop.item, quantity: drop.quantity });
          }
          setScore(s => s + (enemyAtPos.type === 'boss' ? 50 : 10));
          setMessages(prev => [...prev.slice(-4), `Defeated ${enemyAtPos.type}!`]);
        } else {
          const eDmg = Math.max(1, (enemyAtPos.attack as number) - combat.stats.defense * 0.5);
          combat.takeDamage({ amount: eDmg, type: 'physical' });
          setMessages(prev => [...prev.slice(-4), `${enemyAtPos.type} hits back for ${Math.floor(eDmg)}`]);
          if (combat.isDead) {
            setGameOver(true);
            setMessages(prev => [...prev.slice(-4), 'You died!']);
          }
        }
        return;
      }

      setPlayerGx(nx);
      setPlayerGy(ny);

      // Move enemies toward player (greedy step — O(3) per enemy, safe for QuickJS)
      enemies.all.forEach(e => {
        if (!e.alive) return;
        const ex = e.x as number;
        const ey = e.y as number;
        const dist = Math.abs(ex - nx) + Math.abs(ey - ny);
        if (dist > 8) return;

        const ddx = nx > ex ? 1 : nx < ex ? -1 : 0;
        const ddy = ny > ey ? 1 : ny < ey ? -1 : 0;

        const candidates: [number, number][] = ddx !== 0 && ddy !== 0
          ? [[ddx, 0], [0, ddy]]
          : ddx !== 0
            ? [[ddx, 0], [0, 1], [0, -1]]
            : [[0, ddy], [1, 0], [-1, 0]];

        for (const [cx, cy] of candidates) {
          const tx = ex + cx;
          const ty = ey + cy;
          if (tilemap.isSolid(tx, ty)) continue;
          if (tx === nx && ty === ny) break;
          if (enemies.all.some(o => o !== e && o.alive && o.x === tx && o.y === ty)) continue;
          e.x = tx;
          e.y = ty;
          break;
        }
      });
    }, 16);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera offset for viewport centering
  const camGx = playerGx - Math.floor(VIEW_W / 2);
  const camGy = playerGy - Math.floor(VIEW_H / 2);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#11111b', gap: 4, padding: 8 }}>
      {/* Header */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
        <Text style={{ fontSize: 14, color: '#cdd6f4', fontWeight: 'bold' }}>Roguelite Dungeon</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 11, color: '#f9e2af' }}>{`Floor ${floor}`}</Text>
          <Text style={{ fontSize: 11, color: '#a6e3a1' }}>{`Score: ${score}`}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1 }}>
        {/* Game viewport */}
        <Box style={{
          width: VIEW_W * TILE_SIZE, height: VIEW_H * TILE_SIZE,
          backgroundColor: '#0b0b14', overflow: 'hidden', position: 'relative',
          borderWidth: 1, borderColor: '#313244', borderRadius: 4,
        }}>
          {/* Tiles */}
          {Array.from({ length: VIEW_H }, (_, vy) =>
            Array.from({ length: VIEW_W }, (_, vx) => {
              const gx = camGx + vx;
              const gy = camGy + vy;
              if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return null;

              const vis = fog.getVisibility(gx, gy);
              if (vis === 'hidden') return null;

              const tileId = tilemap.getTile('ground', gx, gy);
              const tt = tilemap.tileTypes[tileId];
              if (!tt?.color) return null;

              return (
                <Box key={`${vx},${vy}`} style={{
                  position: 'absolute',
                  left: vx * TILE_SIZE, top: vy * TILE_SIZE,
                  width: TILE_SIZE, height: TILE_SIZE,
                  backgroundColor: tt.color,
                  opacity: vis === 'revealed' ? 0.4 : 1,
                }} />
              );
            }),
          )}

          {/* Enemies */}
          {enemies.all.filter(e => e.alive).map(e => {
            const vx = (e.x as number) - camGx;
            const vy = (e.y as number) - camGy;
            if (vx < 0 || vx >= VIEW_W || vy < 0 || vy >= VIEW_H) return null;
            if (fog.getVisibility(e.x as number, e.y as number) !== 'visible') return null;
            const isBoss = e.type === 'boss';
            return (
              <Box key={e.id} style={{
                position: 'absolute',
                left: vx * TILE_SIZE + 2, top: vy * TILE_SIZE + 2,
                width: TILE_SIZE - 4, height: TILE_SIZE - 4,
                backgroundColor: isBoss ? '#f38ba8' : '#eba0ac',
                borderRadius: 2,
              }} />
            );
          })}

          {/* Player */}
          <Box style={{
            position: 'absolute',
            left: Math.floor(VIEW_W / 2) * TILE_SIZE + 2,
            top: Math.floor(VIEW_H / 2) * TILE_SIZE + 2,
            width: TILE_SIZE - 4, height: TILE_SIZE - 4,
            backgroundColor: '#89b4fa', borderRadius: 2,
          }} />
        </Box>

        {/* Sidebar */}
        <Box style={{ width: 130, gap: 8 }}>
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 10, color: '#a6adc8' }}>HP</Text>
            <HealthBar hp={combat.stats.hp} maxHp={combat.stats.maxHp} width={120} height={8} />
            <Text style={{ fontSize: 9, color: '#6c7086' }}>{`${combat.stats.hp}/${combat.stats.maxHp}`}</Text>
          </Box>

          {/* Minimap placeholder — full map as Box nodes is too many Lua nodes for QuickJS.
              Needs canvas/image-based implementation. */}
          <Box style={{ width: 120, height: 90, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: '#334155' }}>map</Text>
          </Box>

          {/* Inventory summary */}
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: '#a6adc8', fontWeight: 'bold' }}>Items</Text>
            {inventory.slots.filter(s => s.item).map((s, i) => (
              <Text key={i} style={{ fontSize: 9, color: '#cdd6f4' }}>
                {`${s.item!.name} x${s.item!.quantity}`}
              </Text>
            ))}
            {inventory.usedSlots === 0 && (
              <Text style={{ fontSize: 9, color: '#6c7086' }}>Empty</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Message log */}
      <Box style={{ gap: 1, height: 50 }}>
        {messages.slice(-3).map((msg, i) => (
          <Text key={i} style={{ fontSize: 9, color: i === messages.length - 1 ? '#cdd6f4' : '#6c7086' }}>
            {msg}
          </Text>
        ))}
      </Box>

      {/* Controls */}
      <Box style={{ flexDirection: 'row', gap: 16 }}>
        <Text style={{ fontSize: 9, color: '#6c7086' }}>Arrow keys / WASD to move</Text>
        <Text style={{ fontSize: 9, color: '#6c7086' }}>Bump into enemies to attack</Text>
      </Box>

      {/* Game over overlay */}
      {gameOver && (
        <Box style={{
          position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}>
          <Box style={{
            backgroundColor: '#1e1e2e', padding: 24, borderRadius: 12,
            borderWidth: 2, borderColor: '#f38ba8', gap: 8, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 20, color: '#f38ba8', fontWeight: 'bold' }}>Game Over</Text>
            <Text style={{ fontSize: 13, color: '#cdd6f4' }}>{`Final Score: ${score}`}</Text>
            <Text style={{ fontSize: 13, color: '#cdd6f4' }}>{`Reached Floor ${floor}`}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
