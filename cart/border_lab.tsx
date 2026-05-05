// border_lab — pill gallery probing border rounding behavior.
//
// Each row demonstrates a different border treatment on a pill (radius=999).
// The "rainbow" pills stack four absolutely-positioned overlays, each
// contributing one side at its own borderColor — the framework only supports
// a single borderColor per Box, so per-corner color is faked through layering.
// If border rounding ignores radius on per-side widths, the seams will be
// visible at the curves.
//
// The dashed/flow rows hit framework/border_dash.zig directly.

import { Box, Row, Col, Text } from '@reactjit/runtime/primitives';

const PILL_W = 140;
const PILL_H = 44;
const RADIUS = PILL_H / 2; // proper pill

const C_TL = '#ff5d6c'; // red
const C_TR = '#ffd166'; // amber
const C_BR = '#5eead4'; // teal
const C_BL = '#a78bfa'; // violet

function Label({ children }: { children: any }) {
  return (
    <Text fontSize={11} color="#8b7c68" style={{ letterSpacing: 0.6 }}>
      {children}
    </Text>
  );
}

function PillBase({ children, style }: { children?: any; style?: any }) {
  return (
    <Box
      style={{
        width: PILL_W,
        height: PILL_H,
        borderRadius: RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

// Four-color pill: stack 4 overlays, each only contributing one side.
function RainbowPill({ width = 2 }: { width?: number }) {
  const overlay = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: RADIUS,
  };
  return (
    <Box style={{ width: PILL_W, height: PILL_H }}>
      <Box style={{ ...overlay, borderTopWidth: width, borderColor: C_TR }} />
      <Box style={{ ...overlay, borderRightWidth: width, borderColor: C_BR }} />
      <Box style={{ ...overlay, borderBottomWidth: width, borderColor: C_BL }} />
      <Box style={{ ...overlay, borderLeftWidth: width, borderColor: C_TL }} />
      <Box style={{ ...overlay, alignItems: 'center', justifyContent: 'center' }}>
        <Text fontSize={12} color="#f2e8dc" bold>rainbow</Text>
      </Box>
    </Box>
  );
}

function Pill({
  label,
  borderWidth,
  borderColor = '#f2e8dc',
  borderDashOn,
  borderDashOff,
  borderFlowSpeed,
  borderDashWidth,
  borderRadius = RADIUS,
}: any) {
  return (
    <PillBase
      style={{
        borderWidth,
        borderColor,
        borderDashOn,
        borderDashOff,
        borderFlowSpeed,
        borderDashWidth,
        borderRadius,
      }}
    >
      <Text fontSize={12} color="#f2e8dc" bold>{label}</Text>
    </PillBase>
  );
}

function GalleryRow({ title, children }: { title: string; children: any }) {
  return (
    <Col style={{ gap: 10, alignItems: 'flex-start' }}>
      <Label>{title}</Label>
      <Row style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </Row>
    </Col>
  );
}

export default function BorderLab() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0e0b09', padding: 32 }}>
      <Col style={{ gap: 32, alignItems: 'flex-start' }}>
        <Col style={{ gap: 6 }}>
          <Text fontSize={20} color="#f2e8dc" bold style={{ letterSpacing: 1.2 }}>
            BORDER · LAB
          </Text>
          <Text fontSize={11} color="#b8a890">
            Pills (radius = h/2) probing whether borders respect rounding.
          </Text>
        </Col>

        <GalleryRow title="SOLID — basic widths">
          <Pill label="1px"  borderWidth={1} />
          <Pill label="2px"  borderWidth={2} />
          <Pill label="4px"  borderWidth={4} />
          <Pill label="8px"  borderWidth={8} />
        </GalleryRow>

        <GalleryRow title="DASHED — static (border_dash on rounded edge)">
          <Pill label="6/4"   borderWidth={2} borderDashOn={6}  borderDashOff={4} />
          <Pill label="12/6"  borderWidth={2} borderDashOn={12} borderDashOff={6} />
          <Pill label="3/3"   borderWidth={2} borderDashOn={3}  borderDashOff={3} />
          <Pill label="20/10 thick" borderWidth={3} borderDashOn={20} borderDashOff={10} borderDashWidth={4} />
        </GalleryRow>

        <GalleryRow title="MARCHING ANTS — flow_speed > 0 (this is the dash demo on a pill)">
          <Pill label="slow"     borderWidth={2} borderDashOn={8}  borderDashOff={5} borderFlowSpeed={20} />
          <Pill label="medium"   borderWidth={2} borderDashOn={10} borderDashOff={6} borderFlowSpeed={60}  borderColor="#5eead4" />
          <Pill label="fast"     borderWidth={2} borderDashOn={12} borderDashOff={8} borderFlowSpeed={140} borderColor="#ffd166" />
          <Pill label="reverse"  borderWidth={2} borderDashOn={10} borderDashOff={6} borderFlowSpeed={-60} borderColor="#a78bfa" />
        </GalleryRow>

        <GalleryRow title="FLOWING SOLID — flow_speed > 0, no gap (continuous loop)">
          <Pill label="solid 30"  borderWidth={2} borderDashOn={1} borderDashOff={0} borderFlowSpeed={30}  borderColor="#ff5d6c" />
          <Pill label="solid 90"  borderWidth={2} borderDashOn={1} borderDashOff={0} borderFlowSpeed={90}  borderColor="#5eead4" />
        </GalleryRow>

        <GalleryRow title="PER-SIDE WIDTH — single color (only the active side renders)">
          <PillBase style={{ borderTopWidth: 4, borderColor: '#ff5d6c' }}>
            <Text fontSize={12} color="#f2e8dc" bold>top 4</Text>
          </PillBase>
          <PillBase style={{ borderBottomWidth: 4, borderColor: '#5eead4' }}>
            <Text fontSize={12} color="#f2e8dc" bold>bot 4</Text>
          </PillBase>
          <PillBase style={{ borderLeftWidth: 4, borderColor: '#ffd166' }}>
            <Text fontSize={12} color="#f2e8dc" bold>left 4</Text>
          </PillBase>
          <PillBase style={{ borderTopWidth: 6, borderBottomWidth: 2, borderColor: '#a78bfa' }}>
            <Text fontSize={12} color="#f2e8dc" bold>t6 / b2</Text>
          </PillBase>
        </GalleryRow>

        <GalleryRow title="PER-CORNER RADIUS — asymmetric pills">
          <PillBase style={{ borderRadius: 0, borderWidth: 2, borderColor: '#f2e8dc' }}>
            <Text fontSize={12} color="#f2e8dc" bold>square</Text>
          </PillBase>
          <PillBase style={{ borderRadius: 0, borderTopLeftRadius: RADIUS, borderBottomRightRadius: RADIUS, borderWidth: 2, borderColor: '#5eead4' }}>
            <Text fontSize={12} color="#f2e8dc" bold>diag</Text>
          </PillBase>
          <PillBase style={{ borderRadius: 0, borderTopLeftRadius: 4, borderTopRightRadius: 20, borderBottomRightRadius: 4, borderBottomLeftRadius: 20, borderWidth: 2, borderColor: '#ffd166' }}>
            <Text fontSize={12} color="#f2e8dc" bold>4/20</Text>
          </PillBase>
          <PillBase style={{ borderTopLeftRadius: RADIUS, borderBottomLeftRadius: RADIUS, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderWidth: 2, borderColor: '#ff5d6c' }}>
            <Text fontSize={12} color="#f2e8dc" bold>L pill</Text>
          </PillBase>
        </GalleryRow>

        <GalleryRow title="RAINBOW — every corner a different color (4 stacked overlays)">
          <RainbowPill width={2} />
          <RainbowPill width={4} />
          <RainbowPill width={6} />
        </GalleryRow>

        <GalleryRow title="RAINBOW + DASH — flowing per-side rainbow">
          <Box style={{ width: PILL_W, height: PILL_H }}>
            {[
              { side: 'borderTopWidth',    color: C_TR },
              { side: 'borderRightWidth',  color: C_BR },
              { side: 'borderBottomWidth', color: C_BL },
              { side: 'borderLeftWidth',   color: C_TL },
            ].map((s, i) => (
              <Box
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: PILL_W,
                  height: PILL_H,
                  borderRadius: RADIUS,
                  [s.side]: 2,
                  borderColor: s.color,
                  borderDashOn: 8,
                  borderDashOff: 5,
                  borderFlowSpeed: 40,
                } as any}
              />
            ))}
            <Box style={{ position: 'absolute', top: 0, left: 0, width: PILL_W, height: PILL_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text fontSize={12} color="#f2e8dc" bold>rainbow flow</Text>
            </Box>
          </Box>
        </GalleryRow>
      </Col>
    </Box>
  );
}
