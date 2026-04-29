import { Box, Col, Image, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { WeatherForecast } from '../../lib/apis';

function iconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

export function HourlyForecast(props: { forecast: WeatherForecast | null; loading: boolean; error?: string }) {
  const items = props.forecast?.list || [];
  const now = Date.now();
  const hours = items.filter((item) => item.dt * 1000 >= now).slice(0, 8);
  return (
    <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Hourly forecast</Text>
          <Text fontSize={10} color={COLORS.textDim}>Next 24 hours from the forecast endpoint.</Text>
        </Col>
        {props.forecast ? <Text fontSize={10} color={COLORS.textDim}>{hours.length} entries</Text> : null}
      </Row>

      <ScrollView horizontal={true} style={{ maxHeight: 140 }}>
        <Row style={{ gap: 8 }}>
          {hours.map((item) => {
            const dt = new Date(item.dt * 1000);
            return (
              <Box key={String(item.dt)} style={{ width: 98, gap: 6, padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{dt.toLocaleTimeString(undefined, { hour: 'numeric' })}</Text>
                {item.weather?.[0]?.icon ? <Image source={iconUrl(item.weather[0].icon)} style={{ width: 34, height: 34 }} /> : null}
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{Math.round(item.main.temp)}°</Text>
                <Text fontSize={9} color={COLORS.textDim}>{item.weather?.[0]?.description || '—'}</Text>
                <Text fontSize={9} color={COLORS.textDim}>Pop {Math.round((item.pop || 0) * 100)}%</Text>
              </Box>
            );
          })}
        </Row>
      </ScrollView>

      {props.loading ? <Text fontSize={10} color={COLORS.textDim}>Loading hourly forecast...</Text> : null}
      {props.error ? <Text fontSize={10} color={COLORS.red}>{props.error}</Text> : null}
    </Box>
  );
}
