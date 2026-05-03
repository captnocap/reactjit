// Gallery chrome surface + dark panel palette.
// All values mirror cockpit theme tokens — see
// cart/component-gallery/themes/cockpit/theme-classifier.ts.

export const PAGE_SURFACE = {
  id: 'page',
  label: 'Page Surface',
  width: 960,
  minHeight: 640,
  padding: 32,
  backgroundColor: '#e8dcc4', // theme: paper.paper
  borderColor: '#8a4a20',     // theme: paper.paperRuleBright
  textColor: '#2a1f14',       // theme: paper.paperInk
  mutedTextColor: '#7a6e5d',  // theme: paper.paperInkDim
  radius: 8,
};

export type GallerySurface = typeof PAGE_SURFACE;

export const COLORS = {
  appBg: '#0e0b09',       // theme: bg
  railBg: '#14100d',      // theme: bg1
  panelBg: '#1a1511',     // theme: bg2
  panelRaised: '#221c17', // one tier above bg2
  border: '#3a2a1e',      // theme: rule
  borderStrong: '#8a4a20',// theme: ruleBright
  text: '#f2e8dc',        // theme: ink
  muted: '#b8a890',       // theme: inkDim
  faint: '#7a6e5d',       // theme: inkDimmer
  accent: '#d26a2a',      // theme: accent
  accentInk: '#f2e8dc',   // cream ink on accent fills (cockpit ink)
  success: '#6aa390',     // theme: ok
  warning: '#d6a54a',     // theme: warn
  compose: '#8a7fd4',     // theme: ctx / lilac — top-level / composition tag
  previewBg: '#e8dcc4',   // warm paper for preview tiles
};
