// CCServer
export { createCCServer, type CCServerOptions, type CCServerHandle } from './CCServer';

// Palette utilities
export { nearestCCColor, CC_PALETTE, CC_DEFAULT_FG, CC_DEFAULT_BG, type CCColor } from './palette';

// Re-export layout and flatten from grid (for consumers that imported from cc)
export { computeLayout, type LayoutNode } from '@reactjit/grid';
export { flatten, type DrawCommand } from '@reactjit/grid';
