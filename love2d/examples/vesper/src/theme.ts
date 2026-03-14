/**
 * Vesper Theme — Phosphor terminal aesthetic.
 *
 * Near-black backgrounds, violet accent, opacity-based text hierarchy,
 * role-coded colors for user/assistant/system/tool messages.
 * Minimal border radius (2-8px). Monospace-first typography.
 */

import { createTheme, registerTheme } from '@reactjit/theme';

// ── Color Palette ────────────────────────────────────────

export const V = {
  // Backgrounds
  bg:          '#0a0a0a',
  bgAlt:       '#0c0c10',
  bgElevated:  '#0e0e12',
  bgSurface:   '#111116',
  bgInset:     '#080808',

  // Text (opacity-based hierarchy)
  text:          'rgba(255, 255, 255, 0.92)',
  textSecondary: 'rgba(255, 255, 255, 0.60)',
  textDim:       'rgba(255, 255, 255, 0.40)',
  textMuted:     'rgba(255, 255, 255, 0.25)',

  // Accent: Violet
  accent:        '#8B5CF6',
  accentHover:   '#7C3AED',
  accentPressed: '#6D28D9',
  accentSubtle:  'rgba(139, 92, 246, 0.12)',
  accentGlow:    'rgba(139, 92, 246, 0.20)',

  // Role colors
  user:          '#10B981',
  userSubtle:    'rgba(16, 185, 129, 0.10)',
  userGlow:      'rgba(16, 185, 129, 0.15)',
  assistant:     '#F59E0B',
  assistantSubtle: 'rgba(245, 158, 11, 0.10)',
  assistantGlow: 'rgba(245, 158, 11, 0.15)',
  system:        '#4A90D9',
  systemSubtle:  'rgba(74, 144, 217, 0.10)',
  tool:          '#06B6D4',
  toolSubtle:    'rgba(6, 182, 212, 0.10)',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  // Borders
  border:       '#222222',
  borderSubtle: '#1a1a1a',
  borderStrong: '#333333',

  // Provider brand colors
  anthropic: '#D97757',
  openai:    '#10A37F',
  ollama:    '#FFFFFF',
  google:    '#4285F4',
} as const;

// ── Theme Registration ───────────────────────────────────

export const vesperTheme = createTheme({
  name: 'vesper',
  displayName: 'Vesper',
  colors: {
    bg:             V.bg,
    bgAlt:          V.bgAlt,
    bgElevated:     V.bgElevated,
    text:           V.text,
    textSecondary:  V.textSecondary,
    textDim:        V.textDim,
    primary:        V.accent,
    primaryHover:   V.accentHover,
    primaryPressed: V.accentPressed,
    surface:        V.bgSurface,
    surfaceHover:   V.bgElevated,
    border:         V.border,
    borderFocus:    V.accent,
    accent:         V.accent,
    error:          V.error,
    warning:        V.warning,
    success:        V.success,
    info:           V.info,
    palette: {
      user:            V.user,
      userSubtle:      V.userSubtle,
      userGlow:        V.userGlow,
      assistant:       V.assistant,
      assistantSubtle: V.assistantSubtle,
      assistantGlow:   V.assistantGlow,
      system:          V.system,
      systemSubtle:    V.systemSubtle,
      tool:            V.tool,
      toolSubtle:      V.toolSubtle,
      accentSubtle:    V.accentSubtle,
      accentGlow:      V.accentGlow,
      bgInset:         V.bgInset,
      borderSubtle:    V.borderSubtle,
      borderStrong:    V.borderStrong,
      anthropic:       V.anthropic,
      openai:          V.openai,
      ollama:          V.ollama,
      google:          V.google,
    },
  },
  typography: {
    fontSize:   { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22 },
    fontWeight: { normal: '400', medium: '500', bold: '700' },
    lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radii:   { none: 0, sm: 2, md: 4, lg: 6, full: 9999 },
});

registerTheme(vesperTheme);
