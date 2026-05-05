import { CHAT_CARD } from '../generic-chat-card/tokens';

export const SKELETON = {
  surfaceWidth: 470,
  surfaceHeight: 332,
  tileWidth: 146,
  tileHeight: 154,
  footerHeight: 18,
  contentHeight: 136,
  background: 'theme:bg1',
  tileBg: 'theme:bg2',
  tileMuted: 'theme:bg2',
  frame: 'theme:inkGhost',
  shadow: 'theme:bg',
  warm: 'theme:accent',
  cool: 'theme:tool',
  rose: 'theme:atch',
  green: 'theme:ok',
  orange: CHAT_CARD.orange,
  cyan: CHAT_CARD.cyan,
  pink: CHAT_CARD.pink,
  gold: CHAT_CARD.gold,
  text: 'theme:inkDim',
  faint: 'theme:inkDimmer',
};

export const SKELETON_COMPACT = {
  surfaceWidth: 336,
  surfaceHeight: 174,
  tileWidth: 104,
  tileHeight: 78,
  footerHeight: 16,
  contentHeight: 62,
};

export type SkeletonTone = 'warm' | 'cool' | 'rose' | 'green';
export type SkeletonSize = 'default' | 'compact';

export function getSkeletonFrame(size: SkeletonSize) {
  return size === 'compact' ? SKELETON_COMPACT : SKELETON;
}

export function toneColor(tone: SkeletonTone): string {
  if (tone === 'cool') return SKELETON.cool;
  if (tone === 'rose') return SKELETON.rose;
  if (tone === 'green') return SKELETON.green;
  return SKELETON.warm;
}
