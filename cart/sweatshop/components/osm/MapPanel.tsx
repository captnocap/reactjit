const React: any = require('react');

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MapView } from './MapView';

function parseLatLon(text: string): { lat: number; lon: number } | null {
  const parts = text.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) return null;
  return { lat: parts[0], lon: parts[1] };
}

export function MapPanel(props: { title?: string; onClose?: () => void }) {
  const [center, setCenter] = React.useState({ lat: 52.52, lon: 13.405 });
  const [zoom, setZoom] = React.useState(12);
  const [query, setQuery] = React.useState('52.52,13.405');
  const [error, setError] = React.useState<string | null>(null);

  function recenter() {
    const next = parseLatLon(query);
    if (!next) {
      setError('Enter coordinates as lat,lon');
      return;
    }
    setError(null);
    setCenter(next);
  }

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'OpenStreetMap'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Real OSM tiles centered on Berlin by default. Drag to pan, wheel to zoom.</Text>
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      <Col style={{ padding: 12, gap: 10, minHeight: 0, flexGrow: 1 }}>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pressable onPress={() => setZoom((z) => Math.min(19, z + 1))} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright}>Zoom +</Text>
          </Pressable>
          <Pressable onPress={() => setZoom((z) => Math.max(1, z - 1))} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright}>Zoom -</Text>
          </Pressable>
          <TextInput value={query} onChange={setQuery} placeholder="lat,lon" fontSize={11} color={COLORS.textBright} style={{ minWidth: 180, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusMd }} />
          <Pressable onPress={recenter} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Recenter</Text>
          </Pressable>
          <Text fontSize={10} color={COLORS.textDim}>{`center ${center.lat.toFixed(4)}, ${center.lon.toFixed(4)} · z${zoom}`}</Text>
        </Row>
        {error ? <Box style={{ padding: 8, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}><Text fontSize={10} color={COLORS.red}>{error}</Text></Box> : null}
        <MapView center={center} zoom={zoom} onCenterChange={setCenter} onZoomChange={setZoom} onErrorChange={setError} />
      </Col>
    </Col>
  );
}
