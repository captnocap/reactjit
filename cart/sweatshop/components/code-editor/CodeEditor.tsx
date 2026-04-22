import { Row, Box, TextEditor } from '../../../../runtime/primitives';
import { editorTokenTone } from '../../utils';
import { COLORS } from '../../theme';
import { useCodeTokenize } from './useCodeTokenize';
import { useCodeHistory } from './useCodeHistory';
import { useCodeKeymap, KeymapMode } from './useCodeKeymap';
import { useCodeFolding } from './useCodeFolding';
import { CodeGutter } from './CodeGutter';
import { CodeMinimap } from './CodeMinimap';

export interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave?: () => void;
  language?: string;
  filePath?: string;
  fontSize?: number;
  lineWrap?: boolean;
  showMinimap?: boolean;
  showLineNumbers?: boolean;
  keymapMode?: KeymapMode;
  tabWidth?: number;
  width?: number;
  height?: number;
}

export function CodeEditor(props: CodeEditorProps) {
  const {
    value,
    onChange,
    onSave,
    language = 'typescript',
    fontSize = 13,
    showMinimap = true,
    showLineNumbers = true,
    keymapMode = 'default',
    tabWidth = 2,
    width = 800,
    height = 600,
  } = props;

  const tokenLines = useCodeTokenize(value, language);
  const colorRows = useMemo(
    () => tokenLines.map((toks) => toks.map((t) => ({ text: t.text, color: editorTokenTone(t.kind) }))),
    [tokenLines]
  );

  const history = useCodeHistory(value);
  const folds = useCodeFolding(value);

  const [cursorLine, setCursorLine] = useState(1);

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

  const lines = value.split('\n');
  const lineCount = lines.length;

  const visibleStart = Math.max(1, cursorLine - 20);
  const visibleEnd = Math.min(lineCount, cursorLine + 20);

  const gutterWidth = showLineNumbers ? 48 : 0;
  const minimapWidth = showMinimap ? 80 : 0;
  const editorW = Math.max(200, width - gutterWidth - minimapWidth);
  const lineHeight = fontSize + 5;
  const editorH = Math.max(lineCount * lineHeight, height);

  return (
    <Row style={{ width, height, backgroundColor: COLORS.panelRaised, overflow: 'hidden' }}>
      {showLineNumbers && (
        <CodeGutter
          lineCount={lineCount}
          cursorLine={cursorLine}
          fontSize={fontSize}
          foldedLines={folds.foldedLines}
          onToggleFold={folds.toggleFold}
          foldableLines={new Set(folds.folds.map((f) => f.startLine + 1))}
        />
      )}
      <Box style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
        <TextEditor
          value={value}
          onChange={handleChange}
          paintText={true}
          colorRows={colorRows}
          fontSize={fontSize}
          color={COLORS.text}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: editorW,
            height: editorH,
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 8,
            paddingRight: 8,
            borderWidth: 0,
            lineHeight,
            tabWidth,
          }}
        />
      </Box>
      {showMinimap && (
        <CodeMinimap
          tokenLines={tokenLines}
          fontSize={fontSize}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          width={minimapWidth}
        />
      )}
    </Row>
  );
}
