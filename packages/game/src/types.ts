/** 2D vector */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounding box */
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Circle shape */
export interface Circle {
  x: number;
  y: number;
  radius: number;
}

/** Entity state — position, velocity, and arbitrary game data */
export interface EntityState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  alive: boolean;
  [key: string]: any;
}

/** Game loop config */
export interface GameLoopConfig {
  /** Physics timestep in seconds (default 1/60) */
  fixedStep?: number;
  /** Max catch-up steps per frame to prevent spiral of death (default 4) */
  maxSteps?: number;
  /** Time scale multiplier — 0.5 = slow-mo, 2 = fast-forward (default 1) */
  timeScale?: number;
}

/** Game loop return value */
export interface GameLoopState {
  /** Delta time for this frame in seconds */
  dt: number;
  /** Total tick count */
  tick: number;
  /** Frames per second (rolling average) */
  fps: number;
  /** Whether the loop is paused */
  paused: boolean;
  /** Pause the game loop */
  pause: () => void;
  /** Resume the game loop */
  resume: () => void;
  /** Current time scale */
  timeScale: number;
  /** Set time scale */
  setTimeScale: (scale: number) => void;
}

/** Input action binding */
export interface ActionBinding {
  keys?: string[];
  gamepad?: string;
}

/** Input config */
export interface InputConfig {
  actions: Record<string, ActionBinding>;
  /** Analog stick dead zone (default 0.2) */
  deadZone?: number;
}

/** Input state for a single action */
export interface ActionState {
  held: boolean;
  pressed: boolean;
  released: boolean;
}

/** Input return value */
export interface InputState {
  /** Is the action currently held down? */
  held: (action: string) => boolean;
  /** Was the action pressed this frame? */
  pressed: (action: string) => boolean;
  /** Was the action released this frame? */
  released: (action: string) => boolean;
  /** Get analog axis value (-1 to 1) */
  axis: (axisName: string) => number;
}

/** Camera config */
export interface CameraConfig {
  follow?: Vec2;
  /** Lerp factor: 0 = instant snap, 0.9 = very smooth (default 0.1) */
  smoothing?: number;
  /** World bounds to clamp camera within */
  bounds?: { x: number; y: number; w: number; h: number };
  zoom?: number;
  /** Lookahead offset */
  offset?: Vec2;
}

/** Camera shake config */
export interface ShakeConfig {
  intensity: number;
  duration: number;
  decay?: 'linear' | 'exponential';
}

/** Camera return value */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  shake: (config: ShakeConfig) => void;
  setZoom: (z: number) => void;
}

/** Timer config */
export interface TimerConfig {
  /** Repeat when done */
  loop?: boolean;
}

/** Timer return value */
export interface TimerState {
  /** Is the timer done / ready to use again? */
  ready: boolean;
  /** Elapsed time since start */
  elapsed: number;
  /** Time remaining */
  remaining: number;
  /** Progress 0-1 */
  progress: number;
  /** Start / restart the timer */
  start: () => void;
  /** Reset without starting */
  reset: () => void;
}

/** State machine state definition */
export interface SMState<C = any> {
  onEnter?: (context: C) => void;
  onUpdate?: (context: C, dt: number) => void;
  onExit?: (context: C) => void;
  transitions?: Record<string, string>;
  /** If true, no transitions out */
  terminal?: boolean;
}

/** State machine config */
export interface StateMachineConfig<C = any> {
  initial: string;
  states: Record<string, SMState<C>>;
  context?: C;
}

/** State machine return value */
export interface StateMachineState {
  current: string;
  previous: string | null;
  update: (dt: number) => void;
  send: (event: string) => void;
  is: (state: string) => boolean;
}

/** Tile type definition */
export interface TileType {
  name: string;
  solid: boolean;
  color: string | null;
  [key: string]: any;
}

/** Tilemap config */
export interface TilemapConfig {
  width: number;
  height: number;
  tileSize: number;
  layers?: Record<string, number[][]>;
  tileTypes?: Record<number, TileType>;
}

/** Collision hit result */
export interface CollisionHit {
  a: EntityState;
  b: EntityState | { type: 'tile'; x: number; y: number; tileId: number };
  overlapX: number;
  overlapY: number;
  normal: Vec2;
}

/** Collision config */
export interface CollisionConfig {
  entities?: EntityState[];
  statics?: AABB[];
  layers?: Record<string, string[]>;
}

/** Platformer config */
export interface PlatformerConfig {
  gravity?: number;
  jumpForce?: number;
  moveSpeed?: number;
  maxFallSpeed?: number;
  coyoteTime?: number;
  jumpBuffer?: number;
  wallSlide?: boolean;
  wallSlideSpeed?: number;
  wallJump?: Vec2;
}

/** Combat stats */
export interface CombatStats {
  hp: number;
  maxHp: number;
  mp?: number;
  maxMp?: number;
  attack: number;
  defense: number;
  speed?: number;
  [key: string]: number | undefined;
}

/** Damage event */
export interface DamageEvent {
  amount: number;
  type?: string;
  source?: any;
}

/** Buff/Debuff */
export interface BuffDef {
  id: string;
  stat?: string;
  modifier?: number;
  tickDamage?: number;
  tickHeal?: number;
  interval?: number;
  duration: number;
}

/** Active buff with remaining time */
export interface ActiveBuff extends BuffDef {
  remaining: number;
  tickTimer: number;
}

/** Inventory item */
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  maxStack?: number;
  weight?: number;
  icon?: string;
  [key: string]: any;
}

/** Inventory slot */
export interface InventorySlot {
  item: InventoryItem | null;
  index: number;
}

/** Inventory config */
export interface InventoryConfig {
  slots: number;
  maxStack?: number;
  maxWeight?: number;
}

/** Loot table entry */
export interface LootEntry {
  item: string;
  weight: number;
  quantity?: number | [number, number];
  rarity?: string;
}

/** Loot drop result */
export interface LootDrop {
  item: string;
  quantity: number;
  rarity?: string;
}

/** Loot table definition — can be an array of entries or a composite */
export interface LootTableDef {
  guaranteed?: LootDrop[];
  rolls?: number;
  table?: string;
}

/** Progression config */
export interface ProgressionConfig {
  xpCurve: (level: number) => number;
  maxLevel?: number;
  statGrowth?: Record<string, (level: number) => number>;
  onLevelUp?: (newLevel: number) => void;
}

/** Skill tree node */
export interface SkillNode {
  cost: number;
  description?: string;
  icon?: string;
  requires?: string[];
}

/** Skill tree config */
export interface SkillTreeConfig {
  points: number;
  nodes: Record<string, SkillNode>;
  layout?: Record<string, Vec2>;
}

/** Dialogue node */
export interface DialogueNode {
  text: string;
  speaker?: string;
  choices?: DialogueChoice[];
  next?: string | null;
  onEnter?: () => void;
}

/** Dialogue choice */
export interface DialogueChoice {
  text: string;
  next: string;
  condition?: () => boolean;
}

/** Dialogue config */
export interface DialogueConfig {
  nodes: Record<string, DialogueNode>;
}

/** Crafting recipe */
export interface Recipe {
  id: string;
  name: string;
  ingredients: { id: string; quantity: number }[];
  result: { id: string; quantity: number };
}

/** Quest objective */
export interface QuestObjective {
  description: string;
  current: number;
  target: number;
}

/** Quest definition */
export interface QuestDef {
  id: string;
  name: string;
  description: string;
  objectives: QuestObjective[];
  rewards?: { item?: string; xp?: number; gold?: number }[];
}

/** Achievement definition */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon?: string;
  condition?: () => boolean;
  maxProgress?: number;
}

/** Economy currency */
export interface Currency {
  id: string;
  name: string;
  amount: number;
}

/** Spawner wave definition */
export interface WaveDef {
  count: number;
  type: string;
  delay?: number;
  interval?: number;
  [key: string]: any;
}

/** Spawner config */
export interface SpawnerConfig {
  waves: WaveDef[];
  spawnPoints?: Vec2[];
  onWaveComplete?: (waveIndex: number) => void;
  onAllComplete?: () => void;
}

/** Pathfinding config */
export interface PathfindingConfig {
  allowDiagonal?: boolean;
  heuristic?: 'manhattan' | 'euclidean' | 'octile';
  maxSearchNodes?: number;
}

/** Fog of war visibility state */
export type Visibility = 'hidden' | 'revealed' | 'visible';

/** Room definition for room graph */
export interface RoomDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connections: string[];
  [key: string]: any;
}

/** Proc gen BSP dungeon config */
export interface BSPDungeonConfig {
  width: number;
  height: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  corridorWidth?: number;
}

/** Proc gen BSP dungeon result */
export interface BSPDungeonResult {
  rooms: AABB[];
  corridors: AABB[];
  tiles: number[][];
}

/** Proc gen cellular automata config */
export interface CellularAutomataConfig {
  width: number;
  height: number;
  fillChance?: number;
  iterations?: number;
  birthLimit?: number;
  deathLimit?: number;
}
