import { Box, Pressable, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

interface SplitAddHandleProps {
  direction: 'horizontal' | 'vertical';
  edge: 'start' | 'end';
  onSplit: () => void;
}

export function SplitAddHandle(props: SplitAddHandleProps) {
  const isHorizontal = props.direction === 'horizontal';
  const style: any = {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: TOKENS.radiusPill,
    backgroundColor: COLORS.panelRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  };

  if (isHorizontal) {
    style.top = '50%';
    style.marginTop = -8;
    style[props.edge] = -8;
  } else {
    style.left = '50%';
    style.marginLeft = -8;
    style[props.edge] = -8;
  }

  return (
    <Pressable onPress={props.onSplit} style={style}>
      <Text fontSize={10} color={COLORS.blue}>+</Text>
    </Pressable>
  );
}
