import type { ComponentType } from 'react';
import { stories as addonStories } from '../../../packages/components/src/stories';

export interface StoryDef {
  id: string;
  title: string;
  category: string;
  component: ComponentType;
}

import { BoxBasicStory } from './BoxBasic';
import { BoxNestedStory } from './BoxNested';
import { TextStylesStory } from './TextStyles';
import { TextTruncationStory } from './TextTruncation';
import { ImageBasicStory } from './ImageBasic';
import { FlexRowStory } from './FlexRow';
import { FlexColumnStory } from './FlexColumn';
import { FlexWrapStory } from './FlexWrap';
import { PaddingMarginStory } from './PaddingMargin';
import { PressableStory } from './PressableStory';
import { SliderStory } from './SliderStory';
import { SwitchStory } from './SwitchStory';
import { ScrollViewStory } from './ScrollViewStory';
import { GradientStory } from './Gradient';
import { ShadowStory } from './Shadow';
import { TransformStory } from './Transform';
import { OpacityStory } from './Opacity';
import { ZIndexStory } from './ZIndex';
import { BorderRadiusStory } from './BorderRadius';
import { FlexShrinkStory } from './FlexShrink';
import { AspectRatioStory } from './AspectRatio';
import { TextDecorationStory } from './TextDecoration';
import { PerSideBorderStory } from './PerSideBorder';
import { CheckboxStory } from './CheckboxStory';
import { RadioStory } from './RadioStory';
import { SelectStory } from './SelectStory';
import { AnimationTimingStory } from './AnimationTiming';
import { AnimationSpringStory } from './AnimationSpring';
import { SettingsDemoStory } from './SettingsDemo';
import { NeofetchDemoStory } from './NeofetchDemo';
import { WeatherDemoStory } from './WeatherDemo';
import { ErrorTestStory } from './ErrorTest';
import { BlockTestStory } from './BlockTestStory';
import { TextEditorStory } from './TextEditorStory';
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
import { AutoSizeBasic } from './AutoSizeBasic';
import { OverflowStressStory } from './OverflowStress';
import { FetchStory } from './FetchStory';
import { WebSocketStory } from './WebSocketStory';
import { VideoStory } from './VideoStory';
import { FileDropStory } from './FileDropStory';
import { FontShowcaseStory } from './FontShowcase';
import { SpellCheckStory } from './SpellCheckStory';
import { KeyboardHooksStory } from './KeyboardHooksStory';
import { LlmsTxtReader } from './LlmsTxtReader';
import { AIChatDemoStory } from './AIChatDemo';
import { AICanvasStory } from './AICanvasDemo';
import { MCPDemoStory } from './MCPDemo';
import { APIsStory } from './APIsStory';
import { RSSStory } from './RSSStory';
import { WebhooksStory } from './WebhooksStory';
import { CryptoStory } from './CryptoStory';
import { MediaStory } from './MediaStory';
import { HorizontalBarChartStory } from './HorizontalBarChartStory';
import { StackedBarChartStory } from './StackedBarChartStory';
import { LineChartStory } from './LineChartStory';
import { AreaChartStory } from './AreaChartStory';
import { PieChartStory } from './PieChartStory';
import { RadarChartStory } from './RadarChartStory';
import { Scene3DBasicStory } from './Scene3DBasic';

export const stories: StoryDef[] = [
  // Primitives
  { id: 'box-basic', title: 'Box', category: 'Primitives', component: BoxBasicStory },
  { id: 'box-nested', title: 'Nested Boxes', category: 'Primitives', component: BoxNestedStory },
  { id: 'text-styles', title: 'Text', category: 'Primitives', component: TextStylesStory },
  { id: 'text-truncation', title: 'Text Truncation', category: 'Primitives', component: TextTruncationStory },
  { id: 'image-basic', title: 'Image', category: 'Primitives', component: ImageBasicStory },
  { id: 'video', title: 'Video', category: 'Primitives', component: VideoStory },
  { id: 'file-drop', title: 'File Drop', category: 'Primitives', component: FileDropStory },
  { id: 'font-showcase', title: 'Font Packs', category: 'Primitives', component: FontShowcaseStory },

  // Layout
  { id: 'auto-size-basic', title: 'Auto-Sizing', category: 'Layout', component: AutoSizeBasic },
  { id: 'flex-row', title: 'Flex Row', category: 'Layout', component: FlexRowStory },
  { id: 'flex-column', title: 'Flex Column', category: 'Layout', component: FlexColumnStory },
  { id: 'flex-wrap', title: 'Flex Wrap', category: 'Layout', component: FlexWrapStory },
  { id: 'padding-margin', title: 'Padding & Margin', category: 'Layout', component: PaddingMarginStory },

  // Components
  { id: 'pressable', title: 'Pressable', category: 'Components', component: PressableStory },
  { id: 'slider', title: 'Slider', category: 'Components', component: SliderStory },
  { id: 'switch', title: 'Switch', category: 'Components', component: SwitchStory },
  { id: 'scrollview', title: 'ScrollView', category: 'Components', component: ScrollViewStory },

  // Visual
  { id: 'gradient', title: 'Gradients', category: 'Visual', component: GradientStory },
  { id: 'shadow', title: 'Box Shadow', category: 'Visual', component: ShadowStory },
  { id: 'transform', title: 'Transforms', category: 'Visual', component: TransformStory },
  { id: 'opacity', title: 'Opacity', category: 'Visual', component: OpacityStory },
  { id: 'zindex', title: 'Z-Index', category: 'Visual', component: ZIndexStory },
  { id: 'border-radius', title: 'Border Radius', category: 'Visual', component: BorderRadiusStory },

  // CSS Features
  { id: 'flex-shrink', title: 'Flex Shrink', category: 'CSS Features', component: FlexShrinkStory },
  { id: 'aspect-ratio', title: 'Aspect Ratio', category: 'CSS Features', component: AspectRatioStory },
  { id: 'text-decoration', title: 'Text Decoration', category: 'CSS Features', component: TextDecorationStory },
  { id: 'per-side-border', title: 'Per-Side Borders', category: 'CSS Features', component: PerSideBorderStory },

  // Input
  { id: 'text-editor', title: 'TextEditor', category: 'Input', component: TextEditorStory },
  { id: 'spell-check', title: 'Spell Check', category: 'Input', component: SpellCheckStory },
  { id: 'keyboard-hooks', title: 'Keyboard Hooks', category: 'Input', component: KeyboardHooksStory },

  // Forms
  { id: 'checkbox', title: 'Checkbox', category: 'Forms', component: CheckboxStory },
  { id: 'radio', title: 'Radio', category: 'Forms', component: RadioStory },
  { id: 'select', title: 'Select', category: 'Forms', component: SelectStory },

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

  // Stress Test
  { id: 'overflow-stress', title: 'Overflow Stress', category: 'Stress Test', component: OverflowStressStory },
  { id: 'llms-txt-reader', title: 'llms.txt Reader', category: 'Stress Test', component: LlmsTxtReader },

  // AI
  { id: 'ai-chat', title: 'AI Chat', category: 'AI', component: AIChatDemoStory },
  { id: 'ai-canvas', title: 'AI Canvas', category: 'AI', component: AICanvasStory },
  { id: 'mcp', title: 'MCP Server', category: 'AI', component: MCPDemoStory },

  // Networking
  { id: 'fetch', title: 'Fetch', category: 'Networking', component: FetchStory },
  { id: 'websocket', title: 'WebSocket', category: 'Networking', component: WebSocketStory },
  { id: 'apis', title: 'REST APIs', category: 'Networking', component: APIsStory },
  { id: 'rss', title: 'RSS Feeds', category: 'Networking', component: RSSStory },
  { id: 'webhooks', title: 'Webhooks', category: 'Networking', component: WebhooksStory },

  // Security
  { id: 'crypto', title: 'Crypto', category: 'Security', component: CryptoStory },

  // Media
  { id: 'media', title: 'Media Library', category: 'Media', component: MediaStory },

  // 3D
  { id: 'scene-3d-basic', title: '3D Scene', category: '3D', component: Scene3DBasicStory },

  // Dev Tools
  { id: 'error-test', title: 'Error Test', category: 'Dev Tools', component: ErrorTestStory },
  { id: 'block-test', title: 'Block Test', category: 'Dev Tools', component: BlockTestStory },

  // Addon components (from @ilovereact/components)
  ...addonStories,
];
