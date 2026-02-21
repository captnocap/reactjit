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
import { SettingsDemoStory } from './SettingsDemo';
import { NeofetchDemoStory } from './NeofetchDemo';
import { WeatherDemoStory } from './WeatherDemo';
import { ErrorTestStory } from './ErrorTest';
import { BlockTestStory } from './BlockTestStory';
import { TableStory } from './TableStory';
import { BarChartStory } from './BarChartStory';
import { ProgressBarStory } from './ProgressBarStory';
import { SparklineStory } from './SparklineStory';
import { DataDashboardDemoStory } from './DataDashboardDemo';
import { NavPanelStory } from './NavPanelStory';
import { TabsStory } from './TabsStory';
import { BreadcrumbsStory } from './BreadcrumbsStory';
import { ToolbarStory } from './ToolbarStory';
import { AppShellDemoStory } from './AppShellDemo';
import { TradingViewBarsStory } from './TradingViewBarsStory';
import { TradingPerfLabStory } from './TradingPerfLabStory';
import { OverflowStressStory } from './OverflowStress';
import { FetchStory } from './FetchStory';
import { WebSocketStory } from './WebSocketStory';
import { TorIRCStory } from './TorIRCStory';
import { VideoStory } from './VideoStory';
import { FileDropStory } from './FileDropStory';
import { FontShowcaseStory } from './FontShowcase';
import { LlmsTxtReader } from './LlmsTxtReader';
import { AIChatDemoStory } from './AIChatDemo';
import { AICanvasStory } from './AICanvasDemo';
import { MCPDemoStory } from './MCPDemo';
import { APIsStory } from './APIsStory';
import { RSSStory } from './RSSStory';
import { WebhooksStory } from './WebhooksStory';
import { CryptoStory } from './CryptoStory';
import { MediaStory } from './MediaStory';
import EmulatorStory from './EmulatorStory';
import { HorizontalBarChartStory } from './HorizontalBarChartStory';
import { StackedBarChartStory } from './StackedBarChartStory';
import { LineChartStory } from './LineChartStory';
import { AreaChartStory } from './AreaChartStory';
import { PieChartStory } from './PieChartStory';
import { RadarChartStory } from './RadarChartStory';
import { Scene3DBasicStory } from './Scene3DBasic';
import { Scene3DPlanetStory } from './Scene3DPlanet';
import { Scene3DFrameworkCubeStory } from './Scene3DFrameworkCube';
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
  { id: 'nav-panel', title: 'NavPanel', category: 'Navigation', component: NavPanelStory },
  { id: 'tabs', title: 'Tabs', category: 'Navigation', component: TabsStory },
  { id: 'breadcrumbs', title: 'Breadcrumbs', category: 'Navigation', component: BreadcrumbsStory },
  { id: 'toolbar', title: 'Toolbar', category: 'Navigation', component: ToolbarStory },

  // Data
  { id: 'table', title: 'Table', category: 'Data', component: TableStory },
  { id: 'bar-chart', title: 'Bar Chart', category: 'Data', component: BarChartStory },
  { id: 'progress-bar', title: 'Progress Bar', category: 'Data', component: ProgressBarStory },
  { id: 'sparkline', title: 'Sparkline', category: 'Data', component: SparklineStory },
  { id: 'horizontal-bar-chart', title: 'Horizontal Bar', category: 'Data', component: HorizontalBarChartStory },
  { id: 'stacked-bar-chart', title: 'Stacked Bar', category: 'Data', component: StackedBarChartStory },
  { id: 'line-chart', title: 'Line Chart', category: 'Data', component: LineChartStory },
  { id: 'area-chart', title: 'Area Chart', category: 'Data', component: AreaChartStory },
  { id: 'pie-chart', title: 'Pie / Donut', category: 'Data', component: PieChartStory },
  { id: 'radar-chart', title: 'Radar Chart', category: 'Data', component: RadarChartStory },

  // Demo
  { id: 'settings-demo', title: 'Settings Demo', category: 'Demo', component: SettingsDemoStory },
  { id: 'neofetch-demo', title: 'Neofetch', category: 'Demo', component: NeofetchDemoStory },
  { id: 'weather-demo', title: 'Weather', category: 'Demo', component: WeatherDemoStory },
  { id: 'data-dashboard', title: 'Data Dashboard', category: 'Demo', component: DataDashboardDemoStory },
  { id: 'app-shell', title: 'App Shell', category: 'Demo', component: AppShellDemoStory },
  { id: 'tradingview-bars', title: 'TradingView 2D/3D', category: 'Demo', component: TradingViewBarsStory },

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
  { id: 'fetch', title: 'Fetch', category: 'Networking', component: FetchStory },
  { id: 'websocket', title: 'WebSocket', category: 'Networking', component: WebSocketStory },
  { id: 'tor-irc', title: 'Tor IRC', category: 'Networking', component: TorIRCStory },
  { id: 'apis', title: 'REST APIs', category: 'Networking', component: APIsStory },
  { id: 'rss', title: 'RSS Feeds', category: 'Networking', component: RSSStory },
  { id: 'webhooks', title: 'Webhooks', category: 'Networking', component: WebhooksStory },

  // Security
  { id: 'crypto', title: 'Crypto', category: 'Security', component: CryptoStory },

  // Media
  { id: 'media', title: 'Media Library', category: 'Media', component: MediaStory },

  // Emulation
  { id: 'emulator', title: 'NES Emulator', category: 'Emulation', component: EmulatorStory },

  // 3D
  { id: 'scene-3d-basic', title: '3D Scene', category: '3D', component: Scene3DBasicStory },
  { id: 'scene-3d-planet', title: 'Planet', category: '3D', component: Scene3DPlanetStory },
  { id: 'scene-3d-framework-cube', title: 'Framework Cube', category: '3D', component: Scene3DFrameworkCubeStory },

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
  { id: 'block-test', title: 'Block Test', category: 'Dev Tools', component: BlockTestStory },

  // Storage
  { id: 'local-store', title: 'Local Store', category: 'Storage', component: LocalStoreStory },

  // CartridgeOS
  { id: 'cartridge-inspector', title: 'Cartridge Inspector', category: 'CartridgeOS', component: CartridgeInspectorStory },

  // Generative Effects
  { id: 'effects', title: 'Effects', category: 'Generative', component: EffectsStory },

  // Addon components (from @ilovereact/components)
  ...addonStories,
];
