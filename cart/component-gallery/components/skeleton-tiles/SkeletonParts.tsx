import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { SKELETON, getSkeletonFrame, type SkeletonSize, type SkeletonTone, toneColor } from './tokens';

export function TileStripeField({ tone, size }: { tone: SkeletonTone; size: SkeletonSize }) {
  const color = toneColor(tone);
  const frame = getSkeletonFrame(size);
  const step = size === 'compact' ? 7 : 8;
  const lines = Array.from({ length: Math.ceil(frame.tileWidth / step) + 2 }, (_, index) => index * step + 4);

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {lines.map((left) => (
        <Box
          key={`stripe-${left}`}
          style={{
            position: 'absolute',
            left,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: color,
            opacity: 0.12,
          }}
        />
      ))}
    </Box>
  );
}

export function SkeletonBars({
  tone,
  profile,
  size,
}: {
  tone: SkeletonTone;
  profile: { top: number; line: number; rows: number[] };
  size: SkeletonSize;
}) {
  const color = toneColor(tone);
  const widthScale = size === 'compact' ? 0.62 : 1;
  const gap = size === 'compact' ? 4 : 6;
  const topHeight = size === 'compact' ? 8 : 14;
  const rowHeight = size === 'compact' ? 5 : 7;
  const rows = size === 'compact' ? profile.rows.slice(0, 2) : profile.rows;

  return (
    <Col style={{ gap }}>
      <Box style={{ width: Math.round(profile.top * widthScale), height: topHeight, backgroundColor: color, opacity: 0.42 }} />
      <Box style={{ width: Math.round(profile.line * widthScale), height: 2, backgroundColor: color, opacity: 0.4 }} />
      {rows.map((width, index) => (
        <Box key={`row-${index}`} style={{ width: Math.round(width * widthScale), height: rowHeight, backgroundColor: color, opacity: 0.24 + index * 0.06 }} />
      ))}
    </Col>
  );
}

export function InsetPanel({
  tone,
  compact = false,
  size,
}: {
  tone: SkeletonTone;
  compact?: boolean;
  size: SkeletonSize;
}) {
  const color = toneColor(tone);
  const dense = size === 'compact';
  const panelWidth = compact ? (dense ? 76 : 118) : dense ? 82 : 124;

  return (
    <Col
      style={{
        width: panelWidth,
        gap: dense ? 4 : 7,
        paddingLeft: dense ? 8 : 11,
        paddingRight: dense ? 8 : 11,
        paddingTop: dense ? 7 : 11,
        paddingBottom: dense ? 6 : 10,
        backgroundColor: '#281f26',
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Row style={{ alignItems: 'center', gap: dense ? 5 : 8 }}>
        <Box style={{ width: dense ? 6 : 10, height: dense ? 6 : 10, backgroundColor: color, borderRadius: 99 }} />
        <Box style={{ width: dense ? (compact ? 26 : 32) : compact ? 50 : 58, height: 2, backgroundColor: color, opacity: 0.74 }} />
      </Row>
      <Box style={{ width: dense ? (compact ? 24 : 30) : compact ? 48 : 58, height: 2, marginLeft: dense ? 11 : 18, backgroundColor: color, opacity: 0.44 }} />
    </Col>
  );
}

export function TileCrossOverlay({ size }: { size: SkeletonSize }) {
  const frame = getSkeletonFrame(size);
  const points = size === 'compact' ? 12 : 16;
  const pixel = size === 'compact' ? 2 : 2;
  const diagonal = Array.from({ length: points }, (_, index) => {
    const progress = points <= 1 ? 0 : index / (points - 1);
    return {
      x: Math.round(progress * (frame.tileWidth - pixel)),
      y: Math.round(progress * (frame.contentHeight - pixel)),
    };
  });

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, width: frame.tileWidth, height: frame.contentHeight, overflow: 'hidden', zIndex: 3 }}>
      {diagonal.map((point, index) => (
        <Box
          key={`diag-a-${index}`}
          style={{
            position: 'absolute',
            left: point.x,
            top: point.y,
            width: pixel,
            height: pixel,
            backgroundColor: '#cf6d40',
            opacity: 0.94,
          }}
        />
      ))}
      {diagonal.map((point, index) => (
        <Box
          key={`diag-b-${index}`}
          style={{
            position: 'absolute',
            left: frame.tileWidth - point.x - pixel,
            top: point.y,
            width: pixel,
            height: pixel,
            backgroundColor: '#cf6d40',
            opacity: 0.94,
          }}
        />
      ))}
    </Box>
  );
}

export function TileFooter({
  left,
  right,
  tone,
  size,
  warn = false,
}: {
  left: string;
  right: string;
  tone: SkeletonTone;
  size: SkeletonSize;
  warn?: boolean;
}) {
  const compact = size === 'compact';

  return (
    <Row
      style={{
        height: compact ? 16 : SKELETON.footerHeight,
        alignItems: 'center',
        gap: compact ? 4 : 6,
        paddingLeft: compact ? 3 : 4,
        paddingRight: compact ? 3 : 4,
        borderTopWidth: 1,
        borderColor: warn ? '#7f3d27' : SKELETON.frame,
      }}
    >
      <Box style={{ width: compact ? 13 : 16 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: compact ? 7 : 8, color: warn ? '#ff7b43' : toneColor(tone) }}>{left}</Text>
      </Box>
      <Box style={{ flexGrow: 1, minWidth: 0, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: 'monospace', fontSize: compact ? 7 : 7, color: warn ? '#ff9d67' : '#8db4a0' }}>{right}</Text>
      </Box>
    </Row>
  );
}
