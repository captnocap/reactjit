const React: any = require('react');

import { Box, Col, Row, Text, Canvas } from '../../../runtime/primitives';

export type IconName = string;

type IconPath = {
  d: string;
  filled?: boolean;
  strokeWidth?: number;
};

const line = (d: string, strokeWidth?: number): IconPath => ({ d, strokeWidth });
const solid = (d: string, strokeWidth?: number): IconPath => ({ d, filled: true, strokeWidth });

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
}

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

const ICON_PATHS: Record<string, IconPath[]> = {
  folder: [
    line('M 3 7 h 6 l 2 2 h 10 v 10 H 3 Z'),
    line('M 3 7 v 10 h 18'),
  ],
  file: [
    line('M 6 3 h 8 l 4 4 v 14 H 6 Z'),
    line('M 14 3 v 5 h 4'),
  ],
  'git-branch': [
    line(circlePath(6, 5, 1.7)),
    line('M 6 6.7 V 12'),
    line(circlePath(6, 19, 1.7)),
    line('M 6 12 a 6 6 0 0 0 6 6 h 4'),
    line(circlePath(18, 18, 1.7)),
  ],
  'git-commit': [
    line(circlePath(12, 12, 7.25)),
    solid(circlePath(12, 12, 3.25)),
  ],
  terminal: [
    line('M 4 5 h 16 v 14 H 4 Z'),
    line('M 7 9 l 3 3 l -3 3'),
    line('M 13 15 h 4'),
  ],
  settings: [
    line(circlePath(12, 12, 3.2)),
    line(circlePath(12, 12, 7.4)),
    line('M 12 2.5 v 3'),
    line('M 12 18.5 v 3'),
    line('M 2.5 12 h 3'),
    line('M 18.5 12 h 3'),
    line('M 5.4 5.4 l 2.1 2.1'),
    line('M 16.5 16.5 l 2.1 2.1'),
    line('M 18.6 5.4 l -2.1 2.1'),
    line('M 5.4 18.6 l 2.1 -2.1'),
  ],
  search: [
    line(circlePath(11, 11, 6)),
    line('M 15.5 15.5 L 21 21'),
  ],
  'chevron-up': [line('M 6 14 l 6 -6 l 6 6')],
  'chevron-down': [line('M 6 10 l 6 6 l 6 -6')],
  'chevron-left': [line('M 14 6 l -6 6 l 6 6')],
  'chevron-right': [line('M 10 6 l 6 6 l -6 6')],
  play: [solid('M 8 5 v 14 l 11 -7 Z')],
  pause: [solid(rectPath(7, 5, 3, 14)), solid(rectPath(14, 5, 3, 14))],
  stop: [solid(rectPath(6, 6, 12, 12))],
  plus: [line('M 12 5 v 14'), line('M 5 12 h 14')],
  x: [line('M 6 6 l 12 12'), line('M 18 6 L 6 18')],
  refresh: [
    line('M 20 12 a 8 8 0 1 1 -2.34 -5.66'),
    line('M 20 4 v 6 h -6'),
  ],
  save: [
    line('M 5 3 h 12 l 2 2 v 16 H 5 Z'),
    line('M 7 3 v 6 h 8 V 3'),
    line('M 8 13 h 8'),
  ],
  copy: [
    line('M 8 8 h 10 v 11 H 8 Z'),
    line('M 6 5 h 10 v 11 H 6 Z'),
  ],
  paste: [
    line('M 9 4 h 6 a 2 2 0 0 1 2 2 v 2 H 7 V 6 a 2 2 0 0 1 2 -2 Z'),
    line('M 7 8 h 10 v 12 H 7 Z'),
  ],
  check: [line('M 5 13 l 4 4 l 10 -11')],
  warn: [
    line('M 12 4 l 9 16 H 3 Z'),
    line('M 12 9 v 5'),
    line('M 12 17 h 0.01'),
  ],
  error: [
    line(circlePath(12, 12, 9)),
    line('M 8 8 l 8 8'),
    line('M 16 8 l -8 8'),
  ],
  clock: [
    line(circlePath(12, 12, 9)),
    line('M 12 7 v 6 l 4 2'),
  ],
  menu: [
    line('M 4 6 h 16'),
    line('M 4 12 h 16'),
    line('M 4 18 h 16'),
  ],
  'dots-vertical': [
    line(circlePath(12, 6, 1)),
    line(circlePath(12, 12, 1)),
    line(circlePath(12, 18, 1)),
  ],
  'arrow-up': [
    line('M 12 19 V 5'),
    line('M 7 10 l 5 -5 l 5 5'),
  ],
  'arrow-down': [
    line('M 12 5 v 14'),
    line('M 7 14 l 5 5 l 5 -5'),
  ],
  'panel-left': [
    line('M 4 4 h 16 v 16 H 4 Z'),
    line('M 8 4 v 16'),
  ],
  'panel-right': [
    line('M 4 4 h 16 v 16 H 4 Z'),
    line('M 16 4 v 16'),
  ],
  'panel-bottom': [
    line('M 4 4 h 16 v 16 H 4 Z'),
    line('M 4 16 h 16'),
  ],
  chat: [
    line('M 4 6 h 16 v 10 H 9 l -5 4 Z'),
  ],
  pencil: [
    line('M 4 20 l 4 -1 l 11 -11 a 2.5 2.5 0 0 0 -3.5 -3.5 L 4.5 15.5 Z'),
    line('M 13 5 l 6 6'),
  ],
  trash: [
    line('M 4 7 h 16'),
    line('M 9 7 V 5 h 6 v 2'),
    line('M 7 7 l 1 13 h 8 l 1 -13'),
  ],
  download: [
    line('M 12 3 v 12'),
    line('M 7 10 l 5 5 l 5 -5'),
    line('M 4 19 h 16'),
  ],
  upload: [
    line('M 12 21 V 9'),
    line('M 7 14 l 5 -5 l 5 5'),
    line('M 4 5 h 16'),
  ],
  home: [
    line('M 3 11 l 9 -8 l 9 8'),
    line('M 5 10 v 10 h 14 V 10'),
  ],
  'question-mark': [
    line('M 9 9 a 3 3 0 1 1 5 2 c 0 2 -3 2 -3 5'),
    line('M 12 18 h 0.01'),
  ],
  keyboard: [
    line('M 4 7 h 16 v 10 H 4 Z'),
    line('M 7 10 h 0.01'),
    line('M 10 10 h 0.01'),
    line('M 13 10 h 0.01'),
    line('M 16 10 h 0.01'),
    line('M 7 13 h 10'),
  ],
};

export const ICON_GLYPHS: Record<string, string> = ICON_NAMES.reduce((acc, name) => {
  acc[name] = (ICON_PATHS[name] || [line('M 7 7 h 10 v 10 H 7 Z')]).map((part) => part.d).join(' ');
  return acc;
}, {} as Record<string, string>);

function resolveIconGlyph(name: string): string {
  return ICON_GLYPHS[name] || ICON_GLYPHS['question-mark'];
}

export const ICON_CATALOG = ICON_NAMES.map((name) => {
  const paths = ICON_PATHS[name] || [line('M 7 7 h 10 v 10 H 7 Z')];
  return { name, glyph: `${paths.length} path${paths.length === 1 ? '' : 's'}` };
});

function renderIconPaths(name: string, color: string) {
  const paths = ICON_PATHS[name] || ICON_PATHS['question-mark'];
  return paths.map((part, idx) => (
    <Canvas.Path
      key={`${name}-${idx}`}
      d={part.d}
      stroke={color}
      strokeWidth={part.strokeWidth ?? 1.8}
      fill={part.filled ? color : 'none'}
    />
  ));
}

export function Icon(props: { name: IconName; size?: number; color?: string }) {
  const size = props.size ?? 16;
  const color = props.color || '#ccc';
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
      <Box
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderIconPaths(props.name, color)}
      </Box>
    </Box>
  );
}

export function IconGallery() {
  return (
    <Box
      style={{
        padding: 12,
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#273142',
        backgroundColor: '#0f141c',
      }}
    >
      <Col style={{ gap: 4 }}>
        <Text fontSize={13} color="#e6edf3" style={{ fontWeight: 'bold' }}>
          Icon Gallery
        </Text>
        <Text fontSize={10} color="#8b949e">
          Smoke test for the cursor-ide vector icon catalog.
        </Text>
      </Col>
      <Row
        style={{
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        {ICON_CATALOG.map((entry) => (
          <Box
            key={entry.name}
            style={{
              width: 108,
              padding: 10,
              gap: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#243041',
              backgroundColor: '#121926',
            }}
          >
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#182233',
              }}
            >
              <Icon name={entry.name} size={18} color="#d7dde8" />
            </Box>
            <Text fontSize={10} color="#c9d1d9" style={{ fontWeight: 'bold' }}>
              {entry.name}
            </Text>
            <Text fontSize={9} color="#8b949e">
              {entry.glyph}
            </Text>
          </Box>
        ))}
      </Row>
    </Box>
  );
}
