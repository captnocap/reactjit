import { Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

interface DiffHunkSummaryProps {
  hiddenCount: number;
  onToggle: () => void;
}

export function DiffHunkSummary(props: DiffHunkSummaryProps) {
  return (
    <Pressable onPress={props.onToggle}>
      <Row
        style={{
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.panelAlt,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Text fontSize={9} color={COLORS.textDim}>
          {props.hiddenCount} line{props.hiddenCount === 1 ? '' : 's'} hidden — click to expand
        </Text>
      </Row>
    </Pressable>
  );
}
