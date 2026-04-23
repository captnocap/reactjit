
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';

function parseDropPayload(payload: any): string[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.flatMap(parseDropPayload);
  if (typeof payload === 'string') return payload.split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);
  if (typeof payload.path === 'string') return [payload.path];
  if (typeof payload.paths === 'string') return payload.paths.split(/\r?\n|;/).map((s: string) => s.trim()).filter(Boolean);
  if (Array.isArray(payload.paths)) return payload.paths.filter((item: any) => typeof item === 'string');
  if (typeof payload.data === 'string') return parseDropPayload(payload.data);
  return [];
}

export function ImportDropZone(props: { onPick: () => void; onDropPaths: (paths: string[]) => void; hint?: string }) {
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = useCallback((payload: any) => {
    setDragOver(false);
    const paths = parseDropPayload(payload);
    if (paths.length) props.onDropPaths(paths);
  }, [props]);

  return (
    <Box
      onDragEnter={() => setDragOver(true)}
      onDragOver={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        padding: 14,
        gap: 8,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: dragOver ? COLORS.blue : COLORS.border,
        backgroundColor: dragOver ? COLORS.blueDeep : COLORS.panelBg,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Icon name="upload" size={14} color={COLORS.blue} />
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Drop image/video files here</Text>
        </Row>
        <Pressable onPress={props.onPick} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Pick files</Text>
        </Pressable>
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>{props.hint || 'The dialog validates file type and size before confirming the batch.'}</Text>
    </Box>
  );
}
