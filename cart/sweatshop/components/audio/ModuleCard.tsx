
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Knob } from './Knob';
import { Fader } from './Fader';
import type { AudioRackApi } from '../../lib/audio/hooks/useAudioRack';
import { useAudioNode } from '../../lib/audio/hooks/useAudioNode';
import type { Module } from '../../lib/audio/types';

export interface ModuleCardProps {
  rackApi: AudioRackApi;
  moduleId: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onMoveLeft?: (id: string) => void;
  onMoveRight?: (id: string) => void;
}

const MODULE_ACCENT: Record<string, string> = {
  vco: '#79c0ff', vcf: '#7ee787', vca: '#d2a8ff', lfo: '#f2e05a', envelope: '#ffb86b',
  reverb: '#ff6bcb', delay: '#2d62ff', compressor: '#5c6a78', distortion: '#ff7b72',
  filter: '#8abaff', sequencer: '#ffa657',
};

export function ModuleCard({ rackApi, moduleId, selected, onSelect, onMoveLeft, onMoveRight }: ModuleCardProps) {
  const node = useAudioNode(rackApi, moduleId);
  const m: Module | null = node.module;
  if (!m) return null;
  const accent = MODULE_ACCENT[m.kind] || (COLORS.blue || '#79c0ff');

  // Split params into continuous (knobs/faders) and discrete/choice/toggle.
  const continuousParams = m.params.filter((p) => p.kind === 'continuous');
  const discreteParams = m.params.filter((p) => p.kind !== 'continuous');

  return (
    <Col style={{
      width: 180, flexShrink: 0,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? accent : (COLORS.border || '#1f2630'),
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <Pressable onPress={() => onSelect && onSelect(moduleId)}>
        <Row style={{
          paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', gap: 6,
          backgroundColor: COLORS.panelRaised || '#05090f',
          borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
        }}>
          <Box style={{ width: 4, height: 16, backgroundColor: accent, borderRadius: 2 }} />
          <Text style={{ color: COLORS.textBright, fontSize: 12, fontWeight: 700 }}>{m.label}</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{m.kind.toUpperCase()}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={() => onMoveLeft && onMoveLeft(moduleId)} style={iconBtn()}><Text style={iconTxt()}>◀</Text></Pressable>
          <Pressable onPress={() => onMoveRight && onMoveRight(moduleId)} style={iconBtn()}><Text style={iconTxt()}>▶</Text></Pressable>
          <Pressable onPress={() => node.toggleBypass()} style={{ ...iconBtn(), borderColor: node.bypass ? (COLORS.red || '#ff6b6b') : (COLORS.border || '#1f2630') }}>
            <Text style={{ ...iconTxt(), color: node.bypass ? (COLORS.red || '#ff6b6b') : COLORS.textDim }}>◯</Text>
          </Pressable>
          <Pressable onPress={() => node.remove()} style={iconBtn()}><Text style={{ ...iconTxt(), color: COLORS.red || '#ff6b6b' }}>×</Text></Pressable>
        </Row>
      </Pressable>

      <Col style={{ padding: 8, gap: 8, opacity: node.bypass ? 0.5 : 1 }}>
        <Row style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'space-around' }}>
          {continuousParams.map((p) => {
            const v = node.get(p.id, p.defaultValue) as number;
            const big = p.id === 'freq' || p.id === 'cutoff' || p.id === 'gain' || p.id === 'level';
            if (big) {
              return <Knob key={p.id} label={p.label} value={v} min={p.min} max={p.max} unit={p.unit} taper={p.taper}
                accent={accent} onChange={(nv) => node.set(p.id, nv)} />;
            }
            return <Knob key={p.id} label={p.label} value={v} min={p.min} max={p.max} unit={p.unit} taper={p.taper}
              accent={accent} size={44} onChange={(nv) => node.set(p.id, nv)} />;
          })}
        </Row>

        {discreteParams.length > 0 ? (
          <Col style={{ gap: 4 }}>
            {discreteParams.map((p) => {
              if (p.kind === 'toggle') {
                const on = !!node.get(p.id, p.defaultValue);
                return (
                  <Row key={p.id} style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, flexGrow: 1 }}>{p.label.toUpperCase()}</Text>
                    <Pressable onPress={() => node.set(p.id, !on)} style={chipStyle(on, accent)}>
                      <Text style={{ color: on ? (COLORS.appBg || '#05090f') : accent, fontSize: 9, fontWeight: 700 }}>{on ? 'ON' : 'OFF'}</Text>
                    </Pressable>
                  </Row>
                );
              }
              if (p.kind === 'choice' && p.choices) {
                const cur = node.get(p.id, p.defaultValue);
                return (
                  <Row key={p.id} style={{ alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, width: 40 }}>{p.label.toUpperCase()}</Text>
                    {p.choices.map((c) => {
                      const active = cur === c.value;
                      return (
                        <Pressable key={c.value} onPress={() => node.set(p.id, c.value)} style={chipStyle(active, accent)}>
                          <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>{c.label}</Text>
                        </Pressable>
                      );
                    })}
                  </Row>
                );
              }
              // discrete (min..max step)
              const v = node.get(p.id, p.defaultValue) as number;
              const step = p.step || 1;
              return (
                <Row key={p.id} style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, flexGrow: 1 }}>{p.label.toUpperCase()}</Text>
                  <Pressable onPress={() => node.set(p.id, Math.max(p.min ?? 0, v - step))} style={chipStyle(false, accent)}>
                    <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700 }}>−</Text>
                  </Pressable>
                  <Text style={{ color: accent, fontSize: 10, fontWeight: 700, width: 28, textAlign: 'center' }}>{v}</Text>
                  <Pressable onPress={() => node.set(p.id, Math.min(p.max ?? 100, v + step))} style={chipStyle(false, accent)}>
                    <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700 }}>+</Text>
                  </Pressable>
                </Row>
              );
            })}
          </Col>
        ) : null}

        <Row style={{ gap: 4, flexWrap: 'wrap' }}>
          {m.ports.map((port) => (
            <Box key={port.id} style={{
              paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3,
              backgroundColor: port.direction === 'out' ? accent : (COLORS.panelAlt || '#05090f'),
              borderWidth: 1, borderColor: accent,
            }}>
              <Text style={{ color: port.direction === 'out' ? (COLORS.appBg || '#05090f') : accent, fontSize: 8, fontWeight: 700 }}>
                {port.direction === 'in' ? '◀ ' : '▶ '}{port.label}
              </Text>
            </Box>
          ))}
        </Row>
      </Col>
    </Col>
  );
}

function iconBtn(): any {
  return {
    width: 18, height: 18, borderRadius: 3,
    backgroundColor: COLORS.panelAlt || '#05090f',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
    alignItems: 'center', justifyContent: 'center',
  };
}
function iconTxt(): any {
  return { color: COLORS.textDim, fontSize: 9, fontWeight: 700 };
}
function chipStyle(active: boolean, tone: string): any {
  return {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
    backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
    borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
  };
}
