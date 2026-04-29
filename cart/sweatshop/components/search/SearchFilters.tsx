import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

export interface SearchFiltersProps {
  include: string[];
  exclude: string[];
  onIncludeChange: (v: string[]) => void;
  onExcludeChange: (v: string[]) => void;
  fileTypes: string[];
  activeFileTypes: Record<string, boolean>;
  onToggleFileType: (t: string) => void;
  maxResults: number;
  onMaxResultsChange: (v: number) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export const DEFAULT_FILE_TYPES = ['tsx', 'ts', 'js', 'jsx', 'zig', 'lua', 'md', 'json'];
const MAX_RESULTS_STEPS = [100, 500, 1000, 5000, 10000, 50000];

export function SearchFilters(props: SearchFiltersProps) {
  const tone = COLORS.yellow || '#f2e05a';
  const expanded = props.expanded ?? true;

  return (
    <Col style={{
      gap: expanded ? 8 : 0, padding: 8,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
    }}>
      <Pressable onPress={props.onToggleExpanded}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
          <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>FILTERS</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
            {activeSummary(props)}
          </Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{expanded ? '▾' : '▸'}</Text>
        </Row>
      </Pressable>

      {!expanded ? null : (
        <>
          <GlobField label="include" placeholder="**/*.{ts,tsx}" value={props.include.join(', ')} onChange={(s) => props.onIncludeChange(splitList(s))} tone={COLORS.green || '#7ee787'} />
          <GlobField label="exclude" placeholder="node_modules/**, dist/**" value={props.exclude.join(', ')} onChange={(s) => props.onExcludeChange(splitList(s))} tone={COLORS.red || '#ff6b6b'} />

          <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ color: COLORS.textDim, fontSize: 9, width: 48, textAlign: 'right' }}>types</Text>
            {props.fileTypes.map((t) => {
              const active = !!props.activeFileTypes[t];
              return (
                <Pressable key={t} onPress={() => props.onToggleFileType(t)} style={{
                  paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
                  backgroundColor: active ? (COLORS.blue || '#79c0ff') : (COLORS.panelAlt || '#05090f'),
                  borderWidth: 1, borderColor: active ? (COLORS.blue || '#79c0ff') : (COLORS.border || '#1f2630'),
                }}>
                  <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>.{t}</Text>
                </Pressable>
              );
            })}
          </Row>

          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ color: COLORS.textDim, fontSize: 9, width: 48, textAlign: 'right' }}>max</Text>
            {MAX_RESULTS_STEPS.map((n) => {
              const active = props.maxResults === n;
              return (
                <Pressable key={n} onPress={() => props.onMaxResultsChange(n)} style={{
                  paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4,
                  backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
                  borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
                }}>
                  <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>
                    {n >= 1000 ? (n / 1000) + 'k' : n}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </>
      )}
    </Col>
  );
}

function GlobField({ label, placeholder, value, onChange, tone }: { label: string; placeholder: string; value: string; onChange: (s: string) => void; tone: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 6 }}>
      <Text style={{ color: tone, fontSize: 9, fontWeight: 700, width: 48, textAlign: 'right' }}>{label}</Text>
      <Box style={{
        flexGrow: 1, flexBasis: 0,
        backgroundColor: COLORS.panelAlt || '#05090f',
        borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        paddingHorizontal: 8, paddingVertical: 3,
      }}>
        <TextInput
          value={value}
          placeholder={placeholder}
          onChangeText={onChange}
          style={{ fontSize: 11, color: COLORS.textBright }}
        />
      </Box>
    </Row>
  );
}

function splitList(s: string): string[] {
  return s.split(/[,\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
}

function activeSummary(p: SearchFiltersProps): string {
  const parts: string[] = [];
  const activeTypes = p.fileTypes.filter((t) => p.activeFileTypes[t]).length;
  if (activeTypes > 0) parts.push(activeTypes + ' types');
  if (p.include.length > 0) parts.push('+' + p.include.length + ' inc');
  if (p.exclude.length > 0) parts.push('−' + p.exclude.length + ' exc');
  parts.push('max ' + (p.maxResults >= 1000 ? (p.maxResults / 1000) + 'k' : String(p.maxResults)));
  return parts.join(' · ');
}
