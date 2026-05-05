
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MediaControls } from './MediaControls';
import { MediaLibrary } from './MediaLibrary';
import { ImageSurface } from './ImageSurface';
import { VideoSurface } from './VideoSurface';
import { createMediaItem, useMediaStore } from './useMediaStore';
import { MediaImportDialog } from '../media-import/MediaImportDialog';

export function MediaPanel() {
  const store = useMediaStore();
  const [showImport, setShowImport] = useState(false);
  const fallback = useMemo(() => createMediaItem('image', '', 'Media Preview'), []);
  const active = store.selected || fallback;
  const updateActive = (patch: any) => {
    if (!store.selected) return;
    store.updateMedia(store.selected.id, patch);
  };

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <MediaControls
        title="Media Panel"
        bgToken={active.bgToken}
        radiusKey={active.radiusKey}
        shadow={active.shadow}
        onOpenImport={() => setShowImport(true)}
        onBgTokenChange={(bgToken) => updateActive({ bgToken })}
        onRadiusKeyChange={(radiusKey) => updateActive({ radiusKey })}
        onShadowChange={(shadow) => updateActive({ shadow })}
      />
      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <MediaLibrary
          items={store.items}
          selectedId={store.selectedId}
          onSelect={store.setSelectedId}
          onRemove={store.removeMedia}
          onAdd={store.addMedia}
        />
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
          {store.selected ? (
            store.selected.kind === 'image'
              ? <ImageSurface item={store.selected} onUpdate={store.updateMedia.bind(null, store.selected.id)} />
              : <VideoSurface item={store.selected} onUpdate={store.updateMedia.bind(null, store.selected.id)} />
          ) : (
            <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Drop or add media to begin</Text>
              <Text fontSize={10} color={COLORS.textDim}>The controls above follow the selected item.</Text>
            </Box>
          )}
        </Col>
      </Row>
      <MediaImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onConfirm={(items) => items.forEach((item) => store.addMedia(item.kind === 'video' ? 'video' : 'image', item.path, item.name))}
      />
    </Col>
  );
}

export default MediaPanel;
