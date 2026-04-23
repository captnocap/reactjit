
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS, fileGlyph, fileTone, inferFileType } from '../../theme';
import { Icon } from '../icons';
import type { ImportGraphNode } from './useImportGraph';

function typeForExt(ext: string): string {
  const clean = String(ext || '').toLowerCase().replace(/^\./, '');
  if (clean === 'tsx' || clean === 'ts' || clean === 'jsx' || clean === 'js') return clean;
  if (clean === 'json') return 'json';
  if (clean === 'md') return 'md';
  if (clean === 'css') return 'css';
  if (clean === 'zig') return 'zig';
  return inferFileType('x.' + clean);
}

function KeyRow(props: { icon: string; color: string; label: string; detail?: string }) {
  return (
    <Row style={{ gap: 6, alignItems: 'center' }}>
      <Icon name={props.icon as any} size={12} color={props.color} />
      <Text fontSize={10} color={COLORS.textBright}>{props.label}</Text>
      {props.detail ? <Text fontSize={9} color={COLORS.textDim}>{props.detail}</Text> : null}
    </Row>
  );
}

export function GraphLegend(props: {
  nodes: ImportGraphNode[];
  filterExt: string;
  onFilterChange: (ext: string) => void;
}) {
  const extCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of props.nodes) {
      if (!node.local) continue;
      const ext = String(node.ext || '').toLowerCase();
      if (!ext) continue;
      map.set(ext, (map.get(ext) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [props.nodes]);

  return (
    <Col style={{ gap: 8, padding: 10, borderTopWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Legend</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.nodes.length} nodes</Text>
      </Row>

      <Row style={{ gap: 12, flexWrap: 'wrap' }}>
        <KeyRow icon="folder" color={COLORS.blue} label="Current file" />
        <KeyRow icon="file" color={COLORS.green} label="Local import" />
        <KeyRow icon="question-mark" color={COLORS.textDim} label="External module" />
      </Row>

      {extCounts.length > 0 ? (
        <Col style={{ gap: 6 }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>File types</Text>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            <Pressable onPress={() => props.onFilterChange('all')} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.filterExt === 'all' ? COLORS.blue : COLORS.border, backgroundColor: props.filterExt === 'all' ? COLORS.blueDeep : COLORS.panelAlt }}>
              <Text fontSize={9} color={props.filterExt === 'all' ? COLORS.blue : COLORS.textDim}>all</Text>
            </Pressable>
            {extCounts.map(([ext, count]) => {
              const tone = fileTone(typeForExt(ext));
              const active = props.filterExt === ext;
              return (
                <Pressable key={ext} onPress={() => props.onFilterChange(ext)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: active ? tone : COLORS.border, backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt }}>
                  <Box style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
                    <Text fontSize={8} color={tone} style={{ fontWeight: 'bold' }}>{fileGlyph(typeForExt(ext))}</Text>
                  </Box>
                  <Text fontSize={9} color={active ? tone : COLORS.textBright}>{ext}</Text>
                  <Text fontSize={9} color={COLORS.textDim}>{count}</Text>
                </Pressable>
              );
            })}
          </Row>
        </Col>
      ) : null}
    </Col>
  );
}
