// Chart palette mirrored against the Cockpit theme token contract.
// See cart/app/gallery/themes/cockpit/theme-classifier.ts.
// Keys are chart-idiomatic (pink/cyan/blue…); values are cockpit tokens so
// swapping themes only requires re-mapping here.
export const PALETTE = {
  // Category tones (cockpit data channels)
  pink: 'theme:atch',       // theme: atch
  cyan: 'theme:tool',       // theme: tool
  blue: 'theme:blue',       // theme: sys
  indigo: 'theme:lilac',
  purple: 'theme:lilac',     // theme: ctx / lilac
  teal: 'theme:ok',       // theme: usr / ok
  orange: 'theme:accent',     // theme: ast / accent
  orangeHot: 'theme:accentHot',  // theme: accentHot
  red: 'theme:flag',        // theme: flag / wnd
  green: 'theme:pin',      // theme: pin
  amber: 'theme:warn',      // theme: warn

  // Tonal variants (darken / lighten of the core category tones)
  pinkLight: 'theme:atch',
  pinkDark: 'theme:atch',
  cyanLight: 'theme:tool',
  cyanDark: 'theme:tool',
  blueLight: 'theme:blue',
  blueDark: 'theme:blue',

  // Ink ladder (cockpit text)
  slate: 'theme:inkDimmer',      // theme: inkDimmer
  slateLight: 'theme:inkDim', // theme: inkDim
  white: 'theme:ink',      // theme: ink

  // Surface
  bg: 'theme:bg',         // theme: bg
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
