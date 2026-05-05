
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import type { MediaItem, MediaKind } from './useMediaStore';

function MediaRow(props: {
  item: MediaItem;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const kindTone = props.item.kind === 'image' ? COLORS.blue : COLORS.green;
  return (
    <Pressable
      onPress={props.onSelect}
      style={{
        padding: 10,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelBg,
        gap: 8,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 26, height: 26, borderRadius: TOKENS.radiusMd, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.grayChip, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={9} color={kindTone} style={{ fontWeight: 'bold' }}>{props.item.kind === 'image' ? 'IMG' : 'VID'}</Text>
        </Box>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 2 }}>
          <Text fontSize={11} color={props.active ? COLORS.textBright : COLORS.text} style={{ fontWeight: 'bold' }}>
            {props.item.title}
          </Text>
          <Text fontSize={9} color={COLORS.textDim} numberOfLines={1}>
            {props.item.source}
          </Text>
        </Col>
        <Pressable
          onPress={props.onRemove}
          style={{
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: TOKENS.radiusMd,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text fontSize={10} color={COLORS.textDim}>x</Text>
        </Pressable>
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Text fontSize={9} color={kindTone}>{props.item.kind}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.item.shadow ? 'shadow' : 'flat'}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.item.radiusKey}</Text>
      </Row>
    </Pressable>
  );
}

function AddKindButton(props: { kind: MediaKind; onPress: () => void }) {
  const tone = props.kind === 'image' ? COLORS.blue : COLORS.green;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: tone,
        backgroundColor: props.kind === 'image' ? COLORS.blueDeep : COLORS.greenDeep,
      }}
    >
      <Text fontSize={10} color={tone} style={{ fontWeight: 'bold' }}>{'Add ' + props.kind}</Text>
    </Pressable>
  );
}

export function MediaLibrary(props: {
  items: MediaItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (kind: MediaKind, source: string, title?: string) => void;
}) {
  const [draftSource, setDraftSource] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [dropHint, setDropHint] = useState('Drop image or video files here, or paste a path below.');
  const countLabel = useMemo(() => String(props.items.length) + ' loaded', [props.items.length]);

  function handleAdd(kind: MediaKind) {
    const source = draftSource.trim();
    if (!source) {
      setDropHint('Add a source path first.');
      return;
    }
    props.onAdd(kind, source, draftTitle.trim() || undefined);
    setDraftSource('');
    setDraftTitle('');
    setDropHint('Loaded ' + kind + '.');
  }

  return (
    <Col style={{ width: 300, flexShrink: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Col style={{ padding: 10, gap: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Media Library</Text>
          <Text fontSize={10} color={COLORS.textDim}>{countLabel}</Text>
        </Row>

        <Box
          onDrop={() => setDropHint('Native file drop can populate this panel when the host bridge is wired.')}
          onDragEnter={() => setDropHint('Drop to import.')}
          onDragLeave={() => setDropHint('Drop image or video files here, or paste a path below.')}
          style={{
            padding: 12,
            gap: 8,
            borderRadius: TOKENS.radiusLg,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelBg,
            borderStyle: 'dashed',
          }}
        >
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <Icon name="upload" size={14} color={COLORS.blue} />
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Drop target</Text>
          </Row>
          <Text fontSize={10} color={COLORS.textDim}>{dropHint}</Text>
        </Box>

        <Box style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim}>Source path or URL</Text>
          <TextInput
            value={draftSource}
            onChangeText={setDraftSource}
            placeholder="/path/to/media.mp4"
            fontSize={10}
            color={COLORS.textBright}
            style={{ padding: 8, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}
          />
        </Box>

        <Box style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim}>Title</Text>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Preview label"
            fontSize={10}
            color={COLORS.textBright}
            style={{ padding: 8, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}
          />
        </Box>

        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <AddKindButton kind="image" onPress={() => handleAdd('image')} />
          <AddKindButton kind="video" onPress={() => handleAdd('video')} />
        </Row>
      </Col>

      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 10 }}>
        <Col style={{ gap: 8 }}>
          {props.items.length === 0 ? (
            <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 6 }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>No media loaded</Text>
              <Text fontSize={10} color={COLORS.textDim}>Add an image or video source to populate the demo.</Text>
            </Box>
          ) : null}
          {props.items.map((item) => (
            <MediaRow
              key={item.id}
              item={item}
              active={item.id === props.selectedId}
              onSelect={() => props.onSelect(item.id)}
              onRemove={() => props.onRemove(item.id)}
            />
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
