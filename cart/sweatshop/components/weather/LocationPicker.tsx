const React: any = require('react');

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import type { GeoLocation } from '../../lib/apis';
import type { WeatherLocation } from './hooks/useLocation';

function geolocationHostFunctions(): string[] {
  const host: any = globalThis as any;
  return Object.keys(host).filter((name) => name.startsWith('__geolocation_') && typeof host[name] === 'function').sort();
}

function labelForLocation(loc: WeatherLocation): string {
  if (loc.name) return [loc.name, loc.state, loc.country].filter(Boolean).join(', ');
  return loc.city || 'Choose a city';
}

export function LocationPicker(props: {
  location: WeatherLocation;
  query: string;
  onQueryChange: (value: string) => void;
  onPickLocation: (location: WeatherLocation) => void;
  onUnitsChange: (units: 'metric' | 'imperial') => void;
  onUseDeviceLocation?: () => void;
  suggestions: GeoLocation[];
  loading: boolean;
  error?: string;
}) {
  const geoFns = geolocationHostFunctions();
  return (
    <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Location</Text>
          <Text fontSize={10} color={COLORS.textDim}>Manual city entry drives real OpenWeather lookups. Geo host bindings, if present, can fill the current device location.</Text>
        </Col>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <HoverPressable onPress={() => props.onUnitsChange('metric')} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.location.units === 'metric' ? COLORS.blue : COLORS.border, backgroundColor: props.location.units === 'metric' ? COLORS.blueDeep : COLORS.panelAlt }}>
            <Text fontSize={10} color={props.location.units === 'metric' ? COLORS.blue : COLORS.textDim}>Metric</Text>
          </HoverPressable>
          <HoverPressable onPress={() => props.onUnitsChange('imperial')} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.location.units === 'imperial' ? COLORS.blue : COLORS.border, backgroundColor: props.location.units === 'imperial' ? COLORS.blueDeep : COLORS.panelAlt }}>
            <Text fontSize={10} color={props.location.units === 'imperial' ? COLORS.blue : COLORS.textDim}>Imperial</Text>
          </HoverPressable>
          <HoverPressable onPress={() => props.onUseDeviceLocation?.()} disabled={!props.onUseDeviceLocation || !geoFns.length} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: geoFns.length ? COLORS.green : COLORS.border, backgroundColor: geoFns.length ? COLORS.greenDeep : COLORS.panelAlt, opacity: props.onUseDeviceLocation && geoFns.length ? 1 : 0.6 }}>
            <Text fontSize={10} color={geoFns.length ? COLORS.green : COLORS.textDim}>Use device location</Text>
          </HoverPressable>
        </Row>
      </Row>

      <TextInput
        value={props.query}
        onChangeText={props.onQueryChange}
        placeholder="Enter a city"
        style={{ height: 36, paddingLeft: 10, paddingRight: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, color: COLORS.textBright }}
      />

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {props.suggestions.map((s) => (
          <Pressable key={`${s.name}:${s.lat}:${s.lon}`} onPress={() => props.onPickLocation({ city: s.name, name: s.name, country: s.country, state: s.state, lat: s.lat, lon: s.lon, units: props.location.units })}>
            <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.text}>{[s.name, s.state, s.country].filter(Boolean).join(', ')}</Text>
            </Box>
          </Pressable>
        ))}
      </Row>

      <Row style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textDim}>Selected: {labelForLocation(props.location)}</Text>
        <Text fontSize={10} color={COLORS.textDim}>Units: {props.location.units}</Text>
      </Row>

      {props.loading ? <Text fontSize={10} color={COLORS.textDim}>Searching weather...</Text> : null}
      {props.error ? <Text fontSize={10} color={COLORS.red}>{props.error}</Text> : null}
      {!geoFns.length ? <Text fontSize={9} color={COLORS.textDim}>Geo host bindings pending. Manual city lookup remains fully usable.</Text> : null}
    </Box>
  );
}
