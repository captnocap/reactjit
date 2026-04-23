
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { SearchMatch } from './useSearchEngine';

export interface SearchReplaceProps {
  matches: SearchMatch[];
  disabled?: boolean;
  onConfirm?: (replacement: string, matches: SearchMatch[]) => void;
}

// Flow:
//   1. user types replacement string
//   2. presses PREVIEW — expands a list showing "old → new" for each match
//   3. presses CONFIRM — fires onConfirm with the full match list (host applies)
// CONFIRM is gated behind PREVIEW so you can't fat-finger a repo-wide edit.
export function SearchReplace({ matches, disabled, onConfirm }: SearchReplaceProps) {
  const [replacement, setReplacement] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmArmed, setConfirmArmed] = useState(false);

  const grouped = useMemo(() => {
    const by: Record<string, SearchMatch[]> = {};
    for (const m of matches) { (by[m.path] = by[m.path] || []).push(m); }
    return by;
  }, [matches]);

  const tone = COLORS.purple || '#d2a8ff';
  const danger = COLORS.red || '#ff6b6b';
  const nothing = matches.length === 0 || disabled;

  const renderReplacedLine = (m: SearchMatch): string => {
    const start = Math.max(0, m.col - 1);
    const end = Math.min(m.text.length, start + m.length);
    return m.text.slice(0, start) + replacement + m.text.slice(end);
  };

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 6, padding: 8, gap: 6,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>REPLACE</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{matches.length} hits · {Object.keys(grouped).length} files</Text>
      </Row>

      <Box style={{
        backgroundColor: COLORS.panelAlt || '#05090f',
        borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        paddingHorizontal: 8, paddingVertical: 4,
      }}>
        <TextInput
          value={replacement}
          placeholder="replacement (empty to delete matches)"
          onChangeText={(t: string) => { setReplacement(t); setPreviewOpen(false); setConfirmArmed(false); }}
          style={{ fontSize: 12, color: COLORS.textBright }}
        />
      </Box>

      <Row style={{ gap: 6 }}>
        <Pressable
          onPress={() => { if (!nothing) setPreviewOpen(!previewOpen); }}
          style={btnStyle(previewOpen ? tone : (COLORS.panelAlt || '#05090f'), tone, nothing)}
        >
          <Text style={{ color: previewOpen ? (COLORS.appBg || '#05090f') : tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            {previewOpen ? 'CLOSE PREVIEW' : 'PREVIEW ALL'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (nothing || !previewOpen) return;
            if (!confirmArmed) { setConfirmArmed(true); return; }
            onConfirm && onConfirm(replacement, matches);
            setConfirmArmed(false);
            setPreviewOpen(false);
          }}
          style={btnStyle(confirmArmed ? danger : (COLORS.panelAlt || '#05090f'), danger, nothing || !previewOpen)}
        >
          <Text style={{ color: confirmArmed ? (COLORS.appBg || '#05090f') : danger, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
            {confirmArmed ? 'CLICK AGAIN TO CONFIRM' : 'REPLACE ' + matches.length}
          </Text>
        </Pressable>
      </Row>

      {previewOpen ? (
        <ScrollView style={{ maxHeight: 200 }}>
          <Col style={{ gap: 2 }}>
            {Object.keys(grouped).map((path) => (
              <Col key={path} style={{ gap: 1, paddingVertical: 4 }}>
                <Text style={{ color: COLORS.blue || '#79c0ff', fontSize: 10, fontWeight: 700 }}>{path}</Text>
                {grouped[path].slice(0, 50).map((m) => (
                  <Col key={m.path + ':' + m.line + ':' + m.col} style={{ paddingLeft: 10, gap: 0 }}>
                    <Row style={{ gap: 6 }}>
                      <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, width: 12 }}>−</Text>
                      <Text style={{ color: COLORS.textDim, fontSize: 9, width: 32, textAlign: 'right' }}>{m.line}</Text>
                      <Text style={{ color: COLORS.textBright, fontSize: 11 }}>{m.text}</Text>
                    </Row>
                    <Row style={{ gap: 6 }}>
                      <Text style={{ color: COLORS.green || '#7ee787', fontSize: 9, width: 12 }}>+</Text>
                      <Text style={{ color: COLORS.textDim, fontSize: 9, width: 32, textAlign: 'right' }}>{m.line}</Text>
                      <Text style={{ color: COLORS.textBright, fontSize: 11 }}>{renderReplacedLine(m)}</Text>
                    </Row>
                  </Col>
                ))}
                {grouped[path].length > 50 ? (
                  <Text style={{ color: COLORS.textDim, fontSize: 9, paddingLeft: 10 }}>
                    … {grouped[path].length - 50} more hits in this file
                  </Text>
                ) : null}
              </Col>
            ))}
          </Col>
        </ScrollView>
      ) : null}
    </Col>
  );
}

function btnStyle(bg: string, border: string, disabled?: boolean): any {
  return {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4,
    backgroundColor: bg, borderWidth: 1, borderColor: border,
    opacity: disabled ? 0.4 : 1,
  };
}
