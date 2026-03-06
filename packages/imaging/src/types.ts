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
  | { op: 'blend'; mode: BlendMode; layerSrc: string; opacity?: number };

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
  /** Apply operations to the loaded image */
  apply: (operations: ImagingOperation[]) => void;
  /** Whether an operation is currently running */
  processing: boolean;
  /** Error message if the last operation failed */
  error: string | null;
}
