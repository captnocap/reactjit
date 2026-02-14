/**
 * Void Station HUD — React overlay components.
 *
 * Built entirely with react-love shared primitives (Box, Text).
 * These same components would render as Love2D draw calls in native mode.
 */

import { useState } from 'react';
import { Box, Text } from '../../../packages/shared/src/primitives';
import { useLoveState, useLoveSend } from '../../../packages/shared/src/hooks';
import { usePixelArt } from '../../../packages/shared/src/usePixelArt';
import type { Style } from '../../../packages/shared/src/types';
import type { ReactNode } from 'react';

// === Design Tokens ===

const PANEL_BG = 'rgba(6, 14, 30, 0.88)';
const PANEL_BORDER = 'rgba(0, 170, 255, 0.1)';
const TEXT_DIM = 'rgba(140, 170, 200, 0.4)';
const TEXT_MID = 'rgba(185, 205, 225, 0.7)';
const TEXT_BRIGHT = '#d0dce8';
const ACCENT = '#00bbee';

// === Utility Components ===

function gaugeColor(pct: number): string {
  if (pct > 0.6) return '#00dd77';
  if (pct > 0.3) return '#ffaa00';
  return '#ff3344';
}

function Panel({ children, style }: { children: ReactNode; style?: Style }) {
  return (
    <Box style={{
      backgroundColor: PANEL_BG,
      borderWidth: 1,
      borderColor: PANEL_BORDER,
      borderRadius: 4,
      padding: 12,
      ...style,
    }}>
      {children}
    </Box>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={{ color: TEXT_DIM, fontSize: 9, fontWeight: '600', marginBottom: 8 }}>
      {'// ' + children}
    </Text>
  );
}

function Gauge({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(1, Math.max(0, value / max));
  const color = gaugeColor(pct);

  return (
    <Box style={{ marginBottom: 10 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3, width: '100%' }}>
        <Text style={{ color: TEXT_MID, fontSize: 10, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: TEXT_BRIGHT, fontSize: 10, fontWeight: '500' }}>
          {Math.round(value)}
        </Text>
      </Box>
      <Box style={{
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <Box style={{
          height: 3,
          width: `${pct * 100}%`,
          backgroundColor: color,
          borderRadius: 2,
        }} />
      </Box>
    </Box>
  );
}

// === Top Bar ===

function TopBar() {
  const [stardate] = useLoveState<number>('stardate', 2847.3);
  const [alertLevel] = useLoveState<string>('alertLevel', 'green');

  const alertColor =
    alertLevel === 'red' ? '#ff3344' :
    alertLevel === 'yellow' ? '#ffaa00' :
    '#00dd77';

  return (
    <Panel style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      paddingLeft: 14,
      paddingRight: 14,
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700' }}>
          VOID STATION
        </Text>
        <Text style={{ color: 'rgba(0, 187, 238, 0.25)', fontSize: 10 }}>|</Text>
        <Text style={{ color: TEXT_DIM, fontSize: 10 }}>SECTOR 7G</Text>
      </Box>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Box style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: alertColor,
          }} />
          <Text style={{ color: alertColor, fontSize: 9, fontWeight: '700' }}>
            {(alertLevel as string).toUpperCase()}
          </Text>
        </Box>
        <Text style={{ color: TEXT_DIM, fontSize: 10 }}>
          {stardate.toFixed(3)}
        </Text>
      </Box>
    </Panel>
  );
}

// === Status Panel (Left) ===

function StatusPanel() {
  const [hull] = useLoveState<number>('hull', 87);
  const [shields] = useLoveState<number>('shields', 65);
  const [power] = useLoveState<number>('power', 78);
  const [oxygen] = useLoveState<number>('oxygen', 92);

  return (
    <Panel>
      <Label>SYSTEMS</Label>
      <Gauge label="HULL" value={hull} />
      <Gauge label="SHLD" value={shields} />
      <Gauge label="PWR" value={power} />
      <Gauge label="O2" value={oxygen} />
    </Panel>
  );
}

// === Alert Feed (Left bottom) ===

function AlertFeed() {
  const [alerts] = useLoveState<any[]>('alerts', []);
  const recent = alerts.slice(-6).reverse();

  const levelColor = (level: string) =>
    level === 'danger' ? '#ff3344' :
    level === 'warning' ? '#ffaa00' :
    'rgba(0, 187, 238, 0.6)';

  const levelIcon = (level: string) =>
    level === 'danger' ? '\u2715' :
    level === 'warning' ? '\u26A0' :
    '\u203A';

  return (
    <Panel style={{ flex: 1, overflow: 'hidden' }}>
      <Label>ALERTS</Label>
      {recent.length === 0 && (
        <Text style={{ color: TEXT_DIM, fontSize: 9 }}>No alerts</Text>
      )}
      {recent.map((a: any) => (
        <Box key={a.id} style={{ flexDirection: 'row', gap: 6, marginBottom: 5, alignItems: 'flex-start' }}>
          <Text style={{ color: levelColor(a.level), fontSize: 9 }}>
            {levelIcon(a.level)}
          </Text>
          <Text style={{ color: TEXT_MID, fontSize: 9, flexGrow: 1 }}>
            {a.text}
          </Text>
        </Box>
      ))}
    </Panel>
  );
}

// === Sensor Panel (Right) ===

function SensorPanel() {
  const [objects] = useLoveState<any[]>('objects', []);
  const [speed] = useLoveState<number>('speed', 0);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'asteroid': return '\u2B21';
      case 'ship':     return '\u25B9';
      case 'station':  return '\u25C8';
      case 'debris':   return '\u25C7';
      case 'signal':   return '\u25CE';
      default:         return '\u00B7';
    }
  };

  const typeColor = (type: string, threat: boolean) => {
    if (threat) return '#ff3344';
    switch (type) {
      case 'asteroid': return '#dd8833';
      case 'ship':     return '#44ee88';
      case 'station':  return '#4488ff';
      case 'debris':   return '#556677';
      case 'signal':   return '#eeee44';
      default:         return '#ffffff';
    }
  };

  return (
    <Panel>
      <Label>CONTACTS</Label>
      {objects.slice(0, 8).map((obj: any) => (
        <Box key={obj.id} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 5,
        }}>
          <Text style={{ color: typeColor(obj.type, obj.threat), fontSize: 11 }}>
            {typeIcon(obj.type)}
          </Text>
          <Text style={{ color: TEXT_MID, fontSize: 9, flexGrow: 1 }}>
            {obj.name}
          </Text>
          <Text style={{ color: TEXT_DIM, fontSize: 9 }}>
            {`${obj.distance.toFixed(0)}km`}
          </Text>
        </Box>
      ))}
      {objects.length === 0 && (
        <Text style={{ color: TEXT_DIM, fontSize: 9 }}>No contacts in range</Text>
      )}

      <Box style={{ marginTop: 12, borderColor: PANEL_BORDER, borderWidth: 1, borderRadius: 3, padding: 8 }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <Text style={{ color: TEXT_DIM, fontSize: 8 }}>DRIFT</Text>
          <Text style={{ color: TEXT_BRIGHT, fontSize: 9 }}>{`${speed.toFixed(2)}c`}</Text>
        </Box>
      </Box>
    </Panel>
  );
}

// === Power Allocation ===

function PowerControl({ label, stateKey, color }: {
  label: string;
  stateKey: string;
  color: string;
}) {
  const [value] = useLoveState<number>(stateKey, 1);
  const send = useLoveSend();
  const system = stateKey.replace('Alloc', '');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: TEXT_DIM, fontSize: 8, fontWeight: '700' }}>{label}</Text>

      {/* Segments */}
      <Box style={{ flexDirection: 'row', gap: 2 }}>
        {[0, 1, 2, 3].map(i => (
          <Box
            key={i}
            style={{
              width: 14,
              height: 10,
              backgroundColor: i < value ? color : 'rgba(255, 255, 255, 0.04)',
              borderRadius: 1,
              borderWidth: 1,
              borderColor: i < value ? color : 'rgba(255, 255, 255, 0.06)',
              opacity: i < value ? 1 : 0.5,
            }}
          />
        ))}
      </Box>

      {/* +/- buttons */}
      <Box style={{ flexDirection: 'row', gap: 3 }}>
        <Box
          onClick={() => send('power:set', { system, delta: -1 })}
          onPointerEnter={() => setHoveredBtn('minus')}
          onPointerLeave={() => setHoveredBtn(null)}
          style={{
            width: 18,
            height: 18,
            backgroundColor: hoveredBtn === 'minus' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
            borderRadius: 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {usePixelArt('minus', { size: 2, color: TEXT_MID })}
        </Box>
        <Box
          onClick={() => send('power:set', { system, delta: 1 })}
          onPointerEnter={() => setHoveredBtn('plus')}
          onPointerLeave={() => setHoveredBtn(null)}
          style={{
            width: 18,
            height: 18,
            backgroundColor: hoveredBtn === 'plus' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
            borderRadius: 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: TEXT_MID, fontSize: 11 }}>+</Text>
        </Box>
      </Box>
    </Box>
  );
}

// === Action Button ===

function ActionButton({ label, action, color }: {
  label: string;
  action: string;
  color: string;
}) {
  const send = useLoveSend();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    send(action);
    setPressed(true);
    setTimeout(() => setPressed(false), 300);
  };

  return (
    <Box
      onClick={handleClick}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        backgroundColor: pressed ? color : hovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: pressed ? color : `${color}66`,
        borderRadius: 3,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 14,
        paddingRight: 14,
        opacity: pressed ? 0.8 : 1,
      }}
    >
      <Text style={{
        color: pressed ? '#000000' : color,
        fontSize: 9,
        fontWeight: '700',
      }}>
        {label}
      </Text>
    </Box>
  );
}

// === Bottom Bar ===

function BottomBar() {
  return (
    <Panel style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      paddingLeft: 14,
      paddingRight: 14,
    }}>
      <Box style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
        <Text style={{ color: TEXT_DIM, fontSize: 8, fontWeight: '700' }}>POWER</Text>
        <PowerControl label="SHLD" stateKey="shieldAlloc" color="#00bbee" />
        <PowerControl label="ENG" stateKey="engineAlloc" color="#44ee88" />
        <PowerControl label="L/S" stateKey="lifeSupAlloc" color="#ffaa00" />
        <PowerControl label="WPN" stateKey="weaponAlloc" color="#ff4466" />
      </Box>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <ActionButton label="REPAIR" action="action:repair" color="#00dd77" />
        <ActionButton label="BOOST" action="action:boost" color="#00bbee" />
        <ActionButton label="DISTRESS" action="action:distress" color="#ff3344" />
      </Box>
    </Panel>
  );
}

// === Main HUD Layout ===

export function StationHUD() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      padding: 16,
      display: 'flex',
      flexDirection: 'column' as const,
      pointerEvents: 'none' as const,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
    }}>
      {/* Top Bar */}
      <div style={{ pointerEvents: 'auto' as const }}>
        <TopBar />
      </div>

      {/* Middle: side panels with transparent center */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 12,
        marginTop: 12,
      }}>
        {/* Left Column */}
        <div style={{
          width: 220,
          pointerEvents: 'auto' as const,
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 12,
        }}>
          <StatusPanel />
          <AlertFeed />
        </div>

        {/* Center: transparent, clicks pass to canvas */}
        <div style={{ flex: 1 }} />

        {/* Right Column */}
        <div style={{
          width: 200,
          pointerEvents: 'auto' as const,
        }}>
          <SensorPanel />
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{ pointerEvents: 'auto' as const, marginTop: 12 }}>
        <BottomBar />
      </div>
    </div>
  );
}
