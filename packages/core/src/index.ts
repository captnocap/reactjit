// Types
export type {
  Style,
  Color,
  FileDropMode,
  LoveEvent,
  BoxProps,
  ColProps,
  TextProps,
  ImageProps,
  VideoProps,
  VideoPlayerProps,
  VideoTimeEvent,
  ScrollEvent,
  ScrollViewProps,
  ScrollViewRef,
  InputProps,
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
  ThemeColorsContext,
  useThemeColorsOptional,
} from './context';

// Viewport-proportional scaling
export { ScaleProvider, ScaleContext, useScale, useScaledStyle, NoScale } from './ScaleContext';
export type { ScaleProviderProps, ScaleContextValue } from './ScaleContext';
export { scaleStyle } from './scaleStyle';

// Hooks
export {
  useWindowDimensions,
  useWindowSize,
  useWindowPosition,
  useWindowAlwaysOnTop,
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
  useLuaInterval,
  type WindowControlOptions,
  type WebSocketStatus,
  type PeerMessage,
  type Overlay,
} from './hooks';

// Breakpoint / responsive grid
export {
  useBreakpoint,
  resolveSpan,
  spanToFlexBasis,
  BREAKPOINTS,
  RESPONSIVE_DEFAULTS,
  type Breakpoint,
  type SemanticSpan,
  type SpanValue,
} from './useBreakpoint';

// Tailwind class-to-style parser
export { tw } from './tw';

// Local store (persistent useState backed by SQLite)
export { useLocalStore, type UseLocalStoreOptions } from './useLocalStore';

// Hot state (useState that survives HMR — Lua memory, not disk)
export { useHotState } from './useHotState';

// State preservation (auto-intercept useState for HMR survival)
export {
  enableStatePreservation,
  disableStatePreservation,
  isStatePreservationEnabled,
  setPreservationBridge,
} from './preserveState';

// GIF recorder (capture Love2D window as animated GIF via ffmpeg)
export { useGifRecorder, type GifRecorderOptions, type GifRecorderResult } from './useGifRecorder';

// Primitives
export { Box, Row, Col, Text, Image, FocusGroup } from './primitives';

// Typography
export { Typography } from './Typography';

// Video
export { Video } from './Video';
export { VideoPlayer } from './VideoPlayer';

// Emulator
export { Emulator } from './Emulator';

// Terminal (PTY capability + hook)
export { Terminal, type TerminalProps } from './Terminal';
export { usePTY, type UsePTYOptions, type UsePTYResult, type TerminalCapabilityProps, type DirtyRow, type CursorState } from './usePTY';

// SemanticTerminal (classified PTY + playback + hook)
export { SemanticTerminal, type SemanticTerminalProps } from './SemanticTerminal';
export {
  useSemanticTerminal,
  type UseSemanticTerminalOptions,
  type UseSemanticTerminalResult,
  type ClassifiedRow,
  type GraphState,
  type PlayerState,
} from './useSemanticTerminal';

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

// Input (unified text input — replaces TextInput and TextEditor)
export { Input } from './Input';
/** @deprecated Use <Input /> */
export { TextInput } from './TextInput';

// Search components (headless, Lua-owned input lifecycle)
export {
  SearchBar, SearchResults, SearchResultsSections, SearchCombo, CommandPalette,
  SearchSchemaHint, AppSearch, Searchable,
} from './search';
export type {
  SearchBarProps,
  SearchResultsProps, SearchResultItem,
  SearchResultsSectionsProps, SearchSection,
  SearchComboProps, ComboItem,
  CommandPaletteProps, CommandDef,
  SearchSchemaHintProps,
  AppSearchProps, SearchableProps,
} from './search';

// Search hooks
export {
  useSearch,
  useFuzzySearch,
  useAsyncSearch,
  useSearchHistory,
  useSearchHighlight,
  useCommandSearch,
  useSearchSchema,
  detectSearchableFields,
  type UseSearchOptions,
  type FuzzySearchResult,
  type UseFuzzySearchOptions,
  type UseAsyncSearchOptions,
  type UseSearchHistoryOptions,
  type HighlightPart,
  type UseCommandSearchOptions,
  type SearchSchema,
} from './useSearch';

// App search (hot live-tree + cold compile-time index)
export {
  useAppSearch,
  type HotSearchResult,
  type ColdSearchEntry,
  type UseAppSearchOptions,
} from './useAppSearch';

/** @deprecated Use <Input multiline /> */
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
export { HorizontalBarChart, type HorizontalBarChartProps, type HorizontalBarChartBar } from './HorizontalBarChart';
export { StackedBarChart, type StackedBarChartProps, type StackedBarChartSeries } from './StackedBarChart';
export { LineChart, type LineChartProps, type LineChartPoint } from './LineChart';
export { CandlestickChart, type CandlestickChartProps, type CandlestickDataPoint } from './CandlestickChart';
export { AreaChart, type AreaChartProps } from './AreaChart';
export { PieChart, type PieChartProps, type PieChartSegment } from './PieChart';
export { RadarChart, type RadarChartProps, type RadarChartAxis } from './RadarChart';

// Animation
export {
  AnimatedValue,
  useAnimation,
  useSpring,
  useTransition,
  tickAnimations,
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
export { Audio, Timer, LLMAgent, Window, Notification, Pin, PWM, SerialPort, I2CDevice, SPIDevice, Boids, ImageSelect, ImageProcess } from './capabilities';
export { useCapabilities } from './useCapabilities';
export type {
  NativeProps, AudioProps, TimerProps, LLMAgentProps, WindowProps, NotificationProps,
  PinProps, PWMProps, SerialPortProps, I2CDeviceProps, SPIDeviceProps,
  BoidsProps, ImageSelectProps, ImageProcessProps,
  CapabilitySchema,
  TooltipProp, TooltipConfig,
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
  Sunburst,
  type EffectProps, type SpirographProps, type MirrorProps, type CymaticsProps, type TextEffectProps, type TextEffectType,
  type SunburstProps,
} from './effects';

// Post-processing masks (foreground overlays)
export {
  Scanlines, CRT, VHS, Dither, Ascii,
  type MaskProps, type ScanlinesProps, type CRTProps, type VHSProps, type DitherProps, type AsciiProps,
} from './masks';

// Cartridge Inspector
export { CartridgeInspector, type CartridgeInspectorProps } from './CartridgeInspector';

// Fleet (multi-agent Claude Code panel)
export { Fleet, type FleetProps } from './Fleet';
export {
  useFleet,
  type FleetOptions,
  type FleetAgentConfig,
  type FleetAgentState,
  type FleetPermission,
  type FleetQuestion,
  type FleetResult,
} from './useFleet';
