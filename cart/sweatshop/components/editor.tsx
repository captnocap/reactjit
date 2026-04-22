
import { Box, Col, CodeGutter, Minimap, Pressable, Row, ScrollView, Text, TextEditor } from '../../../runtime/primitives';
import { COLORS, TOKENS, fileGlyph, fileTone, inferFileType, languageForType, baseName, parentPath } from '../theme';
import { Glyph } from './shared';
import { editorAccentTone, editorTokenTone } from '../utils';
import { Pill } from './shared';
import { useDragToScroll } from '../hooks/useDragToScroll';

function EditorSurfaceImpl(props: any) {
  const _rT0 = Date.now();
  (globalThis as any).__hostLog?.(0, "[render] EditorSurface start t=" + _rT0);
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  const showMinimap = !compactBand && props.windowHeight >= 440;
  const showGutter = !minimumBand;
  const showBadges = !minimumBand;
  const lineStride = compactBand ? 17 : 18;
  const topPad = compactBand ? 12 : 14;
  const bottomPad = compactBand ? 14 : 18;
  const leftPad = compactBand ? 14 : 16;
  const rightPad = compactBand ? 36 : 44;
  const gutterWidth = showGutter ? (compactBand ? 58 : 70) : 0;
  const fileType = inferFileType(props.currentFilePath);
  const fileName = baseName(props.currentFilePath);
  const parent = parentPath(props.currentFilePath);
  const longestColumns = props.editorRows.reduce((max: number, row: any) => Math.max(max, row.charCount || row.text?.length || 0), 0);
  const editorWidth = Math.max(compactBand ? 620 : 860, longestColumns * (compactBand ? 6.9 : 7.35) + leftPad + rightPad);
  const editorHeight = Math.max(220, props.totalLines * lineStride + topPad + bottomPad);
  const canvasWidth = gutterWidth + editorWidth;
  const activePathRef = useRef(props.currentFilePath);
  const editorScrollRef = useRef(null);
  const editorScroll = useDragToScroll(editorScrollRef, {
    axis: 'both',
    inertia: false,
    grabCursor: true,
    surfaceKey: 'scrolling.editorDragToScroll',
  });

  useEffect(() => {
    if (activePathRef.current !== props.currentFilePath) {
      activePathRef.current = props.currentFilePath;
      editorScroll.setScroll(0, 0);
    }
  }, [editorScroll, props.currentFilePath]);

  const estimatedViewportHeight = Math.max(160, props.windowHeight - (compactBand ? 260 : 300));
  // The gutter needs to stay fully addressable so line numbers stay correct
  // on very large files. Minimap stays sampled.
  const gutterRowsSlice = props.editorRows;
  const gutterRows = useMemo(
    () => gutterRowsSlice.map((row: any) => ({
      line: row.line,
      marker: row.marker ? editorAccentTone(row.marker, false) : null,
    })),
    [gutterRowsSlice]
  );
  // Cap the minimap sample count regardless of large-file mode; otherwise a
  // 1000-line file mounts 1000 minimap nodes (4 host nodes each), blowing
  // the click-to-paint flush.
  const minimapSampleCount = Math.min(220, Math.max(32, Math.floor(estimatedViewportHeight / 2)));
  const minimapGroupSize = props.editorRows.length > 0 ? Math.max(1, Math.ceil(props.editorRows.length / Math.max(1, minimapSampleCount))) : 1;
  const minimapRows: any[] = [];
  if (showMinimap) {
    for (let idx = 0; idx < props.editorRows.length; idx += minimapGroupSize) {
      const slice = props.editorRows.slice(idx, Math.min(props.editorRows.length, idx + minimapGroupSize));
      if (slice.length === 0) continue;
      let previewWidth = 18;
      let marker = '';
      let active = false;
      for (const row of slice) {
        if (row.previewWidth > previewWidth) previewWidth = row.previewWidth;
        if (!marker && row.marker) marker = row.marker;
        if (row.line === props.cursorLine) active = true;
      }
      minimapRows.push({
        width: previewWidth,
        active,
        marker: marker ? editorAccentTone(marker, false) : null,
      });
    }
  }

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 10 }}>
        <Row style={{ gap: 10, alignItems: 'center', flexGrow: 1, flexBasis: 0 }}>
          <Glyph icon={fileGlyph(fileType)} tone={fileTone(fileType)} backgroundColor={COLORS.grayChip} />
          <Col style={{ gap: 3, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{fileName || props.currentFilePath}</Text>
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{parent === '.' ? 'workspace root' : parent}</Text> : null}
              <Text fontSize={10} color={COLORS.textDim}>{props.totalLines + ' lines'}</Text>
              {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{longestColumns + ' cols max'}</Text> : null}
            </Row>
          </Col>
        </Row>
        {showBadges ? (
          <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Pill label={props.languageMode} color={fileTone(fileType)} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} />
            <Pill label={props.largeFileMode ? 'large-file mode' : 'native syntax'} color={props.largeFileMode ? COLORS.yellow : COLORS.textMuted} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} />
            {props.modified ? <Pill label="modified" color={COLORS.yellow} backgroundColor={COLORS.yellowDeep} borderColor={COLORS.yellowDeep} tiny={true} /> : <Pill label="saved" color={COLORS.green} backgroundColor={COLORS.greenDeep} borderColor={COLORS.greenDeep} tiny={true} />}
            <Pressable onPress={props.onSave} style={{ padding: 8, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={10} color={COLORS.blue}>Save</Text>
            </Pressable>
          </Row>
        ) : null}
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: compactBand ? 8 : 10, gap: 10, backgroundColor: COLORS.panelBg }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusLg, backgroundColor: '#0a0f17', overflow: 'hidden' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: compactBand ? 10 : 12, paddingRight: compactBand ? 10 : 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#111a25', backgroundColor: '#0d131d' }}>
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill label={'Ln ' + props.cursorLine} color={COLORS.blue} backgroundColor={COLORS.blueDeep} borderColor={COLORS.blueDeep} tiny={true} />
              {!minimumBand ? <Pill label={'Col ' + props.cursorColumn} color={COLORS.textMuted} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} /> : null}
              {!minimumBand ? <Pill label={props.modified ? 'unsaved buffer' : 'in sync'} color={props.modified ? COLORS.yellow : COLORS.green} backgroundColor={props.modified ? COLORS.yellowDeep : COLORS.greenDeep} borderColor={props.modified ? COLORS.yellowDeep : COLORS.greenDeep} tiny={true} /> : null}
            </Row>
            {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.currentFilePath}</Text> : null}
          </Row>

          <ScrollView
            ref={editorScrollRef}
            showScrollbar={true}
            onScroll={editorScroll.onScroll}
            onMouseDown={editorScroll.onMouseDown}
            onMouseUp={editorScroll.onMouseUp}
            scrollX={editorScroll.scrollX}
            scrollY={editorScroll.scrollY}
            style={{ flexGrow: 1, height: '100%', backgroundColor: '#0a0f17', cursor: editorScroll.cursor }}
          >
            <Row style={{ minHeight: editorHeight, width: canvasWidth, alignItems: 'flex-start' }}>
              {showGutter ? (
                <CodeGutter
                  rows={gutterRows}
                  rowHeight={lineStride}
                  cursorLine={props.cursorLine}
                  fontSize={11}
                  activeBg="#0f1a29"
                  activeText={COLORS.blue}
                  textColor="#536176"
                  style={{ width: gutterWidth, minHeight: editorHeight, backgroundColor: '#091019', borderRightWidth: 1, borderColor: '#111a25', paddingTop: topPad, paddingBottom: bottomPad }}
                />
              ) : null}

              <Box style={{ width: editorWidth, height: editorHeight, position: 'relative', backgroundColor: '#0b1017' }}>
                <TextEditor
                  contentHandle={props.contentHandle || 0}
                  value={props.contentHandle ? '' : props.content}
                  onChange={props.onChange}
                  paintText={true}
                  colorRows={props.editorColorRows}
                  fontSize={13}
                  color={COLORS.text}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: editorWidth,
                    height: editorHeight,
                    paddingTop: topPad,
                    paddingBottom: bottomPad,
                    paddingLeft: leftPad,
                    paddingRight: rightPad,
                    borderWidth: 0,
                    lineHeight: lineStride,
                  }}
                />
              </Box>
            </Row>
          </ScrollView>
        </Col>

        {showMinimap ? (
          <Col style={{ width: 90, flexShrink: 0, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelRaised, padding: 8, gap: 3 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.textDim}>overview</Text>
              <Text fontSize={10} color={COLORS.textDim}>{props.totalLines}</Text>
            </Row>
            <Minimap
              rows={minimapRows}
              rowHeight={3}
              rowGap={1}
              activeColor={COLORS.blue}
              inactiveColor="#30363d"
              style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden' }}
            />
          </Col>
        ) : null}
      </Row>
    </Col>
  );
}

export const EditorSurface = memo(EditorSurfaceImpl);
