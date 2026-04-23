import { Box, Col, Row } from '../../../../runtime/primitives';
import { SkeletonTile } from './SkeletonTile';
import { getSkeletonFrame, SKELETON, type SkeletonSize, type SkeletonTone } from './tokens';

export type SkeletonTilesProps = {
  size?: SkeletonSize;
};

type TileData = {
  tone: SkeletonTone;
  footerLeft: string;
  footerRight: string;
  bars: { top: number; line: number; rows: number[] };
  compactPanel?: boolean;
  crossed?: boolean;
};

const TILES: TileData[] = [
  { tone: 'rose', footerLeft: 'W1', footerRight: 'classifier · pass', bars: { top: 62, line: 110, rows: [30, 22, 56] } },
  { tone: 'cool', footerLeft: 'W2', footerRight: 'm3a echo · pass', bars: { top: 60, line: 112, rows: [44, 80, 52] }, compactPanel: true },
  { tone: 'warm', footerLeft: 'W3', footerRight: 'cockpit · l3', bars: { top: 66, line: 116, rows: [58, 42, 84] } },
  { tone: 'green', footerLeft: 'W4', footerRight: 'collision · diff', bars: { top: 62, line: 110, rows: [68, 38, 50] }, crossed: true },
  { tone: 'rose', footerLeft: 'W3', footerRight: 'strip · focus', bars: { top: 61, line: 100, rows: [78, 68, 54] }, compactPanel: true },
  { tone: 'cool', footerLeft: 'W1', footerRight: 'hook wire', bars: { top: 66, line: 112, rows: [84, 52, 34] } },
];

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

export function SkeletonTiles({ size = 'default' }: SkeletonTilesProps) {
  const frame = getSkeletonFrame(size);
  const gap = size === 'compact' ? 6 : 8;
  const padding = size === 'compact' ? 6 : 8;
  const rows = chunk(TILES, 3);

  return (
    <Box
      style={{
        width: frame.surfaceWidth,
        height: frame.surfaceHeight,
        padding,
        backgroundColor: SKELETON.background,
        borderWidth: 1,
        borderColor: '#3b425b',
      }}
    >
      <Col style={{ gap }}>
        {rows.map((row, rowIndex) => (
          <Row key={`row-${rowIndex}`} style={{ gap }}>
            {row.map((tile) => (
              <SkeletonTile
                key={`${tile.footerLeft}-${tile.footerRight}`}
                size={size}
                tone={tile.tone}
                footerLeft={tile.footerLeft}
                footerRight={tile.footerRight}
                bars={tile.bars}
                compactPanel={tile.compactPanel}
                crossed={tile.crossed}
              />
            ))}
          </Row>
        ))}
      </Col>
    </Box>
  );
}
