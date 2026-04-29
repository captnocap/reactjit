import { Box, Col, Image, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { WeatherForecast } from '../../lib/apis';

function iconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

type DayRow = {
  day: string;
  date: string;
  high: number;
  low: number;
  icon: string;
  desc: string;
  pop: number;
};

function groupDays(forecast: WeatherForecast | null): DayRow[] {
  if (!forecast?.list?.length) return [];
  const groups = new Map<string, WeatherForecast['list']>();
  for (const item of forecast.list) {
    const d = new Date(item.dt * 1000);
    const key = d.toDateString();
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  const rows: DayRow[] = [];
  for (const [key, list] of groups.entries()) {
    const first = list[0];
    const temps = list.map((item) => item.main.temp);
    const best = list.reduce((a, b) => {
      const at = Math.abs(new Date(a.dt * 1000).getHours() - 12);
      const bt = Math.abs(new Date(b.dt * 1000).getHours() - 12);
      return bt < at ? b : a;
    });
    const dt = new Date(first.dt * 1000);
    rows.push({
      day: dt.toLocaleDateString(undefined, { weekday: 'short' }),
      date: dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      high: Math.round(Math.max(...temps)),
      low: Math.round(Math.min(...temps)),
      icon: best.weather?.[0]?.icon || first.weather?.[0]?.icon || '',
      desc: best.weather?.[0]?.description || first.weather?.[0]?.description || '',
      pop: Math.round((Math.max(...list.map((item) => item.pop || 0))) * 100),
    });
  }
  return rows.slice(0, 7);
}

export function DailyForecast(props: { forecast: WeatherForecast | null; loading: boolean; error?: string }) {
  const rows = groupDays(props.forecast);
  return (
    <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Daily forecast</Text>
          <Text fontSize={10} color={COLORS.textDim}>Grouped from OpenWeather forecast data. Up to seven real days when available.</Text>
        </Col>
        {props.forecast ? <Text fontSize={10} color={COLORS.textDim}>{rows.length} days</Text> : null}
      </Row>

      <ScrollView horizontal={true} style={{ maxHeight: 120 }}>
        <Row style={{ gap: 8 }}>
          {rows.map((row) => (
            <Box key={row.date + row.day} style={{ width: 112, gap: 6, padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{row.day}</Text>
              <Text fontSize={9} color={COLORS.textDim}>{row.date}</Text>
              {row.icon ? <Image source={iconUrl(row.icon)} style={{ width: 40, height: 40 }} /> : null}
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{row.high}° / {row.low}°</Text>
              <Text fontSize={9} color={COLORS.textDim}>{row.desc}</Text>
              <Text fontSize={9} color={COLORS.blue}>Rain {row.pop}%</Text>
            </Box>
          ))}
        </Row>
      </ScrollView>

      {props.loading ? <Text fontSize={10} color={COLORS.textDim}>Loading daily forecast...</Text> : null}
      {props.error ? <Text fontSize={10} color={COLORS.red}>{props.error}</Text> : null}
    </Box>
  );
}
