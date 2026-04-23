import { Box, Col } from '../../../../runtime/primitives';
import { InsetPanel, SkeletonBars, TileCrossOverlay, TileFooter, TileStripeField } from './SkeletonParts';
import { SKELETON, getSkeletonFrame, type SkeletonSize, type SkeletonTone, toneColor } from './tokens';

export type SkeletonTileProps = {
  size: SkeletonSize;
  tone: SkeletonTone;
  footerLeft: string;
  footerRight: string;
  bars: { top: number; line: number; rows: number[] };
  compactPanel?: boolean;
  crossed?: boolean;
};

export function SkeletonTile(props: SkeletonTileProps) {
  const frame = getSkeletonFrame(props.size);
  const color = toneColor(props.tone);
  const compact = props.size === 'compact';

  return (
    <Col
      style={{
        position: 'relative',
        width: frame.tileWidth,
        height: frame.tileHeight,
        backgroundColor: SKELETON.tileBg,
        borderWidth: 1,
        borderColor: props.crossed ? '#7f3d27' : SKELETON.frame,
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: frame.contentHeight,
          backgroundColor: color,
          opacity: 0.05,
        }}
      />
      <TileStripeField tone={props.tone} size={props.size} />
      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: frame.contentHeight,
          borderBottomWidth: 1,
          borderColor: SKELETON.frame,
        }}
      />
      <Col style={{ height: frame.contentHeight, justifyContent: 'space-between', paddingTop: compact ? 6 : 10, paddingBottom: compact ? 6 : 10 }}>
        <Box style={{ paddingLeft: compact ? 5 : 8, paddingRight: compact ? 5 : 8 }}>
          <SkeletonBars tone={props.tone} profile={props.bars} size={props.size} />
        </Box>
        <Box style={{ paddingLeft: compact ? 5 : 8 }}>
          <InsetPanel tone={props.tone} compact={props.compactPanel} size={props.size} />
        </Box>
      </Col>
      {props.crossed ? <TileCrossOverlay size={props.size} /> : null}
      <TileFooter left={props.footerLeft} right={props.footerRight} tone={props.tone} size={props.size} warn={props.crossed} />
    </Col>
  );
}
