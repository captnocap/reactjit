// @reactjit/game — Game Logic Hooks, Systems, and Genre Templates

// ── Types ──
export type {
  Vec2, AABB, Circle, EntityState,
  GameLoopConfig, GameLoopState,
  InputConfig, InputState, ActionBinding, ActionState,
  CameraConfig, CameraState, ShakeConfig,
  TimerConfig, TimerState,
  StateMachineConfig, StateMachineState, SMState,
  TilemapConfig, TileType,
  CollisionHit,
  PlatformerConfig,
  CombatStats, DamageEvent, BuffDef, ActiveBuff,
  InventoryItem, InventorySlot, InventoryConfig,
  LootEntry, LootDrop, LootTableDef,
  ProgressionConfig,
  SkillNode, SkillTreeConfig,
  DialogueNode, DialogueChoice, DialogueConfig,
  Recipe,
  QuestDef, QuestObjective,
  AchievementDef,
  Currency,
  WaveDef, SpawnerConfig,
  PathfindingConfig,
  Visibility,
  RoomDef,
  BSPDungeonConfig, BSPDungeonResult,
  CellularAutomataConfig,
} from './types';

// ── Core hooks ──
export { useGameLoop, GameLoopContext, useGameLoopContext } from './core/useGameLoop';
export { useInput } from './core/useInput';
export { useGameState } from './core/useGameState';
export type { GameStateConfig, GameStateResult } from './core/useGameState';
export { useTimer } from './core/useTimer';
export type { TimerStateWithUpdate } from './core/useTimer';
export { useCamera } from './core/useCamera';

// ── Entity system ──
export { useEntity } from './entity/useEntity';
export { useEntityPool } from './entity/useEntityPool';
export type { EntityPool, EntityPoolConfig } from './entity/useEntityPool';
export { useStateMachine } from './entity/useStateMachine';
export { useSpawner } from './entity/useSpawner';
export type { SpawnerState } from './entity/useSpawner';

// ── Physics ──
export { useCollision } from './physics/useCollision';
export type { CollisionResult } from './physics/useCollision';
export { usePhysics } from './physics/usePhysics';
export type { PhysicsConfig, PhysicsResult } from './physics/usePhysics';
export { usePlatformer } from './physics/usePlatformer';
export type { PlatformerInput, PlatformerState } from './physics/usePlatformer';
export { useProjectile } from './physics/useProjectile';
export type { ProjectileConfig, ProjectileResult } from './physics/useProjectile';

// ── World ──
export { useTilemap } from './world/useTilemap';
export type { TilemapState } from './world/useTilemap';
export { usePathfinding } from './world/usePathfinding';
export type { PathfindingResult } from './world/usePathfinding';
export { useFogOfWar } from './world/useFogOfWar';
export type { FogOfWarState } from './world/useFogOfWar';
export { useRoomGraph } from './world/useRoomGraph';
export type { RoomGraphState } from './world/useRoomGraph';
export { useProcGen } from './world/useProcGen';
export type { ProcGenResult } from './world/useProcGen';

// ── Game systems ──
export { useCombat } from './systems/useCombat';
export type { CombatConfig, CombatState } from './systems/useCombat';
export { useInventory } from './systems/useInventory';
export type { InventoryState } from './systems/useInventory';
export { useLoot } from './systems/useLoot';
export type { LootConfig, LootState } from './systems/useLoot';
export { useProgression } from './systems/useProgression';
export type { ProgressionState } from './systems/useProgression';
export { useSkillTree } from './systems/useSkillTree';
export type { SkillTreeState } from './systems/useSkillTree';
export { useDialogue } from './systems/useDialogue';
export type { DialogueState } from './systems/useDialogue';
export { useCrafting } from './systems/useCrafting';
export type { CraftingConfig, CraftingState } from './systems/useCrafting';
export { useQuest } from './systems/useQuest';
export type { QuestStatus, QuestInstance, QuestState } from './systems/useQuest';
export { useEconomy } from './systems/useEconomy';
export type { EconomyConfig, EconomyState } from './systems/useEconomy';
export { useAchievements } from './systems/useAchievements';
export type { AchievementInstance, AchievementsState } from './systems/useAchievements';

// ── Game Canvas primitive ──
export { Game } from './GameCanvas';
export type { GameProps } from './GameCanvas';

// ── Components ──
export { TilemapView } from './components/TilemapView';
export type { TilemapViewProps } from './components/TilemapView';
export { EntitySprite } from './components/EntitySprite';
export type { EntitySpriteProps } from './components/EntitySprite';
export { StatusBar } from './components/StatusBar';
export type { StatusBarProps } from './components/StatusBar';
export { HealthBar } from './components/HealthBar';
export type { HealthBarProps } from './components/HealthBar';
export { DamageNumber } from './components/DamageNumber';
export type { DamageNumberProps } from './components/DamageNumber';
export { InventoryGrid } from './components/InventoryGrid';
export type { InventoryGridProps } from './components/InventoryGrid';
export { SkillTreeView } from './components/SkillTreeView';
export type { SkillTreeViewProps } from './components/SkillTreeView';
export { DialogueBox } from './components/DialogueBox';
export type { DialogueBoxProps } from './components/DialogueBox';
export { QuestLog } from './components/QuestLog';
export type { QuestLogProps } from './components/QuestLog';
export { Minimap } from './components/Minimap';
export type { MinimapProps } from './components/Minimap';

// ── Templates ──
export { PlatformerTemplate } from './templates/platformer';
export { RogueliteTemplate } from './templates/roguelite';
export { TurnBasedTemplate } from './templates/turnBased';
