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

/** Full theme definition. */
export interface Theme {
  name: string;
  displayName: string;
  colors: ThemeColors;
}

/** Options for createTheme — partial overrides on a base theme. */
export interface CreateThemeOptions {
  name: string;
  displayName?: string;
  extends?: string;
  colors?: Partial<ThemeColors> & { palette?: Record<string, string> };
}

/** Context value exposed by ThemeProvider. */
export interface ThemeContextValue {
  themeId: string;
  setTheme: (id: string) => void;
  colors: ThemeColors;
}
