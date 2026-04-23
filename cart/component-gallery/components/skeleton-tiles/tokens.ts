import { CHAT_CARD } from '../generic-chat-card/tokens';

export const SKELETON = {
  surfaceWidth: 470,
  surfaceHeight: 332,
  tileWidth: 146,
  tileHeight: 154,
  footerHeight: 18,
  contentHeight: 136,
  background: '#1b1f2f',
  tileBg: '#231d25',
  tileMuted: '#2a2530',
  frame: '#433641',
  shadow: '#090b13',
  warm: '#cf835c',
  cool: '#18b6c8',
  rose: '#d07f8d',
  green: '#52be82',
  orange: CHAT_CARD.orange,
  cyan: CHAT_CARD.cyan,
  pink: CHAT_CARD.pink,
  gold: CHAT_CARD.gold,
  text: '#d4c2b9',
  faint: '#927a78',
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
