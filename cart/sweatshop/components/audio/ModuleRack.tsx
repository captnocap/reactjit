
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { ModuleCard } from './ModuleCard';
import type { AudioRackApi } from '../../lib/audio/hooks/useAudioRack';
import type { ModuleKind } from '../../lib/audio/types';

export interface ModuleRackProps {
  rackApi: AudioRackApi;
  selectedModuleId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
}

const ADD_KINDS: { kind: ModuleKind; label: string }[] = [
  { kind: 'vco',         label: 'VCO' },
  { kind: 'vcf',         label: 'VCF' },
  { kind: 'vca',         label: 'VCA' },
  { kind: 'lfo',         label: 'LFO' },
  { kind: 'envelope',    label: 'Env' },
  { kind: 'reverb',      label: 'Rev' },
  { kind: 'delay',       label: 'Dly' },
  { kind: 'compressor',  label: 'Comp' },
  { kind: 'distortion',  label: 'Dist' },
  { kind: 'filter',      label: 'Filt' },
  { kind: 'sequencer',   label: 'Seq' },
];

export function ModuleRack({ rackApi, selectedModuleId, onSelect, height }: ModuleRackProps) {
  const [showAdd, setShowAdd] = useState(false);
  const tone = COLORS.blue || '#79c0ff';

  const move = useCallback((id: string, delta: number) => {
    const idx = rackApi.rack.modules.findIndex((m) => m.id === id);
    if (idx < 0) return;
    rackApi.reorder(id, idx + delta);
  }, [rackApi]);

  return (
    <Col style={{
      height: height ?? 340,
      backgroundColor: COLORS.appBg || '#02050a',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <Row style={{
        alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
        <Text style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>MODULE RACK</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{rackApi.rack.modules.length} modules</Text>
        <Pressable onPress={() => setShowAdd(!showAdd)} style={primary(tone, showAdd)}>
          <Text style={{ color: showAdd ? (COLORS.appBg || '#05090f') : tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            {showAdd ? '× CLOSE' : '+ ADD'}
          </Text>
        </Pressable>
      </Row>

      {showAdd ? (
        <Row style={{ gap: 4, padding: 6, flexWrap: 'wrap', backgroundColor: COLORS.panelBg || '#0b1018', borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
          {ADD_KINDS.map((k) => (
            <Pressable key={k.kind} onPress={() => { rackApi.addModule(k.kind); setShowAdd(false); }}
              style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
                backgroundColor: COLORS.panelAlt || '#05090f',
                borderWidth: 1, borderColor: tone,
              }}>
              <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>+ {k.label}</Text>
            </Pressable>
          ))}
        </Row>
      ) : null}

      <ScrollView horizontal style={{ flexGrow: 1 }}>
        <Row style={{ gap: 8, padding: 8, alignItems: 'stretch' }}>
          {rackApi.rack.modules.length === 0 ? (
            <Col style={{
              width: 260, height: '100%', alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: COLORS.border || '#1f2630', borderRadius: 8,
              gap: 6, padding: 16,
            }}>
              <Text style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1 }}>empty rack</Text>
              <Text style={{ color: COLORS.textDim, fontSize: 9, textAlign: 'center' }}>
                add modules from + ADD above, then patch their ports in the Patchbay below
              </Text>
            </Col>
          ) : null}
          {rackApi.rack.modules.map((m) => (
            <ModuleCard
              key={m.id}
              rackApi={rackApi}
              moduleId={m.id}
              selected={selectedModuleId === m.id}
              onSelect={onSelect}
              onMoveLeft={(id) => move(id, -1)}
              onMoveRight={(id) => move(id, 1)}
            />
          ))}
        </Row>
      </ScrollView>
    </Col>
  );
}

function primary(tone: string, active: boolean): any {
  return {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
    borderWidth: 1, borderColor: tone,
  };
}
