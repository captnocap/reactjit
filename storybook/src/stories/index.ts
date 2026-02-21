import type { ComponentType } from 'react';
import { stories as addonStories } from '../../../packages/components/src/stories';

export interface StoryDef {
  id: string;
  title: string;
  category: string;
  component: ComponentType;
}

import { BoxBasicStory } from './BoxBasic';
import { TextStylesStory } from './TextStyles';
import { ImageBasicStory } from './ImageBasic';
import { ImageGalleryStory } from './ImageGalleryStory';
import { FlexRowStory } from './FlexRow';
import { InputStory } from './InputStory';
import { GradientStory } from './Gradient';
import { AnimationTimingStory } from './AnimationTiming';
import { AnimationSpringStory } from './AnimationSpring';
import { DemoStory } from './DemoStory';
import { ErrorTestStory } from './ErrorTest';
import { DataStory } from './DataStory';
import { NavigationStory } from './NavigationStory';
import { TradingPerfLabStory } from './TradingPerfLabStory';
import { OverflowStressStory } from './OverflowStress';
import { NetworkingStory } from './NetworkingStory';
import { VideoStory } from './VideoStory';
import { FileDropStory } from './FileDropStory';
import { FontShowcaseStory } from './FontShowcase';
import { LlmsTxtReader } from './LlmsTxtReader';
import { AIChatDemoStory } from './AIChatDemo';
import { AICanvasStory } from './AICanvasDemo';
import { MCPDemoStory } from './MCPDemo';
import { CryptoStory } from './CryptoStory';
import { MediaStory } from './MediaStory';
import EmulatorStory from './EmulatorStory';
import { Scene3DShowcaseStory } from './Scene3DShowcaseStory';
import { Scene3DFrameworkGalaxyStory } from './Scene3DFrameworkGalaxy';
import { GamePlatformerStory } from './GamePlatformerStory';
import { GameRogueliteStory } from './GameRogueliteStory';
import { GameTurnBasedStory } from './GameTurnBasedStory';
import { BlackholeStory } from './BlackholeStory';
import { AudioRackStory } from './AudioRackStory';
import { ControlsStory } from './ControlsStory';
import { ThemeStory } from './ThemeStory';
import { ThemeSwitcherStory } from './ThemeSwitcherStory';
import SettingsMenuStory from './SettingsMenuStory';
import { CapabilitiesStory } from './CapabilitiesStory';
import { MapBasicStory } from './MapBasicStory';
import { CartridgeInspectorStory } from './CartridgeInspectorStory';
import { LocalStoreStory } from './LocalStoreStory';
import { EffectsStory } from './EffectsStory';
import { TextEffectsStory } from './TextEffectsStory';
import { PolyPizzaStory } from './PolyPizzaStory';


export const stories: StoryDef[] = [
  // Primitives
  { id: 'box-basic', title: 'Box', category: 'Primitives', component: BoxBasicStory },
  { id: 'text-styles', title: 'Text', category: 'Primitives', component: TextStylesStory },
  { id: 'image-basic', title: 'Image', category: 'Primitives', component: ImageBasicStory },
  { id: 'image-gallery', title: 'Image Gallery', category: 'Primitives', component: ImageGalleryStory },
  { id: 'video', title: 'Video', category: 'Primitives', component: VideoStory },
  { id: 'file-drop', title: 'File Drop', category: 'Primitives', component: FileDropStory },
  { id: 'font-showcase', title: 'Font Packs', category: 'Primitives', component: FontShowcaseStory },

  // Layout
  { id: 'layout', title: 'Layout', category: 'Layout', component: FlexRowStory },

  // Visual
  { id: 'style', title: 'Style', category: 'Visual', component: GradientStory },

  // Input
  { id: 'input', title: 'Input', category: 'Input', component: InputStory },

  // Animation
  { id: 'animation-timing', title: 'Spring Width', category: 'Animation', component: AnimationTimingStory },
  { id: 'animation-spring', title: 'Spring Position', category: 'Animation', component: AnimationSpringStory },

  // Navigation
  { id: 'navigation', title: 'Navigation', category: 'Navigation', component: NavigationStory },

  // Data
  { id: 'data', title: 'Data', category: 'Data', component: DataStory },
  { id: 'poly-pizza', title: 'Poly Pizza', category: 'Data', component: PolyPizzaStory },

  // Demo
  { id: 'demo', title: 'Demos', category: 'Demo', component: DemoStory },

  // Stress Test
  { id: 'overflow-stress', title: 'Overflow Stress', category: 'Stress Test', component: OverflowStressStory },
  { id: 'trading-perf-lab', title: 'Trading Perf Lab', category: 'Stress Test', component: TradingPerfLabStory },
  { id: 'scene-3d-framework-galaxy', title: '3D Cube Galaxy', category: 'Stress Test', component: Scene3DFrameworkGalaxyStory },
  { id: 'llms-txt-reader', title: 'llms.txt Reader', category: 'Stress Test', component: LlmsTxtReader },

  // AI
  { id: 'ai-chat', title: 'AI Chat', category: 'AI', component: AIChatDemoStory },
  { id: 'ai-canvas', title: 'AI Canvas', category: 'AI', component: AICanvasStory },
  { id: 'mcp', title: 'MCP Server', category: 'AI', component: MCPDemoStory },

  // Networking
  { id: 'networking', title: 'Networking', category: 'Networking', component: NetworkingStory },

  // Security
  { id: 'crypto', title: 'Crypto', category: 'Security', component: CryptoStory },

  // Media
  { id: 'media', title: 'Media Library', category: 'Media', component: MediaStory },

  // Emulation
  { id: 'emulator', title: 'NES Emulator', category: 'Emulation', component: EmulatorStory },

  // 3D
  { id: 'scene-3d-showcase', title: '3D Showcase', category: '3D', component: Scene3DShowcaseStory },

  // Geo / Maps
  { id: 'map-basic', title: 'Map', category: 'Geo', component: MapBasicStory },

  // Game Templates
  { id: 'game-platformer', title: 'Platformer', category: 'Game Templates', component: GamePlatformerStory },
  { id: 'game-roguelite', title: 'Roguelite Dungeon', category: 'Game Templates', component: GameRogueliteStory },
  { id: 'game-turnbased', title: 'Turn-Based RPG', category: 'Game Templates', component: GameTurnBasedStory },
  { id: 'game-blackhole', title: 'Blackhole (Before/After)', category: 'Game Templates', component: BlackholeStory },

  // Audio
  { id: 'audio-rack', title: 'Audio Rack', category: 'Audio', component: AudioRackStory },
  { id: 'controls', title: 'Controls', category: 'Audio', component: ControlsStory },

  // Capabilities (declarative native)
  { id: 'capabilities', title: 'Capabilities', category: 'Capabilities', component: CapabilitiesStory },

  // Theme
  { id: 'theme', title: 'Theme System', category: 'Theme', component: ThemeStory },
  { id: 'theme-switcher', title: 'Theme Switcher', category: 'Theme', component: ThemeSwitcherStory },

  // Settings
  { id: 'settings-menu', title: 'Settings Menu', category: 'Dev Tools', component: SettingsMenuStory },

  // Dev Tools
  { id: 'error-test', title: 'Error Test', category: 'Dev Tools', component: ErrorTestStory },

  // Storage
  { id: 'local-store', title: 'Local Store', category: 'Storage', component: LocalStoreStory },

  // CartridgeOS
  { id: 'cartridge-inspector', title: 'Cartridge Inspector', category: 'CartridgeOS', component: CartridgeInspectorStory },

  // Generative Effects
  { id: 'effects', title: 'Effects', category: 'Generative', component: EffectsStory },
  { id: 'text-effects', title: 'Text Effects', category: 'Generative', component: TextEffectsStory },

  // Addon components (from @ilovereact/components)
  ...addonStories,
];
