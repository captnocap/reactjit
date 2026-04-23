import { Box, Col, Image, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { WeatherCurrent } from '../../lib/apis';

function iconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

export function CurrentConditions(props: { current: WeatherCurrent | null; loading: boolean; error?: string }) {
  const current = props.current;
  const condition = current?.weather?.[0];
  return (
    <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 180 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Current conditions</Text>
          <Text fontSize={10} color={COLORS.textDim}>{current ? `${current.name}, ${current.sys.country}` : 'Waiting for weather data'}</Text>
        </Col>
        {condition?.icon ? <Image source={iconUrl(condition.icon)} style={{ width: 64, height: 64 }} /> : null}
        <Col style={{ alignItems: 'flex-end' }}>
          <Text fontSize={24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{current ? `${Math.round(current.main.temp)}°` : '—'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{condition?.description || '—'}</Text>
        </Col>
      </Row>

      <Row style={{ gap: 12, flexWrap: 'wrap' }}>
        <Metric label="Feels like" value={current ? `${Math.round(current.main.feels_like)}°` : '—'} />
        <Metric label="Humidity" value={current ? `${current.main.humidity}%` : '—'} />
        <Metric label="Wind" value={current ? `${Math.round(current.wind.speed)} mph` : '—'} />
        <Metric label="Pressure" value={current ? `${current.main.pressure} hPa` : '—'} />
        <Metric label="Visibility" value={current ? `${Math.round((current.visibility || 0) / 1000)} km` : '—'} />
      </Row>

      {props.loading ? <Text fontSize={10} color={COLORS.textDim}>Loading current conditions...</Text> : null}
      {props.error ? <Text fontSize={10} color={COLORS.red}>{props.error}</Text> : null}
    </Box>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <Col style={{ gap: 1, minWidth: 92 }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.4, fontWeight: 'bold' }}>{props.label}</Text>
      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.value}</Text>
    </Col>
  );
}
