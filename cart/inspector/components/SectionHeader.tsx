import { Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../constants';

export default function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: any;
}) {
  return (
    <Row
      style={{
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 8,
      }}
    >
      <Text
        fontSize={10}
        color={COLORS.textMuted}
        style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 'bold' }}
      >
        {title}
      </Text>
      {right}
    </Row>
  );
}
