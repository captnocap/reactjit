/**
 * storybook.cls.ts — Classifier sheet for the ReactJIT storybook.
 *
 * This is the storybook's visual vocabulary. Import once at app entry.
 * All names are globally unique across every .cls.ts in the project.
 *
 * Theme tokens use 'theme:tokenName' — resolved at render time from
 * the active ThemeProvider. See ThemeColors for available tokens:
 *   bg, bgAlt, bgElevated, text, textSecondary, textDim,
 *   primary, primaryHover, primaryPressed, surface, surfaceHover,
 *   border, borderFocus, accent, error, warning, success, info
 */

import { classifier } from '../../../../packages/core/src';

// ── Palette (storybook accent colors — not theme tokens) ─

export const SB = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  warn: 'rgba(245, 158, 11, 0.08)',
  warnBorder: 'rgba(245, 158, 11, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
  orange: '#fb923c',
  dim: 'rgba(255,255,255,0.12)',
};

// ── Registration ────────────────────────────────────────

classifier({

  // ── Page shell ──────────────────────────────────────────
  // Full-viewport container
  StoryRoot: { type: 'Box', style: {
    width: '100%', height: '100%',
    backgroundColor: 'theme:bg',
  }},

  // ── Header bar ──────────────────────────────────────────
  // Pinned top: icon + title + badge + spacer + subtitle
  StoryHeader: { type: 'Row', style: {
    flexShrink: 0,
    backgroundColor: 'theme:bgElevated',
    borderBottomWidth: 1,
    borderColor: 'theme:border',
    paddingLeft: 20, paddingRight: 20,
    paddingTop: 12, paddingBottom: 12,
    gap: 14,
  }},

  // ── Footer bar ──────────────────────────────────────────
  // Pinned bottom: breadcrumb path
  StoryFooter: { type: 'Row', style: {
    flexShrink: 0,
    backgroundColor: 'theme:bgElevated',
    borderTopWidth: 1,
    borderColor: 'theme:border',
    paddingLeft: 20, paddingRight: 20,
    paddingTop: 6, paddingBottom: 6,
    gap: 12,
  }},

  // ── Hero band ───────────────────────────────────────────
  // Accent left border, full-width intro
  StoryHero: { type: 'Box', style: {
    borderLeftWidth: 3,
    paddingLeft: 25, paddingRight: 28,
    paddingTop: 24, paddingBottom: 24,
    gap: 8,
  }},

  // ── Band (zigzag row) ──────────────────────────────────
  // Two-column content row
  StoryBand: { type: 'Row', style: {
    paddingLeft: 28, paddingRight: 28,
    paddingTop: 20, paddingBottom: 20,
    gap: 24,
  }},

  // ── Half ────────────────────────────────────────────────
  // One side of a Band (50/50 split)
  StoryHalf: { type: 'Box', style: {
    flexGrow: 1, flexBasis: 0,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  }},

  // ── Full-width band ────────────────────────────────────
  StoryFullBand: { type: 'Box', style: {
    paddingLeft: 28, paddingRight: 28,
    paddingTop: 20, paddingBottom: 24,
    gap: 8,
  }},

  // ── Callout band ────────────────────────────────────────
  // Highlighted insight strip
  StoryCallout: { type: 'Row', style: {
    backgroundColor: SB.callout,
    borderLeftWidth: 3,
    borderColor: SB.calloutBorder,
    paddingLeft: 25, paddingRight: 28,
    paddingTop: 14, paddingBottom: 14,
    gap: 8,
  }},

  // ── Warning callout ─────────────────────────────────────
  StoryWarn: { type: 'Row', style: {
    backgroundColor: SB.warn,
    borderLeftWidth: 3,
    borderColor: SB.warnBorder,
    paddingLeft: 25, paddingRight: 28,
    paddingTop: 14, paddingBottom: 14,
    gap: 8,
  }},

  // ── Divider ─────────────────────────────────────────────
  StoryDivider: { type: 'Box', style: {
    height: 1, flexShrink: 0,
    backgroundColor: 'theme:border',
  }},

  // ── Demo well ───────────────────────────────────────────
  // Elevated surface for live demos
  StoryWell: { type: 'Box', style: {
    backgroundColor: 'theme:bgElevated',
    borderRadius: 8, padding: 14, gap: 10,
  }},

  // ── Package badge ───────────────────────────────────────
  // Small pill: @reactjit/packagename
  StoryBadge: { type: 'Box', style: {
    backgroundColor: SB.accentDim,
    borderRadius: 4,
    paddingLeft: 8, paddingRight: 8,
    paddingTop: 3, paddingBottom: 3,
  }},

  // ── Status dot ──────────────────────────────────────────
  StoryDot: { type: 'Box', style: {
    width: 5, height: 5, borderRadius: 3, flexShrink: 0,
  }},

  // ── Spacer ──────────────────────────────────────────────
  StorySpacer: { type: 'Box', grow: true },

  // ── Chip / tag ──────────────────────────────────────────
  StoryChip: { type: 'Box', style: {
    backgroundColor: 'theme:surface',
    borderRadius: 3,
    paddingLeft: 6, paddingRight: 6,
    paddingTop: 2, paddingBottom: 2,
  }},

  // ── Button ──────────────────────────────────────────────
  StoryBtn: { type: 'Box', style: {
    borderRadius: 5,
    paddingTop: 5, paddingBottom: 5,
    paddingLeft: 12, paddingRight: 12,
  }},

  // ── Small button ────────────────────────────────────────
  StoryBtnSm: { type: 'Box', style: {
    borderRadius: 4,
    paddingTop: 3, paddingBottom: 3,
    paddingLeft: 8, paddingRight: 8,
  }},

  // ── Section label row ───────────────────────────────────
  // Icon + uppercase text header inside a Half
  StorySectionLabel: { type: 'Row', style: { gap: 6 } },

  // ── Labeled value row ───────────────────────────────────
  StoryKV: { type: 'Row', style: { gap: 6, alignItems: 'flex-start' } },

  // ── Input surface ───────────────────────────────────────
  // Recessed area for displaying values (hash output, ciphertext, etc.)
  StoryInputWell: { type: 'Box', style: {
    backgroundColor: 'theme:surface',
    borderRadius: 4, padding: 6,
  }},

  // ── Progress bar track ──────────────────────────────────
  StoryTrack: { type: 'Box', style: {
    width: '100%', height: 4, borderRadius: 2,
    backgroundColor: SB.dim,
  }},

  // ── Progress bar fill ───────────────────────────────────
  StoryFill: { type: 'Box', style: {
    height: 4, borderRadius: 2,
  }},

  // ── Typography ──────────────────────────────────────────

  // Page title (20px bold, in header bar)
  StoryTitle: { type: 'Text', size: 20, bold: true, color: 'theme:text' },

  // Hero headline (13px bold)
  StoryHeadline: { type: 'Text', size: 13, bold: true, color: 'theme:text' },

  // Body text in bands (10px)
  StoryBody: { type: 'Text', size: 10, color: 'theme:text' },

  // Muted secondary text (10px)
  StoryMuted: { type: 'Text', size: 10, color: 'theme:textDim' },

  // Small caption (9px muted)
  StoryCap: { type: 'Text', size: 9, color: 'theme:textDim' },

  // Tiny text (8px muted)
  StoryTiny: { type: 'Text', size: 8, color: 'theme:textDim' },

  // Badge text (10px accent)
  StoryBadgeText: { type: 'Text', size: 10, color: SB.accent },

  // Section label text (8px bold, uppercase feel)
  StoryLabelText: { type: 'Text', size: 8, bold: true, color: 'theme:textDim', style: { letterSpacing: 1 } },

  // Footer breadcrumb (9px)
  StoryBreadcrumb: { type: 'Text', size: 9, color: 'theme:textDim' },

  // Footer breadcrumb active segment
  StoryBreadcrumbActive: { type: 'Text', size: 9, color: 'theme:text' },

  // Button text (10px bold)
  StoryBtnText: { type: 'Text', size: 10, bold: true },

  // Small button text (9px)
  StoryBtnSmText: { type: 'Text', size: 9 },

  // Error text
  StoryError: { type: 'Text', size: 10, color: SB.red },

  // ── Icons ───────────────────────────────────────────────

  // Header icon (18x18)
  StoryHeaderIcon: { type: 'Image', style: { width: 18, height: 18 } },

  // Section label icon (10x10)
  StorySectionIcon: { type: 'Image', style: { width: 10, height: 10 } },

  // Callout info icon (12x12)
  StoryInfoIcon: { type: 'Image', style: { width: 12, height: 12 } },

  // Footer icon (12x12)
  StoryFooterIcon: { type: 'Image', style: { width: 12, height: 12 } },

  // 0 occurrences
  RowCenter: { type: 'Box', style: { alignItems: 'center', flexDirection: 'row' } },

  // 0 occurrences
  Center: { type: 'Box', style: { alignItems: 'center', justifyContent: 'center' } },

  // 36 occurrences
  RowG8: { type: 'Box', style: { flexDirection: 'row', gap: 8 } },

  // 25 occurrences
  RowG6: { type: 'Box', style: { flexDirection: 'row', gap: 6 } },

  // 100 occurrences
  RowCenterG8: { type: 'Box', style: { alignItems: 'center', flexDirection: 'row', gap: 8 } },

  // 2 occurrences
  Icon12: { type: 'Image', style: { width: 12, height: 12 } },

  // 77 occurrences
  RowCenterG6: { type: 'Box', style: { alignItems: 'center', flexDirection: 'row', gap: 6 } },

  // 0 occurrences
  RowCenterBorder: { type: 'Box', style: { alignItems: 'center', borderColor: 'theme:border', flexDirection: 'row' } },

  // 7 occurrences
  CenterW100: { type: 'Box', style: { alignItems: 'center', width: '100%' } },

  // 2 occurrences
  RowWrap: { type: 'Box', style: { flexDirection: 'row', flexWrap: 'wrap' } },

  // 0 occurrences
  Bordered: { type: 'Box', style: { borderColor: 'theme:border', borderWidth: 1 } },

  // 0 occurrences
  GrowCenter: { type: 'Box', style: { flexGrow: 1, justifyContent: 'center' } },

  // 2 occurrences
  FullSize: { type: 'Box', style: { width: '100%', height: '100%' } },

  // 36 occurrences
  FullCenter: { type: 'Box', style: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    } },

  // 3 occurrences
  GrowCenterAlign: { type: 'Box', style: { alignItems: 'center', flexGrow: 1, justifyContent: 'center' } },

  // 0 occurrences
  CenterW100J: { type: 'Box', style: { justifyContent: 'center', width: '100%' } },

  // 13 occurrences
  RowG12: { type: 'Box', style: { flexDirection: 'row', gap: 12 } },

  // 12 occurrences
  Half: { type: 'Box', style: { flexBasis: 0, flexGrow: 1 } },

  // 52 occurrences
  StackG6W100: { type: 'Box', style: { gap: 6, width: '100%' } },

  // 22 occurrences
  RowG4: { type: 'Box', style: { flexDirection: 'row', gap: 4 } },

  // 22 occurrences
  RowCenterG4: { type: 'Box', style: { alignItems: 'center', flexDirection: 'row', gap: 4 } },

  // 2 occurrences
  RowCenterG12: { type: 'Box', style: { alignItems: 'center', flexDirection: 'row', gap: 12 } },

  // 0 occurrences
  RowG5: { type: 'Box', style: { flexDirection: 'row', gap: 5 } },

  // 29 occurrences
  RowCenterG5: { type: 'Box', style: { alignItems: 'center', flexDirection: 'row', gap: 5 } },

  // 0 occurrences
  BoldText: { type: 'Text', bold: true, color: 'theme:text' },

  // 1 occurrences
  DimIcon12: { type: 'Image', tintColor: 'theme:textDim', style: { height: 12, width: 12 } },

  // 4 occurrences
  TextIcon12: { type: 'Image', tintColor: 'theme:text', style: { height: 12, width: 12 } },

  // 27 occurrences
  Icon10: { type: 'Image', style: { width: 10, height: 10 } },

  // 0 occurrences
  SurfaceBordered: { type: 'Box', style: { backgroundColor: 'theme:surface', borderColor: 'theme:border', borderWidth: 1 } },

  // 6 occurrences
  HalfCenter: { type: 'Box', style: { flexBasis: 0, flexGrow: 1, justifyContent: 'center' } },

  // 0 occurrences
  GrowG8: { type: 'Box', style: { flexGrow: 1, gap: 8 } },

  // 38 occurrences
  StackG8W100: { type: 'Box', style: { gap: 8, width: '100%' } },

  // 49 occurrences
  SecondaryBody: { type: 'Text', size: 10, color: 'theme:textSecondary' },

  // 41 occurrences
  WhiteBody: { type: 'Text', size: 10, color: '#fff' },

  // 30 occurrences
  CenterG4: { type: 'Box', style: { alignItems: 'center', gap: 4 } },

  // 28 occurrences
  DimBody11: { type: 'Text', size: 11, color: 'theme:textDim' },

  // 11 occurrences
  StackG10W100: { type: 'Box', style: { gap: 10, width: '100%' } },

  // 23 occurrences
  StackG3W100: { type: 'Box', style: { gap: 3, width: '100%' } },

  // 22 occurrences
  StackG4W100: { type: 'Box', style: { gap: 4, width: '100%' } },

  // 0 occurrences
  VertDivider: { type: 'Box', style: { backgroundColor: 'theme:border', width: 1 } },

  // 0 occurrences
  SurfaceR6: { type: 'Box', style: { backgroundColor: 'theme:surface', borderRadius: 6 } },

  // 8 occurrences
  HorzDivider: { type: 'Box', style: { backgroundColor: 'theme:border', height: 1 } },

  // 20 occurrences
  WhiteTiny: { type: 'Text', size: 8, color: '#fff' },

  // 17 occurrences
  WhiteCaption: { type: 'Text', size: 9, color: '#fff' },

  // 16 occurrences
  DimMicro: { type: 'Text', size: 7, color: 'theme:textDim' },

  // 1 occurrences
  ScrollHalf: { type: 'ScrollView', style: { flexBasis: 0, flexGrow: 1 } },

  // 0 occurrences
  Dot6: { type: 'Box', style: { borderRadius: 3, height: 6 } },

  // 5 occurrences
  RowSpaceBetween: { type: 'Box', style: { flexDirection: 'row', justifyContent: 'space-between' } },

  // 1 occurrences
  DimChevron8: { type: 'Image', src: 'chevron-right', tintColor: 'theme:textDim', style: { height: 8, width: 8 } },

  // 0 occurrences
  BorderBottom: { type: 'Box', style: { borderBottomWidth: 1, borderColor: 'theme:border' } },

  // 10 occurrences
  RowGrow: { type: 'Box', style: { flexDirection: 'row', flexGrow: 1 } },

  // 0 occurrences
  Icon20: { type: 'Image', style: { height: 20, width: 20 } },

  // 0 occurrences
  PrimaryIcon20: { type: 'Image', tintColor: 'theme:primary', style: { height: 20, width: 20 } },

  // 5 occurrences
  RowG2: { type: 'Box', style: { flexDirection: 'row', gap: 2 } },

  // 0 occurrences
  PadV6: { type: 'Box', style: { paddingBottom: 6, paddingTop: 6 } },

  // 0 occurrences
  PadH6: { type: 'Box', style: { paddingLeft: 6, paddingRight: 6 } },

  // 0 occurrences
  RowW100: { type: 'Box', style: { flexDirection: 'row', width: '100%' } },

  // 15 occurrences
  DimNano: { type: 'Text', size: 4, color: 'theme:textDim' },

  // 13 occurrences
  WhiteMedText: { type: 'Text', size: 12, color: '#fff' },

  // 0 occurrences
  DimIcon8: { type: 'Image', tintColor: 'theme:textDim', style: { height: 8, width: 8 } },
});
