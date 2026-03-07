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
});
