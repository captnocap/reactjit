/** Semantic color tokens that components consume. */
export interface ThemeColors {
  // Backgrounds
  bg: string;
  bgAlt: string;
  bgElevated: string;

  // Text
  text: string;
  textSecondary: string;
  textDim: string;

  // Interactive
  primary: string;
  primaryHover: string;
  primaryPressed: string;

  // Surfaces & borders
  surface: string;
  surfaceHover: string;
  border: string;
  borderFocus: string;

  // Status
  accent: string;
  error: string;
  warning: string;
  success: string;
  info: string;

  // Raw palette (full color ramp for custom use)
  palette: Record<string, string>;
}

/** Typography scale. */
export interface ThemeTypography {
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontWeight: { normal: string; medium: string; bold: string };
  lineHeight: { tight: number; normal: number; relaxed: number };
}

/** Spacing scale. */
export interface ThemeSpacing {
  xs: number; sm: number; md: number; lg: number; xl: number;
}

/** Border-radius scale. */
export interface ThemeRadii {
  none: number; sm: number; md: number; lg: number; full: number;
}

// ---------------------------------------------------------------------------
// Visual effects, shaders & sprites
// ---------------------------------------------------------------------------

/** A single effect or mask configuration bound to a theme. */
export interface ThemeEffectConfig {
  /** Registered effect/mask type name, e.g. "Spirograph", "CRT", "Voronoi". */
  type: string;
  /** Props forwarded to the effect/mask component. */
  props?: Record<string, unknown>;
}

/** Theme-level visual effects — background generators and post-processing masks. */
export interface ThemeEffects {
  /** Background effect applied to ThemeEffect-tagged containers. null = none. */
  background: ThemeEffectConfig | null;
  /** Post-processing mask applied to ThemeEffect-tagged containers. null = none. */
  mask: ThemeEffectConfig | null;
  /** Ambient particle/generative effect for hero areas. null = none. */
  ambient: ThemeEffectConfig | null;
}

/** Shader-grade color grading parameters (maps to shader_grade.lua uniforms). */
export interface ThemeShaderGrade {
  hueShift?: number;
  saturation?: number;
  value?: number;
  contrast?: number;
  posterize?: number;
  grain?: number;
  tint?: string;
  tintMix?: number;
  vignette?: number;
}

/** Theme-level shader grading — global + per-surface-role overrides. */
export interface ThemeShaders {
  /** Global shader grade. null = passthrough (no grading). */
  grade: ThemeShaderGrade | null;
  /** Per-surface-role overrides. Keys match semantic color roles. */
  surfaces?: Partial<Record<'bg' | 'elevated' | 'surface' | 'card', ThemeShaderGrade>>;
}

/** A sprite atlas definition within a theme. */
export interface ThemeSpriteAtlas {
  /** Path to the sprite sheet image (relative to project assets). */
  src: string;
  /** Grid columns. */
  cols: number;
  /** Grid rows. */
  rows: number;
  /** Frame width in pixels. */
  frameWidth: number;
  /** Frame height in pixels. */
  frameHeight: number;
  /** Named frames for semantic access: { "arrow-right": 12, "star": 7 }. */
  frames?: Record<string, number>;
}

/** Theme-level sprite atlases — named sprite sheets that change with the theme. */
export interface ThemeSprites {
  /** Named sprite atlases available in this theme. */
  atlases: Record<string, ThemeSpriteAtlas>;
}

// ---------------------------------------------------------------------------
// Theme & options
// ---------------------------------------------------------------------------

/** Full theme definition. */
export interface Theme {
  name: string;
  displayName: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  effects: ThemeEffects;
  shaders: ThemeShaders;
  sprites: ThemeSprites;
}

/** Options for createTheme — partial overrides on a base theme. */
export interface CreateThemeOptions {
  name: string;
  displayName?: string;
  extends?: string;
  colors?: Partial<ThemeColors> & { palette?: Record<string, string> };
  typography?: Partial<ThemeTypography>;
  spacing?: Partial<ThemeSpacing>;
  radii?: Partial<ThemeRadii>;
  effects?: Partial<ThemeEffects>;
  shaders?: Partial<ThemeShaders>;
  sprites?: Partial<ThemeSprites>;
}

/** Context value exposed by ThemeProvider. */
export interface ThemeContextValue {
  themeId: string;
  setTheme: (id: string) => void;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  effects: ThemeEffects;
  shaders: ThemeShaders;
  sprites: ThemeSprites;
}
