import { Box, Col, Pressable, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { PaletteCommand } from './types';

interface Props {
  cmd: PaletteCommand;
  isSelected: boolean;
  isGotoFileMode: boolean;
  isShellMode: boolean;
  onRun: () => void;
}

export function PaletteRow({ cmd, isSelected, isGotoFileMode, isShellMode, onRun }: Props) {
  return (
    <Pressable
      onPress={onRun}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: isSelected ? 'rgba(45,98,255,0.15)' : 'transparent',
        borderLeftWidth: 3,
        borderLeftColor: isSelected ? COLORS.blue : 'transparent',
      }}
    >
      <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
        <Text
          style={{
            fontSize: 12,
            color: isSelected ? COLORS.blue : COLORS.textBright,
            fontWeight: isSelected ? 'bold' : 'normal',
          }}
        >
          {cmd.label}
        </Text>
        {cmd.category && !isGotoFileMode && !isShellMode ? (
          <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
            {cmd.category}
          </Text>
        ) : null}
      </Col>
      {cmd.shortcut ? (
        <Box
          style={{
            backgroundColor: COLORS.panelAlt,
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            marginLeft: 8,
          }}
        >
          <Text style={{ fontSize: 9, color: COLORS.textDim }}>
            {cmd.shortcut}
          </Text>
        </Box>
      ) : null}
    </Pressable>
  );
}
