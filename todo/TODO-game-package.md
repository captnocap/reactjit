# TODO: @ilovereact/game — Game Logic Hooks, Systems, and Genre Templates

## Vision

iLoveReact runs on Love2D — a game engine. The rendering pipeline already handles layout, animation, audio, and input. What's missing is the logic layer between "I have UI components" and "I have a game." This package fills that gap: common game systems as React hooks, data structures for things every game needs (inventories, skill trees, stats), and genre-specific starter templates that get someone from zero to playable in minutes.

The philosophy: **dead simple API, real game output.** A roguelite dungeon in 80 lines. A turn-based battle in 60. A platformer in 50. Not because we're cutting corners — because the hooks do the heavy lifting and the framework already handles rendering.

```tsx
import { useGameLoop, useTilemap, useEntity, useCollision } from '@ilovereact/game';
import { Box, Text, Image } from '@ilovereact/core';

function MyGame() {
  const { dt, tick, fps } = useGameLoop();
  const player = useEntity({ x: 100, y: 100, vx: 0, vy: 0, hp: 100 });
  const map = useTilemap(dungeonLayout, { tileSize: 16 });
  const { colliding } = useCollision(player, map.solids);

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <TilemapView tilemap={map} />
      <EntitySprite entity={player} sprite="hero.png" />
      <HUD hp={player.state.hp} fps={fps} />
    </Box>
  );
}
```

## What already exists (build on this)

| Existing | Where | Relevance |
|----------|-------|-----------|
| Spring/easing animation | `packages/shared/src/animation.ts` | UI tweens, juice effects, smooth movement |
| `useLoveState` / `useLoveEvent` / `useLoveRPC` | `packages/shared/src/hooks.ts` | React ↔ Lua state sync (the bridge) |
| Gamepad events | `packages/native/src/eventDispatcher.ts` | `gamepadpressed`, `gamepadreleased`, `gamepadaxis` |
| Keyboard/mouse events | Same | `keydown`, `keyup`, `click`, `wheel` |
| Audio package | `packages/audio/` | Sound effects, music, MIDI |
| HUD example | `examples/native-hud/` | Proves the React overlay + Lua game loop pattern |
| Box-based geometry rendering | `lua/painter.lua` | Everything is already boxes — tiles, sprites, UI |
| `useHotkey` | `packages/shared/src/hooks.ts` | Keyboard shortcut binding |
| `useWindowDimensions` | Same | Viewport-aware layouts |

## Package: `packages/game/`

### Architecture

```
@ilovereact/game
├── src/
│   ├── index.ts                  # Public API exports
│   │
│   ├── core/                     # Foundation hooks — every game needs these
│   │   ├── useGameLoop.ts        # Fixed-timestep game loop with dt, tick, fps
│   │   ├── useGameState.ts       # Finite state machine for game phases (menu/play/pause/gameover)
│   │   ├── useInput.ts           # Unified input mapping (keyboard + gamepad + touch → actions)
│   │   ├── useCamera.ts          # 2D camera: follow, offset, shake, zoom, bounds
│   │   └── useTimer.ts           # Cooldowns, delays, intervals tied to game time (not wall time)
│   │
│   ├── entity/                   # Entity management
│   │   ├── useEntity.ts          # Single entity: position, velocity, state, update callback
│   │   ├── useEntityPool.ts      # Managed pool of entities (enemies, projectiles, particles)
│   │   ├── useSpawner.ts         # Timed/wave/conditional entity spawning
│   │   └── useStateMachine.ts    # Per-entity FSM (idle/walk/attack/hurt/dead)
│   │
│   ├── physics/                  # 2D physics (simple, not Box2D)
│   │   ├── usePhysics.ts         # Gravity, velocity, acceleration, friction
│   │   ├── useCollision.ts       # AABB and circle collision detection + resolution
│   │   ├── usePlatformer.ts      # Gravity + jump + ground detection + coyote time
│   │   └── useProjectile.ts      # Bullet/arrow: spawn, move, collide, despawn
│   │
│   ├── world/                    # World building
│   │   ├── useTilemap.ts         # 2D tile grid: layers, collision mask, tile queries
│   │   ├── usePathfinding.ts     # A* on tilemaps or arbitrary graphs
│   │   ├── useFogOfWar.ts        # Visibility mask: revealed/visible/hidden per tile
│   │   ├── useRoomGraph.ts       # Room-based world (roguelike dungeon, metroidvania)
│   │   └── useProcGen.ts         # Procedural generation primitives (BSP dungeon, noise, cellular automata)
│   │
│   ├── systems/                  # Game systems — the reusable "lego bricks"
│   │   ├── useInventory.ts       # Slots, stacking, drag-and-drop, weight/capacity
│   │   ├── useSkillTree.ts       # Node graph: prerequisites, point allocation, reset
│   │   ├── useCombat.ts          # HP, damage, defense, buffs/debuffs, damage types
│   │   ├── useDialogue.ts        # Branching dialogue: nodes, choices, conditions, events
│   │   ├── useCrafting.ts        # Recipe registry, ingredient check, craft action
│   │   ├── useQuest.ts           # Quest log: objectives, progress, completion, rewards
│   │   ├── useEconomy.ts         # Currencies, prices, buy/sell, inflation
│   │   ├── useLoot.ts            # Loot tables: weighted random, rarity tiers, drop rates
│   │   ├── useProgression.ts     # XP, levels, stat growth, prestige/ascension
│   │   └── useAchievements.ts    # Achievement definitions, unlock conditions, progress tracking
│   │
│   ├── components/               # Ready-made UI components for games
│   │   ├── TilemapView.tsx       # Renders a tilemap hook's data as a grid of colored Boxes
│   │   ├── EntitySprite.tsx      # Renders an entity at its position (Image or Box art)
│   │   ├── Minimap.tsx           # Scaled-down world view with entity markers
│   │   ├── HealthBar.tsx         # Configurable HP bar (color ramps, segments, animation)
│   │   ├── DamageNumber.tsx      # Floating damage/heal text with spring animation
│   │   ├── InventoryGrid.tsx     # Grid of slots bound to useInventory
│   │   ├── SkillTreeView.tsx     # Visual node graph bound to useSkillTree
│   │   ├── DialogueBox.tsx       # Text box with typewriter effect + choice buttons
│   │   ├── QuestLog.tsx          # Quest list with objectives and progress
│   │   └── StatusBar.tsx         # Horizontal bar for HP/MP/XP/stamina/anything
│   │
│   └── templates/                # Genre starters (see below)
│       ├── roguelite.tsx
│       ├── turnBased.tsx
│       ├── platformer.tsx
│       ├── towerDefense.tsx
│       ├── cardGame.tsx
│       ├── idleClicker.tsx
│       ├── topDown.tsx
│       ├── survivalCraft.tsx
│       ├── bulletHell.tsx
│       └── visualNovel.tsx
```

---

## Core hooks — detailed design

### `useGameLoop`

The heartbeat. Gives you a fixed-timestep update tied to Love2D's frame rate, not React reconciliation. Game logic runs here — not in useEffect, not in render.

```tsx
const { dt, tick, fps, paused, pause, resume, timeScale } = useGameLoop({
  fixedStep: 1/60,    // physics timestep (default 1/60)
  maxSteps: 4,        // max catch-up steps per frame (prevents spiral of death)
  timeScale: 1,       // slow-mo or fast-forward
});

// Register update callbacks
useGameLoop.onUpdate((dt) => {
  player.x += player.vx * dt;
  player.y += player.vy * dt;
});
```

Under the hood: uses `useLoveEvent` to listen for frame ticks from Lua, accumulates delta time, runs fixed-step updates. The Lua side already sends frame events — we just need to subscribe.

### `useInput`

Maps raw keyboard/gamepad/touch events to game actions. No more checking `keydown === 'ArrowLeft'` — you define actions and bind them.

```tsx
const input = useInput({
  actions: {
    moveLeft:  { keys: ['ArrowLeft', 'a'],  gamepad: 'dpad_left' },
    moveRight: { keys: ['ArrowRight', 'd'], gamepad: 'dpad_right' },
    jump:      { keys: ['Space', 'w'],      gamepad: 'a' },
    attack:    { keys: ['x'],               gamepad: 'x' },
    pause:     { keys: ['Escape'],          gamepad: 'start' },
  },
});

// In game loop:
if (input.held('moveLeft'))  player.vx = -speed;
if (input.pressed('jump'))   player.vy = -jumpForce;  // pressed = this frame only
if (input.released('attack')) launchCharge();
```

Supports: `pressed` (just this frame), `held` (currently down), `released` (just this frame), `axis` (analog stick), rebinding at runtime, dead zone config.

### `useCamera`

2D camera that follows a target with optional constraints, shake, and zoom.

```tsx
const camera = useCamera({
  follow: { x: player.x, y: player.y },
  smoothing: 0.1,          // lerp factor (0 = instant, 1 = never catches up)
  bounds: { x: 0, y: 0, w: mapWidth, h: mapHeight },  // don't scroll past edges
  zoom: 1,
  offset: { x: 0, y: -40 },  // look-ahead offset
});

// Shake on hit
camera.shake({ intensity: 8, duration: 300, decay: 'exponential' });

// Apply to world container
<Box style={{ transform: `translate(${-camera.x}, ${-camera.y}) scale(${camera.zoom})` }}>
  {/* world content */}
</Box>
```

### `useStateMachine`

Generic FSM for entities, game phases, AI behavior — anything with discrete states and transitions.

```tsx
const enemy = useStateMachine({
  initial: 'patrol',
  states: {
    patrol:  { onEnter: pickWaypoint, onUpdate: moveToWaypoint, transitions: { playerNear: 'chase' } },
    chase:   { onEnter: alert, onUpdate: moveToPlayer, transitions: { playerFar: 'patrol', inRange: 'attack' } },
    attack:  { onEnter: windUp, onUpdate: swingWeapon, transitions: { done: 'cooldown' } },
    cooldown:{ onUpdate: wait, transitions: { ready: 'chase' } },
    dead:    { onEnter: dropLoot, terminal: true },
  },
});

// In game loop:
enemy.update(dt);
enemy.send('playerNear');  // trigger transition
```

### `useTimer`

Cooldowns, delays, and intervals that respect game time (pause-aware, timeScale-aware).

```tsx
const attackCooldown = useTimer(0.5);        // 500ms cooldown
const invincibility = useTimer(2.0);          // 2 second i-frames
const waveTimer = useTimer(30, { loop: true }); // every 30 seconds

if (input.pressed('attack') && attackCooldown.ready) {
  doAttack();
  attackCooldown.start();
}

// Timers pause when the game pauses, speed up with timeScale
```

---

## Entity system — detailed design

### `useEntity`

A single managed entity — position, velocity, state, bounding box. The building block.

```tsx
const player = useEntity({
  x: 100, y: 200,
  vx: 0, vy: 0,
  width: 16, height: 24,
  hp: 100, maxHp: 100,
  state: 'idle',
  grounded: false,
});

// Update each frame
player.update((e, dt) => {
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.vx *= 0.9; // friction
});

// Read state in JSX
<EntitySprite entity={player} sprite={sprites[player.state.state]} />
```

### `useEntityPool`

Manages a collection of entities — enemies, bullets, pickups. Handles spawn, despawn, iteration, and pooling (reuse dead entities instead of GC churn).

```tsx
const enemies = useEntityPool({ poolSize: 50 });

// Spawn
enemies.spawn({ x: 300, y: 100, hp: 30, type: 'skeleton' });

// Update all
enemies.updateAll((enemy, dt) => {
  moveTowardPlayer(enemy, player, dt);
  if (enemy.hp <= 0) enemies.despawn(enemy);
});

// Query
const nearby = enemies.query({ near: player, radius: 100 });

// Render
enemies.map((e) => <EntitySprite key={e.id} entity={e} sprite={`${e.type}.png`} />);
```

### `useSpawner`

Handles wave-based, timed, or conditional spawning.

```tsx
const spawner = useSpawner(enemies, {
  waves: [
    { count: 5,  type: 'skeleton', delay: 1.0, interval: 0.5 },
    { count: 3,  type: 'archer',   delay: 3.0, interval: 0.8 },
    { count: 1,  type: 'boss',     delay: 5.0 },
  ],
  spawnPoints: [{ x: 0, y: 100 }, { x: 400, y: 100 }],
  onWaveComplete: (waveIndex) => { /* reward */ },
  onAllComplete: () => { /* level clear */ },
});

spawner.start();  // begins wave sequence
```

---

## Physics hooks — detailed design

### `useCollision`

AABB and circle collision detection. Not a full physics engine — just "are these overlapping?" and "push them apart."

```tsx
const { colliding, collisions } = useCollision({
  entities: [player, ...enemies.all],
  tilemap: map,            // check against solid tiles too
  layers: {
    player: ['enemy', 'wall', 'pickup'],  // what collides with what
    enemy: ['wall'],
    pickup: [],
  },
});

// React to collisions
for (const hit of collisions) {
  if (hit.a === player && hit.b.type === 'enemy') {
    takeDamage(hit.b.damage);
  }
  if (hit.a === player && hit.b.type === 'pickup') {
    collect(hit.b);
  }
}
```

### `usePlatformer`

Gravity, jump, ground check, coyote time, wall slide — the whole platformer movement package in one hook.

```tsx
const platformer = usePlatformer(player, {
  gravity: 800,
  jumpForce: -350,
  moveSpeed: 150,
  maxFallSpeed: 400,
  coyoteTime: 0.1,         // can still jump 100ms after leaving edge
  jumpBuffer: 0.1,          // press jump 100ms before landing, still works
  wallSlide: true,
  wallSlideSpeed: 60,
  wallJump: { x: 200, y: -300 },
  tilemap: map,              // for ground/wall detection
});

// In game loop — just pass input, physics handles the rest
platformer.update(dt, {
  left: input.held('moveLeft'),
  right: input.held('moveRight'),
  jump: input.pressed('jump'),
});

// Read state
platformer.grounded  // boolean
platformer.wallSliding // boolean
platformer.facing     // 'left' | 'right'
```

---

## Game systems — detailed design

### `useInventory`

Slot-based inventory with stacking, drag-and-drop, and capacity.

```tsx
const inventory = useInventory({
  slots: 20,
  maxStack: 64,
  maxWeight: 100,           // optional weight system
});

inventory.add({ id: 'sword', name: 'Iron Sword', quantity: 1, weight: 5 });
inventory.add({ id: 'potion', name: 'Health Potion', quantity: 3, weight: 0.5 });
inventory.remove('potion', 1);
inventory.move(fromSlot, toSlot);
inventory.swap(slotA, slotB);

const sword = inventory.find('sword');
const hasKey = inventory.has('boss_key');
const totalWeight = inventory.weight;

// Render
<InventoryGrid inventory={inventory} onSlotClick={handleUse} />
```

### `useSkillTree`

Node-based skill tree with prerequisites, point costs, and reset.

```tsx
const skills = useSkillTree({
  points: 5,
  nodes: {
    fireball:    { cost: 1, description: 'Throw a fireball', icon: 'fire' },
    bigFireball: { cost: 2, requires: ['fireball'], description: 'Bigger fireball' },
    fireWall:    { cost: 3, requires: ['fireball'], description: 'Wall of flame' },
    inferno:     { cost: 3, requires: ['bigFireball', 'fireWall'], description: 'Everything burns' },
    iceSpear:    { cost: 1, description: 'Throw an ice spear' },
    frostNova:   { cost: 2, requires: ['iceSpear'], description: 'AoE freeze' },
  },
  layout: {            // position hints for the visual tree
    fireball:    { x: 0, y: 0 },
    bigFireball: { x: -1, y: 1 },
    fireWall:    { x: 1, y: 1 },
    inferno:     { x: 0, y: 2 },
    iceSpear:    { x: 3, y: 0 },
    frostNova:   { x: 3, y: 1 },
  },
});

skills.unlock('fireball');       // costs 1 point
skills.isUnlocked('fireball');   // true
skills.canUnlock('inferno');     // false — missing prerequisites
skills.reset();                  // refund all points
skills.remainingPoints;          // number

<SkillTreeView skills={skills} onNodeClick={handleUnlock} />
```

### `useCombat`

HP, damage calculation, buffs, debuffs, damage types, death.

```tsx
const combat = useCombat({
  stats: {
    hp: 100, maxHp: 100,
    mp: 50, maxMp: 50,
    attack: 15, defense: 8,
    speed: 10,
  },
  damageTypes: ['physical', 'fire', 'ice', 'lightning'],
  resistances: { fire: 0.5 },  // 50% fire resistance
});

combat.takeDamage({ amount: 25, type: 'physical', source: enemy });
combat.heal(30);
combat.addBuff({ id: 'rage', stat: 'attack', modifier: 1.5, duration: 10 });
combat.addDebuff({ id: 'poison', tickDamage: 5, interval: 1, duration: 5 });
combat.update(dt);  // ticks buffs/debuffs

combat.stats.hp;     // current after all modifiers
combat.isDead;       // boolean
combat.buffs;        // active buff list
```

### `useDialogue`

Branching dialogue trees with conditions, variable substitution, and events.

```tsx
const dialogue = useDialogue({
  nodes: {
    start:    { text: "Hello traveler. Looking for work?", next: 'offer' },
    offer:    { text: "I need someone to clear the mine.", choices: [
      { text: "I'll do it.", next: 'accept', condition: () => player.level >= 5 },
      { text: "How much does it pay?", next: 'negotiate' },
      { text: "No thanks.", next: 'decline' },
    ]},
    accept:   { text: "Excellent. Here's a map.", onEnter: () => quests.start('clearMine'), next: null },
    negotiate:{ text: "50 gold, plus whatever you find.", next: 'offer' },
    decline:  { text: "Suit yourself.", next: null },
  },
});

dialogue.start('start');
dialogue.advance();              // move to next node
dialogue.choose(1);              // pick choice by index
dialogue.currentNode;            // { text, choices, ... }
dialogue.isActive;               // boolean

<DialogueBox dialogue={dialogue} speaker="Old Miner" portrait="miner.png" />
```

### `useLoot`

Weighted random loot tables with rarity tiers and guaranteed drops.

```tsx
const loot = useLoot({
  tables: {
    commonChest: [
      { item: 'gold',     weight: 50, quantity: [5, 20] },
      { item: 'potion',   weight: 30, quantity: 1 },
      { item: 'arrow',    weight: 15, quantity: [3, 10] },
      { item: 'rare_gem', weight: 4,  rarity: 'rare' },
      { item: 'legendary_sword', weight: 1, rarity: 'legendary' },
    ],
    bossKill: {
      guaranteed: [{ item: 'boss_key', quantity: 1 }],
      rolls: 3,  // roll the table 3 times
      table: 'commonChest',
    },
  },
});

const drops = loot.roll('commonChest');        // [{ item: 'gold', quantity: 12 }]
const bossDrops = loot.roll('bossKill');       // guaranteed key + 3 random rolls
```

### `useProgression`

XP, leveling, stat growth.

```tsx
const progression = useProgression({
  xpCurve: (level) => Math.floor(100 * Math.pow(1.5, level - 1)),  // XP needed per level
  maxLevel: 50,
  statGrowth: {
    hp:      (level) => 20 + level * 8,
    attack:  (level) => 5 + level * 2,
    defense: (level) => 3 + level * 1.5,
  },
  onLevelUp: (newLevel) => { skills.addPoints(1); },
});

progression.addXP(50);
progression.level;          // current level
progression.xp;             // current xp in this level
progression.xpToNext;       // xp needed for next level
progression.progress;       // 0-1 fraction to next level
progression.statsAt(10);    // preview stats at level 10
```

---

## World hooks — detailed design

### `useTilemap`

The foundation for any 2D world — grid of tiles with collision data, layers, and queries.

```tsx
const map = useTilemap({
  width: 40, height: 30,
  tileSize: 16,
  layers: {
    ground:    [...],  // 2D array of tile IDs
    walls:     [...],  // solid tiles
    decoration:[...],  // non-solid overlay
  },
  tileTypes: {
    0: { name: 'empty', solid: false, color: null },
    1: { name: 'floor', solid: false, color: '#2a2a3a' },
    2: { name: 'wall',  solid: true,  color: '#5a5a7a' },
    3: { name: 'water', solid: false, color: '#3a5aaa', slow: 0.5 },
  },
});

map.getTile(5, 3);           // tile at grid position
map.setTile('walls', 5, 3, 2);  // place a wall
map.isSolid(5, 3);           // check collision
map.solids;                   // array of solid rects for collision system
map.worldToGrid(px, py);     // pixel → grid coords
map.gridToWorld(gx, gy);     // grid → pixel coords

<TilemapView tilemap={map} camera={camera} />
```

### `usePathfinding`

A* pathfinding on tilemaps or custom graphs.

```tsx
const pathfinder = usePathfinding(map, {
  allowDiagonal: true,
  heuristic: 'manhattan',  // or 'euclidean', 'octile'
  maxSearchNodes: 1000,    // cap search to prevent freezes
});

const path = pathfinder.findPath(
  { x: enemy.x, y: enemy.y },
  { x: player.x, y: player.y },
);
// path = [{ x, y }, { x, y }, ...]  in grid coords

// Follow the path
const next = path[0];
moveToward(enemy, next, speed * dt);
```

### `useProcGen`

Procedural generation building blocks. Not a single algorithm — a toolkit.

```tsx
const dungeon = useProcGen.bspDungeon({
  width: 60, height: 40,
  minRoomSize: 5, maxRoomSize: 12,
  corridorWidth: 2,
});
// Returns: { rooms: [...], corridors: [...], tiles: number[][] }

const noise = useProcGen.perlinNoise({ width: 100, height: 100, scale: 0.1 });
// Returns: 2D array of 0-1 values — use for terrain height, cave density, etc.

const cave = useProcGen.cellularAutomata({
  width: 50, height: 50,
  fillChance: 0.45,
  iterations: 5,
  birthLimit: 4,
  deathLimit: 3,
});
// Returns: 2D array of 0/1 — organic cave shapes

// Combine: generate dungeon, fill map, place enemies
const tiles = dungeon.tiles;
map.loadLayer('walls', tiles);
for (const room of dungeon.rooms) {
  spawner.spawnInArea(room, { type: 'skeleton', count: 3 });
}
```

---

## Genre templates

Each template is a single file, self-contained, demonstrates 3+ hooks working together, and is playable out of the box. Copy it, modify it, build your game.

### 1. Roguelite Dungeon Crawler

**Hooks used:** `useGameLoop`, `useEntity`, `useEntityPool`, `useTilemap`, `useProcGen`, `useCollision`, `useCombat`, `useInventory`, `useLoot`, `usePathfinding`, `useFogOfWar`, `useCamera`

**What you get:**
- Procedurally generated dungeon (BSP rooms + corridors)
- Player movement with 4-directional tile-based or free movement
- Enemies that pathfind toward player
- Combat: bump-to-attack with damage numbers
- Loot drops on kill
- Inventory sidebar
- Fog of war (only see what's near you)
- Stairs to next floor
- Permadeath (game over → new dungeon)

**Why this template:** Roguelites touch almost every system — generation, pathfinding, combat, inventory, loot. If this works, everything works.

### 2. Turn-Based RPG Battle

**Hooks used:** `useGameState`, `useStateMachine`, `useCombat`, `useInventory`, `useDialogue`, `useTimer`, `useProgression`

**What you get:**
- Party of 3 vs enemy group
- Turn order based on speed stat
- Actions: Attack, Skill, Item, Defend, Flee
- Damage calculation with types and resistances
- Buff/debuff system
- Item usage from inventory
- XP and level-up on victory
- Pre-battle dialogue

**Why this template:** Turn-based is the easiest genre to make feel complete. No physics, no real-time — pure systems.

### 3. Platformer

**Hooks used:** `useGameLoop`, `useEntity`, `usePlatformer`, `useTilemap`, `useCollision`, `useCamera`, `useEntityPool`

**What you get:**
- Tight platformer controls (coyote time, jump buffer, variable jump height)
- Tile-based level with solid platforms
- Collectible coins
- Enemies that patrol platforms
- Stomp-to-kill mechanic
- Camera following player with bounds
- Death and respawn

**Why this template:** Platformers are the most demanding on physics feel. If `usePlatformer` feels good here, it's ready.

### 4. Tower Defense

**Hooks used:** `useGameLoop`, `useTilemap`, `usePathfinding`, `useEntityPool`, `useSpawner`, `useEconomy`, `useTimer`

**What you get:**
- Grid-based map with a path from spawn to base
- Tower placement on valid tiles
- Enemy waves that follow the path
- Towers auto-target and shoot nearest enemy
- Economy: earn gold from kills, spend on towers
- Tower upgrades (3 tiers)
- Wave counter + lives

**Why this template:** Tower defense is pure strategy and spawning systems. Great for showing off `useSpawner` and `usePathfinding`.

### 5. Card Game / Deck Builder

**Hooks used:** `useGameState`, `useStateMachine`, `useCombat`, `useInventory` (deck as inventory), `useLoot` (card rewards), `useProgression`

**What you get:**
- Draw hand of 5 from deck
- Play cards: attacks, blocks, buffs
- Mana/energy system per turn
- Enemy with intent display (shows next action)
- Discard pile, draw pile, exhaust pile
- Post-battle: pick 1 of 3 card rewards
- Deck viewer

**Why this template:** Slay the Spire popularized the genre. Card games are state machines + inventory with a different skin.

### 6. Idle / Clicker

**Hooks used:** `useGameLoop`, `useEconomy`, `useProgression`, `useAchievements`, `useTimer`

**What you get:**
- Click a button to earn gold
- Buy generators (auto-earners)
- Upgrade tiers for each generator
- Prestige system (reset for multiplier)
- Achievement unlocks
- Offline progress calculation
- Big numbers formatting (1.5M, 3.2B, etc.)

**Why this template:** Idle games are pure economy and progression. Minimal rendering, maximum systems.

### 7. Top-Down Adventure (Zelda-like)

**Hooks used:** `useGameLoop`, `useEntity`, `useTilemap`, `useCollision`, `useCamera`, `useInventory`, `useDialogue`, `useRoomGraph`, `useStateMachine`

**What you get:**
- 4-directional movement
- Sword swing attack
- Room-based world with screen transitions
- NPCs with dialogue
- Collectible items (keys, hearts)
- Locked doors requiring keys
- Bushes to cut, pots to break

**Why this template:** Top-down adventure is the classic Love2D demo genre. This proves iLoveReact handles it elegantly.

### 8. Survival / Crafting

**Hooks used:** `useGameLoop`, `useEntity`, `useTilemap`, `useCollision`, `useInventory`, `useCrafting`, `useTimer`, `useEntityPool`, `useSpawner`

**What you get:**
- Gather resources (chop trees, mine rocks)
- Craft tools and items from recipes
- Hunger/thirst bars that drain over time
- Day/night cycle
- Enemies spawn at night
- Build structures (place tiles)
- Workbench for advanced recipes

**Why this template:** Survival games combine resource management, crafting, and real-time pressure.

### 9. Bullet Hell / Shmup

**Hooks used:** `useGameLoop`, `useEntity`, `useEntityPool`, `useProjectile`, `useCollision`, `useSpawner`, `useInput`, `useCamera`

**What you get:**
- Player ship with precise movement
- Shoot button fires bullet stream
- Enemy patterns (sine wave, spiral, aimed shots)
- Boss with multi-phase bullet patterns
- Score multiplier for no-hit streaks
- Screen shake on hit
- Bomb/special that clears screen

**Why this template:** Bullet hells stress-test entity pooling and collision. Hundreds of projectiles on screen at once.

### 10. Visual Novel

**Hooks used:** `useDialogue`, `useGameState`, `useStateMachine`, `useTimer`

**What you get:**
- Character portraits that slide in/out
- Typewriter text display
- Branching choices
- Background scene changes
- Variable tracking (affection, flags)
- Multiple endings based on choices
- Save/load dialog state

**Why this template:** Visual novels are pure narrative + state. Almost no "game" logic, just dialogue and branching. Good for showing the framework handles non-action games too.

---

## Hook dependency graph

Show which hooks build on which — useful for implementation ordering:

```
useGameLoop (standalone — foundation)
├── useTimer (needs game time from loop)
├── useInput (standalone, but used in loop)
├── useCamera (needs position updates each frame)
├── useEntity (needs update callback per frame)
│   ├── useEntityPool (manages many entities)
│   │   └── useSpawner (spawns into pools)
│   └── useStateMachine (per-entity FSM)
├── usePhysics (needs dt from loop)
│   ├── useCollision (needs entity positions)
│   ├── usePlatformer (physics + collision + input)
│   └── useProjectile (physics + collision + pool)
└── useTilemap (standalone data, rendered per frame)
    ├── usePathfinding (needs tilemap graph)
    ├── useFogOfWar (needs tilemap grid)
    ├── useRoomGraph (rooms from tilemap)
    └── useProcGen (generates tilemap data)

useCombat (standalone stats system)
useInventory (standalone data system)
useSkillTree (standalone data system)
useDialogue (standalone data system)
useCrafting (needs useInventory)
useQuest (standalone data system)
useEconomy (standalone data system)
useLoot (standalone data system)
useProgression (standalone data system)
useAchievements (standalone data system)
```

## Build order

### Phase 1 — Foundation (everything needs these)
1. `useGameLoop` — the tick
2. `useInput` — unified input
3. `useEntity` + `useEntityPool` — things that exist
4. `useTimer` — cooldowns and delays
5. `useStateMachine` — state management

### Phase 2 — Physics and world (makes things move and collide)
6. `useCollision` — AABB/circle detection
7. `usePhysics` — gravity, velocity
8. `useTilemap` + `TilemapView` — the world
9. `useCamera` — viewport control
10. `usePlatformer` — platformer movement package

### Phase 3 — Game systems (makes it a game)
11. `useCombat` — HP and damage
12. `useInventory` + `InventoryGrid` — items
13. `useLoot` — drops
14. `useProgression` — levels and XP
15. `useSpawner` — enemy waves

### Phase 4 — Advanced systems
16. `useSkillTree` + `SkillTreeView` — character builds
17. `useDialogue` + `DialogueBox` — narrative
18. `usePathfinding` — AI navigation
19. `useProcGen` — generated worlds
20. `useFogOfWar` — visibility
21. `useCrafting` — recipes
22. `useQuest` — objectives
23. `useEconomy` — money
24. `useAchievements` — meta-progression

### Phase 5 — Genre templates
25. Platformer (simplest physics demo)
26. Top-Down Adventure (simplest non-physics)
27. Roguelite (combines most systems)
28. Turn-Based RPG (pure systems, no physics)
29. Tower Defense (spawning + pathfinding showcase)
30. Remaining templates in any order

## Quality bar

Each hook ships with:
- [ ] TypeScript types with JSDoc descriptions
- [ ] Works standalone (no mandatory dependencies on other game hooks)
- [ ] Serializable state (can save/load game via `@ilovereact/storage`)
- [ ] Pause-aware (respects `useGameLoop` pause state)
- [ ] Zero dependencies outside `@ilovereact/core` and `@ilovereact/game`

Each template ships with:
- [ ] Playable in under 10 seconds after copy-paste
- [ ] Uses Box-based rendering (no external sprites required, but supports them)
- [ ] Shows 3+ hooks working together
- [ ] Clean code with comments explaining key game logic
- [ ] Registered as a storybook story under "Game Templates"
- [ ] Available in the playground picker
- [ ] Dark theme, polished, the kind of thing you screenshot and share

## Crossover with other packages

| Package | Game integration |
|---------|-----------------|
| `@ilovereact/audio` | Sound effects on hits, pickups, level-up. Background music per area. |
| `@ilovereact/storage` | Save/load game state. Persistent high scores. |
| `@ilovereact/animation` | Springs for juice: screen shake, damage numbers, pickup pop |
| `@ilovereact/components` | Card, Badge, ProgressBar for HUD elements |
| `@ilovereact/3d` (future) | 3D viewport for isometric or first-person games |
| `@ilovereact/theme` (future) | Themed game UI that matches the game's aesthetic |

## The pitch

> "I wrote a roguelite in React. No, really. 80 lines of JSX, runs at 60fps on Love2D, and I didn't touch a single imperative API."

That's the tweet. That's the conference talk. That's why people try iLoveReact.
