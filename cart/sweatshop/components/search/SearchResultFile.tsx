import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { SearchResultLine } from './SearchResultLine';
import type { SearchMatch } from './useSearchEngine';

export interface SearchResultFileProps {
  path: string;
  matches: SearchMatch[];
  collapsed?: boolean;
  onToggle?: (path: string) => void;
  selectedKey?: string;
  showContext?: boolean;
  onOpenLine?: (m: SearchMatch) => void;
  onHoverLine?: (m: SearchMatch | null) => void;
}

function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

export function SearchResultFile(props: SearchResultFileProps) {
  const { path, matches, collapsed, onToggle, selectedKey, showContext, onOpenLine, onHoverLine } = props;
  const tone = COLORS.blue || '#79c0ff';

  return (
    <Col style={{
      marginBottom: 4,
      borderRadius: 6,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      overflow: 'hidden',
    }}>
      <Pressable onPress={() => onToggle && onToggle(path)}>
        <Row style={{
          alignItems: 'center', gap: 6,
          paddingHorizontal: 8, paddingVertical: 6,
          backgroundColor: COLORS.panelRaised || '#05090f',
          borderBottomWidth: collapsed ? 0 : 1,
          borderColor: COLORS.border || '#1f2630',
        }}>
          <Text style={{ color: COLORS.textDim, fontSize: 10, width: 12 }}>{collapsed ? '▸' : '▾'}</Text>
          <Text style={{ color: tone, fontSize: 11, fontWeight: 700 }}>{basename(path)}</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{dirname(path)}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Box style={{
            paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
            backgroundColor: COLORS.blueDeep || '#173048',
            borderWidth: 1, borderColor: tone,
          }}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>{matches.length}</Text>
          </Box>
        </Row>
      </Pressable>

      {collapsed ? null : (
        <Col style={{ gap: 0 }}>
          {matches.map((m) => {
            const key = m.path + ':' + m.line + ':' + m.col;
            return (
              <SearchResultLine
                key={key}
                match={m}
                selected={selectedKey === key}
                showContext={showContext}
                onClick={onOpenLine}
                onHover={onHoverLine}
              />
            );
          })}
        </Col>
      )}
    </Col>
  );
}
