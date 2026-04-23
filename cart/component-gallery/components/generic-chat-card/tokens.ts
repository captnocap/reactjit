export const CHAT_CARD = {
  width: 506,
  height: 584,
  railWidth: 28,
  cliffWidth: 18,
  bg: '#20233a',
  panel: '#252840',
  panelDeep: '#171b31',
  panelSoft: '#2b3048',
  border: '#5f6687',
  borderSoft: '#444b6b',
  text: '#f2f4ff',
  muted: '#aeb7d3',
  faint: '#7f88aa',
  cyan: '#7eddf2',
  mint: '#9be7e2',
  green: '#57e0a5',
  violet: '#bfa3ff',
  pink: '#ff8fb3',
  orange: '#ffa066',
  gold: '#ffcf7a',
};

export type ChatTone = 'user' | 'agent' | 'thinking' | 'tool' | 'diff';

export type ConsoleMode = 'idle' | 'streaming' | 'stuck';
