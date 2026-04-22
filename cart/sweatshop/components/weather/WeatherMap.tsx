import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { WeatherCurrent } from '../../lib/apis';

function tileHostFunctions(): string[] {
  const host: any = globalThis as any;
  return Object.keys(host).filter((name) => (name.startsWith('__geo_tile_') || name.startsWith('__weather_radar_') || name.startsWith('__map_tile_')) && typeof host[name] === 'function').sort();
}

export function WeatherMap(props: { current: WeatherCurrent | null }) {
  const fns = tileHostFunctions();
  return (
    <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Radar / map</Text>
          <Text fontSize={10} color={COLORS.textDim}>This runtime does not ship geo tile bindings. When host radar tiles exist, this panel can render them.</Text>
        </Col>
        <Text fontSize={10} color={COLORS.textDim}>{props.current?.name || 'No location'}</Text>
      </Row>
      <Box style={{ minHeight: 140, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <Col style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Radar tiles unavailable</Text>
          <Text fontSize={10} color={COLORS.textDim} style={{ textAlign: 'center' }}>
            {fns.length ? `Detected host tile bindings: ${fns.join(', ')}` : 'No geo tile host functions are registered in this runtime.'}
          </Text>
        </Col>
      </Box>
    </Box>
  );
}
