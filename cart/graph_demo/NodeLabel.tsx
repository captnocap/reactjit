const React: any = require('react');
const { useMemo } = React;

import { Box, Image, Pressable, Row, Text } from '../../runtime/primitives';
import { COLORS, TOKENS } from '../sweatshop/theme';
import type { ColorMode, DemoNode } from './LayoutEngine';
import { colorForNode, iconShapeForNode } from './LayoutEngine';

function svgDataUri(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function iconPathFor(kind: string): string {
  if (kind === 'root') return 'M12 3l7 4v8l-7 4-7-4V7l7-4zm0 3.3L7 9v6l5 2.7 5-2.7V9l-5-2.7z';
  if (kind === 'hub') return 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15zm0 3.1a4.4 4.4 0 1 1 0 8.8a4.4 4.4 0 0 1 0-8.8zm0-4.6v4m0 11.9v4m9-9h-4M7 12H3m12.7-6.7l-2.8 2.8M8.1 15.9l-2.8 2.8m11.4 0l-2.8-2.8M8.1 8.1L5.3 5.3';
  if (kind === 'branch') return 'M6 6v12M6 8c5 0 4 4 8 4s3-6 10-6M6 16c5 0 4-4 8-4s3 6 10 6';
  return 'M12 4l7 7-7 9-7-9 7-7z';
}

export function NodeLabel(props: {
  node: DemoNode;
  colorMode: ColorMode;
  selected?: boolean;
  dimmed?: boolean;
  pulse?: boolean;
  onPress?: () => void;
}) {
  const accent = colorForNode(props.node, props.colorMode);
  const shape = iconShapeForNode(props.node);
  const icon = useMemo(() => {
    const path = iconPathFor(shape);
    const stroke = props.selected ? '#ffffff' : accent;
    const fill = shape === 'leaf' ? `${accent}22` : `${accent}18`;
    return svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="${path}" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="${fill}" />
      </svg>
    `);
  }, [accent, props.selected, shape]);

  return (
    <Pressable onPress={props.onPress} style={{ width: '100%', height: '100%' }}>
      <Box
        style={{
          width: '100%',
          height: '100%',
          borderRadius: TOKENS.radiusMd,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 7,
          paddingBottom: 7,
          gap: 5,
          backgroundColor: props.selected ? COLORS.panelRaised : COLORS.panelBg,
          borderWidth: 1,
          borderColor: props.selected ? accent : COLORS.borderSoft,
          opacity: props.dimmed ? 0.24 : 1,
        }}
      >
        <Row style={{ gap: 7, alignItems: 'center', minWidth: 0 }}>
          <Box
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accent}14`,
              borderWidth: 1,
              borderColor: props.selected ? accent : `${accent}55`,
              transform: props.pulse ? { scale: 1.08 } : undefined,
            }}
          >
            <Image source={icon} style={{ width: 16, height: 16 }} />
          </Box>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>
            {props.node.label}
          </Text>
        </Row>
        <Row style={{ gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, backgroundColor: `${accent}18` }}>
            <Text fontSize={8} color={accent} style={{ fontWeight: 'bold' }}>{props.node.depth === 0 ? 'root' : `d${props.node.depth}`}</Text>
          </Box>
          <Text fontSize={8} color={COLORS.textDim}>deg {props.node.degree}</Text>
          <Text fontSize={8} color={COLORS.textDim}>c{props.node.cluster}</Text>
        </Row>
      </Box>
    </Pressable>
  );
}
