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

/** Full theme definition. */
export interface Theme {
  name: string;
  displayName: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
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
}

/** Context value exposed by ThemeProvider. */
export interface ThemeContextValue {
  themeId: string;
  setTheme: (id: string) => void;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}
