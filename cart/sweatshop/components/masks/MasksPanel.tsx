const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MediaImportDialog } from '../media-import/MediaImportDialog';
import { MediaLibrary } from '../media/MediaLibrary';
import { buildStackPreview, stageSize } from './buildPreview';
import { MaskCatalogCard } from './MaskCatalogCard';
import { MaskChip } from './MaskChip';
import { ParamControl } from './ParamControl';
import { SourceAvailabilityBanner } from './SourceAvailabilityBanner';
import { StackRow } from './StackRow';
import { MASKS } from './maskCatalog';
import { useLiveSource } from './useLiveSource';
import { useMaskStack } from './useMaskStack';

export function MasksPanel() {
  const source = useLiveSource();
  const stack = useMaskStack();
  const [showImport, setShowImport] = useState(false);

  const selected = source.active;
  const hasMedia = source.hasLiveSource;
  const size = stageSize(selected);
  const preview = buildStackPreview(selected, size.width, size.height, Date.now(), stack.stack);

  return (
    <Col style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Masks</Text>
          <Text fontSize={10} color={COLORS.textDim}>Stack post-processing masks on the selected live media source.</Text>
        </Col>
        <Row style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <MaskChip label={hasMedia ? 'source: ' + source.preview.kind : 'source: none'} active={hasMedia} />
          <MaskChip label={String(stack.activeStack.length) + ' active'} active={stack.activeStack.length > 0} />
          <Pressable onPress={() => setShowImport(true)}>
            <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>import media</Text>
            </Box>
          </Pressable>
        </Row>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Box style={{ width: 320, minWidth: 300, borderRightWidth: 1, borderRightColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <MediaLibrary
            items={source.items}
            selectedId={source.selectedId}
            onSelect={source.setSelectedId}
            onRemove={source.removeMedia}
            onAdd={source.addMedia}
          />
        </Box>

        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, padding: 12 }}>
          <Col style={{ gap: 12, minHeight: 0 }}>
            <SourceAvailabilityBanner sources={source.liveSources} />

            {!hasMedia ? (
              <Box style={{ padding: 14, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, gap: 6 }}>
                <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Select or import a live source</Text>
                <Text fontSize={10} color={COLORS.textDim}>Masks apply to the selected media-library item. Other live capture surfaces are not wired yet, and the banner above says so explicitly.</Text>
              </Box>
            ) : null}

            <Box style={{ gap: 10, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{selected ? selected.title : 'No live source selected'}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{selected ? selected.source : 'Pick an item from the media library to feed the mask stack.'}</Text>
                </Col>
                {selected ? <MaskChip label={selected.kind} active={true} /> : null}
              </Row>
              {selected ? (
                <Box style={{ width: size.width, height: size.height, alignSelf: 'center', borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, overflow: 'hidden', boxShadow: TOKENS.shadow3 }}>
                  {preview}
                </Box>
              ) : (
                <Box style={{ padding: 16, minHeight: 220, alignItems: 'center', justifyContent: 'center', borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                  <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>No live preview</Text>
                </Box>
              )}
            </Box>

            <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Stack editor</Text>
                  <Text fontSize={10} color={COLORS.textDim}>Masks are applied in order from top to bottom, then previewed live against the selected source.</Text>
                </Col>
                {stack.selectedItem ? <MaskChip label={stack.selectedDef ? stack.selectedDef.label : stack.selectedItem.maskId} active={true} /> : null}
              </Row>

              {stack.selectedItem && stack.selectedDef ? (
                <Col style={{ gap: 8 }}>
                  <Text fontSize={10} color={COLORS.textDim}>{stack.selectedDef.desc}</Text>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {stack.selectedDef.props.map((prop) => (
                      <ParamControl
                        key={prop.name}
                        name={prop.name}
                        value={stack.selectedItem!.params[prop.name] ?? prop.defaultVal}
                        def={prop}
                        onChange={(next) => stack.updateParams(stack.selectedItem!.id, prop.name, next)}
                      />
                    ))}
                  </Row>
                </Col>
              ) : (
                <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                  <Text fontSize={10} color={COLORS.textDim}>Add a mask from the catalog on the right, then select it here to tune parameters.</Text>
                </Box>
              )}
            </Box>
          </Col>
        </ScrollView>

        <Box style={{ width: 360, minWidth: 340, borderLeftWidth: 1, borderLeftColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 12 }}>
            <Col style={{ gap: 12 }}>
              <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                    <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Mask catalog</Text>
                    <Text fontSize={10} color={COLORS.textDim}>Tap any effect to append it to the live stack.</Text>
                  </Col>
                  <MaskChip label={String(MASKS.length)} active={true} />
                </Row>
                <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                  {MASKS.map((mask) => (
                    <Box key={mask.id} style={{ flexBasis: 148, flexGrow: 1, minWidth: 148 }}>
                      <MaskCatalogCard maskId={mask.id} selected={stack.stack.some((item) => item.maskId === mask.id)} onAdd={() => stack.addMask(mask.id)} />
                    </Box>
                  ))}
                </Row>
              </Box>

              <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                    <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Active stack</Text>
                    <Text fontSize={10} color={COLORS.textDim}>{stack.stack.length === 0 ? 'No masks yet.' : 'Reorder, disable, or remove masks from the live stack.'}</Text>
                  </Col>
                  <MaskChip label={String(stack.stack.length)} active={stack.stack.length > 0} />
                </Row>
                <Col style={{ gap: 8 }}>
                  {stack.stack.length === 0 ? (
                    <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={10} color={COLORS.textDim}>Pick one of the masks above to start building a stack.</Text>
                    </Box>
                  ) : stack.stack.map((item) => (
                    <StackRow
                      key={item.id}
                      item={item}
                      selected={item.id === stack.selectedItem?.id}
                      onSelect={() => stack.setSelectedStackId(item.id)}
                      onToggle={() => stack.toggleMask(item.id)}
                      onMoveUp={() => stack.moveMask(item.id, -1)}
                      onMoveDown={() => stack.moveMask(item.id, 1)}
                      onRemove={() => stack.removeMask(item.id)}
                    />
                  ))}
                </Col>
              </Box>
            </Col>
          </ScrollView>
        </Box>
      </Row>

      <MediaImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onConfirm={(items) => items.forEach((item) => source.addMedia(item.kind === 'video' ? 'video' : 'image', item.path, item.name))}
      />
    </Col>
  );
}

export default MasksPanel;
