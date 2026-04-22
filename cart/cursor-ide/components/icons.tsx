const React: any = require('react');

import { Box, Col, Row, Text } from '../../../runtime/primitives';

export type IconName = string;

export const ICON_NAMES = [
  'folder',
  'file',
  'git-branch',
  'git-commit',
  'terminal',
  'settings',
  'search',
  'chevron-up',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'play',
  'pause',
  'stop',
  'plus',
  'x',
  'refresh',
  'save',
  'copy',
  'paste',
  'check',
  'warn',
  'error',
  'clock',
  'menu',
  'dots-vertical',
  'arrow-up',
  'arrow-down',
  'panel-left',
  'panel-right',
  'panel-bottom',
  'chat',
  'pencil',
  'trash',
  'download',
  'upload',
  'home',
  'question-mark',
  'keyboard',
] as const;

export const ICON_GLYPHS: Record<string, string> = {
  folder: '🗀',
  file: '🗋',
  'git-branch': '⎇',
  'git-commit': '⦿',
  terminal: '>_',
  settings: '⚙',
  search: '⌕',
  'chevron-up': '⌃',
  'chevron-down': '⌄',
  'chevron-left': '‹',
  'chevron-right': '›',
  play: '▶',
  pause: '⏸',
  stop: '⏹',
  plus: '+',
  x: '×',
  refresh: '↻',
  save: '▣',
  copy: '⧉',
  paste: '⎘',
  check: '✓',
  warn: '⚠',
  error: '✕',
  clock: '◴',
  menu: '☰',
  'dots-vertical': '⋮',
  'arrow-up': '↑',
  'arrow-down': '↓',
  'panel-left': '◧',
  'panel-right': '◨',
  'panel-bottom': '▤',
  chat: '💬',
  pencil: '✎',
  trash: '⌫',
  download: '⇩',
  upload: '⇧',
  home: '⌂',
  'question-mark': '?',
  keyboard: '⌨',
};

function resolveIconGlyph(name: string): string {
  return ICON_GLYPHS[name] || '?';
}

export const ICON_CATALOG = ICON_NAMES.map((name) => ({ name, glyph: resolveIconGlyph(name) }));

export function Icon(props: { name: IconName; size?: number; color?: string }) {
  const size = props.size ?? 16;
  const glyph = resolveIconGlyph(props.name);
  const fontSize = glyph.length > 1 ? Math.max(8, Math.floor(size * 0.68)) : Math.max(10, Math.floor(size * 0.9));
  return (
    <Box
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text
        fontSize={fontSize}
        color={props.color || '#ccc'}
        style={{
          lineHeight: size,
          textAlign: 'center',
          fontFamily: 'monospace',
        }}
      >
        {glyph}
      </Text>
    </Box>
  );
}

export function IconGallery() {
  return <Box />;
}
