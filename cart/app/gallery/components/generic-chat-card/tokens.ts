export const CHAT_CARD = {
  width: 506,
  height: 584,
  railWidth: 28,
  cliffWidth: 18,
  bg: '#14100d',
  panel: '#14100d',
  panelDeep: '#0e0b09',
  panelSoft: '#1a1511',
  border: '#4a4238',
  borderSoft: '#4a4238',
  text: '#f2e8dc',
  muted: '#b8a890',
  faint: '#5a8bd6',
  cyan: '#6ac3d6',
  mint: '#6ac3d6',
  green: '#6aa390',
  violet: '#8a7fd4',
  pink: '#d48aa7',
  orange: '#d26a2a',
};

export type ChatTone = 'user' | 'agent' | 'thinking' | 'tool' | 'diff';

export type ConsoleMode = 'idle' | 'streaming' | 'stuck';
