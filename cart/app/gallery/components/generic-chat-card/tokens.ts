export const CHAT_CARD = {
  width: 506,
  height: 584,
  railWidth: 28,
  cliffWidth: 18,
  bg: 'theme:bg1',
  panel: 'theme:bg1',
  panelDeep: 'theme:bg',
  panelSoft: 'theme:bg2',
  border: 'theme:inkGhost',
  borderSoft: 'theme:inkGhost',
  text: 'theme:ink',
  muted: 'theme:inkDim',
  faint: 'theme:blue',
  cyan: 'theme:tool',
  mint: 'theme:tool',
  green: 'theme:ok',
  violet: 'theme:lilac',
  pink: 'theme:atch',
  orange: 'theme:accent',
};

export type ChatTone = 'user' | 'agent' | 'thinking' | 'tool' | 'diff';

export type ConsoleMode = 'idle' | 'streaming' | 'stuck';
