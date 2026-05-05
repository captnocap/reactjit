import { Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

interface Props {
  label: string;
  modeLabel: string;
}

export function PaletteFooter({ label, modeLabel }: Props) {
  return (
    <Row
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.panelBg,
      }}
    >
      <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
        {label}
      </Text>
      <Row style={{ gap: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: COLORS.textDim }}>
          {modeLabel}
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.textDim }}>
          &uarr;&darr; to navigate
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.textDim }}>
          &crarr; to run
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
          ESC to close
        </Text>
      </Row>
    </Row>
  );
}
