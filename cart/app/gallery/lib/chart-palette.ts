// Chart palette mirrored against the Cockpit theme token contract.
// See cart/component-gallery/themes/cockpit/theme-classifier.ts.
// Keys are chart-idiomatic (pink/cyan/blue…); values are cockpit tokens so
// swapping themes only requires re-mapping here.
export const PALETTE = {
  // Category tones (cockpit data channels)
  pink: '#d48aa7',       // theme: atch
  cyan: '#6ac3d6',       // theme: tool
  blue: '#5a8bd6',       // theme: sys
  indigo: '#8a7fd4',
  purple: '#8a7fd4',     // theme: ctx / lilac
  teal: '#6aa390',       // theme: usr / ok
  orange: '#d26a2a',     // theme: ast / accent
  orangeHot: '#e8501c',  // theme: accentHot
  red: '#e14a2a',        // theme: flag / wnd
  green: '#8aca6a',      // theme: pin
  amber: '#d6a54a',      // theme: warn

  // Tonal variants (darken / lighten of the core category tones)
  pinkLight: '#d48aa7',
  pinkDark: '#d48aa7',
  cyanLight: '#6ac3d6',
  cyanDark: '#6ac3d6',
  blueLight: '#5a8bd6',
  blueDark: '#5a8bd6',

  // Ink ladder (cockpit text)
  slate: '#7a6e5d',      // theme: inkDimmer
  slateLight: '#b8a890', // theme: inkDim
  white: '#f2e8dc',      // theme: ink

  // Surface
  bg: '#0e0b09',         // theme: bg
};

// Ordered soft → hot. Single-series charts default to index 0 (pink/atch),
// which reads as "data" rather than "highlight". Accent colors (orange,
// amber, red) land at the end — they should only appear when the palette
// has already exhausted the peer/category tones, or explicitly as state.
export const COLORS = [
  PALETTE.pink,     // atch
  PALETTE.cyan,     // tool
  PALETTE.blue,     // sys
  PALETTE.teal,     // usr
  PALETTE.purple,   // ctx
  PALETTE.green,    // pin
  PALETTE.orange,   // ast / accent
  PALETTE.amber,    // warn
];
