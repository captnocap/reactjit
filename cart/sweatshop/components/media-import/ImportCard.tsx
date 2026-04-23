const React: any = require('react');

import { Box, Col, Image, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import type { MediaImportItem } from './useMediaImport';

const Video: any = (props: any) => React.createElement('Video', props, props.children);

function Badge(props: { label: string; tone: string }) {
  return <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusPill, backgroundColor: props.tone, borderWidth: 1, borderColor: COLORS.borderSoft }}><Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text></Box>;
}

export function ImportCard(props: { item: MediaImportItem; thumbSize: number; onRemove: () => void }) {
  const item = props.item;
  const kindTone = item.kind === 'video' ? COLORS.greenDeep : item.kind === 'gif' ? COLORS.orangeDeep : COLORS.blueDeep;
  return (
    <HoverPressable onPress={() => {}} hoverScale={1.01} style={{ width: Math.max(140, props.thumbSize + 56), gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: item.status === 'failed' ? COLORS.red : item.status === 'ready' ? COLORS.border : COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Box style={{ width: '100%', height: props.thumbSize, borderRadius: TOKENS.radiusMd, overflow: 'hidden', backgroundColor: COLORS.panelBg, borderWidth: 1, borderColor: COLORS.borderSoft }}>
        {item.status === 'failed' ? (
          <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: COLORS.redDeep }}>
            <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>failed</Text>
            <Text fontSize={9} color={COLORS.textDim} numberOfLines={1}>{item.error || 'import error'}</Text>
          </Box>
        ) : item.kind === 'video' ? (
          <Video source={item.path} video_src={item.path} paused={true} loop={false} volume={0} time={0} style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }} />
        ) : (
          <Image source={item.path} style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }} />
        )}
      </Box>
      <Col style={{ gap: 3, minWidth: 0 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>{item.name}</Text>
          <Badge label={item.kind.toUpperCase()} tone={kindTone} />
        </Row>
        <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.textDim}>{Math.max(0, Math.round(item.size / 1024)) + ' KB'}</Text>
          <Text fontSize={9} color={item.status === 'ready' ? COLORS.green : item.status === 'failed' ? COLORS.red : COLORS.textDim}>{item.status}</Text>
        </Row>
      </Col>
      <Pressable onPress={props.onRemove} style={{ position: 'absolute', right: 10, top: 10, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusMd, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
        <Text fontSize={10} color={COLORS.textDim}>x</Text>
      </Pressable>
    </HoverPressable>
  );
}
