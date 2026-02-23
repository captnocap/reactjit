// Types
export type {
  Style,
  Color,
  FileDropMode,
  LoveEvent,
  BoxProps,
  TextProps,
  ImageProps,
  VideoProps,
  VideoPlayerProps,
  VideoTimeEvent,
  ScrollEvent,
  ScrollViewProps,
  ScrollViewRef,
  TextInputProps,
  TextEditorProps,
  FlatListProps,
  FlatListRef,
} from './types';

// Bridge interface
export type { IBridge, BridgeEvent, Listener, Unsubscribe } from './bridge';

// Context & providers
export {
  BridgeProvider,
  useBridge,
  useBridgeOptional,
  RendererProvider,
  useRendererMode,
  ThemeColorsContext,
  useThemeColorsOptional,
  type RendererMode,
} from './context';

// Viewport-proportional scaling
export { ScaleProvider, ScaleContext, useScale, useScaledStyle, NoScale } from './ScaleContext';
export type { ScaleProviderProps, ScaleContextValue } from './ScaleContext';
export { scaleStyle } from './scaleStyle';

// Hooks
export {
  useWindowDimensions,
  useWindowSize,
  useLove,
  useLoveEvent,
  useLoveRPC,
  useLoveState,
  useLoveReady,
  useLoveSend,
  useLoveOverlays,
  useFetch,
  useWebSocket,
  usePeerServer,
  useHotkey,
  useClipboard,
  type WebSocketStatus,
  type PeerMessage,
  type Overlay,
} from './hooks';

// Local store (persistent useState backed by SQLite)
export { useLocalStore, type UseLocalStoreOptions } from './useLocalStore';

// Primitives
export { Box, Row, Col, Text, Image, FocusGroup, styleToCSS, colorToCSS } from './primitives';

// Typography
export { Typography } from './Typography';

// Video
export { Video } from './Video';
export { VideoPlayer } from './VideoPlayer';

// Emulator
export { Emulator } from './Emulator';

// ScrollView
export { ScrollView } from './ScrollView';

// Portal system
export { Portal, PortalHost, type PortalProps, type PortalHostProps } from './Portal';

// Components
export { Pressable, type PressableProps, type PressableState, type HitSlop } from './Pressable';
export { Modal, type ModalProps } from './Modal';
export {
  ImageGallery,
  type ImageGalleryProps,
} from './ImageGallery';
export {
  HoverPreviewRowsGallery,
  type HoverPreviewRowsGalleryProps,
} from './HoverPreviewRowsGallery';
export {
  BentoImageGallery,
  type BentoImageGalleryProps,
} from './BentoImageGallery';
export {
  ImageViewerModal,
  type ImageViewerModalProps,
  type ImageGalleryItem,
} from './ImageViewerModal';

// TextInput
export { TextInput } from './TextInput';

// TextEditor (Lua-owned document editor)
export { TextEditor } from './TextEditor';

// CodeBlock (Lua-owned code renderer)
export { CodeBlock } from './CodeBlock';
export type { CodeBlockProps } from './CodeBlock';

// ContextMenu (Lua-owned right-click menu)
export { ContextMenu } from './ContextMenu';
export type { ContextMenuProps, ContextMenuItem, ContextMenuEvent, FocusGroupProps } from './types';

// FlatList
export { FlatList } from './FlatList';

// Slider
export { Slider, type SliderProps } from './Slider';

// Switch
export { Switch, type SwitchProps } from './Switch';

// Form primitives
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Radio, RadioGroup, type RadioProps, type RadioGroupProps } from './Radio';
export { Select, type SelectProps, type SelectOption } from './Select';

// Layout
export { FlexRow, type FlexRowProps } from './FlexRow';
export { FlexColumn, type FlexColumnProps } from './FlexColumn';
export { Spacer, type SpacerProps } from './Spacer';

// Card
export { Card, type CardProps } from './Card';

// Badge
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';

// Divider
export { Divider, type DividerProps } from './Divider';

// Navigation
export { NavPanel, type NavPanelProps, type NavItem, type NavSection } from './NavPanel';
export { Tabs, type TabsProps, type Tab } from './Tabs';
export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItem } from './Breadcrumbs';
export { Toolbar, type ToolbarProps, type ToolbarEntry } from './Toolbar';

// Data visualization
export { Table, type TableProps, type TableColumn } from './Table';
export { BarChart, type BarChartProps, type BarChartBar } from './BarChart';
export { ProgressBar, type ProgressBarProps } from './ProgressBar';
export { Sparkline, type SparklineProps } from './Sparkline';
export { ChartTooltip, type ChartTooltipProps } from './ChartTooltip';
export { HorizontalBarChart, type HorizontalBarChartProps, type HorizontalBarChartBar } from './HorizontalBarChart';
export { StackedBarChart, type StackedBarChartProps, type StackedBarChartSeries } from './StackedBarChart';
export { LineChart, type LineChartProps, type LineChartPoint } from './LineChart';
export { AreaChart, type AreaChartProps } from './AreaChart';
export { PieChart, type PieChartProps, type PieChartSegment } from './PieChart';
export { RadarChart, type RadarChartProps, type RadarChartAxis } from './RadarChart';

// Animation
export {
  AnimatedValue,
  useAnimation,
  useSpring,
  useTransition,
  Easing,
  parallel,
  sequence,
  stagger,
  loop,
  type Animation,
  type EasingFunction,
  type TimingConfig,
  type SpringConfig,
  type InterpolationConfig,
} from './animation';

// Colors
export { colors, type CatppuccinColor } from './colors';

// Pixel art (Box-based Unicode symbol rendering)
export { usePixelArt, PixelArt, getPixelArtSymbols, type PixelArtOptions, type PixelArtProps } from './usePixelArt';

// System info
export {
  useSystemInfo,
  formatUptime,
  formatBytes,
  formatMemory,
  type SystemInfo,
  type MemoryInfo,
  type UptimeInfo,
} from './useSystemInfo';

// System monitoring (htop/nvtop level)
export {
  useSystemMonitor,
  formatRate,
  formatTotalBytes,
  type SystemMonitor,
  type CpuInfo,
  type CoreInfo,
  type DetailedMemory,
  type ProcessInfo,
  type TaskCounts,
  type GpuInfo,
  type NetworkInterface,
  type DiskDevice,
} from './useSystemMonitor';

// Port monitoring
export {
  usePorts,
  type PortInfo,
  type PortMonitor,
} from './usePorts';

// Chat / messaging UI
export { MessageBubble, type MessageBubbleProps, type MessageBubbleVariant } from './MessageBubble';
export { ChatInput, type ChatInputProps } from './ChatInput';
export { MessageList, type MessageListProps } from './MessageList';
export { LoadingDots, type LoadingDotsProps } from './LoadingDots';
export { ActionBar, type ActionBarProps, type ActionBarItem } from './ActionBar';
export { ConversationCard, type ConversationCardProps } from './ConversationCard';

// Debug tools
export { useDebug, getDebugData, registerDebug } from './useDebug';
export { DebugOverlay, DebugBox, useDebugOverlay } from './DebugOverlay';

// Declarative native capabilities
export { Native } from './Native';
export { Audio, Timer, LLMAgent, Window, Pin, PWM, SerialPort, I2CDevice, SPIDevice, Boids, ImageSelect } from './capabilities';
export { useCapabilities } from './useCapabilities';
export type {
  NativeProps, AudioProps, TimerProps, LLMAgentProps, WindowProps,
  PinProps, PWMProps, SerialPortProps, I2CDeviceProps, SPIDeviceProps,
  BoidsProps, ImageSelectProps,
  CapabilitySchema,
} from './types';

// GPIO hooks
export {
  usePin, usePWM, useSerial, useI2C,
  type UsePinOptions, type UsePinResult,
  type UsePWMOptions, type UsePWMResult,
  type UseSerialOptions, type UseSerialResult,
  type UseI2COptions, type UseI2CResult,
} from './useGPIO';

// Generative canvas effects
export {
  Spirograph, Rings, FlowParticles, Mirror, Mandala, Cymatics,
  Constellation, Mycelium, Pipes, StainedGlass, Voronoi, Contours, Feedback, PixelSort, TextEffect,
  Terrain, Automata, Combustion, ReactionDiffusion, EdgeGravity, Orbits, Plotter, LSystem,
  type EffectProps, type SpirographProps, type MirrorProps, type CymaticsProps, type TextEffectProps, type TextEffectType,
} from './effects';

// Post-processing masks (foreground overlays)
export {
  Scanlines, CRT, VHS, Dither, Ascii,
  type MaskProps, type ScanlinesProps, type CRTProps, type VHSProps, type DitherProps, type AsciiProps,
} from './masks';

// Cartridge Inspector
export { CartridgeInspector, type CartridgeInspectorProps } from './CartridgeInspector';
