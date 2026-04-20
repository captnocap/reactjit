import { Row, Text, Pressable, Box } from '../../runtime/primitives';
import { COLORS } from '../constants';

export default function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)}>
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Box
          style={{
            width: 26,
            height: 14,
            borderRadius: 7,
            backgroundColor: value ? COLORS.accent : COLORS.border,
            alignItems: value ? 'flex-end' : 'flex-start' as any,
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: COLORS.textBright,
            }}
          />
        </Box>
        <Text fontSize={10} color={COLORS.text}>{label}</Text>
      </Row>
    </Pressable>
  );
}
