import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Glyph } from '../shared';
import type { DiffHunk } from '../../app/diff-helpers';
import { hunkToText, copyToClipboard } from '../../app/diff-helpers';

interface DiffHunkHeaderProps {
  hunk: DiffHunk;
  collapsed: boolean;
  onToggle: () => void;
}

export function DiffHunkHeader(props: DiffHunkHeaderProps) {
  return (
    <Row
      style={{
        height: 18,
        alignItems: 'center',
        paddingLeft: 8,
        paddingRight: 8,
        backgroundColor: COLORS.panelRaised,
        borderBottomWidth: 1,
        borderColor: COLORS.borderSoft,
      }}
    >
      <Pressable onPress={props.onToggle}>
        <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
          {props.collapsed ? '▶' : '▼'}
        </Text>
      </Pressable>
      <Text fontSize={9} color={COLORS.textMuted} style={{ marginLeft: 8 }}>
        {props.hunk.header}
      </Text>
      <Box style={{ flexGrow: 1 }} />
      <Pressable onPress={() => copyToClipboard(hunkToText(props.hunk))}>
        <Row style={{ alignItems: 'center', gap: 4 }}>
          <Glyph icon="copy" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
          <Text fontSize={9} color={COLORS.textDim}>
            Copy
          </Text>
        </Row>
      </Pressable>
    </Row>
  );
}
