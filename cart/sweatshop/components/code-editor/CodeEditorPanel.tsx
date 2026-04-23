
import { Col, Row, Box, Text, Pressable, ScrollView, TextEditor } from '../../../../runtime/primitives';
import { COLORS, TOKENS, fileGlyph, fileTone, inferFileType, baseName, parentPath, languageForType } from '../../theme';
import { Glyph, Pill } from '../shared';
import { editorTokenTone } from '../../utils';
import { useCodeTokenize } from './useCodeTokenize';
import { useCodeHistory } from './useCodeHistory';
import { useCodeKeymap, KeymapMode } from './useCodeKeymap';
import { useCodeFolding } from './useCodeFolding';
import { CodeGutter } from './CodeGutter';
import { CodeMinimap } from './CodeMinimap';

const host: any = globalThis;

function storeGet(key: string, fallback: any) {
  try {
    const raw = host.__store_get?.(key);
    return raw !== undefined ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function storeSet(key: string, value: any) {
  try { host.__store_set?.(key, JSON.stringify(value)); } catch {}
}

export interface CodeEditorPanelProps {
  content: string;
  contentHandle?: number;
  currentFilePath: string;
  cursorLine?: number;
  cursorColumn?: number;
  modified?: number;
  totalLines?: number;
  widthBand?: string;
  windowHeight?: number;
  onChange: (text: string) => void;
  onSave?: () => void;
}

export function CodeEditorPanel(props: CodeEditorPanelProps) {
  const {
    content,
    contentHandle = 0,
    currentFilePath,
    cursorLine = 1,
    cursorColumn = 1,
    modified = 0,
    totalLines: propTotalLines,
    widthBand = 'desktop',
    windowHeight = 800,
    onChange,
    onSave,
  } = props;

  const compactBand = widthBand === 'narrow' || widthBand === 'widget' || widthBand === 'minimum';
  const minimumBand = widthBand === 'minimum';

  const fileType = inferFileType(currentFilePath);
  const fileName = baseName(currentFilePath);
  const parent = parentPath(currentFilePath);
  const language = languageForType(fileType);

  const [fontSize, setFontSize] = useState(() => storeGet('sweatshop.editor.fontSize', compactBand ? 11 : 13));
  const [showMinimap, setShowMinimap] = useState(() => storeGet('sweatshop.editor.showMinimap', !compactBand && windowHeight >= 440));
  const [showLineNumbers, setShowLineNumbers] = useState(() => storeGet('sweatshop.editor.showLineNumbers', !minimumBand));
  const [keymapMode, setKeymapMode] = useState<KeymapMode>(() => storeGet('sweatshop.editor.keymap', 'default'));
  const [tabWidth, setTabWidth] = useState(() => storeGet('sweatshop.editor.tabWidth', 2));

  useEffect(() => { storeSet('sweatshop.editor.fontSize', fontSize); }, [fontSize]);
  useEffect(() => { storeSet('sweatshop.editor.showMinimap', showMinimap); }, [showMinimap]);
  useEffect(() => { storeSet('sweatshop.editor.showLineNumbers', showLineNumbers); }, [showLineNumbers]);
  useEffect(() => { storeSet('sweatshop.editor.keymap', keymapMode); }, [keymapMode]);
  useEffect(() => { storeSet('sweatshop.editor.tabWidth', tabWidth); }, [tabWidth]);

  const tokenLines = useCodeTokenize(content, language);
  const colorRows = useMemo(
    () => tokenLines.map((toks) => toks.map((t) => ({ text: t.text, color: editorTokenTone(t.kind) }))),
    [tokenLines]
  );

  const history = useCodeHistory(content);
  const folds = useCodeFolding(content);

  useEffect(() => {
    history.setValue(content);
  }, [currentFilePath]);

  const handleChange = useCallback(
    (next: string) => {
      onChange(next);
      history.push(next);
    },
    [onChange, history.push]
  );

  useCodeKeymap(keymapMode, {
    undo: history.undo,
    redo: history.redo,
    save: onSave || (() => {}),
  });

  const lines = content.split('\n');
  const totalLines = propTotalLines ?? lines.length;
  const longestColumns = lines.reduce((max, row) => Math.max(max, row.length), 0);

  const lineHeight = fontSize + 5;
  const topPad = compactBand ? 10 : 12;
  const bottomPad = compactBand ? 12 : 16;
  const leftPad = compactBand ? 12 : 14;
  const rightPad = compactBand ? 28 : 36;
  const gutterWidth = showLineNumbers ? 48 : 0;
  const minimapWidth = showMinimap && !compactBand ? 80 : 0;
  const editorWidth = Math.max(compactBand ? 580 : 800, longestColumns * (fontSize * 0.55) + leftPad + rightPad);
  const editorHeight = Math.max(220, totalLines * lineHeight + topPad + bottomPad);
  const canvasWidth = gutterWidth + editorWidth + minimapWidth;

  const visibleStart = Math.max(1, cursorLine - 20);
  const visibleEnd = Math.min(totalLines, cursorLine + 20);

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 8 : 10, backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 8 }}>
        <Row style={{ gap: 8, alignItems: 'center', flexGrow: 1, flexBasis: 0 }}>
          <Glyph icon={fileGlyph(fileType)} tone={fileTone(fileType)} backgroundColor={COLORS.grayChip} />
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{fileName || currentFilePath}</Text>
            <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{parent === '.' ? 'workspace root' : parent}</Text> : null}
              <Text fontSize={10} color={COLORS.textDim}>{totalLines + ' lines'}</Text>
            </Row>
          </Col>
        </Row>
        <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Pill label={language} color={fileTone(fileType)} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} />
          {modified ? <Pill label="modified" color={COLORS.yellow} backgroundColor={COLORS.yellowDeep} borderColor={COLORS.yellowDeep} tiny={true} /> : <Pill label="saved" color={COLORS.green} backgroundColor={COLORS.greenDeep} borderColor={COLORS.greenDeep} tiny={true} />}
          <Pressable onPress={onSave} style={{ padding: 6, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
            <Text fontSize={10} color={COLORS.blue}>Save</Text>
          </Pressable>
        </Row>
      </Row>

      <Row style={{ paddingHorizontal: 8, paddingVertical: 4, gap: 6, alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, flexWrap: 'wrap' }}>
        <Pressable onPress={() => setFontSize((s: number) => Math.max(8, s - 1))}><Text fontSize={10} color={COLORS.textDim}>A-</Text></Pressable>
        <Text fontSize={10} color={COLORS.text}>{fontSize}px</Text>
        <Pressable onPress={() => setFontSize((s: number) => Math.min(32, s + 1))}><Text fontSize={10} color={COLORS.textDim}>A+</Text></Pressable>
        <Box style={{ width: 1, height: 14, backgroundColor: COLORS.borderSoft, marginHorizontal: 4 }} />
        <Pressable onPress={() => setShowMinimap((v: boolean) => !v)}>
          <Text fontSize={10} color={showMinimap ? COLORS.blue : COLORS.textDim}>Minimap</Text>
        </Pressable>
        <Pressable onPress={() => setShowLineNumbers((v: boolean) => !v)}>
          <Text fontSize={10} color={showLineNumbers ? COLORS.blue : COLORS.textDim}>Lines</Text>
        </Pressable>
        <Box style={{ width: 1, height: 14, backgroundColor: COLORS.borderSoft, marginHorizontal: 4 }} />
        {(['default', 'vim', 'emacs'] as KeymapMode[]).map((m) => (
          <Pressable key={m} onPress={() => setKeymapMode(m)}>
            <Text fontSize={10} color={keymapMode === m ? COLORS.blue : COLORS.textDim}>{m}</Text>
          </Pressable>
        ))}
        <Box style={{ width: 1, height: 14, backgroundColor: COLORS.borderSoft, marginHorizontal: 4 }} />
        <Text fontSize={10} color={COLORS.textDim}>Tab:</Text>
        {[2, 4].map((t) => (
          <Pressable key={t} onPress={() => setTabWidth(t)}>
            <Text fontSize={10} color={tabWidth === t ? COLORS.blue : COLORS.textDim}>{t}</Text>
          </Pressable>
        ))}
        <Box style={{ flexGrow: 1 }} />
        <Pill label={'Ln ' + cursorLine} color={COLORS.blue} backgroundColor={COLORS.blueDeep} borderColor={COLORS.blueDeep} tiny={true} />
        {!minimumBand ? <Pill label={'Col ' + cursorColumn} color={COLORS.textMuted} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} /> : null}
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: compactBand ? 6 : 8, gap: 8, backgroundColor: COLORS.panelBg }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusLg, backgroundColor: '#0a0f17', overflow: 'hidden' }}>
          <ScrollView showScrollbar={true} style={{ flexGrow: 1, height: '100%', backgroundColor: '#0a0f17' }}>
            <Row style={{ minHeight: editorHeight, width: canvasWidth - minimapWidth, alignItems: 'flex-start' }}>
              {showLineNumbers && (
                <CodeGutter
                  lineCount={totalLines}
                  cursorLine={cursorLine}
                  fontSize={fontSize}
                  foldedLines={folds.foldedLines}
                  onToggleFold={folds.toggleFold}
                  foldableLines={new Set(folds.folds.map((f) => f.startLine + 1))}
                />
              )}
              <Box style={{ width: editorWidth, height: editorHeight, position: 'relative', backgroundColor: '#0b1017' }}>
                <TextEditor
                  contentHandle={contentHandle || 0}
                  value={contentHandle ? '' : content}
                  onChange={handleChange}
                  paintText={true}
                  colorRows={colorRows}
                  fontSize={fontSize}
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
                    lineHeight,
                    tabWidth,
                  }}
                />
              </Box>
            </Row>
          </ScrollView>
        </Col>

        {showMinimap && !compactBand ? (
          <Col style={{ width: minimapWidth, flexShrink: 0, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelRaised, padding: 6, gap: 2 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text fontSize={9} color={COLORS.textDim}>overview</Text>
              <Text fontSize={9} color={COLORS.textDim}>{totalLines}</Text>
            </Row>
            <CodeMinimap
              tokenLines={tokenLines}
              fontSize={fontSize}
              visibleStart={visibleStart}
              visibleEnd={visibleEnd}
              width={minimapWidth - 12}
            />
          </Col>
        ) : null}
      </Row>
    </Col>
  );
}
