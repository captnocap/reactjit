import { CHAT_CARD } from '../generic-chat-card/tokens';

export const SKELETON = {
  surfaceWidth: 470,
  surfaceHeight: 332,
  tileWidth: 146,
  tileHeight: 154,
  footerHeight: 18,
  contentHeight: 136,
  background: '#14100d',
  tileBg: '#1a1511',
  tileMuted: '#1a1511',
  frame: '#4a4238',
  shadow: '#0e0b09',
  warm: '#d26a2a',
  cool: '#6ac3d6',
  rose: '#d48aa7',
  green: '#6aa390',
  orange: CHAT_CARD.orange,
  cyan: CHAT_CARD.cyan,
  pink: CHAT_CARD.pink,
  gold: CHAT_CARD.gold,
  text: '#b8a890',
  faint: '#7a6e5d',
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
