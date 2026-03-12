// ============================================================================
// Imaging operation types
// ============================================================================

/** A single operation in an imaging pipeline */
export type ImagingOperation =
  | { op: 'brightness'; amount: number }
  | { op: 'contrast'; factor: number }
  | { op: 'levels'; inBlack?: number; inWhite?: number; gamma?: number; outBlack?: number; outWhite?: number }
  | { op: 'curves'; points: [number, number][] }
  | { op: 'hue_saturation'; hue?: number; saturation?: number; value?: number }
  | { op: 'invert' }
  | { op: 'threshold'; level?: number }
  | { op: 'posterize'; levels?: number }
  | { op: 'desaturate'; method?: 'luminosity' | 'average' | 'lightness' }
  | { op: 'colorize'; hue?: number; saturation?: number; lightness?: number }
  | { op: 'channel_mixer'; matrix: number[][] }
  | { op: 'gradient_map'; gradient: [number, number, number, number][] }
  | { op: 'gaussian_blur'; radius?: number }
  | { op: 'box_blur'; radius?: number }
  | { op: 'motion_blur'; angle?: number; distance?: number }
  | { op: 'sharpen'; amount?: number }
  | { op: 'edge_detect'; method?: 'sobel' | 'laplacian' }
  | { op: 'emboss'; angle?: number; depth?: number }
  | { op: 'pixelize'; size?: number }
  | { op: 'blend'; mode: BlendMode; layerSrc?: string; opacity?: number };

/** Available blend modes */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft_light'
  | 'hard_light'
  | 'dodge'
  | 'burn'
  | 'difference'
  | 'exclusion'
  | 'addition'
  | 'subtract'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'value';

// ============================================================================
// Component props
// ============================================================================

/** Props for the <Imaging> capability component */
export interface ImagingProps {
  /** Source image path */
  src: string;
  /** JSON-encoded operation pipeline */
  operations: ImagingOperation[];
  /** Output file path (optional, for save-to-disk) */
  output?: string;
  /** Fired when pipeline completes */
  onComplete?: (result: { outputPath?: string }) => void;
  /** Fired on pipeline error */
  onError?: (error: { message: string }) => void;
  /** Fired with preview canvas reference */
  onPreview?: (preview: { width: number; height: number }) => void;
}

// ============================================================================
// Hook return types
// ============================================================================

export interface UseImagingResult {
  /** Apply operations to an image source (or the procedural test pattern when src is omitted). */
  apply: (input: ImagingApplyRequest | ImagingOperation[]) => Promise<ImagingApplyResult | null>;
  /** Whether an operation is currently running */
  processing: boolean;
  /** Error message if the last operation failed */
  error: string | null;
}

// ============================================================================
// RPC contract
// ============================================================================

export interface ImagingApplyRequest {
  /** Source image path. Omit for a generated test pattern. */
  src?: string;
  /** Operation pipeline to apply. */
  operations: ImagingOperation[];
  /** Optional output file path for save-to-disk. */
  output?: string;
  /** Test pattern width when src is omitted. */
  width?: number;
  /** Test pattern height when src is omitted. */
  height?: number;
  /** Optional selection mask handle from imaging:selection_rasterize.
   *  When provided, ops are applied only inside the mask region. */
  maskId?: string;
}

export interface ImagingApplyResult {
  ok: boolean;
  width: number;
  height: number;
  didProcess: boolean;
  outputPath?: string;
  error?: string;
}

// ============================================================================
// Layer graph (non-destructive composition foundation)
// ============================================================================

export interface ImagingLayer {
  id: string;
  name?: string;
  visible?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  /** File path source. Mutually exclusive with drawCanvasId. */
  src?: string;
  /** Live DrawCanvas canvasId — composites the live paint canvas as a layer. */
  drawCanvasId?: string;
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  rotationUnit?: 'degrees' | 'radians';
  pivotX?: number;
  pivotY?: number;
  pivot?: ImagingLayerPivot;
  crop?: ImagingLayerCrop;
  transform?: ImagingLayerTransform;
  operations?: ImagingOperation[];
  children?: ImagingLayer[];
}

export interface ImagingLayerCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImagingLayerPivot {
  x: number;
  y: number;
  relative?: boolean;
  unit?: 'pixels' | 'relative' | 'normalized';
}

export interface ImagingLayerTransform {
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  rotationUnit?: 'degrees' | 'radians';
  pivotX?: number;
  pivotY?: number;
  pivot?: ImagingLayerPivot;
  crop?: ImagingLayerCrop;
}

export interface ImagingComposition {
  width: number;
  height: number;
  layers: ImagingLayer[];
}

export interface ImagingComposeRequest {
  composition: ImagingComposition;
  output?: string;
}

export interface ImagingComposeResult {
  ok: boolean;
  width: number;
  height: number;
  cacheHit?: boolean;
  dirtyRegions?: ImagingSelectionRect[];
  outputPath?: string;
  error?: string;
}

// ============================================================================
// History model (undo/redo primitives)
// ============================================================================

export interface ImagingHistoryEntry<TState = ImagingComposition> {
  id: string;
  label: string;
  timestamp: number;
  state: TState;
}

export interface ImagingHistoryState<TState = ImagingComposition> {
  past: ImagingHistoryEntry<TState>[];
  present: ImagingHistoryEntry<TState> | null;
  future: ImagingHistoryEntry<TState>[];
}

// ============================================================================
// Selection system
// ============================================================================

export interface ImagingSelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ImagingSelectionMode = 'replace' | 'add' | 'subtract' | 'intersect';

export interface ImagingSelectionState {
  mode: ImagingSelectionMode;
  rects: ImagingSelectionRect[];
}

/** A single geometric shape that defines a selection region. */
export interface ImagingSelectionShape {
  /** Shape type. */
  type: 'rect' | 'ellipse' | 'polygon';
  /** Rect/ellipse origin or ellipse center X. */
  x?: number;
  /** Rect/ellipse origin or ellipse center Y. */
  y?: number;
  /** Rect width or ellipse horizontal radius. */
  width?: number;
  /** Rect height or ellipse vertical radius. */
  height?: number;
  /** Polygon vertices as [x, y] pairs (polygon only). */
  points?: [number, number][];
}

export interface ImagingSelectionRasterizeRequest {
  shapes: ImagingSelectionShape[];
  width: number;
  height: number;
  mode?: ImagingSelectionMode;
  /** Soft-edge blur radius in pixels. */
  featherRadius?: number;
  /** Handle of an existing mask to modify (for add/subtract/intersect modes). */
  baseMaskId?: string;
}

export interface ImagingSelectionRasterizeResult {
  ok: boolean;
  /** In-memory mask handle — pass to imaging:apply's maskId. */
  maskId: string;
  error?: string;
}

export interface ImagingSelectionRasterizeOptions {
  /** Soft-edge blur radius in pixels. 0 keeps a hard edge. */
  featherRadius?: number;
}

// ============================================================================
// Tool state
// ============================================================================

export interface ImagingToolState {
  activeTool: 'move' | 'brush' | 'erase' | 'clone' | 'heal' | 'text' | 'transform';
  brushSize: number;
  brushOpacity: number;
}

// ============================================================================
// Object Detection
// ============================================================================

/** Parameters for foreground detection. All optional — auto-tuned if omitted. */
export interface DetectForegroundParams {
  /** Color distance threshold (0-1). Higher = more permissive foreground. Auto-tuned from border variance if omitted. */
  threshold?: number;
  /** Transition softness (0-1). Controls how gradual the fg/bg transition is. */
  softness?: number;
  /** Border sampling width in pixels. Pixels from image edges are sampled as "definite background". */
  borderWidth?: number;
  /** Morphological cleanup radius. Erode then dilate to remove noise. */
  morphRadius?: number;
  /** Edge feather radius. Gaussian blur applied to final mask edges. */
  featherRadius?: number;
  /** Edge refinement strength (0-1). Uses Sobel edges to sharpen mask boundaries. */
  edgeWeight?: number;
}

export interface DetectForegroundResult {
  ok: boolean;
  /** Mask handle — pass to compositeBackground or imaging:apply's maskId. */
  maskId: string;
  width: number;
  height: number;
  error?: string;
}

export interface CompositeBackgroundResult {
  ok: boolean;
  width: number;
  height: number;
  outputPath?: string;
  error?: string;
}

export interface UseObjectDetectResult {
  /** Detect foreground in an image. Returns a maskId for compositing. */
  detectForeground: (src: string, params?: DetectForegroundParams) => Promise<DetectForegroundResult | null>;
  /** Composite foreground over a new background using a detection mask. */
  compositeBackground: (src: string, background: string, maskId: string, output?: string) => Promise<CompositeBackgroundResult | null>;
  /** Release a detection mask from memory. */
  releaseMask: (maskId: string) => Promise<void>;
  /** Whether a detection or composite operation is running. */
  processing: boolean;
  /** Error from the last operation. */
  error: string | null;
}

// ============================================================================
// Flood Detection (seed-point)
// ============================================================================

/** Parameters for seed-point flood detection. */
export interface FloodDetectParams {
  /** Color distance threshold (0-1). Higher = more permissive region expansion. Default 0.2. */
  tolerance?: number;
  /** Compare against running region mean instead of seed color. Default true. */
  adaptive?: boolean;
  /** Existing mask handle to merge into. When provided, the new flood region is added to that mask. */
  baseMaskId?: string;
  /** Multi-channel edge consensus strength (0-1). Default 0.9. */
  edgeStrength?: number;
  /** Edge detection sensitivity threshold. Default 0.08. */
  edgeThreshold?: number;
  /** Morphological cleanup radius. */
  morphRadius?: number;
  /** Edge feather radius. */
  featherRadius?: number;
}

export interface FloodDetectResult {
  ok: boolean;
  /** Mask handle — pass to compositeBackground or imaging:apply's maskId. */
  maskId: string;
  width: number;
  height: number;
  /** Mean color of the detected region { r, g, b } (0-1 range). */
  meanColor?: { r: number; g: number; b: number };
  error?: string;
}

export interface UseFloodDetectResult {
  /** Flood-detect a region from a seed point. Returns a maskId for compositing. */
  floodDetect: (src: string, seedX: number, seedY: number, params?: FloodDetectParams) => Promise<FloodDetectResult | null>;
  /** Composite foreground over a new background using a detection mask. */
  compositeBackground: (src: string, background: string, maskId: string, output?: string) => Promise<CompositeBackgroundResult | null>;
  /** Release a detection mask from memory. */
  releaseMask: (maskId: string) => Promise<void>;
  /** Whether an operation is running. */
  processing: boolean;
  /** Error from the last operation. */
  error: string | null;
}

// ============================================================================
// Draw Canvas
// ============================================================================

/** Props for the <DrawCanvas> capability component. */
export interface DrawCanvasProps {
  /** Stable user-assigned ID used to address the canvas via RPCs. */
  canvasId: string;
  /** Canvas width in pixels. */
  width: number;
  /** Canvas height in pixels. */
  height: number;
  /** Background fill. 'transparent' (default) or a color table [r,g,b,a]. */
  background?: string;
}

export interface UseDrawCanvasResult {
  /** Stable canvas ID — pass to <Native type="DrawCanvas" canvasId={canvasId}> */
  canvasId: string;
  /** Draw a stroke along a list of [x, y] points. */
  paint: (
    points: [number, number][],
    color: [number, number, number, number],
    size: number,
    opacity?: number,
    maskId?: string,
  ) => Promise<void>;
  /** Erase (set to transparent) along a list of [x, y] points. */
  erase: (points: [number, number][], size: number) => Promise<void>;
  /** Flood-fill from a seed pixel. */
  fill: (
    x: number,
    y: number,
    color: [number, number, number, number],
    tolerance?: number,
  ) => Promise<void>;
  /** Clear the entire canvas (default: transparent). */
  clear: (color?: [number, number, number, number]) => Promise<void>;
  /** Sample a single pixel. Returns null if bridge unavailable. */
  getPixel: (x: number, y: number) => Promise<{ r: number; g: number; b: number; a: number } | null>;
  /** Save the canvas to a file and return the path. */
  export: (path: string) => Promise<{ ok: boolean; path: string } | null>;
}
