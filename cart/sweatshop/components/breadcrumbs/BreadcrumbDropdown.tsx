const React: any = require('react');
import { Box, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS, fileGlyph, fileTone } from '../../theme';
import { Glyph } from '../shared';
import type { FileItem } from '../../types';

export function BreadcrumbDropdown(props: {
  siblings: FileItem[];
  onSelectPath: (path: string) => void;
  onClose: () => void;
}) {
  const { siblings, onSelectPath, onClose } = props;
  return (
    <Box
      style={{
        position: 'absolute',
        top: 26,
        left: 0,
        backgroundColor: COLORS.panelRaised,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: 180,
        maxHeight: 260,
        zIndex: 20,
      }}
    >
      <ScrollView showScrollbar={true}>
        {siblings.length > 0 ? (
          siblings.map((sib: FileItem) => (
            <Pressable
              key={sib.path}
              onPress={() => {
                onSelectPath(sib.path);
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
              }}
            >
              <Glyph icon={fileGlyph(sib.type)} tone={fileTone(sib.type)} backgroundColor={COLORS.grayChip} tiny={true} />
              <Text fontSize={11} color={COLORS.text}>{sib.name}</Text>
            </Pressable>
          ))
        ) : (
          <Box style={{ padding: 10 }}>
            <Text fontSize={10} color={COLORS.textDim}>No siblings</Text>
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
