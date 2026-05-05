
import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import type { SnapshotMeta } from './SnapshotEngine';

export interface SnapshotRowProps {
  meta: SnapshotMeta;
  selected?: boolean;
  diffPick?: 'a' | 'b' | null;  // currently selected as left/right in diff mode
  onSelect?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onPickDiff?: (id: string, slot: 'a' | 'b') => void;
  thumb?: string;  // optional base64 data-uri; rendered if present
}

function fmtBytes(b: number): string {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function fmtAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export function SnapshotRow(props: SnapshotRowProps) {
  const { meta, selected, diffPick, onSelect, onRestore, onDelete, onRename, onPickDiff, thumb } = props;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(meta.name);
  const tone = meta.auto ? (COLORS.blue || '#79c0ff') : (COLORS.purple || '#d2a8ff');

  return (
    <Col style={{
      backgroundColor: selected ? (COLORS.panelHover || '#173048') : (COLORS.panelBg || '#0b1018'),
      borderWidth: 1,
      borderColor: selected ? tone : (COLORS.border || '#1f2630'),
      borderRadius: 6,
      padding: 8,
      gap: 6,
    }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        {thumb ? (
          <Box style={{ width: 48, height: 36, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630', overflow: 'hidden' }}>
            <Box style={{ width: 48, height: 36, backgroundColor: COLORS.panelAlt || '#05090f' }} />
          </Box>
        ) : (
          <Box style={{
            width: 48, height: 36, borderRadius: 4,
            backgroundColor: COLORS.panelAlt || '#05090f',
            borderWidth: 1, borderColor: tone,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: tone, fontSize: 16, fontWeight: 700 }}>{meta.auto ? '⟳' : '◆'}</Text>
          </Box>
        )}
        <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
          {renaming ? (
            <Box style={{
              backgroundColor: COLORS.panelAlt || '#05090f',
              borderWidth: 1, borderColor: tone, borderRadius: 4,
              paddingHorizontal: 6, paddingVertical: 2,
            }}>
              <TextInput
                value={draft}
                onChangeText={(t: string) => setDraft(t)}
                onSubmit={() => { onRename && onRename(meta.id, draft); setRenaming(false); }}
                style={{ fontSize: 12, color: COLORS.textBright }}
              />
            </Box>
          ) : (
            <Pressable onPress={() => onSelect && onSelect(meta.id)}>
              <Text style={{ color: COLORS.textBright, fontSize: 12, fontWeight: 700 }}>{meta.name}</Text>
            </Pressable>
          )}
          <Row style={{ gap: 6 }}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
              {meta.auto ? 'AUTO' : 'MANUAL'}
            </Text>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>·</Text>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{fmtAgo(meta.t)}</Text>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>·</Text>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{meta.sliceCount} slices</Text>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>·</Text>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{fmtBytes(meta.bytes)}</Text>
          </Row>
        </Col>
      </Row>

      <Row style={{ gap: 4 }}>
        <ActionBtn label="RESTORE" tone={COLORS.green || '#7ee787'} onPress={() => onRestore && onRestore(meta.id)} />
        {renaming ? (
          <ActionBtn label="SAVE NAME" tone={tone} onPress={() => { onRename && onRename(meta.id, draft); setRenaming(false); }} />
        ) : (
          <ActionBtn label="RENAME" tone={COLORS.textDim} onPress={() => { setDraft(meta.name); setRenaming(true); }} />
        )}
        <ActionBtn label={diffPick === 'a' ? 'LEFT ✓' : 'DIFF A'} tone={COLORS.yellow || '#f2e05a'} active={diffPick === 'a'} onPress={() => onPickDiff && onPickDiff(meta.id, 'a')} />
        <ActionBtn label={diffPick === 'b' ? 'RIGHT ✓' : 'DIFF B'} tone={COLORS.yellow || '#f2e05a'} active={diffPick === 'b'} onPress={() => onPickDiff && onPickDiff(meta.id, 'b')} />
        <Box style={{ flexGrow: 1 }} />
        <ActionBtn label="DELETE" tone={COLORS.red || '#ff6b6b'} onPress={() => onDelete && onDelete(meta.id)} />
      </Row>
    </Col>
  );
}

function ActionBtn({ label, tone, active, onPress }: { label: string; tone: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
      backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
      borderWidth: 1, borderColor: tone,
    }}>
      <Text style={{ color: active ? (COLORS.appBg || '#05090f') : tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
    </Pressable>
  );
}
