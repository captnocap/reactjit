import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { useLocation } from './hooks/useLocation';
import { useWeather } from './hooks/useWeather';
import { LocationPicker } from './LocationPicker';
import { CurrentConditions } from './CurrentConditions';
import { DailyForecast } from './DailyForecast';
import { HourlyForecast } from './HourlyForecast';
import { WeatherMap } from './WeatherMap';

export function WeatherPanel(props: { title?: string; onClose?: () => void }) {
  const location = useLocation();
  const weather = useWeather(location.location);
  const suggestions = weather.geocode.data || [];

  async function useDeviceLocation() {
    const host: any = globalThis as any;
    const names = ['__geolocation_current', '__geolocation_lookup', '__geolocation_get', '__geolocation_position'];
    const fnName = names.find((name) => typeof host[name] === 'function');
    if (!fnName) return;
    const result = await Promise.resolve(host[fnName]());
    const next = Array.isArray(result) ? result[0] : result;
    if (next && typeof next === 'object') {
      location.setResolved({
        city: next.city || next.name || location.location.city,
        name: next.name || next.city || location.location.name,
        country: next.country || next.countryCode || location.location.country,
        state: next.state || location.location.state,
        lat: next.lat,
        lon: next.lon,
      });
    }
  }

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'Weather'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Real OpenWeather current conditions and forecast data, keyed by your API credentials.</Text>
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ padding: 14, gap: 12 }}>
          {weather.banner ? <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}><Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>{weather.banner}</Text></Box> : null}
          <LocationPicker
            location={location.location}
            query={location.location.city}
            onQueryChange={location.setCity}
            onPickLocation={location.setResolved}
            onUnitsChange={location.setUnits}
            onUseDeviceLocation={useDeviceLocation}
            suggestions={suggestions}
            loading={weather.geocode.loading}
            error={weather.geocode.error?.message}
          />
          <CurrentConditions current={weather.current.data} loading={weather.current.loading} error={weather.current.error?.message} />
          <Row style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 320 }}>
              <DailyForecast forecast={weather.forecast.data} loading={weather.forecast.loading} error={weather.forecast.error?.message} />
            </Box>
            <Box style={{ width: 360, flexShrink: 0, minWidth: 300 }}>
              <WeatherMap current={weather.current.data} />
            </Box>
          </Row>
          <HourlyForecast forecast={weather.forecast.data} loading={weather.forecast.loading} error={weather.forecast.error?.message} />
        </Col>
      </ScrollView>
    </Col>
  );
}
