/**
 * Shared types for reactjit primitives and style system.
 *
 * Colors can be CSS strings ("#ff0000", "rgba(...)") or
 * Love2D-style number arrays [r, g, b, a] where each is 0-1.
 */

export type Color = string | [number, number, number, number?];

export interface Style {
  // Sizing
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;

  // Sizing
  aspectRatio?: number;

  // Flexbox
  display?: 'flex' | 'none';
  flexDirection?: 'row' | 'column';
  flexWrap?: 'nowrap' | 'wrap';
  justifyContent?:
    | 'start'
    | 'center'
    | 'end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  alignSelf?: 'auto' | 'start' | 'center' | 'end' | 'stretch';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string | 'auto';
  gap?: number | string;

  // Spacing
  padding?: number | string;
  paddingLeft?: number | string;
  paddingRight?: number | string;
  paddingTop?: number | string;
  paddingBottom?: number | string;
  margin?: number | string;
  marginLeft?: number | string;
  marginRight?: number | string;
  marginTop?: number | string;
  marginBottom?: number | string;

  // Visual
  backgroundColor?: Color;
  borderRadius?: number;
  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderColor?: Color;
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  opacity?: number;
  zIndex?: number;
  scrollX?: number;
  scrollY?: number;

  // Box Shadow
  shadowColor?: Color;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;

  // Gradient
  backgroundGradient?: {
    direction: 'horizontal' | 'vertical' | 'diagonal';
    colors: [Color, Color];
  };

  // Transform
  transform?: {
    translateX?: number;
    translateY?: number;
    rotate?: number; // degrees
    scaleX?: number;
    scaleY?: number;
    skewX?: number; // degrees
    skewY?: number; // degrees
    originX?: number; // 0-1, default 0.5 (center)
    originY?: number; // 0-1, default 0.5 (center)
  };

  // Text
  userSelect?: 'none' | 'text' | 'auto';
  color?: Color;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | number;
  textAlign?: 'left' | 'center' | 'right';
  whiteSpace?: 'normal' | 'nowrap';
  textWrap?: 'wrap' | 'nowrap';
  textOverflow?: 'clip' | 'ellipsis';
  textDecorationLine?: 'none' | 'underline' | 'line-through';
  lineHeight?: number;
  letterSpacing?: number;

  /** Override the global text scale for this subtree. Set to 1 to render at native size. */
  textScale?: number;

  // Image
  objectFit?: 'fill' | 'contain' | 'cover' | 'none';

  // Positioning (absolute overlays)
  position?: 'relative' | 'absolute';
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;

  // Visibility (hidden but occupies space, unlike display:'none')
  visibility?: 'visible' | 'hidden';

  // Per-corner border radius
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;

  // Per-side border colors
  borderTopColor?: Color;
  borderRightColor?: Color;
  borderBottomColor?: Color;
  borderLeftColor?: Color;

  // Text shadow
  textShadowColor?: Color;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;

  // Outline
  outlineColor?: Color;
  outlineWidth?: number;
  outlineOffset?: number;

  // Vector shape overrides (Love2D-only; ignored in web mode)
  // When set, backgroundColor paints this shape instead of a rectangle.
  arcShape?: {
    startAngle: number;   // radians, 0 = right, clockwise
    endAngle: number;     // radians
    innerRadius?: number; // pixels — creates a donut slice when > 0
  };
  // Flat [x0,y0, x1,y1, ...] polygon coords relative to box top-left.
  // backgroundColor fills this polygon instead of a rectangle.
  polygonPoints?: number[];

  // Stroked polyline paths for vector icons (Love2D-only; ignored in web mode).
  // Each sub-array is a polyline: [x0,y0, x1,y1, ...] in a 24x24 viewBox.
  // Scaled to fit the element's width/height. Drawn with love.graphics.line().
  strokePaths?: number[][];
  strokeWidth?: number;       // Line thickness (default 2)
  strokeColor?: Color;        // Defaults to `color` (inherits text color)

  // CSS Transitions (Lua-side: JS declares targets, Lua interpolates)
  // Per-property: transition: { backgroundColor: { duration: 300, easing: 'easeInOut' } }
  // Or all props:  transition: { all: { duration: 300 } }
  transition?: {
    [key: string]: {
      duration?: number;    // milliseconds (default 300)
      easing?: string;      // 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic'
      delay?: number;       // milliseconds (default 0)
    };
  };

  // CSS Keyframe Animations (Lua-side)
  animation?: {
    keyframes: {
      [percentage: number]: Partial<Style>;
    };
    duration?: number;          // milliseconds (default 300)
    easing?: string;            // easing function name (default 'linear')
    iterations?: number;        // -1 = infinite (default 1)
    direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
    fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
    delay?: number;             // milliseconds (default 0)
    playState?: 'running' | 'paused';
  };
}

export interface LoveEvent {
  type: string;
  targetId?: number;
  x?: number;
  y?: number;
  button?: number;
  key?: string;
  scancode?: string;
  isRepeat?: boolean;
  // Modifier key state (populated for keydown/keyup events)
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  text?: string;
  // Wheel events
  deltaX?: number;
  deltaY?: number;
  // Touch events
  touchId?: number | string;
  dx?: number;
  dy?: number;
  pressure?: number;
  // Gamepad events
  gamepadButton?: string;
  axis?: string;
  axisValue?: number;
  joystickId?: number;
  // MIDI events
  midiNote?: number;
  midiVelocity?: number;
  midiOn?: boolean;
  midiCC?: number;
  midiValue?: number;
  midiChannel?: number;
  midiDevice?: string;
  // Drag events
  startX?: number;
  startY?: number;
  totalDeltaX?: number;
  totalDeltaY?: number;
  // File drop events
  filePath?: string;
  fileSize?: number;
  fileDropMode?: FileDropMode;
  fileName?: string;
  fileExtension?: string;
  filePreviewText?: string;
  filePreviewTruncated?: boolean;
  filePreviewEncoding?: string;
  filePreviewError?: string;

  // Capability events (Audio, Timer, etc.)
  handler?: string;         // Which handler to invoke (e.g. "onProgress", "onTick")
  position?: number;        // Audio: current playback position
  duration?: number;        // Audio: total duration
  count?: number;           // Timer: tick count
  elapsed?: number;         // Timer: elapsed time
  message?: string;         // Error message

  // Bubbling support
  bubblePath?: number[];
  currentTarget?: number;
  stopPropagation?: () => void;
}

export type FileDropMode = 'upload' | 'preview';

export interface LayoutEvent {
  targetId?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Tooltip prop ──────────────────────────────────────────────────────────────

export interface TooltipConfig {
  content: string;

  // Placement
  type?: 'cursor' | 'anchor' | 'corner';
  prefer?: 'above' | 'below';
  anchor?: 'top' | 'bottom' | 'left' | 'right';
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  // Content formatting
  layout?: 'compact' | 'descriptive' | 'dense' | 'table';
  truncate?: boolean;
  maxLines?: number;

  // Timing
  delay?: number;

  // Style overrides
  style?: {
    maxWidth?: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string | number[];
    backgroundColor?: string | number[];
  };
}

export type TooltipProp = string | TooltipConfig;

export interface BoxProps {
  /** Tailwind utility classes. Lowest priority: className < shorthands < style={}. */
  className?: string;

  // Shorthand layout props — mapped to style, style={} wins if both set
  direction?: 'row' | 'col';
  gap?: number | string;
  padding?: number | string;
  px?: number | string;
  py?: number | string;
  margin?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  /** Horizontal alignment — maps to the correct flex property based on direction. */
  xAlign?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';
  /** Vertical alignment — maps to the correct flex property based on direction. */
  yAlign?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';
  fill?: boolean;
  fit?: boolean;
  grow?: boolean;
  bg?: Color;
  radius?: number;
  w?: number | string;
  h?: number | string;
  wrap?: boolean;
  scroll?: boolean;
  hidden?: boolean;
  z?: number;

  // Video backgrounds
  backgroundVideo?: string;
  backgroundVideoFit?: 'fill' | 'contain' | 'cover';
  hoverVideo?: string;
  hoverVideoFit?: 'fill' | 'contain' | 'cover';

  focusable?: boolean;
  focusGroup?: boolean;
  focusGroupController?: number;
  focusGroupRingColor?: [number, number, number, number?];

  style?: Style;
  hoverStyle?: Style;
  activeStyle?: Style;
  focusStyle?: Style;
  onClick?: (event: LoveEvent) => void;
  onRelease?: (event: LoveEvent) => void;
  onPointerEnter?: (event: LoveEvent) => void;
  onPointerLeave?: (event: LoveEvent) => void;
  onKeyDown?: (event: LoveEvent) => void;
  onKeyUp?: (event: LoveEvent) => void;
  onTextInput?: (event: LoveEvent) => void;
  onWheel?: (event: LoveEvent) => void;
  onTouchStart?: (event: LoveEvent) => void;
  onTouchEnd?: (event: LoveEvent) => void;
  onTouchMove?: (event: LoveEvent) => void;
  onGamepadPress?: (event: LoveEvent) => void;
  onGamepadRelease?: (event: LoveEvent) => void;
  onGamepadAxis?: (event: LoveEvent) => void;
  onMidiNote?: (event: LoveEvent) => void;
  onMidiCC?: (event: LoveEvent) => void;
  onDragStart?: (event: LoveEvent) => void;
  onDrag?: (event: LoveEvent) => void;
  onDragEnd?: (event: LoveEvent) => void;
  /**
   * Controls how Lua treats dropped files for this subtree.
   * - 'upload'  => metadata only (path/size), attachment-style flow
   * - 'preview' => attempts to read text content and includes it in filedrop events
   */
  fileDropMode?: FileDropMode;
  onFileDrop?: (event: LoveEvent) => void;
  onDirectoryDrop?: (event: LoveEvent) => void;
  onFileDragEnter?: (event: LoveEvent) => void;
  onFileDragLeave?: (event: LoveEvent) => void;
  onFocus?: (event: LoveEvent) => void;
  onBlur?: (event: LoveEvent) => void;
  onLayout?: (event: LayoutEvent) => void;

  /** Lua-owned tooltip. String for simple cursor-relative, object for full control. */
  tooltip?: TooltipProp;

  children?: React.ReactNode;
  key?: string | number;
}

export interface ColProps extends BoxProps {
  /** Fixed span (1-12) or semantic word. Applied at all breakpoints. */
  span?: import('./useBreakpoint').SpanValue;
  /** Span at sm (≥0px) breakpoint. */
  sm?: import('./useBreakpoint').SpanValue;
  /** Span at md (≥640px) breakpoint. */
  md?: import('./useBreakpoint').SpanValue;
  /** Span at lg (≥1024px) breakpoint. */
  lg?: import('./useBreakpoint').SpanValue;
  /** Span at xl (≥1440px) breakpoint. */
  xl?: import('./useBreakpoint').SpanValue;
  /** Auto-responsive: sm=12, md=6, lg=4, xl=3. Override with breakpoint props. */
  responsive?: boolean;
}

export interface TextProps {
  // Shorthand text props — mapped to style, style={} wins if both set
  size?: number;
  color?: Color;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  font?: string;
  lines?: number;

  style?: Style;
  numberOfLines?: number;
  onKeyDown?: (event: LoveEvent) => void;
  onKeyUp?: (event: LoveEvent) => void;
  onTextInput?: (event: LoveEvent) => void;
  children?: React.ReactNode;
  key?: string | number;
}

export interface ImageProps {
  src: string;
  // Shorthand props
  w?: number | string;
  h?: number | string;
  radius?: number;

  style?: Style;
  onClick?: (event: LoveEvent) => void;
  onWheel?: (event: LoveEvent) => void;
  key?: string | number;
}

export interface VideoTimeEvent {
  currentTime: number;
  duration?: number;
}

export interface VideoProps {
  src: string;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;

  // Shorthand props
  w?: number | string;
  h?: number | string;
  radius?: number;

  style?: Style;

  // Events
  onTimeUpdate?: (event: VideoTimeEvent) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReady?: () => void;
  onError?: (event: { message: string }) => void;
  onClick?: (event: LoveEvent) => void;

  key?: string | number;
}

export interface VideoPlayerProps extends VideoProps {
  controls?: boolean;
}

export interface DevToolsEmbedProps {
  style?: Style;
  w?: number | string;
  h?: number | string;
  key?: string | number;
}

export interface RenderProps {
  /**
   * Source identifier:
   * - "screen:N"       — screen capture (XShm fast path)
   * - "cam:N"          — webcam via v4l2
   * - "hdmi:N"         — HDMI capture card
   * - "window:Title"   — capture a window by title
   * - "/dev/videoN"    — direct v4l2 device
   * - "display"        — virtual display (Xephyr/Xvfb, apps render to it)
   * - "file.iso"       — boot a VM from ISO
   * - "vm:path.qcow2"  — boot a VM from disk image
   */
  source: string;
  /** Capture framerate (default: 30) */
  fps?: number;
  /** Capture resolution e.g. "1920x1080" (default: "1280x720") */
  resolution?: string;
  /** Enable mouse/keyboard input forwarding to source (default: false for capture, true for display/vm) */
  interactive?: boolean;
  /** Suppress audio from source (default: true) */
  muted?: boolean;
  /** Scaling mode (default: "contain") */
  objectFit?: 'fill' | 'contain' | 'cover';

  // VM configuration (only used when source is an ISO/disk image)
  /** VM RAM in MB (default: 2048) */
  vmMemory?: number;
  /** VM CPU count (default: 2) */
  vmCpus?: number;

  // Shorthand props
  w?: number | string;
  h?: number | string;
  radius?: number;

  style?: Style;

  // Events
  onReady?: (event?: { displayNumber?: number; vmInfo?: { pid: number; vncPort: number } }) => void;
  onError?: (event: { message: string }) => void;
  onFrame?: (event: { frameNumber: number }) => void;
  onClick?: (event: LoveEvent) => void;

  key?: string | number;
}

export interface EmulatorProps {
  /** ROM file path (relative to Love2D filesystem, e.g. "game.nes"). Optional — can load via file drop instead. */
  src?: string;
  /** Whether emulation is running (default: true) */
  playing?: boolean;

  // Shorthand props
  w?: number | string;
  h?: number | string;

  style?: Style;

  /** Fired when a ROM is loaded (from src prop or file drop) */
  onROMLoaded?: (event: { filename: string; fileSize: number; filePath: string }) => void;

  key?: string | number;
}

export interface LibretroProps {
  /** Path to libretro core shared library (.so/.dylib) */
  core?: string;
  /** Path to ROM file (Love2D VFS or absolute OS path) */
  rom?: string;
  /** Run or pause emulation (default: true) */
  running?: boolean;
  /** Audio volume 0-1 (default: 1) */
  volume?: number;
  /** Emulation speed multiplier (default: 1) */
  speed?: number;
  /** Mute audio (default: false) */
  muted?: boolean;

  style?: Style;
  w?: number | string;
  h?: number | string;

  /** Fired when core + ROM are loaded successfully */
  onLoaded?: (event: LoveEvent) => void;
  /** Fired on load or runtime error */
  onError?: (event: LoveEvent) => void;
  /** Fired when core is reset */
  onReset?: (event: LoveEvent) => void;

  key?: string | number;
}

export interface ScrollEvent {
  scrollX: number;
  scrollY: number;
  contentWidth: number;
  contentHeight: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ScrollViewProps {
  style?: Style;
  contentContainerStyle?: Style;
  horizontal?: boolean;
  showScrollIndicator?: boolean;
  onScroll?: (event: ScrollEvent) => void;
  onScrollBegin?: () => void;
  onScrollEnd?: () => void;
  children?: React.ReactNode;
  key?: string | number;
}

export interface ScrollViewRef {
  scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
}

export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  /** Called when focus is lost. Receives the current text value. */
  onBlur?: (text: string) => void;
  /**
   * Fired per-keystroke after a debounce delay (default 300ms). The entire
   * debounce runs in Lua — no per-keystroke bridge traffic. Use this for
   * live search, preview, or validation. For the final value on blur/submit,
   * use onChangeText or onSubmit instead.
   */
  onLiveChange?: (text: string) => void;
  /** Debounce delay in ms for onLiveChange. Default: 300. */
  liveChangeDebounce?: number;
  /** Called after the user stops typing for `changeDelay` seconds (idle detection). */
  onChange?: (text: string) => void;
  /** Seconds of idle time before onChange fires (default: 3). */
  changeDelay?: number;
  placeholder?: string;
  placeholderColor?: Color;
  maxLength?: number;
  /** Enable multi-line editing. Implied by lineNumbers, syntaxHighlight, or tooltipLevel. */
  multiline?: boolean;
  editable?: boolean;
  secureTextEntry?: boolean;
  /**
   * When true, keystrokes are forwarded live (via onLiveChange / onChange).
   * When false (default), the value only crosses the bridge on submit or blur.
   */
  live?: boolean;
  /** Hint for on-screen keyboard layout. Default: 'default'. */
  keyboardType?: 'default' | 'numeric' | 'email' | 'phone-pad' | 'url';
  /** Node type to forward raw keystrokes to (Lua → Lua, no bridge). e.g. "ClaudeCanvas" */
  keystrokeTarget?: string;
  /** Node type to dump submitted text to on enter (Lua → Lua, no bridge). Clears input after. */
  submitTarget?: string;
  /** Node type to forward Escape key to (Lua → Lua, no bridge). */
  escapeTarget?: string;
  /** When true on a multiline input, Enter submits and Shift+Enter inserts a newline. */
  submitOnEnter?: boolean;
  /** Enable inline spell checking with red underlines (default: false). */
  spellCheck?: boolean;
  /** Wrap long lines at the viewport edge instead of horizontal scroll (default: false). */
  wordWrap?: boolean;
  /** Show line numbers in the gutter (default: false). Implies multiline. */
  lineNumbers?: boolean;
  /** Enable JSX syntax highlighting (default: false). Implies multiline. */
  syntaxHighlight?: boolean;
  /** Hover tooltip verbosity for known identifiers. Implies multiline. */
  tooltipLevel?: 'beginner' | 'guided' | 'clean';
  /** PTY session ID for real-time keystroke passthrough. Implies multiline. */
  sessionId?: string;
  style?: Style;
  textStyle?: Style;
  autoFocus?: boolean;
  cursorColor?: Color;
  key?: string | number;
}

/** @deprecated Use InputProps */
export type TextInputProps = InputProps;


export interface FlatListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  horizontal?: boolean;

  // Item sizing (required for virtualization)
  itemHeight?: number;
  itemWidth?: number;
  estimatedItemSize?: number;

  // Callbacks
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScroll?: (event: ScrollEvent) => void;

  // Headers/footers
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  ListEmptyComponent?: React.ReactNode;

  // Separators
  ItemSeparatorComponent?: React.ReactNode;

  // Styling
  style?: Style;
  contentContainerStyle?: Style;

  // Performance
  initialNumToRender?: number;
  windowSize?: number;
  maxToRenderPerBatch?: number;

  // Misc
  inverted?: boolean;
  numColumns?: number;

  key?: string | number;
}

export interface FlatListRef {
  scrollToIndex(params: { index: number; animated?: boolean }): void;
  scrollToOffset(params: { offset: number; animated?: boolean }): void;
}

/** @deprecated Use InputProps */
export type TextEditorProps = InputProps;

export interface ContextMenuItem {
  /** Display label for the menu item. */
  label: string;
  /** Action identifier dispatched on selection. */
  action: string;
  /** Whether the item is grayed out / unclickable. */
  disabled?: boolean;
  /** Renders a divider line instead of an item. */
  separator?: boolean;
}

export interface ContextMenuEvent {
  /** The action string of the selected item. */
  action: string;
  /** ID of the node that was right-clicked. */
  targetId?: number;
  /** Whether text was selected when the menu opened. */
  hasSelection?: boolean;
  /** The selected text content (if any). */
  selectedText?: string;
}

export interface FocusGroupProps {
  /** Which controller (joystick ID) owns this group. Omit for any controller. */
  controller?: number;
  /** Focus ring color as [r, g, b, a] (0-1). Default: player-based (P1 blue, P2 red). */
  ringColor?: [number, number, number, number?];
  style?: Style;
  children?: React.ReactNode;
  key?: string | number;
}

export interface ContextMenuProps {
  /** Custom menu items added by the app. */
  items?: ContextMenuItem[];
  /** Called when any menu item (built-in or custom) is selected. */
  onSelect?: (event: ContextMenuEvent) => void;
  /** Called when the context menu opens. */
  onOpen?: () => void;
  /** Called when the context menu closes. */
  onClose?: () => void;
  children?: React.ReactNode;
  key?: string | number;
}

// ── Declarative Capability Components ────────────────────

/**
 * Props for the generic <Native> component.
 * Passes all props through to the Lua capability registry.
 */
export interface NativeProps {
  type: string;
  [key: string]: any;
}

/**
 * Declarative audio playback.
 *
 * @example
 * <Audio src="beat.mp3" playing loop volume={0.8} />
 * <Audio src="ambient.ogg" playing volume={0.3} onEnded={() => next()} />
 */
export interface AudioProps {
  src?: string;
  playing?: boolean;
  volume?: number;
  loop?: boolean;
  pitch?: number;
  onProgress?: (event: LoveEvent) => void;
  onEnded?: (event: LoveEvent) => void;
  onError?: (event: LoveEvent) => void;
  key?: string | number;
}

/**
 * Declarative timer.
 *
 * @example
 * <Timer interval={1000} onTick={() => setCount(c => c + 1)} />
 * <Timer interval={5000} repeat={false} onTick={() => showTimeout()} />
 */
/**
 * Boids flocking simulation powered by TSL (TypeScript-to-Lua transpiler).
 *
 * @example
 * <Boids count={60} speed={1.0} style={{ flexGrow: 1 }} />
 * <Boids count={80} speed={1.4} separation={1.2} alignment={0.9} cohesion={1.0} />
 */
export interface BoidsProps {
  count?: number;
  speed?: number;
  separation?: number;
  alignment?: number;
  cohesion?: number;
  running?: boolean;
  color?: Color;
  style?: Style;
  key?: string | number;
}

export interface TimerProps {
  interval: number;
  repeat?: boolean;
  running?: boolean;
  onTick?: (event: LoveEvent) => void;
  key?: string | number;
}

/**
 * Declarative local LLM agent with coroutine-based non-blocking inference.
 *
 * @example
 * <LLMAgent
 *   chatModel="path/to/model.gguf"
 *   onToken={(e) => setStream(e.fullText)}
 *   onDone={(e) => addMessage(e.response)}
 * />
 */
export interface LLMAgentProps {
  chatModel?: string;
  embedModel?: string;
  personality?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  memoryTopK?: number;
  onToken?: (event: LoveEvent) => void;
  onThink?: (event: LoveEvent) => void;
  onStateChange?: (event: LoveEvent) => void;
  onDone?: (event: LoveEvent) => void;
  onError?: (event: LoveEvent) => void;
  onReady?: (event: LoveEvent) => void;
  key?: string | number;
}

/**
 * Props for the <Window> component — renders children in a separate OS window.
 * All windows share the same React tree; state flows naturally via props/context.
 * SDL2 target only.
 */
export interface WindowProps {
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  /** Monitor/display index (1-based). Default: same monitor as the parent window. */
  display?: number;
  borderless?: boolean;
  alwaysOnTop?: boolean;
  onClose?: (event: LoveEvent) => void;
  onResize?: (event: LoveEvent) => void;
  onFocus?: (event: LoveEvent) => void;
  onBlur?: (event: LoveEvent) => void;
  children?: React.ReactNode;
  key?: string | number;
}

/**
 * Native OS notification via a borderless subprocess window.
 * Fire-and-forget: mounts → shows notification → auto-dismisses.
 *
 * @example
 * <Notification title="Build Complete" body="All tests passed" />
 * <Notification title="Error" body="Connection lost" duration={8} position="bottom-right" />
 */
export interface NotificationProps {
  title?: string;
  body?: string;
  /** Seconds before auto-dismiss (default 5) */
  duration?: number;
  /** Screen position (default "top-right") */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Hex color for accent stripe (default "4C9EFF") */
  accent?: string;
  /** Notification width (default 380) */
  width?: number;
  /** Notification height (default 100) */
  height?: number;
  /** Monitor/display index (1-based). Default: same monitor as the parent window. */
  display?: number;
  /** Exact X position (overrides position-based placement) */
  x?: number;
  /** Exact Y position (overrides position-based placement) */
  y?: number;
  onDismiss?: () => void;
  /** Custom content — when provided, renders a full React tree in the notification window */
  children?: React.ReactNode;
}

/**
 * Interactive image selection via flood fill + Sobel edge detection.
 * Click on the image to select a region; the mask overlay highlights selected pixels.
 * SDL2 target only (requires image_helper.so).
 *
 * @example
 * <ImageSelect
 *   src="photo.jpg"
 *   tolerance={32}
 *   edgeDetection
 *   selectX={point?.x}
 *   selectY={point?.y}
 *   onClick={(e) => setPoint({ x: e.x, y: e.y })}
 *   onMaskReady={(e) => console.log(e.pixelCount)}
 *   style={{ flexGrow: 1 }}
 * />
 */
export interface ImageSelectProps {
  /** Image file path */
  src?: string;
  /** Color distance threshold for flood fill (0–255, default 32) */
  tolerance?: number;
  /** Enable Sobel edge detection to block flood fill at edges */
  edgeDetection?: boolean;
  /** Sobel edge sensitivity threshold (0–255, default 30) */
  edgeThreshold?: number;
  /** Selection origin X coordinate (layout coords) */
  selectX?: number;
  /** Selection origin Y coordinate (layout coords) */
  selectY?: number;
  /** Selection mode: "select" or "remove-background" */
  mode?: 'select' | 'remove-background';
  /** Mask overlay color (hex with alpha, default #3399FF80) */
  maskColor?: string;
  /** Fired when mask computation completes */
  onMaskReady?: (event: LoveEvent) => void;
  /** Fired on image load error */
  onError?: (event: LoveEvent) => void;
  /** Click handler for selection origin */
  onClick?: (event: LoveEvent) => void;
  style?: Style;
  key?: string | number;
}

// ── Image Processing Capability ──────────────────────────

/**
 * Frame-distributed image resize + compress. Spreads CPU work across frames
 * so the UI never blocks. Drop it in, get progress events, done.
 *
 * @example
 * <ImageProcess
 *   src="/photos/big.jpg"
 *   output="/thumbs/big_800.jpg"
 *   width={800}
 *   quality={80}
 *   onProgress={(e) => setProgress(e.progress)}
 *   onComplete={(e) => console.log(e.outputPath, e.sizeBytes)}
 * />
 */
export interface ImageProcessProps {
  /** Source image path */
  src: string;
  /** Output file path */
  output: string;
  /** Target width (aspect-preserving if height omitted) */
  width?: number;
  /** Target height (aspect-preserving if width omitted) */
  height?: number;
  /** JPEG quality 1–100 (default 80) */
  quality?: number;
  /** Output format (default "jpeg") */
  format?: 'jpeg' | 'jpg' | 'png' | 'bmp';
  /** Max ms per frame for processing (default 4) */
  frameBudgetMs?: number;
  /** Progress callback: { phase: "load"|"resize", progress: 0–1 } */
  onProgress?: (event: LoveEvent) => void;
  /** Fires when processing is complete: { outputPath, width, height, sizeBytes, format } */
  onComplete?: (event: LoveEvent) => void;
  /** Fires on error: { message } */
  onError?: (event: LoveEvent) => void;
  key?: string | number;
}

// ── GPIO Capability Components ───────────────────────────

/**
 * Declarative GPIO digital pin (input or output).
 *
 * @example
 * <Pin pin={17} mode="output" value={ledOn} />
 * <Pin pin={4} mode="input" pull="up" edge="both" onChange={(e) => setButton(e.value)} />
 */
export interface PinProps {
  chip?: string;
  pin: number;
  mode?: 'input' | 'output';
  value?: boolean;
  pull?: 'none' | 'up' | 'down';
  edge?: 'none' | 'rising' | 'falling' | 'both';
  activeLow?: boolean;
  onChange?: (event: LoveEvent) => void;
  onRising?: (event: LoveEvent) => void;
  onFalling?: (event: LoveEvent) => void;
  key?: string | number;
}

/**
 * Software PWM via GPIO pin toggling.
 *
 * @example
 * <PWM pin={18} duty={brightness} />
 * <PWM pin={18} frequency={500} duty={0.5} enabled={motorOn} />
 */
export interface PWMProps {
  chip?: string;
  pin: number;
  frequency?: number;
  duty?: number;
  enabled?: boolean;
  key?: string | number;
}

/**
 * Declarative serial port (UART) for microcontroller communication.
 *
 * @example
 * <SerialPort port="/dev/ttyUSB0" baud={115200} onLine={(e) => handleData(e.line)} />
 */
export interface SerialPortProps {
  port: string;
  baud?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
  onLine?: (event: LoveEvent) => void;
  onData?: (event: LoveEvent) => void;
  onError?: (event: LoveEvent) => void;
  key?: string | number;
}

/**
 * Declarative I2C device with register polling.
 *
 * @example
 * <I2CDevice bus={1} address={0x48} register={0x00} pollInterval={100}
 *   onData={(e) => setTemperature(e.value)} />
 */
export interface I2CDeviceProps {
  bus?: number;
  address: number;
  register?: number;
  readLength?: number;
  pollInterval?: number;
  enabled?: boolean;
  onData?: (event: LoveEvent) => void;
  onError?: (event: LoveEvent) => void;
  key?: string | number;
}

/**
 * Declarative SPI device for full-duplex transfers.
 *
 * @example
 * <SPIDevice bus={0} device={0} speed={1000000} />
 */
export interface SPIDeviceProps {
  bus?: number;
  device?: number;
  speed?: number;
  mode?: number;
  bitsPerWord?: number;
  key?: string | number;
}

/**
 * Schema returned by capabilities:list RPC for AI discovery.
 */
export interface CapabilitySchema {
  schema: Record<string, {
    type: string;
    desc?: string;
    default?: any;
    min?: number;
    max?: number;
    values?: string[];
  }>;
  events: string[];
  visual: boolean;
}
